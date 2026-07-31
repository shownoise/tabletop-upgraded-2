import type { ScenarioGraph } from "./types"
import { nis2ShowcaseExample } from "./examples-nis2"
import { buildNis2Showcase } from "./examples-nis2-showcase"
import { meldplichtPressureExample } from "./examples-meldplicht-pressure"
import { fullShowcaseExample } from "./examples-full-showcase"
import { simpleStoryExample } from "./examples-simple-story"

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Ransomware double-extortion ────────────────────────────────────────────

export function ransomwareExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round"), r4 = id("round")
  const inj1 = id("inj"), inj2 = id("inj"), inj3 = id("inj"), inj4 = id("inj"), inj5 = id("inj")
  const spec = id("spec")
  const dec = id("dec")
  const outWin = id("out"), outLose = id("out")

  return {
    id: id("graph"),
    name: "Voorbeeld: Ransomware Double Extortion",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },

      {
        id: r1,
        type: "round",
        position: { x: 220, y: 200 },
        data: {
          kind: "round",
          title: "Detectie: eerste signalen",
          situation_update: "Om 06:12 rapporteert de SOC ongebruikelijke encryptie-activiteit op meerdere fileservers. Enkele endpoints geven een ransom note. Het IT-team is opgeschaald.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r1-isolate", label: "Autoriseer isolatie van getroffen segment",
              description: "Segmenteer het netwerk waar encryptie is gedetecteerd, ondanks impact op productie.",
              allowedRoles: ["ciso", "it_manager"], isRecommended: true, irPlanAligned: true,
              consequence: "Beperkt spread; sommige business-processen vallen tijdelijk stil.",
            },
            {
              id: "r1-notify", label: "Informeer CEO en juridisch direct",
              description: "Escaleer naar directie zodat besluiten over communicatie en betaling kunnen worden voorbereid.",
              allowedRoles: ["ciso"], irPlanAligned: true,
              consequence: "Directie is voorbereid op vervolg-beslissingen.",
            },
            {
              id: "r1-wait", label: "Wacht op meer informatie",
              description: "Verzamel eerst forensische data voordat containment wordt geactiveerd.",
              allowedRoles: [], irPlanAligned: false,
              consequence: "Ransomware verspreidt zich verder tijdens het wachten.",
            },
          ],
          learningObjectives: [
            {
              id: "obj-detect", description: "Team declareert incident binnen 15 minuten",
              module: "detection_sensemaking", measuredBy: "decision",
              triggerActionIds: ["r1-isolate", "r1-notify"],
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test snelheid van eerste beoordeling en escalatie.",
            keyQuestions: ["Wie declareert het incident?", "Wanneer wordt de IR-retainer gebeld?"],
            hints: ["Er is nog geen ransom-note gevalideerd — snelle isolatie voorkomt spread."],
            expectedDecisions: ["Isolatie autoriseren", "Directie inlichten"],
            redFlags: ["Team wacht op complete informatie voor actie", "Alleen technisch team beslist, geen escalatie"],
          },
        },
      },
      {
        id: inj1,
        type: "inject",
        position: { x: 260, y: 420 },
        data: {
          kind: "inject",
          type: "alert", channel: "siem", urgency: "critical",
          title: "SIEM: massale encryptie op FS-01",
          content: "Detected: >2000 file writes/sec on \\\\FS-01. Multiple *.locked extensions. Origin: internal subnet 10.20.30.0/24.",
          source: "SOC", senderName: "SOC on-call", timestamp: "06:12",
          targetTeam: "technical_it", nis2Relevant: true,
        },
      },
      {
        id: inj2,
        type: "inject",
        position: { x: 460, y: 420 },
        data: {
          kind: "inject",
          type: "media", channel: "email", urgency: "high",
          title: "Ransom note — DarkBridge Collective",
          content: "Al uw kritieke data is versleuteld. Betaal 50 BTC binnen 48 uur naar wallet 1FrNQ8TQ... Anders publiceren wij uw klant-PII en financiële records. — DarkBridge",
          source: "Attacker", senderName: "DarkBridge",
          timestamp: "06:30", targetTeam: "all", nis2Relevant: true,
        },
      },

      {
        id: r2,
        type: "round",
        position: { x: 520, y: 200 },
        data: {
          kind: "round",
          title: "Containment & impact-assessment",
          situation_update: "Isolatie is bevestigd, maar 4 kritieke applicaties zijn offline. De IR-partner is aangesloten. Verzekeraar wil eerst een schade-inventarisatie.",
          timerMinutes: 20,
          roleActions: [
            {
              id: "r2-activate-ir", label: "Activeer IR-retainer formeel",
              description: "Officieel notice sturen naar de IR-partij voor forensisch onderzoek.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
            },
            {
              id: "r2-notify-ap", label: "Meld intent bij AP (72u-klok start)",
              description: "Datalek-melding voorbereiden binnen 72 uur na ontdekking.",
              allowedRoles: ["legal"], irPlanAligned: true,
            },
            {
              id: "r2-comms-hold", label: "Formuleer holding statement",
              description: "Ontwerp een korte externe boodschap voor als de pers vraagt.",
              allowedRoles: ["head_of_comms", "ceo"], isRecommended: true, irPlanAligned: true,
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Coördinatie tussen technisch en governance-spoor testen.",
            keyQuestions: ["Wanneer start de 72u-klok?", "Wie leidt de crisis?"],
            hints: [],
            expectedDecisions: ["IR-retainer activeren", "AP-melding voorbereiden", "Holding statement klaarzetten"],
            redFlags: ["Legal wacht op technische zekerheid voor AP-melding"],
          },
        },
      },
      {
        id: inj3,
        type: "inject",
        position: { x: 560, y: 420 },
        data: {
          kind: "inject",
          type: "regulatory", channel: "email", urgency: "high",
          title: "Verzekeraar: assessment vereist",
          content: "Voor dekking moet u binnen 24 uur een impact-assessment aanleveren + bevestiging van IR-partij dat containment gestart is.",
          source: "Cybersure BV", senderName: "Cybersure Claims",
          timestamp: "08:15", targetRoles: ["cfo", "legal"],
        },
      },

      {
        id: spec,
        type: "special",
        position: { x: 820, y: 200 },
        data: {
          kind: "special",
          type: "ransomware_negotiation",
          assignedRole: "cfo",
          thresholds: [
            { id: "bad", label: "Slecht (< 0)", predicate: { op: "<", value: 0 } },
            { id: "ok", label: "OK (>= 0)", predicate: { op: ">=", value: 0 } },
          ],
        },
      },

      {
        id: dec,
        type: "decision",
        position: { x: 1080, y: 200 },
        data: {
          kind: "decision",
          prompt: "Definitieve keuze: betalen of herstellen via back-ups?",
          measuredBy: "participant_choice",
          options: [
            { id: "pay", label: "Betalen", roleActionId: "r3-pay" },
            { id: "recover", label: "Herstellen via back-ups", roleActionId: "r3-recover" },
          ],
        },
      },

      {
        id: r3,
        type: "round",
        position: { x: 1340, y: 200 },
        data: {
          kind: "round",
          title: "Uitvoering herstel",
          situation_update: "De keuze is gemaakt. Nu volgt de uitvoering — back-up restore of ransomware-betaling met alle bijbehorende communicatie.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r3-pay", label: "Autoriseer ransom-betaling",
              description: "Formele goedkeuring van betaling via crypto naar attacker wallet.",
              allowedRoles: ["ceo", "cfo"], irPlanAligned: false,
              consequence: "Data mogelijk wel/niet ontsleuteld. Reputatieschade. Wettelijk risico.",
            },
            {
              id: "r3-recover", label: "Start back-up herstel",
              description: "Formele start herstelprocedure vanuit air-gapped back-ups.",
              allowedRoles: ["ciso", "it_manager"], isRecommended: true, irPlanAligned: true,
              consequence: "48-72u downtime, maar geen betaling en geen precedent.",
            },
          ],
        },
      },
      {
        id: inj4,
        type: "inject",
        position: { x: 1380, y: 420 },
        data: {
          kind: "inject",
          type: "media", channel: "news", urgency: "high",
          title: "NOS: 'Cyberaanval bij bekend bedrijf'",
          content: "Volgens bronnen ligt de IT-omgeving van [bedrijf] plat. Ceo weigert commentaar. Klanten melden storingen.",
          source: "NOS", senderName: "Sanne Visser",
          timestamp: "10:45", targetTeam: "all",
        },
      },

      {
        id: r4,
        type: "round",
        position: { x: 1600, y: 200 },
        data: {
          kind: "round",
          title: "Nazorg & lessons learned",
          situation_update: "Systemen zijn hersteld of ontsleuteld. Klantcommunicatie loopt. Board wil een debrief. AP wil de definitieve melding.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r4-report-ap", label: "Indienen definitieve AP-melding",
              description: "Volledige datalek-melding met scope, categorieën, maatregelen.",
              allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
            },
            {
              id: "r4-post-mortem", label: "Start post-incident review",
              description: "Plan de blameless post-mortem in binnen 5 werkdagen.",
              allowedRoles: ["ciso", "ceo"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj5,
        type: "inject",
        position: { x: 1640, y: 420 },
        data: {
          kind: "inject",
          type: "executive", channel: "email", urgency: "medium",
          title: "Board: 'Wat zijn de lessen?'",
          content: "Board vergadert morgen. Wij verwachten een one-pager: root cause, kosten, structurele maatregelen.",
          source: "Board", senderName: "Voorzitter RvC",
          timestamp: "16:00", targetRoles: ["ceo", "ciso"],
        },
      },

      {
        id: outWin,
        type: "outcome",
        position: { x: 1860, y: 120 },
        data: {
          kind: "outcome",
          key: "controlled_recovery",
          label: "Gecontroleerd herstel",
          narrative: "Herstel zonder betaling, transparante communicatie, board tevreden. Reputatie deels beschadigd maar vertrouwen herstelt.",
          scoreImpact: 3,
        },
      },
      {
        id: outLose,
        type: "outcome",
        position: { x: 1860, y: 320 },
        data: {
          kind: "outcome",
          key: "paid_ransom",
          label: "Ransom betaald",
          narrative: "Data grotendeels ontsleuteld, maar precedent gezet. Reputatie- en compliance-risico's blijven bestaan.",
          scoreImpact: -2,
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: inj1, type: "inject" },
      { id: id("e"), source: r1, target: inj2, type: "inject" },
      { id: id("e"), source: r1, target: r2, type: "sequence" },
      { id: id("e"), source: r2, target: inj3, type: "inject" },
      { id: id("e"), source: r2, target: spec, type: "sequence" },
      { id: id("e"), source: spec, target: dec, sourceHandle: "ok", type: "branch", label: "OK" },
      { id: id("e"), source: spec, target: dec, sourceHandle: "bad", type: "branch", label: "Slecht" },
      { id: id("e"), source: dec, target: outLose, sourceHandle: "pay", type: "branch", label: "Betalen" },
      { id: id("e"), source: dec, target: r3, sourceHandle: "recover", type: "branch", label: "Herstellen" },
      { id: id("e"), source: r3, target: inj4, type: "inject" },
      { id: id("e"), source: r3, target: r4, type: "sequence" },
      { id: id("e"), source: r4, target: inj5, type: "inject" },
      { id: id("e"), source: r4, target: outWin, type: "sequence" },
    ],
  }
}

// ─── Insider Threat ─────────────────────────────────────────────────────────

export function insiderThreatExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2a = id("round"), r2b = id("round"), r3 = id("round")
  const inj1 = id("inj"), inj2 = id("inj"), inj3 = id("inj")
  const dec = id("dec")
  const outCorrect = id("out"), outMisstep = id("out")

  return {
    id: id("graph"),
    name: "Voorbeeld: Insider Threat",
    version: 1,
    scenarioType: "insider_threat",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },
      {
        id: r1,
        type: "round",
        position: { x: 220, y: 200 },
        data: {
          kind: "round",
          title: "Verdachte data-exfiltratie",
          situation_update: "DLP-alert: medewerker P. de Vries heeft afgelopen 48 uur 2.3 GB aan klantcontracten gedownload naar een privé-account. Hij zit in zijn opzegtermijn.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r1-lock", label: "Blokkeer accounts direct",
              description: "Zet alle accounts van medewerker in read-only, revoke SSO tokens.",
              allowedRoles: ["it_manager", "ciso"], isRecommended: true, irPlanAligned: true,
            },
            {
              id: "r1-hr-legal", label: "Betrek HR + Legal voor onderzoek",
              description: "Formele investigation kick-off met chain-of-custody voor eventueel strafrecht.",
              allowedRoles: ["hr_lead", "legal"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj1,
        type: "inject",
        position: { x: 260, y: 420 },
        data: {
          kind: "inject",
          type: "alert", channel: "siem", urgency: "high",
          title: "DLP: bulk upload naar externe cloud",
          content: "User: p.devries@company.local. Destination: personal Dropbox account. Files: 342 contracten, 89 salaris-overzichten.",
          source: "DLP", senderName: "Symantec DLP",
          timestamp: "09:14", targetRoles: ["ciso", "it_manager"], nis2Relevant: true,
        },
      },
      {
        id: dec,
        type: "decision",
        position: { x: 500, y: 200 },
        data: {
          kind: "decision",
          prompt: "Directe confrontatie of eerst forensisch onderzoek?",
          measuredBy: "participant_choice",
          options: [
            { id: "confront", label: "Direct confronteren", roleActionId: "r1-confront" },
            { id: "investigate", label: "Eerst stil onderzoek", roleActionId: "r1-investigate" },
          ],
        },
      },
      {
        id: r2a,
        type: "round",
        position: { x: 780, y: 60 },
        data: {
          kind: "round",
          title: "Confrontatie route",
          situation_update: "Medewerker wordt naar HR-kamer geroepen. Hij ontkent, maar wordt boos en verlaat het pand. Zijn laptop staat nog open.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r2a-preserve", label: "Beslag leggen op laptop + forensische kopie",
              description: "Chain-of-custody procedure starten voordat medewerker terugkomt.",
              allowedRoles: ["ciso", "legal"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj2,
        type: "inject",
        position: { x: 820, y: 280 },
        data: {
          kind: "inject",
          type: "internal", channel: "teams", urgency: "medium",
          title: "Collega meldt: 'P. heeft gedreigd te lekken naar concurrent'",
          content: "Als jullie iets doen, gaat mijn kennis naar de concurrent. Ik heb genoeg.",
          source: "Collega", senderName: "M. Bakker",
          timestamp: "10:20", targetRoles: ["hr_lead", "legal"],
        },
      },
      {
        id: r2b,
        type: "round",
        position: { x: 780, y: 380 },
        data: {
          kind: "round",
          title: "Stil onderzoek route",
          situation_update: "Forensisch team maakt een clone van het endpoint. Logging wordt uitgebreid. Medewerker weet nog niets. HR bereidt een gesprek voor.",
          timerMinutes: 20,
          roleActions: [
            {
              id: "r2b-forensics", label: "Volledig forensisch pakket verzamelen",
              description: "Endpoint image, cloud-audit-logs, mailbox export.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj3,
        type: "inject",
        position: { x: 820, y: 580 },
        data: {
          kind: "inject",
          type: "regulatory", channel: "email", urgency: "medium",
          title: "Legal: check AP-melding vereist?",
          content: "Als klantcontracten al bij de externe partij zijn = mogelijk datalek. Beoordeel of AP-melding nodig is binnen 72u.",
          source: "Legal", senderName: "mr. J. Klein",
          timestamp: "12:00", targetRoles: ["legal", "ciso"],
        },
      },
      {
        id: r3,
        type: "round",
        position: { x: 1080, y: 200 },
        data: {
          kind: "round",
          title: "Afronding & communicatie",
          situation_update: "Feiten zijn helder. Nu volgt: arbeidsrechtelijke actie, eventuele aangifte en interne communicatie.",
          timerMinutes: 15,
        },
      },
      {
        id: outCorrect,
        type: "outcome",
        position: { x: 1340, y: 100 },
        data: {
          kind: "outcome",
          key: "prosecutable_case",
          label: "Vervolgbare zaak",
          narrative: "Volledig bewijs, aangifte mogelijk, arbeidsrechtelijk sluitend. Communicatie proportioneel.",
          scoreImpact: 3,
        },
      },
      {
        id: outMisstep,
        type: "outcome",
        position: { x: 1340, y: 300 },
        data: {
          kind: "outcome",
          key: "evidence_lost",
          label: "Bewijs verloren",
          narrative: "Confrontatie te vroeg, chain-of-custody gebroken, aangifte kansloos. Reputatieschade en juridisch risico.",
          scoreImpact: -2,
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: inj1, type: "inject" },
      { id: id("e"), source: r1, target: dec, type: "sequence" },
      { id: id("e"), source: dec, target: r2a, sourceHandle: "confront", type: "branch", label: "Confronteren" },
      { id: id("e"), source: dec, target: r2b, sourceHandle: "investigate", type: "branch", label: "Onderzoeken" },
      { id: id("e"), source: r2a, target: inj2, type: "inject" },
      { id: id("e"), source: r2b, target: inj3, type: "inject" },
      { id: id("e"), source: r2a, target: outMisstep, type: "sequence" },
      { id: id("e"), source: r2b, target: r3, type: "sequence" },
      { id: id("e"), source: r3, target: outCorrect, type: "sequence" },
    ],
  }
}

// ─── BEC / CFO Fraud ────────────────────────────────────────────────────────

export function becExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round")
  const inj1 = id("inj"), inj2 = id("inj"), inj3 = id("inj")
  const dec = id("dec")
  const outVerify = id("out"), outPay = id("out")

  return {
    id: id("graph"),
    name: "Voorbeeld: BEC / CFO Fraud",
    version: 1,
    scenarioType: "bec_cfo_fraud",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },
      {
        id: r1,
        type: "round",
        position: { x: 220, y: 200 },
        data: {
          kind: "round",
          title: "Spoedbetaling verzoek",
          situation_update: "De 'CEO' mailt de treasurer over een strikt vertrouwelijke overname. Er moet vandaag €780K worden overgemaakt naar een nieuwe leverancier. 'Bel me niet, ik zit in vergadering.'",
          timerMinutes: 10,
          roleActions: [
            {
              id: "r1-flag", label: "Signaleer als verdacht + verificatie starten",
              description: "Volg out-of-band verification protocol, ook al druk hoog is.",
              allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true,
            },
            {
              id: "r1-check", label: "Bel CEO via bekend nummer",
              description: "Verify identity via andere channel dan waar het verzoek binnenkwam.",
              allowedRoles: ["cfo", "ceo"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj1,
        type: "inject",
        position: { x: 260, y: 420 },
        data: {
          kind: "inject",
          type: "executive", channel: "email", urgency: "high",
          title: "Van 'CEO': URGENT - vertrouwelijke betaling",
          content: "Beste [treasurer], vandaag moet €780.000 worden overgemaakt naar rek. IBAN NL12ABNA0987654321 voor de acquisitie van MoonRock BV. Geen vragen, geen calls. Bevestig zsm. -- [CEO]",
          source: "ceo@company-legal.com", senderName: "[CEO]",
          senderHandle: "ceo@company-legal.com",
          timestamp: "09:04", targetRoles: ["cfo"],
        },
      },
      {
        id: dec,
        type: "decision",
        position: { x: 500, y: 200 },
        data: {
          kind: "decision",
          prompt: "Betaling initiëren of eerst verifiëren?",
          measuredBy: "participant_choice",
          options: [
            { id: "pay", label: "Direct betalen (voldoen aan urgentie)", roleActionId: "r1-pay" },
            { id: "verify", label: "Verifiëren via bekend kanaal", roleActionId: "r1-check" },
          ],
        },
      },
      {
        id: r2,
        type: "round",
        position: { x: 780, y: 200 },
        data: {
          kind: "round",
          title: "Waarheid komt uit",
          situation_update: "Verificatie of tweede blik onthult dat het adres net-nét afwijkt ('company-legal.com' ipv 'company.com'). Deze mail komt niet van de CEO.",
          timerMinutes: 10,
          roleActions: [
            {
              id: "r2-report", label: "Meld incident aan CISO + IR-team",
              description: "Formele BEC-melding, headers preserveren voor forensics.",
              allowedRoles: ["cfo", "ciso"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj2,
        type: "inject",
        position: { x: 820, y: 420 },
        data: {
          kind: "inject",
          type: "technical", channel: "email", urgency: "high",
          title: "IT: mail-headers laten spoofing zien",
          content: "Header analyse: SPF fail, DKIM fail. Domain 'company-legal.com' geregistreerd 3 dagen geleden. Klassieke CEO-fraud vector.",
          source: "IT", senderName: "SOC on-call",
          timestamp: "09:34", targetRoles: ["ciso", "cfo"],
        },
      },
      {
        id: r3,
        type: "round",
        position: { x: 1080, y: 200 },
        data: {
          kind: "round",
          title: "Opschaling & lessons",
          situation_update: "Incident bevestigd. Vraag: was dit de enige poging? Andere medewerkers ook benaderd? Communicatie intern nodig.",
          timerMinutes: 10,
        },
      },
      {
        id: inj3,
        type: "inject",
        position: { x: 1120, y: 420 },
        data: {
          kind: "inject",
          type: "internal", channel: "email", urgency: "medium",
          title: "Awareness: bredere phishing-campagne",
          content: "Twee andere financiële medewerkers hebben soortgelijke mails ontvangen vanochtend. Aanvaller lijkt organisatie te 'kennen'.",
          source: "IT", senderName: "IT Awareness",
          timestamp: "10:15", targetTeam: "all",
        },
      },
      {
        id: outVerify,
        type: "outcome",
        position: { x: 1340, y: 100 },
        data: {
          kind: "outcome",
          key: "fraud_prevented",
          label: "Fraude voorkomen",
          narrative: "Verificatie stopte de betaling. Awareness-campagne gestart, IR-team heeft indicators geblokkeerd.",
          scoreImpact: 3,
        },
      },
      {
        id: outPay,
        type: "outcome",
        position: { x: 1340, y: 300 },
        data: {
          kind: "outcome",
          key: "fraud_completed",
          label: "Betaling verstuurd",
          narrative: "€780K overgemaakt naar aanvaller. Terughalen mogelijk via de bank, maar niet gegarandeerd. Verzekering onderzoekt dekking.",
          scoreImpact: -3,
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: inj1, type: "inject" },
      { id: id("e"), source: r1, target: dec, type: "sequence" },
      { id: id("e"), source: dec, target: outPay, sourceHandle: "pay", type: "branch", label: "Betalen" },
      { id: id("e"), source: dec, target: r2, sourceHandle: "verify", type: "branch", label: "Verifiëren" },
      { id: id("e"), source: r2, target: inj2, type: "inject" },
      { id: id("e"), source: r2, target: r3, type: "sequence" },
      { id: id("e"), source: r3, target: inj3, type: "inject" },
      { id: id("e"), source: r3, target: outVerify, type: "sequence" },
    ],
  }
}

// ─── Complete showcase: Supply Chain Double Extortion ──────────────────────

export function supplyChainShowcase(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3a = id("round"), r3b = id("round"), r4a = id("round"), r4c = id("round")
  const decA = id("dec"), decB = id("dec")
  const specJourn = id("spec"), specRans = id("spec")
  const outExcellent = id("out"), outRegRisk = id("out"), outControlled = id("out"), outPaid = id("out")
  // Injects
  const inj1a = id("inj"), inj1b = id("inj")
  const inj2a = id("inj"), inj2b = id("inj")
  const inj3aa = id("inj"), inj3ab = id("inj")
  const inj3ba = id("inj"), inj3bb = id("inj")
  const inj4aa = id("inj")
  const inj4ca = id("inj")

  return {
    id: id("graph"),
    name: "OPERATIE ZERO-DAY — Supply Chain Compromise",
    version: 1,
    scenarioType: "supply_chain_compromise",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },

      // ── R1 Detection ─────────────────────────────────────────
      {
        id: r1, type: "round", position: { x: 260, y: 200 },
        data: {
          kind: "round",
          title: "Externe waarschuwing",
          situation_update: "07:42 — Het Nationaal Cyber Security Centrum belt: 'Wij hebben jullie klant-tenant zien opduiken op een leak-blog. Attackers claimen 8TB aan data. Onze intel: ingang via jullie CI/CD supply chain, waarschijnlijk via de logging-agent van FluxLog v3.2.1.'",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r1-declare", label: "Incident declareren en IR-retainer activeren",
              description: "Formele incident-status uitroepen. IR-partij inschakelen voor forensisch onderzoek naar de logging-agent.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              consequence: "Officiële status opent draaiboek en verzekering-dekking.",
            },
            {
              id: "r1-scope-tech", label: "Scope-onderzoek naar FluxLog-agent starten",
              description: "IT gaat alle systemen met FluxLog v3.2.1 identificeren en isoleren.",
              allowedRoles: ["it_manager", "ciso"], isRecommended: true, irPlanAligned: true,
              consequence: "Bepaalt attack surface. Enkele klant-tenants tijdelijk offline.",
            },
            {
              id: "r1-notify-legal", label: "Legal betrekken voor 72u-klok",
              description: "Juridische assessment van AVG Art.33 meldplicht starten — klok tikt vanaf ontdekking.",
              allowedRoles: ["legal"], irPlanAligned: true,
              consequence: "72-uur klok is formeel gestart.",
            },
            {
              id: "r1-wait", label: "Wachten op meer informatie",
              description: "Eerst kijken of NCSC-melding klopt voor we escaleren.",
              allowedRoles: [], irPlanAligned: false,
              consequence: "Attackers exfilteren verder tijdens ons dralen.",
            },
          ],
          learningObjectives: [
            {
              id: "obj-declare",
              description: "Incident wordt binnen 15 min gedeclareerd na externe waarschuwing",
              module: "detection_sensemaking", measuredBy: "decision",
              triggerActionIds: ["r1-declare"],
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Snelheid van eerste erkenning en het activeren van de juiste sporen (technisch + juridisch).",
            keyQuestions: [
              "Wie declareert het incident officieel?",
              "Wanneer start de AVG 72u-klok — bij het NCSC-belletje of bij interne bevestiging?",
              "Welke aannames maakt het team over de scope?",
            ],
            hints: ["NCSC belt zelden zonder concrete indicators — externe bron is een sterk signaal."],
            expectedDecisions: ["Formele incident-declaratie", "Legal betrokken voor 72u-klok"],
            redFlags: ["Team wacht op interne bevestiging", "Alleen tech-team reageert, geen escalatie naar directie"],
          },
        },
      },
      {
        id: inj1a, type: "inject", position: { x: 260, y: 430 },
        data: {
          kind: "inject",
          type: "regulatory", channel: "phone", urgency: "critical",
          title: "NCSC belt: jullie data staat op DarkBridge leak-blog",
          content: "Goedemorgen. NCSC hier. We hebben zojuist een post gezien op de leak-blog van DarkBridge Collective — jullie klant-tenant 'moonrock-b2b' wordt genoemd, ze claimen 8TB. Onze intel wijst op FluxLog v3.2.1 als vector.",
          source: "NCSC", senderName: "NCSC on-duty officer",
          timestamp: "07:42", targetRoles: ["ciso", "ceo"], nis2Relevant: true,
        },
      },
      {
        id: inj1b, type: "inject", position: { x: 460, y: 430 },
        data: {
          kind: "inject",
          type: "technical", channel: "slack", urgency: "high",
          title: "SOC: baseline afwijkingen in build-servers",
          content: "Retrospectief onderzoek: 3 weken geleden begon FluxLog met calls naar een onbekend IP (185.220.101.4). Gemiddeld 2GB egress per nacht. Niet gealarmeerd — 'binnen normale metrics'. 12 klant-tenants raken de agent.",
          source: "SOC", senderName: "SOC L2 analyst",
          timestamp: "07:55", targetRoles: ["ciso", "it_manager", "system_admin"],
        },
      },

      // ── R2 Assessment ────────────────────────────────────────
      {
        id: r2, type: "round", position: { x: 540, y: 200 },
        data: {
          kind: "round",
          title: "Scope wordt duidelijk",
          situation_update: "IR-partij (Cronos Digital Forensics) is aangehaakt. Voorlopige assessment: 12 klant-tenants gecompromitteerd, waaronder MoonRock B2B (financial), NoordZorg (medisch dossiers) en Havenwerk Rotterdam (kritieke infra). CFO belt met de vraag hoe dit naar buiten gebracht wordt. Board wil vanmiddag een update.",
          timerMinutes: 20,
          roleActions: [
            {
              id: "r2-contain", label: "Alle FluxLog-agents wereldwijd isoleren",
              description: "Force-uninstall via config management. Downtime voor 12 tenants ~ 2u.",
              allowedRoles: ["ciso", "it_manager"], isRecommended: true, irPlanAligned: true,
              consequence: "Contamination stopt, maar klanten merken de storing.",
            },
            {
              id: "r2-inform-customers", label: "Getroffen klanten proactief telefonisch informeren",
              description: "Onder embargo, met technisch detail over vector en containment.",
              allowedRoles: ["ceo", "head_of_comms"], isRecommended: true, irPlanAligned: true,
              consequence: "Klanten waarderen transparantie. Reputatiewinst.",
            },
            {
              id: "r2-legal-hold", label: "Alle betrokken logs onder legal hold plaatsen",
              description: "Preserveer voor forensisch onderzoek en mogelijk strafrecht.",
              allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true,
            },
            {
              id: "r2-cfo-insurance", label: "Cyberverzekeraar formeel activeren",
              description: "Notice-of-loss indienen binnen contractueel raam.",
              allowedRoles: ["cfo"], irPlanAligned: true,
            },
            {
              id: "r2-wait-comms", label: "Communicatie uitstellen tot beeld compleet is",
              description: "Geen klant- of pers-communicatie tot forensics een compleet plaatje heeft.",
              allowedRoles: ["ceo", "head_of_comms"], irPlanAligned: false,
              consequence: "Wint tijd voor onderzoek, maar attackers en pers vullen het gat.",
            },
          ],
          learningObjectives: [
            {
              id: "obj-contain",
              description: "Team isoleert bekende attack vector binnen 60 min na declaratie",
              module: "triage_containment", measuredBy: "decision",
              triggerActionIds: ["r2-contain"],
            },
            {
              id: "obj-cust-comm",
              description: "Getroffen klanten worden geïnformeerd vóór media publiceert",
              module: "crisis_communication", measuredBy: "decision",
              triggerActionIds: ["r2-inform-customers"],
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Balans tussen technische containment, klantcommunicatie en juridische bescherming.",
            keyQuestions: [
              "Isoleren we alle FluxLog-agents nu, of doen we impact-analyse eerst?",
              "Wie belt de eerste klant, wanneer, en met welke boodschap?",
              "Legal hold — hebben we een chain-of-custody plan?",
            ],
            hints: ["MoonRock B2B is 40% van onze ARR — hun CEO gaat vandaag NOS bellen als wij niet eerst bellen."],
            expectedDecisions: ["Containment autoriseren", "Klantcommunicatie plan", "Verzekering activeren"],
            redFlags: [
              "Team wil eerst 'weten wat er is' voor ze klanten bellen",
              "CFO wil verzekering pas activeren als kosten duidelijk zijn — te laat",
            ],
          },
        },
      },
      {
        id: inj2a, type: "inject", position: { x: 540, y: 430 },
        data: {
          kind: "inject",
          type: "executive", channel: "email", urgency: "high",
          title: "MoonRock B2B (grootste klant): 'Wat gebeurt er?'",
          content: "Onze fraud-detection ziet vanochtend rare patterns in de audit logs. Onze CISO wil binnen 2 uur een technisch briefing. Wij overwegen SLA-melding en onze eigen AP-melding.",
          source: "MoonRock B2B", senderName: "CISO MoonRock",
          senderHandle: "sander.k@moonrock.io",
          timestamp: "09:10", targetRoles: ["ceo", "head_of_comms", "ciso"],
        },
      },
      {
        id: inj2b, type: "inject", position: { x: 740, y: 430 },
        data: {
          kind: "inject",
          type: "regulatory", channel: "email", urgency: "high",
          title: "NoordZorg: 'medische gegevens — dit valt onder NEN 7510'",
          content: "Als medische gegevens exfiltreerd zijn, is dit voor ons een categorie-A datalek. Wij moeten IGJ informeren binnen 24u. Wij verwachten een schriftelijke bevestiging van jullie IR-partij binnen 3u.",
          source: "NoordZorg", senderName: "DPO NoordZorg",
          timestamp: "09:24", targetRoles: ["legal", "ciso"], nis2Relevant: true,
        },
      },

      // ── Decision A ───────────────────────────────────────────
      {
        id: decA, type: "decision", position: { x: 820, y: 200 },
        data: {
          kind: "decision",
          prompt: "Nu direct publiek naar buiten of eerst stil onderzoeken?",
          measuredBy: "participant_choice",
          options: [
            { id: "public", label: "Persverklaring vandaag nog", roleActionId: "r2-inform-customers" },
            { id: "silent", label: "Stil onderzoek, communicatie wachten", roleActionId: "r2-wait-comms" },
          ],
        },
      },

      // ═══ DISCLOSE BRANCH ═══════════════════════════════════════
      {
        id: r3a, type: "round", position: { x: 1100, y: 60 },
        data: {
          kind: "round",
          title: "Publieke communicatie",
          situation_update: "Er staat een persverklaring klaar. NOS heeft al gebeld. Journalist Sanne Visser wil vanmiddag om 15:00 een interview met de CEO. Aandeelhouders zien de koers -12% opening.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r3a-statement", label: "Persverklaring goedkeuren en publiceren",
              description: "Erken incident, benoem containment, beloof concrete follow-up-datums.",
              allowedRoles: ["ceo", "head_of_comms"], isRecommended: true, irPlanAligned: true,
            },
            {
              id: "r3a-noos", label: "NOS-interview accepteren met woordvoerder-training",
              description: "Head of Comms coacht CEO. Q&A-boek pre-briefed.",
              allowedRoles: ["ceo", "head_of_comms"], isRecommended: true, irPlanAligned: true,
            },
            {
              id: "r3a-decline", label: "Alle media-verzoeken afwijzen",
              description: "'We reageren pas als we alles weten.'",
              allowedRoles: ["ceo"], irPlanAligned: false,
              consequence: "NOS publiceert met 'organisatie weigert commentaar'. Reputatie deuk.",
            },
          ],
        },
      },
      {
        id: inj3aa, type: "inject", position: { x: 1080, y: 290 },
        data: {
          kind: "inject",
          type: "media", channel: "email", urgency: "high",
          title: "NOS: interviewverzoek 15:00",
          content: "Beste team, ik ben Sanne Visser (NOS). Wij publiceren vanavond 20:00 een verhaal over de FluxLog-hack. Wij bieden jullie CEO een interview aan om 15:00 om jullie kant te horen. Anders publiceren wij op basis van bronnen.",
          source: "NOS", senderName: "Sanne Visser",
          senderHandle: "sanne.visser@nos.nl",
          timestamp: "10:15", targetRoles: ["head_of_comms", "ceo"],
        },
      },
      {
        id: inj3ab, type: "inject", position: { x: 1280, y: 290 },
        data: {
          kind: "inject",
          type: "social", channel: "news", urgency: "medium",
          title: "Twitter/X: '#datalek trends op #1'",
          content: "3400 mentions/uur. Klanten posten screenshots. Concurrenten liken de kritiek. Één post door een beveiligingsonderzoeker: 'FluxLog is een klassieke npm supply chain vulnerability'.",
          source: "Social monitoring", senderName: "PR-agency",
          timestamp: "11:00", targetTeam: "crisis_management",
        },
      },
      {
        id: specJourn, type: "special", position: { x: 1400, y: 60 },
        data: {
          kind: "special",
          type: "journalist_qa",
          assignedRole: "head_of_comms",
          thresholds: [
            { id: "poor", label: "Slecht (< 0)", predicate: { op: "<", value: 0 } },
            { id: "ok", label: "Voldoende (>= 0)", predicate: { op: ">=", value: 0 } },
          ],
        },
      },
      {
        id: decB, type: "decision", position: { x: 1700, y: 60 },
        data: {
          kind: "decision",
          prompt: "AP-melding vandaag versneld indienen of wachten tot 72u-deadline?",
          measuredBy: "participant_choice",
          options: [
            { id: "report", label: "Direct volledige AP-melding indienen", roleActionId: "r4-ap-fast" },
            { id: "wait", label: "Wachten tot 72u om melding compleet te maken", roleActionId: "r4-ap-wait" },
          ],
        },
      },
      {
        id: r4a, type: "round", position: { x: 1980, y: -60 },
        data: {
          kind: "round",
          title: "Volledige compliance-uitrol",
          situation_update: "AP-melding is versneld ingediend. NoordZorg en IGJ zijn geïnformeerd. Board is tevreden over transparantie. NOS-verhaal is genuanceerd — organisatie krijgt lof voor snelheid.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r4a-post-mortem", label: "Public post-mortem inplannen binnen 2 weken",
              description: "Volledige transparantie over root cause + maatregelen.",
              allowedRoles: ["ceo", "ciso"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj4aa, type: "inject", position: { x: 2000, y: 150 },
        data: {
          kind: "inject",
          type: "media", channel: "news", urgency: "low",
          title: "FD: 'SaaS-bedrijf toont hoe je incident-response hoort te doen'",
          content: "Zeldzame lof in analyse-artikel. Investors reageren rustig. Koers herstelt naar -3%.",
          source: "FD", timestamp: "17:30", targetTeam: "all",
        },
      },
      {
        id: outExcellent, type: "outcome", position: { x: 2280, y: -60 },
        data: {
          kind: "outcome",
          key: "excellent_response",
          label: "Voorbeeldige respons",
          narrative: "Volledige transparantie, snelle klantcommunicatie, tijdige regulatorische melding en een gedisciplineerd media-optreden hebben de reputatieschade beperkt tot een kortstondige dip. Case study voor komende jaren.",
          scoreImpact: 5,
        },
      },
      {
        id: outRegRisk, type: "outcome", position: { x: 1980, y: 200 },
        data: {
          kind: "outcome",
          key: "regulatory_risk",
          label: "Compliance-risico",
          narrative: "Publieke communicatie was goed, maar de late AP-melding levert een handhavingsonderzoek op. Klantvertrouwen deels hersteld, maar juridische kosten en mogelijke boete blijven boven de markt hangen.",
          scoreImpact: -1,
        },
      },

      // ═══ SILENT BRANCH ═════════════════════════════════════════
      {
        id: r3b, type: "round", position: { x: 1100, y: 460 },
        data: {
          kind: "round",
          title: "Stil onderzoek — attackers escaleren",
          situation_update: "Team houdt de kaken op elkaar en werkt aan een compleet plaatje. Nadeel: attackers merken dat we niet reageren en verhogen de druk. 12:00 — een tweede leak-post verschijnt met 500 échte klantrecords als 'proof'. MoonRock ziet het en belt woedend.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r3b-negotiate", label: "Onderhandelingskanaal openen met attackers",
              description: "Via IR-partij, om tijd te winnen en intel op te bouwen.",
              allowedRoles: ["ceo", "cfo"], irPlanAligned: false,
              consequence: "Kan intel opleveren, maar signaleert bereidheid tot betaling.",
            },
            {
              id: "r3b-continue-silent", label: "Doorgaan met stil onderzoek",
              description: "Blijf onder de radar tot forensics compleet is.",
              allowedRoles: [], irPlanAligned: false,
              consequence: "Attackers escaleren, klantvertrouwen erodeert.",
            },
            {
              id: "r3b-emergency-comm", label: "Alsnog crisis-communicatie starten",
              description: "Erken publiekelijk, ondanks eerder besluit om stil te houden.",
              allowedRoles: ["ceo", "head_of_comms"], irPlanAligned: true,
              consequence: "Late erkenning wordt door pers extra kritisch bekeken.",
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test hoe het team omgaat met omgekeerde druk — de aanvaller sets the pace.",
            keyQuestions: [
              "Verandert de tweede leak-post het eerdere besluit?",
              "Kunnen we onderhandelen zonder een precedent te scheppen?",
              "Wanneer breekt intern of extern iemand het silentium?",
            ],
            hints: [],
            expectedDecisions: [],
            redFlags: [
              "Team blijft koppig aan stil onderzoek vasthouden",
              "Onderhandeling wordt gezien als 'winst' terwijl het een teken van escalatie is",
            ],
          },
        },
      },
      {
        id: inj3ba, type: "inject", position: { x: 1080, y: 700 },
        data: {
          kind: "inject",
          type: "media", channel: "ransom_note", urgency: "critical",
          title: "DarkBridge post: 500 echte klantrecords als proof",
          content: "Wij zijn geduldig geweest. Sample is gepubliceerd op ons blog en 4 mirror-sites. Deadline: 72u. Bedrag: 4 miljoen euro in BTC. Daarna: full-dump, plus we bellen jullie klanten persoonlijk.",
          source: "Attacker", senderName: "DarkBridge Collective",
          timestamp: "12:00", targetTeam: "all",
        },
      },
      {
        id: inj3bb, type: "inject", position: { x: 1280, y: 700 },
        data: {
          kind: "inject",
          type: "executive", channel: "phone", urgency: "critical",
          title: "MoonRock CEO belt: 'Waarom lees ik dit op Twitter?'",
          content: "Sander van MoonRock. WOEDEND. Onze klanten bellen ons ná zien van tweets. Wij overwegen jullie contract op te zeggen en aangifte te doen tegen jullie voor SLA-breach. Bel binnen 30 minuten terug of we gaan naar de pers.",
          source: "MoonRock", senderName: "Sander Klaassen (CEO MoonRock)",
          timestamp: "12:15", targetRoles: ["ceo", "head_of_comms"],
        },
      },
      {
        id: specRans, type: "special", position: { x: 1400, y: 460 },
        data: {
          kind: "special",
          type: "ransomware_negotiation",
          assignedRole: "cfo",
          thresholds: [
            { id: "bad", label: "Slecht onderhandeld (< 0)", predicate: { op: "<", value: 0 } },
            { id: "good", label: "Goed onderhandeld (>= 0)", predicate: { op: ">=", value: 0 } },
          ],
        },
      },
      {
        id: r4c, type: "round", position: { x: 1700, y: 380 },
        data: {
          kind: "round",
          title: "Herstel via clean back-ups",
          situation_update: "Onderhandeling gaf intel + tijd. Team koos uiteindelijk voor herstel via clean back-ups. Klant-tenants zijn 4u offline geweest. Klanten zijn na afloop uitgebreid geïnformeerd. Reputatieschade is aanzienlijk maar herstelbaar.",
          timerMinutes: 15,
          roleActions: [
            {
              id: "r4c-legal-pursue", label: "Strafrechtelijke aangifte doen bij politie",
              description: "Volg NCSC-advies en dien aangifte in. Werk mee aan internationaal onderzoek.",
              allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true,
            },
          ],
        },
      },
      {
        id: inj4ca, type: "inject", position: { x: 1720, y: 570 },
        data: {
          kind: "inject",
          type: "internal", channel: "memo", urgency: "medium",
          title: "Interne memo: lessons learned start morgen",
          content: "Post-incident review gepland. Focus: hoe voorkomen we een supply-chain vector in de toekomst? Externe reviewer aangesteld.",
          source: "CEO", senderName: "CEO", timestamp: "18:00", targetTeam: "all",
        },
      },
      {
        id: outControlled, type: "outcome", position: { x: 1980, y: 380 },
        data: {
          kind: "outcome",
          key: "controlled_recovery",
          label: "Gecontroleerd herstel",
          narrative: "Onderhandeling leverde de attackers geen geld op — het gaf ons tijd om back-ups te valideren. Herstel geslaagd. Reputatieschade blijft, maar geen betaling en geen data-lek naar de brede markt. Grote klanten zijn gebleven.",
          scoreImpact: 2,
        },
      },
      {
        id: outPaid, type: "outcome", position: { x: 1700, y: 620 },
        data: {
          kind: "outcome",
          key: "paid_ransom",
          label: "Losgeld betaald",
          narrative: "Onder druk van MoonRock en interne stemmen is er betaald. Data-lek is 'gestopt' — maar er is geen garantie. Board is verdeeld, verzekering dekt slechts deel, en NCSC ontraadt betaling actief. Precedent voor de sector.",
          scoreImpact: -4,
        },
      },
    ],

    edges: [
      // Main line
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: inj1a, type: "inject" },
      { id: id("e"), source: r1, target: inj1b, type: "inject" },
      { id: id("e"), source: r1, target: r2, type: "sequence" },
      { id: id("e"), source: r2, target: inj2a, type: "inject" },
      { id: id("e"), source: r2, target: inj2b, type: "inject" },
      { id: id("e"), source: r2, target: decA, type: "sequence" },

      // Disclose branch
      { id: id("e"), source: decA, target: r3a, sourceHandle: "public", type: "branch", label: "Publiek" },
      { id: id("e"), source: r3a, target: inj3aa, type: "inject" },
      { id: id("e"), source: r3a, target: inj3ab, type: "inject" },
      { id: id("e"), source: r3a, target: specJourn, type: "sequence" },
      { id: id("e"), source: specJourn, target: decB, sourceHandle: "ok", type: "branch", label: "Journalist OK" },
      { id: id("e"), source: specJourn, target: decB, sourceHandle: "poor", type: "branch", label: "Journalist slecht" },
      { id: id("e"), source: decB, target: r4a, sourceHandle: "report", type: "branch", label: "Melden" },
      { id: id("e"), source: decB, target: outRegRisk, sourceHandle: "wait", type: "branch", label: "Wachten" },
      { id: id("e"), source: r4a, target: inj4aa, type: "inject" },
      { id: id("e"), source: r4a, target: outExcellent, type: "sequence" },

      // Silent branch
      { id: id("e"), source: decA, target: r3b, sourceHandle: "silent", type: "branch", label: "Stil" },
      { id: id("e"), source: r3b, target: inj3ba, type: "inject" },
      { id: id("e"), source: r3b, target: inj3bb, type: "inject" },
      { id: id("e"), source: r3b, target: specRans, type: "sequence" },
      { id: id("e"), source: specRans, target: r4c, sourceHandle: "good", type: "branch", label: "Goed" },
      { id: id("e"), source: specRans, target: outPaid, sourceHandle: "bad", type: "branch", label: "Slecht" },
      { id: id("e"), source: r4c, target: inj4ca, type: "inject" },
      { id: id("e"), source: r4c, target: outControlled, type: "sequence" },
    ],
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

export interface Example {
  key: string
  label: string
  description: string
  build: () => ScenarioGraph
}

export const EXAMPLES: Example[] = [
  {
    key: "simple_story",
    label: "★ Ransomware Crisis — 7 rondes (aanbevolen start)",
    description: "Compleet voorbeeldscenario met 7 rondes, elke ronde meerdere parallelle keuzes voor verschillende rollen (CISO / Legal / CEO / Comms / CFO / HR / Ops). 15 injects, 39 opties met complete 6-dim scoring, 3 uitkomsten op basis van cumulatieve score.",
    build: simpleStoryExample,
  },
  {
    key: "full_showcase",
    label: "★★ Full Showcase — alles wat de builder kan",
    description: "7 rondes met side stories, dynamische tokens, misleidende inject, cumulatieve score-bandbreedtes en 5 outcomes. Twee 'scenario-stoppende' foutkeuzes hebben een reroute-inject zodat de oefening tóch doorloopt.",
    build: fullShowcaseExample,
  },
  {
    key: "nis2_meldplicht_pressure_test",
    label: "★ NIS2 Meldplicht Pressure Test",
    description: "6 rondes, 3 rollen (CISO / Legal / CEO). Fout kiezen kost punten en levert een chaser-inject met facilitator-hint — verhaal loopt door. Retainer = Eye Security. R1/R3 injects zijn dynamisch (sector, criticalSystems).",
    build: meldplichtPressureExample,
  },
  {
    key: "nis2_showcase",
    label: "NIS2 showcase: Ransomware MSP",
    description: "Deep-branching demo met chasers, retainer-mechaniek en 6 uitkomsten.",
    build: buildNis2Showcase,
  },
  {
    key: "nis2",
    label: "★ NIS2 Compliance Test — jaarlijkse workshop",
    description: "Diepe showcase met scoring op elke keuze, NIS2 24/72/30d klokken, board-verantwoordelijkheid, 5 outcomes. Toezichthouder-perspectief + rijke lessons learned.",
    build: nis2ShowcaseExample,
  },
  {
    key: "showcase",
    label: "Showcase: Supply Chain Double Extortion",
    description: "Uitgebreid: 6 rondes, 2 decisions, 2 specials (journalist + ransom-negotiation), 4 outcomes. Toont alle graph-features.",
    build: supplyChainShowcase,
  },
  {
    key: "ransomware",
    label: "Ransomware Double Extortion",
    description: "4 rondes, special (ransom-negotiation), branch pay vs recover, 2 outcomes.",
    build: ransomwareExample,
  },
  {
    key: "insider",
    label: "Insider Threat",
    description: "Confronteren vs stil onderzoek — 3 rondes, 2 outcomes.",
    build: insiderThreatExample,
  },
  {
    key: "bec",
    label: "BEC / CFO Fraud",
    description: "Spoedbetaling scam — verify vs pay, direct impact.",
    build: becExample,
  },
]
