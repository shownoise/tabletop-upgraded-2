import type { ModuleDefinition } from "../types/scenario-instance"

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: 'detection_sensemaking',
    name: 'Detection & Sensemaking',
    learning_goal:
      'Het CMT herkent dat losse signalen samen één incident vormen, schaalt op naar ' +
      'crisis-niveau, activeert de juiste rollen en mandatering.',
    default_lens: 'symptoms',
    default_duration_minutes: 40,
    default_channels: ['siem', 'teams', 'sms'],
    framework_prompts: {
      bob: [
        'Wat weten we zeker? Wat weten we niet? Klopt alles wat we weten?',
        'Hebben we genoeg informatie om een goed besluit te nemen?',
        'Hoe gaan we ontbrekende informatie verzamelen?',
        'Wat is ons doel? Waar maken we ons zorgen over?',
        'Wat besluiten we? Wie tekent dat af?',
      ],
      ooda: [
        'Wat observeren we — welke signalen hebben we op dit moment?',
        'Hoe oriënteren we ons — past dit in een bekend patroon?',
        'Welke actie kiezen we nu?',
        'Wanneer herhalen we de loop om nieuwe informatie mee te nemen?',
      ],
      dair: [
        'Wat detecteren we, en hoe zeker zijn we van die detectie?',
        'Wat is onze inschatting van impact en scope?',
        'Wie moet dit nu weten — intern en extern?',
        'Welke respons-actie nemen we?',
      ],
      nist_ir: [
        'Detection & Analysis — wat zien we, wat is het, hoe ernstig?',
        'Welke initiële containment-stap nemen we?',
        'Is dit het moment voor een formele incident-declaratie?',
      ],
      free: [
        'Wat valt jullie op?',
        'Waar willen jullie eerst over praten?',
        'Wat zou je nu doen?',
      ],
    },
    scope_hints: [
      'Decisions gaan over CMT-samenstelling, escalatie, mandaat — niet over technische executie',
      'Welk crisisniveau activeren we (geel/oranje/rood)?',
      'Schakelen we externe partijen in?',
    ],
  },
  {
    id: 'triage_containment',
    name: 'Triage & Containment',
    learning_goal:
      'Het CMT bepaalt onder onzekerheid welke systemen geïsoleerd worden, in welke ' +
      'volgorde, en welke compromissen daarbij worden gemaakt.',
    default_lens: 'impact',
    default_duration_minutes: 40,
    default_channels: ['siem', 'phone', 'email'],
    framework_prompts: {
      bob: [
        'Wat weten we over de scope van de besmetting?',
        'Welke isolatie-actie geeft ons de beste balans tussen beheersing en continuïteit?',
        'Wie autoriseert de isolatie die operationele downtime veroorzaakt?',
      ],
      ooda: [
        'Welke systemen zijn bevestigd besmet vs mogelijk besmet?',
        'Welke containment-optie beperkt de schade het snelst?',
        'Voer uit — en evalueer over 15 minuten opnieuw.',
      ],
      dair: [
        'Wat detecteert ons IR-team aan actieve bedreiging?',
        'Wat is de impact als we systeem X isoleren?',
        'Wie moet weten dat we systeem X isoleren?',
        'Welke containment-stap autoriseren we?',
      ],
      nist_ir: [
        'Containment — welke systemen isoleren we, en in welke volgorde?',
        'Accepteren we collateral downtime om verspreiding te stoppen?',
        'Forensic preservation vs snelle recovery — wat is de afweging?',
      ],
      free: [
        'Welke systemen kunnen we isoleren zonder de zaak te verergeren?',
        'Wie autoriseert een grote downtime-beslissing?',
      ],
    },
    scope_hints: [
      'Containment-acties worden door ons IR-team uitgevoerd — klant autoriseert grote impact-beslissingen',
      'Decisions: welke isolatie-prioriteit, accepteren we collateral downtime, wie autoriseert',
      'Communicatie over geplande disruption naar interne stakeholders',
    ],
  },
  {
    id: 'business_continuity',
    name: 'Business Continuity',
    learning_goal:
      'Het CMT bepaalt impact op vier domeinen, prioriteert kritieke processen, ' +
      'bepaalt geaccepteerde uitvaltijd, en initieert workarounds.',
    default_lens: 'impact',
    default_duration_minutes: 40,
    default_channels: ['email', 'teams', 'memo'],
    framework_prompts: {
      bob: [
        'Wat weten we over de operationele impact per afdeling?',
        'Welke processen moeten als eerste worden hersteld of handmatig doorgaan?',
        'Wat is de maximale uitvaltijd die we kunnen accepteren per kritiek proces?',
        'Wie communiceert intern naar medewerkers — wat en wanneer?',
      ],
      ooda: [
        'Wat zien we aan operationele uitval op dit moment?',
        'Welk kritiek proces heeft de hoogste urgentie?',
        'Welke workaround activeren we nu?',
        'Hoe evalueren we het herstel na één uur?',
      ],
      dair: [
        'Welke operationele impact is bevestigd?',
        'Wat is de inschatting van de totale schade per uur?',
        'Welke stakeholders moeten geïnformeerd worden over de uitval?',
        'Welke herstelstap heeft de meeste impact?',
      ],
      nist_ir: [
        'Recovery planning — welke systemen herstellen we in welke volgorde?',
        'Zijn backups beschikbaar en betrouwbaar?',
        'Wat is de RTO/RPO die we in de praktijk kunnen halen?',
      ],
      free: [
        'Welke afdeling heeft het zwaarst te lijden?',
        'Wat kunnen jullie zelf doen terwijl IT aan herstel werkt?',
        'Hoe communiceer je naar medewerkers zonder paniek te veroorzaken?',
      ],
    },
    scope_hints: [
      'Decisions: welke processen prioriteit, geaccepteerde uitvaltijd, handmatige workarounds',
      'Communicatie naar medewerkers over de situatie',
      'Activatie cyberverzekeraar',
      'Impact op vier domeinen: fysiek/digitaal, psychologisch, financieel, reputatie',
    ],
  },
  {
    id: 'crisis_communication',
    name: 'Crisis Communication',
    learning_goal:
      'Het CMT bepaalt stakeholder-prioriteit, kiest een communicatiestrategie, ' +
      'en formuleert concrete boodschappen.',
    default_lens: 'external_reactions',
    default_duration_minutes: 40,
    default_channels: ['email', 'news', 'phone'],
    framework_prompts: {
      bob: [
        'Welke stakeholders weten het al, en wat weten ze?',
        'Wat is onze communicatiestrategie — informeren, empathie, of verantwoordelijkheid?',
        'Welke stakeholder contacteren we als eerste, en wie voert dat gesprek?',
        'Wat zeggen we wel, wat zeggen we niet — en waarom?',
      ],
      ooda: [
        'Welke externe druk ontvangen we op dit moment?',
        'Hoe positioneren we ons — slachtoffer, verantwoordelijke, of herstelgericht?',
        'Welke communicatie-actie ondernemen we nu?',
        'Hoe monitoren we de reactie?',
      ],
      dair: [
        'Welke externe signalen detecteren we (pers, klanten, social media)?',
        'Wat is de reputatierisco-inschatting?',
        'Wie moet nu geïnformeerd worden?',
        'Welke boodschap sturen we uit?',
      ],
      nist_ir: [
        'Welke externe partijen hebben een meldplicht van ons?',
        'Wat is de timing voor pers- en stakeholder-communicatie?',
        'Hoe verhouden interne en externe communicatie zich?',
      ],
      free: [
        'Wie belt je als eerste — en wat zeg je?',
        'Hoe voorkom je dat de boodschap escaleert?',
        'Wat doe je als de pers al vragen stelt?',
      ],
    },
    scope_hints: [
      'Decisions: welke stakeholder eerst, woordvoerder, boodschap-strategie, pers actief vs reactief',
      'AVG-meldplicht aan AP (72u), NIS2 early warning (24u)',
      'Sociale media management',
    ],
  },
  {
    id: 'legal_regulatory',
    name: 'Legal & Regulatory',
    learning_goal:
      'Het CMT navigeert meldplichten, aansprakelijkheid, contractuele verplichtingen, ' +
      'en juridische risico\'s.',
    default_lens: 'external_reactions',
    default_duration_minutes: 30,
    default_channels: ['email', 'memo', 'phone'],
    framework_prompts: {
      bob: [
        'Welke meldplichten lopen er al, en waar staan we in de klokken?',
        'Welke juridische risico\'s zijn in beeld — aansprakelijkheid, schade-claims?',
        'Wat besluiten we over de AP-melding — wat melden we, wanneer?',
      ],
      ooda: [
        'Welke juridische deadlines naderen op dit moment?',
        'Wat is onze inschatting van aansprakelijkheid?',
        'Welke juridische actie nemen we nu?',
      ],
      dair: [
        'Welke meldplichten zijn getriggerd door de feiten die we kennen?',
        'Wat is de inschatting van juridische exposure?',
        'Wie informeren we — AP, RDI, sectortoezichthouder?',
        'Welke juridische stap zetten we?',
      ],
      nist_ir: [
        'Welke regulatory reporting verplichtingen vloeien voort uit het incident?',
        'Hoe documenteren we het incident voor juridische doeleinden?',
      ],
      free: [
        'Moeten we de AP bellen — en wat vertellen we ze?',
        'Kunnen klanten ons aansprakelijk stellen?',
        'Doen we aangifte?',
      ],
    },
    scope_hints: [
      'AVG Art.33: melding AP binnen 72u na ontdekking datalek',
      'NIS2: early warning 24u, incident notification 72u, final report 1 maand',
      'Sectorale meldplichten: DNB, AFM, NVWA, IGJ',
      'Aangifte bij politie, aansprakelijkheid, contractuele meldplichten richting klanten',
    ],
  },
  {
    id: 'ransom_negotiation',
    name: 'Ransom Negotiation',
    learning_goal:
      'Het CMT weegt wel/niet betalen af tegen reputatie, juridisch (sanctielijsten), ' +
      'kans op recidive, en bepaalt onderhandelingstactiek.',
    default_lens: 'attacker_voice',
    default_duration_minutes: 40,
    default_channels: ['email', 'memo'],
    framework_prompts: {
      bob: [
        'Wat weten we over de aanvaller — wie zijn dit, staan ze op sanctielijsten?',
        'Wat zijn de argumenten voor betalen, wat zijn de argumenten ertegen?',
        'Welk besluit nemen we — en wie tekent dat af?',
        'Wat doen we als we betalen maar de aanvaller publiceert toch?',
      ],
      ooda: [
        'Wat biedt de aanvaller aan, en hoe betrouwbaar is dat aanbod?',
        'Hoe oriënteren we ons op de opties — betalen, onderhandelen, weigeren?',
        'Welke keuze maken we?',
        'Hoe reageren we op de volgende zet van de aanvaller?',
      ],
      dair: [
        'Wat detecteren we over de aanvaller en zijn capaciteiten?',
        'Wat is onze inschatting van de kans op succesvolle recovery zonder betaling?',
        'Wie moet dit besluit kennen — bestuur, verzekeraar, advocaat?',
        'Welke actie nemen we?',
      ],
      nist_ir: [
        'Wat is de impact op recovery als we niet betalen?',
        'Welke alternatieven voor betaling zijn er — decryptors, backups?',
        'Hoe documenteren we dit besluit voor auditors en verzekeraars?',
      ],
      free: [
        'Betalen of niet — wat is jullie instinct?',
        'Wie moet dit besluit nemen?',
        'Wat zijn de gevolgen van elke keuze?',
      ],
    },
    scope_hints: [
      'Decisions: wel/niet betalen, wie tekent af, wat als aanvaller publiceert toch',
      'Sanctielijsten: betaling aan gesanctioneerde partij is strafbaar',
      'Verzekeraar en advocaat moeten betrokken zijn voor het besluit',
      'Communicatie naar accountant/auditor over de afweging',
    ],
  },
  {
    id: 'recovery_lessons',
    name: 'Recovery & Lessons Learned',
    learning_goal:
      'Het CMT plant herstel, valideert BIA-aannames tegen ervaring, en formuleert ' +
      'lessons learned die als input dienen voor het cyber-crisis-plan.',
    default_lens: 'impact',
    default_duration_minutes: 30,
    default_channels: ['memo', 'teams'],
    framework_prompts: {
      bob: [
        'Wat hebben we in dit incident goed gedaan?',
        'Waar zaten de gaps — in proces, tooling, of mensen?',
        'Welke aanpassingen maken we aan het cyber-crisis-plan?',
      ],
      ooda: [
        'Wat observeren we terugkijkend op de respons?',
        'Hoe klopt dat met ons plan en onze aannames?',
        'Welke verbeteringen zetten we door?',
      ],
      dair: [
        'Welke detectie-gaten hebben we gevonden?',
        'Wat was de werkelijke impact versus onze BIA-aannames?',
        'Wie rapporteert de lessons learned aan RvC en OR?',
        'Welke verbeteringsmaatregelen committeren we?',
      ],
      nist_ir: [
        'Post-incident activity — wat leren we voor toekomstige preparedness?',
        'Welke control-gaps zijn blootgelegd?',
        'Hoe verankeren we de lessen in het ISMS?',
      ],
      free: [
        'Wat zou je anders doen?',
        'Wat moet in het plan staan dat er nu niet in staat?',
        'Welke investering ga je aanvragen?',
      ],
    },
    scope_hints: [
      'Decisions: aanpassingen cyber-crisis-plan, investeringsaanvragen, communicatie naar OR/RvC',
      'Validatie BIA-aannames: klopten onze RTO/RPO aannames?',
    ],
  },
  {
    id: 'insider_investigation',
    name: 'Insider Investigation',
    learning_goal:
      'Het CMT navigeert de eigenheid van een insider-onderzoek: HR en Legal werken ' +
      'samen met IT, bewijs moet zorgvuldig worden vergaard, communicatie is uiterst beperkt.',
    default_lens: 'symptoms',
    default_duration_minutes: 40,
    default_channels: ['memo', 'phone', 'teams'],
    framework_prompts: {
      bob: [
        'Wat weten we over de omvang van de data-extractie?',
        'Welke stappen zetten we voor bewijsvergaring zonder de verdachte te alarmeren?',
        'Wat besluiten we over schorsing — en wanneer?',
      ],
      ooda: [
        'Welke gedragssignalen en DLP-events hebben we geobserveerd?',
        'Hoe duiden we dit — intentioneel, opportunistisch, of onbewust?',
        'Welke onderzoeksstap zetten we nu?',
      ],
      dair: [
        'Welke signalen hebben we gedetecteerd?',
        'Wat is de inschatting van de schade — welke data, naar wie?',
        'Wie weet van dit onderzoek — kernteam only?',
        'Welke actie nemen we: HR-gesprek, schorsing, of aangifte?',
      ],
      nist_ir: [
        'Hoe verzamelen we forensisch bewijs op een juridisch houdbare manier?',
        'Welke chain-of-custody procedures volgen we?',
      ],
      free: [
        'Wanneer confronteer je de medewerker?',
        'Wat doe je met het bewijs?',
        'Wanneer betrek je HR en Legal?',
      ],
    },
    scope_hints: [
      'Communicatie is uiterst beperkt — alleen kernteam (CMT-voorzitter, HR, Legal, CISO)',
      'Decisions: bewijsvergaring-aanpak, tijdstip van schorsing, aangifte vs civielrechtelijk traject',
      'OR-betrokkenheid bij schorsing of ontslag',
      'Ons IR-team doet forensisch onderzoek — klant beslist over HR-procedure',
    ],
  },
  {
    id: 'supply_chain_response',
    name: 'Supply Chain Response',
    learning_goal:
      'Het CMT navigeert third-party afhankelijkheid: hoe weet je wat geraakt is, ' +
      'hoe coördineer je met de leverancier, hoe communiceer je naar jouw klanten.',
    default_lens: 'external_reactions',
    default_duration_minutes: 40,
    default_channels: ['email', 'news', 'phone'],
    framework_prompts: {
      bob: [
        'Wat weten we over de scope van de leverancier-breach?',
        'Vertrouwen we de analyse van de leverancier — of doen we eigen onderzoek?',
        'Informeren we onze klanten actief of reactief?',
      ],
      ooda: [
        'Welke informatie hebben we van de leverancier en van eigen detectie?',
        'Hoe groot is ons vertrouwen in de leverancier op dit moment?',
        'Welke actie nemen we richting leverancier en richting eigen klanten?',
      ],
      dair: [
        'Wat weten we over de impact bij ons — bevestigd vs mogelijk?',
        'Wat is onze inschatting van de scope?',
        'Wie informeren we — leverancier, eigen klanten, toezichthouder?',
        'Welke eis stellen we aan de leverancier?',
      ],
      nist_ir: [
        'Hoe voeren we eigen impact-assessment uit naast het leverancier-onderzoek?',
        'Welke contractuele rechten hebben we richting de leverancier?',
      ],
      free: [
        'Vertrouw je de leverancier?',
        'Wat vertel je aan jouw klanten?',
        'Stap je over naar een andere leverancier?',
      ],
    },
    scope_hints: [
      'Decisions: vertrouwen we leverancier-analyse, eigen onderzoek, audit-rechten eisen',
      'Informeren eigen klanten — actief of reactief',
      'Juridische positie: aansprakelijkheid leverancier, jouw positie richting jouw klanten',
      'NIS2/DORA meldplichten voor supply chain incidenten',
    ],
  },
  {
    id: 'forensic_attribution',
    name: 'Forensic & Attribution',
    learning_goal:
      'Het CMT begrijpt wat forensisch onderzoek wel en niet kan, weegt attributie ' +
      'tegen actie, en communiceert technische bevindingen aan niet-technische stakeholders.',
    default_lens: 'symptoms',
    default_duration_minutes: 30,
    default_channels: ['memo', 'siem', 'phone'],
    framework_prompts: {
      bob: [
        'Wat weten we over de aanvaller — wat heeft het IR-team gevonden?',
        'Wat kunnen we met zekerheid zeggen, wat is speculatie?',
        'Welk besluit nemen we over publieke attributie?',
      ],
      ooda: [
        'Welke technische bevindingen hebben we?',
        'Hoe interpreteren we die — ransomware-groep, staat, hacktivisme?',
        'Delen we attributie publiek, of houden we het intern?',
      ],
      dair: [
        'Welke technische indicators heeft het IR-team gevonden?',
        'Wat is onze inschatting van de actor en motivatie?',
        'Wie moet de attributie-bevindingen kennen?',
        'Doen we aangifte op basis van attributie?',
      ],
      nist_ir: [
        'Welke forensische bevindingen zijn relevant voor eradication?',
        'Hoe vertalen we technische attributie naar policy-beslissingen?',
      ],
      free: [
        'Wie heeft dit gedaan — en maakt dat iets uit?',
        'Doe je aangifte?',
        'Deel je IOCs met de sector?',
      ],
    },
    scope_hints: [
      'Ons IR-team doet de analyse — klant beslist over publieke attributie, aangifte, IOC-sharing',
      'Decisions: publieke attributie, aangifte, ISAC-sharing, communicatie aan NCSC',
    ],
  },
]

export function getModuleDefinition(id: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find(m => m.id === id)
}
