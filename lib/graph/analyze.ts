import type { Role, SpecialsMode } from "@/lib/types"
import type { DecisionNodeData, RoundNodeData, ScenarioGraph, SpecialNodeData } from "./types"

export interface GraphAnalysis {
  requiredRoles: Role[]
  suggestedSpecialsMode: SpecialsMode
  specialTypes: string[]
  roundCount: number
  hasDecisions: boolean
  hasOutcomes: boolean
  decisionRoleActionIds: string[]
  unmatchedDecisionOptions: Array<{ decisionNodeId: string; optionLabel: string }>
}

export function analyzeGraph(graph: ScenarioGraph): GraphAnalysis {
  const requiredRoles = new Set<Role>()
  const allRoleActionIds = new Set<string>()
  const decisionRoleActionIds = new Set<string>()
  let hasDecisions = false
  let hasOutcomes = false
  const specialTypes = new Set<string>()
  let roundCount = 0

  for (const node of graph.nodes) {
    if (node.type === "round") {
      roundCount++
      const rd = node.data as RoundNodeData
      for (const action of rd.roleActions ?? []) {
        allRoleActionIds.add(action.id)
        for (const r of action.allowedRoles) requiredRoles.add(r)
      }
    } else if (node.type === "decision") {
      hasDecisions = true
      const dd = node.data as DecisionNodeData
      if (dd.triggerRole) requiredRoles.add(dd.triggerRole)
      for (const opt of dd.options) {
        if (opt.roleActionId) decisionRoleActionIds.add(opt.roleActionId)
      }
    } else if (node.type === "special") {
      const sd = node.data as SpecialNodeData
      if (sd.assignedRole) requiredRoles.add(sd.assignedRole)
      specialTypes.add(sd.type)
    } else if (node.type === "outcome") {
      hasOutcomes = true
    }
  }

  const unmatchedDecisionOptions: Array<{ decisionNodeId: string; optionLabel: string }> = []
  for (const node of graph.nodes) {
    if (node.type !== "decision") continue
    const dd = node.data as DecisionNodeData
    for (const opt of dd.options) {
      if (opt.roleActionId && !allRoleActionIds.has(opt.roleActionId)) {
        unmatchedDecisionOptions.push({ decisionNodeId: node.id, optionLabel: opt.label })
      }
    }
  }

  return {
    requiredRoles: [...requiredRoles],
    suggestedSpecialsMode: specialTypes.size > 0 ? "static" : "off",
    specialTypes: [...specialTypes],
    roundCount,
    hasDecisions,
    hasOutcomes,
    decisionRoleActionIds: [...decisionRoleActionIds],
    unmatchedDecisionOptions,
  }
}
