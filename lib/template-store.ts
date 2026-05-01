/**
 * Template library — persists templates to localStorage (client) or a JSON file (server).
 * In this implementation: client-side localStorage for portability.
 */

import type { ScenarioTemplate, TemplateLibrary } from "./template-types"
import { BUILTIN_TEMPLATES } from "./builtin-templates"

const STORAGE_KEY = "ctt:template-library"

export function loadLibrary(): TemplateLibrary {
  if (typeof window === "undefined") return { templates: BUILTIN_TEMPLATES, lastUpdated: Date.now() }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initLibrary()
    const lib = JSON.parse(raw) as TemplateLibrary
    // Merge builtins (always up to date)
    const customIds = new Set(lib.templates.map(t => t.id))
    const merged = [
      ...BUILTIN_TEMPLATES.filter(b => !customIds.has(b.id)),
      ...lib.templates,
    ]
    return { ...lib, templates: merged }
  } catch {
    return initLibrary()
  }
}

function initLibrary(): TemplateLibrary {
  const lib: TemplateLibrary = { templates: [...BUILTIN_TEMPLATES], lastUpdated: Date.now() }
  saveLibrary(lib)
  return lib
}

export function saveLibrary(lib: TemplateLibrary): void {
  if (typeof window === "undefined") return
  try {
    // Only save custom templates (not builtins) to avoid bloat
    const custom = lib.templates.filter(t => !BUILTIN_TEMPLATES.some(b => b.id === t.id))
    const toStore: TemplateLibrary = { templates: custom, lastUpdated: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch {}
}

export function addTemplate(template: ScenarioTemplate): TemplateLibrary {
  const lib = loadLibrary()
  const existing = lib.templates.findIndex(t => t.id === template.id)
  if (existing >= 0) lib.templates[existing] = template
  else lib.templates.push(template)
  saveLibrary(lib)
  return loadLibrary()
}

export function deleteTemplate(id: string): TemplateLibrary {
  const lib = loadLibrary()
  lib.templates = lib.templates.filter(t => t.id !== id)
  saveLibrary(lib)
  return loadLibrary()
}

export function exportTemplate(template: ScenarioTemplate): void {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `ctt-template-${template.id}-v${template.version}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importTemplate(file: File): Promise<ScenarioTemplate> {
  const text = await file.text()
  const t = JSON.parse(text) as ScenarioTemplate
  if (!t.id || !t.name || !t.rounds) throw new Error("Invalid template file")
  return t
}
