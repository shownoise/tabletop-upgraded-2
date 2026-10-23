"use client"

import { Users, CheckCircle2, Circle } from "lucide-react"
import type { DecisionNodeData } from "@/lib/graph/types"
import type { Role, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { formatTime } from "@/lib/format"
import { allParticipantRoles, roleCoverage, decisionMandate } from "@/lib/session-roles"
import { currentDecisionNode } from "@/lib/session-next-action"

// De facilitator keek hier naar `participant.role` en zag dus alleen de rol die
// iemand zelf claimde (#105 §5). Een deelnemer die drie onbezette stoelen had
// overgenomen was niet te onderscheiden van iemand met één rol, en een rol die
// niemand dekte was hier onzichtbaar — terwijl juist die rol de ronde ophoudt
// of stil als "geen besluit" wordt afgesloten. Alles komt nu uit
// `lib/session-roles.ts`, dezelfde bron als de deelnemersconsole.

function label(role: Role): string {
  return ROLE_META[role]?.label ?? role
}

export function ParticipantsList({ session }: { session: SessionState }) {
  const list = [...session.participants].sort((a, b) => b.joinedAt - a.joinedAt)
  const rolesById = new Map(allParticipantRoles(session).map(r => [r.participantId, r]))
  const unoccupied = roleCoverage(session).filter(c => c.status === 'onbezet')

  // Mandaat hangt aan het actuele beslispunt, niet aan de sessie: een rol die nu
  // geen keuze bezit heeft nu ook geen mandaat. Staat er geen beslispunt open,
  // dan markeren we niets — beter niets dan een misleidende "geen mandaat".
  const node = currentDecisionNode(session)
  const decision = node?.type === 'decision' ? (node.data as DecisionNodeData) : undefined
  const mandateById = new Map<string, Set<Role>>()
  if (decision) {
    for (const p of session.participants) {
      mandateById.set(p.id, new Set(decisionMandate(session, decision, p.id).myRoles))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3 md:px-6">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Deelnemers</span>
        <span className="font-mono text-xs text-foreground">{session.participants.length}</span>
      </header>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center md:px-6">
          <Users className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nog geen deelnemers</p>
          <p className="font-mono text-xs text-muted-foreground">
            Deel code{" "}
            <span className="text-primary">{session.joinCode}</span>
          </p>
        </div>
      ) : (
        <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
          {list.map((p) => {
            const roles = rolesById.get(p.id)
            const mandated = mandateById.get(p.id)
            return (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 px-5 py-3 md:px-6 animate-fade-in"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-xs uppercase text-muted-foreground">
                    {p.name.slice(0, 2)}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      aangesloten {formatTime(p.joinedAt)}
                    </span>
                    {roles && roles.all.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {roles.all.map((r) => {
                          const inherited = r !== roles.primary
                          const hasMandate = mandated?.has(r)
                          return (
                            <span
                              key={r}
                              title={inherited
                                ? `${label(r)} is door niemand geclaimd; ${p.name} speelt die rol erbij`
                                : `${label(r)} is de eigen rol van ${p.name}`}
                              className={inherited
                                ? "rounded-full border border-dashed border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                                : "rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary"}
                            >
                              {label(r)}
                              {inherited ? " · overgenomen" : ""}
                              {hasMandate ? " · mandaat" : ""}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        geen rol
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  {p.readyAt ? (
                    <CheckCircle2 className="size-3.5 text-primary" aria-label="Gereed" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground" aria-label="Nog niet gereed" />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {list.length > 0 && (
        <div className="border-t border-border px-5 py-3 md:px-6">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Onbezette rollen
          </span>
          {unoccupied.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Geen. Elke rol die dit scenario gebruikt wordt gespeeld of overgenomen.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-foreground">
                {unoccupied.map(c => c.label).join(", ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Niemand dekt {unoccupied.length === 1 ? "deze rol" : "deze rollen"}; keuzes van{" "}
                {unoccupied.length === 1 ? "deze rol" : "deze rollen"} worden als &quot;geen besluit&quot;
                afgesloten en houden de ronde niet tegen.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
