"use client"

import { useMemo, useState } from "react"
import { Loader2, RotateCcw, Save, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DECISION_VECTOR_OVERRIDES } from "@/lib/scoring/vector-overrides"
import { ROLE_META, type Role } from "@/lib/types"
import { useOverrides, SaveBar } from "./override-editor"
import type { OutcomeVector } from "@/lib/scoring/vector-overrides"

// Scoring-tabel per beslissings-optie. De defaults staan in code
// (lib/scoring/vector-overrides.ts). Wijzigingen worden per key
// (`${role}::${label}`) als KV-override opgeslagen. Runtime pikt ze op via
// installAdminOverrides() aan het begin van de scoring-API.

const DIMS = ["CONT", "FOR", "BC", "JUR", "VER", "KOS"] as const
type Dim = typeof DIMS[number]
const DIM_LABEL: Record<Dim, string> = {
  CONT: "Containment", FOR: "Forensics", BC: "Business continuity",
  JUR: "Juridisch",    VER: "Stakeholders", KOS: "Kosten",
}

function parseKey(k: string): { role: string; label: string } {
  const [role, ...rest] = k.split("::")
  return { role, label: rest.join("::") }
}

export function ScoringTab() {
  const { overrides, patch, save, reload, loading, saving, dirty, error } = useOverrides()
  const scoring = overrides.scoring ?? {}
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("")

  const allKeys = useMemo(() => Object.keys(DECISION_VECTOR_OVERRIDES).sort(), [])
  const roles = useMemo(() => {
    const s = new Set<string>()
    for (const k of allKeys) s.add(parseKey(k).role)
    return [...s].sort()
  }, [allKeys])

  const filtered = useMemo(() => {
    return allKeys.filter(k => {
      const { role, label } = parseKey(k)
      if (roleFilter && role !== roleFilter) return false
      if (search && !label.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [allKeys, search, roleFilter])

  function setVec(key: string, next: OutcomeVector) {
    patch(prev => ({ ...prev, scoring: { ...(prev.scoring ?? {}), [key]: next } }))
  }
  function setDim(key: string, dim: Dim, val: number) {
    const cur = scoring[key] ?? DECISION_VECTOR_OVERRIDES[key]
    setVec(key, { ...cur, [dim]: Math.max(-2, Math.min(2, Math.round(val))) })
  }
  function revert(key: string) {
    patch(prev => {
      const next = { ...(prev.scoring ?? {}) }
      delete next[key]
      return { ...prev, scoring: next }
    })
  }

  if (loading) return <p className="text-sm text-muted-foreground">Laden…</p>

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Scoring</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vector-tabel per antwoordoptie. Aanpassen is meteen live — de scoring-engine leest overrides bij elk score-request.
          Waardes van −2 tot +2 per dimensie. De uitleg per dimensie staat in <code className="font-mono text-xs">SCORING.md</code>.
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-2">
          Dit is de sectie waar je overheen kunt: de standaard-waardes zijn met aannames gevuld — pas ze aan zonder code te openen.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek in label…"
            className="h-8 flex-1"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-sm"
        >
          <option value="">Alle rollen</option>
          {roles.map(r => (
            <option key={r} value={r}>{ROLE_META[r as Role]?.label ?? r}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} van {allKeys.length}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-muted-foreground w-24">Rol</th>
              <th className="px-3 py-2 text-left font-mono uppercase tracking-wider text-muted-foreground">Optie</th>
              {DIMS.map(d => (
                <th key={d} className="px-2 py-2 text-center font-mono uppercase tracking-wider text-muted-foreground w-14" title={DIM_LABEL[d]}>{d}</th>
              ))}
              <th className="px-2 py-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(k => {
              const { role, label } = parseKey(k)
              const defaultVec = DECISION_VECTOR_OVERRIDES[k]
              const overrideVec = scoring[k]
              const effective = overrideVec ?? defaultVec
              const overridden = !!overrideVec
              return (
                <tr key={k} className={`border-t border-border ${overridden ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground align-top">{role}</td>
                  <td className="px-3 py-2 align-top">{label}</td>
                  {DIMS.map(d => {
                    const v = effective[d]
                    const dv = defaultVec[d]
                    const changed = overrideVec && v !== dv
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <input
                          type="number"
                          min={-2}
                          max={2}
                          step={1}
                          value={v}
                          onChange={e => setDim(k, d, Number(e.target.value))}
                          className={`w-10 h-7 rounded border text-center font-mono text-xs ${
                            changed
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                              : "border-border bg-background"
                          }`}
                          title={changed ? `Standaard: ${dv}` : DIM_LABEL[d]}
                        />
                      </td>
                    )
                  })}
                  <td className="px-1 py-1 text-center">
                    {overridden && (
                      <button
                        type="button"
                        onClick={() => revert(k)}
                        title="Terug naar standaard"
                        className="text-amber-700 dark:text-amber-500 hover:text-amber-900"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <SaveBar dirty={dirty} saving={saving} error={error} onSave={save} onDiscard={reload} />
    </section>
  )
}
