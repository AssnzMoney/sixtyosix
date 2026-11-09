import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { receiveNotification, validateSignature } from '../api/mercadopago.ts'

const env = { MERCADOPAGO_WEBHOOK_SECRET:'webhook-secret', MERCADOPAGO_ACCESS_TOKEN:'server-token', SUPABASE_URL:'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'sb_secret_server' }
function input(topic='payment', id='123') {
  const requestId='request-123', ts='1704908010'
  const v1=createHmac('sha256',env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex')
  return { url:new URL(`https://www.sixtysix.online/api/mercadopago/webhook?data.id=${id}&type=${topic}`), body:{type:topic,data:{id}}, requestId,signature:`ts=${ts},v1=${v1}` }
}
test('rejects forged signatures before contacting a provider or database',async()=>{
  const notification=input();notification.signature='ts=1704908010,v1='+'0'.repeat(64)
  let calls=0
  await assert.rejects(receiveNotification(notification,env,(async()=>{calls++;return Response.json({})}) as typeof fetch),{status:401})
  assert.equal(calls,0)
})
test('requires the independent webhook secret, not just an access token',async()=>{
  await assert.rejects(receiveNotification(input(),{...env,MERCADOPAGO_WEBHOOK_SECRET:''}),{status:503})
})
test('rejects duplicate query IDs and inconsistencies between signed ID and body',async()=>{
  const notification=input();notification.url.searchParams.append('data.id','456')
  await assert.rejects(receiveNotification(notification,env),{status:400})
  const mismatch=input();mismatch.body.data.id='456'
  await assert.rejects(receiveNotification(mismatch,env),{status:400})
})
test('rejects a resource belonging to another merchant',async()=>{
  const mock=async (url:string|URL|Request)=> Response.json(String(url).endsWith('users/me') ? {id:99} : {id:123,collector_id:11,status:'approved'})
  await assert.rejects(receiveNotification(input(),env,mock as typeof fetch),{status:403})
})
test('stores provider facts instead of trusting payment status in the request',async()=>{
  const writes:Record<string,unknown>[]=[]
  const notification={...input(),body:{...input().body,status:'approved',secret:'should-not-be-stored'}}
  const mock=async (url:string|URL|Request,init?:RequestInit)=>{
    if (String(url).endsWith('users/me')) return Response.json({id:99})
    if (String(url).includes('/v1/payments/')) return Response.json({id:123,collector_id:99,status:'pending',transaction_amount:119.99,currency_id:'BRL'})
    if(String(url).includes('/billing_payments'))return Response.json([])
    if(String(url).includes('/authorized_payments/search'))return Response.json({results:[]})
    if(init?.method==='PATCH')return new Response(null,{status:204})
    writes.push(JSON.parse(String(init?.body)));return new Response(null,{status:201})
  }
  await receiveNotification(notification,env,mock as typeof fetch)
  await receiveNotification(notification,env,mock as typeof fetch)
  assert.deepEqual(writes[0],writes[1])
  assert.equal((writes[0].snapshot as Record<string,unknown>).status,'pending')
  assert.equal(writes[0].state,'awaiting_account_link')
  assert.ok(!JSON.stringify(writes).includes('should-not-be-stored'))
  assert.ok(!JSON.stringify(writes).includes('server-token'))
})
test('asks the provider to retry if persistence fails',async()=>{
  const mock=async (url:string|URL|Request)=>String(url).includes('supabase.co') ? new Response(null,{status:500}) : Response.json(String(url).endsWith('users/me') ? {id:99} : {id:123,collector_id:99,status:'approved'})
  await assert.rejects(receiveNotification(input(),env,mock as typeof fetch),{status:503})
})
test('a malformed signature cannot throw an unhandled buffer error',()=>{
  assert.throws(()=>validateSignature('secret','ts=1704908010,v1=abc','request-123','123'),{status:401})
})
