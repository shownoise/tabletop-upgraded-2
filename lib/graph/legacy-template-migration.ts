import { BUILTIN_TEMPLATES } from "@/lib/builtin-templates"
import type { ScenarioTemplate } from "@/lib/template-types"
import { planToGraph, type WizardPlan } from "./wizard-plan"
import type { ScenarioGraph } from "./types"
import type { ScenarioType } from "@/lib/types"

export type LegacyTemplateSource = "browser" | "server"

export const LEGACY_TEMPLATE_LIBRARY_KEY = "ctt:template-library"

export function isBuiltinTemplate(template: Pick<ScenarioTemplate, "id">): boolean {
  return BUILTIN_TEMPLATES.some(builtin => builtin.id === template.id)
}

function plainText(html: string | undefined): string {
  if (!html) return ""
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function scenarioTypeFor(template: ScenarioTemplate): ScenarioType {
  if (template.scenario_type) return template.scenario_type
  if (template.tags.includes("insider-threat")) return "insider_threat"
  if (template.tags.includes("bec")) return "bec_cfo_fraud"
  if (template.tags.includes("supply-chain")) return "supply_chain_compromise"
  return "ransomware_double_extortion"
}

export function legacyTemplateGraphId(source: LegacyTemplateSource, templateId: string): string {
  const safe = templateId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "template"
  let hash = 0x811c9dc5
  for (const character of `${source}:${templateId}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `legacy-${source}-${safe}-${(hash >>> 0).toString(36)}`
}

function outcomeNarrative(template: ScenarioTemplate): string {
  const sections = [
    template.outcomes.good.length > 0 ? `Gewenste uitkomsten:\n${template.outcomes.good.map(item => `- ${item}`).join("\n")}` : "",
    template.outcomes.bad.length > 0 ? `Risico's om te bespreken:\n${template.outcomes.bad.map(item => `- ${item}`).join("\n")}` : "",
    template.outcomes.debriefQuestions.length > 0 ? `Debriefvragen:\n${template.outcomes.debriefQuestions.map(item => `- ${item}`).join("\n")}` : "",
  ].filter(Boolean)
  return sections.join("\n\n") || "Bespreek de gekozen acties, gevolgen en verbeterpunten."
}

/**
 * Converts the usable, static part of a retired ScenarioTemplate to the current
 * graph format. The original template is deliberately never changed or deleted:
 * imports are drafts and remain independently reviewable in the graph builder.
 */
export function legacyTemplateToScenarioGraph(
  template: ScenarioTemplate,
  source: LegacyTemplateSource,
  now = Date.now(),
): ScenarioGraph {
  if (template.rounds.length === 0) {
    throw new Error("Dit legacy-template bevat geen rondes en kan niet als scenario worden geïmporteerd.")
  }

  const plan: WizardPlan = {
    name: template.name.trim() || template.operationName.trim() || "Geïmporteerd scenario",
    scenarioType: scenarioTypeFor(template),
    rounds: template.rounds.map((round, roundIndex) => ({
      title: round.title.trim() || `Ronde ${roundIndex + 1}`,
      situation: round.situationUpdateTemplate.trim() || "Situatie nog uit te werken.",
      timerMinutes: round.timerMinutes,
      roleActions: round.roleActions,
      injects: round.injects.map(inject => ({
        id: inject.id,
        type: inject.type,
        channel: inject.channel,
        urgency: inject.urgency,
        title: inject.title?.trim() || "Bericht zonder titel",
        content: inject.content?.trim() || plainText(inject.htmlContent) || inject.title?.trim() || "Inhoud nog uit te werken.",
        senderName: inject.senderName,
        senderHandle: inject.senderHandle,
        targetTeam: inject.targetTeam,
        nis2Relevant: inject.nis2Relevant,
        facilitatorNote: [inject.showNotes, inject.context].filter(Boolean).join("\n\n") || undefined,
      })),
      discussionGoal: round.facilitatorNotes.discussionGoal,
      keyQuestions: round.facilitatorNotes.keyQuestions,
      hints: round.facilitatorNotes.hints,
      expectedDecisions: round.facilitatorNotes.expectedDecisions,
      redFlags: round.facilitatorNotes.redFlags,
      facilitatorPerspective: round.facilitatorNotes.debriefPoints.length > 0
        ? `Debriefpunten:\n${round.facilitatorNotes.debriefPoints.map(point => `- ${point}`).join("\n")}`
        : undefined,
    })),
    decisions: template.rounds.flatMap((round, afterRoundIndex) => {
      const decision = round.decisionPoint
      if (!decision || decision.options.length === 0) return []
      return [{
        afterRoundIndex,
        prompt: [decision.title, decision.description].filter(Boolean).join("\n\n"),
        // A legacy decision was one shared team-lead choice, not a per-role vote.
        perRole: false,
        options: decision.options.map(option => ({
          label: [option.label, option.description, option.consequence].filter(Boolean).join(" — "),
          leadsTo: typeof option.nextRoundIndex === "number"
            && option.nextRoundIndex > afterRoundIndex
            && option.nextRoundIndex < template.rounds.length
            ? `round:${option.nextRoundIndex}`
            : undefined,
        })),
      }]
    }),
    // The legacy good/bad lists were debrief material rather than score-routed
    // graph outcomes. One reachable debrief outcome keeps the imported graph
    // valid while retaining every list in the author-visible narrative.
    outcomes: [{ key: "legacy-debrief", label: "Debrief", narrative: outcomeNarrative(template) }],
    irPlaybook: template.aiSystemPromptAddition,
  }

  const graph = planToGraph(plan, {
    seed: `legacy:${source}:${template.id}`,
    now,
    publishStatus: "draft",
  })

  graph.id = legacyTemplateGraphId(source, template.id)
  // Legacy templates did not provide the structured data these mechanics need.
  // Authors can explicitly enable them after review in the graph builder.
  graph.features = { reliability: false, compliance: false, scoring: false }

  const hasFinalDecision = plan.decisions?.some(decision => decision.afterRoundIndex === plan.rounds.length - 1)
  if (!hasFinalDecision) {
    const finalRound = graph.nodes.filter(node => node.type === "round").at(-1)
    const debrief = graph.nodes.find(node => node.type === "outcome")
    if (finalRound && debrief) {
      graph.edges.push({
        id: `legacy-finish-${graph.id}`,
        source: finalRound.id,
        target: debrief.id,
        type: "sequence",
      })
    }
  }

  return graph
}
