import type { ScenarioGraph } from "./types"

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── NIS2 Deep-Dive Showcase ────────────────────────────────────────────────
// Alles wat een toezichthouder-oefening moet raken:
// - 24u vroegtijdige waarschuwing (art. 23 lid 4 NIS2)
// - 72u meldingsplicht (art. 23 lid 4b)
// - 30-dagen finaal rapport (art. 23 lid 4c)
// - Bestuurdersverantwoordelijkheid (art. 20)
// - Business continuity + incident-response beleid (art. 21)
// - Supply chain risicomanagement (art. 21 lid 2d)

export function nis2ShowcaseExample(): ScenarioGraph {
  const now = Date.now()
  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round"), r4 = id("round"), r5 = id("round")
  // Two additional compliance checkpoints (facilitator-triggered) that route to different outcomes
  const decA = id("dec"), decB = id("dec"), decC1 = id("dec"), decC2 = id("dec"), decD = id("dec")
  const specJourn = id("spec"), specAp = id("spec")
  const outFullCompliance = id("out")
  const outLate24h = id("out")
  const outMissed72h = id("out")
  const outBoardFail = id("out")
  const outExemplary = id("out")

  // Injects
  const i1a = id("inj"), i1b = id("inj"), i1c = id("inj"), i1d = id("inj")
  const i2a = id("inj"), i2b = id("inj"), i2c = id("inj"), i2d = id("inj")
  const i3a = id("inj"), i3b = id("inj"), i3c = id("inj")
  const i4a = id("inj"), i4b = id("inj"), i4c = id("inj")
  const i5a = id("inj")

  return {
    id: id("graph"),
    name: "OPERATIE POLDER — NIS2 Compliance Test",
    version: 1,
    scenarioType: "supply_chain_compromise",
    createdAt: now,
    updatedAt: now,
    irRetainerName: "Cronos Digital Forensics (IR-retainer)",
    irPlaybook: `## Crisis Playbook — OPERATIE POLDER

Dit playbook is aangeleverd door de organisatie. Gebruik het als referentie, MAAR:
sommige passages zijn gedateerd of onjuist. Verifieer feiten vóór je erop handelt.

## Ransomware — organisatie-beleid
- Betaling toegestaan tot MAX 5 BTC (approval CFO + CEO gezamenlijk vereist)
- Onderhandelingskanaal: uitsluitend via IR-retainer (nooit direct met attacker)
- Cyberverzekeraar (Cybersure BV) dekt tot €1M ransom-schade
- Aangifte politie: verplicht binnen 48u ongeacht betaalbesluit

## NIS2 meldingsplichten
- Vroegtijdige waarschuwing NCSC: binnen 24u van 'significant' incident
- Volledige melding aan sectorregelaar: binnen 72u
- Finale rapport: binnen 30 dagen post-incident
- Bestuurders (CEO, CFO) persoonlijk aansprakelijk onder art. 20

## AVG parallel-track
- 72u melding bij AP indien datalek waarschijnlijk
- Individuele notificatie bij 'hoog risico' (art. 34)
- Medische data = altijd hoog risico → categorie 9

## Klantcommunicatie
- Getroffen klanten binnen 4u telefonisch benaderen (NIET per e-mail)
- Persverklaring pas na directie-goedkeuring
- Social media monitoring via PR-agency

## IR-retainer contact
- 24/7 nummer: +31 (0)20 555 0100
- Escalatie via ir-lead@cronos.example
- SLA: eerste respons < 2u, on-site < 4u

## Herstel-prioriteiten
- Kritische tenants eerst (contractueel vastgelegd, zie appendix A)
- Backups op 3 locaties: prod-cloud, warm-standby, cold-archief
- RTO 4u voor tier-1 klanten, 24u voor tier-2

## LET OP — bekende gedateerde passages
- 'Ransomware onderhandelen mag als polis-cover' — dit is achterhaald, NCSC-advies is nooit betalen
- 'AP-melding pas na volledige forensics' — onjuist, 72u is hard, ook onvolledig
- 'Board pas informeren na containment' — onjuist onder NIS2 art. 20`,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 300 }, data: { kind: "start" } },

      // ═══ R1 — Detection & Early Warning (0-24u venster) ══════════════════
      {
        id: r1, type: "round", position: { x: 260, y: 260 },
        data: {
          kind: "round",
          title: "Detectie — de 24-uurs klok begint",
          situation_update: "06:12 — SOC detecteert massale versleuteling op fileservers. Ransom note van 'DarkBridge' op meerdere endpoints. Uw organisatie valt onder NIS2 als essentiële entiteit. Vanaf nu tikt de 24-uurs vroegtijdige-waarschuwingsklok naar NCSC. De 72-uurs meldingsklok naar de sectoriële toezichthouder ook.",
          timerMinutes: 15,
          bobPhase: "beeldvorming",
          openingPrompts: [
            "Wat weten we zeker op dit moment vs. wat is aanname?",
            "Welke drie NIS2-klokken beginnen nu — wie houdt ze bij?",
            "Wie is de crisisleider en heeft die formeel mandaat?",
          ],
          roleActions: [
            {
              id: "r1-declare-nis2", label: "Incident formeel declareren + NIS2 protocol activeren",
              description: "Uitroepen van 'significant incident' onder NIS2. Start alle wettelijke klokken en informeer de CMT.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 8, linkedDimension: "compliance_awareness",
              lessonLearned: "NIS2 art. 23 vereist 'onverwijlde' declaratie zodra een incident 'significant' lijkt. Vroege declaratie = klok in eigen hand, geen discussie achteraf met NCSC.",
            },
            {
              id: "r1-ceo-mandate", label: "CEO neemt regie: benoemt crisisleider + mandaat",
              description: "CEO wijst formeel crisisleider aan (typisch CISO) met beslismandaat voor de eerste 24u.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 8, linkedDimension: "mandate_clarity",
              lessonLearned: "NIS2 art. 20 legt bestuurdersverantwoordelijkheid op — CEO moet zichtbaar governance-eigenaar zijn, niet delegeren zonder mandaat-vastlegging.",
            },
            {
              id: "r1-legal-clocks", label: "Legal start de 24/72u/30-dagen tijdlijnen",
              description: "Legal noteert exacte declaratie-tijd, plant vroegtijdige waarschuwing binnen 24u naar NCSC/sectorregelaar.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 7, linkedDimension: "escalation_timing",
              lessonLearned: "Drie klokken parallel: 24u vroegtijdige waarschuwing (art. 23 lid 4a), 72u volledige melding (lid 4b), 30d finaal rapport (lid 4c). Legal moet ze afzonderlijk bijhouden.",
            },
            {
              id: "r1-contain", label: "IT: containment — isoleer geïnfecteerde segmenten",
              description: "Netwerksegmentatie: knip getroffen segmenten los, behoud forensische data.",
              allowedRoles: ["it_manager", "ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 6, linkedDimension: "decision_quality",
              lessonLearned: "Containment vóór eradicatie. Sluit netwerk maar wis niets — forensische data heb je nodig voor de 30-dagen rapport.",
            },
            {
              id: "r1-cfo-insurance", label: "CFO activeert cyberverzekeraar + reserveert budget",
              description: "Notice-of-loss binnen contractueel raam, reserveer €500K voor externe IR + juridisch.",
              allowedRoles: ["cfo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 5, linkedDimension: "decision_speed",
              lessonLearned: "Vroegtijdige notice-of-loss voorkomt polis-afwijzing. Meeste polissen eisen melding binnen 24-48u van ontdekking.",
            },
            {
              id: "r1-comms-hold", label: "Comms: bereid holding statement voor",
              description: "Head of Comms schrijft een klaar-om-te-gebruiken persverklaring, met CEO goedkeuring.",
              allowedRoles: ["head_of_comms"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 4, linkedDimension: "communication_clarity",
              lessonLearned: "Wachten met communicatie-voorbereiding tot je moet, is te laat. Holding statement in bureau = keuze om wel/niet te publiceren, niet frantic schrijven.",
            },
            {
              id: "r1-wait", label: "Wachten op bevestiging voor we escaleren",
              description: "Laten we eerst zeker zijn dat het echt significant is voor we alarm slaan.",
              allowedRoles: [], irPlanAligned: false,
              scoreImpact: -8, linkedDimension: "escalation_timing",
              lessonLearned: "NIS2 tolereert geen 'wait-and-see'. Toezichthouder ziet late declaratie als schending van 'onverwijld' vereiste. Kies fout-op-vroeg boven fout-op-laat.",
            },
            {
              id: "r1-follow-playbook-blindly",
              label: "Playbook zegt 'ransom onderhandelen mag' — open kanaal",
              description: "In het IR-plan staat expliciet dat ransomware-betaling toegestaan is tot 5 BTC. Laten we direct onderhandeling openen.",
              allowedRoles: ["ceo", "cfo"], irPlanAligned: false,
              scoreImpact: -8, linkedDimension: "decision_quality",
              lessonLearned: "Klassieke BOB-fout: aanname (playbook is actueel) wordt niet getoetst. Playbook is deels achterhaald — NCSC-beleid is niet betalen. Blind volgen van documenten zonder verificatie is een valstrik.",
            },
          ],
          learningObjectives: [
            {
              id: "obj-early-declare",
              description: "Incident wordt binnen 60 min gedeclareerd onder NIS2",
              module: "detection_sensemaking", measuredBy: "decision",
              triggerActionIds: ["r1-declare-nis2"],
            },
            {
              id: "obj-ceo-mandate",
              description: "CEO neemt zichtbaar bestuurdersverantwoordelijkheid",
              module: "detection_sensemaking", measuredBy: "decision",
              triggerActionIds: ["r1-ceo-mandate"],
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test of het team de drie NIS2-klokken kent én meteen laat lopen. Test of CEO regie neemt zonder gevraagd te worden.",
            keyQuestions: [
              "Wat betekent 'significant incident' voor onze organisatie?",
              "Welke drie NIS2-klokken beginnen nu? Wie houdt ze bij?",
              "Wie is de crisisleider en heeft die formeel mandaat?",
            ],
            hints: [
              "NIS2 art. 23 lid 4a: 24u vroegtijdige waarschuwing",
              "NIS2 art. 23 lid 4b: 72u volledige melding",
              "NIS2 art. 23 lid 4c: 30d finaal rapport",
            ],
            expectedDecisions: [
              "CISO declareert incident formeel",
              "CEO benoemt crisisleider expliciet",
              "Legal start klok-registratie",
              "IT start containment",
            ],
            redFlags: [
              "Team wacht op forensische zekerheid vóór declaratie",
              "CEO delegeert stilzwijgend zonder mandaat vast te leggen",
              "Niemand houdt formeel de 24/72u tijden bij",
              "Alleen technisch team reageert, geen governance-spoor",
            ],
          },
        },
      },
      {
        id: i1a, type: "inject", position: { x: 220, y: 500 },
        data: {
          kind: "inject", type: "alert", channel: "siem", urgency: "critical",
          title: "SOC: massale encryptie op FS-cluster",
          content: "Detected: >4000 file writes/sec, extensions .locked. Origin: internal subnet 10.20.30.0/24. Ransom note on desktops.",
          source: "SOC", senderName: "SOC L2", timestamp: "06:12",
          targetTeam: "technical_it", nis2Relevant: true, deliverySeconds: 0,
          reliability: "fact",
        },
      },
      {
        id: i1b, type: "inject", position: { x: 400, y: 500 },
        data: {
          kind: "inject", type: "regulatory", channel: "email", urgency: "high",
          title: "Legal: NIS2 klok tikt — actie vereist",
          content: "Team, dit lijkt op een significant incident onder NIS2. Ik heb 24u om NCSC en sectorregelaar te informeren. Wie declareert formeel?",
          source: "Legal", senderName: "General Counsel", timestamp: "06:35",
          targetRoles: ["ceo", "ciso", "legal"], nis2Relevant: true, deliverySeconds: 180,
          reliability: "fact",
        },
      },
      {
        id: i1c, type: "inject", position: { x: 580, y: 500 },
        data: {
          kind: "inject", type: "executive", channel: "phone", urgency: "high",
          title: "Board voorzitter belt CEO",
          content: "Ik hoor via Sander (RvC-lid) dat er iets aan de hand is. Wat is er en wanneer krijg ik een briefing? Ik wil elke 2u een update.",
          source: "Board", senderName: "Voorzitter RvC", timestamp: "07:00",
          targetRoles: ["ceo"], deliverySeconds: 420,
          reliability: "fact",
        },
      },
      {
        id: i1d, type: "inject", position: { x: 760, y: 500 },
        data: {
          kind: "inject", type: "internal", channel: "whatsapp", urgency: "low",
          title: "Collega app't: 'kan een test zijn?'",
          content: "Hey — is dit misschien de red-team-oefening waar Mark het over had? Ik zag laatst een mail dat er dit kwartaal een pentest zou zijn.",
          source: "Collega ops", senderName: "Ops teamlead",
          timestamp: "06:20", targetTeam: "technical_it", deliverySeconds: 60,
          reliability: "misleading",
        },
      },

      // ═══ R2 — Assessment & Early Warning verplicht (binnen 24u) ══════════
      {
        id: r2, type: "round", position: { x: 620, y: 260 },
        data: {
          kind: "round",
          title: "Assessment — vroegtijdige waarschuwing (voor 24u)",
          situation_update: "10:00 — Cronos IR-partij is aangesloten. Vermoedelijke scope: 8 klant-tenants, waaronder medische data (NoordZorg). Verzekeraar wil impact-inschatting. Klok naar 24u: nog 20u. Vroegtijdige waarschuwing MOET voor 06:12 morgen bij NCSC binnen zijn.",
          timerMinutes: 15,
          bobPhase: "beeldvorming",
          openingPrompts: [
            "Welke scope-info is bevestigd door forensics vs. wat is nog aanname?",
            "Welke MELDINGEN moeten binnen 24u — en aan wie precies?",
            "Wat gaat er WEL en NIET in een vroegtijdige waarschuwing?",
          ],
          roleActions: [
            {
              id: "r2-early-warning", label: "CISO stuurt vroegtijdige waarschuwing naar NCSC",
              description: "Formele NIS2 vroegtijdige waarschuwing (art. 23 lid 4a) — nog geen definitieve scope nodig, wel indicatie en genomen maatregelen.",
              allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 10, linkedDimension: "compliance_awareness",
              lessonLearned: "Vroegtijdige waarschuwing binnen 24u is NIET-onderhandelbaar onder NIS2 voor essentiële entiteiten. Ontbreken = handhavingszaak + bestuurdersboete. Melding hoeft nog niet compleet te zijn.",
            },
            {
              id: "r2-ceo-board-brief", label: "CEO briefingt board schriftelijk",
              description: "Formele memo naar board: wat is er, wat is impact, welke besluiten worden voorbereid, wanneer volgt update.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 7, linkedDimension: "mandate_clarity",
              lessonLearned: "Board moet 'toezicht kunnen houden'. Schriftelijke updates elke 2-4u tijdens crisis is de standaard voor beursgenoteerde en NIS2-essentiële entiteiten.",
            },
            {
              id: "r2-legal-scope", label: "Legal beoordeelt AVG-datalek + NIS2 scope",
              description: "Categoriseren getroffen data (medisch = art. 9 AVG bijzonder), aantal betrokkenen, aparte 72u AP-klok start.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 8, linkedDimension: "compliance_awareness",
              lessonLearned: "NIS2 én AVG kunnen tegelijk van toepassing zijn — parallelle meldingsplichten. Medische data = art. 9 = altijd 'hoog risico' = individuele notificatie waarschijnlijk vereist.",
            },
            {
              id: "r2-ops-continuity", label: "Ops Manager activeert bedrijfscontinuïteitsplan",
              description: "Noodprocedures aan, alternatieve leveranciers/kanalen, RTO/RPO analyse.",
              allowedRoles: ["ops_manager", "ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 6, linkedDimension: "decision_quality",
              lessonLearned: "NIS2 art. 21 vereist een BCP. Toezichthouder zal na afloop vragen of het is geactiveerd en getest. Papier alleen is niet genoeg.",
            },
            {
              id: "r2-customer-notify", label: "Comms: getroffen klanten proactief bellen",
              description: "Vóór de pers of hun eigen SOC het ziet — persoonlijk telefonisch contact met key accounts.",
              allowedRoles: ["head_of_comms", "ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 7, linkedDimension: "communication_clarity",
              lessonLearned: "Klanten die het via Twitter horen worden een handhavingsklachten-tegen-jou. Proactieve klantcommunicatie = verzekerings- én reputatie-hedge.",
            },
            {
              id: "r2-cfo-quantify", label: "CFO: kwantificeer directe + potentiële schade",
              description: "Downtime kosten × verwachte duur + potentiële boete-range + verzekerings-dekking gap.",
              allowedRoles: ["cfo"], irPlanAligned: true,
              scoreImpact: 5, linkedDimension: "decision_quality",
              lessonLearned: "Financiële kwantificering ondersteunt board-besluiten. Zonder cijfers geen goede afweging pay vs recover.",
            },
            {
              id: "r2-delay-warning", label: "Nog even wachten met NCSC-melding tot scope duidelijker is",
              description: "We willen niet halfbakken bij toezichthouder aankomen.",
              allowedRoles: [], irPlanAligned: false,
              scoreImpact: -10, linkedDimension: "compliance_awareness",
              lessonLearned: "Het uitstellen van de 24u vroegtijdige waarschuwing is de meest voorkomende NIS2-schending. Toezichthouder bekijkt logs én mailtijden — 'we wisten het al vroeger' is fataal.",
            },
            {
              id: "r2-reactive-tweet", label: "Publiceer direct persverklaring op basis van MoonRock's tweet",
              description: "MoonRock CEO tweet zegt dat onze data lekt — laten we direct reageren met een statement.",
              allowedRoles: ["ceo", "head_of_comms"], irPlanAligned: false,
              scoreImpact: -9, linkedDimension: "decision_quality",
              lessonLearned: "Tweet van MoonRock CEO was ongefundeerd — geen forensisch bewijs dat data lekt op dat moment. Reactie op aanname = zelf bevestigen van desinformatie. BOB-fout: aanname wordt feit door onze eigen respons.",
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test of het team de 24u-klok actief bewaakt en niet uitstelt vanwege onvolledige info.",
            keyQuestions: [
              "Wat MOET er in de vroegtijdige waarschuwing staan en wat niet?",
              "Zijn medische gegevens getroffen — wat betekent dat voor AVG?",
              "Is de board voldoende geïnformeerd om oversight te houden?",
            ],
            hints: [
              "De vroegtijdige waarschuwing hoeft NIET compleet te zijn — wel: indicatie, mogelijke oorzaak, genomen maatregelen.",
              "NoordZorg (medische data) → art. 9 AVG → individuele notificatie waarschijnlijk vereist.",
            ],
            expectedDecisions: [
              "CISO stuurt vroegtijdige waarschuwing",
              "Legal splitst NIS2 en AVG tijdlijnen",
              "CEO briefingt board schriftelijk",
              "Ops activeert BCP",
            ],
            redFlags: [
              "Team wil compleet plaatje voor melding",
              "Board wordt niet geïnformeerd of alleen mondeling",
              "AVG en NIS2 worden verward of samen behandeld",
            ],
          },
          learningObjectives: [
            {
              id: "obj-24h",
              description: "Vroegtijdige waarschuwing wordt binnen het 24u venster ingediend",
              module: "legal_regulatory", measuredBy: "decision",
              triggerActionIds: ["r2-early-warning"],
            },
          ],
        },
      },
      {
        id: i2a, type: "inject", position: { x: 580, y: 500 },
        data: {
          kind: "inject", type: "executive", channel: "email", urgency: "high",
          title: "MoonRock B2B belt: 'Wat gebeurt er?'",
          content: "Onze SOC ziet raar patroon. We overwegen SLA-melding EN AP-melding. Bel me terug binnen 2u.",
          source: "MoonRock", senderName: "CISO MoonRock", timestamp: "09:10",
          targetRoles: ["ceo", "head_of_comms", "ciso"], deliverySeconds: 0,
          reliability: "assumption",
        },
      },
      {
        id: i2b, type: "inject", position: { x: 760, y: 500 },
        data: {
          kind: "inject", type: "regulatory", channel: "email", urgency: "high",
          title: "NoordZorg: 'medische gegevens = NEN 7510 categorie-A'",
          content: "Als medische gegevens exfiltreerd zijn: IGJ binnen 24u, patiënten individueel binnen 72u. Wij vragen schriftelijke bevestiging van jullie IR-partij.",
          source: "NoordZorg", senderName: "DPO NoordZorg", timestamp: "09:24",
          targetRoles: ["legal", "ciso"], nis2Relevant: true, deliverySeconds: 200,
          reliability: "fact",
        },
      },
      {
        id: i2c, type: "inject", position: { x: 940, y: 500 },
        data: {
          kind: "inject", type: "regulatory", channel: "email", urgency: "medium",
          title: "NCSC: 'wij zien signalen — is er iets bij jullie?'",
          content: "Wij hebben chatter gezien over jullie tenant op een leak-blog. Kunnen jullie bevestigen of ontkennen? Anders publiceren wij op basis van bronnen.",
          source: "NCSC", senderName: "NCSC on-duty officer", timestamp: "11:00",
          targetRoles: ["ciso", "legal", "ceo"], nis2Relevant: true, deliverySeconds: 480,
          reliability: "fact",
        },
      },
      {
        id: i2d, type: "inject", position: { x: 1120, y: 500 },
        data: {
          kind: "inject", type: "media", channel: "news", urgency: "high",
          title: "MoonRock CEO twittert: 'onze data lekt bij SaaS-provider'",
          content: "Sander Klaassen (@sanderk) op X: 'Slechte dienstverlening bij onze SaaS-leverancier. Onze klantdata is aan het lekken. Waarschuw jezelf.' — 2400 retweets in 20 min.",
          source: "Twitter/X", senderName: "MoonRock CEO",
          senderHandle: "@sanderk",
          timestamp: "11:30", targetTeam: "all", deliverySeconds: 600,
          reliability: "misleading",
        },
      },

      // ═══ Decision A — Publieke communicatie strategie ═══════════════════
      {
        id: decA, type: "decision", position: { x: 980, y: 260 },
        data: {
          kind: "decision",
          prompt: "Hoe communiceer je nu naar buiten? De pers begint te bellen, klanten twijfelen.",
          measuredBy: "participant_choice",
          options: [
            {
              id: "opt-transparent", label: "Vol transparant + proactieve klantcalls",
              roleActionId: "r2-customer-notify",
              scoreImpact: 8, linkedDimension: "communication_clarity",
              lessonLearned: "Volledige transparantie is de weg met minste reputatieschade in NIS2-context — bevestigt goed bestuur.",
            },
            {
              id: "opt-holding", label: "Holding statement + selectief bellen",
              roleActionId: "r2-comms-hold",
              scoreImpact: 3, linkedDimension: "communication_clarity",
              lessonLearned: "Holding statement is acceptabel maar creëert een informatie-vacuüm dat door speculatie wordt gevuld.",
            },
            {
              id: "opt-silent", label: "Stil houden — wachten tot forensics compleet is",
              roleActionId: "r2-delay-warning",
              scoreImpact: -8, linkedDimension: "communication_clarity",
              lessonLearned: "Stil houden werkt niet meer — attackers, klanten en NCSC hebben eigen kanalen. NIS2 art. 23 lid 5 kan communicatie zelfs verplichten.",
            },
          ],
        },
      },

      // ═══ R3 — 24u milestone + Q&A ═════════════════════════════════════════
      {
        id: r3, type: "round", position: { x: 1340, y: 260 },
        data: {
          kind: "round",
          title: "24u-milestone bereikt — nu de 72u-klok",
          situation_update: "23:12 — Vroegtijdige waarschuwing is uit (of niet). Pers publiceert. NoordZorg heeft eigen AP-melding gedaan (dus toezichthouder weet nu extern van jouw incident). Nog 48u tot volledige NIS2-melding. Team is uitgeput, board wil vandaag beslissing over ransom.",
          timerMinutes: 15,
          bobPhase: "oordeel",
          openingPrompts: [
            "Welke opties hebben we voor de ransom-beslissing? Weegt legal/verzekering elk apart mee?",
            "Wat weten we over de attacker (capaciteit, betrouwbaarheid), en wat is aanname?",
            "Wat gaat er in de 72u-melding — feiten, geen speculatie.",
          ],
          roleActions: [
            {
              id: "r3-nis2-full-prep", label: "Legal + CISO bereiden 72u NIS2-melding voor",
              description: "Volledige melding: aard, ernst, impact, oorzaak (indien bekend), maatregelen, grensoverschrijdende impact.",
              allowedRoles: ["legal", "ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 9, linkedDimension: "compliance_awareness",
              lessonLearned: "72u melding vereist substantieel meer detail dan vroegtijdige waarschuwing. Voorbereiding starten meteen na 24u = essentieel voor kwaliteit.",
            },
            {
              id: "r3-ceo-decision-frame", label: "CEO structureert ransom-beslissing (pay/no-pay/negotiate)",
              description: "Formele beslismethode: criteria, alternatieven, legal advies, financieel, ethisch. Board conviction.",
              allowedRoles: ["ceo", "cfo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 8, linkedDimension: "mandate_clarity",
              lessonLearned: "Ransom-besluit is textbook bestuursbesluit. Onvoldoende structuur = toezichthouder én verzekeraar zullen na afloop 'proces onvoldoende zorgvuldig' vinden.",
            },
            {
              id: "r3-comms-daily", label: "Comms: dagelijkse update-briefings inplannen",
              description: "Vaste tijden voor updates naar medewerkers, klanten, pers — voorkomt info-vacuüm.",
              allowedRoles: ["head_of_comms", "ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 6, linkedDimension: "communication_clarity",
              lessonLearned: "Voorspelbaarheid van communicatie = vertrouwenswinst. 'Er is elke dag om 14:00 een update' voorkomt 20 mails per dag.",
            },
            {
              id: "r3-hr-employees", label: "HR: medewerkers-communicatie + support-lijn",
              description: "Alle medewerkers weten wat te doen bij vragen van externen, en hebben iemand om zorgen te delen.",
              allowedRoles: ["hr_lead"], irPlanAligned: true,
              scoreImpact: 5, linkedDimension: "communication_clarity",
              lessonLearned: "Medewerkers zijn vaak eerste woordvoerder ongewild. Instructies + steun = ambassadeurs ipv anonieme bronnen.",
            },
            {
              id: "r3-ops-recovery-plan", label: "Ops: technisch herstelplan met RTO per tenant",
              description: "Prioriteitenlijst welke tenant wanneer online, welke back-ups.",
              allowedRoles: ["ops_manager", "it_manager"], irPlanAligned: true,
              scoreImpact: 6, linkedDimension: "decision_quality",
              lessonLearned: "Prioritering met SLA-consequenties per tenant maakt keuzes verdedigbaar naar klanten en toezichthouder.",
            },
            {
              id: "r3-skip-formal", label: "Board-briefing overslaan — team is te druk",
              description: "We doen het wel als het wat rustiger is.",
              allowedRoles: [], irPlanAligned: false,
              scoreImpact: -7, linkedDimension: "mandate_clarity",
              lessonLearned: "Board oversight kan niet worden opgeschort tijdens crisis — juist dán is het nodig. NIS2 art. 20 = permanente verantwoordelijkheid.",
            },
            {
              id: "r3-trust-attacker-deadline",
              label: "Vertrouw op DarkBridge 'deadline' — plan onderhandeling in",
              description: "Attackers noemen 48u — dat geeft ons ruimte om te onderhandelen.",
              allowedRoles: ["ceo", "cfo"], irPlanAligned: false,
              scoreImpact: -7, linkedDimension: "decision_quality",
              lessonLearned: "Attacker-deadlines zijn tactische pressure, geen contract. Vertrouwen dat de deadline gehaald wordt is aanname. BOB-oordeelsvorming: alternatieve hypothesen (o.a. 'attacker publiceert eerder om druk te verhogen') niet gewogen.",
            },
          ],
          learningObjectives: [
            {
              id: "obj-72h",
              description: "72u NIS2-melding wordt onderbouwd voorbereid",
              module: "legal_regulatory", measuredBy: "decision",
              triggerActionIds: ["r3-nis2-full-prep"],
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test of het team parallel de 72u-melding voorbereidt terwijl grote beslissingen (ransom) op tafel liggen.",
            keyQuestions: [
              "Wat gaat er in de 72u-melding staan?",
              "Hoe framework het team het pay/no-pay besluit?",
              "Wie communiceert wanneer met wie?",
            ],
            hints: [
              "72u-melding schema: aard + ernst + impact + oorzaak + maatregelen + grensoverschrijdend?",
            ],
            expectedDecisions: ["72u voorbereiding start", "Ransom-besluit geframed", "Communicatie-cadans vastgesteld"],
            redFlags: [
              "72u-melding wordt tot uur 71 uitgesteld",
              "Ransom-besluit wordt door één persoon genomen zonder proces",
              "Board wordt genegeerd 'omdat er teveel te doen is'",
            ],
          },
        },
      },
      {
        id: i3a, type: "inject", position: { x: 1300, y: 500 },
        data: {
          kind: "inject", type: "media", channel: "news", urgency: "critical",
          title: "NOS publiceert: 'Grote SaaS-provider getroffen door ransomware'",
          content: "Volgens bronnen zijn tientallen klanten getroffen. NoordZorg heeft een AP-melding gedaan. De organisatie zelf zou nog geen commentaar hebben gegeven.",
          source: "NOS", senderName: "Sanne Visser", timestamp: "22:00",
          targetTeam: "all", deliverySeconds: 0,
          reliability: "assumption",
        },
      },
      {
        id: i3b, type: "inject", position: { x: 1500, y: 500 },
        data: {
          kind: "inject", type: "regulatory", channel: "phone", urgency: "high",
          title: "Sectoriële toezichthouder belt",
          content: "Wij hebben uw vroegtijdige waarschuwing ontvangen (of we hebben niks). We verwachten de volledige melding voor overmorgen 06:12. Ook: wat is de status van bestuursbetrokkenheid?",
          source: "Toezichthouder", senderName: "NIS2 team", timestamp: "23:45",
          targetRoles: ["ciso", "legal", "ceo"], nis2Relevant: true, deliverySeconds: 360,
          reliability: "fact",
        },
      },
      {
        id: i3c, type: "inject", position: { x: 1680, y: 500 },
        data: {
          kind: "inject", type: "intel", channel: "email", urgency: "medium",
          title: "Threat intel: DarkBridge lekt zelden na betaling",
          content: "Onze threat-intel-partner meldt: 'DarkBridge heeft historisch in 60% van de gevallen alsnog data gepubliceerd na betaling. Bron: dark-web observatie afgelopen 6 maanden.'",
          source: "IR-retainer", senderName: "Cronos Threat Intel",
          timestamp: "23:50", targetRoles: ["ciso", "ceo", "cfo"], deliverySeconds: 480,
          reliability: "assumption",
        },
      },

      // ═══ Journalist Special (na R3) ═════════════════════════════════════
      {
        id: specJourn, type: "special", position: { x: 1660, y: 260 },
        data: {
          kind: "special",
          type: "journalist_qa",
          assignedRole: "head_of_comms",
          thresholds: [
            { id: "bad", label: "Slecht (< 0)", predicate: { op: "<", value: 0 } },
            { id: "good", label: "Goed (>= 0)", predicate: { op: ">=", value: 0 } },
          ],
        },
      },

      // ═══ Decision B — Ransom-besluit ═════════════════════════════════════
      {
        id: decB, type: "decision", position: { x: 1980, y: 260 },
        data: {
          kind: "decision",
          prompt: "48u sinds detectie — betaal je losgeld of ga je door met herstel?",
          measuredBy: "facilitator_trigger",
          triggerRole: "ceo",
          options: [
            {
              id: "opt-pay", label: "Betaal 15 BTC om lekpublicatie te stoppen",
              scoreImpact: -10, linkedDimension: "compliance_awareness",
              lessonLearned: "Betaling is zowel juridisch (sanctielijsten!) als beleidsmatig (NCSC-advies) ontraden. Financiert criminaliteit én garandeert niets. Toezichthouder zal het als beleidsfalen zien.",
            },
            {
              id: "opt-recover", label: "Ga door met herstel via clean back-ups + aangifte",
              scoreImpact: 9, linkedDimension: "decision_quality",
              lessonLearned: "Niet-betalen + aangifte + samenwerking met NCSC is het aanbevolen pad. Kost meer tijd, maar bouwt reputatie én compliance-argument voor toezichthouder.",
            },
            {
              id: "opt-partial", label: "Onderhandelen om tijd te winnen (geen intentie te betalen)",
              scoreImpact: 2, linkedDimension: "decision_quality",
              lessonLearned: "Tactische onderhandeling kan intel opleveren. Alleen doen met IR-partij; documenteren dat er geen betalingsintentie is voor toezichthouder-registratie.",
            },
          ],
        },
      },

      // ═══ R4 — Uitvoering + AVG-notificatie ═══════════════════════════════
      {
        id: r4, type: "round", position: { x: 2280, y: 260 },
        data: {
          kind: "round",
          title: "72u — de dubbele deadline",
          situation_update: "72u sinds detectie. NIS2-volledige melding moet vandaag naar toezichthouder. AVG-melding moet naar AP. Individuen (patiënten NoordZorg) mogelijk individueel notificeren. Herstel loopt — 40% van tenants weer online.",
          timerMinutes: 20,
          bobPhase: "besluit",
          openingPrompts: [
            "Zijn beide meldingen (NIS2 én AVG) daadwerkelijk on-track — of één van beide vertraagd?",
            "Wie tekent voor de finale strategie — CEO alleen of board?",
            "Welke drempel voor individuele notificatie AVG art. 34 — halen we die?",
          ],
          roleActions: [
            {
              id: "r4-nis2-submit", label: "Legal dient volledige NIS2-melding in",
              description: "Complete melding aan sectorregelaar én NCSC volgens 6-punts template.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 10, linkedDimension: "compliance_awareness",
              lessonLearned: "72u-melding = harde deadline. Zelfs onvolledige melding op tijd > perfecte melding een uur te laat. Aanvullingen kan later.",
            },
            {
              id: "r4-ap-submit", label: "Legal dient AVG-melding bij AP",
              description: "Parallel-track. Categorieën data, aantal betrokkenen, individuele notificatie-oordeel.",
              allowedRoles: ["legal"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 9, linkedDimension: "compliance_awareness",
              lessonLearned: "NIS2 en AVG zijn onafhankelijke plichten. AP heeft eigen formulier en beoordelingskader. Beide gemist = dubbele boete.",
            },
            {
              id: "r4-individual-notify", label: "Comms: individuele patiëntnotificatie voorbereiden",
              description: "Persoonlijke brief per patient bij hoog risico (art. 34 AVG).",
              allowedRoles: ["head_of_comms", "legal"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 8, linkedDimension: "communication_clarity",
              lessonLearned: "Art. 34 AVG vereist individuele notificatie bij 'hoog risico'. Medische data + brede exfiltratie = drempel bereikt. Uitstellen = boete-risico.",
            },
            {
              id: "r4-ceo-board-decision", label: "CEO haalt formele board-goedkeuring",
              description: "Board keurt gevolgde strategie goed, notulen vastgelegd voor toezichthouder-dossier.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 7, linkedDimension: "mandate_clarity",
              lessonLearned: "Bestuurdersgoedkeuring op moment van beslissing = bewijs van behoorlijk toezicht. Retroactieve legalisering telt niet.",
            },
            {
              id: "r4-cfo-loss-report", label: "CFO stelt schade-inventarisatie op voor verzekeraar",
              description: "Directe kosten + potentiële boete + omzetderving.",
              allowedRoles: ["cfo"], irPlanAligned: true,
              scoreImpact: 5, linkedDimension: "decision_quality",
              lessonLearned: "Verzekering dekt zelden alles. Vroege inventarisatie = onderhandelingsbasis over dekking + input voor toezichthouder-dossier over 'proportionaliteit'.",
            },
            {
              id: "r4-ops-restore-priority", label: "Ops: herstel-prioriteit vaststellen",
              description: "Welke tenant eerst; medisch/vitale infra voorrang.",
              allowedRoles: ["ops_manager", "it_manager"], irPlanAligned: true,
              scoreImpact: 6, linkedDimension: "decision_quality",
              lessonLearned: "Prioriteiten aan hand van klantimpact + wettelijke plicht. Documenteer de logica — toezichthouder vraagt achteraf om verantwoording van de volgorde.",
            },
            {
              id: "r4-miss-72h", label: "72u-melding uitstellen — 'we hebben meer tijd nodig'",
              description: "Interne push om melding compleet te maken voor we indienen.",
              allowedRoles: [], irPlanAligned: false,
              scoreImpact: -10, linkedDimension: "compliance_awareness",
              lessonLearned: "72u-overschrijding = automatische handhavingszaak onder NIS2. Toezichthouder heeft geen coulance-marge — 'we waren nog aan het onderzoeken' is geen excuus.",
            },
            {
              id: "r4-skip-individual",
              label: "Individuele notificatie skippen — 'risico is niet hoog genoeg'",
              description: "AP-melding is klaar; individuele notificatie aan patiënten kunnen we later doen.",
              allowedRoles: ["legal"], irPlanAligned: false,
              scoreImpact: -8, linkedDimension: "compliance_awareness",
              lessonLearned: "Medische data valt onder AVG art. 9 = automatisch hoog risico → art. 34 individuele notificatie waarschijnlijk verplicht. Skippen op basis van eigen inschatting zonder DPO/AP-overleg = risico op boete + reputatie-hit.",
            },
          ],
          learningObjectives: [
            {
              id: "obj-72h-submit",
              description: "NIS2 melding en AVG-melding beide binnen 72u ingediend",
              module: "legal_regulatory", measuredBy: "decision",
              triggerActionIds: ["r4-nis2-submit", "r4-ap-submit"],
            },
            {
              id: "obj-individual",
              description: "Individuele patiëntnotificatie voorbereid",
              module: "crisis_communication", measuredBy: "decision",
              triggerActionIds: ["r4-individual-notify"],
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test parallel-execution: NIS2 + AVG + individuele notificatie + board-goedkeuring, alles voor het 72u venster.",
            keyQuestions: [
              "Wat is de status van beide meldingen?",
              "Wie voert individuele notificatie uit — wanneer, hoe?",
              "Heeft de board de strategie formeel goedgekeurd?",
            ],
            hints: [
              "6-punts NIS2 melding schema: aard, ernst, impact, oorzaak, maatregelen, grensoverschrijdend",
              "AP-formulier is anders — apart invullen",
            ],
            expectedDecisions: [
              "Beide meldingen ingediend voor 06:12",
              "Individuele notificatie in voorbereiding",
              "Board tekent voor strategie",
            ],
            redFlags: [
              "NIS2 en AVG samen behandeld ('één melding')",
              "Individuele notificatie 'wordt volgende week gedaan'",
              "Board wordt niet formeel gevraagd",
            ],
          },
        },
      },
      {
        id: i4a, type: "inject", position: { x: 2240, y: 500 },
        data: {
          kind: "inject", type: "regulatory", channel: "email", urgency: "high",
          title: "Toezichthouder: 'wij hebben ontvangen' (of niet)",
          content: "Uw vroegtijdige waarschuwing is ontvangen op TIJD X. We verwachten volledige melding met genomen maatregelen en oorzaak-analyse.",
          source: "Toezichthouder", senderName: "NIS2 team", timestamp: "05:30",
          targetRoles: ["legal", "ciso"], nis2Relevant: true, deliverySeconds: 0,
          reliability: "fact",
        },
      },
      {
        id: i4b, type: "inject", position: { x: 2440, y: 500 },
        data: {
          kind: "inject", type: "regulatory", channel: "email", urgency: "high",
          title: "AP: 'AVG-melding ontvangen — vervolgvragen'",
          content: "Bedankt voor melding. Vragen: aantal exacte betrokkenen, categorieën, of individuele notificatie is gedaan, waarom wel/niet. Antwoord binnen 5 werkdagen.",
          source: "AP", senderName: "Autoriteit Persoonsgegevens", timestamp: "10:00",
          targetRoles: ["legal"], nis2Relevant: true, deliverySeconds: 300,
          reliability: "fact",
        },
      },
      {
        id: i4c, type: "inject", position: { x: 2620, y: 500 },
        data: {
          kind: "inject", type: "intel", channel: "email", urgency: "medium",
          title: "Anonieme tip: 'jullie hebben niet alle data — er is meer'",
          content: "Ontvangen via zakelijk contactformulier: 'Ik werk voor DarkBridge. Jullie hebben een verkeerd beeld van wat er is gestolen. Er is meer — bel dit nummer voor bewijs.'",
          source: "Onbekend", senderName: "Anoniem",
          timestamp: "12:15", targetRoles: ["ciso", "ceo"], deliverySeconds: 600,
          reliability: "misleading",
        },
      },

      // ═══ AP Notification Special (na R4 — formulier) ══════════════════════
      {
        id: specAp, type: "special", position: { x: 2500, y: 260 },
        data: {
          kind: "special",
          type: "ap_notification",
          assignedRole: "legal",
          thresholds: [
            { id: "auto", label: "Ingevuld", predicate: { op: ">=", value: 0 } },
          ],
        },
      },

      // ═══ Facilitator compliance checkpoints ═══════════════════════════════
      {
        id: decC1, type: "decision", position: { x: 2740, y: 260 },
        data: {
          kind: "decision",
          prompt: "Beoordeel: is de 24u vroegtijdige waarschuwing binnen het venster ingediend?",
          measuredBy: "facilitator_trigger",
          triggerRole: "legal",
          options: [
            {
              id: "opt-24h-yes", label: "Ja, binnen 24u",
              scoreImpact: 5, linkedDimension: "escalation_timing",
              lessonLearned: "Vroegtijdige waarschuwing tijdig verstuurd = essentiële NIS2-plicht behaald.",
            },
            {
              id: "opt-24h-no", label: "Nee, te laat / niet ingediend",
              scoreImpact: -8, linkedDimension: "escalation_timing",
              lessonLearned: "Late vroegtijdige waarschuwing wordt door toezichthouder gedocumenteerd — verzwarend bij vervolginspectie.",
            },
          ],
        },
      },
      {
        id: decC2, type: "decision", position: { x: 2980, y: 260 },
        data: {
          kind: "decision",
          prompt: "Beoordeel: is de 72u volledige melding tijdig én compleet ingediend?",
          measuredBy: "facilitator_trigger",
          triggerRole: "legal",
          options: [
            {
              id: "opt-72h-yes", label: "Ja, tijdig en compleet",
              scoreImpact: 8, linkedDimension: "compliance_awareness",
              lessonLearned: "72u-melding op tijd én kwalitatief goed = kernbewijs van compliance. Toezichthouder kan hierop rusten.",
            },
            {
              id: "opt-72h-no", label: "Nee, te laat of te dun",
              scoreImpact: -10, linkedDimension: "compliance_awareness",
              lessonLearned: "72u-fail is de zwaarste NIS2-schending. Sanctie tot 2% wereldwijde omzet realistisch.",
            },
          ],
        },
      },
      {
        id: decD, type: "decision", position: { x: 3460, y: 260 },
        data: {
          kind: "decision",
          prompt: "Finale beoordeling: hoe schat je de teamrespons in?",
          measuredBy: "facilitator_trigger",
          triggerRole: "ceo",
          options: [
            {
              id: "opt-exemplary", label: "Voorbeeldig — dit was een case study",
              scoreImpact: 10, linkedDimension: "framework_adherence",
              lessonLearned: "Exemplary respons = alle sub-plichten proactief vervuld + team-samenwerking optimaal.",
            },
            {
              id: "opt-standard", label: "Solide — basis gehaald, geen excellence",
              scoreImpact: 3, linkedDimension: "framework_adherence",
              lessonLearned: "Standaard compliance geeft ademruimte, maar volgende inspectie kijkt of het niveau stijgt.",
            },
          ],
        },
      },

      // ═══ R5 — 30-dagen slotmelding + lessons learned ═════════════════════
      {
        id: r5, type: "round", position: { x: 3220, y: 260 },
        data: {
          kind: "round",
          title: "30 dagen post-incident — finaal rapport",
          situation_update: "Herstel is 95% compleet. Verzekering keert deels uit. Toezichthouder vraagt om finaal rapport (NIS2 art. 23 lid 4c). Board wil evaluatie. Klantretentie is 88%. Nu de lessons learned formaliseren.",
          timerMinutes: 15,
          bobPhase: "besluit",
          openingPrompts: [
            "Welke aannames uit de eerste 24u bleken achteraf fout? Wat leren we daarvan?",
            "Welke drie structurele beleidsupdates komen uit dit incident voort?",
            "Wanneer is de volgende oefening — en wie valideert die extern?",
          ],
          roleActions: [
            {
              id: "r5-final-report", label: "CISO + Legal dienen finaal rapport in",
              description: "Complete post-incident analyse: root cause, gevolgde tijdlijn, verbetermaatregelen.",
              allowedRoles: ["ciso", "legal"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 9, linkedDimension: "compliance_awareness",
              lessonLearned: "30d finaal rapport (art. 23 lid 4c) is niet symbolisch — toezichthouder gebruikt het voor sanctiebeoordeling. Kwaliteit hier bepaalt terugval-risico.",
            },
            {
              id: "r5-ceo-lessons", label: "CEO agendeert lessons-learned board-sessie",
              description: "Formele evaluatie met externe reviewer, verbeteringen worden vastgelegd in beleidsupdate.",
              allowedRoles: ["ceo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 7, linkedDimension: "mandate_clarity",
              lessonLearned: "NIS2 art. 20: bestuurders moeten leren en beleid updaten. Zonder documenteerbare update = bevestiging dat de organisatie niet leert = strafverzwarend.",
            },
            {
              id: "r5-annual-exercise", label: "Plan volgende jaarlijkse cyber crisis workshop",
              description: "NIS2-verplichte oefening voor volgend jaar inplannen + externe validator.",
              allowedRoles: ["ceo", "ciso"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 8, linkedDimension: "compliance_awareness",
              lessonLearned: "NIS2 vereist periodieke oefening van incident-respons. Direct na incident plannen = niet vergeten + toont commitment aan toezichthouder.",
            },
            {
              id: "r5-supply-chain-review", label: "Supply chain review — voorkomen dat het weer gebeurt",
              description: "Alle third-party dependencies opnieuw beoordelen; contracten aanscherpen op security.",
              allowedRoles: ["ciso", "cfo"], isRecommended: true, irPlanAligned: true,
              scoreImpact: 7, linkedDimension: "decision_quality",
              lessonLearned: "NIS2 art. 21 lid 2d vereist supply chain risicomanagement. Post-incident review is het perfecte moment voor structurele aanscherping.",
            },
            {
              id: "r5-comms-transparency", label: "Publiek post-mortem + open dialoog",
              description: "Publieke blog met root cause en maatregelen — bouwt sector-vertrouwen op.",
              allowedRoles: ["head_of_comms", "ceo"], irPlanAligned: true,
              scoreImpact: 6, linkedDimension: "communication_clarity",
              lessonLearned: "Publieke transparantie na crisis versterkt reputatie meer dan de crisis verzwakte. Zeldzaam voorbeeld dat sector waardeert.",
            },
            {
              id: "r5-move-on", label: "Klaar — team gaat weer aan het gewone werk",
              description: "We hebben genoeg gedaan, tijd om verder te gaan.",
              allowedRoles: [], irPlanAligned: false,
              scoreImpact: -6, linkedDimension: "framework_adherence",
              lessonLearned: "Zonder gestructureerde nazorg herhaalt de organisatie dezelfde fouten. NIS2 én de sector zullen dit als 'niet-lerende organisatie' typeren.",
            },
          ],
          facilitatorNotes: {
            discussionGoal: "Test of het team het 30-dagen venster gebruikt om echt te leren en NIS2-plicht af te maken.",
            keyQuestions: [
              "Wat gaat er in het finale rapport?",
              "Welke drie beleidsupdates komen hieruit voort?",
              "Wanneer is de volgende oefening?",
            ],
            hints: [
              "NIS2 art. 21 leidt tot structurele maatregelen — niet alleen procedureel",
            ],
            expectedDecisions: [
              "Finaal rapport ingediend",
              "Board leert formeel",
              "Volgende oefening gepland",
            ],
            redFlags: [
              "Team ziet 30d-rapport als formaliteit",
              "Geen concrete beleidsupdate",
              "Geen volgende oefening gepland",
            ],
          },
        },
      },
      {
        id: i5a, type: "inject", position: { x: 3220, y: 500 },
        data: {
          kind: "inject", type: "regulatory", channel: "email", urgency: "medium",
          title: "Toezichthouder: finale beoordeling volgt",
          content: "Wij zullen uw finale rapport beoordelen. Uw handelen in de 24u/72u/30d fases weegt mee bij sanctiebeoordeling.",
          source: "Toezichthouder", senderName: "NIS2 team", timestamp: "T+30d",
          targetRoles: ["ceo", "ciso", "legal"], nis2Relevant: true, deliverySeconds: 0,
          reliability: "fact",
        },
      },

      // ═══ OUTCOMES ═════════════════════════════════════════════════════════
      {
        id: outExemplary, type: "outcome", position: { x: 3720, y: 100 },
        data: {
          kind: "outcome",
          key: "exemplary_compliance",
          label: "Voorbeeldige NIS2-compliance",
          narrative: "Alle drie NIS2-klokken gehaald met marge. Board zichtbaar betrokken. AVG en NIS2 parallel afgehandeld. Individuele notificatie voorbereid. Publieke transparantie. Toezichthouder complimenteert met case study. Sector-benchmark.",
          scoreImpact: 10, linkedDimension: "compliance_awareness",
          lessonLearned: "Deze respons voldoet aan alle NIS2 art. 20-23 verplichtingen en zet de organisatie op de kaart als voorbeeld. Board oversight was zichtbaar, meldingen op tijd, communicatie proportioneel.",
        },
      },
      {
        id: outFullCompliance, type: "outcome", position: { x: 3720, y: 260 },
        data: {
          kind: "outcome",
          key: "full_compliance",
          label: "Volledige compliance behaald",
          narrative: "24u waarschuwing en 72u melding op tijd. Board geïnformeerd. Herstel ordelijk. Toezichthouder tevreden, geen handhaving. Reputatie deuk maar herstelt binnen kwartaal.",
          scoreImpact: 6, linkedDimension: "compliance_awareness",
          lessonLearned: "Basis-compliance behaald. Voor 'exemplary' rating hadden proactieve klantcalls en publiek post-mortem toegevoegde waarde geleverd.",
        },
      },
      {
        id: outLate24h, type: "outcome", position: { x: 3020, y: 460 },
        data: {
          kind: "outcome",
          key: "late_24h_warning",
          label: "24u-venster gemist",
          narrative: "Vroegtijdige waarschuwing te laat. Toezichthouder start informeel onderzoek. 72u-melding op tijd redt deels de dag, maar dossier is niet schoon. Reputatie deuk substantieel.",
          scoreImpact: -4, linkedDimension: "escalation_timing",
          lessonLearned: "Missen van de 24u vroegtijdige waarschuwing is de meest voorkomende NIS2-fout in het eerste jaar. Toezichthouder zal in vervolginspecties strenger zijn.",
        },
      },
      {
        id: outMissed72h, type: "outcome", position: { x: 3260, y: 460 },
        data: {
          kind: "outcome",
          key: "missed_72h",
          label: "72u-melding gemist",
          narrative: "Zowel NIS2 als AVG-melding te laat. Formele handhavingszaak wordt gestart. Boete tot 2% wereldwijde omzet mogelijk. Board wordt persoonlijk aansprakelijk. Reputatieschade langdurig.",
          scoreImpact: -10, linkedDimension: "compliance_awareness",
          lessonLearned: "Missen van 72u-melding is een zware NIS2-schending. Boete-berekening kan tot 2% wereldwijde omzet gaan (art. 34). Bestuurdersaansprakelijkheid speelt onder art. 20.",
        },
      },
      {
        id: outBoardFail, type: "outcome", position: { x: 1100, y: 620 },
        data: {
          kind: "outcome",
          key: "board_governance_fail",
          label: "Bestuurders-governance faalde",
          narrative: "Meldingen op tijd, maar board is niet zichtbaar geïnformeerd. Toezichthouder concludeert dat NIS2 art. 20 (bestuurdersverantwoordelijkheid) niet gerealiseerd is. Formele waarschuwing + verplichte governance-review + externe auditor.",
          scoreImpact: -6, linkedDimension: "mandate_clarity",
          lessonLearned: "NIS2 art. 20 maakt bestuurders persoonlijk verantwoordelijk. Zonder gedocumenteerde board-betrokkenheid is de wet niet nagekomen — ook als alle andere plichten wel vervuld zijn.",
        },
      },
    ],

    edges: [
      // Main sequence
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: i1a, type: "inject" },
      { id: id("e"), source: r1, target: i1b, type: "inject" },
      { id: id("e"), source: r1, target: i1c, type: "inject" },
      { id: id("e"), source: r1, target: i1d, type: "inject" },
      { id: id("e"), source: r1, target: r2, type: "sequence" },
      { id: id("e"), source: r2, target: i2a, type: "inject" },
      { id: id("e"), source: r2, target: i2b, type: "inject" },
      { id: id("e"), source: r2, target: i2c, type: "inject" },
      { id: id("e"), source: r2, target: i2d, type: "inject" },
      { id: id("e"), source: r2, target: decA, type: "sequence" },
      // Decision A branches — communicatie-strategie
      { id: id("e"), source: decA, target: r3, sourceHandle: "opt-transparent", type: "branch", label: "Transparant" },
      { id: id("e"), source: decA, target: r3, sourceHandle: "opt-holding", type: "branch", label: "Holding" },
      { id: id("e"), source: decA, target: outBoardFail, sourceHandle: "opt-silent", type: "branch", label: "Stil (governance-fail)" },
      // R3 → journalist special
      { id: id("e"), source: r3, target: i3a, type: "inject" },
      { id: id("e"), source: r3, target: i3b, type: "inject" },
      { id: id("e"), source: r3, target: i3c, type: "inject" },
      { id: id("e"), source: r3, target: specJourn, type: "sequence" },
      // Special thresholds → decision B (ransom)
      { id: id("e"), source: specJourn, target: decB, sourceHandle: "good", type: "branch", label: "Journalist OK" },
      { id: id("e"), source: specJourn, target: decB, sourceHandle: "bad", type: "branch", label: "Journalist slecht" },
      // Decision B → early exit (pay = direct missed_72h narrative) or R4
      { id: id("e"), source: decB, target: outMissed72h, sourceHandle: "opt-pay", type: "branch", label: "Betaal (fataal)" },
      { id: id("e"), source: decB, target: r4, sourceHandle: "opt-recover", type: "branch", label: "Herstel" },
      { id: id("e"), source: decB, target: r4, sourceHandle: "opt-partial", type: "branch", label: "Onderhandel" },
      // R4 injects
      { id: id("e"), source: r4, target: i4a, type: "inject" },
      { id: id("e"), source: r4, target: i4b, type: "inject" },
      { id: id("e"), source: r4, target: i4c, type: "inject" },
      // R4 → AP notification special (Legal vult formulier in)
      { id: id("e"), source: r4, target: specAp, type: "sequence" },
      // AP → 24u compliance check (facilitator judges)
      { id: id("e"), source: specAp, target: decC1, sourceHandle: "auto", type: "branch", label: "Formulier klaar" },
      // 24u check → 72u check or late24h outcome
      { id: id("e"), source: decC1, target: decC2, sourceHandle: "opt-24h-yes", type: "branch", label: "24u gehaald" },
      { id: id("e"), source: decC1, target: outLate24h, sourceHandle: "opt-24h-no", type: "branch", label: "24u gemist" },
      // 72u check → R5 or missed_72h outcome
      { id: id("e"), source: decC2, target: r5, sourceHandle: "opt-72h-yes", type: "branch", label: "72u gehaald" },
      { id: id("e"), source: decC2, target: outMissed72h, sourceHandle: "opt-72h-no", type: "branch", label: "72u gemist" },
      // R5 → final performance decision
      { id: id("e"), source: r5, target: i5a, type: "inject" },
      { id: id("e"), source: r5, target: decD, type: "sequence" },
      { id: id("e"), source: decD, target: outExemplary, sourceHandle: "opt-exemplary", type: "branch", label: "Exemplary" },
      { id: id("e"), source: decD, target: outFullCompliance, sourceHandle: "opt-standard", type: "branch", label: "Standaard" },
    ],
  }
}
