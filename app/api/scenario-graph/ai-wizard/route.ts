import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { planToGraph, type WizardPlan } from "@/lib/graph/wizard-plan"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { rateLimit } from "@/lib/rate-limit"
import { sanitizeForPrompt, PROMPT_FIELD_CAPS } from "@/lib/scenario/sanitize"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

interface Body {
  sector?: string
  companySize?: string
  attackType?: string
  difficulty?: "beginner" | "intermediate" | "advanced"
  roundCount?: number
  freeText?: string
  crownJewels?: string
  criticalSystems?: string
  clientName?: string
}

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const userId = (gate.session?.user as { id?: string } | undefined)?.id ?? "unknown"
  const rl = await rateLimit(`ai:${userId}`, 10, 60)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many AI requests. Please wait a minute." }, {
      status: 429,
      headers: { "Retry-After": String(rl.resetSeconds) },
    })
  }

  const body = await req.json() as Body
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
  }

  const roundCount = Math.max(3, Math.min(6, body.roundCount ?? 5))

  const sector          = sanitizeForPrompt(body.sector, PROMPT_FIELD_CAPS.sector) || "onbepaald"
  const companySize     = sanitizeForPrompt(body.companySize, PROMPT_FIELD_CAPS.companySize) || "onbepaald"
  const attackType      = sanitizeForPrompt(body.attackType, PROMPT_FIELD_CAPS.scenarioType) || "ransomware_double_extortion"
  const crownJewels     = sanitizeForPrompt(body.crownJewels, PROMPT_FIELD_CAPS.crownJewels) || "onbepaald"
  const criticalSystems = sanitizeForPrompt(body.criticalSystems, PROMPT_FIELD_CAPS.criticalSystems) || "onbepaald"
  const clientName      = sanitizeForPrompt(body.clientName, 200) || "de klant"
  const freeText        = sanitizeForPrompt(body.freeText, 4000)

  const prompt = `Je bent een tabletop-scenarioschrijver voor Eye Security's IR-retainer klanten. Wij faciliteren als IR-partner een crisisoefening bij een klantorganisatie. Genereer een compleet startscenario als JSON dat de facilitator daarna kan tweaken.

Context (in te vullen door de klantorganisatie):
- Klantnaam: ${clientName}
- Sector: ${sector}
- Bedrijfsgrootte: ${companySize}
- Aanvalstype: ${attackType}
- Moeilijkheid: ${body.difficulty ?? "intermediate"}
- Aantal rondes: ${roundCount}
- Kroonjuwelen (belangrijkste assets): ${crownJewels}
- Kritieke systemen: ${criticalSystems}
${freeText ? `- Extra context: ${freeText}` : ""}

PLAYABLE ROLES — exact 8, gebruik altijd deze IDs:
  ceo, ciso, cfo, legal, head_of_comms, hr_lead, ops_manager, it_manager

EXTERNE PARTIJEN (NOOIT als playable role — alleen als inject-bron of melding-recipient):
  IR-retainer (Eye Security), MSP/IT-partner, cyberverzekeraar, Autoriteit Persoonsgegevens (AP),
  NCSC, politie, klanten, leveranciers, media.

REGELS VOOR EEN GOEDE TRAINING:
1. Vier fasen per ronde (Inject → Discussie → Beslissing → Review) worden door de engine afgedwongen; jij schrijft alleen situation, injects, roleActions, opties, outcomes.
2. Per ronde: 2-3 injects, met reliability tag: "fact" | "assumption" | "misleading" (max 1 misleading per ronde). De reliability is de ground truth die alleen tijdens REVIEW wordt onthuld — participants moeten het zelf herkennen.
3. Per ronde: **3-4 roleActions per rol** die dienen als per-rol beslisopties. Zorg dat elke rol tenminste één inhoudelijke keuze heeft — vooral CEO moet altijd wat te doen hebben (nooit "wachten").
4. Elke roleAction krijgt:
   - qualityRank: "best" | "good" | "poor" | "wrong" — hoe de IR-retainer deze keuze beoordeelt
   - facilitatorCommentary: 1 zin IR-perspectief (verschijnt in REVIEW én rapport)
   - lessonLearned: 1 zin debrief-notitie
5. Optioneel: één red-flag actie per ronde met respondsToMisleading:true (participant reageert op de misleidende inject als ware het feit).
6. Rounds hebben openingPrompts (2-3 startvragen die het team direct kan bespreken) en facilitatorPerspective (jouw IR-briefing — alleen zichtbaar voor facilitator).
7. Per-ronde-decision (optioneel maar aanbevolen) — een expliciet beslispunt met per-role opties. Elk option-object krijgt:
   - allowedRole: de rol die deze optie mag kiezen
   - outcomeVector: {CONT, FOR, BC, JUR, VER, KOS} met integer waardes van -2 tot +2 die de trade-off op de 6 uitkomstdimensies weergeven
   - qualityRank, facilitatorCommentary, lessonLearned
   - leadsTo: "round:<0-based-idx>" (meestal +1) of "outcome:<key>"
   - eventueel implicit:true op één optie ("geen besluit binnen de tijd")
8. Melding-moment op één of meer rondes: participants kunnen zelf een melding indienen (bv. IR-retainer bellen, AP-melding voorbereiden). Elk melding-type heeft een triggersInjectId dat verwijst naar een inject-id in dezelfde plan die als reactie wordt gespawnd.
9. irPlaybook (markdown) — het "crisis playbook" van de klant. Bevat opzettelijk 1-2 verouderde of misleidende passages zodat participants leren kritisch naar hun eigen documentatie te kijken.
10. Outcomes (min 3, max 5): "excellent" | "goed" | "gemiddeld" | "slecht" — met scoreRange {min, max} zodat de engine op basis van cumulatieve score selecteert.

DE 6 UITKOMSTDIMENSIES (elke option.outcomeVector krijgt een waarde per as, -2..+2):
  CONT (Containment) — hoger = beter ingedamd
  FOR  (Forensische positie) — hoger = betere forensische positie
  BC   (Bedrijfscontinuïteit) — hoger = minder verstoring
  JUR  (Juridisch & meldplicht) — hoger = beter afgedekt
  VER  (Verantwoording & communicatie) — hoger = duidelijker verantwoord
  KOS  (Kosten & schade) — hoger = lagere schade

Elke keuze is een trade-off: geen enkele optie is +2 op alles. Snel isoleren scoort +CONT maar kan -FOR (bewijs verloren). Losgeld betalen scoort mogelijk +BC maar -JUR/-KOS. Etc.

Geef ALLEEN geldige JSON terug (geen markdown blocks, geen uitleg buiten de JSON), exact volgens dit schema:

{
  "name": "OPERATIE X — ${clientName}",
  "scenarioType": "ransomware_double_extortion",
  "irPlaybook": "## Ransomware playbook — ${clientName}\\n- Betaling tot 50k EUR toegestaan door CFO (OPZET-VEROUDERD: sinds 2024 alleen board-approval).\\n- Contact met IR-retainer via activationnummer...\\n...",
  "rounds": [
    {
      "title": "Korte titel",
      "situation": "3-4 zinnen situation update in het Nederlands",
      "timerMinutes": 15,
      "openingPrompts": ["Wat weten we zeker vs aanname?", "Welke klok tikt?"],
      "facilitatorPerspective": "Als IR-consultant zou ik nu adviseren: ... (alleen facilitator ziet dit)",
      "roleActions": [
        {
          "id": "r1-ceo-1",
          "label": "Kondig intern crisisstaat af",
          "description": "Roep het crisismanagementteam bij elkaar, autoriseer noodmaatregelen.",
          "allowedRoles": ["ceo"],
          "isRecommended": true,
          "irPlanAligned": true,
          "consequence": "Team weet dat dit prioriteit heeft; risico op vroeg-uitroepen zonder feiten.",
          "qualityRank": "good",
          "facilitatorCommentary": "Vroeg escaleren geeft mandaat, maar past op tegen bias richting overreactie.",
          "lessonLearned": "Mandaatduidelijkheid: wie mag wat autoriseren?"
        }
      ],
      "injects": [
        {
          "id": "r1-inj-1",
          "type": "alert", "channel": "siem", "urgency": "critical",
          "title": "SIEM-alert: ongewone data-egress",
          "content": "Cluster van uitgaande verbindingen naar 3 onbekende IPs, ~4 GB in de laatste 30 min.",
          "reliability": "fact",
          "senderName": "SOC — Eye Security",
          "timestamp": "06:12",
          "targetTeam": "technical_it"
        }
      ],
      "meldingMoment": {
        "id": "r1-melding",
        "allowedRoles": ["ceo", "ciso"],
        "recipient": "ir_retainer",
        "helper": "Bel Eye Security als je twijfelt over de omvang.",
        "types": [
          { "id": "activate-retainer", "label": "Eye Security-retainer activeren", "triggersInjectId": "r1-followup-retainer" }
        ]
      },
      "discussionGoal": "Test of het team situationele analyse doet vóór actie.",
      "keyQuestions": ["Wat is feit, wat is aanname?"],
      "hints": ["Let op wie het gesprek leidt."],
      "expectedDecisions": ["IR-retainer inschakelen"],
      "redFlags": ["Sprong direct naar oplossing zonder feiten te toetsen"]
    }
  ],
  "decisions": [
    {
      "afterRoundIndex": 0,
      "prompt": "Beslissing na R1: welke primaire koers?",
      "perRole": true,
      "options": [
        {
          "label": "Direct alle productiesystemen isoleren",
          "allowedRole": "ciso",
          "outcomeVector": {"CONT": 2, "FOR": 0, "BC": -2, "JUR": 0, "VER": 0, "KOS": -1},
          "qualityRank": "good",
          "facilitatorCommentary": "Snelle containment; klant staat vrijwel plat — communicatie richting klanten wordt cruciaal.",
          "lessonLearned": "Trade-off: containment vs continuïteit.",
          "leadsTo": "round:1"
        },
        {
          "label": "Doorwerken, alleen segmentgebonden isolatie",
          "allowedRole": "ceo",
          "outcomeVector": {"CONT": -1, "FOR": 0, "BC": 1, "JUR": 0, "VER": 0, "KOS": 0},
          "qualityRank": "poor",
          "facilitatorCommentary": "Minder continuïteitsschade maar risico op lateral spread.",
          "lessonLearned": "Wie besluit hoe agressief te isoleren?",
          "leadsTo": "round:1"
        },
        {
          "label": "Geen besluit binnen de tijd",
          "implicit": true,
          "outcomeVector": {"CONT": -2, "FOR": -1, "BC": -1, "JUR": -1, "VER": -1, "KOS": -1},
          "leadsTo": "round:1"
        }
      ]
    }
  ],
  "outcomes": [
    {
      "key": "excellent",
      "label": "Voorbeeldige respons",
      "narrative": "Team escaleerde vroeg, meldde binnen 24u, koos herstel via schone back-up.",
      "lessonLearned": "Vroege escalatie + heldere mandaten waren doorslaggevend.",
      "scoreRange": { "min": 5 }
    },
    {
      "key": "gemiddeld",
      "label": "Redelijk maar onvolledig",
      "narrative": "Meldingen op tijd, maar interne communicatie liep achter — medewerkers hoorden het via media.",
      "lessonLearned": "Interne communicatie hoort binnen 4u expliciet gepland.",
      "scoreRange": { "min": -2, "max": 4 }
    },
    {
      "key": "slecht",
      "label": "Escalerende crisis",
      "narrative": "Meldplicht gemist, betaald zonder herstelkans, reputatie zwaar geraakt.",
      "lessonLearned": "Trage besluitvorming = compliance risico.",
      "scoreRange": { "max": -3 }
    }
  ]
}

BELANGRIJK:
- Alle NL-teksten in NATUURLIJK, VLOEIEND Nederlands (geen letterlijke vertaling uit Engels).
- Elke inject.id die ergens als triggersInjectId wordt gerefereerd moet ook echt bestaan in de plan.
- Elke roleAction.id die als linksToRoleActionId wordt gebruikt moet bestaan.
- Elke decision-optie MOET een outcomeVector hebben.
- Elke outcome MOET een scoreRange hebben.
- Het aantal rondes moet ${roundCount} zijn.`

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 12000,
      messages: [{ role: "user", content: prompt }],
    }),
  }, 240_000)

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return NextResponse.json({ error: `AI call failed: ${text.slice(0, 400)}` }, { status: 502 })
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""

  try {
    const cleaned = text.replace(/```json|```/g, "").trim()
    const plan = JSON.parse(cleaned) as WizardPlan
    if (!plan.rounds || plan.rounds.length === 0) {
      return NextResponse.json({ error: "AI returned an empty plan" }, { status: 502 })
    }
    if (!plan.outcomes || plan.outcomes.length === 0) {
      return NextResponse.json({ error: "AI returned no outcomes" }, { status: 502 })
    }
    const graph = planToGraph(plan)
    return NextResponse.json({ ok: true, graph })
  } catch (err) {
    const { randomBytes } = await import("crypto")
    const requestId = randomBytes(4).toString("hex")
    console.error(`[ai-wizard] parse failed (${requestId}):`, err, "raw:", text.slice(0, 500))
    return NextResponse.json({ error: `AI response was not valid JSON (ref: ${requestId})` }, { status: 502 })
  }
}
