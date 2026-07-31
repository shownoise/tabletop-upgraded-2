"use client"

import { useState } from "react"
import { Users, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Group, SessionState } from "@/lib/types"
import { api } from "@/lib/api-client"

// Deel B §4 — team-selectie voor EVENT-mode. Verschijnt over de play-view
// zolang deelnemer nog geen groepId heeft. Kan bestaande groep joinen of
// nieuwe groep aanmaken (dan meteen zelf lid).

export function TeamPicker({
  session,
  participantId,
  onJoined,
}: {
  session: SessionState
  participantId: string
  onJoined: () => void
}) {
  const [newTeamName, setNewTeamName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groups: Group[] = session.groups ?? []

  async function joinExisting(groupId: string) {
    setBusy(true); setError(null)
    try {
      await api.joinGroup({ participantId, groupId })
      onJoined()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon niet joinen")
    } finally { setBusy(false) }
  }

  async function createAndJoin() {
    const name = newTeamName.trim()
    if (!name) { setError("Geef de groep een naam."); return }
    setBusy(true); setError(null)
    try {
      const { groupId } = await api.createGroup({ name })
      await api.joinGroup({ participantId, groupId })
      onJoined()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon groep niet aanmaken")
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-primary/30 bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <Users className="size-5 text-primary" />
          <h2 className="text-lg font-bold">Kies een team</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          In event-modus speel je met een team. Kies een bestaand team of maak een nieuw team aan.
        </p>

        {groups.length > 0 && (
          <div className="mb-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bestaande teams</div>
            <div className="grid gap-2">
              {groups.map(g => {
                const memberCount = session.participants.filter(p => p.groupId === g.id).length
                return (
                  <button
                    key={g.id}
                    onClick={() => joinExisting(g.id)}
                    disabled={busy}
                    className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-left hover:border-primary/40 disabled:opacity-40"
                  >
                    <span className="font-mono text-sm">{g.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{memberCount} lid{memberCount === 1 ? "" : "en"}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Nieuw team aanmaken</div>
          <div className="flex gap-2">
            <Input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="Bijv. Team Blauw"
              className="flex-1"
              maxLength={50}
              disabled={busy}
            />
            <Button onClick={createAndJoin} disabled={busy || !newTeamName.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Maak
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
