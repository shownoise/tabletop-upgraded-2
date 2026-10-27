// Regressietest bij de klacht "dit moet versimpeld veel te uitgebreid" over de
// gereedschapsstap: het toezichthouder-rapport toonde daar veertien rijen met
// score 0 en "Niet aanwezig", plus een traceability-matrix van veertien ketens,
// terwijl er nog geen enkel bewijsstuk was. Deze test houdt die veertien rijen
// weg zolang er niets is vastgelegd, en houdt de groepering van de stap vast.
//
// Geen browser en geen jsdom in dit project: `renderToStaticMarkup` geeft de
// eerste render van een client component, en dat is precies wat de facilitator
// ziet voordat hij iets uitklapt. Effects lopen daarbij niet, dus het ingeklapte
// rapport doet hier ook geen fetch.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SupervisionReportView } from '@/components/admin/supervision-report'
import { SupervisionReportSection } from '@/components/admin/facilitator/supervision-report-section'
import { StepGereedschap } from '@/components/admin/facilitator/step-gereedschap'
import { SUPERVISION_AREAS, type SupervisionReport } from '@/lib/engine/supervision'
import type { SessionState } from '@/lib/types'
import type { FacilitatorActions } from '@/components/admin/facilitator/facilitator-shell'

function report(evidencePerArea: number): SupervisionReport {
  const areas = SUPERVISION_AREAS.map((meta, i) => ({
    area: meta.id,
    score: (evidencePerArea > 0 && i === 0 ? 2 : 0) as 0 | 1 | 2 | 3,
    rationale: evidencePerArea > 0 && i === 0 ? 'Gemengd beeld.' : 'Geen bewijs verzameld voor dit testgebied.',
    evidence: i === 0
      ? Array.from({ length: evidencePerArea }, (_, n) => ({
          timestamp: 1_700_000_000_000 + n,
          kind: 'decision' as const,
          summary: `bewijs ${n}`,
          supervisionArea: meta.id,
        }))
      : [],
  }))
  return {
    sessionId: 's1',
    scenarioTitle: 'Ransomware',
    participants: [],
    timeline: areas.flatMap(a => a.evidence),
    areas,
    overallScore: 0,
    lessonsLearned: [],
    traceability: [],
    generatedAt: 1_700_000_000_000,
  }
}

const actions: FacilitatorActions = {
  working: null,
  run: async () => {},
  startSession: () => {},
  endExercise: () => {},
  destroySession: () => {},
}

function session(): SessionState {
  return {
    id: 's1',
    joinCode: 'ABCD',
    status: 'active',
    mode: 'assessment',
    currentRound: 0,
    roundPhase: 'inject',
    participants: [],
    pushedInjects: [],
    timeline: [],
    config: { specialsMode: 'off' },
    scenario: {
      title: 'Ransomware',
      rounds: [{ title: 'Ontdekking', situation_update: 'De servers staan stil.', injects: [] }],
    },
  } as unknown as SessionState
}

describe('toezichthouder-rapport zonder bewijs', () => {
  const html = renderToStaticMarkup(createElement(SupervisionReportView, { report: report(0) }))

  it('toont geen veertien rijen met nullen', () => {
    expect(html).not.toMatch(/testgebieden\s*\(14\)/i)
    expect(html).not.toMatch(/niet aanwezig/i)
    expect(html).not.toMatch(/bewijsstukken/i)
  })

  it('toont geen traceability-matrix', () => {
    expect(html).not.toMatch(/traceability-ketens/i)
  })

  it('zegt in één regel dat er nog niets is en wat het vult', () => {
    expect(html).toMatch(/nog niets vastgelegd/i)
    expect(html).toMatch(/alle 14 testgebieden staan op 0/i)
    expect(html).toMatch(/besluit inlevert|besluit inleveren/i)
  })

  it('houdt de exportknoppen bij het rapport', () => {
    expect(html).toMatch(/json/i)
    expect(html).toMatch(/markdown/i)
  })
})

describe('toezichthouder-rapport met bewijs', () => {
  const html = renderToStaticMarkup(createElement(SupervisionReportView, { report: report(2) }))

  it('toont de testgebieden met de telling erbij', () => {
    expect(html).toMatch(/testgebieden — 1 van 14 met bewijs/i)
    expect(html).not.toMatch(/nog niets vastgelegd/i)
  })
})

describe('het rapport staat ingeklapt achter één regel', () => {
  const html = renderToStaticMarkup(createElement(SupervisionReportSection, {}))

  it('toont de kop maar niet het rapport', () => {
    expect(html).toMatch(/toezichthouder-rapport/i)
    expect(html).toMatch(/uitklappen/i)
    expect(html).not.toMatch(/testgebieden/i)
    expect(html).not.toMatch(/traceability/i)
  })
})

describe('de gereedschapsstap is gegroepeerd op wanneer je het nodig hebt', () => {
  const html = renderToStaticMarkup(
    createElement(StepGereedschap, { session: session(), lang: 'nl', actions }),
  )

  it('heeft vier kopjes', () => {
    expect(html).toMatch(/tijdens een ronde/i)
    expect(html).toMatch(/nakijken/i)
    expect(html).toMatch(/na de oefening/i)
    expect(html).toMatch(/techniek/i)
  })

  it('zet inject sturen open en het logboek dicht', () => {
    expect(html).toMatch(/de servers staan stil/i)
    expect(html).not.toMatch(/nog geen gebeurtenissen/i)
  })

  it('laat het toezichthouder-rapport op de stap niet uitklappen', () => {
    expect(html).toMatch(/toezichthouder-rapport — /i)
    expect(html).not.toMatch(/testgebieden/i)
  })

  it('is eerlijk over het pushen van een inject vóór de klik', () => {
    expect(html).toMatch(/bezorgen is definitief/i)
    expect(html).toMatch(/niet worden teruggehaald/i)
  })
})
