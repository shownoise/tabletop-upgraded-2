import type { ScenarioGraph } from "./types"
import { DEFAULT_FEATURES, EYE_SECURITY_RETAINER, meldplichtFromProfile } from "./types"

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

// Full Showcase v2 — laat alle mechanieken zien met simpele, uitlegbare scoring.
//
// Dimensies (max 4, uitlegbaar):
//   snelheid — reageert het team op tijd?
//   kwaliteit — is de keuze inhoudelijk goed?
//   compliance — meldplicht / NIS2 / AVG in acht genomen?
//   communicatie — duidelijk richting stakeholders?
//
// Elke keuze raakt hooguit 2 dimensies. Trade-offs (bv. snelheid + / compliance -)
// worden zichtbaar in het rapport per-dimensie en in de review-fase per keuze.
//
// Injects verschijnen gestaffeld gedurende de ronde (deliverySeconds).
// Wrong choices → chaser-inject met facilitator-hint, verhaal loopt door.
// 4 outcomes met scoreRange — engine kiest automatisch op cumulatieve score.
export function fullShowcaseExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round"), r4 = id("round"), r5 = id("round"), r6 = id("round")

  const inj_r1a = id("inj"), inj_r1b = id("inj")
  const inj_r2a = id("inj")
  const inj_r3a = id("inj"), inj_r3b = id("inj")
  const inj_r4a = id("inj")
  const inj_r5a = id("inj")
  const inj_r6 = id("inj")

  const cha_r1 = id("cha"), cha_r2 = id("cha"), cha_r3 = id("cha"), cha_r4 = id("cha"), cha_r5 = id("cha")

  const out_gold = id("out"), out_silver = id("out"), out_bronze = id("out"), out_meltdown = id("out")

  // Correct-choice action ids (voor chaser-trigger via decision_not_taken)
  const A_R1_CISO_RETAINER = "r1-ciso-eye-direct"
  const A_R2_LEGAL_AP = "r2-legal-ap-72u"
  const A_R3_CEO_FORMAL = "r3-ceo-formeel"
  const A_R4_CISO_VIA_EYE = "r4-ciso-onderhandel-eye"
  const A_R5_CISO_STRUCT_RESTORE = "r5-ciso-struct-restore"

  return {
    id: id("graph"),
    name: "★★ Full Showcase — Ransomware @ {{sector}}",
    version: 2,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    meldplicht: meldplichtFromProfile('both', { incidentDetectedAt: 'round_1' }),
    features: DEFAULT_FEATURES,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 240 }, data: { kind: "start" } },

      // ── R1 — CISO + CEO ──────────────────────────────────────────────────
      {
        id: r1,
        type: "round",
        position: { x: 220, y: 200 },
        data: {
          kind: "round",
          title: "R1 — Verdachte activiteit op productie",
          situation_update: "05:12 — MDR meldt outbound-verbindingen vanaf {{criticalSystems}}. Scope onduidelijk, maar patroon lijkt op ransomware-recon. CISO en CEO zijn aan zaak.",
          timerMinutes: 12,
          dynamic: { enabled: true, fillFrom: ["sector", "criticalSystems"] },
          roleActions: [
            // CISO keuzes ─────
            {
              id: A_R1_CISO_RETAINER,
              label: "Eye Security direct activeren + eigen forensics starten",
              description: "24/7 lijn bellen, parallel eigen logs veiligstellen.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { decision_speed: 2, decision_quality: 2 },
              qualityRank: "best",
              facilitatorCommentary: "Precies wat wij als IR-retainer verwachten: snel én je eigen huis op orde. Deze combinatie levert de meeste tijd op.",
              consequence: "Binnen 15 min forensische support en logs veilig.",
            },
            {
              id: "r1-ciso-wait",
              label: "Eerst intern uitzoeken, retainer bewaren voor als nodig",
              description: "Ownership behouden, kostenrisico beperken.",
              allowedRoles: ["ciso"], irPlanAligned: false,
              scoreImpacts: { decision_speed: -2, decision_quality: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Snappen we vanuit kosten-oogpunt, maar attacker heeft nu 2 uur ruimte om te bewegen. Eye bellen is goedkoper dan een uitgelopen incident.",
              consequence: "Verspreiding wordt pas ontdekt in ronde 2.",
            },
            {
              id: "r1-ciso-only-vendor",
              label: "Alleen de leverancier bellen, geen retainer",
              description: "Wachten op leverancier-bevestiging voordat er iemand ingeschakeld wordt.",
              allowedRoles: ["ciso"], irPlanAligned: false,
              scoreImpacts: { decision_speed: -1, decision_quality: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "Leverancier heeft een belang bij bagatelliseren. Onafhankelijke forensics is niet-onderhandelbaar.",
              consequence: "Leverancier ontkent, spoor loopt dood.",
            },
            // CEO keuzes ─────
            {
              id: "r1-ceo-alert",
              label: "Directie inlichten + crisis-tafel oproepen",
              description: "Board voorbereiden, geen wachtstand.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { decision_speed: 2, communication_clarity: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Board vroeg activeren = geen verrassingen later. Vooral bij een {{sector}}-organisatie waar bestuurlijke verantwoording snel hard wordt.",
              consequence: "Board is voorbereid; besluitvorming kan in R2 vlot.",
            },
            {
              id: "r1-ceo-wait",
              label: "Wachten tot 08:00 — 'kwestie van geduld'",
              description: "Board niet uit bed halen op basis van 1 alert.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              scoreImpacts: { decision_speed: -2 },
              qualityRank: "poor",
              facilitatorCommentary: "Snappen we — nachtelijke escalatie kost politiek kapitaal. Maar bij ransomware-recon kost wachten meer.",
              consequence: "Board hoort van social media dat er 'iets speelt'.",
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Testen of team snel + gelaagd escaleert bij ambigue signaal.",
            keyQuestions: ["Wat is de drempel om Eye Security te bellen?", "Wanneer wek je board?"],
            hints: [], expectedDecisions: [], redFlags: [],
          },
        },
      },
      // Injects R1 — 0s + 90s stagger
      {
        id: inj_r1a, type: "inject", position: { x: 260, y: 420 },
        data: {
          kind: "inject",
          type: "alert", channel: "siem", urgency: "high",
          title: "MDR — verdachte outbound",
          content: "Outbound naar onbekend AS-nummer vanaf 3 hosts. Off-hours logins. Patroon lijkt op ransomware-recon. Vereist scoping.",
          source: "MDR", senderName: "MDR SOC", timestamp: "05:12",
          targetTeam: "all",
          deliverySeconds: 0,
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
          source: "Leverancier", senderName: "K. de Boer (AM)", timestamp: "05:38",
          targetTeam: "crisis_management",
          deliverySeconds: 90,
        },
      },
      {
        id: cha_r1, type: "chaser", position: { x: 660, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R1_CISO_RETAINER, afterRoundNumber: 1 },
          inject: {
            kind: "inject",
            type: "internal", channel: "email", urgency: "high",
            title: "Terugkoppeling — retainer niet ingeschakeld",
            content: "MDR-team zet ticket op 'awaiting client'. Attacker heeft nu 3 uur extra bewegingsruimte.\n\n[Facilitator-hint] Dit is wat 'we wachten even' in de praktijk kost. We gaan in de oefening door.",
            source: "MDR", senderName: "MDR SOC", timestamp: "08:15",
            targetTeam: "all",
          },
        },
      },

      // ── R2 — Legal + CEO ─────────────────────────────────────────────────
      {
        id: r2, type: "round", position: { x: 880, y: 200 },
        data: {
          kind: "round",
          title: "R2 — PII-lek bevestigd, meldplicht-klok tikt",
          situation_update: "Forensics bevestigt: attacker heeft data uit {{crownJewels}} geëxfiltreerd. 72u AP-klok loopt vanaf 05:12. NCSC 24u ook actief. Legal en CEO moeten meldpad kiezen.",
          timerMinutes: 12,
          dynamic: { enabled: true, fillFrom: ["crownJewels"] },
          roleActions: [
            // LEGAL ─────
            {
              id: A_R2_LEGAL_AP,
              label: "72u AP-melding + NCSC 24u waarschuwing parallel starten",
              description: "Concepten openen, feiten via Eye Security aanleveren.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { compliance_awareness: 3, decision_quality: 1 },
              qualityRank: "best",
              facilitatorCommentary: "De AP hanteert 'aannemelijk', niet 'bewezen'. Concept openen kost niets, uitstellen wel.",
            },
            {
              id: "r2-legal-wait",
              label: "Wachten met beide meldingen — 'we willen eerst zekerheid'",
              description: "Voorkomen dat we iets communiceren dat later niet klopt.",
              allowedRoles: ["legal"], irPlanAligned: false,
              scoreImpacts: { compliance_awareness: -3, decision_speed: -1 },
              qualityRank: "wrong",
              facilitatorCommentary: "Snappen we vanuit 'geen half werk', maar de AP komt proactief langs als jij niet komt. Boete-risico stijgt met elk uur.",
            },
            {
              id: "r2-legal-only-ap",
              label: "Alleen AP, NCSC pas als zeker is",
              description: "AVG heeft prioriteit boven NIS2 in eerste uren.",
              allowedRoles: ["legal"], irPlanAligned: false,
              scoreImpacts: { compliance_awareness: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Kritieke dienst uitgevallen = ook NCSC. Twee kloklijnen tegelijk, één owner per lijn.",
            },
            // CEO ─────
            {
              id: "r2-ceo-sign",
              label: "Ondertekening AP-melding namens board delegeren aan Legal",
              description: "Legal heeft mandaat + tempo, CEO blijft focus houden.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { decision_speed: 1, compliance_awareness: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Delegeren op operationele meldingen = goed mandaat-gebruik. CEO houdt bandwidth vrij voor board en pers.",
            },
            {
              id: "r2-ceo-hold",
              label: "Eerst intern uitzoeken, ondertekening pas na scope-lock",
              description: "Board wil niets ondertekenen zonder volledige feiten.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              scoreImpacts: { decision_speed: -1, compliance_awareness: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "Klassieke board-reflex maar juridisch kloppen 'aannemelijk' en 'bewezen' niet op één lijn. Legal moet nu kunnen tekenen.",
            },
          ],
        },
      },
      {
        id: inj_r2a, type: "inject", position: { x: 920, y: 420 },
        data: {
          kind: "inject",
          type: "technical", channel: "email", urgency: "high",
          title: "Eye Security — 40MB PII bevestigd geëxfiltreerd",
          content: "Klantendata uit {{crownJewels}}. 2 tabellen. Attacker heeft persistence op 4 hosts. NCSC 24u loopt tot morgen 05:12.",
          source: "Eye Security", senderName: "Eye IR-lead", timestamp: "09:40",
          targetTeam: "all", deliverySeconds: 0,
          dynamic: { enabled: true, fillFrom: ["crownJewels"] },
        },
      },
      {
        id: cha_r2, type: "chaser", position: { x: 1120, y: 400 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R2_LEGAL_AP, afterRoundNumber: 2 },
          inject: {
            kind: "inject",
            type: "regulatory", channel: "email", urgency: "critical",
            title: "AP mailt — 'wij ontvingen een klacht'",
            content: "'Klant meldt vermoedelijk lek. Kunt u toelichten of u dit gemeld heeft?'\n\n[Facilitator-hint] Als jij niet meldt, komt de AP naar jou. Boete-risico is nu materieel groter.",
            source: "Autoriteit Persoonsgegevens", senderName: "AP toezicht", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R3 — CEO + Legal (media) ─────────────────────────────────────────
      {
        id: r3, type: "round", position: { x: 220, y: 720 },
        data: {
          kind: "round",
          title: "R3 — Media druk",
          situation_update: "Journalist heeft deadline 17:00, Twitter draait. CEO en Legal moeten samen statement handelen.",
          timerMinutes: 12,
          roleActions: [
            // CEO ─────
            {
              id: A_R3_CEO_FORMAL,
              label: "Kort formeel statement via woordvoerder",
              description: "Bevestigde feiten + geruststelling, verwijzen naar Eye Security.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { communication_clarity: 3, decision_quality: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Formeel + kort + verifieerbaar. Precies de driehoek waarmee je onder tijdsdruk niet in problemen komt.",
            },
            {
              id: "r3-ceo-nocomment",
              label: "'Geen commentaar' — 'we onderzoeken het'",
              description: "Wachten tot alles zeker is voor er iets naar buiten gaat.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              scoreImpacts: { communication_clarity: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Stilte wordt gevuld met speculatie. Twitter kan sneller dan jij.",
            },
            {
              id: "r3-ceo-uitgebreid",
              label: "Uitgebreid interview om vertrouwen te herstellen",
              description: "Transparant en breed uitleggen wat er gebeurt.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              scoreImpacts: { communication_clarity: -2, decision_quality: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "Elk detail dat later moet worden bijgesteld = tweede crisis. Nooit ontkennen wat je niet zeker weet.",
            },
            // LEGAL ─────
            {
              id: "r3-legal-review",
              label: "Statement door Legal pre-review vóór publicatie",
              description: "Elke zin door Legal langs voor er iets naar buiten gaat.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { compliance_awareness: 2, communication_clarity: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Standaard hoge kwaliteit-vinger op de trekker. Kost 10 minuten, voorkomt uren narrigheid.",
            },
            {
              id: "r3-legal-nolegal",
              label: "CEO tekent zelf — Legal krijgt kopie",
              description: "Snel weg met het statement, Legal reviewt post-hoc.",
              allowedRoles: ["legal"], irPlanAligned: false,
              scoreImpacts: { compliance_awareness: -1, decision_speed: 1 },
              qualityRank: "poor",
              facilitatorCommentary: "Snel = mooi, maar één juridisch verkeerde zin en je hebt een aansprakelijkheids-issue erbovenop.",
            },
          ],
        },
      },
      {
        id: inj_r3a, type: "inject", position: { x: 260, y: 940 },
        data: {
          kind: "inject",
          type: "media", channel: "email", urgency: "high",
          title: "NRC — deadline 60 minuten",
          content: "'Wij schrijven over de storing bij uw {{sector}}-organisatie. Reactie graag binnen 60 min.'",
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
        id: cha_r3, type: "chaser", position: { x: 660, y: 940 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R3_CEO_FORMAL, afterRoundNumber: 3 },
          inject: {
            kind: "inject",
            type: "media", channel: "news_ticker", urgency: "critical",
            title: "NRC-artikel live — kop is stelliger dan gehoopt",
            content: "'{{sector}}-organisatie zwijgt over lek' — Twitter pikt de stilte op.\n\n[Facilitator-hint] Een kort formeel statement had dit voorkomen. Verhaal loopt door.",
            source: "NRC", senderName: "M. Vermeulen", reliability: "fact", targetTeam: "all",
            dynamic: { enabled: true, fillFrom: ["sector"] },
          },
        },
      },

      // ── R4 — CISO + CEO (ransom) ─────────────────────────────────────────
      {
        id: r4, type: "round", position: { x: 880, y: 720 },
        data: {
          kind: "round",
          title: "R4 — Ransom demand",
          situation_update: "Attacker post: '12u tot publicatie. 15 BTC of het gaat door.' Board-druk stijgt.",
          timerMinutes: 14,
          roleActions: [
            {
              id: A_R4_CISO_VIA_EYE,
              label: "Onderhandeling via Eye Security, board tekent scope",
              description: "IR-partij doet OFAC-check, koopt tijd, houdt narratief onder controle.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { decision_quality: 2, compliance_awareness: 2 },
              qualityRank: "best",
              facilitatorCommentary: "Onze default. Sancties-check + narratieve controle + tijdswinning zonder direct te betalen.",
            },
            {
              id: "r4-ciso-noplay",
              label: "Niet betalen, geen onderhandeling",
              description: "Direct communiceren dat er niets betaald wordt.",
              allowedRoles: ["ciso"], irPlanAligned: false,
              scoreImpacts: { decision_quality: -1, communication_clarity: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "Kán juist zijn, maar zonder onderhandelplan verspil je optionaliteit. Onderhandelen ≠ betalen.",
            },
            {
              id: "r4-ciso-pay",
              label: "Board goedkeuring voor directe 15 BTC betaling",
              description: "Snel afkopen, herstel binnen 24 uur.",
              allowedRoles: ["ciso"], irPlanAligned: false,
              scoreImpacts: { decision_quality: -3, compliance_awareness: -2 },
              qualityRank: "wrong",
              facilitatorCommentary: "Zonder OFAC-check kan dit een sanctie-overtreding worden. Ook: veel betalers krijgen alsnog geen key.",
            },
            {
              id: "r4-ceo-mandaat",
              label: "CEO tekent scope-mandaat voor Eye Security onderhandeling",
              description: "Duidelijke autorisatie zonder betalingsverplichting.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { decision_speed: 1, decision_quality: 1 },
              qualityRank: "best",
              facilitatorCommentary: "Scope-mandaat is de sleutel: Eye kan onderhandelen zonder dat je iets belooft.",
            },
            {
              id: "r4-ceo-board-veto",
              label: "Wachten op board-veto voor elk gesprek",
              description: "Board wil per stap goedkeuring geven.",
              allowedRoles: ["ceo"], irPlanAligned: false,
              scoreImpacts: { decision_speed: -2 },
              qualityRank: "poor",
              facilitatorCommentary: "Micro-mandaat vertraagt onderhandeling zodanig dat attacker de deadline gebruikt tegen je.",
            },
          ],
        },
      },
      {
        id: inj_r4a, type: "inject", position: { x: 920, y: 940 },
        data: {
          kind: "inject",
          type: "media", channel: "ransom_note", urgency: "critical",
          title: "Ransom note",
          content: "'12u tot publicatie. 15 BTC of het gaat door. Geen onderhandeling.' — TidalWave",
          source: "Attacker", senderName: "TidalWave",
          targetTeam: "all", deliverySeconds: 0,
        },
      },
      {
        id: cha_r4, type: "chaser", position: { x: 1120, y: 940 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R4_CISO_VIA_EYE, afterRoundNumber: 4 },
          inject: {
            kind: "inject",
            type: "regulatory", channel: "email", urgency: "critical",
            title: "REROUTE — betaling zonder OFAC-check zou game over zijn",
            content: "[Facilitator reroute] Attacker-wallet is 1 hop van OFAC-sanctielijst. In het echt: handhavings-incident + geen key.\n\nIn de oefening: fictief nét geen sanctie-link, verhaal gaat door naar R5. In de debrief: waarom OFAC-check verplicht is.",
            source: "Facilitator", senderName: "Facilitator", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R5 — CISO + Legal (herstel + klantcomms) ─────────────────────────
      {
        id: r5, type: "round", position: { x: 220, y: 1240 },
        data: {
          kind: "round",
          title: "R5 — Herstel + klantcommunicatie",
          situation_update: "Attacker gaf de key na Eye-onderhandeling. Herstel is technisch mogelijk maar vraagt keuzes. Klanten willen ook horen wat er is gebeurd.",
          timerMinutes: 12,
          roleActions: [
            {
              id: A_R5_CISO_STRUCT_RESTORE,
              label: "Gestructureerd restore-plan met validation-checkpoints",
              description: "Backup-restore in fases + forensics-validation per fase.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { decision_quality: 3 },
              qualityRank: "best",
              facilitatorCommentary: "Fases + validation = de manier om herhalings-compromise te voorkomen. Duurt langer maar is duurzamer.",
            },
            {
              id: "r5-ciso-fast",
              label: "Snel volledige restore, validatie later",
              description: "Zo snel mogelijk operationeel, checks in de nasleep.",
              allowedRoles: ["ciso"], irPlanAligned: false,
              scoreImpacts: { decision_speed: 2, decision_quality: -2 },
              qualityRank: "poor",
              facilitatorCommentary: "Snel = mooi voor operations, maar attacker-persistence kan zo intact blijven. Trade-off tussen snelheid en zekerheid.",
            },
            {
              id: "r5-legal-24u",
              label: "Klanten binnen 24u informeren + FAQ + support-lijn",
              description: "Volledige transparantie met opties voor gedupeerden.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              scoreImpacts: { communication_clarity: 2, compliance_awareness: 2 },
              qualityRank: "best",
              facilitatorCommentary: "Proactieve klantcommunicatie is compliance én reputation-management in één. Geen alternatief.",
            },
            {
              id: "r5-legal-later",
              label: "Klanten informeren zodra scope écht rond is",
              description: "Wachten tot alle feiten helder zijn.",
              allowedRoles: ["legal"], irPlanAligned: false,
              scoreImpacts: { communication_clarity: -2, compliance_awareness: -1 },
              qualityRank: "poor",
              facilitatorCommentary: "AVG-eis is 'onverwijld'. Wachten geeft de indruk dat je iets verbergt.",
            },
          ],
        },
      },
      {
        id: inj_r5a, type: "inject", position: { x: 260, y: 1460 },
        data: {
          kind: "inject",
          type: "technical", channel: "email", urgency: "medium",
          title: "Eye Security — key ontvangen, herstel kan starten",
          content: "Onderhandeling succesvol; attacker leverde key na scope-druk. Restore is technisch klaar om te starten.",
          source: "Eye Security", senderName: "Eye IR-lead",
          targetTeam: "all", deliverySeconds: 0,
        },
      },
      {
        id: cha_r5, type: "chaser", position: { x: 460, y: 1460 },
        data: {
          kind: "chaser",
          condition: { kind: "decision_not_taken", roleActionId: A_R5_CISO_STRUCT_RESTORE, afterRoundNumber: 5 },
          inject: {
            kind: "inject",
            type: "technical", channel: "siem", urgency: "high",
            title: "Follow-up compromise gedetecteerd",
            content: "3 dagen na restore: nieuwe verdachte activiteit op dezelfde subnet. Attacker-persistence was niet volledig geruimd.\n\n[Facilitator-hint] Snel restoreren zonder validation = tweede kans voor de attacker. Verhaal gaat door.",
            source: "MDR", senderName: "MDR SOC", reliability: "fact",
            targetTeam: "all",
          },
        },
      },

      // ── R6 — Debrief ─────────────────────────────────────────────────────
      {
        id: r6, type: "round", position: { x: 880, y: 1240 },
        data: {
          kind: "round",
          title: "R6 — Debrief",
          situation_update: "Incident gestabiliseerd. De outcome wordt automatisch gekozen op basis van jullie cumulatieve dimensie-score.",
          timerMinutes: 8,
          facilitatorNotes: {
            discussionGoal: "Trade-offs zichtbaar maken: snel handelen kostte compliance? Communicatie was strak maar tempo laag?",
            keyQuestions: ["Welke dimensie liep het meest achter?", "Waar was de duurste keuze?"],
            hints: [], expectedDecisions: [], redFlags: [],
          },
        },
      },
      {
        id: inj_r6, type: "inject", position: { x: 920, y: 1460 },
        data: {
          kind: "inject",
          type: "internal", channel: "memo", urgency: "low",
          title: "Debrief-start",
          content: "Bekijk het rapport voor de per-dimensie-breakdown en de outcome-band waarin jullie score valt.",
          source: "Facilitator", senderName: "Facilitator",
          targetTeam: "all", deliverySeconds: 0,
        },
      },

      // ── Outcomes met scoreRange (cumulatieve som van alle dimensies) ────
      {
        id: out_gold, type: "outcome", position: { x: 1220, y: 1140 },
        data: {
          kind: "outcome",
          key: "outcome_gold",
          label: "★ Gold — Voorbeeldige respons",
          narrative: "Eye direct actief, meldingen op tijd, communicatie strak, herstel gestructureerd. Board tevreden.",
          scoreImpact: 0, scoreRange: { min: 14 },
          lessonLearned: "De combinatie van snelheid, kwaliteit én compliance was consistent. Dat is zeldzaam.",
        },
      },
      {
        id: out_silver, type: "outcome", position: { x: 1220, y: 1280 },
        data: {
          kind: "outcome",
          key: "outcome_silver",
          label: "Silver — Solide met kleine kreuken",
          narrative: "Meeste keuzes goed, één of twee trade-offs kostten punten op één dimensie.",
          scoreImpact: 0, scoreRange: { min: 5, max: 13 },
          lessonLearned: "Kijk terug op welke dimensie het meest afwijkt — daar zit vaak je grootste verbeter-slag.",
        },
      },
      {
        id: out_bronze, type: "outcome", position: { x: 1220, y: 1420 },
        data: {
          kind: "outcome",
          key: "outcome_bronze",
          label: "Bronze — Wisselvallig",
          narrative: "Meerdere keuzes waren traag of niet-consistent. Meldplicht net op tijd, reputatie geraakt.",
          scoreImpact: 0, scoreRange: { min: -3, max: 4 },
          lessonLearned: "Rol-mandaten waren onduidelijk; het team wachtte vaak op elkaar.",
        },
      },
      {
        id: out_meltdown, type: "outcome", position: { x: 1220, y: 1560 },
        data: {
          kind: "outcome",
          key: "outcome_meltdown",
          label: "Meltdown — reroute nodig gehad",
          narrative: "Reroute-injects moesten worden ingezet — in werkelijkheid was er materiële schade en handhavings-risico.",
          scoreImpact: 0, scoreRange: { max: -4 },
          lessonLearned: "De reroute is oefeningshulp. Bespreek in de debrief waarom die keuze in het echt onomkeerbaar was.",
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: inj_r1a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r1, target: inj_r1b, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r1, target: r2, type: "sequence" },
      { id: id("e"), source: r2, target: inj_r2a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r2, target: r3, type: "sequence" },
      { id: id("e"), source: r3, target: inj_r3a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r3, target: inj_r3b, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r3, target: r4, type: "sequence" },
      { id: id("e"), source: r4, target: inj_r4a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r4, target: r5, type: "sequence" },
      { id: id("e"), source: r5, target: inj_r5a, sourceHandle: "injects", type: "inject" },
      { id: id("e"), source: r5, target: r6, type: "sequence" },
      { id: id("e"), source: r6, target: inj_r6, sourceHandle: "injects", type: "inject" },
      // Alle outcomes verbonden — engine kiest op scoreRange.
      { id: id("e"), source: r6, target: out_silver, type: "outcome" },
      { id: id("e"), source: r6, target: out_gold, type: "outcome" },
      { id: id("e"), source: r6, target: out_bronze, type: "outcome" },
      { id: id("e"), source: r6, target: out_meltdown, type: "outcome" },
    ],
  }
}
