import type { ScenarioGraph } from "./types"
import { EYE_SECURITY_RETAINER, meldplichtFromProfile } from "./types"

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

// NIS2 Meldplicht Pressure Test —
// Uitgebreide showcase (6 rondes, 3 rollen: CISO / Legal / CEO) waarin elke
// verkeerde keuze punten kost én een follow-up chaser met facilitator-hint
// oplevert; het hoofdverhaal loopt hoe dan ook door. R1 en R3 injects zijn
// dynamisch — {{sector}} en {{criticalSystems}} worden gevuld bij sessie-start.
export function meldplichtPressureExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round")
  const r4 = id("round"), r5 = id("round"), r6 = id("round")

  const inj_r1 = id("inj"), inj_r2 = id("inj"), inj_r3a = id("inj"), inj_r3b = id("inj")
  const inj_r4 = id("inj"), inj_r5 = id("inj")

  const dec_r1 = id("dec"), dec_r2 = id("dec"), dec_r3 = id("dec"), dec_r4 = id("dec")

  const cha_r1 = id("cha"), cha_r2 = id("cha"), cha_r3 = id("cha"), cha_r4 = id("cha")

  const out_clean = id("out"), out_partial = id("out"), out_mishandled = id("out")

  // Correct-option roleActionIds — the chaser fires with `decision_not_taken`
  // when the "right" action isn't submitted, so wrong choices trigger the
  // facilitator-hint inject in the next round without branching the graph.
  const A_R1_ACTIVATE = "r1-activate-retainer"
  const A_R2_PREPARE_AP = "r2-prepare-ap"
  const A_R3_FORMAL_STATEMENT = "r3-formal-statement"
  const A_R4_VIA_RETAINER = "r4-via-retainer"

  return {
    id: id("graph"),
    name: "★ NIS2 Meldplicht Pressure Test",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    meldplicht: meldplichtFromProfile('both', { incidentDetectedAt: 'round_1' }),
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },

      // ── R1 ────────────────────────────────────────────────────────────────
      {
        id: r1,
        type: "round",
        position: { x: 220, y: 200 },
        data: {
          kind: "round",
          title: "R1 — Detectie & twijfel",
          situation_update:
            "Om 02:47 rapporteert de MDR-provider een reeks verdachte gedragingen op meerdere endpoints. " +
            "Scope is nog onduidelijk. Het is 03:00 op zondag. De vraag: escaleren we nu of wachten we tot ochtend?",
          timerMinutes: 12,
          bobPhase: "beeldvorming",
          evaluationAspects: ["nis2", "lessons_learned"],
          openingPrompts: [
            "Wat weten we zeker, wat zijn aannames?",
            "Wie moet nu al aan tafel — CISO, Legal, CEO?",
            "Waar ligt de drempel om Eye Security te bellen?",
          ],
          roleActions: [
            {
              id: A_R1_ACTIVATE,
              label: "CISO: activeer Eye Security retainer (24/7)",
              description: "Bel het 24/7-nummer, geef incident-samenvatting, vraag om forensische support.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              consequence: "Eye Security draait binnen 15 min mee — snelheid van analyse verdubbelt.",
            },
            {
              id: "r1-wait",
              label: "CEO: wacht tot 08:00 en beoordeel dan",
              description: "Verzamel eerst intern beeld voordat externe partij wordt ingeschakeld.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              consequence: "MDR laat het bij een ticket; verspreiding blijft onopgemerkt tot maandag.",
            },
            {
              id: "r1-legal-early",
              label: "Legal: check meldplicht-trigger",
              description: "Legal opent de meldplicht-checklist en houdt de 24u/72u klok warm.",
              allowedRoles: ["legal"], irPlanAligned: true,
              consequence: "Klok staat scherp — geen verrassingen bij escalatie.",
            },
          ],
          learningObjectives: [
            { id: "obj-r1", description: "Team activeert retainer binnen 30 minuten", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: [A_R1_ACTIVATE] },
          ],
          facilitatorNotes: {
            discussionGoal: "Test escalatiedrempel bij ambigue signalen.",
            keyQuestions: ["Welk signaal is genoeg om Eye te bellen?", "Wie mag dit besluit nemen buiten kantooruren?"],
            hints: ["Eye Security-retainer is 24/7 — géén reden om te wachten."],
            expectedDecisions: ["Retainer activeren", "Legal warmt meldplicht-klok"],
            redFlags: ["Team wacht tot ochtend", "Alleen CISO beslist, geen Legal-check"],
          },
        },
      },
      {
        id: inj_r1,
        type: "inject",
        position: { x: 260, y: 420 },
        data: {
          kind: "inject",
          type: "alert", channel: "siem", urgency: "high",
          title: "MDR-alert — Anomalie op {{criticalSystems}}",
          content:
            "MDR-provider meldt 03:11: verdachte lateral-movement patroon op {{criticalSystems}} bij {{sector}}-organisatie. " +
            "3 endpoints tonen encoded PowerShell + off-hours logins. Nog geen bevestigde encryptie. " +
            "Escalatie vereist voor scoping.",
          source: "MDR", senderName: "MDR SOC on-call", timestamp: "03:11",
          targetTeam: "all", nis2Relevant: true,
          reliability: "assumption",
          evaluationAspects: ["reliability", "nis2"],
          dynamic: { enabled: true, fillFrom: ["sector", "criticalSystems"] },
        },
      },
      {
        id: dec_r1,
        type: "decision",
        position: { x: 460, y: 220 },
        data: {
          kind: "decision",
          prompt: "R1 — Activeren we Eye Security nu of wachten we tot 08:00?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "ciso",
          options: [
            {
              id: id("opt"), label: "Bel Eye Security nu (24/7)",
              roleActionId: A_R1_ACTIVATE,
              scoreImpact: 2, linkedDimension: "escalation_timing",
              lessonLearned: "Retainer om 03:00 activeren spaart uren analyse-tijd bij bevestigd incident.",
            },
            {
              id: id("opt"), label: "Wachten tot 08:00 — team wakker maken kost politiek kapitaal",
              scoreImpact: -2, linkedDimension: "decision_speed",
              lessonLearned: "Wachten = attacker heeft 5 uur extra om te bewegen. Meldplicht-klok tikt door.",
            },
            {
              id: id("opt"), label: "Vraag MDR om meer info voor beslissing",
              scoreImpact: -1, linkedDimension: "decision_quality",
              lessonLearned: "MDR heeft niet meer info dan wat je al hebt — beslissen op onvolledige info hoort erbij.",
            },
          ],
          supervisionAreas: ["notification_duty", "technical_response"],
        },
      },
      {
        id: cha_r1,
        type: "chaser",
        position: { x: 660, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R1_ACTIVATE, afterRoundNumber: 1 },
          inject: {
            kind: "inject",
            type: "internal", channel: "email", urgency: "high",
            title: "Terugkoppeling — retainer niet geactiveerd",
            content:
              "MDR-team stopt met alert-follow-up: geen escalatie ontvangen, ze zetten het incident op 'awaiting client'. " +
              "Attacker heeft 4 uur ruimte gekregen om lateraal te bewegen. " +
              "\n\n[Facilitator-hint] Dit is de kostenpost van 'wachten tot ochtend' — je krijgt geen tweede kans in R2.",
            source: "MDR", senderName: "MDR SOC", timestamp: "07:12",
            targetTeam: "all", reliability: "fact",
          },
        },
      },

      // ── R2 ────────────────────────────────────────────────────────────────
      {
        id: r2,
        type: "round",
        position: { x: 880, y: 200 },
        data: {
          kind: "round",
          title: "R2 — Impact wordt scherp",
          situation_update:
            "Forensics bevestigt: één van de systemen bevat een klantendatabase met PII. " +
            "Meerdere klantportalen zijn offline. De 72-uurs AP-klok tikt vanaf detectiemoment (03:11).",
          timerMinutes: 12,
          bobPhase: "oordeel",
          evaluationAspects: ["nis2", "lessons_learned"],
          roleActions: [
            {
              id: A_R2_PREPARE_AP,
              label: "Legal: start AP-melding voorbereiden",
              description: "Concept 72u-melding openen; Eye Security levert forensische feiten aan.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              consequence: "Melding klaar voor review binnen 24u van klok-start.",
            },
            {
              id: "r2-hold",
              label: "CEO: 'eerst intern uitzoeken' — wacht met melding",
              description: "Legal krijgt opdracht om nog niet aan de AP te melden totdat de scope zeker is.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              consequence: "AP-klok tikt door; risico op boete én proactieve controle.",
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test of team meldplicht-72u serieus neemt onder onzekerheid.",
            keyQuestions: ["Is een 'aannemelijk' PII-lek genoeg om te melden?", "Wie tekent de melding?"],
            hints: ["De AP wil weten dat je melden zodra het aannemelijk is — niet pas bij zekerheid."],
            expectedDecisions: ["AP-melding starten", "Eye Security levert feiten aan Legal"],
            redFlags: ["Wachten op volledige scope", "Alleen CISO betrokken bij melding"],
          },
        },
      },
      {
        id: inj_r2,
        type: "inject",
        position: { x: 920, y: 420 },
        data: {
          kind: "inject",
          type: "technical", channel: "email", urgency: "high",
          title: "Eye Security — Interim forensisch beeld",
          content:
            "Bevestigd: exfiltratie van ~40MB uit CRM-database (2 tabellen: klanten, contactpersonen). " +
            "Encryptie nog niet actief, maar attacker heeft persistence op 4 hosts. " +
            "Klok voor NCSC 24u-waarschuwing loopt tot 03:11 morgen.",
          source: "Eye Security", senderName: "Eye IR-lead", timestamp: "09:40",
          targetTeam: "all", nis2Relevant: true, reliability: "fact",
        },
      },
      {
        id: dec_r2,
        type: "decision",
        position: { x: 1120, y: 220 },
        data: {
          kind: "decision",
          prompt: "R2 — Bereidt Legal nu de 72u AP-melding voor?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "legal",
          options: [
            {
              id: id("opt"), label: "Ja, start concept-melding; feiten via Eye Security",
              roleActionId: A_R2_PREPARE_AP,
              scoreImpact: 3, linkedDimension: "compliance_awareness",
              lessonLearned: "Aannemelijk PII-lek = melden. Concept openen kost niets, uitstellen wel.",
            },
            {
              id: id("opt"), label: "Wacht — 'we willen eerst zeker weten'",
              scoreImpact: -3, linkedDimension: "compliance_awareness",
              lessonLearned: "AP hanteert 'aannemelijk', niet 'bewezen'. Wachten geeft proactieve controle-risico.",
            },
            {
              id: id("opt"), label: "Melden bij AP maar niet bij NCSC",
              scoreImpact: -1, linkedDimension: "mandate_clarity",
              lessonLearned: "Kritieke dienst uitgevallen = ook NCSC 24u-waarschuwing. Twee kloklijnen tegelijk.",
            },
          ],
          supervisionAreas: ["notification_duty"],
        },
      },
      {
        id: cha_r2,
        type: "chaser",
        position: { x: 1320, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R2_PREPARE_AP, afterRoundNumber: 2 },
          inject: {
            kind: "inject",
            type: "regulatory", channel: "email", urgency: "critical",
            title: "AP heeft signaal opgevangen — komt bij ons",
            content:
              "AP mailt: 'wij ontvingen een klacht van klant X over vermoedelijk PII-lek. Kunt u toelichten of u dit gemeld heeft?' " +
              "\n\n[Facilitator-hint] Als je de 72u-melding niet zelf opende, komt de AP nú naar jou — proactief. " +
              "Boete-risico stijgt substantieel.",
            source: "Autoriteit Persoonsgegevens", senderName: "AP toezicht", timestamp: "17:22",
            targetTeam: "all", reliability: "fact",
          },
        },
      },

      // ── R3 ────────────────────────────────────────────────────────────────
      {
        id: r3,
        type: "round",
        position: { x: 220, y: 720 },
        data: {
          kind: "round",
          title: "R3 — Media pressure",
          situation_update:
            "Een journalist heeft lucht gekregen. Er staat een tweet met een screenshot van jullie offline klantportaal. " +
            "Binnen een uur belt de journalist voor commentaar.",
          timerMinutes: 12,
          bobPhase: "oordeel",
          evaluationAspects: ["nis2", "lessons_learned"],
          roleActions: [
            {
              id: A_R3_FORMAL_STATEMENT,
              label: "CEO: kort formeel statement via woordvoerder",
              description: "Feiten die publiek zijn + geruststelling; verwijzen naar Eye Security als IR-partij.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              consequence: "Journalist heeft quote; controle over narratief blijft bij jou.",
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Communicatie onder tijdsdruk zonder feiten weg te geven die forensics tegenspreekt.",
            keyQuestions: ["Wat is de 'confirmed truth' die we kunnen delen?", "Wie is woordvoerder?"],
            hints: ["Kort en formeel > detail. Wie details geeft die later kloppen niet, verliest twee keer."],
            expectedDecisions: ["Formeel statement", "CEO als eindverantwoordelijk"],
            redFlags: ["Directe uitspraak zonder afstemming forensics", "Geen commentaar → gat wordt gevuld met speculatie"],
          },
        },
      },
      {
        id: inj_r3a,
        type: "inject",
        position: { x: 260, y: 940 },
        data: {
          kind: "inject",
          type: "media", channel: "email", urgency: "high",
          title: "Journalist — deadline 60 minuten",
          content:
            "'Wij bereiden een artikel voor over de storing bij uw {{sector}}-organisatie. " +
            "Klopt het dat klantgegevens zijn buitgemaakt? Wij publiceren om 18:00. Reactie graag binnen 60 min.'",
          source: "Journalist NRC", senderName: "M. Vermeulen", senderHandle: "mvermeulen@nrc.nl",
          timestamp: "17:00",
          targetTeam: "crisis_management",
          reliability: "fact",
          evaluationAspects: ["reliability", "nis2"],
          dynamic: { enabled: true, fillFrom: ["sector"] },
        },
      },
      {
        id: inj_r3b,
        type: "inject",
        position: { x: 460, y: 940 },
        data: {
          kind: "inject",
          type: "social", channel: "news_ticker", urgency: "medium",
          title: "Twitter — screenshot van offline portaal gaat rond",
          content:
            "@techlekker: 'Klantportaal van {{sector}}-speler ligt eruit — iemand die kan bevestigen dat dit een cyberaanval is? 👀' (312 retweets)",
          source: "Twitter", senderName: "@techlekker", timestamp: "16:48",
          targetTeam: "all",
          reliability: "assumption",
          dynamic: { enabled: true, fillFrom: ["sector"] },
        },
      },
      {
        id: dec_r3,
        type: "decision",
        position: { x: 660, y: 740 },
        data: {
          kind: "decision",
          prompt: "R3 — Wat is ons statement richting de journalist?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "ceo",
          options: [
            {
              id: id("opt"), label: "Kort formeel statement via woordvoerder — feiten die publiek zijn",
              roleActionId: A_R3_FORMAL_STATEMENT,
              scoreImpact: 2, linkedDimension: "communication_clarity",
              lessonLearned: "Formeel, kort, controleerbaar — dat is de veilige weg onder tijdsdruk.",
            },
            {
              id: id("opt"), label: "Geen commentaar — 'we onderzoeken het'",
              scoreImpact: -1, linkedDimension: "communication_clarity",
              lessonLearned: "Stilte wordt gevuld met speculatie. Je verliest het narratief.",
            },
            {
              id: id("opt"), label: "Directe uitspraak: 'Er is niets aan de hand, alles onder controle'",
              scoreImpact: -4, linkedDimension: "framework_adherence",
              lessonLearned: "Elk detail dat later niet klopt, is een tweede crisis. Nooit ontkennen wat je niet zeker weet.",
            },
          ],
          supervisionAreas: ["technical_response", "board_decision_making"],
        },
      },
      {
        id: cha_r3,
        type: "chaser",
        position: { x: 860, y: 940 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R3_FORMAL_STATEMENT, afterRoundNumber: 3 },
          inject: {
            kind: "inject",
            type: "media", channel: "news_ticker", urgency: "critical",
            title: "NRC-artikel live — quote spreekt forensics tegen",
            content:
              "NRC publiceert 17:58: 'Woordvoerder ontkent dat klantdata is buitgemaakt' — terwijl Eye Security in R2 exfiltratie bevestigde. " +
              "Twitter pikt de tegenspraak op binnen 6 minuten. " +
              "\n\n[Facilitator-hint] Dit is waarom 'we hebben niks te verbergen' zonder afstemming forensics gevaarlijk is. Verhaal loopt door, maar reputatiepunt verloren.",
            source: "NRC", senderName: "M. Vermeulen", timestamp: "17:58",
            targetTeam: "all", reliability: "fact",
          },
        },
      },

      // ── R4 ────────────────────────────────────────────────────────────────
      {
        id: r4,
        type: "round",
        position: { x: 220, y: 1240 },
        data: {
          kind: "round",
          title: "R4 — Ransom demand",
          situation_update:
            "Attacker post op zijn leak-site: '48 uur tot publicatie van 40MB klantdata, tenzij 15 BTC binnen 24u.' " +
            "Board-druk stijgt: 'kunnen we dit gewoon regelen?'",
          timerMinutes: 15,
          bobPhase: "besluit",
          evaluationAspects: ["nis2", "decision_impact", "lessons_learned"],
          roleActions: [
            {
              id: A_R4_VIA_RETAINER,
              label: "CISO: onderhandeling loopt via Eye Security, geen directe betaling",
              description: "Alle communicatie met attacker via IR-partij; board tekent scope-mandaat.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              consequence: "Sanctie-check + narratieve controle. Tijd wordt gekocht zonder direct te betalen.",
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Board-druk vs juridische en OFAC-risico's rond ransom-betaling.",
            keyQuestions: ["Wie mag betaling autoriseren?", "Weten we of attacker op sanctielijst staat?"],
            hints: ["Direct betalen zonder OFAC-check kan boete opleveren. Retainer doet die check standaard."],
            expectedDecisions: ["Via Eye Security onderhandelen", "OFAC-check afwachten"],
            redFlags: ["Direct BTC-transactie", "CEO tekent zonder Legal-check"],
          },
        },
      },
      {
        id: inj_r4,
        type: "inject",
        position: { x: 260, y: 1460 },
        data: {
          kind: "inject",
          type: "media", channel: "ransom_note", urgency: "critical",
          title: "Leak-site — 48u tot publicatie",
          content:
            "'Wij hebben 40MB klantdata. 15 BTC binnen 24u naar wallet bc1q... — anders publiceren wij op onze leak-site. Geen onderhandeling.' — TidalWave Collective",
          source: "Attacker", senderName: "TidalWave", timestamp: "19:22",
          targetTeam: "all", nis2Relevant: true, reliability: "fact",
        },
      },
      {
        id: dec_r4,
        type: "decision",
        position: { x: 460, y: 1260 },
        data: {
          kind: "decision",
          prompt: "R4 — Betalen, niet betalen, of via Eye Security onderhandelen?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "ceo",
          options: [
            {
              id: id("opt"), label: "Onderhandelen via Eye Security — geen directe betaling",
              roleActionId: A_R4_VIA_RETAINER,
              scoreImpact: 2, linkedDimension: "decision_quality",
              lessonLearned: "IR-partij checkt sancties, koopt tijd, houdt narratief onder controle.",
            },
            {
              id: id("opt"), label: "Niet betalen — 'we accepteren de publicatie'",
              scoreImpact: -2, linkedDimension: "decision_quality",
              lessonLearned: "Kán juist zijn, maar zonder onderhandelplan verspil je optionaliteit.",
            },
            {
              id: id("opt"), label: "Betalen — 'gewoon oplossen, board tekent'",
              scoreImpact: -5, linkedDimension: "framework_adherence",
              lessonLearned: "Zonder OFAC-check = boete-risico + geen garantie op non-publicatie.",
            },
          ],
          supervisionAreas: ["technical_response", "board_decision_making"],
        },
      },
      {
        id: cha_r4,
        type: "chaser",
        position: { x: 660, y: 1460 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R4_VIA_RETAINER, afterRoundNumber: 4 },
          inject: {
            kind: "inject",
            type: "regulatory", channel: "email", urgency: "critical",
            title: "OFAC-listing geconstateerd door forensics",
            content:
              "Eye Security laat weten: attacker-wallet is 1 hop verwijderd van een OFAC-sanctielijst-cluster (bekende Russische groep). " +
              "\n\n[Facilitator-hint] Als je had gekozen om te betalen, was dit een sanctie-overtreding geworden. Verhaal loopt door, punt is duur gemaakt.",
            source: "Eye Security", senderName: "Eye compliance", timestamp: "20:14",
            targetTeam: "all", reliability: "fact",
          },
        },
      },

      // ── R5 ────────────────────────────────────────────────────────────────
      {
        id: r5,
        type: "round",
        position: { x: 880, y: 1240 },
        data: {
          kind: "round",
          title: "R5 — 24u/72u checkpoint",
          situation_update:
            "48 uur na detectie. Klok-check: 24u NCSC-waarschuwing en 72u AP-melding staan op agenda. " +
            "Deze ronde is een compliance-checkpoint — geen nieuwe keuze, wel een reflectie.",
          timerMinutes: 8,
          bobPhase: "beeldvorming",
          evaluationAspects: ["nis2"],
          learningObjectives: [
            { id: "obj-r5", description: "Team gebruikt de compliance-panel om coverage te checken", module: "legal_regulatory", measuredBy: "manual" },
          ],
          facilitatorNotes: {
            discussionGoal: "Ruimte voor debrief-moment over meldplicht-status.",
            keyQuestions: ["Welke meldingen staan?", "Welke NIS2-gebieden hebben we geraakt?"],
            hints: ["Open het compliance-paneel links en loop de coverage af."],
            expectedDecisions: [],
            redFlags: ["Team overslaat compliance-check"],
          },
        },
      },
      {
        id: inj_r5,
        type: "inject",
        position: { x: 920, y: 1460 },
        data: {
          kind: "inject",
          type: "internal", channel: "memo", urgency: "medium",
          title: "Compliance-checkpoint — status meldingen",
          content:
            "24u-waarschuwing NCSC: [status volgens jouw acties]\n" +
            "72u-melding AP: [status volgens jouw acties]\n" +
            "Retainer-log: Eye Security betrokken sinds R1/R2/R3 — check timeline in debrief.",
          source: "Facilitator", senderName: "Facilitator",
          targetTeam: "all", reliability: "fact",
        },
      },

      // ── R6 ────────────────────────────────────────────────────────────────
      {
        id: r6,
        type: "round",
        position: { x: 1320, y: 1240 },
        data: {
          kind: "round",
          title: "R6 — Debrief & outcome",
          situation_update:
            "Het incident is afgeschaald. Wat blijft: 3 keuzes die eraf hingen (retainer, AP-melding, ransom-route) " +
            "plus je publieke narratief. Ga naar de outcome-node die past bij jullie cumulatieve score.",
          timerMinutes: 10,
          evaluationAspects: ["lessons_learned"],
          learningObjectives: [
            { id: "obj-r6", description: "Team benoemt 3 concrete verbeteringen", module: "recovery_lessons", measuredBy: "manual" },
          ],
          facilitatorNotes: {
            discussionGoal: "Confronteren met de cumulatieve gevolgen van elke keuze.",
            keyQuestions: ["Waar was het duurste moment?", "Welke rol had een dubbel-check kunnen doen?"],
            hints: [],
            expectedDecisions: [],
            redFlags: [],
          },
        },
      },

      // ── Outcomes ─────────────────────────────────────────────────────────
      {
        id: out_clean,
        type: "outcome",
        position: { x: 1620, y: 1140 },
        data: {
          kind: "outcome",
          key: "outcome_clean",
          label: "Schone crisis — retainer + meldingen goed",
          narrative:
            "Eye Security binnen 30 min actief. AP- en NCSC-meldingen tijdig ingediend. Statement kort en formeel — narratief bleef bij jou. " +
            "Geen sanctie-risico, geen mediastorm.",
          scoreImpact: 4, linkedDimension: "framework_adherence",
          lessonLearned: "De keten retainer → feiten → melden → statement is één beweging. Als één schakel wacht, betaal je het later.",
        },
      },
      {
        id: out_partial,
        type: "outcome",
        position: { x: 1620, y: 1280 },
        data: {
          kind: "outcome",
          key: "outcome_partial",
          label: "Gemengd — één of twee keuzes fout",
          narrative:
            "Meldingen zijn gedaan, maar tempo of communicatie was matig. Reputatieschade beperkt maar zichtbaar.",
          scoreImpact: 0, linkedDimension: "decision_quality",
          lessonLearned: "Elk uur uitstel op meldplicht kost oefening-punten én in het echt bijna zeker euro's.",
        },
      },
      {
        id: out_mishandled,
        type: "outcome",
        position: { x: 1620, y: 1420 },
        data: {
          kind: "outcome",
          key: "outcome_mishandled",
          label: "Slecht afgehandeld — meerdere fouten stapelen",
          narrative:
            "Retainer laat geactiveerd, AP kwam proactief langs, statement sprak forensics tegen, ransom-vraag zonder OFAC-check. " +
            "Boete-risico stijgt substantieel; klant-vertrouwen laag.",
          scoreImpact: -4, linkedDimension: "framework_adherence",
          lessonLearned: "Elke schakel apart voelde 'niet zo erg' — samen wordt het een compliance-boete én een reputatiecrisis.",
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: inj_r1, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r1, target: dec_r1, type: "sequence" },
      { id: id("e"), source: dec_r1, target: r2, type: "sequence" },
      { id: id("e"), source: r2, target: inj_r2, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r2, target: dec_r2, type: "sequence" },
      { id: id("e"), source: dec_r2, target: r3, type: "sequence" },
      { id: id("e"), source: r3, target: inj_r3a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r3, target: inj_r3b, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r3, target: dec_r3, type: "sequence" },
      { id: id("e"), source: dec_r3, target: r4, type: "sequence" },
      { id: id("e"), source: r4, target: inj_r4, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r4, target: dec_r4, type: "sequence" },
      { id: id("e"), source: dec_r4, target: r5, type: "sequence" },
      { id: id("e"), source: r5, target: inj_r5, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r5, target: r6, type: "sequence" },
      { id: id("e"), source: r6, target: out_clean, type: "outcome" },
      { id: id("e"), source: r6, target: out_partial, type: "outcome" },
      { id: id("e"), source: r6, target: out_mishandled, type: "outcome" },
    ],
  }
}
