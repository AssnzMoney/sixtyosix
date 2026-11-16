import { useRef } from "react"
import { motion, useInView, useReducedMotion } from "framer-motion"
import { Crown } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Pódio do top 3, adaptado do "Leaderboard Podium" do 21st.dev (trophyso):
 * mesma ideia (2º, 1º, 3º lado a lado, coroa e bloco com a posição), com as cores da SixtySix,
 * capa do projeto no lugar do avatar e os blocos subindo quando o pódio entra na tela.
 */
export type PodiumItem = { id: string; rank: 1 | 2 | 3; title: string; subtitle: string; value: number; image: string | null }

const PLACES = {
  1: { block: "from-[#c3f5a0] to-[#7fd04a] text-[#0b3824]", ring: "ring-[#9eea6c]", crown: "text-[#f5c542]", height: "h-32 sm:h-36", delay: 0.35 },
  2: { block: "from-[#f1f5f3] to-[#c9d6d2] text-[#1f4647]", ring: "ring-[#dbe5e1]", crown: "text-[#c9d6d2]", height: "h-24 sm:h-28", delay: 0.18 },
  3: { block: "from-[#f8d49a] to-[#d99a4a] text-[#4a2c05]", ring: "ring-[#f0b968]", crown: "text-[#e7a95a]", height: "h-16 sm:h-20", delay: 0.05 },
} as const

export function LeaderboardPodium({ items, valueLabel, className }: { items: PodiumItem[]; valueLabel: (value: number) => string; className?: string }) {
  const reduce = useReducedMotion()
  // O pódio inteiro decide quando animar: um bloco com altura zero nunca "entra" na tela sozinho.
  const ref = useRef<HTMLOListElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const order = [2, 1, 3].map((rank) => items.find((i) => i.rank === rank)).filter(Boolean) as PodiumItem[]
  if (!order.length) return null
  return (
    <ol ref={ref} className={cn("flex items-end justify-center gap-3 sm:gap-5", className)} aria-label="Pódio do mês">
      {order.map((item) => {
        const place = PLACES[item.rank]
        return (
          <li key={item.id} className="flex w-[30%] max-w-36 min-w-0 flex-col items-center" aria-label={`${item.rank}º lugar: ${item.title}, ${valueLabel(item.value)}`}>
            <motion.div
              className="relative mb-2"
              initial={reduce ? false : { opacity: 0, y: -14, scale: 0.9 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
              transition={{ delay: place.delay + 0.35, type: "spring", stiffness: 320, damping: 22 }}
              aria-hidden="true"
            >
              <div className={cn("grid size-14 place-items-center overflow-hidden rounded-2xl bg-[#0e3a3b] ring-2 ring-offset-2 ring-offset-[#0c3233] sm:size-16", place.ring)}>
                {item.image ? (
                  <img src={item.image} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <span className="font-['Fustat'] text-2xl font-extrabold text-[#9eea6c]/70">{item.title.trim()[0]?.toUpperCase() || "?"}</span>
                )}
              </div>
              <span className="absolute -top-3 -right-3 grid size-7 place-items-center rounded-full bg-[#0b2122] shadow-md ring-1 ring-white/10">
                <Crown className={cn("size-4", place.crown)} fill="currentColor" strokeWidth={1.5} />
              </span>
            </motion.div>
            <span className="w-full truncate text-center text-[13px] font-bold text-white" title={item.title}>
              {item.title}
            </span>
            <span className="w-full truncate text-center text-xs text-[#b5cfc7]">{item.subtitle}</span>
            <span className="mt-0.5 text-xs font-bold text-[#9eea6c] tabular-nums">{valueLabel(item.value)}</span>
            <motion.div
              aria-hidden="true"
              className={cn("mt-2 w-full origin-bottom rounded-t-2xl bg-gradient-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]", place.block, place.height)}
              initial={reduce ? false : { scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : undefined}
              transition={{ delay: place.delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex h-10 items-center justify-center font-['Fustat'] text-2xl font-extrabold">{item.rank}</div>
            </motion.div>
          </li>
        )
      })}
    </ol>
  )
}
