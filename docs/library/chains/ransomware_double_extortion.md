# Attack chain — Ransomware (double extortion)

Default chain voor `scenario_type: 'ransomware_double_extortion'`. Past op MKB+ klanten in vrijwel elke sector. Initial access varieert (phishing, ClickFix, supply chain, gestolen VPN-credentials).

## Fasen

```typescript
export const ransomware_double_extortion: AttackChainTemplate = {
  id: 'ransomware_double_extortion',
  name: 'Ransomware (double extortion)',
  description: 'Externe aanvaller verkrijgt toegang, beweegt lateraal, exfiltreert ' +
               'data, vernietigt backups en deployt ransomware. Dreigt met publicatie ' +
               'van gelekte data naast het versleutelen van systemen.',
  phases: [
    {
      id: 'T-21d-initial-access',
      t_offset: 'T-21d',
      technique: 'Phishing-mail met ClickFix-techniek of gestolen VPN-credentials. ' +
                 'Backdoor geïnstalleerd via PowerShell. Outbound C2-verbinding actief.',
      mitre_attack: ['T1566.001', 'T1078.004'],
      artifacts: ['phishing email in user mailbox', 'PowerShell history entry', 
                  'scheduled task "WindowsDefenderHealth"', 'C2 traffic in firewall logs'],
      detectability: 'subtle',  // ervaren SOC ziet het, doorsnee EDR mist het
    },
    {
      id: 'T-14d-lateral-movement',
      t_offset: 'T-14d',
      technique: 'Lateral movement via SMB en gestolen credentials. Toegang tot ' +
                 'meerdere endpoints en file servers. Credential dumping op een ' +
                 'beheerders-werkstation.',
      mitre_attack: ['T1021.002', 'T1003'],
      artifacts: ['anomalous SMB connections in netflow', 'mimikatz-style memory access',
                  'new admin sessions outside business hours'],
      detectability: 'subtle',
    },
    {
      id: 'T-10d-priv-escalation',
      t_offset: 'T-10d',
      technique: 'Privilege escalation naar Domain Admin via een gevonden gedeeld ' +
                 'wachtwoord in Passwords.xlsx. Persistence ingericht via mailbox-rules ' +
                 'en een nieuw service-account.',
      mitre_attack: ['T1078.002', 'T1098', 'T1137.005'],
      artifacts: ['new domain admin account', 'mailbox rule "Updates"', 
                  'service principal in M365 audit log'],
      detectability: 'noisy',  // maar wordt vaak gemist door overflow van logs
    },
    {
      id: 'T-7d-cloud-pivot',
      t_offset: 'T-7d',
      technique: 'Pivot naar cloud-omgeving (M365 / SaaS) via gestolen sessietoken. ' +
                 'Toegang tot SharePoint, OneDrive, Outlook van meerdere accounts.',
      mitre_attack: ['T1550.001', 'T1530'],
      artifacts: ['M365 audit log: anomalous geographic logins',
                  'unusual SharePoint search queries',
                  'mass file access events'],
      detectability: 'subtle',
    },
    {
      id: 'T-3d-data-exfiltration',
      t_offset: 'T-3d',
      technique: 'Massieve data-exfiltratie naar attacker-controlled cloud storage. ' +
                 'Klantgegevens, financiële data, HR-data (incl BSN), contracten.',
      mitre_attack: ['T1567.002', 'T1041'],
      artifacts: ['large outbound transfers to mega.nz / dropbox',
                  'compressed archives created on file servers',
                  'data staging directories'],
      detectability: 'noisy',  // 40+ GB outbound is moeilijk te missen, maar gebeurt vaak buiten kantooruren
    },
    {
      id: 'T-1d-backup-destruction',
      t_offset: 'T-1d',
      technique: 'Backup-omgeving gecompromitteerd. Backup-jobs gesaboteerd of ' +
                 'versleuteld. Hypervisors voorbereid voor encryption.',
      mitre_attack: ['T1490'],
      artifacts: ['backup job failures', 'veeam/commvault config changes',
                  'hypervisor admin logins outside business hours'],
      detectability: 'noisy',
    },
    {
      id: 'T-0-encryption',
      t_offset: 'T-0',
      technique: 'Ransomware deployment via GPO of PsExec. Mass file encryption ' +
                 'met .CSPDR (of vergelijkbare unieke) extensie. Ransom notes ' +
                 'gedropt op elke endpoint.',
      mitre_attack: ['T1486'],
      artifacts: ['mass file rename events', 'ransom note README.txt op alle shares',
                  'shadow copies verwijderd', 'systemd / services stopped'],
      detectability: 'noisy',
    },
    {
      id: 'T+0-ransom-demand',
      t_offset: 'T+0:15',
      technique: 'Eerste ransom note bereikt management via email. Dreigt met ' +
                 'publicatie van geëxfiltreerde data binnen 72u als niet wordt betaald.',
      mitre_attack: ['T1657'],
      artifacts: ['email to info@ / management mailboxes',
                  'tor-onion contact address'],
      detectability: 'noisy',
    },
    {
      id: 'T+2-proof-of-life',
      t_offset: 'T+02:00',
      technique: 'Aanvaller stuurt proof-of-life: sample van geëxfiltreerde data, ' +
                 'concrete benoeming van klant-namen en BSN-nummers.',
      artifacts: ['second email with data sample',
                  'optional: post on leak site'],
      detectability: 'noisy',
    },
  ],
}
```

## Module-projecties (default)

| Module | Visible phases | Lens |
|---|---|---|
| detection_sensemaking | T-0, T+0:15, één gemiste fase uit T-21d tot T-7d | symptoms |
| business_continuity | T-0 + indirect bewijs T-3d (exfil) | impact |
| crisis_communication | T-0, T+0:15, T+2 + externe reacties | external_reactions |
| ransom_negotiation | T+0:15, T+2 + aanvaller-zijde expliciet | attacker_voice |

## Sectorvariaties

**Transport/logistiek:** initial access via phishing naar planning-team. Backups op tape die al twee jaar niet getest is. Klanten zijn AH/Lidl/Pharmalink-achtige distributiepartners met SLA-P1 contracten.

**Productie/voedsel:** initial access via OT-engineer's laptop. Productielijnen vallen stil. HACCP-protocollen kunnen niet meer worden gelogd. Klanten zijn supermarktketens en horeca-grossiers.

**IT-dienstverlener / SaaS:** initial access via vibe-coder die hardcoded credentials in Git heeft gepushed (zie Conclusion-scenario). Multi-tenant impact. Klantnotificatie wordt een hoofdrol.

**Zorg:** initial access via een onderhoudspartij. EPD valt uit. AVG-meldplicht is direct hard. Patiëntveiligheid is een psychologische dimensie naast bedrijfsimpact.

**Gemeente:** initial access via een interne medewerker phishing. Burgerdiensten vallen uit. Raadcommunicatie, ministerie van BZK, IBD allemaal betrokken.
