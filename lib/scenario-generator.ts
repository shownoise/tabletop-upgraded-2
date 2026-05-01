import type { ExerciseConfig, Scenario, Round, Inject, FacilitatorNotes, InjectChannel, RoleAction } from "./types"

let counter = 0
function id(prefix: string) {
  counter++
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

/**
 * Fallback mock generator used when AI generation is unavailable.
 */
export function generateScenario(config: ExerciseConfig): Scenario {
  const sector = config.sector || "Organization"
  const scenarioType = config.scenarioType || "Cyber Incident"
  const crown = config.crownJewels || "customer data and core production systems"
  const systems = config.criticalSystems || "ERP, customer portal, identity provider"
  const size = config.companySize || "mid-market"
  const maturity = config.irMaturity || "developing"

  const title = `${scenarioType} at ${sector} — Operation BLACK TIDE`
  const summary = `A ${scenarioType.toLowerCase()} is unfolding against a ${size} ${sector.toLowerCase()} organization. Critical systems (${systems}) are showing anomalies. The incident response team has ${maturity.toLowerCase()} maturity. Crown jewels at risk: ${crown}.`

  const rounds: Round[] = [
    round1(sector, systems),
    round2(crown, systems),
    round3(sector),
    round4(sector, crown),
  ]

  return { scenario_title: title, scenario_summary: summary, rounds }
}

function round1(sector: string, systems: string): Round {
  const injects: Inject[] = [
    {
      id: id("inj"),
      type: "alert",
      channel: "siem_alert",
      title: "SIEM: Anomalous outbound traffic detected",
      content: `EDR flags 14 endpoints in the corporate VLAN beaconing to an unfamiliar ASN. Volume is low but consistent. ${systems} appear unaffected — for now.`,
      urgency: "medium",
      source: "Security Operations Center",
      senderName: "SOC Analyst L1",
      timestamp: "09:03",
    },
    {
      id: id("inj"),
      type: "internal",
      channel: "slack",
      title: "Helpdesk reports cluster of locked accounts",
      content: "Eight users across Finance and Procurement report being locked out within a 12-minute window. Helpdesk is queueing password resets without escalation.",
      urgency: "low",
      source: "IT Service Desk",
      senderName: "Tim Helpdesk",
      senderHandle: "tim.vd.berg",
      timestamp: "09:11",
    },
    {
      id: id("inj"),
      type: "intel",
      channel: "email",
      title: "Threat intel: New campaign targeting your sector",
      content: `An ISAC bulletin warns that a financially motivated group is actively targeting ${sector.toLowerCase()} organizations using stolen contractor credentials and Cobalt Strike.`,
      urgency: "medium",
      source: "Sector ISAC",
      senderName: "ISAC Threat Intel Team",
      senderHandle: "intel@sector-isac.org",
      timestamp: "09:22",
    },
    {
      id: id("inj"),
      type: "technical",
      channel: "system_alert",
      title: "DLP: Large compressed archive uploaded",
      content: "A 2.4 GB encrypted .7z file was uploaded to a personal cloud storage domain from a workstation belonging to a finance analyst at 02:14.",
      urgency: "high",
      source: "Data Loss Prevention",
      senderName: "DLP Engine",
      timestamp: "09:31",
    },
  ]

  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Assess whether the team recognizes the pattern across disparate, low-severity signals — and whether they escalate correctly.",
    keyQuestions: [
      "Who owns the first escalation decision — SOC, IT, or the IC?",
      "At what point do you open a formal incident ticket?",
      "Do you notify legal/compliance yet? Why or why not?",
      "What's your initial scoping hypothesis?",
    ],
    hints: [
      "The 02:14 DLP alert is 7 hours old. Why wasn't it escalated overnight?",
      "The locked accounts and the outbound traffic may not be correlated — or they may be the same actor.",
    ],
    expectedDecisions: [
      "Declare or defer formal incident",
      "Assign incident commander",
      "Begin log collection / forensic preservation",
      "Notify CISO verbally",
    ],
    redFlags: [
      "Team dismisses alerts as false positives without investigation",
      "No one assigns an owner to the DLP alert",
      "Helpdesk continues resetting passwords without a hold",
    ],
  }

  const roleActions: RoleAction[] = [
    { id: "gen-r1-a1", label: "Isolate affected endpoint", description: "Isolate the affected endpoint from the network.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r1-a2", label: "Escalate to CISO", description: "Formally escalate the incident to the CISO.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r1-a3", label: "Open crisis bridge call", description: "Initiate a crisis bridge call with key stakeholders.", allowedRoles: ["ciso", "head_of_comms"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r1-a4", label: "Notify board immediately", description: "Send immediate notification to the board.", allowedRoles: ["ceo", "ciso"], irPlanAligned: false, consequence: "Premature escalation before facts are established" },
    { id: "gen-r1-a5", label: "No action taken", description: "Do not take any immediate action.", allowedRoles: [], irPlanAligned: true },
  ]

  return {
    round_number: 1,
    title: "Initial Detection",
    situation_update: "It is 09:00. Overnight monitoring has produced a series of low- and medium-severity alerts. Nothing critical has tripped, but the pattern is unusual. The on-call analyst has paged the incident commander.",
    timerMinutes: 15,
    injects,
    facilitatorNotes,
    roleActions,
  }
}

function round2(crown: string, systems: string): Round {
  const injects: Inject[] = [
    {
      id: id("inj"),
      type: "technical",
      channel: "siem_alert",
      title: "Domain Admin account used from unknown host",
      content: "An account in the Domain Admins group authenticated to a domain controller from a workstation that has never been used by that account before. The session is still active.",
      urgency: "critical",
      source: "Identity Provider",
      senderName: "Azure AD / Entra",
      timestamp: "10:34",
    },
    {
      id: id("inj"),
      type: "alert",
      channel: "system_alert",
      title: `Encryption activity detected on file servers hosting ${crown}`,
      content: "EDR reports a process spawning from a scheduled task is rapidly renaming files with a .lockd extension on three file servers. Approximately 12% of the share is already affected.",
      urgency: "critical",
      source: "Endpoint Detection",
      senderName: "EDR Platform",
      timestamp: "10:41",
    },
    {
      id: id("inj"),
      type: "executive",
      channel: "whatsapp",
      title: "CEO requests an update — now",
      content: "The CEO has heard from a board member that 'something is going on with IT.' She wants a 5-minute briefing in 10 minutes. What do you tell her?",
      urgency: "high",
      source: "Executive Office",
      senderName: "Sarah de Vries (CEO)",
      senderHandle: "+31 6 12 34 56 78",
      timestamp: "10:47",
    },
    {
      id: id("inj"),
      type: "internal",
      channel: "slack",
      title: `${systems.split(",")[0]} performance degraded`,
      content: "Users report timeouts and partial page loads. Application owners are asking if they should fail over to DR. No formal incident declaration has been made yet.",
      urgency: "high",
      source: "Application Operations",
      senderName: "Ops-Alerts Bot",
      senderHandle: "#ops-alerts",
      timestamp: "10:52",
    },
  ]

  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Force the team into active containment decisions under time pressure — with incomplete information and executive interference.",
    keyQuestions: [
      "Do you isolate the affected file servers immediately? What's the business impact?",
      "What do you tell the CEO — and who delivers that message?",
      "Do you kill the active DA session? What's the risk of tipping off the attacker?",
      "Is this the moment to call your IR retainer / MDR?",
    ],
    hints: [
      "12% encrypted and climbing — every minute of discussion costs more files.",
      "Failing over to DR before you know if DR is also compromised may be catastrophic.",
    ],
    expectedDecisions: [
      "Isolate or not isolate affected file servers",
      "Formal crisis declaration",
      "Engage external IR retainer",
      "CEO briefing talking points agreed",
    ],
    redFlags: [
      "Team paralysis — no clear decision owner",
      "Attempting to negotiate with the attacker at this stage",
      "Skipping legal notification entirely",
    ],
  }

  const roleActions: RoleAction[] = [
    { id: "gen-r2-a1", label: "Disable compromised admin account", description: "Immediately disable the compromised admin account.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r2-a2", label: "Engage external IR firm", description: "Contact and engage the external incident response retainer.", allowedRoles: ["ciso", "it_manager"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r2-a3", label: "Brief CEO on incident status", description: "Provide a structured briefing to the CEO.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r2-a4", label: "Shut down crown jewel systems", description: "Immediately shut down all crown jewel systems.", allowedRoles: ["it_manager"], irPlanAligned: false, consequence: "Causes business disruption and logging gaps" },
    { id: "gen-r2-a5", label: "No action taken", description: "Do not take any immediate action.", allowedRoles: [], irPlanAligned: true },
  ]

  return {
    round_number: 2,
    title: "Containment & Investigation",
    situation_update: "It is 10:30. The picture is sharpening: this is not noise. Decisions about isolation, communication, and authority must be made under pressure, with incomplete information.",
    timerMinutes: 20,
    injects,
    facilitatorNotes,
    roleActions,
  }
}

function round3(sector: string): Round {
  const injects: Inject[] = [
    {
      id: id("inj"),
      type: "media",
      channel: "email",
      title: "Journalist asks for comment",
      content: `A reporter from a national outlet emails Communications: "We've been told ${sector} has been hit by a ransomware attack and customer data is being leaked. Can you confirm or deny by 16:00?"`,
      urgency: "high",
      source: "Communications Inbox",
      senderName: "Joris Vermeer — NRC",
      senderHandle: "j.vermeer@nrc.nl",
      timestamp: "14:03",
    },
    {
      id: id("inj"),
      type: "social",
      channel: "news_ticker",
      title: "Screenshots circulating on social media",
      content: "A Twitter/X account with 40k followers has posted screenshots that appear to be from your internal ticketing system. The post has 1,200 reposts in 20 minutes.",
      urgency: "high",
      source: "Brand Monitoring",
      senderName: "@DarkNetWatch",
      timestamp: "14:17",
    },
    {
      id: id("inj"),
      type: "alert",
      channel: "system_alert",
      title: "Ransom note delivered",
      content: "A README.txt file appears on dozens of endpoints. The threat actor demands $4.2M in cryptocurrency within 72 hours, and claims to have exfiltrated 850 GB of data, with proof samples linked.",
      urgency: "critical",
      source: "Endpoint Detection",
      senderName: "EDR Platform",
      timestamp: "14:29",
    },
    {
      id: id("inj"),
      type: "regulatory",
      channel: "email",
      title: "Regulator inquiry incoming",
      content: "Legal informs you that a sector regulator has formally asked whether you have suffered a 'material cyber incident' in the last 24 hours. Their disclosure clock starts on first knowledge.",
      urgency: "high",
      source: "Legal & Compliance",
      senderName: "Merel Hoekstra (Legal)",
      senderHandle: "m.hoekstra@legal.internal",
      timestamp: "14:44",
    },
  ]

  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Test crisis communication and legal/regulatory decision-making under public and institutional pressure simultaneously.",
    keyQuestions: [
      "What is your holding statement for the journalist? Do you confirm, deny, or 'no comment'?",
      "Under NIS2/Cbw — when does your 72-hour notification clock start?",
      "Who has authority to speak to regulators? Is that person available?",
      "Does the social media leak change your response posture?",
    ],
    hints: [
      "The regulator question about 'first knowledge' matters — document when you became aware.",
      "Saying 'no comment' to a journalist is still an answer. What story does it tell?",
      "'$4.2M in 72 hours' — do you have a pre-approved position on ransom negotiation?",
    ],
    expectedDecisions: [
      "Approve or reject media holding statement",
      "File NIS2 early warning within 24h (required)",
      "Decide ransomware negotiation posture",
      "Assign regulatory liaison",
    ],
    redFlags: [
      "No one owns the communications channel — Legal, Comms, and IT all contradicting each other",
      "Team wants to pay ransom without board/legal sign-off",
      "Missing the regulatory notification window",
    ],
  }

  const roleActions: RoleAction[] = [
    { id: "gen-r3-a1", label: "Issue holding statement to media", description: "Release an approved holding statement to media inquiries.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r3-a2", label: "Advise on regulatory notification timeline", description: "Provide legal guidance on notification obligations and deadlines.", allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r3-a3", label: "Authorize ransom negotiation", description: "Authorize engagement with the threat actor to negotiate ransom.", allowedRoles: ["ceo", "cfo"], irPlanAligned: false, consequence: "Financially and legally risky; no guarantee of decryption" },
    { id: "gen-r3-a4", label: "Maintain media silence", description: "Maintain media silence and do not issue any statement.", allowedRoles: ["head_of_comms", "ceo"], irPlanAligned: true },
    { id: "gen-r3-a5", label: "No action taken", description: "Do not take any immediate action.", allowedRoles: [], irPlanAligned: true },
  ]

  return {
    round_number: 3,
    title: "Escalation & Public Pressure",
    situation_update: "It is 14:00. The incident is no longer contained to IT. Communications, Legal, and the executive team are now part of the response. External pressure is mounting from media, regulators, and customers.",
    timerMinutes: 20,
    injects,
    facilitatorNotes,
    roleActions,
  }
}

function round4(sector: string, crown: string): Round {
  const injects: Inject[] = [
    {
      id: id("inj"),
      type: "executive",
      channel: "phone",
      title: "Board demands a decision on payment",
      content: "The board chair convenes an emergency call. They want a clear recommendation in 30 minutes: pay, do not pay, or negotiate. They expect risk, legal, and ethical considerations.",
      urgency: "critical",
      source: "Board of Directors",
      senderName: "Board Chair — Emergency Call",
      senderHandle: "+31 20 555 0100",
      timestamp: "18:15",
    },
    {
      id: id("inj"),
      type: "technical",
      channel: "slack",
      title: "Recovery from immutable backups confirmed",
      content: `The infrastructure team has confirmed clean immutable backups from 36 hours ago for ${crown}. Full restore is estimated at 18-24 hours with potential data loss in the gap.`,
      urgency: "high",
      source: "Infrastructure Team",
      senderName: "Backup & Recovery Team",
      senderHandle: "#infra-recovery",
      timestamp: "18:31",
    },
    {
      id: id("inj"),
      type: "regulatory",
      channel: "email",
      title: `${sector} customer notification draft`,
      content: "Legal has drafted a customer notification. Marketing wants it softened. Compliance wants it sent now. CEO wants 'one more pass.' Decide who signs off and when it goes.",
      urgency: "high",
      source: "Legal & Compliance",
      senderName: "Merel Hoekstra (Legal)",
      senderHandle: "m.hoekstra@legal.internal",
      timestamp: "18:48",
    },
    {
      id: id("inj"),
      type: "intel",
      channel: "raw",
      title: "Lessons-learned trigger",
      content: "The CISO asks each team lead for three things: what worked, what failed, and what you will change in the runbook starting Monday.",
      urgency: "medium",
      source: "CISO",
      senderName: "CISO",
      timestamp: "19:00",
    },
  ]

  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Drive toward concrete decisions on recovery sequencing, ransom, and notification — then extract honest lessons-learned.",
    keyQuestions: [
      "Pay or not? Who has authority to approve payment, and what's the legal exposure?",
      "18-24 hours of downtime — what's the business cost vs ransom cost?",
      "Which customers get notified, by when, and through which channel?",
      "What's the one thing that must change in the runbook before the next exercise?",
    ],
    hints: [
      "Paying does not guarantee decryption. ~20% of paying victims don't recover data.",
      "Customer notification timing may be legally mandated — check against the regulatory clock.",
      "The backup restore window overlaps with potential re-infection if the initial access vector isn't closed.",
    ],
    expectedDecisions: [
      "Final ransomware payment position",
      "Recovery sequencing approved",
      "Customer notification sent or scheduled",
      "Lessons-learned captured per team",
    ],
    redFlags: [
      "No consensus on payment — decision deferred without a clear process",
      "Customer notification blocked by internal politics past the legal deadline",
      "Lessons-learned treated as formality with no actionable outputs",
    ],
  }

  const roleActions: RoleAction[] = [
    { id: "gen-r4-a1", label: "Authorize recovery from clean backups", description: "Formally authorize recovery from confirmed clean backups.", allowedRoles: ["it_manager", "ciso"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r4-a2", label: "File regulatory notification", description: "Submit the required regulatory notification to authorities.", allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r4-a3", label: "Send customer breach notification", description: "Send breach notification to affected customers.", allowedRoles: ["head_of_comms", "legal"], isRecommended: true, irPlanAligned: true },
    { id: "gen-r4-a4", label: "Resume all systems without full forensics", description: "Resume all systems immediately without completing forensic analysis.", allowedRoles: ["it_manager"], irPlanAligned: false, consequence: "Risk of reinfection if root cause not confirmed" },
    { id: "gen-r4-a5", label: "No action taken", description: "Do not take any immediate action.", allowedRoles: [], irPlanAligned: true },
  ]

  return {
    round_number: 4,
    title: "Recovery & Communications",
    situation_update: "It is 18:30. The acute phase is winding down. Strategic decisions about payment, recovery sequencing, customer notification, and post-incident learning now define how the organization comes out of this.",
    timerMinutes: 15,
    injects,
    facilitatorNotes,
    roleActions,
  }
}
