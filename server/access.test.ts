import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import accessHandler from '../api/access.ts'
import { createAccessService, seal, unseal, trialActive, proxyPath } from '../api/access.ts'
const uid='1a9ff780-4164-4952-a9af-cbf41cc02042'
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_private',VITE_SUPABASE_ANON_KEY:'public'}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')

test('paid API blocks expired, refunded, revoked, site-only and excluded models',async()=>{
 const id='11111111-1111-4111-8111-111111111111'
 const paid={user_id:uid,subscription_id:id,encrypted_upstream:seal('private-bridge',env.SUPABASE_SERVICE_ROLE_KEY,`${uid}:paid:${id}:upstream`),paid_until:new Date(Date.now()+86400000).toISOString(),revoked_at:null,api_enabled:true,models:['gpt-6-astra'],entitled:true}
 for(const change of [{paid_until:new Date(Date.now()-1).toISOString()},{entitled:false},{revoked_at:new Date().toISOString()},{api_enabled:false}]){
  const service=createAccessService(env,(async()=>Response.json([{...paid,...change}])) as typeof fetch)
  await assert.rejects(service.authorizePaid('sk-sp-test','gpt-6-astra'),{status:403})
 }
 const service=createAccessService(env,(async()=>Response.json([paid])) as typeof fetch)
 await assert.rejects(service.authorizePaid('sk-sp-test','claude-fable-5-1'),{status:403})
 assert.equal((await service.authorizePaid('sk-sp-test','gpt-6-astra')).token,'private-bridge')
})
test('expired or revoked trials cannot recover an upstream credential',async()=>{
  for(const dates of [{expires_at:new Date(Date.now()-1).toISOString(),revoked_at:null},{expires_at:new Date(Date.now()+86400000).toISOString(),revoked_at:new Date().toISOString()}]){
    const service=createAccessService(env,(async()=>Response.json([{user_id:uid,encrypted_upstream:'not-decryptable',...dates}])) as typeof fetch)
    await assert.rejects(service.authorize('sk-sx-expired'),{status:403})
  }
  assert.equal(trialActive({expires_at:'2026-11-09T00:00:00Z',revoked_at:null},Date.parse('2026-11-09T00:00:00Z')),false)
})
test('trial activation validates the session and confirmed email before generating an access',async()=>{
  let calls=0
  const service=createAccessService(env,(async()=>{calls++;return Response.json({id:uid})}) as typeof fetch)
  await assert.rejects(service.start(),{status:401});assert.equal(calls,0)
  await assert.rejects(service.start('Bearer valid'),{status:403});assert.equal(calls,1)
})
test('activation stores encrypted credentials and hashes; the private bridge token is never returned',async()=>{
  let saved:Record<string,string>={}
  const service=createAccessService(env,(async(url:string|URL|Request,init?:RequestInit)=>{
    if(String(url).endsWith('/auth/v1/user'))return Response.json({id:uid,email_confirmed_at:new Date().toISOString()})
    saved=JSON.parse(String(init?.body))
    return Response.json({user_id:uid,gateway_client_id:'client-id',encrypted_token:saved.p_encrypted_token,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+7*86400000).toISOString(),revoked_at:null})
  }) as typeof fetch)
  const result=await service.start('Bearer verified')
  assert.match(result.key!,/^sk-sx-[A-Za-z0-9_-]{43}$/)
  assert.equal(saved.p_user_id,uid)
  assert.equal(saved.p_hash,hash(result.key!))
  assert.ok(!JSON.stringify(saved).includes(result.key!))
  const upstream=unseal(saved.p_encrypted_upstream,env.SUPABASE_SERVICE_ROLE_KEY,`${uid}:upstream`)
  assert.match(upstream,/^sk-flg-/);assert.ok(!JSON.stringify(result).includes(upstream))
})
test('encryption binds delivery to its user and purpose and rejects altered data',()=>{
  const encrypted=seal('private-key','server-secret',`${uid}:public`)
  assert.equal(unseal(encrypted,'server-secret',`${uid}:public`),'private-key')
  assert.throws(()=>unseal(encrypted,'server-secret',`${uid}:upstream`))
  assert.throws(()=>unseal(encrypted,'different-secret',`${uid}:public`))
})
test('the proxy accepts inference paths and refuses admin, traversal and external hosts',()=>{
  for(const path of ['/v1/responses','/v1/messages/count_tokens','/glm/v1/models','/api/codex/models'])assert.equal(proxyPath(path),path)
  for(const path of ['https://example.com','//example.com/v1/models','/api/admin/clients','/v1/../api/admin','/v1/%2e%2e/admin'])assert.throws(()=>proxyPath(path),{status:400})
})
test('missing trials are rejected instead of falling through to legacy authentication',async()=>{
  const service=createAccessService(env,(async()=>Response.json([])) as typeof fetch)
  await assert.rejects(service.authorize('sk-sx-unknown'),{status:401})
})
test('legacy inference retains streaming, credentials and query options through the proxy',async()=>{
  const nativeFetch=globalThis.fetch
  let capturedUrl='',capturedBody='',capturedKey=''
  globalThis.fetch=(async(url:string|URL|Request,init?:RequestInit)=>{
    capturedUrl=String(url);capturedBody=Buffer.from(init?.body as Uint8Array).toString();capturedKey=(init?.headers as Record<string,string>)['x-api-key']
    return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('event: first\ndata: 1\n\n'));controller.enqueue(new TextEncoder().encode('event: done\ndata: 2\n\n'));controller.close()}}),{headers:{'Content-Type':'text/event-stream'}})
  }) as typeof fetch
  const server=createServer(accessHandler)
  try{
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
    const address=server.address() as {port:number}
    const response=await nativeFetch(`http://127.0.0.1:${address.port}/api/access?action=proxy&path=/v1/messages&beta=true`,{
      method:'POST',headers:{'Content-Type':'application/json','x-api-key':'sk-flg-existing-test'},body:JSON.stringify({model:'claude-fable-5-1',stream:true})})
    assert.equal(response.status,200)
    assert.equal(response.headers.get('content-type'),'text/event-stream')
    assert.equal(await response.text(),'event: first\ndata: 1\n\nevent: done\ndata: 2\n\n')
    assert.equal(capturedUrl,'https://66cloud.vercel.app/v1/messages?beta=true')
    assert.equal(capturedKey,'sk-flg-existing-test')
    assert.deepEqual(JSON.parse(capturedBody),{model:'claude-fable-5-1',stream:true})
  }finally{globalThis.fetch=nativeFetch;await new Promise<void>(resolve=>{server.closeAllConnections();server.close(()=>resolve())})}
})
