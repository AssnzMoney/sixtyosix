import {useEffect,useState} from 'react'
import {Link,useNavigate,useSearchParams} from 'react-router-dom'
import {Check,Copy,Eye,EyeOff,RefreshCw,ShieldCheck} from 'lucide-react'
import {useAuth} from '../lib/AuthContext'
import {billingRequest,type BillingState} from '../lib/billing'
import './trial.css'
import './billing.css'
export default function SubscriptionPage(){
  const {session,user,loading}=useAuth(),navigate=useNavigate(),[params]=useSearchParams()
  const [data,setData]=useState<BillingState|null>(null),[error,setError]=useState(''),[key,setKey]=useState(''),[reveal,setReveal]=useState(false),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[cancelIntent,setCancelIntent]=useState(false)
  const chosen=data?.subscriptions.find(item=>item.id===params.get('order'))||data?.subscriptions.find(item=>item.active)||data?.subscriptions[0]
  useEffect(()=>{
    if(loading)return
    sessionStorage.removeItem('sixtysix_pending_trial');sessionStorage.removeItem('sixtysix_pending_purchase')
    if(!session){sessionStorage.setItem('sixtysix_pending_subscription','1');navigate('/login',{replace:true});return}
    if(!user?.hasCompletedOnboarding){sessionStorage.setItem('sixtysix_pending_subscription','1');navigate('/onboarding',{replace:true});return}
    sessionStorage.removeItem('sixtysix_pending_subscription')
    const controller=new AbortController();let running=false
    async function refresh(sync=false){if(running)return;running=true;try{const state=await billingRequest<BillingState>(sync?'sync':'status',sync?{}:undefined,controller.signal);if(!controller.signal.aborted){setData(state);setError('')}}catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Não foi possível consultar sua assinatura.')}finally{running=false}}
    void refresh(Boolean(params.get('order')))
    const timer=setInterval(()=>void refresh(),10000)
    return()=>{controller.abort();clearInterval(timer);setKey('')}
  },[loading,session?.user.id,user?.hasCompletedOnboarding,navigate,params.get('order')])
  useEffect(()=>{
    setKey('');setCopied(false);setCancelIntent(false)
    if(!chosen?.active||!chosen.api||chosen.keyRevoked)return
    const controller=new AbortController()
    billingRequest<{key:string}>('key',{id:chosen.id},controller.signal).then(result=>{if(!controller.signal.aborted)setKey(result.key)}).catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Não foi possível consultar a chave.')})
    return()=>controller.abort()
  },[chosen?.id,chosen?.active,chosen?.api,chosen?.keyRevoked])
  async function update(action:'sync'|'cancel'|'restore'){
    setBusy(true);setError('')
    try{const result=await billingRequest<BillingState>(action,action!=='sync'?{id:chosen?.id}:{});setData(result);setCancelIntent(false)}catch(err){setError(err instanceof Error?err.message:'Não foi possível concluir.')}finally{setBusy(false)}
  }
  async function copy(){try{await navigator.clipboard.writeText(key);setCopied(true)}catch{setReveal(true);setError('Selecione e copie a chave abaixo.')}}
  const date=chosen?.expires?new Date(chosen.expires).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'}):''
  return <main className="six-trial-page"><section className="six-trial-card">
    <Link to="/dashboard" className="six-trial-brand"><img src="/assets/sidebar-logo.png" alt=""/><span>SixtySix</span></Link>
    <span className="six-trial-pill"><ShieldCheck size={15}/> Minha assinatura</span>
    <h1>{chosen?`${chosen.name} · ${chosen.active?'acesso ativo':chosen.status==='cancelled'?'cancelado':chosen.expires?'período encerrado':'aguardando pagamento'}`:'Seu espaço para criar.'}</h1>
    {error&&<p role="alert" className="six-trial-error">{error}</p>}
    {!data&&!error&&<p role="status">Conferindo sua assinatura…</p>}
    {chosen&&<>
      <p><strong>{chosen.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}{chosen.mode==='pix'?' / 30 dias · Pix.':'/mês.'}</strong> {chosen.active?`Acesso pago até ${date}.`:chosen.expires?`O último período terminou em ${date}.`:'Aguardando a confirmação do primeiro pagamento.'}</p>
      <p>{chosen.mode==='pix'?'Sem débito automático. Cada novo Pix aprovado acrescenta 30 dias ao acesso.':chosen.status==='cancelled'?'Renovação cancelada. O acesso é mantido até o fim do período já pago.':'Cada renovação aprovada atualiza o acesso automaticamente. Sem novo pagamento confirmado, o acesso termina no vencimento.'}</p>
      {chosen.active&&!chosen.api&&<><p>Seu plano funciona pelo site. Abra seu painel e escolha Conversar no site.</p><Link to="/dashboard" className="six-trial-primary">Abrir meu painel</Link></>}
      {key&&<><label className="six-trial-key"><span>Sua chave individual</span><div><input aria-label="Sua chave individual da assinatura" type={reveal?'text':'password'} readOnly value={key}/><button onClick={()=>setReveal(v=>!v)} aria-label={reveal?'Ocultar chave':'Mostrar chave'}>{reveal?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><button className="six-trial-primary" onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Chave copiada':'Copiar minha chave'}</button><Link to="/dashboard" className="six-trial-secondary">Abrir painel e tutoriais</Link></>}
      {chosen.keyRevoked&&<><p>A chave foi revogada. A assinatura permanece registrada; sua cobrança não é cancelada ao revogar uma chave.</p>{chosen.active&&chosen.api&&<button disabled={busy} className="six-trial-secondary" onClick={()=>void update('restore')}>Gerar uma nova chave individual</button>}</>}
      {!chosen.active&&chosen.checkoutUrl&&<a href={chosen.checkoutUrl} className="six-trial-primary">Continuar pagamento</a>}
      {chosen.active&&chosen.mode==='pix'&&chosen.checkoutUrl&&<a href={chosen.checkoutUrl} className="six-trial-secondary">Renovar mais 30 dias com Pix</a>}
      <button disabled={busy} className="six-trial-secondary" onClick={()=>void update('sync')}><RefreshCw size={16}/> {busy?'Conferindo…':'Atualizar pagamento'}</button>
      {chosen.mode!=='pix'&&chosen.status!=='cancelled'&&(!cancelIntent?<button className="six-trial-guide" onClick={()=>setCancelIntent(true)}>Cancelar renovação</button>:<div className="six-trial-cancel"><p>Cancelar as próximas cobranças? Você mantém o acesso até o fim do período já pago.</p><button disabled={busy} className="six-trial-secondary" onClick={()=>void update('cancel')}>Confirmar cancelamento</button><button className="six-trial-guide" onClick={()=>setCancelIntent(false)}>Manter assinatura</button></div>)}
    </>}
    {data&&!chosen&&<><p>Sua conta ainda não tem uma assinatura. Escolha um plano para continuar.</p><Link to="/planos" className="six-trial-primary">Ver planos</Link><Link to="/teste-gratis" className="six-trial-secondary">Conhecer o teste grátis</Link></>}
    {!!data?.payments.length&&<div className="six-billing-history"><h2>Seus pagamentos</h2>{data.payments.map(p=><article key={p.id}><strong>{(p.amount_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong><span>{p.status==='approved'?'Aprovado':p.status==='refunded'?'Estornado':p.status==='charged_back'?'Contestado':p.status==='rejected'?'Recusado':'Pendente'}</span><small>{new Date(p.period_start).toLocaleDateString('pt-BR')} — {new Date(p.period_end).toLocaleDateString('pt-BR')}</small></article>)}</div>}
    <Link to="/dashboard" className="six-trial-guide">Voltar ao painel</Link>
  </section></main>
}
