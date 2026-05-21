import type { AttackChainTemplate } from "../types/scenario-instance"

export const bec_cfo_fraud: AttackChainTemplate = {
  id: 'bec_cfo_fraud',
  name: 'Business Email Compromise (CFO fraude)',
  description:
    'Aanvaller compromitteert mailbox van CFO of finance-medewerker, leest mee, ' +
    'en lanceert op het juiste moment een gefingeerd betalingsverzoek via een ' +
    'gewijzigd factuuradres of via een overtuigend "CEO fraud"-bericht.',
  phases: [
    {
      id: 'T-45d-phishing',
      t_offset: 'T-45d',
      technique:
        'CFO ontvangt een goed-uitgewerkte phishing-mail die lijkt op een Microsoft ' +
        '365 sessie-verlooopnotificatie. Klikt en geeft credentials, omzeilt MFA via ' +
        'een evilginx-style proxy.',
      mitre_attack: ['T1566.002', 'T1556.006'],
      artifacts: [
        'phishing email in mailbox (verwijderd door aanvaller)',
        'M365 sign-in log: succesvolle login vanaf vreemd IP',
        'session token granted',
      ],
      detectability: 'subtle',
    },
    {
      id: 'T-44d-persistence',
      t_offset: 'T-44d',
      technique:
        'Aanvaller richt mailbox rules in: bepaalde keywords (factuur, IBAN, betaling) ' +
        'worden automatisch verplaatst naar een verborgen subfolder en als gelezen ' +
        'gemarkeerd. App password aangemaakt.',
      mitre_attack: ['T1137.005', 'T1098.001'],
      artifacts: [
        'mailbox rule "Updates"',
        'app password "Outlook Mobile" in audit log',
        'inbox rule audit entries',
      ],
      detectability: 'subtle',
    },
    {
      id: 'T-30d-reconnaissance',
      t_offset: 'T-30d',
      technique:
        'Aanvaller leest passief mee, leert toon en stijl van de CFO, identificeert ' +
        'relevante leveranciers met grote bedragen, achterhaalt goedkeuringsproces ' +
        'voor betalingen.',
      artifacts: [
        'mail read audit events (overweldigend volume — onbruikbaar als alert)',
        'mogelijk OAuth grants voor read-access tools',
      ],
      detectability: 'covert',
    },
    {
      id: 'T-14d-target-identified',
      t_offset: 'T-14d',
      technique:
        'Aanvaller identificeert een lopende grote factuur van een leverancier. Bereidt ' +
        'een lookalike domein voor (bv. leverancier-nl.com i.p.v. leverancier.nl).',
      artifacts: [
        'domeinregistratie lookalike (publieke whois — niet gemonitord)',
        'mogelijk eerste test-emails naar zichzelf',
      ],
      detectability: 'subtle',
    },
    {
      id: 'T-3d-spoofed-email',
      t_offset: 'T-3d',
      technique:
        'Aanvaller stuurt vanuit lookalike-domein een mail naar de finance-medewerker: ' +
        '"ons IBAN is gewijzigd, hierbij onze nieuwe rekening voor de openstaande ' +
        'factuur". Mail past in eerder gevoerde correspondentie.',
      mitre_attack: ['T1534'],
      artifacts: [
        'inkomende mail van lookalike-domein',
        'SPF/DKIM checks falen subtiel (vaak niet geblokt)',
        'mogelijk reply-chain hijack',
      ],
      detectability: 'noisy',
    },
    {
      id: 'T-1d-payment-approved',
      t_offset: 'T-1d',
      technique:
        'Finance-medewerker verwerkt nieuwe IBAN, vraagt CFO om akkoord. CFO ziet het ' +
        'verzoek niet (mailbox rule), of ziet het wel maar keurt goed zonder verificatie ' +
        'via tweede kanaal. Aanvaller reageert vanuit gehackte CFO-account om te ' +
        'bevestigen.',
      artifacts: [
        'mail van CFO mailbox: "akkoord, betaal door" (door aanvaller)',
        'ERP entry: IBAN gewijzigd voor leverancier',
        'payment scheduled',
      ],
      detectability: 'subtle',
    },
    {
      id: 'T-0-payment-executed',
      t_offset: 'T-0',
      technique:
        'Betaling wordt overgemaakt naar de fraudulente rekening. Aanvaller heeft de ' +
        'mailbox rule actief gehouden zodat eventuele bevestigingen ook verborgen blijven.',
      mitre_attack: ['T1657'],
      artifacts: [
        'betaalbatch uitgevoerd',
        'bank confirmation email (mogelijk verborgen via rule)',
        'aanvaller-rekening waarschijnlijk via money mule chain',
      ],
      detectability: 'noisy',
    },
    {
      id: 'T+7d-real-supplier-calls',
      t_offset: 'T+7d',
      technique:
        'Echte leverancier belt: "betaling is nog niet binnen". CFO en finance vergelijken ' +
        'hun records: ze hebben wel betaald, maar naar een andere rekening. Realisatie ' +
        'wat is gebeurd.',
      artifacts: [
        'inkomend telefoongesprek',
        'aanmaning email',
        'bankafschrift toont bestemming',
      ],
      detectability: 'noisy',
    },
  ],
  applicable_sectors: ['construction', 'manufacturing', 'consultancy', 'healthcare'],
}
