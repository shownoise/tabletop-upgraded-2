import type { ScenarioType } from "../types"
import type { AttackChainTemplate } from "../types/scenario-instance"
import { ransomware_double_extortion } from "./ransomware_double_extortion"
import { insider_threat } from "./insider_threat"
import { bec_cfo_fraud } from "./bec_cfo_fraud"
import { supply_chain_compromise } from "./supply_chain_compromise"

export { ransomware_double_extortion, insider_threat, bec_cfo_fraud, supply_chain_compromise }

export const CHAIN_REGISTRY: Record<ScenarioType, AttackChainTemplate> = {
  ransomware_double_extortion,
  insider_threat,
  bec_cfo_fraud,
  supply_chain_compromise,
}

export function getChain(type: ScenarioType): AttackChainTemplate {
  return CHAIN_REGISTRY[type]
}
