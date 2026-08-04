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
  participantBriefing: `## Participant Briefing — Decision-Making Under Pressure

In this exercise, your team will face a realistic cyber incident scenario. Your goal is not just to respond to technical events — it is to **make clear, justified decisions** under time pressure, with incomplete information.

**What we are practising:**
- Who has the authority to make which decisions?
- How do you structure a decision when you disagree?
- When is it the right moment to escalate?

**How it works:**
- You will receive injects (messages, alerts, emails) as the scenario unfolds
- Your role comes with specific authorities — use them
- At key moments, the facilitator may call a structured decision phase
- Some rounds include a dilemma — everyone votes, then you discuss

**There is no single right answer.** The quality of your decision-making process matters more than the outcome.`,
}
