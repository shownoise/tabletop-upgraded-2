# SCORING.md — Decision-making under pressure

The canonical scoring model. One system, six dimensions. Every earlier engine has been deleted (see `CHANGELOG.md`).

## Overview

The six **outcome dimensions** are trade-off axes on the range `−2 .. +2` per authored decision option. Each option's outcome vector is summed round-by-round into an `AssessmentReport` (see `lib/scoring/report.ts`). The reveal panel presents each axis with a full Dutch label, a plain-language sentence, and an explicit direction so a negative number is never ambiguous.

**Neither pole is "the right answer".** The score reflects awareness, justification, and consistency — not picking a preferred side. The rules for each axis document both directions so the debrief can go either way.

## The six dimensions

| Key | Dutch label | Direction (`hoger = beter`) | What it measures |
|---|---|---|---|
| `CONT` | Containment | Beter ingedamd | Snelheid en zekerheid waarmee de dreiging is gestopt (isolatie, netwerk-segmentatie, systeem-shutdowns). |
| `FOR` | Forensische positie | Betere forensische positie | Behoud van bewijs, mogelijkheden tot attributie en later leren. Actie die evidence wist scoort laag. |
| `BC` | Bedrijfscontinuïteit | Minder verstoring | Doorlopen van primaire processen ondanks incident. Beslissingen die onnodig lang systemen uitschakelen scoren laag. |
| `JUR` | Juridisch & meldplicht | Beter afgedekt | Naleving AVG, NIS2 en contractuele verplichtingen. Missen van 24u/72u-meldingen scoort laag. |
| `VER` | Verantwoording & communicatie | Duidelijker verantwoord | Transparantie richting medewerkers, klanten, media, board. Zwijgen wanneer stakeholders informatie nodig hebben scoort laag. |
| `KOS` | Kosten & schade | Lagere schade | Directe kosten, herstelkosten, reputatieschade. Losgeld betalen is niet automatisch fout — het gaat om afweging vs. herstelkans. |

## Poles per axis (author guidance)

Every dimension has two poles. Each option loads one pole; the trade-off is inherent.

| Axis | Positive pole | Negative pole |
|---|---|---|
| CONT | Direct isoleren, netwerk in quarantaine, endpoints offline | Doorwerken zonder isolatie, aanvaller kan lateral gaan |
| FOR | Logs bevriezen, image maken, IR-retainer inschakelen | Systemen wipen, herbooten zonder capture, ad-hoc reset |
| BC | Handmatige workaround, back-up brengt processen live | Lange black-out, klanten zonder dienstverlening |
| JUR | Melding op tijd, legal-advies voor communicatie | Deadline missen, verklaring zonder juridisch review |
| VER | Duidelijk statement, interne update binnen 4u, board geïnformeerd | Radio-stilte, medewerkers horen het via media |
| KOS | Verzekering activeren, kosten transparant afwegen | Losgeld zonder herstelkans, over-investeren zonder verzekeraar |

## Signals per dimension

Which observations feed each axis:

- **Decisions** — the primary signal. Every decision option carries an authored `outcomeVector` on the 6 axes. The engine sums these across the round.
- **Timing** — decisions submitted late in the DECISION phase carry an implicit `−CONT` weight if the phase auto-locked; authored via `implicit` option on the DecisionNode.
- **Meldingen** — a participant-initiated melding is a positive signal on the axis that best matches the melding's recipient (AP → JUR, IR retainer → CONT/FOR, media → VER). Encoded on the melding-moment authoring.
- **Consistency across rounds** — repeating the same tension pattern (e.g. always speed over legal) is highlighted in the reveal narrative; no automatic score adjustment.
- **Confidence** — participants may submit a 1–5 confidence with each decision. Calibration is available via `lib/scoring/calibration.ts`; not shown to participants during play.

## What was deleted

Explicit removals per the refactor:

- **8-dimension assessment system** — `AssessmentDimensionKey` / `AssessmentDimensionId`, `SessionAssessment`, `AssessmentEvent`, `AssessmentAdvice`, `AssessmentControl`, `lib/engine/assessment.ts`, `lib/engine/debrief.ts`, `/api/session/{assessment,debrief}`.
- **Gamification points** — `POINT_EVENTS`, `PointEventKey`, `GamificationConfig`, `GamificationMode`, `DilemmaCard`, `DilemmaOption`, `RoundActionType`.
- **7 process dimensions** (`BESLUIT/MANDAAT/AANNAME/ADAPT/EXTERN/VOLHOUD/DELEN`) — folded into the 6 outcome axes as trade-off signals. The `lib/scoring/dimensions/*.ts` files remain for the transitional adapter; direct display was removed from the participant reveal panel.
- **Facilitator −1/0/+1 per-round score** — `FacilitatorRoundScore`, `submitFacilitatorRoundScore`, `/api/session/score-round`. Facilitators leave qualitative notes in REVIEW, not numeric scores.
- **`Punten: 38` aggregate** — participant-facing aggregate is deleted. If a facilitator wants a per-round summary, they read the per-axis vector.
- **`Genormaliseerd`, `Scoring v1.0.0`, `rolCoverage`** — moved from the participant reveal to a facilitator-only debug footer.

## Trend

The trend chart in the reveal panel renders **only completed rounds** — rounds where the participant has submitted a decision. Future rounds do not pre-fill with zero. `AssessmentReport.outcomes` includes an entry per round but the reveal panel filters by `round.round <= currentRound`.

## Signals into the report

`lib/scoring/report.ts::buildAssessmentReport` produces an `AssessmentReport` with:

- `outcomes[]` — one entry per round, containing `perDimension: OutcomeVector` and an aggregated `normalized: −1..+1`.
- `roleResolution` — the distributed role snapshot (Phase C2) — coverage %, distinct owners, and effective domain owners as **participant IDs**, no longer raw spec-role strings. The reveal panel maps these back to app-role labels + participant names, fixing the "every role shows CRISIS_LEAD" bug.
- `meta` — `scoringVersion`, `rolCoverage`. Facilitator-only.

## Solo play / understaffed sessions

Phase 4 introduces a sequential decision queue for participants who have inherited additional roles because their spec-mate never joined. Solo play is the extreme case — one participant carrying 6+ roles — but the same mechanic covers every gap between MINIMUM_STAFFING and a fully staffed room.

**Per-dimension behaviour.** Nothing changes in `computeRoundOutcome` (`lib/scoring/outcome-round.ts`). Each authored option still contributes its `outcomeVector` to the round's dimension sum, then the round's `perDimension` is the average of all submitted-option vectors within that round. A solo participant who submits 6 decisions in one round produces the same shape of sum-then-average as 6 different people would.

**Distinct-owner metric.** `roleResolution.distinctOwners` counts unique effective owners across the 10 spec-domains. In solo play this is 1 — the sole participant carries every domain via the fallback chain. Two consequences:

- `dropOptionalDecisions()` (in `lib/scoring/dry-run.ts`) may drop optional decisions when `distinctOwners < optionalDecisionThreshold`. Authors who set an `optionalDecisionThreshold > 1` are explicitly signalling "this decision only counts when at least N distinct owners are present" — the scenario should degrade gracefully, not error out.
- The facilitator report footer names the participant as sole owner across every domain; this is expected, not a bug.

**Non-degenerate scores.** Because each authored option carries a distinct `outcomeVector`, a solo run still produces a meaningful profile. The round's `perDimension` is the average of the vectors of the options the participant actually chose — it is neither zero (because vectors are non-zero) nor a copy of any single option (unless the participant happened to pick options with identical vectors). The IR-retainer perspective in the review panel remains a per-decision reveal, so the debrief works the same way whether one or eight people played.

**What the participant sees.** During the DECISION phase the ticket walks through the participant's role queue one option at a time. For inherited roles a Dutch hand-off notice is rendered above the option so the participant deliberately switches perspective before choosing. The DECISION → REVIEW transition is blocked until every queue item has been submitted (or the facilitator forces it via "Fase forceren").

## What the participant sees

Per axis, the reveal panel renders:

1. Full Dutch dimension label (no abbreviation).
2. Value with sign and explicit `positief` / `negatief` word.
3. A one-sentence hint on what the axis captures.
4. The direction (`Hoger = beter ingedamd`, etc.) so a negative number is never mistaken for the good pole.
5. In `bestChoiceIndex` panels, one Dutch sentence: which decision produced this outcome and what the IR-retainer perspective is (`facilitatorCommentary` on the authored option).

Nothing else is shown to participants — no version, no coverage, no `Genormaliseerd`, no raw aggregate.
