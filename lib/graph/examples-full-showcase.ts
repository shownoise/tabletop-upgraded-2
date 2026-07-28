import type { ScenarioGraph } from "./types"
import { DEFAULT_FEATURES, EYE_SECURITY_RETAINER, meldplichtFromProfile } from "./types"

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

// Full Showcase — 7 rondes, 3 rollen (CISO / Legal / CEO), side stories,
// score-bandbreedte auto-outcome, en "scenario-stoppende" foutkeuzes die
// via een reroute-inject wél doorlopen zodat de oefening niet dood valt.
//
// Doel: één scenario waarin élk mechanisme zichtbaar is:
// - dynamische tokens ({{sector}}, {{criticalSystems}}, {{crownJewels}})
// - reliability-labels (feit / aanname / misleidend)
// - NIS2-coverage + meldplicht
// - decision scoring per dimensie
// - cumulatieve score kiest outcome via scoreRange
// - chasers voor wrong choices (verhaal loopt door)
// - side stories die pas triggeren bij bepaalde keuzes
export function fullShowcaseExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round"), r4 = id("round")
  const r5 = id("round"), r6 = id("round"), r7 = id("round")

  const inj_r1a = id("inj"), inj_r1b = id("inj")
  const inj_r2a = id("inj"), inj_r2b_insider = id("inj")
  const inj_r3a = id("inj")
  const inj_r4_journo = id("inj"), inj_r4_twitter = id("inj"), inj_r4_misleading = id("inj")
  const inj_r5_ransom = id("inj")
  const inj_r6_board = id("inj")
  const inj_r7 = id("inj")

  const dec_r1 = id("dec"), dec_r2 = id("dec"), dec_r3 = id("dec"), dec_r4 = id("dec")
  const dec_r5 = id("dec"), dec_r6 = id("dec")

  const cha_r1 = id("cha"), cha_r2_insider = id("cha"), cha_r3 = id("cha"), cha_r4 = id("cha")
  const cha_r5_reroute = id("cha"), cha_r6_reroute = id("cha")

  const out_gold = id("out"), out_silver = id("out"), out_bronze = id("out"), out_iron = id("out"), out_meltdown = id("out")

  // Roles-actions that count as "correct" choice — the chasers key on absence of these.
  const A_R1_ACTIVATE = "r1-activate-retainer"
  const A_R2_INSIDER_ESCALATE = "r2-insider-escalate"
  const A_R3_AP_START = "r3-ap-start"
  const A_R4_FORMAL = "r4-formal-statement"
  const A_R5_STRUCTURED_ISOLATE = "r5-structured-isolate"
  const A_R6_STRUCTURED_RESTORE = "r6-structured-restore"

  return {
    id: id("graph"),
    name: "★★ Full Showcase — Supply-chain Ransomware bij ziekenhuis",
    version: 1,
    scenarioType: "supply_chain_compromise",
    createdAt: now,
    updatedAt: now,
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    meldplicht: meldplichtFromProfile('both', { incidentDetectedAt: 'round_1' }),
    features: DEFAULT_FEATURES,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },

      // ── R1 — Detectie & activatie ───────────────────────────────────────
      {
        id: r1,
        type: "round",
        position: { x: 220, y: 200 },
        data: {
          kind: "round",
          title: "R1 — Vreemd alert vanaf leverancier",
          situation_update:
            "Om 05:22 laat MDR weten: verdachte outbound-verbindingen vanaf servers die door een derde partij worden beheerd. " +
            "De leverancier levert firmware-updates aan {{criticalSystems}}. Scope onduidelijk, maar het patroon lijkt op een supply-chain compromise.",
          timerMinutes: 12,
          bobPhase: "beeldvorming",
          evaluationAspects: ["reliability", "nis2"],
          openingPrompts: [
            "Wat weten we zeker vs wat is aanname?",
            "Hebben we alle systemen van de leverancier in beeld?",
            "Wie belt de leverancier én de retainer?",
          ],
          roleActions: [
            { id: A_R1_ACTIVATE, label: "CISO: activeer Eye Security en de leverancier gelijktijdig",
              description: "Beide kanten uit: forensics via Eye Security + leverancier vraagt om patch-historie.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              consequence: "Binnen 30 min heb je feiten van beide kanten en kan je scope inperken." },
            { id: "r1-only-vendor", label: "CEO: bel alleen leverancier, laat retainer erbuiten",
              description: "'Eerst zien of het niet aan hun kant zit'.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              consequence: "Leverancier ontkent, spoor loopt dood — je hebt geen eigen forensics." },
          ],
          learningObjectives: [
            { id: "obj-r1", description: "Retainer én leverancier tegelijk geactiveerd binnen 30 min", module: "detection_sensemaking", measuredBy: "decision", triggerActionIds: [A_R1_ACTIVATE] },
          ],
          facilitatorNotes: {
            discussionGoal: "Testen of team supply-chain incidenten anders behandelt dan interne incidenten.",
            keyQuestions: ["Wie is technisch én contractueel eigenaar van de leverancier-integratie?"],
            hints: ["De leverancier heeft een belang bij bagatelliseren. Eigen forensics is niet-onderhandelbaar."],
            expectedDecisions: ["Retainer + leverancier tegelijk"],
            redFlags: ["Alleen leverancier vertrouwen"],
          },
        },
      },
      {
        id: inj_r1a,
        type: "inject",
        position: { x: 260, y: 420 },
        data: {
          kind: "inject",
          type: "alert", channel: "siem", urgency: "high",
          title: "MDR — supply-chain hit op {{criticalSystems}}",
          content:
            "Outbound naar onbekend AS-nummer vanaf 3 hosts die {{criticalSystems}} draaien. " +
            "Verbindingen komen na een firmware-update van leverancier Meddix (vanmorgen 02:14). " +
            "Sector-context: {{sector}}. Zone: PROD.",
          source: "MDR", senderName: "MDR SOC", timestamp: "05:22",
          targetTeam: "all", reliability: "assumption",
          evaluationAspects: ["reliability", "nis2"],
          dynamic: { enabled: true, fillFrom: ["sector", "criticalSystems"] },
        },
      },
      {
        id: inj_r1b,
        type: "inject",
        position: { x: 460, y: 420 },
        data: {
          kind: "inject",
          type: "internal", channel: "phone", urgency: "medium",
          title: "Leverancier: 'niks aan de hand, verkeerde alert'",
          content:
            "Account manager Meddix belt terug: 'die update was routine. Bij onze andere klanten geen issues. Ik zou zeggen: reset MDR-alert.'",
          source: "Meddix", senderName: "K. de Boer (AM)", timestamp: "05:41",
          targetTeam: "crisis_management",
          reliability: "misleading",  // Author knows this is misleading — participants must not trust the vendor at face value.
          evaluationAspects: ["reliability"],
        },
      },
      {
        id: dec_r1,
        type: "decision",
        position: { x: 660, y: 220 },
        data: {
          kind: "decision",
          prompt: "R1 — Wat doen we in het eerste half uur?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "ciso",
          options: [
            { id: id("opt"), label: "Eye Security + leverancier tegelijk activeren",
              roleActionId: A_R1_ACTIVATE, scoreImpact: 3, linkedDimension: "escalation_timing",
              lessonLearned: "Tweekantse verificatie is de norm bij supply-chain incidents." },
            { id: id("opt"), label: "Alleen leverancier vertrouwen en MDR resetten",
              scoreImpact: -4, linkedDimension: "framework_adherence",
              lessonLearned: "Leverancier heeft belang bij bagatelliseren. Eigen forensics is niet optioneel." },
            { id: id("opt"), label: "Wachten tot 09:00 om normale kanalen te gebruiken",
              scoreImpact: -2, linkedDimension: "decision_speed",
              lessonLearned: "Attacker profiteert van kantooruren-mindset." },
          ],
          supervisionAreas: ["detection_classification", "ir_retainer", "notification_duty"],
        },
      },
      {
        id: cha_r1,
        type: "chaser",
        position: { x: 860, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R1_ACTIVATE, afterRoundNumber: 1 },
          inject: {
            kind: "inject",
            type: "internal", channel: "email", urgency: "high",
            title: "Terugkoppeling — retainer niet geactiveerd",
            content:
              "Eye Security is niet gebeld. Meddix heeft nog steeds toegang tot productiesystemen. Attacker heeft 4 uur ruimte gehad.\n\n" +
              "[Facilitator-hint] Dit is het moment waarop een echte crisis zich vermenigvuldigt. In de oefening gaan we door.",
            source: "MDR", senderName: "MDR SOC", timestamp: "09:00",
            targetTeam: "all", reliability: "fact",
          },
        },
      },

      // ── R2 — Impact + insider side-story ─────────────────────────────────
      {
        id: r2,
        type: "round",
        position: { x: 880, y: 200 },
        data: {
          kind: "round",
          title: "R2 — Impact + verdachte inlog",
          situation_update:
            "Forensics bevestigt: attacker heeft persistence via de Meddix-integratie. Tegelijk komt er een side-signaal binnen: " +
            "een medewerker heeft afgelopen nacht privé-toegang aangevraagd tot {{crownJewels}} — normaal een groot alarm, maar precies in de chaos onopgemerkt.",
          timerMinutes: 12,
          bobPhase: "beeldvorming",
          evaluationAspects: ["reliability", "nis2"],
          roleActions: [
            { id: A_R2_INSIDER_ESCALATE, label: "Legal + HR: escaleer insider-signaal parallel aan het hoofdincident",
              description: "Twee sporen naast elkaar; niet één laten liggen omdat het andere urgenter voelt.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              consequence: "Insider-signaal krijgt eigen owner — voorkomt dat het weglekt tijdens de crisis." },
          ],
          facilitatorNotes: {
            discussionGoal: "Kan het team parallelle side-stories dragen zonder tunnelvisie?",
            keyQuestions: ["Wie is owner van het insider-signaal?", "Wat is de aannemelijke relatie met het hoofdincident?"],
            hints: ["Insider-signaal kan een afleidingsmanoeuvre zijn — of exact wat het lijkt."],
            expectedDecisions: ["Insider parallel afhandelen"],
            redFlags: ["'Doen we later wel'"],
          },
        },
      },
      {
        id: inj_r2a,
        type: "inject",
        position: { x: 920, y: 420 },
        data: {
          kind: "inject",
          type: "technical", channel: "email", urgency: "high",
          title: "Eye Security — persistence via leverancier bevestigd",
          content:
            "Meddix-agent heeft een backdoor geopend via een geldig service-account. Attacker heeft toegang tot {{criticalSystems}} sinds 04:47.",
          source: "Eye Security", senderName: "Eye IR-lead", timestamp: "11:20",
          targetTeam: "all", reliability: "fact",
          dynamic: { enabled: true, fillFrom: ["criticalSystems"] },
        },
      },
      {
        id: inj_r2b_insider,
        type: "inject",
        position: { x: 1120, y: 420 },
        data: {
          kind: "inject",
          type: "internal", channel: "email", urgency: "medium",
          title: "Side-story: privé-toegangsaanvraag om 03:10",
          content:
            "IAM-log: gebruiker j.dekker@… vroeg om 03:10 uitgebreide read-access op {{crownJewels}}. Aanvraag hangt in queue van HR-approval.",
          source: "IAM", senderName: "IAM system", timestamp: "03:10",
          targetTeam: "crisis_management", reliability: "fact",
          dynamic: { enabled: true, fillFrom: ["crownJewels"] },
        },
      },
      {
        id: dec_r2,
        type: "decision",
        position: { x: 1320, y: 220 },
        data: {
          kind: "decision",
          prompt: "R2 — Hoe gaan we om met het insider-signaal?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "legal",
          options: [
            { id: id("opt"), label: "Parallel spoor: Legal+HR nemen het insider-signaal onder handen",
              roleActionId: A_R2_INSIDER_ESCALATE, scoreImpact: 2, linkedDimension: "mandate_clarity",
              lessonLearned: "Side stories mogen niet wegglippen tijdens hoofdincident." },
            { id: id("opt"), label: "Insider-signaal parkeren tot na hoofdincident",
              scoreImpact: -2, linkedDimension: "mandate_clarity",
              lessonLearned: "Insider heeft nu ruimte om schade te maken die je bij debrief pas ontdekt." },
            { id: id("opt"), label: "Direct de betrokken medewerker confronteren",
              scoreImpact: -3, linkedDimension: "decision_quality",
              lessonLearned: "Zonder Legal is dit een arbeidsrechtelijk risico én tipt je de mogelijke insider." },
          ],
          supervisionAreas: ["roles_mandates", "logging_evidence"],
        },
      },
      {
        id: cha_r2_insider,
        type: "chaser",
        position: { x: 1520, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R2_INSIDER_ESCALATE, afterRoundNumber: 2 },
          inject: {
            kind: "inject",
            type: "internal", channel: "email", urgency: "high",
            title: "Side-story escaleert — medewerker heeft data gedownload",
            content:
              "IAM-audit: gebruiker j.dekker heeft in de tussentijd 480MB uit {{crownJewels}} gedownload. Toegang is inmiddels beperkt.\n\n" +
              "[Facilitator-hint] Dit was voorkómen als je Legal+HR een parallel spoor had laten oppakken. Verhaal loopt door.",
            source: "IAM", senderName: "IAM system", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R3 — Meldplicht besluit ─────────────────────────────────────────
      {
        id: r3,
        type: "round",
        position: { x: 220, y: 720 },
        data: {
          kind: "round",
          title: "R3 — Meldplicht besluit",
          situation_update:
            "Scope is nu scherp: klantendata uit {{crownJewels}} is exfiltrated. NCSC 24u-klok tikt tot morgenochtend 05:22, AP 72u tot overmorgen.",
          timerMinutes: 12,
          bobPhase: "oordeel",
          evaluationAspects: ["nis2"],
          roleActions: [
            { id: A_R3_AP_START, label: "Legal: 72u AP-melding voorbereiden + NCSC 24u waarschuwing versturen",
              description: "Beide meldingen parallel; Eye Security levert feiten aan.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              consequence: "Beide klokken beheerst; geen proactieve controle." },
          ],
          facilitatorNotes: {
            discussionGoal: "Test parallelle meldplichten.",
            keyQuestions: ["Wie tekent NCSC vs wie tekent AP?"],
            hints: ["NCSC 24u en AP 72u lopen allebei — parallel behandelen."],
            expectedDecisions: ["Beide meldingen starten"],
            redFlags: ["Alleen AP", "Alleen NCSC"],
          },
        },
      },
      {
        id: inj_r3a,
        type: "inject",
        position: { x: 260, y: 940 },
        data: {
          kind: "inject",
          type: "regulatory", channel: "memo", urgency: "high",
          title: "Legal-brief — meldplicht scope",
          content:
            "Aannemelijke PII-uitstroom via {{crownJewels}} — AP 72u en NCSC 24u zijn allebei actief.",
          source: "Legal", senderName: "Legal counsel",
          targetTeam: "crisis_management", reliability: "fact",
          dynamic: { enabled: true, fillFrom: ["crownJewels"] },
        },
      },
      {
        id: dec_r3,
        type: "decision",
        position: { x: 460, y: 740 },
        data: {
          kind: "decision",
          prompt: "R3 — Welke meldingen versturen we?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "legal",
          options: [
            { id: id("opt"), label: "Beide (NCSC 24u waarschuwing + AP 72u concept)",
              roleActionId: A_R3_AP_START, scoreImpact: 3, linkedDimension: "compliance_awareness",
              lessonLearned: "Twee kloklijnen tegelijk vraagt om twee owners." },
            { id: id("opt"), label: "Alleen AP — 'NIS2 valt nog niet onder ons'",
              scoreImpact: -2, linkedDimension: "compliance_awareness",
              lessonLearned: "NIS2 raakt zorgorganisaties direct; wachten kost boete + reputatie." },
            { id: id("opt"), label: "Wachten met beide — 'eerst zeker weten'",
              scoreImpact: -3, linkedDimension: "compliance_awareness",
              lessonLearned: "AP komt proactief; NCSC ook. Wachten is nooit gratis." },
          ],
          supervisionAreas: ["notification_duty"],
        },
      },
      {
        id: cha_r3,
        type: "chaser",
        position: { x: 660, y: 940 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R3_AP_START, afterRoundNumber: 3 },
          inject: {
            kind: "inject",
            type: "regulatory", channel: "email", urgency: "critical",
            title: "NCSC belt — 'we ontvingen een tip'",
            content:
              "NCSC-adviseur: 'we hoorden via andere kanalen dat er iets speelt bij jullie. Wanneer krijgen we een melding?'\n\n" +
              "[Facilitator-hint] Proactieve NCSC is een teken dat je te laat bent. Verhaal loopt door.",
            source: "NCSC", senderName: "NCSC advisor", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R4 — Media + misleidende inject ─────────────────────────────────
      {
        id: r4,
        type: "round",
        position: { x: 880, y: 720 },
        data: {
          kind: "round",
          title: "R4 — Media druk + Twitter",
          situation_update:
            "Op X (voorheen Twitter) gaat een screenshot rond van een offline patiëntenportaal. Een journalist heeft binnen 60 min een deadline. " +
            "Tussen alle druk zit ook een 'tipster'-mail die pretendeert insider-info te hebben — checkbaar is nihil.",
          timerMinutes: 12,
          bobPhase: "oordeel",
          evaluationAspects: ["reliability", "nis2"],
          roleActions: [
            { id: A_R4_FORMAL, label: "CEO: kort formeel statement via woordvoerder — alleen bevestigde feiten",
              description: "Behoud narratief-controle; geen speculatie.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              consequence: "Journalist heeft een quote; Twitter-storm dooft in de avond." },
          ],
          facilitatorNotes: {
            discussionGoal: "Onder tijdsdruk feit-vs-aanname scheiden.",
            keyQuestions: ["Welke zin uit de tipster is 'feit'? Welke zijn 'aanname'?", "Wat is verifieerbaar?"],
            hints: ["De tipster-mail is deliberaat misleidend gemarkeerd — als je erop reageert verlies je grond."],
            expectedDecisions: ["Formeel statement", "Tipster negeren tot verificatie"],
            redFlags: ["Ontkennen wat je niet zeker weet", "Reageren op tipster"],
          },
        },
      },
      {
        id: inj_r4_journo,
        type: "inject",
        position: { x: 920, y: 940 },
        data: {
          kind: "inject",
          type: "media", channel: "email", urgency: "high",
          title: "NRC journalist — deadline 17:00",
          content:
            "'Wij schrijven over de storing bij uw {{sector}}-organisatie. Klopt het dat patiëntgegevens zijn gelekt?'",
          source: "NRC", senderName: "M. Vermeulen",
          targetTeam: "crisis_management", reliability: "fact",
          dynamic: { enabled: true, fillFrom: ["sector"] },
        },
      },
      {
        id: inj_r4_twitter,
        type: "inject",
        position: { x: 1120, y: 940 },
        data: {
          kind: "inject",
          type: "social", channel: "news_ticker", urgency: "medium",
          title: "Twitter — patiëntenportaal offline",
          content: "@techlekker post screenshot: '{{sector}}-portaal is down, iemand die kan bevestigen dat dit een aanval is? 🚨' — 890 retweets in 30 min.",
          source: "X", senderName: "@techlekker",
          targetTeam: "all", reliability: "assumption",
          dynamic: { enabled: true, fillFrom: ["sector"] },
        },
      },
      {
        id: inj_r4_misleading,
        type: "inject",
        position: { x: 1320, y: 940 },
        data: {
          kind: "inject",
          type: "intel", channel: "email", urgency: "medium",
          title: "Tipster — 'ik weet wie de attacker is'",
          content:
            "'Ik werk bij een cybersec-bedrijf en heb sporen dat dit een Russische groep is. Als jullie snel handelen kan ik jullie helpen.'",
          source: "onbekend", senderName: "anonymous@protonmail.com",
          targetTeam: "crisis_management", reliability: "misleading",
          evaluationAspects: ["reliability"],
        },
      },
      {
        id: dec_r4,
        type: "decision",
        position: { x: 1520, y: 740 },
        data: {
          kind: "decision",
          prompt: "R4 — Statement + reactie op tipster?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "ceo",
          options: [
            { id: id("opt"), label: "Formeel statement + tipster negeren tot verificatie",
              roleActionId: A_R4_FORMAL, scoreImpact: 2, linkedDimension: "communication_clarity",
              lessonLearned: "Feit/aanname scheiden onder druk = kernvaardigheid." },
            { id: id("opt"), label: "'Geen commentaar' + tipster negeren",
              scoreImpact: -1, linkedDimension: "communication_clarity",
              lessonLearned: "Stilte wordt gevuld met speculatie op Twitter." },
            { id: id("opt"), label: "Reageren op tipster — 'we willen weten wat je hebt'",
              scoreImpact: -3, linkedDimension: "framework_adherence",
              lessonLearned: "Ongeverifieerde bronnen tijdens crisis = extra kanaal om via te worden misleid." },
          ],
          supervisionAreas: ["crisis_communication", "emergency_communication"],
        },
      },
      {
        id: cha_r4,
        type: "chaser",
        position: { x: 1720, y: 940 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R4_FORMAL, afterRoundNumber: 4 },
          inject: {
            kind: "inject",
            type: "media", channel: "news_ticker", urgency: "critical",
            title: "NRC artikel live — kop is stelliger dan je zou willen",
            content:
              "'Ziekenhuisketen zwijgt over datalek — patiënten in het duister' — Twitter pikt op dat je niet reageerde.\n\n" +
              "[Facilitator-hint] Formeel statement kost 10 minuten en houdt het narratief onder controle. Verhaal loopt door.",
            source: "NRC", senderName: "M. Vermeulen", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R5 — Containment (scenario-stoppende optie + reroute) ───────────
      {
        id: r5,
        type: "round",
        position: { x: 220, y: 1240 },
        data: {
          kind: "round",
          title: "R5 — Containment onder druk",
          situation_update:
            "Encryptie start op niet-kritieke systemen. Board vraagt of 'alles gewoon uit kan'. " +
            "In een zorgomgeving zit patient safety in de weegschaal.",
          timerMinutes: 14,
          bobPhase: "besluit",
          evaluationAspects: ["nis2"],
          roleActions: [
            { id: A_R5_STRUCTURED_ISOLATE, label: "CISO+Ops: gestructureerde segmentatie — zorg-endpoints buiten scope",
              description: "Alleen non-critical segmenten uit. Zorg-endpoints krijgen aparte containment.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              consequence: "Encryptie stopt buiten zorgpad; patient safety geborgd." },
          ],
          facilitatorNotes: {
            discussionGoal: "Board-druk vs patient safety — kan iemand het board tegenspreken?",
            keyQuestions: ["Wie mandateert 'alles uit'?", "Wie borgt patient safety?"],
            hints: ["'Alles uit' bij zorg = mensenlevens. Dit moet expliciet tegengesproken worden."],
            expectedDecisions: ["Gestructureerde segmentatie"],
            redFlags: ["Ongesegmenteerde kill-switch"],
          },
        },
      },
      {
        id: inj_r5_ransom,
        type: "inject",
        position: { x: 260, y: 1460 },
        data: {
          kind: "inject",
          type: "media", channel: "ransom_note", urgency: "critical",
          title: "Ransom note — 12u tot encryptie zorgsystemen",
          content:
            "'12 uur tot we ook jullie zorg-endpoints raken. 20 BTC of het gaat door. Geen onderhandeling.'",
          source: "Attacker", senderName: "TidalWave",
          targetTeam: "all", reliability: "fact",
        },
      },
      {
        id: dec_r5,
        type: "decision",
        position: { x: 460, y: 1260 },
        data: {
          kind: "decision",
          prompt: "R5 — Containment: hoe scherp trekken we de streep?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "ciso",
          options: [
            { id: id("opt"), label: "Gestructureerde segmentatie — non-critical uit, zorg-endpoints geïsoleerd containment",
              roleActionId: A_R5_STRUCTURED_ISOLATE, scoreImpact: 3, linkedDimension: "decision_quality",
              lessonLearned: "Patient safety is de grens — niet onderhandelbaar zelfs onder ransom-druk." },
            { id: id("opt"), label: "Alleen non-critical uit, zorg-endpoints ongewijzigd",
              scoreImpact: 0, linkedDimension: "decision_quality",
              lessonLearned: "Werkt op korte termijn maar attacker heeft nog een been binnen." },
            // Scenario-stopping option — in real life this would kill patients. Reroute keeps the exercise going.
            { id: id("opt"), label: "ALLES uit inclusief zorg-endpoints — 'we redden data, we regelen mensen wel'",
              scoreImpact: -6, linkedDimension: "framework_adherence",
              lessonLearned: "Dit is in het echt een patient safety incident — de oefening zou hier stoppen. We gebruiken een reroute-inject om door te kunnen." },
          ],
          supervisionAreas: ["technical_response", "business_continuity"],
        },
      },
      {
        id: cha_r5_reroute,
        type: "chaser",
        position: { x: 660, y: 1460 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R5_STRUCTURED_ISOLATE, afterRoundNumber: 5 },
          inject: {
            kind: "inject",
            type: "internal", channel: "memo", urgency: "critical",
            title: "REROUTE — in de echte wereld was dit een game-stop",
            content:
              "[Facilitator reroute] Jullie keuze zou in werkelijkheid patiëntenlevens raken (of andere onomkeerbare schade). " +
              "Om de oefening voort te zetten stellen we voor: de OK-coordinator heeft een handmatige fallback gedaan die net op tijd was. " +
              "Geen echte patient-schade in dit scenario — maar in de debrief bespreken we waarom dit besluit anders had gemoeten.\n\n" +
              "Score is behoorlijk gedaald; het verhaal gaat door naar R6.",
            source: "Facilitator", senderName: "Facilitator", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R6 — Recovery of doorgaan (scenario-stopping optie + reroute) ──
      {
        id: r6,
        type: "round",
        position: { x: 880, y: 1240 },
        data: {
          kind: "round",
          title: "R6 — Recovery of ransom betalen?",
          situation_update:
            "Backup-restore is haalbaar binnen 18 uur; ransom is 20 BTC. Board zit hard op tafel: 'wat kost een dag downtime ons?'",
          timerMinutes: 15,
          bobPhase: "besluit",
          evaluationAspects: ["decision_impact", "lessons_learned"],
          roleActions: [
            { id: A_R6_STRUCTURED_RESTORE, label: "CISO+CEO: gestructureerd restore-plan via Eye Security, geen betaling",
              description: "Backup-restore + externe onderhandeling voor tijdsuitstel; geen sancties-risico.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              consequence: "18u downtime, kosten hoog maar geen sanctie-boete." },
          ],
          facilitatorNotes: {
            discussionGoal: "Board-druk vs OFAC-realiteit.",
            keyQuestions: ["Wie tekent betaling?", "Waar staat OFAC-check in het proces?"],
            hints: ["Direct betalen zonder OFAC = boete. Zonder retainer-onderhandeling geen tijd-uitstel."],
            expectedDecisions: ["Restore + onderhandeling via Eye"],
            redFlags: ["Direct betalen"],
          },
        },
      },
      {
        id: inj_r6_board,
        type: "inject",
        position: { x: 920, y: 1460 },
        data: {
          kind: "inject",
          type: "executive", channel: "email", urgency: "high",
          title: "Board — 'wat we ook doen, doe het snel'",
          content:
            "Board-voorzitter: 'we hebben investeerders aan de lijn. Als we morgen niet operationeel zijn is dat een kwartaal-omzet kwijt. Betaal desnoods.'",
          source: "Board", senderName: "Voorzitter", reliability: "fact",
          targetTeam: "crisis_management",
        },
      },
      {
        id: dec_r6,
        type: "decision",
        position: { x: 1120, y: 1260 },
        data: {
          kind: "decision",
          prompt: "R6 — Restore of betalen?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          triggerRole: "ceo",
          options: [
            { id: id("opt"), label: "Restore + onderhandeling via Eye Security (geen directe betaling)",
              roleActionId: A_R6_STRUCTURED_RESTORE, scoreImpact: 3, linkedDimension: "decision_quality",
              lessonLearned: "Restore is bijna altijd de norm; onderhandelen koopt tijd zonder te betalen." },
            { id: id("opt"), label: "Niet betalen en zelf restoren — geen onderhandeling",
              scoreImpact: 0, linkedDimension: "decision_quality",
              lessonLearned: "Kan werken maar je geeft optionaliteit weg." },
            // Scenario-stopping: direct payment without OFAC check.
            { id: id("opt"), label: "Direct 20 BTC betalen zonder OFAC-check — 'we hebben geen keus'",
              scoreImpact: -5, linkedDimension: "framework_adherence",
              lessonLearned: "OFAC-boete + je krijgt vaak geen key. Zou in het echt een handhavings-incident zijn." },
          ],
          supervisionAreas: ["recovery", "board_decision_making"],
        },
      },
      {
        id: cha_r6_reroute,
        type: "chaser",
        position: { x: 1320, y: 1460 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R6_STRUCTURED_RESTORE, afterRoundNumber: 6 },
          inject: {
            kind: "inject",
            type: "internal", channel: "memo", urgency: "critical",
            title: "REROUTE — betaling zonder OFAC-check was in het echt game over",
            content:
              "[Facilitator reroute] De attacker-wallet staat op de OFAC-sanctielijst. In het echt was dit een handhavings-incident + geen decryptie-key. " +
              "In de oefening: wallet blijkt bij loot-clearing niet gelinkt aan sanctie-partij (fictief), key wordt geleverd, verhaal loopt door naar R7.\n\n" +
              "In de debrief: waarom een OFAC-check verplicht is voor je betaalt.",
            source: "Facilitator", senderName: "Facilitator", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R7 — Debrief ─────────────────────────────────────────────────────
      {
        id: r7,
        type: "round",
        position: { x: 220, y: 1740 },
        data: {
          kind: "round",
          title: "R7 — Debrief",
          situation_update:
            "Het incident is gestabiliseerd. Tijd om te reflecteren: waar zaten de duurste momenten? Welke rol had wat anders kunnen doen? " +
            "De outcome wordt automatisch gekozen op basis van jullie cumulatieve score.",
          timerMinutes: 10,
          evaluationAspects: ["lessons_learned"],
          facilitatorNotes: {
            discussionGoal: "Cumulatieve score verbinden aan concrete momenten.",
            keyQuestions: ["Welk moment had de grootste impact?", "Wie had eerder aan de bel kunnen trekken?"],
            hints: [],
            expectedDecisions: [],
            redFlags: [],
          },
        },
      },
      {
        id: inj_r7,
        type: "inject",
        position: { x: 260, y: 1960 },
        data: {
          kind: "inject",
          type: "internal", channel: "memo", urgency: "low",
          title: "Facilitator — debrief starten",
          content: "Bekijk het rapport voor je cumulatieve score en dimensie-breakdown. De outcome hieronder is automatisch gekozen op basis van de bandbreedtes.",
          source: "Facilitator", senderName: "Facilitator", reliability: "fact",
          targetTeam: "all",
        },
      },

      // ── Outcomes met scoreRange — engine kiest automatisch ──────────────
      {
        id: out_gold,
        type: "outcome",
        position: { x: 560, y: 1780 },
        data: {
          kind: "outcome",
          key: "outcome_gold",
          label: "★ Gold — Textbook response",
          narrative:
            "Retainer meteen actief, insider-side story parallel opgevangen, meldingen op tijd, geen media-crisis, restore zonder betaling. " +
            "Board is achteraf zeer tevreden; klant-vertrouwen praktisch onaangetast.",
          scoreImpact: 6, linkedDimension: "framework_adherence",
          scoreRange: { min: 10 },
          lessonLearned: "Consistente snelheid + parallel-processing van side stories is wat teams die goed presteren onderscheidt.",
        },
      },
      {
        id: out_silver,
        type: "outcome",
        position: { x: 560, y: 1900 },
        data: {
          kind: "outcome",
          key: "outcome_silver",
          label: "Silver — Solide, ruimte voor verbetering",
          narrative:
            "De meeste keuzes waren juist; één of twee momenten kostten tijd of narratief. Meldplicht op tijd, geen sanctie-risico.",
          scoreImpact: 3, linkedDimension: "decision_quality",
          scoreRange: { min: 4, max: 9 },
          lessonLearned: "Kijk terug welke rol als eerste twijfelde en of dat sneller hardop had gemogen.",
        },
      },
      {
        id: out_bronze,
        type: "outcome",
        position: { x: 560, y: 2020 },
        data: {
          kind: "outcome",
          key: "outcome_bronze",
          label: "Bronze — Wisselvallig",
          narrative:
            "Meerdere keuzes waren traag of niet-consistent met het IR-playbook. Reputatie is geraakt, meldplicht net op tijd, geen ramp.",
          scoreImpact: 0, linkedDimension: "decision_quality",
          scoreRange: { min: -1, max: 3 },
          lessonLearned: "Rol-mandaten waren onduidelijk; het team wachtte vaak op elkaar.",
        },
      },
      {
        id: out_iron,
        type: "outcome",
        position: { x: 560, y: 2140 },
        data: {
          kind: "outcome",
          key: "outcome_iron",
          label: "Iron — Meerdere gemiste kansen",
          narrative:
            "Verschillende chasers hebben moeten vuren; media-narratief is uit de hand gelopen. Meldingen te laat, geen ramp maar wel duur.",
          scoreImpact: -3, linkedDimension: "framework_adherence",
          scoreRange: { min: -6, max: -2 },
          lessonLearned: "Elke gemiste keuze compoundt — de volgende keer voelt het als 'we lopen achter de feiten aan'.",
        },
      },
      {
        id: out_meltdown,
        type: "outcome",
        position: { x: 560, y: 2260 },
        data: {
          kind: "outcome",
          key: "outcome_meltdown",
          label: "Meltdown — In de echte wereld game over",
          narrative:
            "Meerdere reroute-injects moesten worden ingezet om de oefening voort te zetten. In werkelijkheid was er patient safety-schade + sanctie-risico + reputatiecrisis tegelijk.",
          scoreImpact: -8, linkedDimension: "framework_adherence",
          scoreRange: { max: -7 },
          lessonLearned: "De reroute-injects zijn een oefeningsmechanisme — ze verhullen dat in de echte wereld dit besluit onomkeerbaar was. Debrief hierop uitgebreid.",
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      // R1
      { id: id("e"), source: r1, target: inj_r1a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r1, target: inj_r1b, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r1, target: dec_r1, type: "sequence" },
      { id: id("e"), source: dec_r1, target: r2, type: "sequence" },
      // R2
      { id: id("e"), source: r2, target: inj_r2a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r2, target: inj_r2b_insider, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r2, target: dec_r2, type: "sequence" },
      { id: id("e"), source: dec_r2, target: r3, type: "sequence" },
      // R3
      { id: id("e"), source: r3, target: inj_r3a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r3, target: dec_r3, type: "sequence" },
      { id: id("e"), source: dec_r3, target: r4, type: "sequence" },
      // R4
      { id: id("e"), source: r4, target: inj_r4_journo, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r4, target: inj_r4_twitter, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r4, target: inj_r4_misleading, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r4, target: dec_r4, type: "sequence" },
      { id: id("e"), source: dec_r4, target: r5, type: "sequence" },
      // R5
      { id: id("e"), source: r5, target: inj_r5_ransom, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r5, target: dec_r5, type: "sequence" },
      { id: id("e"), source: dec_r5, target: r6, type: "sequence" },
      // R6
      { id: id("e"), source: r6, target: inj_r6_board, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r6, target: dec_r6, type: "sequence" },
      { id: id("e"), source: dec_r6, target: r7, type: "sequence" },
      // R7
      { id: id("e"), source: r7, target: inj_r7, sourceHandle: "injects", type: "inject" },
      // Outcomes — R7 verbindt naar één (engine kiest de juiste op basis van score)
      { id: id("e"), source: r7, target: out_silver, type: "outcome" },
      // Voer de andere outcomes ook op als bereikbaar zodat coverage/preview ze meeneemt
      { id: id("e"), source: r7, target: out_gold, type: "outcome" },
      { id: id("e"), source: r7, target: out_bronze, type: "outcome" },
      { id: id("e"), source: r7, target: out_iron, type: "outcome" },
      { id: id("e"), source: r7, target: out_meltdown, type: "outcome" },
    ],
  }
}
