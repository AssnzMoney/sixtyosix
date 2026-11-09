import {useState} from 'react'
import {Link} from 'react-router-dom'
import {billingRequest} from '../lib/billing'
export default function SiteChat({models}:{models:string[]}){
  const [selected,setSelected]=useState(models[0]||'gpt-6-astra'),[text,setText]=useState(''),[messages,setMessages]=useState<{role:'user'|'assistant';content:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const labels:Record<string,string>={'claude-fable-5-1':'Fable 5.1','gpt-6-astra':'Astra 6','glm-5':'GLM 5'}
  async function send(e:React.FormEvent){e.preventDefault();if(!text.trim()||busy)return;setBusy(true);setError('');const next=[...messages.slice(-19),{role:'user' as const,content:text.trim()}];try{const result=await billingRequest<{reply:string}>('chat',{model:models.includes(selected)?selected:models[0],messages:next});setMessages([...next,{role:'assistant',content:result.reply}]);setText('')}catch(err){setError(err instanceof Error?err.message:'Não foi possível responder.')}finally{setBusy(false)}}
  return <section className="six-panel six-site-chat"><div className="six-panel-head"><div><h2>Conversar no site</h2><p>Crie, programe e tire suas dúvidas.</p></div></div>
    {!models.length?<><p>Ative o teste grátis ou um plano para começar sua conversa.</p><Link to="/planos" className="six-primary">Ver planos</Link></>:<>
      <div className="six-chat-tools"><select aria-label="Modelo da conversa" value={models.includes(selected)?selected:models[0]} onChange={e=>setSelected(e.target.value)} disabled={busy}>{models.map(m=><option key={m} value={m}>{labels[m]||m}</option>)}</select><button className="six-secondary" disabled={busy} onClick={()=>{setMessages([]);setError('')}}>Nova conversa</button></div>
      <div className="six-chat-history" aria-live="polite">{!messages.length&&<p>Sua próxima ideia pode começar aqui. O histórico fica nesta tela enquanto ela estiver aberta.</p>}{messages.map((message,i)=><article key={i} className={`six-chat-message ${message.role}`}><strong>{message.role==='user'?'Você':labels[selected]||selected}</strong><div>{message.content}</div></article>)}{busy&&<p role="status">Preparando resposta…</p>}</div>
      {error&&<p role="alert" className="six-chat-error">{error}</p>}
      <form onSubmit={send}><textarea aria-label="Sua mensagem" placeholder="Descreva o que você quer criar…" maxLength={12000} value={text} onChange={e=>setText(e.target.value)} disabled={busy}/><button className="six-primary" disabled={busy||!text.trim()}>Enviar mensagem</button></form>
    </>}
  </section>
}
