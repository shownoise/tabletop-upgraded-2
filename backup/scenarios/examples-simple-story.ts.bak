import type { ScenarioGraph, DecisionNodeData, InjectNodeData, RoundNodeData, OutcomeNodeData } from "./types"
import { EYE_SECURITY_RETAINER } from "./types"
import type { Role } from "@/lib/types"

// Ransomware Crisis — realistische 7-ronde showcase.
// Per ronde 1 DecisionNode met per-rol opties (allowedRole). Elke ronde
// meerdere injects met MDR-alert-niveau content. Diepe situaties.
// 3 uitkomsten via cumulatieve score.

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
      kind: "decision", prompt, measuredBy: "participant_choice",
      perRole: true, advancesGraph: false,
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
      title: cfg.title, content: cfg.content,
      senderName: cfg.senderName, source: cfg.source, timestamp: cfg.timestamp,
      importance: cfg.importance ?? "info",
      visibility: cfg.visibility, targetRoles: cfg.targetRoles,
      correctRoute: cfg.correctRoute, deliverySeconds: cfg.deliverySeconds,
    }
  }
  function outcomeData(cfg: Omit<OutcomeNodeData, "kind">): OutcomeNodeData {
    return { kind: "outcome", ...cfg }
  }

  const startId = id("start")
  const r = [1,2,3,4,5,6,7].map(() => id("round"))
  const dec = [1,2,3,4,5,6,7].map(() => id("dec"))
  const outWin = id("out"), outMixed = id("out"), outLose = id("out")

  const inj: Record<string, string> = {}
  const injIds = (n: number, count: number) => Array.from({ length: count }, (_, i) => {
    const key = `r${n}_i${i}`
    inj[key] = id("inj")
    return { key, id: inj[key] }
  })
  const r1i = injIds(1, 3), r2i = injIds(2, 4), r3i = injIds(3, 3), r4i = injIds(4, 3)
  const r5i = injIds(5, 3), r6i = injIds(6, 3), r7i = injIds(7, 2)

  const nodes: ScenarioGraph["nodes"] = [
    { id: startId, type: "start", position: { x: 40, y: 260 }, data: { kind: "start" } },

    // ── R1 ──
    { id: r[0], type: "round", position: { x: 220, y: 220 }, data: roundData(
      "R1 — Zondagnacht: het begint",
      "Zondag 02:47. In het datacenter draait alles routine. Bij Eye Security (MDR-provider) beginnen alerts binnen te tikken: encoded PowerShell vanuit user-context, off-hours logins vanuit een verdachte IP-range, anomale DNS-lookups naar één C2-host. De MDR-analist op wacht escaleert om 03:11.\n\nGeen encryptie waargenomen. Geen data-exfiltratie zichtbaar in de eerste 30 minuten. Wel: patroon wijst op initial access via een phishing-payload van ~72u eerder, en de aanvaller lijkt bezig met 'living off the land' — verkennen van shares, dumpen van credentials, opzetten van persistence.\n\nDit zit in het pre-encryption reconnaissance venster: containment nu is realistisch. De klok tikt.",
      12,
    )},
    { id: r1i[0].id, type: "inject", position: { x: 260, y: 440 }, data: injectData({
      title: "MDR — Priority 1 alert: lateral movement patroon",
      content:
        "URGENT — Managed Detection & Response detectie\n\n" +
        "Detectietijd: 02:47:14 CET\n" +
        "Signature: T1059.001 (PowerShell) + T1021 (Remote Services) + T1003 (OS Credential Dumping)\n" +
        "Betrokken hosts: LAP-NL-1247, LAP-NL-0892, SRV-FILE-03 (via SMB-relay)\n\n" +
        "IOCs waargenomen:\n" +
        "  • base64-encoded PowerShell downloader → C2: 185.147.34.211:443 (Cobalt Strike beacon signature)\n" +
        "  • Mimikatz-artefacten in LSASS-memory dump op LAP-NL-1247\n" +
        "  • Nieuw scheduled task 'MSUpdateHelper' op 3 hosts — persistence-mechanisme\n\n" +
        "Analist-notitie: Dit patroon komt overeen met LockBit/BlackCat-affiliates in verkenningsfase. Ze zijn ~4 uur binnen. Verwacht window tot encryption: 12–36 uur.\n\n" +
        "Aanbeveling: NU escaleren, EDR-isolatie op de 3 hosts, forensische image maken vóór eventuele wipe. Ons IR-team staat klaar. Bel het 24/7-nummer.",
      type: "alert", channel: "siem", urgency: "critical",
      senderName: "MDR SOC — Analist op wacht", timestamp: "03:11",
      importance: "crucial", deliverySeconds: 0,
    })},
    { id: r1i[1].id, type: "inject", position: { x: 440, y: 440 }, data: injectData({
      title: "Servicedesk — 'ik kan mijn bestanden niet openen'",
      content:
        "Twee inkomende meldingen op de nacht-lijn tussen 02:55 en 03:08:\n\n" +
        "1) Medewerker Financiën (thuisdienst maandopeinde): 'Mijn Excel-bestanden op de shared drive geven een vreemde error. Het zijn allemaal .xlsx bestanden en ineens kan Excel ze niet meer openen. Dit is dringend, ik moet vanavond af.'\n\n" +
        "2) Medewerker Operations (avond-shift logistiek): 'De WMS-koppeling laadt niet. Onze shift-planning is gebaseerd op die data — als dit morgenochtend niet werkt hebben we een probleem.'\n\n" +
        "Servicedesk-nachtdienst heeft ticket aangemaakt. Geen escalatie naar IT-management ingezet. Vraagt: 'is dit gerelateerd aan het MDR-alert?'",
      type: "internal", channel: "phone", urgency: "medium",
      senderName: "Servicedesk avond", timestamp: "03:14",
      importance: "info", deliverySeconds: 240,
    })},
    { id: r1i[2].id, type: "inject", position: { x: 620, y: 440 }, data: injectData({
      title: "Eye Security — 'we kunnen nu draaien'",
      content:
        "Marc de Vries (IR Lead Eye Security) op de 24/7-lijn:\n\n" +
        "'We hebben het alert ook zien binnenkomen. Als jullie ons nu activeren zijn we binnen 15 minuten aangesloten. Dan doen we drie dingen tegelijk: forensische image van de 3 endpoints, EDR-isolatie van de verdachte hosts (verkeer geblokkeerd behalve naar onze IR-relay), en scope-analyse — hoe ver is de aanvaller? Wat we NU niet moeten doen: die endpoints herstarten of opschonen. Dan vernielen we het bewijs en zien we niet welke andere systemen ze hebben aangeraakt.\n\n" +
        "Ik heb Legal ook stand-by gezet — voor als de scope groter blijkt dan we nu denken en meldplicht gaat spelen. Zullen we?'",
      type: "executive", channel: "phone", urgency: "high",
      senderName: "Marc de Vries — Eye Security IR",
      importance: "info", deliverySeconds: 480,
    })},
    { id: dec[0], type: "decision", position: { x: 820, y: 220 }, data: decisionData(
      "Wat zet ieder van jullie NU in gang?",
      [
        { role: "ciso", label: "Eye Security activeren — 24/7 retainer, meteen containment",
          vec: { CONT: 2, FOR: 2, VER: 1, KOS: -1 }, quality: "best",
          note: "24/7-retainer is er om 03:00 gebeld te worden. Snelheid + bewijsbehoud in één beweging." },
        { role: "ciso", label: "Wachten tot 08:00, eerst intern IT-team laten kijken",
          vec: { CONT: -2, FOR: -1, JUR: -1 }, quality: "poor",
          note: "5 uur wachten in pre-encryption reconnaissance venster = aanvaller wint. Elke uur telt." },
        { role: "legal", label: "Meldplicht-klok warm zetten (24u NIS2 / 72u AVG)",
          vec: { JUR: 2, VER: 1 }, quality: "best",
          note: "Klok start bij detectie, niet bij bevestiging. Voorbereiden ≠ melden." },
        { role: "legal", label: "Wachten tot scope duidelijk is",
          vec: { JUR: -2 }, quality: "poor",
          note: "Deadlines wachten niet op scope. Te laat = boete-risico ook zonder daadwerkelijke exfil." },
        { role: "ceo", label: "Crisisteam formeren, board informeren via bestuur-groepsapp",
          vec: { VER: 1, CONT: 1 }, quality: "best",
          note: "Mandaat + zichtbaarheid. Board hoort van jou, niet van de pers of een klant." },
        { role: "ceo", label: "Nog niet escaleren — 'het kan een false positive zijn'",
          vec: { VER: -2, CONT: -1, JUR: -1 }, quality: "wrong",
          note: "MDR met 3 gecorreleerde signatures + Cobalt Strike C2 = geen false positive. Vertraging kost tijd." },
      ],
    )},

    // ── R2 ──
    { id: r[1], type: "round", position: { x: 1000, y: 220 }, data: roundData(
      "R2 — De omvang wordt duidelijk",
      "Zes uur later. 09:30 op maandag. Eye Security's forensisch team is sinds 03:45 aan het werk. De eerste rapportage komt binnen: dit is groter dan de initial scope suggereerde.\n\nDe aanvaller heeft zich in de afgelopen 72 uur systematisch verplaatst: van de eerste laptop via SMB naar file-servers, van file-servers via delegated accounts naar Active Directory, en van AD terug naar database-servers waar de kroonjuwelen staan.\n\nEye Security bevestigt: 400 GB uitgaand verkeer richting één specifieke host, gespreid over 4 nachten. In die 400 GB: klant-databases (naam, adres, contract-details, betaalgegevens), een deel van het HR-personeelsdossier, én de contracten-database met contractuele geheimhoudingsbedingen van de 20 grootste klanten.\n\nDe ransomware-payload staat klaar op 60% van de file-servers. Nog niet gedetoneerd. Persoonsgegevens exfiltratie = AVG melding 72u vanaf detectie: donderdag 03:11.",
      15,
    )},
    { id: r2i[0].id, type: "inject", position: { x: 1040, y: 440 }, data: injectData({
      title: "Eye Security — Volledig scope rapport (draft)",
      content:
        "IR-rapport draft 1 — 09:15 CET\n\n" +
        "Aanvaller: waarschijnlijk BlackCat/ALPHV affiliate 'Sphynx'\n" +
        "Initial access: phishing-email 27/7, klik op malicious document → Cobalt Strike loader\n" +
        "Persistence: 3 scheduled tasks + 1 service + 2 WMI event subscriptions\n" +
        "Privilegie-escalatie: DPAPI-decryptie op AD-service-account, gevolgd door DCSync-attack → krbtgt hash bemachtigd → golden ticket mogelijk\n\n" +
        "EXFILTRATIE BEVESTIGD:\n" +
        "  • 412 GB gearchiveerd naar C:\\ProgramData\\.cache\\backup*.7z (staged)\n" +
        "  • Uitgestuurd via rclone naar Mega.nz over 4 nachten (72u–24u geleden)\n" +
        "  • Data-samples in memory-dumps geïdentificeerd: SQL-dumps klant-DB, HR-CSV export, scan van fileshare 'Contracten\\Klanten\\Top20'\n\n" +
        "AANBEVELING:\n" +
        "  • Meldplicht is niet meer optioneel. AVG-schade bewezen.\n" +
        "  • Ransomware-payload nog niet gedetoneerd — containment NU is prioriteit.\n" +
        "  • Alle DC's moeten worden geïsoleerd + admin-credentials gereset (golden ticket risico).\n" +
        "  • Wij adviseren dringend: schakel forensische partner voor rechtsgeldigheid van bewijs.",
      type: "technical", channel: "email", urgency: "critical",
      senderName: "Eye Security IR Team", timestamp: "09:15",
      importance: "crucial", targetRoles: ["ciso"], visibility: "exclusive",
      deliverySeconds: 0,
    })},
    { id: r2i[1].id, type: "inject", position: { x: 1220, y: 440 }, data: injectData({
      title: "Legal — Meldplicht-analyse (spoed)",
      content:
        "Van: Marloes Jansen, Legal Counsel — 09:32\n\n" +
        "Op basis van Eye's rapportage:\n\n" +
        "1) AVG artikel 33 — 72u meldingsplicht aan AP. Klok tikt sinds 03:11. Deadline: donderdag 03:11.\n" +
        "2) NIS2 — jullie zijn 'essentiële entiteit'. Early warning binnen 24u aan NCSC (dus vóór morgenvroeg). Volledige melding: 72u.\n" +
        "3) Contractueel — Top 5 klanten hebben datalek-clausules. Meldingsplicht aan hen binnen 48u van detectie. Twee daarvan hebben opzegrecht bij niet-melden.\n" +
        "4) Beursregels — wij zijn beursgenoteerd. Materiële informatie moet openbaar gemaakt als dit koersgevoelig is. Onze inschatting: JA, dit is materieel.\n\n" +
        "Aanbeveling: NCSC vandaag bellen (early warning + gesprek over aanpak), AP-melding voorbereiden, klant-communicatie uitwerken. Geen 'wachten tot we zeker weten': deadlines zijn absoluut.",
      type: "regulatory", channel: "email", urgency: "high",
      senderName: "Marloes Jansen — Legal", timestamp: "09:32",
      importance: "crucial", targetRoles: ["legal"], visibility: "exclusive",
      deliverySeconds: 120,
    })},
    { id: r2i[2].id, type: "inject", position: { x: 1400, y: 440 }, data: injectData({
      title: "Cyberverzekeraar — 24u-clausule",
      content:
        "Van: Erik van der Meer, Cyber-broker — 09:45\n\n" +
        "'Ik heb het bericht van Eye Security ontvangen. Je moet weten: onze polis heeft een 24u-notificatie clausule. De klok is 03:11 gaan lopen. Dat betekent 2 dingen:\n\n" +
        "1) Als jullie NU officieel bij ons melden zijn we volledig gedekt. Dekking omvat: forensiek, losgeld-adviseur, PR-crisis-firma, juridische kosten, business-interruption tot €5M, klant-notificatie kosten, cyber-remediation.\n\n" +
        "2) Als jullie later melden (na 24u) heeft de underwriter een argument om claim af te wijzen of te limiteren. In alle recente cases hebben we dat gezien.\n\n" +
        "Ik heb Eye Security al gebeld voor een joint IR-plan. Ik moet nu formeel bevestiging van jullie CFO. Één email volstaat, formele claim komt later.'",
      type: "executive", channel: "phone", urgency: "high",
      senderName: "Erik van der Meer — Broker", timestamp: "09:45",
      importance: "crucial", targetRoles: ["cfo"], visibility: "exclusive",
      deliverySeconds: 300,
    })},
    { id: r2i[3].id, type: "inject", position: { x: 1580, y: 440 }, data: injectData({
      title: "COO — 'Kritieke systemen wankelen'",
      content:
        "Van: Sanne Bakker — COO — 09:52\n\n" +
        "'Ik hoor het van IT: de ransomware zit klaar op 60% van de file-servers. Als die aangaat vandaag of morgen kunnen we 3-5 dagen niet werken. Onze 3 hoofdproducten zijn afhankelijk van die shares.\n\n" +
        "Ik wil weten of we noodplan aan moeten. Dat betekent: 40% capaciteit, handmatige processen voor orders, en de klantenservice krijgt een goed verhaal. Geen paniek maar wel afwijken van hoe we het normaal doen.\n\n" +
        "Kan iemand mij een indicatie geven of de encryption in de komende 24u komt of niet? Ik moet nu besluiten of ik het management-team van elke lijn oproep.'",
      type: "internal", channel: "teams", urgency: "high",
      senderName: "Sanne Bakker — COO", timestamp: "09:52",
      importance: "info", targetRoles: ["ops_manager"],
      deliverySeconds: 450,
    })},
    { id: dec[1], type: "decision", position: { x: 1780, y: 220 }, data: decisionData(
      "Scope is duidelijk — wat besluit ieder van jullie?",
      [
        { role: "ciso", label: "Volledig containment: segmenten isoleren, DC's uit, AD-reset",
          vec: { CONT: 2, FOR: 1, BC: -1, KOS: -1 }, quality: "best",
          note: "Golden ticket-risico = AD-reset is niet optioneel. Kort BC-verlies maar containment werkt." },
        { role: "ciso", label: "Alles offline — volledige netwerk-shutdown",
          vec: { CONT: 2, FOR: -2, BC: -2, KOS: -2 }, quality: "poor",
          note: "Overkill. Verliest volatiele forensische data + stopt legitieme operatie onnodig." },
        { role: "ciso", label: "Alleen de al bekende 3 hosts isoleren",
          vec: { CONT: -2, FOR: 0, BC: 1 }, quality: "wrong",
          note: "Golden ticket = aanvaller heeft AD-toegang. 3 hosts isoleren doet niks meer." },
        { role: "legal", label: "NIS2 early warning + AVG voorbereiden + NCSC-gesprek vandaag",
          vec: { JUR: 2, VER: 1, KOS: -1 }, quality: "best",
          note: "Op tijd melden = toezichthouder wordt bondgenoot. Later = tegenstander." },
        { role: "legal", label: "Alleen NIS2 doen, AVG afwachten tot data-verlies bevestigd",
          vec: { JUR: -1 }, quality: "poor",
          note: "AVG-klok tikt sinds detectie, niet sinds bevestiging. Twee klokken = twee acties." },
        { role: "cfo", label: "Verzekeraar formeel bevestigen, joint IR-plan starten",
          vec: { KOS: 2, JUR: 1, VER: 1 }, quality: "best",
          note: "24u-clausule + hun IR-adviseur = miljoenen dekking + expertise." },
        { role: "cfo", label: "Wachten tot schade in cijfers uit te drukken is",
          vec: { KOS: -2, JUR: -1 }, quality: "wrong",
          note: "Wachten = argument voor niet-dekken. 24u-clausule is industry-standaard." },
        { role: "ops_manager", label: "Noodplan aan + management-team oproepen + klantenservice briefen",
          vec: { BC: 2, VER: 1 }, quality: "best",
          note: "Klanten voelen niks, mensen weten wat te doen. Downtime wordt logistiek." },
        { role: "ops_manager", label: "Wachten tot encryption daadwerkelijk aangaat",
          vec: { BC: -2, VER: -1 }, quality: "poor",
          note: "Reactief zijn op ransomware = 3 dagen chaos. Proactief = orde." },
      ],
    )},

    // ── R3 ──
    { id: r[2], type: "round", position: { x: 1960, y: 220 }, data: roundData(
      "R3 — De losgeld-eis komt binnen",
      "12:47 op maandag. Er komt een geëncrypteerd bericht binnen op info@. Ransom-note van 'Sphynx': 5 BTC (~€312.000) binnen 48 uur, te betalen naar een specifieke wallet. Als betaling niet komt: publicatie van 400 GB + automatische encryption van de payload.\n\nOm 13:03 belt een journalist van een landelijk vakmedium. Ze heeft 'signalen' dat er iets speelt en wil binnen 2 uur een reactie. Ze spreekt op dit moment iemand van HR omdat de servicedesk 'geen commentaar' zei.\n\nAls je gaat betalen: terug in bedrijf maar (a) je financiert de volgende aanval, (b) niets garandeert dat de data alsnog niet gepubliceerd wordt, (c) 50% van betalers krijgt sleutels die niet volledig werken. Als je NIET betaalt: encryption + publicatie. En dat wordt binnen 24u nieuws.",
      15,
    )},
    { id: r3i[0].id, type: "inject", position: { x: 2000, y: 440 }, data: injectData({
      title: "Losgeld-note — 'Sphynx'",
      content:
        "[Ontvangen op info@ om 12:47]\n\n" +
        "HELLO. WE ARE SPHYNX.\n\n" +
        "We have exfiltrated 412 GB of your data. This includes:\n" +
        "  • Full customer database with contact details, contracts, payment info\n" +
        "  • HR files including employee salaries, appraisals, and one termination case\n" +
        "  • Top 20 customer contracts with confidentiality clauses that you signed\n" +
        "  • Board minutes 2023-2026 including your acquisition discussions\n\n" +
        "We have also prepared ransomware payload on 60% of your file servers.\n" +
        "It will activate in 48 hours unless you pay.\n\n" +
        "PAYMENT: 5 BTC (~€312,000)\n" +
        "WALLET: bc1qxyz...\n" +
        "DEADLINE: Wednesday 12:47 CET\n\n" +
        "If paid on time:\n" +
        "  1. We provide decryption keys (guaranteed for at least 80% of files)\n" +
        "  2. We delete our copy of your data (we provide proof)\n" +
        "  3. You avoid publication on our leaksite\n\n" +
        "If not paid:\n" +
        "  1. Encryption activates automatically Wednesday 12:47\n" +
        "  2. Sample of data published on leaksite Wednesday 15:00\n" +
        "  3. Full dataset published Friday 12:00\n" +
        "  4. Ranshub crawler feeds it to security researchers who will contact your clients\n\n" +
        "Reply to this address to negotiate. Silence = we assume you chose publication.",
      type: "executive", channel: "raw", urgency: "critical",
      senderName: "Sphynx / anonymous", timestamp: "12:47",
      importance: "crucial", deliverySeconds: 0,
    })},
    { id: r3i[1].id, type: "inject", position: { x: 2200, y: 440 }, data: injectData({
      title: "Journalist NL-Vakblad belt HR-lijn",
      content:
        "Servicedesk verwijst deze door naar HR omdat de journalist vraagt naar 'medewerkers-impact'.\n\n" +
        "'Hoi, Rianne Prins hier van [Vakblad]. Ik hoor van een bron dat er bij jullie een cyber-incident speelt en dat medewerkers thuis werken vandaag. Klopt dat? Ik werk aan een kort artikel voor vanavond en wil jullie de kans geven om een reactie te geven. Zonder reactie schrijf ik het verhaal op basis van wat ik heb. Ik heb 2 uur.'\n\n" +
        "HR-medewerker (jong, geen crisis-ervaring) heeft haar door 'te gaan checken en terug te bellen'. Ze wacht nu op reactie. Als het bericht gepubliceerd wordt vóór jullie eigen verklaring, verlies je de framing.",
      type: "media", channel: "phone", urgency: "medium",
      senderName: "Rianne Prins — Vakblad", timestamp: "13:03",
      importance: "info", targetRoles: ["hr_lead"],
      correctRoute: "head_of_comms", visibility: "exclusive",
      deliverySeconds: 240,
    })},
    { id: r3i[2].id, type: "inject", position: { x: 2400, y: 440 }, data: injectData({
      title: "Eye Security IR — 'Onze aanbeveling'",
      content:
        "Van: Marc de Vries (Eye Security IR Lead) — 13:15\n\n" +
        "'We hebben de ransom-note geanalyseerd. Onze positie:\n\n" +
        "1) NIET betalen. Reden: (a) betaling wordt door NCSC afgekeurd + verzekeraar heeft voorwaarden om betaling wél te dekken maar wij raden af, (b) 50%+ decrypt-tools werken niet volledig, (c) je bent daarna target voor Sphynx-partners.\n\n" +
        "2) WEL onderhandelen — via een IR-partner (wij hebben dat gedaan). Doel is niet betalen maar TIJD KOPEN. Elke 12u onderhandeling = 12u recovery-window.\n\n" +
        "3) Recovery-strategie: wij bouwen clean-room. Nieuwe infrastructuur, van backups die getest zijn (backups >7 dagen oud, dus vóór aanvaller binnen was). Duurt 3-4 dagen. In die tijd is de organisatie 40% operationeel.\n\n" +
        "4) NCSC + AP nu volledig informeren. Verzekeraar formeel activeren. Klanten pro-actief bellen over jullie top-20 — nog vóór media publicatie.\n\n" +
        "Dit is een integriteitsmoment: doe het goed, en over 6 weken is dit een leerverhaal.'",
      type: "executive", channel: "email", urgency: "high",
      senderName: "Marc de Vries — Eye Security", timestamp: "13:15",
      importance: "crucial", deliverySeconds: 480,
    })},
    { id: dec[2], type: "decision", position: { x: 2600, y: 220 }, data: decisionData(
      "Losgeld & Media — hoe reageer je?",
      [
        { role: "ceo", label: "Geen betaling — principiële weigering, via IR-partner tijd kopen",
          vec: { CONT: 1, JUR: 2, VER: 2 }, quality: "best",
          note: "NCSC, verzekeraar en aandeelhouders belonen dit. Onderhandeling ≠ betalen." },
        { role: "ceo", label: "Betalen — snelste terugkeer, minst nieuws",
          vec: { CONT: -1, JUR: -2, VER: -2, KOS: -2 }, quality: "wrong",
          note: "Geen garantie dat data verwijderd wordt. Aanvaller komt terug. Boetes én reputatieschade." },
        { role: "ceo", label: "Nog wachten — misschien overwaarderen we het",
          vec: { CONT: -2, VER: -1, JUR: -1 }, quality: "poor",
          note: "Elke uur wachten = aanvaller escaleert. 48u-deadline is echt." },
        { role: "head_of_comms", label: "Proactieve verklaring vandaag — 'we werken aan een cyberincident'",
          vec: { VER: 2, JUR: 1 }, quality: "best",
          note: "Zelf de framing bepalen voordat de journalist het overneemt." },
        { role: "head_of_comms", label: "'No comment' via advocaten",
          vec: { VER: -2 }, quality: "poor",
          note: "Klinkt schuldig. Advocatentaal weerhoudt journalisten niet, verergert speculatie." },
        { role: "head_of_comms", label: "Wachten tot forensisch rapport volledig is",
          vec: { VER: -2, JUR: 0 }, quality: "poor",
          note: "Media wacht niet. Silence wordt door hen ingevuld." },
        { role: "hr_lead", label: "Journalist doorverbinden naar Comms (correcte routing)",
          vec: { VER: 1, JUR: 1 }, quality: "best",
          note: "HR is geen woordvoerder. Doorverbinden voordat er iets stoms wordt gezegd." },
        { role: "hr_lead", label: "Zelf antwoord geven — 'geen commentaar' herhalen",
          vec: { VER: -1, JUR: -1 }, quality: "poor",
          note: "Elk woord aan de pers zonder briefing = officiële statement." },
      ],
    )},

    // ── R4 ──
    { id: r[3], type: "round", position: { x: 2780, y: 220 }, data: roundData(
      "R4 — Iedereen belt tegelijk",
      "Dinsdag 08:00. Persverklaring is gisteravond uitgegaan. Reguliere media pikt op: 3 landelijke titels, 6 vakbladen, LinkedIn brandt. Aandelenkoers daalt in pre-market 4%.\n\nDe grootste klant (30% van omzet) belt om 08:15. Hun contract heeft opzegrecht bij datalek.\n\nInterne Slack ontgint: 200+ berichten in #general voordat HR erop kan reageren.\n\nNCSC belt: NIS2 early warning ontvangen, wil vandaag intake — waar staan jullie met containment, hoe communiceren jullie naar klanten. Dit is geen formele hearing maar ook geen vrijblijvend gesprek.",
      15,
    )},
    { id: r4i[0].id, type: "inject", position: { x: 2820, y: 440 }, data: injectData({
      title: "Klant #1 — CIO belt CFO direct",
      content:
        "Van: Peter Vorstenbosch, CIO — [Grootste Klant] — 08:15\n\n" +
        "'Ik heb je verklaring gelezen. Ik heb 20 minuten. Direct: is onze data in de exfil? Ons contract met jullie heeft een datalek-clausule (artikel 14.3). Als jullie ons niet actief informeren binnen 48u en het blijkt achteraf dat wij erin zaten, dan hebben wij het recht om onmiddellijk op te zeggen én schadevergoeding te eisen.\n\n" +
        "Ik ga jullie niet meteen aan het kruis nagelen. Maar ik wil vandaag antwoord op DRIE dingen:\n\n" +
        "1) Zit onze data in de exfil?\n" +
        "2) Welke categorieën data? (Namen? Contracten? Betalingen?)\n" +
        "3) Wat is jullie plan om te voorkomen dat onze klanten dit via publicatie ontdekken?\n\n" +
        "Als jullie proactief bellen, ben ik jullie bondgenoot. Als ik het via de pers hoor, ben ik jullie ex-klant.'",
      type: "executive", channel: "phone", urgency: "critical",
      senderName: "Peter Vorstenbosch — Klant CIO", timestamp: "08:15",
      importance: "crucial", targetRoles: ["cfo"], visibility: "exclusive",
      deliverySeconds: 0,
    })},
    { id: r4i[1].id, type: "inject", position: { x: 3020, y: 440 }, data: injectData({
      title: "Slack #general — medewerkers onrust",
      content:
        "Van: HR monitoring — 08:30\n\n" +
        "Berichten in #general: 247. Sentiment: 60% ongerust, 25% boos, 15% neutraal.\n\n" +
        "Top-3 vragen:\n" +
        "  1. 'Zijn onze salarissen ook gelekt?' (78 upvotes)\n" +
        "  2. 'Wat vertel ik als journalisten mij privé bellen?' (44 upvotes)\n" +
        "  3. 'Kunnen we morgen wel werken? Is thuiswerken veilig nu?' (39 upvotes)\n\n" +
        "Ondernemingsraad heeft om spoedoverleg gevraagd. Voorzitter OR: 'Wij horen dit via de pers, niet via HR. Dat vinden wij onacceptabel.'\n\n" +
        "Twee medewerkers hebben op LinkedIn commentaar geplaatst — één klopt, één verkeerd (paniekverhaal 'alle data weg').",
      type: "internal", channel: "slack", urgency: "high",
      senderName: "HR monitoring", timestamp: "08:30",
      importance: "crucial", targetRoles: ["hr_lead"], visibility: "exclusive",
      deliverySeconds: 200,
    })},
    { id: r4i[2].id, type: "inject", position: { x: 3220, y: 440 }, data: injectData({
      title: "NCSC — intake gesprek gepland",
      content:
        "Van: NCSC — Adviseur Bijzondere Zaken — 09:00\n\n" +
        "'Bedankt voor het snel melden. Ik zou vandaag met jullie willen spreken. Niet als toezichthouder maar als adviseur.\n\n" +
        "  • Waar staan jullie qua containment? Is de aanvaller er nog?\n" +
        "  • Wat is jullie besluit op betaling? (Ons standpunt: doe het niet, we adviseren daarover.)\n" +
        "  • Hebben jullie klant-communicatie voorbereid?\n" +
        "  • Wat is jullie herstel-strategie?\n\n" +
        "Als jullie transparant zijn en de goede stappen zetten, staan wij achter jullie in de eindrapportage naar AP. Als jullie afsluiten of vertragen worden wij formeel én dat is niet in jullie belang.\n\n" +
        "Ik kan vandaag 14:00 of 16:00. Legal, CISO en CEO uitgenodigd.'",
      type: "regulatory", channel: "phone", urgency: "high",
      senderName: "NCSC — Adviseur", timestamp: "09:00",
      importance: "crucial", targetRoles: ["legal"], visibility: "exclusive",
      deliverySeconds: 400,
    })},
    { id: dec[3], type: "decision", position: { x: 3420, y: 220 }, data: decisionData(
      "Stakeholders bedienen — wie doet wat?",
      [
        { role: "cfo", label: "Klant #1 zelf terugbellen — proactief + eerlijk + met plan",
          vec: { VER: 2, JUR: 1 }, quality: "best",
          note: "Klant een bondgenoot maken. Kost 1 uur nu, redt de relatie voor 5+ jaar." },
        { role: "cfo", label: "Generic mail naar alle klanten tegelijk",
          vec: { VER: -1 }, quality: "poor",
          note: "Top-klant verdient top-behandeling. Generic mail = respectloos in crisis." },
        { role: "cfo", label: "Wachten tot Legal zegt wat we mogen zeggen",
          vec: { VER: -2, JUR: 0 }, quality: "poor",
          note: "Legal-verlamming is een klassieke fout. Klanten wachten niet." },
        { role: "hr_lead", label: "All-hands binnen 2 uur + FAQ + OR briefen",
          vec: { VER: 2, BC: 1 }, quality: "best",
          note: "Medewerkers zijn ambassadeurs. Onderrichte medewerkers voorkomen social-media schade." },
        { role: "hr_lead", label: "Generic 'we werken eraan' mail",
          vec: { VER: -2 }, quality: "poor",
          note: "247 berichten in #general laten zien dat generic niet werkt." },
        { role: "legal", label: "NCSC intake vandaag 14:00 — volle openheid",
          vec: { JUR: 2, VER: 1 }, quality: "best",
          note: "NCSC helpt actief bij AP-rapportage. Bondgenoot vandaag = respijt volgend week." },
        { role: "legal", label: "Intake pas na intern advocaten-team",
          vec: { JUR: -2, VER: -1 }, quality: "poor",
          note: "NCSC-toon verandert. Wat vandaag advies is, wordt volgende week vermaning." },
      ],
    )},

    // ── R5 ──
    { id: r[4], type: "round", position: { x: 3600, y: 220 }, data: roundData(
      "R5 — Kiezen: herstellen of onderhandelen",
      "Dinsdag 16:30. Deadline losgeld = morgen 12:47. Nog 20 uur. IR-partner voert onderhandeling. Sphynx bereid deadline met 24u te verlengen als er 'goede intentie' getoond wordt — 0.5 BTC 'goodwill' (~€30k).\n\nBackups: 4 sets versleuteld, 8 zijn 7 dagen oud. Clean-room bouwen: 3-4 dagen, 7 dagen data-verlies. Kritieke ERP heeft eigen shadow-copy — daar kan 24u uit teruggehaald worden.\n\nAls clean-room + encryption gaat vandaag/morgen aan op bestaande systemen: zowel oude infra kwijt als nieuwe niet af. IT vraagt keuze.",
      15,
    )},
    { id: r5i[0].id, type: "inject", position: { x: 3640, y: 440 }, data: injectData({
      title: "Backup-lead rapport — 'wat kunnen we terughalen?'",
      content:
        "Van: Bas van Rijn — Backup & Recovery lead — 16:45\n\n" +
        "STATUS BACKUPS (van 12 backup-sets):\n" +
        "  • 4 sets: versleuteld door LockBit-variant\n" +
        "  • 8 sets: intact, laatst gevalideerd donderdag 25/7 22:00 (7 dagen data-verlies)\n" +
        "  • Air-gapped tape: laatst gedraaid vorige zondag — 9 dagen oud\n\n" +
        "OPTIE A — CLEAN ROOM (aanbevolen door Eye Security):\n" +
        "  Nieuwe infra opzetten in cloud, week-oude backup restoren, alle admin-credentials nieuw, DNS + AD helemaal opnieuw. Duur: 3-4 dagen. Data-verlies: 7 werkdagen. Zeker: aanvaller is 100% weg, forensisch bewijs volledig behouden. Kosten: €150k voor cloud + IR extra uren.\n\n" +
        "OPTIE B — GEFASEERD:\n" +
        "  Kritieke systemen (ERP, klantportaal) uit shadow-copy herstellen, rest later. Duur: 24u voor essentie, 5 dagen totaal. Data-verlies: 24u kritiek, 3-7 dagen rest. Risico: aanvaller kan nog terugkomen als niet alle credentials geroteerd zijn.\n\n" +
        "OPTIE C — PROD-RESTORE:\n" +
        "  Backups over bestaande systemen zetten. Snelst (12u). Maar: als aanvaller nog persistence heeft = direct terug bij af. Verliest ook forensische data. Niet aanbevolen.",
      type: "technical", channel: "teams", urgency: "high",
      senderName: "Bas van Rijn — Backup lead", timestamp: "16:45",
      importance: "crucial", targetRoles: ["ciso"], deliverySeconds: 0,
    })},
    { id: r5i[1].id, type: "inject", position: { x: 3840, y: 440 }, data: injectData({
      title: "COO — 'noodplan werkinstructies klaar'",
      content:
        "Van: Sanne Bakker (COO) — 17:00\n\n" +
        "'Noodplan-instructies zijn klaar voor de 3 kritieke processen:\n\n" +
        "  • Klantenservice: telefoon werkt, papieren order-formulieren geprint, facturatie kan handmatig — 40% extra tijd maar loopt door.\n" +
        "  • Logistiek: WMS-vervanger op Excel opgezet, dagelijkse output-lijsten getekend + gescand.\n" +
        "  • Financiën: incidentele betalingen via telefonisch contact bank. Loonverwerking eventueel handmatig via oud systeem.\n\n" +
        "Kost 40% capaciteit maar houdt operatie op de been. Als IT 3-4 dagen niet ligt, kunnen wij 5-7 dagen doorbrengen zonder klantverlies.\n\n" +
        "Beslissing nodig: activeer ik het noodplan nu?'",
      type: "internal", channel: "email", urgency: "high",
      senderName: "Sanne Bakker — COO", timestamp: "17:00",
      importance: "info", targetRoles: ["ops_manager"], deliverySeconds: 300,
    })},
    { id: r5i[2].id, type: "inject", position: { x: 4040, y: 440 }, data: injectData({
      title: "IR-partner — onderhandelingsresultaat",
      content:
        "Van: Marc de Vries (Eye Security IR) — 17:20\n\n" +
        "'Update van onderhandeling:\n\n" +
        "Sphynx biedt: 24u deadline-verlenging tegen 0.5 BTC (~€30k) 'goodwill-betaling'. Als jullie die betalen, deadline schuift naar overmorgen 12:47.\n\n" +
        "MIJN ADVIES: Doen. Reden — die €30k is NIET om te betalen, het is om TIJD TE KOPEN. Met 24u extra kan Bas het clean-room bijna af hebben. Als Sphynx daarna de encryption trekt en de leak start, hebben jullie al nieuwe infra draaien en kunnen jullie transparant zijn richting klanten met 'we zijn terug in bedrijf'.\n\n" +
        "Als jullie helemaal niet betalen: encryption gaat morgen aan, jullie zitten 4 dagen zonder IT én zonder narratief.\n\n" +
        "Verzekeraar heeft goedkeuring gegeven voor deze €30k als 'IR-kosten' — niet als losgeld. Beslissing?'",
      type: "executive", channel: "phone", urgency: "critical",
      senderName: "Marc de Vries — Eye Security", timestamp: "17:20",
      importance: "crucial", deliverySeconds: 600,
    })},
    { id: dec[4], type: "decision", position: { x: 4240, y: 220 }, data: decisionData(
      "Recovery-strategie — welke koers?",
      [
        { role: "ciso", label: "Clean-room + goodwill-betaling voor tijd — 4 dagen bouwen",
          vec: { CONT: 2, FOR: 2, BC: -1, KOS: -1 }, quality: "best",
          note: "Langste hersteltijd maar zekerheid + forensisch bewijs volledig. Referentie-aanpak." },
        { role: "ciso", label: "Gefaseerd — snel kritiek terug, geleidelijk de rest",
          vec: { CONT: 0, FOR: 0, BC: 1, KOS: 0 }, quality: "good",
          note: "Sneller operationeel maar risico dat aanvaller nog terugkomt. Compromis." },
        { role: "ciso", label: "Prod-restore — backups over bestaande hosts",
          vec: { CONT: -2, FOR: -2, BC: 2, KOS: -1 }, quality: "wrong",
          note: "Verliest bewijs, aanvaller kan nog persistence hebben. Klassiek zelf-in-de-voet." },
        { role: "ops_manager", label: "Noodplan aan + management-team briefen + klantenservice op standby",
          vec: { BC: 2, VER: 1 }, quality: "best",
          note: "3-4 dagen downtime wordt behapbaar. Klanten voelen 40% capaciteit niet." },
        { role: "ops_manager", label: "Noodplan pas activeren als IT-herstel faalt",
          vec: { BC: -2, VER: -1 }, quality: "poor",
          note: "Reactief = paniek. Proactief = beheersing." },
        { role: "cfo", label: "Goodwill-betaling €30k toestaan als IR-kosten (verzekerd)",
          vec: { CONT: 1, KOS: -1 }, quality: "good",
          note: "Tijd kopen is legitiem — dit is geen losgeld maar een IR-tactiek. Verzekerd." },
        { role: "cfo", label: "Geen enkele betaling — ook geen goodwill",
          vec: { CONT: -2, JUR: 0, KOS: 1 }, quality: "poor",
          note: "Principe verheerlijken kost hier 4 dagen extra downtime. Legitieme IR-tactiek." },
      ],
    )},

    // ── R6 ──
    { id: r[5], type: "round", position: { x: 4420, y: 220 }, data: roundData(
      "R6 — De leaksite gaat live",
      "Donderdag 15:00. Deadline is gepasseerd. Clean-room is voor 80% klaar. Sphynx heeft de eerste sample gepubliceerd: 500 klant-emails + intern management-rapport. Landelijke media pikt het binnen 15 min op.\n\nTrending term wordt jullie bedrijfsnaam. Vier interview-verzoeken. Board-vergadering ingelast voor 20:00.\n\nLegal wijst erop dat 500 gelekte klant-mails betekent dat individuele meldingen aan die klanten verplicht zijn (aanvullende AVG-melding, 72u vanaf publicatie). Advocatenkantoor kan helpen maar wil NU besluit — communicatie is niet meer optioneel.",
      15,
    )},
    { id: r6i[0].id, type: "inject", position: { x: 4460, y: 440 }, data: injectData({
      title: "AD.nl / RTL / NOS — 'Grote NL-organisatie slachtoffer'",
      content:
        "Van: Media-monitoring — 15:12\n\n" +
        "PUBLICATIES afgelopen 12 min:\n" +
        "  • AD.nl — 'Ransomware bij [bedrijfsnaam]: klantdata gelekt' (15:04)\n" +
        "  • RTL Z — Beursreactie: -6% in 8 minuten (15:07)\n" +
        "  • NOS — Persbericht opgevraagd (15:09)\n" +
        "  • De Telegraaf — twitter-post: 'reactie?' (15:10)\n" +
        "  • FD — Diepgaande analyse aangekondigd voor morgen\n\n" +
        "SOCIAL SENTIMENT: Twitter 87% negatief, hashtag #DataLek trending NL. LinkedIn 60% negatief maar meer nuance.\n\n" +
        "INTERVIEW-VERZOEKEN (deadline vandaag):\n" +
        "  • NOS Journaal — CEO voor 18:00 uitzending\n" +
        "  • FD — hoofdredacteur zelf, CEO of CFO\n" +
        "  • RTL Boulevard — bureau-drama\n" +
        "  • Nieuwsuur — CISO, technisch-diepgaand\n\n" +
        "Als jullie NIEMAND leveren tegen 17:00, wordt het verhaal geschreven met 'geen reactie'.",
      type: "media", channel: "news", urgency: "critical",
      senderName: "Media-monitoring", timestamp: "15:12",
      importance: "crucial", deliverySeconds: 0,
    })},
    { id: r6i[1].id, type: "inject", position: { x: 4660, y: 440 }, data: injectData({
      title: "Board — spoedvergadering 20:00 vanavond",
      content:
        "Van: Company Secretary — 15:30\n\n" +
        "'CEO, Board-voorzitter vraagt spoedvergadering. Alle 5 board-leden + 2 externe adviesraad + executive team.\n\n" +
        "Agenda:\n" +
        "  1. Status update — waar staan we NU?\n" +
        "  2. Communicatie-strategie — pers, klanten, aandeelhouders\n" +
        "  3. Financiële impact & verzekering\n" +
        "  4. Herstel timeline & vertrouwen\n" +
        "  5. Governance — wie leidt, wat is onze positie?\n\n" +
        "Board-voorzitter privé: 'ik verwacht LEIDERSCHAP vanavond, niet excuses. Als er vragen zijn — beantwoord ze. Als er fouten zijn — benoem ze. Wij staan achter jou zolang jij ons niet verrast met dingen die we hadden moeten weten.'\n\n" +
        "Externe advies: minstens 1 board-lid stelt vraag over jouw persoonlijke positie. Wees voorbereid.",
      type: "executive", channel: "email", urgency: "critical",
      senderName: "Company Secretary", timestamp: "15:30",
      importance: "crucial", targetRoles: ["ceo"], visibility: "exclusive",
      deliverySeconds: 300,
    })},
    { id: r6i[2].id, type: "inject", position: { x: 4860, y: 440 }, data: injectData({
      title: "Legal — aanvullende AVG-melding + individuele klant-notif's",
      content:
        "Van: Marloes Jansen — Legal — 15:45\n\n" +
        "URGENT — na publicatie van 500 klant-emails is aanvullende AVG-melding vereist:\n\n" +
        "1) Melding aan AP: aanvullende informatie datalek. Deadline: 72u vanaf publicatie (zondag 15:00).\n" +
        "2) Individuele melding aan 500 betrokkenen. AVG art. 34 — 'hoog risico'. Publicatie op leaksite = hoog risico. GEEN uitstel.\n\n" +
        "OPTIES:\n" +
        "  A) Mail-template, morgen versturen naar 500 mensen. Kans op backlash: hoog. Legitiem-boete-risico: laag.\n" +
        "  B) Handmatig bellen via specialistisch bureau. Kosten €25k. Ontvangst: veel beter. Duur: 3 dagen.\n" +
        "  C) Combi: proactief massa-mail vandaag, telefonische follow-up binnen 48u. Kosten €10k. AANBEVOLEN.\n\n" +
        "Beslissing nodig vandaag 17:00.",
      type: "regulatory", channel: "email", urgency: "high",
      senderName: "Marloes Jansen — Legal", timestamp: "15:45",
      importance: "crucial", targetRoles: ["legal"], visibility: "exclusive",
      deliverySeconds: 480,
    })},
    { id: dec[5], type: "decision", position: { x: 5060, y: 220 }, data: decisionData(
      "Reactie op leak — hoe positioneren?",
      [
        { role: "ceo", label: "NOS Journaal vanavond — jij in beeld, transparant + met plan",
          vec: { VER: 2, JUR: 1 }, quality: "best",
          note: "Boardvoorzitter vraagt leiderschap. Zichtbaarheid onder druk = gouden moment." },
        { role: "ceo", label: "COO of externe woordvoerder inzetten",
          vec: { VER: -2 }, quality: "poor",
          note: "Delegeren in crisis voedt kritiek." },
        { role: "ceo", label: "Alleen schriftelijke verklaring, geen interviews",
          vec: { VER: -1 }, quality: "poor",
          note: "Statement zonder gezicht = 'wat verbergen ze?'" },
        { role: "head_of_comms", label: "Actieve pers-briefing + FAQ + 1-op-1 met key media",
          vec: { VER: 2, JUR: 1 }, quality: "best",
          note: "Nu bepaal je de framing, later is het te laat." },
        { role: "head_of_comms", label: "Statement via advocaten alleen",
          vec: { VER: -2 }, quality: "poor",
          note: "Klinkt schuldig. Journalisten schrijven het verhaal zonder jou." },
        { role: "legal", label: "Optie C — mass mail + telefonische follow-up (aanbevolen)",
          vec: { JUR: 2, VER: 2, KOS: -1 }, quality: "best",
          note: "Compliance + menselijkheid. Optimale mix voor kosten en effect." },
        { role: "legal", label: "Alleen massa-mail — snelst en goedkoopst",
          vec: { JUR: 1, VER: -1 }, quality: "poor",
          note: "500 mensen die zichzelf op leaksite tegenkomen willen persoonlijk contact." },
        { role: "legal", label: "Wachten tot 500-lijst definitief geverifieerd is",
          vec: { JUR: -2 }, quality: "wrong",
          note: "AVG-boete 4% wereldwijde omzet bij vertraging. Deadline is deadline." },
      ],
    )},

    // ── R7 ──
    { id: r[6], type: "round", position: { x: 5240, y: 220 }, data: roundData(
      "R7 — Zeven dagen later: wat verandert er?",
      "Volgende week donderdag. 08:00 in het board-room. De acute fase is voorbij. Clean-room draait, operatie is op 90% capaciteit terug, klant-notificaties afgerond (450 van de 500 gereageerd, 3 kleine klanten opgezegd, 1 grote klant heeft juist vertrouwen bevestigd publiekelijk op LinkedIn). Media-aandacht grotendeels verstomd, Nieuwsuur volgt met documentaire over 6 maanden. NCSC 'positief-onder-voorbehoud' bevinding.\n\nBoard vraagt: 'wat leren we hiervan? Wat gaan we structureel anders doen? Concrete commitments, met eigenaar en budget?'\n\nDit is de kans om deze crisis te verzilveren. Doe je het slim: aanleiding om cyberweerbaarheid blijvende prioriteit te maken. Doe je het slecht: goede voornemens die over 6 maanden verstoft zijn.",
      12,
    )},
    { id: r7i[0].id, type: "inject", position: { x: 5280, y: 440 }, data: injectData({
      title: "Post-mortem template — Board vraagt concrete commitments",
      content:
        "Van: Company Secretary — 08:00\n\n" +
        "'Elk executive team-lid schrijft één structurele verandering op:\n\n" +
        "  1. Concrete actie (geen 'we gaan kijken naar')\n" +
        "  2. Eigenaar (naam)\n" +
        "  3. Deadline (datum)\n" +
        "  4. Budget (bedrag)\n" +
        "  5. Success-metric (hoe meten we dat het werkt?)\n\n" +
        "Board weet dat dit incident €4M gekost heeft. Ze zijn bereid tot 3x dat bedrag te investeren IF commitments concreet + meetbaar zijn.\n\n" +
        "Generalities ('we gaan awareness verhogen') → investering gaat NIET door. Concreet ('MDR-uitbreiding naar 24/7 tier-3 + jaarlijkse full-scope oefening met externe leverancier + purple-team assessment Q3') → budget goedgekeurd.'",
      type: "internal", channel: "memo", urgency: "medium",
      senderName: "Company Secretary", timestamp: "08:00",
      importance: "info", deliverySeconds: 0,
    })},
    { id: r7i[1].id, type: "inject", position: { x: 5480, y: 440 }, data: injectData({
      title: "Aandeelhoudersvertegenwoordiging — vertrouwenscheck",
      content:
        "Van: David Boersma — Voorzitter aandeelhoudersvertegenwoordiging — 08:30\n\n" +
        "'Onze aandeelhouders volgen de post-mortem met scherpe aandacht:\n\n" +
        "  • Directie heeft de crisis integer aangepakt — waardering.\n" +
        "  • Aandelenkoers is voor 60% hersteld — rendez-vous met Q3-jaarcijfer volgt.\n" +
        "  • ZORG: organisatie MOET structureel iets leren, anders is dit reputatie-krediet-verlies opnieuw op de horizon.\n\n" +
        "Wij verwachten:\n" +
        "  1. Cyberweerbaarheid als STRATEGISCHE prioriteit in de jaarrekening\n" +
        "  2. Externe periodieke assessment (jaarlijks) met openbare samenvatting\n" +
        "  3. Board-level cyber-risk-comité (kwartaalrapportage)\n" +
        "  4. Budget: € [x] structureel per jaar boven op de huidige IT-uitgaven\n\n" +
        "4 dingen concreet → wij blijven investerend. 'Business as usual' → significant deel positie in Q4 naar concurrenten.'",
      type: "executive", channel: "email", urgency: "high",
      senderName: "David Boersma — Aandeelhouders",
      importance: "info", targetRoles: ["ceo"], visibility: "exclusive",
      deliverySeconds: 300,
    })},
    { id: dec[6], type: "decision", position: { x: 5680, y: 220 }, data: decisionData(
      "Structurele lessen — waar committen jullie op?",
      [
        { role: "ciso", label: "Eye Security uitbreiden naar 24/7 tier-3 + purple-team + budget €[X]",
          vec: { CONT: 2, FOR: 1, KOS: -1 }, quality: "best",
          note: "Concreet, meetbaar, board-approved. Voorkomt herhaling; expertise blijft extern." },
        { role: "ciso", label: "Interne SOC-team opzetten (2M+/jaar)",
          vec: { CONT: -1, KOS: -2 }, quality: "poor",
          note: "24/7 SOC bouwen kost 2M+/jaar, jaren doorlooptijd. Onrealistisch." },
        { role: "ciso", label: "Alleen awareness-training uitrollen",
          vec: { CONT: -1 }, quality: "wrong",
          note: "Awareness alleen voorkomt geen ransomware." },
        { role: "legal", label: "Incident-runbook + jaarlijkse oefening + kwartaal-review",
          vec: { JUR: 2, VER: 1 }, quality: "best",
          note: "Meldplicht-fouten voorkom je door repetitie." },
        { role: "legal", label: "Alleen dit incident documenteren",
          vec: { JUR: -1 }, quality: "poor",
          note: "Documentatie zonder training = plank-materiaal." },
        { role: "ceo", label: "Cyber-risk-comité op board-niveau + externe assessment + budget €[X]/jaar",
          vec: { CONT: 1, VER: 2, KOS: -2 }, quality: "best",
          note: "Board-level commitment = strategisch. Aandeelhouders vragen dit expliciet." },
        { role: "ceo", label: "Alleen budget verhogen, geen governance-verandering",
          vec: { CONT: 0, VER: 0 }, quality: "poor",
          note: "Meer geld ≠ meer effect. Structuur is de multiplier." },
        { role: "ceo", label: "Business-as-usual — 'we hebben geleerd'",
          vec: { CONT: -2, VER: -2 }, quality: "wrong",
          note: "Terug naar dagorde = tweede crisis binnen 3 jaar." },
      ],
    )},

    // ── Outcomes ──
    { id: outWin, type: "outcome", position: { x: 5860, y: 80 }, data: outcomeData({
      key: "gewonnen",
      label: "Contained met integriteit — case study voor de sector",
      narrative:
        "Zes maanden later. Jullie case is voorbeeld voor de sector geworden. NCSC gebruikt jullie aanpak in trainings. De Autoriteit Persoonsgegevens heeft de melding als 'proportioneel en tijdig' gekwalificeerd — geen boete. Verzekeraar heeft de claim volledig gehonoreerd (€2.8M dekking uitgekeerd). Klantverlies bleef bij 3 kleine klanten; grote klanten hebben publiekelijk vertrouwen bevestigd. Aandelenkoers is 8% hoger dan vóór de crisis. De post-mortem-commitments zijn uitgevoerd; het cyber-risk-comité vergadert kwartaal, de externe assessment loopt jaarlijks. Aanvaller geïdentificeerd door forensisch bewijs; 3 arrestaties.",
      lessonLearned: "Snelheid + integriteit + transparantie — geen shortcuts, wel discipline.",
      scoreRange: { min: 18 },
    })},
    { id: outMixed, type: "outcome", position: { x: 5860, y: 260 }, data: outcomeData({
      key: "gemengd",
      label: "Overleefd — met kleerscheuren",
      narrative:
        "Zes maanden later. Organisatie draait weer op volle capaciteit. Boete van €280k van AP voor te late aanvullende melding — 'proportioneel gezien de verzachtende omstandigheden'. Verzekeraar heeft 70% van de claim gedekt. Vijf klanten weg (1 grote, 4 kleine) — 5-7% omzetdaling. Media-aandacht vervaagd. Aandelenkoers is teruggevallen naar pre-crisis niveau. Board heeft budget goedgekeurd voor structurele veranderingen (helft van wat werd gehoopt). CEO heeft board-vertrouwen behouden.",
      lessonLearned: "Verkeerde volgorde in communicatie kostte meer dan de technische keuzes. Nog steeds herstelbaar, maar bittere lessen.",
      scoreRange: { min: 3, max: 17 },
    })},
    { id: outLose, type: "outcome", position: { x: 5860, y: 440 }, data: outcomeData({
      key: "verloren",
      label: "Cascaded failure — lange herstelweg",
      narrative:
        "Zes maanden later. AVG-boete van €1.8M — 1.2% van wereldwijde omzet. Verzekeraar heeft claim afgewezen wegens niet-nakomen 24u-clausule. Drie grote klanten vertrokken (18% omzetdaling). Aandelenkoers is 32% lager dan pre-crisis; activistische aandeelhouder-groep wil zittende bestuur vervangen. Aanvaller nooit gepakt. CEO opgestapt na buitengewone aandeelhoudersvergadering in Q2. Interimmer wordt zoekend. NCSC heeft in publieke eindrapportage 'onvoldoende voortvarendheid' benoemd. Sector heeft onze case als afschrikwekkend voorbeeld.",
      lessonLearned: "Deadlines zijn deadlines. Compliance eerst, dan techniek. Beslissingen onder druk waren impulsief; structuur ontbrak.",
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
