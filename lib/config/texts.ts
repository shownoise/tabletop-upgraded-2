// Central config voor niet-scenario-specifieke NL teksten.
//
// Wat hier hoort: UI-strings, labels, foutmeldingen, generieke uitleg die niet
// per scenario verschilt.
// Wat hier NIET hoort: scenario-teksten (situatieschets, injects, opties, playbook,
// stuurvragen per ronde, valkuilen). Die staan per scenario in de builder.
// Wat hier ook NIET hoort: role spec (authorities/mandateSummary) — die blijft
// in ROLE_META omdat het de rol-definitie is, geen tekst-tweak.
//
// Geen vertaallaag: één taal (NL). Als developers de i18n-laag opzetten, kunnen
// zij dit bestand als bron gebruiken.
//
// Aanpassen: wijzig de string, save. Geen migratie nodig.

import type { Role } from "@/lib/types"

// ─── Escalatie & urgency ──────────────────────────────────────────────────

// Escalatieniveau van de sessie (session-hud). Was hardcoded 'normal/elevated/
// high/critical' als Engels label in een NL scherm.
export const ESCALATION_LABELS = ["Normaal", "Verhoogd", "Hoog", "Kritiek"] as const

// Inject-urgency labels — Engelse enum-waardes in de data, NL labels voor de UI.
export const URGENCY_LABELS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: "laag",
  medium: "midden",
  high: "hoog",
  critical: "kritiek",
}

// ─── Round phase ──────────────────────────────────────────────────────────

// Fase-labels voor de facilitator-dashboard.
export const ROUND_PHASE_LABELS_NL: Record<'inject' | 'discussion' | 'decision' | 'review', string> = {
  inject: "Injects",
  discussion: "Discussie",
  decision: "Beslissing",
  review: "Review",
}

// ─── Classificatie & fact-check ───────────────────────────────────────────

// Author-set classification (feit / aanname) op InjectNodeData.
export const CLASSIFICATION_LABELS: Record<'feit' | 'aanname', { label: string; help: string }> = {
  feit:    { label: "Feit",    help: "Geverifieerd of uit vertrouwde bron" },
  aanname: { label: "Aanname", help: "Plausibel maar niet gecheckt" },
}

// Participant-set fact-check tag (fact / assumption) — Engelse enum, NL labels.
export const FACT_CHECK_TAG_LABELS: Record<'fact' | 'assumption', { label: string; help: string }> = {
  fact:       { label: "Feit",    help: "Ik heb dit geverifieerd of vertrouw de bron" },
  assumption: { label: "Aanname", help: "Plausibel maar niet gecheckt" },
}

// ─── Meldplicht ────────────────────────────────────────────────────────────

// Generieke labels voor het meldplicht-mechanisme. De bevoegde autoriteit
// verschilt per klant en regime en komt uit `regulatory.regime.authorityLabel`
// op de scenario — NIET uit deze constanten. Deze strings zijn de generieke
// wrappers eromheen.
export const MELDPLICHT_TEXTS = {
  panelHeading: "Meldplicht",
  cta_initial: "Melding indienen bij de bevoegde autoriteit",
  cta_closing: "Eindrapportage indienen",
  status_notFiled: "Nooit ingediend — expliciete bevinding in de nabespreking",
  status_filedOnTime: (round: number) => `Op tijd ingediend in ronde ${round}`,
  status_filedLate: (round: number) => `Te laat ingediend in ronde ${round} — na de wettelijke termijn`,
  status_open: (label: string, hours: number) =>
    `${label} staat nog open — deadline binnen ${hours} uur na bekendwording`,
  status_expired: (label: string) =>
    `${label} is niet ingediend — expliciete bevinding in de nabespreking`,
  // De naam van de autoriteit komt uit het regime; deze template alleen als
  // fallback wanneer regime.authorityLabel undefined is.
  fallbackAuthority: "de bevoegde autoriteit",
} as const

// ─── Knoplabels — dominante hardcoded strings ─────────────────────────────

export const BUTTON_LABELS = {
  finalizeDecision: "Beslissing afsluiten",
  finalizeDecisionTitle: "Sluit de beslissing af — deelnemers zonder inzending krijgen een impliciete keuze",
  advanceToReview: "Naar review",
  nextRound: (n: number) => `Start ronde ${n}`,
  endSession: "Sessie afronden",
  resetSession: "Sessie resetten",
  submitDecision: "Beslissing indienen",
  updateDecision: "Aanpassen",
  verify: "Verifieer",
  markHandled: "Afgehandeld",
  hideInject: "Verbergen",
  showHidden: "Toon verborgen",
} as const

// ─── Foutmeldingen ────────────────────────────────────────────────────────

export const ERROR_MESSAGES = {
  actionRequired: "Selecteer een actie.",
  submitFailed: "Indienen mislukt",
  noRoleAssigned: "Je hebt een rol nodig om beslissingen in te dienen. Neem contact op met de facilitator.",
  fetchReportFailed: (msg: string) => `Kon rapport niet ophalen: ${msg}`,
  missingClassification: (title: string) =>
    `Inject "${title}" heeft geen type informatie — kies feit of aanname.`,
  missingRegulatoryTrigger:
    "Geen enkele inject in deze graph draagt `triggersRegulatoryNotification: true` — de meldplicht wordt tijdens spel nooit geopend.",
} as const

// ─── Facilitator guide (event-mode help + BOB-hint) ───────────────────────

export const FACILITATOR_GUIDE = {
  bobHint:
    "Overweeg BOB (Beeldvorming — Oordeelvorming — Besluitvorming) om deze fase te structureren. Het team beslist zelf of ze de methode toepassen.",
  eventMode: {
    heading: "Event-modus",
    intro: "Één notulist bedient de iPad; deelnemers spelen op het grote scherm mee.",
    step_briefing: "Briefing: introduceer scenario, teams, en werkwijze.",
    step_push: "Push injects, sluit ronde met LOCK. Reveal + leaderboard verschijnt automatisch op het grote scherm.",
    step_review: "Review: bespreek keuzes, alternatieven, en scoring per dimensie.",
  },
} as const

// ─── Startbriefing per rol ────────────────────────────────────────────────

// De canonieke bewoording van elke rol z'n mandate + authorities.
// De ROLE_META in lib/types.ts leest deze strings en bewaart de spec-structuur.
// Aanpassen hier verandert wat de deelnemer ziet in de opening-briefing en op
// de rolkaarten (/admin/role-cards).

export const ROLE_BRIEFINGS: Record<Role, {
  mandateSummary: string
  description: string
  authorities: string[]
  notResponsibleFor: string
}> = {
  ceo: {
    description: "Directiebesluiten, communicatie naar board",
    mandateSummary: "Eindverantwoordelijk voor strategische keuzes, board-communicatie en het autoriseren van onomkeerbare stappen.",
    authorities: [
      "Beslissen over betaling losgeld (of weigering)",
      "Openbare communicatie autoriseren",
      "Communicatie naar board en aandeelhouders",
      "Escalatie naar overheid of politie",
      "Noodsituatie intern uitroepen",
    ],
    notResponsibleFor: "Technische maatregelen, GDPR-meldingen opstellen",
  },
  ciso: {
    description: "Beveiligingsstrategie, coördinatie incidentrespons",
    mandateSummary: "Coördineert incidentrespons, weegt technische risico's af en stuurt de externe IR-partij aan.",
    authorities: [
      "Coördineren van de incidentrespons",
      "Aanbevelen van isolatie en containment-maatregelen",
      "Aansturing externe IR-partij",
      "Technische risicoafweging naar directie communiceren",
      "Beslissen over beveiligingsmaatregelen",
    ],
    notResponsibleFor: "Definitieve betaling losgeld, juridische meldingen",
  },
  cfo: {
    description: "Financiële besluiten, verzekering, losgeld",
    mandateSummary: "Bewaakt financiële impact, activeert verzekering en adviseert over losgeld- en herstelbudget.",
    authorities: [
      "Goedkeuren van financiële noodbesluiten",
      "Contact met verzekeraar opnemen",
      "Financiële schade inschatten en rapporteren",
      "Advies over losgeldsituatie geven aan CEO",
    ],
    notResponsibleFor: "Technische herstelstappen, communicatie naar pers",
  },
  legal: {
    description: "Compliance, meldplichten aan toezichthouders",
    mandateSummary: "Bewaakt meldplichten (bevoegde autoriteit conform regime) en beoordeelt aansprakelijkheid en klantverplichtingen.",
    authorities: [
      "Melding aan de bevoegde autoriteit coördineren (conform regime)",
      "Meldplicht bewaken richting sector-toezichthouder",
      "Juridisch advies over aansprakelijkheid geven",
      "Contractuele verplichtingen richting klanten beoordelen",
    ],
    notResponsibleFor: "Technische en financiële beslissingen",
  },
  head_of_comms: {
    description: "Interne en externe communicatie",
    mandateSummary: "Regisseert interne en externe boodschap, treedt op als woordvoerder en bewaakt de reputatie.",
    authorities: [
      "Interne communicatie naar medewerkers verzorgen",
      "Perscommunicatie afstemmen met CEO",
      "Social media bewaken en reageren",
      "Woordvoerder namens de organisatie",
    ],
    notResponsibleFor: "Technische en financiële beslissingen",
  },
  hr_lead: {
    description: "Medewerkerscommunicatie en insider-threat casussen",
    mandateSummary: "Zorgt voor medewerkers en welzijn, en trekt insider-onderzoek samen met Legal.",
    authorities: [
      "Medewerkerscommunicatie coördineren",
      "Insider threat-onderzoek initiëren (samen met Legal)",
      "Crisisopvang en welzijn medewerkers organiseren",
    ],
    notResponsibleFor: "Technische en financiële beslissingen, perscommunicatie",
  },
  ops_manager: {
    description: "Bedrijfscontinuïteit en operationele impact",
    mandateSummary: "Houdt primaire processen draaiend, activeert workarounds en bepaalt herstelprioriteit.",
    authorities: [
      "Bedrijfscontinuïteit-plan activeren",
      "Prioriteren welke processen door moeten gaan",
      "Workarounds en noodprocessen inzetten",
      "Herstelprioriteit bepalen samen met IT",
    ],
    notResponsibleFor: "Communicatie naar buiten, juridische meldingen",
  },
  it_manager: {
    description: "IT-infrastructuur en technische uitvoering",
    mandateSummary: "Voert technische maatregelen uit, coördineert met de MSP en het IR-team, houdt IT-continuïteit bewaakt.",
    authorities: [
      "Systemen isoleren en netwerksegmenten offline halen",
      "IT-herstel en back-up-restore aansturen",
      "MSP en cyberpartner instrueren",
      "Technische incident-updates leveren aan CISO",
    ],
    notResponsibleFor: "Beleid, juridische keuzes, externe communicatie",
  },
}
