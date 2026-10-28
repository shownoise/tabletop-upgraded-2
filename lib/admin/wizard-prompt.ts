// Wizard-prompt override. Standaard-prompt zit in lib/wizard/pipeline.ts als
// getrouwe buildSystemPrompt(). Deze store bewaart een override-versie die
// je in het admin-paneel bewerkt — plus een versie-string zodat rubric-scores
// weten welke prompt ze scoorden.

import { withStore } from "@/lib/db"

export interface WizardPromptOverride {
  systemPromptTemplate?: string  // volledige system prompt, tokens ${clientName} etc. blijven werken
  ruleAdditions?: string         // extra regels toegevoegd aan de 12 kern-rules (freeform tekst)
  version: string                // door user te wijzigen; default "v0"
  updatedAt: number
}

const KEY = "admin:wizard-prompt"

// Via withStore; zie de opmerking in rubric-scores.ts. Dit was de laatste
// module met een eigen, half afgeschermde @vercel/kv-client.
export async function loadPromptOverride(): Promise<WizardPromptOverride | null> {
  return await withStore("wizard-prompt lezen", async s =>
    (await s.get<WizardPromptOverride>(KEY)) ?? null,
  )
}

export async function savePromptOverride(override: WizardPromptOverride): Promise<void> {
  const next: WizardPromptOverride = { ...override, updatedAt: Date.now() }
  await withStore("wizard-prompt schrijven", s => s.set(KEY, next))
}
