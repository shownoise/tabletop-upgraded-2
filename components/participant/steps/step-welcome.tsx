"use client"

import { useState } from "react"
import { CheckCircle, ChevronDown, ChevronRight, FileText, Gavel, Loader2, ShieldCheck, Users } from "lucide-react"
import { ROLE_META, ROLE_ORDER, type Role, type SessionState } from "@/lib/types"
import { roleCoverage } from "@/lib/session-roles"
import { DocumentsSheet, documentsForRoles } from "./documents-sheet"
import { api } from "@/lib/api-client"
import { OpeningBriefing } from "../opening-briefing"
import type { ActiveRoleView } from "./active-role"

// Stap 1 — wie je bent en wat je mag besluiten.
//
// Alles op dit scherm komt uit de serverstate via `activeRoleView()`. De
// rolkeuze zit hier, en niet achter een klaarmeld-knop: je kon je eerst
// klaarmelden en daarna pas een rol kiezen, waardoor een heel team "klaar" las
// terwijl niemand een stoel had (issue #105 §1).

// Crisisrollen zonder de IT-lead, in dezelfde volgorde als ROLE_ORDER zodat de
// lobby, de builder en het setupformulier dezelfde rij tonen.
const CRISIS_ROLES_ORDERED: readonly Role[] = ROLE_ORDER.filter(r => r !== "it_manager")

function RolePicker({
  session,
  participantId,
  myRole,
}: {
  session: SessionState
  participantId: string
  myRole?: Role
}) {
  const [claiming, setClaiming] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)

  const takenRoles = new Map<Role, string>()
  for (const p of session.participants) if (p.role) takenRoles.set(p.role, p.name)

  async function claimRole(role: Role) {
    if (claiming) return
    setClaiming(role)
    setError(null)
    try {
      let joinCode: string | undefined
      try { joinCode = localStorage.getItem("ctt:joinCode") ?? undefined } catch { /* noop */ }
      await api.assignRole({ participantId, role, joinCode })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rol claimen mislukt")
    } finally {
      setClaiming(null)
    }
  }

  const allowedRoles: readonly Role[] = (session.config.selectedRoles?.length ?? 0) > 0
    ? ROLE_ORDER.filter(r => session.config.selectedRoles!.includes(r))
    : CRISIS_ROLES_ORDERED

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
          <Users className="size-3.5" aria-hidden /> Kies je rol
        </span>
        <p className="text-xs text-muted-foreground">
          Elke rol wordt door één deelnemer gedragen. Zodra je kiest weet de facilitator wie aan tafel zit.
        </p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {allowedRoles.map(role => {
          const meta = ROLE_META[role]
          const takenBy = takenRoles.get(role)
          const isMine = myRole === role
          const isTaken = !!takenBy && !isMine
          const isClaiming = claiming === role
          return (
            <button
              key={role}
              type="button"
              onClick={() => !isTaken && !isMine && claimRole(role)}
              disabled={isTaken || !!claiming}
              className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                isMine
                  ? "border-primary bg-primary/10"
                  : isTaken
                    ? "border-border bg-card/30 opacity-50"
                    : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {isClaiming ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
              ) : isMine ? (
                <CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <span className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${isTaken ? "border-border" : "border-primary/40"}`} />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`font-mono text-sm ${isMine ? "text-primary" : isTaken ? "text-muted-foreground" : "text-foreground"}`}>
                  {meta.label}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">{meta.mandateSummary}</span>
                {isTaken && (
                  <span className="font-mono text-[10px] text-muted-foreground">Geclaimd door {takenBy}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function MandateCard({ role, isInherited }: { role: Role; isInherited: boolean }) {
  const meta = ROLE_META[role]
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-semibold text-foreground">{meta.label}</span>
        <span className="rounded-full border border-primary/40 px-2 py-px font-mono text-[9px] uppercase tracking-wider text-primary">
          {isInherited ? "overgenomen rol" : "jouw rol"}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{meta.mandateSummary}</p>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Dit mag je besluiten
        </span>
        <ul className="flex flex-col gap-1">
          {meta.authorities.map((a, i) => (
            <li key={i} className="flex gap-2 text-xs text-foreground">
              <span className="shrink-0 text-primary">✓</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Dit expliciet niet
        </span>
        <p className="text-xs text-muted-foreground">{meta.notResponsibleFor}</p>
      </div>
    </section>
  )
}

// Het blok "Dit is jullie organisatie" toonde live Financial Services / ERP /
// Customer PII bij een onderwijsvereniging: onware feiten voor de deelnemer
// (issue #105 §4). Een sessie met een echte klant erachter heeft
// `config.adminClientId`; zonder dat zijn deze velden wizard-defaults en laten
// we het blok helemaal weg in plaats van iets te verzinnen.
function OrganisationFacts({ session }: { session: SessionState }) {
  const cfg = session.config
  if (!cfg.adminClientId) return null
  const rows: Array<[string, string]> = []
  if (cfg.sector) rows.push(["Sector", cfg.sector])
  if (cfg.companySize) rows.push(["Omvang", `${cfg.companySize} medewerkers`])
  if (cfg.criticalSystems) rows.push(["Kritieke systemen", cfg.criticalSystems])
  if (cfg.crownJewels) rows.push(["Kroonjuwelen", cfg.crownJewels])
  if (rows.length === 0) return null

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        Dit is jullie organisatie{cfg.adminClientName ? ` — ${cfg.adminClientName}` : ""}
      </span>
      <dl className="flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</dt>
            <dd className="text-xs text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// Wie zit er aan tafel, en welke rol draagt niemand. Komt uit `roleCoverage()`,
// dezelfde bron als de deelnemerslijst van de facilitator — die twee spraken
// elkaar tegen (issue #105 §1).
function Table({ session, mine }: { session: SessionState; mine: Role[] }) {
  const coverage = roleCoverage(session)
  if (coverage.length === 0) return null
  const mineSet = new Set(mine)

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        Aan tafel
      </span>
      <ul className="flex flex-col gap-1">
        {coverage.map(c => (
          <li key={c.role} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className={`font-medium ${mineSet.has(c.role) ? "text-primary" : "text-foreground"}`}>
              {c.label}
            </span>
            {c.status === "onbezet" ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                niemand
              </span>
            ) : (
              <span className="text-muted-foreground">
                {c.participantName}
                {c.status === "overgenomen" ? " (erbij genomen)" : ""}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// De documenten van je eigen rol. Stonden in een zijkolom die op elke fase mee
// scrolde; ze horen bij wie je bent, dus staan ze op deze stap.
function MyDocuments({ session, roles }: { session: SessionState; roles: Role[] }) {
  // Eén implementatie: de lijst zit in DocumentsSheet, die ook vanuit het
  // stapmenu en vanaf het keuzescherm opent. Hier stond een tweede, eigen
  // uitklaplijst met dezelfde inhoud.
  const docs = documentsForRoles(session, roles)
  if (docs.length === 0) return null
  return (
    <DocumentsSheet
      session={session}
      roles={roles}
      trigger={
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
        >
          <FileText className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Jouw documenten</span>
            <span className="block text-xs text-muted-foreground">
              {docs.length} {docs.length === 1 ? "document" : "documenten"} — polis, protocol, draaiboek. Ook te openen tijdens de keuze.
            </span>
          </span>
        </button>
      }
    />
  )
}

export function StepWelcome({
  session,
  participantId,
  view,
  mandatedRoles,
  onPreferRole,
  canPickRole,
}: {
  session: SessionState
  participantId: string | null
  view: ActiveRoleView
  // Rollen die op het lopende beslismoment mogen indienen. Leeg zolang er geen
  // beslismoment open staat.
  mandatedRoles: Role[]
  // Welke van meerdere eigen rollen actief is. Alleen een voorkeur: welke
  // rollen je draagt bepaalt de server.
  onPreferRole: (role: Role) => void
  // In event-modus claimt niemand een rol: één toestel per team speelt namens
  // alle rollen. Dan is er geen rolkeuze te maken.
  canPickRole: boolean
}) {
  const extra = view.all.filter(r => r !== view.active)
  const mandated = new Set(mandatedRoles)
  const [extraOpen, setExtraOpen] = useState(false)

  return (
    <>
      {!view.hasRole && participantId && canPickRole && (
        <RolePicker session={session} participantId={participantId} myRole={view.primary} />
      )}

      {!view.hasRole && participantId && !canPickRole && (
        <section className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Users className="size-3.5" aria-hidden /> Eén toestel, het hele team
          </span>
          <p className="text-xs text-muted-foreground">
            Jullie spelen samen op dit toestel. Niemand kiest hier één rol: bij elke keuze staat
            erbij namens welke rol je indient, en dat kan voor meerdere rollen op een rij.
          </p>
        </section>
      )}

      {!view.hasRole && !participantId && (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Je bent nog niet aangemeld bij deze oefening. Open de joinlink opnieuw.
        </p>
      )}

      {view.preferenceDropped && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          De rol die op dit toestel was opgeslagen hoort niet meer bij jou. De facilitator heeft de
          verdeling aangepast; hieronder staat wat je nu draagt.
        </p>
      )}

      {view.active && <MandateCard role={view.active} isInherited={view.activeIsInherited} />}

      {extra.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3">
          {/* Ingeklapt beginnen. Een solo-deelnameer draagt alle zeven andere
              rollen, en uitgeklapt was dit blok het grootste deel van stap 1.
              Welke rollen je erbij hebt staat al in de regel van de knop; de
              mandaatomschrijving per rol is naslag. */}
          <button
            type="button"
            onClick={() => setExtraOpen(v => !v)}
            aria-expanded={extraOpen}
            className="flex items-center gap-2 text-left font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {extraOpen ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />}
            Je draagt er nog {extra.length} {extra.length === 1 ? "rol" : "rollen"} bij
            <span className="font-sans normal-case tracking-normal text-muted-foreground/70">
              {extra.map(r => ROLE_META[r].label).join(", ")}
            </span>
          </button>
          <ul className={`flex flex-col gap-1.5 ${extraOpen ? "" : "hidden"}`}>
            {extra.map(role => (
              <li key={role} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{ROLE_META[role].label}</span>
                <span className="text-muted-foreground">{ROLE_META[role].mandateSummary}</span>
                {mandated.has(role) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-primary">
                    <Gavel className="size-2.5" aria-hidden /> mandaat
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className={`text-[11px] text-muted-foreground ${extraOpen ? "" : "hidden"}`}>
            Niemand heeft deze rollen geclaimd, dus jij neemt ze erbij. Bij de keuze zegt het scherm
            namens welke rol je indient.
          </p>
          {/* De rolwisselaar hoort bij dit detail: ingeklapt zie je één regel,
              uitgeklapt de mandaten plus de knoppen om te wisselen. Zeven chips
              permanent in beeld las als een menu. */}
          <div className={`flex flex-wrap gap-1.5 ${extraOpen ? "" : "hidden"}`}>
            {view.all.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => onPreferRole(role)}
                aria-pressed={role === view.active}
                className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  role === view.active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                {ROLE_META[role].label}
              </button>
            ))}
          </div>
          <p className={`text-[11px] text-muted-foreground ${extraOpen ? "" : "hidden"}`}>
            Dit bepaalt alleen welk mandaat je nu bovenaan ziet. Indienen kan voor al je rollen.
          </p>
        </section>
      )}

      <OrganisationFacts session={session} />

      <Table session={session} mine={view.all} />

      <MyDocuments session={session} roles={view.all} />

      <OpeningBriefing session={session} participantId={participantId ?? undefined} />
    </>
  )
}
