import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowBigUp } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Botão de voto, adaptado do "Animated Upvote Button" do 21st.dev (shadcnspace):
 * onda ao clicar, partículas subindo e o número deslizando. Aqui ele é controlado (o voto vem do
 * servidor), usa o verde da SixtySix e funciona nos temas claro e escuro do painel.
 */
const COLORS = ["bg-[#9eea6c]", "bg-[#b5f08f]", "bg-[#16a34a]", "bg-[#d9f99d]"]
const COUNT = 7
const PARTICLES = Array.from({ length: COUNT }, (_, i) => {
  const angle = -155 + (i / (COUNT - 1)) * 130
  const rad = (angle * Math.PI) / 180
  const dist = 30 + (i % 2) * 16
  return { id: i, x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, color: COLORS[i % COLORS.length], size: 4 + (i % 2), dur: 0.5 + (i % 3) * 0.07 }
})

export function UpvoteButton({
  count,
  voted,
  disabled,
  onToggle,
  ariaLabel,
  title,
}: {
  count: number
  voted: boolean
  disabled?: boolean
  onToggle: () => void
  ariaLabel: string
  title?: string
}) {
  const reduce = useReducedMotion()
  const [burst, setBurst] = useState(0)
  const before = useRef(count)
  const up = count >= before.current
  useEffect(() => {
    before.current = count
  }, [count])

  return (
    <div className="relative inline-flex items-center justify-center">
      <AnimatePresence>
        {!reduce &&
          burst > 0 &&
          voted &&
          PARTICLES.map((p) => (
            <motion.span
              key={`${p.id}-${burst}`}
              className={cn("pointer-events-none absolute rounded-full", p.color)}
              style={{ width: p.size, height: p.size, left: "50%", top: "50%", marginLeft: -(p.size / 2), marginTop: -(p.size / 2) }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: [0, p.y * 0.6, p.y], opacity: [1, 1, 0], scale: 0.5 }}
              exit={{}}
              transition={{ duration: p.dur, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
      </AnimatePresence>
      <motion.button
        type="button"
        aria-pressed={voted}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => {
          if (!voted) setBurst((k) => k + 1)
          onToggle()
        }}
        whileHover={disabled || reduce ? undefined : { scale: 1.05 }}
        whileTap={disabled || reduce ? undefined : { scale: 0.9 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className={cn(
          "relative inline-flex h-9 cursor-pointer items-center gap-1.5 overflow-hidden rounded-full border pr-3.5 pl-2.5 font-['Manrope'] text-[13px] font-bold select-none",
          "transition-[background-color,border-color,color,box-shadow] duration-300 disabled:cursor-not-allowed",
          voted
            ? "border-transparent bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_4px_14px_var(--accent-glow)] disabled:opacity-85"
            : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--em)] hover:text-[var(--em)] disabled:opacity-55 disabled:hover:border-[var(--line-strong)] disabled:hover:text-[var(--ink)]",
        )}
      >
        <AnimatePresence initial={false}>
          {!reduce && (
            <motion.span
              key={burst}
              className="pointer-events-none absolute size-5 rounded-full bg-[#9eea6c]/35"
              style={{ top: "50%", left: "50%", marginLeft: -10, marginTop: -10 }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 14, opacity: 0 }}
              exit={{}}
              transition={{ scale: { duration: 1.1, ease: "easeOut" }, opacity: { duration: 1, ease: "easeIn", delay: 0.1 } }}
            />
          )}
        </AnimatePresence>
        <motion.span key={`icon-${burst}-${voted}`} className="relative" animate={reduce ? undefined : voted ? { y: [0, -4, 1, -2, 0] } : { y: [0, 3, 0] }} transition={{ duration: 0.4, ease: "easeOut" }}>
          <ArrowBigUp className="size-5" fill={voted ? "currentColor" : "none"} strokeWidth={1.75} />
        </motion.span>
        <span className="relative flex h-5 min-w-[2ch] items-center overflow-hidden font-['DM_Mono',monospace] tabular-nums">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={count}
              className="block"
              initial={reduce ? false : { y: up ? 12 : -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? undefined : { y: up ? -12 : 12, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0.2, 1] }}
            >
              {count.toLocaleString("pt-BR")}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="relative">{voted ? "Votado" : "Votar"}</span>
      </motion.button>
    </div>
  )
}
