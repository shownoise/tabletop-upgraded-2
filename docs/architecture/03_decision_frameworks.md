# Decision frameworks — wanneer welk model

Het BOB-model is een Nederlandse traditie, maar niet het enige zinvolle framework. De generator ondersteunt vijf opties die de gespreksstructuur en facilitator-prompts beïnvloeden.

## De vijf opties

| Framework | Herkomst | Beste voor |
|---|---|---|
| BOB | NL crisisbeheersing (GHOR, veiligheidsregio) | NL MKB+, gemeenten, zorg |
| OODA | Boyd, militair | Tech-bedrijven, tijdsdruk-scenario's |
| DAIR | IR-context (industry-standard) | SOC-teams, technische CMT's |
| NIST-IR | NIST SP 800-61 | Volwassen IR-programma's |
| Vrij | Geen | Beginnende teams, snelle oefeningen |

## BOB — Beeldvorming, Oordeelsvorming, Besluitvorming

**Cyclus per module:**

```
Beeldvorming   → Wat weten we? Wat weten we niet? Klopt alles wat we weten?
                 Hebben we die info nodig om een goed besluit te nemen?
                 Hoe gaan we de ontbrekende informatie verzamelen?

Oordeelsvorming → Wat is ons doel? Waar maken we ons zorgen over?
                  Wat zou die zorgen verminderen?
                  Aan welke voorwaarden moet het besluit voldoen?

Besluitvorming  → Wat besluiten we? Wat gaan we doen?
                  Weet iedereen welk besluit is genomen?
                  Is iedereen het met het besluit eens?
```

**Sterke punten:** zeer expliciete structuur, dwingt teams om niet meteen naar oplossingen te springen, goed voor onervaren CMT's.

**Zwakke punten:** kan langzaam aanvoelen bij hoge tijdsdruk, kan formeel/bureaucratisch worden.

**Facilitator-prompts per BOB-fase:** zie de oude Eye Security PDF voor de complete set vragen.

## OODA — Observe, Orient, Decide, Act

**Cyclus per module:**

```
Observe → Wat is er gebeurd? Welke informatie hebben we binnen?
Orient  → Hoe past dit in ons begrip van de situatie? Welk mentaal model?
Decide  → Welke optie kiezen we?
Act     → Voer uit en herhaal de loop.
```

**Sterke punten:** snelheid, expliciet iteratief (de loop herhaalt), goed bij snel veranderende situaties zoals ransomware in actieve fase.

**Zwakke punten:** minder expliciete plek voor stakeholder-overwegingen en lange-termijn risico's.

**Wanneer kiezen:** tech-bedrijven, SaaS, scale-ups, scenario's met veel snelle veranderingen en hoge tijdsdruk.

## DAIR — Detect, Assess, Inform, Respond

**Cyclus per module:**

```
Detect   → Wat hebben we waargenomen, en hoe zeker zijn we?
Assess   → Wat is de inschatting van impact, scope, prioriteit?
Inform   → Wie moet weten? Intern, extern, toezichthouder?
Respond  → Welke actie nemen we?
```

**Sterke punten:** populair binnen IR-community, "Inform" als expliciete stap voorkomt dat communicatie wordt vergeten.

**Zwakke punten:** technisch georiënteerd, minder geschikt voor strategische beslissingen.

**Wanneer kiezen:** SOC-teams, technische CMT's, MSSP-omgevingen.

## NIST-IR — NIST SP 800-61 Incident Response Cycle

**Cyclus per module (afhankelijk van module-fase):**

```
Preparation  → (vooraf, niet in oefening)
Detection &
 Analysis    → Wat zien we, wat is het, hoe ernstig?
Containment  → Hoe stoppen we de bloeding?
Eradication  → Hoe halen we de aanvaller weg?
Recovery     → Hoe herstellen we?
Post-incident
 activity    → Wat hebben we geleerd?
```

**Sterke punten:** geaccepteerde internationale standaard, mapt direct op compliance-frameworks (NIS2, ISO 27035).

**Zwakke punten:** lange cyclus, niet alle fasen passen in elke module, technisch georiënteerd.

**Wanneer kiezen:** volwassen IR-programma's, klanten die NIST-aligned zijn, ISMS-omgevingen.

## Vrij — geen vast framework

De facilitator gebruikt open vragen zonder vaste structuur. Goed voor beginnende teams die overweldigd raken door een formele aanpak, of voor heel korte oefeningen.

**Facilitator-prompts:** open vragen per module — "wat valt jullie op", "waar willen jullie eerst over praten", "wat zou je nu doen".

## Hybride aanpak — framework per module

Voor gevorderde oefeningen kun je per module een ander framework kiezen. Bijvoorbeeld:

- detection_sensemaking → OODA (snelheid)
- business_continuity → BOB (structuur)
- crisis_communication → DAIR (Inform expliciet)
- ransom_negotiation → BOB (gewicht op overweging)

De builder ondersteunt dit als optionele power-user keuze. Default: één framework voor de hele oefening.

## Implementatie-implicaties

De gekozen framework-string beïnvloedt twee dingen in de output:

**1. Facilitator-prompts per module.** In plaats van vaste BOB-vragen worden framework-specifieke prompts gerenderd. De AI-laag krijgt het framework als parameter mee en formuleert prompts in de bijbehorende structuur.

**2. Decision-prompt formulering.** Bij BOB-stijl worden vragen als "Wat besluiten we en wie tekent het af?" geformuleerd. Bij OODA-stijl als "Welke actie nemen we nu en wanneer evalueren we?". Inhoudelijk dezelfde beslissing, ander framing.

De `decisions` array in het data model blijft hetzelfde — alleen de rendering verandert.
