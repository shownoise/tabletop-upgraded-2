# Attack chain — Supply chain compromise

Default chain voor `scenario_type: 'supply_chain_compromise'`. De aanvaller komt niet rechtstreeks bij de klant binnen, maar via een vertrouwde leverancier. Dit zijn de moeilijkste scenario's omdat detectie afhangt van anderen, en omdat de klant zowel slachtoffer als doorgever is.

## Fasen

```typescript
export const supply_chain_compromise: AttackChainTemplate = {
  id: 'supply_chain_compromise',
  name: 'Supply chain compromise',
  description: 'Aanvaller compromitteert een IT-leverancier of software-leverancier ' +
               'van de klant en gebruikt vertrouwde toegang om bij de klant binnen ' +
               'te komen. De klant ontdekt het vaak via een breach notice van de ' +
               'leverancier, niet via eigen detectie.',
  phases: [
    {
      id: 'T-180d-supplier-compromised',
      t_offset: 'T-180d',
      technique: 'IT-leverancier (bijv. MSP, software-vendor, of cloud-aanbieder) ' +
                 'wordt gecompromitteerd via phishing of een vendor-vulnerability. ' +
                 'De klant heeft hier geen zicht op.',
      artifacts: ['logs binnen de leverancier (niet beschikbaar voor klant)'],
      detectability: 'covert',  // klant kan dit niet zien
    },
    {
      id: 'T-90d-trojanized-update',
      t_offset: 'T-90d',
      technique: 'Aanvaller injecteert een backdoor in een legitieme software-update ' +
                 'die de leverancier distribueert (SolarWinds-stijl), of krijgt ' +
                 'toegang tot leverancier-tooling met klant-toegang (zoals een ' +
                 'remote-management tool).',
      mitre_attack: ['T1195.002'],
      artifacts: ['software update gepushed naar klant',
                  'remote management session logs (alleen leverancier ziet)'],
      detectability: 'covert',
    },
    {
      id: 'T-60d-foothold-at-client',
      t_offset: 'T-60d',
      technique: 'Backdoor activeert op klantsystemen. Beacon naar C2, lichte ' +
                 'reconnaissance, identificatie van waardevolle data. Verkeer ' +
                 'lijkt op normaal leverancier-verkeer.',
      mitre_attack: ['T1071.001'],
      artifacts: ['outbound traffic naar C2 vermomd als update-server',
                  'lichte file enumeration',
                  'mogelijk persistence via legitieme scheduled tasks'],
      detectability: 'subtle',  // moeilijk te zien omdat het lijkt op leverancier-traffic
    },
    {
      id: 'T-30d-lateral-and-collection',
      t_offset: 'T-30d',
      technique: 'Aanvaller beweegt voorzichtig lateraal. Verzamelt data van ' +
                 'interesse: klantbestanden, financiële data, persoonsgegevens, ' +
                 'mogelijk OT-data afhankelijk van sector.',
      mitre_attack: ['T1021', 'T1005'],
      artifacts: ['SMB/RDP connections van leverancier-account',
                  'file access events',
                  'gestaagde uitvoer over lange periode'],
      detectability: 'subtle',
    },
    {
      id: 'T-14d-exfiltration',
      t_offset: 'T-14d',
      technique: 'Gestaagde exfiltratie van verzamelde data. Vermomd als legitiem ' +
                 'leverancier-verkeer of via cloud-services die de klant al ' +
                 'gebruikt.',
      mitre_attack: ['T1567'],
      artifacts: ['outbound flows boven baseline (maar onder alert-threshold)',
                  'cloud storage uploads'],
      detectability: 'subtle',
    },
    {
      id: 'T-7d-other-victim-discovers',
      t_offset: 'T-7d',
      technique: 'Een andere klant van dezelfde leverancier ontdekt de compromise ' +
                 'en meldt aan de leverancier. Leverancier start eigen onderzoek, ' +
                 'identificeert dat backdoor in software-update zat.',
      artifacts: ['intern bij leverancier'],
      detectability: 'covert',  // klant heeft hier nog steeds geen zicht
    },
    {
      id: 'T-3d-supplier-private-disclosure',
      t_offset: 'T-3d',
      technique: 'Leverancier bevestigt compromise intern en bereidt klant-notificatie ' +
                 'voor. Leverancier neemt mogelijk juridisch advies in over wat ' +
                 'precies te disclosen.',
      artifacts: ['intern bij leverancier'],
      detectability: 'covert',
    },
    {
      id: 'T-0-breach-notice',
      t_offset: 'T-0',
      technique: 'Leverancier stuurt breach notice naar alle klanten. Vaak vaag: ' +
                 '"een security incident heeft mogelijk impact op een deel van onze ' +
                 'klanten". Klant moet zelf bepalen of en hoe hij geraakt is.',
      artifacts: ['breach notice email van leverancier',
                  'optioneel: persbericht van leverancier',
                  'optioneel: nieuwsbericht over de leverancier'],
      detectability: 'noisy',  // breach notice is overduidelijk, maar de scope is onduidelijk
    },
    {
      id: 'T+1d-news-breaks',
      t_offset: 'T+24h',
      technique: 'Nieuws over de leverancier-breach komt in pers. Klanten en ' +
                 'toezichthouders beginnen vragen te stellen aan iedereen die ' +
                 'bij de leverancier afneemt.',
      artifacts: ['nieuwsberichten',
                  'social media discussie',
                  'mogelijk publieke leak-claim'],
      detectability: 'noisy',
    },
    {
      id: 'T+3d-own-impact-confirmed',
      t_offset: 'T+72h',
      technique: 'Eigen forensisch onderzoek (door ons IR-team) bevestigt impact ' +
                 'bij de klant. Specifieke gestolen data wordt geïdentificeerd. ' +
                 'Tijdlijn wordt gereconstrueerd.',
      artifacts: ['IR-rapport',
                  'aggregated logs',
                  'data-inventarisatie van wat is meegenomen'],
      detectability: 'noisy',
    },
  ],
}
```

## Module-projecties (default)

| Module | Visible phases | Lens |
|---|---|---|
| detection_sensemaking | T-0 breach notice + retrospectief T-60d | symptoms |
| supply_chain_response | T-180d t/m T-0 + leverancier-coördinatie | external_reactions |
| business_continuity | T+3d impact-bevestiging | impact |
| crisis_communication | T+1d news + eigen klant-notificatie | external_reactions |

## Specifieke kenmerken

**Detectie via derde partij.** Het CMT ontdekt het incident niet zelf. De eerste inject is een breach notice van de leverancier, niet een SIEM-alert. Het gevoel van "geen controle hebben" is fundamenteel.

**Onduidelijke scope, lange tijd.** Tot eigen forensisch onderzoek is afgerond, weet de klant niet of en hoe hij is geraakt. Beslissingen moeten onder grote onzekerheid worden genomen — wachten op duidelijkheid is geen optie.

**Driedubbele communicatierol.** De klant is tegelijk slachtoffer (van de leverancier), bemiddelaar (richting eigen klanten), en partij in een groter incident (sectoraal of nationaal). Communicatie moet alle drie aansturen.

**Juridische complexiteit.** Wie is aansprakelijk — de leverancier, jij, of beide? Wat zegt het contract? Heb je audit-rechten? Kunnen jouw klanten jou aanspreken voor schade die ontstaan is via jouw leverancier?

**Vendor-management implicaties.** Decision: blijven we deze leverancier gebruiken, eisen we audit en remediation, of stappen we over (en hoe snel kan dat).

**Toezichthouder-rol.** Bij NIS2-organisaties zijn er meldplichten over supply chain incidenten. Bij financiële sector idem (DORA).

## Sectorvariaties

**MKB+ algemeen:** leverancier is meestal de eigen IT-MSP of een veelgebruikte SaaS (CRM, ERP, HR-systeem).

**Financieel:** leverancier is bijv. een fintech-koppeling, betalingsdienst, of compliance-software. DORA-meldplicht hard.

**Zorg:** leverancier is EPD-vendor, lab-systeem, of medische apparatuur. Patiëntveiligheid is direct in het geding.

**Productie:** leverancier is OT/SCADA-vendor of supply chain management software. Productiekritisch.

**Overheid/gemeente:** leverancier is een grote IT-dienstverlener of platform-aanbieder. Politiek gevoelig.
