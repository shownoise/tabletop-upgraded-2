import type { PremadeInject, RoleBriefing, ScenarioGraph } from "./types"
import { RETAINER_ACTIVATED_FLAG } from "./types"
import { planToGraph, type WizardPlan } from "./wizard-plan"
import type { Role } from "@/lib/types"

// ONDERWIJSVERENIGING NOORD-OOST — Play-ransomware bij een MKB+ schoolbestuur.
//
// Setting: een Nederlandse onderwijsvereniging met vijf VO-scholen, samen ~4000
// leerlingen en ~350 medewerkers. Essentiële entiteit onder NIS2 (Annex I,
// sector 8 — onderwijs is inmiddels opgenomen). Verwerkingsverantwoordelijke
// onder AVG art. 33. Klassiek MKB+ ICT-profiel:
//
//   • ICT is uitbesteed aan regionale MSP "WestNet ICT B.V." — SLA 8 werkuren
//     eerste-lijn respons; ransomware valt buiten scope van het contract.
//   • Backups draaien via Veeam → Wasabi cold storage. Volledige restore is
//     nooit getest; laatste beperkte drill (2 servers) was ruim twee jaar geleden.
//   • Eén IT-coördinator (Rob de Vries, rol `it_manager`) kent finance en het
//     leerlingregistratiesysteem echt. Rob zit in Portugal, laptop mee, mobiel
//     bereikbaar maar niet paraat.
//   • Cyberpolis via Univé Zakelijk bestaat sinds 2022 — melding aan verzekeraar
//     binnen 24 uur, uitsluitingsclausule voor "vermijdbare fouten" nooit
//     zorgvuldig gelezen door bestuur of controller.
//   • Grote leveranciers: Magister (leerlingregistratie, 48u breach-clause),
//     ParnasSys (financiële administratie), LoonBureau Oost (salaris).
//
// Aanvalskarakter: Play-ransomware met exfiltratie. Zes rondes over vijf dagen
// verhaaltijd. Ronde 1 opent met ambigue signalen; ronde 6 sluit met
// verantwoording aan AP, RvT en verzekeraar.
//
// Dit is een starter-scenario voor Eye Security-trainingen — facilitator kan
// per klant tweaken via de builder of via de AI-wizard.

const plan: WizardPlan = {
  name: "★ Onderwijsvereniging Noord-Oost — Play-ransomware (AVG + NIS2)",
  scenarioType: "ransomware_double_extortion",
  irPlaybook: `## Crisisdraaiboek — Onderwijsvereniging Noord-Oost (v1.3, mei 2023)

**Rol IT-coördinator (Rob de Vries):** eerste aanspreekpunt bij IT-incidenten.
Bij afwezigheid: bestuurssecretaris meldt bij MSP en informeert bestuurder.

**Escalatiepad**
1. Melding bij WestNet ICT via ticketportal binnen kantooruren (08:00–17:30).
2. Buiten kantooruren: piketnummer WestNet +31 (0)26 355 41 00 (SLA 8 werkuren).
3. Bij vermoeden datalek: bestuurder informeren, Legal/DPO betrekken.
4. Cyberverzekeraar Univé Zakelijk melden binnen 24 uur na ontdekking.
5. AP-melding via portaal binnen 72 uur na ontdekking (AVG art. 33).

**Backup & herstel**
- Dagelijkse Veeam-backup naar Wasabi cold storage.
- Retentie: 30 dagen dagelijks, 12 maanden maandelijks.
- (OPZET-VEROUDERD: paragraaf noemt "wekelijkse restore-drill" — sinds 2022
  niet meer uitgevoerd door capaciteitsgebrek.)

**Losgeld**
- Beleid bestuur (2022): "geen losgeld tenzij aantoonbaar noodzakelijk voor
  continuïteit leerlingveiligheid". Interpretatie is nooit uitgewerkt.
- Verzekeraar-onderhandelaar activeren voordat er contact met dader is.

**Externe communicatie**
- Bestuurder autoriseert. Ouders informeren via Magister-berichten en de
  website. Journalisten uitsluitend via bestuurder of woordvoerder.`,
  rounds: [
    // ══════════════════════════════════════════════════════════════
    // Ronde 1 — Dag 0 ochtend — Ambigue signalen
    // ══════════════════════════════════════════════════════════════
    {
      title: "R1 — Vreemde signalen op maandagochtend",
      situation:
        "Maandag 4 november, 09:15. Op de eerste schooldag na de herfstvakantie meldt lerares Nederlands mevrouw Van der Meer dat haar klassenplanner leeg lijkt: leerlinggegevens laden niet. Twee collega's op locatie Noord bevestigen dat Magister traag doet en dat gedeelde bestanden 'raar reageren'. WestNet ICT heeft in het MSP-dashboard om 08:42 een low-severity alert gezet ('ongebruikelijke schrijfactiviteit op FS-01'), maar dat is niet doorgezet naar een ticket. IT-coördinator Rob de Vries is op vakantie in Portugal — WhatsApp aan, mobiel op stil. Meerdere ouders melden bij de administratie dat ze een vreemde SMS hebben gehad over een wachtwoord-reset.",
      timerMinutes: 15,
      openingPrompts: [
        "Wat weten we zeker en wat is aanname op dit moment?",
        "Wie mag nu, zonder Rob, een besluit nemen richting WestNet?",
        "Welke meldingsklok is misschien al gaan lopen?",
      ],
      facilitatorPerspective:
        "R1 test of het team het verschil ziet tussen ruis en een echt incident. De MSP-alert van 08:42 is de sleutel — teams die deze koppelen aan het lerarensignaal komen op tijd in beweging. Let op teams die de ouder-SMS als 'onderdeel van het incident' behandelen: die SMS is een klassiek phishingcampagne-signaal dat toevallig samenvalt en niets met de encryptie te maken heeft. Rob's afwezigheid dwingt het team om mandaat expliciet te maken; dat is geen bug, dat is een leerdoel.",
      injects: [
        {
          id: "r1-teacher-email",
          type: "internal", channel: "email", urgency: "medium",
          title: "Lerares meldt: klassenplanner werkt niet",
          content:
            "Van: E. van der Meer (docent Nederlands, locatie Noord). Aan: administratie@ov-no.nl. Verzonden: 09:12.\n\n" +
            "Beste administratie, ik heb net mijn eerste les moeten beginnen zonder klassenlijst. Magister laadt niet en mijn map op de gedeelde schijf geeft raar gedrag — ik zie mappen wel maar bestanden openen niet of geven een foutmelding over rechten. Kan iemand hier vandaag nog naar kijken? Ik zit tot 15:20 vast in de vaklessen. Groet, Erika van der Meer.",
          senderName: "Erika van der Meer",
          timestamp: "09:12",
          reliability: "fact",
          classification: "aanname",
          targetTeam: "all",
          facilitatorNote: "Aanname — docentobservatie zonder technische bevestiging. Perfect om aan het MSP-signaal te knopen.",
        },
        {
          id: "r1-msp-alert",
          type: "alert", channel: "siem", urgency: "high",
          title: "WestNet MSP-dashboard — Ongebruikelijke schrijfactiviteit FS-01 (AVG/NIS2-relevant)",
          content:
            "MSP-dashboard notificatie (nog geen ticket). Bron: WestNet monitoring op fileserver FS-01. Vensterperiode: 08:38–08:45. Signaal: 4200 bestandsmodificaties in 7 minuten, waaronder uitbreiding .PLAY op ~1800 objecten in de shares /leerlingdossiers en /financien. Severity door WestNet automatisch op 'low' gezet omdat het patroon lijkt op geplande archivering. Doorzetten naar ticket vereist manuele actie van dienstdoende engineer. De MSP-SLA dekt geen ransomware-scope buiten kantooruren; opschaling naar piket kost tijd en geld. Bij bevestiging van datalek treden AVG art. 33 (AP, 72u) en NIS2 art. 23 (NCSC/CSIRT, 24u) in werking.",
          senderName: "WestNet ICT — Monitoring",
          source: "MSP dashboard",
          timestamp: "08:42",
          reliability: "fact",
          classification: "feit",
          triggersRegulatoryNotification: true,
          nis2Relevant: true,
          targetTeam: "technical_it",
          setsUpDecisionNodeId: "d1-r1-ambigue",
          facilitatorNote: "Feit — de MSP-alert is de sleutel. Als het team dit niet aan de docentenmelding knoopt, blijft R1 hangen.",
        },
        {
          id: "r1-parent-sms",
          type: "social", channel: "sms", urgency: "low",
          title: "Ouders melden vreemde SMS over wachtwoord-reset",
          content:
            "Van: telefonistes locatie Zuid. Binnengekomen tussen 08:50 en 09:20: zeven ouders bellen omdat ze een SMS hebben gekregen: 'Uw ouderaccount vereist een wachtwoord-reset — klik hier voor bevestiging.' Link wijst naar een domein dat lijkt op ov-no.nl maar dat niet is. Ouders vragen of dit klopt. Let op: deze SMS is niet uitgegaan vanaf een van onze systemen. Waarschijnlijk een losstaande phishingcampagne die toevallig vandaag piekt.",
          senderName: "Frontoffice locatie Zuid",
          timestamp: "09:22",
          reliability: "misleading",
          classification: "fabel",
          targetTeam: "crisis_management",
          facilitatorNote: "Fabel — expliciete red herring. Test of team dit als losstaande phishingcampagne herkent.",
        },
        {
          id: "r1-rob-whatsapp",
          type: "internal", channel: "whatsapp", urgency: "medium",
          title: "WhatsApp van Rob (vanuit Portugal)",
          content:
            "Rob de Vries: 'Hey — kreeg net een mailtje van Erika dat Magister traag is. Ik zit nog aan het ontbijt hier in Faro. Kan iemand kijken of het gewoon een Magister-storing is? Ik zie op Magister-status geen melding maar dat betekent niets. Ik ben na 12:00 NL-tijd wat beter bereikbaar. Als het echt een dingetje is bel me op WhatsApp, gewone SMS werkt hier slecht.' — Rob is de enige persoon met écht diepe kennis van het leerlingregistratiesysteem, en zit onbereikbaar op vakantie.",
          senderName: "Rob de Vries — IT-coordinator",
          timestamp: "09:28",
          reliability: "assumption",
          classification: "aanname",
          deliverySeconds: 90,
          targetTeam: "technical_it",
        },
      ],
      roleActions: [
        {
          id: "r1-ceo-mandate",
          label: "Geef bestuurssecretaris mandaat om WestNet formeel te escaleren",
          description: "Expliciet, schriftelijk mandaat aan bestuurssecretaris om buiten Rob om te handelen richting MSP en verzekeraar.",
          allowedRoles: ["ceo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-ciso-verify",
          label: "Verifieer de MSP-alert bij de bron",
          description: "Bel WestNet piketnummer om de alert van 08:42 te laten opwaarderen tot ticket met engineer erop.",
          allowedRoles: ["ciso"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-it-isolate",
          label: "Vraag WestNet om FS-01 netwerktechnisch te isoleren",
          description: "Netwerk-isolatie via de switch — niet uitzetten. Behoud van geheugen en logs voor forensiek.",
          allowedRoles: ["it_manager", "ciso"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-legal-clock",
          label: "Log tijdstip eerste indicatie en start meldingskalender",
          description: "Registreer 08:42 als eerste indicatietijd. Voorbereid AP- en NCSC-melding maar verzend nog niet.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-cfo-insurer-preadvies",
          label: "Bel verzekeraar Univé — pre-melding zonder details",
          description: "Meld het incident-in-onderzoek. De 24u-klok voor Univé start bij detectie, niet bij bevestiging.",
          allowedRoles: ["cfo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-comms-hold",
          label: "Zet interne holding-statement klaar voor onderwijsteams",
          description: "Kant-en-klare tekst voor collega's op de vijf locaties zodra we iets weten. Niet verzenden.",
          allowedRoles: ["head_of_comms"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-hr-standby",
          label: "Bereid teamleiders voor op mogelijke lesuitval",
          description: "Bel de vijf teamleiders vertrouwelijk. Nog geen paniek zaaien, wel voorbereid zijn op noodrooster.",
          allowedRoles: ["hr_lead"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-ops-inventory",
          label: "Inventariseer welke primaire processen op FS-01 leunen",
          description: "Roosters, cijferregistratie, leerlingzorgdossiers — wat valt uit als FS-01 offline gaat?",
          allowedRoles: ["ops_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r1-wait-more-info",
          label: "Wacht op meer signalen voordat WestNet wordt opgeschaald",
          description: "Ga eerst na of het geen Magister-storing is; bel WestNet pas als het patroon zich versterkt.",
          allowedRoles: ["ceo", "ciso", "it_manager"], irPlanAligned: false,
          qualityRank: "poor",
          facilitatorCommentary: "Deze reflex is menselijk maar hier duur: elke minuut wachten geeft de aanvaller meer bestanden om te versleutelen.",
          lessonLearned: "Bij ambigue signalen: escaleer richting bron in plaats van te wachten op meer bewijs.",
        },
      ],
      discussionGoal:
        "Deze ronde toetst of het team het MSP-dashboard koppelt aan de docentenmelding en of het mandaat rond de afwezigheid van Rob de Vries expliciet wordt vastgelegd. Wie stalt, mist de vroege containment; wie racet, riskeert een grove reflex zoals FS-01 uitzetten via de switch. Nudge bij stilstand: verwijs naar het MSP-dashboard van vanochtend. Nudge bij haast: check of iemand via WestNet handelt in plaats van de stekker eruit.",
      keyQuestions: [
        "Welke informatie is feit, welke aanname?",
        "Wie mag zonder Rob nu opdracht geven aan WestNet?",
        "Herkennen we de ouder-SMS als losstaande phishingcampagne?",
      ],
      hints: [
        "Let op teams die de ouder-SMS als bevestiging van 'het' incident behandelen.",
        "Kijk of iemand de 08:42 MSP-alert als startpunt van de meldplichtklok benoemt.",
      ],
      expectedDecisions: [
        "MSP formeel escaleren via piketnummer",
        "FS-01 netwerktechnisch isoleren",
        "Meldplichtklok gestart op 08:42",
      ],
      redFlags: [
        "Team wacht op 'meer feiten' zonder deadline",
        "Ouder-SMS wordt onterecht als deel van het incident behandeld",
        "Niemand neemt Rob's afwezigheid als mandaatprobleem",
      ],
      reviewPrompts: [
        "Op welk moment werd het duidelijk dat dit géén Magister-storing was?",
        "Wie nam feitelijk het besluit richting WestNet — en op basis van welk mandaat?",
        "Hoe zwaar woog de ouder-SMS in jullie beeldvorming, en klopte dat achteraf?",
      ],
    },
    // ══════════════════════════════════════════════════════════════
    // Ronde 2 — Dag 0 middag — Bevestiging + ransomnote
    // ══════════════════════════════════════════════════════════════
    {
      title: "R2 — Ransomnote in de finance-share",
      situation:
        "Voortbouwend op de netwerk-isolatie FS-01/02 en de WestNet-piketoproep van vanochtend is het beeld nu bevestigd. Maandag 13:40. WestNet-engineer Kevin heeft na een piketoproep om 11:15 remote ingelogd. Bevestigd: Play-ransomware. Ongeveer 68% van de shares op FS-01 en FS-02 is versleteld, waaronder cijferadministratie voor rapportvergadering deze week, allergiegegevens leerlingzorg, en financiële reconciliatie voor lesgeldincasso. Op de share /financien staat een tekstbestand HELLO_PLAY.txt: ransomeis €680.000 in Monero binnen 72 uur, anders publicatie op de leaksite. Rob is inmiddels bereikbaar maar zit in Faro zonder werk-laptop — de enige persoon met kennis van de Magister-koppelingsdatabase is dus niet ter plaatse. Er zijn signalen dat de aanvaller data heeft ge-exfiltreerd — WestNet ziet uitgaand verkeer van ~4 GB naar een onbekend IP in de nacht van zaterdag op zondag. Ouders beginnen te bellen omdat de website afwijkend traag doet.",
      timerMinutes: 15,
      openingPrompts: [
        "Kunnen we vandaag nog een geloofwaardig bericht naar ouders sturen — en zo ja, wat?",
        "Wat vertelt de aanwezigheid van leerlingdossiers in de exfil ons voor de AVG-melding?",
        "Welke leveranciers moeten wij zelf contractueel informeren, en binnen welke termijn?",
      ],
      facilitatorPerspective:
        "R2 is het moment waarop het team overschakelt van 'iets gaat mis' naar 'wij hebben een incident'. Dilemma's zijn: (1) Univé betrekken vóór onderhandeling — anders vervalt polisdekking, (2) Magister formeel op de hoogte stellen — 48u-clause is streng, (3) leerlingzorgdossiers zijn bijzondere persoonsgegevens (art. 9 AVG). Let op teams die willen betalen 'zodat de rapportvergadering doorgaat' — dat is de klassieke MKB-reflex die tot slecht besluit leidt.",
      injects: [
        {
          id: "r2-ransomnote",
          type: "intel", channel: "ransom_note", urgency: "critical",
          title: "HELLO_PLAY.txt — ransomnote op /financien",
          content:
            "HELLO. YOUR NETWORK IS ENCRYPTED BY PLAY. WE HAVE DOWNLOADED 41 GB OF DATA INCLUDING STUDENT RECORDS, MEDICAL/ALLERGY DATA, FINANCIAL RECONCILIATION AND STAFF PAYROLL. YOU HAVE 72 HOURS TO PAY 680.000 EUR IN MONERO. AFTER THAT WE PUBLISH ON OUR LEAKSITE AND AUCTION THE DATA. DO NOT INVOLVE POLICE — WE MONITOR. DO NOT ATTEMPT RESTORE — WE HAVE PERSISTENCE. Contact: qtox address below.",
          senderName: "Play (ransomware group)",
          timestamp: "13:22",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
          setsUpDecisionNodeId: "d2-r2-forensiek-comms",
          facilitatorNote: "Feit — de ransomnote maakt het incident onmiskenbaar. Zet de losgeld-vs-restore-vraag scherp neer.",
        },
        {
          id: "r2-westnet-technical",
          type: "technical", channel: "email", urgency: "high",
          title: "WestNet — Voorlopig technisch beeld",
          content:
            "Van: Kevin Bosch (senior engineer WestNet ICT). Onderwerp: voorlopige bevindingen ov-no.nl incident.\n\n" +
            "Beste bestuur, wij hebben remote toegang gekregen om 11:20 en om 13:15 een eerste beeld:\n\n" +
            "1. Encryptie: Play-ransomware, ~68% shares op FS-01 en FS-02 encrypted. .PLAY-extensie.\n" +
            "2. Initial access-vermoeden: onbeheerd RDP-endpoint van een oud-medewerker (vertrokken juli), account niet gedeactiveerd.\n" +
            "3. Exfiltratie: uitgaande verbinding zaterdagnacht 03:12–05:41, ~4.1 GB richting hoster in Duitsland (bekende Play-infrastructuur).\n" +
            "4. Persistence: wij zien nog geen tweede kanaal maar sluiten het niet uit — full sweep vereist voordat we schoon melden.\n\n" +
            "Wij adviseren: (a) alle domain-accounts een wachtwoord-reset, (b) FS-01/02 offline houden, (c) Eye Security IR-retainer activeren voor forensische lead. De MSP-SLA dekt geen incidentresponse op dit niveau — wij kunnen ondersteunen maar niet leiden.",
          senderName: "Kevin Bosch — WestNet ICT",
          source: "WestNet ICT B.V.",
          timestamp: "13:35",
          reliability: "fact",
          classification: "feit",
          nis2Relevant: true,
          targetTeam: "technical_it",
          setsUpDecisionNodeId: "d2-r2-forensiek-comms",
        },
        {
          id: "r2-magister-notify",
          type: "regulatory", channel: "email", urgency: "high",
          title: "Reminder: Magister-contract kent 48u breach-notification. De verzekeringspolis eist parallel activatie.",
          content:
            "Interne notitie van bestuurssecretaris aan bestuur. Onderwerp: Magister-contract art. 14.3 + Univé-clausule.\n\n" +
            "Artikel 14.3 van ons Magister-contract (versie 2022) verplicht ons om Iddink Group (moederbedrijf Magister) binnen 48 uur na ontdekking van een datalek te informeren dat mogelijk hun platform of hun data raakt. Wij hebben dit nog nooit ingeroepen. Detectietijd volgens ons: vandaag 08:42, dus 48u-klok verstrijkt woensdag 08:42. Aandachtspunt: als de exfil-data leerlinggegevens uit Magister bevat, is dit contractueel én richting hen relevant. Aanvullend: de verzekeringspolis heeft uitsluitingsclausules — als wij pas na 24u melden bij Univé, kan een deel van de dekking vervallen; die polis is nooit precies gelezen.",
          senderName: "Marijke Vlietstra — bestuurssecretaris",
          timestamp: "13:52",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
        },
        {
          id: "r2-teacher-panic",
          type: "internal", channel: "whatsapp", urgency: "medium",
          title: "Docentengroep op WhatsApp — paniek + roddel",
          content:
            "Screenshot doorgestuurd vanuit teamleider Zuid. In de docenten-WhatsAppgroep van locatie Zuid staan 43 berichten in het laatste uur: 'Ik hoor dat we gehackt zijn?', 'Betaalt de school losgeld?', 'Ik heb allergie-info van leerlingen in mijn map staan — is dat gelekt?', 'Moet ik ouders wat zeggen bij het uitgaan?'. Teamleider vraagt: kan de bestuurder om 15:00 een 5-minuten videobericht sturen zodat we vanmiddag met feiten kunnen sluiten in plaats van roddel?",
          senderName: "Teamleider Marc Dijkstra — locatie Zuid",
          timestamp: "14:01",
          reliability: "fact",
          classification: "aanname",
          targetTeam: "crisis_management",
        },
      ],
      meldingMoment: {
        id: "r2-msp-escalate",
        allowedRoles: ["ciso", "it_manager"],
        recipient: "msp",
        helper: "Technische escalatie: WestNet SLA dekt geen ransomware — beslis of we hen inzetten voor triage of Eye Security IR erbij halen.",
        types: [
          { id: "msp-formal-escalate", label: "WestNet formeel opschalen naar 24/7 stand-by (buiten SLA)", triggersInjectId: "r2-westnet-formal-response" },
        ],
      },
      roleActions: [
        {
          id: "r2-ceo-boardbrief",
          label: "Bestuur informeren + tijdelijk crisismandaat vastleggen",
          description: "Kort bericht aan bestuur en Raad van Toezicht. Vraag om schriftelijk crisismandaat voor 72 uur.",
          allowedRoles: ["ceo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-ciso-eye-security",
          label: "Eye Security IR-retainer activeren",
          description: "Bel +31 (0)88 6600 700 voor forensische lead. WestNet ondersteunt, Eye Security leidt.",
          allowedRoles: ["ciso"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-it-baseline",
          label: "Domein-brede wachtwoordreset + audit vertrokken accounts",
          description: "Activeer opgeslagen scripts. Prioriteit: het onbeheerde RDP-account.",
          allowedRoles: ["it_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-legal-ap-prep",
          label: "AP-melding en NCSC-early-warning voorbereiden",
          description: "AVG 72u klok: verstrijkt donderdag 08:42. NIS2 24u: dinsdag 08:42.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-legal-magister",
          label: "Iddink (Magister) formeel op de hoogte stellen",
          description: "Schriftelijke notificatie o.g.v. art. 14.3 contract. Feitelijk, geen speculatie.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-cfo-univé",
          label: "Univé formeel schade-melding + onderhandelaar aanvragen",
          description: "24u-klok verstrijkt dinsdag 08:42. Vraag een gedekte onderhandelaar aan.",
          allowedRoles: ["cfo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-comms-video",
          label: "Videobericht bestuurder voor teams om 15:00",
          description: "Feitelijke, korte boodschap. Wat weten we, wat weten we niet, wanneer volgende update.",
          allowedRoles: ["head_of_comms", "ceo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-hr-teachers",
          label: "Instructie aan docenten voor einde schooldag",
          description: "1-pagina script: wat wel/niet zeggen bij ouders bij het uitgaan.",
          allowedRoles: ["hr_lead"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-ops-workaround",
          label: "Noodrooster + papieren presentielijsten activeren",
          description: "Roosters printen bij de teamleiders, presentie op papier voor deze week.",
          allowedRoles: ["ops_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r2-pay-now",
          label: "Beslis nu: betaal losgeld zodat rapportvergadering doorgaat",
          description: "Autoriseer CFO om onderhandeling te starten, doel: cijfers terug voor donderdag.",
          allowedRoles: ["ceo"], irPlanAligned: false,
          qualityRank: "wrong",
          facilitatorCommentary: "Betalen zonder verzekeraar aan tafel = polisdekking waarschijnlijk weg. Bovendien geen enkele garantie op decryptie of niet-publicatie.",
          lessonLearned: "Losgeldbesluit is een proces, geen paniekreflex. Verzekeraar altijd eerst.",
        },
      ],
      discussionGoal:
        "Deze ronde toetst of het team parallelle sporen kan aansturen: IR technisch, meldingen juridisch, communicatie intern én extern, verzekeraar financieel — zonder dat één spoor het andere blokkeert. De zwaarste keuze zit bij de bestuurder: comms-eerst of forensiek-eerst. Nudge bij stilstand: verwijs naar de ransomnote en de 48u-klok richting Iddink. Nudge bij haast: check of de MSP-SLA op tafel ligt voordat er tot betalen wordt besloten.",
      keyQuestions: [
        "Wat is het besluitmoment op losgeld — nu, morgen, of na herstel-inschatting?",
        "Halen we de 24u NIS2-melding richting NCSC?",
        "Wie belt Iddink en wat zeggen we exact?",
      ],
      hints: [
        "Let op teams die videobericht uitstellen 'omdat we nog niets weten' — dat is precies waarom het bericht nu moet.",
        "Kijk of iemand de Univé-clausule als échte harde deadline behandelt of als 'kunnen we later doen'.",
      ],
      expectedDecisions: [
        "Eye Security IR geactiveerd",
        "AP-melding en NCSC 24u-melding in voorbereiding",
        "Univé geïnformeerd binnen 24u",
        "Videobericht aan teams",
      ],
      redFlags: [
        "Betaalbesluit in R2 zonder proces",
        "Univé-melding uitgesteld naar dinsdagmorgen",
        "Docenten worden opgezadeld met vragen zonder script",
      ],
      reviewPrompts: [
        "Welke van de drie klokken (NIS2 24u, AVG 72u, Univé 24u) heeft jullie besluitvorming daadwerkelijk gestuurd?",
        "Hoe zwaar woog het argument 'rapportvergadering moet door' in jullie afweging?",
        "Waar hakte een besluit van één rol een deur dicht voor een andere rol?",
      ],
    },
    // ══════════════════════════════════════════════════════════════
    // Ronde 3 — Dag 1 — Regulatoire klok + pers
    // ══════════════════════════════════════════════════════════════
    {
      title: "R3 — Regelklok tikt en de pers belt",
      situation:
        "Voortbouwend op de AP-melding indienen als voorlopig van gisteren en de bestuurder belt-terug naar teams: Dinsdag 10:30 — 26 uur na detectie. NIS2 early-warning had gisteren 08:42 al ingediend moeten zijn; als jullie dat gemist hebben is dat een formeel gebrek. AVG art. 33-klok verstrijkt donderdag 08:42. RTV Oost belt: journalist Sanne Bruijns wil vandaag om 14:00 op locatie een gesprek — 'we hebben van meerdere ouders begrepen dat er iets gaande is'. Magister-contract 48u-klok: nog 22 uur. Ouders posten in Facebook-groepen dat 'de school is gehackt'. Een oudervereniging-voorzitter mailt of hij vanmiddag geïnformeerd kan worden. Restore-test op eerste backup-set draait — Rob heeft vanuit Faro het commando gegeven via WestNet.",
      timerMinutes: 15,
      openingPrompts: [
        "Als we de NIS2 24u-melding hebben gemist, hoe verantwoorden we dat richting NCSC?",
        "Praten we met RTV Oost of niet — en wie?",
        "Wat vertellen we ouders vanmiddag, en via welk kanaal?",
      ],
      facilitatorPerspective:
        "R3 is de uitverstuur-ronde. Meldingen moeten weg, communicatie moet consistent zijn over kanalen heen. Herkenbaar dilemma: transparantie versus nog-niet-alles-weten. Let op teams die bij RTV Oost de reflex 'geen commentaar' geven — dat is bijna altijd erger dan een strakke feitelijke reactie. Let ook op teams die naar Eye Security-forensiek verwijzen zonder dat de retainer geactiveerd is (capability-check).",
      injects: [
        {
          id: "r3-rtv-oost",
          type: "media", channel: "phone", urgency: "high",
          title: "RTV Oost belt — journalist wil bevestiging",
          content:
            "Van: telefonistes bestuurskantoor. Sanne Bruijns (RTV Oost regionale redactie) heeft twee keer gebeld tussen 10:05 en 10:22. Boodschap: 'Wij hebben van drie oudergezinnen begrepen dat er sinds maandag iets speelt bij Onderwijsvereniging Noord-Oost — Magister werkt niet, roosters onduidelijk, er gaat een gerucht rond over ransomware. Wij willen vandaag om 14:00 op locatie iemand van het bestuur spreken. Als jullie niet reageren gaan wij toch uitzenden met wat wij van ouders hebben. Deadline voor commentaar: 13:30.'",
          senderName: "Frontoffice bestuurskantoor",
          source: "RTV Oost — regionale redactie",
          timestamp: "10:24",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
          setsUpDecisionNodeId: "d3-r3-comms-meldingen",
          facilitatorNote: "Feit — RTV Oost forceert een comms-besluit met deadline. Test of team 'geen commentaar' vermijdt.",
        },
        {
          id: "r3-parent-facebook",
          type: "social", channel: "raw", urgency: "medium",
          title: "Screenshots uit ouders-Facebookgroep",
          content:
            "Doorgezonden door woordvoerder: screenshots uit 'Ouders VO Noord-Oost' Facebookgroep (2.100 leden). Meerdere posts sinds gisteravond: 'Weet iemand of het waar is dat de school gehackt is?' — 'Mijn dochter kon geen huiswerk uploaden' — 'Ik hoor iets over medische gegevens, wat is dit?' — 'Zit er ransomware op onze allergie-info??' Sommigen taggen wethouder Onderwijs. Twee ouders reageren met 'ik heb net een rare SMS gehad, hangt dat samen?'.",
          senderName: "Woordvoerder — monitoring",
          timestamp: "10:33",
          reliability: "assumption",
          classification: "aanname",
          targetTeam: "crisis_management",
        },
        {
          id: "r3-ap-guidance",
          type: "regulatory", channel: "email", urgency: "high",
          title: "AP-portaal — Ontvangstbevestiging + aanvullende vragen (AVG art. 33)",
          content:
            "Autoriteit Persoonsgegevens — Meldpunt Datalekken. Uw voorlopige melding met casuskenmerk AP-2024-11-04-XXXXX is in behandeling genomen. Aanvullende vragen om de melding te completeren binnen 72 uur na eerste indicatie:\n\n" +
            "1. Aantal betrokkenen (leerlingen, ouders, medewerkers) — gespecificeerd.\n" +
            "2. Type persoonsgegevens (art. 9 bijzondere gegevens? bsn?).\n" +
            "3. Mitigerende maatregelen genomen tot dusver.\n" +
            "4. Communicatiestrategie richting betrokkenen (art. 34 AVG).\n\n" +
            "Verzuim tot volledige melding kan leiden tot handhavingstraject onder AVG.",
          senderName: "Autoriteit Persoonsgegevens",
          timestamp: "10:41",
          reliability: "fact",
          classification: "feit",
          nis2Relevant: true,
          targetTeam: "crisis_management",
          setsUpDecisionNodeId: "d3-r3-comms-meldingen",
        },
        {
          id: "r3-eye-security-tussenrapport",
          type: "technical", channel: "email", urgency: "high",
          title: "Eye Security IR — Tussenrapport dag 1",
          content:
            "Van: Marc de Vries (Eye Security IR-lead). Aan: bestuur ov-no.nl.\n\n" +
            "Omdat jullie ons gisteren in ronde 2 hebben geactiveerd, kunnen wij nu iets delen wat teams zonder retainer op dit moment NIET hebben:\n\n" +
            "1) EXFIL-METHODE bevestigd: rclone → hoster in Duitsland (bekend Play-affiliate infra). Wij hebben via takedown-verzoek al twee C2-endpoints bevroren.\n" +
            "2) SCOPE: geen tweede aanvaller, geen slapende persistence buiten FS-01/02. Domain controller is schoon — herstel kan bouwen op bestaande baseline.\n" +
            "3) DATA: van de 41 GB exfil is ~2.3 GB persoonsgegevens (leerlingdossiers), ~180 MB medische/allergie-notities (art. 9 AVG bijzonder), ~90 MB salaris. Deze uitsplitsing kunnen jullie 1-op-1 in de AP-melding gebruiken.\n" +
            "4) ATTRIBUTIE: Play-affiliate 'Balloonfly' — wij volgen deze actor sinds januari, geen bekende decryptie-verrader. Betalen geeft geen garantie op ook maar iets.\n" +
            "5) FORENSISCH BEWIJS: memory-dumps FS-01/02 gehashed en offsite. Bruikbaar voor politie én verzekeraar.\n\n" +
            "Hang dit rapport aan de AP-completering en aan de Univé-claim.",
          senderName: "Marc de Vries — Eye Security IR",
          source: "Eye Security",
          timestamp: "11:15",
          reliability: "fact",
          classification: "feit",
          deliverySeconds: 300,
          requiresCapability: RETAINER_ACTIVATED_FLAG,
          targetTeam: "crisis_management",
          facilitatorNote: "Feit — alleen zichtbaar als het team in R2 de retainer heeft geactiveerd. Cross-round capability-check.",
        },
      ],
      meldingMoment: {
        id: "r3-insurer-claim",
        allowedRoles: ["cfo", "ceo"],
        recipient: "insurer",
        helper: "Univé-polis vereist formele activatie voordat kosten (onderhandelaar, forensiek, comms-consultant) worden gedekt.",
        types: [
          { id: "univé-claim-formal", label: "Formele schade-activatie Univé Zakelijk indienen", triggersInjectId: "r3-univé-followup" },
        ],
      },
      roleActions: [
        {
          id: "r3-ceo-rtv-call",
          label: "Bestuurder belt zelf terug naar RTV Oost — feiten, kort",
          description: "10-minuten telefonisch: wat weten we, wat weten we niet, wanneer volgende update. Geen bevestiging losgeld-onderhandeling.",
          allowedRoles: ["ceo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-ceo-parents-brief",
          label: "Ouders-mail via Magister-berichten + website vóór 15:00",
          description: "Alle 4000 gezinnen. Feitelijk, geen speculatie, geen jargon. Meldpunt-mailadres erbij.",
          allowedRoles: ["ceo", "head_of_comms"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-ciso-restore-oversight",
          label: "Toezicht op restore-test — resultaat vóór 16:00",
          description: "Werkt de eerste cold-restore of niet? Dit bepaalt het pad in R4.",
          allowedRoles: ["ciso"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-it-restore-execute",
          label: "Restore-test op tweede backup-set starten (fallback)",
          description: "Als eerste faalt, moeten we direct doorgaan met tweede set — geen tijd voor pauze.",
          allowedRoles: ["it_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-legal-ap-complete",
          label: "AP-melding compleet maken vóór donderdag 08:42",
          description: "Aantallen, art. 9-status, mitigatie, art. 34-strategie richting betrokkenen.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-legal-ncsc-late",
          label: "NCSC-melding indienen ondanks verstreken 24u",
          description: "Meld te laat is minder erg dan niet melden. Voeg feitelijke uitleg toe waarom de melding te laat is.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-cfo-onderhandelaar",
          label: "Univé-onderhandelaar aan tafel zetten",
          description: "Voor onderhandelaar praat aanvaller nog niet met ons. Onderhandelaar bepaalt kanaal en tempo.",
          allowedRoles: ["cfo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-comms-oudervereniging",
          label: "Voorzitter oudervereniging vandaag persoonlijk informeren",
          description: "45 minuten videocall of op locatie. Neem oudervereniging mee in beeld — zij worden anders jouw hardste criticus.",
          allowedRoles: ["head_of_comms"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-hr-teacher-support",
          label: "Coaching-lijn voor docenten open (mentorleerlingen ongerust)",
          description: "Docenten krijgen vragen van hun mentorklas. Snel intern Q&A-document.",
          allowedRoles: ["hr_lead"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-ops-noodrooster",
          label: "Noodrooster tot vrijdag doortrekken",
          description: "Uitgaan van 5 werkdagen zonder Magister. Toetsweek in week 46 opnieuw plannen.",
          allowedRoles: ["ops_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r3-comms-no-comment",
          label: "RTV Oost 'geen commentaar' geven",
          description: "Weiger commentaar in afwachting van meer feiten.",
          allowedRoles: ["ceo", "head_of_comms"], irPlanAligned: false,
          qualityRank: "wrong",
          facilitatorCommentary: "'Geen commentaar' laat de pers de invulling doen. Feitelijke, korte reactie is bijna altijd beter dan zwijgen.",
          lessonLearned: "Communicatie-regie behoud je alleen door te communiceren.",
        },
      ],
      discussionGoal:
        "Deze ronde toetst of interne, externe, ouder- en regulatoire communicatie inhoudelijk consistent blijft, en of de meldingen ook feitelijk de deur uit gaan. De zwaarste keuze zit bij de bestuurder en het hoofd communicatie: bel je RTV Oost zelf, of laat je een woordvoerder gaan? Nudge bij stilstand: verwijs naar de 13:30-deadline van RTV Oost. Nudge bij haast: check of het team niet in 'geen commentaar' schiet.",
      keyQuestions: [
        "AP-completering: gaan alle vier vragen beantwoord vóór donderdag 08:42?",
        "Als NIS2 24u is gemist — hoe verwoorden we dat richting NCSC?",
        "Wie neemt de RTV Oost-call en met welk mandaat?",
      ],
      hints: [
        "Let op teams die de ouders-mail steeds uitstellen 'omdat we niet volledig zijn'.",
        "Kijk of Eye Security-tussenrapport de AP-melding daadwerkelijk verrijkt.",
      ],
      expectedDecisions: [
        "RTV Oost-reactie voor 13:30",
        "Ouders-mail voor 15:00",
        "AP-completering onderhanden",
        "Univé formeel geactiveerd",
      ],
      redFlags: [
        "'Geen commentaar' richting pers",
        "AP-aanvullende vragen niet toebedeeld",
        "Ouderverenigingvoorzitter genegeerd",
      ],
      reviewPrompts: [
        "Hoe zichtbaar was jullie regie voor de buitenwereld op dit moment?",
        "Waar botste transparantie (VER) met juridische voorzichtigheid (JUR)?",
        "Welk deel van jullie communicatie was reactief en welk proactief?",
      ],
    },
    // ══════════════════════════════════════════════════════════════
    // Ronde 4 — Dag 2 — Betalen, onderhandelen, of weigeren
    // ══════════════════════════════════════════════════════════════
    {
      title: "R4 — Betalen, onderhandelen of weigeren",
      situation:
        "Terugblik op dinsdag: de AP-completering is verzonden, de bestuurder heeft persoonlijk RTV Oost teruggebeld. Woensdag 09:00 — 48 uur na detectie. Ransom-deadline nog 24 uur. Univé-onderhandelaar meldt: aanvaller staat op €680k, realistisch haalbaar €340k met bewijs van deletion. Bij herstelfase blijkt de restore-test op de eerste cold-backup te FALEN — Wasabi-object corrupt sinds september (niet gemerkt). Tweede backup-set draait nu; verwachte uitkomst 15:30. Univé vraagt schriftelijke incident-scope voordat zij eventuele betaling autoriseren; zonder scope geen dekking, en de verzekeringspolis heeft uitzonderingsclausules die zich nu concreet manifesteren. Bestuur en Raad van Toezicht willen om 14:00 een videocall. RTV Oost heeft gisteravond uitgezonden — feitelijk maar streng ('kwetsbare gegevens van 4000 leerlingen mogelijk op straat'). Een parent posted op Facebook dat hij AP-klacht gaat indienen — hij heeft dat inmiddels ook daadwerkelijk gedaan.",
      timerMinutes: 15,
      openingPrompts: [
        "Op basis waarvan hakken wij de knoop door op wel/niet betalen?",
        "Wat betekent een gefaalde restore-test voor onze BC-inschatting richting bestuur?",
        "Wie hoort welke uitleg te krijgen op de 14:00 videocall?",
      ],
      facilitatorPerspective:
        "R4 is de zwaarste ronde. Dilemma is echt: elke keuze heeft een serieuze downside. Niet-betalen + solide herstel = beste maar vereist dat restore-set 2 wél werkt. Betalen = 30% recidive-kans, VER-schade blijft. Uitstellen = tijd kopen zolang je die tijd gebruikt. Let op teams die het besluit op onderbuik nemen ('we zijn een school, wij betalen niet') zonder BC-analyse — die uitkomst is misschien correct maar de weg erheen is fout.",
      injects: [
        {
          id: "r4-restore-fail",
          type: "technical", channel: "email", urgency: "critical",
          title: "IT — Eerste cold-restore FAALT (bij herstelfase blijkt back-up-restoretest jaren geleden voor het laatst uitgevoerd)",
          content:
            "Van: Kevin Bosch (WestNet) + Rob de Vries (extern via WhatsApp-call).\n\n" +
            "Restore-poging eerste backup-set (Wasabi cold, incrementeel sept–okt) gefaald. Manifest wijst naar object-hash mismatch op negen kernbestanden waaronder de Magister-koppelingsdatabase. Waarschijnlijke oorzaak: silent corruption sinds mid-september bij een failed rotation die niet gealarmeerd is. Bij herstelfase blijkt de back-up-restoretest jaren geleden voor het laatst volledig gedraaid — een documented weakness in ons IR-plan. Tweede backup-set (Veeam maandelijkse full, oktober) draait nu terug op een schone VM. ETA volledige restore-test: 15:30 vandaag. Als deze ook faalt zitten wij op backup uit september — 6 weken werk kwijt, incl. cijfers Q1.\n\n" +
            "Belangrijk: dit maakt de losgeldkeuze zwaarder. Betalen levert theoretische decryptor, maar volledige integriteit ná decryptie is niet gegarandeerd — Play staat bekend om onvolledige tools.",
          senderName: "Kevin Bosch — WestNet ICT",
          timestamp: "09:12",
          reliability: "fact",
          classification: "feit",
          targetTeam: "technical_it",
          setsUpDecisionNodeId: "d4-r4-losgeld",
          facilitatorNote: "Feit — de gefaalde restore verzwaart het losgeld-besluit. Zonder deze inject is het besluit theoretisch, met deze inject moet het team écht kiezen.",
        },
        {
          id: "r4-univé-scope",
          type: "executive", channel: "email", urgency: "high",
          title: "Univé Zakelijk — Vereiste incident-scope",
          content:
            "Van: Diana Rademakers (schadebehandelaar cyber, Univé Zakelijk).\n\n" +
            "Naar aanleiding van uw activatie: onze polis dekt onderhandelaar, forensiek en (potentieel) losgeld tot polislimit €500.000. Voordat wij een eventuele losgeldbetaling autoriseren hebben wij nodig:\n\n" +
            "(a) schriftelijke incident-scope door forensisch onderzoeker (Eye Security IR-rapport voldoet),\n" +
            "(b) bevestiging dat er geen alternatief herstelpad haalbaar is binnen 5 werkdagen,\n" +
            "(c) verklaring dat u geen contact heeft gehad met de aanvaller zonder onze onderhandelaar,\n" +
            "(d) juridische bevestiging dat betaling niet in strijd is met sanctielijsten (OFAC/EU).\n\n" +
            "Zonder deze vier documenten kunnen wij een betaling niet dekken — u kunt uiteraard buiten polis om betalen maar dan valt de rest van uw claim mogelijk ook.",
          senderName: "Diana Rademakers — Univé Zakelijk",
          timestamp: "09:34",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
          setsUpDecisionNodeId: "d4-r4-losgeld",
        },
        {
          id: "r4-parent-ap-complaint",
          type: "regulatory", channel: "email", urgency: "medium",
          title: "AP — ontvangst klacht van betrokkene",
          content:
            "Autoriteit Persoonsgegevens meldt: ontvangst klacht van een betrokkene onder klachtnummer AP-K-2024-XXXXX. De klager stelt dat hij niet tijdig en niet volledig is geïnformeerd over de aard van de betrokken gegevens van zijn kind. Onze eerdere melding en de klacht worden aan elkaar gekoppeld. Dit heeft geen zelfstandige rechtsgevolgen maar wordt meegewogen bij het handhavingstraject. U wordt verzocht binnen 10 werkdagen te reageren.",
          senderName: "Autoriteit Persoonsgegevens",
          timestamp: "10:02",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
        },
      ],
      roleActions: [
        {
          id: "r4-ceo-rvt-brief",
          label: "Voorstel aan Raad van Toezicht — drie scenario's incl. cost",
          description: "Betalen / niet-betalen / uitstel. Elke variant met BC, VER, JUR en KOS-impact expliciet.",
          allowedRoles: ["ceo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-ciso-scope-doc",
          label: "Forensisch scope-document voor Univé opleveren",
          description: "Voorwaarde (a) uit Univé-mail. Zonder dit geen enkele polis-dekking mogelijk.",
          allowedRoles: ["ciso"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-it-restore-monitor",
          label: "Restore-test tweede backup-set live monitoren",
          description: "Als deze om 15:30 werkt, verandert de BC-context volledig.",
          allowedRoles: ["it_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-legal-sanctions",
          label: "Sancties-check betaling (OFAC/EU)",
          description: "Voorwaarde (d) uit Univé-mail. Play-affiliate Balloonfly niet gesanctioneerd, maar bevestig schriftelijk.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-legal-parent-response",
          label: "Reactie op AP-klacht binnen 10 werkdagen voorbereiden",
          description: "Feitelijk, met tijdlijn en mitigaties. Geen defensieve toon.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-cfo-limit-analysis",
          label: "Analyse polislimit vs. onderhandeld bedrag",
          description: "Polislimit €500k, onderhandeld €340k, headroom voor forensiek en comms €160k?",
          allowedRoles: ["cfo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-comms-scenario-a",
          label: "Twee comms-versies klaarzetten (wel/niet betaald)",
          description: "Elke versie 1 pagina intern + 1 pagina extern. Klaar om te draaien na besluit.",
          allowedRoles: ["head_of_comms"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-hr-wellbeing",
          label: "Welzijnscheck crisisteam + docenten",
          description: "Dag 2 = uitputting begint. Vervangers organiseren voor de sleutelrollen.",
          allowedRoles: ["hr_lead"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-ops-week47-planning",
          label: "Vervolgplanning tot einde week — met en zonder cijfers",
          description: "Rapportvergadering donderdag: doorschuiven naar volgende week met formeel besluit van bestuur.",
          allowedRoles: ["ops_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r4-pay-fast",
          label: "Betaal buiten polis om — 'we willen dit klaar hebben'",
          description: "Autoriseer directe betaling buiten Univé; snelheid boven dekking.",
          allowedRoles: ["ceo", "cfo"], irPlanAligned: false,
          qualityRank: "wrong",
          facilitatorCommentary: "Buiten polis om betalen zonder scope-check kost twee keer: geen dekking én geen zekerheid op decryptie of niet-publicatie.",
          lessonLearned: "Onder druk versneld betalen is de klassieke misgreep bij MKB+ ransomware.",
        },
      ],
      discussionGoal:
        "Deze ronde toetst besluitvormingsproces onder échte ambiguïteit: elk pad heeft een serieuze downside. De gefaalde restore verzwaart de losgeld-vraag; Univé bindt met vier voorwaarden. De zwaarste keuze zit bij de bestuurder en de financieel verantwoordelijke. Nudge bij stilstand: verwijs naar de €340k-onderhandelde-som en de tweede restore-set die om 15:30 landt. Nudge bij haast: check of het besluit expliciete criteria heeft in plaats van onderbuik.",
      keyQuestions: [
        "Wat is jullie beslissingscriterium — is het BC, is het reputatie, is het budget?",
        "Welke uitkomst laat zich naar ouders én RvT verantwoorden?",
        "Als restore 2 om 15:30 faalt, wat verandert er dan aan het besluit?",
      ],
      hints: [
        "Let op wie criteria expliciet maakt vs. wie op onderbuik beslist.",
        "Kijk hoe de Univé-clausules feitelijk hun ruimte inperken.",
      ],
      expectedDecisions: [
        "RvT-voorstel met drie scenario's",
        "Univé-scopedocument opgeleverd",
        "Sanctie-check afgerond",
      ],
      redFlags: [
        "Betaalbesluit zonder Univé aan tafel",
        "Restore-test niet actief gemonitord",
        "AP-klacht defensief afgehandeld",
      ],
      reviewPrompts: [
        "Welke tegenstelling tussen twee uitkomstassen woog het zwaarst — CONT vs BC, of KOS vs VER?",
        "Waar heeft de gefaalde restore jullie perceptie van 'goede besluit' geraakt?",
        "Wie was uiteindelijk beslisser en op basis van welk mandaat?",
      ],
    },
    // ══════════════════════════════════════════════════════════════
    // Ronde 5 — Dag 3 — Herstel loopt, complicaties komen
    // ══════════════════════════════════════════════════════════════
    {
      title: "R5 — Herstel loopt en de keten komt terug",
      situation:
        "Voortbouwend op het besluit niet betalen en de onderhandelaar 24u laten rekken: Donderdag 09:00 — 72 uur na detectie. Restore-set 2 werkt gedeeltelijk: alle roosters en zorgdossiers terug (peildatum vorige week), cijfers Q1 gedeeltelijk terug. Bij herstelfase blijkt de tweede backup-set beter dan de eerste, maar niet foutloos — de restore-drill was voor het incident jaren niet volledig uitgevoerd. Magister heeft een alternatieve tenant beschikbaar gesteld — technisch klaar, maar docenten moeten hun cijfers handmatig opnieuw invoeren. LoonBureau Oost belt: zij hebben ontdekt dat een gedeeld service-account tussen hen en ons systeem in de exfil zit — hun eigen systemen zijn mogelijk ook gecompromitteerd via die weg. Vakbond AOb heeft een statement uitgegeven ('scholen worden systemisch te licht beveiligd') en noemt Onderwijsvereniging Noord-Oost als voorbeeld. Ouders vragen: 'kunnen mijn kinderen morgen wel of niet naar school?'",
      timerMinutes: 15,
      openingPrompts: [
        "Wat betekent de LoonBureau-melding voor onze scope- en communicatie-afhandeling?",
        "Hoe krijgen wij docenten meebewegen op cijfer-herinvoer?",
        "Wat vertellen we ouders vandaag over school-morgen?",
      ],
      facilitatorPerspective:
        "R5 test uithoudingsvermogen en ketendenken. LoonBureau is de klassieke supply-chain-verrassing: jullie zijn nu ook downstream-risico voor iemand anders. Vakbondstatement dwingt reputatie-management. Let op teams die 'we zijn bijna klaar' voelen — dit is precies waar zwakke afhandeling gebeurt.",
      injects: [
        {
          id: "r5-loonbureau",
          type: "executive", channel: "phone", urgency: "high",
          title: "LoonBureau Oost belt — mogelijk secundair incident",
          content:
            "Van: telefonistes bestuurskantoor. Peter van Ravenzwaaij, hoofd security LoonBureau Oost, heeft om 08:47 gebeld. Hij vraagt om terugbelverzoek voor de CFO. Kernboodschap: 'wij zien in ons SIEM sinds dinsdag inlogpogingen vanuit dezelfde infrastructuur die volgens jullie forensische partner (Eye Security) bij het incident betrokken is. Wij vermoeden dat via een gedeeld service-account voor batch-verwerking ook onze omgeving getoetst is. Wij moeten dit vandaag afstemmen — is dit een gezamenlijk incident voor de meldplicht?'",
          senderName: "Peter van Ravenzwaaij — LoonBureau Oost",
          source: "LoonBureau Oost B.V.",
          timestamp: "08:52",
          reliability: "fact",
          classification: "aanname",
          targetTeam: "crisis_management",
          setsUpDecisionNodeId: "d5-r5-ketenverbreding",
          facilitatorNote: "Aanname — LoonBureau vermoedt eigen compromise. Zet de ketenverbredings-vraag scherp neer.",
        },
        {
          id: "r5-aob-statement",
          type: "media", channel: "news", urgency: "medium",
          title: "AOb-statement noemt Onderwijsvereniging Noord-Oost",
          content:
            "Persbericht Algemene Onderwijsbond, 08:30. 'AOb constateert dat de digitale beveiliging in het funderend onderwijs structureel achterloopt. Het incident deze week bij Onderwijsvereniging Noord-Oost — waarbij mogelijk gevoelige gegevens van 4000 leerlingen op straat kwamen — is illustratief. Wij pleiten voor een verplicht cyber-basisniveau in de sector-cao en verhoogde OCW-budgetten voor MBK+ schoolbesturen. Individuele scholen kunnen dit niet alleen dragen.' AOb-woordvoerder is vandaag beschikbaar voor media.",
          senderName: "AOb (Algemene Onderwijsbond)",
          source: "persbericht",
          timestamp: "08:30",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
        },
        {
          id: "r5-teacher-refuse",
          type: "internal", channel: "email", urgency: "medium",
          title: "PMR vraagt of cijfer-herinvoer overuren zijn",
          content:
            "Van: voorzitter PMR (personeelsgeleding medezeggenschapsraad).\n\n" +
            "Beste bestuur, docenten wordt gevraagd om cijfers die zij eerder al hadden ingevoerd nu opnieuw in te voeren via de nieuwe Magister-tenant. Dat kost per docent naar schatting 4–6 uur bovenop de normale werkdruk. Onze vraag: (1) wordt dit als overuren geregistreerd, (2) is er compensatie in vrije uren of geld, (3) kunnen wij hierover met bestuur vanmiddag om 15:00 spreken? PMR wil de bestuurlijke lijn helder hebben vóór docenten aan het weekend beginnen.",
          senderName: "Marc Timmermans — PMR-voorzitter",
          timestamp: "09:14",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
          facilitatorNote: "Feit — PMR-verzoek dwingt HR-rol tot concrete compensatie. Test hoe snel goodwill wordt geactiveerd.",
        },
      ],
      roleActions: [
        {
          id: "r5-ceo-loonbureau-call",
          label: "Bestuurder belt LoonBureau — gezamenlijk incident-plan",
          description: "Vandaag afspraak: één woordvoering, gedeelde AP-melding update, wederzijdse forensische input.",
          allowedRoles: ["ceo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-ciso-scope-extend",
          label: "Scope-verbreding forensiek naar service-account exfil",
          description: "Eye Security opdracht geven om ook de LoonBureau-lateral pathway te reconstrueren.",
          allowedRoles: ["ciso"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-it-tenant-migration",
          label: "Magister nieuwe tenant volledig operationeel maken",
          description: "Toegang docenten, koppelingen, testleerling erin — voor vrijdag klaar.",
          allowedRoles: ["it_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-legal-joint-notification",
          label: "AP-melding aanvullen met LoonBureau als medebetrokken partij",
          description: "Feitelijk melden dat scope breder is dan gedacht. Beter aanvullen dan achteraf betrapt worden. Werkt beter als bestuurders al ketenafspraak hebben.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-cfo-loonbureau-contract",
          label: "Contract met LoonBureau juridisch scannen op aansprakelijkheid",
          description: "Wie draagt welke kosten? Voorkom conflict later.",
          allowedRoles: ["cfo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-comms-aob-response",
          label: "Feitelijke reactie op AOb-statement uitgeven",
          description: "Niet defensief. Erken tekortkoming waar terecht, feit boven emotie waar onterecht.",
          allowedRoles: ["head_of_comms"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-hr-pmr-meeting",
          label: "PMR om 15:00 spreken + concreet compensatievoorstel",
          description: "Overuren erkend, keuze tussen vrije uren of eenmalige toelage. Snelle helderheid.",
          allowedRoles: ["hr_lead"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-ops-parent-clarity",
          label: "Ouders duidelijkheid vrijdag/weekend/volgende week",
          description: "Wat verwacht ouder — les op maandag ja/nee, cijfers voor rapport, contactadres bij vragen.",
          allowedRoles: ["ops_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r5-legal-ap-silence",
          label: "AP niet inlichten over LoonBureau — hoop dat het niet uitkomt",
          description: "Melding beperkt houden tot ons eigen incident.",
          allowedRoles: ["legal"], irPlanAligned: false,
          qualityRank: "wrong",
          facilitatorCommentary: "Zwijgen over een verbreding wordt onder handhaving altijd zwaarder gestraft dan aanvullend melden.",
          lessonLearned: "Meldplicht is niet klaar bij eerste indiening — verbredingen aanvullen is verplicht.",
        },
      ],
      discussionGoal:
        "Deze ronde toetst ketendenken en het vermogen om onder aanhoudende druk vaste routines vast te houden zonder in 'we zijn er bijna' te vervallen. De zwaarste keuze zit bij de bestuurder rond LoonBureau en bij de personele lijn rond de PMR. Nudge bij stilstand: verwijs naar het verzoek van de PMR van vanmiddag en het AOb-statement. Nudge bij haast: check of iemand LoonBureau als 'niet ons probleem' afschuift — dat is precies de val.",
      keyQuestions: [
        "Hoe verweven we onze AP-melding met LoonBureau zonder conflict?",
        "Kan PMR-gesprek de docentmedewerking daadwerkelijk versterken?",
        "Wat is onze weerwoord op AOb — erkennen, weerleggen, of allebei?",
      ],
      hints: [
        "Let op teams die LoonBureau als 'niet ons probleem' behandelen — het is precies wél ons probleem.",
        "Kijk hoe kort of lang het duurt voor iemand voor cijferherinvoer aandacht geeft.",
      ],
      expectedDecisions: [
        "Gezamenlijk crisis-communicatie-plan met LoonBureau",
        "AP-melding aanvullen",
        "PMR-compensatievoorstel",
      ],
      redFlags: [
        "LoonBureau afgehandeld op operationeel niveau",
        "AOb-statement genegeerd of defensief beantwoord",
        "Docenten geen concreet aanbod voor herinvoer",
      ],
      reviewPrompts: [
        "Welk deel van de crisis is nu 'operationeel doorlopend' en welk deel is echt af?",
        "Hoe hebben jullie de balans tussen eigenaarschap en samenwerking met LoonBureau gevoerd?",
        "Wat zegt de vakbondsreactie over jullie externe positie — nu en over drie maanden?",
      ],
    },
    // ══════════════════════════════════════════════════════════════
    // Ronde 6 — Dag 5 — Verantwoording en verankering
    // ══════════════════════════════════════════════════════════════
    {
      title: "R6 — Verantwoording aan AP, RvT en verzekeraar",
      situation:
        "Maandag 11 november, 10:00 — vijf dagen na detectie. Herstel voor 91% voltooid; laatste 9% (cijfers laatste twee weken oktober) definitief kwijt en handmatig gereconstrueerd. AP verzoekt schriftelijke follow-up onder art. 33 en heeft aangegeven dat een vervolg-inspectie op art. 32 (technische en organisatorische maatregelen) waarschijnlijk is. NIS2 30-dagen final report opent nu, moet uiterlijk 5 december binnen. Raad van Toezicht komt woensdag bij elkaar en wil een schriftelijk incident-post-mortem. Univé wil final claim binnen 3 weken met alle documentatie. Voorzitter oudervereniging vraagt om betrokkenheid bij het verbeterplan. Pers is verstomd — het weekend heeft de aandacht verplaatst.",
      timerMinutes: 15,
      openingPrompts: [
        "Wat verandert er maandag over twee weken in onze IT-organisatie?",
        "Welke drie MKB+-lessen willen we hardmaken in het IR-plan?",
        "Hoe garanderen we dat AP-vervolg-inspectie niet nog een crisis wordt?",
      ],
      facilitatorPerspective:
        "R6 is de embedding-ronde. Het risico is niet meer 'de aanvaller' — het is 'terug naar routine zonder verandering'. Let op teams die willen dat de crisis-modus stopt zonder dat concrete governance-besluiten schriftelijk vastliggen. De volgende crisis is dezelfde crisis als je hier zwak afsluit.",
      injects: [
        {
          id: "r6-ap-follow-up",
          type: "regulatory", channel: "email", urgency: "high",
          title: "AP — Schriftelijke follow-up + aankondiging art. 32-inspectie (AVG-handhaving)",
          content:
            "Autoriteit Persoonsgegevens.\n\n" +
            "Onder verwijzing naar uw meldingen (initieel, aangevuld) en de door ons ontvangen klacht, verzoeken wij binnen 30 werkdagen een schriftelijke follow-up onder AVG art. 33. Op basis van de omvang (>4000 betrokkenen, art. 9-gegevens) en de ontvangen klacht bereidt de AP een vervolg-inspectie voor onder art. 32 (technische en organisatorische maatregelen). Wij zullen uiterlijk in het eerste kwartaal 2025 contact opnemen voor bezoekafspraken en documentenverzoek. Wij wijzen u nu al op de mogelijkheid van een bestuurlijke boete indien wij ernstige tekortkomingen vaststellen.",
          senderName: "Autoriteit Persoonsgegevens — afdeling handhaving",
          timestamp: "09:15",
          reliability: "fact",
          classification: "feit",
          nis2Relevant: true,
          targetTeam: "crisis_management",
          setsUpDecisionNodeId: "d6-r6-verankering",
        },
        {
          id: "r6-rvt-agenda",
          type: "executive", channel: "email", urgency: "medium",
          title: "RvT vraagt post-mortem + governance-agenda",
          content:
            "Van: voorzitter Raad van Toezicht.\n\n" +
            "Beste bestuur, voor de RvT-vergadering woensdag 13 november graag: (1) schriftelijk incident-post-mortem met tijdlijn, kosten en oorzaken, (2) voorstel voor governance-verandering met concrete investeringsbedragen en eigenaars, (3) helderheid over de rol en het contract met WestNet ICT — is dit de juiste MSP of moeten we opnieuw kijken, (4) risico-analyse: welke andere systemen vergelijkbaar kwetsbaar. Ik verwacht dat wij als RvT ook een verklaring naar oudervereniging en OR moeten voorbereiden — help ons daarin.",
          senderName: "Voorzitter RvT — mr. J. de Boer",
          timestamp: "09:33",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
          setsUpDecisionNodeId: "d6-r6-verankering",
          facilitatorNote: "Feit — RvT dwingt tot concreet post-mortem met eigenaar + deadline + budget. Zet de verankerings-vraag scherp neer.",
        },
        {
          id: "r6-univé-claim-deadline",
          type: "executive", channel: "email", urgency: "medium",
          title: "Univé — Final claim deadline 3 weken",
          content:
            "Van: Diana Rademakers (Univé Zakelijk).\n\n" +
            "Bedankt voor uw update over de restore-uitkomst en de gemaakte keuzes. Voor de afhandeling van uw claim ontvangen wij graag binnen 3 weken: (a) totaaloverzicht incident-kosten met bonnen (forensiek, onderhandelaar, tijdelijke tenant Magister, communicatieadviseur, overuren personeel), (b) definitief forensisch eindrapport Eye Security, (c) juridische afhandeling met AP tot dusver, (d) evaluatie beleidsuitvoering — wij toetsen of alle contractuele meldingsclausules zijn nageleefd, dit bepaalt of uitbetaling volledig, gedeeltelijk of niet plaatsvindt.",
          senderName: "Diana Rademakers — Univé Zakelijk",
          timestamp: "10:12",
          reliability: "fact",
          classification: "feit",
          targetTeam: "crisis_management",
        },
      ],
      roleActions: [
        {
          id: "r6-ceo-postmortem-lead",
          label: "Post-mortem-document leiden — met naam, functie en datum per actie",
          description: "Concreet stuk voor RvT + basis voor AP-follow-up en Univé-claim. Blame-free maar concreet.",
          allowedRoles: ["ceo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-ciso-hardening",
          label: "Hardening-plan: MFA, netwerksegmentatie, MDR-scope, account-hygiene",
          description: "Voorstel met investeringsbedrag en tijdlijn, tekenbaar door RvT woensdag.",
          allowedRoles: ["ciso"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-it-msp-contract",
          label: "Voorbereiding contractgesprek WestNet — nieuwe SLA-eisen",
          description: "Ransomware-scope in SLA, monitoring severity-triage, 24/7 doorschakeling.",
          allowedRoles: ["it_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-legal-ap-response",
          label: "AP-follow-up conceptbeantwoording binnen 3 weken",
          description: "Feitelijk, met tijdlijn, geleerde lessen, en concrete mitigatiestappen.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-legal-nis2-final",
          label: "NIS2 final report voorbereiden voor 5 december",
          description: "30-dagen slotrapportage naar NCSC. Nauw sluitend met AP-follow-up.",
          allowedRoles: ["legal"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-cfo-tco",
          label: "Total-cost-of-incident overzicht + Univé-claim compleet maken",
          description: "Alle bonnen, alle uren, alle indirecte kosten inclusief herinvoer-tijd docenten.",
          allowedRoles: ["cfo"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-comms-oudervereniging-partner",
          label: "Voorzitter oudervereniging in verbeterproject betrekken",
          description: "Structureel meepraten in stuurgroep 'digitale weerbaarheid' — geen incident, maar bondgenoot.",
          allowedRoles: ["head_of_comms"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-hr-team-debrief",
          label: "Team-debrief crisisteam + individuele nazorg",
          description: "Twee sessies. Ook: HR-verklaring naar OR over week-inzet en compensatie.",
          allowedRoles: ["hr_lead"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-ops-permanent-processes",
          label: "Noodprocessen die goed werkten permanent maken",
          description: "Papieren fallback-roosters, teamleiders-back-up-mandaat — was crisis-driver dat óók werkt in vredestijd.",
          allowedRoles: ["ops_manager"], irPlanAligned: true, isRecommended: true,
        },
        {
          id: "r6-close-nolessons",
          label: "Vergadering afronden zonder concrete actielijst",
          description: "'We hebben het goed gedaan' — verder alles bij het oude houden.",
          allowedRoles: ["ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager", "it_manager"],
          irPlanAligned: false,
          qualityRank: "wrong",
          facilitatorCommentary: "Grootste verliesrisico: geen verankering. Volgende crisis is dan letterlijk dezelfde crisis.",
          lessonLearned: "Zonder eigenaar, deadline en budget per verbetering herhaalt het patroon zich.",
        },
      ],
      discussionGoal:
        "Deze ronde toetst learning-embedding: worden concrete governance-besluiten schriftelijk vastgelegd met eigenaar, deadline en budget? De zwaarste keuze zit bij de bestuurder rond het post-mortem voor de Raad van Toezicht, en bij de security-lijn rond het hardening-plan. Nudge bij stilstand: verwijs naar de RvT-vergadering woensdag 13 november en de art. 32-inspectie die in kwartaal 2025 volgt. Nudge bij haast: check of iemand 'we hebben het goed gedaan' als afsluiting gebruikt zonder concrete actielijst.",
      keyQuestions: [
        "Welke drie dingen liggen woensdag ter tekening bij de RvT?",
        "Wie is eigenaar van elke actie — met naam en datum?",
        "Hoe klinkt onze samenwerking met WestNet er over drie maanden uit?",
      ],
      hints: [
        "Let op teams die 'we hebben het goed gedaan' als afsluitzin gebruiken zonder acties.",
        "Kijk of AP-follow-up en Univé-claim inhoudelijk sluitend zijn.",
      ],
      expectedDecisions: [
        "Post-mortem gereed voor RvT",
        "Hardening-voorstel met budget",
        "MSP-contractupdate in gang",
        "AP-follow-up en NIS2 final in voorbereiding",
      ],
      redFlags: [
        "Geen concrete actielijst",
        "MSP-gesprek doorgeschoven",
        "AP-vervolg als 'komt vanzelf' behandeld",
      ],
      reviewPrompts: [
        "Wat is jullie belangrijkste organisatorische verandering die uit dit incident volgt?",
        "Hoe voorkomen jullie dat over 12 maanden dezelfde restore-test opnieuw niet wordt uitgevoerd?",
        "Waar staat jullie MKB+-realiteit tussen 'we zijn een school' en 'we zijn een verwerkingsverantwoordelijke'?",
      ],
    },
  ],
  // ──────────────────────────────────────────────────────────────
  // Decision nodes — één per ronde, `perRole: true` zodat elke rol
  // hun eigen 4-opties-set krijgt binnen dezelfde node. Elke optie
  // draagt de outcomeVector op de 6 assen. `capabilityFlag` en
  // `requiresCapability` implementeren cross-role coupling.
  // ──────────────────────────────────────────────────────────────
  decisions: [
    // ── R1 decision ──
    {
      afterRoundIndex: 0,
      authorId: "d1-r1-ambigue",
      prompt: "Na R1 — Ambigue signalen: koers bepalen zonder volle informatie",
      perRole: true,
      options: [
        // CISO — cross-role driver: activeert retainer, ontsluit forensiek in R3
        {
          label: "Eye Security-retainer nu al activeren — vóór bevestiging",
          allowedRole: "ciso",
          outcomeVector: { CONT: 1, FOR: 2, BC: 0, JUR: 1, VER: 1, KOS: -2 },
          qualityRank: "good",
          facilitatorCommentary: "Vroeg activeren opent forensische capaciteit die anders pas een dag later beschikbaar is; kost geld, wint kwaliteit van meldingen en van scope-bepaling.",
          lessonLearned: "Vroeg activeren = eerder scope-zekerheid = betere AP-melding.",
          capabilityFlag: RETAINER_ACTIVATED_FLAG,
          consumesOptionAfterUse: true,
        },
        {
          label: "WestNet formeel opschalen — engineer nu op de zaak",
          allowedRole: "ciso",
          outcomeVector: { CONT: 2, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: -1 },
          qualityRank: "good",
          facilitatorCommentary: "Snelle escalatie richting MSP — SLA-overschrijding kost geld maar levert direct handelingsruimte.",
          lessonLearned: "MSP-piket bellen ondanks kantooruur-SLA is normaal in crisis.",
        },
        {
          label: "Zelf FS-01 uitzetten via de switch (stekker)",
          allowedRole: "ciso",
          outcomeVector: { CONT: 2, FOR: -2, BC: -2, JUR: 0, VER: 0, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Snel maar bewijs kwijt en herstart-tijd langer dan netwerk-isolatie. Klassieke reflex.",
          lessonLearned: "Isoleren via netwerk behoudt vluchtige data.",
        },
        {
          label: "Alleen monitoren, geen actie tot Rob terug is",
          allowedRole: "ciso",
          outcomeVector: { CONT: -2, FOR: -1, BC: 1, JUR: -1, VER: 0, KOS: 0 },
          qualityRank: "wrong",
          facilitatorCommentary: "Wachten op de terugkerende expert kost containment. Mandaatprobleem is een ontwerpfout, geen dagelijkse constante.",
          lessonLearned: "Bij ambigue signalen: mandaat vullen, niet uitstellen.",
        },
        // CEO — cross-role driver
        {
          label: "Bestuurssecretaris crisismandaat geven — 72 uur, tekenbevoegd",
          allowedRole: "ceo",
          outcomeVector: { CONT: 1, FOR: 0, BC: 1, JUR: 2, VER: 1, KOS: 0 },
          qualityRank: "best",
          facilitatorCommentary: "Snel mandaat lost het Rob-probleem op en creëert helderheid voor de rest van het team.",
          lessonLearned: "Crisismandaat is een besluit, geen procedure — dus nu.",
          capabilityFlag: "crisis_mandate_active",
        },
        {
          label: "Zelf alles blijven aansturen tot beeld helder is",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: -1, BC: -1, JUR: -1, VER: 1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Bestuurder als single-point-of-decision werkt niet lang; delegatie voorkomt bottleneck.",
          lessonLearned: "Delegeren in crisis is regie, niet loslaten.",
        },
        {
          label: "Bel eerst RvT-voorzitter voor persoonlijk advies",
          allowedRole: "ceo",
          outcomeVector: { CONT: -1, FOR: 0, BC: 0, JUR: 0, VER: 1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Governance-reflex, maar timing kost een uur waarin containment stagneert.",
          lessonLearned: "RvT informeren = ja, wachten op advies = nee.",
        },
        {
          label: "Wacht op Rob's terugkeer voordat je iets tekent",
          allowedRole: "ceo",
          outcomeVector: { CONT: -2, FOR: 1, BC: -1, JUR: -2, VER: 0, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "Wachten op één individu voor bestuurlijke keuze is precies waarom continuïteitsplannen bestaan. Verleidelijk want Rob's terugkeer belooft complete kennis — maar tegen die tijd zijn andere sporen kapot.",
          lessonLearned: "Afhankelijkheid van één persoon = geen continuïteitsplan.",
        },
        // Legal
        {
          label: "Meldingsklok formeel starten op 08:42 en logboek openen",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 1, BC: 0, JUR: 2, VER: 1, KOS: 0 },
          qualityRank: "best",
          facilitatorCommentary: "Vroeg starten van de klok is juridisch én reputatie-technisch verstandig; achteraf herrekenen is altijd kwetsbaarder.",
          lessonLearned: "Meldingsklok start bij detectie, niet bij bevestiging.",
        },
        {
          label: "Wacht met klok starten tot bevestiging ransomware",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -1, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "Achteraf gerekende klok is een handhavingsrisico — AP kijkt altijd naar het vroegste indicatiemoment.",
          lessonLearned: "Later starten is nooit een voordeel bij AP-handhaving.",
        },
        {
          label: "Contract-check Magister (48u) én Univé (24u) klaarleggen",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 2, VER: 0, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Contractuele meldingsclausules zijn precies het punt waar MKB+ het vaak laat liggen — nu voorwerk is later winst.",
          lessonLearned: "Contract-meldingen zijn geen bijzaak.",
        },
        {
          label: "Legal-workstream pauzeren tot IT bevestigt",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: -1, BC: 0, JUR: -1, VER: -1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Legal in crisis loopt vóór IT, niet erachter; anders passeer je klok-deadlines.",
          lessonLearned: "Juridisch spoor loopt parallel, niet volgend.",
        },
        // IT-manager
        {
          label: "Netwerk-isolatie FS-01/02 aanvragen bij WestNet",
          allowedRole: "it_manager",
          outcomeVector: { CONT: 2, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Correcte technische reactie — indammen zonder bewijsverlies.",
          lessonLearned: "Isoleren via netwerk = ideale trade-off containment vs. forensiek.",
        },
        {
          label: "Alle 350 accounts een password-reset forceren",
          allowedRole: "it_manager",
          outcomeVector: { CONT: 1, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Grof middel dat het onderwijs uur-lang platlegt — te vroeg zonder scope-inschatting.",
          lessonLearned: "Grote gebruikersimpact-maatregelen: pas na scope-check.",
        },
        {
          label: "Volledig herstellen uit backup, nu direct",
          allowedRole: "it_manager",
          outcomeVector: { CONT: 0, FOR: -2, BC: -2, JUR: -1, VER: 1, KOS: -2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Herstellen zonder scope + zonder eradication = binnen dagen weer terug bij af, mogelijk zelfde variant.",
          lessonLearned: "Restore vóór scope-check = terugloop-risico.",
        },
        {
          label: "Rob terugvliegen van vakantie",
          allowedRole: "it_manager",
          outcomeVector: { CONT: -1, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: -2 },
          qualityRank: "poor",
          facilitatorCommentary: "Kost geld, kost uren, en Rob is alsnog niet ter plaatse in de eerste 12u. Ondersteuning organiseren is nuttiger dan reizen.",
          lessonLearned: "Fysieke aanwezigheid ≠ bruikbaarheid.",
        },
        // Implicit
        {
          label: "Geen besluit binnen de tijd",
          implicit: true,
          outcomeVector: { CONT: -2, FOR: -1, BC: -1, JUR: -1, VER: -1, KOS: -1 },
        },
      ],
    },
    // ── R2 decision ──
    {
      afterRoundIndex: 1,
      authorId: "d2-r2-forensiek-comms",
      prompt: "Na R2 — Bevestiging: kies je forensiek-first of communicatie-first?",
      perRole: true,
      options: [
        // CEO
        {
          label: "Publiek video-statement bestuurder om 15:00 vandaag",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 2, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Vroege regie voorkomt dat pers of ouderchat de invulling doen; kost tijd van bestuurder maar wint communicatie-controle.",
          lessonLearned: "Interne én externe regie is een eendagsraam — pak het.",
        },
        {
          label: "Wachten tot Eye Security volledige technische bevestiging geeft",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 1, BC: -1, JUR: -1, VER: -2, KOS: 0 },
          qualityRank: "poor",
          facilitatorCommentary: "Volledige bevestiging afwachten = de eerste 8 uur ouders en docenten in het luchtledige. Comms mag niet wachten op forensiek.",
          lessonLearned: "Communicatie loopt parallel, niet volgend op forensiek.",
        },
        {
          label: "Alleen intern communiceren, extern nog even niet",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Middenweg — soms verdedigbaar in eerste 4 uur. Wordt kwetsbaar zodra ouders het via docenten opvangen.",
          lessonLearned: "Intern-only communiceren werkt maar heel kort.",
        },
        {
          label: "Betalen autoriseren zodat rapportvergadering doorgaat",
          allowedRole: "ceo",
          outcomeVector: { CONT: -1, FOR: -1, BC: 1, JUR: -2, VER: -2, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "Snelheid boven proces = polis weg, dekking weg, reputatie weg. Klassieke MKB-misgreep.",
          lessonLearned: "Betaalbesluit vraagt altijd verzekeraar + juridische check. Kortstondig lijkt het geld het probleem op te lossen — daarna komt de dekking-schade.",
        },
        // CFO — cross-role: Univé-activatie ontsluit onderhandelaar en polislimit-check
        {
          label: "Univé formeel activeren + onderhandelaar aanvragen",
          allowedRole: "cfo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 2, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Correcte volgorde: verzekeraar aan tafel voordat er contact met dader is. Beschermt polis, activeert professionele onderhandelaar.",
          lessonLearned: "Nooit zelf onderhandelen met een gedreven ransomware-actor.",
          capabilityFlag: "insurer_activated",
        },
        {
          label: "Univé pas informeren als betaling ter sprake komt",
          allowedRole: "cfo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -1, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "24u-clausule geeft je geen keuze — wachten is polisdekking verspelen. De 'aantrekkelijkheid' zit in geen telefoontje nu — de rekening komt later.",
          lessonLearned: "Polisclausules zijn deadlines, geen richtlijnen.",
        },
        {
          label: "Alleen interne kostenraming maken, extern niets",
          allowedRole: "cfo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: 0, KOS: 0 },
          qualityRank: "poor",
          facilitatorCommentary: "CFO-werkstroom in crisis is óók extern: verzekeraar, bank, RvT-financieel.",
          lessonLearned: "CFO doet extern zowel als intern in crisis.",
        },
        {
          label: "Cashreserve reserveren voor snelle betaling (backup-plan)",
          allowedRole: "cfo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: -1, VER: -1, KOS: 0 },
          qualityRank: "poor",
          facilitatorCommentary: "Verstandig als voorbereiding maar signaleren aan derden dat betaling optie is verhoogt drukt op besluitvormingsproces.",
          lessonLearned: "Voorbereiden ≠ voorpositioneren.",
        },
        // Legal
        {
          label: "AP-melding indienen als voorlopig — completering later",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 1, KOS: 0 },
          qualityRank: "best",
          facilitatorCommentary: "Vroeg voorlopig melden = klokkelijke veiligheid. AP kan aanvullende vragen stellen wat je ook mag beantwoorden.",
          lessonLearned: "Voorlopig melden is altijd beter dan late volledige melding.",
        },
        {
          label: "Iddink (Magister) contractueel informeren binnen 48u",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 2, VER: 0, KOS: 0 },
          qualityRank: "best",
          facilitatorCommentary: "Contractuele meldingsclausule is een hard punt in een MKB+-omgeving; op tijd melden voorkomt tweede juridisch spoor.",
          lessonLearned: "Leveranciers-clausules zijn stille meldingsverplichtingen.",
        },
        {
          label: "Wachten met NCSC-melding — 24u zit er nog ruim in?",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: 0, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "24u klok is klein voor onbekend incident; snelheid boven volledigheid, aanvullen mag later. Wachten kost geen telefoontje nu; de rekening komt met de NCSC-relatie.",
          lessonLearned: "NIS2 early-warning is 'wat we nu weten', niet 'volledig'.",
        },
        {
          label: "Vertrouwelijkheidsverklaringen alle betrokken partijen",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: -1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Nuttig maar niet urgent in R2 — bindt tijd die op meldingen nodig is.",
          lessonLearned: "Prioriteringsdiscipline in juridisch spoor.",
        },
        // CISO — coupling: requires retainer to escalate correctly
        {
          label: "Eye Security IR de lead geven — WestNet ondersteunt",
          allowedRole: "ciso",
          outcomeVector: { CONT: 1, FOR: 2, BC: 0, JUR: 0, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Correcte verhouding: gespecialiseerde IR-lead met MSP als operationele arm. Voorkomt 'te veel handen op één stuur'.",
          lessonLearned: "IR-leiderschap ligt bij de specialist, uitvoering bij MSP.",
          requiresCapability: RETAINER_ACTIVATED_FLAG,
        },
        {
          label: "WestNet de lead laten houden — Eye Security als sparring",
          allowedRole: "ciso",
          outcomeVector: { CONT: 0, FOR: -1, BC: 0, JUR: 0, VER: -1, KOS: 0 },
          qualityRank: "poor",
          facilitatorCommentary: "WestNet is capabel maar heeft ransomware niet als core-competentie; sparring-model geeft geen scope-zekerheid.",
          lessonLearned: "IR-lead vraagt specialistische ervaring.",
        },
        {
          label: "Zelf de lead nemen — WestNet en Eye Security parallel gebruiken",
          allowedRole: "ciso",
          outcomeVector: { CONT: -1, FOR: -1, BC: -1, JUR: 0, VER: 1, KOS: 0 },
          qualityRank: "wrong",
          facilitatorCommentary: "Twee externe partijen aansturen zonder duidelijke lead = coördinatiechaos, dubbele rekeningen, gemiste stappen. Verleidelijk voelt het als sterke leiding — dat is precies de val.",
          lessonLearned: "Één lead, altijd.",
        },
        {
          label: "Alle domain-accounts direct verlopen ipv gerichte reset",
          allowedRole: "ciso",
          outcomeVector: { CONT: 1, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 0 },
          qualityRank: "poor",
          facilitatorCommentary: "Grof middel — sluit 350 medewerkers buiten Magister en e-mail terwijl je hen nu juist nodig hebt.",
          lessonLearned: "Onder tijdsdruk gericht handelen, niet grof.",
        },
        // Implicit
        {
          label: "Geen besluit binnen de tijd",
          implicit: true,
          outcomeVector: { CONT: -1, FOR: -1, BC: -1, JUR: -2, VER: -2, KOS: -1 },
        },
      ],
    },
    // ── R3 decision ──
    {
      afterRoundIndex: 2,
      authorId: "d3-r3-comms-meldingen",
      prompt: "Na R3 — Communicatie- en meldingsregie: transparant of voorzichtig?",
      perRole: true,
      options: [
        // Head of comms — coupling with CEO's earlier public-statement decision
        {
          label: "Bestuurder belt zelf terug naar RTV Oost — feitelijk statement",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 2, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Bestuurderswoord aan pers is de zwaarste communicatie-waarde die je hebt; feitelijk statement voorkomt speculatie.",
          lessonLearned: "Bestuurderswoord = communicatie-tienvoud van woordvoerder.",
        },
        {
          label: "Persbericht + geen mondelinge reactie richting RTV Oost",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 0, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Veilige middenweg — mist echter de mogelijkheid om nuance mondeling toe te lichten.",
          lessonLearned: "Papier is precies, telefoon is menselijk — kies bewust.",
        },
        {
          label: "'Geen commentaar' — regie via stilte",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: -2, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "Stilte wordt uitgelegd als bevestiging én laat pers de invulling doen — bijna altijd de slechtste keuze. Verleidelijk want kost niets nu.",
          lessonLearned: "Stilte is ook een boodschap, meestal de verkeerde.",
        },
        {
          label: "Preventief interview met sympathiek regionaal medium",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: 1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Kan werken maar riskeert dat andere media het als voorkeurstoegang zien — reputatie-neutraal maar juridisch kwetsbaar.",
          lessonLearned: "Alle media in principe gelijk behandelen.",
        },
        // Legal
        {
          label: "AP-completering vandaag afronden + verzenden",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 1, KOS: 0 },
          qualityRank: "best",
          facilitatorCommentary: "Op tijd + volledig = geen handhavingsopening. Vraagt discipline in dag 1 uitwerking.",
          lessonLearned: "Op tijd is nooit een luxe bij toezichthouders.",
        },
        {
          label: "Bewuste keuze: melding aanvullen tot laatste moment (donderdag 08:42)",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 1, BC: 1, JUR: 1, VER: 0, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Meer feiten in de melding is beter — mits je écht klokvast blijft en verzending gepland is.",
          lessonLearned: "Uitstel = ok mits deadline gerespecteerd wordt.",
        },
        {
          label: "NCSC-melding indienen ondanks verstreken 24u",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 1, BC: 0, JUR: 1, VER: 1, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Te laat melden is minder erg dan niet melden; feitelijk uitleg voegt je positie waarde toe.",
          lessonLearned: "Alsnog melden na miss is standaardpraktijk, niet uitzondering.",
        },
        {
          label: "NCSC-melding overslaan omdat 24u al voorbij is",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -1, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "Overslaan is een handhavingsopening en een reputatiesignaal richting NCSC waar je later mee te maken krijgt. Verleidelijk want geen telefoontje nu.",
          lessonLearned: "Miss melden is altijd beter dan uitstellen.",
        },
        // Ops manager
        {
          label: "Noodrooster vasthouden tot vrijdag — geen half-halfmaatregel",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: 2, JUR: 0, VER: 0, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Halfslachtig terug naar Magister werkt niet; hele week papier is voorspelbaar en werkt.",
          lessonLearned: "Voorspelbaarheid weegt zwaarder dan schijnbare normaliteit.",
        },
        {
          label: "Woensdag proberen terug naar Magister — nieuwe tenant",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Vroeg terugkeren riskeert een tweede storing en verwarring; noodrooster is ongemakkelijk maar zeker. Verleidelijk want lijkt op normaal.",
          lessonLearned: "Vroegtijdig terugschakelen is een klassieke crisisfout.",
        },
        {
          label: "Toetsweek 46 doorschuiven naar week 48",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Realistisch, geeft docenten en leerlingen rust; verlengt de doorlooptijd van de crisis maar is verdedigbaar.",
          lessonLearned: "Onderwijskalender wijzigen is geen falen, is aanpassing.",
        },
        {
          label: "Toetsweek 46 gewoon doorlaten gaan",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Toetsen zonder betrouwbare cijferregistratie = ongeldige toetsafname + herzieningsroute die veel duurder is. Verleidelijk want geen extra planning nu.",
          lessonLearned: "Onderwijsintegriteit weegt zwaarder dan schema.",
        },
        // HR
        {
          label: "Q&A-document + hotline voor docenten",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Docenten zijn eerstelijns communicators naar ouders; hun onzekerheid verergert het externe verhaal.",
          lessonLearned: "Docenten zijn communicatie-frontlijn.",
        },
        {
          label: "Alleen teamleiders informeren, zij briefen docenten",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 1 },
          qualityRank: "good",
          facilitatorCommentary: "Cascade werkt, mits teamleiders elk voldoende tijd nemen — controleer op dag 2.",
          lessonLearned: "Cascade-communicatie moet je actief bewaken.",
        },
        {
          label: "Op-de-vlakte-houden — 'niet verontrusten'",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: -2, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Docenten die het via ouders horen, verliezen vertrouwen in het bestuur — precies verkeerde signaal. Verleidelijk want geen crisiscommunicatie-inzet nodig.",
          lessonLearned: "Onzekerheid onder personeel groeit sneller dan onder ouders.",
        },
        {
          label: "Docenten vrijaf geven zolang Magister uit is",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 2 },
          qualityRank: "poor",
          facilitatorCommentary: "Grof middel — leerlingen komen wel naar school en verwachten onderwijs.",
          lessonLearned: "Personele reactie past bij operationele werkelijkheid.",
        },
        // Implicit
        {
          label: "Geen besluit binnen de tijd",
          implicit: true,
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: -2, VER: -2, KOS: -1 },
        },
      ],
    },
    // ── R4 decision ──
    {
      afterRoundIndex: 3,
      authorId: "d4-r4-losgeld",
      prompt: "Na R4 — Losgeld: betalen, onderhandelen, of weigeren?",
      perRole: true,
      options: [
        // CEO — the primary decision
        {
          label: "Niet betalen — vertrouwen op restore + reconstructie",
          allowedRole: "ceo",
          outcomeVector: { CONT: 1, FOR: 1, BC: -1, JUR: 2, VER: 2, KOS: 1 },
          qualityRank: "best",
          facilitatorCommentary: "Standhouden op principe werkt hier — mits restore 2 landt en je docenten mee-krijgt. Reputatie- en juridische positie versterkt zich hierdoor.",
          lessonLearned: "Niet-betalen alleen verantwoord als BC-alternatief solide is.",
        },
        {
          label: "Onderhandelaar 24u laten rekken — parallel restore doorzetten",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 1, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Tijd kopen is legitieme strategie — mits die tijd effectief wordt gebruikt voor restore- en scope-vooruitgang.",
          lessonLearned: "Optionaliteit heeft waarde als je haar activeert.",
        },
        {
          label: "€340k betalen via Univé — polisdekking gebruiken",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: -1, VER: -2, KOS: -1 },
          qualityRank: "poor",
          facilitatorCommentary: "Verdedigbaar met scope-doc en sanctiecheck maar VER-schade blijft — jullie zijn 'de school die betaalde'.",
          lessonLearned: "Betalen = kostenpost + reputatiepost, ook met polisdekking.",
          requiresCapability: "insurer_activated",
        },
        {
          label: "€340k betalen buiten Univé om — snelheid boven dekking",
          allowedRole: "ceo",
          outcomeVector: { CONT: -1, FOR: -1, BC: 1, JUR: -2, VER: -2, KOS: 0 },
          qualityRank: "wrong",
          facilitatorCommentary: "Alle risico's aannemen zonder dekking = onbestuurbaar besluit voor een MKB+-schoolvereniging. Verleidelijk want geen polis-administratie nu.",
          lessonLearned: "Buiten polis om is bijna altijd het slechtste pad.",
        },
        // CISO — coupling: forensiek voor Univé
        {
          label: "Volledig forensisch scope-document leveren aan Univé",
          allowedRole: "ciso",
          outcomeVector: { CONT: 1, FOR: 2, BC: 0, JUR: 1, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Zonder scope-doc geen polis-dekking op eventuele betaling. Dus dit is óók een BC-beslissing, niet alleen technisch.",
          lessonLearned: "Forensische output is compliance-input.",
          requiresCapability: RETAINER_ACTIVATED_FLAG,
        },
        {
          label: "Beperkte scope-verklaring — snelheid boven volledigheid",
          allowedRole: "ciso",
          outcomeVector: { CONT: 0, FOR: -1, BC: 0, JUR: -1, VER: 0, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Univé kan claim beperken op basis van onvolledige documentatie — kortere termijn wint, langere termijn verliest.",
          lessonLearned: "Onvolledige documentatie is technisch schuld.",
        },
        {
          label: "Volledige eradication forceren vóór welke restore ook",
          allowedRole: "ciso",
          outcomeVector: { CONT: 2, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Restoren zonder eradication = risico op tweede crisis binnen dagen. Kost 12u, wint week 3.",
          lessonLearned: "Attack-eradication vóór restore, altijd.",
        },
        {
          label: "Restore starten parallel aan sweep — geen tijd te verliezen",
          allowedRole: "ciso",
          outcomeVector: { CONT: -1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: -1 },
          qualityRank: "poor",
          facilitatorCommentary: "Snelheid nu, mogelijk nieuwe crisis binnen week — de gok werkt zelden goed.",
          lessonLearned: "Herstelversnelling via kortsluiting is uitgesteld probleem.",
        },
        // CFO
        {
          label: "Complete polislimit-analyse + kosten-scenario aan CEO",
          allowedRole: "cfo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 1, KOS: 1 },
          qualityRank: "best",
          facilitatorCommentary: "CFO als besluitondersteuner: numeriek transparant. Voorkomt dat CEO op onderbuik beslist.",
          lessonLearned: "CFO-cijfers zijn het skelet van een goed besluit.",
          requiresCapability: "insurer_activated",
        },
        {
          label: "Cashflow-buffer opzetten voor onvoorziene kosten",
          allowedRole: "cfo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 2 },
          qualityRank: "good",
          facilitatorCommentary: "Voorzichtige financiële hygiëne — wint bewegingsruimte, reserveert maar besteedt niet.",
          lessonLearned: "Cash-planning in crisis is discipline.",
        },
        {
          label: "Snelle betaling voorbereiden — 'voor de zekerheid'",
          allowedRole: "cfo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: 1, KOS: 2 },
          qualityRank: "poor",
          facilitatorCommentary: "Voorbereiding is prima, signaal aan CEO 'we kunnen morgen betalen' zet besluitproces onder verkeerde druk. Verleidelijk want geeft schijn van executie-klaar.",
          lessonLearned: "Voorbereiden ≠ voorstellen.",
        },
        {
          label: "Univé-onderhandelaar buiten spel zetten — zelf onderhandelen",
          allowedRole: "cfo",
          outcomeVector: { CONT: 1, FOR: 0, BC: -1, JUR: -2, VER: -1, KOS: -2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Zelf onderhandelen tegen gedreven ransomware-actor = polisdekking weg + slechtere uitkomst dan professionals. Verleidelijk want directe controle-illusie.",
          lessonLearned: "Onderhandelen is een specialisme dat je niet improviseert.",
        },
        // Legal
        {
          label: "Sanctielijstencheck (OFAC/EU) + juridische betalingsgoedkeuring",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 0, KOS: 0 },
          qualityRank: "best",
          facilitatorCommentary: "Vereist voor Univé-dekking én voor bestuurlijke aansprakelijkheid. Snel te doen als je concreet werkt.",
          lessonLearned: "Sanctie-check is niet-onderhandelbaar bij betaling.",
        },
        {
          label: "AP-klachtreactie feitelijk voorbereiden binnen deadline",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 1, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Voorkomt escalatie van klachtprocedure; feitelijke, empathische toon werkt.",
          lessonLearned: "AP-klachtprocedure is niet ondergeschikt.",
        },
        {
          label: "AP-klachtreactie uitstellen tot na losgeld-besluit",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: -1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Parallelle sporen moeten parallel lopen; uitstel geeft signaal 'wij nemen klacht niet serieus'.",
          lessonLearned: "Parallel werken is discipline.",
        },
        {
          label: "Juridisch: 'wij betalen niet' zonder proces vastleggen",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: -1, VER: 1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Principebesluit zonder procesvastlegging = later kritiek 'jullie hebben niet eens overwogen' — beter is beslisproces documenteren.",
          lessonLearned: "Verantwoording = beslisproces documenteren.",
        },
        // Implicit
        {
          label: "Geen besluit binnen de tijd",
          implicit: true,
          outcomeVector: { CONT: -1, FOR: -1, BC: -2, JUR: -2, VER: -2, KOS: -2 },
        },
      ],
    },
    // ── R5 decision ──
    {
      afterRoundIndex: 4,
      authorId: "d5-r5-ketenverbreding",
      prompt: "Na R5 — Ketenverbreding: LoonBureau, AOb, PMR-onrust",
      perRole: true,
      options: [
        // CEO
        {
          label: "Bestuurder belt LoonBureau CEO — gezamenlijk crisis-plan",
          allowedRole: "ceo",
          outcomeVector: { CONT: 1, FOR: 1, BC: 1, JUR: 2, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Bestuurder-tot-bestuurder gesprek zet toon: samen dragen we dit verantwoord af.",
          lessonLearned: "Ketenpartners: bestuur belt bestuur.",
          capabilityFlag: "loonbureau_partnership",
        },
        {
          label: "CISO's laten afstemmen — bestuurders op de hoogte houden",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 0, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Werkt op operationeel niveau, mist het bestuurlijke signaal richting LoonBureau.",
          lessonLearned: "Bestuurlijke signalen kun je niet delegeren.",
        },
        {
          label: "LoonBureau doorverwijzen naar onze verzekeraar",
          allowedRole: "ceo",
          outcomeVector: { CONT: -1, FOR: -1, BC: -1, JUR: -1, VER: -2, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Passief afhandelen = signaal 'wij nemen geen verantwoordelijkheid' — reputatie- en contractrisico.",
          lessonLearned: "Verantwoordelijkheid dragen ≠ juridisch schuld erkennen.",
        },
        {
          label: "LoonBureau ontkennen betrokkenheid — 'apart incident'",
          allowedRole: "ceo",
          outcomeVector: { CONT: -1, FOR: -2, BC: -1, JUR: -2, VER: -2, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Feitelijk incorrect (Eye Security heeft koppeling bevestigd) én reputatie-destructief zodra het uitkomt. Verleidelijk want kortste route.",
          lessonLearned: "Feit ontkennen is later dubbel duur.",
        },
        // HR
        {
          label: "PMR-gesprek 15:00 + eenmalige toelage voorstellen",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 0, BC: 2, JUR: 0, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Snel + concreet vervolg = docentmedewerking veiliggesteld. Herinvoer-project versnelt met 30-40%.",
          lessonLearned: "Personele goodwill is een tastbare crisis-versneller.",
          capabilityFlag: "pmr_agreement",
        },
        {
          label: "PMR-gesprek verzetten naar volgende week",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: -1, KOS: 2 },
          qualityRank: "poor",
          facilitatorCommentary: "Uitstel voedt onzekerheid en vermindert herinvoer-tempo; wordt duur. Verleidelijk want de HR-agenda blijft leeg vandaag.",
          lessonLearned: "In crisis werken PMR-relaties op snelheid.",
        },
        {
          label: "Overuren erkennen zonder concrete compensatie",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: 1 },
          qualityRank: "good",
          facilitatorCommentary: "Symbolische erkenning zonder actie werkt kortdurend; wordt kwetsbaar na een week.",
          lessonLearned: "Erkenning zonder actie is een tijdelijk plaster.",
        },
        {
          label: "Overuren afdoen als 'ligt in normale werktijd'",
          allowedRole: "hr_lead",
          outcomeVector: { CONT: 0, FOR: 1, BC: -2, JUR: -1, VER: -2, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Verstoort docent-medewerking én creëert AOb-verhaal-2. Bekende MKB+-misstap. Verleidelijk want geen HR-actie nu.",
          lessonLearned: "Personele kosten in crisis erkennen, altijd.",
        },
        // Head of comms
        {
          label: "AOb-statement inhoudelijk beantwoorden — feit erkennen waar terecht",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: 1, VER: 2, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Erkennen wat terecht is + feit boven emotie waar niet terecht = geloofwaardig; positioneert jullie als volwassen partij.",
          lessonLearned: "Vakbond-statement is soms een uitgestoken hand.",
        },
        {
          label: "AOb-statement negeren — reageert op zichzelf uit",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: -1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Kan werken maar riskeert dat AOb via andere kanalen doorpakt; risico-tolerant maar niet strategisch.",
          lessonLearned: "Zwijgen is een risico-oordeel, geen strategie.",
        },
        {
          label: "AOb defensief weerleggen — 'ongefundeerd'",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: -2, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Openlijk conflict met vakbond in crisis = verhaal wordt 'school valt vakbond aan' — bijna altijd verlies. Verleidelijk want directe pushback.",
          lessonLearned: "Conflict-escalatie in crisis is bijna nooit strategisch.",
        },
        {
          label: "Voorzitter oudervereniging in stuurgroep verbetering betrekken",
          allowedRole: "head_of_comms",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 2, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Van criticus naar mede-eigenaar in verbetering — een van de sterkste reputatie-manoeuvres beschikbaar.",
          lessonLearned: "Betrokkenheid neutraliseert kritiek.",
        },
        // Ops manager
        {
          label: "Papieren fallback-processen deze week volhouden",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: 2, JUR: 0, VER: 0, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Consistentie belangrijker dan schijnbaar snelle herstart; voorspelbaarheid = vertrouwen.",
          lessonLearned: "Halfslachtige overgang kost meer dan doorwerken op noodproces.",
        },
        {
          label: "Half-half deze week — Magister waar mogelijk",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 2 },
          qualityRank: "poor",
          facilitatorCommentary: "Twee sporen tegelijk = fouten, ontstemde docenten, inconsistente ouderdata. Verleidelijk want klinkt als 'pragmatisch'.",
          lessonLearned: "Eenduidigheid boven schijnbare efficiëntie.",
        },
        {
          label: "Terug naar Magister zodra tenant werkt — donderdag al",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: -2, JUR: 0, VER: 1, KOS: 1 },
          qualityRank: "wrong",
          facilitatorCommentary: "Terugkeer forceren = tweede storing incalculeren + docenten kwaad krijgen op herinvoer met korte deadline. Verleidelijk want 'we zijn snel terug bij normaal'.",
          lessonLearned: "Vroeg terugschakelen is de klassieke crisisfout.",
        },
        {
          label: "Rapportvergadering donderdag doorschuiven naar week 47",
          allowedRole: "ops_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Formeel besluit vermijdt half-half en communiceert helderheid richting ouders.",
          lessonLearned: "Formele planningswijziging is besluit, geen falen.",
        },
        // Implicit
        {
          label: "Geen besluit binnen de tijd",
          implicit: true,
          outcomeVector: { CONT: -1, FOR: -1, BC: -2, JUR: -1, VER: -2, KOS: -1 },
        },
      ],
    },
    // ── R6 decision ──
    {
      afterRoundIndex: 5,
      authorId: "d6-r6-verankering",
      prompt: "Na R6 — Verankering: welke governance-verandering wordt schriftelijk?",
      perRole: true,
      options: [
        // CEO
        {
          label: "Concreet governance-pakket met eigenaar, deadline en budget voor RvT",
          allowedRole: "ceo",
          outcomeVector: { CONT: 1, FOR: 1, BC: 2, JUR: 2, VER: 2, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Enige moment waarop RvT écht luistert naar IT-investering. Momentum benutten. Concreet = beklonken.",
          lessonLearned: "Post-crisis momentum is een raam van 6 weken.",
          leadsTo: "outcome:voorbeeldig",
        },
        {
          label: "Verhaal aan RvT, actielijst 'volgt binnen kwartaal'",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 1, VER: 0, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Zonder concrete deadlines verwatert het naar business-as-usual.",
          lessonLearned: "Vage acties = geen acties.",
          leadsTo: "outcome:acceptabel",
        },
        {
          label: "Externe consultant vragen om governance-plan te schrijven",
          allowedRole: "ceo",
          outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 0, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Extern kan versnellen, kost geld, wint kwaliteit. Belangrijk: bestuurlijk eigenaarschap houden.",
          lessonLearned: "Externe consultant = katalysator, niet eigenaar.",
        },
        {
          label: "'We hebben het goed gedaan' — actielijst uitstellen",
          allowedRole: "ceo",
          outcomeVector: { CONT: -1, FOR: -1, BC: -2, JUR: -2, VER: -1, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Grootste verliesrisico — volgende crisis is dezelfde crisis. Verleidelijk want geen extra werk nu.",
          lessonLearned: "Zonder verankering herhaalt het patroon zich.",
          leadsTo: "outcome:escalerend",
        },
        // CISO
        {
          label: "Hardening-plan: MFA, segmentatie, MDR-scope, account-hygiene — met bedragen",
          allowedRole: "ciso",
          outcomeVector: { CONT: 2, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: -2 },
          qualityRank: "best",
          facilitatorCommentary: "Concreet plan met bedrag maakt investering tekenbaar. Voorkomt herhaling. Werkt vooral als de nieuwe MSP-scope er ook ligt.",
          lessonLearned: "IT-investering wordt in crisis-nasleep goedgekeurd of nooit.",
          requiresCapability: "msp_contract_v2",
        },
        {
          label: "Rapport 'lessen geleerd' zonder investeringsvoorstel",
          allowedRole: "ciso",
          outcomeVector: { CONT: 0, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Analyse zonder aankoop = plank-materiaal.",
          lessonLearned: "Rapport zonder acties is theater.",
        },
        {
          label: "Alleen MDR-scope uitbreiden, rest naar volgend jaar",
          allowedRole: "ciso",
          outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: -1 },
          qualityRank: "good",
          facilitatorCommentary: "Prioritering is verstandig; MDR is inderdaad grootste gap. Vergeet niet MFA en account-hygiene.",
          lessonLearned: "Prioriteren = ok, negeren = nee.",
        },
        {
          label: "Alles verplaatsen naar cloud — 'we lopen achter'",
          allowedRole: "ciso",
          outcomeVector: { CONT: 0, FOR: -1, BC: -1, JUR: -1, VER: 1, KOS: 0 },
          qualityRank: "poor",
          facilitatorCommentary: "Grote transformatie in crisis-nasleep = tweede crisis binnen half jaar. Fase eerst hardening, dan strategie. Verleidelijk want maakt indruk op RvT.",
          lessonLearned: "Herstel + hardening eerst, transformatie later.",
        },
        // IT-manager
        {
          label: "WestNet-contract heronderhandelen — ransomware-scope, 24/7, betere severity-triage",
          allowedRole: "it_manager",
          outcomeVector: { CONT: 1, FOR: 1, BC: 2, JUR: 1, VER: 1, KOS: -1 },
          qualityRank: "best",
          facilitatorCommentary: "Enige moment waarop MSP écht luistert naar contractuele verbetering. Rob's continuïteitsrisico weglaten in nieuw contract.",
          lessonLearned: "MSP-contracten na incident zijn concreter.",
          capabilityFlag: "msp_contract_v2",
        },
        {
          label: "MSP wisselen naar een grotere partij (bijv. landelijk)",
          allowedRole: "it_manager",
          outcomeVector: { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Migratie in nasleep = tweede risico. Behalve als WestNet aantoonbaar niet kán leveren; feit is nu dat ze ondersteunend waren tijdens crisis. Verleidelijk want geeft schijn van doortastendheid.",
          lessonLearned: "Emotie-gedreven leveranciers-wisseling is duur.",
        },
        {
          label: "IT-team uitbreiden — junior ICT-medewerker in dienst",
          allowedRole: "it_manager",
          outcomeVector: { CONT: 1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 },
          qualityRank: "good",
          facilitatorCommentary: "Vermindert Rob's single-point-of-knowledge risico. Kost geld, wint continuïteit.",
          lessonLearned: "Single-point-of-knowledge is een organisatorisch risico.",
        },
        {
          label: "Volledig laten zoals het is — MSP redt het wel",
          allowedRole: "it_manager",
          outcomeVector: { CONT: -1, FOR: -1, BC: -2, JUR: -1, VER: -1, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Business-as-usual = volgende crisis identiek. Verleidelijk want geen extra investering nodig.",
          lessonLearned: "Status-quo is een besluit met risico.",
        },
        // Legal
        {
          label: "AP-follow-up + NIS2 final report inhoudelijk sluitend maken",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 1, BC: 0, JUR: 2, VER: 1, KOS: 0 },
          qualityRank: "best",
          facilitatorCommentary: "AP-vervolgtraject wordt zwaarder als jullie NIS2 final report tegenstrijdig oplevert. Consistentie is discipline. Werkt bijzonder goed als de LoonBureau-partnership al ligt (dan één gezamenlijk narratief).",
          lessonLearned: "Meldingen-set moet inhoudelijk sluitend zijn.",
          requiresCapability: "loonbureau_partnership",
        },
        {
          label: "AP-follow-up minimalistisch — geen extra info",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: -1, KOS: 1 },
          qualityRank: "poor",
          facilitatorCommentary: "Minimale medewerking wekt indruk 'zij verbergen iets' — riskant voor art. 32-inspectie. Verleidelijk want minder juridisch tijdverlies.",
          lessonLearned: "Ruimhartige medewerking positioneert je goed.",
        },
        {
          label: "Extern advocatenkantoor inschakelen voor AP-traject",
          allowedRole: "legal",
          outcomeVector: { CONT: 1, FOR: 0, BC: 0, JUR: 1, VER: 0, KOS: -1 },
          qualityRank: "good",
          facilitatorCommentary: "Externe expertise voor gevoelig traject — kost geld, verstandig als eigen team beperkt in AP-praktijk is.",
          lessonLearned: "Externe expertise voor specialistisch handhavingstraject.",
        },
        {
          label: "AP-vervolgtraject onderschatten — 'komt vanzelf wel goed'",
          allowedRole: "legal",
          outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -2, KOS: 2 },
          qualityRank: "wrong",
          facilitatorCommentary: "Boete-risico op art. 32-tekortkoming voor essentiële entiteit is reëel; onderschatten wordt duur. Verleidelijk want geen legal-inzet nu.",
          lessonLearned: "AP-vervolg is nooit routine.",
        },
        // Implicit
        {
          label: "Geen besluit binnen de tijd",
          implicit: true,
          outcomeVector: { CONT: -2, FOR: -2, BC: -2, JUR: -2, VER: -2, KOS: -2 },
        },
      ],
    },
  ],
  // ──────────────────────────────────────────────────────────────
  // Outcomes — cumulatieve score bepaalt welke narrative getriggerd wordt.
  // ──────────────────────────────────────────────────────────────
  outcomes: [
    {
      key: "voorbeeldig",
      label: "Voorbeeldige respons — Onderwijsvereniging Noord-Oost als voorbeeld",
      narrative:
        "Team escaleerde binnen 30 minuten, activeerde Eye Security in dag 0, meldde binnen 24u (NCSC), binnen 24u (Univé) en binnen 72u (AP). Restore lukte via tweede backup-set met minimale data-loss. Docenten hielden het scenario door omdat compensatie snel geregeld was. AOb-statement werd omgebogen naar samenwerking. LoonBureau-verbreding werd aangevuld gemeld. RvT keurde hardening-investering (€180k, 12 mnd) goed. AP-vervolg-inspectie afgesloten met bevestiging 'organisatie in de leerkromme'.",
      lessonLearned:
        "Vroege escalatie + expliciete mandaten + parallel werken op alle sporen bepalen of een MKB+-schoolvereniging dit doorstaat of niet.",
      scoreRange: { min: 10 },
    },
    {
      key: "acceptabel",
      label: "Acceptabel — leerpunten helder, maar met deuken",
      narrative:
        "Meldingen (deels) op tijd — NIS2 24u werd nét gemist maar alsnog ingediend met feitelijke uitleg. AP-melding op de laatste dag ingediend, aanvullende vragen beantwoord binnen vervolgtermijn. Interne communicatie liep dag 1 achter (docenten hoorden roddels via ouders eerst), verbeterde dag 2. Ransom-besluit was 'niet betalen' met solide onderbouwing. Univé-claim gedeeltelijk gedekt (~65%) vanwege late Iddink-melding. RvT vraagt vervolgrapportage; art. 32-inspectie loopt.",
      lessonLearned:
        "In een MKB+-omgeving is het niet de aanwezigheid van een IR-plan die telt, maar de discipline om alle klokken parallel te lopen.",
      scoreRange: { min: -3, max: 9 },
    },
    {
      key: "escalerend",
      label: "Escalerende crisis — reputatie- en boete-risico groot",
      narrative:
        "Meldplicht gemist (NIS2 én AP-completering te laat), betaald zonder Univé-scope-check, videobericht nooit gedaan. Ouders hoorden het via RTV Oost, docenten via ouders. LoonBureau werd afgehandeld op operationeel niveau zonder bestuurlijk contact — leidde tot juridisch geschil later. AOb-statement kreeg politieke opvolging in gemeenteraad. AP-vervolg-inspectie start met bestuurlijke boete op tafel. Univé keert ~30% uit. Bestuurder biedt in maart aan af te treden.",
      lessonLearned:
        "Trage besluitvorming + versplinterde communicatie + niet betrekken van verzekeraar = grotere schade dan het incident zelf.",
      scoreRange: { max: -4 },
    },
  ],
}

// Phase 5 — 6 authored ruis-injects (2 feit, 2 aanname, 2 fabel) matching the
// schoolvereniging world. Facilitator kan deze via het runtime-panel afvuren
// tijdens de discussie. Puur context — nooit gescoord.
const schoolverenigingInjectLibrary: PremadeInject[] = [
  {
    id: "plib_msp_second_system",
    label: "MSP-status update — 2e systeem geïsoleerd",
    channel: "system_alert",
    urgency: "medium",
    classification: "feit",
    senderName: "WestNet ICT — SOC",
    title: "MSP-update: tweede systeem preventief geïsoleerd",
    content:
      "Update WestNet ICT — 14:22. Naast FS-01 hebben we ook FS-02 (backup file server, locatie Oost) preventief van het netwerk gehaald na verdachte SMB-activiteit. Geen encryptie waargenomen op FS-02. Geen impact op leerlingregistratie op dit moment. Volgende update over ~30 minuten of eerder bij escalatie.",
    facilitatorNote: "Feit — inzetten wanneer team te lang op R1-symptomen blijft hangen; MSP levert een concrete, controleerbare stap.",
  },
  {
    id: "plib_om_aangifte",
    label: "OM: aangifte in behandeling genomen",
    channel: "email",
    urgency: "medium",
    classification: "feit",
    senderName: "Openbaar Ministerie — Team Cybercrime",
    title: "Bevestiging aangifte cyberincident",
    content:
      "Geachte bestuurder, wij bevestigen ontvangst van uw aangifte inzake het cyberincident (ref. OM-CYB-2024-1147). Uw zaak wordt in behandeling genomen door team Cybercrime Noord-Oost. Een contactpersoon zal binnen 5 werkdagen contact opnemen. In afwachting daarvan verzoeken wij u forensische data ongewijzigd te bewaren. Met vriendelijke groet.",
    targetRoles: ["legal", "ceo"],
    facilitatorNote: "Feit — externe bevestiging die juridische track legitimeert; helpt legal-rol te activeren als die achterblijft.",
  },
  {
    id: "plib_hr_gerucht",
    label: "HR-tip — collega X hoorde iets over ontslag",
    channel: "whatsapp",
    urgency: "low",
    classification: "aanname",
    senderName: "HR-medewerker (Sanne)",
    title: "Tip vanuit HR — gerucht rondom personeelsgevolgen",
    content:
      "Hoi, sorry voor het late berichtje. Ik hoorde net van een collega dat er iemand heeft laten vallen dat 'ze denken dat mensen ontslagen gaan worden' vanwege de hack. Weet niet of dit hard is of gewoon paniek. Wilde het even doorgeven zodat je er van weet. Groet, Sanne",
    targetRoles: ["hr_lead"],
    facilitatorNote: "Aanname — test of HR-rol dit oppakt als signaal-om-te-checken i.p.v. als feit door te sturen.",
  },
  {
    id: "plib_ouder_tiktok",
    label: "Ouder belt — 'mijn zoon zei op TikTok...'",
    channel: "phone",
    urgency: "medium",
    classification: "aanname",
    senderName: "Ouder — mevr. Aksoy",
    title: "Ouder belt bezorgd over TikTok-verhaal",
    content:
      "Mevr. Aksoy (ouder klas 3B): 'Mijn zoon Emir zei net dat er op TikTok een filmpje rondgaat waarin een leerling zegt dat álle cijfers gehackt zijn en dat kinderen niet kunnen overgaan. Klopt dat? Wat moet ik tegen hem zeggen?' — noteert nummer voor terugbellen.",
    targetRoles: ["head_of_comms"],
    facilitatorNote: "Aanname — bron is één ouder die één kind citeert; verleiding is om direct te reageren op onbevestigd signaal.",
  },
  {
    id: "plib_linkedin_utrecht",
    label: "Vage LinkedIn-post — 'grote hack scholen Utrecht'",
    channel: "news",
    urgency: "low",
    classification: "fabel",
    senderName: "LinkedIn — anonieme post",
    title: "LinkedIn-gerucht over 'grote hack bij scholen in Utrecht'",
    content:
      "Screenshot van een LinkedIn-post door 'CyberWatchdog NL' (niet-geverifieerd account, 340 volgers): 'Bronnen melden een grote ransomware-aanval bij een schoolgroep in Utrecht — meerdere locaties platgelegd, ouderdata mogelijk buit. Meer info volgt.' — Onze vereniging zit in Noord-Oost, niet Utrecht. Geen link naar bron.",
    targetRoles: ["head_of_comms"],
    facilitatorNote: "Fabel — verkeerde regio, anoniem account. Test of team dit als niet-relevant kan classificeren of erin trapt.",
  },
  {
    id: "plib_concierge_iemand_zei",
    label: "WhatsApp conciërge — 'iemand zei dat...'",
    channel: "whatsapp",
    urgency: "low",
    classification: "fabel",
    senderName: "Conciërge Willem (loc. Noord)",
    title: "WhatsApp — 'iemand zei dat de rectrix aftreedt'",
    content:
      "Ha, gehoord van een schoonmaker in gebouw B dat iemand op het parkeerterrein zei dat 'de rectrix vanavond zou aftreden'. Weet niet wie het zei maar wilde het even melden. Groetjes W.",
    facilitatorNote: "Fabel — meta-gerucht (iemand zei dat iemand zei). Perfect voor BOB-training: hoe checken we bron?",
  },
]

// Phase 10 — per-role opening briefings. Each role gets mandate + t=0 situatie +
// wat ze nog NIET weten (rendered at session start). playbookGaps: dingen die
// het IR-plan niet dekt en die dit scenario echt exerciseert.
const schoolverenigingRoleBriefings: Partial<Record<Role, RoleBriefing>> = {
  ceo: {
    text:
      "Jij bent bestuurder van Onderwijsvereniging Noord-Oost. Vandaag opent de eerste schooldag na de herfstvakantie. Je krijgt ambigue signalen dat 'Magister traag doet' — je weet nog niet dat er een Play-ransomware-encryptie loopt op FS-01/02 en dat er data is ge-exfiltreerd. Wat je vooral niet weet: de MSP-alert van 08:42 is de sleutel, en je IT-coördinator Rob de Vries zit in Portugal.",
    playbookGaps: [
      "Geen procedure voor crisismandaat wanneer de enige IT-kenner onbereikbaar is",
      "Geen communicatiesjabloon voor ouders bij grootschalig datalek",
      "Geen expliciete afspraak wie AP-vervolg-inspectie leidt",
    ],
  },
  ciso: {
    text:
      "Jij bent CISO en coördineert de incidentrespons. Je weet dat WestNet monitoring een low-severity alert heeft geplaatst op FS-01, maar er is nog geen ticket. Wat je nog niet weet: het is ransomware met exfiltratie, en de MSP-SLA dekt geen incidentresponse op dit niveau. Je moet vandaag beslissen of je Eye Security al vroeg activeert — vóór volledige bevestiging.",
    playbookGaps: [
      "Geen contract met Eye Security-lead — retainer moet expliciet worden geactiveerd",
      "Netwerk-isolatie procedure ligt bij MSP, niet intern",
      "Geen forensische baseline vastgelegd van FS-01/02 vóór crisis",
    ],
  },
  cfo: {
    text:
      "Jij bent CFO en bewaakt de financiële impact. Je hebt sinds 2022 een cyberpolis via Univé Zakelijk (polislimit €500.000) — maar de exacte uitsluitingsclausules zijn nooit precies gelezen. De 24u-melding aan Univé begint bij detectie, niet bij bevestiging. Wat je nog niet weet: de aanvaller vraagt €680k in Monero en de gefaalde restore in R4 zal de losgeld-vraag verzwaren.",
    playbookGaps: [
      "Univé-uitsluitingsclausules nooit geïnventariseerd",
      "Geen cashflow-scenario voor 5 werkdagen zonder Magister-incasso",
      "Geen procedure voor total-cost-of-incident-tracking",
    ],
  },
  legal: {
    text:
      "Jij bent verantwoordelijk voor compliance. Je bewaakt de AVG art. 33 (72u AP-melding) en NIS2 art. 23 (24u NCSC-melding). Wat je nog niet expliciet weet: het Magister-contract heeft een 48u breach-clause (art. 14.3) die nog nooit is ingeroepen, en er is een AP-klacht van een betrokkene op komst.",
    playbookGaps: [
      "Meldplichtklok start moment: nooit formeel vastgelegd",
      "Contractuele meldingsclausules richting leveranciers: niet geïnventariseerd",
      "Geen sjabloon voor art. 32-inspectie verweer",
    ],
  },
  head_of_comms: {
    text:
      "Jij regisseert interne en externe communicatie. Je weet dat ouders en docenten vandaag verwarrende signalen krijgen; je weet nog niet dat RTV Oost morgen een reactie eist vóór 13:30 en dat de AOb je later in de week publiek noemt. Bestuurder moet je snel briefen, want de eerstelijns communicators zijn de docenten — hun onzekerheid vergroot het externe verhaal.",
    playbookGaps: [
      "Geen media-training bestuur voor cybercrisis-specifiek",
      "Geen communicatiesjabloon voor 4000 ouders in Magister-berichten + website",
      "Geen protocol voor omgaan met vakbond-statement mid-crisis",
    ],
  },
  hr_lead: {
    text:
      "Jij zorgt voor medewerkers, welzijn en de PMR-relatie. Docenten worden vandaag onzeker: klassenlijsten laden niet, geruchten razen door WhatsAppgroepen. Wat je nog niet weet: later deze week vraagt de PMR expliciet om compensatie voor cijfer-herinvoer (4–6 uur per docent) en zal je snelheid van reageren bepalen of docenten meebewegen of niet.",
    playbookGaps: [
      "Geen crisiscommunicatie-protocol voor docenten via teamleiders",
      "Geen concrete compensatieregeling voor overuren in cybercrisis",
      "Geen HR-verklaring naar OR/PMR als sjabloon paraat",
    ],
  },
  ops_manager: {
    text:
      "Jij houdt primaire processen draaiend. Wat betekent 'FS-01 offline' operationeel? Roosters, cijferregistratie, leerlingzorgdossiers hangen ervan. Wat je nog niet weet: er komt een noodrooster op papier voor 5 werkdagen én een toetsweek-verschuiving.",
    playbookGaps: [
      "Geen papieren fallback-rooster voor 5 werkdagen paraat",
      "Geen procedure voor toetsweek-verschuiving met formeel bestuursbesluit",
      "Geen backup-mandaat voor teamleiders bij crisis",
    ],
  },
  it_manager: {
    text:
      "Jij (of Rob's vervanging) bent verantwoordelijk voor de technische kant. Rob de Vries zit in Portugal — de enige persoon met écht diepe kennis van finance-koppeling en het leerlingregistratiesysteem. Wat je nog niet weet: de eerste cold-restore faalt woensdag, en de tweede backup-set landt gedeeltelijk. De back-up-restoretest was jaren geleden voor het laatst volledig gedraaid.",
    playbookGaps: [
      "Back-up-restore procedure onbekend voor Magister-cloud-tenant",
      "Geen documentatie van FS-01/02 configuratie voor externe hulp",
      "Single-point-of-knowledge risico bij Rob nooit formeel geagendeerd",
    ],
  },
}

export function schoolverenigingScenario(): ScenarioGraph {
  const g = planToGraph(plan, { publishStatus: 'published' })
  return {
    ...g,
    injectLibrary: schoolverenigingInjectLibrary,
    roleBriefings: schoolverenigingRoleBriefings,
  }
}
