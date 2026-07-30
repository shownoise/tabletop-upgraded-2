"use client"

import { useState } from "react"
import { CheckCircle, AlertTriangle, Clock, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Role, RoleAction, SubmittedDecision } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { api } from "@/lib/api-client"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"
import { stripMarkdown } from "@/lib/render-markdown"

function stripBobLabel(text: string): string {
  return text
    // [Beeldvorming], [Beeldvorming]: …
    .replace(/^\[(Beeldvorming|Oordeelvorming|Besluit(?:vorming)?)\][:\s]*/i, "")
    // Beeldvorming: …  /  Beeldvorming — …  /  Beeldvorming - …
    .replace(/^(Beeldvorming|Oordeelvorming|Besluit(?:vorming)?)\s*[:\-–—]\s*/i, "")
    .trim()
}

interface Props {
  roundIndex: number
  roundActions: RoleAction[]
  participantId: string
  participantName: string
  participantRole: Role | undefined
  existingDecision?: SubmittedDecision
  lang: Lang
}

export function DecisionPanel({
  roundIndex,
  roundActions,
  participantId,
  participantName,
  participantRole,
  existingDecision,
  lang,
}: Props) {
  const [selectedActionId, setSelectedActionId] = useState<string>(existingDecision?.actionId ?? "")
  const [reasoning, setReasoning] = useState(existingDecision?.reasoning ?? "")
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | undefined>(existingDecision?.confidence)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<SubmittedDecision | null>(existingDecision ?? null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    if (!selectedActionId) { setError("Selecteer een actie."); return }
    setError(null)
    setSubmitting(true)
    try {
      await api.submitDecision({
        participantId,
        participantName,
        roundIndex,
        actionId: selectedActionId,
        reasoning,
        confidence,
      })
      const action = roundActions.find(a => a.id === selectedActionId)
      const isWrongRole = action && participantRole
        ? action.allowedRoles.length > 0 && !action.allowedRoles.includes(participantRole)
        : false
      setSubmitted({
        participantId,
        participantName,
        role: participantRole ?? "it_manager",
        roundIndex,
        actionId: selectedActionId,
        actionLabel: action?.label ?? "",
        reasoning,
        submittedAt: new Date().toISOString(),
        isWrongRole: isWrongRole ?? false,
        isIrDeviation: action ? !action.irPlanAligned : false,
        confidence,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indienen mislukt")
    } finally {
      setSubmitting(false)
    }
  }

  if (!participantRole) {
    return (
      <div className="border border-tt-warn/40 bg-tt-warn/5 p-4"
        style={{ borderLeft: "3px solid var(--tt-warn)" }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="size-4 text-tt-warn" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-tt-warn">Geen rol toegewezen</span>
        </div>
        <p className="font-mono text-xs text-tt-dim">
          Je hebt een rol nodig om beslissingen in te dienen. Neem contact op met de facilitator.
        </p>
      </div>
    )
  }

  return (
    <div
      className="border border-tt-border bg-tt-surface overflow-hidden"
      style={{ borderLeft: "3px solid var(--tt-accent)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-tt-bright/5 border-b border-tt-border">
        <span className="font-mono text-[10px] font-bold tracking-widest text-tt-accent">
          {tr(lang, "decisionPanel")}
        </span>
        <span className="font-mono text-[9px] border border-tt-accent/30 px-2 py-0.5 text-tt-accent">
          {ROLE_META[participantRole].label}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {submitted ? (
          <div className="flex flex-col gap-3">
            <div
              className="flex items-center gap-2 border border-tt-green/30 bg-tt-green/5 px-4 py-3"
              style={{ borderLeft: "3px solid var(--tt-green)" }}
            >
              <CheckCircle className="size-4 text-tt-green shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-tt-green">
                  {tr(lang, "decisionSubmitted")}
                </span>
                <span className="font-mono text-sm text-tt-bright">{stripMarkdown(submitted.actionLabel)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 border border-tt-border bg-tt-bright/5 px-3 py-2.5">
              <Clock className="size-3.5 text-tt-dim shrink-0" />
              <p className="font-mono text-xs text-tt-dim">{tr(lang, "feedbackPending")}</p>
            </div>
            {submitted.reasoning && (
              <p className="font-mono text-xs text-tt-dim italic">"{submitted.reasoning}"</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="self-start font-mono text-xs uppercase tracking-widest border-tt-border text-tt-dim hover:border-tt-accent/40 hover:text-tt-accent"
              onClick={() => { setSubmitted(null); setSelectedActionId(submitted.actionId); setReasoning(submitted.reasoning) }}
            >
              {tr(lang, "updateDecision")}
            </Button>
          </div>
        ) : (
          <>
            {/* Action grid — split by role authorization */}
            {(() => {
              const role = participantRole // narrowed to Role (not undefined — guarded above)
              const myActions = roundActions.filter(a => a.allowedRoles.length === 0 || a.allowedRoles.includes(role))

              function ActionButton({ action }: { action: typeof roundActions[number] }) {
                const isSelected = selectedActionId === action.id
                const authorized = action.allowedRoles.length === 0 || action.allowedRoles.includes(role)
                const ownerLabel = !authorized && action.allowedRoles.length > 0
                  ? action.allowedRoles.slice(0, 2).map(r => ROLE_META[r]?.label ?? r).join(" / ")
                  : null
                return (
                  <button
                    key={action.id}
                    onClick={() => setSelectedActionId(action.id)}
                    className="text-left border px-4 py-3 transition-all"
                    style={{
                      borderColor: isSelected ? "var(--tt-accent)" : authorized ? "var(--tt-border)" : "var(--tt-border)",
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--tt-accent) 5%, transparent)"
                        : authorized
                          ? "color-mix(in srgb, var(--tt-bright) 4%, transparent)"
                          : "transparent",
                      borderLeft: isSelected ? "3px solid var(--tt-accent)" : authorized ? "3px solid var(--tt-border)" : "3px solid transparent",
                      opacity: authorized ? 1 : 0.45,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-mono text-xs font-medium ${authorized ? "text-tt-bright" : "text-tt-dim"}`}>
                            {stripMarkdown(stripBobLabel(action.label))}
                          </span>
                          {ownerLabel && (
                            <span className="font-mono text-[8px] uppercase tracking-widest text-tt-dim border border-tt-border px-1">
                              → {ownerLabel}
                            </span>
                          )}
                        </div>
                        {action.description && (
                          <p className="font-mono text-[10px] text-tt-dim leading-relaxed">
                            {stripMarkdown(stripBobLabel(action.description))}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle className="size-3.5 text-tt-accent shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                )
              }

              return (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
                      {tr(lang, "selectAction")} — {ROLE_META[role].label}
                    </span>
                    {myActions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {myActions.map(action => <ActionButton key={action.id} action={action} />)}
                      </div>
                    ) : (
                      <p className="font-mono text-xs text-tt-dim">
                        Er zijn geen acties voor jouw rol in deze ronde. Draag bij via de discussie.
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Reasoning */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
                {tr(lang, "reasoning")}
              </span>
              <Textarea
                value={reasoning}
                onChange={e => setReasoning(e.target.value)}
                placeholder={tr(lang, "reasoningPlaceholder")}
                rows={2}
                className="resize-none font-mono text-xs bg-tt-bright/5 border-tt-border text-tt-bright placeholder:text-tt-dim focus:border-tt-accent/40"
              />
            </div>

            {/* Confidence — Deel B §7.2 zekerheidstap 1..5 voor KALIBRATIE */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
                Hoe zeker ben je? (optioneel)
              </span>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setConfidence(confidence === v ? undefined : v)}
                    className={`flex-1 rounded border px-2 py-1.5 font-mono text-xs transition-colors ${
                      confidence === v
                        ? "border-tt-accent bg-tt-accent/20 text-tt-accent"
                        : "border-tt-border bg-tt-bright/5 text-tt-dim hover:border-tt-accent/40"
                    }`}
                    aria-label={`Zekerheid ${v} van 5`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[9px] text-tt-dim">
                1 = onzeker · 5 = heel zeker
              </span>
            </div>

            {error && (
              <p className="font-mono text-xs text-tt-red">{error}</p>
            )}

            <Button
              onClick={onSubmit}
              disabled={submitting || !selectedActionId}
              className="gap-2 font-mono text-xs uppercase tracking-widest bg-tt-accent text-tt-bg hover:bg-tt-accent/90 disabled:opacity-40"
            >
              {submitting ? (
                <span className="inline-block size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {tr(lang, "submitDecision")}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
