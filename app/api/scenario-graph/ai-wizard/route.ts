import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { rateLimit } from "@/lib/rate-limit"
import { sanitizeForPrompt, PROMPT_FIELD_CAPS } from "@/lib/scenario/sanitize"
import {
  runWizardPipeline,
  WizardPipelineError,
  type LlmMessage,
  type WizardLlm,
} from "@/lib/wizard/pipeline"
import {
  defaultWizardConfig,
  validateWizardConfig,
  ALL_WIZARD_ROLES,
  SPECIAL_CONDITIONS,
  DEFAULT_REGULATORY_REGIME_ID,
  WIZARD_LIMITS,
  type CompanySize,
  type WizardConfig,
} from "@/lib/wizard/config"
import type { Role } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

// Parse-time coercion: the body is trusted only after we've clamped and
// sanitised every field. Untrusted string fields go through sanitizeForPrompt.
function parseConfigFromBody(body: unknown): WizardConfig {
  const base = defaultWizardConfig()
  if (!body || typeof body !== 'object') return base
  const b = body as Record<string, unknown>

  const clientName    = sanitizeForPrompt(typeof b.clientName === 'string' ? b.clientName : "", 200) || ""
  const sector        = sanitizeForPrompt(typeof b.sector === 'string' ? b.sector : "", PROMPT_FIELD_CAPS.sector) || ""
  const itArrangement = sanitizeForPrompt(typeof b.itArrangement === 'string' ? b.itArrangement : "", 400) || ""
  const importantContext = typeof b.importantContext === 'string'
    ? (sanitizeForPrompt(b.importantContext, 2000) || undefined)
    : undefined

  const companySize: CompanySize = (['small', 'mkbplus', 'enterprise'] as const).includes(b.companySize as CompanySize)
    ? (b.companySize as CompanySize)
    : base.companySize

  const clamp = (v: unknown, min: number, max: number, dflt: number) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return dflt
    return Math.max(min, Math.min(max, n))
  }

  const rounds = clamp(b.rounds, WIZARD_LIMITS.rounds.min, WIZARD_LIMITS.rounds.max, base.rounds)
  const injectsPerRound = clamp(b.injectsPerRound, WIZARD_LIMITS.injectsPerRound.min, WIZARD_LIMITS.injectsPerRound.max, base.injectsPerRound)
  const optionsPerRolePerRound = clamp(b.optionsPerRolePerRound, WIZARD_LIMITS.optionsPerRolePerRound.min, WIZARD_LIMITS.optionsPerRolePerRound.max, base.optionsPerRolePerRound)
  const factsNoiseRatio = clamp(b.factsNoiseRatio, 0, 1, base.factsNoiseRatio)

  const rolesIncluded: Role[] = Array.isArray(b.rolesIncluded)
    ? (b.rolesIncluded.filter((r): r is Role => (ALL_WIZARD_ROLES as readonly string[]).includes(r as string)))
    : base.rolesIncluded

  const regulatoryRegimeId = typeof b.regulatoryRegimeId === 'string' && b.regulatoryRegimeId
    ? b.regulatoryRegimeId
    : DEFAULT_REGULATORY_REGIME_ID

  const knownIds = new Set(SPECIAL_CONDITIONS.map(s => s.id))
  const specialConditions: string[] = Array.isArray(b.specialConditions)
    ? b.specialConditions.filter((s): s is string => typeof s === 'string' && knownIds.has(s))
    : []

  const seed = typeof b.seed === 'string' && b.seed.trim().length > 0 ? b.seed.trim().slice(0, 64) : undefined

  return {
    clientName,
    sector,
    companySize,
    itArrangement,
    importantContext,
    rounds,
    injectsPerRound,
    optionsPerRolePerRound,
    factsNoiseRatio,
    rolesIncluded: rolesIncluded.length > 0 ? rolesIncluded : base.rolesIncluded,
    regulatoryRegimeId,
    specialConditions,
    seed,
  }
}

// Build the Anthropic-backed LLM callable. The pipeline passes messages; we
// map them to Anthropic's Messages API shape.
function anthropicLlm(apiKey: string): WizardLlm {
  return async (messages: LlmMessage[]) => {
    const systemContent = messages.filter(m => m.role === 'system').map(m => m.content).join("\n\n")
    const nonSystem = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Sonnet 4.6: betrouwbaar voor structured JSON. Snelheidswinst uit
        // parallel rondes + parallel closer.
        // max_tokens 12000 was overkill: Sonnet-output ~60-80 tokens/sec,
        // dus 12000 tokens = tot 200s per call. Onze JSON is 500-4000 tokens.
        // 6000 is ruim genoeg voor de closer (8 rollen × briefing + outcomes +
        // injectLibrary) en 2× sneller worst case dan 12000.
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        system: systemContent || undefined,
        messages: nonSystem,
      }),
    }, 240_000)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Anthropic call failed: ${text.slice(0, 400)}`)
    }
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    return data.content?.find(b => b.type === "text")?.text ?? ""
  }
}

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const userId = (gate.session?.user as { id?: string } | undefined)?.id ?? "unknown"
  const rl = await rateLimit(`ai:${userId}`, 10, 60)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many AI requests. Please wait a minute." }, {
      status: 429,
      headers: { "Retry-After": String(rl.resetSeconds) },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const config = parseConfigFromBody(body)
  const errs = validateWizardConfig(config)
  if (errs.length > 0) {
    return NextResponse.json({ error: `Config invalid: ${errs.join("; ")}` }, { status: 400 })
  }

  try {
    const result = await runWizardPipeline(config, {
      llm: anthropicLlm(apiKey),
      // Was 3. In praktijk fixt de eerste repair-pass ~90%; extra passes
      // kosten elk 30-60s zonder veel extra opbrengst. Als er na 1 pass
      // nog schendingen zijn: user krijgt een leesbare fout met de lijst
      // schendingen en kan ze in de builder repareren.
      maxRepairAttempts: 1,
    })
    return NextResponse.json({
      ok: true,
      graph: result.graph,
      seed: result.seed,
      repairLog: result.repairLog,
    })
  } catch (err) {
    if (err instanceof WizardPipelineError) {
      return NextResponse.json({
        error: err.message,
        seed: err.seed,
        failures: err.failures,
        repairLog: err.repairLog,
      }, { status: 502 })
    }
    const { randomBytes } = await import("crypto")
    const requestId = randomBytes(4).toString("hex")
    console.error(`[ai-wizard] pipeline failed (${requestId}):`, err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Wizard pipeline failed (ref: ${requestId}): ${message.slice(0, 400)}` }, { status: 502 })
  }
}
