import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { planToGraph, type WizardPlan } from "@/lib/graph/wizard-plan"

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
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as Body
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
  }

  const roundCount = Math.max(3, Math.min(6, body.roundCount ?? 4))

  const prompt = `Je bent een cyber-tabletop scenarioschrijver. Wij zijn de IR-retainer die dit als trainings-oefening bij een klant faciliteren.
Genereer een compleet crisisscenario als JSON, opgebouwd rond het BOB-model (Beeldvorming/Oordeel/Besluit).

Input van de facilitator:
- Sector: ${body.sector ?? "onbepaald"}
- Bedrijfsgrootte: ${body.companySize ?? "onbepaald"}
- Aanvalstype: ${body.attackType ?? "onbepaald"}
- Moeilijkheid: ${body.difficulty ?? "intermediate"}
- Aantal rondes: ${roundCount}
- Crown jewels: ${body.crownJewels ?? "onbepaald"}
- Kritieke systemen: ${body.criticalSystems ?? "onbepaald"}
${body.freeText ? `- Extra context: ${body.freeText}` : ""}

REGELS VOOR EEN GOEDE TRAINING:
1. BOB-fasen: R1-R2 = beeldvorming (feiten verzamelen), midden = oordeel (opties wegen), einde = besluit (kiezen).
2. Reliability op elke inject: 'fact' | 'assumption' | 'unverified' | 'misleading' (max 1-2 misleading per ronde). Misleading = plausibel maar niet waar; participants zien geen label en moeten dit zelf herkennen.
3. Per ronde 1 red-flag action met respondsToMisleading:true die scoort op een BOB-vergissing (aanname als feit).
4. Elke roleAction krijgt scoring: scoreImpact (-10 tot +10), linkedDimension (decision_speed | decision_quality | escalation_timing | mandate_clarity | framework_adherence | dilemma_participation | communication_clarity | compliance_awareness), lessonLearned (1 zin voor debrief).
5. Elke outcome krijgt scoreImpact, linkedDimension en lessonLearned.
6. Rounds hebben openingPrompts (2-3 BOB-startvragen) en facilitatorPerspective (jouw IR-briefing als facilitator).
7. Minimaal 1 role action per rol per ronde — vooral CEO moet altijd wat te doen hebben.
8. irRetainerName + irPlaybook (markdown, met 1-2 opzet-verouderde/misleidende passages).

Geef ALLEEN geldige JSON terug (geen markdown), exact volgens dit schema:

{
  "name": "OPERATIE X",
  "scenarioType": "ransomware_double_extortion|insider_threat|bec_cfo_fraud|supply_chain_compromise",
  "irRetainerName": "Onze IR-firma",
  "irPlaybook": "## Ransomware beleid\\n- Betaling tot X BTC toegestaan (OPZET-VEROUDERD)\\n...",
  "rounds": [
    {
      "title": "Korte titel",
      "situation": "3-4 zinnen situation update",
      "timerMinutes": 15,
      "bobPhase": "beeldvorming|oordeel|besluit",
      "openingPrompts": ["Wat weten we zeker vs aanname?", "Welke klok tikt?"],
      "facilitatorPerspective": "Als IR-consultant zou ik nu adviseren: ... (facilitator ziet dit)",
      "roleActions": [
        {
          "id": "r1-a1",
          "label": "Actie",
          "description": "Beschrijving",
          "allowedRoles": ["ceo"],
          "isRecommended": true, "irPlanAligned": true,
          "consequence": "Gevolg",
          "scoreImpact": 8, "linkedDimension": "compliance_awareness",
          "lessonLearned": "NIS2 art. 23 vereist onverwijlde declaratie."
        },
        {
          "id": "r1-misleading",
          "label": "Reactie op ongeverifieerd signaal",
          "description": "Handel op de whatsapp van collega die zegt dat het een test is",
          "allowedRoles": ["it_manager"],
          "irPlanAligned": false,
          "scoreImpact": -7, "linkedDimension": "framework_adherence",
          "respondsToMisleading": true,
          "lessonLearned": "BOB-vergissing: aanname als feit. Verifieer eerst."
        }
      ],
      "injects": [
        {
          "type": "alert", "channel": "siem", "urgency": "critical",
          "title": "SIEM alert", "content": "...", "reliability": "fact",
          "senderName": "SOC", "timestamp": "06:12", "targetTeam": "technical_it"
        },
        {
          "type": "internal", "channel": "whatsapp", "urgency": "low",
          "title": "Collega app't", "content": "kan een test zijn?", "reliability": "misleading",
          "deliverySeconds": 60
        }
      ],
      "discussionGoal": "Wat wil je testen?",
      "keyQuestions": ["Vraag 1"], "hints": ["Hint"],
      "expectedDecisions": ["..."], "redFlags": ["..."]
    }
  ],
  "decisions": [
    {
      "afterRoundIndex": 1, "prompt": "Beslissing",
      "measuredBy": "participant_choice",
      "options": [
        {
          "label": "Optie A", "linksToRoleActionId": "r2-a1", "leadsTo": "round:2",
          "scoreImpact": 5, "linkedDimension": "decision_quality",
          "lessonLearned": "Rationale voor rapport"
        }
      ]
    }
  ],
  "specials": [],
  "outcomes": [
    {
      "key": "excellent", "label": "Voorbeeldig", "narrative": "...",
      "scoreImpact": 10, "linkedDimension": "compliance_awareness",
      "lessonLearned": "Waarom dit ideaal is"
    },
    {
      "key": "bad", "label": "Slecht", "narrative": "...",
      "scoreImpact": -8, "linkedDimension": "compliance_awareness",
      "lessonLearned": "Wat de organisatie hier kan leren"
    }
  ]
}

BELANGRIJK:
- Elke linksToRoleActionId MOET matchen met een echte roleAction id
- leadsTo: "round:<0-based-idx>" | "outcome:<key>" | "special:<key>"
- Rollen: ceo, ciso, cfo, legal, head_of_comms, hr_lead, ops_manager, it_manager, system_admin
- Alle outcomes moeten bereikbaar zijn`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  })

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
    const graph = planToGraph(plan)
    return NextResponse.json({ ok: true, graph })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to parse AI response: ${msg}`, raw: text.slice(0, 500) }, { status: 502 })
  }
}
