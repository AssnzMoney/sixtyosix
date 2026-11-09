import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createAccountService } from '../api/account.ts'

const uid = '1a9ff780-4164-4952-a9af-cbf41cc02042'
const own = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const config = { url: 'https://example.supabase.co', secret:'server-only-secret', publicKey:'public-key' }
function fixture() {
  const calls: {url:URL;init:RequestInit}[] = []
  const fake = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input)); calls.push({url,init})
    if (url.pathname === '/auth/v1/user') return Response.json({id:uid,email_confirmed_at:'2026-01-01T00:00:00Z'})
    if (url.pathname.endsWith('/gateway_clients')) {
      if (init.method === 'PATCH') return Response.json([])
      return Response.json([{id:own,name:'Meu acesso',enabled:true,created_at:'2026-01-01',key_prefix:'sk-flg-test'}])
    }
    if (url.pathname.endsWith('/gateway_usage')) return Response.json([{id:1,client_id:own,requested_alias:'gpt-6-astra',input_tokens:500,output_tokens:20,status_code:200,created_at:'2026-01-01'}])
    if (url.pathname.includes('/rpc/')) return Response.json(own)
    throw new Error('Unexpected destination')
  }
  return {calls,service:createAccountService(config,fake as typeof fetch)}
}
test('rejects an unsigned or invalid session before reading data',async()=>{
  const {calls,service}=fixture()
  await assert.rejects(service.execute('GET','summary'),{status:401})
  assert.equal(calls.length,0)
  const invalid=createAccountService(config,(async()=>new Response('{}',{status:401})) as typeof fetch)
  await assert.rejects(invalid.execute('GET','summary','Bearer fake'),{status:401})
})
test('reads only the verified user and owned keys; ignores client-supplied owner',async()=>{
  const {calls,service}=fixture()
  const result=await service.execute('GET','summary','Bearer verified',{user_id:other},new URLSearchParams({from:'2026-01-01',to:'2026-01-02',timezone:'180'}))
  const clients=calls.find(c=>c.url.pathname.endsWith('/gateway_clients'))!
  const usage=calls.find(c=>c.url.pathname.endsWith('/gateway_usage'))!
  assert.equal(clients.url.searchParams.get('user_id'),`eq.${uid}`)
  assert.equal(usage.url.searchParams.get('client_id'),`in.(${own})`)
  assert.match(usage.url.searchParams.get('and')!,/2026-01-01T03:00:00.000Z/)
  assert.ok(!JSON.stringify(result).includes('server-only-secret'))
  assert.ok(!usage.url.searchParams.get('select')!.includes('upstream_model'))
})
test('foreign keys cannot be revoked',async()=>{
  const {calls,service}=fixture()
  await assert.rejects(service.execute('POST','revoke','Bearer verified',{id:other,user_id:other}),{status:404})
  const patch=calls.find(c=>c.init.method==='PATCH')!
  assert.equal(patch.url.searchParams.get('user_id'),`eq.${uid}`)
})
test('issues a gateway-compatible key and stores only its SHA-256 hash',async()=>{
  const {calls,service}=fixture()
  const result=await service.execute('POST','keys','Bearer verified',{name:'Notebook'}) as {key:string}
  assert.match(result.key,/^sk-flg-[A-Za-z0-9_-]{43}$/)
  const write=calls.find(c=>c.url.pathname.endsWith('account_issue_gateway_key'))!
  const body=JSON.parse(String(write.init.body))
  assert.equal(body.p_user_id,uid)
  assert.equal(body.p_token_hash,createHash('sha256').update(result.key).digest('hex'))
  assert.ok(!String(write.init.body).includes(result.key))
})
test('rejects malformed periods and does not silently truncate to first page',async()=>{
  const {calls,service}=fixture()
  await assert.rejects(service.execute('GET','summary','Bearer verified',{},new URLSearchParams({from:'2026-02-31',to:'2026-03-04'})),{status:400})
  await service.execute('GET','summary','Bearer verified',{},new URLSearchParams({from:'2026-01-01',to:'2026-01-02',offset:'1000'}))
  assert.equal(calls.find(c=>c.url.pathname.endsWith('/gateway_usage'))!.url.searchParams.get('offset'),'1000')
})
test('accepts the empty 204 response returned by a successful key claim',async()=>{
  const fake = async (input: string | URL | Request) => String(input).includes('/auth/v1/user')
    ? Response.json({id:uid,email_confirmed_at:'2026-01-01T00:00:00Z'}) : new Response(null,{status:204})
  const service=createAccountService(config,fake as typeof fetch)
  assert.deepEqual(await service.execute('POST','claim','Bearer verified',{key:'sk-flg-'+'a'.repeat(43)}),{ok:true})
})

test('unconfirmed accounts cannot read usage, claim or issue keys',async()=>{
  let calls=0
  const service=createAccountService(config,(async()=>{calls++;return Response.json({id:uid})}) as typeof fetch)
  for (const [method,path] of [['GET','summary'],['POST','keys'],['POST','claim']]) {
    await assert.rejects(service.execute(method,path,'Bearer verified',{name:'Notebook'}),{status:403})
  }
  assert.equal(calls,3)
})
