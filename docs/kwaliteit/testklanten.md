# Vaste testklanten

Vijf ijkpunten voor de scenariobeoordeling. Elk gegenereerd scenario wordt tegen
één van deze klanten gescoord (zie `rubric.md`). Ze zijn verzonnen maar
realistisch — dit zijn de vaste referenties. Verander ze niet zonder
`docs/overdracht/status.md` bij te werken, anders zijn oude scores niet meer
vergelijkbaar met nieuwe.

De 8 rollen komen uit `lib/types.ts:10` — `ceo · ciso · cfo · legal ·
head_of_comms · hr_lead · ops_manager · it_manager`. Niet elke klant heeft
alle rollen bezet; dat is expliciet vermeld want dat is een test op zich
(kiest de wizard rollen die passen bij de klant?).

---

## 1. Stichting Onderwijs Zuid-Kennemerland

**Sector**: primair onderwijs — basisscholen
**Medewerkers**: ~350 (leraren ~280, admin + ondersteuning ~40, directie ~10, ICT ~4)
**Overige omvang**: 12 locaties, ~3500 leerlingen

**IT-inrichting**: kantoor volledig in Microsoft 365. Leerlingadministratie
(ParnasSys) in de cloud bij de leverancier. Twee kleine on-prem NAS-servers
per locatie voor gedeelde documenten en foto's. IT is uitbesteed aan een
middelgrote onderwijs-MSP (fictieve naam WestNet ICT) met 08:00–17:00
werkdag-SLA; buiten die tijd piket tegen meerprijs. Interne ICT-coördinator
zonder security-mandaat.

**Kroonjuwelen**:
- Leerlingdossiers (bijzondere persoonsgegevens onder AVG art. 9)
- Personeelsadministratie (BSN, salarisgegevens)
- Financiële en RvT-vergaderdocumenten

**Crisis-team (bezet)**: `ceo` (bestuurder), `hr_lead`, `it_manager`
(ICT-coördinator zonder security-mandaat), `legal` (via extern advocaat op
afroep — geen vaste rolhouder in de sessie).

**Rollen NIET bezet**: `ciso` (rol ligt bij de bestuurder, formeel niet
apart), `head_of_comms` (bestuurder + externe pr-adviseur op afroep),
`cfo` (rol binnen de bestuurder), `ops_manager` (integratie in directie).

**Regelgevende status**: NIS2 essentiële entiteit onder Annex I onderwijs
(sector 2024 opgenomen), AVG-verwerkingsverantwoordelijke voor bijzondere
persoonsgegevens.

**Wat dit scenario moet testen**: kan de wizard omgaan met een klant die
maar half een crisisteam heeft? Verzint hij een CISO die er niet is, of legt
hij de CISO-verantwoordelijkheid bij een bestaande rol?

---

## 2. Vermeulen Metaal BV

**Sector**: metaalproductie — plaatbewerking en assemblage voor
industriële klanten (o.a. defensie-toelevering)
**Medewerkers**: 120 (productie ~90, kantoor ~25, management ~5)
**Overige omvang**: eén productielocatie, 2 kantoorvestigingen

**IT-inrichting**: on-prem ERP (SAP Business One via lokale integrator) met
MRP-koppeling naar OT (CNC-machines en robotcell). Kantoor in Microsoft 365.
VPN naar hoofdvestiging. Cyberpartner op abonnement met piket 24/7. Geen
dedicated CISO — technisch beheerder is 0,6 fte, rest via de integrator.

**Kroonjuwelen**:
- Productieplanning + open orders (uur-stilstand kost ~€15k)
- CAD-tekeningen van klanten (waaronder defensie-toeleveringsketen — exportcontrole)
- Personeelsadministratie
- Financiële administratie

**Crisis-team (bezet)**: `ceo` (directeur-eigenaar), `cfo`, `ops_manager`
(productieleider), `it_manager` (systeembeheerder), `legal` (extern advocaat
op afroep).

**Rollen NIET bezet**: `ciso`, `hr_lead` (bij `ops_manager`),
`head_of_comms` (bij `ceo`).

**Regelgevende status**: NIS2 belangrijke entiteit onder Annex II
vervaardiging. Klantcontracten defensie-toelevering kennen aanvullende
meldplichten (KDD-clausules).

**Wat dit scenario moet testen**: OT/IT-convergentie in het verhaal (raakt
containment ook de productie?), en klantketen-meldplichten naast NIS2/AVG.
Directeur-eigenaar met te veel petten op — de wizard moet dat verwerken
zonder onrealistische delegatie te verzinnen.

---

## 3. GGZ De Waterhof

**Sector**: ambulante geestelijke gezondheidszorg (jeugd + volwassenen)
**Medewerkers**: 480 (behandelaars ~350, ondersteuning + admin ~110, management ~20)
**Overige omvang**: 6 locaties, ~4200 cliënten in actieve behandeling

**IT-inrichting**: hybride — EPD (fictief: User) in private cloud bij een
zorg-ISV, kantoorautomatisering in Microsoft 365, MFA verplicht sinds 2024,
roosterplanning via een aparte SaaS-provider. Externe MSP voor devices en
kantoorondersteuning. Interne security-adviseur (0,4 fte) rapporterend aan
`cfo`.

**Kroonjuwelen**:
- EPD (bijzondere persoonsgegevens categorie gezondheid — hoogste categorie
  onder AVG)
- Roosterplanning (crisisdienst — uitval leidt direct tot
  behandelonderbreking)
- Medicatievoorschriften
- Financiële administratie

**Crisis-team (bezet)**: alle 8 rollen bezet. `ciso` is de interne
security-adviseur (deeltijd). `legal` is tevens FG (Functionaris
Gegevensbescherming).

**Regelgevende status**: NIS2 essentiële entiteit onder Annex I gezondheid,
AVG art. 9 (bijzondere persoonsgegevens categorie gezondheid), NEN
7510-gecertificeerd, IGJ-toezicht op zorgverlening.

**Wat dit scenario moet testen**: de duurste kroonjuwelen (categorie
gezondheid = zwaarste boete-regime en meeste toezichthouders) plus alle
rollen bezet. Als de wizard hier géén rijk dilemma produceert, ligt het niet
aan de klant.

---

## 4. Van der Meer Vermogensbeheer

**Sector**: financiële dienstverlening — vermogensbeheer voor
particulieren en institutionele klanten
**Medewerkers**: 68 (adviseurs + relatiebeheer ~30, portfolio + trading ~15,
compliance + risk ~8, ondersteuning ~15)
**Overige omvang**: AuM €2,3 miljard, ~1800 actieve klanten, één hoofdkantoor

**IT-inrichting**: volledig cloud (Microsoft 365 + portfolio-managementsysteem
SaaS + orderplatform van een grote broker). Extern SOC via MSSP (24/7). Zeer
sterke identiteitsbeveiliging: MFA + PAM + conditional access. Dedicated
`ciso`. DORA-conform sinds januari 2025.

**Kroonjuwelen**:
- Klantportefeuilles inclusief transactiebevoegdheden (grootste single-point
  risico: onbevoegde transactie)
- KYC/AML-dossiers
- Live orderplatform (verstoring = marktrisico)
- Klantcommunicatie (mailboxen)

**Crisis-team (bezet)**: alle 8 rollen. `legal` is tevens interne
compliance-officer. `head_of_comms` is de marketing-lead met externe
crisisPR-agency op contract.

**Regelgevende status**: AFM-vergunning (vermogensbeheer), DORA-verordening
(kritieke ICT-processen, meldplicht 4u/24u/72u aan DNB), NIS2 belangrijke
entiteit financiële markten, MiFID II.

**Wat dit scenario moet testen**: DORA + AFM + NIS2 samen — kloppen de
meldplichten (4u/24u/72u) én worden ze op elkaar afgestemd? En: wat betekent
"onbevoegde transactie" tijdens een ransomware-inschakeling? Deze klant
maakt of breekt de wizard op regelgeving.

---

## 5. Cloudbrick B.V.

**Sector**: IT-dienstverlening — Managed Service Provider voor MKB
**Medewerkers**: 85 (engineers ~60, servicedesk ~15, sales ~5, management ~5)
**Overige omvang**: ~180 MKB-klanten (typisch 20–200 fte), één hoofdkantoor +
één servicehub

**IT-inrichting**: eigen SOC (16/5 met piket 24/7), PSA (Autotask) + RMM
(Datto) multi-tenant. Volledig cloud + private hosting bij TransIP en
Leaseweb. Zeer sterke interne security en identity — vooropgestelde eigen
tandvlees is de business case.

**Kroonjuwelen**:
- Klantomgevingen — privileged access naar 180 klanten
  (supply-chain-risico, écht kritiek)
- Klantendata in PSA en RMM
- Service-desk credentials en API-tokens
- Eigen source code voor scripts en automatiseringen

**Crisis-team (bezet)**: `ceo` (technisch DGA), `ciso` (SOC-lead), `cfo`
(interim / extern), `legal` (op afroep), `hr_lead`, `ops_manager`
(service-manager), `it_manager` (senior engineers wisselen deze rol).

**Rollen NIET bezet**: `head_of_comms` (`ceo` + technisch accountmanager doen
communicatie samen).

**Regelgevende status**: NIS2 belangrijke entiteit onder Annex II ICT-
dienstverlening. Klantcontracten kennen doorlopende meldplichten (klanten die
zelf onder NIS2 vallen leggen dat vaak contractueel neer). Reputatie is het
primaire bedrijfsrisico — één klant-omgeving stuk is nieuws.

**Wat dit scenario moet testen**: supply-chain positie — een compromise bij
Cloudbrick treft 180 klanten. Verzint de wizard multi-tenant scenarios en
klantcommunicatie-cascades? En kan het een MSP het onderscheid tussen "eigen
incident" en "klant-incident dat via ons loopt" laten maken?
