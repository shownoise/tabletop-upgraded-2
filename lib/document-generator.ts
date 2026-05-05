import type { ExerciseConfig, RoleDocument, Role } from "./types"

function docId() {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function insurerFor(sector: string): { name: string; phone: string; email: string } {
  const map: Record<string, { name: string; phone: string; email: string }> = {
    "Financial Services": { name: "Allianz Cyber Solutions", phone: "+31 20 555 0200", email: "cyber.claims@allianz.nl" },
    "Healthcare":         { name: "Aon Cyber Risk", phone: "+31 20 555 0300", email: "cyber@aon.nl" },
    "Energy & Utilities": { name: "Zurich Cyber", phone: "+31 20 555 0400", email: "cyber.claims@zurich.nl" },
    "Public Sector":      { name: "Nationale Nederlanden Cyber", phone: "+31 70 555 0500", email: "cyber@nn.nl" },
  }
  return map[sector] ?? { name: "AXA XL Cyber", phone: "+31 20 555 0100", email: "cyber.claims@axaxl.nl" }
}

function coverageLimitFor(size: string): string {
  if (size.includes("1,500")) return "€ 10.000.000"
  if (size.includes("500")) return "€ 5.000.000"
  if (size.includes("250")) return "€ 2.500.000"
  return "€ 1.000.000"
}

export function generateDocuments(config: ExerciseConfig): RoleDocument[] {
  const sector    = config.sector        || "de organisatie"
  const size      = config.companySize   || "250–500"
  const systems   = config.criticalSystems || "ERP, klantportaal, identiteitsprovider"
  const crown     = config.crownJewels   || "klantgegevens, financiële records"
  const scenario  = config.scenarioType  || "Ransomware"
  const insurer   = insurerFor(sector)
  const limit     = coverageLimitFor(size)
  const policyNum = `CY-${Date.now().toString(36).toUpperCase().slice(-6)}`

  const docs: RoleDocument[] = []

  // ─── CFO: Cyber Insurance Policy ───────────────────────────────
  docs.push({
    id: docId(),
    targetRole: "cfo",
    title: "Cyber Verzekeringspolis — Samenvatting",
    type: "policy",
    referenceTag: "insurance",
    content: `POLISNUMMER: ${policyNum}
VERZEKERAAR: ${insurer.name}
VERZEKERDE: ${sector}-organisatie
DEKKINGSPERIODE: 1 januari – 31 december

MAXIMALE UITKERING: ${limit} per incident

GEDEKTE RISICO'S
• Ransomware en cyberafpersing: GEDEKT (tot ${limit})
• Losgeldbetalingen: GEDEKT — voorafgaande schriftelijke toestemming verzekeraar vereist
• Business interruption (max. 90 dagen): GEDEKT
• Forensisch onderzoek en IR-kosten: GEDEKT
• Crisismanagement en PR: GEDEKT (tot € 250.000)
• Aansprakelijkheid richting derden/klanten: GEDEKT
• Boetes toezichthouders (AP, NIS2): GEDEKT tot € 500.000

UITSLUITINGEN
• Aanvallen via niet-gepatchte systemen ouder dan 180 dagen
• Schade door interne fraude zonder melding
• Bekende kwetsbaarheden waarvoor patch beschikbaar was

MELDINGSPLICHT
U dient een incident binnen 24 uur na ontdekking te melden.
Losgeldonderhandelingen starten ZONDER toestemming: polis vervalt.

DIRECTE LIJN CLAIMS
${insurer.name} — Incident Hotline
Telefoon: ${insurer.phone}
E-mail: ${insurer.email}
24/7 bereikbaar — vermeld polisnummer ${policyNum}`,
  })

  // ─── Legal: GDPR / NIS2 Checklist ──────────────────────────────
  docs.push({
    id: docId(),
    targetRole: "legal",
    title: "GDPR Artikel 33 & NIS2 Meldplicht Checklist",
    type: "checklist",
    referenceTag: "gdpr",
    content: `GDPR ARTIKEL 33 — MELDING AAN AUTORITEIT PERSOONSGEGEVENS (AP)

DEADLINE: 72 uur na eerste kennis van inbreuk
Starttijdstip meldklok: moment waarop een medewerker redelijkerwijs kennis had.

VEREISTE INFORMATIE VOOR AP-MELDING
☐ Aard van de inbreuk (vertrouwelijkheid / integriteit / beschikbaarheid)
☐ Categorieën betroffen persoonsgegevens (bijv. namen, BSN, financieel)
☐ Aantal betrokken personen (schatting acceptabel)
☐ Vermoedelijke oorzaak
☐ Naam en contactgegevens functionaris gegevensbescherming (FG)
☐ Verwachte gevolgen van de inbreuk
☐ Getroffen en geplande maatregelen

AP MELDINGSPORTAAL: https://datalekken.autoriteitpersoonsgegevens.nl
Telefonisch: 088 – 180 52 50

NIS2-MELDPLICHT (bij significante incidenten)
• Early warning: binnen 24 uur — aan NCSC of sector-CSIRT
• Incident notification: binnen 72 uur — met impact-inschatting
• Tussenrapportage: op verzoek
• Eindrapport: binnen 1 maand

NCSC melden: ncsc.nl/incident-melden

BETROKKEN SYSTEMEN DEZE CASUS
Kritieke systemen: ${systems}
Gegevens at risk: ${crown}

INTERNE ESCALATIE VOORDAT U MELDT
☐ CISO heeft incidentclassificatie bevestigd
☐ CEO heeft meldingsbesluit goedgekeurd
☐ Tijdstip eerste kennis gedocumenteerd`,
  })

  // ─── CISO: IR Quick Reference ───────────────────────────────────
  docs.push({
    id: docId(),
    targetRole: "ciso",
    title: "IR Respons Quick Reference",
    type: "reference",
    referenceTag: "ir",
    content: `INCIDENTCLASSIFICATIE

P1 — KRITIEK: productiesystemen neer, data-exfiltratie bevestigd, ransomware actief
P2 — HOOG: systemen degraded, verdachte activiteit bevestigd, dreiging geïdentificeerd
P3 — MEDIUM: anomalieën, alerts zonder bevestigde impact
P4 — LAAG: informatief, geen directe impact

HUIDIGE CLASSIFICATIE: Beoordeel op basis van actuele situatie

ESCALATIEKETEN
1. IT Manager → CISO (altijd, ook buiten kantooruren)
2. CISO → CEO + Legal (bij P1/P2)
3. CEO → Board chair (bij P1 of media-druk)
4. Legal → AP/NCSC (bij datalek of NIS2-trigger)

EERSTE 60 MINUTEN (P1-incident)
☐ 0–5 min: Bevestig incident, wijs Incident Commander aan
☐ 5–15 min: Isoleer getroffen systemen (geen volledige shutdown)
☐ 15–30 min: Activeer externe IR-partij
☐ 30–45 min: Brief CEO (mondeling), Legal op de hoogte
☐ 45–60 min: Documenteer timeline, start forensische preservering

KRITIEKE SYSTEMEN IN SCOPE
${systems}

CROWN JEWELS — maximale bescherming
${crown}

EXTERNE IR CONTACTEN
Maak vóór escalatie contact via de in het IR-contract vastgelegde hotline.
Beschikbaar 24/7 bij P1-incidents.

CONTAINMENT CRITERIA (systemen pas vrijgeven als):
☐ Initieel toegangspunt geïdentificeerd en gesloten
☐ Laterale beweging volledig in kaart gebracht
☐ Geen actieve backdoors of persistentiemechanismen meer aanwezig`,
  })

  // ─── CEO: Board Escalation Protocol ────────────────────────────
  docs.push({
    id: docId(),
    targetRole: "ceo",
    title: "Board Escalatieprotocol — Cyberincident",
    type: "plan",
    referenceTag: "board",
    content: `WANNEER INFORMEERT DE CEO DE BOARD?

P1-incident (kritiek): directe mondelinge notificatie binnen 2 uur
P2-incident (hoog): schriftelijke update binnen 4 uur
Mediaberichtgeving: voorafgaand aan persverklaring
Losgeldoverweging: board-besluit vereist voor bedragen > € 100.000
Regulatoire melding: board op de hoogte vóór indiening

VERPLICHTE BESLUITEN VOOR CEO
☐ Formele incidentverklaring intern
☐ Activering crisisteam
☐ Autorisatie externe IR-partij
☐ Definitief go/no-go losgeld (mede ondertekend CFO + Legal)
☐ Finale goedkeuring externe communicatie

BOARD BRIEFING STRUCTUUR (5 minuten)
1. Wat weten we zeker? (feiten, geen speculatie)
2. Wat weten we nog niet? (gaps)
3. Welke maatregelen zijn genomen?
4. Welk besluit vragen we aan de board?
5. Wanneer is de volgende update?

SPREEKPUNTEN BIJ MEDIAVRAGEN
• "We are aware of the situation and have activated our incident response team."
• "We are cooperating fully with relevant authorities."
• "We will provide an update at [tijdstip]."
• NOOIT: bevestig of ontkent betaling losgeld aan pers

SECTOR: ${sector} | OMVANG: ${size} medewerkers
SCENARIO: ${scenario}`,
  })

  // ─── Head of Comms: Crisis Comms Playbook ──────────────────────
  docs.push({
    id: docId(),
    targetRole: "head_of_comms",
    title: "Crisiscommunicatie Draaiboek",
    type: "template",
    referenceTag: "comms",
    content: `HOLDING STATEMENT — DIRECT INZETBAAR

"Wij zijn op de hoogte van een IT-verstoring die momenteel wordt onderzocht. De veiligheid van onze klantgegevens en bedrijfscontinuïteit heeft onze volledige aandacht. Ons incident response team is actief. Wij informeren u zodra er meer duidelijkheid is."

[Aanpassen per situatie — CEO goedkeuring vereist vóór verzending]

STAKEHOLDERPRIORITERING
1. Medewerkers (interne update vóór externe)
2. Board/aandeelhouders
3. Klanten (als data getroffen)
4. Pers/media
5. Toezichthouders (via Legal)
6. Leveranciers/partners

INTERNE COMMUNICATIE MEDEWERKERS
Subject: Cyberincident — update voor medewerkers
"Beste collega's, we hebben een cyberveiligheidsincident vastgesteld. Onze IT- en beveiligingsteams werken actief aan herstel. Klik niet op verdachte links. Gebruik [noodcommunicatiekanaal] voor urgente zaken. Meer info volgt zodra beschikbaar."

SOCIALE MEDIA PROTOCOL
• Geen reactie op sociale media zonder goedkeuring CEO
• Monitor: Twitter/X, LinkedIn, nieuws-sites
• Escaleer screenshots van interne informatie direct aan CISO
• Verklaring pers: altijd via het persbericht, nooit DM

PERSCOMMUNICATIE
Contacten NOS: 020-555-0101
ANP: 020-555-0200
Lokale media: 020-555-0300

VERBODEN UITSPRAKEN
• "Er is geen bewijs van datadiefstal" (tenzij forensisch bevestigd)
• "We betalen geen losgeld" (schept juridische/tactische risico's)
• "Alles is onder controle" (te vroeg, ondermijnt geloofwaardigheid)`,
  })

  // ─── HR Lead: Employee Crisis Protocol ─────────────────────────
  docs.push({
    id: docId(),
    targetRole: "hr_lead",
    title: "Medewerkers Crisisprotocol",
    type: "plan",
    referenceTag: "hr",
    content: `COMMUNICATIESTRUCTUUR MEDEWERKERS

Cascadestap 1: HR informeert teamleiders (direct na besluit CEO)
Cascadestap 2: Teamleiders informeren medewerkers (standaard bericht)
Cascadestap 3: HR stuurt all-hands update (max. 2 uur na Cascadestap 1)

WAT MEDEWERKERS MOETEN WETEN
✓ Er is een cyberveiligheidsincident vastgesteld
✓ IT en beveiliging werken aan herstel
✓ Instructies voor noodprocedures volgen (zie bijlage)
✗ Geen details over aanvalsomvang of type aanvaller
✗ Geen speculaties over oorzaak of duur

GEDRAGSREGELS MEDEWERKERS TIJDENS INCIDENT
• Stop met gebruik van getroffen systemen (aanwijzing IT)
• Gebruik noodmailboxen / telefoon voor urgente klantcommunicatie
• Meld verdachte e-mails/berichten direct aan IT (ook als al geklikt)
• Schakel niet op eigen initiatief systemen in/uit
• Spreek NIET met pers, ook niet via persoonlijke social media

INSIDER THREAT PROCEDURE
Bij vermoedens van betrokkenheid medewerker:
1. Direct melden aan CISO + HR directeur (niet aan lijnmanager)
2. HR + Legal beoordelen passende maatregelen
3. Forensische preservering vóór eventuele confrontatie

MEDEWERKER ONDERSTEUNING
• Aanspreekpunten tijdens incident: [HR Manager] via [noodlijn]
• EAP (Employee Assistance Program): beschikbaar 24/7
• Thuiswerkende medewerkers: apart informeren via directe lijnmanager`,
  })

  // ─── Ops Manager: Business Continuity Quick Reference ──────────
  docs.push({
    id: docId(),
    targetRole: "ops_manager",
    title: "Business Continuity — Noodprocedure Overzicht",
    type: "reference",
    referenceTag: "bcp",
    content: `KRITIEKE SYSTEMEN EN PRIORITERING

${systems.split(",").map((s, i) => `PRIORITEIT ${i + 1}: ${s.trim()}`).join("\n")}

HERSTELPRIORITEIT VOLGORDE
1. Systemen die klantgegevens verwerken (${crown})
2. Financiële transactiesystemen
3. Interne communicatieplatforms
4. Overige productiesystemen

RPO / RTO DOELSTELLINGEN (REFERENTIE)
• Tier 1 systemen: RPO 4u / RTO 8u
• Tier 2 systemen: RPO 24u / RTO 24u
• Tier 3 systemen: RPO 72u / RTO 72u

HANDMATIGE NOODPROCEDURES
• Klantcommunicatie: telefoon via centraal nummer 0800-XXXXXXX
• Orderverwerking: papierformulieren via faxnummer (archief HR-kast)
• Financiële autorisaties: twee-handtekeningen papieren procedures
• Leverancierscontact: zie leveranciersregister (papieren versie kluisruimte)

EXTERNE PARTNERS — PRIORITAIRE CONTACTEN
• Cloud/hosting provider: [contractnummer, 24/7 lijn]
• Primaire leverancier: [naam, telefoonnummer]
• Logistiek partner: [naam, telefoonnummer]

BESLISSINGSBEVOEGDHEID TIJDENS INCIDENT
Omschakeling naar handmatige procedures: Ops Manager beslist (geen CEO-goedkeuring nodig)
Failover naar DR-omgeving: CISO + Ops Manager gezamenlijk
Volledige shutdown businessproces: CEO-goedkeuring vereist

SECTOR: ${sector} | MEDEWERKERS: ${size}`,
  })

  return docs
}
