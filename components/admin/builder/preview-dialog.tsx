"use client"

import { useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ROLE_META } from "@/lib/types"
import type { Role } from "@/lib/types"
import type { ScenarioGraph } from "@/lib/graph/types"
import { previewRoundForRole, listRoundNodes } from "@/lib/graph/preview"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  graph: ScenarioGraph
}

const ALL_ROLES = Object.keys(ROLE_META) as Role[]

export function PreviewDialog({ open, onOpenChange, graph }: Props) {
  const rounds = useMemo(() => listRoundNodes(graph), [graph])
  const [role, setRole] = useState<Role>("ceo")
  const [roundId, setRoundId] = useState<string | undefined>(rounds[0]?.id)

  const preview = useMemo(
    () => (roundId ? previewRoundForRole(graph, roundId, role) : null),
    [graph, roundId, role],
  )

  const visibleInjects = preview?.injects.filter(i => i.visible) ?? []
  const hiddenInjects = preview?.injects.filter(i => !i.visible) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview — what participants see</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">As role</Label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as Role)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
              >
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Round</Label>
              <select
                value={roundId ?? ""}
                onChange={e => setRoundId(e.target.value || undefined)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
              >
                {rounds.length === 0 && <option value="">No rounds in graph</option>}
                {rounds.map((r, i) => (
                  <option key={r.id} value={r.id}>Round {i + 1} — {r.title}</option>
                ))}
              </select>
            </div>
          </div>

          {preview && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    Situation briefing
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{preview.timerMinutes ?? "?"}m</span>
                </div>
                <h3 className="mt-1 font-semibold">{preview.title || "(untitled)"}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {preview.situation_update || <em className="text-muted-foreground">— No situation update —</em>}
                </p>
              </div>

              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="size-3.5 text-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    Injects visible ({visibleInjects.length})
                  </span>
                </div>
                {visibleInjects.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No injects visible to this role.</p>
                )}
                {visibleInjects.map(({ inject, reason }) => (
                  <div key={inject.id} className="rounded border border-border bg-background px-3 py-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                        {inject.channel ?? inject.type} · {inject.urgency}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">{reason}</span>
                    </div>
                    <div className="font-mono text-xs font-medium">{inject.title}</div>
                    <p className="text-[11px] text-muted-foreground leading-snug whitespace-pre-wrap">{inject.content}</p>
                    {inject.senderName && (
                      <span className="font-mono text-[9px] text-muted-foreground">
                        — {inject.senderName}{inject.senderHandle ? ` (${inject.senderHandle})` : ""}
                      </span>
                    )}
                  </div>
                ))}
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    Role actions available ({preview.roleActions.length})
                  </span>
                </div>
                {preview.roleActions.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No actions available to this role in this round.
                  </p>
                )}
                {preview.roleActions.map(action => (
                  <div key={action.id} className="rounded border border-border bg-background px-3 py-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium">{action.label}</span>
                      <div className="flex gap-1">
                        {action.isRecommended && (
                          <span className="rounded bg-primary/10 border border-primary/30 px-1 py-0.5 font-mono text-[9px] uppercase text-primary">Recommended</span>
                        )}
                        {!action.irPlanAligned && (
                          <span className="rounded bg-destructive/10 border border-destructive/30 px-1 py-0.5 font-mono text-[9px] uppercase text-destructive">Off-plan</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{action.description}</p>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      Allowed roles: {action.allowedRoles.length === 0 ? "any" : action.allowedRoles.join(", ")}
                    </span>
                  </div>
                ))}
              </section>

              {hiddenInjects.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <EyeOff className="size-3.5 text-muted-foreground" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Hidden from this role ({hiddenInjects.length})
                    </span>
                  </div>
                  {hiddenInjects.map(({ inject, reason }) => (
                    <div key={inject.id} className="rounded border border-dashed border-border bg-background/30 px-3 py-2 opacity-60">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-muted-foreground">{inject.title}</span>
                        <span className="font-mono text-[9px] text-muted-foreground">{reason}</span>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}

          {rounds.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Add at least one Round node to preview what participants will see.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
