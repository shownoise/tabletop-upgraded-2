import type { OutcomeDimension } from './constants'

export type OutcomeVector = Record<OutcomeDimension, number>

/**
 * Score-tabel per beslissings-optie.
 *
 * Sleutel-formaat: `${allowedRole}::${label}` — exact zoals in de scenario-data
 * staat. Waarden zijn integers van −2 tot +2 per dimensie.
 *
 * Dimensies:
 *   CONT — containment (hoe snel/effectief ingedamd)
 *   FOR  — forensische positie (bewijs behouden)
 *   BC   — bedrijfscontinuïteit (proces doorloop)
 *   JUR  — juridisch & meldplicht
 *   VER  — verantwoording & communicatie (stakeholders)
 *   KOS  — kosten & schade (hoger = beter, dus minder schade)
 *
 * Aanpassen: wijzig de vector, save. De scoring-engine leest deze tabel FIRST;
 * inline `outcomeVector` op scenario-opties is fallback.
 *
 * Impliciete opties ("Geen besluit binnen de tijd") staan bewust NIET in deze
 * tabel — die blijven inline in de scenario-data omdat ze per ronde
 * verschillen (5 varianten).
 *
 * Om een override toe te voegen voor een nieuwe optie:
 *   1. Kopieer de exacte label-string uit de scenario-data
 *   2. Voeg een regel toe: `"${allowedRole}::${label}": { CONT: 0, FOR: 0, ... },`
 *
 * ── Bewerkings-tips ─────────────────────────────────────────────────────
 *   • Denk in trade-offs: zelden zijn alle 6 dimensies positief. Kies waar
 *     de keuze WINT en waar het KOST.
 *   • Escalatie-schaal: 0 = neutraal, ±1 = merkbaar, ±2 = extreem.
 *   • Verplicht → hoge JUR-uitslag. Bewijs wissen → sterk negatieve FOR.
 *   • Losgeld betalen: kies bewust hoe je VER en JUR wegzet.
 */
export const DECISION_VECTOR_OVERRIDES: Record<string, OutcomeVector> = {
  "ciso::Eye Security-retainer nu al activeren — vóór bevestiging": { CONT: 1, FOR: 2, BC: 0, JUR: 1, VER: 1, KOS: -2 },
  "ciso::WestNet formeel opschalen — engineer nu op de zaak": { CONT: 2, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: -1 },
  "ciso::Zelf FS-01 uitzetten via de switch (stekker)": { CONT: 2, FOR: -2, BC: -2, JUR: 0, VER: 0, KOS: 1 },
  "ciso::Alleen monitoren, geen actie tot Rob terug is": { CONT: -2, FOR: -1, BC: 1, JUR: -1, VER: 0, KOS: 0 },
  "ceo::Bestuurssecretaris crisismandaat geven — 72 uur, tekenbevoegd": { CONT: 1, FOR: 0, BC: 1, JUR: 2, VER: 1, KOS: 0 },
  "ceo::Zelf alles blijven aansturen tot beeld helder is": { CONT: 0, FOR: -1, BC: -1, JUR: -1, VER: 1, KOS: 1 },
  "ceo::Bel eerst RvT-voorzitter voor persoonlijk advies": { CONT: -1, FOR: 0, BC: 0, JUR: 0, VER: 1, KOS: 1 },
  "ceo::Wacht op Rob's terugkeer voordat je iets tekent": { CONT: -2, FOR: 1, BC: -1, JUR: -2, VER: 0, KOS: 1 },
  "legal::Meldingsklok formeel starten op 08:42 en logboek openen": { CONT: 0, FOR: 1, BC: 0, JUR: 2, VER: 1, KOS: 0 },
  "legal::Wacht met klok starten tot bevestiging ransomware": { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -1, KOS: 1 },
  "legal::Contract-check Magister (48u) én Univé (24u) klaarleggen": { CONT: 0, FOR: 0, BC: 1, JUR: 2, VER: 0, KOS: 0 },
  "legal::Legal-workstream pauzeren tot IT bevestigt": { CONT: 0, FOR: -1, BC: 0, JUR: -1, VER: -1, KOS: 1 },
  "it_manager::Netwerk-isolatie FS-01/02 aanvragen bij WestNet": { CONT: 2, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: -1 },
  "it_manager::Alle 350 accounts een password-reset forceren": { CONT: 1, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 1 },
  "it_manager::Volledig herstellen uit backup, nu direct": { CONT: 0, FOR: -2, BC: -2, JUR: -1, VER: 1, KOS: -2 },
  "it_manager::Rob terugvliegen van vakantie": { CONT: -1, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: -2 },
  "ceo::Publiek video-statement bestuurder om 15:00 vandaag": { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 2, KOS: -1 },
  "ceo::Wachten tot Eye Security volledige technische bevestiging geeft": { CONT: 0, FOR: 1, BC: -1, JUR: -1, VER: -2, KOS: 0 },
  "ceo::Alleen intern communiceren, extern nog even niet": { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: -1, KOS: 0 },
  "ceo::Betalen autoriseren zodat rapportvergadering doorgaat": { CONT: -1, FOR: -1, BC: 1, JUR: -2, VER: -2, KOS: 1 },
  "cfo::Univé formeel activeren + onderhandelaar aanvragen": { CONT: 0, FOR: 0, BC: 1, JUR: 2, VER: 1, KOS: -1 },
  "cfo::Univé pas informeren als betaling ter sprake komt": { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -1, KOS: 1 },
  "cfo::Alleen interne kostenraming maken, extern niets": { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: 0, KOS: 0 },
  "cfo::Cashreserve reserveren voor snelle betaling (backup-plan)": { CONT: 0, FOR: 0, BC: 1, JUR: -1, VER: -1, KOS: 0 },
  "legal::AP-melding indienen als voorlopig — completering later": { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 1, KOS: 0 },
  "legal::Iddink (Magister) contractueel informeren binnen 48u": { CONT: 0, FOR: 0, BC: 1, JUR: 2, VER: 0, KOS: 0 },
  "legal::Wachten met NCSC-melding — 24u zit er nog ruim in?": { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: 0, KOS: 1 },
  "legal::Vertrouwelijkheidsverklaringen alle betrokken partijen": { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: -1, KOS: 1 },
  "ciso::Eye Security IR de lead geven — WestNet ondersteunt": { CONT: 1, FOR: 2, BC: 0, JUR: 0, VER: 1, KOS: -1 },
  "ciso::WestNet de lead laten houden — Eye Security als sparring": { CONT: 0, FOR: -1, BC: 0, JUR: 0, VER: -1, KOS: 0 },
  "ciso::Zelf de lead nemen — WestNet en Eye Security parallel gebruiken": { CONT: -1, FOR: -1, BC: -1, JUR: 0, VER: 1, KOS: 0 },
  "ciso::Alle domain-accounts direct verlopen ipv gerichte reset": { CONT: 1, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 0 },
  "head_of_comms::Bestuurder belt zelf terug naar RTV Oost — feitelijk statement": { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 2, KOS: -1 },
  "head_of_comms::Persbericht + geen mondelinge reactie richting RTV Oost": { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 0, KOS: 0 },
  "head_of_comms::'Geen commentaar' — regie via stilte": { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: -2, KOS: 1 },
  "head_of_comms::Preventief interview met sympathiek regionaal medium": { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: 1, KOS: 1 },
  "legal::AP-completering vandaag afronden + verzenden": { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 1, KOS: 0 },
  "legal::Bewuste keuze: melding aanvullen tot laatste moment (donderdag 08:42)": { CONT: 0, FOR: 1, BC: 1, JUR: 1, VER: 0, KOS: 0 },
  "legal::NCSC-melding indienen ondanks verstreken 24u": { CONT: 0, FOR: 1, BC: 0, JUR: 1, VER: 1, KOS: 0 },
  "legal::NCSC-melding overslaan omdat 24u al voorbij is": { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -1, KOS: 1 },
  "ops_manager::Noodrooster vasthouden tot vrijdag — geen half-halfmaatregel": { CONT: 0, FOR: 0, BC: 2, JUR: 0, VER: 0, KOS: -1 },
  "ops_manager::Woensdag proberen terug naar Magister — nieuwe tenant": { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 1 },
  "ops_manager::Toetsweek 46 doorschuiven naar week 48": { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 },
  "ops_manager::Toetsweek 46 gewoon doorlaten gaan": { CONT: 0, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 2 },
  "hr_lead::Q&A-document + hotline voor docenten": { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 1, KOS: -1 },
  "hr_lead::Alleen teamleiders informeren, zij briefen docenten": { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 1 },
  "hr_lead::Op-de-vlakte-houden — 'niet verontrusten'": { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: -2, KOS: 2 },
  "hr_lead::Docenten vrijaf geven zolang Magister uit is": { CONT: 0, FOR: 0, BC: -2, JUR: 0, VER: -1, KOS: 2 },
  "ceo::Niet betalen — vertrouwen op restore + reconstructie": { CONT: 1, FOR: 1, BC: -1, JUR: 2, VER: 2, KOS: 1 },
  "ceo::Onderhandelaar 24u laten rekken — parallel restore doorzetten": { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 1, KOS: 0 },
  "ceo::€340k betalen via Univé — polisdekking gebruiken": { CONT: 0, FOR: 0, BC: 1, JUR: -1, VER: -2, KOS: -1 },
  "ceo::€340k betalen buiten Univé om — snelheid boven dekking": { CONT: -1, FOR: -1, BC: 1, JUR: -2, VER: -2, KOS: 0 },
  "ciso::Volledig forensisch scope-document leveren aan Univé": { CONT: 1, FOR: 2, BC: 0, JUR: 1, VER: 1, KOS: -1 },
  "ciso::Beperkte scope-verklaring — snelheid boven volledigheid": { CONT: 0, FOR: -1, BC: 0, JUR: -1, VER: 0, KOS: 1 },
  "ciso::Volledige eradication forceren vóór welke restore ook": { CONT: 2, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: -1 },
  "ciso::Restore starten parallel aan sweep — geen tijd te verliezen": { CONT: -1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: -1 },
  "cfo::Complete polislimit-analyse + kosten-scenario aan CEO": { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 1, KOS: 1 },
  "cfo::Cashflow-buffer opzetten voor onvoorziene kosten": { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 2 },
  "cfo::Snelle betaling voorbereiden — 'voor de zekerheid'": { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: 1, KOS: 2 },
  "cfo::Univé-onderhandelaar buiten spel zetten — zelf onderhandelen": { CONT: 1, FOR: 0, BC: -1, JUR: -2, VER: -1, KOS: -2 },
  "legal::Sanctielijstencheck (OFAC/EU) + juridische betalingsgoedkeuring": { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 0, KOS: 0 },
  "legal::AP-klachtreactie feitelijk voorbereiden binnen deadline": { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 1, KOS: 0 },
  "legal::AP-klachtreactie uitstellen tot na losgeld-besluit": { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: -1, KOS: 1 },
  "legal::Juridisch: 'wij betalen niet' zonder proces vastleggen": { CONT: 0, FOR: 0, BC: -1, JUR: -1, VER: 1, KOS: 1 },
  "ceo::Bestuurder belt LoonBureau CEO — gezamenlijk crisis-plan": { CONT: 1, FOR: 1, BC: 1, JUR: 2, VER: 1, KOS: -1 },
  "ceo::CISO's laten afstemmen — bestuurders op de hoogte houden": { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER: 0, KOS: 0 },
  "ceo::LoonBureau doorverwijzen naar onze verzekeraar": { CONT: -1, FOR: -1, BC: -1, JUR: -1, VER: -2, KOS: 1 },
  "ceo::LoonBureau ontkennen betrokkenheid — 'apart incident'": { CONT: -1, FOR: -2, BC: -1, JUR: -2, VER: -2, KOS: 2 },
  "hr_lead::PMR-gesprek 15:00 + eenmalige toelage voorstellen": { CONT: 0, FOR: 0, BC: 2, JUR: 0, VER: 1, KOS: -1 },
  "hr_lead::PMR-gesprek verzetten naar volgende week": { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: -1, KOS: 2 },
  "hr_lead::Overuren erkennen zonder concrete compensatie": { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: 1 },
  "hr_lead::Overuren afdoen als 'ligt in normale werktijd'": { CONT: 0, FOR: 1, BC: -2, JUR: -1, VER: -2, KOS: 2 },
  "head_of_comms::AOb-statement inhoudelijk beantwoorden — feit erkennen waar terecht": { CONT: 1, FOR: 0, BC: 0, JUR: 1, VER: 2, KOS: -1 },
  "head_of_comms::AOb-statement negeren — reageert op zichzelf uit": { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: -1, KOS: 1 },
  "head_of_comms::AOb defensief weerleggen — 'ongefundeerd'": { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: -2, KOS: 2 },
  "head_of_comms::Voorzitter oudervereniging in stuurgroep verbetering betrekken": { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 2, KOS: -1 },
  "ops_manager::Papieren fallback-processen deze week volhouden": { CONT: 0, FOR: 0, BC: 2, JUR: 0, VER: 0, KOS: -1 },
  "ops_manager::Half-half deze week — Magister waar mogelijk": { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 0, KOS: 2 },
  "ops_manager::Terug naar Magister zodra tenant werkt — donderdag al": { CONT: 0, FOR: 0, BC: -2, JUR: 0, VER: 1, KOS: 1 },
  "ops_manager::Rapportvergadering donderdag doorschuiven naar week 47": { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 1, KOS: -1 },
  "ceo::Concreet governance-pakket met eigenaar, deadline en budget voor RvT": { CONT: 1, FOR: 1, BC: 2, JUR: 2, VER: 2, KOS: -1 },
  "ceo::Verhaal aan RvT, actielijst 'volgt binnen kwartaal'": { CONT: 0, FOR: 0, BC: -1, JUR: 1, VER: 0, KOS: 1 },
  "ceo::Externe consultant vragen om governance-plan te schrijven": { CONT: 0, FOR: 0, BC: 1, JUR: 1, VER: 0, KOS: 0 },
  "ceo::'We hebben het goed gedaan' — actielijst uitstellen": { CONT: -1, FOR: -1, BC: -2, JUR: -2, VER: -1, KOS: 2 },
  "ciso::Hardening-plan: MFA, segmentatie, MDR-scope, account-hygiene — met bedragen": { CONT: 2, FOR: 1, BC: 1, JUR: 1, VER: 1, KOS: -2 },
  "ciso::Rapport 'lessen geleerd' zonder investeringsvoorstel": { CONT: 0, FOR: 1, BC: -1, JUR: 0, VER: 0, KOS: 1 },
  "ciso::Alleen MDR-scope uitbreiden, rest naar volgend jaar": { CONT: 1, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: -1 },
  "ciso::Alles verplaatsen naar cloud — 'we lopen achter'": { CONT: 0, FOR: -1, BC: -1, JUR: -1, VER: 1, KOS: 0 },
  "it_manager::WestNet-contract heronderhandelen — ransomware-scope, 24/7, betere severity-triage": { CONT: 1, FOR: 1, BC: 2, JUR: 1, VER: 1, KOS: -1 },
  "it_manager::MSP wisselen naar een grotere partij (bijv. landelijk)": { CONT: 0, FOR: 0, BC: -1, JUR: 0, VER: 1, KOS: 1 },
  "it_manager::IT-team uitbreiden — junior ICT-medewerker in dienst": { CONT: 1, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: 0 },
  "it_manager::Volledig laten zoals het is — MSP redt het wel": { CONT: -1, FOR: -1, BC: -2, JUR: -1, VER: -1, KOS: 2 },
  "legal::AP-follow-up + NIS2 final report inhoudelijk sluitend maken": { CONT: 0, FOR: 1, BC: 0, JUR: 2, VER: 1, KOS: 0 },
  "legal::AP-follow-up minimalistisch — geen extra info": { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: -1, KOS: 1 },
  "legal::Extern advocatenkantoor inschakelen voor AP-traject": { CONT: 1, FOR: 0, BC: 0, JUR: 1, VER: 0, KOS: -1 },
  "legal::AP-vervolgtraject onderschatten — 'komt vanzelf wel goed'": { CONT: 0, FOR: 0, BC: 0, JUR: -2, VER: -2, KOS: 2 },
}

export function vectorOverrideFor(allowedRole: string | undefined, label: string): OutcomeVector | undefined {
  if (!allowedRole) return undefined
  const key = `${allowedRole}::${label}`
  return DECISION_VECTOR_OVERRIDES[key]
}
