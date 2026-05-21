import type { CapabilityPlugin } from "./types"

export const gamificationCapability: CapabilityPlugin = {
  id: 'gamification',
  name: 'Gamification',
  description: 'Always-active engagement layer: dilemma cards, optional points tracking, and competitive leaderboard.',
  injectChannelPreferences: [],
  roundActionTypes: ['dilemma_card'],
  participantDocTemplates: [],
  facilitatorHints: [
    'Dilemma cards work best after an inject that raises a real tension — use them at the moment of peak ambiguity.',
    'In subtle mode, announce the dilemma verbally without mentioning points.',
    'Allow 60 seconds for votes before revealing — silence is part of the effect.',
  ],
  assessmentDimensions: ['dilemma_participation'],
}
