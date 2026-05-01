"use client"

import { useState } from "react"
import { CheckCircle, AlertTriangle, AlertCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Role, RoleAction, SubmittedDecision } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { api } from "@/lib/api-client"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

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
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<SubmittedDecision | null>(existingDecision ?? null)
  const [error, setError] = useState<string | null>(null)

  const selectedAction = roundActions.find(a => a.id === selectedActionId)
  const isWrongRole = selectedAction && participantRole
    ? selectedAction.allowedRoles.length > 0 && !selectedAction.allowedRoles.includes(participantRole)
    : false
  const isIrDeviation = selectedAction ? !selectedAction.irPlanAligned : false

  async function onSubmit() {
    if (!selectedActionId) { setError("Please select an action."); return }
    setError(null)
    setSubmitting(true)
    try {
      await api.submitDecision({
        participantId,
        participantName,
        roundIndex,
        actionId: selectedActionId,
        reasoning,
      })
      const action = roundActions.find(a => a.id === selectedActionId)
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
        isIrDeviation: isIrDeviation,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  if (!participantRole) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <span className="font-mono text-xs uppercase tracking-wider text-amber-600">No Role Assigned</span>
        </div>
        <p className="text-sm text-muted-foreground">
          You need a role assigned to submit decisions. Contact your facilitator.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-primary">{tr(lang, "decisionPanel")}</span>
        {participantRole && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            {ROLE_META[participantRole].label}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {submitted ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <CheckCircle className="size-4 text-primary shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-primary uppercase tracking-wider">{tr(lang, "decisionSubmitted")}</span>
                <span className="text-sm font-medium">{submitted.actionLabel}</span>
              </div>
            </div>
            {(submitted.isWrongRole || submitted.isIrDeviation) && (
              <div className="flex flex-wrap gap-2">
                {submitted.isWrongRole && (
                  <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-600">
                    {tr(lang, "wrongRoleBadge")}
                  </span>
                )}
                {submitted.isIrDeviation && (
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-destructive">
                    {tr(lang, "irDeviationBadge")}
                  </span>
                )}
              </div>
            )}
            {submitted.reasoning && (
              <p className="text-xs text-muted-foreground italic">"{submitted.reasoning}"</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="self-start font-mono uppercase tracking-wider"
              onClick={() => { setSubmitted(null); setSelectedActionId(submitted.actionId); setReasoning(submitted.reasoning) }}
            >
              {tr(lang, "updateDecision")}
            </Button>
          </div>
        ) : (
          <>
            {/* Action list */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "selectAction")}</span>
              {roundActions.map(action => {
                const authorized = action.allowedRoles.length === 0 || action.allowedRoles.includes(participantRole)
                const irOk = action.irPlanAligned
                const isSelected = selectedActionId === action.id
                return (
                  <button
                    key={action.id}
                    onClick={() => setSelectedActionId(action.id)}
                    className={`text-left rounded-lg border px-4 py-3 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : authorized
                        ? "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                        : "border-border bg-card/50 opacity-70 hover:border-orange-500/40 hover:bg-orange-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${authorized ? "text-foreground" : "text-muted-foreground"}`}>
                            {action.label}
                          </span>
                          {action.isRecommended && (
                            <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-primary">
                              Recommended
                            </span>
                          )}
                          {!authorized && (
                            <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-orange-600">
                              {tr(lang, "actionUnauthorized")}
                            </span>
                          )}
                          {!irOk && (
                            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-destructive">
                              IR Deviation
                            </span>
                          )}
                        </div>
                        {action.description && (
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        )}
                      </div>
                      {isSelected && <CheckCircle className="size-4 text-primary shrink-0 mt-0.5" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Warnings */}
            {selectedAction && (isWrongRole || isIrDeviation) && (
              <div className="flex flex-col gap-2">
                {isWrongRole && (
                  <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
                    <AlertTriangle className="size-3.5 text-orange-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-700 dark:text-orange-400">{tr(lang, "actionWarning")}</p>
                  </div>
                )}
                {isIrDeviation && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                    <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">
                      {tr(lang, "irDeviationWarning")}
                      {selectedAction.consequence && ` ${selectedAction.consequence}`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Reasoning */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "reasoning")}</span>
              <Textarea
                value={reasoning}
                onChange={e => setReasoning(e.target.value)}
                placeholder={tr(lang, "reasoningPlaceholder")}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <Button
              onClick={onSubmit}
              disabled={submitting || !selectedActionId}
              className="gap-2 font-mono uppercase tracking-wider"
            >
              {submitting ? (
                <span className="animate-spin inline-block size-4 border-2 border-current border-t-transparent rounded-full" />
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
