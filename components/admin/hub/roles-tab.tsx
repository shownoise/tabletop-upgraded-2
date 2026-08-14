"use client"

import { ROLE_BRIEFINGS } from "@/lib/config/texts"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"
import { useOverrides, StringField, StringArrayField, SaveBar } from "./override-editor"
import type { RoleOverride } from "@/lib/admin/overrides"

// Rolbeheer: label + team + domein + briefing (mandateSummary + authorities +
// notResponsibleFor + description) per rol. Wijzigingen worden per-rol als
// override opgeslagen. De rol-structuur (welke 8 rollen bestaan) blijft in
// code — nieuwe rollen toevoegen vereist een code-wijziging omdat het datamodel
// (roleActions.allowedRoles, ROLE_META completeness-check) daarop leunt.

export function RolesTab() {
  const { overrides, patch, save, reload, loading, saving, dirty, error } = useOverrides()
  const roleOverrides = overrides.roles ?? {}

  function setField(role: Role, key: keyof RoleOverride, value: string | string[]) {
    patch(prev => {
      const roles = { ...(prev.roles ?? {}) }
      const cur = { ...(roles[role] ?? {}) } as Record<string, unknown>
      cur[key] = value
      roles[role] = cur as RoleOverride
      return { ...prev, roles }
    })
  }
  function revertField(role: Role, key: keyof RoleOverride) {
    patch(prev => {
      const roles = { ...(prev.roles ?? {}) }
      const cur = { ...(roles[role] ?? {}) } as Record<string, unknown>
      delete cur[key]
      if (Object.keys(cur).length === 0) delete roles[role]
      else roles[role] = cur as RoleOverride
      return { ...prev, roles }
    })
  }

  if (loading) return <p className="text-sm text-muted-foreground">Laden…</p>

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Rollen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Briefing per rol — mandaat, bevoegdheden, wat NIET tot de rol behoort. Aanpassen hier
          verandert de rolkaarten en de opening-briefing. Rollen zelf toevoegen/verwijderen vereist een
          code-wijziging (zie <code className="font-mono text-xs">.claude/commands/add-role.md</code>).
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
          Runtime consumeert overrides nog uit code. Opgeslagen wijzigingen zijn zichtbaar in dit paneel maar landen bij een volgende deploy in de app.
        </p>
      </div>

      {ROLE_ORDER.map(role => {
        const meta = ROLE_META[role]
        const briefingDefault = ROLE_BRIEFINGS[role]
        const ov = roleOverrides[role] ?? {}
        return (
          <div key={role} className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{meta.label} <span className="font-mono text-[10px] text-muted-foreground">· {role}</span></h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Team: <span className="font-mono">{meta.team}</span> · Domein: <span className="font-mono">{meta.domain}</span>
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <StringField
                label="Label"
                defaultValue={meta.label}
                value={ov.label}
                onChange={v => setField(role, "label", v)}
                onRevert={() => revertField(role, "label")}
              />
              <StringField
                label="Description"
                hint="Één regel — verschijnt in de facilitator-console"
                defaultValue={briefingDefault.description}
                value={ov.description}
                onChange={v => setField(role, "description", v)}
                onRevert={() => revertField(role, "description")}
              />
              <StringField
                label="Mandate summary"
                hint="Wat deze rol beslist / bewaakt in één zin"
                defaultValue={briefingDefault.mandateSummary}
                value={ov.mandateSummary}
                onChange={v => setField(role, "mandateSummary", v)}
                onRevert={() => revertField(role, "mandateSummary")}
                multiline
              />
              <StringArrayField
                label="Authorities"
                hint="Concrete bevoegdheden — verschijnt op de rolkaart"
                defaultValue={briefingDefault.authorities}
                value={ov.authorities}
                onChange={v => setField(role, "authorities", v)}
                onRevert={() => revertField(role, "authorities")}
              />
              <StringField
                label="Not responsible for"
                hint="Wat NIET van deze rol is — voorkomt scope-creep in de sessie"
                defaultValue={briefingDefault.notResponsibleFor}
                value={ov.notResponsibleFor}
                onChange={v => setField(role, "notResponsibleFor", v)}
                onRevert={() => revertField(role, "notResponsibleFor")}
                multiline
              />
            </div>
          </div>
        )
      })}

      <SaveBar dirty={dirty} saving={saving} error={error} onSave={save} onDiscard={reload} />
    </section>
  )
}
