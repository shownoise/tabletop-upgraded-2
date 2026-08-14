"use client"

// Twee visualisaties naast elkaar zodat Bas kan kiezen welke leest.
// Spider chart = klassieke zes-assen radar. Staafjes = horizontale balken.
// Beide krijgen dezelfde vector (perDimension van een sessie).
// Waardes lopen -2..+2 per as. Positief = beter afgedekt (behalve KOS
// waar hoger óók beter is want minder schade — zie SCORING.md).

const DIMS = [
  { key: "CONT", label: "Containment" },
  { key: "FOR",  label: "Forensics" },
  { key: "BC",   label: "Business continuity" },
  { key: "JUR",  label: "Juridisch" },
  { key: "VER",  label: "Stakeholders" },
  { key: "KOS",  label: "Kosten" },
] as const
type Dim = typeof DIMS[number]["key"]
export type ReportVector = Record<Dim, number>

// Spider chart in SVG. Radius representeert de waarde (getransleerd van
// −2..+2 naar 0..1). Assen om de as gelabeld.
export function SpiderChart({ vector, size = 280 }: { vector: ReportVector; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 40
  // Punten op de zes assen.
  const angle = (i: number) => (Math.PI * 2 * i) / DIMS.length - Math.PI / 2
  // −2..+2 → 0..1
  const norm = (v: number) => Math.max(0, Math.min(1, (v + 2) / 4))
  const point = (i: number, r: number) => {
    const a = angle(i)
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  }
  const dataPoints = DIMS.map((d, i) => point(i, norm(vector[d.key]) * radius))
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z"
  // Ring-guides op −1, 0, +1, +2 → norm 0.25, 0.5, 0.75, 1.0
  const rings = [0.25, 0.5, 0.75, 1.0]
  const ringLabels = ["-1", "0", "+1", "+2"]

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px] mx-auto" role="img" aria-label="Spider chart van de zes dimensies">
      {/* Ring-guides */}
      {rings.map((r, i) => (
        <g key={i}>
          <polygon
            points={DIMS.map((_, j) => {
              const p = point(j, r * radius)
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
            }).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeDasharray={i === 1 ? "" : "2,3"}
          />
          <text
            x={cx + 4}
            y={cy - r * radius}
            className="fill-muted-foreground"
            fontSize="9"
            fontFamily="monospace"
          >{ringLabels[i]}</text>
        </g>
      ))}
      {/* Assen */}
      {DIMS.map((_, i) => {
        const p = point(i, radius)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" strokeOpacity={0.15} />
      })}
      {/* Data-polygoon */}
      <path
        d={dataPath}
        fill="var(--primary)"
        fillOpacity={0.15}
        stroke="var(--primary)"
        strokeWidth={2}
      />
      {/* Data-punten */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--primary)" />
      ))}
      {/* Labels */}
      {DIMS.map((d, i) => {
        const p = point(i, radius + 18)
        const value = vector[d.key]
        const sign = value >= 0 ? "+" : ""
        return (
          <text
            key={d.key}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            className="fill-foreground font-medium"
          >
            {d.label}
            <tspan
              x={p.x}
              dy="1.1em"
              className={value > 0 ? "fill-emerald-600 dark:fill-emerald-400" : value < 0 ? "fill-rose-600 dark:fill-rose-400" : "fill-muted-foreground"}
              fontFamily="monospace"
              fontSize="9"
            >{sign}{value.toFixed(1)}</tspan>
          </text>
        )
      })}
    </svg>
  )
}

// Horizontale staafjes-variant. Nul-as in het midden. Negatief = links (rood),
// positief = rechts (groen).
export function BarChart({ vector, height = 280 }: { vector: ReportVector; height?: number }) {
  const rowH = 32
  const totalH = DIMS.length * rowH + 20
  return (
    <svg viewBox={`0 0 400 ${totalH}`} className="w-full max-w-[420px]" role="img" aria-label="Staafjes van de zes dimensies">
      {/* Nul-as */}
      <line x1="200" y1="10" x2="200" y2={totalH - 10} stroke="currentColor" strokeOpacity={0.3} />
      {/* -2, -1, +1, +2 grid */}
      {[-2, -1, 1, 2].map(v => {
        const x = 200 + (v / 2) * 180
        return <line key={v} x1={x} y1="10" x2={x} y2={totalH - 10} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="2,3" />
      })}
      {DIMS.map((d, i) => {
        const y = 15 + i * rowH
        const value = vector[d.key]
        const barLen = (Math.abs(value) / 2) * 180
        const barX = value >= 0 ? 200 : 200 - barLen
        const color = value > 0 ? "rgb(16 185 129)" : value < 0 ? "rgb(244 63 94)" : "rgb(148 163 184)"
        return (
          <g key={d.key}>
            <rect
              x={barX}
              y={y}
              width={barLen}
              height={18}
              fill={color}
              fillOpacity={0.7}
              rx={2}
            />
            <text x={value >= 0 ? 195 : 205} y={y + 13} textAnchor={value >= 0 ? "end" : "start"} fontSize="10" className="fill-foreground font-medium">
              {d.label}
            </text>
            <text
              x={value >= 0 ? barX + barLen + 4 : barX - 4}
              y={y + 13}
              textAnchor={value >= 0 ? "start" : "end"}
              fontSize="10"
              fontFamily="monospace"
              className="fill-foreground"
            >
              {value >= 0 ? "+" : ""}{value.toFixed(1)}
            </text>
          </g>
        )
      })}
      <text x="200" y={totalH - 2} textAnchor="middle" fontSize="9" fontFamily="monospace" className="fill-muted-foreground">−2 … 0 … +2</text>
    </svg>
  )
}
