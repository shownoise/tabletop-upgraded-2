import type { ScenarioGraph } from "./types"
import { DEFAULT_FEATURES, EYE_SECURITY_RETAINER, meldplichtFromProfile } from "./types"

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

// Full Showcase — één authoring-pad: elke ronde is een Round-node gevolgd door
// een DecisionNode met perRole:true. Elke rol krijgt daar z'n eigen opties.
// Scoring loopt via scoreImpacts (max 4 dimensies), qualityRank markeert welke
// optie "best" is, facilitatorCommentary komt tijdens de review-fase in beeld.
//
// Dimensies (uitlegbaar, max 4): snelheid / kwaliteit / compliance / communicatie.
// Elke optie raakt max 2 dimensies om trade-offs zichtbaar te maken.
export function fullShowcaseExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round"), r4 = id("round"), r5 = id("round"), r6 = id("round")
  const inj_r1a = id("inj"), inj_r1b = id("inj"), inj_r2a = id("inj")
  const inj_r3a = id("inj"), inj_r3b = id("inj"), inj_r4a = id("inj"), inj_r5a = id("inj"), inj_r6 = id("inj")
  const dec_r1 = id("dec"), dec_r2 = id("dec"), dec_r3 = id("dec"), dec_r4 = id("dec"), dec_r5 = id("dec")
  const cha_r1 = id("cha"), cha_r2 = id("cha"), cha_r3 = id("cha"), cha_r4 = id("cha"), cha_r5 = id("cha")
  const out_gold = id("out"), out_silver = id("out"), out_bronze = id("out"), out_meltdown = id("out")

  // De "beste" option-ids per ronde — chasers keyen hierop (decision_not_taken).
  const O_R1_CISO_RETAINER = "r1-ciso-eye"
  const O_R2_LEGAL_AP = "r2-legal-ap"
  const O_R3_CEO_FORMAL = "r3-ceo-formeel"
  const O_R4_CISO_VIA_EYE = "r4-ciso-via-eye"
  const O_R5_CISO_STRUCTURED = "r5-ciso-structured"

  return {
    id: id("graph"),
    name: "★★ Full Showcase — Ransomware @ {{sector}}",
    version: 3,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    meldplicht: meldplichtFromProfile('both', { incidentDetectedAt: 'round_1' }),
    features: DEFAULT_FEATURES,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },

      // ── R1 — Detectie ──────────────────────────────────────────────────────
      {
        id: r1, type: "round", position: { x: 220, y: 200 },
        data: {
          kind: "round",
          title: "R1 — Verdachte activiteit op productie",
          situation_update: "05:12 — MDR meldt outbound-verbindingen vanaf {{criticalSystems}}. Scope onduidelijk, patroon lijkt op ransomware-recon.",
          timerMinutes: 12,
          dynamic: { enabled: true, fillFrom: ["sector", "criticalSystems"] },
          facilitatorNotes: {
            discussionGoal: "Testen of team snel + gelaagd escaleert bij een ambigue signaal.",
            keyQuestions: ["Drempel voor Eye bellen?", "Wanneer wek je board?"],
            hints: [], expectedDecisions: [], redFlags: [],
          },
        },
      },
      {
        id: inj_r1a, type: "inject", position: { x: 260, y: 420 },
        data: {
          kind: "inject",
          type: "alert", channel: "siem", urgency: "high",
          title: "MDR — verdachte outbound",
          content: "Outbound naar onbekend AS-nummer vanaf 3 hosts. Off-hours logins. Patroon lijkt op ransomware-recon.",
          source: "MDR", senderName: "MDR SOC", timestamp: "05:12",
          targetTeam: "all", deliverySeconds: 0,
          dynamic: { enabled: true, fillFrom: ["criticalSystems"] },
        },
      },
      {
        id: inj_r1b, type: "inject", position: { x: 460, y: 420 },
        data: {
          kind: "inject",
          type: "internal", channel: "phone", urgency: "medium",
          title: "Leverancier belt terug",
          content: "'Bij onze andere klanten geen issues. Ik zou zeggen: reset de alert, komt goed.'",
          source: "Leverancier", senderName: "K. de Boer", timestamp: "05:38",
          targetTeam: "crisis_management", deliverySeconds: 180,
        },
      },
      {
        id: dec_r1, type: "decision", position: { x: 660, y: 200 },
        data: {
          kind: "decision",
          prompt: "R1 — Wat doen we in het eerste half uur?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          perRole: true,
          options: [
            {
              id: O_R1_CISO_RETAINER, label: "Eye Security direct activeren + eigen forensics starten",
              allowedRole: "ciso",
              scoreImpacts: { decision_speed: 2, decision_quality: 2 },
              qualityRank: "best",
              facilitatorCommentary: "Precies wat wij verwachten: snel én eigen huis op orde. Deze combinatie levert de meeste tijd op.",
            },
            {
              id: "r1-ciso-wait", label: "Eerst intern uitzoeken, retainer bewaren",
              allowedRole: "ciso",
              scoreImpacts: { decision_speed: -2, decision_quality: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Snappen we vanuit kosten-oogpunt, maar attacker heeft nu 2 uur ruimte om te bewegen.",
            },
            {
              id: "r1-ciso-vendor", label: "Alleen de leverancier bellen",
              allowedRole: "ciso",
              scoreImpacts: { decision_speed: -1, decision_quality: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "Leverancier heeft belang bij bagatelliseren. Onafhankelijke forensics is niet-onderhandelbaar.",
            },
            {
              id: "r1-ceo-alert", label: "Directie inlichten + crisis-tafel oproepen",
              allowedRole: "ceo",
              scoreImpacts: { decision_speed: 2, communication_clarity: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Board vroeg activeren = geen verrassingen later.",
            },
            {
              id: "r1-ceo-wait", label: "Wachten tot 08:00 — geen board wakker maken",
              allowedRole: "ceo",
              scoreImpacts: { decision_speed: -2 },
              qualityRank: "poor",
              facilitatorCommentary: "Nachtelijke escalatie kost politiek kapitaal, maar wachten kost meer bij ransomware-recon.",
            },
          ],
        },
      },
      {
        id: cha_r1, type: "chaser", position: { x: 860, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: O_R1_CISO_RETAINER, afterRoundNumber: 1 },
          inject: {
            kind: "inject",
            type: "internal", channel: "email", urgency: "high",
            title: "Terugkoppeling — retainer niet ingeschakeld",
            content: "MDR-team zet ticket op 'awaiting client'. Attacker heeft nu 3 uur extra bewegingsruimte.",
            source: "MDR", senderName: "MDR SOC", timestamp: "08:15",
            targetTeam: "all",
          },
        },
      },

      // ── R2 — Meldplicht ───────────────────────────────────────────────────
      {
        id: r2, type: "round", position: { x: 1080, y: 200 },
        data: {
          kind: "round",
          title: "R2 — PII-lek bevestigd, meldplicht-klok tikt",
          situation_update: "Forensics bevestigt: attacker heeft data uit {{crownJewels}} geëxfiltreerd. 72u AP-klok loopt vanaf 05:12. NCSC 24u ook actief.",
          timerMinutes: 12,
          dynamic: { enabled: true, fillFrom: ["crownJewels"] },
        },
      },
      {
        id: inj_r2a, type: "inject", position: { x: 1120, y: 420 },
        data: {
          kind: "inject",
          type: "technical", channel: "email", urgency: "high",
          title: "Eye Security — 40MB PII bevestigd geëxfiltreerd",
          content: "Klantendata uit {{crownJewels}}. Attacker heeft persistence op 4 hosts. NCSC 24u loopt tot morgen 05:12.",
          source: "Eye Security", senderName: "Eye IR-lead", timestamp: "09:40",
          targetTeam: "all", deliverySeconds: 0,
          dynamic: { enabled: true, fillFrom: ["crownJewels"] },
        },
      },
      {
        id: dec_r2, type: "decision", position: { x: 1320, y: 200 },
        data: {
          kind: "decision",
          prompt: "R2 — Welke meldingen versturen we?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          perRole: true,
          options: [
            {
              id: O_R2_LEGAL_AP, label: "AP 72u concept + NCSC 24u waarschuwing parallel starten",
              allowedRole: "legal",
              scoreImpacts: { compliance_awareness: 3, decision_quality: 1 },
              qualityRank: "best",
              facilitatorCommentary: "De AP hanteert 'aannemelijk', niet 'bewezen'. Concept openen kost niets, uitstellen wel.",
            },
            {
              id: "r2-legal-wait", label: "Wachten met beide — 'eerst zekerheid'",
              allowedRole: "legal",
              scoreImpacts: { compliance_awareness: -3, decision_speed: -1 },
              qualityRank: "wrong",
              facilitatorCommentary: "AP komt proactief langs als jij niet komt. Boete-risico stijgt met elk uur.",
            },
            {
              id: "r2-legal-only-ap", label: "Alleen AP, NCSC pas als zeker is",
              allowedRole: "legal",
              scoreImpacts: { compliance_awareness: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Kritieke dienst uitgevallen = ook NCSC. Twee kloklijnen tegelijk.",
            },
            {
              id: "r2-ceo-sign", label: "Ondertekening delegeren aan Legal",
              allowedRole: "ceo",
              scoreImpacts: { decision_speed: 1, compliance_awareness: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Delegeren op operationele meldingen = goed mandaat-gebruik.",
            },
            {
              id: "r2-ceo-hold", label: "Eerst intern uitzoeken vóór ondertekening",
              allowedRole: "ceo",
              scoreImpacts: { decision_speed: -1, compliance_awareness: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "'Aannemelijk' en 'bewezen' kloppen juridisch niet op één lijn. Legal moet nu kunnen tekenen.",
            },
          ],
        },
      },
      {
        id: cha_r2, type: "chaser", position: { x: 1520, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: O_R2_LEGAL_AP, afterRoundNumber: 2 },
          inject: {
            kind: "inject",
            type: "regulatory", channel: "email", urgency: "critical",
            title: "AP mailt — 'wij ontvingen een klacht'",
            content: "'Klant meldt vermoedelijk lek. Kunt u toelichten of u dit gemeld heeft?'",
            source: "Autoriteit Persoonsgegevens", senderName: "AP toezicht", reliability: "fact", targetTeam: "all",
          },
        },
      },

      // ── R3 — Media ─────────────────────────────────────────────────────────
      {
        id: r3, type: "round", position: { x: 220, y: 720 },
        data: {
          kind: "round",
          title: "R3 — Media druk",
          situation_update: "Journalist heeft deadline 17:00, Twitter draait.",
          timerMinutes: 12,
        },
      },
      {
        id: inj_r3a, type: "inject", position: { x: 260, y: 940 },
        data: {
          kind: "inject",
          type: "media", channel: "email", urgency: "high",
          title: "NRC — deadline 60 minuten",
          content: "'Wij schrijven over de storing bij uw {{sector}}-organisatie. Reactie binnen 60 min.'",
          source: "NRC", senderName: "M. Vermeulen",
          targetTeam: "crisis_management", deliverySeconds: 0,
          dynamic: { enabled: true, fillFrom: ["sector"] },
        },
      },
      {
        id: inj_r3b, type: "inject", position: { x: 460, y: 940 },
        data: {
          kind: "inject",
          type: "social", channel: "news_ticker", urgency: "medium",
          title: "Twitter — screenshot gaat rond",
          content: "@techlekker: '{{sector}}-portaal ligt eruit — iemand die kan bevestigen? 🚨' — 890 retweets.",
          source: "X", senderName: "@techlekker",
          targetTeam: "all", deliverySeconds: 180,
          dynamic: { enabled: true, fillFrom: ["sector"] },
        },
      },
      {
        id: dec_r3, type: "decision", position: { x: 660, y: 720 },
        data: {
          kind: "decision",
          prompt: "R3 — Statement richting de journalist?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          perRole: true,
          options: [
            {
              id: O_R3_CEO_FORMAL, label: "Kort formeel statement via woordvoerder",
              allowedRole: "ceo",
              scoreImpacts: { communication_clarity: 3, decision_quality: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Formeel + kort + verifieerbaar. De veilige weg onder tijdsdruk.",
            },
            {
              id: "r3-ceo-nocomment", label: "'Geen commentaar'",
              allowedRole: "ceo",
              scoreImpacts: { communication_clarity: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Stilte wordt gevuld met speculatie.",
            },
            {
              id: "r3-ceo-interview", label: "Uitgebreid interview om vertrouwen te herstellen",
              allowedRole: "ceo",
              scoreImpacts: { communication_clarity: -2, decision_quality: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "Elk detail dat later niet blijkt te kloppen = tweede crisis.",
            },
            {
              id: "r3-legal-review", label: "Statement door Legal pre-review vóór publicatie",
              allowedRole: "legal",
              scoreImpacts: { compliance_awareness: 2, communication_clarity: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Kost 10 minuten, voorkomt uren narrigheid.",
            },
            {
              id: "r3-legal-postreview", label: "CEO tekent zelf, Legal reviewt post-hoc",
              allowedRole: "legal",
              scoreImpacts: { compliance_awareness: -1, decision_speed: 1 },
              qualityRank: "poor",
              facilitatorCommentary: "Snel = mooi, maar één juridisch verkeerde zin en je hebt een aansprakelijkheids-issue erbovenop.",
            },
          ],
        },
      },
      {
        id: cha_r3, type: "chaser", position: { x: 860, y: 940 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: O_R3_CEO_FORMAL, afterRoundNumber: 3 },
          inject: {
            kind: "inject",
            type: "media", channel: "news_ticker", urgency: "critical",
            title: "NRC-artikel live — kop stelliger dan gehoopt",
            content: "'{{sector}}-organisatie zwijgt over lek' — Twitter pikt de stilte op.",
            source: "NRC", senderName: "M. Vermeulen", reliability: "fact", targetTeam: "all",
            dynamic: { enabled: true, fillFrom: ["sector"] },
          },
        },
      },

      // ── R4 — Ransom ────────────────────────────────────────────────────────
      {
        id: r4, type: "round", position: { x: 1080, y: 720 },
        data: {
          kind: "round",
          title: "R4 — Ransom demand",
          situation_update: "Attacker post: '12u tot publicatie. 15 BTC of het gaat door.' Board-druk stijgt.",
          timerMinutes: 14,
        },
      },
      {
        id: inj_r4a, type: "inject", position: { x: 1120, y: 940 },
        data: {
          kind: "inject",
          type: "media", channel: "ransom_note", urgency: "critical",
          title: "Ransom note",
          content: "'12u tot publicatie. 15 BTC of het gaat door. Geen onderhandeling.' — TidalWave",
          source: "Attacker", senderName: "TidalWave", targetTeam: "all", deliverySeconds: 0,
        },
      },
      {
        id: dec_r4, type: "decision", position: { x: 1320, y: 720 },
        data: {
          kind: "decision",
          prompt: "R4 — Ransom-strategie?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          perRole: true,
          options: [
            {
              id: O_R4_CISO_VIA_EYE, label: "Onderhandelen via Eye Security, board tekent scope",
              allowedRole: "ciso",
              scoreImpacts: { decision_quality: 2, compliance_awareness: 2 },
              qualityRank: "best",
              facilitatorCommentary: "Sancties-check + narratieve controle + tijd winnen zonder direct te betalen.",
            },
            {
              id: "r4-ciso-noplay", label: "Niet betalen, geen onderhandeling",
              allowedRole: "ciso",
              scoreImpacts: { decision_quality: -1, communication_clarity: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Kán juist zijn, maar zonder onderhandelplan verspil je optionaliteit.",
            },
            {
              id: "r4-ciso-pay", label: "Direct 15 BTC betalen",
              allowedRole: "ciso",
              scoreImpacts: { decision_quality: -3, compliance_awareness: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "Zonder OFAC-check kan dit een sanctie-overtreding worden. Veel betalers krijgen alsnog geen key.",
            },
            {
              id: "r4-ceo-mandaat", label: "Scope-mandaat tekenen voor Eye Security onderhandeling",
              allowedRole: "ceo",
              scoreImpacts: { decision_speed: 1, decision_quality: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Scope-mandaat = Eye kan onderhandelen zonder dat je iets belooft.",
            },
            {
              id: "r4-ceo-veto", label: "Board-veto op elk gesprek",
              allowedRole: "ceo",
              scoreImpacts: { decision_speed: -2 },
              qualityRank: "poor",
              facilitatorCommentary: "Micro-mandaat vertraagt de onderhandeling. Attacker gebruikt de deadline tegen je.",
            },
          ],
        },
      },
      {
        id: cha_r4, type: "chaser", position: { x: 1520, y: 940 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: O_R4_CISO_VIA_EYE, afterRoundNumber: 4 },
          inject: {
            kind: "inject",
            type: "regulatory", channel: "email", urgency: "critical",
            title: "REROUTE — betaling zonder OFAC-check zou game over zijn",
            content: "[Facilitator reroute] Attacker-wallet 1 hop van OFAC-sanctielijst. In het echt: handhavings-incident + geen key.\n\nIn de oefening: fictief net geen sanctie-link. Verhaal loopt door.",
            source: "Facilitator", senderName: "Facilitator", reliability: "fact", targetTeam: "all",
          },
        },
      },

      // ── R5 — Herstel ──────────────────────────────────────────────────────
      {
        id: r5, type: "round", position: { x: 220, y: 1240 },
        data: {
          kind: "round",
          title: "R5 — Herstel + klantcommunicatie",
          situation_update: "Attacker gaf key na Eye-onderhandeling. Herstel + klantcomms staan op de rol.",
          timerMinutes: 12,
        },
      },
      {
        id: inj_r5a, type: "inject", position: { x: 260, y: 1460 },
        data: {
          kind: "inject",
          type: "technical", channel: "email", urgency: "medium",
          title: "Eye Security — key ontvangen, herstel kan starten",
          content: "Onderhandeling succesvol; attacker leverde key na scope-druk.",
          source: "Eye Security", senderName: "Eye IR-lead",
          targetTeam: "all", deliverySeconds: 0,
        },
      },
      {
        id: dec_r5, type: "decision", position: { x: 460, y: 1240 },
        data: {
          kind: "decision",
          prompt: "R5 — Herstel-aanpak + klantcommunicatie?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          perRole: true,
          options: [
            {
              id: O_R5_CISO_STRUCTURED, label: "Gestructureerd restore-plan met validation-checkpoints",
              allowedRole: "ciso",
              scoreImpacts: { decision_quality: 3 },
              qualityRank: "best",
              facilitatorCommentary: "Fases + validation voorkomt herhalings-compromise. Duurt langer maar duurzamer.",
            },
            {
              id: "r5-ciso-fast", label: "Snel volledige restore, validatie later",
              allowedRole: "ciso",
              scoreImpacts: { decision_speed: 2, decision_quality: -2 },
              qualityRank: "poor",
              facilitatorCommentary: "Attacker-persistence kan zo intact blijven. Trade-off tussen snelheid en zekerheid.",
            },
            {
              id: "r5-legal-24u", label: "Klanten binnen 24u informeren + FAQ + support-lijn",
              allowedRole: "legal",
              scoreImpacts: { communication_clarity: 2, compliance_awareness: 2 },
              qualityRank: "best",
              facilitatorCommentary: "Compliance + reputation-management in één beweging.",
            },
            {
              id: "r5-legal-later", label: "Klanten informeren zodra scope écht rond is",
              allowedRole: "legal",
              scoreImpacts: { communication_clarity: -2, compliance_awareness: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "AVG-eis is 'onverwijld'. Wachten geeft de indruk dat je iets verbergt.",
            },
          ],
        },
      },
      {
        id: cha_r5, type: "chaser", position: { x: 660, y: 1460 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: O_R5_CISO_STRUCTURED, afterRoundNumber: 5 },
          inject: {
            kind: "inject",
            type: "technical", channel: "siem", urgency: "high",
            title: "Follow-up compromise gedetecteerd",
            content: "3 dagen na restore: nieuwe verdachte activiteit. Attacker-persistence was niet volledig geruimd.",
            source: "MDR", senderName: "MDR SOC", reliability: "fact", targetTeam: "all",
          },
        },
      },

      // ── R6 — Debrief ──────────────────────────────────────────────────────
      {
        id: r6, type: "round", position: { x: 1080, y: 1240 },
        data: {
          kind: "round",
          title: "R6 — Debrief",
          situation_update: "Incident gestabiliseerd. De outcome wordt automatisch gekozen op basis van jullie cumulatieve dimensie-score.",
          timerMinutes: 8,
        },
      },
      {
        id: inj_r6, type: "inject", position: { x: 1120, y: 1460 },
        data: {
          kind: "inject",
          type: "internal", channel: "memo", urgency: "low",
          title: "Debrief-start",
          content: "Bekijk het rapport voor de per-dimensie breakdown en de outcome-band waarin jullie score valt.",
          source: "Facilitator", senderName: "Facilitator", targetTeam: "all", deliverySeconds: 0,
        },
      },

      // ── Outcomes — engine kiest op cumulatieve score ─────────────────────
      {
        id: out_gold, type: "outcome", position: { x: 1420, y: 1140 },
        data: {
          kind: "outcome", key: "outcome_gold",
          label: "★ Gold — Voorbeeldige respons",
          narrative: "Eye direct actief, meldingen op tijd, communicatie strak, herstel gestructureerd.",
          scoreImpact: 0, scoreRange: { min: 14 },
          lessonLearned: "Consistente combinatie van snelheid, kwaliteit én compliance.",
        },
      },
      {
        id: out_silver, type: "outcome", position: { x: 1420, y: 1280 },
        data: {
          kind: "outcome", key: "outcome_silver",
          label: "Silver — Solide met kleine kreuken",
          narrative: "Meeste keuzes goed, één of twee trade-offs kostten punten op één dimensie.",
          scoreImpact: 0, scoreRange: { min: 5, max: 13 },
          lessonLearned: "Kijk terug op welke dimensie het meest afwijkt.",
        },
      },
      {
        id: out_bronze, type: "outcome", position: { x: 1420, y: 1420 },
        data: {
          kind: "outcome", key: "outcome_bronze",
          label: "Bronze — Wisselvallig",
          narrative: "Meerdere keuzes traag of niet-consistent. Meldplicht net op tijd.",
          scoreImpact: 0, scoreRange: { min: -3, max: 4 },
          lessonLearned: "Rol-mandaten waren onduidelijk; team wachtte vaak op elkaar.",
        },
      },
      {
        id: out_meltdown, type: "outcome", position: { x: 1420, y: 1560 },
        data: {
          kind: "outcome", key: "outcome_meltdown",
          label: "Meltdown — reroute nodig gehad",
          narrative: "Reroute-injects moesten worden ingezet — in werkelijkheid was er materiële schade en handhavings-risico.",
          scoreImpact: 0, scoreRange: { max: -4 },
          lessonLearned: "De reroute is oefeningshulp. In het echt onomkeerbaar.",
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      // R1: round → injects, round → decision, decision → r2
      { id: id("e"), source: r1, target: inj_r1a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r1, target: inj_r1b, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r1, target: dec_r1, type: "sequence" },
      { id: id("e"), source: dec_r1, target: r2, type: "sequence" },
      // R2
      { id: id("e"), source: r2, target: inj_r2a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r2, target: dec_r2, type: "sequence" },
      { id: id("e"), source: dec_r2, target: r3, type: "sequence" },
      // R3
      { id: id("e"), source: r3, target: inj_r3a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r3, target: inj_r3b, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r3, target: dec_r3, type: "sequence" },
      { id: id("e"), source: dec_r3, target: r4, type: "sequence" },
      // R4
      { id: id("e"), source: r4, target: inj_r4a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r4, target: dec_r4, type: "sequence" },
      { id: id("e"), source: dec_r4, target: r5, type: "sequence" },
      // R5
      { id: id("e"), source: r5, target: inj_r5a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r5, target: dec_r5, type: "sequence" },
      { id: id("e"), source: dec_r5, target: r6, type: "sequence" },
      // R6
      { id: id("e"), source: r6, target: inj_r6, sourceHandle: "injects", type: "inject" },
      // Outcomes — engine kiest op scoreRange
      { id: id("e"), source: r6, target: out_silver, type: "outcome" },
      { id: id("e"), source: r6, target: out_gold, type: "outcome" },
      { id: id("e"), source: r6, target: out_bronze, type: "outcome" },
      { id: id("e"), source: r6, target: out_meltdown, type: "outcome" },
    ],
  }
}
