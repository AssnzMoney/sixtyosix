import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Copy, KeyRound, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { accountRequest } from '../lib/account'
import './trial.css'

type TrialResult={active:boolean;revoked:boolean;expires:string;key:string|null}
export default function TrialPage(){
  const {session,user,loading}=useAuth()
  const navigate=useNavigate()
  const [trial,setTrial]=useState<TrialResult|null>(null)
  const [error,setError]=useState(''),[retry,setRetry]=useState(0),[copied,setCopied]=useState(false),[reveal,setReveal]=useState(false)
  useEffect(()=>{
    if(loading)return
    sessionStorage.setItem('sixtysix_pending_trial','1')
    sessionStorage.removeItem('sixtysix_pending_purchase');sessionStorage.removeItem('sixtysix_pending_subscription')
    if(!session){navigate('/login?mode=cadastro',{replace:true});return}
    if(!user?.hasCompletedOnboarding){navigate('/onboarding',{replace:true});return}
    const controller=new AbortController();setError('')
    accountRequest<TrialResult>('trial',{},controller.signal).then(data=>{
      if(controller.signal.aborted)return
      setTrial(data);sessionStorage.removeItem('sixtysix_pending_trial')
    }).catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Não foi possível ativar seu teste.')})
    return ()=>controller.abort()
  },[loading,session?.user.id,user?.hasCompletedOnboarding,navigate,retry])
  const end=trial?new Date(trial.expires).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'}):''
  async function copy(){try{await navigator.clipboard.writeText(trial?.key||'');setCopied(true)}catch{setReveal(true);setError('Selecione e copie a chave exibida abaixo.')}}
  return <main className="six-trial-page"><section className="six-trial-card">
    <Link to="/" aria-label="SixtySix, início" className="six-trial-brand"><img src="/assets/sidebar-logo.png" alt="SixtySix"/><span>SixtySix</span></Link>
    <span className="six-trial-pill"><ShieldCheck size={15}/> Teste grátis · 7 dias</span>
    <h1>{trial?.active?'Seu espaço para começar.':trial?'Seu teste foi encerrado.':'Vamos preparar seu acesso.'}</h1>
    {!trial&&!error&&<p role="status">Conferindo sua conta e preparando sua chave individual…</p>}
    {error&&<p role="alert" className="six-trial-error">{error}</p>}
    {error&&!trial&&<button className="six-trial-primary" onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button>}
    {trial?.active&&<>
      <p>Pronto, {user?.name}. Seu acesso termina em <strong>{end}</strong>. Use a chave abaixo nas ferramentas dos nossos tutoriais.</p>
      <label className="six-trial-key"><span><KeyRound size={17}/> Sua chave individual</span><div><input aria-label="Sua chave individual de teste" type={reveal?'text':'password'} readOnly value={trial.key||''}/><button onClick={()=>setReveal(v=>!v)} aria-label={reveal?'Ocultar chave':'Mostrar chave'}>{reveal?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      <button className="six-trial-primary" onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Chave copiada':'Copiar minha chave'}</button>
      <Link className="six-trial-secondary" to="/dashboard">Abrir meu painel <ArrowRight size={17}/></Link>
      <Link className="six-trial-guide" to="/claude-code#passo-a-passo">Ver tutorial de conexão</Link>
      <small>Sem cartão e sem cobrança automática. Você pode voltar a esta página para consultar sua chave durante o teste. Cada conta pode ativar o teste uma única vez.</small>
    </>}
    {trial&&!trial.active&&<><p>{trial.revoked?'A chave deste teste foi revogada.':`Os seus 7 dias terminaram em ${end}.`} Seu consumo continua disponível no painel.</p><Link className="six-trial-primary" to="/planos">Escolher meu plano <ArrowRight size={17}/></Link><Link className="six-trial-secondary" to="/dashboard">Voltar ao painel</Link></>}
  </section></main>
}
