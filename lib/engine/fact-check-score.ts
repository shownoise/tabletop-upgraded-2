import type { FactCheckTag, InjectAnnotation, InjectSpanAnnotation, SessionState } from "@/lib/types"

interface Score {
  correct: number
  total: number
  score: number
}

interface AnnotationScore {
  matched: number
  total: number
  score: number
}

export interface FactCheckScoreResult {
  perParticipant: Record<string, Score>
  perParticipantAnnotations: Record<string, AnnotationScore>
  perRound: Record<number, Score>
  teamAverage: number   // 0..1
  totalTargets: number
}

export function annotationCorrectness(
  participant: InjectAnnotation[],
  groundTruth: InjectSpanAnnotation[],
): { matched: number; total: number } {
  let matched = 0
  for (const gt of groundTruth) {
    const gtLen = Math.max(1, gt.end - gt.start)
    for (const p of participant) {
      if (p.tag !== gt.tag) continue
      const overlap = Math.max(0, Math.min(p.end, gt.end) - Math.max(p.start, gt.start))
      if (overlap / gtLen >= 0.5) { matched += 1; break }
    }
  }
  return { matched, total: groundTruth.length }
}

function normalizeReliability(rel: string | undefined): FactCheckTag | undefined {
  if (!rel) return undefined
  if (rel === "fact" || rel === "assumption" || rel === "misleading") return rel
  return undefined
}

export function computeFactCheckScore(session: SessionState): FactCheckScoreResult {
  const perParticipant: Record<string, Score> = {}
  const perParticipantAnnotations: Record<string, AnnotationScore> = {}
  const perRound: Record<number, Score> = {}
  const checks = session.factChecks ?? []
  const allAnnotations = session.injectAnnotations ?? []
  let totalTargets = 0
  let sumRatio = 0
  let participantsScored = 0

  for (const p of session.participants) {
    perParticipant[p.id] = { correct: 0, total: 0, score: 0 }
    perParticipantAnnotations[p.id] = { matched: 0, total: 0, score: 0 }
  }

  session.scenario.rounds.forEach((r, ri) => {
    if (!perRound[ri]) perRound[ri] = { correct: 0, total: 0, score: 0 }
    for (const inj of r.injects) {
      const truth = normalizeReliability(inj.reliability)
      if (truth) {
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
      const gt = inj.groundTruthAnnotations ?? []
      if (gt.length > 0) {
        for (const p of session.participants) {
          const mine = allAnnotations.filter(a => a.injectId === inj.id && a.participantId === p.id)
          if (mine.length === 0) continue
          const { matched, total } = annotationCorrectness(mine, gt)
          const bucket = perParticipantAnnotations[p.id]
          bucket.matched += matched
          bucket.total += total
        }
      }
    }
  })

  for (const id of Object.keys(perParticipant)) {
    const s = perParticipant[id]
    const annScore = perParticipantAnnotations[id]
    annScore.score = annScore.total > 0 ? annScore.matched / annScore.total : 0
    // Combined weighting: inject-level 0.6, annotation-level 0.4 (per Part 1.6).
    const tagScore = s.total > 0 ? s.correct / s.total : 0
    if (annScore.total > 0) {
      s.score = tagScore * 0.6 + annScore.score * 0.4
    } else {
      s.score = tagScore
    }
    if (s.total > 0 || annScore.total > 0) {
      sumRatio += s.score
      participantsScored += 1
    }
  }
  for (const key of Object.keys(perRound)) {
    const s = perRound[key as unknown as number]
    s.score = s.total > 0 ? s.correct / s.total : 0
  }

  const teamAverage = participantsScored > 0 ? sumRatio / participantsScored : 0
  return { perParticipant, perParticipantAnnotations, perRound, teamAverage, totalTargets }
}
