import type { ExerciseConfig, Scenario, Round, Inject, FacilitatorNotes, RoleAction, Role, LearningObjective } from "./types"
import { ROLE_FALLBACK } from "./types"

let counter = 0
function id(prefix: string) {
  counter++
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

function filterActions(actions: RoleAction[], selectedRoles?: Role[]): RoleAction[] {
  if (!selectedRoles?.length) return actions
  const active = new Set(selectedRoles)
  return actions
    .map(action => {
      if (action.allowedRoles.length === 0) return action
      const kept = action.allowedRoles.filter(r => active.has(r))
      if (kept.length > 0) return { ...action, allowedRoles: kept }
      const remapped = [...new Set(
        action.allowedRoles.flatMap(r =>
          (ROLE_FALLBACK[r] ?? []).filter(fb => active.has(fb))
        )
      )]
      return { ...action, allowedRoles: remapped.length > 0 ? remapped : [] }
    })
    .filter(action =>
      action.allowedRoles.length === 0 ||
      action.allowedRoles.some(r => active.has(r))
    )
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
    // IT Manager
    { id: "gen-r1-itm-1", label: "Isoleer endpoints en escaleer naar CISO", description: "Naar aanleiding van de SIEM-melding: isoleer de gemarkeerde endpoints van het netwerk en open een formeel incidentticket bij de CISO.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Beperkt verspreiding en start de formele responsketting. Tijdelijke uitval voor betrokken gebruikers." },
    { id: "gen-r1-itm-2", label: "Monitor en log — nog geen isolatie", description: "Blijf de endpoints in de gaten houden en verzamel meer bewijs vóór je isoleert.", allowedRoles: ["it_manager"], isRecommended: false, irPlanAligned: false, consequence: "Aanvaller blijft actief terwijl je wacht. Meer bewijs, maar ook meer schade." },
    // System Admin
    { id: "gen-r1-sa-1", label: "Forensische logs veiligstellen vóór isolatie", description: "Naar aanleiding van de DLP-melding: zet een forensische kopie van alle relevante logs apart en controleer de back-upstatus.", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Bewijsketen gewaarborgd; essentieel voor forensisch onderzoek." },
    { id: "gen-r1-sa-2", label: "Wachtwoorden resetten van getroffen accounts", description: "Reset de wachtwoorden van de vergrendelde accounts direct en heractiveer de gebruikers.", allowedRoles: ["system_admin"], isRecommended: false, irPlanAligned: false, consequence: "Gebruikers zijn snel actief, maar aanvaller kan dezelfde credentials opnieuw stelen als de vector niet gesloten is." },
    // CISO
    { id: "gen-r1-ciso-1", label: "Crisisoverleg openen en IR-retainer activeren", description: "Naar aanleiding van het signalenpatroon: roep de crisiskerngroep bijeen en activeer de externe IR-retainer.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Coördineert de respons en brengt forensische capaciteit in. Formele respons start direct." },
    { id: "gen-r1-ciso-2", label: "Wachten op meer bewijs vóór formele escalatie", description: "Houd de situatie in de gaten en escaleer pas als er meer harde bewijzen zijn.", allowedRoles: ["ciso"], isRecommended: false, irPlanAligned: false, consequence: "Aanvaller wint tijd. Passief bij al-duidelijke signalen vergroot de schade." },
    // CEO
    { id: "gen-r1-ceo-1", label: "Board direct informeren vóór feiten vaststaan", description: "Stuur nu een melding naar de board dat er een mogelijke aanval gaande is.", allowedRoles: ["ceo"], isRecommended: false, irPlanAligned: false, consequence: "Veroorzaakt paniek vóór de scope bekend is. Creëert reputatiedruk zonder actieplan." },
    // Universal
    { id: "gen-r1-do-nothing", label: "Wacht af — meer informatie nodig", description: "Neem nog geen actie; wacht tot het beeld duidelijker is.", allowedRoles: [], isRecommended: false, irPlanAligned: true, consequence: "Kan juist zijn bij onduidelijke signalen; riskant als detectie al helder is." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-r1-1", description: "Team escaleert incident naar CISO en opent crisisoverleg", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["gen-r1-ciso-1", "gen-r1-itm-1"], achieved: false },
    { id: "obj-r1-2", description: "Formeel incident gedeclareert en logbewijs veiliggesteld", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["gen-r1-itm-1", "gen-r1-sa-1"], achieved: false },
  ]
  return { round_number: 1, title: "Initial Detection", situation_update: "It is 09:00. Overnight monitoring has produced low- and medium-severity alerts. Nothing critical has tripped, but the pattern is unusual. The on-call analyst has paged the incident commander.", timerMinutes: 15, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // IT Manager
    { id: "gen-r2-itm-1", label: "Gecompromitteerd admin-account uitschakelen", description: "Schakel het gecompromitteerde Domain Admin-account direct uit om de actieve aanvallersessie te beëindigen.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Verbreekt de aanvallerszugriffsweg; aanvaller wordt mogelijk gewaarschuwd van detectie." },
    { id: "gen-r2-itm-2", label: "Failover naar DR starten zonder besmettingscheck", description: "Start direct de failover naar het DR-systeem om downtime te beperken.", allowedRoles: ["it_manager"], isRecommended: false, irPlanAligned: false, consequence: "Risico op infectie van het DR-systeem als dat ook al gecompromitteerd is." },
    // System Admin
    { id: "gen-r2-sa-1", label: "Getroffen bestandsservers isoleren van het netwerk", description: "Isoleer de bestandsservers met actieve encryptie-activiteit onmiddellijk van het netwerk.", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Stopt verdere encryptie. Vereist gecoördineerde downtime met IT Manager." },
    { id: "gen-r2-sa-2", label: "Actieve encryptiesessie monitoren zonder onderbreking", description: "Observeer het encryptieproces in real time voor forensische waarde, zonder het te stoppen.", allowedRoles: ["system_admin"], isRecommended: false, irPlanAligned: false, consequence: "Meer forensische informatie, maar meer bestanden versleuteld per minuut monitoring." },
    // CISO
    { id: "gen-r2-ciso-1", label: "CEO briefen met feitelijke statusupdate", description: "Naar aanleiding van de CEO-vraag: geef een gestructureerde, feitelijke briefing met wat wel en niet bekend is.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Stuurt verwachtingen bij en stelt geautoriseerde escalatie veilig." },
    { id: "gen-r2-ciso-2", label: "Externe IR-retainer formeel inschakelen", description: "Contacteer en activeer de externe IR-retainer voor forensische en technische ondersteuning.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Brengt specialistische capaciteit in. Essentieel als interne capaciteit beperkt is." },
    // CFO
    { id: "gen-r2-cfo-1", label: "Cyber-verzekeraar notificeren en polis activeren", description: "Contacteer de cyber-verzekeraar om de claimprocedure te starten en dekkingsrichtlijnen te verkrijgen.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Behoudt dekkingsrecht; sommige polissen vereisen melding binnen uren." },
    { id: "gen-r2-cfo-2", label: "Losgeldbedrag reserveren zonder overleg", description: "Reserveer alvast een budget voor een eventuele losgelduitbetaling.", allowedRoles: ["cfo"], isRecommended: false, irPlanAligned: false, consequence: "Premature actie zonder context over hersteloptie via backups. Signaleert betalingsbereidheid prematuur." },
    // Legal
    { id: "gen-r2-leg-1", label: "NIS2/GDPR-meldingstijdlijn activeren", description: "Registreer het tijdstip van eerste kennisname en start formeel de 72-uursklok voor de verplichte melding.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Borgt compliance; gemiste meldingsdeadline leidt tot aanzienlijke boetes." },
    // Universal
    { id: "gen-r2-do-nothing", label: "Wachten op IR-retainer vóór elke actie", description: "Houd alle besluiten aan totdat de externe IR-firma online is.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "Encryptie gaat door terwijl je wacht. Waardevolle responstijd gaat verloren." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-r2-1", description: "Gecompromitteerd admin-account uitgeschakeld en IR-retainer ingeschakeld", module: "triage_containment", measuredBy: "decision", triggerActionIds: ["gen-r2-itm-1", "gen-r2-ciso-2"], achieved: false },
    { id: "obj-r2-2", description: "CEO geïnformeerd met feitelijke briefing", module: "triage_containment", measuredBy: "decision", triggerActionIds: ["gen-r2-ciso-1"], achieved: false },
  ]
  return { round_number: 2, title: "Containment & Investigation", situation_update: "It is 10:30. The picture is sharpening: this is not noise. Decisions about isolation, communication, and authority must be made under pressure, with incomplete information.", timerMinutes: 20, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // Head of Comms
    { id: "gen-r3-hoc-1", label: "Holding statement opstellen voor persverzoeken", description: "Naar aanleiding van de journalistenvraag: stel een goedgekeurd holding statement op dat de situatie erkent zonder bevestiging van details.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Behoudt controle over het narratief. Moet goedgekeurd zijn door CEO en Legal." },
    { id: "gen-r3-hoc-2", label: "Volledige breach-details bevestigen aan pers", description: "Bevestig de omvang van het incident met specifieke details aan de journalist.", allowedRoles: ["head_of_comms"], isRecommended: false, irPlanAligned: false, consequence: "Juridische en reputatieschade. Onbevestigde details mogen niet publiek worden gemaakt." },
    // Legal
    { id: "gen-r3-leg-1", label: "NIS2-meldingstijdlijn en 72u-deadline bewaken", description: "Naar aanleiding van de regulatoire enquête: zorg dat de melding op schema staat en documenteer het tijdstip van eerste kennisname.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Compliance geborgd; gemiste deadline leidt tot aansprakelijkheid." },
    { id: "gen-r3-leg-2", label: "Alle externe communicatie blokkeren tot rechtsbijstand klaar is", description: "Verbied elke externe communicatie totdat de juridisch adviseur alle uitingen heeft gereviewd.", allowedRoles: ["legal"], isRecommended: false, irPlanAligned: false, consequence: "Regulatoire klok loopt door; journalist publiceert zonder uw input." },
    // CFO
    { id: "gen-r3-cfo-1", label: "Financiële analyse losgeld vs herstelkosten presenteren", description: "Stel een kosten-baten analyse op voor de CEO: losgeld vs. herstelkosten via backups, met verzekeringscontext.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Geeft de CEO een zakelijke basis voor de zichtbaarste beslissing van het incident." },
    { id: "gen-r3-cfo-2", label: "Losgeld direct goedkeuren zonder boardconsultatie", description: "Autoriseer de losgelduitbetaling onmiddellijk op basis van de urgentie.", allowedRoles: ["cfo"], isRecommended: false, irPlanAligned: false, consequence: "Financieel en juridisch riskant; geen garantie op decryptie. Board moet geconsulteerd worden." },
    // CEO
    { id: "gen-r3-ceo-1", label: "Ransom-onderhandelingspositie vaststellen met board", description: "Bepaal samen met de board de positie ten aanzien van losgeld vóór enige onderhandeling.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Legitimeert de beslissing en beperkt persoonlijke aansprakelijkheid." },
    { id: "gen-r3-ceo-2", label: "Losgeld betalen zonder board of legal", description: "Autoriseer de betaling direct op eigen gezag zonder board- of juridisch advies.", allowedRoles: ["ceo"], isRecommended: false, irPlanAligned: false, consequence: "Bestuursrechtelijk riskant. ~20% van betaalde slachtoffers krijgt data niet terug." },
    // Universal
    { id: "gen-r3-do-nothing", label: "Volledige stilte handhaven op alle fronten", description: "Geef geen verklaring af en onderneem geen regulatoire actie in afwachting van meer informatie.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "Regulatoire klok loopt door; media vult het stilzwijgen in." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-r3-1", description: "Holding statement goedgekeurd en NIS2-melding in gang gezet", module: "crisis_communication", measuredBy: "decision", triggerActionIds: ["gen-r3-hoc-1", "gen-r3-leg-1"], achieved: false },
    { id: "obj-r3-2", description: "Ransomware-onderhandelingspositie bepaald voor CEO", module: "crisis_communication", measuredBy: "decision", triggerActionIds: ["gen-r3-cfo-1", "gen-r3-ceo-1"], achieved: false },
  ]
  return { round_number: 3, title: "Escalation & Public Pressure", situation_update: "It is 14:00. The incident is no longer contained to IT. Communications, Legal, and the executive team are now fully engaged. External pressure is mounting.", timerMinutes: 20, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // IT Manager
    { id: "gen-r4-itm-1", label: "Herstel vanuit schone backups autoriseren", description: "Autoriseer formeel het herstel van de bevestigde schone backups en publiceer de herstelplanning.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Start de 18-24u herstelperiode. Veilig als de initiële aanvalsvector bevestigd gesloten is." },
    { id: "gen-r4-itm-2", label: "Alle systemen direct online zonder rootcause-verificatie", description: "Herstel alle systemen onmiddellijk om de downtime te beperken vóór de oorzaak bevestigd is.", allowedRoles: ["it_manager"], isRecommended: false, irPlanAligned: false, consequence: "Risico op herinfectie als de initiële aanvalsvector nog open is." },
    // Legal
    { id: "gen-r4-leg-1", label: "NIS2/GDPR-notificatie indienen bij toezichthouder", description: "Dien de verplichte melding in bij de bevoegde autoriteit binnen de 72u-termijn.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Wettelijk vereist. Na de deadline zijn boetes onvermijdelijk." },
    { id: "gen-r4-leg-2", label: "Notificatie uitstellen tot advocaat volledig gereed is", description: "Houd de toezichthoudermelding aan tot alle juridische details zijn doorgevoerd.", allowedRoles: ["legal"], isRecommended: false, irPlanAligned: false, consequence: "Deadline overschreden; significant boeterisico." },
    // Head of Comms
    { id: "gen-r4-hoc-1", label: "Klant-breachnotificatie verzenden per GDPR Art.34", description: "Stuur de verplichte breachnotificatie naar betrokken klanten conform de GDPR Art.34-eisen.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Wettelijk vereist bij hoog risico voor betrokkenen. Transparantie versterkt het vertrouwen." },
    { id: "gen-r4-hoc-2", label: "Klantnotificatie afzwakken zonder juridische toetsing", description: "Verstuur een verzachte versie van de klantnotificatie om reputatieschade te beperken.", allowedRoles: ["head_of_comms"], isRecommended: false, irPlanAligned: false, consequence: "Kan juridisch onvoldoende zijn en klanten misleiden. Vergroot aansprakelijkheidsrisico." },
    // CEO
    { id: "gen-r4-ceo-1", label: "Definitieve losgeld-positie bepalen met board", description: "Leg de board de keuze voor — betalen of niet — met de bekende backup-hersteloptie als alternatief.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Borgt governance en beperkt persoonlijke aansprakelijkheid." },
    // Universal
    { id: "gen-r4-do-nothing", label: "Alle besluiten uitstellen tot juridisch advies gereed is", description: "Houd alle herstel- en notificatiebeslissingen aan totdat Legal de positie bevestigt.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "Vertraagt herstel en overschrijdt mogelijk notificatiedeadlines." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-r4-1", description: "Herstel vanuit schone backup geautoriseerd", module: "recovery_lessons", measuredBy: "decision", triggerActionIds: ["gen-r4-itm-1"], achieved: false },
    { id: "obj-r4-2", description: "Klantnotificatie en NIS2-melding ingediend", module: "recovery_lessons", measuredBy: "decision", triggerActionIds: ["gen-r4-leg-1", "gen-r4-hoc-1"], achieved: false },
  ]
  return { round_number: 4, title: "Recovery & Communications", situation_update: "It is 18:30. The acute phase is winding down. Strategic decisions about payment, recovery sequencing, customer notification, and post-incident learning now define how the organisation comes out of this.", timerMinutes: 15, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // HR Lead
    { id: "ins-r1-hrl-1", label: "Legal raadplegen vóór enige onderzoeksstap", description: "Naar aanleiding van het DLP-signaal: schakel Legal in om het juridische kader van het onderzoek te bepalen vóór HR of IT actie onderneemt.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Beschermt de organisatie juridisch; zorgt dat bewijs op toelaatbare wijze wordt verzameld." },
    { id: "ins-r1-hrl-2", label: "Vertrouwelijk gesprek met de direct leidinggevende", description: "HR voert een vertrouwelijk gesprek met teamleider M. Jansen om gedragscontext te verzamelen, zonder de medewerker te alarmeren.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Verzamelt context; leidinggevende kan signaleren als medewerker plotseling vertrekt." },
    { id: "ins-r1-hrl-3", label: "Medewerker direct confronteren met de beschuldiging", description: "Roep J. Bakker direct naar een gesprek en vraag naar de datatransfers.", allowedRoles: ["hr_lead"], isRecommended: false, irPlanAligned: false, consequence: "Vernietigt bewijs, geeft juridisch voordeel aan de medewerker en kan tot verdere exfiltratie leiden." },
    // IT Manager
    { id: "ins-r1-itm-1", label: "Alle relevante logs veiligstellen zonder account aan te raken", description: "IT bewaart alle relevante logs, e-mail en toegangsregistraties voor forensisch gebruik, zonder de actieve account te deactiveren.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Borgt de bewijsketen; essentieel vóór elke confrontatie." },
    { id: "ins-r1-itm-2", label: "Account J. Bakker direct intrekken", description: "Deactiveer onmiddellijk de toegangsrechten van J. Bakker.", allowedRoles: ["it_manager"], isRecommended: false, irPlanAligned: false, consequence: "Vernietigt bewijs, maakt juridische positie kwetsbaar en waarschuwt de medewerker." },
    // System Admin
    { id: "ins-r1-sa-1", label: "Stille real-time monitoring instellen op het account", description: "Configureer stille monitoring op het account van J. Bakker om verdere activiteit in real time te volgen.", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Verzamelt meer bewijs; vereist juridische toestemming voor werknemersmonitoring in NL." },
    // CISO
    { id: "ins-r1-ciso-1", label: "Legal formeel betrekken bij insider threat-onderzoek", description: "Escaleert de zaak naar Legal om de juridische kaders en bevoegdheden voor een insider threat-onderzoek te bepalen.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Garandeert dat het onderzoek juridisch toelaatbaar is en bewijs geldig blijft." },
    // Universal
    { id: "ins-r1-do-nothing", label: "Passief blijven monitoren vóór escalatie", description: "Laat de medewerker zijn activiteit voortzetten terwijl IT in real time monitort.", allowedRoles: [], isRecommended: false, irPlanAligned: true, consequence: "Geeft onderzoekstijd maar vergroot het risico op verdere exfiltratie per dag." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-ins-r1-1", description: "Legal betrokken vóór investigatiestappen", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["ins-r1-hrl-1", "ins-r1-ciso-1"], achieved: false },
    { id: "obj-ins-r1-2", description: "Digitaal bewijs veiliggesteld zonder medewerker te alarmeren", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["ins-r1-itm-1", "ins-r1-sa-1"], achieved: false },
  ]
  return { round_number: 1, title: "Suspicious Activity Detected", situation_update: "It is 09:00. A cluster of signals — some behavioural, some technical — are pointing at a single employee. Nothing is confirmed yet. The investigation must be handled carefully to preserve evidence and stay within employment law.", timerMinutes: 15, injects: slicedInjects, facilitatorNotes, roleActions, learningObjectives }
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
    // HR Lead
    { id: "ins-r2-hrl-1", label: "Medewerker op non-actief stellen met Legal-akkoord", description: "HR plaatst J. Bakker formeel op betaald non-actief na schriftelijk akkoord van Legal — met directe ingang.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Stopt de actieve exfiltratie en is juridisch verdedigbaar. Vereist formele schriftelijke kennisgeving." },
    { id: "ins-r2-hrl-2", label: "Hoor-en-wederhoor-gesprek voorbereiden", description: "HR bereidt het verplichte onderzoeksinterview (hoor en wederhoor) voor, vóór enige disciplinaire maatregel.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Wettelijk vereist (NL arbeidsrecht). Versterkt het ontslagdossier als correct uitgevoerd." },
    // Legal
    { id: "ins-r2-leg-1", label: "Non-actiefstelling juridisch autoriseren", description: "Legal geeft formeel akkoord op de non-actiefstelling en begeleidt de procedure conform NL arbeidsrecht.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Juridisch vereist. Voorkomt onrechtmatig ontslag en bewijs-contaminatie." },
    { id: "ins-r2-leg-2", label: "Politie direct inschakelen vóór non-actiefstelling", description: "Doe aangifte bij de politie voor computercriminaliteit en IP-diefstal vóór de medewerker op non-actief te stellen.", allowedRoles: ["legal"], isRecommended: false, irPlanAligned: true, consequence: "Juridisch mogelijk maar kan het arbeidsrechtelijke traject compliceren. Timing is cruciaal." },
    // IT Manager
    { id: "ins-r2-itm-1", label: "Systeemtoegang intrekken gelijktijdig met non-actiefstelling", description: "IT trekt SSO, e-mail, VPN en bestandsservertoegang van J. Bakker in, gesynchroniseerd met de non-actiefkennisgeving.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Stopt verdere datatransfer. Moet gelijktijdig met de kennisgeving plaatsvinden." },
    // System Admin
    { id: "ins-r2-sa-1", label: "Actieve ERP-sessie J. Bakker direct beëindigen", description: "Beëindig de actieve ERP-sessie van J. Bakker nu al, terwijl hij bezig is met het openen van contractbestanden.", allowedRoles: ["system_admin"], isRecommended: false, irPlanAligned: false, consequence: "Stopt directe schade maar geeft de medewerker het signaal dat hij gevolgd wordt, zonder formeel proces." },
    // CEO
    { id: "ins-r2-ceo-1", label: "Board informeren over insider threat-situatie", description: "Brief de board over de bevestigde exfiltratie en de stappen die worden ondernomen, inclusief juridische positie.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Zorgplicht richting board; beschermt CEO bij volgende boardvergadering." },
    // Universal
    { id: "ins-r2-do-nothing", label: "Nog 24 uur wachten om dossier verder op te bouwen", description: "Houd alle actie aan voor nog 24 uur om meer bewijs te verzamelen.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "De concurrent-afspraak van morgen maakt dit zeer riskant — data kan het land verlaten." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-ins-r2-1", description: "Medewerker op non-actief met Legal-akkoord", module: "insider_investigation", measuredBy: "decision", triggerActionIds: ["ins-r2-hrl-1"], achieved: false },
    { id: "obj-ins-r2-2", description: "Systeemtoegang ingetrokken gelijktijdig met non-actiefstelling", module: "insider_investigation", measuredBy: "decision", triggerActionIds: ["ins-r2-itm-1"], achieved: false },
  ]
  return { round_number: 2, title: "Confirmed Exfiltration", situation_update: "It is 11:00. Forensics has confirmed systematic, intentional exfiltration. The employee is currently in the building and actively accessing files. Legal is advising caution. A decision on administrative leave must be made now — or the window closes.", timerMinutes: 20, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // Legal
    { id: "ins-r3-leg-1", label: "Klokkenluidersclaim juridisch beoordelen vóór verdere actie", description: "Legal beoordeelt of de beschermde melding geldig is en wat de implicaties zijn voor het disciplinaire en strafrechtelijke traject.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Voorkomt aansprakelijkheid voor onrechtmatig ontslag; bepaalt of twee parallelle trajecten mogelijk zijn." },
    { id: "ins-r3-leg-2", label: "AP-breachmelding opstellen en indienen", description: "Legal stelt de GDPR Art.33-melding op en dient deze in bij de AP binnen het 72u-venster.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Wettelijk vereist. Gemiste deadline leidt tot significante boetes." },
    { id: "ins-r3-leg-3", label: "Klokkenluidersclaim negeren en ontslag doorzetten", description: "Zet het ontslagtraject door ondanks de klokkenluidersclaim.", allowedRoles: ["legal"], isRecommended: false, irPlanAligned: false, consequence: "Hoog risico op onrechtmatig ontslagclaim en aanvullende arbeidsrechtelijke procedures." },
    // Head of Comms
    { id: "ins-r3-hoc-1", label: "Holding statement voor pers opstellen over interne HR-kwestie", description: "Communications stelt een gedoseerde verklaring op die een interne HR-kwestie erkent zonder details of strafrechtelijke beschuldigingen te bevestigen.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Beheerst het narratief; mag de medewerker niet veroordelen tijdens lopend onderzoek." },
    { id: "ins-r3-hoc-2", label: "Journalist ontkennen dat er enig incident is", description: "Ontken ieder incident tegenover de journalist.", allowedRoles: ["head_of_comms"], isRecommended: false, irPlanAligned: false, consequence: "Als de journalist al informatie heeft, beschadigt ontkenning de geloofwaardigheid ernstig." },
    // CEO
    { id: "ins-r3-ceo-1", label: "Board formeel briefen over incidentomvang en respons", description: "CEO informeert de board schriftelijk over de omvang van het incident, de juridische blootstelling en de genomen stappen.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Zorgplicht board; beschermt CEO bij volgende boardvergadering." },
    // CISO
    { id: "ins-r3-ciso-1", label: "Systemen controleren op aanvullende exfiltratie-activiteit", description: "CISO laat een gerichte scan uitvoeren om te bepalen of er naast de bekende exfiltratie nog andere datalekkage is.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Sluit de scope van het datalek; noodzakelijk voor de AP-melding." },
    // Universal
    { id: "ins-r3-do-nothing", label: "Wachten op juridische procedures alvorens te handelen", description: "Houd alle communicatie en notificaties aan totdat de arbeidsrechtelijke positie helder is.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "AP-deadline verstrijkt; media publiceert het verhaal zonder uw input." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-ins-r3-1", description: "AP-melding ingediend binnen 72u na ontdekking", module: "legal_regulatory", measuredBy: "decision", triggerActionIds: ["ins-r3-leg-2"], achieved: false },
    { id: "obj-ins-r3-2", description: "Klokkenluidersclaim juridisch beoordeeld vóór verdere actie", module: "legal_regulatory", measuredBy: "decision", triggerActionIds: ["ins-r3-leg-1"], achieved: false },
  ]
  return { round_number: 3, title: "Legal Complexity & External Pressure", situation_update: "It is 14:00. The employee has now engaged a lawyer citing whistleblower protection. GDPR requires an AP notification within 72 hours. A journalist is asking questions. The board wants answers. Multiple simultaneous pressure tracks must be managed without contradiction.", timerMinutes: 20, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // CEO
    { id: "ins-r4-ceo-1", label: "Schikkingsonderhandeling autoriseren", description: "CEO keurt het starten van schikkingsonderhandelingen goed op de voorgestelde voorwaarden (€45k + NDA).", allowedRoles: ["ceo"], isRecommended: false, irPlanAligned: true, consequence: "Snellere afsluiting; vermijdt publieke rechtszaak. Beperkt schadevergoeding en geeft intern signaal." },
    // CFO
    { id: "ins-r4-cfo-1", label: "Financiële analyse schikking vs. vervolging presenteren", description: "CFO stelt een kosten-baten analyse op: schikking (€45k + NDA) vs. 18-24 maanden strafproces.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Geeft de CEO een zakelijke basis voor de beslissing. Maakt de financiële trade-off expliciet." },
    // Legal
    { id: "ins-r4-leg-1", label: "Strafrechtelijke vervolging inzetten", description: "Legal verwijst de volledige zaak naar politie en OM voor strafrechtelijke aanklacht voor IP-diefstal en computercriminaliteit.", allowedRoles: ["legal"], isRecommended: false, irPlanAligned: true, consequence: "Sterk signaal; kan toekomstige incidenten afschrikken. Duur en langdurig; geen garantie op veroordeling." },
    { id: "ins-r4-leg-2", label: "AP-follow-up-eigenaar aanwijzen voor 30-dagenrapport", description: "Legal wijst een verantwoordelijke aan voor het 30-dagenrapport aan de AP met volledige impact-assessment en herstelstappen.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "AP-follow-up wordt niet gemist; expliciete eigenaarsbelegging voorkomt verval." },
    // Head of Comms
    { id: "ins-r4-hoc-1", label: "Klantnotificatiebrieven verzenden voor betrokken personen", description: "Communications en Legal coördineren de klantnotificatie voor alle personen wier PII in de geëxfiltreerde data zit.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Verplicht onder GDPR Art.34 bij hoog risico voor betrokkenen. Transparantie versterkt vertrouwen." },
    // HR Lead
    { id: "ins-r4-hrl-1", label: "Insider threat-procedures en toegangsbeheer updaten", description: "HR Lead en CISO leggen geüpdatede offboarding-checklist, toegangsintrekkings-SLA en DLP-escalatiebeleid vast.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Voorkomt herhaling. Maakt de AP-follow-up geloofwaardig." },
    // Universal
    { id: "ins-r4-do-nothing", label: "Alle besluiten tot volgende boardvergadering uitstellen", description: "Houd alle definitieve besluiten aan tot de board formeel bijeenkomt over twee weken.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "AP-follow-up-deadline en klantnotificatieverplichtingen worden gemist." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-ins-r4-1", description: "CEO/CFO neemt beslissing schikking of strafrechtelijk vervolgen", module: "recovery_lessons", measuredBy: "decision", triggerActionIds: ["ins-r4-ceo-1", "ins-r4-leg-1"], achieved: false },
    { id: "obj-ins-r4-2", description: "Klantnotificatie goedgekeurd en eigenaar AP-follow-up aangewezen", module: "recovery_lessons", measuredBy: "decision", triggerActionIds: ["ins-r4-hoc-1"], achieved: false },
  ]
  return { round_number: 4, title: "Resolution & Lessons Learned", situation_update: "It is 17:00. Forensics confirms competitor involvement. The AP has acknowledged the breach notification. A settlement offer is on the table. The board is waiting. Decisions on legal strategy, customer notification, and systemic improvements must be made today.", timerMinutes: 15, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // CFO
    { id: "bec-r1-cfo-1", label: "CEO telefonisch verifiëren via bekend nummer", description: "Bel de CEO direct op een verifieerd nummer — niet het nummer uit de e-mail — om het verzoek te bevestigen vóór enige actie.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Bevestigt of weerlegt het verzoek in minder dan 2 minuten. Altijd de juiste eerste stap." },
    { id: "bec-r1-cfo-2", label: "Betalingsverzoek on hold zetten in afwachting van verificatie", description: "Finance houdt de overboeking aan totdat het verzoek via een tweede kanaal is bevestigd.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Voorkomt verlies. De 'urgentie'-framing is een social engineering-tactiek — wachten is altijd veilig." },
    { id: "bec-r1-cfo-3", label: "Overboeking uitvoeren op basis van CEO-urgentie", description: "Voer de €185.000-overboeking uit op basis van het e-mailverzoek.", allowedRoles: ["cfo"], isRecommended: false, irPlanAligned: false, consequence: "Stuurt €185.000 naar een frauduleuze rekening. Na SWIFT-verrekening nauwelijks te stoppen." },
    // IT Manager
    { id: "bec-r1-itm-1", label: "E-mailheaders analyseren op domeinvervalsing", description: "IT beoordeelt de volledige e-mailheaders om te bevestigen of het verzenddomein het geregistreerde bedrijfsdomein is of een lookalike.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Bevestigt BEC-poging als het domein afwijkt. Bewaart bewijs." },
    // System Admin
    { id: "bec-r1-sa-1", label: "E-mailgateway controleren op vergelijkbare lookalike-domeinen", description: "Zoek in de gateway-logs op andere e-mails van vergelijkbare lookalike-domeinen de afgelopen 30 dagen.", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Bepaalt de scope van de BEC-campagne; vergelijkbare pogingen kunnen ook andere medewerkers bereikt hebben." },
    // Universal
    { id: "bec-r1-do-nothing", label: "EA vragen te verifiëren in plaats van CEO direct te bellen", description: "Vraag de executive assistant van de CEO om het verzoek namens u te bevestigen.", allowedRoles: [], isRecommended: false, irPlanAligned: true, consequence: "Redelijk als de EA directe toegang heeft. Trager dan direct bellen maar acceptabel." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-bec-r1-1", description: "Betaalverzoek on hold gezet en CEO telefonisch geverifieerd", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["bec-r1-cfo-1", "bec-r1-cfo-2"], achieved: false },
    { id: "obj-bec-r1-2", description: "E-mailheaders onderzocht op domeinvervalsing", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["bec-r1-itm-1"], achieved: false },
  ]
  return { round_number: 1, title: "Suspicious Transfer Request", situation_update: "It is 10:00. A Finance Manager has received what appears to be a CEO-authorised wire transfer request. The urgency framing and secrecy request are unusual. The CFO has been alerted. No transfer has been made yet.", timerMinutes: 15, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // CFO
    { id: "bec-r2-cfo-1", label: "SWIFT-recall initiëren via bank — direct bellen", description: "CFO belt het fraudenummer van de bank direct om een SWIFT-recall van de €185.000-overboeking te starten. Het 2-uurs-venster sluit.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Gedeeltelijke of volledige terugvordering mogelijk binnen het venster. Na verrekening zijn middelen doorgaans onterugvorderbaar." },
    { id: "bec-r2-cfo-2", label: "Verzekeraar notificeren en incident documenteren", description: "CFO contacteert de cyber-verzekeraar om een mogelijke fraudeclaim te initiëren en documenteert de incidenttijdlijn.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Behoudt verzekeringsclaimrecht. De meeste polissen vereisen tijdige melding." },
    // IT Manager
    { id: "bec-r2-itm-1", label: "CEO-credentials resetten en MFA inschakelen", description: "IT reset het CEO-wachtwoord, trekt alle actieve sessies in en dwingt MFA af op het account.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Sluit de aanvaller buiten. Essentieel vóór de CEO vanuit het account communiceert." },
    // System Admin
    { id: "bec-r2-sa-1", label: "Forensische scope van inbox-toegang bepalen", description: "IT-forensics brengt in kaart hoeveel e-mails de aanvaller gedurende 72u heeft gelezen: deals, contracten, personeelszaken.", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Bepaalt de volledige blootstelling. Noodzakelijk voor eventuele klant- en regelgevingsnotificaties." },
    // HR Lead
    { id: "bec-r2-hrl-1", label: "HR: Due process starten voor Finance-medewerker", description: "HR Lead garandeert dat de junior Finance-medewerker die de overboeking uitvoerde een eerlijk feitenvaststellingsgesprek krijgt vóór eventuele disciplinaire stap.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Beschermt de organisatie juridisch; de medewerker kan slachtoffer zijn van een social engineering-keten." },
    // Universal
    { id: "bec-r2-do-nothing", label: "Wachten op IT-forensics vóór de bank te bellen", description: "Houd bankkontact aan totdat IT de volledige forensische analyse heeft afgerond.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "Het recall-venster sluit. €185.000 is onterugvorderbaar. Dit is de meest kostbare beslissing in dit incident." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-bec-r2-1", description: "SWIFT-recall ingediend binnen 2-uur-window", module: "triage_containment", measuredBy: "decision", triggerActionIds: ["bec-r2-cfo-1"], achieved: false },
    { id: "obj-bec-r2-2", description: "CEO-account gereset en MFA ingeschakeld", module: "triage_containment", measuredBy: "decision", triggerActionIds: ["bec-r2-itm-1"], achieved: false },
  ]
  return { round_number: 2, title: "Transfer Processed — Attacker Had Inbox Access", situation_update: "It is 11:00. The wire transfer has been processed. The bank has a 2-hour recall window. IT confirms the CEO's email was compromised for 72 hours. The attacker has read sensitive deal information. A second wave of fraudulent transfers was prepared but not yet sent.", timerMinutes: 20, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // CEO
    { id: "bec-r3-ceo-1", label: "Board briefen over financiële blootstelling en respons", description: "CEO bereidt een schriftelijke board-briefing voor: verloren/teruggevorderd bedrag, oorzaak, direct genomen maatregelen en tijdlijn voor controleverbetering.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Ontlast bestuursverantwoordelijkheid. Beschermt CEO bij governance-uitdaging." },
    { id: "bec-r3-ceo-2", label: "Boardvraag omzeilen tot juridische positie helder is", description: "Geef de board voorlopig geen antwoord totdat de volledige juridische situatie vaststaat.", allowedRoles: ["ceo"], isRecommended: false, irPlanAligned: false, consequence: "Board zal escaleren. Juridische en reputatieschade neemt toe bij uitblijven van antwoord." },
    // CFO
    { id: "bec-r3-cfo-1", label: "Verzekeringsclaimbescheiden samenstellen", description: "CFO stelt de incidenttijdlijn, forensisch bewijs en schadeoverzicht samen voor de 48u-eis van de verzekeraar.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Maximaliseert de €143.000-claim. Gemiste 48u-deadline kan dekking ongeldig maken." },
    // Head of Comms
    { id: "bec-r3-hoc-1", label: "Holding statement uitgeven aan financieel journalist", description: "Communications geeft een gedoseerde verklaring af die een IT-beveiligingsincident erkent, met bevestiging dat herstelstappen zijn genomen.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Beheert het narratief. Mag geen details over verzekeringsaanspraken of specifieke controleproblemen bevatten." },
    // Legal
    { id: "bec-r3-leg-1", label: "Aangifte doen voor cyberfraude", description: "Legal dient een formele aangifte in bij de politie voor computerfraude ter ondersteuning van het bankonderzoek en de verzekeringsaanspraak.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Ondersteunt het bankonderzoek. Vereist voor de meeste fraudeverzekeringsclaims." },
    // Universal
    { id: "bec-r3-do-nothing", label: "Alle communicatie aanhouden tot juridische review klaar is", description: "Geef geen verklaring af en deel geen informatie met board of pers tot de volledige juridische positie duidelijk is.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "Board zal escaleren. Media vult het stilzwijgen in. Verzekeraar interpreteert stilte als niet-medewerking." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-bec-r3-1", description: "Board geïnformeerd en verzekeraarsdossier opgestart", module: "crisis_communication", measuredBy: "decision", triggerActionIds: ["bec-r3-ceo-1", "bec-r3-cfo-1"], achieved: false },
    { id: "obj-bec-r3-2", description: "Holding statement uitgegeven en aangifte gedaan", module: "crisis_communication", measuredBy: "decision", triggerActionIds: ["bec-r3-hoc-1", "bec-r3-leg-1"], achieved: false },
  ]
  return { round_number: 3, title: "Recovery & External Pressure", situation_update: "It is 13:00. €143,000 is unrecoverable. The insurer has a 48-hour claim window. The board wants answers. A journalist is calling. Legal, Finance, and Communications all need to act — without contradicting each other.", timerMinutes: 20, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // CFO
    { id: "bec-r4-cfo-1", label: "Verbeterde financiële controls autoriseren", description: "CFO keurt de dubbele autorisatie en terugbelprocedure voor overboekingen formeel goed, met directe ingang.", allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true, consequence: "Pakt de onderliggende oorzaak aan. Voldoet ook aan de hersteleis van de verzekeraar." },
    // IT Manager
    { id: "bec-r4-itm-1", label: "MFA inschakelen op alle directie- en Finance-accounts", description: "IT zet MFA aan op alle C-suite- en Finance-e-mailaccounts als noodmaatregel, met volledige uitrol in 30 dagen.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Sluit de primaire aanvalsvector. Had al standaard moeten zijn." },
    // CEO
    { id: "bec-r4-ceo-1", label: "HR-aanbeveling accepteren: hertraining in plaats van ontslag", description: "CEO accepteert de HR-aanbeveling dat de Finance-medewerker verplichte hertraining krijgt in plaats van een disciplinaire maatregel.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Eerlijk resultaat gezien systeemfouten. Voorkomt onrechtmatig ontslag. Stuurt de juiste culturele norm." },
    // Legal
    { id: "bec-r4-leg-1", label: "Verzekeringsclaimdocumentatie afronden", description: "Legal dient het volledige forensische rapport en verbeterplan voor de controls in bij de verzekeraar ter afronding van de €143.000-claim.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Maximaliseert de claimvergoeding. Forensics bevestigt enkelvoudige compromittering." },
    // HR Lead
    { id: "bec-r4-hrl-1", label: "Verplichte BEC-bewustzijnstraining voor Finance plannen", description: "HR Lead plant verplichte anti-BEC en social engineering training voor het volledige Finance-team.", allowedRoles: ["hr_lead"], isRecommended: true, irPlanAligned: true, consequence: "Pakt de menselijke factor aan. Noodzakelijk om de verzekeraar te overtuigen van herstelmaatregelen." },
    // Universal
    { id: "bec-r4-do-nothing", label: "Controleverbetering uitstellen naar volgend kwartaalbudget", description: "Stel de voorgestelde maatregelen uit tot de volgende kwartaalplanningssessie.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "Organisatie blijft kwetsbaar voor dezelfde aanval. Verzekeraar kan de claim aanvechten bij vertraging." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-bec-r4-1", description: "Verbeterde financiële controls geautoriseerd door CFO", module: "recovery_lessons", measuredBy: "decision", triggerActionIds: ["bec-r4-cfo-1"], achieved: false },
    { id: "obj-bec-r4-2", description: "MFA ingeschakeld op alle executive-accounts", module: "recovery_lessons", measuredBy: "decision", triggerActionIds: ["bec-r4-itm-1"], achieved: false },
  ]
  return { round_number: 4, title: "Controls & Accountability", situation_update: "It is 16:00. Forensics confirms the breach was limited to the CEO's email. The insurer is processing the claim. HR has completed its review of the junior Finance employee. A clear set of control gaps has been identified. Decisions on controls, accountability, and the insurer's remediation requirement must be made today.", timerMinutes: 15, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // IT Manager
    { id: "exf-r1-itm-1", label: "Exfiltratiescope bepalen vóór API-toegang in te trekken", description: "IT-forensics voert een snelle query-analyse uit: hoeveel records, welke datatypes, over welke periode — vóór de access in te trekken.", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, consequence: "Essentieel voor de GDPR-melding: je moet weten wat is meegenomen." },
    { id: "exf-r1-itm-2", label: "Leveranciers-API-credentials direct intrekken", description: "IT trekt de OAuth-token en API-toegang van de externe leverancier onmiddellijk in.", allowedRoles: ["it_manager"], isRecommended: false, irPlanAligned: true, consequence: "Stopt lopende exfiltratie maar kan de aanvaller waarschuwen. Moet volgen op scope-bepaling." },
    // System Admin
    { id: "exf-r1-sa-1", label: "API-querypatronen analyseren op aanvullende compromittering", description: "Systeembeheer analyseert de API-gatewaylogs op andere service-accounts met vergelijkbaar abnormaal gedrag.", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, consequence: "Bepaalt of de scope beperkt is tot één account of breder. Noodzakelijk voor de GDPR-inschatting." },
    // CISO
    { id: "exf-r1-ciso-1", label: "Externe analytics-leverancier direct contacteren", description: "CISO belt de externe leverancier om te onderzoeken of hun systemen zijn gecompromitteerd en welke bredere intelligentie zij hebben over de aanval.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Leverancier kan bredere aanvalsinformatie hebben. Contractuele verplichting onder GDPR-verwerkersovereenkomst." },
    { id: "exf-r1-ciso-2", label: "CERT-NL-advisory als voldoende beschouwen en intern melden", description: "Behandel de CERT-NL-waarschuwing als bevestiging en meld intern zonder leverancier te contacteren.", allowedRoles: ["ciso"], isRecommended: false, irPlanAligned: false, consequence: "Leverancier weet mogelijk meer over de aanvalsvector. Missen van leveranciersbesmetting kan tot grotere scope leiden." },
    // Legal
    { id: "exf-r1-leg-1", label: "Clientnotificatieplicht juridisch beoordelen", description: "Legal beoordeelt de contractuele en GDPR-verwerkersverplichtingen: welke notificatieplicht bestaat tegenover de getroffen client?", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "De client heeft het probleem al gemeld. Proactieve notificatie is juridisch en commercieel beter dan stilte." },
    // Universal
    { id: "exf-r1-do-nothing", label: "Wachten op CERT-NL voor verdere richtlijnen", description: "Houd alle interne acties aan in afwachting van de volgende CERT-NL update.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "Exfiltratie gaat door. Client-notificatievenster sluit. Passieve respons bij een actieve breach." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-exf-r1-1", description: "Exfiltratiescope bepaald vóór actie op vendor", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["exf-r1-itm-1"], achieved: false },
    { id: "obj-exf-r1-2", description: "Juridische clientnotificatieplicht beoordeeld", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: ["exf-r1-leg-1"], achieved: false },
  ]
  return { round_number: 1, title: "Silent Breach Discovered", situation_update: "It is 09:00. A client complaint and an anomalous API alert are pointing at an ongoing, silent data exfiltration through a third-party integration. The breach may have been active for six weeks. Nothing is confirmed yet — but the clock is running.", timerMinutes: 15, injects, facilitatorNotes, roleActions, learningObjectives }
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
    // Legal
    { id: "exf-r2-leg-1", label: "AP Art.33-melding indienen binnen 72u", description: "Legal stelt de verplichte GDPR Art.33-melding op en dient deze in bij de AP: aard van de inbreuk, categorieën, aantal betrokkenen, mogelijke gevolgen en getroffen maatregelen.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Wettelijke vereiste. Niet tijdig melden verhoogt het boeterisico aanzienlijk." },
    { id: "exf-r2-leg-2", label: "Art.34 individuele notificatieplicht beoordelen", description: "Legal beoordeelt of de 340.000 betrokken personen direct gemeld moeten worden conform GDPR Art.34 op basis van het risico voor hun rechten.", allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true, consequence: "Bij hoog risico is Art.34-notificatie verplicht en moet dit in de AP-melding worden meegenomen." },
    { id: "exf-r2-leg-3", label: "Wachten tot leverancier meldt en hun aanpak volgen", description: "Houd de eigen AP-melding aan totdat de leverancier melding heeft gedaan en analyseer hun aanpak.", allowedRoles: ["legal"], isRecommended: false, irPlanAligned: false, consequence: "U bent de data controller. Melding van leverancier vervangt uw eigen verplichting niet. Klok loopt door." },
    // CISO
    { id: "exf-r2-ciso-1", label: "Leverancier coördineren voor consistente AP-melding", description: "CISO en Legal stemmen met de leverancier af om tegenstrijdige GDPR-meldingen bij de AP te voorkomen.", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, consequence: "Voorkomt tegenstrijdige regelgevingsaanvragen. Leverancier is GDPR-verwerker — coördinatie wordt verwacht." },
    // Head of Comms
    { id: "exf-r2-hoc-1", label: "Formele schriftelijke breachnotificatie aan client sturen", description: "Legal en Communications stellen een formele schriftelijke breachnotificatie op voor de client die de anomalie gemeld heeft, conform GDPR-verwerkersverplichtingen.", allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true, consequence: "Proactieve notificatie is juridisch vereist en commercieel verstandig. Client vermoedt al een inbreuk." },
    // CEO
    { id: "exf-r2-ceo-1", label: "Board informeren over omvang inbreuk en regulatoire stappen", description: "CEO informeert de board over de bevestigde omvang (340.000 records), de lopende meldprocedures en de zakelijke blootstelling.", allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true, consequence: "Zorgplicht richting board; beschermt CEO bij volgende vergadering." },
    // Universal
    { id: "exf-r2-do-nothing", label: "Wachten op leverancier vóór enige melding", description: "Houd eigen AP-melding aan totdat de leverancier zijn eigen melding heeft ingediend.", allowedRoles: [], isRecommended: false, irPlanAligned: false, consequence: "U bent de data controller. Leveranciers-melding vervangt uw verplichting niet. Klok loopt door." },
  ], sel)
  const learningObjectives: LearningObjective[] = [
    { id: "obj-exf-r2-1", description: "AP Art.33-melding ingediend binnen 72u", module: "legal_regulatory", measuredBy: "decision", triggerActionIds: ["exf-r2-leg-1"], achieved: false },
    { id: "obj-exf-r2-2", description: "Formele schriftelijke notificatie verstuurd naar getroffen client", module: "legal_regulatory", measuredBy: "decision", triggerActionIds: ["exf-r2-hoc-1"], achieved: false },
  ]
  return { round_number: 2, title: "Breach Confirmed — Regulatory Clock Running", situation_update: "It is 11:00. 340,000 customer records were systematically exfiltrated. The GDPR 72-hour AP notification clock has 61 hours remaining. An affected client is demanding a formal response today. The vendor has confirmed their own compromise.", timerMinutes: 20, injects, facilitatorNotes, roleActions, learningObjectives }
}
