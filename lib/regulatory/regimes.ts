import type { RegulatoryRegime } from "@/lib/types"

// Default NL regime — AVG art. 33 + NIS2 art. 23 combined.
//
// Deadlines (verified against Article 33 GDPR + Directive 2022/2555 NIS2):
//   • AVG art. 33     — 72 hours to Autoriteit Persoonsgegevens.
//   • NIS2 art. 23(4) — 24-hour early warning to CSIRT/NCSC, 72-hour incident
//                        notification, 1-month final report.
//
// The exercise-facing regime keeps the strictest initial deadline (24h from
// NIS2) and the closing deadline from NIS2 (1 month = 720h). Scenarios can
// override to AVG-only via their own regime object if they wish.
export const NL_AVG_NIS2_REGIME: RegulatoryRegime = {
  id: 'nl_avg_nis2',
  jurisdiction: 'Nederland',
  authorityLabel: 'Autoriteit Persoonsgegevens (AVG) + CSIRT/NCSC (NIS2)',
  obligation:
    'Bij een datalek met risico voor betrokkenen (AVG art. 33) en/of een significant incident onder NIS2 (art. 23) is een melding aan de toezichthouder verplicht.',
  triggerFlag: 'triggersRegulatoryNotification',
  milestones: [
    {
      id: 'initial',
      label: 'Initiële melding bij de toezichthouder',
      deadlineHours: 24,
      purpose:
        'Vroegtijdige waarschuwing binnen 24 uur na bekendwording (NIS2 art. 23 lid 4). Onder AVG art. 33 geldt 72 uur; NIS2 is strenger. In een oefening houden we de strengste aan.',
    },
    {
      id: 'closing',
      label: 'Eindrapportage aan de toezichthouder',
      deadlineHours: 720,
      purpose:
        'Eindrapport binnen één maand na de eerste melding. Deze verplichting stopt niet met de containment — dit is het bewustzijnsmoment.',
    },
  ],
  scoring: {
    onTime:  { JUR: +2, VER: +1 },
    late:    { JUR: -1, VER:  0 },
    omitted: { JUR: -2, VER: -1 },
  },
}

export const REGULATORY_REGIMES: Record<string, RegulatoryRegime> = {
  [NL_AVG_NIS2_REGIME.id]: NL_AVG_NIS2_REGIME,
}
