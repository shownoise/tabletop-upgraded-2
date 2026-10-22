// Wat de klant en het scenario aan een sessie meegeven. De facilitator voert
// deze dingen één keer in — bij de klant respectievelijk in de builder — en
// nooit opnieuw bij het starten van een sessie.

import type { AdminClient } from "./clients"
import type { ExerciseConfig, GoalId, RegulatoryRegime, Role } from "@/lib/types"
import type { ScenarioGraph } from "@/lib/graph/types"
import { NL_AVG_NIS2_REGIME, REGULATORY_REGIMES } from "@/lib/regulatory/regimes"

// Dezelfde vier buckets als het oude handmatige veld in de setup-form. De
// waarde belandt in deelnemer-teksten via het {{companySize}}-token, dus de
// exacte spelling (en-dash, duizendscheiding) is onderdeel van het contract.
export const COMPANY_SIZE_BUCKETS = ["100–250", "250–500", "500–1,500", "1,500+"] as const

export type CompanySizeBucket = (typeof COMPANY_SIZE_BUCKETS)[number]

// `employees` is een aantal, `companySize` een reeks. Bovengrens inclusief:
// 250 medewerkers valt in "100–250", 251 in "250–500". Onder de 100 bestaat
// geen bucket, dus daar klemt het naar de kleinste.
export function companySizeBucket(employees: number): CompanySizeBucket {
  if (!Number.isFinite(employees) || employees <= 250) return "100–250"
  if (employees <= 500) return "250–500"
  if (employees <= 1500) return "500–1,500"
  return "1,500+"
}

// De organisatievelden die de klant bepaalt. `criticalSystems` komt uit
// `itArrangement` — dat is hetzelfde gegeven onder twee namen (zie CONTEXT.md).
export interface ClientOrganisation {
  sector: string
  companySize: CompanySizeBucket
  criticalSystems: string
  crownJewels: string
  selectedRoles?: Role[]
}

export function organisationFromClient(client: AdminClient): ClientOrganisation {
  const org: ClientOrganisation = {
    sector: client.sector,
    companySize: companySizeBucket(client.employees),
    criticalSystems: client.itArrangement,
    crownJewels: client.crownJewels,
  }
  if (client.crisisTeamRoles?.length) org.selectedRoles = [...client.crisisTeamRoles]
  return org
}

export const DEFAULT_GOAL_ID: GoalId = "decision_making"

// Een graph van voor de doel-koppeling heeft geen goalId. Hier oplossen, niet
// in de graph schrijven: openen mag een opgeslagen scenario niet wijzigen.
export function resolveGraphGoalId(graph: Pick<ScenarioGraph, "goalId"> | null | undefined): GoalId {
  return graph?.goalId ?? DEFAULT_GOAL_ID
}

// De klant bepaalt onder welk regime geoefend wordt. Geen klant, geen regimeId
// of een id dat we niet kennen → het Nederlandse AVG+NIS2-regime.
export function regimeForClient(client: Pick<AdminClient, "regimeId"> | null | undefined): RegulatoryRegime {
  if (!client?.regimeId) return NL_AVG_NIS2_REGIME
  return REGULATORY_REGIMES[client.regimeId] ?? NL_AVG_NIS2_REGIME
}

// Welke config-velden de klant bezit. De setup-form gebruikt dit om te bepalen
// wat vaststaat en wat de facilitator nog zelf kiest.
export const CLIENT_OWNED_CONFIG_KEYS = [
  "sector",
  "companySize",
  "criticalSystems",
  "crownJewels",
  "selectedRoles",
] as const satisfies readonly (keyof ExerciseConfig)[]

export type ClientOwnedConfigKey = (typeof CLIENT_OWNED_CONFIG_KEYS)[number]
