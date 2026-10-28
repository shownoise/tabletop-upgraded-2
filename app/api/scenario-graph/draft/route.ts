import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { rateLimit } from "@/lib/rate-limit"
import { buildDraftGraph } from "@/lib/wizard/deterministic"
import { validateFramework } from "@/lib/wizard/framework"
import { validateWizardConfig } from "@/lib/wizard/config"
import { parseWizardConfigFromBody } from "@/lib/wizard/parse-config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Conceptscenario zonder AI.
//
// WAAROM naast /ai-wizard: dat pad doet tien of meer LLM-aanroepen in één
// request en loopt bij vier rondes in de 5-minuten-timeout van de functie. Dit
// pad rekent hetzelfde scenario in code uit — geen netwerk, geen API-key, een
// paar milliseconden — en levert een graph die alle framework-regels haalt.
// Zelfde facilitator-auth als /ai-wizard; de route staat daarom net zo goed
// NIET in PUBLIC_API_ROUTES in proxy.ts.
export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  // Ruim bemeten: dit kost geen AI-tokens, alleen rekentijd. De limiet staat er
  // tegen een vastgelopen client die in een lus blijft aanvragen.
  const userId = (gate.session?.user as { id?: string } | undefined)?.id ?? "unknown"
  const rl = await rateLimit(`draft:${userId}`, 60, 60)
  if (!rl.ok) {
    return NextResponse.json({ error: "Te veel aanvragen. Wacht een minuut." }, {
      status: 429,
      headers: { "Retry-After": String(rl.resetSeconds) },
    })
  }

  const body = await req.json().catch(() => ({}))
  const config = parseWizardConfigFromBody(body)
  const errs = validateWizardConfig(config)
  if (errs.length > 0) {
    return NextResponse.json({ error: `Config ongeldig: ${errs.join("; ")}` }, { status: 400 })
  }

  const graph = buildDraftGraph(config, { now: Date.now() })
  // De regels draaien ook hier: zakt er ooit een regel door een wijziging in
  // de generator, dan ziet de facilitator dat als waarschuwing bij het concept
  // in plaats van dat het stil misgaat.
  const { failures } = validateFramework(graph, config)

  return NextResponse.json({
    ok: true,
    graph,
    seed: graph.wizardSeed ?? "",
    repairLog: [],
    warnings: failures,
  })
}
