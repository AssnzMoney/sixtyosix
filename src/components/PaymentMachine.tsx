import { useEffect } from 'react'
import { armSound, playPlim, playPrint } from '../lib/printSound'
import './payment-machine.css'

export type Receipt = { plan: string; amount: string; method: string; date: string; until: string; order: string }

// Tempos da impressão (iguais aos do CSS): a máquina assenta, o papel sai em passos e, no fim, o plim.
const PRINT_DELAY = 0.75
const PRINT_TIME = 2.4
const PRINT_STEPS = 20

/**
 * Maquininha da confirmação de pagamento. "aguardando": tela com o círculo girando.
 * "aprovado": a tela confirma, a notinha sai de dentro da máquina (com som de impressora) e termina com um plim.
 */
export default function PaymentMachine({ state, receipt, onPrinted }: { state: 'aguardando' | 'aprovado'; receipt: Receipt | null; onPrinted?: () => void }) {
  const approved = state === 'aprovado' && receipt
  useEffect(() => armSound(), [])
  useEffect(() => {
    if (!approved) return
    playPrint(PRINT_DELAY, PRINT_TIME, PRINT_STEPS)
    playPlim(PRINT_DELAY + PRINT_TIME + 0.12)
  }, [approved])

  return (
    <div className={`pm${approved ? ' is-approved' : ''}`} role="img" aria-label={approved ? `Pagamento aprovado: ${receipt.plan}, ${receipt.amount}` : 'Aguardando a confirmação do pagamento'}>
      <div className="pm-window" aria-hidden="true">
        {approved && (
          <div className="pm-paper" onAnimationEnd={(e) => { if (e.animationName === 'pm-print') onPrinted?.() }}>
            <img src="/assets/sidebar-logo.png" alt="" />
            <strong className="pm-total">{receipt.amount}</strong>
            <span className="pm-tag">Pagamento aprovado</span>
            <hr />
            <dl>
              <div><dt>Plano</dt><dd>{receipt.plan}</dd></div>
              <div><dt>Forma</dt><dd>{receipt.method}</dd></div>
              <div><dt>Data</dt><dd>{receipt.date}</dd></div>
              <div><dt>Pedido</dt><dd>{receipt.order}</dd></div>
            </dl>
            <hr />
            <p className="pm-until">Acesso até {receipt.until}</p>
          </div>
        )}
      </div>
      <div className="pm-machine" aria-hidden="true">
        <span className="pm-slot" />
        <div className="pm-screen">
          {approved ? (
            <div className="pm-ok">
              <svg viewBox="0 0 64 64" width="64" height="64">
                <circle className="pm-ring" cx="32" cy="32" r="28" />
                <path className="pm-tick" d="M20 33 L28 41 L44 24" />
              </svg>
              <b>Aprovado</b>
              <small>{receipt.amount}</small>
            </div>
          ) : (
            <div className="pm-wait">
              <span className="pm-spin" />
              <b>Aguardando Pix</b>
              <small>Confirmando com o banco</small>
            </div>
          )}
        </div>
        <img className="pm-brand" src="/assets/sidebar-logo.png" alt="" />
      </div>
    </div>
  )
}
