import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

/** Coluna direita do login e da tela de WhatsApp: as damas e o mascote de paraquedas, com o texto embaixo. */
export default function AuthShowcase({ children }: { children: ReactNode }) {
  return (
    <div className="login-right-col">
      <div className="login-showcase-panel">
        <div className="login-art-stage">
          <motion.img
            src="/assets/login-art-lady-left.webp"
            alt="Donzela Renascentista"
            className="login-art-lady-left"
            initial={{ opacity: 0, x: -35 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="login-art-parachute-wrap">
            <img src="/assets/sixtysix-parachute.webp" alt="SixtySix Paraquedas" className="login-art-parachute-img" />
          </div>

          <motion.img
            src="/assets/login-art-lady-right.webp"
            alt="Dama Renascentista"
            className="login-art-lady-right"
            initial={{ opacity: 0, x: 35 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {children}
      </div>
    </div>
  )
}
