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
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  if (!participantRole) {
    return (
      <div className="border border-[#ffb340]/40 bg-[#ffb340]/5 p-4"
        style={{ borderLeft: "3px solid #ffb340" }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="size-4 text-[#ffb340]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#ffb340]">No Role Assigned</span>
        </div>
        <p className="font-mono text-xs text-[#7a9090]">
          You need a role assigned to submit decisions. Contact your facilitator.
        </p>
      </div>
    )
  }

  return (
    <div
      className="border border-[#2a3030] bg-[#111618] overflow-hidden"
      style={{ borderLeft: "3px solid #e8ff40" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/25 border-b border-[#2a3030]">
        <span className="font-mono text-[10px] font-bold tracking-widest text-[#e8ff40]">
          {tr(lang, "decisionPanel")}
        </span>
        <span className="font-mono text-[9px] border border-[#e8ff40]/30 px-2 py-0.5 text-[#e8ff40]">
          {ROLE_META[participantRole].label}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {submitted ? (
          <div className="flex flex-col gap-3">
            <div
              className="flex items-center gap-2 border border-[#40ffb3]/30 bg-[#40ffb3]/5 px-4 py-3"
              style={{ borderLeft: "3px solid #40ffb3" }}
            >
              <CheckCircle className="size-4 text-[#40ffb3] shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#40ffb3]">
                  {tr(lang, "decisionSubmitted")}
                </span>
                <span className="font-mono text-sm text-[#f0fafa]">{submitted.actionLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 border border-[#2a3030] bg-black/20 px-3 py-2.5">
              <Clock className="size-3.5 text-[#7a9090] shrink-0" />
              <p className="font-mono text-xs text-[#7a9090]">{tr(lang, "feedbackPending")}</p>
            </div>
            {submitted.reasoning && (
              <p className="font-mono text-xs text-[#7a9090] italic">"{submitted.reasoning}"</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="self-start font-mono text-xs uppercase tracking-widest border-[#2a3030] text-[#7a9090] hover:border-[#e8ff40]/40 hover:text-[#e8ff40]"
              onClick={() => { setSubmitted(null); setSelectedActionId(submitted.actionId); setReasoning(submitted.reasoning) }}
            >
              {tr(lang, "updateDecision")}
            </Button>
          </div>
        ) : (
          <>
            {/* Action grid — 2 columns */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">
                {tr(lang, "selectAction")}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roundActions.map(action => {
                  const authorized = action.allowedRoles.length === 0 || action.allowedRoles.includes(participantRole)
                  const isSelected = selectedActionId === action.id
                  return (
                    <button
                      key={action.id}
                      onClick={() => setSelectedActionId(action.id)}
                      className="text-left border px-4 py-3 transition-all"
                      style={{
                        borderColor: isSelected ? "#e8ff40" : "#2a3030",
                        backgroundColor: isSelected ? "rgba(232,255,64,0.05)" : "rgba(0,0,0,0.2)",
                        borderLeft: isSelected ? "3px solid #e8ff40" : "3px solid #2a3030",
                        opacity: authorized ? 1 : 0.5,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-medium text-[#f0fafa]">
                              {action.label}
                            </span>
                            {!authorized && (
                              <span className="font-mono text-[8px] uppercase tracking-widest text-[#7a9090] border border-[#2a3030] px-1">
                                {tr(lang, "actionUnauthorized")}
                              </span>
                            )}
                          </div>
                          {action.description && (
                            <p className="font-mono text-[10px] text-[#7a9090] leading-relaxed">
                              {action.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <CheckCircle className="size-3.5 text-[#e8ff40] shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reasoning */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">
                {tr(lang, "reasoning")}
              </span>
              <Textarea
                value={reasoning}
                onChange={e => setReasoning(e.target.value)}
                placeholder={tr(lang, "reasoningPlaceholder")}
                rows={2}
                className="resize-none font-mono text-xs bg-black/20 border-[#2a3030] text-[#f0fafa] placeholder:text-[#7a9090] focus:border-[#e8ff40]/40"
              />
            </div>

            {error && (
              <p className="font-mono text-xs text-[#ff4d3d]">{error}</p>
            )}

            <Button
              onClick={onSubmit}
              disabled={submitting || !selectedActionId}
              className="gap-2 font-mono text-xs uppercase tracking-widest bg-[#e8ff40] text-[#0d0f0f] hover:bg-[#e8ff40]/90 disabled:opacity-40"
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
