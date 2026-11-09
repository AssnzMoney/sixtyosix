import { useEffect,useState } from 'react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { ArrowRight,ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { billingRequest,planLabels,planAmounts,type PlanCode } from '../lib/billing'
import './trial.css'
export default function CheckoutPage(){
  const {plan}=useParams(),navigate=useNavigate(),{session,user,loading}=useAuth()
  const valid=Boolean(plan&&Object.prototype.hasOwnProperty.call(planLabels,plan)),code=plan as PlanCode
  const [payer,setPayer]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[method,setMethod]=useState<'pix'|'card'>('pix')
  useEffect(()=>{
    if(loading||!valid)return
    sessionStorage.setItem('sixtysix_pending_purchase',code)
    sessionStorage.removeItem('sixtysix_pending_trial');sessionStorage.removeItem('sixtysix_pending_subscription')
    if(!session){navigate('/login?mode=cadastro',{replace:true});return}
    if(!user?.hasCompletedOnboarding){navigate('/onboarding',{replace:true});return}
    setPayer(user.email)
  },[loading,session?.user.id,user?.hasCompletedOnboarding,valid,code,navigate])
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('')
    try{const result=await billingRequest<{id:string;url:string}>('checkout',{plan:code,payerEmail:payer,method});sessionStorage.removeItem('sixtysix_pending_purchase');window.location.assign(result.url)}
    catch(err){setError(err instanceof Error?err.message:'Não foi possível abrir o pagamento.');setBusy(false)}
  }
  return <main className="six-trial-page"><section className="six-trial-card">
    <Link to="/planos" className="six-trial-brand"><img src="/assets/sidebar-logo.png" alt=""/><span>SixtySix</span></Link>
    <span className="six-trial-pill"><ShieldCheck size={15}/> Assinatura mensal</span>
    {!valid?<><h1>Plano não encontrado.</h1><Link to="/planos" className="six-trial-primary">Ver planos</Link></>:<>
      <h1>Seu próximo passo com o {planLabels[code]}.</h1>
      <p><strong>{planAmounts[code].toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} por mês.</strong> {code==='dev'?'Uso pelo site.':'Uso pelo site e chave individual para ferramentas compatíveis.'}</p>
      <p>O acesso começa após a confirmação do pagamento. Escolha Pix por 30 dias ou cartão com renovação mensal automática.</p>
      {loading||!session||!user?.hasCompletedOnboarding?<p role="status">Conferindo sua conta…</p>:<form onSubmit={submit}>
        <label className="six-trial-key"><span>Como você quer pagar?</span><select aria-label="Forma de pagamento" value={method} onChange={e=>setMethod(e.target.value as 'pix'|'card')} style={{width:'100%',padding:14,borderRadius:12,background:'#14271e',color:'#e7f1de',border:'1px solid #4c6351'}}><option value="pix">Pix · 30 dias, sem cobrança automática</option><option value="card">Cartão · assinatura mensal automática</option></select></label>
        <p>{method==='pix'?'Cada Pix aprovado libera 30 dias. Para renovar, faça um novo pagamento.':'A renovação é mensal. Você pode cancelar as próximas cobranças e manter o período já pago.'}</p>
        <label className="six-trial-key"><span>E-mail usado no Mercado Pago</span><div><input aria-label="E-mail usado no Mercado Pago" type="email" maxLength={254} required value={payer} onChange={e=>setPayer(e.target.value)}/></div></label>
        <small>O e-mail de pagamento pode ser diferente do seu login. A assinatura ficará vinculada à conta SixtySix em que você está conectado.</small>
        {error&&<p role="alert" className="six-trial-error">{error}</p>}
        <button disabled={busy} className="six-trial-primary" style={{marginTop:20}}>{busy?'Preparando pagamento…':'Continuar no Mercado Pago'} <ArrowRight size={17}/></button>
      </form>}
      <Link to="/assinatura" className="six-trial-secondary">Já paguei / ver minha assinatura</Link>
    </>}
  </section></main>
}
