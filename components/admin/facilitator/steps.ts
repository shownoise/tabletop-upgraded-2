// De vijf stappen van het facilitatordashboard.
//
// Waarom stappen met een eigen URL: het dashboard was één pagina van 700 regels
// waarin de facilitator tijdens een live sessie langs alle injectteksten moest
// scrollen om bij de review te komen (issue #105, probleem 1). Elke stap heeft
// nu een eigen adres, zodat een refresh dezelfde stap teruggeeft en de
// hoofdflow niet verdrinkt in beheerpanelen.

import type { SessionState } from "@/lib/types"

export type FacilitatorStep =
  | "sessie"
  | "ronde"
  | "review"
  | "eindbespreking"
  | "gereedschap"

export const STEP_PATH: Record<FacilitatorStep, string> = {
  sessie: "/admin/dashboard/sessie",
  ronde: "/admin/dashboard/ronde",
  review: "/admin/dashboard/review",
  eindbespreking: "/admin/dashboard/eindbespreking",
  gereedschap: "/admin/dashboard/gereedschap",
}

export const STEP_LABEL: Record<FacilitatorStep, string> = {
  sessie: "Sessie",
  ronde: "Actieve ronde",
  review: "Review",
  eindbespreking: "Eindbespreking",
  gereedschap: "Gereedschap",
}

// De koptekst per stap. Genummerd zodat de facilitator ziet waar hij in de
// flow staat, en uniek zodat een testbewering niet per ongeluk de navigatie
// raakt in plaats van de pagina.
export const STEP_HEADING: Record<FacilitatorStep, string> = {
  sessie: "Stap 1 — sessie en lobby",
  ronde: "Stap 2 — actieve ronde",
  review: "Stap 3 — review",
  eindbespreking: "Stap 4 — eindbespreking",
  gereedschap: "Gereedschap — injects, specials en techniek",
}

// De hoofdflow. Gereedschap staat hier bewust niet in: injectbeheer, specials
// en reveal zijn beheer, geen stap in de begeleiding.
export const MAIN_STEPS: readonly FacilitatorStep[] = [
  "sessie",
  "ronde",
  "review",
  "eindbespreking",
] as const

// Waar `/admin/dashboard` zonder stap in de URL op landt. De oude URL blijft
// daarmee werken en kiest de stap op basis van de sessiestatus.
export function resolveStep(session: SessionState | null): FacilitatorStep {
  if (!session) return "sessie"
  if (session.status === "lobby") return "sessie"
  if (session.status === "ended") return "eindbespreking"
  return session.roundPhase === "review" ? "review" : "ronde"
}
