"use client"

import { useMemo, useState } from "react"
import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Role, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { TeamId } from "@/lib/team-roster"
import { getInjectRecipients } from "@/lib/inject-routing"

interface Props {
  session: SessionState
  teamRoles: Record<TeamId, Role[]>
  onReplot: () => Promise<void>
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function nameFor(session: SessionState, role: Role): string {
  const p = session.participants.find(pp => pp.role === role)
  return p ? `${p.name} (${ROLE_META[role].label})` : ROLE_META[role].label
}

export function InjectRoutePlan({ session, teamRoles, onReplot }: Props) {
  const [busy, setBusy] = useState(false)
  const plan = session.injectRoutePlan
  const version = plan?.version ?? 0
  const plottedAt = plan?.plottedAt ?? session.startedAt ?? Date.now()

  const rows = useMemo(() => {
    const out: Array<{
      injectId: string
      title: string
      round: number
      recipients: Role[]
      status: "planned" | "delivered" | "manually_pushed"
      hasDeviation: boolean
    }> = []
    const pushedById = new Map(session.pushedInjects.map(p => [p.inject.id, p]))
    session.scenario.rounds.forEach((r, ri) => {
      for (const inj of r.injects) {
        const recipients = getInjectRecipients(inj, session, teamRoles)
        const pushed = pushedById.get(inj.id)
        let status: "planned" | "delivered" | "manually_pushed" = "planned"
        let hasDeviation = false
        if (pushed) {
          status = pushed.pushedAt <= Date.now() ? "delivered" : "planned"
          if (pushed.roundIndex !== ri) hasDeviation = true
        }
        out.push({
          injectId: inj.id,
          title: inj.title || "(zonder titel)",
          round: ri + 1,
          recipients,
          status: hasDeviation ? "manually_pushed" : status,
          hasDeviation,
        })
      }
    })
    return out
  }, [session, teamRoles])

  async function handleReplot() {
    setBusy(true)
    try { await onReplot() } finally { setBusy(false) }
  }

  if (!plan && rows.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Verdeling injects</span>
          {plan && (
            <span className="font-mono text-[10px] text-muted-foreground">
              versie {version}, geplot om {fmtTime(plottedAt)}
            </span>
          )}
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {rows.length} injects
        </Badge>
      </header>

      <div className="max-h-72 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            Nog geen injects gepland
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Inject</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ontvanger(s)</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.injectId} className="border-b border-border/40">
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] text-primary">R{row.round}</span>
                      <span className="text-xs leading-snug">{row.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.recipients.length === 0 ? (
                      <span className="font-mono text-[10px] text-muted-foreground">—</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {row.recipients.map(r => (
                          <li key={r} className="font-mono text-[10px]">{nameFor(session, r)}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.status === "delivered" && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/5 font-mono text-[10px] text-primary">Bezorgd</Badge>
                    )}
                    {row.status === "planned" && (
                      <Badge variant="outline" className="border-muted-foreground/30 font-mono text-[10px] text-muted-foreground">Ingepland</Badge>
                    )}
                    {row.status === "manually_pushed" && (
                      <Badge variant="outline" className="border-amber-400/50 bg-amber-500/5 font-mono text-[10px] text-amber-600 dark:text-amber-400">Ingepland (afwijkend gepusht)</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          onClick={handleReplot}
          disabled={busy}
          className="gap-2 font-mono uppercase tracking-wider text-[10px]"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Herverdelen op basis van huidige lobby
        </Button>
      </div>
    </div>
  )
}
