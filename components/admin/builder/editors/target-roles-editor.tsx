"use client"

import { ROLE_META } from "@/lib/types"
import type { Role } from "@/lib/types"

const ALL_ROLES = Object.keys(ROLE_META) as Role[]

interface Props {
  value: Role[] | undefined
  onChange: (next: Role[] | undefined) => void
}

export function TargetRolesEditor({ value, onChange }: Props) {
  const selected = value ?? []

  function toggle(role: Role) {
    const next = selected.includes(role) ? selected.filter(r => r !== role) : [...selected, role]
    onChange(next.length === 0 ? undefined : next)
  }

  return (
    <div className="flex flex-wrap gap-1">
      {ALL_ROLES.map(role => {
        const active = selected.includes(role)
        return (
          <button
            key={role}
            type="button"
            onClick={() => toggle(role)}
            className={`rounded border px-1.5 py-0.5 font-mono text-[9px] transition-colors ${
              active
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            {ROLE_META[role].label}
          </button>
        )
      })}
    </div>
  )
}
