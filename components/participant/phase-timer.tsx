"use client"
import { useEffect, useState } from "react"
import { ClipboardList, MessageSquare, Zap, CheckCircle2 } from "lucide-react"

interface Props {
  phaseName: string
  phaseIndex: number
  totalPhases: number
  startedAt: number
  effectiveDurationSeconds: number
  paused?: boolean
}

// Fase-metadata: icoon + kleur per fase-index (0..3). Volgorde uit round-phases.ts:
// 0 briefing (blauw), 1 discussie (groen), 2 beslissing (amber → rood), 3 review (grijs).
const PHASE_META = [
  { Icon: ClipboardList, ring: "#38bdf8" }, // briefing
  { Icon: MessageSquare, ring: "#22c55e" }, // discussie
  { Icon: Zap,           ring: "#f59e0b" }, // beslissing
  { Icon: CheckCircle2,  ring: "#64748b" }, // review
] as const

const SIZE = 72                       // px, buiten-diameter
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

export function PhaseTimer({ phaseName, phaseIndex, totalPhases, startedAt, effectiveDurationSeconds, paused }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [paused])

  const elapsedMs = Math.max(0, now - startedAt)
  const totalMs = Math.max(1, effectiveDurationSeconds * 1000)
  const remainingMs = Math.max(0, totalMs - elapsedMs)
  const frac = Math.min(1, elapsedMs / totalMs)
  const min = Math.floor(remainingMs / 60000)
  const sec = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, "0")

  // Fase-metadata; fallback naar briefing als index buiten range zit.
  const meta = PHASE_META[Math.min(phaseIndex, PHASE_META.length - 1)] ?? PHASE_META[0]
  const Icon = meta.Icon

  // Decision-fase heeft een extra urgency-mode in de laatste 30% van de tijd:
  // ring wordt rood, hele badge pulseert. Andere fases pulseren niet.
  const isDecisionPhase = phaseIndex === 2
  const isCritical = isDecisionPhase && frac >= 0.7 && !paused
  const isBurning  = isDecisionPhase && frac >= 0.9 && !paused
  const ringColor = isCritical ? "#ef4444" : meta.ring
  const dashOffset = CIRC * (1 - frac)

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative shrink-0 ${isBurning ? "animate-[pulse_0.6s_ease-in-out_infinite]" : isCritical ? "animate-[pulse_1.5s_ease-in-out_infinite]" : ""}`}
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            stroke="var(--tt-border)" strokeWidth={STROKE} fill="none"
            opacity={0.25}
          />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            stroke={ringColor} strokeWidth={STROKE} fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="size-6" style={{ color: ringColor }} />
        </div>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: ringColor }}>
          {phaseName}
        </span>
        <span className={`font-mono text-2xl font-bold ${isCritical ? "text-red-500" : "text-tt-bright"}`}>
          {paused ? "paused" : `${min}:${sec}`}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
          Fase {phaseIndex + 1} / {totalPhases}
          {isBurning ? " · BESLIS NU" : isCritical ? " · rond af" : ""}
        </span>
      </div>
    </div>
  )
}

interface SegmentedProps {
  totalPhases: number
  phaseIndex: number
  names?: string[]
}

// Segmenten-strip is er nog voor legacy plekken die 'm nog gebruiken; we
// hebben 'm niet meer nodig in de nieuwe layout maar we breken hem niet af.
export function PhaseSegments({ totalPhases, phaseIndex, names }: SegmentedProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalPhases }, (_, i) => (
        <div
          key={i}
          className={`h-0.5 flex-1 rounded-full ${
            i < phaseIndex ? "bg-tt-accent" :
            i === phaseIndex ? "bg-tt-accent/60" :
            "bg-tt-border/40"
          }`}
          title={names?.[i]}
        />
      ))}
    </div>
  )
}
