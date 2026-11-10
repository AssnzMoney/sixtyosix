import './legal-notice.css'
export default function LegalNotice({dark=false,login=false}:{dark?:boolean;login?:boolean}) {
  return <aside className={'six-legal-notice'+(dark?' six-legal-notice-dark':'')} aria-label="Termos, privacidade e direitos">
    <strong>{login?'Antes de entrar':'Central de confiança SixtySix'}</strong>
    <p>{login?'Ao continuar, você concorda com os Termos de uso. Consulte também como tratamos seus dados e as regras de cancelamento.':'Conheça as condições do serviço, o tratamento dos seus dados e seus direitos antes de criar sua conta ou contratar.'}</p>
    <nav aria-label="Documentos legais"><a href="/termos.html" target="_blank" rel="noopener noreferrer">Termos de uso</a><a href="/privacidade.html" target="_blank" rel="noopener noreferrer">Privacidade e LGPD</a><a href="/reembolso.html" target="_blank" rel="noopener noreferrer">Cancelamento e reembolso</a><a href="/seguranca.html" target="_blank" rel="noopener noreferrer">Segurança e disponibilidade</a></nav>
    <small>Os documentos abrem em uma nova aba.</small>
  </aside>
}
