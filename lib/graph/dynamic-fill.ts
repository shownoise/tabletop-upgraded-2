import type { ExerciseConfig } from "@/lib/types"
import type { DecisionNodeData, DynamicFillToken, InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"
import { DYNAMIC_FILL_TOKENS } from "./types"

// Values available for {{token}} substitution. Keep this list in sync with
// DYNAMIC_FILL_TOKENS in ./types.
function tokenValue(token: DynamicFillToken, config: ExerciseConfig): string | undefined {
  switch (token) {
    case 'sector':           return config.sector
    case 'companySize':      return config.companySize
    case 'crownJewels':      return config.crownJewels
    case 'criticalSystems':  return config.criticalSystems
    case 'irRetainerName':   return config.irRetainerName
  }
}

function replaceTokens(text: string, allowed: DynamicFillToken[], config: ExerciseConfig): string {
  if (!text || allowed.length === 0) return text
  let out = text
  for (const t of allowed) {
    const v = tokenValue(t, config)
    if (v === undefined || v === null || v === '') continue
    out = out.split(`{{${t}}}`).join(v)
  }
  return out
}

// Decision options don't carry a per-node dynamic config — as soon as the
// graph contains ANY dynamic-marked node, decision option labels + lessons
// get the full token set (all known tokens allowed) so authors can drop
// {{crownJewels}} in an option without extra ceremony.
const ALL_TOKENS: DynamicFillToken[] = DYNAMIC_FILL_TOKENS

// Which config field feeds each token, for telling a facilitator what to fill in.
export const TOKEN_CONFIG_LABEL: Record<DynamicFillToken, string> = {
  sector: 'Sector',
  companySize: 'Bedrijfsgrootte',
  crownJewels: 'Kroonjuwelen',
  criticalSystems: 'Kritieke systemen',
  irRetainerName: 'Naam IR-retainer',
}

function tokensIn(text: string | undefined, allowed: readonly DynamicFillToken[]): DynamicFillToken[] {
  if (!text) return []
  return allowed.filter(t => text.includes(`{{${t}}}`))
}

// Which tokens this scenario actually substitutes into participant-facing
// text. Mirrors applyDynamicFill's rules exactly — including that
// aiPromptTemplate is filled even without dynamic.enabled, and that decision
// nodes only take part once some node in the graph is dynamic. Callers use this
// to warn about config values that land in the scenario: an empty one leaves a
// literal "{{sector}}", an untouched default puts the wrong client in the text.
export function findUsedTokens(graph: ScenarioGraph): DynamicFillToken[] {
  const hasAnyDynamic = graph.nodes.some(n => (n.data as { dynamic?: { enabled?: boolean } }).dynamic?.enabled === true)
  const used = new Set<DynamicFillToken>()

  for (const node of graph.nodes) {
    const d = node.data as (InjectNodeData | RoundNodeData | DecisionNodeData) & {
      dynamic?: { enabled?: boolean; fillFrom?: DynamicFillToken[] }
      aiPromptTemplate?: string
    }
    const allowed = d.dynamic?.fillFrom ?? ALL_TOKENS
    const isDynamic = d.dynamic?.enabled === true

    for (const t of tokensIn(d.aiPromptTemplate, ALL_TOKENS)) used.add(t)

    if (node.type === 'inject' && isDynamic) {
      const inj = d as InjectNodeData
      for (const t of [...tokensIn(inj.title, allowed), ...tokensIn(inj.content, allowed)]) used.add(t)
    } else if (node.type === 'round' && isDynamic) {
      const rd = d as RoundNodeData
      const fields = [rd.title, rd.situation_update, ...(rd.openingPrompts ?? [])]
      for (const f of fields) for (const t of tokensIn(f, allowed)) used.add(t)
    } else if (node.type === 'decision' && hasAnyDynamic) {
      const dd = d as DecisionNodeData
      const fields = [dd.prompt, ...dd.options.flatMap(o => [o.label, o.lessonLearned])]
      for (const f of fields) for (const t of tokensIn(f, ALL_TOKENS)) used.add(t)
    }
  }

  return [...used]
}

// The subset whose config value is missing, so replaceTokens leaves the raw
// "{{token}}" in the text a participant reads.
export function findUnfilledTokens(graph: ScenarioGraph, config: ExerciseConfig): DynamicFillToken[] {
  return findUsedTokens(graph).filter(t => {
    const v = tokenValue(t, config)
    return v === undefined || v === null || v === ''
  })
}

// Walk the graph and substitute {{token}} in nodes marked dynamic.enabled.
// Only title, content, situation_update, openingPrompts[], and decision option
// label / lessonLearned are touched. Unknown or unlisted tokens are left
// verbatim so authors see mistyped placeholders.
export function applyDynamicFill(graph: ScenarioGraph, config: ExerciseConfig): ScenarioGraph {
  const hasAnyDynamic = graph.nodes.some(n => {
    const d = n.data as { dynamic?: { enabled?: boolean } }
    return d.dynamic?.enabled === true
  })
  return {
    ...graph,
    nodes: graph.nodes.map(n => {
      if (n.type === 'inject') {
        const d = n.data as InjectNodeData
        // aiPromptTemplate wordt altijd token-vervangen (ook zonder dynamic.enabled) —
        // Claude expandeert dan de gerichte prompt met de juiste sector/etc.
        const hasAi = typeof d.aiPromptTemplate === 'string' && d.aiPromptTemplate.length > 0
        if (!d.dynamic?.enabled && !hasAi) return n
        const allowed = d.dynamic?.fillFrom ?? ALL_TOKENS
        return {
          ...n,
          data: {
            ...d,
            title: d.dynamic?.enabled ? replaceTokens(d.title, allowed, config) : d.title,
            content: d.dynamic?.enabled ? replaceTokens(d.content, allowed, config) : d.content,
            aiPromptTemplate: hasAi ? replaceTokens(d.aiPromptTemplate!, ALL_TOKENS, config) : d.aiPromptTemplate,
          },
        }
      }
      if (n.type === 'round') {
        const d = n.data as RoundNodeData
        const hasAi = typeof d.aiPromptTemplate === 'string' && d.aiPromptTemplate.length > 0
        if (!d.dynamic?.enabled && !hasAi) return n
        const allowed = d.dynamic?.fillFrom ?? ALL_TOKENS
        return {
          ...n,
          data: {
            ...d,
            title: d.dynamic?.enabled ? replaceTokens(d.title, allowed, config) : d.title,
            situation_update: d.dynamic?.enabled ? replaceTokens(d.situation_update, allowed, config) : d.situation_update,
            openingPrompts: d.dynamic?.enabled ? d.openingPrompts?.map(p => replaceTokens(p, allowed, config)) : d.openingPrompts,
            aiPromptTemplate: hasAi ? replaceTokens(d.aiPromptTemplate!, ALL_TOKENS, config) : d.aiPromptTemplate,
          },
        }
      }
      if (n.type === 'decision' && hasAnyDynamic) {
        const d = n.data as DecisionNodeData
        return {
          ...n,
          data: {
            ...d,
            prompt: replaceTokens(d.prompt, ALL_TOKENS, config),
            options: d.options.map(o => ({
              ...o,
              label: replaceTokens(o.label, ALL_TOKENS, config),
              lessonLearned: o.lessonLearned ? replaceTokens(o.lessonLearned, ALL_TOKENS, config) : o.lessonLearned,
            })),
          },
        }
      }
      return n
    }),
  }
}
