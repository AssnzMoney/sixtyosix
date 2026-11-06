import React from 'react'

interface PlanCardWavesProps {
  cardIndex: 0 | 1 | 2 // 0 = Teste Grátis (esquerda), 1 = Dev (centro), 2 = Pro Ilimitado (direita)
  className?: string
}

export default function PlanCardWaves({ cardIndex, className = '' }: PlanCardWavesProps) {
  // Coordenadas calculadas para sincronização perfeita de ondas contínuas entre os 3 cards
  // Card 0: 0 a 380px
  // Gap 1: 380 a 404px (24px)
  // Card 1: 404 a 784px
  // Gap 2: 784 a 808px (24px)
  // Card 2: 808 a 1188px
  const viewBoxes = {
    0: '0 0 380 550',
    1: '404 0 380 550',
    2: '808 0 380 550',
  }

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
        zIndex: 0,
      }}
      viewBox={viewBoxes[cardIndex]}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M -40 240 C 140 160, 270 310, 470 210 C 670 120, 860 300, 1020 190 C 1120 130, 1190 180, 1240 165"
        stroke="rgba(31, 70, 71, 0.13)"
        strokeWidth="1.5"
      />
      <path
        d="M -40 295 C 170 380, 330 220, 560 330 C 760 420, 930 240, 1090 320 C 1170 360, 1210 330, 1240 315"
        stroke="rgba(31, 70, 71, 0.10)"
        strokeWidth="1.5"
      />
      <path
        d="M -40 355 C 190 260, 380 430, 630 310 C 850 190, 1010 400, 1150 290 C 1190 260, 1220 280, 1240 270"
        stroke="rgba(31, 70, 71, 0.08)"
        strokeWidth="1.5"
      />
      <path
        d="M -40 415 C 220 330, 410 480, 680 370 C 910 270, 1070 420, 1180 340 C 1210 320, 1230 335, 1240 330"
        stroke="rgba(31, 70, 71, 0.09)"
        strokeWidth="1.5"
      />
      <path
        d="M -40 465 C 250 380, 460 520, 740 410 C 970 320, 1110 460, 1200 400 C 1220 390, 1235 405, 1240 400"
        stroke="rgba(31, 70, 71, 0.06)"
        strokeWidth="1.5"
      />
      <path
        d="M -40 515 C 280 430, 500 560, 800 450 C 1030 360, 1150 490, 1240 450"
        stroke="rgba(31, 70, 71, 0.05)"
        strokeWidth="1.5"
      />
    </svg>
  )
}
