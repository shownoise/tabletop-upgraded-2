import type { ModuleId } from "../types"
import type { ModuleDefinition } from "../types/scenario-instance"

export { MODULE_DEFINITIONS, getModuleDefinition } from "./definitions"
export { DEFAULT_MODULE_SETS, DEFAULT_VISIBLE_PHASES } from "./defaults"

export function getModule(id: ModuleId): ModuleDefinition {
  const { MODULE_DEFINITIONS } = require("./definitions") as { MODULE_DEFINITIONS: ModuleDefinition[] }
  const m = MODULE_DEFINITIONS.find(d => d.id === id)
  if (!m) throw new Error(`Module not found: ${id}`)
  return m
}
