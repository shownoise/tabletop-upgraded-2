# Attack chain — Business Email Compromise (CFO fraude)

Default chain voor `scenario_type: 'bec_cfo_fraud'`. Geen technische paniek, geen encryption. Het draait om vertrouwen, governance van betalingen, en hoe snel je vermissing van geld merkt. Een van de meest schadelijke en meest voorkomende scenarios voor MKB+.

## Fasen

```typescript
export const bec_cfo_fraud: AttackChainTemplate = {
  id: 'bec_cfo_fraud',
  name: 'Business Email Compromise (CFO fraude)',
  description: 'Aanvaller compromitteert mailbox van CFO of finance-medewerker, ' +
               'leest mee, en lanceert op het juiste moment een gefingeerde ' +
               'betalingsverzoek via een gewijzigd factuuradres of via een ' +
               'overtuigend "CEO fraud"-bericht.',
  phases: [
    {
      id: 'T-45d-phishing',
      t_offset: 'T-45d',
      technique: 'CFO ontvangt een goed-uitgewerkte phishing-mail die lijkt op een ' +
                 'Microsoft 365 sessie-verlooop notificatie. Klikt en geeft ' +
                 'credentials, omzeilt MFA via een evilginx-style proxy.',
      mitre_attack: ['T1566.002', 'T1556.006'],
      artifacts: ['phishing email in mailbox (verwijderd door aanvaller)',
                  'M365 sign-in log: succesvolle login vanaf vreemd IP',
                  'session token granted'],
      detectability: 'subtle',
    },
    {
      id: 'T-44d-persistence',
      t_offset: 'T-44d',
      technique: 'Aanvaller richt mailbox rules in: bepaalde keywords (factuur, ' +
                 'IBAN, betaling) worden automatisch verplaatst naar een verborgen ' +
                 'subfolder en als gelezen gemarkeerd. App password aangemaakt.',
      mitre_attack: ['T1137.005', 'T1098.001'],
      artifacts: ['mailbox rule "Updates"',
                  'app password "Outlook Mobile" in audit log',
                  'inbox rule audit entries'],
      detectability: 'subtle',  // alleen actief admin-onderzoek vindt dit
    },
    {
      id: 'T-30d-reconnaissance',
      t_offset: 'T-30d',
      technique: 'Aanvaller leest passief mee, leert toon en stijl van de CFO, ' +
                 'identificeert relevante leveranciers met grote bedragen, ' +
                 'achterhaalt goedkeuringsproces voor betalingen.',
      artifacts: ['mail read audit events (overweldigend volume — onbruikbaar als alert)',
                  'mogelijk OAuth grants voor read-access tools'],
      detectability: 'covert',
    },
    {
      id: 'T-14d-target-identified',
      t_offset: 'T-14d',
      technique: 'Aanvaller identificeert een lopende grote factuur van een ' +
                 'leverancier (€350K voor een lopend project). Bereidt een ' +
                 'lookalike domein voor (leverancier-nl.com ipv leverancier.nl).',
      artifacts: ['domeinregistratie lookalike (publieke whois — niet gemonitord)',
                  'mogelijk eerste test-emails naar zichzelf'],
      detectability: 'subtle',
    },
    {
      id: 'T-3d-spoofed-email',
      t_offset: 'T-3d',
      technique: 'Aanvaller stuurt vanuit lookalike-domein een mail naar de ' +
                 'finance-medewerker: "ons IBAN is gewijzigd, hierbij onze nieuwe ' +
                 'rekening voor de openstaande factuur". Mail past in eerder ' +
                 'gevoerde correspondentie.',
      mitre_attack: ['T1534'],
      artifacts: ['inkomende mail van lookalike-domein',
                  'SPF/DKIM checks falen subtiel (vaak niet geblokt)',
                  'mogelijk reply-chain hijack'],
      detectability: 'noisy',  // is detecteerbaar door goed email security gateway
    },
    {
      id: 'T-1d-payment-approved',
      t_offset: 'T-1d',
      technique: 'Finance-medewerker verwerkt nieuwe IBAN, vraagt CFO om akkoord. ' +
                 'CFO ziet het verzoek niet (mailbox rule), of ziet het wel maar ' +
                 'goedkeurt zonder verificatie via tweede kanaal. Aanvaller ' +
                 'reageert vanuit gehackte CFO-account om te bevestigen.',
      artifacts: ['mail van CFO mailbox: "akkoord, betaal door" (door aanvaller)',
                  'ERP entry: IBAN gewijzigd voor leverancier',
                  'payment scheduled'],
      detectability: 'subtle',  // CFO gaat het pas zien als hij actief zoekt
    },
    {
      id: 'T-0-payment-executed',
      t_offset: 'T-0',
      technique: '€350K wordt overgemaakt naar de fraudulente rekening. Aanvaller ' +
                 'heeft de mailbox rule actief gehouden zodat eventuele bevestigingen ' +
                 'ook verborgen blijven.',
      mitre_attack: ['T1657'],
      artifacts: ['betaalbatch uitgevoerd',
                  'bank confirmation email (mogelijk verborgen via rule)',
                  'aanvaller-rekening waarschijnlijk via money mule chain'],
      detectability: 'noisy',
    },
    {
      id: 'T+7d-real-supplier-calls',
      t_offset: 'T+7d',
      technique: 'Echte leverancier belt: "betaling is nog niet binnen". CFO en ' +
                 'finance vergelijken hun records: ze hebben wel betaald, maar naar ' +
                 'een andere rekening. Realisatie wat is gebeurd.',
      artifacts: ['inkomend telefoongesprek',
                  'aanmaning email',
                  'bankafschrift toont bestemming'],
      detectability: 'noisy',
    },
  ],
}
```

## Module-projecties (default)

| Module | Visible phases | Lens |
|---|---|---|
| detection_sensemaking | T+7d-real-supplier-calls + retrospectieve check | symptoms |
| legal_regulatory | civielrechtelijk, aangifte, AVG, AFM-meldplicht | external_reactions |
| crisis_communication | richting leverancier, bank, mogelijk pers | external_reactions |

## Specifieke kenmerken

**Geen technische crisis.** Het IT-landschap werkt normaal. Geen encryption, geen DDoS, geen platgelegde systemen. De crisis is volledig financieel en operationeel.

**Vertrouwensbreuk intern.** Het belangrijkste psychologische element is dat een collega (CFO of finance-medewerker) zich misleid voelt. De vraag "wie heeft hier een fout gemaakt" is gevoelig.

**Snelheid is alles.** De eerste 24-72 uur na ontdekking bepalen of het geld terug te halen is. Bank-noodprocedure, politie-aangifte, en internationale terug-acties moeten parallel lopen.

**Verzekering en aansprakelijkheid.** Veel polissen hebben specifieke clausules voor fraud/social engineering. Decision: wat communiceren we naar de verzekeraar, wat doet dat met de polis voor volgend jaar.

**Communicatie is subtiel.** Geen breed persbericht — meestal niet in het belang van de organisatie. Wel naar bestuur, RvC, accountant, eventueel grote klanten als er secundair risico is.

**Decision over de medewerker.** De finance-medewerker die de betaling deed: was er sprake van menselijke fout, slecht proces, of beide? Wordt vaak één van de moeilijkste gespreken.

## Sectorvariaties

**Bouw/installatie:** facturen aan onderaannemers, vaak grote bedragen. Bouwbedrijven zijn een groot target.

**Productie:** facturen aan grondstof-leveranciers. Internationale betalingen zijn extra risico.

**Consultancy/IT-dienstverlening:** kleinere bedragen vaker, maar relatief hoge schade door reputatie.

**Zorginstellingen:** facturen aan medische leveranciers, gevoeligheid omdat publieke middelen betrokken zijn.
