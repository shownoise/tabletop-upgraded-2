import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { rateLimit } from "@/lib/rate-limit"
import {
  runWizardPipeline,
  WizardPipelineError,
  type LlmMessage,
  type LlmCallOptions,
  type WizardLlm,
} from "@/lib/wizard/pipeline"
import { validateWizardConfig } from "@/lib/wizard/config"
import { parseWizardConfigFromBody } from "@/lib/wizard/parse-config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

// Build the Anthropic-backed LLM callable. The pipeline passes messages + per-
// call options; we map them to Anthropic's Messages API shape. `maxTokens` per
// stage: pipeline geeft zware calls (round=12000, repair=16000) meer headroom
// dan lichte closer-parts (meta/briefings/injects=3000-6000).
function anthropicLlm(apiKey: string): WizardLlm {
  return async (messages: LlmMessage[], options?: LlmCallOptions) => {
    const systemContent = messages.filter(m => m.role === 'system').map(m => m.content).join("\n\n")
    const nonSystem = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))
    const maxTokens = options?.maxTokens ?? 8000
    const stage = options?.stage ?? 'unknown'
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: systemContent || undefined,
        messages: nonSystem,
      }),
    }, 240_000)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Anthropic call failed (${stage}): ${text.slice(0, 400)}`)
    }
    const data = await res.json() as {
      content: Array<{ type: string; text: string }>
      stop_reason?: string
    }
    // Als de output op max_tokens is afgekapt, is de JSON typisch incompleet.
    // Fail hard met leesbare error incl. stage — de user weet dan waar het
    // knelpunt zit (repair-pass is het vaakst de boosdoener bij grote configs).
    if (data.stop_reason === "max_tokens") {
      throw new Error(`LLM output afgekapt op max_tokens in stage '${stage}' (cap: ${maxTokens}). Probeer met minder rondes/rollen/opties.`)
    }
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
  const config = parseWizardConfigFromBody(body)
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
      warnings: result.warnings,
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
