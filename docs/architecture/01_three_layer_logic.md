# Drie-laags logica — hoe scenario, modules en injects samenhangen

Dit document beschrijft de kernarchitectuur van de scenario-generator. Iedere oefening wordt opgebouwd uit drie lagen die in deze volgorde worden gegenereerd. Het is essentieel dat de implementatie deze volgorde respecteert, want consistency-checks tussen lagen voorkomen incoherente output.

## Laag 1 — Attack chain (grondwaarheid)

Elke oefening begint met één **attack chain**: een interne timeline van wat de aanvaller heeft gedaan, van eerste actie tot impact. Deze chain is niet zichtbaar voor de deelnemers. Hij is de fysica van het scenario — alles wat het CMT ziet moet hier consistent uit volgen.

Een attack chain heeft fasen met deze velden:

```typescript
type AttackChainPhase = {
  id: string                  // "T-21d-initial-access"
  t_offset: string            // "T-21d" of "T+00:15"
  technique: string           // korte beschrijving
  mitre_attack?: string[]     // optioneel: T1566, T1078, etc.
  artifacts: string[]         // wat heeft dit achtergelaten? (logs, files, accounts)
  detectability: 'covert' | 'subtle' | 'noisy'  // hoe makkelijk te zien
}
```

Attack chains zijn **scenario-type specifiek**. Een ransomware chain ziet er fundamenteel anders uit dan een insider chain (zie `docs/library/chains/`). De keuze van scenario-type in de builder triggert dus een specifieke chain-template, niet één generieke.

## Laag 2 — Module-projectie

Een oefening bestaat uit een serie **modules**. Elke module is een coherent tijdvenster met één leerdoel (zie `02_module_library.md`). Een module projecteert een deel van de attack chain op het CMT-perspectief: wat is op dit moment zichtbaar, en wat blijft verborgen?

```typescript
type ModuleProjection = {
  module_id: string             // bv "detection_sensemaking"
  visible_phases: string[]      // chain-fase ids die deze module mag tonen
  hidden_phases: string[]       // chain-fase ids die nog niet zichtbaar zijn
  observation_lens: 'symptoms' | 'impact' | 'external_reactions' | 'attacker_voice'
}
```

**Observation lens** bepaalt hoe een chain-fase wordt gepresenteerd. Dezelfde fase (bv. T-3d data exfiltration) ziet er anders uit door verschillende lenzen:

- `symptoms`: vage signalen — een logregel, een trage server, een gebruiker die iets meldt
- `impact`: operationele gevolgen — facturen kunnen niet, klanten klagen, processen stoppen
- `external_reactions`: pers, klanten, toezichthouders reageren
- `attacker_voice`: ransom note, proof-of-life, dark web post

Sensemaking-modules gebruiken `symptoms`. Business Continuity gebruikt `impact`. Crisis Communication gebruikt `external_reactions`. Ransom Negotiation gebruikt `attacker_voice`.

## Laag 3 — Inject-rendering

Iedere inject is een concrete vorm: een email, een Teams-bericht, een SIEM-alert. Een inject wordt gerenderd uit vier parameters:

```typescript
type Inject = {
  source_phase_id: string       // verwijst terug naar Laag 1 — consistency check
  channel: InjectChannel        // email, sms, teams, siem, edr, news, phone, memo
  sender: string                // wie verstuurt het
  emotional_tone: 'clinical' | 'urgent' | 'panicked' | 'menacing' | 'professional'
  timestamp: string             // exact tijdstempel
  content: string               // de daadwerkelijke tekst
}
```

De **consistency check**: voordat een inject in de output komt, valideer dat zijn `source_phase_id` bestaat in de attack chain én in `visible_phases` van zijn module. Een inject die refereert aan een fase die nog niet zichtbaar mag zijn, is een bug.

**Kanaal-variatie afdwingen**: elke module moet minimaal drie verschillende kanalen gebruiken. Een module met alleen emails voelt plat. SIEM-alert + klantmail + WhatsApp van een chauffeur geeft het juiste crisis-gevoel.

De negen kanalen in volgorde van impact:

1. WhatsApp/SMS — menselijk, urgent, ongepolijst
2. Microsoft Teams/Slack — intern, half-formeel, met collegiale druk
3. Email — formeel, met deadline, vaak van klant of journalist
4. Telefoongesprek (uitgeschreven dialoog) — meest realistisch crisis-gevoel
5. SIEM/EDR-alert — technisch, van onze SOC naar klant
6. LinkedIn/X post — publiek, ongecontroleerd
7. Persbericht/nieuwssite — escalerend
8. Memo/handout — formeel document
9. Ransom note — alleen in negotiation-modules

## Generatie-volgorde (implementatie)

```
1. Gebruiker kiest scenario-type → laad chain-template
2. Gebruiker kiest modules en volgorde → maak module-projectie
3. AI genereert per module:
   a. Een verhalende situatie-update (op basis van zichtbare fasen)
   b. 3-5 injects (met kanaal-variatie, gekoppeld aan zichtbare fasen)
   c. Decision-prompts (binnen IR-retainer scope, in gekozen framework-stijl)
   d. Facilitator-observaties (verwijzend naar specifieke injects)
4. Validator checkt:
   - Elke inject verwijst naar bestaande chain-fase
   - Elke module heeft 3+ kanalen
   - Geen decisions buiten klant-scope (zie 04_ir_retainer_scope.md)
   - Severity-curve loopt op of blijft gelijk, daalt nooit
5. Render naar HTML in bestaande Operatie-template stijl
```

## Waarom dit beter is dan de huidige aanpak

De huidige scenario-generatie bedenkt injects los van elkaar. Dat leidt tot incoherenties: een ransom note in ronde 1 voor er onderzoek gedaan is, BSN-lek in ronde 3 zonder dat HR-data eerder in de chain was geëxfiltreerd, of beslissingen waar de klant over moet beslissen terwijl wij als retainer dat al doen.

De drie-laagse aanpak dwingt af dat:

- Elke inject terug te voeren is op één gebeurtenis in de chain
- Modules samen de chain volledig vertellen, zonder gaten of inconsistenties
- Per scenario-type een eigen chain wordt gebruikt (insider ≠ ransomware ≠ BEC)
- AI binnen vaste constraints werkt in plaats van vrije generatie
