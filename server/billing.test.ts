import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createBillingService,monthPeriod,subscriptionActive,cents} from '../api/mercadopago.ts'
const uid='1a9ff780-4164-4952-a9af-cbf41cc02042',order='11111111-1111-4111-8111-111111111111'
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_private',VITE_SUPABASE_ANON_KEY:'public',MERCADOPAGO_ACCESS_TOKEN:'private-mp',MERCADOPAGO_WEBHOOK_SECRET:'private-hook'}
const item={id:order,user_id:uid,provider_id:'sub1',merchant_id:'99',plan_code:'devApi',amount_cents:9499,api_enabled:true,models:['gpt-6-astra','glm-5'],checkout_url:null,paid_until:null,billing_anchor:31}
const remote={id:'sub1',collector_id:99,external_reference:order,status:'authorized',last_modified:'2026-11-09T00:00:00Z',auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:94.99,currency_id:'BRL'}}
function fixture(overrides:Record<string,unknown>={}){
 const calls:{url:URL;body:any}[]=[]
 const request=async(input:string|URL|Request,init?:RequestInit)=>{
  const url=new URL(String(input)),body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({url,body})
  if(url.pathname==='/auth/v1/user')return Response.json({id:uid,email:'owner@example.com',email_confirmed_at:'2026-01-01'})
  if(url.pathname==='/users/me')return Response.json({id:99})
  if(url.pathname==='/preapproval'&&init?.method==='POST')return Response.json({...remote,init_point:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sub1'})
  if(url.pathname==='/checkout/preferences')return Response.json({id:'pref1',collector_id:99,external_reference:order,init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref1'})
  if(url.pathname==='/preapproval/sub1')return Response.json(remote)
  if(url.pathname==='/authorized_payments/invoice1')return Response.json({id:'invoice1',preapproval_id:'sub1',debit_date:'2026-10-31T12:00:00Z',payment:{id:123}})
  if(url.pathname==='/v1/payments/123')return Response.json({id:123,collector_id:99,transaction_amount:94.99,currency_id:'BRL',live_mode:true,status:'approved',date_approved:'2026-10-31T12:00:00Z',date_last_updated:'2026-10-31T12:01:00Z',...overrides})
  if(url.pathname.endsWith('/billing_begin_checkout'))return Response.json({...item,provider_id:null})
  if(url.pathname.endsWith('/billing_begin_pix'))return Response.json({...item,billing_mode:'pix',provider_id:null})
  if(url.pathname.endsWith('/billing_subscriptions'))return Response.json([item])
  if(url.pathname.endsWith('/billing_subscription_state'))return Response.json([{...item,entitled:false}])
  if(url.pathname.endsWith('/billing_payments')||url.pathname.endsWith('/billing_key_access'))return Response.json([])
  if(url.pathname.includes('/rpc/'))return Response.json(true)
  throw new Error(`Unexpected path ${url.pathname}`)
 }
 return {calls,service:createBillingService(env,request as typeof fetch)}
}
test('calendar-month access clamps month ends and restores the original anchor',()=>{
 assert.equal(monthPeriod('2026-01-31T12:00:00Z').end,'2026-02-28T12:00:00.000Z')
 assert.equal(monthPeriod('2028-01-31T12:00:00Z').end,'2028-02-29T12:00:00.000Z')
 assert.equal(monthPeriod('2026-02-28T12:00:00Z',31).end,'2026-03-31T12:00:00.000Z')
 assert.throws(()=>monthPeriod('invalid'))
})
test('access ends exactly at the deadline and requires a current approved period',()=>{
 const now=Date.parse('2026-11-30T12:00:00Z')
 assert.equal(subscriptionActive({paid_until:new Date(now).toISOString()},now),false)
 assert.equal(subscriptionActive({paid_until:new Date(now+1).toISOString(),entitled:false},now),false)
 assert.equal(subscriptionActive({paid_until:new Date(now+1).toISOString(),entitled:true},now),true)
 assert.equal(subscriptionActive({paid_until:null},now),false)
 assert.equal(cents(94.99),9499);assert.throws(()=>cents(94.999))
})
test('checkout uses the verified account and server price, ignoring forged owner and amount',async()=>{
 const {service,calls}=fixture()
 const result=await service.execute('checkout','Bearer verified',{plan:'devApi',user_id:'forged',amount:0.01,status:'approved'})
 assert.ok('id' in result);assert.equal(result.id,order)
 const begin=calls.find(c=>c.url.pathname.endsWith('/billing_begin_checkout'))!.body
 assert.deepEqual(begin,{p_user_id:uid,p_plan:'devApi'})
 const submitted=calls.find(c=>c.url.pathname==='/preapproval')!.body
 assert.equal(submitted.auto_recurring.transaction_amount,94.99)
 assert.equal(submitted.auto_recurring.frequency_type,'months')
 assert.equal(submitted.external_reference,order);assert.equal(submitted.status,'pending')
 assert.equal(submitted.payer_email,'owner@example.com')
 assert.ok(!calls.some(c=>c.url.pathname.endsWith('/billing_apply_payment')))
})
test('unconfirmed or unsigned accounts cannot start checkout',async()=>{
 const {service,calls}=fixture();await assert.rejects(service.execute('checkout',undefined,{plan:'pro'}),{status:401});assert.equal(calls.length,0)
 const unconfirmed=createBillingService(env,(async()=>Response.json({id:uid,email:'a@b.com'})) as typeof fetch)
 await assert.rejects(unconfirmed.execute('checkout','Bearer valid',{plan:'pro'}),{status:403})
})
test('approved invoice stores hashes and encrypted keys with its monthly period',async()=>{
 const {service,calls}=fixture();assert.equal(await service.process('subscription_authorized_payment',{id:'invoice1'}),'processed')
 const saved=calls.find(c=>c.url.pathname.endsWith('/billing_apply_payment'))!.body
 assert.equal(saved.p_id,order);assert.equal(saved.p_status,'approved');assert.equal(saved.p_amount,9499)
 assert.equal(saved.p_end,'2026-11-30T12:00:00.000Z');assert.match(saved.p_hash,/^[0-9a-f]{64}$/)
 assert.equal(saved.p_prefix.length,14);assert.ok(!JSON.stringify({...saved,p_prefix:null}).includes('sk-sp-'));assert.ok(!JSON.stringify(saved).includes('sk-flg-'))
})
test('wrong amount, currency and sandbox payments cannot grant production access',async()=>{
 for(const change of [{transaction_amount:1},{currency_id:'USD'},{live_mode:false},{collector_id:123}]){
  const {service,calls}=fixture(change)
  await assert.rejects(service.process('subscription_authorized_payment',{id:'invoice1'}),{status:403})
  assert.ok(!calls.some(c=>c.url.pathname.endsWith('/billing_apply_payment')))
 }
})
test('partial refunds withdraw the corresponding entitlement',async()=>{
 const {service,calls}=fixture({transaction_amount_refunded:1})
 await service.process('subscription_authorized_payment',{id:'invoice1'})
 assert.equal(calls.find(c=>c.url.pathname.endsWith('/billing_apply_payment'))!.body.p_status,'refunded')
})
test('subscription authorization alone does not create a key or paid period',async()=>{
 const {service,calls}=fixture();await service.process('subscription_preapproval',{id:'sub1'})
 assert.ok(calls.some(c=>c.url.pathname.endsWith('/billing_update_status')))
 assert.ok(!calls.some(c=>c.url.pathname.endsWith('/billing_apply_payment')))
 await assert.rejects(service.execute('key','Bearer valid',{id:order}),{status:403})
})
test('one-time checkout uses the regular payment selection and does not start recurring billing',async()=>{
 const {service,calls}=fixture();const result=await service.execute('checkout','Bearer verified',{plan:'devApi',method:'pix',amount:1})
 assert.ok('url' in result&&typeof result.url==='string');assert.match(result.url,/checkout\/v1/)
 const preference=calls.find(c=>c.url.pathname==='/checkout/preferences')!.body
 assert.equal(preference.external_reference,order);assert.equal(preference.items[0].unit_price,94.99)
 assert.ok(!('payment_methods' in preference))
 assert.ok(!('payer' in preference))
 assert.ok(!calls.some(c=>c.url.pathname==='/preapproval'))
 assert.ok(!calls.some(c=>c.url.pathname.endsWith('/billing_apply_payment')))
})
test('verified Pix notification grants only its own exact-value production order',async()=>{
 const {service,calls}=fixture()
 const payment={id:456,collector_id:99,external_reference:order,transaction_amount:94.99,currency_id:'BRL',live_mode:true,payment_method_id:'pix',status:'approved',date_approved:'2026-11-09T12:00:00Z',date_last_updated:'2026-11-09T12:01:00Z'}
 assert.equal(await service.process('payment',payment),'processed')
 const saved=calls.find(c=>c.url.pathname.endsWith('/billing_apply_payment'))!.body
 assert.equal(saved.p_payment_id,'456');assert.equal(saved.p_invoice_id,'pix-456')
 assert.equal(saved.p_end,'2026-12-09T12:00:00.000Z')
 for(const change of [{collector_id:123},{transaction_amount:1},{live_mode:false}])await assert.rejects(service.process('payment',{...payment,...change}),{status:403})
 await service.process('payment',{...payment,payment_method_id:'visa'})
})
