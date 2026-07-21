import type { ScenarioGraph, ChaserNodeData, DecisionNodeData, MeldplichtConfig, RoundNodeData } from "./types"
import type { IrRetainerProfile } from "@/lib/types"

function id(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 8)}` }

const RETAINER: IrRetainerProfile = {
  name: "Cronos Digital Forensics",
  activationNumber: "+31 88 555 24 24",
  activationEmail: "ir@cronos-df.example",
  authorizedActivators: ["CISO", "IT Manager", "CEO"],
  slaMinutesToFirstContact: 30,
  handoffChecklist: [
    "Asset inventory (kritieke systemen)",
    "Netwerkdiagram",
    "Recent SIEM/EDR logs",
    "User accounts en priv. escalaties",
    "Backup-status",
  ],
  scopeIncludes: [
    "Forensische analyse en containment-advies",
    "24/7 IR-coördinatie",
    "Rapport aan bestuur en toezichthouder",
  ],
  scopeExcludes: [
    "Onderhandeling losgeld",
    "PR en pers",
  ],
}

const MELDPLICHT: MeldplichtConfig = {
  enabled: true,
  incidentDetectedAt: 'start',
  ncsc24hEnabled: true,
  ncsc72hEnabled: true,
  ncscFinalEnabled: true,
  apEnabled: true,
  chasersEnabled: true,
}

export function buildNis2Showcase(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round"), r4 = id("round"), r5 = id("round"), r6 = id("round")
  // decisions
  const d1 = id("dec"), d2 = id("dec"), d3 = id("dec"), d4 = id("dec"), d5 = id("dec"), d6 = id("dec")
  // outcomes
  const outExemplary = id("out"), outSlow = id("out"), outMissed24 = id("out"),
        outDatabreach = id("out"), outNoInsurance = id("out"), outBoardFail = id("out")
  // chasers
  const chNcsc = id("chase"), chAp = id("chase"), chRet = id("chase")

  // Decision option ids
  const d1a = "d1_optimal", d1b = "d1_missed", d1c = "d1_perfect"
  const d2a = "d2_ceo", d2b = "d2_wait", d2c = "d2_cfo"
  const d3a = "d3_report", d3b = "d3_wait"
  const d4a = "d4_forensics", d4b = "d4_fast", d4c = "d4_pay"
  const d5a = "d5_transparent", d5b = "d5_holding", d5c = "d5_silent"
  const d6a = "d6_strict", d6b = "d6_speedy"

  // inject ids (round -> inject)
  const i11 = id("inj"), i12 = id("inj"), i13 = id("inj"), i14 = id("inj")
  const i21 = id("inj"), i22 = id("inj"), i23 = id("inj")
  const i31 = id("inj"), i32 = id("inj"), i33 = id("inj")
  const i41 = id("inj"), i42 = id("inj"), i43 = id("inj")
  const i51 = id("inj"), i52 = id("inj"), i53 = id("inj")
  const i61 = id("inj"), i62 = id("inj")

  const round1Data: RoundNodeData = {
    kind: "round",
    title: "Detectie & Classificatie",
    situation_update: "T+0: SIEM meldt massale bestandsversleuteling op de prod-VMware-cluster van het klantenportaal. Meerdere klanten kunnen niet meer inloggen.",
    timerMinutes: 15,
    roleActions: [
      {
        id: "r1-classify-crisis",
        label: "Classificeer als aanzienlijk incident onder Cbw en activeer crisisteam",
        description: "Vast te leggen: tijdstip, criteria (Cbw), en dat crisisteam wordt geactiveerd.",
        allowedRoles: ["ciso", "ceo"],
        irPlanAligned: true,
        isRecommended: true,
        scoreImpact: 2,
        supervisionAreas: ['detection_classification', 'crisis_activation'],
      },
    ],
  }

  const round2Data: RoundNodeData = {
    kind: "round" as const,
    title: "Activatie & Mandaat",
    situation_update: "T+15m: CEO is in bestuursvergadering en niet direct bereikbaar. IR-partner-contactcard is gedeeld met CISO.",
    timerMinutes: 25,
    roleActions: [
      {
        id: "r2-activate-retainer",
        label: "Activeer IR-retainer volgens procedure",
        description: "Bel het 24/7-nummer via een geautoriseerde activator en start overdrachtchecklist.",
        allowedRoles: ["ciso", "it_manager"],
        irPlanAligned: true,
        isRecommended: true,
        scoreImpact: 2,
        supervisionAreas: ['ir_retainer'],
      },
    ],
  }

  const round3Data: RoundNodeData = {
    kind: "round" as const,
    title: "Meldplicht",
    situation_update: "T+40m: 24u-klok tikt. Persoonsgegevens vermoeden groeit. Journalist tweet de ransom-note.",
    timerMinutes: 40,
    roleActions: [
      {
        id: "r3-file-ncsc",
        label: "Dien NCSC vroegtijdige waarschuwing in (24u)",
        description: "Onverwijld, uiterlijk 24u na constatering.",
        allowedRoles: ["ciso", "legal", "ceo"],
        irPlanAligned: true,
        isRecommended: true,
        scoreImpact: 3,
        supervisionAreas: ['notification_duty'],
      },
      {
        id: "r3-file-ap",
        label: "Dien AP-melding (AVG) in bij vermoeden datalek",
        description: "72u vanaf constatering.",
        allowedRoles: ["legal"],
        irPlanAligned: true,
        scoreImpact: 2,
        supervisionAreas: ['notification_duty'],
      },
    ],
  }

  const round4Data: RoundNodeData = {
    kind: "round" as const,
    title: "Containment vs. Bewijs",
    situation_update: "T+80m: Ops wil snel opstarten; forensics wil systemen aanhouden. 'Backups clean' claim niet geverifieerd.",
    timerMinutes: 30,
    roleActions: [
      {
        id: "r4-forensics-first",
        label: "Volledige isolatie + rebuild na IR-sign-off",
        description: "Bewijs boven snelheid.",
        allowedRoles: ["ciso"],
        irPlanAligned: true,
        isRecommended: true,
        scoreImpact: 2,
        supervisionAreas: ['technical_response', 'logging_evidence'],
      },
    ],
  }

  const round5Data: RoundNodeData = {
    kind: "round" as const,
    title: "Communicatie & Klanten",
    situation_update: "T+110m: Journalisten bellen. Board wil brief. Klanten open ticket-storm.",
    timerMinutes: 30,
    roleActions: [
      {
        id: "r5-transparent-comms",
        label: "Transparant persbericht consistent met NCSC/AP",
        description: "Geen aannames, wel feiten en volgende stap.",
        allowedRoles: ["head_of_comms", "ceo"],
        irPlanAligned: true,
        isRecommended: true,
        scoreImpact: 2,
        supervisionAreas: ['crisis_communication'],
      },
    ],
  }

  const round6Data: RoundNodeData = {
    kind: "round" as const,
    title: "Herstel & Nazorg",
    situation_update: "T+140m: RTO/RPO gehaald? Bestuurlijk akkoord voor terug-in-productie.",
    timerMinutes: 25,
    roleActions: [
      {
        id: "r6-strict-acceptance",
        label: "Strikte acceptatiecriteria + IR-sign-off",
        description: "Geen productie zonder verifieerbare criteria.",
        allowedRoles: ["ciso", "ceo"],
        irPlanAligned: true,
        isRecommended: true,
        scoreImpact: 2,
        supervisionAreas: ['recovery', 'business_continuity', 'aftercare'],
      },
    ],
  }

  const nodes: ScenarioGraph["nodes"] = [
    { id: startId, type: "start", position: { x: 40, y: 300 }, data: { kind: "start" } },

    { id: r1, type: "round", position: { x: 220, y: 200 }, data: round1Data },
    { id: i11, type: "inject", position: { x: 220, y: 60 }, data: {
      kind: "inject", type: "alert", channel: "siem", urgency: "critical",
      title: "SIEM: massale encryptie op prod-VMware-cluster",
      content: "Meer dan 4.000 bestanden per minuut versleuteld. Detectie via anomaly-rule 'RansomBurst'. Bron: SIEM.",
      reliability: "fact", nis2Relevant: true, supervisionAreas: ['detection_classification', 'logging_evidence'],
    } },
    { id: i12, type: "inject", position: { x: 320, y: 60 }, data: {
      kind: "inject", type: "internal", channel: "whatsapp", urgency: "medium",
      title: "WhatsApp — SOC-lead J. Bakker",
      content: "We hebben containment, geen paniek. Alles onder controle.",
      reliability: "misleading", senderName: "SOC-lead J. Bakker",
      groundTruthAnnotations: [
        { id: "gt1", start: 0, end: 24, tag: "misleading", authorNote: "SOC-lead heet in werkelijkheid anders — bron niet te vertrouwen." },
      ],
      supervisionAreas: ['detection_classification'],
    } },
    { id: i13, type: "inject", position: { x: 420, y: 60 }, data: {
      kind: "inject", type: "technical", channel: "edr", urgency: "high",
      title: "EDR: lateral movement nog actief",
      content: "Beacons naar 3 domain controllers gedetecteerd. Bewegingen naar backup-server geregistreerd.",
      reliability: "fact",
      supervisionAreas: ['technical_response', 'logging_evidence'],
    } },
    { id: i14, type: "inject", position: { x: 520, y: 60 }, data: {
      kind: "inject", type: "media", channel: "email", urgency: "medium",
      title: "Journalist: 'wij horen dat AVG-data gelekt is'",
      content: "Anonieme bron zegt dat persoonsgegevens gelekt zouden zijn. Reactie gevraagd voor 22:00.",
      reliability: "assumption",
      supervisionAreas: ['crisis_communication'],
    } },
    {
      id: d1, type: "decision", position: { x: 340, y: 260 }, data: {
        kind: "decision",
        prompt: "Hoe classificeer je dit incident?",
        measuredBy: "participant_choice",
        supervisionAreas: ['detection_classification', 'crisis_activation'],
        options: [
          { id: d1c, label: "Kritiek crisis — activeer bestuurlijke laag én NCSC-early-warning binnen 1 uur", scoreImpact: 3, roleActionId: "r1-classify-crisis" },
          { id: d1a, label: "Significant incident onder Cbw — activeer crisisteam", scoreImpact: 2, roleActionId: "r1-classify-crisis" },
          { id: d1b, label: "Nog technisch incident — SOC lost het op", scoreImpact: -2 },
        ],
      } as DecisionNodeData,
    },

    { id: r2, type: "round", position: { x: 620, y: 200 }, data: round2Data },
    { id: i21, type: "inject", position: { x: 620, y: 60 }, data: {
      kind: "inject", type: "internal", channel: "phone", urgency: "medium",
      title: "CEO onbereikbaar — bestuursvergadering",
      content: "CFO staat op stand-by als vervanger. Continuïteitsplan noemt CFO expliciet.",
      reliability: "fact", supervisionAreas: ['roles_mandates', 'board_decision_making'],
    } },
    { id: i22, type: "inject", position: { x: 720, y: 60 }, data: {
      kind: "inject", type: "executive", channel: "memo", urgency: "high",
      title: "Head of Legal: 'AVG-melding kan wachten tot forensics klaar is'",
      content: "Interne memo suggereert dat de AP-melding pas ná forensics hoeft — dat is niet correct: 72u start bij constatering.",
      reliability: "misleading",
      groundTruthAnnotations: [
        { id: "gt2", start: 0, end: 200, tag: "misleading", authorNote: "72u loopt vanaf constatering, niet vanaf afronding forensics." },
      ],
      supervisionAreas: ['notification_duty'],
    } },
    { id: i23, type: "inject", position: { x: 820, y: 60 }, data: {
      kind: "inject", type: "internal", channel: "whatsapp", urgency: "medium",
      title: "IR-retainer contactcard beschikbaar",
      content: `24/7-nummer: ${RETAINER.activationNumber}. Alleen te bellen door een geautoriseerde activator.`,
      reliability: "fact", supervisionAreas: ['ir_retainer'],
    } },
    {
      id: d2, type: "decision", position: { x: 740, y: 260 }, data: {
        kind: "decision",
        prompt: "Hoe borg je mandaat als CEO onbereikbaar is?",
        measuredBy: "participant_choice",
        supervisionAreas: ['roles_mandates', 'board_decision_making'],
        options: [
          { id: d2a, label: "Bereik CEO alsnog via extern nummer", scoreImpact: 2 },
          { id: d2c, label: "CFO neemt over conform continuïteitsplan", scoreImpact: 2 },
          { id: d2b, label: "Wacht op CEO — geen mandaat", scoreImpact: -3 },
        ],
      } as DecisionNodeData,
    },

    { id: r3, type: "round", position: { x: 1020, y: 200 }, data: round3Data },
    { id: i31, type: "inject", position: { x: 1020, y: 60 }, data: {
      kind: "inject", type: "regulatory", channel: "news", urgency: "high",
      title: "NCSC portal placeholder link",
      content: "https://meldpunt.example/nis2 — voor vroegtijdige waarschuwing en 72u melding.",
      reliability: "fact", supervisionAreas: ['notification_duty'],
    } },
    { id: i32, type: "inject", position: { x: 1120, y: 60 }, data: {
      kind: "inject", type: "social", channel: "news", urgency: "critical",
      title: "Tweet met screenshot ransom-note viral",
      content: "Klant deelt screenshot. Aandacht groeit snel.",
      reliability: "fact", supervisionAreas: ['crisis_communication'],
    } },
    { id: i33, type: "inject", position: { x: 1220, y: 60 }, data: {
      kind: "inject", type: "internal", channel: "teams", urgency: "medium",
      title: "Team: 'we hebben nog 24u speling'",
      content: "Aanname circuleert in het chatkanaal.",
      reliability: "assumption", supervisionAreas: ['notification_duty'],
    } },
    {
      id: d3, type: "decision", position: { x: 1140, y: 260 }, data: {
        kind: "decision",
        prompt: "Meld je nu of wacht je op meer duidelijkheid?",
        measuredBy: "participant_choice",
        supervisionAreas: ['notification_duty'],
        options: [
          { id: d3a, label: "Dien vroegtijdige waarschuwing in conform bijlage 1", scoreImpact: 3, roleActionId: "r3-file-ncsc" },
          { id: d3b, label: "Wacht op meer duidelijkheid — chaser dreigt", scoreImpact: -3 },
        ],
      } as DecisionNodeData,
    },

    { id: r4, type: "round", position: { x: 1420, y: 200 }, data: round4Data },
    { id: i41, type: "inject", position: { x: 1420, y: 60 }, data: {
      kind: "inject", type: "technical", channel: "email", urgency: "high",
      title: "Forensisch partner: houd systemen aan",
      content: "Onderzoek loopt. Rebuild pas na sign-off.",
      reliability: "fact", supervisionAreas: ['technical_response', 'logging_evidence'],
    } },
    { id: i42, type: "inject", position: { x: 1520, y: 60 }, data: {
      kind: "inject", type: "internal", channel: "teams", urgency: "medium",
      title: "Ops: 'backups clean' claim",
      content: "Backup-manager claimt clean. Verificatie ontbreekt.",
      reliability: "misleading", supervisionAreas: ['recovery'],
      groundTruthAnnotations: [
        { id: "gt3", start: 0, end: 50, tag: "misleading", authorNote: "Claim niet geverifieerd; risico op re-infectie via backup." },
      ],
    } },
    { id: i43, type: "inject", position: { x: 1620, y: 60 }, data: {
      kind: "inject", type: "executive", channel: "email", urgency: "high",
      title: "Verzekeraar: geen dekking zonder forensics-sign-off",
      content: "Polisvoorwaarde: rebuild vereist externe forensics sign-off.",
      reliability: "fact", supervisionAreas: ['business_continuity'],
    } },
    {
      id: d4, type: "decision", position: { x: 1540, y: 260 }, data: {
        kind: "decision",
        prompt: "Welke response-strategie?",
        measuredBy: "participant_choice",
        supervisionAreas: ['technical_response', 'recovery', 'business_continuity'],
        options: [
          { id: d4a, label: "Full isolation + rebuild ná forensics sign-off", scoreImpact: 3, roleActionId: "r4-forensics-first" },
          { id: d4b, label: "Fast recovery zonder forensics-sign-off", scoreImpact: -2 },
          { id: d4c, label: "Betaal losgeld conform playbook", scoreImpact: -2 },
        ],
      } as DecisionNodeData,
    },

    { id: r5, type: "round", position: { x: 1820, y: 200 }, data: round5Data },
    { id: i51, type: "inject", position: { x: 1820, y: 60 }, data: {
      kind: "inject", type: "media", channel: "phone", urgency: "high",
      title: "Journalist FD belt terug",
      content: "Deadline 30 min. Vraag: 'is er persoonsgegevens gelekt?'",
      reliability: "fact", supervisionAreas: ['crisis_communication'],
    } },
    { id: i52, type: "inject", position: { x: 1920, y: 60 }, data: {
      kind: "inject", type: "internal", channel: "email", urgency: "medium",
      title: "Board vraagt board-brief",
      content: "Chairman verzoekt om board-update voor 22:00.",
      reliability: "fact", supervisionAreas: ['board_decision_making', 'crisis_communication'],
    } },
    { id: i53, type: "inject", position: { x: 2020, y: 60 }, data: {
      kind: "inject", type: "internal", channel: "sms", urgency: "medium",
      title: "Klanten stromen support in",
      content: "1.200 tickets in 15 minuten.",
      reliability: "fact", supervisionAreas: ['emergency_communication'],
    } },
    {
      id: d5, type: "decision", position: { x: 1940, y: 260 }, data: {
        kind: "decision",
        prompt: "Externe communicatie: transparant, holding, of stil?",
        measuredBy: "participant_choice",
        supervisionAreas: ['crisis_communication'],
        options: [
          { id: d5a, label: "Transparant persbericht consistent met NCSC/AP", scoreImpact: 2, roleActionId: "r5-transparent-comms" },
          { id: d5b, label: "Holding statement", scoreImpact: 1 },
          { id: d5c, label: "Geen communicatie", scoreImpact: -2 },
        ],
      } as DecisionNodeData,
    },

    { id: r6, type: "round", position: { x: 2220, y: 200 }, data: round6Data },
    { id: i61, type: "inject", position: { x: 2220, y: 60 }, data: {
      kind: "inject", type: "technical", channel: "email", urgency: "medium",
      title: "Ops rapporteert RTO/RPO status",
      content: "70% van kritieke systemen hersteld. RPO binnen SLA.",
      reliability: "fact", supervisionAreas: ['business_continuity', 'recovery'],
    } },
    { id: i62, type: "inject", position: { x: 2320, y: 60 }, data: {
      kind: "inject", type: "executive", channel: "memo", urgency: "medium",
      title: "Bestuur vraagt akkoord terug-in-productie",
      content: "Wachten op formeel bestuursakkoord én IR sign-off.",
      reliability: "fact", supervisionAreas: ['recovery', 'board_decision_making'],
    } },
    {
      id: d6, type: "decision", position: { x: 2340, y: 260 }, data: {
        kind: "decision",
        prompt: "Wat is jullie criterium voor terug-in-productie?",
        measuredBy: "participant_choice",
        supervisionAreas: ['recovery', 'aftercare'],
        options: [
          { id: d6a, label: "Strikte acceptatiecriteria + IR sign-off", scoreImpact: 3, roleActionId: "r6-strict-acceptance" },
          { id: d6b, label: "Snelle terugkeer om klanten te dienen", scoreImpact: -1 },
        ],
      } as DecisionNodeData,
    },

    // Chasers
    {
      id: chNcsc, type: "chaser", position: { x: 1120, y: 420 }, data: {
        kind: "chaser",
        condition: { kind: "notification_missing", type: "ncsc_24h", afterRoundNumber: 3 },
        inject: {
          kind: "inject", type: "regulatory", channel: "phone", urgency: "critical",
          title: "NCSC-CSIRT belt",
          content: "Wij hebben nog geen vroegtijdige waarschuwing van u ontvangen betreffende het incident. Bevestig graag binnen 4 uur of Cbw-meldplicht van toepassing is.",
          senderName: "NCSC-CSIRT",
          reliability: "fact",
          supervisionAreas: ['notification_duty'],
        },
      } as ChaserNodeData,
    },
    {
      id: chAp, type: "chaser", position: { x: 1940, y: 420 }, data: {
        kind: "chaser",
        condition: { kind: "notification_missing", type: "ap_72h", afterRoundNumber: 5 },
        inject: {
          kind: "inject", type: "regulatory", channel: "email", urgency: "high",
          title: "Autoriteit Persoonsgegevens: verzoek om bevestiging",
          content: "Uit openbare bronnen vernemen wij een mogelijk datalek. Wij verzoeken u binnen 24 uur te bevestigen of AVG-meldplicht van toepassing is.",
          senderName: "Autoriteit Persoonsgegevens",
          reliability: "fact",
          supervisionAreas: ['notification_duty'],
        },
      } as ChaserNodeData,
    },
    {
      id: chRet, type: "chaser", position: { x: 1540, y: 420 }, data: {
        kind: "chaser",
        condition: { kind: "flag", key: "retainer_activated", value: false, afterRoundNumber: 4 },
        inject: {
          kind: "inject", type: "internal", channel: "slack", urgency: "high",
          title: "IT Manager: 'geen response van forensics'",
          content: "Ik krijg geen response van forensics — hebben we de retainer wel formeel geactiveerd?",
          reliability: "fact",
          supervisionAreas: ['ir_retainer'],
        },
      } as ChaserNodeData,
    },

    // Outcomes
    {
      id: outExemplary, type: "outcome", position: { x: 2560, y: 100 }, data: {
        kind: "outcome", key: "exemplary_compliance",
        label: "Voorbeeldig — alle meldingen op tijd",
        narrative: "Team classificeerde tijdig, activeerde retainer met geautoriseerde activator, meldingen NCSC/AP tijdig ingediend, forensics-first response, bestuurlijk akkoord vóór productie. Toezichthouder-rapport zou effectief scoren op alle 14 gebieden.",
        scoreImpact: 6,
      },
    },
    {
      id: outSlow, type: "outcome", position: { x: 2560, y: 200 }, data: {
        kind: "outcome", key: "compliant_but_slow",
        label: "Compliant maar traag",
        narrative: "Meldingen op tijd, maar besluitvorming week 30-50 minuten af van ideaal. Toezichthouder ziet dossier maar met kanttekeningen.",
        scoreImpact: 2,
      },
    },
    {
      id: outMissed24, type: "outcome", position: { x: 2560, y: 300 }, data: {
        kind: "outcome", key: "missed_24h_warning",
        label: "24u vroegtijdige waarschuwing gemist",
        narrative: "NCSC chaser vuurde. Toezichthouder krijgt geen tijdige melding — Cbw-tekortkoming.",
        scoreImpact: -3,
      },
    },
    {
      id: outDatabreach, type: "outcome", position: { x: 2560, y: 400 }, data: {
        kind: "outcome", key: "data_breach_undeclared",
        label: "AVG-melding gemist",
        narrative: "AP-chaser vuurde. Datalek werd te laat gemeld. Compliance-tekortkoming.",
        scoreImpact: -5,
      },
    },
    {
      id: outNoInsurance, type: "outcome", position: { x: 2560, y: 500 }, data: {
        kind: "outcome", key: "insurance_denied_no_forensics",
        label: "Verzekeraar keert niet uit",
        narrative: "Snelle rebuild zonder forensics sign-off. Polis biedt geen dekking.",
        scoreImpact: -2,
      },
    },
    {
      id: outBoardFail, type: "outcome", position: { x: 2560, y: 600 }, data: {
        kind: "outcome", key: "board_governance_fail",
        label: "Bestuurlijke besluitvorming faalde",
        narrative: "Zonder CEO/CFO-substitutie geen tijdig besluit. Bestuurlijke tekortkoming zichtbaar.",
        scoreImpact: -4,
      },
    },
  ]

  const edges: ScenarioGraph["edges"] = [
    { id: id("e"), source: startId, target: r1, type: "sequence" },
    { id: id("e"), source: r1, target: i11, type: "inject" },
    { id: id("e"), source: r1, target: i12, type: "inject" },
    { id: id("e"), source: r1, target: i13, type: "inject" },
    { id: id("e"), source: r1, target: i14, type: "inject" },
    { id: id("e"), source: r1, target: d1, type: "sequence" },
    { id: id("e"), source: d1, target: r2, sourceHandle: d1c, type: "branch" },
    { id: id("e"), source: d1, target: r2, sourceHandle: d1a, type: "branch" },
    { id: id("e"), source: d1, target: outBoardFail, sourceHandle: d1b, type: "outcome", label: "gemist" },

    { id: id("e"), source: r2, target: i21, type: "inject" },
    { id: id("e"), source: r2, target: i22, type: "inject" },
    { id: id("e"), source: r2, target: i23, type: "inject" },
    { id: id("e"), source: r2, target: d2, type: "sequence" },
    { id: id("e"), source: d2, target: r3, sourceHandle: d2a, type: "branch" },
    { id: id("e"), source: d2, target: r3, sourceHandle: d2c, type: "branch" },
    { id: id("e"), source: d2, target: outBoardFail, sourceHandle: d2b, type: "outcome" },

    { id: id("e"), source: r3, target: i31, type: "inject" },
    { id: id("e"), source: r3, target: i32, type: "inject" },
    { id: id("e"), source: r3, target: i33, type: "inject" },
    { id: id("e"), source: r3, target: d3, type: "sequence" },
    { id: id("e"), source: d3, target: r4, sourceHandle: d3a, type: "branch" },
    { id: id("e"), source: d3, target: outMissed24, sourceHandle: d3b, type: "outcome" },

    { id: id("e"), source: r4, target: i41, type: "inject" },
    { id: id("e"), source: r4, target: i42, type: "inject" },
    { id: id("e"), source: r4, target: i43, type: "inject" },
    { id: id("e"), source: r4, target: d4, type: "sequence" },
    { id: id("e"), source: d4, target: r5, sourceHandle: d4a, type: "branch" },
    { id: id("e"), source: d4, target: outNoInsurance, sourceHandle: d4b, type: "outcome" },
    { id: id("e"), source: d4, target: outDatabreach, sourceHandle: d4c, type: "outcome" },

    { id: id("e"), source: r5, target: i51, type: "inject" },
    { id: id("e"), source: r5, target: i52, type: "inject" },
    { id: id("e"), source: r5, target: i53, type: "inject" },
    { id: id("e"), source: r5, target: d5, type: "sequence" },
    { id: id("e"), source: d5, target: r6, sourceHandle: d5a, type: "branch" },
    { id: id("e"), source: d5, target: r6, sourceHandle: d5b, type: "branch" },
    { id: id("e"), source: d5, target: outSlow, sourceHandle: d5c, type: "outcome" },

    { id: id("e"), source: r6, target: i61, type: "inject" },
    { id: id("e"), source: r6, target: i62, type: "inject" },
    { id: id("e"), source: r6, target: d6, type: "sequence" },
    { id: id("e"), source: d6, target: outExemplary, sourceHandle: d6a, type: "outcome" },
    { id: id("e"), source: d6, target: outSlow, sourceHandle: d6b, type: "outcome" },
  ]

  return {
    id: id("graph"),
    name: "NIS2-showcase: Ransomware bij Nederlands MSP-klantenportaal",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    irRetainerName: RETAINER.name,
    irRetainerProfile: RETAINER,
    meldplicht: MELDPLICHT,
    irPlaybook: `## Meldplicht (Cbw)\n- Vroegtijdige waarschuwing NCSC: uiterlijk 24 uur na constatering.\n- Melding met initiële beoordeling: uiterlijk 72 uur.\n- Eindverslag / voortgangsverslag: uiterlijk 1 maand na 72u-melding.\n\n## AVG\n- Melding AP: binnen 72 uur na constatering datalek.\n\n## IR-retainer\n- Activeer via 24/7-nummer; alleen geautoriseerde activators.\n- Overdrachtchecklist: asset inventory, netwerkdiagram, logs, users, backups.\n\n## Board mandaat\n- Vervangingsregeling: CFO neemt over als CEO onbereikbaar >30 min.`,
    nodes,
    edges,
  }
}
