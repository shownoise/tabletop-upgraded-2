"use client"

import { Gavel, Layers, UserCog } from "lucide-react"
import { ROLE_META, type Role } from "@/lib/types"

// Wisselen tussen je rollen, bovenaan het scherm.
//
// Sinds onbezette rollen worden overgenomen draagt een solo-deelnemer al snel
// zes of zeven rollen. Alles van alle rollen door elkaar is dan onleesbaar: 32
// keuze-opties, berichten voor iedereen, zeven mandaten. De eigenaar: "ik wil
// dat als je verschillende rollen hebt dat je bovenaan je rol view kan pakken
// en dat er dan alleen de dingen zichtbaar zijn voor die rol".
//
// `null` betekent: geen filter, alles van al je rollen. Dat blijft bestaan,
// want wie solo speelt wil af en toe het hele beeld.

export const ALLE_ROLLEN = null

export function RoleSwitcher({
  roles,
  active,
  mandated,
  onPick,
}: {
  // Alle rollen die deze deelnemer draagt, geclaimde rol eerst.
  roles: readonly Role[]
  // De rol waarop nu gefilterd wordt, of null voor alles.
  active: Role | null
  // Rollen die op het lopende beslismoment mogen indienen. Leeg zolang er geen
  // beslismoment open staat.
  mandated: readonly Role[]
  onPick: (role: Role | null) => void
}) {
  // Eén rol is geen keuze.
  if (roles.length < 2) return null
  const mandatedSet = new Set(mandated)

  return (
    <section
      data-tour="deelnemer-rolwisselaar"
      className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
          <UserCog className="size-3.5" aria-hidden /> Je bekijkt dit als
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Je draagt {roles.length} rollen
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Wissel van rol">
        {roles.map(role => {
          const isActive = active === role
          const heeftMandaat = mandatedSet.has(role)
          return (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onPick(role)}
              title={heeftMandaat
                ? `${ROLE_META[role]?.label ?? role} — deze rol mag nu indienen`
                : ROLE_META[role]?.label ?? role}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {ROLE_META[role]?.label ?? role}
              {/* Een hamertje bij de rol die nu aan de bak moet, zodat je niet
                  hoeft te raden welke van je rollen een keuze open heeft. */}
              {heeftMandaat && <Gavel className="size-3" aria-hidden />}
            </button>
          )
        })}

        <button
          type="button"
          role="tab"
          aria-selected={active === null}
          onClick={() => onPick(null)}
          title="Alles van al je rollen door elkaar"
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            active === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-dashed border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          <Layers className="size-3" aria-hidden /> Alles
        </button>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        {active === null
          ? "Je ziet nu alles van al je rollen door elkaar. Kies een rol om te filteren."
          : `Berichten, documenten en keuzes van ${ROLE_META[active]?.label ?? active}. Wat je als andere rol al hebt ingediend blijft staan.`}
      </p>
    </section>
  )
}
