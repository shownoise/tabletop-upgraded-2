import { ROLE_META } from "@/lib/types"
import type { ExerciseConfig, SimulationMode, AiIntensity, Scenario, SpecialsMode, RoleAction, Role, GoalId } from "@/lib/types"
import { getGoal } from "@/lib/goals/registry"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

function buildRoleContext(config: ExerciseConfig): string {
  const roles = config.selectedRoles
  if (!roles?.length) return ""
  const lines = roles.map(r => {
    const m = ROLE_META[r]
    return `- ${m.label} (${r}): ${m.description}\n  Authorities: ${m.authorities.join("; ")}`
  })
  return `\nRoles participating in this exercise:\n${lines.join("\n")}\n\nPER-ROLE DECISIONS: Generate a dedicated set of 3-4 options for EACH participating role, where allowedRoles contains EXACTLY ONE role. Never put multiple roles on a single action (except the universal do-nothing option which uses allowedRoles: []). In every roleActions entry, allowedRoles must ONLY contain values from this list: [${roles.join(", ")}]. For absent roles, assign their decisions to the closest participating role:\n- Communications → head_of_comms, else ceo\n- Financial → cfo, else ceo\n- Legal/regulatory → legal, else ciso\n- Technical → ciso or it_manager\n- Operational → ops_manager, else cfo or ceo\nGenerate injects for all relevant crisis domains even if a domain's primary role is absent.`
}

function buildContext(c: ExerciseConfig): string {
  const parts = [
    `sector=${c.sector}`,
    `size=${c.companySize}`,
    `type=${c.scenarioType}`,
    `systems=${c.criticalSystems}`,
    `crown=${c.crownJewels}`,
  ]
  if (c.itMaturity) parts.push(`it_maturity=${c.itMaturity}`)
  if (c.securityCapability) parts.push(`security_capability=${c.securityCapability}`)
  if (c.exerciseGoal) parts.push(`goal=${c.exerciseGoal}`)
  if (c.teamStructure) parts.push(`team_structure=${c.teamStructure}`)
  if (c.difficulty) parts.push(`difficulty=${c.difficulty}`)
  if (c.existingPlans?.length) parts.push(`existing_plans=${c.existingPlans.join(',')}`)
  parts.push(`duration=${c.duration}`)
  return parts.join(', ')
}

function buildScenarioDirectives(c: ExerciseConfig, mode?: string): string {
  const d: string[] = []

  // Language — always first
  d.push("TAAL: Genereer alle scenario-inhoud in het Nederlands (NL). Injects, roleAction labels en descriptions, facilitatorNotes, learningObjectives — alles in het Nederlands. Uitzondering: technische termen (IP-adressen, productnamen, protocollen) mogen in het Engels blijven.")

  // Simulation mode
  if (mode === "event") d.push(
    "SIMULATION MODE — EVENT: This is a competitive multi-team event. Keep the scenario fast-paced and decision-focused. Each round should have clear scoring moments. Inject urgency from the start."
  )
  else d.push(
    "SIMULATION MODE — TRAINING: This is a learning-focused exercise. Facilitator notes should be rich and educational. The scenario should expose process gaps and decision-making weaknesses, not just test speed. Include hints that help the facilitator draw out lessons."
  )

  // Crown jewels and critical systems — must appear by name in injects
  if (c.crownJewels) d.push(
    `CROWN JEWELS: The most sensitive assets are: "${c.crownJewels}". Reference these specifically by name in inject content — do NOT use generic placeholders like 'sensitive data' or 'important files'. When the attacker targets or exfiltrates data, name these assets explicitly.`
  )
  if (c.criticalSystems) d.push(
    `CRITICAL SYSTEMS: The systems whose disruption materially affects operations are: "${c.criticalSystems}". Reference these by name in injects about outages, encryption, performance degradation, or recovery. Do NOT use generic 'the systems' — name them.`
  )

  // Duration / pacing
  const durationPacing: Record<string, string> = {
    "60 minutes": "DURATION — 60 MINUTES: This is a short exercise. Keep injects concise (2–3 sentences max). Each round should have 3 injects max and 3–4 roleActions. Facilitator notes should be brief bullet points, not paragraphs.",
    "90 minutes": "DURATION — 90 MINUTES: Standard exercise pace. 3–4 injects per round, 4–5 roleActions per round. Facilitator notes should cover the key questions and 2–3 red flags.",
    "2 hours": "DURATION — 2 HOURS: Extended exercise. Can support 4–5 injects per round and richer roleActions. Facilitator notes should include discussion questions for debrief segments between rounds.",
    "Half day": "DURATION — HALF DAY: Full workshop format. Each round should support extended team discussion. Include rich facilitator notes with discussion goals, expected decisions, and debrief questions. Injects can be more detailed and nuanced.",
  }
  if (c.duration && durationPacing[c.duration]) d.push(durationPacing[c.duration])

  // Difficulty
  if (c.difficulty === "beginner") d.push(
    "DIFFICULTY — BEGINNER: Use gradual escalation with clear, unambiguous signals in round 1. Each round should have one obviously correct decision and one obviously wrong one. Avoid information overload — max 3 injects per round. Facilitator notes should be encouraging and explanatory. Time pressure should be low in early rounds."
  )
  else if (c.difficulty === "intermediate") d.push(
    "DIFFICULTY — INTERMEDIATE: Mix clear and ambiguous signals. Include at least one round where the 'right' decision is debatable and the consequence of each option has real trade-offs. 3–4 injects per round. Moderate time pressure from round 2 onwards."
  )
  else if (c.difficulty === "advanced") d.push(
    "DIFFICULTY — ADVANCED: Use contradictory or misleading signals in round 1. Multiple crises should run simultaneously by round 2. Decisions should have significant irreversible consequences with no single obvious right answer. Include pressure from multiple external stakeholders at once. 4–5 injects per round. Red flags in facilitator notes should cover realistic overconfident team responses."
  )

  // Exercise goal
  const goalDirectives: Record<string, string> = {
    nis2_readiness: "EXERCISE GOAL — NIS2 READINESS: Set nis2Relevant:true on every inject that triggers an NIS2 obligation. Include explicit NIS2 notification timeline decisions in at least 2 rounds (24h early warning to NCSC/competent authority, 72h notification, 30-day final report). At least one round should test whether the team knows which authority to notify and what must be included. Reference the NIS2 threshold test (significant incident) explicitly.",
    board_decisions: "EXERCISE GOAL — BOARD DECISION-MAKING: Every round must have at least one decision that requires CEO or CFO authority (financial threshold, public disclosure, legal exposure). Include board-level pressure in at least 2 rounds — either a direct board member inquiry inject, or a decision that explicitly requires board sign-off. The scenario climax should be a structured board recommendation.",
    crisis_comms: "EXERCISE GOAL — CRISIS COMMUNICATIONS: Every round must have a communication-facing pressure point (media, social media, customer, internal staff). Include a journalist inquiry in round 2 at the latest. Head of Communications must have specific decisions in every round. Round 3 or 4 should include a social media or press scenario that forces a real-time response decision.",
    ransomware_tabletop: "EXERCISE GOAL — RANSOMWARE TABLETOP: Round 1 = detection and initial scoping. Round 2 = active encryption / containment decision. Round 3 = ransom demand received, communication crisis, regulatory clock. Round 4 = pay vs recover decision with known backup status. Each round must test a distinct phase of the ransomware playbook.",
    technical_containment: "EXERCISE GOAL — TECHNICAL CONTAINMENT: Technical roles (it_manager, system_admin, ciso) must have the most critical decisions in every round. Include explicit choices about: network isolation, access revocation, forensic preservation vs business continuity, and logging chain of custody. Non-technical roles should be in a supporting/decision-approval role rather than leading.",
    supplier_incident: "EXERCISE GOAL — SUPPLIER INCIDENT: The scenario must involve a third-party supplier as the primary attack vector or critical dependency. Include supplier notification, SLA/contract review, and alternative supplier assessment as decision points. At least one inject should come from the affected supplier. Legal liability towards the supplier and downstream customers should both be tested.",
    data_breach: "EXERCISE GOAL — DATA BREACH: Every round must reference the personal data at risk (categories, number of individuals). Include GDPR Art.33 (72h AP notification clock), Art.34 (individual notification assessment), and at least one decision about whether the breach meets the 'high risk to individuals' threshold. Data subject rights requests should appear in at least one inject.",
  }
  if (c.exerciseGoal && goalDirectives[c.exerciseGoal]) d.push(goalDirectives[c.exerciseGoal])

  // Platform goal directive (new goal registry)
  if (c.goalId) {
    try {
      const goal = getGoal(c.goalId as GoalId)
      if (goal.status === 'active') {
        d.push(
          `PLATFORM GOAL — ${goal.name.toUpperCase()}: ${goal.description} Assessment dimensions to surface in facilitator notes: ${goal.assessmentDimensions.join(', ')}. Every round must include at least one moment that tests mandate clarity (who has authority to decide?) and one that tests escalation timing (when is the right moment to involve the next level?).`
        )
      }
    } catch { /* unknown goalId — skip */ }
  }

  // Security capability — affects what detection sources are realistic
  const capDirectives: Record<string, string> = {
    no_soc: "SECURITY CAPABILITY — NO SOC: This organisation has NO monitoring tools, no SIEM, no EDR. Do NOT generate any SIEM alerts or automated detection injects. Detection in round 1 MUST come from: a user complaint, a client tip-off, an external party notification, or accidental discovery. The absence of monitoring is itself a theme — facilitator notes should reference it as a gap.",
    small_it: "SECURITY CAPABILITY — SMALL IT TEAM (1–3 people): Technical alerts should come from basic tools (firewall log, antivirus, helpdesk ticket). The IT team is reactive, not proactive. Include at least one inject where the IT team is overwhelmed or slow to respond due to capacity constraints.",
    outsourced_it: "SECURITY CAPABILITY — OUTSOURCED IT: All technical actions go through an external MSP. Injects from IT should reference the MSP. There is no internal IT expertise. Include realistic friction: the MSP has their own escalation process, their response time adds 30–60 minutes to any technical action, and they may have limited context on business priorities.",
    it_mssp: "SECURITY CAPABILITY — IT + MSSP: The MSSP provides monitoring and sends alerts. Include MSSP-sourced injects (they notice the anomaly before internal IT does in round 1). The MSSP is a key actor but decisions and authorisations rest with the internal team. Include an MSSP escalation call or report in round 1.",
    it_ir_retainer: "SECURITY CAPABILITY — IT + SOC/IR RETAINER: The organisation has an internal IT team, a contracted IR firm (retainer), and optional SOC monitoring. In round 1 the SOC or IT signals the anomaly. From round 2 the IR retainer joins — they provide forensic context and recommendations, but all decisions and authority remain with the internal team. Include at least one inject where the IR retainer's recommendation conflicts with the CEO/CFO's instinct, forcing a real authority-vs-expertise tension. The internal team's role is decision-making and stakeholder management, not forensics.",
  }
  if (c.securityCapability && capDirectives[c.securityCapability]) d.push(capDirectives[c.securityCapability])

  // Sector context
  const sectorDirectives: Record<string, string> = {
    "Financial Services": "SECTOR — FINANCIAL SERVICES: Reference relevant Dutch/EU regulators (DNB, AFM) where appropriate. Crown jewels are transaction data, client portfolios, and payment infrastructure. PSD2 open banking obligations may be relevant. Regulatory reporting obligations are strict and time-bound. Customer trust and regulatory relationship are primary reputation risks.",
    "Healthcare": "SECTOR — HEALTHCARE: Reference patient safety implications explicitly — delayed treatments, cancelled procedures, unavailable medication records. Electronic Patient Records (EPD/EHR) are the primary crown jewel. Both AVG/GDPR and NEN 7510 apply. The IGJ (healthcare regulator) is a relevant authority. Clinical staff disruption should feature in at least one inject.",
    "Energy & Utilities": "SECTOR — ENERGY & UTILITIES: Reference OT/SCADA implications if operational systems are affected. This organisation likely qualifies as an essential entity under NIS2 — notification obligations are more stringent. Include potential physical operational impact (production outage, grid instability, supply disruption) in at least one round.",
    "Manufacturing": "SECTOR — MANUFACTURING: Include production line / OT impact — downtime costs per hour should be referenced. Crown jewels include production designs, client order data, and supply chain integrations. At least one inject should reference a downstream client or supplier impacted by the disruption.",
    "Retail & E-commerce": "SECTOR — RETAIL & E-COMMERCE: Reference PCI-DSS obligations if payment data is involved. Customer data and order history are crown jewels. Reputation damage and customer trust are the primary business risk. Include a customer-facing impact (website down, checkout failures, fraudulent orders) in at least one round.",
    "Public Sector": "SECTOR — PUBLIC SECTOR: Reference BIO (Baseline Informatiebeveiliging Overheid) and DigiD implications if applicable. Public accountability and political exposure are higher than private sector — include a media/political pressure inject. The NCSC and relevant sector CERT are notification targets.",
    "Technology / SaaS": "SECTOR — TECHNOLOGY / SAAS: The organisation's customers may be affected if their platform is compromised (multi-tenant breach). Include downstream customer impact in at least one inject. Contractual SLA obligations and data processor responsibilities under GDPR are key themes.",
    "Transportation": "SECTOR — TRANSPORTATION: Operational continuity is paramount — reference disruption to fleet, routing, or logistics systems. Include a physical operational impact (delayed shipments, grounded vehicles, route data unavailable) in at least one round. Customer and partner SLA breaches should feature.",
  }
  if (c.sector && sectorDirectives[c.sector]) d.push(sectorDirectives[c.sector])

  // Company size
  const sizeDirectives: Record<string, string> = {
    "100–250": "COMPANY SIZE — SMALL (100–250 employees): Resources are limited. The CEO likely doubles as a de facto decision-maker on everything. No dedicated crisis comms team — the CEO or HR Lead handles communications. Budget constraints are a real factor in decisions (e.g. IR retainer cost, ransom payment, forensics). Reflect the leanness in the scenario — fewer stakeholders, more hats worn per person.",
    "250–500": "COMPANY SIZE — MEDIUM-SMALL (250–500 employees): Dedicated functions exist but teams are lean (1–3 people per department). Decisions involve a small group. Legal may be a single person or outsourced. Reflect that escalation is fast but capacity is limited.",
    "500–1,500": "COMPANY SIZE — MEDIUM (500–1,500 employees): Established functions with some process maturity. Multiple stakeholders need to be aligned. Include cross-departmental coordination challenges as a realistic friction point.",
    "1,500+": "COMPANY SIZE — LARGE (1,500+ employees): Multiple business units, formal governance structures, committee-based decisions. Board involvement is structured and documented. Reflect that decisions take longer but have more institutional support. Include business unit or subsidiary complications where relevant.",
  }
  if (c.companySize && sizeDirectives[c.companySize]) d.push(sizeDirectives[c.companySize])

  // IT maturity
  if (c.itMaturity === "low") d.push(
    "IT MATURITY — LOW: Basic IT hygiene gaps are expected — missing MFA, unpatched systems, no asset inventory. The scenario should reflect that the organisation is surprised by the incident and lacks basic tooling to respond quickly. At least one decision should expose a maturity gap as a factor."
  )
  else if (c.itMaturity === "medium") d.push(
    "IT MATURITY — MEDIUM: The organisation has basic controls in place (some MFA, periodic patching, basic logging) but is not mature. Detection is possible but slow. Gaps will surface under pressure — include at least one moment where a missing control (e.g. no MFA on a specific system, incomplete logging) becomes a factor."
  )
  else if (c.itMaturity === "high") d.push(
    "IT MATURITY — HIGH: The organisation has solid IT practices — MFA enforced, patching current, logging in place. Detection should be faster. The challenge should be in decision-making and stakeholder management, not in basic IT execution. Do not include obviously preventable technical failures as the root cause."
  )

  // Team structure
  if (c.teamStructure === "crisis_only") d.push(
    "TEAM STRUCTURE — CRISIS MANAGEMENT ONLY: Only crisis management roles are participating (CEO, CISO, CFO, Legal, Head of Comms, HR Lead, Ops Manager). Do NOT generate injects or roleActions targeting IT-specific technical execution. IT/technical details should appear as context in injects, but the decisions are always at the management/governance level."
  )
  else if (c.teamStructure === "it_only") d.push(
    "TEAM STRUCTURE — IT TEAM ONLY: Only technical roles are participating (IT Manager, System Administrator). Focus injects on technical detection, containment, and recovery. Management escalation appears as pressure from above, but the decisions in roleActions are all technical."
  )
  else if (c.teamStructure === "crisis_it" || c.teamStructure === "full") d.push(
    "TEAM STRUCTURE — FULL TEAM: Both crisis management and technical IT roles are participating. Generate injects and roleActions for both tracks. Include handoff moments where technical findings must be translated into management decisions, and where management decisions require technical execution."
  )

  // Business decision framing — always applicable for crisis roles
  d.push(
    "BESLUITVORMING: Elke roleAction voor een crisis-managementrol (CEO, CFO, Legal, Head of Comms, HR Lead, Ops Manager) moet een zakelijke beslissing zijn — geen IT-operationele actie. Formuleer altijd als: 'Autoriseer...', 'Stel vast...', 'Informeer...', 'Besluit of...', 'Geef opdracht tot...'. De kernvraag is altijd: wie heeft de bevoegdheid en wat zijn de zakelijke consequenties van deze keuze?"
  )

  // Existing plans
  if (c.existingPlans?.includes("none") || !c.existingPlans?.length) d.push(
    "EXISTING PLANS — NONE: This organisation has no documented IR plan, crisis comms plan, or backup procedure. Do not assume any formal process exists. Decisions will be ad hoc. This is itself a red flag — facilitator notes should reference the absence of a plan as a gap when relevant."
  )
  else {
    const planNotes: string[] = []
    if (c.existingPlans?.includes("ir_plan")) planNotes.push("IR plan exists — roleActions that follow it should be marked irPlanAligned:true")
    if (c.existingPlans?.includes("crisis_comms_plan")) planNotes.push("Crisis comms plan exists — communications decisions should reference it")
    if (c.existingPlans?.includes("backup_procedure")) planNotes.push("Backup procedure documented — backup recovery is a realistic option; test whether the team uses it correctly")
    if (c.existingPlans?.includes("nis2_process")) planNotes.push("NIS2 process documented — test whether the team follows it under pressure")
    if (planNotes.length) d.push("EXISTING PLANS: " + planNotes.join(". ") + ".")
  }

  // Learning objectives directive (Task 4)
  const objectivesByGoal: Record<string, string> = {
    nis2_readiness: `LEARNING OBJECTIVES per ronde: (1) "Team herkent NIS2-meldplichtig incident" (measuredBy: decision, triggerActionIds: acties die incident declareren of IR activeren) (2) "CISO/Legal besluit tot AP-melding binnen 72u" (measuredBy: decision) (3) "AP-notificatieformulier ingevuld" (measuredBy: special, triggerSpecialType: ap_notification) (4) "Board geïnformeerd over compliance-status" (measuredBy: decision).`,
    ransomware_tabletop: `LEARNING OBJECTIVES per ronde: (1) "Incident gedeclareert en IR-retainer geactiveerd" (measuredBy: decision) (2) "Geïnfecteerde systemen geïsoleerd van netwerk" (measuredBy: decision) (3) "Ransom-onderhandelingspositie bepaald" (measuredBy: special of decision) (4) "Betaal/herstel beslissing genomen met back-up status bekend" (measuredBy: decision).`,
    crisis_comms: `LEARNING OBJECTIVES per ronde: (2) "Interne communicatie naar medewerkers verstuurd" (measuredBy: decision) (3) "Persbericht of holding statement goedgekeurd door CEO" (measuredBy: decision) (3) "NOS-interview afgehandeld" (measuredBy: special, triggerSpecialType: journalist_qa).`,
    board_decisions: `LEARNING OBJECTIVES elke ronde: "CEO of CFO neemt beslissing binnen eigen autoriteitsdomein" (measuredBy: decision, triggerActionIds: acties met allowedRoles CEO of CFO).`,
    data_breach: `LEARNING OBJECTIVES per ronde: (1) "Datalek-scope bepaald: categorieën en aantal betrokkenen" (measuredBy: decision) (2) "AVG Art.33 melding besluit genomen (72u klok)" (measuredBy: decision) (3) "AP-melding ingediend" (measuredBy: special of decision) (4) "Individuele notificatie-assessment afgerond" (measuredBy: decision).`,
  }
  d.push(
    `LEARNING OBJECTIVES: Every round MUST include 1–2 learningObjectives in this JSON format: { "id": "unique-string", "description": "max 15 words, action-oriented, Dutch", "module": "<one of the ModuleId values>", "measuredBy": "decision|special|manual", "triggerActionIds": ["roleAction id that fulfils this"] }. ${c.exerciseGoal && objectivesByGoal[c.exerciseGoal] ? objectivesByGoal[c.exerciseGoal] : 'Base objectives on the scenario type and exercise goal.'}`
  )

  // Role-specific inject targeting
  d.push(
    `INJECT ROLE TARGETING: For injects that are only relevant to specific roles, set "targetRoles": ["ciso"] or ["it_manager", "system_admin"] etc. Use this for: IR/SOC technical briefings → targetRoles: ["ciso", "it_manager"]; Financial impact updates → targetRoles: ["cfo"]; Legal/regulatory alerts → targetRoles: ["legal"]; Internal HR communications → targetRoles: ["hr_lead"]; General crisis updates, ransom notes, media coverage → targetTeam: "all" (no targetRoles). The targetRoles field overrides targetTeam when both are present. Only set targetRoles when the inject content is genuinely role-specific — most injects should use targetTeam only.`
  )

  // Inject ↔ roleAction coupling — critical for realism
  d.push(
    `INJECT-ACTIE KOPPELING: Elke roleAction in een ronde moet een directe reactie zijn op één of meer injects in diezelfde ronde. De inject triggert de situatie — de roleAction is de teamreactie. Regels: (1) Noem in de roleAction description expliciet waar de inject over gaat (bijv. "Naar aanleiding van de melding van de IR-retainer: autoriseer isolatie van het productiesysteem"). (2) De verantwoordelijke rol voor een roleAction moet aansluiten op de inhoud van de inject: een juridische inject → allowedRoles bevat 'legal' of 'ciso'; een communicatiedruk → 'head_of_comms'; een financieel besluit → 'cfo' of 'ceo'. (3) Elke inject van het type 'executive', 'regulatory' of 'media' moet minstens één bijbehorende roleAction hebben voor de verantwoordelijke crisismanagementrol.`
  )

  // BOB framework directive (Task 7)
  if (c.decisionFramework === 'bob') {
    d.push(
      `DECISION FRAMEWORK — BOB: Structure every round's facilitatorNotes along BOB phases. discussionGoal must name the BOB phase (Rounds 1–2: Beeldvorming; Round 3: Oordeelvorming; Round 4: Besluitvorming). keyQuestions must include at least one question per applicable BOB phase. hints must include a BOB failure pattern (e.g. "springt naar besluit vóór volledig beeld is gevormd"). Do NOT add any BOB phase prefix to roleAction labels or descriptions — keep action text clean and action-oriented.`
    )
  }

  return d.length ? "\n\nScenario generation directives (apply ALL of the following):\n" + d.map((x, i) => `${i + 1}. ${x}`).join("\n\n") : ""
}

const LEAN_VARIANTS = [
  "Focus on a scenario where the attack originates from a compromised third-party supplier.",
  "Focus on a scenario where the initial vector is a phishing email targeting a finance employee.",
  "Focus on a scenario where attackers exploited an unpatched VPN appliance to gain initial access.",
  "Focus on a scenario where the breach was discovered by an external party (client complaint, CERT notification).",
  "Focus on a scenario where the threat actor is a nation-state APT with longer dwell time before detonation.",
  "Focus on a scenario where a malicious insider assisted the external attacker.",
  "Focus on a scenario where the attacker encrypts backups before triggering the main payload.",
]

const FULL_COMPANY_NAMES = [
  "Heijmans Groep B.V.", "Bakker & Zonen Logistics", "De Vries Installatietechniek",
  "Maas Adviesgroep", "Terneuzen Maritiem B.V.", "Westland Agri Holding",
  "Noord Brabant Energie", "Helmond Precision Parts", "IJssel Zorg Groep",
  "Schiphol Cargo Services",
]

async function generateLean(config: ExerciseConfig, apiKey: string, mode: string) {
  const roundCount = config.roundCount ?? 4
  const timerPerRound = config.timerPerRound ?? 15
  const irCtx = config.irTemplateText
    ? `\nIR plan excerpt:\n${config.irTemplateText.slice(0, 3000)}`
    : ""
  const variant = LEAN_VARIANTS[Math.floor(Math.random() * LEAN_VARIANTS.length)]
  const roleCtx = buildRoleContext(config)
  const directives = buildScenarioDirectives(config, mode)
  const prompt = `You are a cybersecurity exercise designer for MKB+ organizations. Generate a unique ${roundCount}-round ${config.scenarioType} scenario for: ${buildContext(config)}${irCtx}${roleCtx}${directives}

Variation instruction (make the scenario distinct each time): ${variant}

Return ONLY valid JSON (no markdown):
{"scenario_title":"...","scenario_summary":"1-2 sentence summary","rounds":[{"round_number":1,"title":"...","situation_update":"2-3 sentence situation for facilitator","timerMinutes":${timerPerRound},"roleActions":[{"id":"r1-a1","label":"...","description":"...","allowedRoles":["ciso","ceo"],"isRecommended":true,"irPlanAligned":true,"consequence":"..."},{"id":"r1-a2","label":"...","description":"...","allowedRoles":["legal"],"irPlanAligned":true,"consequence":"..."},{"id":"r1-a3","label":"...","description":"...","allowedRoles":["cfo"],"irPlanAligned":false,"consequence":"..."},{"id":"r1-do-nothing","label":"Do nothing / wait","description":"Wait for more information before acting.","allowedRoles":[],"irPlanAligned":true,"consequence":"..."}]},{"round_number":2,...}]}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

async function generateFull(config: ExerciseConfig, apiKey: string, mode: string) {
  const roundCount = config.roundCount ?? 4
  const timerPerRound = config.timerPerRound ?? 15
  const existingPlans = config.existingPlans?.length ? config.existingPlans.join(', ') : 'none documented'
  const irPlanContext = config.irTemplateText
    ? `\nClient IR plan:\n<ir_plan>\n${config.irTemplateText.slice(0, 6000)}\n</ir_plan>`
    : ""
  const companyName = FULL_COMPANY_NAMES[Math.floor(Math.random() * FULL_COMPANY_NAMES.length)]
  const variant = LEAN_VARIANTS[Math.floor(Math.random() * LEAN_VARIANTS.length)]
  const randomSeed = Math.floor(Math.random() * 10000)

  const secCapabilityNote = {
    no_soc: "This organization has NO internal SOC and no dedicated IR capability.",
    small_it: "This organization has a small IT team only, no dedicated security function.",
    outsourced_it: "This organization relies entirely on outsourced IT. Internal IT knowledge is limited.",
    it_mssp: "This organization has IT + MSSP. The MSSP handles monitoring and alerts.",
    it_ir_retainer: "This organization has IT + an external IR retainer on contract.",
  }[config.securityCapability ?? "small_it"] ?? ""

  const irAlignedNote = config.irTemplateText
    ? `- "irPlanAligned": true means the action is consistent with the uploaded IR plan above. false means it deviates from it.`
    : `- "irPlanAligned": true means the action follows industry best practice for this type of incident. false means it is objectively risky or inadvisable (e.g. paying ransom without authorization, resuming systems before forensics, making premature public statements). Do NOT reference a specific IR plan — no plan has been uploaded. Base this flag purely on recognized crisis-response best practice.`

  const roleCtxFull = buildRoleContext(config)
  const directivesFull = buildScenarioDirectives(config, mode)
  const prompt = `You are a senior IR exercise designer for MKB+ organizations. Generate a UNIQUE, realistic, narrative-coherent ${config.scenarioType} incident scenario. Seed: ${randomSeed}.

Variation directive: ${variant}
Fictional company name to use in inject messages: ${companyName}
${roleCtxFull}
Organization profile:
- Sector: ${config.sector}
- Company size: ${config.companySize}
- IT maturity: ${config.itMaturity ?? "medium"}
- Security capability: ${config.securityCapability ?? "small_it"}
- Exercise goal: ${config.exerciseGoal ?? "ransomware_tabletop"}
- Difficulty: ${config.difficulty ?? "intermediate"}
- Team structure: ${config.teamStructure ?? "crisis_only"}
- Existing plans: ${existingPlans}
- Crown jewels: ${config.crownJewels}
- Critical systems: ${config.criticalSystems}
- Duration: ${config.duration}
${irPlanContext}
${directivesFull}

Structural constraints:
- Generate exactly ${roundCount} rounds, each ${timerPerRound} minutes
- Each round MUST build logically on the previous; the narrative arc must match the scenario type and exercise goal above
- Round 1: Detection / initial awareness (informed by security capability above)
- Round 2: Triage, business impact emerges
- Round 3: Escalation, external stakeholder pressure
- Round ${roundCount}: Resolution decision point — consequences are real and irreversible
- Every roleActions array MUST include a "do_nothing" option
- ${irAlignedNote}
- Do NOT hallucinate plan contents. If no IR plan was provided, only mark irPlanAligned:false for clearly inadvisable actions.
- consequence: realistic neutral outcome description. Never moralize or say "this violates the IR plan" unless one was uploaded.

Return ONLY valid JSON:
{
  "scenario_title": "...",
  "scenario_summary": "2-3 sentences",
  "rounds": [{
    "round_number": 1,
    "title": "...",
    "situation_update": "3-4 sentences for facilitator",
    "timerMinutes": ${timerPerRound},
    "facilitatorNotes": {
      "discussionGoal": "...",
      "keyQuestions": ["...", "..."],
      "hints": ["...", "..."],
      "expectedDecisions": ["...", "..."],
      "redFlags": ["...", "..."]
    },
    "injects": [{
      "id": "r1-i1",
      "type": "alert|intel|media|executive|technical|regulatory|social|internal",
      "channel": "whatsapp|slack|email|siem_alert|sms|phone|news_ticker|system_alert|raw",
      "title": "...",
      "content": "...",
      "urgency": "low|medium|high|critical",
      "source": "...",
      "senderName": "...",
      "senderHandle": "...",
      "timestamp": "HH:MM",
      "targetTeam": "all|crisis_management|technical_it",
      "targetRoles": ["ciso"],
      "nis2Relevant": false
    }],
    "roleActions": [{
      "id": "r1-a1",
      "label": "...",
      "description": "...",
      "allowedRoles": ["ciso", "it_manager"],
      "isRecommended": true,
      "irPlanAligned": true,
      "consequence": "..."
    }, {
      "id": "r1-do-nothing",
      "label": "Do nothing / wait for more information",
      "description": "Gather more facts before acting. Ask IR retainer for assessment.",
      "allowedRoles": [],
      "irPlanAligned": true,
      "consequence": "May be correct at this stage — avoids premature action. Risky if detection was already clear."
    }]
  }]
}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4500,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content?.find(b => b.type === "text")?.text ?? ""
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

async function generateWithAI(
  config: ExerciseConfig,
  mode: string,
  opts: { moduleSlots?: unknown; decisionFramework?: unknown },
): Promise<{ scenario: Scenario; intensity: AiIntensity; warnings?: string[] } | { aiError: string } | null> {
  const intensity = config.aiIntensity ?? "full"
  if (intensity === "off") return null

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("[generateWithAI] ANTHROPIC_API_KEY is not set")
    return { aiError: "ANTHROPIC_API_KEY is not set — contact the administrator" }
  }

  try {
    const { generateScenarioInstance } = await import("@/lib/scenario/generator")
    const { scenarioInstanceToScenario } = await import("@/lib/scenario/bridge")

    const moduleSlots = Array.isArray(opts.moduleSlots) ? opts.moduleSlots : undefined
    const framework = (typeof opts.decisionFramework === "string" ? opts.decisionFramework : "bob") as import("@/lib/types").DecisionFramework

    if (intensity === "lean") {
      const { generateLeanScenario } = await import("@/lib/scenario/generator")
      const scenario = await generateLeanScenario(config, apiKey, "claude-haiku-4-5-20251001", 8000)
      return { scenario, intensity: "lean" as const, warnings: [] }
    }

    const { instance, warnings } = await generateScenarioInstance(config, apiKey, {
      model: "claude-sonnet-4-6",
      maxTokens: 12000,
      moduleSlots,
      framework,
      maxRetries: 2,
      maxModules: 4,
    })
    return { scenario: scenarioInstanceToScenario(instance), intensity: "full" as const, warnings }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error("[generateWithAI] FULL ERROR:", error.message, "\nStack:", error.stack)
    return { aiError: error.message }
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ExerciseConfig> & {
    mode?: string
    moduleSlots?: unknown
    decisionFramework?: unknown
    graph?: import("@/lib/graph/types").ScenarioGraph
  }
  const config: ExerciseConfig = {
    sector: body.sector?.toString() ?? "",
    companySize: body.companySize?.toString() ?? "",
    criticalSystems: body.criticalSystems?.toString() ?? "",
    crownJewels: body.crownJewels?.toString() ?? "",
    scenarioType: body.scenarioType?.toString() ?? "",
    duration: body.duration?.toString() ?? "",
    irTemplateText: body.irTemplateText?.toString(),
    aiIntensity: (body.aiIntensity as AiIntensity | undefined) ?? "off",
    specialsMode: (body.specialsMode as SpecialsMode | undefined) ?? "off",
    itMaturity: body.itMaturity,
    securityCapability: body.securityCapability,
    existingPlans: Array.isArray(body.existingPlans) ? body.existingPlans : undefined,
    exerciseGoal: body.exerciseGoal,
    teamStructure: body.teamStructure,
    teamCount: typeof body.teamCount === "number" ? body.teamCount : undefined,
    roundCount: typeof body.roundCount === "number" ? body.roundCount : undefined,
    timerPerRound: typeof body.timerPerRound === "number" ? body.timerPerRound : undefined,
    difficulty: body.difficulty,
    selectedRoles: Array.isArray(body.selectedRoles) ? body.selectedRoles as Role[] : undefined,
    goalId: typeof body.goalId === "string" ? body.goalId as GoalId : undefined,
    graphId: typeof body.graphId === "string" ? body.graphId : undefined,
    decisionFramework: (body.decisionFramework === "ooda" || body.decisionFramework === "bob") ? body.decisionFramework : undefined,
    phaseAutoAdvance: (body.phaseAutoAdvance === "off" || body.phaseAutoAdvance === "fixed_durations" || body.phaseAutoAdvance === "fit_to_round") ? body.phaseAutoAdvance : undefined,
  }
  const mode: SimulationMode = body.mode === "event" ? "event" : "training"

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }
      try {
        send({ stage: "building_prompt", pct: 10, label: "Scenario opbouwen..." })

        let scenario: Scenario | null = null
        let aiSuccess: { scenario: Scenario; intensity: AiIntensity; warnings?: string[] } | null = null
        let loadedGraph: import("@/lib/graph/types").ScenarioGraph | null = null

        if (config.graphId || body.graph) {
          send({ stage: "loading_graph", pct: 40, label: "Scenario-grafiek laden..." })
          const { loadScenarioGraph, saveScenarioGraph } = await import("@/lib/session-store")
          const { compileLinearGraph } = await import("@/lib/graph/compile")

          // Prefer inline graph (from client) — avoids cross-instance KV lookups.
          // Fall back to server-side lookup if only graphId was sent.
          let graph = body.graph ?? null
          if (!graph && config.graphId) {
            graph = await loadScenarioGraph(config.graphId)
          }
          if (!graph) {
            send({ stage: "error", message: "Scenario graph not found — probeer eerst 'Save' in de builder." })
            return
          }
          // Persist inline graph so subsequent server-side lookups work (e.g. debrief).
          if (body.graph) {
            try { await saveScenarioGraph(body.graph) } catch { /* ignore */ }
          }
          // Substitute {{sector}} etc. in nodes marked dynamic before compile.
          const { applyDynamicFill } = await import("@/lib/graph/dynamic-fill")
          loadedGraph = applyDynamicFill(graph, config)
          try {
            const compiled = compileLinearGraph(loadedGraph)
            scenario = { scenario_title: compiled.scenario_title, scenario_summary: compiled.scenario_summary, rounds: [] }
          } catch (compileErr) {
            const msg = compileErr instanceof Error ? compileErr.message : "Graph compile failed"
            send({ stage: "error", message: msg })
            return
          }
        } else {
          const intensity = config.aiIntensity ?? "off"
          if (intensity !== "off") {
            send({ stage: "calling_ai", pct: 30, label: "AI genereert scenario..." })
          }

          const aiResult = await generateWithAI(config, mode, {
            moduleSlots: body.moduleSlots,
            decisionFramework: body.decisionFramework,
          })

          const aiError = aiResult && 'aiError' in aiResult ? aiResult.aiError : undefined
          aiSuccess = aiResult && 'scenario' in aiResult ? aiResult : null

          if (aiError) {
            send({ stage: "error", message: aiError })
            return
          }

          send({ stage: "parsing", pct: 75, label: "Resultaat verwerken..." })

          scenario = aiSuccess?.scenario ?? null
          if (!scenario) {
            try {
              const { generateScenario } = await import("@/lib/scenario-generator")
              scenario = generateScenario(config)
            } catch (fallbackErr) {
              const msg = fallbackErr instanceof Error ? fallbackErr.message : "Fallback generation failed"
              console.error("[create] fallback scenario error:", msg)
              send({ stage: "error", message: `Scenario generatie mislukt: ${msg}` })
              return
            }
          }
        }

        send({ stage: "saving", pct: 90, label: "Sessie opslaan..." })

        if (!scenario) {
          send({ stage: "error", message: "Scenario generatie mislukt: leeg resultaat" })
          return
        }

        const { generateDocuments } = await import("@/lib/document-generator")
        const documents = generateDocuments(config)

        const { createSession } = await import("@/lib/session-store")
        const session = await createSession(config, scenario, mode, documents, loadedGraph ?? undefined)

        send({
          stage: "done",
          pct: 100,
          sessionId: session.id,
          joinCode: session.joinCode,
          aiGenerated: !!aiSuccess,
          aiIntensity: aiSuccess?.intensity ?? "off",
          warnings: aiSuccess?.warnings ?? [],
        })
      } catch (err) {
        send({ stage: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
