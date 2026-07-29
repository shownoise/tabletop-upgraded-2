import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getState } from '@/lib/session-store'
import { scoreExercise, buildAssessmentReport } from '@/lib/scoring'
import { sessionToScoringInput } from '@/lib/scoring/graph-adapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/session/score — geeft de scoring-output voor de huidige sessie.
// Alleen facilitators (auth). Participants zouden een gescrubde variant krijgen
// via een aparte read-view (Deel B §5.3 anti-gaming), niet via deze endpoint.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const state = await getState()
  if (!state.session) {
    return NextResponse.json({ error: 'no active session' }, { status: 404 })
  }
  const url = new URL(req.url)
  const format = url.searchParams.get('format') ?? 'json'
  const mode = url.searchParams.get('mode') === 'EVENT' ? 'EVENT' : 'ASSESSMENT'

  const input = sessionToScoringInput(state.session, { mode })
  if (!input) {
    return NextResponse.json({ error: 'session has no graph — scoring requires graph-based scenario' }, { status: 400 })
  }

  if (format === 'report') {
    const report = buildAssessmentReport(input)
    return NextResponse.json(report)
  }
  const output = scoreExercise(input)
  return NextResponse.json(output)
}
