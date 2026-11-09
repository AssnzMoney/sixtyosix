import {useEffect,useState,useMemo} from 'react'
import {Link} from 'react-router-dom'
import {RefreshCw,Download,Search,ShieldCheck,ArrowLeft} from 'lucide-react'
import {useAuth} from '../lib/AuthContext'
import './admin.css'
type Row=Record<string,any>
const labels:Record<string,string>={users:'Clientes',subscriptions:'Planos',keys:'Chaves',trials:'Testes grátis',usage:'Consumo e falhas',payments:'Pagamentos'}
const columns:Record<string,string[]>={users:['name','email','provider','created_at','last_sign_in_at'],subscriptions:['customer','plan_code','amount_cents','provider_status','entitled','paid_until','billing_mode'],keys:['customer','token_prefix','api_enabled','entitled','paid_until','revoked_at'],trials:['customer','token_prefix','created_at','expires_at','revoked_at'],usage:['customer','key','requested_alias','status_code','input_tokens','output_tokens','latency_ms','created_at'],payments:['customer','plan_code','id','status','amount_cents','currency','approved_at','period_end']}
const titles:Record<string,string>={name:'Nome',email:'E-mail',provider:'Login',created_at:'Criado em',last_sign_in_at:'Último acesso',customer:'Cliente',plan_code:'Plano',amount_cents:'Valor',provider_status:'Status',entitled:'Acesso pago',paid_until:'Vencimento',billing_mode:'Cobrança',token_prefix:'Identificação da chave',api_enabled:'API externa',revoked_at:'Revogada em',expires_at:'Fim do teste',key:'Chave',requested_alias:'Modelo',status_code:'Resposta',input_tokens:'Tokens entrada',output_tokens:'Tokens saída',latency_ms:'Tempo (ms)',id:'ID',status:'Status',currency:'Moeda',approved_at:'Aprovado em',period_end:'Fim do período'}
const money=(n:number)=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const number=(n:number)=>n.toLocaleString('pt-BR')
function format(key:string,value:any){if(value==null||value==='')return '—';if(typeof value==='boolean')return value?'Sim':'Não';if(key==='amount_cents')return money(value);if(key.endsWith('_at')||['paid_until','period_end'].includes(key))return new Date(value).toLocaleString('pt-BR');if(typeof value==='number')return number(value);return String(value)}
export default function AdminPage(){
 const {session,loading}=useAuth(),[data,setData]=useState<Record<string,Row[]>>({}),[tab,setTab]=useState('users'),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[updated,setUpdated]=useState('')
 const [from,setFrom]=useState(new Date(Date.now()-29*86400000).toISOString().slice(0,10)),[to,setTo]=useState(new Date().toISOString().slice(0,10)),[revision,setRevision]=useState(0)
 useEffect(()=>{
  if(!session)return
  const controller=new AbortController();let alive=true
  setBusy(true);setError('');setNotice('');setData({})
  async function load(){
   const result:Record<string,Row[]>={};let capped=false
   const fetchPage=async(resource:string,offset:number)=>{
    const response=await fetch('/api/management?'+new URLSearchParams({resource,offset:String(offset),from,to}),{headers:{Authorization:`Bearer ${session!.access_token}`},signal:controller.signal})
    const body=await response.json();if(!response.ok)throw new Error(body.error||'Falha ao carregar a administração.');return body
   }
   // Validate administrator before requesting the remaining resources.
   const first=await fetchPage('users',0);result.users=first.rows
   async function rest(resource:string,initial?:any){let page=initial,offset=initial?500:0;const rows:Row[]=initial?[...initial.rows]:[];while(!initial||page.hasMore){page=await fetchPage(resource,offset);rows.push(...page.rows);offset+=500;initial=page;if(!page.hasMore)break;if(offset>=10000){capped=true;break}}result[resource]=rows}
   await rest('users',first)
   const failed:string[]=[];await Promise.all(['clients',...Object.keys(labels).filter(x=>x!=='users')].map(async x=>{try{await rest(x)}catch(e){if(controller.signal.aborted)throw e;result[x]=[];failed.push(labels[x]||'Vínculo das chaves')}}))
   const known=new Set([...result.keys,...result.trials].map(x=>x.gateway_client_id));result.keys.push(...result.clients.filter(x=>!known.has(x.id)).map(x=>({...x,gateway_client_id:x.id,token_prefix:x.key_prefix,entitled:x.enabled,api_enabled:true})));
   if(alive){setData(result);setUpdated(new Date().toLocaleTimeString('pt-BR'));setNotice([capped?'Exibindo até 10.000 registros por seção. Reduza o período para consultar o consumo em partes.':'',failed.length?'Dados indisponíveis: '+failed.join(', ')+'. Os totais dessas seções estão incompletos; clique em Atualizar para tentar novamente.':''].filter(Boolean).join(' '))}
  }
  load().catch(e=>{if(alive&&e.name!=='AbortError')setError(e.message)}).finally(()=>{if(alive)setBusy(false)})
  return()=>{alive=false;controller.abort()}
 },[session?.access_token,from,to,revision])
 const enriched=useMemo<Row[]>(()=>{
  const users=new Map((data.users||[]).map(x=>[x.id,x])),subs=new Map((data.subscriptions||[]).map(x=>[x.id,x])),clients=new Map<string,Row>((data.clients||[]).map(x=>[x.id,{...x,owner:x.user_id}]))
  for(const x of [...data.keys||[],...data.trials||[]])clients.set(x.gateway_client_id,{...clients.get(x.gateway_client_id),owner:x.user_id,key_prefix:x.token_prefix})
  const customer=(id:string)=>{const u=users.get(id);return u?`${u.name||'Sem nome'} · ${u.email}`:id||'Chave legada sem conta vinculada'}
  return (data[tab]||[]).map(x=>{const sub=subs.get(x.subscription_id),client=clients.get(x.client_id);return {...x,customer:customer(x.user_id||sub?.user_id||client?.owner),plan_code:x.plan_code||sub?.plan_code,key:client?.key_prefix||x.client_id}}).filter(x=>JSON.stringify(x).toLowerCase().includes(search.toLowerCase()))
 },[data,tab,search])
 const usage=data.usage||[],payments=data.payments||[],failures=usage.filter(x=>x.status_code>=400),tokens=usage.reduce((a,x)=>a+Number(x.input_tokens||0)+Number(x.output_tokens||0),0),revenue=payments.filter(x=>x.status==='approved').reduce((a,x)=>a+Number(x.amount_cents||0),0)
 async function revokeOld(){if(!session)return;setBusy(true);setError('');try{const response=await fetch('/api/management',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}});const result=await response.json();if(!response.ok)throw new Error(result.error);setRevision(x=>x+1)}catch(e){setError(e instanceof Error?e.message:'Não foi possível revogar.');setBusy(false)}}
 function exportCsv(){const cols=columns[tab],escape=(v:any)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const csv='\ufeff'+[cols.map(c=>escape(titles[c])).join(';'),...enriched.map(x=>cols.map(c=>escape(format(c,x[c]))).join(';'))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`sixtysix-${tab}-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url)}
 return <main className="sx-admin"><header><Link to="/dashboard"><ArrowLeft size={17}/> Dashboard</Link><div className="sx-admin-brand"><img src="/assets/sidebar-logo.png" alt="SixtySix"/><span>SixtySix <small>Administração</small></span></div><span><ShieldCheck size={16}/> Área privada</span></header><section className="sx-admin-heading"><div><p>CONTROLE DA OPERAÇÃO</p><h1>Uma visão de tudo que acontece.</h1><span>Clientes, acesso e pagamentos reais da SixtySix.</span></div><button disabled={busy||!session} onClick={()=>setRevision(x=>x+1)}><RefreshCw size={16} className={busy?'sx-spin':''}/> {busy?'Atualizando…':'Atualizar'}</button></section>
 {loading?<p role="status">Conferindo sua conta…</p>:!session?<div className="sx-admin-message"><h2>Entre com sua conta administrativa</h2><Link to="/login">Entrar na SixtySix</Link></div>:<>
 <p className="sx-admin-note">Testes contabilizados a partir de 09/11/2026 às 18h10 (Brasília).</p><button disabled={busy||!session} onClick={()=>void revokeOld()}>Revogar testes anteriores às 18h10</button><div className="sx-admin-filters"><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><span>Período aplicado ao consumo e aos pagamentos. Horários dos filtros em UTC.{updated&&` Atualizado às ${updated}.`}</span></div>
 {error?<div role="alert" className="sx-admin-message">{error}</div>:<>
 {notice&&<p className="sx-admin-message">{notice}</p>}
 <div className="sx-admin-metrics">{[['Clientes cadastrados',data.users?.length],['Planos com acesso',(data.subscriptions||[]).filter(x=>x.entitled&&Date.parse(x.paid_until)>Date.now()).length],['Pagamentos aprovados',money(revenue)],['Tokens no período',number(tokens)],['Chamadas',number(usage.length)],['Falhas',number(failures.length)]].map(([label,value])=><article key={label}><span>{label}</span><strong>{busy?'…':value??'—'}</strong></article>)}</div>
 <section className="sx-admin-panel"><nav>{Object.entries(labels).map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);setSearch('')}}>{label}<small>{data[key]?.length??0}</small></button>)}</nav><div className="sx-admin-tools"><label><Search size={17}/><input aria-label="Buscar" placeholder="Busque cliente, modelo, chave ou status…" value={search} onChange={e=>setSearch(e.target.value)}/></label><button disabled={busy||!enriched.length} onClick={exportCsv}><Download size={16}/> Exportar CSV</button></div><div className="sx-admin-table"><table><thead><tr>{columns[tab].map(c=><th key={c}>{titles[c]}</th>)}</tr></thead><tbody>{enriched.slice(0,500).map((row,i)=><tr key={row.id||row.subscription_id||i}>{columns[tab].map(c=><td key={c} className={c==='status_code'&&row[c]>=400?'sx-admin-failure':''}>{format(c,row[c])}</td>)}</tr>)}</tbody></table>{!enriched.length&&<p className="sx-admin-empty">{busy?'Carregando os dados da operação…':'Nenhum registro encontrado.'}</p>}</div><footer>{enriched.length>500?'Mostrando os primeiros 500 resultados. Use a busca ou exporte o CSV completo.':`${enriched.length} registros encontrados.`}</footer></section><p className="sx-admin-note">Chaves são identificadas pelo prefixo. Credenciais privadas não são enviadas ao navegador. Os pagamentos refletem o status registrado pela integração; valores aprovados não incluem taxas do Mercado Pago.</p>
 </>}
 </>}
 </main>
}




