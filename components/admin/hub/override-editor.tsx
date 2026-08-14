"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { AdminOverrides } from "@/lib/admin/overrides"

// Gedeeld admin-overrides state-model. Iedere tab (config/roles/scoring)
// leest en muteert dezelfde blob. Wijzigingen buffered client-side; expliciet
// opslaan via de save-knop.

interface OverridesResponse { overrides: AdminOverrides }

async function fetchOverrides(): Promise<AdminOverrides> {
  const res = await fetch("/api/admin/overrides")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as OverridesResponse
  return data.overrides ?? {}
}

async function saveOverrides(o: AdminOverrides): Promise<void> {
  const res = await fetch("/api/admin/overrides", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(o),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

// Hook voor gemeenschappelijk state-beheer. Returns overrides + setters +
// save/loading indicators. Elk paneel gebruikt hem.
export function useOverrides() {
  const [overrides, setOverrides] = useState<AdminOverrides>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const o = await fetchOverrides()
      setOverrides(o)
      setDirty(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const patch = useCallback((updater: (prev: AdminOverrides) => AdminOverrides) => {
    setOverrides(prev => {
      const next = updater(prev)
      setDirty(true)
      return next
    })
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await saveOverrides(overrides)
      setDirty(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [overrides])

  return { overrides, patch, save, reload, loading, saving, dirty, error }
}

// ── Field editor primitives ──────────────────────────────────────────

export function StringField({
  label,
  hint,
  defaultValue,
  value,
  onChange,
  onRevert,
  multiline,
}: {
  label: string
  hint?: string
  defaultValue: string
  value: string | undefined
  onChange: (v: string) => void
  onRevert: () => void
  multiline?: boolean
}) {
  const overridden = value !== undefined && value !== defaultValue
  const effective = value ?? defaultValue
  return (
    <div className={`rounded border p-3 ${overridden ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {overridden && (
          <button
            type="button"
            onClick={onRevert}
            className="flex items-center gap-1 font-mono text-[10px] text-amber-700 dark:text-amber-500 hover:underline"
          >
            <RotateCcw className="size-3" /> Terug naar standaard
          </button>
        )}
      </div>
      {multiline ? (
        <Textarea
          value={effective}
          rows={3}
          onChange={e => onChange(e.target.value)}
          className={overridden ? "border-amber-500/40" : undefined}
        />
      ) : (
        <Input
          value={effective}
          onChange={e => onChange(e.target.value)}
          className={overridden ? "border-amber-500/40" : undefined}
        />
      )}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      {overridden && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">Standaard: "{defaultValue}"</p>
      )}
    </div>
  )
}

export function StringArrayField({
  label,
  hint,
  defaultValue,
  value,
  onChange,
  onRevert,
}: {
  label: string
  hint?: string
  defaultValue: readonly string[]
  value: string[] | undefined
  onChange: (v: string[]) => void
  onRevert: () => void
}) {
  const overridden = value !== undefined && JSON.stringify(value) !== JSON.stringify(defaultValue)
  const effective = value ?? [...defaultValue]
  return (
    <div className={`rounded border p-3 ${overridden ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {overridden && (
          <button
            type="button"
            onClick={onRevert}
            className="flex items-center gap-1 font-mono text-[10px] text-amber-700 dark:text-amber-500 hover:underline"
          >
            <RotateCcw className="size-3" /> Terug naar standaard
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {effective.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={e => {
                const next = [...effective]
                next[i] = e.target.value
                onChange(next)
              }}
              className="flex-1"
            />
            <Button
              size="sm" variant="ghost" className="h-8 px-2 hover:text-destructive"
              onClick={() => onChange(effective.filter((_, j) => j !== i))}
            >×</Button>
          </div>
        ))}
        <Button
          size="sm" variant="outline" className="self-start text-xs"
          onClick={() => onChange([...effective, ""])}
        >+ regel</Button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function SaveBar({ dirty, saving, error, onSave, onDiscard }: {
  dirty: boolean
  saving: boolean
  error: string | null
  onSave: () => void
  onDiscard: () => void
}) {
  if (!dirty && !error) return null
  return (
    <div className="sticky bottom-3 z-10 mt-6 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 shadow-md">
      <div className="flex-1 text-xs">
        {error && <span className="text-destructive">Fout: {error}</span>}
        {!error && dirty && <span className="text-primary">Er zijn niet-opgeslagen wijzigingen.</span>}
      </div>
      <Button size="sm" variant="outline" onClick={onDiscard}>Ongedaan maken</Button>
      <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        Opslaan
      </Button>
    </div>
  )
}
