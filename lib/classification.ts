import type { Inject, FactCheckTag, SessionState } from "./types"
import type { ScenarioGraph } from "./graph/types"

export type InjectClassification = 'feit' | 'aanname'

// `classification` is het enige auteursveld voor de feit/aanname-as en is
// ground truth: toParticipantState strijkt het uit de deelnemer-payload tot de
// review-fase. Het oude `reliability` ('fact' | 'assumption' | 'misleading') is
// geen auteursinput meer en wordt hier eenmalig ingelezen.
//
// 'misleading' wordt 'aanname': een bewuste onwaarheid is achteraf een
// ongetoetste aanname, en de deelnemer heeft er geen derde knop voor.
export function classificationFromLegacyReliability(value: unknown): InjectClassification | undefined {
  switch (value) {
    case 'fact':       return 'feit'
    case 'assumption': return 'aanname'
    case 'misleading': return 'aanname'
    default:           return undefined
  }
}

// De deelnemer tagt in Engels ('fact' | 'assumption'), de auteur in Nederlands.
export function classificationForTag(tag: FactCheckTag): InjectClassification {
  return tag === 'fact' ? 'feit' : 'aanname'
}

export function tagMatchesClassification(
  tag: FactCheckTag | undefined,
  classification: InjectClassification | undefined,
): boolean | undefined {
  if (!tag || !classification) return undefined
  return classificationForTag(tag) === classification
}

type ClassifiableInject = { classification?: string; reliability?: unknown }

// Vult classification alleen waar het ontbreekt — een auteurswaarde wordt nooit
// overschreven. Geeft hetzelfde object terug als er niks te migreren is, zodat
// callers op referentie-gelijkheid kunnen testen.
function migrateOne<T extends ClassifiableInject>(inject: T): T {
  const current = inject.classification
  if (current === 'feit' || current === 'aanname') return inject
  // 'fabel' is verwijderd 2026-08-14 en bestond alleen op classification.
  const fromLegacyLabel = current === 'fabel' ? 'aanname' as const : undefined
  const next = fromLegacyLabel ?? classificationFromLegacyReliability(inject.reliability)
  if (!next) return inject
  return { ...inject, classification: next }
}

function migrateList<T extends ClassifiableInject>(list: readonly T[]): readonly T[] {
  let touched = false
  const out = list.map(item => {
    const next = migrateOne(item)
    if (next !== item) touched = true
    return next
  })
  return touched ? out : list
}

export function migrateInjectClassification(inject: Inject): Inject {
  return migrateOne(inject)
}

// Dekt zowel graph.nodes als graph.injectLibrary — de bibliotheek werd eerder
// overgeslagen, waardoor legacy-entries een verouderde waarde hielden.
export function migrateGraphClassifications(graph: ScenarioGraph): ScenarioGraph {
  let touched = false
  const nodes = graph.nodes.map(node => {
    if (node.type !== 'inject') return node
    const data = migrateOne(node.data as ClassifiableInject)
    if (data === (node.data as ClassifiableInject)) return node
    touched = true
    return { ...node, data: data as typeof node.data }
  })
  const library = graph.injectLibrary
  const migratedLibrary = library ? migrateList(library) : library
  if (migratedLibrary !== library) touched = true
  if (!touched) return graph
  return {
    ...graph,
    nodes,
    ...(migratedLibrary ? { injectLibrary: migratedLibrary as NonNullable<ScenarioGraph['injectLibrary']> } : {}),
  }
}

// Live sessies hebben hun rondes al gematerialiseerd, dus de graph-migratie
// alleen is niet genoeg: scenario.rounds, pushedInjects en de meegebakken graph
// moeten alle drie mee.
export function migrateSessionClassifications(session: SessionState): SessionState {
  let touched = false

  const rounds = session.scenario.rounds.map(round => {
    const injects = migrateList(round.injects) as Inject[]
    const roleActions = round.roleActions?.map(action => {
      const pushes = action.pushesInject
      if (!pushes) return action
      const migrated = migrateOne(pushes as ClassifiableInject)
      if (migrated === (pushes as ClassifiableInject)) return action
      return { ...action, pushesInject: migrated as typeof pushes }
    })
    const actionsTouched = roleActions
      ? roleActions.some((a, i) => a !== round.roleActions![i])
      : false
    if (injects === round.injects && !actionsTouched) return round
    touched = true
    return { ...round, injects, ...(roleActions ? { roleActions } : {}) }
  })

  const pushedInjects = session.pushedInjects.map(pushed => {
    const inject = migrateOne(pushed.inject)
    if (inject === pushed.inject) return pushed
    touched = true
    return { ...pushed, inject }
  })

  const graph = session.graph ? migrateGraphClassifications(session.graph) : session.graph
  if (graph !== session.graph) touched = true

  if (!touched) return session
  return {
    ...session,
    scenario: { ...session.scenario, rounds },
    pushedInjects,
    ...(graph ? { graph } : {}),
  }
}
