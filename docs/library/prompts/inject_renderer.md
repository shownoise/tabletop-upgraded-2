# Inject renderer — van structuur naar concrete tekst

Dit document beschrijft hoe je van een Inject-structuur (channel + sender + source_phase + tone) naar concrete inject-content komt. Het is bedoeld als reference voor de AI-laag, en als handmatige fallback wanneer iemand in de format builder een specifieke inject zelf wil schrijven.

## Per kanaal — structuur en voorbeeld

### Email

Email is het rijkste inject-kanaal: het ondersteunt enkelvoudige meldingen, forwarded threads, attachment-context, en escalerende antwoordketens. Gebruik dit kanaal voor externe druk (klanten, regulators, pers), formele interne communicatie (Legal, HR), en alles wat een handtekening vereist.

**Basisstructuur:**
```
Van:     [naam <email@domein.nl>]
Aan:     [ontvangers]
Onderwerp: [URGENT / RE: / FW: + onderwerp]
Ontvangen: [dag dd mmm HH:MM]
────────────────────────────────
[Aanhef]

[Body: 4–10 regels, zakelijk proza. Geen bulletpoints tenzij het echt een lijstje is.]

[Afsluiting + naam + functie + organisatie]
────────────────────────────────
[Optioneel: technische footer zoals "SPF: pass | DKIM: pass | via relay.provider.com"]
```

**Variant A — enkelvoudige externe druk (klant met SLA-claim):**
```
Van:     M. van der Hoeven <m.vanderhoeven@ah-distributie.nl>
Aan:     operaties@transcore.nl
Onderwerp: URGENT — Leveringen vanochtend niet ontvangen
Ontvangen: di 8 apr 08:04
────────────────────────────────
Beste TransCore,

Drie leveringen die vanochtend voor 08:00 zouden aankomen zijn
niet gearriveerd. Onze koelcellen staan leeg. Wij hebben contract
SLA-P1 — kritieke levering binnen 30 minuten na afwijking.

Wij verwachten binnen 15 minuten een verklaring.
Bij uitblijven schakelen wij juridisch in.

Dit is de tweede keer dit kwartaal.

Met vriendelijke groet,
M. van der Hoeven
Operationeel Manager — AH Distributie B.V.
T: +31 70 312 88 00
────────────────────────────────
```

**Variant B — forwarded thread (Legal forwardt escalatie naar crisisteam):**

Gebruik dit wanneer je wil laten zien dat een probleem al een interne escalatiehistorie heeft. De spelers zien niet alleen het laatste bericht maar ook de context eronder — dit triggert vragen als "waarom reageerde niemand op de eerste mail?".

```
Van:     j.klaasen@transcore.nl (Juridisch Adviseur)
Aan:     cmt@transcore.nl
Onderwerp: FW: Formele aansprakelijkheidsstelling — zie thread
Ontvangen: di 8 apr 11:47
────────────────────────────────
Team,

Zie de thread hieronder. Kuijpers Advocaten vertegenwoordigt nu
AH Distributie. Ze stellen ons formeel aansprakelijk voor de
SLA-schending én voor mogelijke datalekkage van hun orderhistorie.

De deadline voor onze eerste reactie is vandaag 17:00.
Ik heb intern al contact opgenomen met de verzekeraar (Hiscox).
Zij willen een schriftelijke incidentbeschrijving voor 14:00.

Juridisch advies: geen publieke uitspraken over oorzaak of scope
zolang het forensisch onderzoek loopt.

J. Klaasen
────────────────────────────────

-------- Doorgestuurd bericht --------
Van:     p.kuijpers@kuijpersadvocaten.nl
Aan:     j.klaasen@transcore.nl
Datum:   di 8 apr 10:22
Onderwerp: Formele aansprakelijkheidsstelling — TransCore B.V.

Geachte heer Klaasen,

Namens onze cliënt AH Distributie B.V. stellen wij TransCore B.V.
formeel aansprakelijk voor de gevolgen van de operationele uitval
op 8 april jl., resulterend in SLA-breuk (referentie P1-2025-0408)
en potentiële blootstelling van vertrouwelijke orderpositiedata.

Wij verzoeken uiterlijk 8 april 17:00 een schriftelijke reactie
met: (1) de oorzaak van de uitval, (2) de getroffen systemen,
(3) de maatregelen die worden genomen om herhaling te voorkomen.

Hoogachtend,
P. Kuijpers LLM
Kuijpers Advocaten N.V.
────────────────────────────────
```

**Variant C — regulatoire aanvraag (toezichthouder schrijft rechtstreeks):**

Hoog-impact inject voor de legal/compliance track. De klok tikt zichtbaar: de regulator vraagt om informatie met een expliciete deadline en een juridische grondslag.

```
Van:     handhaving@autoriteitpersoonsgegevens.nl
Aan:     fg@transcore.nl
CC:      directie@transcore.nl
Onderwerp: Verzoek om informatie — mogelijke inbreuk persoonsgegevens [AP-2025-04-3871]
Ontvangen: di 8 apr 13:15
────────────────────────────────
Geachte Functionaris Gegevensbescherming,

De Autoriteit Persoonsgegevens heeft via een externe melding kennis
genomen van een mogelijk beveiligingsincident bij TransCore B.V.
waarbij persoonsgegevens betrokken kunnen zijn.

Wij verzoeken u uiterlijk 9 april 2025 om 12:00 de volgende informatie
te verstrekken:

1. Aard en omvang van het incident (welke systemen, welke categorieën
   persoonsgegevens, geschat aantal betrokkenen)
2. Tijdstip van ontdekking en of een melding bij de AP is overwogen
   (artikel 33 AVG — meldplicht binnen 72 uur na ontdekking)
3. Reeds getroffen maatregelen

Wij wijzen u erop dat niet-nakoming van de meldplicht een
bestuurlijke boete kan opleveren van maximaal € 10 miljoen of
2% van de wereldwijde jaaromzet.

Met vriendelijke groet,
Team Handhaving
Autoriteit Persoonsgegevens
Postbus 93374 | 2509 AJ Den Haag
T: 070 888 85 00
────────────────────────────────
```

**Variant D — persvraag met deadline (journalist, NRC/FD):**

Geef de spelers een concrete keuze: reageren of zwijgen? De deadline in de mail is de tijdsdruk. De formulering "kan u bevestigen of ontkennen" dwingt tot een positiebepaling.

```
Van:     k.vermeer@nrc.nl
Aan:     woordvoering@transcore.nl
Onderwerp: Verzoek om reactie — publicatie vanavond 20:00
Ontvangen: di 8 apr 14:03
────────────────────────────────
Geachte woordvoerder,

Ik ben journalist bij NRC Handelsblad en werk aan een artikel over
het cyberincident bij TransCore B.V. dat vandaag plaatsvond.

Uit meerdere bronnen verneem ik dat:
— Klantdata van minimaal drie grote retailers is getroffen
— Uw planningssystemen al uren offline zijn
— Er een losgeldbedrag is geëist

Kan TransCore bevestigen of ontkennen dat er sprake is van
ransomware en dat klantdata is buitgemaakt?

Ik publiceer vanavond om 20:00 met of zonder uw reactie.
Ik verzoek u te reageren voor 16:00.

K. Vermeer
Verslaggever Economie & Tech — NRC
────────────────────────────────
```

**Interactie-patroon: escalerende emailketen over meerdere rondes**

Voor maximale immersie kun je hetzelfde e-mailthread over meerdere rondes laten escaleren. De spelers zien de druk groeien en moeten hun eerdere beslissingen verdedigen:

- **Ronde 1** — Variant A: klant meldt operationeel probleem
- **Ronde 2** — Variant B: Legal forwardt de advocatenbrief (FW-thread met ronde-1-mail erin)
- **Ronde 3** — Variant C: toezichthouder schrijft rechtstreeks (verwijst naar ontvangen tipmelding)
- **Ronde 4** — Variant D: journalist vraagt om reactie voor 20:00

Elke volgende mail maakt zichtbaar dat de buitenwereld sneller opereert dan het crisisteam dacht.

### WhatsApp / SMS

**Structuur:**
```
[timestamp]
[naam]: [bericht in spreektaal, mag typefouten bevatten]
[bericht 2]
[bericht 3]

[latere timestamp]
[naam]: [vervolgbericht, mogelijk gefrustreerd "??"]
```

**Voorbeeld - chauffeur in het veld:**
```
06:53
Henk: Marco we staan hier al een uur te wachten
computer doet niks, scherm is zwart
Kevin zegt dat ie een tekst ziet staan over encrypted
Wat moeten we doen? Kan ik gewoon rijden?
Klant belt al 😬

06:58
Henk: Marco??
```

### Microsoft Teams / Slack

**Structuur:**
```
[timestamp]
[naam] [rol]: [bericht, half-formeel, korte zinnen]

[timestamp]
[andere naam] [rol]: [reactie, vaak met technische details]
```

**Voorbeeld - intern IT-overleg:**
```
08:11
Sander [IT]: back-up server ook encrypted. dezelfde .CSPDR extensie
staat er nog een NAS in het magazijn?

08:13
Peter [Netwerk]: ja maar die syncte elke nacht met de main NAS
waarschijnlijk ook weg

08:14
Sander [IT]: tape dan. maar de tapelezer... weet jij waar die is?

08:15
Peter [Netwerk]: magazijn. maar werkt ie nog?
laatste keer dat ik hem gezien heb was 2022

08:16
Sander [IT]: laat maar zitten
dit is een ramp
```

### SIEM alert

**Structuur:**
```
[SEVERITY] [datum-tijd UTC]
Sensor: [hostname of sensor-id]
Rule: [rule-naam]
Details: [specifieke metingen]
Affected: [paden of accounts]
Process tree: [parent → child → grandchild]
Action taken: [wat heeft de tool gedaan, of NONE]

[scheidingslijn]
[optioneel: meta-info zoals "Alert queued; no on-call notification configured"]
```

**Voorbeeld - SOC alert (van ons IR-team naar klant):**
```
[CRITICAL] 2025-04-08 06:31:17 UTC
Sensor: WINSERVER-PLAN01
Rule: Mass file modification detected
Details: 14.847 file rename events in 00:03:12
Extension pattern: .CSPDR (unknown extension)
Affected paths: D:\TransPlan\, D:\Klantdata\, C:\Users\
Parent process: svchost.exe → cmd.exe → cipher_x64.exe
Action taken: Container isolated by Eye Security IR team at 06:33:42

— — — — — — — — — — — — — —
Onze conclusie: ransomware deployment fase actief. Klant moet 
operationele impact-assessment starten en CMT activeren.
```

### LinkedIn / X / News

**Structuur:**
```
[platform-header / banner]
[naam, profiel-info]
[bericht-tekst]
[hashtags]
[engagement-metrics: reacties, gedeeld, likes]
```

**Voorbeeld - LinkedIn-post:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rick V. • 2e connectie
Voormalig medewerker Logistiek | 47 connecties
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Tja... wie werkte bij TransCore weet dat de
beveiliging al JAREN rammelde. Geen wonder dat
ze nu gehackt zijn. Had dit al verwacht eerlijk gezegd.
Benieuwd of ze de klanten gaan informeren 👀"

#cybersecurity #transport #hack

💬 23 reacties  ↗ 61 keer gedeeld  ❤ 142
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Telefoongesprek

**Structuur:**
Uitgeschreven dialoog met sprekers-tags. Helpt enorm bij sense-of-crisis omdat het gesprek live aanvoelt.

```
[gespreksaanhef]

[Spreker A]:
[wat ze zeggen]

[Spreker B]:
[reactie]

[Spreker A]:
[vervolg]
```

**Voorbeeld - IT-partner belt:**
```
IT-partner:
Goedemiddag, ik bel over een EDR-melding op meerdere laptops. Een 
applicatie is geblokkeerd vanwege verdacht gedrag: hij probeerde in een
keer heel veel bestanden te lezen.

IT-manager:
Oke, dat klinkt niet goed. Is het probleem nu opgelost?

IT-partner:
De directe blokkade is verholpen, maar ik kan niet verklaren hoe deze
applicatie überhaupt op de systemen terecht is gekomen.

IT-manager:
Dus we weten niet of dit kwaadwillig was?

IT-partner:
Precies. Daarom mijn vraag: ik wil dit graag escaleren naar jullie 
crisisteam.
```

### Memo / handout

**Structuur:**
```
[Aanhef met type document, datum, vertrouwelijkheid]
[Onderwerp]
[Afzender + ontvangers]

[Body in zakelijke prose, mag bullet points hebben]

[Optioneel: handtekening, contactgegevens]
```

**Voorbeeld - interne memo over jaarafsluiting (sensemaking-context):**
```
Interne Memo — Vertrouwelijk
Datum: 12 december
Afzender: intern
Onderwerp: Operationele druk & jaarafsluiting — verhoogde alertheid

December is traditioneel een van onze meest intensieve maanden. De 
laatste opdrachten van het jaar komen binnen en meerdere teams werken 
op volle capaciteit om deadlines te halen.

Tegelijkertijd bereiden Management en Finance de eindejaarsrapportages 
voor. De timing en nauwkeurigheid hiervan zijn cruciaal: zowel 
aandeelhouders als medewerkers rekenen op de cijfers van het afgelopen 
jaar.

Door de huidige piekdrukte is onze afhankelijkheid van IT-systemen 
groter dan normaal en zijn de marges voor fouten minimaal. Het is 
daarom van belang dat we extra alert zijn en zorgen dat onze processen 
zonder onderbreking kunnen blijven functioneren.
```

### Ransom note

**Structuur:**
```
[email-header alsof legitieme email]
[scheidingslijn]
[engelse tekst met militaire/professionele toon]
[wat is versleuteld]
[wat is geexfiltreerd — vaak met sample]
[bedrag, valuta, deadline]
[escalatieclausule]
[contact-instructie via Tor]
[scheidingslijn]
[technische footnote]
```

**Voorbeeld:**
```
Van:     noreply@coldchain-recovery[.]onion.ws
Onderwerp: YOUR DATA IS ENCRYPTED — READ CAREFULLY
Ontvangen: di 8 apr 06:52
────────────────────────────────
Dear TransCore Management,

Your network infrastructure has been fully compromised.
All critical files have been encrypted using military-grade AES-256.

We have ALSO downloaded 42.3 GB of your data including:
 - Customer contracts & SLA documents
 - Employee personal data (HR records)
 - Financial records 2022–2025

Ransom: €180.000 in Monero (XMR)
Deadline: 72 hours from now (11 apr, 06:52)
After deadline: price doubles. After 96h: data published.

Do NOT involve law enforcement. Do NOT attempt recovery.
This will result in immediate publication.

Decryption proof available on request.
Contact: https://coldchain-spiders[.]onion (Tor required)
────────────────────────────────
[This message was not caught by spam filter — SPF/DKIM bypassed via legitimate relay]
```

## Emotional tone — sturende parameters

De gewenste tone bepaalt woordkeuze en stijl:

- **clinical** — feitelijk, kort, technisch. SIEM-alerts, forensische samenvattingen.
- **urgent** — duidelijk haastig, met deadline, zonder paniek. Klantmails, journalist-verzoeken.
- **panicked** — onsamenhangend, typefouten, korte zinnen, emoji. Chauffeur, junior medewerker.
- **menacing** — koud, dreigend, professional crime. Ransom notes, aanvaller-emails.
- **professional** — formeel, voorzichtig, juridisch. Advocaat, toezichthouder, verzekeraar.

## Cross-channel patronen

Krachtige inject-combinaties die in elke module werken:

**Outside-in:** SIEM-alert (technisch) + klantmail (zakelijk) + WhatsApp van een chauffeur (menselijk). Drie invalshoeken op hetzelfde incident.

**Escalatie:** intern Teams-bericht → telefoongesprek IT-partner → memo crisisteam. Het probleem groeit door de lagen heen.

**Pressure cooker:** klantmail met deadline + persvraag met deadline + advocaat-memo. Drie deadlines tegelijk, geen lucht om diep na te denken.

**Aanvaller-zijde:** ransom note + LinkedIn-post (ex-medewerker speculeert) + nieuwsbericht. Externe wereld weet meer dan klant fijn vindt.
