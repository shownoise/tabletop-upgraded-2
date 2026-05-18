import type { ExerciseConfig, Scenario, Round, Inject, FacilitatorNotes, RoleAction, Role } from "./types"

let counter = 0
function id(prefix: string) {
  counter++
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

function filterActions(actions: RoleAction[], selectedRoles?: Role[]): RoleAction[] {
  if (!selectedRoles?.length) return actions
  return actions.filter(a => a.allowedRoles.length === 0 || a.allowedRoles.some(r => selectedRoles.includes(r)))
}

// Returns true if this org has automated detection tooling (SIEM/EDR)
function hasMonitoring(config: ExerciseConfig): boolean {
  return !["no_soc", "outsourced_it"].includes(config.securityCapability ?? "small_it")
}

// Beginner = fewer, clearer injects; advanced = more, noisier injects
function injectSlice(injects: Inject[], config: ExerciseConfig): Inject[] {
  if (config.difficulty === "beginner") return injects.slice(0, 2)
  if (config.difficulty === "advanced") return injects
  return injects.slice(0, 3)
}

// Detection inject for orgs with no monitoring — detection comes externally or via user
function externalDetectionInject(context: string): Inject {
  return {
    id: id("inj"), type: "internal", channel: "email",
    title: "Employee reports strange computer behaviour",
    content: `A Finance employee emails IT: 'My computer has been acting up since this morning — files are opening very slowly and I can't save to the shared drive. Several colleagues on my floor have the same issue.' ${context}`,
    urgency: "medium", source: "IT Helpdesk", senderName: "Finance Employee", timestamp: "09:18",
  }
}

export function generateScenario(config: ExerciseConfig): Scenario {
  const type = (config.scenarioType || "").toLowerCase()
  if (type.includes("insider")) return generateInsiderThreat(config)
  if (type.includes("business email") || type.includes("bec")) return generateBEC(config)
  if (type.includes("data exfil")) return generateDataExfil(config)
  return generateRansomware(config)
}

// ─── RANSOMWARE ────────────────────────────────────────────────────────────────

function generateRansomware(config: ExerciseConfig): Scenario {
  const sector = config.sector || "Organization"
  const crown = config.crownJewels || "customer data and production systems"
  const systems = config.criticalSystems || "ERP, customer portal, identity provider"
  const size = config.companySize || "mid-market"
  const sel = config.selectedRoles

  return {
    scenario_title: `Ransomware Incident at ${sector} — Operation BLACK TIDE`,
    scenario_summary: `A ransomware attack is unfolding against a ${size} ${sector.toLowerCase()} organization. Critical systems (${systems}) are showing anomalies. Crown jewels at risk: ${crown}.`,
    rounds: [
      ransomwareR1(sector, systems, sel, config),
      ransomwareR2(crown, systems, sel),
      ransomwareR3(sector, sel),
      ransomwareR4(sector, crown, sel),
    ],
  }
}

function ransomwareR1(sector: string, systems: string, sel?: Role[], config?: ExerciseConfig): Round {
  const monitoring = hasMonitoring(config ?? ({} as ExerciseConfig))
  const allInjects: Inject[] = [
    monitoring ? {
      id: id("inj"), type: "alert", channel: "siem_alert",
      title: "SIEM: Anomalous outbound traffic detected",
      content: `EDR flags 14 endpoints in the corporate VLAN beaconing to an unfamiliar ASN. Volume is low but consistent. ${systems} appear unaffected — for now.`,
      urgency: "medium", source: "Security Operations Center", senderName: "SOC Analyst L1", timestamp: "09:03",
    } : externalDetectionInject(`No automated alerts were generated — there is no SIEM or EDR in place. This is the first indication of a problem.`),
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: "Helpdesk reports cluster of locked accounts",
      content: "Eight users across Finance and Procurement report being locked out within a 12-minute window. Helpdesk is queueing password resets without escalation.",
      urgency: "low", source: "IT Service Desk", senderName: "Tim Helpdesk", senderHandle: "tim.vd.berg", timestamp: "09:11",
    },
    {
      id: id("inj"), type: "intel", channel: "email",
      title: "Threat intel: New campaign targeting your sector",
      content: `An ISAC bulletin warns that a financially motivated group is actively targeting ${sector.toLowerCase()} organizations using stolen contractor credentials and Cobalt Strike.`,
      urgency: "medium", source: "Sector ISAC", senderName: "ISAC Threat Intel Team", senderHandle: "intel@sector-isac.org", timestamp: "09:22",
    },
    {
      id: id("inj"), type: "technical", channel: "system_alert",
      title: "DLP: Large compressed archive uploaded",
      content: monitoring
        ? "A 2.4 GB encrypted .7z file was uploaded to a personal cloud storage domain from a workstation belonging to a finance analyst at 02:14."
        : "A colleague notices the finance analyst's laptop was left on overnight and the screensaver shows an unfamiliar command prompt window.",
      urgency: "high", source: monitoring ? "Data Loss Prevention" : "Employee report", senderName: monitoring ? "DLP Engine" : "Office Manager", timestamp: "09:31",
    },
  ]
  const injects = injectSlice(allInjects, config ?? ({} as ExerciseConfig))
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Assess whether the team recognises the pattern across disparate low-severity signals — and whether they escalate correctly.",
    keyQuestions: ["Who owns the first escalation decision — SOC, IT, or the IC?", "At what point do you open a formal incident ticket?", "Do you notify legal/compliance yet? Why or why not?"],
    hints: ["The 02:14 DLP alert is 7 hours old. Why wasn't it escalated overnight?", "The locked accounts and outbound traffic may or may not be the same actor."],
    expectedDecisions: ["Declare or defer formal incident", "Assign incident commander", "Begin log collection / forensic preservation"],
    redFlags: ["Team dismisses alerts as false positives without investigation", "Helpdesk continues resetting passwords without a hold"],
  }
  const roleActions = filterActions([
    { id: "gen-r1-a1", label: "Isolate affected endpoints", description: "Isolate the flagged endpoints from the network to stop lateral movement.", allowedRoles: ["it_manager", "system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Limits spread; may disrupt some users temporarily." },
    { id: "gen-r1-a2", label: "Escalate to CISO", description: "Formally escalate the incident to the CISO and open an incident ticket.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Engages security leadership and starts the formal response clock." },
    { id: "gen-r1-a3", label: "Open crisis bridge call", description: "Initiate a crisis bridge call with key stakeholders.", allowedRoles: ["ciso", "head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Aligns response team early; prevents siloed decisions." },
    { id: "gen-r1-a4", label: "Notify board immediately", description: "Send immediate notification to the board before facts are established.", allowedRoles: ["ceo", "ciso"], irPlanAligned: false, consequence: "Premature escalation may cause panic before the scope is known." },
    { id: "gen-r1-do-nothing", label: "Do nothing / wait for more information", description: "Hold until more facts are available before escalating.", allowedRoles: [], irPlanAligned: true, consequence: "Reasonable if signals are ambiguous; risky if detection was already clear." },
  ], sel)
  return { round_number: 1, title: "Initial Detection", situation_update: "It is 09:00. Overnight monitoring has produced low- and medium-severity alerts. Nothing critical has tripped, but the pattern is unusual. The on-call analyst has paged the incident commander.", timerMinutes: 15, injects, facilitatorNotes, roleActions }
}

function ransomwareR2(crown: string, systems: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "technical", channel: "siem_alert",
      title: "Domain Admin account used from unknown host",
      content: "An account in the Domain Admins group authenticated to a domain controller from a workstation that has never been used by that account before. The session is still active.",
      urgency: "critical", source: "Identity Provider", senderName: "Azure AD / Entra", timestamp: "10:34",
    },
    {
      id: id("inj"), type: "alert", channel: "system_alert",
      title: `Encryption activity detected on file servers hosting ${crown}`,
      content: "EDR reports a process spawning from a scheduled task is rapidly renaming files with a .lockd extension on three file servers. Approximately 12% of the share is already affected.",
      urgency: "critical", source: "Endpoint Detection", senderName: "EDR Platform", timestamp: "10:41",
    },
    {
      id: id("inj"), type: "executive", channel: "whatsapp",
      title: "CEO requests an update — now",
      content: "The CEO has heard from a board member that 'something is going on with IT.' She wants a 5-minute briefing in 10 minutes.",
      urgency: "high", source: "Executive Office", senderName: "CEO", senderHandle: "+31 6 12 34 56 78", timestamp: "10:47",
    },
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: `${systems.split(",")[0]} performance degraded`,
      content: "Users report timeouts and partial page loads. Application owners are asking if they should fail over to DR. No formal incident declaration has been made yet.",
      urgency: "high", source: "Application Operations", senderName: "Ops-Alerts Bot", senderHandle: "#ops-alerts", timestamp: "10:52",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Force the team into active containment decisions under time pressure with incomplete information and executive interference.",
    keyQuestions: ["Do you isolate the affected file servers? What's the business impact?", "What do you tell the CEO — and who delivers that message?", "Is this the moment to call your IR retainer?"],
    hints: ["12% encrypted and climbing — every minute of discussion costs more files.", "Failing over to DR before you know if DR is also compromised may be catastrophic."],
    expectedDecisions: ["Isolate or not isolate file servers", "Formal crisis declaration", "Engage external IR retainer", "CEO briefing talking points agreed"],
    redFlags: ["Team paralysis — no clear decision owner", "Skipping legal notification entirely"],
  }
  const roleActions = filterActions([
    { id: "gen-r2-a1", label: "Disable compromised admin account", description: "Immediately disable the compromised Domain Admin account to stop the active session.", allowedRoles: ["it_manager", "system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Cuts off attacker's privileged access; may alert them to detection." },
    { id: "gen-r2-a2", label: "Engage external IR firm", description: "Contact and engage the external incident response retainer.", allowedRoles: ["ciso", "it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Brings in specialist capability; essential if internal capacity is limited." },
    { id: "gen-r2-a3", label: "Brief CEO on incident status", description: "Provide a structured factual briefing to the CEO with what is known and unknown.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Manages executive expectations and enables authorised escalation." },
    { id: "gen-r2-a4", label: "Advise on insurance notification", description: "Contact cyber insurer to initiate the claim process and get coverage guidance.", allowedRoles: ["cfo", "legal"], isRecommended: true, irPlanAligned: true, consequence: "Preserves insurance coverage; some policies require notification within hours." },
    { id: "gen-r2-do-nothing", label: "Do nothing / wait for IR retainer", description: "Hold all decisions until the external IR firm is on-call.", allowedRoles: [], irPlanAligned: false, consequence: "Encryption continues while waiting; valuable response time lost." },
  ], sel)
  return { round_number: 2, title: "Containment & Investigation", situation_update: "It is 10:30. The picture is sharpening: this is not noise. Decisions about isolation, communication, and authority must be made under pressure, with incomplete information.", timerMinutes: 20, injects, facilitatorNotes, roleActions }
}

function ransomwareR3(sector: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "media", channel: "email",
      title: "Journalist asks for comment",
      content: `A reporter from a national outlet emails Communications: "We've been told ${sector} has been hit by a ransomware attack and customer data is being leaked. Can you confirm or deny by 16:00?"`,
      urgency: "high", source: "Communications Inbox", senderName: "Journalist — NRC", senderHandle: "j.vermeer@nrc.nl", timestamp: "14:03",
    },
    {
      id: id("inj"), type: "social", channel: "news_ticker",
      title: "Screenshots circulating on social media",
      content: "A Twitter/X account with 40k followers has posted screenshots that appear to be from your internal ticketing system. 1,200 reposts in 20 minutes.",
      urgency: "high", source: "Brand Monitoring", senderName: "@DarkNetWatch", timestamp: "14:17",
    },
    {
      id: id("inj"), type: "alert", channel: "system_alert",
      title: "Ransom note delivered",
      content: "A README.txt appears on dozens of endpoints. The threat actor demands $4.2M in cryptocurrency within 72 hours, and claims to have exfiltrated 850 GB of data.",
      urgency: "critical", source: "Endpoint Detection", senderName: "EDR Platform", timestamp: "14:29",
    },
    {
      id: id("inj"), type: "regulatory", channel: "email",
      title: "Regulator inquiry incoming",
      content: "Legal informs you that a sector regulator has formally asked whether you have suffered a 'material cyber incident' in the last 24 hours. Their disclosure clock starts on first knowledge.",
      urgency: "high", source: "Legal & Compliance", senderName: "Legal Counsel", senderHandle: "legal@internal", timestamp: "14:44",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Test crisis communication and legal/regulatory decision-making under public and institutional pressure simultaneously.",
    keyQuestions: ["What is your holding statement for the journalist?", "Under NIS2 — when does your 72-hour notification clock start?", "Who has authority to speak to regulators?"],
    hints: ["The regulator question about 'first knowledge' matters — document when you became aware.", "'$4.2M in 72 hours' — do you have a pre-approved position on ransom negotiation?"],
    expectedDecisions: ["Approve or reject media holding statement", "File NIS2 early warning within 24h", "Decide ransomware negotiation posture", "Assign regulatory liaison"],
    redFlags: ["No one owns the communications channel", "Team wants to pay ransom without board/legal sign-off", "Missing the regulatory notification window"],
  }
  const roleActions = filterActions([
    { id: "gen-r3-a1", label: "Issue holding statement to media", description: "Release an approved holding statement to media inquiries acknowledging awareness of an IT incident without confirming breach details.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Controls narrative; prevents speculation. Must be approved by CEO/Legal first." },
    { id: "gen-r3-a2", label: "Advise on NIS2 notification timeline", description: "Provide legal guidance on notification obligations and deadlines under NIS2/GDPR.", allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Ensures compliance; missing the window creates regulatory liability." },
    { id: "gen-r3-a3", label: "Recommend ransom negotiation posture to CEO", description: "Provide financial and legal analysis on ransom payment options for CEO decision.", allowedRoles: ["cfo", "legal"], irPlanAligned: true, consequence: "Gives CEO a structured basis for the most visible decision of the incident." },
    { id: "gen-r3-a4", label: "Authorise ransom payment without board approval", description: "Approve the ransom payment immediately without board sign-off.", allowedRoles: ["ceo", "cfo"], irPlanAligned: false, consequence: "Financially and legally risky; no guarantee of decryption. Board must be consulted." },
    { id: "gen-r3-do-nothing", label: "Maintain silence on all fronts", description: "Issue no statement and take no regulatory action pending further information.", allowedRoles: [], irPlanAligned: false, consequence: "Regulatory clock is running; silence may worsen both public and legal exposure." },
  ], sel)
  return { round_number: 3, title: "Escalation & Public Pressure", situation_update: "It is 14:00. The incident is no longer contained to IT. Communications, Legal, and the executive team are now fully engaged. External pressure is mounting.", timerMinutes: 20, injects, facilitatorNotes, roleActions }
}

function ransomwareR4(sector: string, crown: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "executive", channel: "phone",
      title: "Board demands a decision on payment",
      content: "The board chair convenes an emergency call. They want a clear recommendation in 30 minutes: pay, do not pay, or negotiate. They expect risk, legal, and ethical considerations.",
      urgency: "critical", source: "Board of Directors", senderName: "Board Chair — Emergency Call", senderHandle: "+31 20 555 0100", timestamp: "18:15",
    },
    {
      id: id("inj"), type: "technical", channel: "slack",
      title: "Recovery from immutable backups confirmed",
      content: `The infrastructure team has confirmed clean immutable backups from 36 hours ago for ${crown}. Full restore is estimated at 18-24 hours with potential data loss in the gap.`,
      urgency: "high", source: "Infrastructure Team", senderName: "Backup & Recovery Team", senderHandle: "#infra-recovery", timestamp: "18:31",
    },
    {
      id: id("inj"), type: "regulatory", channel: "email",
      title: `${sector} customer notification draft`,
      content: "Legal has drafted a customer notification. Marketing wants it softened. Compliance wants it sent now. CEO wants 'one more pass.' Decide who signs off and when it goes.",
      urgency: "high", source: "Legal & Compliance", senderName: "Legal Counsel", senderHandle: "legal@internal", timestamp: "18:48",
    },
    {
      id: id("inj"), type: "intel", channel: "raw",
      title: "Lessons-learned trigger",
      content: "The CISO asks each team lead: what worked, what failed, and what you will change in the runbook starting Monday.",
      urgency: "medium", source: "CISO", senderName: "CISO", timestamp: "19:00",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Drive toward concrete decisions on recovery sequencing, ransom, and notification — then extract honest lessons-learned.",
    keyQuestions: ["Pay or not? Who has authority to approve, and what's the legal exposure?", "18-24 hours of downtime — what's the business cost vs ransom cost?", "Which customers get notified, by when, through which channel?"],
    hints: ["Paying does not guarantee decryption. ~20% of paying victims don't recover data.", "The backup restore window overlaps with potential re-infection if the initial access vector isn't closed."],
    expectedDecisions: ["Final ransomware payment position", "Recovery sequencing approved", "Customer notification sent or scheduled", "Lessons-learned captured per team"],
    redFlags: ["No consensus on payment — decision deferred without a clear process", "Customer notification blocked past the legal deadline"],
  }
  const roleActions = filterActions([
    { id: "gen-r4-a1", label: "Authorise recovery from clean backups", description: "Formally authorise recovery from confirmed clean backups and publish the recovery timeline.", allowedRoles: ["it_manager", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Starts the clock on 18-24h restore. Safe path if initial access vector is confirmed closed." },
    { id: "gen-r4-a2", label: "File regulatory notification", description: "Submit the required NIS2/GDPR notification to authorities.", allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Ensures compliance; must be done within 72h of first knowledge." },
    { id: "gen-r4-a3", label: "Send customer breach notification", description: "Send breach notification to affected customers per GDPR Art. 34.", allowedRoles: ["head_of_comms", "legal"], isRecommended: true, irPlanAligned: true, consequence: "Required under GDPR if high risk to individuals. Builds trust if done transparently." },
    { id: "gen-r4-a4", label: "Resume all systems without full forensics", description: "Restore all systems immediately to minimise downtime before root cause is confirmed.", allowedRoles: ["it_manager"], irPlanAligned: false, consequence: "Risk of reinfection if the initial access vector is still open." },
    { id: "gen-r4-do-nothing", label: "Defer all decisions pending legal review", description: "Hold all recovery and notification decisions until legal confirms the position.", allowedRoles: [], irPlanAligned: false, consequence: "Delays recovery and may breach notification deadlines." },
  ], sel)
  return { round_number: 4, title: "Recovery & Communications", situation_update: "It is 18:30. The acute phase is winding down. Strategic decisions about payment, recovery sequencing, customer notification, and post-incident learning now define how the organisation comes out of this.", timerMinutes: 15, injects, facilitatorNotes, roleActions }
}

// ─── INSIDER THREAT ────────────────────────────────────────────────────────────

function generateInsiderThreat(config: ExerciseConfig): Scenario {
  const sector = config.sector || "Organization"
  const crown = config.crownJewels || "client contracts and strategic plans"
  const systems = config.criticalSystems || "file servers, CRM, ERP"
  const size = config.companySize || "mid-market"
  const sel = config.selectedRoles

  return {
    scenario_title: `Insider Threat at ${sector} — Operation SHADOW KEY`,
    scenario_summary: `A ${size} ${sector.toLowerCase()} organisation is confronted with systematic data exfiltration by a trusted employee. Crown jewels at risk: ${crown}. The incident unfolds across HR, Legal, IT, and the executive team.`,
    rounds: [
      insiderR1(sector, systems, sel, config),
      insiderR2(crown, sel),
      insiderR3(sector, sel),
      insiderR4(crown, sel),
    ],
  }
}

function insiderR1(sector: string, systems: string, sel?: Role[], config?: ExerciseConfig): Round {
  const monitoring = hasMonitoring(config ?? ({} as ExerciseConfig))
  const injects: Inject[] = [
    monitoring ? {
      id: id("inj"), type: "alert", channel: "siem_alert",
      title: "DLP: Unusual file download volume from shared drives",
      content: `DLP flags employee J. Bakker downloading 18 GB from the ${systems.split(",")[0]} shared drives to a personal USB device over the past three weeks. The pattern was flagged but marked low-priority by the overnight analyst.`,
      urgency: "medium", source: "Data Loss Prevention", senderName: "DLP Engine", timestamp: "09:15",
    } : {
      id: id("inj"), type: "internal", channel: "slack",
      title: "Manager reports suspected data theft",
      content: `Team lead M. Jansen messages HR Lead: 'I think J. Bakker has been taking files home. I noticed them copying things to a USB stick last week and they've been asking about salaries at our competitor. I didn't know who to tell.' There is no automated monitoring in place to verify this independently.`,
      urgency: "medium", source: "HR", senderName: "M. Jansen (Team Lead)", senderHandle: "m.jansen", timestamp: "09:10",
    },
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: "Manager informal tip to HR",
      content: "Team lead M. Jansen messages HR Lead via Slack: 'I've noticed J. Bakker has been printing a lot of documents lately and asking colleagues about salaries at our main competitor. Probably nothing, but it felt off.'",
      urgency: "low", source: "HR", senderName: "M. Jansen (Team Lead)", senderHandle: "m.jansen", timestamp: "09:28",
    },
    monitoring ? {
      id: id("inj"), type: "technical", channel: "siem_alert",
      title: "SIEM: After-hours access to HR payroll system",
      content: `J. Bakker's account accessed the ${sector} payroll and salary database at 23:47 on Saturday. This system is outside their normal job scope. The session lasted 42 minutes.`,
      urgency: "high", source: "SIEM", senderName: "SOC Analyst", timestamp: "09:41",
    } : {
      id: id("inj"), type: "internal", channel: "email",
      title: "IT finds unusual files on shared drive",
      content: "IT Manager notices during routine maintenance that J. Bakker's home folder contains a large number of compressed archives with names like 'backup_final_v3.zip'. These files are not related to their job role. No automated tool flagged this — it was found manually.",
      urgency: "high", source: "IT Manager", senderName: "IT Manager", timestamp: "09:41",
    },
    {
      id: id("inj"), type: "intel", channel: "email",
      title: monitoring ? "IT: Large zip file shared via external link" : "Competitor tip: suspiciously similar proposal",
      content: monitoring
        ? "IT audit log shows J. Bakker uploaded a 4.2 GB .zip archive to a personal Dropbox account at 23:14 last Thursday. The file was shared via an external link that has since been accessed from a non-company IP."
        : "A business contact at a partner firm casually mentions that your main competitor recently pitched them using pricing details that could only have come from your CRM. 'It felt like they had access to your proposal.'",
      urgency: "high", source: monitoring ? "IT Security" : "Business Development", senderName: monitoring ? "IT Security Team" : "Sales Manager", timestamp: "09:53",
    },
  ]
  const allInjects = injects
  const slicedInjects = injectSlice(allInjects, config ?? ({} as ExerciseConfig))
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Assess whether the team can piece together a behavioural + technical pattern without tipping off the employee, and whether they involve HR and Legal before acting.",
    keyQuestions: ["Who leads an insider threat investigation — HR, Legal, or IT?", "Do you confront the employee now or gather more evidence first?", "What are the legal constraints on monitoring an employee's activity?", "Who else needs to know at this stage?"],
    hints: [monitoring ? "The SIEM alert was available since Saturday. Why is it only surfaced now?" : "Without monitoring tools, you're relying on human observation. How do you build a case without automated evidence?", "Confronting too early may destroy evidence and give the employee a legal advantage."],
    expectedDecisions: ["Start formal covert investigation", "Involve Legal from the outset", "Preserve all digital evidence without alerting the employee"],
    redFlags: ["HR acts without Legal sign-off", "IT immediately revokes access before evidence is secured", "No one considers employment law constraints"],
  }
  const roleActions = filterActions([
    { id: "ins-r1-a1", label: "Brief Legal before any investigation steps", description: "Engage Legal to define the lawful investigation framework before HR or IT take any action.", allowedRoles: ["hr_lead", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Protects the organisation legally; ensures evidence is gathered in an admissible way." },
    { id: "ins-r1-a2", label: "Preserve all access logs without alerting the employee", description: "IT secures and preserves all relevant logs, email, and access records for forensic use — without touching the employee's active account.", allowedRoles: ["it_manager", "system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Preserves evidence chain; essential before any confrontation." },
    { id: "ins-r1-a3", label: "Speak confidentially with the employee's manager", description: "HR Lead conducts a confidential briefing with the team lead to understand behavioural context — without revealing the investigation.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Gathers context; manager can flag if the employee plans to leave imminently." },
    { id: "ins-r1-a4", label: "Confront the employee immediately", description: "Call J. Bakker in for an impromptu meeting and ask directly about the data transfers.", allowedRoles: [], irPlanAligned: false, consequence: "Destroys evidence, triggers legal exposure, and may cause data destruction or further exfiltration." },
    { id: "ins-r1-do-nothing", label: "Continue passive monitoring before escalating", description: "Allow the employee to continue activity while IT monitors in real time.", allowedRoles: [], irPlanAligned: true, consequence: "Buys investigation time but risk of further exfiltration grows daily." },
  ], sel)
  return { round_number: 1, title: "Suspicious Activity Detected", situation_update: "It is 09:00. A cluster of signals — some behavioural, some technical — are pointing at a single employee. Nothing is confirmed yet. The investigation must be handled carefully to preserve evidence and stay within employment law.", timerMinutes: 15, injects: slicedInjects, facilitatorNotes, roleActions }
}

function insiderR2(crown: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "technical", channel: "email",
      title: "Forensics report: 84 GB confirmed exfiltration over 42 days",
      content: `IT forensics confirms J. Bakker systematically copied files from six shared drives to a personal Dropbox over 42 days. The exfiltrated data includes ${crown}. Timeline reconstruction is complete.`,
      urgency: "critical", source: "IT Forensics", senderName: "External Forensics Team", timestamp: "11:14",
    },
    {
      id: id("inj"), type: "intel", channel: "slack",
      title: "LinkedIn: Employee actively interviewing",
      content: "HR Lead notices J. Bakker updated their LinkedIn profile to 'Open to Work' yesterday. HR access to calendar (via manager) shows a 'coffee meeting' tomorrow at 10:00 at the main competitor's office.",
      urgency: "high", source: "HR Intelligence", senderName: "HR Lead", timestamp: "11:32",
    },
    {
      id: id("inj"), type: "executive", channel: "email",
      title: "Legal memo: Investigation protocol constraints",
      content: "Legal advises that under Dutch employment law, disciplinary action requires a formal investigative interview (hoor en wederhoor). Immediate dismissal without this process creates wrongful termination risk. Employee is currently in the building.",
      urgency: "high", source: "Legal Counsel", senderName: "Legal Counsel", senderHandle: "legal@internal", timestamp: "11:48",
    },
    {
      id: id("inj"), type: "internal", channel: "siem_alert",
      title: "IT: Employee continues accessing systems now",
      content: "Real-time monitoring shows J. Bakker is currently active on the ERP system and has opened 12 additional client contract files in the last 20 minutes.",
      urgency: "critical", source: "IT Security", senderName: "IT Security Monitor", timestamp: "12:01",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Force a decision on whether to act now (revoke access, place on leave) vs continue gathering evidence — under the tension of ongoing exfiltration and legal constraints.",
    keyQuestions: ["Place on administrative leave now — or wait for more evidence?", "Who has authority to approve the leave decision?", "Do you revoke access before or after notifying the employee?", "At what point do you contact the police?"],
    hints: ["Every hour of continued access is more exfiltration. But moving too fast destroys your legal position.", "The 'coffee meeting' tomorrow may be the handoff. That's your deadline."],
    expectedDecisions: ["Administrative leave approved with Legal sign-off", "Access revocation timed with the leave notification", "Decision on police referral"],
    redFlags: ["HR acts without Legal authorisation", "Access revoked with no accompanying formal process", "No one considers the police/FIOD option explicitly"],
  }
  const roleActions = filterActions([
    { id: "ins-r2-a1", label: "Place employee on administrative leave", description: "HR Lead, with Legal sign-off, formally places J. Bakker on paid administrative leave pending investigation — effective immediately.", allowedRoles: ["hr_lead", "legal"], isRecommended: true, irPlanAligned: true, consequence: "Stops ongoing exfiltration and is legally defensible. Requires formal written notice." },
    { id: "ins-r2-a2", label: "Revoke all system access credentials", description: "IT revokes J. Bakker's SSO, email, VPN, and file server access simultaneously with the leave notification.", allowedRoles: ["it_manager", "system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Stops further data transfer. Must be timed with leave notification to avoid legal challenge." },
    { id: "ins-r2-a3", label: "Prepare formal investigative interview", description: "Legal and HR prepare the hoor-en-wederhoor interview to be conducted before any disciplinary decision.", allowedRoles: ["hr_lead", "legal"], isRecommended: true, irPlanAligned: true, consequence: "Required under Dutch employment law. Strengthens dismissal case if conducted correctly." },
    { id: "ins-r2-a4", label: "File police report immediately", description: "Report J. Bakker to the police for computer fraud and IP theft before placing on leave.", allowedRoles: ["ceo", "legal"], irPlanAligned: true, consequence: "Legally possible but may complicate the employment law process. Timing matters." },
    { id: "ins-r2-do-nothing", label: "Continue monitoring while preparing the case", description: "Hold off on all action for another 24 hours to complete the evidence picture.", allowedRoles: [], irPlanAligned: false, consequence: "The competitor meeting tomorrow makes this very risky — data may leave the country." },
  ], sel)
  return { round_number: 2, title: "Confirmed Exfiltration", situation_update: "It is 11:00. Forensics has confirmed systematic, intentional exfiltration. The employee is currently in the building and actively accessing files. Legal is advising caution. A decision on administrative leave must be made now — or the window closes.", timerMinutes: 20, injects, facilitatorNotes, roleActions }
}

function insiderR3(sector: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "regulatory", channel: "email",
      title: "Legal: GDPR AP notification required",
      content: "Legal confirms the exfiltrated data includes customer PII — names, contact details, and contract terms. This triggers GDPR Art. 33: AP notification within 72 hours of first knowledge. Clock started this morning.",
      urgency: "critical", source: "Legal Counsel", senderName: "Legal Counsel", timestamp: "14:03",
    },
    {
      id: id("inj"), type: "internal", channel: "email",
      title: "Employee's lawyer contacts HR",
      content: "J. Bakker's employment lawyer sends a formal letter claiming J. Bakker intends to make a protected whistleblower disclosure about alleged financial irregularities at the company. The letter cautions against dismissal.",
      urgency: "high", source: "External Counsel", senderName: "Advocatenkantoor Pietersen & Partners", timestamp: "14:29",
    },
    {
      id: id("inj"), type: "media", channel: "email",
      title: "Journalist asks about 'IP theft lawsuit'",
      content: `A financial journalist emails Communications: "We've heard that ${sector} is pursuing legal action against a former employee for theft of trade secrets. Can you confirm and provide details by 17:00?"`,
      urgency: "high", source: "Press", senderName: "Journalist — FD", senderHandle: "k.smits@fd.nl", timestamp: "14:47",
    },
    {
      id: id("inj"), type: "executive", channel: "whatsapp",
      title: "Board member asks CEO directly",
      content: "A board member messages the CEO via WhatsApp: 'Heard there's a data theft issue internally. Do I need to know about this? What's the exposure?'",
      urgency: "high", source: "Board", senderName: "Board Member (WhatsApp)", timestamp: "15:02",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Test Legal, HR, and Communications under simultaneous pressure from a whistleblower claim, GDPR clock, and media inquiry — with the board watching.",
    keyQuestions: ["Does the whistleblower claim change your legal strategy?", "What does GDPR require you to do in the next 48 hours?", "Who responds to the journalist — and what do you say?", "How do you brief the board?"],
    hints: ["Whistleblower protection does NOT protect the employee from a separate criminal matter — but the sequence of actions matters enormously.", "The AP notification clock is ticking from this morning. Legal must draft today."],
    expectedDecisions: ["Legal assesses whistleblower claim validity", "AP notification drafted and filed", "Media holding statement approved", "Board briefed by CEO"],
    redFlags: ["Legal dismisses whistleblower claim without proper assessment", "AP notification delayed past 72-hour mark", "Communications issues denial before Legal review"],
  }
  const roleActions = filterActions([
    { id: "ins-r3-a1", label: "Assess whistleblower claim before any further action", description: "Legal advises on whether the protected disclosure claim is valid and what it means for the disciplinary/criminal track.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Prevents wrongful dismissal exposure; determines whether the two tracks (employment + criminal) can proceed in parallel." },
    { id: "ins-r3-a2", label: "File AP breach notification", description: "Legal drafts and files the GDPR Art. 33 notification to the Dutch Data Protection Authority (AP) within the 72-hour window.", allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Required by law. Missing the window creates significant regulatory liability." },
    { id: "ins-r3-a3", label: "Issue media holding statement", description: "Communications drafts a measured holding statement acknowledging an internal HR matter — without confirming criminal allegations.", allowedRoles: ["head_of_comms", "ceo"], isRecommended: true, irPlanAligned: true, consequence: "Controls narrative; prevents speculation. Must not prejudge the employee while under investigation." },
    { id: "ins-r3-a4", label: "Brief board formally", description: "CEO provides board with a written update on the incident scope, legal exposure, and response steps taken.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Board duty of care; protects CEO from being blindsided at next board meeting." },
    { id: "ins-r3-do-nothing", label: "Wait for legal proceedings to determine next steps", description: "Hold all communications and notifications until the employment court position is clear.", allowedRoles: [], irPlanAligned: false, consequence: "AP notification deadline passes; media runs the story without your input." },
  ], sel)
  return { round_number: 3, title: "Legal Complexity & External Pressure", situation_update: "It is 14:00. The employee has now engaged a lawyer citing whistleblower protection. GDPR requires an AP notification within 72 hours. A journalist is asking questions. The board wants answers. Multiple simultaneous pressure tracks must be managed without contradiction.", timerMinutes: 20, injects, facilitatorNotes, roleActions }
}

function insiderR4(crown: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "intel", channel: "email",
      title: "Forensics final: Competitor access confirmed",
      content: `Final forensics report: the exfiltrated data (${crown}) was accessed from an IP registered to the main competitor within 6 hours of upload. Economic espionage is now a credible theory. The report has been handed to the police.`,
      urgency: "critical", source: "External Forensics Team", senderName: "Forensic Investigator", timestamp: "17:05",
    },
    {
      id: id("inj"), type: "regulatory", channel: "email",
      title: "AP acknowledgement: Notification received",
      content: "The Dutch AP confirms receipt of the breach notification. They request a follow-up within 30 days with the full impact assessment and remediation steps taken.",
      urgency: "high", source: "Autoriteit Persoonsgegevens", senderName: "AP Case Manager", senderHandle: "ap.handhaving@autoriteitpersoonsgegevens.nl", timestamp: "17:31",
    },
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: "Legal: Settlement offer vs prosecution — decision needed",
      content: "Employment lawyer advises: settlement offer from J. Bakker's legal team received (€45k, NDA, mutual release). Alternative: full criminal prosecution will take 18–24 months. CEO and CFO must decide.",
      urgency: "high", source: "Legal Counsel", senderName: "Legal Counsel", timestamp: "17:48",
    },
    {
      id: id("inj"), type: "intel", channel: "raw",
      title: "CISO + HR joint debrief: How did this happen?",
      content: "CISO and HR Lead jointly facilitate a post-incident debrief. Key questions: why did DLP mark the alert as low-priority? Why did no access control limit the employee's cross-system access?",
      urgency: "medium", source: "CISO / HR Lead", senderName: "CISO & HR Lead", timestamp: "18:30",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Drive concrete decisions on the legal strategy (settlement vs prosecution), customer notification, and systemic access control improvements.",
    keyQuestions: ["Settle or prosecute? What are the trade-offs?", "Which customers need to be notified about their data?", "What access control changes prevent this happening again?", "Who takes ownership of the 30-day AP follow-up?"],
    hints: ["Settlement prevents a public court case but sends a message internally. Prosecution is slow and expensive.", "AP follow-up in 30 days — assign an owner now, or it will be missed."],
    expectedDecisions: ["CEO/CFO settle or prosecute decision", "Customer notification plan approved", "Systemic access control improvements committed", "AP follow-up owner assigned"],
    redFlags: ["CEO defers settlement/prosecution decision with no timeline", "Customer notification not discussed", "No systemic change identified — treated as a one-off"],
  }
  const roleActions = filterActions([
    { id: "ins-r4-a1", label: "Authorise settlement negotiation with employee", description: "CEO and CFO approve entering settlement discussions with J. Bakker's lawyer on the terms proposed.", allowedRoles: ["ceo", "cfo"], isRecommended: false, irPlanAligned: true, consequence: "Faster resolution; avoids public trial. Prevents full recovery of damages. Internal morale risk." },
    { id: "ins-r4-a2", label: "Proceed with criminal prosecution", description: "Legal refers the full case to the police and public prosecutor for criminal charges of IP theft and computer fraud.", allowedRoles: ["ceo", "legal"], irPlanAligned: true, consequence: "Sends a strong message; may deter future incidents. 18–24 month process. No guarantee of conviction." },
    { id: "ins-r4-a3", label: "Send customer breach notification letters", description: "Communications and Legal coordinate customer notification for all individuals whose PII was included in the exfiltrated data.", allowedRoles: ["head_of_comms", "legal"], isRecommended: true, irPlanAligned: true, consequence: "Required under GDPR Art. 34 if high risk to individuals. Transparency preserves trust." },
    { id: "ins-r4-a4", label: "Update insider threat detection procedures", description: "HR Lead and CISO commit to updated offboarding checklist, access revocation SLA, and DLP escalation policy effective next quarter.", allowedRoles: ["hr_lead", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Prevents recurrence. Makes the AP follow-up response credible." },
    { id: "ins-r4-do-nothing", label: "Defer all decisions to next board meeting", description: "Hold all final decisions until the board formally convenes in two weeks.", allowedRoles: [], irPlanAligned: false, consequence: "AP follow-up deadline and customer notification obligations will be missed." },
  ], sel)
  return { round_number: 4, title: "Resolution & Lessons Learned", situation_update: "It is 17:00. Forensics confirms competitor involvement. The AP has acknowledged the breach notification. A settlement offer is on the table. The board is waiting. Decisions on legal strategy, customer notification, and systemic improvements must be made today.", timerMinutes: 15, injects, facilitatorNotes, roleActions }
}

// ─── BUSINESS EMAIL COMPROMISE ─────────────────────────────────────────────────

function generateBEC(config: ExerciseConfig): Scenario {
  const sector = config.sector || "Organization"
  const size = config.companySize || "mid-market"
  const sel = config.selectedRoles

  return {
    scenario_title: `Business Email Compromise at ${sector} — Operation FALSE FLAG`,
    scenario_summary: `A ${size} ${sector.toLowerCase()} organisation is targeted in a sophisticated Business Email Compromise attack. The CEO's email account is impersonated to authorise a fraudulent wire transfer. The incident spans Finance, IT, Legal, and Communications.`,
    rounds: [
      becR1(sector, sel),
      becR2(sel),
      becR3(sector, sel),
      becR4(sel),
    ],
  }
}

function becR1(sector: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "executive", channel: "email",
      title: "'CEO' requests urgent wire transfer",
      content: "Finance Manager S. Hendriksen receives an email from 'CEO <ceo@" + sector.toLowerCase().replace(/\s+/g, "") + "-secure.nl>' requesting an urgent €185,000 wire transfer to a new vendor before end of business. The email cites a confidential acquisition deal and asks to keep it quiet.",
      urgency: "high", source: "Finance Inbox", senderName: "CEO (via email)", timestamp: "10:14",
    },
    {
      id: id("inj"), type: "technical", channel: "siem_alert",
      title: "IT: Email passed SPF/DKIM — slight domain mismatch",
      content: `The email technically passed SPF and DKIM checks on the sending domain. However, the domain is '${sector.toLowerCase().replace(/\s+/g, "")}-secure.nl', not the registered company domain. The difference is easy to miss at a glance.`,
      urgency: "medium", source: "Email Gateway", senderName: "Mail Security Filter", timestamp: "10:19",
    },
    {
      id: id("inj"), type: "intel", channel: "email",
      title: "OSINT: Vendor company registered 3 weeks ago",
      content: "Finance does a quick OSINT check: the vendor receiving the transfer was incorporated in Latvia 21 days ago. The company has no web presence or trading history.",
      urgency: "high", source: "Finance / OSINT", senderName: "Finance Manager", timestamp: "10:33",
    },
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: "Finance manager flags to CFO for approval",
      content: "S. Hendriksen forwards the request to the CFO with a note: 'CEO says urgent — confirming approval before I proceed? The vendor details look unusual to me.'",
      urgency: "high", source: "Finance", senderName: "Finance Manager", senderHandle: "s.hendriksen", timestamp: "10:41",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Test whether the team can recognise BEC indicators (domain spoofing, urgency, secrecy request) and whether financial controls require verbal confirmation before executing.",
    keyQuestions: ["Should verbal confirmation with the CEO be mandatory for all large transfers?", "Who in Finance has authority to approve a €185k transfer?", "What are the BEC red flags in this email?"],
    hints: ["The secrecy request is a major red flag. Legitimate deals don't require bypassing controls.", "Calling the CEO directly on a known number takes 2 minutes. It's always worth it."],
    expectedDecisions: ["Verbal verification with CEO before any action", "IT to investigate the email headers", "Transfer on hold pending investigation"],
    redFlags: ["CFO approves without verbal CEO confirmation", "Finance team prioritises urgency over verification", "No one checks the sender domain carefully"],
  }
  const roleActions = filterActions([
    { id: "bec-r1-a1", label: "Verify request directly with CEO by phone", description: "CFO or Finance Manager calls the CEO on a known, verified number — not the one in the email — to confirm before any action.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Confirms or disproves the request in under 2 minutes. Always the right first move." },
    { id: "bec-r1-a2", label: "Analyse email headers for domain spoofing", description: "IT reviews the full email headers to confirm whether the sender domain is a registered company domain or a lookalike.", allowedRoles: ["it_manager", "system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Confirms BEC attempt if domain is different. Preserves evidence." },
    { id: "bec-r1-a3", label: "Place the transfer request on hold", description: "Finance holds the transfer pending verification — no money moves until the request is confirmed via a secondary channel.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Prevents loss. The 'urgency' framing is a social engineering tactic — holding is always safe." },
    { id: "bec-r1-a4", label: "Process the transfer — CEO urgency justifies it", description: "Approve and execute the €185k wire transfer based on the email request.", allowedRoles: ["cfo"], irPlanAligned: false, consequence: "Sends €185,000 to a fraudulent account. Recovery is extremely difficult after SWIFT settlement." },
    { id: "bec-r1-do-nothing", label: "Escalate to CEO's EA to confirm without calling CEO", description: "Ask the CEO's executive assistant to verify the request on your behalf.", allowedRoles: [], irPlanAligned: true, consequence: "Reasonable if EA has direct access. Slower than a direct call but acceptable." },
  ], sel)
  return { round_number: 1, title: "Suspicious Transfer Request", situation_update: "It is 10:00. A Finance Manager has received what appears to be a CEO-authorised wire transfer request. The urgency framing and secrecy request are unusual. The CFO has been alerted. No transfer has been made yet.", timerMinutes: 15, injects, facilitatorNotes, roleActions }
}

function becR2(sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "alert", channel: "siem_alert",
      title: "IT: CEO email account compromised — 72-hour window",
      content: "IT investigation reveals the CEO's email account was compromised via a password spray attack 3 days ago. The attacker had read access to the inbox for 72 hours, including all ongoing deal discussions.",
      urgency: "critical", source: "IT Security", senderName: "IT Security Team", timestamp: "11:22",
    },
    {
      id: id("inj"), type: "executive", channel: "phone",
      title: "Bank: Transfer processed by another employee",
      content: "Finance Director receives a call from the bank: a junior Finance employee processed the €185k transfer an hour ago, believing it was pre-approved by the CFO. The bank can attempt a SWIFT recall but the window is approximately 2 hours.",
      urgency: "critical", source: "Bank Fraud Department", senderName: "ING Fraud Desk", senderHandle: "+31 20 888 0000", timestamp: "11:38",
    },
    {
      id: id("inj"), type: "technical", channel: "email",
      title: "IT: Two additional fraudulent transfer drafts found",
      content: "IT forensics of the compromised CEO inbox finds two additional unsent transfer requests in drafts: €92k and €340k to different shell companies. They were ready to send.",
      urgency: "high", source: "IT Forensics", senderName: "IT Security", timestamp: "11:51",
    },
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: "Finance: Junior employee in distress",
      content: "HR is informed that the junior Finance employee who processed the transfer is very distressed and fears dismissal. They say they believed the CFO had verbally approved it via a colleague.",
      urgency: "medium", source: "HR", senderName: "HR Lead", senderHandle: "hr-lead", timestamp: "12:04",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Force immediate bank intervention while simultaneously managing the IT compromise, a distressed employee, and the broader exposure of having an attacker with 72-hour inbox access.",
    keyQuestions: ["Who makes the call to the bank to initiate the recall?", "What else did the attacker read in 72 hours of inbox access?", "How do you handle the employee who processed the transfer?", "Is the CEO's account the only one compromised?"],
    hints: ["The 2-hour recall window is the most time-critical action. Everything else can wait 10 minutes.", "72 hours of inbox access means the attacker may know about pending deals, contracts, and personnel matters."],
    expectedDecisions: ["Bank recall initiated within 2-hour window", "CEO credentials reset and MFA enabled", "Forensic scope of inbox access determined", "HR manages employee situation with appropriate due process"],
    redFlags: ["CFO or Legal delays bank call for any reason", "CEO account not reset and MFA not enabled immediately", "Employee blamed before facts are established"],
  }
  const roleActions = filterActions([
    { id: "bec-r2-a1", label: "Initiate SWIFT recall with bank — immediately", description: "CFO calls the bank fraud department directly to initiate a SWIFT recall of the €185k transfer. 2-hour window is closing.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Partial or full recovery possible within the window. After settlement, funds are typically unrecoverable." },
    { id: "bec-r2-a2", label: "Reset CEO credentials and enable MFA", description: "IT immediately resets the CEO's password, revokes all active sessions, and enforces MFA on the account.", allowedRoles: ["it_manager", "system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Locks out the attacker. Essential before the CEO communicates anything from their account." },
    { id: "bec-r2-a3", label: "Notify cyber insurer and document the incident", description: "Legal contacts the cyber insurer to initiate a potential fraud claim and documents the incident timeline.", allowedRoles: ["legal", "cfo"], isRecommended: true, irPlanAligned: true, consequence: "Preserves insurance claim rights. Most policies require prompt notification." },
    { id: "bec-r2-a4", label: "HR: Conduct due process with Finance employee", description: "HR Lead ensures the junior Finance employee is treated fairly — fact-finding interview before any disciplinary consideration.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Protects the organisation legally; the employee may be a victim of a social engineering chain." },
    { id: "bec-r2-do-nothing", label: "Wait for IT forensics before involving the bank", description: "Hold bank notification until IT has completed its full forensic picture.", allowedRoles: [], irPlanAligned: false, consequence: "The recall window closes. €185,000 is unrecoverable. This is the single worst decision in this incident." },
  ], sel)
  return { round_number: 2, title: "Transfer Processed — Attacker Had Inbox Access", situation_update: "It is 11:00. The wire transfer has been processed. The bank has a 2-hour recall window. IT confirms the CEO's email was compromised for 72 hours. The attacker has read sensitive deal information. A second wave of fraudulent transfers was prepared but not yet sent.", timerMinutes: 20, injects, facilitatorNotes, roleActions }
}

function becR3(sector: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "executive", channel: "phone",
      title: "Bank: €42k recovered, €143k unrecoverable",
      content: "Bank confirms the SWIFT recall was partially successful. €42,000 was frozen before settlement. €143,000 has already been disbursed and moved through multiple jurisdictions. A criminal investigation has been opened by the bank.",
      urgency: "high", source: "Bank Fraud Department", senderName: "ING Fraud Desk", timestamp: "13:15",
    },
    {
      id: id("inj"), type: "regulatory", channel: "email",
      title: "Insurance: Fraud coverage assessment",
      content: "Cyber insurer confirms the policy has a BEC/fraud rider. Coverage of €143k loss is possible pending investigation. They require a full incident report within 48 hours and confirmation that dual-authorisation controls are now in place.",
      urgency: "high", source: "Cyber Insurer", senderName: "Claims Adjuster", senderHandle: "claims@insurer.nl", timestamp: "13:44",
    },
    {
      id: id("inj"), type: "media", channel: "email",
      title: "Financial journalist asks about 'fraud at company'",
      content: `A journalist from a financial outlet messages Communications: "We understand ${sector} has been the victim of a significant fraud. Can you confirm the amount lost and what controls failed?"`,
      urgency: "high", source: "Press", senderName: "Journalist — FD", timestamp: "14:02",
    },
    {
      id: id("inj"), type: "executive", channel: "email",
      title: "Board Chair: Written question on control failures",
      content: "The board chair sends a written request to the CEO asking for an explanation of how this was possible given existing financial controls, and what immediate remediation steps have been taken.",
      urgency: "high", source: "Board", senderName: "Board Chair", timestamp: "14:28",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Test the organisation's communications discipline, board accountability, and insurance claim coordination under external and governance pressure.",
    keyQuestions: ["What do you say to the journalist?", "Who briefs the board, and what do they say?", "Does the insurance requirement to show 'controls now in place' affect your public messaging?"],
    hints: ["The insurer requires proof of new controls within 48 hours. That deadline shapes what you can promise publicly.", "The board question about 'control failures' is not just about this incident — it's about governance."],
    expectedDecisions: ["Media holding statement approved", "Board briefing prepared", "Insurance claim documentation started", "Finance controls update committed"],
    redFlags: ["CEO avoids board question", "Comms issues statement before Legal reviews insurance implications", "No one takes ownership of the insurer's 48-hour deadline"],
  }
  const roleActions = filterActions([
    { id: "bec-r3-a1", label: "Brief board on financial exposure and immediate response", description: "CEO prepares a written board briefing covering: amount lost/recovered, root cause, immediate actions taken, and timeline for control improvements.", allowedRoles: ["ceo", "cfo"], isRecommended: true, irPlanAligned: true, consequence: "Discharges board duty. Protects CEO from governance challenge." },
    { id: "bec-r3-a2", label: "Submit insurance claim documentation", description: "Legal and CFO compile the incident timeline, forensic evidence, and loss documentation for the insurer's 48-hour requirement.", allowedRoles: ["legal", "cfo"], isRecommended: true, irPlanAligned: true, consequence: "Preserves the €143k claim. Missing the 48-hour window may invalidate coverage." },
    { id: "bec-r3-a3", label: "Issue media holding statement", description: "Communications issues a measured statement acknowledging an IT security incident and fraudulent transfer attempt, confirming funds recovery steps are underway.", allowedRoles: ["head_of_comms", "ceo"], isRecommended: true, irPlanAligned: true, consequence: "Controls narrative. Must not reference insurance claim details or specific control failures." },
    { id: "bec-r3-a4", label: "File police report for cyber fraud", description: "Legal files a formal police report for computer fraud and wire fraud to support both the criminal investigation and the insurance claim.", allowedRoles: ["legal", "ceo"], isRecommended: true, irPlanAligned: true, consequence: "Supports the bank's criminal investigation. Required for most insurance fraud claims." },
    { id: "bec-r3-do-nothing", label: "Hold all communications until legal review is complete", description: "Issue no statement and provide no information to board or press until the full legal picture is clear.", allowedRoles: [], irPlanAligned: false, consequence: "Board chair will escalate. Media will fill the silence. Insurer may interpret silence as non-cooperation." },
  ], sel)
  return { round_number: 3, title: "Recovery & External Pressure", situation_update: "It is 13:00. €143,000 is unrecoverable. The insurer has a 48-hour claim window. The board wants answers. A journalist is calling. Legal, Finance, and Communications all need to act — without contradicting each other.", timerMinutes: 20, injects, facilitatorNotes, roleActions }
}

function becR4(sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "technical", channel: "email",
      title: "IT Forensics: Scope of inbox access confirmed — no other accounts",
      content: "Full forensic review confirms only the CEO's email was compromised. No other accounts, systems, or data were accessed. The attacker's intent was limited to financial fraud. Report ready for insurer and police.",
      urgency: "high", source: "IT Forensics", senderName: "External Forensics Team", timestamp: "16:05",
    },
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: "Finance: Dual-authorisation proposal for CFO approval",
      content: "Finance Manager proposes: all wire transfers above €10,000 require dual authorisation (Finance Director + CFO) AND verbal confirmation via a registered phone number for amounts above €50,000. Implementation can start immediately.",
      urgency: "medium", source: "Finance Department", senderName: "Finance Manager", senderHandle: "s.hendriksen", timestamp: "16:32",
    },
    {
      id: id("inj"), type: "internal", channel: "email",
      title: "HR: Junior employee — recommendation on disciplinary action",
      content: "HR Lead completes the due-process interview. Finding: the employee was misled by a colleague who claimed verbal CFO approval. The control failure was systemic, not individual negligence. HR recommends no disciplinary action — mandatory retraining instead.",
      urgency: "medium", source: "HR Lead", senderName: "HR Lead", timestamp: "16:48",
    },
    {
      id: id("inj"), type: "intel", channel: "raw",
      title: "CISO debrief: What systemic gaps enabled this?",
      content: "CISO facilitates a debrief: no MFA on executive email accounts, no mandatory callback procedure for large transfers, no BEC training in the past 18 months. Each gap had a known owner who deprioritised it.",
      urgency: "medium", source: "CISO", senderName: "CISO", timestamp: "17:15",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Close the incident with concrete control improvements, fair treatment of the Finance employee, and a credible insurer/board response.",
    keyQuestions: ["CFO approves new dual-authorisation controls — what's the implementation timeline?", "Is the HR recommendation on the junior employee correct?", "What is the one thing that must change before next month?", "Who owns the insurer follow-up?"],
    hints: ["The three control gaps (no MFA, no callback, no training) each had an owner. That's a governance discussion, not just an IT discussion.", "The employee outcome sets a cultural signal about who is accountable for systemic failures."],
    expectedDecisions: ["CFO approves enhanced financial controls", "HR recommendation accepted or contested", "Insurer claim finalised", "CISO assigned to close the three identified gaps with deadlines"],
    redFlags: ["CFO defers controls decision", "Junior employee held responsible for systemic failure", "No one is assigned to close the identified gaps"],
  }
  const roleActions = filterActions([
    { id: "bec-r4-a1", label: "Approve enhanced financial controls", description: "CFO formally approves the dual-authorisation and callback procedure for wire transfers, effective immediately.", allowedRoles: ["cfo", "ceo"], isRecommended: true, irPlanAligned: true, consequence: "Directly addresses the root cause. Also satisfies the insurer's remediation requirement." },
    { id: "bec-r4-a2", label: "Implement MFA on all executive email accounts", description: "IT enables MFA across all C-suite and Finance email accounts as an emergency measure, with full rollout in 30 days.", allowedRoles: ["it_manager", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Closes the primary attack vector. Should have been standard already." },
    { id: "bec-r4-a3", label: "Accept HR recommendation: retraining not dismissal", description: "CEO and CFO accept HR's recommendation that the Finance employee receives mandatory retraining rather than disciplinary action, given systemic control failure.", allowedRoles: ["ceo", "hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Fair outcome given systemic gaps. Avoids wrongful dismissal risk. Sets the right cultural signal." },
    { id: "bec-r4-a4", label: "Complete insurer claim documentation", description: "Legal submits the full forensic report and control remediation plan to the insurer to finalise the €143k claim.", allowedRoles: ["legal", "cfo"], isRecommended: true, irPlanAligned: true, consequence: "Maximises claim recovery. Forensics confirms single-account compromise which strengthens the claim." },
    { id: "bec-r4-do-nothing", label: "Defer control improvements to next quarter's budget cycle", description: "Table the proposed controls for the next quarterly planning session.", allowedRoles: [], irPlanAligned: false, consequence: "Organisation remains exposed to the same attack. Insurer may challenge the claim if controls are delayed." },
  ], sel)
  return { round_number: 4, title: "Controls & Accountability", situation_update: "It is 16:00. Forensics confirms the breach was limited to the CEO's email. The insurer is processing the claim. HR has completed its review of the junior Finance employee. A clear set of control gaps has been identified. Decisions on controls, accountability, and the insurer's remediation requirement must be made today.", timerMinutes: 15, injects, facilitatorNotes, roleActions }
}

// ─── DATA EXFILTRATION (EXTERNAL) ──────────────────────────────────────────────

function generateDataExfil(config: ExerciseConfig): Scenario {
  const sector = config.sector || "Organization"
  const crown = config.crownJewels || "customer records and intellectual property"
  const systems = config.criticalSystems || "CRM, data warehouse, API"
  const size = config.companySize || "mid-market"
  const sel = config.selectedRoles

  return {
    scenario_title: `Data Exfiltration at ${sector} — Operation SILENT DRAIN`,
    scenario_summary: `A ${size} ${sector.toLowerCase()} organisation discovers that an APT actor has been silently exfiltrating ${crown} through a compromised API for weeks. The breach is only discovered when a client reports anomalous activity.`,
    rounds: [
      exfilR1(sector, systems, sel),
      exfilR2(crown, sel),
      ransomwareR3(sector, sel),
      ransomwareR4(sector, crown, sel),
    ],
  }
}

function exfilR1(sector: string, systems: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "executive", channel: "email",
      title: "Client reports anomalous data in competitor's hands",
      content: `A key enterprise client emails your account manager: 'We noticed that the proposal your competitor sent us last week contained details about our contract with you — details only you should know. This is very concerning.'`,
      urgency: "high", source: "Client Relations", senderName: "Client Account Manager", timestamp: "09:22",
    },
    {
      id: id("inj"), type: "technical", channel: "siem_alert",
      title: `API Gateway: Unusual query volumes on ${systems.split(",")[0]}`,
      content: `SIEM flags a service account performing bulk data queries on the ${systems.split(",")[0]} API — 40,000 records in 3 days, far exceeding normal usage patterns. The account belongs to an integration that was set up 6 weeks ago.`,
      urgency: "high", source: "API Gateway / SIEM", senderName: "SOC Analyst", timestamp: "09:41",
    },
    {
      id: id("inj"), type: "intel", channel: "email",
      title: "CERT-NL advisory: Active APT campaign in your sector",
      content: `CERT-NL issues an advisory: a state-linked threat actor is actively targeting ${sector.toLowerCase()} organisations via compromised API service accounts and OAuth token theft. TTPs match what IT is observing.`,
      urgency: "high", source: "CERT-NL", senderName: "CERT-NL Threat Intelligence", senderHandle: "info@ncsc.nl", timestamp: "10:03",
    },
    {
      id: id("inj"), type: "internal", channel: "slack",
      title: "IT: The integration was installed by a third-party vendor",
      content: `The service account in question belongs to a third-party analytics vendor integrated 6 weeks ago. The vendor's OAuth token may have been stolen. The vendor is based outside the EU.`,
      urgency: "medium", source: "IT Operations", senderName: "IT Ops Lead", senderHandle: "it-ops", timestamp: "10:28",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Establish the scope of potential exfiltration and whether this is an ongoing breach — before deciding on containment vs monitoring.",
    keyQuestions: ["Is the breach still ongoing, or has the data already left?", "Do you immediately revoke the vendor's API access or monitor first?", "Who needs to know about the client complaint?", "What is your supplier notification obligation?"],
    hints: ["Revoking API access immediately may alert the attacker. Monitoring longer means more data leaves.", "The client complaint is the most legally sensitive element — it implies they may have liability claims."],
    expectedDecisions: ["Scope the exfiltration: how much, how long", "Decision on revoke vs monitor", "Legal: client notification obligation assessment", "Vendor contacted"],
    redFlags: ["IT revokes access without scoping how much data left first", "No one connects the client complaint to the API anomaly", "Vendor not contacted or GDPR processor agreement not checked"],
  }
  const roleActions = filterActions([
    { id: "exf-r1-a1", label: "Scope the exfiltration before acting", description: "IT forensics conducts a rapid query analysis to determine how many records were accessed, what data types, and over what period — before revoking access.", allowedRoles: ["it_manager", "system_admin", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Informs the response. Essential for GDPR notification (you need to know what was taken)." },
    { id: "exf-r1-a2", label: "Revoke vendor API credentials immediately", description: "IT immediately revokes the third-party vendor's OAuth token and API access.", allowedRoles: ["it_manager", "system_admin"], irPlanAligned: true, consequence: "Stops ongoing exfiltration but may alert the attacker. Should follow, not precede, scoping." },
    { id: "exf-r1-a3", label: "Legal: Assess client notification obligations", description: "Legal reviews the contract and GDPR processor agreements to determine what notification obligations exist towards the affected client.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Client has already raised the issue. Proactive notification is legally and commercially better than silence." },
    { id: "exf-r1-a4", label: "Contact the analytics vendor directly", description: "CISO or IT calls the third-party analytics vendor to investigate whether their systems were compromised.", allowedRoles: ["ciso", "it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Vendor may have broader intelligence on the attack. Also a contractual obligation under GDPR processor agreements." },
    { id: "exf-r1-do-nothing", label: "Wait for CERT-NL to issue further guidance", description: "Hold all internal actions and await the next CERT-NL advisory update.", allowedRoles: [], irPlanAligned: false, consequence: "Exfiltration continues. Client notification window closes. Passive response in an active breach." },
  ], sel)
  return { round_number: 1, title: "Silent Breach Discovered", situation_update: "It is 09:00. A client complaint and an anomalous API alert are pointing at an ongoing, silent data exfiltration through a third-party integration. The breach may have been active for six weeks. Nothing is confirmed yet — but the clock is running.", timerMinutes: 15, injects, facilitatorNotes, roleActions }
}

function exfilR2(crown: string, sel?: Role[]): Round {
  const injects: Inject[] = [
    {
      id: id("inj"), type: "technical", channel: "email",
      title: "Forensics: 340,000 customer records exfiltrated over 6 weeks",
      content: `IT forensics confirms: 340,000 customer records — including names, contact details, and ${crown} — were systematically exported via the compromised API over 43 days. The exfiltration is now stopped. Data integrity of remaining systems confirmed.`,
      urgency: "critical", source: "IT Forensics", senderName: "Forensic Lead", timestamp: "11:18",
    },
    {
      id: id("inj"), type: "regulatory", channel: "email",
      title: "Legal: GDPR Art. 33 — 72-hour clock running",
      content: "Legal confirms: 340,000 affected individuals triggers mandatory AP notification under GDPR Art. 33. The 72-hour clock started when IT first detected the anomaly at 09:41 yesterday. You have 61 hours remaining.",
      urgency: "critical", source: "Legal Counsel", senderName: "Legal Counsel", timestamp: "11:34",
    },
    {
      id: id("inj"), type: "executive", channel: "whatsapp",
      title: "Affected client demands briefing today",
      content: "The client who originally flagged the anomaly calls your CEO directly: 'Our legal team believes you have an obligation to notify us formally of the breach. We want a written statement by end of business today.'",
      urgency: "critical", source: "Client", senderName: "Client CEO (direct call)", timestamp: "11:52",
    },
    {
      id: id("inj"), type: "intel", channel: "raw",
      title: "Vendor confirms: their systems were compromised",
      content: "The analytics vendor admits their OAuth token management system was compromised by a credential stuffing attack. They are informing all affected clients. Their own GDPR notification is being prepared. They have cyber insurance.",
      urgency: "high", source: "Analytics Vendor", senderName: "Vendor CISO", timestamp: "12:10",
    },
  ]
  const facilitatorNotes: FacilitatorNotes = {
    discussionGoal: "Manage simultaneous obligations: AP notification, client notification, vendor coordination, and potential reputational damage — all under a 61-hour regulatory clock.",
    keyQuestions: ["Who files the AP notification, and what must it contain at the 24-hour mark?", "What do you tell the affected client today?", "How does the vendor's own breach notification affect your obligation?", "Is there an Art. 34 individual notification obligation?"],
    hints: ["GDPR Art. 33 requires notification to the AP. Art. 34 requires notification to individuals if there is high risk. These are separate obligations.", "The vendor's breach does not remove your obligation — you are the data controller."],
    expectedDecisions: ["AP notification filed or on track within 72 hours", "Client formal notification letter approved", "Vendor GDPR coordination agreed", "Individual notification scope assessed (Art. 34)"],
    redFlags: ["No one tracks the 72-hour clock explicitly", "Team conflates vendor notification with their own obligation", "Client notification blocked by marketing or legal hesitation"],
  }
  const roleActions = filterActions([
    { id: "exf-r2-a1", label: "File AP Art. 33 notification within 72 hours", description: "Legal drafts and files the mandatory GDPR Art. 33 notification to the AP, covering: nature of breach, categories of data, approximate number of individuals, likely consequences, and measures taken.", allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "Legal requirement. Failure to notify on time significantly increases fine risk under GDPR." },
    { id: "exf-r2-a2", label: "Send formal written notification to affected client", description: "Legal and Communications prepare a formal written breach notification to the client who flagged the issue, per contractual and GDPR processor obligations.", allowedRoles: ["legal", "head_of_comms", "ceo"], isRecommended: true, irPlanAligned: true, consequence: "Proactive notification is legally required and commercially prudent. The client already suspects the breach." },
    { id: "exf-r2-a3", label: "Assess Art. 34 individual notification obligation", description: "Legal assesses whether the 340,000 affected individuals must be notified directly under GDPR Art. 34 based on the risk to their rights and freedoms.", allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true, consequence: "If high risk is assessed, Art. 34 notification is mandatory. Must be factored into the AP notification." },
    { id: "exf-r2-a4", label: "Coordinate with vendor on joint AP notification", description: "CISO and Legal coordinate with the vendor to ensure AP notifications are consistent and do not contradict each other.", allowedRoles: ["ciso", "legal"], isRecommended: true, irPlanAligned: true, consequence: "Prevents contradictory regulatory submissions. Vendor is a GDPR processor — coordination is expected." },
    { id: "exf-r2-do-nothing", label: "Wait for vendor to file first and follow their lead", description: "Hold your own AP notification until the vendor's notification is submitted and reviewed.", allowedRoles: [], irPlanAligned: false, consequence: "You are the data controller. The vendor's notification does not substitute yours. Clock continues." },
  ], sel)
  return { round_number: 2, title: "Breach Confirmed — Regulatory Clock Running", situation_update: "It is 11:00. 340,000 customer records were systematically exfiltrated. The GDPR 72-hour AP notification clock has 61 hours remaining. An affected client is demanding a formal response today. The vendor has confirmed their own compromise.", timerMinutes: 20, injects, facilitatorNotes, roleActions }
}
