# Module library — de bouwblokken van een tabletop

In plaats van vaste rondes definieert de generator nu een library van modules. Elke template kiest 2 tot 8 modules in de gewenste volgorde. Elke module heeft een leerdoel, een observation lens, default duur, default kanalen, en framework-specifieke gespreksprompts.

## Het volledige module-overzicht

| ID | Naam | Lens | Default duur | Default kanalen |
|---|---|---|---|---|
| detection_sensemaking | Detection & Sensemaking | symptoms | 40 min | siem, teams, sms |
| triage_containment | Triage & Containment | impact | 40 min | siem, phone, email |
| business_continuity | Business Continuity | impact | 40 min | email, teams, memo |
| crisis_communication | Crisis Communication | external_reactions | 40 min | email, news, phone |
| legal_regulatory | Legal & Regulatory | external_reactions | 30 min | email, memo, phone |
| ransom_negotiation | Ransom Negotiation | attacker_voice | 40 min | email, memo |
| recovery_lessons | Recovery & Lessons Learned | impact | 30 min | memo, teams |
| insider_investigation | Insider Investigation | symptoms | 40 min | memo, phone, teams |
| supply_chain_response | Supply Chain Response | external_reactions | 40 min | email, news, phone |
| forensic_attribution | Forensic & Attribution | symptoms | 30 min | memo, siem, phone |

Per module hieronder de volledige definitie.

---

## detection_sensemaking

**Leerdoel:** Het CMT herkent dat losse signalen samen één incident vormen, schaalt op naar crisis-niveau, activeert de juiste rollen en mandatering.

**Wanneer:** Vrijwel altijd als eerste module. Uitzondering: als de oefening start na bevestigde detectie (bv. bij een Recovery-focused oefening).

**Observation lens:** symptoms — meerdere zwakke signalen uit verschillende hoeken.

**Wat de injects doen:** Drie tot vier signalen die afzonderlijk niet alarmerend zijn maar samen wel. Voorbeelden: één gebruiker meldt iets vreemds, finance ervaart trage systemen, support krijgt een SLA-klacht, ons SOC ziet afwijkend gedrag. Het CMT moet de patroonherkenning zelf doen.

**Wat injects NIET doen:** Niet meteen een ransom note tonen. Dat is geen sensemaking — dat is een memo dat je een crisis hebt. De aanvaller heeft die module al gewonnen.

**Beslisruimte:** Wie informeren we, wie roepen we erbij, op welk crisisniveau gaan we, wie krijgt mandaat, schakelen we externe partijen in.

**Framework-prompts:**

- BOB: zwaarte op Beeldvorming. "Wat weten we, wat weten we niet, klopt het wat we weten."
- OODA: snel door de loop. "Wat observeren we, hoe oriënteren we ons, wat besluiten we, wat doen we."
- DAIR: Detect en Assess domineren. "Wat detecteren we, wat is onze inschatting van de impact."
- NIST-IR: Detection-fase expliciet.
- Vrij: open gespreksvorm.

**Default duur:** 40 min.

---

## triage_containment

**Leerdoel:** Het CMT (vaak het IT/security-deel) bepaalt onder onzekerheid welke systemen geïsoleerd worden, in welke volgorde, en welke compromissen daarbij worden gemaakt.

**Wanneer:** Optioneel voor technische teams. Skip voor C-level-only oefeningen of als wij als IR-retainer dit al doen.

**Belangrijk voor IR-retainer scope:** containment-beslissingen worden grotendeels door ons gedaan. Deze module is alleen relevant als de klant een eigen IT-team heeft dat samenwerkt met ons. De decisions gaan over **co-ordinatie met ons IR-team**, niet over technische executie.

**Observation lens:** impact — wat valt uit als we X isoleren.

**Wat de injects doen:** Onze SOC meldt voorgestelde containment-acties. Operations meldt welke processen daardoor zouden stilvallen. Klanten bellen over uitval. Tijdsdruk.

**Beslisruimte:** Welke isolatie-actie krijgt prioriteit, accepteren we collateral downtime, wie autoriseert grote downtime, communicatie over de geplande disruption.

**Default duur:** 40 min.

---

## business_continuity

**Leerdoel:** Het CMT bepaalt impact op vier domeinen (fysiek/digitaal, psychologisch, financieel, reputatie), prioriteert kritieke processen, bepaalt geaccepteerde uitvaltijd, en initieert workarounds.

**Observation lens:** impact — operationele gevolgen worden concreet.

**Wat de injects doen:** Aanval blijkt breder. Backups blijken kapot of verouderd. Een handout maakt impact concreet per afdeling (Finance, HR, Operations, Klantrelatie, Aandeelhouders). Klanten beginnen te bellen.

**Beslisruimte:** Welke processen prio, welke uitvaltijd accepteren we, welke handmatige workaround, intern communicatie naar medewerkers, activeren cyberverzekeraar.

**Handout-template:** een 4-domein impact-tabel die de deelnemers invullen tijdens de module. Zie de oude Eye Security PDF voor het format.

**Default duur:** 40 min.

---

## crisis_communication

**Leerdoel:** Het CMT bepaalt stakeholder-prioriteit, kiest een communicatiestrategie (informeren/empathie vs uitleg/excuses vs verantwoordelijkheid/herstel), en formuleert concrete boodschappen — bij voorkeur live tijdens de module.

**Observation lens:** external_reactions — buitenwereld wordt actief.

**Wat de injects doen:** Journalist mailt met deadline. Klant eist statement. Aandeelhouder belt met scherpe vragen. LinkedIn post van ex-medewerker. Toezichthouder vraagt om early warning. De aanvallers publiceren proof-of-life data.

**Beslisruimte:** Welke stakeholder eerst, wat zeggen we wel/niet, welke woordvoerder, victim framing of verantwoordelijkheid nemen, AVG-meldplicht aan AP, NIS2 early warning aan RDI.

**Live opdracht:** schrijf de persverklaring of klantmail tijdens de module — geeft tijdsdruk en levert tastbaar resultaat.

**Default duur:** 40 min.

---

## legal_regulatory

**Leerdoel:** Het CMT navigeert meldplichten, aansprakelijkheid, contractuele verplichtingen, en juridische risico's.

**Wanneer:** Korte module die vaak parallel aan Crisis Communication loopt, of als opmaat ernaartoe.

**Observation lens:** external_reactions.

**Wat de injects doen:** Memo van advocaat, mail van AP/RDI, contractkluis-clausule die uit context komt, vraag van compliance officer over interne logging-verplichting.

**Beslisruimte:** AVG-meldplicht aan AP (72u), NIS2 early warning aan RDI (24u), incident notification (72u), final report (1 maand), sectorale meldplichten, aangifte bij politie, contractuele schade-claims.

**Default duur:** 30 min.

---

## ransom_negotiation

**Leerdoel:** Het CMT weegt wel/niet betalen af tegen reputatie, juridisch (sanctielijsten), kans op recidive, en bepaalt onderhandelingstactiek of niet-onderhandelen.

**Wanneer:** Alleen relevant bij ransomware of extortion-scenario's.

**Observation lens:** attacker_voice — de aanvaller is expliciet aan het woord.

**Wat de injects doen:** Concrete ransom note met bedrag (richtlijn: 1-2% jaaromzet), wat exact wordt aangeboden (decryptor, geen publicatie, audit van gelekt materiaal), deadline, escalatieclausule. Eventueel sanctie-check signaal of bemiddelaar.

**Beslisruimte:** Wel/niet betalen met argumenten, wie tekent dat besluit af, wat als we niet betalen, wat als we wel betalen maar de aanvaller publiceert toch, hoe verwerken we dit aan accountant/auditor.

**Default duur:** 40 min.

---

## recovery_lessons

**Leerdoel:** Het CMT plant herstel, valideert BIA-aannames tegen ervaring, en formuleert lessons learned die als input dienen voor het cyber-crisis-plan.

**Wanneer:** Laatste module, vaak ingekort. Geschikt voor maturere klanten die het echte plan willen verbeteren.

**Observation lens:** impact — terugkijken op wat er is gebeurd.

**Wat de injects doen:** Tijdlijn van het hele incident wordt expliciet gemaakt. Externe IR-rapport wordt overhandigd. Een vraag van de auditor over wat er beter had gekund.

**Beslisruimte:** Welke aanpassingen aan het cyber-crisis-plan, welke investeringen worden aangevraagd, communicatie naar OR en RvC.

**Default duur:** 30 min.

---

## insider_investigation

**Leerdoel:** Het CMT navigeert de eigenheid van een insider-onderzoek: HR en Legal werken samen met IT, bewijs moet zorgvuldig worden vergaard, communicatie is uiterst beperkt.

**Wanneer:** Alleen relevant bij insider-scenario's.

**Observation lens:** symptoms — gedragssignalen en ongebruikelijke patronen.

**Wat de injects doen:** DLP-alert van een mass download, HR-melding van een vertrekkende medewerker, melding van manager over gedragsverandering, mail van vakbond over een arbeidsconflict.

**Beslisruimte:** Hoe verzamelen we bewijs zonder de verdachte te alarmeren, wie wordt betrokken (HR, Legal, ondernemingsraad), wanneer schorsen we, hoe doen we de gesprekken, gaan we aangifte doen.

**Default duur:** 40 min.

---

## supply_chain_response

**Leerdoel:** Het CMT navigeert third-party afhankelijkheid: hoe weet je wat geraakt is, hoe coördineer je met de leverancier, hoe communiceer je naar jouw klanten over diens compromise.

**Wanneer:** Bij supply chain scenario's, of als secundaire module bij andere scenario's met derde-partij component.

**Observation lens:** external_reactions — een breach notice komt binnen, klanten reageren.

**Wat de injects doen:** Breach notice van de leverancier (vaak vaag), vraag van een grote klant aan jou, mail van jouw eigen toezichthouder over jouw verantwoordelijkheid, een journalist die de schakel maakt.

**Beslisruimte:** Vertrouwen we de leverancier's analyse, doen we eigen onderzoek, eisen we audit-rechten, informeren we onze klanten actief of reactief, wat is onze juridische positie.

**Default duur:** 40 min.

---

## forensic_attribution

**Leerdoel:** Het CMT begrijpt wat forensisch onderzoek wel en niet kan, weegt attributie tegen actie, en communiceert technische bevindingen aan niet-technische stakeholders.

**Wanneer:** Voor maturere klanten of bij scenario's waar attributie een rol speelt (nationaal-statelijk, hacktivisme, gerichte aanval).

**Observation lens:** symptoms — wat zien we in de logs.

**Wat de injects doen:** Forensisch rapport van onze IR (samenvatting + technische appendix), vraag van CISO over wat we wel/niet kunnen zeggen, vraag van directie over "wie zijn deze mensen", mogelijk een NCSC-briefing.

**Beslisruimte:** Hoe communiceren we technische bevindingen, doen we attributie publiek of niet, delen we IOCs met sector via ISAC, doen we aangifte gebaseerd op attributie.

**Default duur:** 30 min.

---

## Default module-combinaties per scenario-type

Als de gebruiker een scenario-type kiest zonder modules expliciet te configureren:

**Ransomware (double extortion)** — 4 modules, 2:40 totaal:
1. detection_sensemaking
2. business_continuity
3. crisis_communication
4. ransom_negotiation

**Insider threat** — 4 modules, 2:30 totaal:
1. detection_sensemaking
2. insider_investigation
3. legal_regulatory
4. crisis_communication

**BEC / CFO fraude** — 3 modules, 2:00 totaal:
1. detection_sensemaking
2. legal_regulatory
3. crisis_communication

**Supply chain compromise** — 4 modules, 2:30 totaal:
1. detection_sensemaking
2. supply_chain_response
3. business_continuity
4. crisis_communication

**Mature client deep-dive** — 6 modules, 4:00 totaal:
1. detection_sensemaking
2. triage_containment
3. business_continuity
4. crisis_communication
5. ransom_negotiation
6. recovery_lessons
