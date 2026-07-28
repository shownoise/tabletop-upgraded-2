import type { ExerciseConfig } from "@/lib/types"
import type { InjectNodeData, RoundNodeData, ScenarioGraph } from "./types"

// Runtime AI-fill: nodes met een aiPromptTemplate krijgen bij sessie-start
// content gegenereerd door Claude, gestuurd door de prompt-template van de
// author. De template ondergaat éérst dynamic-fill (in de create-route), zodat
// {{sector}} etc. al vervangen zijn voordat Claude hem ziet.
//
// Waarom niet in dynamic-fill zelf: die is synchroon en pure; deze doet een
// externe API call en mag falen zonder de sessie te blokkeren.
export async function applyAiRuntimeFill(
  graph: ScenarioGraph,
  config: ExerciseConfig,
  apiKey: string,
): Promise<ScenarioGraph> {
  const targets = graph.nodes.filter(n => {
    const d = n.data as { aiPromptTemplate?: string }
    return typeof d.aiPromptTemplate === 'string' && d.aiPromptTemplate.trim().length > 0
  })
  if (targets.length === 0) return graph

  // Sequentiele calls houd het rate-friendly. Als het scenario > 5 AI-nodes heeft
  // wordt het langzaam maar dat is expliciete authoring-keuze.
  const results = new Map<string, { title?: string; content?: string; situation_update?: string }>()
  for (const node of targets) {
    const d = node.data as { aiPromptTemplate?: string }
    const prompt = buildPrompt(node.type, d.aiPromptTemplate!, config, graph)
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 700,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (!res.ok) continue
      const data = await res.json() as { content: Array<{ type: string; text: string }> }
      const text = data.content?.find(b => b.type === "text")?.text ?? ""
      const parsed = safeParseJson(text)
      if (parsed) results.set(node.id, parsed)
    } catch { /* silent: fall back to author-written content */ }
  }

  if (results.size === 0) return graph
  return {
    ...graph,
    nodes: graph.nodes.map(n => {
      const filled = results.get(n.id)
      if (!filled) return n
      if (n.type === 'round') {
        const d = n.data as RoundNodeData
        return {
          ...n,
          data: {
            ...d,
            title: filled.title?.trim() || d.title,
            situation_update: filled.situation_update?.trim() || filled.content?.trim() || d.situation_update,
          },
        }
      }
      if (n.type === 'inject') {
        const d = n.data as InjectNodeData
        return {
          ...n,
          data: {
            ...d,
            title: filled.title?.trim() || d.title,
            content: filled.content?.trim() || filled.situation_update?.trim() || d.content,
          },
        }
      }
      return n
    }),
  }
}

function buildPrompt(kind: string, template: string, config: ExerciseConfig, graph: ScenarioGraph): string {
  const contextLines = [
    `Scenario-naam: ${graph.name}`,
    `Scenario-type: ${graph.scenarioType}`,
    config.sector ? `Sector: ${config.sector}` : "",
    config.companySize ? `Organisatiegrootte: ${config.companySize}` : "",
    config.criticalSystems ? `Kritieke systemen: ${config.criticalSystems}` : "",
    config.crownJewels ? `Kroonjuwelen: ${config.crownJewels}` : "",
  ].filter(Boolean).join("\n")

  const outputShape = kind === 'round'
    ? `{"title":"korte titel max 8 woorden","situation_update":"3-4 zinnen situatie-beschrijving"}`
    : `{"title":"korte inject-titel","content":"1-3 zinnen berichtinhoud in het Nederlands"}`

  return `Je bent een cyber-tabletop scenarioschrijver. Genereer content op basis van deze prompt.

Context:
${contextLines}

Author-prompt:
${template}

Geef ALLEEN geldige JSON terug (geen markdown, geen uitleg):
${outputShape}`
}

function safeParseJson(text: string): { title?: string; content?: string; situation_update?: string } | null {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim())
  } catch {
    return null
  }
}
