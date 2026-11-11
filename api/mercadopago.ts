import { createHash, createHmac, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { withFableVariants } from '../server/model-aliases.js'

type ObjectValue = Record<string, unknown>
type Env = Record<string, string | undefined>
type Subscription = {id:string;user_id:string;plan_code:'dev'|'devApi'|'pro';amount_cents:number;api_enabled:boolean;models:string[];provider_id:string|null;merchant_id:string|null;provider_status:string;checkout_url:string|null;paid_until:string|null;created_at:string;billing_anchor:number|null;billing_mode?:'recurring'|'pix'}
type PaidAccess = {subscription_id:string;user_id:string;gateway_client_id:string;token_prefix:string;encrypted_token:string;encrypted_upstream:string;revoked_at:string|null;paid_until:string|null;models:string[];api_enabled:boolean;plan_code:string}
export const billingPlans = {
  dev:{name:'Dev',amount:7999,api:false,models:['gpt-6-astra','glm-5']},
  devApi:{name:'Dev + API',amount:9499,api:true,models:['gpt-6-astra','glm-5']},
  pro:{name:'Pro',amount:11999,api:true,models:['claude-fable-5-1','claude-fable-5-2','gpt-6-astra','glm-5']},
} as const
const validUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
function cryptoKey(secret:string){return createHash('sha256').update(`sixtysix-trial-v1\0${secret}`).digest()}
function encrypt(value:string,secret:string,aad:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',cryptoKey(secret),iv);cipher.setAAD(Buffer.from(aad));const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url')}
function decrypt(value:string,secret:string,aad:string){const packed=Buffer.from(value,'base64url');if(packed.length<29)throw new WebhookError(503,'Credencial indisponível.');const decipher=createDecipheriv('aes-256-gcm',cryptoKey(secret),packed.subarray(0,12));decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(packed.subarray(12,28));return Buffer.concat([decipher.update(packed.subarray(28)),decipher.final()]).toString('utf8')}
export function monthPeriod(start:unknown,anchor?:number|null){
  if(typeof start!=='string'||!Number.isFinite(Date.parse(start)))throw new WebhookError(400,'Período de cobrança inválido.')
  const first=new Date(start),end=new Date(first),day=anchor&&anchor>=1&&anchor<=31?anchor:first.getUTCDate()
  end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1)
  const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last))
  return {start:first.toISOString(),end:end.toISOString()}
}
export function cents(value:unknown){const n=Number(value),result=Math.round(n*100);if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(result)||Math.abs(result-n*100)>0.001)throw new WebhookError(400,'Valor de pagamento inválido.');return result}
export function subscriptionActive(item:Pick<Subscription,'paid_until'>&{entitled?:boolean},now=Date.now()){return item.entitled!==false&&Boolean(item.paid_until&&Date.parse(item.paid_until)>now)}

export function createBillingService(env:Env=process.env,request:typeof fetch=fetch){
  const base=env.SUPABASE_URL?.replace(/\/+$/,''),secret=env.SUPABASE_SERVICE_ROLE_KEY,token=env.MERCADOPAGO_ACCESS_TOKEN
  const dbHeaders={apikey:secret||'',...((secret&&!secret.startsWith('sb_secret_'))?{Authorization:`Bearer ${secret}`} :{}),'Content-Type':'application/json'}
  async function db<T>(path:string,query:Record<string,string>={},method='GET',body?:unknown):Promise<T>{
    if(!base?.startsWith('https://')||!secret)throw new WebhookError(503,'Conexão de assinatura indisponível.')
    const response=await request(`${base}/rest/v1/${path}?${new URLSearchParams(query)}`,{method,headers:{...dbHeaders,Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)})
    if(!response.ok){const error=await response.json().catch(()=>({}));if(error.code==='P0001')throw new WebhookError(409,error.message?.includes('active plan')?'Você já tem um plano ativo. Gerencie sua assinatura no painel.':'Aguarde alguns instantes e tente novamente.');throw new WebhookError(503,'Não foi possível atualizar sua assinatura.')}
    const text=await response.text();return (text?JSON.parse(text):null) as T
  }
  async function mp(path:string,method='GET',body?:unknown,idempotency?:string):Promise<ObjectValue>{
    if(!token||!env.MERCADOPAGO_WEBHOOK_SECRET)throw new WebhookError(503,'A conexão de pagamentos está sendo configurada.')
    const response=await request(`https://api.mercadopago.com/${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(idempotency?{'X-Idempotency-Key':idempotency}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)})
    if(!response.ok)throw new WebhookError(response.status===400?400:503,response.status===400?'O Mercado Pago não aceitou os dados. Confira o e-mail usado para pagar e tente novamente.':'Não foi possível consultar o Mercado Pago. Tente novamente.')
    return object(await response.json())
  }
  let merchantPromise:Promise<string>|undefined
  const merchant=()=>merchantPromise||=(mp('users/me').then(item=>identifier(item.id)))
  async function identity(authorization?:string){
    if(!authorization?.startsWith('Bearer ')||authorization.length>16000)throw new WebhookError(401,'Entre na sua conta para continuar.')
    if(!base||!(env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY))throw new WebhookError(503,'Autenticação indisponível.')
    const response=await request(`${base}/auth/v1/user`,{headers:{apikey:env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||'',Authorization:authorization},signal:AbortSignal.timeout(10000)})
    if(!response.ok)throw new WebhookError(response.status>=500?503:401,'Entre novamente na sua conta.')
    const user=await response.json() as {id?:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean}
    if(!validUuid(user.id)||user.is_anonymous)throw new WebhookError(401,'Conta inválida.')
    if(!user.email_confirmed_at||!user.email)throw new WebhookError(403,'Confirme seu e-mail para continuar.')
    return {id:user.id,email:user.email}
  }
  async function own(id:unknown,userId:string){if(!validUuid(id))throw new WebhookError(400,'Assinatura inválida.');const rows=await db<Subscription[]>('billing_subscription_state',{id:`eq.${id}`,user_id:`eq.${userId}`,select:'*',limit:'1'});if(!rows[0])throw new WebhookError(404,'Assinatura não encontrada.');return rows[0]}
  function checkSubscription(resource:ObjectValue,item:Subscription,merchantId:string){
    const recurring=object(resource.auto_recurring)
    if(String(resource.collector_id)!==merchantId||String(resource.id)!==item.provider_id||resource.external_reference!==item.id||cents(recurring.transaction_amount)!==item.amount_cents||recurring.currency_id!=='BRL'||Number(recurring.frequency)!==1||recurring.frequency_type!=='months')throw new WebhookError(403,'A assinatura não corresponde ao pedido.')
  }
  async function matchingSubscription(resource:ObjectValue){
    const id=typeof resource.external_reference==='string'?resource.external_reference:''
    if(!validUuid(id))return null
    const rows=await db<Subscription[]>('billing_subscriptions',{id:`eq.${id}`,provider_id:`eq.${identifier(resource.id)}`,select:'*',limit:'1'})
    if(!rows[0])return null
    checkSubscription(resource,rows[0],await merchant());return rows[0]
  }
  async function refreshSubscription(id:string){
    const remote=await mp(`preapproval/${identifier(id)}`),item=await matchingSubscription(remote)
    if(!item)return null
    const modified=String(remote.last_modified||remote.date_created||'')
    if(!Number.isFinite(Date.parse(modified)))throw new WebhookError(503,'Data de assinatura indisponível.')
    await db('rpc/billing_update_status',{},'POST',{p_id:item.id,p_provider_id:id,p_status:String(remote.status),p_modified:modified})
    return item
  }
  async function processInvoice(invoiceId:string){
    const invoice=await mp(`authorized_payments/${identifier(invoiceId)}`)
    const providerId=identifier(invoice.preapproval_id),remote=await mp(`preapproval/${providerId}`),item=await matchingSubscription(remote)
    if(!item)return 'awaiting_account_link'
    const paymentId=object(invoice.payment).id
    if(!paymentId)return 'awaiting_payment'
    const payment=await mp(`v1/payments/${identifier(paymentId)}`)
    if(String(payment.collector_id)!==await merchant()||identifier(payment.id)!==String(paymentId))throw new WebhookError(403,'Pagamento de outra conta.')
    if(cents(payment.transaction_amount)!==item.amount_cents||payment.currency_id!=='BRL'||payment.live_mode!==true)throw new WebhookError(403,'Valor, moeda ou ambiente de pagamento incorreto.')
    const status=Number(payment.transaction_amount_refunded||0)>0?'refunded':String(payment.status||'')
    const period=monthPeriod(invoice.debit_date,item.billing_anchor)
    const next=typeof remote.next_payment_date==='string'?Date.parse(remote.next_payment_date):NaN
    if(Number.isFinite(next)&&next>Date.parse(period.start)&&next-Date.parse(period.start)<=35*86400000)period.end=new Date(next).toISOString()
    // Later renewals change next_payment_date. Refunds/retries retain the
    // immutable period originally granted for this exact payment.
    const recorded=await db<{period_start:string;period_end:string}[]>('billing_payments',{id:`eq.${identifier(payment.id)}`,subscription_id:`eq.${item.id}`,select:'period_start,period_end',limit:'1'})
    if(recorded[0]){period.start=new Date(recorded[0].period_start).toISOString();period.end=new Date(recorded[0].period_end).toISOString()}
    const modified=String(payment.date_last_updated||payment.date_created||'')
    if(!Number.isFinite(Date.parse(modified)))throw new WebhookError(503,'Data de pagamento indisponível.')
    if(!secret)throw new WebhookError(503,'Credencial de servidor indisponível.')
    const publicToken=`sk-sp-${randomBytes(32).toString('base64url')}`,upstream=`sk-flg-${randomBytes(32).toString('base64url')}`
    await db('rpc/billing_apply_payment',{},'POST',{
      p_id:item.id,p_payment_id:String(payment.id),p_invoice_id:String(invoice.id),p_status:status,p_amount:cents(payment.transaction_amount),p_currency:'BRL',p_live:true,
      p_start:period.start,p_end:period.end,p_approved:payment.date_approved||null,p_modified:modified,
      p_hash:createHash('sha256').update(publicToken).digest('hex'),p_prefix:publicToken.slice(0,14),p_encrypted_token:encrypt(publicToken,secret,`${item.user_id}:paid:${item.id}:public`),
      p_upstream_hash:createHash('sha256').update(upstream).digest('hex'),p_encrypted_upstream:encrypt(upstream,secret,`${item.user_id}:paid:${item.id}:upstream`),
    })
    return 'processed'
  }
  async function processEvent(topic:string,resource:ObjectValue){
    if(topic==='subscription_authorized_payment')return processInvoice(identifier(resource.id))
    if(topic==='subscription_preapproval')return await refreshSubscription(identifier(resource.id))?'processed':'awaiting_account_link'
    if(topic==='payment'){
      if(typeof resource.external_reference==='string'&&validUuid(resource.external_reference)){
        const rows=await db<Subscription[]>('billing_subscriptions',{id:`eq.${resource.external_reference}`,billing_mode:'eq.pix',select:'*',limit:'1'})
        if(rows[0])return processPix(resource,rows[0])
      }
      const found=await db<{invoice_id:string}[]>('billing_payments',{id:`eq.${identifier(resource.id)}`,select:'invoice_id',limit:'1'})
      if(found[0])return processInvoice(found[0].invoice_id)
      const search=await mp(`authorized_payments/search?payment_id=${encodeURIComponent(identifier(resource.id))}&limit=20`)
      const invoice=(Array.isArray(search.results)?search.results:[]).map(object).find(row=>String(object(row.payment).id)===String(resource.id))
      return invoice?processInvoice(identifier(invoice.id)):'awaiting_invoice'
    }
    return 'recorded'
  }
  async function processPix(payment:ObjectValue,item:Subscription){
    if(String(payment.collector_id)!==await merchant()||payment.external_reference!==item.id||cents(payment.transaction_amount)!==item.amount_cents||payment.currency_id!=='BRL'||payment.live_mode!==true)throw new WebhookError(403,'Pagamento não corresponde ao pedido.')
    if(!item.provider_id||!secret)throw new WebhookError(503,'Pedido Pix indisponível.')
    const status=Number(payment.transaction_amount_refunded||0)>0?'refunded':String(payment.status)
    const approved=typeof payment.date_approved==='string'?payment.date_approved:null
    const start=approved||String(payment.date_created),modified=String(payment.date_last_updated||payment.date_created)
    if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(modified)))throw new WebhookError(503,'Data do Pix indisponível.')
    const publicToken=`sk-sp-${randomBytes(32).toString('base64url')}`,upstream=`sk-flg-${randomBytes(32).toString('base64url')}`
    await db('rpc/billing_apply_payment',{},'POST',{p_id:item.id,p_payment_id:identifier(payment.id),p_invoice_id:`pix-${identifier(payment.id)}`,p_status:status,p_amount:item.amount_cents,p_currency:'BRL',p_live:true,p_start:start,p_end:new Date(Date.parse(start)+30*86400000).toISOString(),p_approved:approved,p_modified:modified,p_hash:createHash('sha256').update(publicToken).digest('hex'),p_prefix:publicToken.slice(0,14),p_encrypted_token:encrypt(publicToken,secret,`${item.user_id}:paid:${item.id}:public`),p_upstream_hash:createHash('sha256').update(upstream).digest('hex'),p_encrypted_upstream:encrypt(upstream,secret,`${item.user_id}:paid:${item.id}:upstream`)})
    return 'processed'
  }
  async function status(userId:string){
    const rows=await db<Subscription[]>('billing_subscription_state',{user_id:`eq.${userId}`,select:'*',order:'created_at.desc',limit:'50'})
    const accesses=await db<PaidAccess[]>('billing_key_access',{user_id:`eq.${userId}`,select:'subscription_id,revoked_at',limit:'100'})
    const ids=rows.map(item=>item.id)
    const payments=ids.length?await db<ObjectValue[]>('billing_payments',{subscription_id:`in.(${ids.join(',')})`,select:'id,subscription_id,status,amount_cents,currency,approved_at,period_start,period_end',order:'period_end.desc',limit:'100'}):[]
    return {subscriptions:rows.map(item=>({id:item.id,plan:item.plan_code,name:billingPlans[item.plan_code].name,amount:item.amount_cents/100,api:item.api_enabled,models:item.models,mode:item.billing_mode||'recurring',active:subscriptionActive(item),expires:item.paid_until,status:item.provider_status,created:item.created_at,keyRevoked:Boolean(accesses.find(a=>a.subscription_id===item.id)?.revoked_at),checkoutUrl:item.provider_status==='pending'||item.billing_mode==='pix'?item.checkout_url:null})),payments}
  }
  return {
    process:processEvent,
    async execute(action:string,authorization:string|undefined,body:ObjectValue={},query=new URLSearchParams()){
      const user=await identity(authorization)
      if(action==='status')return status(user.id)
      if(action==='checkout'){
        const plan=String(body.plan||'')
        if(!Object.prototype.hasOwnProperty.call(billingPlans,plan))throw new WebhookError(400,'Escolha um plano válido.')
        const payer=typeof body.payerEmail==='string'?body.payerEmail.trim():user.email
        if(payer.length>254||!/^\S+@\S+\.\S+$/.test(payer))throw new WebhookError(400,'Informe seu e-mail de pagamento.')
        const pix=body.method==='pix'
        const result=await db<Subscription|Subscription[]>(pix?'rpc/billing_begin_pix':'rpc/billing_begin_checkout',{},'POST',{p_user_id:user.id,p_plan:plan}),item=Array.isArray(result)?result[0]:result
        if(!item)throw new WebhookError(503,'Não foi possível preparar sua assinatura.')
        if(item.checkout_url)return {id:item.id,url:item.checkout_url}
        if(pix){
          const back=`https://www.sixtysix.online/assinatura?order=${item.id}`
          // Open Checkout Pro with Pix preselected while preserving the usual
          // Mercado Pago checkout and its ability to switch payment methods.
          const remote=await mp('checkout/preferences','POST',{items:[{id:item.plan_code,title:`SixtySix ${billingPlans[item.plan_code].name} · 30 dias`,quantity:1,currency_id:'BRL',unit_price:item.amount_cents/100}],external_reference:item.id,payment_methods:{default_payment_method_id:'pix',excluded_payment_types:[{id:'ticket'}]},back_urls:{success:back,pending:back,failure:back},auto_return:'approved',notification_url:'https://www.sixtysix.online/api/mercadopago/webhook'},`pix-${item.id}-${randomBytes(8).toString('hex')}`)
          const checkout=new URL(String(remote.init_point)),merchantId=await merchant()
          if(String(remote.collector_id)!==merchantId||remote.external_reference!==item.id||checkout.protocol!=='https:'||checkout.hostname!=='www.mercadopago.com.br'||!checkout.pathname.startsWith('/checkout/'))throw new WebhookError(503,'Resposta de checkout Pix inconsistente.')
          await db('rpc/billing_link_checkout',{},'POST',{p_id:item.id,p_user_id:user.id,p_provider_id:identifier(remote.id),p_merchant_id:merchantId,p_url:checkout.toString(),p_modified:new Date().toISOString()})
          return {id:item.id,url:checkout.toString()}
        }
        const remote=await mp('preapproval','POST',{reason:`SixtySix · ${billingPlans[item.plan_code].name}`,external_reference:item.id,payer_email:payer,auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:item.amount_cents/100,currency_id:'BRL'},back_url:`https://www.sixtysix.online/assinatura?order=${item.id}`,status:'pending'},item.id)
        const merchantId=await merchant(),providerId=identifier(remote.id)
        if(String(remote.collector_id)!==merchantId||remote.external_reference!==item.id)throw new WebhookError(503,'Resposta de assinatura inconsistente.')
        const checkout=new URL(String(remote.init_point))
        if(checkout.protocol!=='https:'||checkout.hostname!=='www.mercadopago.com.br'||!checkout.pathname.startsWith('/subscriptions/checkout'))throw new WebhookError(503,'Endereço de checkout inválido.')
        await db('rpc/billing_link_checkout',{},'POST',{p_id:item.id,p_user_id:user.id,p_provider_id:providerId,p_merchant_id:merchantId,p_url:checkout.toString(),p_modified:String(remote.last_modified||remote.date_created||new Date().toISOString())})
        return {id:item.id,url:checkout.toString()}
      }
      if(action==='sync'){
        if(await db<boolean>('rpc/billing_take_sync',{},'POST',{p_user_id:user.id})){
          const rows=await db<Subscription[]>('billing_subscriptions',{user_id:`eq.${user.id}`,provider_id:'not.is.null',select:'*',order:'created_at.desc',limit:'3'})
          for(const item of rows){
            if(item.billing_mode==='pix'){
              const found=await mp(`v1/payments/search?external_reference=${encodeURIComponent(item.id)}&sort=date_created&criteria=desc&limit=50`)
              for(const payment of (Array.isArray(found.results)?found.results:[]).map(object).sort((a,b)=>Date.parse(String(a.date_created))-Date.parse(String(b.date_created))))await processPix(await mp(`v1/payments/${identifier(payment.id)}`),item)
              continue
            }
            await refreshSubscription(item.provider_id!)
            const recent:ObjectValue[]=[]
            for(let offset=0;offset<500;offset+=100){
              const invoices=await mp(`authorized_payments/search?preapproval_id=${encodeURIComponent(item.provider_id!)}&limit=100&offset=${offset}`)
              const list=Array.isArray(invoices.results)?invoices.results:[]
              for(const invoice of list){const row=object(invoice);if(String(row.preapproval_id)!==item.provider_id)throw new WebhookError(503,'Fatura de outra assinatura.');if(Date.parse(String(row.debit_date))>Date.now()-70*86400000)recent.push(row)}
              if(list.length<100)break
            }
            recent.sort((a,b)=>Date.parse(String(b.debit_date))-Date.parse(String(a.debit_date)))
            for(const row of recent.slice(0,6))await processInvoice(identifier(row.id))
          }
        }
        return status(user.id)
      }
      if(action==='cancel'){
        const item=await own(body.id,user.id)
        if(item.billing_mode==='pix')throw new WebhookError(400,'Pix não tem renovação automática para cancelar.')
        if(!item.provider_id)throw new WebhookError(409,'A assinatura ainda não foi criada.')
        await mp(`preapproval/${identifier(item.provider_id)}`,'PUT',{status:'cancelled'})
        await refreshSubscription(item.provider_id)
        return {ok:true,...await status(user.id)}
      }
      if(action==='restore'){
        const item=await own(body.id,user.id)
        if(!subscriptionActive(item)||!item.api_enabled||!secret)throw new WebhookError(403,'Seu plano não tem acesso externo ativo.')
        if(env.SIXTYSIX_AUTO_GATEWAY_KEYS!=='1')throw new WebhookError(410,'Sua chave é entregue pelo WhatsApp. Fale com a gente: (81) 99237-6036.')
        const publicToken=`sk-sp-${randomBytes(32).toString('base64url')}`,upstream=`sk-flg-${randomBytes(32).toString('base64url')}`
        const restored=await db<boolean>('rpc/billing_restore_key',{},'POST',{p_user_id:user.id,p_id:item.id,p_hash:createHash('sha256').update(publicToken).digest('hex'),p_prefix:publicToken.slice(0,14),p_encrypted_token:encrypt(publicToken,secret,`${user.id}:paid:${item.id}:public`),p_upstream_hash:createHash('sha256').update(upstream).digest('hex'),p_encrypted_upstream:encrypt(upstream,secret,`${user.id}:paid:${item.id}:upstream`)})
        if(!restored)throw new WebhookError(409,'A chave não está revogada. Atualize a página.')
        return status(user.id)
      }
      if(action==='key'){
        const item=await own(body.id,user.id)
        if(!subscriptionActive(item)||!item.api_enabled)throw new WebhookError(403,'Seu plano não tem acesso externo ativo.')
        if(env.SIXTYSIX_AUTO_GATEWAY_KEYS!=='1')throw new WebhookError(410,'Sua chave é entregue pelo WhatsApp. Fale com a gente: (81) 99237-6036.')
        const rows=await db<PaidAccess[]>('billing_access',{subscription_id:`eq.${item.id}`,user_id:`eq.${user.id}`,select:'*',limit:'1'}),access=rows[0]
        if(!access||access.revoked_at||!secret)throw new WebhookError(403,'A chave está indisponível ou foi revogada.')
        return {key:decrypt(access.encrypted_token,secret,`${user.id}:paid:${item.id}:public`),expires:item.paid_until}
      }
      if(action==='chat'){
        const rows=await db<PaidAccess[]>('billing_key_access',{user_id:`eq.${user.id}`,entitled:'eq.true',paid_until:`gt.${new Date().toISOString()}`,revoked_at:'is.null',select:'*',order:'paid_until.desc',limit:'1'}),access=rows[0]
        if(!secret)throw new WebhookError(503,'Conexão indisponível.')
        let allowed:string[],upstream:string
        if(access){allowed=withFableVariants(access.models);upstream=decrypt(access.encrypted_upstream,secret,`${user.id}:paid:${access.subscription_id}:upstream`)}
        else{
          const trials=await db<{encrypted_upstream:string;expires_at:string;revoked_at:string|null}[]>('gateway_trials',{user_id:`eq.${user.id}`,select:'encrypted_upstream,expires_at,revoked_at',limit:'1'}),trial=trials[0]
          if(!trial||trial.revoked_at||Date.parse(trial.expires_at)<=Date.now())throw new WebhookError(403,'Ative um plano ou um teste grátis para conversar pelo site.')
          allowed=[...billingPlans.pro.models];upstream=decrypt(trial.encrypted_upstream,secret,`${user.id}:upstream`)
        }
        const model=typeof body.model==='string'?body.model:''
        if(!allowed.includes(model))throw new WebhookError(403,'Este modelo não está incluído no seu plano.')
        if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>40)throw new WebhookError(400,'Conversa inválida.')
        let length=0
        const messages=body.messages.map(value=>{const m=object(value);if(!['user','assistant'].includes(String(m.role))||typeof m.content!=='string'||!m.content.trim())throw new WebhookError(400,'Mensagem inválida.');length+=(m.content as string).length;return {role:m.role,content:m.content}})
        if(length>60000)throw new WebhookError(413,'Esta conversa ficou longa. Comece uma nova para continuar.')
        const response=await request('https://66cloud.vercel.app/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':upstream,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:4096,messages}),signal:AbortSignal.timeout(180000)})
        if(!response.ok)throw new WebhookError(response.status===429?429:503,'Não foi possível responder agora. Tente novamente em instantes.')
        const content=object(await response.json()).content
        const reply=(Array.isArray(content)?content:[]).map(v=>object(v)).filter(v=>v.type==='text').map(v=>String(v.text||'')).join('\n')
        if(!reply)throw new WebhookError(503,'A resposta veio vazia. Tente novamente.')
        return {reply}
      }
      throw new WebhookError(404,'Operação não encontrada.')
    },
  }
}
class WebhookError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
const resources: Record<string, string> = {
  payment: 'v1/payments',
  subscription_preapproval: 'preapproval',
  subscription_authorized_payment: 'authorized_payments',
  subscription_preapproval_plan: 'preapproval_plan',
}
function object(value: unknown): ObjectValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
}
function identifier(value: unknown): string {
  const id = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new WebhookError(400, 'Identificador inválido.')
  return id
}
export function validateSignature(secret: string, signature: string | undefined, requestId: string | undefined, id: string): void {
  if (!secret) throw new WebhookError(503, 'Configuração da assinatura do webhook pendente.')
  if (!signature || !requestId || requestId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new WebhookError(401, 'Assinatura inválida.')
  const fields = signature.split(',').map(part => part.trim().split('='))
  const timestamps = fields.filter(([key]) => key === 'ts')
  const versions = fields.filter(([key]) => key === 'v1')
  if (timestamps.length !== 1 || versions.length !== 1) throw new WebhookError(401, 'Assinatura inválida.')
  const ts = timestamps[0][1] || ''
  const digest = versions[0][1] || ''
  if (!/^\d{10,16}$/.test(ts) || !/^[0-9a-f]{64}$/i.test(digest)) throw new WebhookError(401, 'Assinatura inválida.')
  const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  if (!timingSafeEqual(expected, Buffer.from(digest, 'hex'))) throw new WebhookError(401, 'Assinatura inválida.')
  // Retries may retain the original timestamp. Durable deduplication handles replay.
}

export async function receiveNotification(input: {
  url: URL; body: ObjectValue; signature?: string; requestId?: string
}, env: Env = process.env, request: typeof fetch = fetch) {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || ''
  if (!secret) throw new WebhookError(503, 'Configuração da assinatura do webhook pendente.')
  const queryIds = input.url.searchParams.getAll('data.id')
  const queryTypes = input.url.searchParams.getAll('type')
  if (queryIds.length !== 1 || queryTypes.length > 1) throw new WebhookError(400, 'Notificação inválida.')
  const id = identifier(queryIds[0])
  validateSignature(secret, input.signature, input.requestId, id)
  const bodyData = object(input.body.data)
  if (bodyData.id !== undefined && identifier(bodyData.id).toLowerCase() !== id.toLowerCase()) throw new WebhookError(400, 'Notificação inconsistente.')
  const topic = String(input.body.type || queryTypes[0] || '')
  if (queryTypes[0] && input.body.type && queryTypes[0] !== input.body.type) throw new WebhookError(400, 'Notificação inconsistente.')
  if (!Object.prototype.hasOwnProperty.call(resources, topic)) return { received: true, ignored: true }
  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  const base = env.SUPABASE_URL?.replace(/\/+$/, '')
  const dbSecret = env.SUPABASE_SERVICE_ROLE_KEY
  if (!accessToken || !base?.startsWith('https://') || !dbSecret) throw new WebhookError(503, 'Integração de pagamentos indisponível.')
  async function provider(path: string): Promise<ObjectValue> {
    const response = await request(`https://api.mercadopago.com/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    if (!response.ok) throw new WebhookError(503, 'Não foi possível confirmar a notificação no Mercado Pago.')
    return object(await response.json())
  }
  const merchant = await provider('users/me')
  const resource = await provider(`${resources[topic]}/${encodeURIComponent(id)}`)
  if (identifier(resource.id).toLowerCase() !== id.toLowerCase()) throw new WebhookError(400, 'Recurso inconsistente.')
  if (resource.collector_id !== undefined && String(resource.collector_id) !== String(merchant.id)) throw new WebhookError(403, 'Notificação de outra conta.')
  // Only store facts fetched from the provider; the incoming payload cannot grant access.
  const snapshot: ObjectValue = {
    resource_id: id, topic, status: typeof resource.status === 'string' ? resource.status : null,
    merchant_id: String(merchant.id), provider_modified_at: resource.last_modified || resource.date_last_updated || null,
  }
  if (topic === 'payment') {
    snapshot.amount = resource.transaction_amount
    snapshot.currency = resource.currency_id
    snapshot.live_mode = resource.live_mode
    snapshot.approved_at = resource.date_approved
  }
  if (topic === 'subscription_preapproval') {
    snapshot.plan_id = resource.preapproval_plan_id || null
    snapshot.external_reference = typeof resource.external_reference === 'string' ? resource.external_reference.slice(0,200) : null
    snapshot.next_payment_date = resource.next_payment_date || null
    snapshot.recurring = object(resource.auto_recurring)
  }
  if (topic === 'subscription_authorized_payment') {
    snapshot.subscription_id = resource.preapproval_id
    const subscriptionId = identifier(resource.preapproval_id)
    const subscription = await provider(`preapproval/${encodeURIComponent(subscriptionId)}`)
    if (String(subscription.collector_id) !== String(merchant.id)) throw new WebhookError(403, 'Notificação de outra conta.')
    const payment = object(resource.payment)
    snapshot.payment_id = payment.id || null
    snapshot.payment_status = payment.status || null
    snapshot.amount = resource.transaction_amount
    snapshot.currency = resource.currency_id
    snapshot.plan_id = subscription.preapproval_plan_id || null
    snapshot.external_reference = typeof subscription.external_reference === 'string' ? subscription.external_reference.slice(0,200) : null
    if (payment.id) {
      const confirmed = await provider(`v1/payments/${identifier(payment.id)}`)
      if (String(confirmed.collector_id) !== String(merchant.id)) throw new WebhookError(403, 'Notificação de outra conta.')
      snapshot.payment_status = confirmed.status
      snapshot.amount = confirmed.transaction_amount
      snapshot.currency = confirmed.currency_id
      snapshot.live_mode = confirmed.live_mode
      snapshot.approved_at = confirmed.date_approved
    }
  }
  // Identical facts have the same ID even when delivery headers differ. Different
  // provider statuses are retained, so an approved payment cannot hide a refund.
  const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
  const stored = await request(`${base}/rest/v1/billing_webhook_events?on_conflict=fingerprint`, {
    method: 'POST', headers: {
      apikey: dbSecret, ...(!dbSecret.startsWith('sb_secret_') ? { Authorization: `Bearer ${dbSecret}` } : {}),
      'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({ fingerprint, topic, resource_id: id, snapshot, state: 'awaiting_account_link' }),
    signal: AbortSignal.timeout(10000),
  })
  if (!stored.ok) throw new WebhookError(503, 'Não foi possível registrar a notificação. Tente novamente.')
  const state=await createBillingService(env,request).process(topic,resource)
  const updated=await request(`${base}/rest/v1/billing_webhook_events?fingerprint=eq.${fingerprint}`,{
    method:'PATCH',headers:{apikey:dbSecret,...(!dbSecret.startsWith('sb_secret_')?{Authorization:`Bearer ${dbSecret}`} :{}),'Content-Type':'application/json'},body:JSON.stringify({state}),signal:AbortSignal.timeout(10000),
  })
  if(!updated.ok)throw new WebhookError(503,'Não foi possível concluir o registro da notificação.')
  return { received: true }
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const requestUrl=new URL(req.url||'/','https://www.sixtysix.online')
    const action=requestUrl.searchParams.get('action')
    const billingAction=Boolean(action&&['checkout','status','sync','cancel','key','restore','chat'].includes(action))
    if (!billingAction && (req.method === 'GET' || req.method === 'HEAD')) {
      res.statusCode = 200
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({
        service: 'SixtySix Mercado Pago webhook', endpoint: '/api/mercadopago/webhook',
        status: process.env.MERCADOPAGO_WEBHOOK_SECRET ? 'receiver_configured' : 'awaiting_webhook_secret',
        automaticKeyDelivery: Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET&&process.env.MERCADOPAGO_ACCESS_TOKEN&&process.env.SIXTYSIX_AUTO_GATEWAY_KEYS==='1'),
      }))
      return
    }
    if (billingAction ? req.method!==(action==='status'?'GET':'POST') : req.method!=='POST') { res.setHeader('Allow','GET, HEAD, POST'); throw new WebhookError(405, 'Método não permitido.') }
    let body = req.body
    if (body === undefined) {
      let raw = ''
      for await (const chunk of req) {
        raw += chunk
        if (Buffer.byteLength(raw) > (action==='chat'?262144:32768)) throw new WebhookError(413, 'Solicitação muito grande.')
      }
      try { body = JSON.parse(raw || '{}') } catch { throw new WebhookError(400, 'JSON inválido.') }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > (action==='chat'?262144:32768)) throw new WebhookError(400, 'Solicitação inválida.')
    if(billingAction){const result=await createBillingService().execute(action!,req.headers.authorization,body as ObjectValue,requestUrl.searchParams);res.statusCode=200;res.end(JSON.stringify(result));return}
    const single = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined
    const result = await receiveNotification({
      url: requestUrl, body: body as ObjectValue,
      signature: single(req.headers['x-signature']), requestId: single(req.headers['x-request-id']),
    })
    res.statusCode = 200
    res.end(JSON.stringify(result))
  } catch (error) {
    res.statusCode = error instanceof WebhookError ? error.status : 503
    res.end(JSON.stringify({ error: error instanceof WebhookError ? error.message : 'Webhook temporariamente indisponível.' }))
  }
}
