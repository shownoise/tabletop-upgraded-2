import type { SessionAssessment, AssessmentAdvice, AssessmentDimensionId } from "./types"
import type { SessionState } from "@/lib/types"
import { getGoal } from "@/lib/goals/registry"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

const DIMENSION_LABELS: Record<AssessmentDimensionId, string> = {
  decision_speed: 'Decision Speed',
  decision_quality: 'Decision Quality',
  escalation_timing: 'Escalation Timing',
  communication_clarity: 'Communication Clarity',
  compliance_awareness: 'Compliance Awareness',
  mandate_clarity: 'Mandate Clarity',
  dilemma_participation: 'Dilemma Participation',
  framework_adherence: 'Framework Adherence',
}

export class DebriefAdviceError extends Error {
  constructor(message: string, public reason: 'no_api_key' | 'api_error' | 'parse_error' | 'network_error') {
    super(message)
    this.name = 'DebriefAdviceError'
  }
}

export async function generateDebriefAdvice(
  session: SessionState,
  assessment: SessionAssessment,
): Promise<AssessmentAdvice[]> {
  const goal = getGoal(assessment.goalId)
  const scoredDimensions = goal.assessmentDimensions.filter(
    d => assessment.dimensionScores[d] !== undefined
  )

  if (scoredDimensions.length === 0) return []
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new DebriefAdviceError('ANTHROPIC_API_KEY missing — cannot generate debrief advice', 'no_api_key')
  }

  const dimensionLines = scoredDimensions
    .map(d => `- ${DIMENSION_LABELS[d]}: ${assessment.dimensionScores[d]}/100`)
    .join('\n')

  const prompt = `You are a crisis exercise debrief expert. Generate concise assessment advice based on the following exercise session.

Goal: ${goal.name}
Description: ${goal.description}

Dimension scores (0-100):
${dimensionLines}

Overall score: ${assessment.overallScore}/100
Participants: ${session.participants.length}
Rounds completed: ${session.currentRound}

For each dimension that scored below 70, generate one piece of advice with:
- observation: what we likely observed (1 sentence)
- recommendation: specific improvement (1 sentence)
- priority: "high" if below 50, "medium" if 50-69, "low" if 70 or above

Return valid JSON only: { "advice": [ { "dimensionId": "...", "observation": "...", "recommendation": "...", "priority": "..." } ] }

Only include dimensions that were scored. Return an empty advice array if all scores are 70 or above.`

  try {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      throw new DebriefAdviceError(`Anthropic API returned ${response.status}`, 'api_error')
    }

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new DebriefAdviceError('No JSON block found in Anthropic response', 'parse_error')
    }
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed.advice) ? parsed.advice : []
  } catch (err) {
    if (err instanceof DebriefAdviceError) throw err
    throw new DebriefAdviceError(err instanceof Error ? err.message : 'Unknown debrief error', 'network_error')
  }
}
