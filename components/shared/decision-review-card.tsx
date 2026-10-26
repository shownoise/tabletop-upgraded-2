// De scorebespreking. Eén component voor deelnemer, facilitator en rapport,
// omdat issue #105 als acceptatie-eis stelt dat die drie exact dezelfde
// keuzes, dimensies, scores en noemer tonen.
//
// Ontwerpkeuze: dit is geen gamescore maar een gesprekshulpmiddel. Daarom
// staat per dimensie eerst de richting (pijl + kleur), dan de uitleg in
// mensentaal, en pas daarna het getal. Geen balkjes, geen afkortingen zonder
// label — dat waren de twee concrete klachten uit de live test.

import {
  NO_DECISION_REASON,
  dimensionImpacts,
  tradeOffSentence,
  type DimensionImpact,
  type OutcomeVectorLike,
} from "@/lib/scoring/dimensions"
import { ROLE_META, type Role } from "@/lib/types"

export interface DecisionReviewItem {
  // De beslisvraag zoals die aan het team is gesteld.
  question: string
  // De gekozen optie. Null betekent: er is geen besluit ingediend.
  chosenLabel: string | null
  // Rol die de keuze bezat, en wie hem namens die rol indiende.
  role?: Role
  byName?: string
  // Rol was onbezet en is overgenomen, of door niemand gedekt.
  viaInheritance?: boolean
  unoccupied?: boolean
  reasoning?: string
  vector: OutcomeVectorLike
  // Punten voor deze keuze, als ze zijn vastgesteld.
  points?: number
  // Toelichting van de auteur, als die er is. Vervangt de gegenereerde
  // trade-offzin niet maar komt eronder.
  facilitatorCommentary?: string
}

const DIRECTION_CLASS: Record<DimensionImpact["direction"], string> = {
  positief: "text-emerald-600 dark:text-emerald-400",
  negatief: "text-red-600 dark:text-red-400",
  neutraal: "text-muted-foreground",
}

const DIRECTION_BG: Record<DimensionImpact["direction"], string> = {
  positief: "border-emerald-500/30 bg-emerald-500/5",
  negatief: "border-red-500/30 bg-red-500/5",
  neutraal: "border-border bg-muted/20",
}

export function DimensionImpactList({ vector }: { vector: OutcomeVectorLike }) {
  const impacts = dimensionImpacts(vector)
  return (
    <ul className="flex flex-col gap-1.5">
      {impacts.map(impact => (
        <li
          key={impact.key}
          className={`flex items-start gap-3 rounded-md border px-3 py-2 ${DIRECTION_BG[impact.direction]}`}
        >
          <span
            aria-hidden
            className={`mt-px w-4 shrink-0 text-center text-base leading-5 font-semibold ${DIRECTION_CLASS[impact.direction]}`}
          >
            {impact.arrow}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{impact.label}</span>
            <span className="block text-xs text-muted-foreground">{impact.explanation}</span>
          </span>
          <span
            className={`shrink-0 font-mono text-xs tabular-nums ${DIRECTION_CLASS[impact.direction]}`}
            title={`${impact.label}: ${impact.value > 0 ? "+" : ""}${impact.value}`}
          >
            {impact.value > 0 ? "+" : ""}{formatValue(impact.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function DecisionReviewCard({ item }: { item: DecisionReviewItem }) {
  const noDecision = item.chosenLabel === null
  const tradeOff = tradeOffSentence(item.vector)
  const roleLabel = item.role ? ROLE_META[item.role]?.label ?? item.role : undefined

  return (
    <article
      data-tour="deelnemer-review"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Beslisvraag</p>
        <h3 className="text-sm font-medium leading-snug text-foreground">{item.question}</h3>
      </header>

      <div className={`rounded-md border px-3 py-2 ${noDecision ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/30"}`}>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {noDecision ? "Geen besluit" : "Gekozen"}
        </p>
        <p className="text-sm text-foreground">
          {noDecision ? "Geen besluit binnen de tijd" : item.chosenLabel}
        </p>
        {noDecision && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{NO_DECISION_REASON}</p>}
        {/* De rol hoort er altijd bij te staan, ook zonder besluit. Stond die
            er niet, dan kreeg de facilitator bij vier open keuzes vier
            identieke anonieme kaarten — dat was een van de live klachten. */}
        {roleLabel && (
          <p className="mt-1 text-xs text-muted-foreground">
            {roleLabel}
            {!noDecision && item.byName ? ` · ${item.byName}` : ""}
            {!noDecision && item.viaInheritance ? " · rol overgenomen" : ""}
            {noDecision && (item.unoccupied
              ? " · was niet bezet en door niemand overgenomen"
              : " · was bezet, maar heeft niet ingediend")}
          </p>
        )}
      </div>

      {item.reasoning ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Onderbouwing</p>
          <p className="text-xs leading-relaxed text-foreground/90">{item.reasoning}</p>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Gevolgen op de zes dimensies
        </p>
        <DimensionImpactList vector={item.vector} />
      </div>

      {tradeOff ? (
        <p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Trade-off</span>
          <br />
          {tradeOff}
        </p>
      ) : null}

      {item.facilitatorCommentary ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{item.facilitatorCommentary}</p>
      ) : null}

      {typeof item.points === "number" ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Punten voor deze keuze: <span className="text-foreground">{item.points}</span>
        </p>
      ) : null}
    </article>
  )
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
