# Scoring — hoe het nu werkt

Puur, stateless package in `lib/scoring/`. Geen I/O. `SCORING_VERSION = '1.0.0'` reist mee in elke output.

## Flow

```
SessionState + ScenarioGraph
   │  lib/scoring/graph-adapter.ts (sessionToScoringInput)
   ▼
ExerciseInput  ──► scoreExercise() ──► ScoringOutput
                        │
                        ├─► buildReveal()           per-ronde reveal + divergence
                        ├─► buildAssessmentReport() 1-team PDF-payload
                        └─► buildEventReport()      multi-groep leaderboard
```

## De zes uitkomstdimensies (`constants.ts`)

| Code | Betekenis |
|---|---|
| CONT | Containment |
| FOR  | Forensische integriteit |
| BC   | Bedrijfscontinuïteit |
| JUR  | Juridisch / notificatieplicht |
| VER  | Stakeholder-vertrouwen |
| KOS  | Kosten |

Elke optie heeft een `outcomeVector: Record<Dim, number>` (typisch −2..+2). Elke ronde heeft `outcomeWeights` per dimensie.

## Kernformule per ronde (`outcome-round.ts`)

```
uitkomst(r) = Σdim (w_dim(r) · gemiddelde_gekozen_vector_dim)
              ─────────────────────────────────────────────────
                    Σdim (w_dim(r) · 2)                // −1..+1

punten(r)   = round(100 · (uitkomst(r) + 1) / 2)       // 0..100
totaal      = Σ punten(r)
```

1. Per beslispunt: laatste `submitted` of `revised` telt.
2. Geen inzending → `implicit`-optie, anders `NO_DECISION_FALLBACK_VECTOR = { CONT:-1, FOR:0, BC:-1, JUR:-1, VER:0, KOS:0 }`.
3. Gemiddelde vector over beslispunten van die ronde.
4. Weeg, normaliseer, → punten 0..100.

`hasSubmissions` onderscheidt "score 50 door fallback" van "nog niks ingezonden".

## Rollen — twee namespaces

App-rol (UI) ↔ spec-rol (scoring), mapping in `lib/graph/role-adapter.ts`:

| App | Spec |
|---|---|
| ceo | CRISIS_LEAD |
| ciso | SECURITY_LEAD |
| cfo | FINANCE_PROC |
| legal | LEGAL_DPO |
| head_of_comms | COMMS |
| hr_lead | HR |
| ops_manager | BUSINESS_OWNER |
| it_manager | IT_LEAD |

## Rol-toewijzing bij session start

`distributeRoles()` in `lib/engine/distribute-roles.ts` — deterministisch, workload-balanced:
- Elke aanwezige deelnemer behoudt zijn primary rol.
- Afwezige rollen worden verdeeld over aanwezige deelnemers als **inherited** rollen (tie-break op laagste workload → domain-affinity → participant-id).
- CEO wordt nooit doorgegeven (`isTopDecisionMaker`).
- Uitkomst op `session.roleDistribution.entries`.

Runtime: `decision-panel.tsx` filtert acties op **primary + inherited** rollen; erfelijke acties krijgen een subtiel *"namens Legal"*-labeltje.

## Rolresolutie in scoring (`role-resolution.ts`)

Puur voor **fallback-keten** (`DEFAULT_DOMAIN_OWNERSHIP` in `constants.ts`) en meta-cijfers in het rapport (`rolCoverage`, `distinctOwners`, `effectiveOwners`). Beïnvloedt de score **niet** — dat is nu puur outcome-based.

Enige score-consequentie: `required:false`-beslispunten vervallen als `distinctOwners < optionalDecisionThreshold` (default 3).

## Modes

- **ASSESSMENT**: 1 team, submissions mogen overschreven worden.
- **EVENT**: state-machine per ronde — `BRIEFING → OVERLEG → KEUZE → LOCK → REVIEW`. LOCK genereert `IMPLICIT` submissions voor lege beslispunten. Per-groep leaderboard via `scoreExerciseByGroup`.

## Reveal & rapport

- **`buildReveal(round)`** — gewichten (nu pas onthuld), option-distribution per beslispunt, Shannon-entropie ("waar was het gesprek?"), option-vectoren + `debriefNote`, standings.
- **`buildEndReveal()`** — causale kettingen: welke groepen zakten cumulatief onder 0 op een dimensie en welke opties kozen ze daarna.
- **`buildAssessmentReport()`** — outcomes + `spider.team` + effectiveOwners.
- **`buildEventReport()`** — per groep een one-pager met vectoren + één zin per dimensie ("Sterk / Positief / Neutraal / Verlies / Kritiek verlies").

## Wat NIET (meer) meetelt

- Er is **geen mandaat-check** in de score. Wie de knop indrukt maakt niet uit — alleen welke optie gekozen wordt.
- `mandaatValue()` is verwijderd; participants zien geen "buiten mandaat"-waarschuwing.
- Facilitator-debrief: `isWrongRole` + `GovernanceFlag` blijven server-side voor de rapportage, niet richting deelnemer.

## Call sites

| Bestand | Doel |
|---|---|
| `app/api/session/score/route.ts` | Server-API |
| `app/admin/report/[sessionId]/page.tsx` | Facilitator-rapport (ASSESSMENT) |
| `app/admin/report/one-pager/page.tsx` | Event one-pager per groep |
| `components/admin/live-overview-panel.tsx` | Live tijdens sessie |
