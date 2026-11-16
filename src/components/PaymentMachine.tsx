import { Check } from 'lucide-react'
import './payment-machine.css'

export type Receipt = { plan: string; amount: string; method: string; date: string; until: string; order: string }

/**
 * Maquininha da confirmação de pagamento. "aguardando": a tela pisca esperando o Pix.
 * "aprovado": a tela fica verde e a notinha sai impressa por cima; ao terminar, chama onPrinted.
 */
export default function PaymentMachine({ state, receipt, onPrinted }: { state: 'aguardando' | 'aprovado'; receipt: Receipt | null; onPrinted?: () => void }) {
  const approved = state === 'aprovado' && receipt
  return (
    <div className={`pm${approved ? ' is-approved' : ''}`} role="img" aria-label={approved ? `Pagamento aprovado: ${receipt.plan}, ${receipt.amount}` : 'Aguardando a confirmação do pagamento'}>
      <div className="pm-window" aria-hidden="true">
        {approved && (
          <div className="pm-receipt" onAnimationEnd={(e) => { if (e.animationName === 'pm-print') onPrinted?.() }}>
            <img src="/assets/sidebar-logo.png" alt="" />
            <strong className="pm-receipt-title">Comprovante</strong>
            <hr />
            <dl>
              <div><dt>Plano</dt><dd>{receipt.plan}</dd></div>
              <div><dt>Valor</dt><dd>{receipt.amount}</dd></div>
              <div><dt>Forma</dt><dd>{receipt.method}</dd></div>
              <div><dt>Data</dt><dd>{receipt.date}</dd></div>
              <div><dt>Pedido</dt><dd>{receipt.order}</dd></div>
            </dl>
            <hr />
            <p className="pm-until">Acesso até <b>{receipt.until}</b></p>
            <p className="pm-thanks">Obrigado por escolher a SixtySix</p>
          </div>
        )}
      </div>
      <div className="pm-machine" aria-hidden="true">
        <span className="pm-slot" />
        <div className="pm-screen">
          {approved ? (
            <div className="pm-ok">
              <span className="pm-check"><Check size={30} strokeWidth={3.2} /></span>
              <b>Aprovado</b>
              <small>{receipt.amount}</small>
            </div>
          ) : (
            <div className="pm-wait">
              <b>Aguardando o Pix</b>
              <span className="pm-dots"><i /><i /><i /></span>
            </div>
          )}
        </div>
        <div className="pm-keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].map((key, i) => <i key={i}>{key}</i>)}
        </div>
        <div className="pm-actions"><i className="is-red" /><i className="is-yellow" /><i className="is-green" /></div>
        <span className="pm-led" />
      </div>
      <div className="pm-shadow" aria-hidden="true" />
    </div>
  )
}
