import type { ScenarioGraph, DecisionNodeData, InjectNodeData, RoundNodeData, OutcomeNodeData } from "./types"
import { EYE_SECURITY_RETAINER } from "./types"
import type { Role } from "@/lib/types"

// Ransomware crisis — 7 rondes met per-rol parallel keuzes.
// Elke ronde: 1 DecisionNode met opties gefilterd per rol (allowedRole).
// CISO / Legal / CEO / Comms / CFO / HR / Ops — elk kiest voor de eigen rol.
// Scoring is 6-dim outcomeVector per optie. Debrief-noten leggen keuzes uit.

export function simpleStoryExample(): ScenarioGraph {
  const now = Date.now()
  const rnd = () => Math.random().toString(36).slice(2, 8)
  const id = (p: string) => `${p}_${rnd()}`

  interface OptSpec {
    role: Role
    label: string
    vec: Partial<Record<"CONT"|"FOR"|"BC"|"JUR"|"VER"|"KOS", number>>
    note: string
    quality?: "best" | "good" | "poor" | "wrong"
  }
  function decisionData(prompt: string, opts: OptSpec[]): DecisionNodeData {
    return {
      kind: "decision",
      prompt,
      measuredBy: "participant_choice",
      perRole: true,
      advancesGraph: false,
      options: opts.map(o => ({
        id: `${o.role}_${rnd()}`,
        label: o.label,
        allowedRole: o.role,
        qualityRank: o.quality,
        lessonLearned: o.note,
        outcomeVector: {
          CONT: o.vec.CONT ?? 0, FOR: o.vec.FOR ?? 0, BC: o.vec.BC ?? 0,
          JUR: o.vec.JUR ?? 0, VER: o.vec.VER ?? 0, KOS: o.vec.KOS ?? 0,
        },
      })),
    }
  }

  function roundData(title: string, situation: string, timer: number): RoundNodeData {
    return { kind: "round", title, situation_update: situation, timerMinutes: timer }
  }

  function injectData(cfg: Partial<InjectNodeData> & Pick<InjectNodeData, "title" | "content">): InjectNodeData {
    return {
      kind: "inject",
      type: cfg.type ?? "alert",
      channel: cfg.channel ?? "email",
      urgency: cfg.urgency ?? "medium",
      title: cfg.title,
      content: cfg.content,
      senderName: cfg.senderName,
      source: cfg.source,
      importance: cfg.importance ?? "info",
      visibility: cfg.visibility,
      targetRoles: cfg.targetRoles,
      correctRoute: cfg.correctRoute,
      deliverySeconds: cfg.deliverySeconds,   // drip-timing binnen de ronde
    }
  }

  function outcomeData(cfg: Omit<OutcomeNodeData, "kind">): OutcomeNodeData {
    return { kind: "outcome", ...cfg }
  }

  const startId = id("start")
  const r = [1,2,3,4,5,6,7].map(() => id("round"))
  const dec = [1,2,3,4,5,6,7].map(() => id("dec"))
  const outWin  = id("out"), outMixed = id("out"), outLose = id("out")

  const inj: Record<string, string> = {}
  const injIds = (n: number, count: number) => Array.from({ length: count }, (_, i) => {
    const key = `r${n}_i${i}`
    inj[key] = id("inj")
    return { key, id: inj[key] }
  })
  const r1i = injIds(1, 2), r2i = injIds(2, 3), r3i = injIds(3, 2), r4i = injIds(4, 3)
  const r5i = injIds(5, 2), r6i = injIds(6, 2), r7i = injIds(7, 1)

  const nodes: ScenarioGraph["nodes"] = [
    { id: startId, type: "start", position: { x: 40, y: 260 }, data: { kind: "start" } },

    // ── R1 — Detectie ──
    { id: r[0], type: "round", position: { x: 220, y: 220 }, data: roundData(
      "R1 — Detectie",
      "Om 03:11 op zondag ziet de MDR-provider verdachte activiteit op meerdere endpoints. Encoded PowerShell, off-hours logins. Scope onduidelijk. Het team wordt gebeld.",
      12,
    )},
    { id: r1i[0].id, type: "inject", position: { x: 260, y: 440 }, data: injectData({
      title: "MDR-alert — lateral movement",
      content: "3 endpoints met verdacht gedrag. Nog geen encryptie. Aanvaller lijkt nog verkennend.",
      type: "alert", channel: "siem", urgency: "high", senderName: "MDR SOC on-call",
      importance: "crucial", deliverySeconds: 0,
    })},
    { id: r1i[1].id, type: "inject", position: { x: 440, y: 440 }, data: injectData({
      title: "Servicedesk — bestandsproblemen",
      content: "Twee gebruikers melden dat ze bestanden op de fileshare niet kunnen openen.",
      type: "internal", channel: "phone", urgency: "medium", senderName: "Servicedesk avond",
      importance: "info", deliverySeconds: 180,
    })},
    { id: dec[0], type: "decision", position: { x: 620, y: 220 }, data: decisionData(
      "Ronde 1 — Wat zet ieder van jullie in gang?",
      [
        { role: "ciso", label: "Bel Eye Security direct (24/7 retainer)",
          vec: { CONT: 2, FOR: 2, VER: 1, KOS: -1 }, quality: "best",
          note: "24/7-retainer is er om 03:00 gebeld te worden. Forensiek + containment starten direct." },
        { role: "ciso", label: "Wachten tot ochtend, intern beoordelen",
          vec: { CONT: -2, JUR: -1 }, quality: "poor",
          note: "Elk uur wachten geeft de aanvaller voorsprong. Verspreiding gebeurt vaak stil." },
        { role: "legal", label: "Meldplicht-klok warm zetten (24u/72u)",
          vec: { JUR: 2, VER: 1 }, quality: "best",
          note: "Legal opent de checklist — zodat je op T+24u niet hoeft te improviseren." },
        { role: "legal", label: "Afwachten tot scope duidelijk is",
          vec: { JUR: -1 }, quality: "poor",
          note: "Deadlines beginnen bij detectie, niet bij bevestiging. Klok tikt al." },
        { role: "ceo", label: "Crisisteam formeren + board informeren",
          vec: { VER: 1, CONT: 1 }, quality: "best",
          note: "Duidelijk mandaat versnelt alle andere rollen." },
        { role: "ceo", label: "Nog geen board — te vroeg",
          vec: { VER: -1, JUR: -1 }, quality: "poor",
          note: "Board hoort van jou, niet van de pers of een klant." },
      ],
    )},

    // ── R2 — Scope & Impact ──
    { id: r[1], type: "round", position: { x: 800, y: 220 }, data: roundData(
      "R2 — Scope & Impact",
      "T+6u. Eye Security bevestigt: 400 GB uitgaand verkeer richting onbekende host. Persoonsgegevens bevestigd in de export. Ransomware-payload staat klaar maar niet gedetoneerd.",
      15,
    )},
    { id: r2i[0].id, type: "inject", position: { x: 830, y: 440 }, data: injectData({
      title: "MDR — payload identificatie",
      content: "LockBit 3.0-variant. Cobalt Strike beacons. 60% van file-servers heeft actieve session.",
      type: "technical", channel: "siem", urgency: "critical", senderName: "Eye Security",
      importance: "crucial", targetRoles: ["ciso"], visibility: "exclusive",
      deliverySeconds: 0,
    })},
    { id: r2i[1].id, type: "inject", position: { x: 1010, y: 440 }, data: injectData({
      title: "Legal — AVG + NIS2 klok tikt",
      content: "Persoonsgegevens exfiltratie bevestigd. AVG-melding 72u vanaf detectie. NIS2 early warning binnen 24u.",
      type: "regulatory", channel: "email", urgency: "high", senderName: "Legal Counsel",
      importance: "crucial", targetRoles: ["legal"], visibility: "exclusive",
      deliverySeconds: 120,
    })},
    { id: r2i[2].id, type: "inject", position: { x: 1190, y: 440 }, data: injectData({
      title: "CFO — verzekeraar 24u-clausule",
      content: "Cyberverzekeraar heeft 24u-notificatie clausule. Nu bellen = dekking geldig. Later = argument voor niet-dekken.",
      type: "executive", channel: "phone", urgency: "high", senderName: "Verzekerings-broker",
      importance: "crucial", targetRoles: ["cfo"], visibility: "exclusive",
      deliverySeconds: 300,
    })},
    { id: dec[1], type: "decision", position: { x: 1400, y: 220 }, data: decisionData(
      "Ronde 2 — Scope-actie",
      [
        { role: "ciso", label: "Segmenten isoleren + EDR-isolatie op verdachte hosts",
          vec: { CONT: 2, FOR: 2, BC: 0 }, quality: "best",
          note: "Snelheid + bewijsbehoud. Referentie-aanpak van Eye Security." },
        { role: "ciso", label: "Alles offline — volledige netwerk-shutdown",
          vec: { CONT: 2, FOR: -1, BC: -2, KOS: -2 }, quality: "poor",
          note: "Overkill. Verliest volatiele forensische data + stopt legitieme operatie." },
        { role: "legal", label: "NIS2 early warning + AVG-melding starten",
          vec: { JUR: 2, VER: 1, KOS: -1 }, quality: "best",
          note: "Op tijd melden = geen boete + toezichthouder aan jouw zijde." },
        { role: "legal", label: "Wachten op complete forensiek",
          vec: { JUR: -2, VER: -1 }, quality: "wrong",
          note: "72u AVG start bij DETECTIE. Wachten kost sowieso boete-risico." },
        { role: "cfo", label: "Verzekeraar direct informeren (24u-clausule)",
          vec: { KOS: 1, JUR: 1 }, quality: "best",
          note: "Vroege notificatie = dekkingsgarantie + verzekeraar helpt met de rest." },
        { role: "cfo", label: "Wachten tot schade duidelijk is",
          vec: { KOS: -2, JUR: -1 }, quality: "wrong",
          note: "Standaard-clausules eisen 24u. Te laat = geen dekking." },
      ],
    )},

    // ── R3 — Ransom note ──
    { id: r[2], type: "round", position: { x: 1580, y: 220 }, data: roundData(
      "R3 — Ransom note & Dilemma",
      "T+18u. Aanvallers eisen 5 BTC binnen 48u. Bij niet-betaling: publicatie van 400 GB op leaksite. Media pikt eerste geruchten op.",
      15,
    )},
    { id: r3i[0].id, type: "inject", position: { x: 1620, y: 440 }, data: injectData({
      title: "Losgeld-note ontvangen",
      content: "5 BTC (≈€300k). 48u deadline. 'Wij hebben database met klantgegevens, medische data, HR-dossiers.'",
      type: "executive", channel: "raw", urgency: "critical", senderName: "Ranshub",
      importance: "crucial", deliverySeconds: 0,
    })},
    { id: r3i[1].id, type: "inject", position: { x: 1800, y: 440 }, data: injectData({
      title: "Journalist NL-Cyber belt HR",
      content: "'Klopt het dat medewerkers naar huis zijn gestuurd i.v.m. cyberincident?' Wil binnen 2 uur reactie.",
      type: "media", channel: "phone", urgency: "medium", senderName: "NL-Cyber redactie",
      importance: "info", targetRoles: ["hr_lead"],
      correctRoute: "head_of_comms", visibility: "exclusive",
      deliverySeconds: 240,
    })},
    { id: dec[2], type: "decision", position: { x: 1980, y: 220 }, data: decisionData(
      "Ronde 3 — Losgeld & Media",
      [
        { role: "ceo", label: "Geen betaling — principiële weigering",
          vec: { JUR: 2, VER: 2 }, quality: "best",
          note: "Betalen financiert volgende aanvallen én garandeert niets. NCSC en verzekeraar waarderen weigering." },
        { role: "ceo", label: "Onderhandelen via IR-partner — tijd kopen",
          vec: { CONT: 1, JUR: 1, KOS: -1 }, quality: "good",
          note: "Elk uur onderhandeling = uur voor herstel. Geen commitment aan betaling." },
        { role: "ceo", label: "Betalen — snelste ontsleuteling",
          vec: { JUR: -2, VER: -2, KOS: -2 }, quality: "wrong",
          note: "Sleutels werken vaak deels; aanvaller komt terug. Boetes én reputatieschade." },
        { role: "head_of_comms", label: "Proactieve verklaring — 'incident, we werken eraan'",
          vec: { VER: 2, JUR: 0 }, quality: "best",
          note: "Zelf de framing bepalen voordat journalisten het overnemen." },
        { role: "head_of_comms", label: "No comment tot forensisch klaar",
          vec: { VER: -2 }, quality: "poor",
          note: "Silence wordt gelezen als schuld. De speculatie wordt jouw verhaal." },
        { role: "hr_lead", label: "Journalist meteen doorverbinden naar Comms",
          vec: { VER: 1 }, quality: "best",
          note: "Correcte routing — HR is niet de woordvoerder." },
        { role: "hr_lead", label: "Zelf antwoord geven — 'geen commentaar'",
          vec: { VER: -1, JUR: -1 }, quality: "poor",
          note: "Zonder briefing niet aan de pers. HR-antwoord wordt jullie officiële statement." },
      ],
    )},

    // ── R4 — Cascaderende comms ──
    { id: r[3], type: "round", position: { x: 2160, y: 220 }, data: roundData(
      "R4 — Cascaderende communicatie",
      "T+30u. Verklaring is uit. Twee grote klanten bellen. Medewerkers vragen op Slack wat er speelt. NCSC vraagt een intake-gesprek.",
      15,
    )},
    { id: r4i[0].id, type: "inject", position: { x: 2200, y: 440 }, data: injectData({
      title: "Klant #1 — 'zijn onze contractdata veilig?'",
      content: "Grootste klant (30% omzet). Contract heeft datalek-clausule met opzegrecht.",
      type: "executive", channel: "email", urgency: "high", senderName: "Klant #1 CIO",
      importance: "crucial", targetRoles: ["cfo"], visibility: "exclusive",
      deliverySeconds: 0,
    })},
    { id: r4i[1].id, type: "inject", position: { x: 2380, y: 440 }, data: injectData({
      title: "Medewerkers-onrust op Slack",
      content: "150+ berichten in #general. 'Klopt ransomware?', 'Kunnen wij morgen wel werken?'",
      type: "internal", channel: "slack", urgency: "medium", senderName: "HR monitoring",
      importance: "crucial", targetRoles: ["hr_lead"], visibility: "exclusive",
      deliverySeconds: 150,
    })},
    { id: r4i[2].id, type: "inject", position: { x: 2560, y: 440 }, data: injectData({
      title: "NCSC — intake gesprek",
      content: "NCSC bevestigt NIS2-melding. Wil intake vandaag: containment-status, betaling, klantmelding.",
      type: "regulatory", channel: "phone", urgency: "high", senderName: "NCSC",
      importance: "crucial", targetRoles: ["legal"], visibility: "exclusive",
      deliverySeconds: 360,
    })},
    { id: dec[3], type: "decision", position: { x: 2740, y: 220 }, data: decisionData(
      "Ronde 4 — Stakeholders bedienen",
      [
        { role: "cfo", label: "Klant proactief bellen + status delen",
          vec: { VER: 2, JUR: 1 }, quality: "best",
          note: "Klant een bondgenoot maken. Blijft loyaal als je eerlijk bent." },
        { role: "cfo", label: "Wachten op zekerheid, dan pas contact",
          vec: { VER: -1 }, quality: "poor",
          note: "Klant hoort het via de pers = contract-issue." },
        { role: "hr_lead", label: "All-hands binnen 2 uur + FAQ",
          vec: { VER: 1, BC: 1 }, quality: "best",
          note: "Duidelijke interne comms voorkomt Slack-chaos en werknemer-leaks." },
        { role: "hr_lead", label: "Generic mail — 'we werken eraan'",
          vec: { VER: -1 }, quality: "poor",
          note: "Medewerkers zijn ambassadeurs, geen ontvangers. Detail werkt beter." },
        { role: "legal", label: "NCSC intake vandaag — volle transparantie",
          vec: { JUR: 2, VER: 1 }, quality: "best",
          note: "Toezichthouder respecteert openheid. Wordt in latere fase je advocaat." },
        { role: "legal", label: "Intake pas na advocaten-overleg",
          vec: { JUR: -2 }, quality: "poor",
          note: "NCSC hulp verspelen aan de start = eindeloze problemen later." },
      ],
    )},

    // ── R5 — Herstel begint ──
    { id: r[4], type: "round", position: { x: 2920, y: 220 }, data: roundData(
      "R5 — Herstel begint",
      "T+48u. Van 12 backup-sets zijn er 4 versleuteld, 8 zijn week-oud maar getest. Losgeld-deadline over 24u.",
      15,
    )},
    { id: r5i[0].id, type: "inject", position: { x: 2960, y: 440 }, data: injectData({
      title: "Backup-lead rapporteert",
      content: "Clean-room herbouw: 4 dagen. Data-verlies: ~7 werkdagen. Kritieke ERP: eigen shadow-copy — 24u.",
      type: "technical", channel: "teams", urgency: "high", senderName: "Backup lead",
      importance: "crucial", targetRoles: ["ciso"], deliverySeconds: 0,
    })},
    { id: r5i[1].id, type: "inject", position: { x: 3140, y: 440 }, data: injectData({
      title: "Ops — noodplan werkinstructies",
      content: "Handmatige processen voor de 3 kritieke processen zijn klaar. Kost 40% capaciteit maar houdt operatie op de been.",
      type: "internal", channel: "email", urgency: "medium", senderName: "Ops Manager",
      importance: "info", targetRoles: ["ops_manager"], deliverySeconds: 210,
    })},
    { id: dec[4], type: "decision", position: { x: 3320, y: 220 }, data: decisionData(
      "Ronde 5 — Recovery pad",
      [
        { role: "ciso", label: "Clean-room herbouw (4d) — behoud forensiek",
          vec: { CONT: 2, FOR: 2, BC: -2, KOS: -2 }, quality: "best",
          note: "Langere hersteltijd maar sluitend bewijs + zekerheid dat aanvaller weg is." },
        { role: "ciso", label: "Prod-restore op bestaande systemen (12u)",
          vec: { CONT: -1, FOR: -2, BC: 2, KOS: -1 }, quality: "poor",
          note: "Snel, maar bewijs overschreven en beacons kunnen blijven zitten." },
        { role: "ops_manager", label: "Noodplan aan + handmatige processen",
          vec: { BC: 2, VER: 1 }, quality: "best",
          note: "Klanten voelen niets. Downtime wordt operationele last, niet reputatieschade." },
        { role: "ops_manager", label: "Wachten op IT-herstel — geen noodplan",
          vec: { BC: -2, VER: -2 }, quality: "wrong",
          note: "3 dagen niet leveren = klanten weg + boeteclausules." },
      ],
    )},

    // ── R6 — Leaksite live ──
    { id: r[5], type: "round", position: { x: 3500, y: 220 }, data: roundData(
      "R6 — Leaksite live",
      "T+72u. Losgeld niet betaald. Aanvaller publiceert eerste sample: 500 klant-emails + intern management-rapport. Media pikt het op.",
      15,
    )},
    { id: r6i[0].id, type: "inject", position: { x: 3540, y: 440 }, data: injectData({
      title: "AD.nl — 'Grote NL-organisatie slachtoffer'",
      content: "Landelijke media pikt leak op. Interview-verzoeken van 4 media. Sociale media woedend + speculatief.",
      type: "media", channel: "news", urgency: "high", senderName: "Media-monitoring",
      importance: "crucial", deliverySeconds: 0,
    })},
    { id: r6i[1].id, type: "inject", position: { x: 3720, y: 440 }, data: injectData({
      title: "Board-vergadering ingelast",
      content: "Aandeelhouders vragen positie. Externe adviesraad wil vergadering vanavond.",
      type: "executive", channel: "email", urgency: "critical", senderName: "Company Secretary",
      importance: "crucial", targetRoles: ["ceo"], visibility: "exclusive",
      deliverySeconds: 300,
    })},
    { id: dec[5], type: "decision", position: { x: 3900, y: 220 }, data: decisionData(
      "Ronde 6 — Reactie op leaksite",
      [
        { role: "head_of_comms", label: "Actieve pers-briefing + FAQ live",
          vec: { VER: 2, JUR: 1 }, quality: "best",
          note: "Publieke opinie vragen om vertrouwen — zichtbaarheid is de valuta." },
        { role: "head_of_comms", label: "Statement via advocaten alleen",
          vec: { VER: -2 }, quality: "poor",
          note: "Klinkt schuldig. Advocatentaal weerhoudt journalisten niet." },
        { role: "legal", label: "Aanvullende AVG-melding + individuele notif's",
          vec: { JUR: 2, VER: 1, KOS: -1 }, quality: "best",
          note: "500 klant-mails gelekt = individuele meldplicht." },
        { role: "legal", label: "Wachten tot volledige omvang bekend",
          vec: { JUR: -2 }, quality: "wrong",
          note: "AVG-boete op vertraging is 4% wereldwijde omzet." },
        { role: "ceo", label: "Board live in beeld — 'ik leid dit'",
          vec: { VER: 2 }, quality: "best",
          note: "Aandeelhouders willen leiderschap zien." },
        { role: "ceo", label: "Delegeren aan COO of externe woordvoerder",
          vec: { VER: -1 }, quality: "poor",
          note: "In crisis wil de wereld het gezicht van de organisatie zien." },
      ],
    )},

    // ── R7 — Post-mortem ──
    { id: r[6], type: "round", position: { x: 4080, y: 220 }, data: roundData(
      "R7 — Post-mortem & Lessen",
      "T+7d. Herstel op 80%. Toezichthouder is inhoudelijk positief. Board vraagt: wat gaat structureel veranderen?",
      12,
    )},
    { id: r7i[0].id, type: "inject", position: { x: 4120, y: 440 }, data: injectData({
      title: "Post-mortem template — wat gaan we anders doen?",
      content: "Elke rol schrijft 1 structurele verandering op. Board wil concrete commitments + budget.",
      type: "internal", channel: "memo", urgency: "low", senderName: "Company Secretary",
      importance: "info",
    })},
    { id: dec[6], type: "decision", position: { x: 4300, y: 220 }, data: decisionData(
      "Ronde 7 — Structurele lessen",
      [
        { role: "ciso", label: "Extra Eye Security services + MDR uitbreiding",
          vec: { CONT: 2, FOR: 1, KOS: -1 }, quality: "best",
          note: "Deze crisis was minder erg door de retainer — nu is het moment voor uitbreiding." },
        { role: "ciso", label: "Alleen interne SOC uitbouwen",
          vec: { CONT: -1, KOS: -2 }, quality: "poor",
          note: "24/7 SOC bouwen kost 2M+/jaar. Niet realistisch." },
        { role: "legal", label: "Vaste incident-runbook + jaarlijkse oefening",
          vec: { JUR: 2, VER: 1 }, quality: "best",
          note: "Meldplicht-fouten voorkom je door repetitie, niet door goede intenties." },
        { role: "legal", label: "Alleen documenteren wat er gebeurd is",
          vec: { JUR: -1 }, quality: "poor",
          note: "Documentatie zonder training = plank-materiaal." },
        { role: "ceo", label: "Cyberweerbaarheid als strategische prioriteit",
          vec: { CONT: 1, VER: 2, KOS: -2 }, quality: "best",
          note: "Cyberrisico is business-risico. Board-level commitment nu vs. crisis-mode over 2 jaar." },
        { role: "ceo", label: "Business-as-usual, geen structurele wijziging",
          vec: { CONT: -2, VER: -2 }, quality: "wrong",
          note: "Terug naar dagorde = tweede crisis binnen 3 jaar." },
      ],
    )},

    // ── Outcomes — cumulatieve score bepaalt welk pad ──
    { id: outWin, type: "outcome", position: { x: 4480, y: 80 }, data: outcomeData({
      key: "gewonnen",
      label: "Contained met integriteit",
      narrative:
        "Zes weken later. Toezichthouder gebruikt jullie case als voorbeeld voor de sector. " +
        "Klanten waarderen de proactieve communicatie — grote klant blijft. Aandeelhouders verhogen cyberbudget met 40%. " +
        "Aanvaller geïdentificeerd binnen 3 maanden door forensisch bewijs.",
      lessonLearned: "Snelheid + integriteit + transparantie is het referentiepad.",
      scoreRange: { min: 15 },
    })},
    { id: outMixed, type: "outcome", position: { x: 4480, y: 240 }, data: outcomeData({
      key: "gemengd",
      label: "Overleefd — met kleerscheuren",
      narrative:
        "Organisatie is er nog. Kleine boete voor te late aanvullende melding (€ 150k). " +
        "Twee klanten weg (5% omzetdaling). Media-aandacht vervaagt na 2 weken. Board wil evaluatie en versterking.",
      lessonLearned: "Verkeerde volgorde in comms kostte meer dan de technische keuzes.",
      scoreRange: { min: 3, max: 14 },
    })},
    { id: outLose, type: "outcome", position: { x: 4480, y: 400 }, data: outcomeData({
      key: "verloren",
      label: "Cascaded failure",
      narrative:
        "Boete van 1,2% wereldwijde omzet. Persaandacht wekenlang. Grote klanten stappen over. " +
        "Aandeelhouders roepen externe consultant in; CEO stapt op na Q2. Aanvaller nooit gepakt.",
      lessonLearned: "Deadlines zijn deadlines. Compliance eerst, dan techniek — geen shortcuts.",
      scoreRange: { max: 2 },
    })},
  ]

  const edges: ScenarioGraph["edges"] = [
    { id: id("e"), source: startId, target: r[0], type: "sequence" },
  ]

  const injectsPerRound = [r1i, r2i, r3i, r4i, r5i, r6i, r7i]
  for (let i = 0; i < 7; i++) {
    for (const inj of injectsPerRound[i]) {
      edges.push({ id: id("e"), source: r[i], target: inj.id, type: "inject" })
    }
    edges.push({ id: id("e"), source: r[i], target: dec[i], type: "sequence" })
    if (i < 6) {
      edges.push({ id: id("e"), source: dec[i], target: r[i + 1], type: "sequence" })
    }
  }
  // Laatste decision → 3 outcomes; engine kiest via scoreRange
  edges.push({ id: id("e"), source: dec[6], target: outWin,   type: "sequence" })
  edges.push({ id: id("e"), source: dec[6], target: outMixed, type: "sequence" })
  edges.push({ id: id("e"), source: dec[6], target: outLose,  type: "sequence" })

  return {
    id: id("graph"),
    name: "Ransomware Crisis — 7 rondes",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    nodes,
    edges,
    features: { reliability: false, compliance: false, scoring: true },
  }
}
