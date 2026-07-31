import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"
import { getState } from "@/lib/session-store"
import { sessionToScoringInput } from "@/lib/scoring/graph-adapter"
import { scoreExerciseByGroup } from "@/lib/scoring"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Deel B §6 — print-friendly one-pager per groep. Query-param ?groupId=X of
// zonder → toont alle groepen naast elkaar. Facilitator print + deelt uit.

const DIMS = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"] as const
const DIM_LABELS: Record<string, string> = {
  CONT: "Containment",
  FOR:  "Forensische integriteit",
  BC:   "Bedrijfscontinuïteit",
  JUR:  "Juridisch",
  VER:  "Vertrouwen",
  KOS:  "Kosten",
}

export default async function OnePagerPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>
}) {
  const { groupId } = await searchParams
  const state = await getState()
  const session = state.session
  if (!session) {
    return <NoSession />
  }
  const input = sessionToScoringInput(session, { mode: "EVENT" })
  if (!input) {
    return <NoGraph />
  }
  const perGroup = scoreExerciseByGroup(input)
  const groups = session.groups ?? []
  const filtered = groupId ? groups.filter(g => g.id === groupId) : groups

  if (filtered.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Geen groep gevonden voor dit filter.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      {/* Header — verborgen bij print */}
      <header className="border-b print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{session.scenario.scenario_title}</span>
            <PrintButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 print:p-0">
        {filtered.map(g => {
          const out = perGroup[g.id]
          if (!out) return null
          return (
            <article
              key={g.id}
              className="border-2 border-black bg-white p-8 mb-8 print:mb-0 print:border-2 print:break-after-page"
              style={{ minHeight: "27cm" }}
            >
              <header className="mb-8 pb-4 border-b-2 border-black">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest opacity-60">Groep</div>
                    <h1 className="text-4xl font-bold mt-1">{g.name}</h1>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs uppercase tracking-widest opacity-60">Totaal punten</div>
                    <div className="text-6xl font-bold tabular-nums">{out.totalPoints}</div>
                  </div>
                </div>
              </header>

              <section className="mb-8">
                <h2 className="text-lg font-bold mb-4 uppercase tracking-wider">Uitkomst per ronde</h2>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="text-left py-2 font-mono text-xs uppercase">Ronde</th>
                      <th className="text-right py-2 font-mono text-xs uppercase">Punten</th>
                      {DIMS.map(d => (
                        <th key={d} className="text-right py-2 font-mono text-xs uppercase">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {out.outcomes.map(o => (
                      <tr key={o.round} className="border-b border-black/20">
                        <td className="py-2 font-mono">R{o.round}</td>
                        <td className="text-right py-2 font-mono font-bold">{o.points}</td>
                        {DIMS.map(d => (
                          <td key={d} className="text-right py-2 font-mono tabular-nums">
                            {o.perDimension[d] > 0 ? "+" : ""}{o.perDimension[d].toFixed(1)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="mb-8">
                <h2 className="text-lg font-bold mb-3 uppercase tracking-wider">Dimensie-legende</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {DIMS.map(d => (
                    <div key={d}>
                      <strong className="font-mono">{d}</strong> — {DIM_LABELS[d]}
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-lg font-bold mb-3 uppercase tracking-wider">Sterke en zwakke punten</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="font-mono text-xs uppercase opacity-60 mb-2">Sterkst op</div>
                    <ul className="text-sm space-y-1">
                      {topDims(out.outcomes, "up").map(d => (
                        <li key={d.dim}><strong>{DIM_LABELS[d.dim]}</strong> — cumulatief +{d.value.toFixed(1)}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-mono text-xs uppercase opacity-60 mb-2">Zwakst op</div>
                    <ul className="text-sm space-y-1">
                      {topDims(out.outcomes, "down").map(d => (
                        <li key={d.dim}><strong>{DIM_LABELS[d.dim]}</strong> — cumulatief {d.value.toFixed(1)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <footer className="mt-auto pt-6 border-t border-black text-[10px] font-mono opacity-60 uppercase tracking-widest">
                Scoring v{out.scoringVersion} · {session.scenario.scenario_title} · gegenereerd door Cyber Tabletop
              </footer>
            </article>
          )
        })}
      </main>

      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}

function topDims(outcomes: Array<{ perDimension: Record<string, number> }>, dir: "up" | "down") {
  const cum: Record<string, number> = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  for (const o of outcomes) {
    for (const d of DIMS) cum[d] += o.perDimension[d] ?? 0
  }
  const sorted = DIMS.map(d => ({ dim: d, value: cum[d] }))
    .sort((a, b) => dir === "up" ? b.value - a.value : a.value - b.value)
  return sorted.slice(0, 2)
}

function NoSession() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Geen actieve sessie.</p>
    </div>
  )
}

function NoGraph() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Sessie heeft geen graph — one-pager vereist scoring.</p>
    </div>
  )
}

// Extracted client-side print button (server component wrapper can't call window).
function PrintButton() {
  return (
    <a
      href="javascript:window.print()"
      className="flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider hover:bg-muted"
    >
      <Printer className="size-3.5" /> Print
    </a>
  )
}
