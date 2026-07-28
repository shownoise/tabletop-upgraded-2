import type { ExerciseConfig } from "@/lib/types"
import type { DynamicFillToken, InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"

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

// Walk the graph and substitute {{token}} in nodes marked dynamic.enabled.
// Only title, content, situation_update, and openingPrompts[] are touched.
// Unknown or unlisted tokens are left verbatim so authors see mistyped placeholders.
export function applyDynamicFill(graph: ScenarioGraph, config: ExerciseConfig): ScenarioGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(n => {
      if (n.type === 'inject') {
        const d = n.data as InjectNodeData
        if (!d.dynamic?.enabled) return n
        const allowed = d.dynamic.fillFrom
        return {
          ...n,
          data: {
            ...d,
            title: replaceTokens(d.title, allowed, config),
            content: replaceTokens(d.content, allowed, config),
          },
        }
      }
      if (n.type === 'round') {
        const d = n.data as RoundNodeData
        if (!d.dynamic?.enabled) return n
        const allowed = d.dynamic.fillFrom
        return {
          ...n,
          data: {
            ...d,
            title: replaceTokens(d.title, allowed, config),
            situation_update: replaceTokens(d.situation_update, allowed, config),
            openingPrompts: d.openingPrompts?.map(p => replaceTokens(p, allowed, config)),
          },
        }
      }
      return n
    }),
  }
}
