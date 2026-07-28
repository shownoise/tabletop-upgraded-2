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
