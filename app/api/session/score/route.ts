import { NextResponse } from 'next/server'
import { requireFacilitator } from '@/lib/auth-guard'
import { getState } from '@/lib/session-store'
import { scoreExercise, scoreExerciseByGroup, buildAssessmentReport } from '@/lib/scoring'
import { sessionToScoringInput } from '@/lib/scoring/graph-adapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/session/score — geeft de scoring-output voor de huidige sessie.
// Query-params:
//   mode = 'EVENT' | 'ASSESSMENT' (default ASSESSMENT)
//   format = 'json' | 'report'
//   byGroup = 'true' — geeft { [groupId]: ScoringOutput } terug voor EVENT-mode leaderboard
export async function GET(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const state = await getState()
  if (!state.session) {
    return NextResponse.json({ error: 'no active session' }, { status: 404 })
  }
  const url = new URL(req.url)
  const format = url.searchParams.get('format') ?? 'json'
  const mode = url.searchParams.get('mode') === 'EVENT' ? 'EVENT' : 'ASSESSMENT'
  const byGroup = url.searchParams.get('byGroup') === 'true'

  const input = sessionToScoringInput(state.session, { mode })
  if (!input) {
    return NextResponse.json({ error: 'session has no graph — scoring requires graph-based scenario' }, { status: 400 })
  }

  if (byGroup) {
    const perGroup = scoreExerciseByGroup(input)
    // Verrijk met groupName voor UI-gebruik.
    const groupNames: Record<string, string> = {}
    for (const g of (state.session.groups ?? [])) groupNames[g.id] = g.name
    return NextResponse.json({ perGroup, groupNames })
  }

  if (format === 'report') {
    const report = buildAssessmentReport(input)
    return NextResponse.json(report)
  }
  const output = scoreExercise(input)
  return NextResponse.json(output)
}
