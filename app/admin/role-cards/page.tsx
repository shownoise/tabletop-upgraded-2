import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import { dbLoadScenarioGraph } from "@/lib/db"
import { graphToScenarioSpec } from "@/lib/scoring/graph-adapter"
import { buildRoleCards, resolveRoles } from "@/lib/scoring"
import { ROLE_META, type Role } from "@/lib/types"
import { APP_ROLE_TO_SPEC, fromSpecRole } from "@/lib/graph/role-adapter"

// Deel B §7.5 — print-friendly role cards. Eén (ronde × rol) per pagina;
// private injects + eigenaarschap zichtbaar. Facilitator print + knipt in
// enveloppen zodat rolinformatie asymmetrisch verdeeld blijft.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function RoleCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ graph?: string }>
}) {
  const { graph: graphId } = await searchParams
  if (!graphId) {
    return <NoGraphSelector />
  }
  const graph = await dbLoadScenarioGraph(graphId)
  if (!graph) notFound()

  const scenario = graphToScenarioSpec(graph)
  // Alle 9 app-rollen als bezet aannemen — de kaarten worden gegenereerd voor
  // elke rol die daadwerkelijk private inject of eigenaarschap heeft.
  const allSpecRoles = Object.values(APP_ROLE_TO_SPEC)
  const resolution = resolveRoles(
    { presentRoles: allSpecRoles as string[] },
    scenario,
  )
  const cards = buildRoleCards(scenario, resolution)

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      {/* Header — verborgen tijdens print */}
      <header className="border-b print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href={`/templates/builder?graph=${graphId}`} className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Terug naar builder
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{graph.name}</span>
            <button
              onClick={() => typeof window !== "undefined" && window.print()}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider hover:bg-muted"
            >
              <Printer className="size-3.5" /> Print
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 print:p-0">
        {cards.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-muted-foreground">
              Geen rolkaarten te genereren. Zet visibility=exclusive op injects met targetRoles,
              of markeer decisions met scoringDomain/Owner.
            </p>
          </div>
        )}
        {cards.map((card, idx) => {
          const appRoles = fromSpecRole(card.role)
          const appRoleLabel = appRoles.length > 0 ? ROLE_META[appRoles[0]].label : card.role
          return (
            <article
              key={`${card.round}-${card.role}-${idx}`}
              className="border-2 border-black bg-white p-8 mb-8 print:mb-0 print:border-2 print:break-after-page"
              style={{ minHeight: "24cm" }}
            >
              <header className="mb-6 pb-4 border-b-2 border-black">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest opacity-60">Ronde {card.round}</div>
                    <h1 className="text-3xl font-bold mt-1">{appRoleLabel}</h1>
                    <div className="font-mono text-xs uppercase tracking-wider opacity-60 mt-1">
                      Spec-rol: {card.role}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs uppercase tracking-widest opacity-60">Scenario</div>
                    <div className="font-mono text-sm mt-1">{graph.name}</div>
                  </div>
                </div>
              </header>

              {card.privateInjects.length > 0 && (
                <section className="mb-6">
                  <h2 className="text-lg font-bold mb-3 uppercase tracking-wider">
                    Alleen jij ziet dit
                  </h2>
                  {card.privateInjects.map(inj => (
                    <div key={inj.id} className="mb-4 border-l-4 border-black pl-3">
                      <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">
                        {inj.origin === "facilitator" ? "Facilitator inject" : "Scenario inject"} · Ronde {inj.round}
                      </div>
                      <div className="mt-1 font-mono text-sm">
                        {inj.correctRoute && (
                          <span className="inline-block bg-yellow-100 border border-yellow-400 px-1 py-0.5 text-[10px] mr-2">
                            MISROUTE → {inj.correctRoute}
                          </span>
                        )}
                        Inject {inj.id} — importance: {inj.importance}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {card.ownedDecisions.length > 0 && (
                <section className="mb-6">
                  <h2 className="text-lg font-bold mb-3 uppercase tracking-wider">
                    Beslispunten in jouw mandaat
                  </h2>
                  <ul className="space-y-2">
                    {card.ownedDecisions.map(dp => (
                      <li key={dp.decisionPointId} className="border-l-4 border-black pl-3">
                        <div className="font-mono text-xs uppercase tracking-wider opacity-60">
                          Domein: {dp.domain}
                        </div>
                        <div className="font-mono text-sm mt-1">
                          {dp.decisionPointId}
                          {dp.consulted.length > 0 && (
                            <span className="opacity-60"> · consult: {dp.consulted.join(", ")}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {card.misroutedInjects.length > 0 && (
                <section className="mb-6">
                  <h2 className="text-lg font-bold mb-3 uppercase tracking-wider">
                    Misroute — komt bij jou binnen, hoort ergens anders
                  </h2>
                  <ul className="space-y-2">
                    {card.misroutedInjects.map(inj => (
                      <li key={inj.id} className="font-mono text-sm border-l-4 border-yellow-500 pl-3">
                        {inj.id} — hoort bij: <strong>{inj.correctRouteEffective}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <footer className="mt-auto pt-6 border-t border-black text-[10px] font-mono opacity-60 uppercase tracking-widest">
                Cut here · vertrouwelijk · niet delen tijdens overleg
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

function NoGraphSelector() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Rolkaarten</h1>
        <p className="text-sm text-muted-foreground">
          Voeg een <code>?graph=&lt;graphId&gt;</code> query-parameter toe om rolkaarten voor een specifieke scenario te printen.
        </p>
      </div>
    </div>
  )
}
