import type { FactCheckTag, SessionState } from "@/lib/types"

interface Score {
  correct: number
  total: number
  score: number
}

export interface FactCheckScoreResult {
  perParticipant: Record<string, Score>
  perRound: Record<number, Score>
  teamAverage: number   // 0..1
  totalTargets: number
}

function normalizeReliability(rel: string | undefined): FactCheckTag | undefined {
  if (!rel) return undefined
  if (rel === "fact" || rel === "assumption" || rel === "misleading") return rel
  return undefined
}

export function computeFactCheckScore(session: SessionState): FactCheckScoreResult {
  const perParticipant: Record<string, Score> = {}
  const perRound: Record<number, Score> = {}
  const checks = session.factChecks ?? []
  let totalTargets = 0
  let sumRatio = 0
  let participantsScored = 0

  for (const p of session.participants) {
    perParticipant[p.id] = { correct: 0, total: 0, score: 0 }
  }

  session.scenario.rounds.forEach((r, ri) => {
    if (!perRound[ri]) perRound[ri] = { correct: 0, total: 0, score: 0 }
    for (const inj of r.injects) {
      const truth = normalizeReliability(inj.reliability)
      if (!truth) continue
      totalTargets += 1
      for (const p of session.participants) {
        const tag = checks.find(c => c.injectId === inj.id && c.participantId === p.id)?.tag
        if (!tag) continue
        const target = perParticipant[p.id]
        target.total += 1
        perRound[ri].total += 1
        if (tag === truth) {
          target.correct += 1
          perRound[ri].correct += 1
        }
      }
    }
  })

  for (const id of Object.keys(perParticipant)) {
    const s = perParticipant[id]
    s.score = s.total > 0 ? s.correct / s.total : 0
    if (s.total > 0) {
      sumRatio += s.score
      participantsScored += 1
    }
  }
  for (const key of Object.keys(perRound)) {
    const s = perRound[key as unknown as number]
    s.score = s.total > 0 ? s.correct / s.total : 0
  }

  const teamAverage = participantsScored > 0 ? sumRatio / participantsScored : 0
  return { perParticipant, perRound, teamAverage, totalTargets }
}
