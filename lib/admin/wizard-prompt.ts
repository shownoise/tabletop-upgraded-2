// Wizard-prompt override. Standaard-prompt zit in lib/wizard/pipeline.ts als
// getrouwe buildSystemPrompt(). Deze store bewaart een override-versie die
// je in het admin-paneel bewerkt — plus een versie-string zodat rubric-scores
// weten welke prompt ze scoorden.

export interface WizardPromptOverride {
  systemPromptTemplate?: string  // volledige system prompt, tokens ${clientName} etc. blijven werken
  ruleAdditions?: string         // extra regels toegevoegd aan de 12 kern-rules (freeform tekst)
  version: string                // door user te wijzigen; default "v0"
  updatedAt: number
}

const KEY = "admin:wizard-prompt"

const globalAny = globalThis as unknown as { __ctt_admin_wizard_prompt__?: WizardPromptOverride }

async function getKv() {
  if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
  try { const { kv } = await import("@vercel/kv"); return kv }
  catch { return null }
}

export async function loadPromptOverride(): Promise<WizardPromptOverride | null> {
  const kv = await getKv()
  if (kv) return (await kv.get<WizardPromptOverride>(KEY)) ?? null
  return globalAny.__ctt_admin_wizard_prompt__ ?? null
}

export async function savePromptOverride(override: WizardPromptOverride): Promise<void> {
  const kv = await getKv()
  const next: WizardPromptOverride = { ...override, updatedAt: Date.now() }
  if (kv) await kv.set(KEY, next)
  else globalAny.__ctt_admin_wizard_prompt__ = next
}
