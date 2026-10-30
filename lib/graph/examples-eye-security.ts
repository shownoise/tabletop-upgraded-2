// Eye Security — interne oefening: ons eigen beheerplatform als de keten.
//
// Het scenario waar een MDR-leverancier wakker van ligt: niet dat een klant
// geraakt wordt, maar dat wíj het zijn. Wij hebben privileged access in
// klant-tenants, dus een compromittering bij ons is per definitie een
// ketenincident bij honderden anderen — en hun meldklokken beginnen te lopen
// op óns bericht.
//
// ── Waarom ronde 1 over alarmeren gaat ─────────────────────────────────
//
// Elk crisisverhaal begint met iets wat nog niet bestaat en escaleert
// langzaam, maar een crisisteam zit zaterdag om 02:48 niet bij elkaar. In
// plaats van dat weg te poetsen is het hier het eerste beslispunt: wie
// alarmeer je, en wie laat je slapen. Daarom hebben in ronde 1 alléén de CISO
// en de IT-manager opties — de twee die op dat uur bereikbaar zijn. De overige
// rollen staan op adviseren en lezen mee zonder mandaat; dat is precies de
// ervaring die je wil hebben.
//
// Dat besluit werkt door: wie opschaalt zet de vlag `crisisteam_opgeschaald`,
// en een paar opties in ronde 2 en 3 bestaan alleen mét die vlag. Wie het team
// liet slapen merkt dat later aan wat er niet kan.

import type { ChoiceQuality, Role } from "@/lib/types"
import { planToGraph, type WizardPlan, type WizardPlanDecision } from "./wizard-plan"
import type { OutcomeVector, PremadeInject, RoleBriefing, ScenarioGraph } from "./types"
import { EYE_SECURITY_CLIENT_ID } from "@/lib/admin/seed-clients"

// ── Uitkomstvectoren ──────────────────────────────────────────────────────
//
// Vier vectoren per rol, uit vier assen opgebouwd. Met de hand uitschrijven
// gaf 56 kansen op twee fouten die pas in de nabespreking opvallen: een
// rangorde die de scoring tegenspreekt, en een optie die een andere op álle
// zes assen verslaat (rule3). Deze vorm sluit beide per constructie uit.
//
//   best   a+2 b+2      d−1   → netto +3
//   good   a+1 b−1 c+2  d−1   → netto +1
//   poor   a−1 b+1 c−2  d+1   → netto −1
//   wrong  a−2 b−1 c−1  d+1   → netto −3
//
// Elke optie wint op minstens één as waar de andere drie niet winnen — `wrong`
// bijvoorbeeld op d, de as die hij koopt met verlies elders. Daarom domineert
// geen enkele een andere, terwijl de netto-uitkomst wél de rangorde volgt.
type As = keyof OutcomeVector
const NUL: OutcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }

function vierVectoren(a: As, b: As, c: As, d: As): Record<ChoiceQuality, OutcomeVector> {
  return {
    best:  { ...NUL, [a]: 2,  [b]: 2,  [d]: -1 },
    good:  { ...NUL, [a]: 1,  [b]: -1, [c]: 2,  [d]: -1 },
    poor:  { ...NUL, [a]: -1, [b]: 1,  [c]: -2, [d]: 1 },
    wrong: { ...NUL, [a]: -2, [b]: -1, [c]: -1, [d]: 1 },
  }
}

// Welke assen bij welke rol horen. De hoofdas is waar die rol zijn winst
// haalt, zodat de review leest zoals het werk voelt: Legal wint op juridisch,
// de CFO op kosten, Operations op continuïteit.
const ASSEN: Partial<Record<Role, [As, As, As, As]>> = {
  ciso:          ["CONT", "FOR", "BC", "KOS"],
  it_manager:    ["CONT", "BC", "FOR", "KOS"],
  ceo:           ["VER", "CONT", "BC", "KOS"],
  legal:         ["JUR", "VER", "FOR", "KOS"],
  head_of_comms: ["VER", "JUR", "BC", "KOS"],
  cfo:           ["KOS", "BC", "CONT", "VER"],
  ops_manager:   ["BC", "CONT", "VER", "KOS"],
  hr_lead:       ["VER", "BC", "JUR", "KOS"],
}

/** Eén optie-regel. `kwaliteit` bepaalt de vector, dus die twee kunnen niet
 *  uit de pas lopen. */
function optie(
  rol: Role,
  kwaliteit: ChoiceQuality,
  label: string,
  description: string,
  facilitatorCommentary: string,
  lessonLearned: string,
  extra: Partial<NonNullable<WizardPlanDecision["options"]>[number]> = {},
): NonNullable<WizardPlanDecision["options"]>[number] {
  const assen = ASSEN[rol] ?? ["CONT", "FOR", "BC", "KOS"]
  return {
    label,
    description,
    allowedRole: rol,
    qualityRank: kwaliteit,
    outcomeVector: vierVectoren(...assen)[kwaliteit],
    facilitatorCommentary,
    lessonLearned,
    ...extra,
  }
}

/** De impliciete "geen besluit"-optie. Zonder allowedRole, zodat hij voor elke
 *  rol zichtbaar is en niet meetelt in het optie-aantal per rol (rule2). */
function geenBesluit(echo: string): NonNullable<WizardPlanDecision["options"]>[number] {
  return {
    label: "Geen besluit binnen de tijd",
    implicit: true,
    outcomeVector: { CONT: -1, FOR: -1, BC: -1, JUR: -1, VER: -1, KOS: 0 },
    lessonLearned: `${echo} Niet kiezen is ook een keuze, en de rekening komt een ronde later.`,
  }
}

/** Gezet door elke optie die het crisisteam daadwerkelijk bijeenroept. */
export const CRISISTEAM_OPGESCHAALD = "crisisteam_opgeschaald"
/** Gezet zodra er een eerste bericht naar klanten uit is. */
export const KLANTEN_GEINFORMEERD = "klanten_geinformeerd"

const plan: WizardPlan = {
  name: "★ Eye Security — ons eigen beheerplatform (interne oefening)",
  scenarioType: "supply_chain_compromise",
  rounds: [
    // ── R1 ───────────────────────────────────────────────────────────────
    {
      title: "R1 — Zaterdag 02:48, één analist wakker",
      situation:
        "Zaterdagnacht, 02:48. De dienstdoende SOC-analist ziet iets in onze eigen omgeving " +
        "dat hij niet kan plaatsen. Niemand anders is wakker. Er is geen crisisteam, er is " +
        "een piketlijst en een telefoon. Jullie hebben een kwartier om te bepalen wie je nu " +
        "belt en wie je laat slapen — en wie dat besluit neemt.",
      timerMinutes: 15,
      decisionAuthorId: "eye-d1-alarmeren",
      discussionGoal:
        "Toets of het team durft op te schalen op een onvolledig signaal, en of iemand " +
        "expliciet het mandaat pakt in plaats van het bij de piketdienst te laten liggen.",
      keyQuestions: [
        "Wat weet je nu écht, en wat vul je in?",
        "Wie mag om 03:00 besluiten dat dit een incident is?",
        "Wat kost het als je iedereen wakker maakt en het blijkt niets?",
      ],
      hints: [
        "Vraag hardop wie er op de piketlijst staat en wie daar feitelijk op reageert.",
        "Let op wie zegt 'laten we wachten tot het duidelijk is' — dat is de kern van deze ronde.",
      ],
      expectedDecisions: ["Wie wordt nu gealarmeerd, en wie neemt dat besluit?"],
      redFlags: [
        "Het besluit blijft bij de dienstdoende analist liggen zonder dat iemand het overneemt.",
        "Een geolocatie wordt als bewijs gebruikt in plaats van als signaal.",
      ],
      openingPrompts: [
        "Het is 02:48. Wie van jullie is op dit moment überhaupt bereikbaar?",
        "Wat is het kleinste groepje waarmee je dit kunt beoordelen?",
      ],
      reviewPrompts: [
        "Wie heeft er uiteindelijk besloten, en hoe laat?",
        "Wat had je anders gedaan als dit op dinsdagmiddag was gebeurd?",
      ],
      facilitatorPerspective:
        "Dit is de ronde waarin het team ontdekt dat 'het crisisteam' om 03:00 niet bestaat. " +
        "Laat de stilte vallen als niemand het mandaat pakt — die stilte is de les.",
      injects: [
        {
          id: "eye-r1-i1",
          type: "alert",
          urgency: "high",
          title: "Service-account authenticatie buiten patroon",
          senderName: "Eigen detectie — identity-monitoring",
          source: "Eye Security SOC",
          content:
            "Signaal op svc-agentpolicy, het service-account dat agentbeleid naar klant-tenants " +
            "uitrolt. Twee geslaagde authenticaties om 02:31 en 02:36, buiten het " +
            "onderhoudsvenster. Bron-IP bij een hostingpartij in Litouwen; dit account heeft " +
            "nooit eerder buiten onze eigen ranges geauthenticeerd. MFA is op dit account " +
            "niet afdwingbaar — het is een machine-account met een certificaat. De " +
            "dienstdoende analist heeft nog geen actie ondernomen en onderneemt die ook niet " +
            "zolang er geen besluit is. Hij vraagt jullie dus twee dingen: is dit ruis of een " +
            "incident, en wie van jullie wordt nu gebeld?",
          classification: "feit",
          setsUpDecisionNodeId: "eye-d1-alarmeren",
          facilitatorNote:
            "Dit is de setup-inject: hij eindigt op de beslisvraag. Het signaal is hard, de " +
            "betekenis niet. Wie 'eerst meer data' zegt, kiest voor stilte.",
        },
        {
          id: "eye-r1-i2",
          type: "internal",
          urgency: "medium",
          title: "Piketengineer: 'ik denk dat het de certificaatrotatie is'",
          senderName: "Piketengineer platform",
          content:
            "WhatsApp van de piketengineer, 02:41: 'Volgens mij is dit de certificaatrotatie " +
            "die vrijdag gepland stond, die schuift soms een dag door. Ik zou wachten tot " +
            "maandag.' Navraag: de rotatie staat in de changekalender op vrijdag 20:00, en " +
            "er is geen ticket dat zegt dat hij is uitgesteld. De engineer heeft het niet " +
            "nagekeken maar klinkt zeker.",
          classification: "aanname",
          facilitatorNote:
            "Ruis met gezag. Dit is de aantrekkelijkste verklaring en hij is onjuist. Let op " +
            "of iemand vraagt of die rotatie daadwerkelijk heeft gelopen.",
        },
        {
          id: "eye-r1-i3",
          type: "internal",
          urgency: "low",
          title: "Twee klanten melden trage agents",
          senderName: "Servicedesk — nachtwacht",
          content:
            "Twee losse meldingen in de wachtrij, 01:55 en 02:20: bij een klant in Rotterdam " +
            "en een klant in Gent reageren de endpoint-agents traag op policy-pushes. " +
            "Servicedesk heeft het als 'performance' geclassificeerd en doorgezet naar " +
            "maandag. Niemand heeft het aan het identity-signaal gekoppeld.",
          classification: "feit",
          facilitatorNote:
            "Hier zit de echte bevestiging, weggestopt in een performance-ticket. Teams die " +
            "alleen naar het alert kijken missen dit.",
        },
        {
          id: "eye-r1-i4",
          type: "social",
          urgency: "low",
          title: "Mastodon-post over 'een Nederlandse MDR'",
          senderName: "@infosec_nl",
          content:
            "Post van 01:12: 'Hoor van meerdere kanten dat er iets speelt bij een Nederlandse " +
            "MDR-partij. Iemand meer info?' Drie reacties, geen namen, geen onderbouwing. " +
            "Twee van de reageerders zijn bekende doemdenkers.",
          classification: "aanname",
          facilitatorNote:
            "Ruis zonder waarde, maar hij verhoogt de druk. Wie hierop handelt, laat zich " +
            "leiden door de buitenwereld in plaats van door eigen telemetrie.",
        },
      ],
    },

    // ── R2 ───────────────────────────────────────────────────────────────
    {
      title: "R2 — Zaterdag 06:30, het is geen rotatie",
      situation:
        "06:30. Opschalen op een onvolledig signaal was vannacht de keuze, en wie dat deed zit nu " +
        "met meer mensen aan tafel. De keuze van vannacht bepaalt dus met wie je " +
        "nu aan tafel zit. Inmiddels is duidelijk dat de verklaring van de piketengineer niet " +
        "klopt. Er is beweging geweest in het beheerplatform, en de vraag is niet meer of dit " +
        "een incident is. De vraag is wat je eerst beschermt: onze eigen omgeving of het " +
        "vertrouwen van de klanten die erachter hangen. Jullie hebben twintig minuten.",
      timerMinutes: 20,
      decisionAuthorId: "eye-d2-eigen-of-klant",
      discussionGoal:
        "Toets of het team durft te kiezen tussen eigen containment en klantvertrouwen, en " +
        "of ze beseffen dat afsluiten van het platform de klanten blind maakt.",
      keyQuestions: [
        "Wat gebeurt er bij de klant als wij ons platform nu uitzetten?",
        "Wie bepaalt of wij onze eigen detectie offline halen?",
        "Welke klanten zijn als eerste aan de beurt, en waarom die?",
      ],
      hints: [
        "Vraag wat het contract belooft over reactietermijnen — en of dat nog haalbaar is.",
        "De reflex is 'alles dicht'. Vraag wat dat voor 180 klanten betekent.",
      ],
      expectedDecisions: ["Eigen containment eerst, of klantzicht overeind houden?"],
      redFlags: [
        "Het platform gaat dicht zonder dat iemand de klantgevolgen benoemt.",
        "Niemand vraagt of de aanvaller al in klantomgevingen is geweest.",
      ],
      openingPrompts: [
        "Wie zit er nu aan tafel, en wie mist er door de keuze van vannacht?",
        "Wat is op dit moment onze belangrijkste belofte aan klanten?",
      ],
      reviewPrompts: [
        "Heeft het team de klantgevolgen expliciet gewogen of alleen de eigen omgeving?",
        "Wat had een extra persoon aan tafel vannacht hier opgeleverd?",
      ],
      facilitatorPerspective:
        "Hier wordt zichtbaar wat ronde 1 heeft gekost. Teams die hebben opgeschaald hebben " +
        "nu mensen; teams die hebben gewacht lopen achter en moeten eerst bijpraten.",
      injects: [
        {
          id: "eye-r2-i1",
          type: "alert",
          urgency: "critical",
          title: "Forensiek: agentbeleid aangepast bij elf klant-tenants",
          senderName: "Eigen forensiek — eerste beeld",
          source: "Eye Security IR",
          content:
            "De certificaatrotatie heeft vrijdag wél gelopen en is 20:14 afgerond; het signaal " +
            "van vannacht is dus niet te verklaren. Eerste beeld: met svc-agentpolicy is " +
            "tussen 02:31 en 03:50 het agentbeleid aangepast bij elf klant-tenants. De " +
            "wijziging zet detectie-uitsluitingen op twee directories — precies de mappen " +
            "waar een aanvaller zijn gereedschap zou neerzetten. Geen bewijs van verdere " +
            "beweging in die tenants, maar ook geen bewijs van het tegendeel: onze eigen " +
            "telemetrie is daar juist uitgezet. Wat wij nu van jullie nodig hebben is één " +
            "lijn, en beide kan niet: halen wij het beheerplatform offline om dit te stoppen, " +
            "of houden wij het in de lucht zodat klanten zicht houden en wij kunnen blijven " +
            "kijken?",
          classification: "feit",
          setsUpDecisionNodeId: "eye-d2-eigen-of-klant",
          triggersRegulatoryNotification: true,
          nis2Relevant: true,
          facilitatorNote:
            "Setup-inject die op de beslisvraag eindigt. Let op het detail dat de uitsluitingen " +
            "onze eigen ogen dichtdoen — 'geen bewijs' betekent hier niet 'niets gebeurd'.",
        },
        {
          id: "eye-r2-i2",
          type: "executive",
          urgency: "high",
          title: "Klant vraagt of zijn omgeving veilig is",
          senderName: "CISO — klant uit de top 10",
          content:
            "Mail van 06:12: 'Wij zien vannacht policy-wijzigingen in onze tenant die wij niet " +
            "hebben aangevraagd. Komen die van jullie? Zo niet, dan hebben wij een probleem. " +
            "Wij verwachten binnen het uur antwoord — dat staat zo in ons contract.' Deze " +
            "klant is zelf een essentiële entiteit onder NIS2 en heeft dus zijn eigen " +
            "24-uurs klok, die begint te lopen op het moment dat wij hem iets vertellen.",
          classification: "feit",
          facilitatorNote:
            "Dit is de keten die terugbelt. De klant heeft het zelf gezien; zwijgen is geen " +
            "optie meer, alleen nog timing.",
        },
        {
          id: "eye-r2-i3",
          type: "internal",
          urgency: "medium",
          title: "Accountmanagement: 'niet melden tot we zeker zijn'",
          senderName: "Commercieel directeur",
          content:
            "Bericht van 06:20: 'Laten we wachten met klantcommunicatie tot we het hele beeld " +
            "hebben. Half nieuws richting 180 klanten kost ons meer dan het oplevert, en de " +
            "contractuele termijn geldt pas bij een vastgesteld incident.' Juridisch is die " +
            "laatste bewering niet nagekeken.",
          classification: "aanname",
          facilitatorNote:
            "Een verdedigbaar klinkende redenering die op een onjuiste contractlezing rust. " +
            "Vraag wie het contract er daadwerkelijk bij heeft gehaald.",
        },
        {
          id: "eye-r2-i4",
          type: "internal",
          urgency: "low",
          title: "Analist meldt oude verkenning in de logs",
          senderName: "SOC-analist dagdienst",
          content:
            "Bij het terugkijken valt op dat hetzelfde bron-IP drie weken geleden al twee keer " +
            "een mislukte authenticatie deed op hetzelfde account. Beide keren zijn als " +
            "'brute force, geblokkeerd' afgehandeld en gesloten. Er is toen geen onderzoek " +
            "gedaan en niemand is geïnformeerd.",
          classification: "feit",
          facilitatorNote:
            "De zwakte die eerder is weggeklikt. Komt in ronde 5 terug als de verandering die " +
            "je vastlegt.",
        },
      ],
    },

    // ── R3 ───────────────────────────────────────────────────────────────
    {
      title: "R3 — Zaterdag 11:00, de klok van de klant loopt",
      situation:
        "11:00. Containment ging vanmorgen vóór of ná het zicht van de klant, en wat jullie daar " +
        "hebben gekozen " +
        "staat nu op papier en de buitenwereld begint te reageren. Het bijzondere van ons " +
        "vak komt hier hard binnen: onze klanten hebben hun eigen meldplichten, en die " +
        "klokken beginnen te lopen op het moment dat wij hen informeren. Niet eerder, en " +
        "niet later. Jullie hebben twintig minuten om te bepalen wie namens Eye Security " +
        "spreekt en wat er vandaag de deur uit gaat.",
      timerMinutes: 20,
      decisionAuthorId: "eye-d3-melden",
      discussionGoal:
        "Toets of het team begrijpt dat het als leverancier twee meldplichten tegelijk " +
        "bedient: de eigen, en die van elke klant die op ons bericht wacht.",
      keyQuestions: [
        "Welke melding is van ons, en welke is van de klant?",
        "Wie spreekt namens Eye Security, en wie juist niet?",
        "Wat zeg je tegen een klant van wie je nog niet weet of hij geraakt is?",
      ],
      hints: [
        "Laat ze onderscheiden: eigen NIS2-melding, AVG-rol als verwerker, en de klant als verwerkingsverantwoordelijke.",
        "Vraag of één bericht naar alle klanten kan, of dat het per klant moet.",
      ],
      expectedDecisions: ["Wie spreekt namens ons, en welke meldingen gaan vandaag uit?"],
      redFlags: [
        "Alle klanten krijgen hetzelfde bericht, ook de elf die aantoonbaar geraakt zijn.",
        "De eigen melding wordt uitgesteld tot het beeld rond is.",
      ],
      openingPrompts: [
        "Wie heeft op dit moment formeel de woordvoering?",
        "Welke termijn loopt het eerst af, en van wie is die?",
      ],
      reviewPrompts: [
        "Is er onderscheid gemaakt tussen de elf getroffen klanten en de rest?",
        "Hebben jullie de klanten in staat gesteld hun eigen klok te starten?",
      ],
      facilitatorPerspective:
        "De valkuil is één generiek bericht. De elf getroffen klanten hebben andere " +
        "informatie nodig dan de overige 169, en dat onderscheid maken kost tijd die " +
        "niemand heeft.",
      injects: [
        {
          id: "eye-r3-i1",
          type: "regulatory",
          urgency: "critical",
          title: "NCSC vraagt om onze eigen melding",
          senderName: "NCSC — meldpunt",
          source: "Nationaal Cyber Security Centrum",
          content:
            "Wij ontvingen via een derde partij signalen over een mogelijk incident bij Eye " +
            "Security. Als aanbieder van beheerde beveiligingsdiensten bent u essentiële " +
            "entiteit onder NIS2: de vroegtijdige waarschuwing geldt binnen 24 uur na " +
            "bekendwording. Daarnaast wijzen wij op uw rol in de keten — uw klanten kunnen " +
            "zelf meldplichtig zijn en hebben uw informatie nodig om die termijn te halen. " +
            "Wat wij vandaag van u nodig hebben is twee dingen: uw eigen melding, en de lijst " +
            "van getroffen afnemers. Wie is bij u het aanspreekpunt, en gaat die melding " +
            "vandaag de deur uit of wacht u het forensische beeld af?",
          classification: "feit",
          setsUpDecisionNodeId: "eye-d3-melden",
          triggersRegulatoryNotification: true,
          nis2Relevant: true,
          facilitatorNote:
            "Setup-inject, eindigt op de beslisvraag. Let op dat het NCSC twee dingen vraagt: " +
            "een eigen melding én de ketenlijst.",
        },
        {
          id: "eye-r3-i2",
          type: "media",
          urgency: "high",
          title: "Vakjournalist heeft het verhaal",
          senderName: "Redactie — vakmedium",
          content:
            "Mail van 10:40: 'Wij hebben van twee onafhankelijke bronnen dat er bij Eye " +
            "Security vannacht is ingebroken op een beheerplatform met toegang tot " +
            "klantomgevingen. Wij publiceren vandaag om 17:00. Wilt u reageren?' De " +
            "journalist noemt één klantnaam die niet op de lijst van elf staat.",
          classification: "feit",
          facilitatorNote:
            "De deadline van buiten. De verkeerde klantnaam is het interessante: reageren op " +
            "die naam bevestigt informatie die niet klopt.",
        },
        {
          id: "eye-r3-i3",
          type: "internal",
          urgency: "medium",
          title: "Concept-klantbericht gaat rond",
          senderName: "Marketing",
          content:
            "In de groep circuleert een concept: 'Wij hebben een beveiligingsincident " +
            "gedetecteerd en direct opgetreden. Er zijn geen aanwijzingen dat klantgegevens " +
            "zijn geraakt.' Die laatste zin is er door marketing ingezet. Forensiek heeft dat " +
            "niet gezegd en kan het ook niet zeggen — de telemetrie in die tenants stond uit.",
          classification: "aanname",
          facilitatorNote:
            "Hier wordt een aanname tot feit gemaakt in een extern bericht. Dit is de " +
            "gevaarlijkste inject van de ronde.",
        },
        {
          id: "eye-r3-i4",
          type: "executive",
          urgency: "medium",
          title: "Klant dreigt met opzegging",
          senderName: "Inkoopdirecteur — grote klant",
          content:
            "Telefoon van 10:55: 'Als wij vandaag geen helder antwoord krijgen, schorten wij " +
            "de dienst op en gaan wij over op onze fallback. Dat betekent dat jullie agents " +
            "er bij ons vanavond uit gaan.' Deze klant staat niet op de lijst van elf.",
          classification: "feit",
          facilitatorNote:
            "Commerciële druk op het moment dat je hem het minst kunt gebruiken. Let op of het " +
            "team zich hierdoor laat afleiden van de elf die écht geraakt zijn.",
        },
      ],
    },

    // ── R4 ───────────────────────────────────────────────────────────────
    {
      title: "R4 — Maandag 08:00, bij één klant is het echt gebeurd",
      situation:
        "Maandagochtend 08:00. Twee berichten of één — de lijn die jullie zaterdag in de " +
        "communicatie hebben gekozen, " +
        "wordt vandaag getoetst aan wat er feitelijk blijkt. Het forensische beeld per tenant " +
        "is niet overal hetzelfde, en dat heeft gevolgen. Tegelijk staat de maandagochtend vol: " +
        "180 klanten die weer aan het werk gaan, een platform dat nog niet volledig " +
        "vertrouwd is, en een team dat het weekend heeft doorgewerkt. Jullie hebben twintig " +
        "minuten om te bepalen waar mensen en geld nu naartoe gaan.",
      timerMinutes: 20,
      decisionAuthorId: "eye-d4-prioriteit",
      discussionGoal:
        "Toets of het team durft te prioriteren tussen één zwaar geraakte klant en de " +
        "dienstverlening aan alle andere — en of ze de eigen mensen niet vergeten.",
      keyQuestions: [
        "Zetten wij ons beste IR-team bij één klant of houden we de dienst voor allemaal overeind?",
        "Wie betaalt het herstel bij de klant, en op grond waarvan?",
        "Wie van ons eigen team werkt nu te lang door?",
      ],
      hints: [
        "Vraag of de contracten iets zeggen over herstel bij een incident dat bij ons is begonnen.",
        "Let op of iemand de verzekeraar noemt. En wanneer.",
      ],
      expectedDecisions: ["Waar gaan mensen en geld nu naartoe?"],
      redFlags: [
        "Het beste team gaat naar de klant die het hardst roept, niet naar de zwaarst geraakte.",
        "Niemand benoemt dat eigen mensen 30 uur op zijn.",
      ],
      openingPrompts: [
        "Wat is vanmorgen onze grootste blootstelling: één klant of alle klanten?",
        "Wie houdt de eigen mensen in de gaten?",
      ],
      reviewPrompts: [
        "Is er een expliciete keuze gemaakt of is het bij iedereen een beetje geworden?",
        "Hoe is de aansprakelijkheid richting de geraakte klant behandeld?",
      ],
      facilitatorPerspective:
        "De verleiding is overal een beetje doen. Dat is hier de slechtste variant: dan is " +
        "de geraakte klant niet geholpen en de rest ook niet.",
      injects: [
        {
          id: "eye-r4-i1",
          type: "alert",
          urgency: "critical",
          title: "Laterale beweging bij klant via onze agent",
          senderName: "IR-lead",
          source: "Eye Security IR",
          content:
            "Bij één van de elf klanten, een zorginstelling, is het niet bij de policy-wijziging " +
            "gebleven. Via de detectie-uitsluiting is gereedschap neergezet en is er beweging " +
            "naar twee servers met patiëntgegevens. De klant weet dit nog niet; wij zien het " +
            "als eerste, in onze eigen telemetrie. Dit betekent dat er bij hen een datalek " +
            "speelt waarvoor zij verwerkingsverantwoordelijke zijn en wij verwerker — en dat " +
            "onze toegang de weg naar binnen was. Wat wij vandaag van jullie nodig hebben is " +
            "een lijn, en met de mensen die er zijn kan niet beide: zetten wij ons zwaarste " +
            "team bij deze ene klant, of houden wij de dienst voor de overige klanten op niveau?",
          classification: "feit",
          setsUpDecisionNodeId: "eye-d4-prioriteit",
          triggersRegulatoryNotification: true,
          facilitatorNote:
            "Setup-inject die op de beslisvraag eindigt. Let op de verwerker-rol: wij moeten de " +
            "klant in staat stellen te melden, niet zelf melden.",
        },
        {
          id: "eye-r4-i2",
          type: "internal",
          urgency: "high",
          title: "Verzekeraar vraagt om het dossier",
          senderName: "Risicomanager",
          content:
            "Onze eigen cyberpolis dekt aansprakelijkheid richting klanten, maar de polis eist " +
            "melding binnen 24 uur na bekendwording en bewaring van forensisch bewijs. De klok " +
            "liep vanaf zaterdagnacht. Of die melding inmiddels is gedaan, kan niemand in deze " +
            "groep bevestigen.",
          classification: "feit",
          facilitatorNote:
            "Een termijn die al loopt en waarvan niemand de stand kent. Vraag wie dit oppakt.",
        },
        {
          id: "eye-r4-i3",
          type: "internal",
          urgency: "high",
          title: "Twee analisten zijn 30 uur op",
          senderName: "Teamlead SOC",
          content:
            "De twee analisten die dit vannacht hebben opgepakt werken sinds zaterdag 02:00 " +
            "door, met twee uur slaap. Een van hen heeft net een verkeerde tenant-id in een " +
            "ticket gezet. Er is geen aflossingsschema voor een incident dat langer dan een " +
            "dienst duurt.",
          classification: "feit",
          facilitatorNote:
            "Het personele risico dat in elke oefening wordt vergeten. De fout in het ticket is " +
            "het signaal, niet de vermoeidheid zelf.",
        },
        {
          id: "eye-r4-i4",
          type: "social",
          urgency: "low",
          title: "Concurrent gebruikt het verhaal",
          senderName: "@mdr_alternatief",
          content:
            "LinkedIn-post van een concurrent: 'Dit is precies waarom je je MDR-leverancier " +
            "moet kiezen op architectuur en niet op prijs.' 140 reacties. Twee van onze " +
            "klanten reageren eronder met een vraag.",
          classification: "aanname",
          facilitatorNote:
            "Ruis die commercieel pijn doet en operationeel niets betekent. Let op of iemand er " +
            "tijd in wil stoppen.",
        },
      ],
    },

    // ── R5 ───────────────────────────────────────────────────────────────
    {
      title: "R5 — Dinsdag, wat leggen we vast",
      situation:
        "Dinsdagmiddag. Aflossingsschema of doorwerken: de keuze van maandag over mensen en geld " +
        "is uitgevoerd. Het platform is opnieuw opgebouwd, de meldingen staan, en de keuze " +
        "die jullie maandag over mensen en geld hebben gemaakt, is uitgevoerd. Wat er nu " +
        "gebeurt bepaalt of deze week iets oplevert of alleen geld heeft gekost. Er liggen " +
        "drie dingen op tafel die deze week zijn opgevallen en die niemand eerder had " +
        "geagendeerd. Jullie hebben vijftien minuten om te bepalen wat je vastlegt, met wie " +
        "erop en wanneer.",
      timerMinutes: 15,
      decisionAuthorId: "eye-d5-vastleggen",
      discussionGoal:
        "Toets of het team één verandering vastlegt met eigenaar en datum, in plaats van drie " +
        "zonder.",
      keyQuestions: [
        "Wat is over drie maanden aantoonbaar anders?",
        "Wie wordt daarop afgerekend?",
        "Wat vertellen we onze klanten over wat wij hebben veranderd?",
      ],
      hints: [
        "Vraag naar een naam en een datum. Zonder die twee is het een intentie.",
        "Let op of de drie zwaktes van deze week terugkomen: het service-account zonder MFA, de weggeklikte verkenning, en het ontbrekende aflossingsschema.",
      ],
      expectedDecisions: ["Welke verandering leggen we vast, met welke eigenaar en datum?"],
      redFlags: [
        "Alles wordt vastgelegd, dus niets.",
        "De evaluatie wordt een vergadering in plaats van een eigenaar.",
      ],
      openingPrompts: [
        "Noem de drie dingen die deze week zijn opgevallen.",
        "Welke daarvan zou dit incident hebben voorkomen?",
      ],
      reviewPrompts: [
        "Staat er een naam en een datum bij?",
        "Wat vertellen jullie de geraakte klant over wat er verandert?",
      ],
      facilitatorPerspective:
        "Het enige dat na een crisis nog beweegt is een eigenaar met een deadline. Laat het " +
        "team dat zelf benoemen in plaats van het voor te zeggen.",
      injects: [
        {
          id: "eye-r5-i1",
          type: "internal",
          urgency: "high",
          title: "Drie zwaktes op één A4",
          senderName: "CISO — concept-evaluatie",
          content:
            "Het concept van de evaluatie zet drie dingen naast elkaar. Eén: svc-agentpolicy " +
            "is een machine-account met certificaat en zonder afdwingbare MFA, en het heeft " +
            "schrijfrechten in 180 tenants. Twee: dezelfde bron heeft drie weken eerder al " +
            "geprobeerd binnen te komen en dat is als 'brute force, geblokkeerd' gesloten " +
            "zonder onderzoek. Drie: er was geen aflossingsschema, dus twee analisten hebben " +
            "30 uur doorgewerkt en er is een fout in een ticket gekomen. Wat het bestuur nu " +
            "moet bepalen is niet welke van de drie waar is — dat zijn ze alle drie — maar " +
            "welke verandering jullie vastleggen met een eigenaar en een datum. Wat wordt het, wie " +
            "zetten jullie erop, en per wanneer?",
          classification: "feit",
          setsUpDecisionNodeId: "eye-d5-vastleggen",
          facilitatorNote:
            "Setup-inject, eindigt op de beslisvraag. De drie zwaktes zijn in ronde 1, 2 en 4 " +
            "gezaaid; teams die ze herkennen hebben goed opgelet.",
        },
        {
          id: "eye-r5-i2",
          type: "executive",
          urgency: "medium",
          title: "Geraakte klant wil een verbeterplan zien",
          senderName: "Bestuurder — zorginstelling",
          content:
            "Mail: 'Wij blijven klant, maar wij willen voor 1 december schriftelijk zien wat " +
            "er aan jullie kant verandert, met wie daarvoor verantwoordelijk is. Onze eigen " +
            "toezichthouder zal daar om vragen.' Deze klant is de zwaarst geraakte.",
          classification: "feit",
          facilitatorNote:
            "Externe druk op het eigenaarschap. Dit is wat 'vastleggen' concreet maakt.",
        },
        {
          id: "eye-r5-i3",
          type: "internal",
          urgency: "low",
          title: "Voorstel: securityweek organiseren",
          senderName: "HR",
          content:
            "Voorstel om in januari een interne securityweek te organiseren met workshops en " +
            "een phishingtest. Goedbedoeld, maar het raakt geen van de drie zwaktes die deze " +
            "week zichtbaar werden.",
          classification: "aanname",
          facilitatorNote:
            "Ruis die als actie voelt. Teams die hier instappen hebben de analyse niet gemaakt.",
        },
        {
          id: "eye-r5-i4",
          type: "internal",
          urgency: "medium",
          title: "Kosten tot nu toe",
          senderName: "Controller",
          content:
            "Voorlopige rekening: 340 uur eigen inzet buiten dienst, externe forensiek ingehuurd " +
            "voor de klantkant, één klant die de dienst tijdelijk had opgeschort en inmiddels " +
            "terug is, en twee klanten die hun contract heronderhandelen. De verzekeringsclaim " +
            "is in behandeling.",
          classification: "feit",
          facilitatorNote:
            "Geeft de kostenas een getal. Handig in de nabespreking als iemand zegt dat " +
            "opschalen te duur was.",
        },
      ],
    },
  ],

  decisions: [
    // ── D1 — alarmeren ─────────────────────────────────────────────────
    //
    // Het eerste beslispunt gaat niet over techniek maar over wie je wakker
    // maakt. Alléén CISO en IT-manager hebben hier opties: dat zijn de twee
    // die om 02:48 bereikbaar zijn. De overige rollen staan op adviseren en
    // merken in ronde 2 wat deze keuze hun heeft gekost.
    {
      afterRoundIndex: 0,
      authorId: "eye-d1-alarmeren",
      prompt: "Na R1 — Wie alarmeer je nu, wie laat je slapen, en wie neemt dat besluit?",
      context:
        "Het is 02:48. Je hebt één hard signaal op een service-account met schrijfrechten in 180 " +
        "klant-tenants, een piketengineer die het wegwuift als certificaatrotatie, en twee " +
        "performance-tickets die niemand eraan heeft gekoppeld. Deze keuze gaat over opschalen " +
        "en mandaat — niet over containment of klantcommunicatie, die komen in de volgende " +
        "rondes. Kijk in je documenten wat jouw rol hier mag besluiten.",
      facilitatorRationale:
        "De beste optie schaalt op vóórdat het beeld rond is en legt vast wie het besluit nam: " +
        "je koopt mensen en tijd terug voor de prijs van een vals alarm. De tweede optie is " +
        "verdedigbaar — eerst zelf verifiëren met één extra persoon — maar laat het mandaat " +
        "impliciet, en om 05:00 weet dan niemand wie er beslist. Zet die twee naast elkaar: " +
        "wat kost een vals alarm, en wat kost twee uur stilte in 180 tenants? De onderste twee " +
        "wachten op bevestiging, en precies die bevestiging is wat de aanvaller aan het " +
        "wegpoetsen is.",
      perRole: true,
      options: [
        optie("ciso", "best",
          "Crisisteam nu wekken en zelf het incidentmandaat pakken",
          "Je belt CEO, Legal en Operations wakker, verklaart dit een incident en legt in het " +
            "logboek vast dat jij het besluit hebt genomen.",
          "De scherpste keuze: hij kost een nacht slaap van zes mensen en koopt daarmee " +
            "handelingsruimte in 180 klantomgevingen. Vraag het team wat een vals alarm hier " +
            "feitelijk kost.",
          "Opschalen op een onvolledig signaal is goedkoper dan wachten op zekerheid.",
          { capabilityFlag: CRISISTEAM_OPGESCHAALD, consumesOptionAfterUse: true }),
        optie("ciso", "good",
          "Eerst de piketengineer laten verifiëren of de rotatie echt heeft gelopen",
          "Je wekt alleen de platformengineer, laat de changekalender en de auditlogs naast " +
            "elkaar leggen, en besluit daarna over opschalen.",
          "Verdedigbaar en snel te doen — en het is precies de vraag die de aanname onderuit " +
            "haalt. Maar het mandaat blijft open: vraag wie beslist als die verificatie om " +
            "04:30 nog loopt.",
          "Een aanname natrekken is goed; het mandaat erbij vastleggen is beter.",
          { capabilityFlag: CRISISTEAM_OPGESCHAALD }),
        optie("ciso", "poor",
          "Het service-account meteen blokkeren en verder niets doen",
          "Je trekt het certificaat van svc-agentpolicy in, waardoor agentbeleid niet meer " +
            "uitrolt, en wacht met alarmeren tot maandag.",
          "Technisch de juiste reflex, organisatorisch de verkeerde: je stopt de aanvaller " +
            "misschien en maakt tegelijk 180 klanten blind, zonder dat iemand het weet. Vraag " +
            "wie de klant belt als die om 09:00 belt.",
          "Een technische maatregel zonder opschaling is een stille storing met jouw naam erop.",
        ),
        optie("ciso", "wrong",
          "Wachten tot de dagdienst om 08:00 begint",
          "Je laat het ticket open staan met een notitie voor de ochtendploeg en gaat verder " +
            "met de reguliere piketdienst.",
          "De valkuil van deze ronde. Vijf uur stilte in een platform met schrijfrechten in " +
            "180 tenants. Laat het team zelf benoemen wat er in die vijf uur gebeurt.",
          "De nacht is geen wachtkamer: een ketenpositie kent geen kantooruren.",
        ),
        optie("it_manager", "best",
          "Auditlogs van het beheerplatform nu veiligstellen en de CISO wekken",
          "Je exporteert en hasht de logs van het beheerplatform voordat er iets verandert, en " +
            "belt daarna de CISO met wat je ziet.",
          "Dit is de enige onomkeerbare stap van de nacht: logs die je nu niet bewaart, bestaan " +
            "straks niet meer. En hij kost vijf minuten.",
          "Bewijs bewaren kan alleen vóóraf; alles daarna is reconstructie.",
          { capabilityFlag: CRISISTEAM_OPGESCHAALD }),
        optie("it_manager", "good",
          "Het onderhoudsvenster en de changekalender naast de auditlogs leggen",
          "Je zoekt uit of de certificaatrotatie vrijdag daadwerkelijk is afgerond en legt dat " +
            "schriftelijk vast voordat je iemand belt.",
          "Precies de juiste vraag, en hij haalt de verklaring van de piketengineer onderuit. " +
            "Vraag alleen hoe lang hij erover mag doen voordat hij toch belt.",
          "De makkelijkste verklaring verdient de eerste controle, niet het laatste woord.",
        ),
        optie("it_manager", "poor",
          "De twee performance-tickets vast doorzetten naar de dagdienst",
          "Je koppelt de trage agents bij Rotterdam en Gent aan het identity-signaal in een " +
            "ticket en laat het bij de ochtendploeg landen.",
          "De koppeling is scherp gezien — en dan belandt hij in een wachtrij. Vraag wat een " +
            "ticket vannacht nog oplevert.",
          "Een juiste observatie in de verkeerde wachtrij is hetzelfde als geen observatie.",
        ),
        optie("it_manager", "wrong",
          "De piketengineer volgen: dit is de certificaatrotatie",
          "Je neemt de verklaring over, zet het ticket op 'verwacht gedrag' en sluit het af " +
            "zonder het na te kijken.",
          "De valkuil. Een zelfverzekerd klinkende collega om 02:41 is geen bron. Laat het team " +
            "benoemen hoe je dit had kunnen checken in twee minuten.",
          "Zekerheid in iemands stem is geen bewijs in je logboek.",
        ),
        geenBesluit("Niemand pakte het mandaat en de analist bleef alleen achter."),
      ],
    },

    // ── D2 — eigen omgeving of klantzicht ──────────────────────────────
    {
      afterRoundIndex: 1,
      authorId: "eye-d2-eigen-of-klant",
      prompt: "Na R2 — Halen we het beheerplatform offline, of houden we klantzicht overeind?",
      context:
        "Het agentbeleid is bij elf klant-tenants aangepast en er staan detectie-uitsluitingen " +
        "op precies de mappen waar gereedschap zou landen. Onze eigen telemetrie is daar dus " +
        "uitgezet: 'geen bewijs van beweging' betekent hier niets. Eén klant heeft het zelf " +
        "gezien en wil binnen het uur antwoord. Deze keuze gaat over wat je eerst beschermt — " +
        "niet over wie het bericht schrijft, dat is de volgende ronde.",
      facilitatorRationale:
        "De beste optie knipt de aanvaller eruit zónder de klanten blind te maken: je rolt de " +
        "policy-wijzigingen terug en isoleert het account, maar laat de detectie staan. De " +
        "tweede optie haalt het hele platform offline — veilig en eerlijk, en het kost 180 " +
        "klanten hun zicht op een zaterdag. Vraag welke van de twee ze maandag aan een klant " +
        "willen uitleggen. De onderste twee houden alles in de lucht om de dienst niet te " +
        "raken, en laten daarmee de uitsluitingen staan die ons eigen oog dichthouden.",
      perRole: true,
      options: [
        optie("ciso", "best",
          "Policy-wijzigingen terugdraaien en het account isoleren, detectie blijft staan",
          "Je herstelt het agentbeleid bij de elf tenants, trekt het certificaat in en zet een " +
            "aparte monitoring op die elf, zonder de dienst voor de rest te raken.",
          "De scherpste keuze: hij haalt de uitsluitingen weg waardoor je weer kunt kijken, en " +
            "houdt de klanten bediend. Kost wel een handmatige actie per tenant.",
          "Containment hoeft niet alles-of-niets te zijn als je per tenant kunt werken.",
        ),
        optie("ciso", "good",
          "Het hele beheerplatform offline halen tot het opnieuw is opgebouwd",
          "Je zet het multi-tenant beheerplatform uit. Niemand kan meer policies pushen, " +
            "inclusief wij, en klanten verliezen tijdelijk een deel van hun detectie.",
          "Eerlijk en veilig, en het is de duurste variant: 180 klanten verliezen zicht op een " +
            "zaterdag. Vraag of ze dat aan de klant die net mailde kunnen uitleggen.",
          "Alles dichtzetten is veilig voor ons en onveilig voor de klant.",
        ),
        optie("ciso", "poor",
          "Alleen scherper monitoren op de elf tenants, niets terugdraaien",
          "Je laat het agentbeleid staan en zet extra monitoring op de elf tenants om te zien " +
            "of er iets gebeurt.",
          "Monitoring op een omgeving waar jouw detectie-uitsluitingen nog staan is kijken met " +
            "een hand voor je ogen. Vraag wat ze verwachten te zien.",
          "Je kunt niet monitoren wat je zelf hebt uitgesloten.",
        ),
        optie("ciso", "wrong",
          "Wachten tot de forensiek het volledige beeld heeft",
          "Je laat alles zoals het is tot forensiek kan zeggen wat er precies is gebeurd, en " +
            "informeert ondertussen niemand.",
          "De valkuil. De uitsluitingen blijven staan, dus het volledige beeld komt er juist " +
            "níet. Laat het team dat zelf vaststellen.",
          "Wachten op een compleet beeld werkt niet als de aanvaller je ogen heeft dichtgedaan.",
        ),
        optie("ops_manager", "best",
          "Degradatiescenario starten: handmatige respons voor de elf, dienst voor de rest",
          "Je zet een tijdelijke werkwijze op waarbij de elf getroffen tenants handmatig door " +
            "analisten worden bediend en de overige 169 op de normale dienst blijven.",
          "Dit is de keuze die het onderscheid maakt tussen getroffen en niet-getroffen klanten, " +
            "en dat onderscheid draagt de hele rest van de oefening.",
          "Een degradatiescenario is pas een scenario als het per klant verschilt.",
        ),
        optie("ops_manager", "good",
          "Alle klanten tijdelijk op handmatige respons zetten",
          "Je schakelt de hele portefeuille over naar handmatige respons door het SOC, zodat " +
            "niemand van het beheerplatform afhankelijk is.",
          "Veilig en uitvoerbaar voor een dag, niet voor een week. Vraag hoe lang ze dit met de " +
            "huidige bezetting denken te volhouden.",
          "Handmatig werkt één dienst; daarna is het een personeelsprobleem.",
        ),
        optie("ops_manager", "poor",
          "Pas iets veranderen als een klant erom vraagt",
          "Je houdt de dienst ongewijzigd en reageert per klant als die zelf aan de bel trekt.",
          "Reactief op een zaterdag betekent dat de hardst roepende klant geholpen wordt en de " +
            "zwaarst geraakte niet. Vraag wie dan als eerste geholpen wordt.",
          "Wie wacht tot de klant belt, laat de volgorde door volume bepalen.",
        ),
        optie("ops_manager", "wrong",
          "De dienst volledig ongewijzigd doorzetten, dit is een platformprobleem",
          "Je beschouwt dit als iets voor het platformteam en verandert niets in de " +
            "dienstverlening of de bezetting.",
          "De valkuil. Het platform ís de dienst. Laat het team benoemen wat er misgaat als de " +
            "analisten doorwerken op telemetrie die is uitgezet.",
          "Bij een MDR-leverancier is een platformprobleem altijd een dienstprobleem.",
        ),
        optie("ceo", "best",
          "Besluit nemen en vastleggen: containment gaat vóór commercieel ongemak",
          "Je legt vast dat technische containment nu voorgaat, dat de kosten daarvan voor " +
            "onze rekening zijn, en dat Legal de contractuele kant uitzoekt.",
          "Geeft het team dekking om te handelen. Zonder dit besluit blijft iedereen naar de " +
            "commerciële gevolgen kijken in plaats van naar de aanvaller.",
          "Een expliciet bestuursbesluit is wat een team van aarzelen afhoudt.",
        ),
        optie("ceo", "good",
          "Eerst de top-10 klanten persoonlijk bellen, daarna besluiten",
          "Je belt zelf de tien grootste klanten voordat er iets verandert in de dienst, zodat " +
            "zij het van jou horen.",
          "Sterk op vertrouwen, zwak op tempo: tien gesprekken kosten twee uur die de aanvaller " +
            "ook heeft. Vraag wie er ondertussen beslist.",
          "Persoonlijk bellen koopt vertrouwen en kost tijd; weet wat je inruilt.",
        ),
        optie("ceo", "poor",
          "Het besluit bij de CISO laten en zelf de commerciële kant pakken",
          "Je houdt je bij klanten en pers en laat de technische keuze volledig aan de CISO.",
          "Verdedigbare rolverdeling die hier knelt: de keuze raakt 180 contracten, dus hij is " +
            "niet alleen technisch. Vraag wie de afweging dan maakt.",
          "Een keuze die contracten raakt is geen technische keuze.",
        ),
        optie("ceo", "wrong",
          "Niets naar buiten en niets veranderen tot het beeld rond is",
          "Je houdt alles intern en wacht met elk besluit tot forensiek klaar is.",
          "De valkuil. Een klant heeft het al gezien en de pers is al aan het bellen. Laat het " +
            "team benoemen wie het verhaal dan vertelt.",
          "Als de klant het eerder ziet dan jij het vertelt, ben je de regie al kwijt.",
        ),
        geenBesluit("De uitsluitingen bleven staan terwijl het team overlegde."),
      ],
    },

    // ── D3 — melden en woordvoering ────────────────────────────────────
    {
      afterRoundIndex: 2,
      authorId: "eye-d3-melden",
      prompt: "Na R3 — Wie spreekt namens ons, en welke meldingen gaan vandaag de deur uit?",
      context:
        "Het NCSC vraagt onze eigen melding én de lijst van getroffen afnemers. Een vakmedium " +
        "publiceert om 17:00 en noemt een klantnaam die níet geraakt is. Intern circuleert een " +
        "concept waarin staat dat er geen aanwijzingen zijn dat klantgegevens zijn geraakt — " +
        "iets wat forensiek niet heeft gezegd en ook niet kan zeggen. Deze keuze gaat over " +
        "woordvoering en meldingen, niet over herstel.",
      facilitatorRationale:
        "De beste optie splitst het bericht: de elf getroffen klanten krijgen wat ze nodig " +
        "hebben om hun eigen klok te starten, de overige 169 krijgen een ander bericht, en de " +
        "eigen NIS2-melding gaat vandaag met wat we nu weten. De tweede optie stuurt één " +
        "zorgvuldig bericht naar iedereen — sneller en eerlijk, en het laat de zwaarst " +
        "geraakte klanten zonder de details waarmee zij moeten melden. Leg die twee naast " +
        "elkaar aan de hand van één vraag: wie moet er vanavond kunnen melden, en heeft die " +
        "daarvoor genoeg van ons gekregen?",
      perRole: true,
      options: [
        optie("legal", "best",
          "Eigen NIS2-melding vandaag, plus per getroffen klant een meldbaar feitenrelaas",
          "Je stuurt de vroegtijdige waarschuwing met het huidige beeld en levert de elf " +
            "getroffen klanten een feitenrelaas waarmee zij zelf kunnen melden.",
          "Twee plichten tegelijk goed bediend: de onze en de hunne. Benoem dat wij verwerker " +
            "zijn en de klant verwerkingsverantwoordelijke — wij melden niet voor hen.",
          "Als leverancier meld je niet namens je klant, je stelt hem in staat te melden.",
        ),
        optie("legal", "good",
          "Eerst onze eigen melding, klantrelaas volgt morgen",
          "Je dient vandaag de eigen NIS2-melding in en levert de klantdossiers zodra het " +
            "forensische beeld per tenant rond is.",
          "Onze eigen termijn is gehaald, en de klant staat een dag stil met een klok die al " +
            "loopt. Vraag welke termijn er bij die klant vanavond afloopt.",
          "Je eigen melding op tijd hebben helpt de klant niet die op jouw informatie wacht.",
        ),
        optie("legal", "poor",
          "Wachten met melden tot het forensische beeld per tenant rond is",
          "Je houdt beide meldingen aan tot er per tenant een vastgesteld beeld is, om geen " +
            "onjuiste informatie te verspreiden.",
          "Begrijpelijke zorgvuldigheid die de wet anders inricht: de vroegtijdige waarschuwing " +
            "is bedoeld voor een onvolledig beeld. Vraag wie dat heeft nagekeken.",
          "De vroegtijdige waarschuwing is er juist voor het moment dat je het nog niet weet.",
        ),
        optie("legal", "wrong",
          "Het concept van marketing laten uitgaan zoals het er staat",
          "Je laat het bericht met 'geen aanwijzingen dat klantgegevens zijn geraakt' de deur " +
            "uit gaan om de onrust te dempen.",
          "De gevaarlijkste optie van de oefening: een aanname als feit in een extern bericht, " +
            "op een moment dat je eigen telemetrie uit stond. Laat het team benoemen wat dit " +
            "over twee dagen kost.",
          "Een aanname die als feit naar buiten gaat, komt als verwijt terug.",
        ),
        optie("head_of_comms", "best",
          "Twee berichten: één voor de elf getroffen klanten, één voor de overige 169",
          "Je schrijft een feitelijk bericht met details voor de getroffen klanten en een " +
            "kortere, eerlijke update voor de rest, en zet één woordvoerder neer.",
          "Het onderscheid dat de hele ronde draagt. Kost een uur meer werk en voorkomt dat de " +
            "zwaarst geraakte klant hetzelfde leest als iemand die niets merkt.",
          "Eén bericht naar alle klanten is sneller en laat juist de geraakte klant in de kou.",
          { capabilityFlag: KLANTEN_GEINFORMEERD }),
        optie("head_of_comms", "good",
          "Eén zorgvuldig bericht naar alle klanten, vóór de publicatie om 17:00",
          "Je stuurt één feitelijke update naar de hele portefeuille, zodat niemand het eerst " +
            "in de pers leest.",
          "Verdedigbaar en snel: je bent voor de publicatie binnen. Vraag wat de zorginstelling " +
            "met dit bericht kan doen richting zijn eigen toezichthouder.",
          "Vóór de pers zijn is winst; ongedifferentieerd zijn is de prijs.",
          { capabilityFlag: KLANTEN_GEINFORMEERD }),
        optie("head_of_comms", "poor",
          "Alleen reageren op de journalist, klanten komen daarna",
          "Je geeft het vakmedium een reactie om de berichtgeving te sturen en informeert " +
            "klanten na publicatie.",
          "Dan hoort de klant het van de pers. En de journalist noemt een verkeerde klantnaam, " +
            "dus reageren bevestigt iets wat niet klopt.",
          "De pers eerst bedienen betekent dat je klant het van een ander hoort.",
        ),
        optie("head_of_comms", "wrong",
          "Geen reactie geven en de publicatie afwachten",
          "Je laat de journalist weten dat je niet reageert en wacht af wat er om 17:00 staat.",
          "De valkuil. Het verhaal verschijnt met een onjuiste klantnaam en zonder onze feiten. " +
            "Laat het team bedenken wie er maandag belt.",
          "Zwijgen is geen neutrale keuze: het laat anderen jouw verhaal schrijven.",
        ),
        optie("ceo", "best",
          "Zelf de woordvoering nemen en de getroffen klanten persoonlijk bellen",
          "Je bent het gezicht naar buiten, belt de elf getroffen klanten zelf en laat de " +
            "overige communicatie bij Communicatie.",
          "Op dit niveau verwacht een geraakte klant de bestuurder aan de lijn. Kost je de hele " +
            "middag, en dat is hier de juiste besteding.",
          "Bij een ketenincident is woordvoering een bestuurstaak, geen communicatietaak.",
        ),
        optie("ceo", "good",
          "Woordvoering bij Communicatie leggen, zelf beschikbaar voor de top-10",
          "Je mandateert Communicatie voor pers en portefeuille en houdt jezelf vrij voor de " +
            "grootste klanten.",
          "Werkbare verdeling. Vraag alleen of de zwaarst geraakte klant in die top-10 zit — " +
            "dat is namelijk niet hetzelfde.",
          "De grootste klant en de hardst geraakte klant zijn zelden dezelfde.",
        ),
        optie("ceo", "poor",
          "Elke rol zijn eigen klanten laten informeren",
          "Je laat accountmanagers, Operations en het SOC elk hun eigen contacten bijpraten.",
          "Snel en ongecontroleerd: acht mensen vertellen acht versies. Vraag wat er gebeurt als " +
            "twee klanten elkaar spreken.",
          "Zonder één lijn krijgt elke klant een ander incident.",
        ),
        optie("ceo", "wrong",
          "Niets zeggen tot de forensiek per klant rond is",
          "Je houdt alle communicatie aan tot er een definitief beeld per tenant is.",
          "De valkuil, en nu duurder dan in ronde 2: het NCSC vraagt expliciet, de pers " +
            "publiceert en een klant dreigt met opzegging.",
          "Bij een ketenincident is stilte de enige boodschap die je zeker verkeerd overkomt.",
        ),
        geenBesluit("De publicatie om 17:00 kwam zonder onze feiten erin."),
      ],
    },

    // ── D4 — waar gaan mensen en geld naartoe ──────────────────────────
    {
      afterRoundIndex: 3,
      authorId: "eye-d4-prioriteit",
      prompt: "Na R4 — Waar zetten we mensen en geld nu op in, nu niet alles tegelijk kan?",
      context:
        "Bij één klant, een zorginstelling, is er beweging geweest naar twee servers met " +
        "patiëntgegevens — via onze toegang. Zij weten dat nog niet. Tegelijk gaan maandag 180 " +
        "klanten weer aan het werk, twee eigen analisten zijn 30 uur op en de verzekeringsklok " +
        "loopt sinds zaterdagnacht. Deze keuze gaat over prioriteit en inzet, niet meer over " +
        "communicatie.",
      facilitatorRationale:
        "De beste optie zet het zwaarste team bij de zorginstelling en stelt hen vandaag in " +
        "staat te melden: daar zit het grootste risico voor derden en onze grootste " +
        "aansprakelijkheid. De tweede optie houdt de dienst voor alle 180 op niveau en geeft de " +
        "zorginstelling externe hulp — verdedigbaar, en het betekent dat de zwaarst geraakte " +
        "klant het met een onbekende partij moet doen. Vraag welke van de twee ze over een jaar " +
        "aan een rechter willen uitleggen. 'Overal een beetje' is hier de slechtste variant.",
      perRole: true,
      options: [
        optie("ciso", "best",
          "Zwaarste IR-team naar de zorginstelling en hen vandaag laten melden",
          "Je zet je twee beste forensisch onderzoekers volledig op die ene klant en levert " +
            "vanmiddag het feitenrelaas waarmee zij hun datalek kunnen melden.",
          "Daar zit het risico voor derden én onze aansprakelijkheid. Benoem dat wij de weg naar " +
            "binnen waren: dat maakt dit geen gunst maar een plicht.",
          "Waar jouw toegang de ingang was, hoort jouw beste team te staan.",
        ),
        optie("ciso", "good",
          "Externe forensiek inhuren voor de klant, eigen team op de portefeuille",
          "Je huurt een externe IR-partij in voor de zorginstelling en houdt je eigen mensen op " +
            "de dienst voor alle klanten.",
          "Verdedigbaar en snel op te zetten, en de zwaarst geraakte klant krijgt een onbekende " +
            "aan tafel terwijl wij de ingang waren. Vraag hoe dat overkomt.",
          "Inhuren lost capaciteit op en niet het vertrouwen dat jij moet herstellen.",
        ),
        optie("ciso", "poor",
          "Capaciteit gelijkmatig over alle getroffen tenants verdelen",
          "Je verdeelt de onderzoekers over de elf tenants zodat elke klant evenveel aandacht " +
            "krijgt.",
          "Klinkt rechtvaardig en is het niet: tien klanten met een policy-wijziging krijgen " +
            "hetzelfde als één klant met een datalek. Vraag of dat te verdedigen is.",
          "Gelijk verdelen is niet eerlijk als de schade ongelijk is.",
        ),
        optie("ciso", "wrong",
          "Eerst het platform volledig opnieuw opbouwen, klantonderzoek daarna",
          "Je zet alle capaciteit op de herbouw van het beheerplatform en pakt het " +
            "klantonderzoek daarna op.",
          "De valkuil. Bij de zorginstelling loopt een datalek dat zij nog niet kennen, en elke " +
            "dag telt daar voor hun eigen termijn. Laat het team dat zelf uitrekenen.",
          "Je eigen huis eerst opruimen kost de klant zijn meldtermijn.",
        ),
        optie("cfo", "best",
          "Herstelkosten bij de klant nu toezeggen en de polis vandaag melden",
          "Je legt vast dat wij het herstel bij de zorginstelling betalen, en dient vandaag de " +
            "melding bij de verzekeraar in met het forensische dossier.",
          "Twee klokken in één besluit: de polistermijn van 24 uur en het vertrouwen van de " +
            "klant. Vraag wie de polis daadwerkelijk heeft gelezen.",
          "Een toezegging op dag drie is goedkoper dan een claim op maand negen.",
        ),
        optie("cfo", "good",
          "Polis vandaag melden, kostenafspraak met de klant volgende week",
          "Je zorgt dat de verzekeringsmelding binnen de termijn valt en houdt de kostenvraag " +
            "aan tot het beeld compleet is.",
          "De harde termijn is gehaald, en de klant hoort vandaag niets over kosten. Vraag wat " +
            "die stilte doet met het gesprek over verlenging.",
          "Dekking veiligstellen is noodzakelijk; het is nog geen antwoord aan je klant.",
        ),
        optie("cfo", "poor",
          "Eerst uitzoeken of de polis dit dekt, dan beslissen",
          "Je laat de polisvoorwaarden en de contracten analyseren voordat je iets toezegt of " +
            "meldt.",
          "Zorgvuldig en te laat: de meldtermijn van de polis zelf loopt tijdens die analyse " +
            "af. Vraag wanneer die 24 uur begon.",
          "Een polis uitzoeken terwijl zijn eigen meldtermijn loopt, kost je de dekking.",
        ),
        optie("cfo", "wrong",
          "Geen toezeggingen doen in verband met aansprakelijkheid",
          "Je houdt alle kosten- en herstelvragen aan tot er juridische duidelijkheid is over " +
            "aansprakelijkheid.",
          "De valkuil. Aansprakelijkheid beperken door niets te zeggen werkt hier tegen je: de " +
            "klant heeft het bewijs al en de polis eist juist medewerking.",
          "Zwijgen uit aansprakelijkheidsvrees is zelf een aansprakelijkheidsrisico.",
        ),
        optie("ops_manager", "best",
          "Aflossingsschema invoeren en de twee oververmoeide analisten eruit halen",
          "Je zet een rooster op met drie ploegen, haalt de twee analisten van zaterdag eruit " +
            "en laat hun werk door een frisse collega overdragen.",
          "De fout in dat ticket was het signaal, niet de vermoeidheid. Benoem dat een fout in " +
            "een tenant-id bij ons een klantomgeving raakt.",
          "Een incident langer dan één dienst vraagt een rooster, niet uithoudingsvermogen.",
        ),
        optie("ops_manager", "good",
          "De analisten laten blijven maar al hun acties laten dubbelchecken",
          "Je houdt de twee mensen met de meeste context aan boord en zet een " +
            "vier-ogen-procedure op elke actie die zij doen.",
          "Houdt de kennis aan tafel en verdubbelt het werk. Vraag hoe lang die vier ogen " +
            "scherp blijven als het derde paar ook moe is.",
          "Dubbelchecken dekt de fout af en lost de oorzaak niet op.",
        ),
        optie("ops_manager", "poor",
          "Externe capaciteit inhuren voor de servicedesk",
          "Je huurt tijdelijke krachten in voor de eerstelijns servicedesk zodat het eigen team " +
            "kan doorwerken op het incident.",
          "Helpt op volume en niet op de plek waar het knelt: de fouten worden gemaakt in de " +
            "tenants, niet aan de telefoon.",
          "Capaciteit bijzetten helpt alleen op de plek waar de fouten vallen.",
        ),
        optie("ops_manager", "wrong",
          "Doorwerken; het team wil dit zelf afmaken",
          "Je laat de mensen die erbij waren doorgaan tot het incident gesloten is, omdat zij " +
            "dat zelf willen.",
          "De valkuil, en een sympathieke. Laat het team benoemen wat de volgende verkeerde " +
            "tenant-id kost in een omgeving met patiëntgegevens.",
          "Betrokkenheid is geen vervanging voor rust; moeheid maakt fouten in andermans omgeving.",
        ),
        geenBesluit("De zorginstelling wachtte nog een dag op informatie die wij al hadden."),
      ],
    },

    // ── D5 — wat leggen we vast ────────────────────────────────────────
    {
      afterRoundIndex: 4,
      authorId: "eye-d5-vastleggen",
      prompt: "Na R5 — Welke verandering leggen we vast, met welke eigenaar en welke datum?",
      context:
        "Er liggen drie zwaktes op tafel die alle drie waar zijn: een service-account zonder " +
        "afdwingbare MFA met schrijfrechten in 180 tenants, een verkenningspoging van drie " +
        "weken eerder die als 'brute force, geblokkeerd' is weggeklikt, en het ontbreken van " +
        "een aflossingsschema. De zwaarst geraakte klant wil voor 1 december schriftelijk zien " +
        "wat er verandert. Deze keuze gaat niet meer over het incident.",
      facilitatorRationale:
        "De beste optie pakt het service-account: dat is de ingang geweest, en het is het enige " +
        "van de drie dat dit incident had voorkomen. Met een naam en een datum erop. De tweede " +
        "optie pakt de weggeklikte verkenning aan via het triageproces — waardevol, en het had " +
        "je alleen drie weken eerder gewaarschuwd, niet tegengehouden. Zet ze naast elkaar met " +
        "één vraag: welke van de twee maakt dat dit niet opnieuw kan, en welke maakt dat je het " +
        "eerder ziet? De onderste twee leggen alles vast of niets, en dat komt op hetzelfde neer.",
      perRole: true,
      options: [
        optie("ceo", "best",
          "Eén verandering vastleggen met naam en datum: het service-account",
          "Je legt bestuurlijk vast dat machine-accounts met schrijfrechten in klant-tenants " +
            "voor 1 december op PAM en korte-levensduurcertificaten zitten, met de CISO als " +
            "eigenaar.",
          "Eén eigenaar, één datum, de ingang gedicht. Dit is ook precies wat de klant " +
            "schriftelijk wil zien. Vraag wie er in maart op wordt afgerekend.",
          "Na een crisis beweegt alleen wat een naam en een datum heeft.",
        ),
        optie("ceo", "good",
          "Alle drie de zwaktes vastleggen met één eigenaar per stuk",
          "Je zet de drie punten in het verbeterplan, elk met een eigenaar en een datum in het " +
            "eerste kwartaal.",
          "Compleet en daarmee zwakker: drie parallelle trajecten in een organisatie die net een " +
            "week heeft doorgewerkt. Vraag welke als eerste afvalt.",
          "Drie veranderingen tegelijk vastleggen is vaak hetzelfde als er één halen.",
        ),
        optie("ceo", "poor",
          "Een evaluatie beleggen met het managementteam in januari",
          "Je plant een evaluatiesessie waarin de drie punten besproken worden en besluiten " +
            "worden genomen.",
          "Een vergadering is geen eigenaar. Vraag wat er tussen nu en januari verandert, en " +
            "wat je de klant op 1 december stuurt.",
          "Een evaluatie plannen voelt als actie en stelt het besluit alleen uit.",
        ),
        optie("ceo", "wrong",
          "Het bij de CISO laten; dit is een technisch verbeterpunt",
          "Je geeft het dossier aan de CISO mee met de opdracht het op te lossen, zonder " +
            "bestuurlijke vastlegging of datum.",
          "De valkuil. Zonder bestuursbesluit concurreert dit met alle andere werk en verliest " +
            "het. En de klant vraagt om jóuw ondertekening.",
          "Delegeren zonder datum is hetzelfde als niet besluiten.",
        ),
        optie("ciso", "best",
          "Machine-accounts met klanttoegang op PAM, met een aantoonbare deadline",
          "Je zet alle service-accounts met schrijfrechten in klant-tenants achter PAM met " +
            "kortlevende certificaten, en levert op 1 december bewijs van de stand.",
          "Dicht de ingang en is meetbaar. Benoem dat 'MFA kan niet op een machine-account' " +
            "geen conclusie was maar een aanname die nooit is getoetst.",
          "Een account dat geen MFA kan, hoort geen schrijfrechten in andermans omgeving te hebben.",
        ),
        optie("ciso", "good",
          "Triage aanpassen: een geblokkeerde poging op een service-account wordt onderzoek",
          "Je verandert het triageproces zodat een mislukte authenticatie op een " +
            "privileged service-account altijd een onderzoeksticket wordt.",
          "Dit had je drie weken eerder gewaarschuwd — en niet tegengehouden. Waardevol als " +
            "tweede, niet als eerste. Vraag wat het aan extra tickets oplevert.",
          "Eerder zien is winst; niet binnen kunnen komen is meer winst.",
        ),
        optie("ciso", "poor",
          "Een extra detectieregel op dit specifieke aanvalspatroon",
          "Je schrijft een detectieregel op authenticaties van buitenlandse ranges op " +
            "service-accounts.",
          "Vecht de vorige oorlog: deze aanvaller komt niet terug met hetzelfde IP. Vraag wat " +
            "deze regel bij een volgende variant doet.",
          "Een regel op het patroon van gisteren dekt de aanval van morgen niet.",
        ),
        optie("ciso", "wrong",
          "Niets structureel vastleggen; het platform is immers opnieuw opgebouwd",
          "Je beschouwt de herbouw als de verbetering en legt verder niets vast.",
          "De valkuil. Hetzelfde account met dezelfde rechten staat weer in de nieuwe omgeving. " +
            "Laat het team dat zelf nagaan.",
          "Opnieuw opbouwen met dezelfde rechten herbouwt ook het risico.",
        ),
        optie("hr_lead", "best",
          "Aflossingsschema vastleggen én nazorg voor de twee analisten regelen",
          "Je legt een ploegenschema vast voor incidenten langer dan één dienst en zorgt dat de " +
            "twee analisten van zaterdag begeleiding krijgen.",
          "Het personele punt dat anders uit elk verbeterplan valt. Benoem dat zij een incident " +
            "bij hun eigen werkgever hebben gedraaid — dat is iets anders dan bij een klant.",
          "Een incident bij je eigen werkgever draaien vraagt andere nazorg dan een klantcasus.",
        ),
        optie("hr_lead", "good",
          "Alleen het aflossingsschema vastleggen, nazorg informeel oppakken",
          "Je regelt het rooster formeel en vangt de twee mensen informeel op via hun teamlead.",
          "Het structurele deel staat. Vraag wat er gebeurt als die teamlead er zelf ook " +
            "doorheen zat.",
          "Informele nazorg werkt tot degene die hem moet geven zelf moe is.",
        ),
        optie("hr_lead", "poor",
          "Een securityweek in januari organiseren",
          "Je zet een interne securityweek op met workshops en een phishingtest.",
          "Goedbedoeld en het raakt geen van de drie zwaktes van deze week. Vraag welke " +
            "daarvan dit had voorkomen.",
          "Bewustwording organiseren is geen antwoord op een technisch rechtenprobleem.",
        ),
        optie("hr_lead", "wrong",
          "Niets vastleggen; het team heeft het goed opgelost",
          "Je benoemt in een bedankmail dat het team dit sterk heeft gedraaid en laat het " +
            "daarbij.",
          "De valkuil. Waardering is terecht en verandert niets. Laat het team benoemen wat er " +
            "bij het volgende weekendincident opnieuw gebeurt.",
          "Een compliment is geen maatregel.",
        ),
        geenBesluit("Er is niets vastgelegd, dus over drie maanden is er niets anders."),
      ],
    },
  ],

  outcomes: [
    {
      key: "beheerst",
      label: "Beheerst — keten vroeg gewaarschuwd, vertrouwen overeind",
      narrative:
        "Jullie hebben vannacht opgeschaald op een onvolledig signaal, de elf getroffen klanten " +
        "apart behandeld van de overige 169, en de eigen melding op tijd gedaan. De zorginstelling " +
        "kon zijn eigen klok starten met informatie van jullie in plaats van uit de pers. Dat is " +
        "wat een MDR-leverancier verkoopt, en jullie hebben het op jezelf toegepast.",
      lessonLearned:
        "Als leverancier ben je de klok van je klant. Hoe eerder je bericht, hoe korter hun termijn.",
      scoreRange: { min: 60 },
    },
    {
      key: "houdbaar",
      label: "Houdbaar — laat op gang, maar de keten is bediend",
      narrative:
        "Er is tijd verloren in de nacht en in de klantcommunicatie, en één bericht is te generiek " +
        "de deur uit gegaan. De meldingen zijn gehaald en de getroffen klant is geholpen, maar de " +
        "buitenwereld was op sommige momenten eerder dan jullie. Dat kost vertrouwen dat je later " +
        "terug moet kopen.",
      lessonLearned:
        "Een generiek bericht naar alle klanten is sneller, en het kost je de klanten die het hardst geraakt zijn.",
      scoreRange: { min: 25, max: 59 },
    },
    {
      key: "onhoudbaar",
      label: "Onhoudbaar — de keten hoorde het van iemand anders",
      narrative:
        "Er is gewacht tot het beeld rond was. Daardoor lazen klanten het in de pers, begon hun " +
        "eigen meldtermijn te laat, en bleek een extern bericht een aanname als feit te hebben " +
        "gepresenteerd. De zorginstelling heeft zijn datalek ontdekt zonder jullie. Voor een " +
        "partij die detectie en respons verkoopt is dat de duurste uitkomst die er is.",
      lessonLearned:
        "Wachten op zekerheid is bij een ketenincident geen zorgvuldigheid maar een keuze om je klant te laten wachten.",
      scoreRange: { max: 24 },
    },
  ],

  irPlaybook:
    "Eye Security intern: SOC 24/7 met piket, IR-team met eigen forensische capaciteit, " +
    "crisisteam op afroep via piketlijst. Wat in het plan staat maar niet is geoefend: " +
    "opschaling buiten kantooruren, en communicatie naar de hele klantportefeuille tegelijk.",
}

// ── Rolbriefings ──────────────────────────────────────────────────────────
//
// `playbookGaps` is waar de standaard-zwakte landt (rule11). Per rol één of
// meer dingen die in het draaiboek ontbreken en die deze oefening raakt.

const roleBriefings: Partial<Record<Role, RoleBriefing>> = {
  ciso: {
    text:
      "Jij bent eindverantwoordelijk voor de technische kant én voor het moment van opschalen. " +
      "Wat je nog niet weet: de verklaring van de piketengineer is onjuist, en de " +
      "detectie-uitsluitingen die de aanvaller heeft gezet maken onze eigen telemetrie bij elf " +
      "klanten blind. 'Geen aanwijzingen' betekent deze week dus iets anders dan normaal.",
    playbookGaps: [
      "Geen criterium wanneer de dienstdoende analist het crisisteam mág wekken",
      "Service-accounts met schrijfrechten in klant-tenants staan niet in de risicoregistratie",
      "Nooit geoefend: ons eigen beheerplatform als bron van het incident",
    ],
  },
  it_manager: {
    text:
      "Jij kent het beheerplatform en de agentuitrol. Jij bent om 02:48 een van de twee mensen " +
      "die iets kan doen. Wat je nog niet weet: de certificaatrotatie heeft vrijdag wél gelopen, " +
      "dus de makkelijke verklaring houdt geen stand.",
    playbookGaps: [
      "Geen procedure om het beheerplatform gecontroleerd offline te halen zonder klantzicht te verliezen",
      "Changekalender en ticketsysteem spreken elkaar tegen bij uitgestelde changes",
    ],
  },
  ceo: {
    text:
      "Jij bent eindverantwoordelijk voor wat Eye Security naar buiten zegt en voor de keuze " +
      "tussen één zwaar geraakte klant en de hele portefeuille. Wat je nog niet weet: een " +
      "concurrent gaat dit commercieel gebruiken, en twee klanten gaan heronderhandelen.",
    playbookGaps: [
      "Geen besluitlijn voor communicatie naar de hele klantportefeuille tegelijk",
      "Geen vastgelegd mandaat voor opschaling buiten kantooruren",
    ],
  },
  legal: {
    text:
      "Jij bewaakt twee dingen tegelijk die mensen door elkaar halen: onze eigen NIS2-plicht als " +
      "essentiële entiteit, en onze rol als verwerker bij een datalek dat bij de klant speelt. " +
      "Wat je nog niet weet: er circuleert een concept-bericht waarin marketing een aanname als " +
      "feit heeft gezet.",
    playbookGaps: [
      "Geen modelbericht dat een klant in staat stelt zijn eigen meldtermijn te starten",
      "Contractuele reactietermijnen zijn nooit naast de NIS2-termijnen gelegd",
    ],
  },
  head_of_comms: {
    text:
      "Jij regisseert wat er naar klanten, pers en eigen mensen gaat. Wat je nog niet weet: een " +
      "vakjournalist publiceert vandaag om 17:00 en noemt een klantnaam die níet geraakt is.",
    playbookGaps: [
      "Geen gescheiden boodschap voor getroffen en niet-getroffen klanten",
      "Geen afspraak wie reageert op onjuiste berichtgeving over een klant",
    ],
  },
  cfo: {
    text:
      "Jij bewaakt de financiële kant en de verzekering. Wat je nog niet weet: de polis eist " +
      "melding binnen 24 uur na bekendwording, en die klok liep vanaf zaterdagnacht.",
    playbookGaps: [
      "Niemand kent de stand van de eigen cyberpolis-melding",
      "Geen budgetlijn voor herstel bij een klant waar het incident bij ons begon",
    ],
  },
  ops_manager: {
    text:
      "Jij houdt de dienstverlening aan 180 klanten overeind terwijl het platform niet volledig " +
      "vertrouwd is. Wat je nog niet weet: één klant schort de dienst tijdelijk op.",
    playbookGaps: [
      "Geen degradatiescenario voor de dienst als het beheerplatform deels uit staat",
      "Geen prioriteitsvolgorde over de klantportefeuille bij schaarse capaciteit",
    ],
  },
  hr_lead: {
    text:
      "Jij bent verantwoordelijk voor de mensen die dit draaien. Wat je nog niet weet: twee " +
      "analisten werken sinds zaterdag 02:00 door en er is al een fout in een ticket gekomen.",
    playbookGaps: [
      "Geen aflossingsschema voor een incident dat langer duurt dan één dienst",
      "Geen nazorgafspraak voor mensen die een incident bij de eigen werkgever hebben gedraaid",
    ],
  },
}

// ── Ruis-bibliotheek ──────────────────────────────────────────────────────
//
// Injects die de facilitator tijdens het overleg kan laten vallen. Nooit
// gescoord; bedoeld om druk te zetten of een spoor te laten doodlopen.

const injectLibrary: PremadeInject[] = [
  {
    id: "eye-lib-1",
    label: "Gerucht: insider",
    channel: "slack",
    urgency: "low",
    title: "Gerucht: 'het was een insider'",
    content:
      "Op een besloten Slack van vakgenoten gaat rond dat het bij Eye Security om een " +
      "insider zou gaan. Geen bron, geen onderbouwing. Een van onze eigen analisten vraagt " +
      "intern of dat waar is.",
    classification: "aanname",
  },
  {
    id: "eye-lib-2",
    label: "Klant wil agents uitzetten",
    channel: "email",
    urgency: "medium",
    title: "Klant wil zijn agents nu uitzetten",
    content:
      "Een middelgrote klant belt dat hij onze agents vandaag wil deïnstalleren. Daarmee " +
      "verliest hij alle detectie, maar dat wil hij op dit moment niet horen.",
    classification: "feit",
  },
  {
    id: "eye-lib-3",
    label: "Leverancier biedt hulp",
    channel: "email",
    urgency: "low",
    title: "Leverancier biedt gratis hulp aan",
    content:
      "Een securityleverancier biedt aan 'kosteloos te assisteren' en vraagt in dezelfde mail " +
      "om een gesprek met jullie CISO over hun product.",
    classification: "feit",
  },
  {
    id: "eye-lib-4",
    label: "Medewerker op LinkedIn",
    channel: "slack",
    urgency: "medium",
    title: "Medewerker plaatst iets op LinkedIn",
    content:
      "Een medewerker heeft op LinkedIn gezet dat hij 'een bijzonder weekend' heeft gehad en " +
      "trots is op het team. Drie klanten hebben gereageerd met vragen.",
    classification: "feit",
  },
]

export function eyeSecurityScenario(): ScenarioGraph {
  const g = planToGraph(plan, { publishStatus: "published", seed: "eye-security-intern-v1" })
  return {
    ...g,
    // Hierdoor staat het scenario op de klantpagina van Eye Security.
    clientId: EYE_SECURITY_CLIENT_ID,
    injectLibrary,
    roleBriefings,
  }
}
