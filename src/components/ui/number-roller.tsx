import { motion } from 'framer-motion'
import React from 'react'

interface NumberRollerProps {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  animateOnMount?: boolean
  duration?: number
}

function RollingDigit({ digit, duration = 0.55, animateOnMount = false }: { digit: string; duration?: number; animateOnMount?: boolean }) {
  const num = parseInt(digit, 10)

  if (isNaN(num)) {
    return <span className="inline-block select-none">{digit}</span>
  }

  return (
    <span
      className="inline-block overflow-hidden relative"
      style={{
        height: '1.18em',
        lineHeight: '1.18em',
        verticalAlign: '-0.12em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <motion.span
        className="flex flex-col items-center"
        initial={animateOnMount ? { y: "0%" } : false}
        animate={{ y: `-${num * 10}%` }}
        transition={{
          duration,
          ease: [0.16, 1, 0.3, 1], // Curva de desaceleração elástica ultra fluida
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            style={{
              height: '1.18em',
              lineHeight: '1.18em',
              display: 'block',
              textAlign: 'center',
            }}
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export default function NumberRoller({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  className = '',
  duration = 0.55,
  animateOnMount = false,
}: NumberRollerProps) {
  const parts = Math.max(0, value).toFixed(decimals).split('.')
  const intStr = parts[0]
  const decStr = parts[1]
  const intFormatted = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  const tokens: Array<{ char: string; key: string }> = []
  let digitIndex = intStr.length - 1

  for (let i = 0; i < intFormatted.length; i++) {
    const ch = intFormatted[i]
    if (ch === '.') {
      tokens.push({ char: ch, key: `dot-${Math.floor(digitIndex / 3)}` })
    } else {
      tokens.push({ char: ch, key: `int-${digitIndex}` })
      digitIndex--
    }
  }

  if (decStr !== undefined && decimals > 0) {
    tokens.push({ char: ',', key: 'comma' })
    for (let i = 0; i < decStr.length; i++) {
      tokens.push({ char: decStr[i], key: `dec-${i}` })
    }
  }

  return (
    <span className={`inline-flex items-baseline font-tabular-nums ${className}`}>
      {prefix && <span className="inline-block mr-[0.15em] select-none">{prefix}</span>}
      <span className="inline-flex items-baseline">
        {tokens.map((t) => (
          <RollingDigit key={t.key} digit={t.char} duration={duration} animateOnMount={animateOnMount} />
        ))}
      </span>
      {suffix && <span className="inline-block ml-[0.15em] select-none">{suffix}</span>}
    </span>
  )
}

export { NumberRoller }

