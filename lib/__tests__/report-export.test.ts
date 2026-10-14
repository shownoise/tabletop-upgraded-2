import { describe, expect, it } from 'vitest'
import { schoolverenigingScenario } from '@/lib/graph/examples-schoolvereniging'
import { exportReportMarkdown } from '@/lib/report/export'
import type { SessionState } from '@/lib/types'

describe('session report export', () => {
  it('does not present an unscored graph outcome as established', () => {
    const session = {
      id: 'test-session', status: 'ended',
      graph: schoolverenigingScenario(),
      graphState: {
        finalOutcome: { label: 'Misleidende uitkomst', narrative: 'Niet genomen acties.' },
        branchLog: [],
      },
      scenario: { scenario_title: 'Test', rounds: [] },
      submittedDecisions: [{ actionId: 'unlinked-role-action', actionLabel: 'Actie', roundIndex: 0, participantName: 'Tester', role: 'ceo' }],
      participants: [], timeline: [],
    } as unknown as SessionState

    const markdown = exportReportMarkdown(session)
    expect(markdown).toContain('Automatische uitkomst niet betrouwbaar')
    expect(markdown).not.toContain('Misleidende uitkomst')
    expect(markdown).not.toContain('Niet genomen acties.')
  })
})
