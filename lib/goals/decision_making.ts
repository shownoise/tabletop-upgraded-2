import type { GoalPlugin } from "./types"

export const decisionMakingGoal: GoalPlugin = {
  id: 'decision_making',
  name: 'Decision-Making Under Pressure',
  description: 'Train your team to make clear, mandate-aware decisions in crisis conditions. Focus on escalation timing, role clarity, and structured frameworks.',
  status: 'active',
  capabilities: [
    'governance_decisions',
    'crisis_communication',
    'legal_compliance',
  ],
  defaultScenarioTypes: [
    'ransomware_double_extortion',
    'insider_threat',
    'bec_cfo_fraud',
    'supply_chain_compromise',
  ],
  facilitatorGuide: `## Facilitator Guide — Decision-Making Under Pressure

**Focus areas for this exercise:**
- Are decisions being made by the right people?
- Is escalation happening at the right moment, or is the team waiting too long?
- Does the team apply a consistent framework, or do they jump between approaches?

**Before the session:**
- Assign roles and brief participants on their authorities (see role cards)
- Review the BOB/OODA phases — know when to call a phase transition
- Identify 2–3 moments where you will use the assessment controls to rate mandate clarity

**During the session:**
- Watch for decision paralysis: the team discussing without a clear owner
- Watch for premature escalation: involving the CEO/board before facts are established
- Use the facilitator halt action if the team is skipping the 'oordeelsvorming' phase
- Log assessment events in real time — don't wait until the debrief

**Debrief focus:**
- Which decisions were clear, and which were contested?
- Where did the mandate boundary cause confusion?
- What would change in your crisis protocol as a result?`,
  // Plain lines, no markdown: the intro overlay renders this split on newlines,
  // so any ## or ** would show up literally on a participant's screen.
  participantBriefing: `Jullie team krijgt een realistisch cyberincident voor de kiezen. Het doel is niet om technisch het juiste te doen — het is om onder tijdsdruk, met onvolledige informatie, heldere en verdedigbare keuzes te maken.

Wat je oefent: wie mag welk besluit nemen, hoe je tot een besluit komt als je het oneens bent, en wanneer escaleren aan de orde is.

Er is geen enkel juist antwoord. Hoe jullie tot een besluit komen weegt zwaarder dan de uitkomst.`,
}
