"use client"

import type { GovernanceFlag, Participant, RoleAction, SubmittedDecision } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

interface Props {
  decisions: SubmittedDecision[]
  flags: GovernanceFlag[]
  participants: Participant[]
  roundActions: RoleAction[]
  lang: Lang
}

export function DecisionsView({ decisions, flags, participants, roundActions, lang }: Props) {
  const technicalTeam = participants.filter(p => p.role && ROLE_META[p.role]?.team === "technical_it")
  const crisisTeam = participants.filter(p => p.role && ROLE_META[p.role]?.team === "crisis_management")
  const unassigned = participants.filter(p => !p.role)

  const submitted = decisions.length
  const total = participants.length

  function getDecision(participantId: string): SubmittedDecision | undefined {
    return decisions.find(d => d.participantId === participantId)
  }

  function getFlags(participantId: string): GovernanceFlag[] {
    return flags.filter(f => f.participantId === participantId)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {tr(lang, "submittedDecisions")}
        </span>
        <span className="font-mono text-xs text-foreground">
          {tr(lang, "decidedOf", { n: String(submitted), total: String(total) })}
        </span>
      </div>

      {decisions.length === 0 ? (
        <p className="text-center py-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {tr(lang, "noDecisionYet")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <TeamSection
            label={tr(lang, "team_technical_it")}
            participants={technicalTeam}
            getDecision={getDecision}
            getFlags={getFlags}
            lang={lang}
          />
          <TeamSection
            label={tr(lang, "team_crisis_management")}
            participants={crisisTeam}
            getDecision={getDecision}
            getFlags={getFlags}
            lang={lang}
          />
          {unassigned.length > 0 && (
            <TeamSection
              label="No team assigned"
              participants={unassigned}
              getDecision={getDecision}
              getFlags={getFlags}
              lang={lang}
            />
          )}
        </div>
      )}
    </div>
  )
}

function TeamSection({
  label,
  participants,
  getDecision,
  getFlags,
  lang,
}: {
  label: string
  participants: Participant[]
  getDecision: (id: string) => SubmittedDecision | undefined
  getFlags: (id: string) => GovernanceFlag[]
  lang: Lang
}) {
  if (participants.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/50">
              <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Participant</th>
              <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Role</th>
              <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Action</th>
              <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Reasoning</th>
              <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {participants.map(p => {
              const decision = getDecision(p.id)
              const pFlags = getFlags(p.id)
              return (
                <tr key={p.id} className={`${pFlags.length > 0 ? "bg-destructive/5" : ""}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-5 rounded-full border border-border bg-background font-mono text-[8px] uppercase text-muted-foreground flex items-center justify-center shrink-0">
                        {p.name.slice(0, 2)}
                      </div>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {p.role ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                        {ROLE_META[p.role].label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {decision ? (
                      <span className="text-sm">{decision.actionLabel}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    {decision?.reasoning ? (
                      <span className="text-xs text-muted-foreground line-clamp-2">{decision.reasoning}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {pFlags.map(f => (
                        <span
                          key={f.id}
                          className={`rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${
                            f.type === "wrong_role"
                              ? "border-orange-500/40 bg-orange-500/10 text-orange-600"
                              : "border-destructive/40 bg-destructive/10 text-destructive"
                          }`}
                        >
                          {f.type === "wrong_role" ? tr(lang, "wrongRoleBadge") : tr(lang, "irDeviationBadge")}
                        </span>
                      ))}
                      {pFlags.length === 0 && decision && (
                        <span className="text-xs text-primary">✓</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
