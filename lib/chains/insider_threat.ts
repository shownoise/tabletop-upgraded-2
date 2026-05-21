import type { AttackChainTemplate } from "../types/scenario-instance"

export const insider_threat: AttackChainTemplate = {
  id: 'insider_threat',
  name: 'Insider threat — disgruntled employee',
  description:
    'Een ontevreden senior medewerker met legitieme toegang verzamelt systematisch ' +
    'data over meerdere maanden, in voorbereiding op vertrek naar een concurrent ' +
    'of voor financieel gewin via verkoop.',
  phases: [
    {
      id: 'T-180d-trigger-event',
      t_offset: 'T-180d',
      technique:
        'Trigger event in arbeidsrelatie: gemiste promotie, conflict met manager, ' +
        'financiële problemen, of contact met concurrent. Geen IT-signaal — alleen ' +
        'HR/manager kan dit retrospectief zien.',
      artifacts: [
        'HR-notes over functioneringsgesprek (mogelijk)',
        'verslag van conflict (mogelijk)',
        'geen IT-artifacts',
      ],
      detectability: 'covert',
    },
    {
      id: 'T-90d-behavior-change',
      t_offset: 'T-90d',
      technique:
        'Gedragsverandering wordt merkbaar: terugtrekking uit teamactiviteiten, overwerk ' +
        'in vreemde uren, onverklaarde afwezigheid. Begint oriënterend te zoeken in ' +
        'systemen waar hij wel rechten heeft maar normaal niet kijkt.',
      artifacts: [
        'DLP-events: anomalous searches (geen alert getriggerd)',
        'login-patronen wijken af van baseline',
        'manager-observaties (informeel, niet vastgelegd)',
      ],
      detectability: 'subtle',
    },
    {
      id: 'T-60d-data-hoarding-starts',
      t_offset: 'T-60d',
      technique:
        'Systematisch downloaden van documenten naar persoonlijke OneDrive of USB. ' +
        'Klantbestanden, prijslijsten, contracten, technische IP. In kleine batches ' +
        'om DLP onder de radar te blijven.',
      mitre_attack: ['T1530', 'T1052'],
      artifacts: [
        'DLP events laag scorend, niet geescaleerd',
        'M365 audit log: file downloads',
        'USB-mount events op werkstation',
      ],
      detectability: 'subtle',
    },
    {
      id: 'T-30d-resignation-discussed',
      t_offset: 'T-30d',
      technique:
        'Eerste indicatie van vertrek wordt zichtbaar voor HR/manager: gesprek over ' +
        'loopbaan, sollicitatie elders bevestigd, of opzegging aangekondigd. Geen ' +
        'IT-koppeling gemaakt.',
      artifacts: [
        'HR-notitie over loopbaangesprek',
        'opzeggingsbrief (mogelijk)',
      ],
      detectability: 'covert',
    },
    {
      id: 'T-14d-acceleration',
      t_offset: 'T-14d',
      technique:
        'Versnelling van data-verzameling. Grotere downloads, toegang tot systemen die ' +
        'de medewerker zelden gebruikt. Mogelijk delen met externe partij via persoonlijke ' +
        'email of cloud storage.',
      mitre_attack: ['T1530', 'T1567.002'],
      artifacts: [
        'DLP events nu hoger scorend',
        'unusual file access patterns',
        'persoonlijke email forwarding rules (mogelijk)',
      ],
      detectability: 'noisy',
    },
    {
      id: 'T-7d-dlp-alert-fires',
      t_offset: 'T-7d',
      technique:
        'DLP-alert vuurt af op een mass download van klantbestanden. Alert komt in ' +
        'algemene queue, niet direct gekoppeld aan de medewerker.',
      mitre_attack: ['T1530'],
      artifacts: ['DLP alert in security queue', 'audit log entry'],
      detectability: 'noisy',
    },
    {
      id: 'T-3d-laatste-werkweek',
      t_offset: 'T-3d',
      technique:
        'Laatste werkweek voor vertrek aangekondigd. Medewerker maakt mass copies ' +
        '"voor referentie", verwijdert browser history, mailt zichzelf documenten.',
      artifacts: [
        'mass file copies to USB',
        'self-sent emails with attachments',
        'browser history clear events',
      ],
      detectability: 'noisy',
    },
    {
      id: 'T-0-detection',
      t_offset: 'T-0',
      technique:
        'DLP-alert wordt eindelijk goed bekeken. CISO of SOC legt verband tussen ' +
        'meerdere alerts over weken. Stelt vast dat één gebruiker systematisch heeft ' +
        'geëxfiltreerd. Meldt aan management.',
      artifacts: [
        'SOC-rapport',
        'aggregated DLP timeline',
        'reconstructie van wat is meegenomen',
      ],
      detectability: 'noisy',
    },
    {
      id: 'T+1d-investigation-starts',
      t_offset: 'T+24h',
      technique:
        'Forensisch onderzoek start onder HR/Legal mandaat. Doel: bewijs verzamelen ' +
        'zonder dat de medewerker dit doorheeft. Werkstation image, mailbox forensics, ' +
        'USB-history.',
      artifacts: [
        'forensic image van werkstation',
        'mailbox export',
        'USB-mount audit',
      ],
      detectability: 'covert',
    },
  ],
  applicable_sectors: ['tech_saas', 'consultancy', 'manufacturing', 'financial'],
}
