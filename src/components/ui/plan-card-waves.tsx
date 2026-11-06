import React from 'react'

interface PlanCardWavesProps {
  cardIndex: 0 | 1 | 2 // 0 = Teste Grátis (esquerda), 1 = Dev (centro), 2 = Pro Ilimitado (direita)
  className?: string
}

// 5 Linhas fluídas em verde escuro translúcido com junções exatas
// Junção Card 0 -> Card 1 (x=400 / x=0): Y = [220, 280, 340, 400, 460]
// Junção Card 1 -> Card 2 (x=400 / x=0): Y = [200, 270, 330, 390, 450]
const cardPaths: Record<0 | 1 | 2, Array<{ d: string; stroke: string; strokeWidth: number }>> = {
  // Card 0: Teste Grátis (Fase 1: Ascensão & Ondulação Inicial)
  0: [
    {
      d: 'M -5 170 C 110 110, 270 270, 405 220',
      stroke: 'rgba(31, 70, 71, 0.22)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 230 C 130 330, 260 210, 405 280',
      stroke: 'rgba(31, 70, 71, 0.17)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 300 C 120 220, 280 400, 405 340',
      stroke: 'rgba(31, 70, 71, 0.14)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 380 C 140 450, 270 330, 405 400',
      stroke: 'rgba(31, 70, 71, 0.16)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 450 C 130 390, 280 500, 405 460',
      stroke: 'rgba(31, 70, 71, 0.12)',
      strokeWidth: 1.8,
    },
  ],

  // Card 1: Dev (Fase 2: Conexão Central & Cristas Suaves)
  1: [
    {
      d: 'M -5 220 C 120 160, 260 140, 405 200',
      stroke: 'rgba(31, 70, 71, 0.22)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 280 C 140 350, 270 320, 405 270',
      stroke: 'rgba(31, 70, 71, 0.17)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 340 C 120 270, 280 250, 405 330',
      stroke: 'rgba(31, 70, 71, 0.14)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 400 C 140 460, 270 430, 405 390',
      stroke: 'rgba(31, 70, 71, 0.16)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 460 C 130 520, 280 480, 405 450',
      stroke: 'rgba(31, 70, 71, 0.12)',
      strokeWidth: 1.8,
    },
  ],

  // Card 2: Pro Ilimitado (Fase 3: Resolução & Conclusão Harmônica)
  2: [
    {
      d: 'M -5 200 C 130 260, 270 120, 405 170',
      stroke: 'rgba(31, 70, 71, 0.22)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 270 C 120 210, 280 320, 405 230',
      stroke: 'rgba(31, 70, 71, 0.17)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 330 C 140 400, 270 240, 405 300',
      stroke: 'rgba(31, 70, 71, 0.14)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 390 C 120 330, 280 440, 405 370',
      stroke: 'rgba(31, 70, 71, 0.16)',
      strokeWidth: 1.8,
    },
    {
      d: 'M -5 450 C 140 500, 270 380, 405 430',
      stroke: 'rgba(31, 70, 71, 0.12)',
      strokeWidth: 1.8,
    },
  ],
}

export default function PlanCardWaves({ cardIndex, className = '' }: PlanCardWavesProps) {
  const paths = cardPaths[cardIndex] || cardPaths[0]

  return (
    <svg
      className={`plan-card-waves-bg ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 3,
      }}
      viewBox="0 0 400 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((p, idx) => (
        <path
          key={idx}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
