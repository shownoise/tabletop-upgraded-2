# ALIGNMENT.md — Scoremethodiek ↔ bestaande builder

Mapping van het target scoremodel ("Scoremethodiek — herbouwopdracht (geconsolideerd)", **Deel A**, plus **Deel B** — Adaptieve rolbezetting, twee modi, Event Mode) op de huidige graph-builder in dit repo. Puur analyse — geen code, geen schema-wijziging, geen scenario-aanpassing.

Deel A leidt: het scoremodel. Deel B wijzigt Deel A op drie plekken (§4 adaptieve rolbezetting, §7.9 modus-as, §11 buiten-scope-lijst herzien) en voegt Event Mode + reveal + PDF-export toe. Waar de twee botsen wint Deel B en staat dat expliciet gemarkeerd.

De builder is een gerichte graaf van `GraphNode`s (`lib/graph/types.ts:157`) met vijf functionele nodetypes (`start`, `round`, `inject`, `decision`, `chaser`, `special`, `outcome`) en één transportedge-type (`lib/graph/types.ts:18`). Runtime staat in `lib/graph/engine.ts`; scoring op dit moment loopt via `AssessmentEvent` (proces, één-dim) en `ScoreImpacts` op RoleActions/DecisionOptions (multi-dim map over acht process-dimensies). De zes uitkomstdimensies (CONT/FOR/BC/JUR/VER/KOS) uit spec §5 bestaan nergens in de code — dat is de grootste enkelvoudige gap.

Waar velden niet bestaan staat **`— missing —`** in de mapping. Gap-voorstellen staan in sectie 2, per gap kleinst mogelijke additie met default.

---

## 1. Mapping table

### 1.1 Domeinmodel (spec §2)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| `Scenario` (graph van rondes) | `ScenarioGraph` interface | `lib/graph/types.ts:256` | canonical model — `nodes: GraphNode[]`, `edges: GraphEdge[]` |
| `Round[]` (§2, §3) | `RoundNodeData` (`kind: "round"`) | `lib/graph/types.ts:41` | volgorde bepaald door sequence-edges, niet door een expliciete array |
| `Inject[]` (§2, §3.1) | `InjectNodeData` (`kind: "inject"`) | `lib/graph/types.ts:64` (`extends Omit<Inject, "id">`, `lib/types.ts:436`) | gekoppeld aan Round via edge `type: "inject"` |
| `DecisionPoint[]` (§2, §4.2a) | `DecisionNodeData` (`kind: "decision"`) | `lib/graph/types.ts:80` | staat op **graph-niveau**, niet op ronde-niveau — reikt hetzelfde als spec |
| `Option[]` op DecisionPoint (§2) | `DecisionNodeData.options[]` | `lib/graph/types.ts:85` | ook `RoleAction[]` op de round (`RoundNodeData.roleActions`, `lib/graph/types.ts:46`) is een tweede besluitmechaniek — zie 1.6 |
| `Exercise` (§2) | `SessionState` | `lib/types.ts:685` | ook `ExerciseConfig`, `lib/types.ts:550` |
| `Participant.plays: RoleId[]` (§2, §4.2d) | `Participant.role?: Role` | `lib/types.ts:578` (`role?: Role`) | **eén rol per participant** — geen array, geen multiplexing |
| `EventLog` (append-only) (§2) | `SessionState.timeline: TimelineEvent[]` + `assessmentEvents: AssessmentEvent[]` + `submittedDecisions: SubmittedDecision[]` + `factChecks: FactCheckEntry[]` + `injectAnnotations: InjectAnnotation[]` + `pushedInjects: PushedInject[]` | `lib/types.ts:685-745`, event types `lib/types.ts:600` | log is **verspreid over 6 velden**, geen unified append-only stream met discriminated `kind` |
| Placeholder-lijst `{{token}}` per oefening (§2) | Vast token-vocabulaire uit `ExerciseConfig` | `DynamicFillToken` in `lib/graph/types.ts:71` — 5 tokens: `sector`, `companySize`, `crownJewels`, `criticalSystems`, `irRetainerName` | **niet uitbreidbaar** door de scenario-auteur; spec-voorbeeld `{{TOPKLANT_1}}`, `{{ERP}}` kan niet worden gemaakt |
| Placeholder-fout bij onopgeloste token (§2, "harde fout") | Onopgeloste `{{token}}` blijft **verbatim** in de tekst | `lib/graph/dynamic-fill.ts:37` — "Unknown or unlisted tokens are left verbatim so authors see mistyped placeholders." | validate.ts controleert dit niet |

### 1.2 Ronde-anatomie (spec §3)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Fase `BRIEFING` | `RoundPhase = 'inject'` | `lib/types.ts:147`, `lib/engine/round-phases.ts:11` (label "Briefing") | 1:1 met spec |
| Fase `OVERLEG` | `RoundPhase = 'discussion'` | `lib/types.ts:147`, `lib/engine/round-phases.ts:12` | 1:1 |
| Fase `KEUZE` | `RoundPhase = 'decision'` | `lib/types.ts:147`, `lib/engine/round-phases.ts:13` | 1:1 |
| Fase `REVIEW` | `RoundPhase = 'review'` | `lib/types.ts:147`, `lib/engine/round-phases.ts:14` | 1:1 |
| Fase-start-tijdstempel | `SessionState.activeDiscussionPhase.phaseStartedAt` en `activeRoundPhaseState.phaseStartedAt` | `lib/types.ts:587`, `lib/types.ts:658` | wél op fase-niveau, maar ronde-begin per-fase komt **niet in de event-timeline** — er is geen `phase_started` event met vaste identifier per ronde+fase |
| `t_start_overleg` (§7.1) | Niet direct — af te leiden uit `discussion_phase_changed` timeline-event + `roundStartedAt` | timeline event `lib/types.ts:611`, session field `lib/types.ts:696` | af te leiden, niet expliciet |
| `t_keuze_vastgeklikt` (§7.1) | `SubmittedDecision.submittedAt` (ISO-string per participant) | `lib/types.ts:274-284` | per-participant, niet per beslispunt-eigenaar |
| Ronde-referentietijd `designTimeMinutes` (§3, §7.1) | **`— missing —`** | `RoundNodeData.timerMinutes` (`lib/graph/types.ts:45`) is de zichtbare countdown, geen scoring-referentietijd | zie gap 1 |
| Facilitator-invoer termen in `REVIEW` (§3, §7.9) | Deels: `FacilitatorRoundScore { score: -1 | 0 | 1 }` en `SpecialScore` | `lib/types.ts:309-319` | grofmazig één cijfer per ronde; **geen per-dimensie slider (§7.9)** — zie gap 12 |

### 1.3 Injects (spec §3.1, §4.2b, §4.2c)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| `importance: crucial | info` (§3.1) | **`— missing —`** | `Inject.urgency: 'low'/'medium'/'high'/'critical'` (`lib/types.ts:354, 445`) is een presentatie-tag, niet crucial/info | zie gap 3. `nis2Relevant?: boolean` (`lib/types.ts:449`) is een aparte compliance-flag, niet hetzelfde begrip |
| `visibleTo: RoleId[]` (§4.2b) | Deels: `Inject.targetRoles?: Role[]` (`lib/types.ts:446`) en `Inject.targetTeam` | `lib/types.ts:446-447` | **hard: dit is routing (recipient), niet asymmetrische zichtbaarheid.** Spec zegt: "Niemand ziet het geheel. Delen is een actie". Nu ziet iedereen alle situation_updates; alleen de per-inject route bepaalt wie de push krijgt (`resolveInjectRecipients`, `lib/inject-routing.ts:11`). Zie gap 4 |
| `SHARE_INJECT(injectId)` actie (§4.2b) | **`— missing —`** | geen deel-actie in `session-store.ts`, geen `shared` set in `SessionState` | zie gap 5 |
| `correctRoute` op misroutes (§4.2c) | **`— missing —`** | inject heeft `targetRoles`/`targetTeam`, maar geen "de-juiste-rol-was-X" annotatie | zie gap 6 |
| `routingOptions[]` (§4.2c) — verwerker kan doorzetten/negeren | **`— missing —`** | ontvanger kan alleen decisie-actions of open-input geven; geen "doorzet naar X" mechaniek | zie gap 6 |
| Facilitator-injects gemarkeerd `source: FACILITATOR` (§3.1) | `PushedInject { pushedAt, roundIndex }` + timeline `"surprise_inject"` en `"inject_pushed"` | `lib/types.ts:594`, `lib/types.ts:600` | onderscheid facilitator-inject vs. scenario-inject blijkt uit **timeline-event-type** en de aanwezigheid in `pushedInjects`, niet uit een label op de inject zelf — af te leiden, niet expliciet |
| Inject in log ná vastklikken meetelt niet in `D` (§3.1) | **`— missing —`** | er is geen `D` berekening en geen "vastklikken"-marker per beslispunt | valt binnen scoring-package, niet builder |
| `reliability: fact | assumption | misleading` | `Inject.reliability?: InjectReliability` (`lib/types.ts:425, 454`) | dit is BOB-training ground-truth, orthogonaal aan crucial/info. Handhaven, niet overloaden |

### 1.4 Rollen en domeinen (spec §4.1)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Rol-enumeratie `RoleId` (§4.1) | `type Role` | `lib/types.ts:6-15` — 9 rollen | **niet 1:1 met spec**: spec heeft o.a. `RETAINER_LIAISON`, `BUSINESS_OWNER`, `FINANCE_PROC`, `SECURITY_LEAD`; huidige set: `it_manager`, `ciso`, `head_of_comms`, `legal`, `ceo`, `cfo`, `system_admin`, `hr_lead`, `ops_manager`. Merge mogelijk (`ciso` ≈ `SECURITY_LEAD`, `cfo` ≈ `FINANCE_PROC`, `ceo` ≈ `CRISIS_LEAD`, `ops_manager` ≈ `BUSINESS_OWNER`) maar `RETAINER_LIAISON` en `SECURITY_LEAD` als expliciete rol ontbreken. Zie gap 9 |
| `ROLE_META` labels/authorities/team | `lib/types.ts:17-132` | zelfde plek | wél aanwezig, breed |
| `Role.domains: Domain[]` (§4.1) | **`— missing —`** | rol heeft `team`, `authorities[]`, `notResponsibleFor`, geen `domains[]` gekoppeld aan de 10 spec-domeinen | zie gap 8 |
| `Domain` enum (`CONTAINMENT` … `EXTERNE_PARTIJEN`) (§4.1) | **`— missing —`** | dichtstbijzijnde is `SupervisionArea` (`lib/engine/supervision.ts:14`, 12 areas over technische kaart, niet de spec-domeinen); niet-1:1 | zie gap 8 |
| `DecisionPoint.domain: Domain` (§4.2a) | **`— missing —`** | dichtstbijzijnd `DecisionNodeData.supervisionAreas?: SupervisionArea[]` (`lib/graph/types.ts:108`) — semantisch een andere as (NIS2-audit vs. functioneel domein) | zie gap 8 |
| `DecisionPoint.owner: RoleId` (§4.2a) | Deels via optie-`allowedRole` en RoleAction-`allowedRoles` | `lib/graph/types.ts:91` (per-optie `allowedRole?: Role`), `lib/types.ts:172` (`RoleAction.allowedRoles: Role[]`) | eigenaar op **DecisionNode-niveau** ontbreekt; alleen per-optie geregeld. Zie gap 8 |
| `DecisionPoint.consulted: RoleId[]` (§4.2a) | **`— missing —`** | zie gap 8 |
| `escalationTrigger { atInject, targetHours }` (§2) | **`— missing —`** | er is wél `RoleAction.pushesInject` (auto-inject na keuze, `lib/types.ts:191`) maar geen escalatie-klok met doel-uren | zie gap 10 |
| Rol-multiplexing (§4.2d) | **`— missing —`** | `Participant.role?: Role` is single-role. Rol-uitval opgevangen via `ROLE_FALLBACK` (`lib/types.ts:134`) — routing fallback, geen expliciete "één persoon = meerdere rollen". Zie gap 11 |
| NPC-marker voor niet-gespeelde rollen (§4.2d) | **`— missing —`** | facilitator kan overnemen, geen `NPC`-vlag die scoring uitsluit | zie gap 11 |

### 1.5 Uitkomstdimensies (spec §5)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Zes uitkomstdimensies CONT/FOR/BC/JUR/VER/KOS (§5) | **`— missing —`** | `AssessmentDimensionKey` (`lib/types.ts:149`, 8 items) is de **procesas** (decision_speed, mandate_clarity, …), niet uitkomst. Er is geen aparte uitkomst-as in het model | zie gap 2 (de grootste enkelvoudige gap) |
| `Option.vector: OutcomeVector` (−2..+2 over 6 dims) (§5) | **`— missing —`** | `DecisionNodeData.options[].scoreImpacts?: ScoreImpacts` (`lib/graph/types.ts:96`) is een `Partial<Record<AssessmentDimensionKey, number>>` — verkeerd domein (proces i.p.v. uitkomst) én niet volledig ingevuld (Partial) | zie gap 2 |
| Weging per ronde over de zes dims (§5) | **`— missing —`** | ronde heeft `timerMinutes`, `bobPhase`, `evaluationAspects`; geen weegvector | zie gap 2 |
| `RONDE_UITKOMST(r)` formule (§5) | **`— missing —`** | huidige `cumulativeScore()` / `scoreByDimension()` (`lib/graph/outcome-selector.ts:42, 52`) sommeren *ScoreImpacts*, geen genormaliseerde ronde-uitkomst | binnen scoring-package op te bouwen zodra dim-vector en weging bestaan |

### 1.6 Optie-metadata (spec §2)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| `Option.id` | `DecisionNodeData.options[].id` | `lib/graph/types.ts:86` | ✓ |
| `Option.label` | `DecisionNodeData.options[].label` | `lib/graph/types.ts:87` | ✓ |
| `Option.requiresCosign: RoleId[]` (§2) | **`— missing —`** | zie gap 7 |
| `Option.availableIf: Expr` (§2, §6) | **`— missing —`** | outcome-nodes hebben `scoreRange` (`lib/graph/types.ts:154`); special-nodes hebben `predicate: { op, value }` (`lib/graph/types.ts:137`); chaser-condities hebben tag-union (`ChaserCondition`, `lib/graph/types.ts:111`). **Geen gedeelde expressie-taal** — elk mechaniek heeft zijn eigen mini-DSL. Zie gap 13 |
| `Option.effects: StateEffect[]` (§2) | Deels: chasers reageren op `SessionState.flags: Record<string, boolean>` (`lib/types.ts:734`) maar er is **geen `effects[]` op een optie** die die flag zet — de flag komt op andere manieren binnen | zie gap 14 |
| `Option.debriefNote` (§2) | `DecisionNodeData.options[].facilitatorCommentary?` en `lessonLearned?` | `lib/graph/types.ts:98-99` | ✓ (naam-verschil, één daarvan is de canonieke `debriefNote`) |
| `Option.qualityRank` (author-marker beste) | `DecisionNodeData.options[].qualityRank?: ChoiceQuality` (`'best'|'good'|'poor'|'wrong'`) | `lib/graph/types.ts:97`, `lib/types.ts:162` | extra t.o.v. spec — buiten scope, behouden |

### 1.7 Knock-on regels (spec §6)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| State-effects op `ExerciseState` aan het einde van de ronde (§6) | **`— missing —`** als algemene regel-motor | huidige mechanismen: (a) `ChaserNodeData` op basis van `flags`/`decision_not_taken`/`notification_missing` (`lib/graph/types.ts:124`), (b) `scoreRange` op outcome-node (`lib/graph/types.ts:154`), (c) `SpecialNodeData.thresholds` met numeriek predicate (`lib/graph/types.ts:137`). Elk mechaniek staat los. Zie gap 13/14 |
| "Grijs vakje met reden" per geblokkeerde optie (§6) | **`— missing —`** | er is geen "beschikbaar/geblokkeerd + reden" indicator per optie | zie gap 14 |
| Causale keten in debrief (§6) | Deels: `branchLog` (`GraphRuntimeState.branchLog`, `lib/types.ts:632`) heeft `nodeId → choseHandle → trigger`; geen expliciet "leidde tot blokkade in ronde X" | branch-log is er, blokkade-oorzaak niet |

### 1.8 Externe partijen (spec §7.5)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Externe partij als scenario-config-item (§7.5) | **`— missing —`** als data-model | notification-machinerie richt zich op NCSC + AP (`NotificationType`, `lib/types.ts:223`) en IR-retainer (`IrRetainerProfile`, `lib/types.ts:212`). Verzekeraar/counsel/sector-CERT/politie/klant zijn niet gemodelleerd | zie gap 15 |
| `w_j`, `κ_j` per partij (§7.5) | **`— missing —`** | zie gap 15 |
| Activatiemoment `t_j` (§7.5) | Deels voor 2 partijen: `NotificationDraft.submittedAt` (`lib/types.ts:249`) en `RetainerActivationState.dialedAt` (`lib/types.ts:271`) | | dekt AP/NCSC en Eye-retainer, niet de rest |
| Wettelijke deadlines (24u/72u) | `notificationDeadlineMinutes()` | `lib/engine/supervision.ts:399` | hard-coded per `NotificationType`, geen builder-veld — voor scoring OK, voor uitbreidbaarheid gap |
| `q_j` — was de vraag actionable? (§7.5, facilitator-in) | **`— missing —`** | | zie gap 12 |

### 1.9 Overige procesgrootheden (spec §7)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Herzieningsactie (§7.4 ADAPT) | **`— missing —`** | `session-store.ts:1193` verwijdert een oude decision bij nieuwe (`existingDecisions = … filter …`) — een herziening laat geen event achter behalve overschrijving | zie gap 16 |
| `t_venster` (§7.4) — hoe lang na inject een herziening nog telt | **`— missing —`** | | scoring-package config |
| Aannames aanvinken bij besluit (§7.3) | **`— missing —`** | `SubmittedDecision.reasoning: string` (vrije tekst) — geen gestructureerde premissen | zie gap 17 |
| Falsificatietrigger per aanname (§7.3) | **`— missing —`** | | zie gap 17 |
| Rooster / taaktoewijzing (§7.6 VOLHOUD) | **`— missing —`** | | zie gap 12 (blijft slider) |
| `SHARE_INJECT` deelvertraging (§7.7 DELEN) | **`— missing —`** | zie gap 5 | |
| Co-sign schending → `m(d)=0` (§7.2) | **`— missing —`** | `requiresCosign` bestaat niet (gap 7), afdwingen kan pas na gap 7 |
| Handmatig ingevoerde termen `q_j`, `O`, `m` bij twijfel (§7 header + §7.9) | Deels: `FacilitatorRoundScore { score: -1 | 0 | 1 }` per ronde | `lib/types.ts:309` | te grofmazig; zie gap 12 |

### 1.10 Nodetypes en edges (spec §8)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Node `ROUND` (§8) | `GraphNodeType = "round"`, `RoundNodeData` | `lib/graph/types.ts:18, 41` | aanwezig; mist `designTimeMinutes` en dim-weging (gap 1, 2) |
| Node `INJECT` (§8) | `GraphNodeType = "inject"`, `InjectNodeData` | `lib/graph/types.ts:18, 64` | aanwezig; mist `importance`, `visibleTo`, `correctRoute` (gap 3, 4, 6) |
| Node `DECISION` (§8) | `GraphNodeType = "decision"`, `DecisionNodeData` | `lib/graph/types.ts:18, 80` | aanwezig; mist `domain`, `owner`, `consulted` (gap 8) |
| Node `GATE` (§8) — conditie over `ExerciseState` | **`— missing —`** | ontbreekt als expliciet nodetype. **Wél vergelijkbare mechanismen**: (a) `special`-thresholds op numeriek predicate, (b) chaser met `flag`-conditie, (c) outcome met `scoreRange`. Geen algemene gate. Zie gap 13 |
| Node `END` (§8) — afsluiting met debrief-anker | `GraphNodeType = "outcome"`, `OutcomeNodeData { key, label, narrative, lessonLearned }` | `lib/graph/types.ts:141` | ✓ semantisch equivalent (naamsverschil) |
| Edge `sequence` | `GraphEdgeType = "sequence"` | `lib/graph/types.ts:19` | ✓ |
| Edge `branch` (§8, "expressie over `ExerciseState`") | `GraphEdgeType = "branch"` bestaat als type-string, maar in de engine wordt gebranched via `sourceHandle` match, niet via een expressie | `lib/graph/engine.ts:87` (`e.sourceHandle === trigger.handle`) | er is geen edge-conditie-expressie; branching is `sourceHandle`-matching. Zie gap 13 |
| Edge `outcome` / `inject` | `GraphEdgeType = "outcome" | "inject"` | `lib/graph/types.ts:19` | ✓ |
| Één expressietaal, gedeeld met `availableIf` (§8) | **`— missing —`** | zie gap 13 |
| Blokkerende validatie (§8) | `validateGraph()` — dekt: onbereikbare nodes, decision zonder ≥2 uitgangen, cycle-check, edge naar niet-bestaande node, decision-optie zonder edge | `lib/graph/validate.ts:11` | **dekt niet**: optie zonder complete 6-dim vector (gap 2), ronde zonder weging (gap 2), ronde zonder richttijd (gap 1), misroute zonder `correctRoute` (gap 6), decision zonder domein/owner (gap 8), knock-on regel die naar niet-bestaande node verwijst (gap 14), onopgeloste placeholder (gap 22) |
| Import/export als leesbaar JSON, git-diffbaar | `db.ts`/`template-store.ts` (op te zoeken) + `ScenarioGraph` is plain object | `lib/graph/types.ts:256` | ScenarioGraph is JSON-serialiseerbaar; onderzoek bij implementatie of één-file-export bestaat |

### 1.11 EventLog — wat wordt er nu geëmit?

| Event | Uit | Bruikbaar voor |
|---|---|---|
| `session_created`, `session_started`, `session_ended` | `pushTimeline(...)` diverse plekken in `lib/session-store.ts` | scoring-run-anker |
| `round_changed { roundIndex }` | `lib/session-store.ts:512, 966, 990` | ronde-begin (maar geen fase-begin) |
| `inject_pushed`, `inject_advanced`, `surprise_inject` | `lib/session-store.ts:514, 545, 1023, 1051, 1330` | inject-tijdstippen; onderscheid facilitator vs. scenario via event-type |
| `discussion_phase_changed` | `lib/session-store.ts:199` | *enige* fase-overgang die getimestamped wordt; dekt niet OVERLEG→KEUZE→REVIEW |
| `participant_joined`, `participant_ready` | `lib/session-store.ts:673`, `LiveEventName` in `lib/types.ts:788` | roster |
| `special_triggered`, `special_completed` | `lib/session-store.ts:584, 1714` | externe-partij simulatie (`journalist_qa`, `ap_notification`, `ransomware_negotiation` — spec-external ≠ 1:1) |
| `inject_routes_plotted`, `inject_routes_replotted` | `lib/session-store.ts:742, 912` | routing-snapshot, geen scoring-input |
| `inject_tagged` | `lib/session-store.ts:836` | reliability-tag (BOB), geen shared-inject-actie |
| `AssessmentEvent { dimensionId, roundNumber, value, source, participantId, scoreImpact }` | `lib/engine/types.ts:68`, `lib/session-store.ts:1263, 1278, 1294, 1348` | **al enige** dimensie-per-ronde-per-participant log — maar dimensie-ID = process-as (`AssessmentDimensionId`), niet uitkomst-as |
| `SubmittedDecision { actionId, submittedAt, isWrongRole, isIrDeviation }` | `lib/session-store.ts:1179` | KEUZE-tijdstip per participant |
| `NotificationDraft { submittedAt }` | `lib/types.ts:249` | AP/NCSC-activatie |
| `FactCheckEntry`, `InjectAnnotation` | `lib/types.ts:665, 675` | reliability-tagging per participant per inject |

**Kernbezwaar tegen de huidige event-emissie voor spec-scoring** (verwerkt in gaps 18, 19):
1. Geen unified append-only stream met discriminated `kind` — data zit in 6 aparte velden.
2. Fase-overgangen worden niet per-fase getimestamped in de timeline (alleen `discussion_phase_changed`).
3. Geen event bij "vastklikken van de KEUZE-fase" per beslispunt (niet per participant) — nodig voor `t_keuze_vastgeklikt` (§7.1) op de scorenoemer van *het beslispunt*, niet per persoon.
4. Geen `share_inject` event.
5. Geen `assumption_tagged` event.

---

## 2. Gap list

Gesorteerd op hoeveel van het scoremodel per gesloten gap ontsluit. Elke voorgestelde toevoeging is **backwards compatible**: bestaande scenario's blijven valideren doordat elk nieuw veld optioneel is met een default, én oude scenario's zonder het veld leveren `null` in de betreffende scorenoemer volgens §7.9 (terugval op facilitator-slider).

### Gap 1 — `designTimeMinutes` per ronde
- **Gap:** ronde heeft geen ontwerp-referentietijd voor de tempo-scorenoemer.
- **Needed for:** §7.1 BESLUIT (Δ_ref bepaalt `ρ = Δ/Δ_ref`).
- **Proposal:** veld `designTimeMinutes?: number` toevoegen aan `RoundNodeData` (naast bestaande `timerMinutes`). Semantiek: verwachte gemiddelde overleg-tot-besluit-duur in minuten; puur scoring-noemer, geen countdown.
- **Migration:** default `undefined` → BESLUIT-dimensie valt terug op slider (§7.9). Bestaande scenario's ongewijzigd valid.

### Gap 2 — Uitkomstdimensie-vector (CONT/FOR/BC/JUR/VER/KOS)
- **Gap:** het model kent alleen procesdimensies (`AssessmentDimensionKey`), geen uitkomstdimensies. Opties hebben geen 6-dim vector, ronde geen weging over die dimensies.
- **Needed for:** §5 (Ronde-uitkomst-formule), §6 (knock-on op `cum.FOR < 0` en vergelijkbaar), §7 (spider per rol op uitkomstvectoren van eigen besluiten).
- **Proposal:** drie samenhangende additions.
  1. Nieuw type `OutcomeDimensionKey = 'CONT' | 'FOR' | 'BC' | 'JUR' | 'VER' | 'KOS'` in `lib/types.ts` (naast bestaande `AssessmentDimensionKey`, niet vervangend).
  2. Optioneel `outcomeVector?: Record<OutcomeDimensionKey, number>` (−2..+2, alle zes verplicht wanneer aanwezig) op `DecisionNodeData.options[]` en `RoleAction`.
  3. Optioneel `outcomeWeights?: Record<OutcomeDimensionKey, number>` op `RoundNodeData` (default `{CONT:1,FOR:1,BC:1,JUR:1,VER:1,KOS:1}` — zonder auteur-input worden alle dimensies gelijk gewogen).
- **Migration:** ontbrekende `outcomeVector` → optie levert `null` bij uitkomst-berekening en wordt gerapporteerd als "geen uitkomst-annotatie". Bestaande `scoreImpacts` (procesas) blijft naast bestaan; scoring rapporteert proces en uitkomst apart (§7.8: nooit optellen).
- **Validator:** waarschuwing (niet blokkerend) op decision-optie zonder `outcomeVector` totdat opt-in per scenario; blokkerend zodra `graph.features.outcomeScoring === true` gezet is.

### Gap 3 — `Inject.importance: 'crucial' | 'info'`
- **Gap:** het crucial/info-onderscheid uit §3.1 bestaat niet; `urgency` en `nis2Relevant` dekken het niet.
- **Needed for:** §7.1 (`D` = crucial injects bereikt de beslisser / totaal crucial in ronde), §7.4 ADAPT (materieel = crucial, ruis = info).
- **Proposal:** `importance?: 'crucial' | 'info'` op `InjectNodeData` (en op `Inject` in `lib/types.ts:436`). Default `'info'`.
- **Migration:** bestaande injects worden impliciet `'info'`. Auteur kan gericht `'crucial'` opzetten. Facilitator-injects krijgen ook default `'info'` — voorgestelde UX: markering-in-push-dialog (aparte werk-item, valt onder gap 20).

### Gap 4 — `Inject.visibleTo` (asymmetrische zichtbaarheid, niet routing)
- **Gap:** iedereen ziet nu alle scenario-injects (routing bepaalt alleen wie de **push-notificatie** krijgt, maar de inject verschijnt in het gedeelde feed van iedereen). Spec §4.2b vereist dat een rol een inject **alleen** ziet.
- **Needed for:** §4.2b (asymmetrie), §7.1 (`D` op basis van "info die de beslisser bereikte"), §7.7 DELEN.
- **Proposal:** semantiek van bestaande `Inject.targetRoles` verrijken → als `targetRoles` gezet is én `Inject.visibility === 'exclusive'` (nieuw optioneel veld, default `'shared'`), dan is de inject **alleen** zichtbaar voor die rollen. Twee namen mogelijk: (a) nieuw veld `visibility: 'shared' | 'exclusive'`, of (b) nieuw veld `visibleTo?: Role[]` naast `targetRoles` waar `targetRoles = routing` en `visibleTo = zichtbaarheid`.
- **Migration:** default `'shared'` (huidige gedrag). Bestaande scenario's ongewijzigd. Aanbevolen: (b) — `visibleTo` los van `targetRoles` — semantische scheiding blijft schoon.

### Gap 5 — `SHARE_INJECT` actie en gedeelde-informatie state
- **Gap:** geen deel-actie, geen `SessionState.sharedInjects` set, geen `share_inject` event.
- **Needed for:** §4.2b (kern van rolgebonden-informatie-mechaniek), §7.7 DELEN (deelvertraging = `t_share − t_receive`).
- **Proposal:** nieuw sessie-mutation-endpoint `POST /api/session/action` met `kind: 'share_inject', injectId, participantId`. State: `SessionState.sharedInjects?: { injectId, sharedBy, sharedAt }[]`. Timeline-event: `'inject_shared'`.
- **Migration:** ontbrekende `sharedInjects` → geïnterpreteerd als lege lijst; DELEN valt terug op slider tot mechaniek ingeschakeld per scenario.

### Gap 6 — `Inject.correctRoute` + `routingOptions`
- **Gap:** misroute-injects hebben geen "de juiste rol was X" annotatie; ontvanger heeft geen "doorzet-actie".
- **Needed for:** §4.2c (misroutering), §7.2 MANDAAT-term `Rt`.
- **Proposal:** twee velden op `InjectNodeData`.
  - `correctRoute?: Role` — de rol waar dit inject "hoort".
  - `routingOptions?: Array<{ id: string; route: Role | null; outcomeVector: Record<OutcomeDimensionKey, number> }>` — expliciete keuzes voor de ontvanger.
- **Migration:** ontbrekende velden → inject wordt geen misroute, geldt als normaal. Bestaande scenario's ongewijzigd.

### Gap 7 — `Option.requiresCosign: Role[]`
- **Gap:** geen co-sign-mechaniek per optie.
- **Needed for:** §7.2 MANDAAT (co-sign schending → `m(d) = 0`).
- **Proposal:** `requiresCosign?: Role[]` op `DecisionNodeData.options[]` (en op `RoleAction`).
- **Migration:** ontbrekende `requiresCosign` → interpretatie "geen co-sign nodig". Bestaande scenario's ongewijzigd.

### Gap 8 — DecisionPoint `domain`, `owner`, `consulted` + `Role.domains`
- **Gap:** vier gerelateerde velden ontbreken; op dit moment is besluit-eigenaarschap versnipperd (per-optie `allowedRole` + per-actie `allowedRoles`), en domain is geen concept.
- **Needed for:** §4.2a (beslismandaat), §7.2 (`p_i*` per eigenaar, `m(d)` per domein-eigenaar), §5.1 (domein-kolom in beslispunt-lijst).
- **Proposal:** vier additions.
  1. Nieuw type `Domain = 'CONTAINMENT' | 'FORENSIEK' | 'HERSTEL' | 'JURIDISCH' | 'EXTERNE_COMMS' | 'INTERNE_COMMS' | 'PERSONEEL' | 'BEDRIJFSPROCES' | 'GELD' | 'EXTERNE_PARTIJEN'` in `lib/types.ts`.
  2. `domain?: Domain` op `DecisionNodeData`. Blokkerend zodra `graph.features.outcomeScoring === true`.
  3. `owner?: Role` en `consulted?: Role[]` op `DecisionNodeData`. Owner heeft precedentie boven per-optie `allowedRole` bij ambiguïteit.
  4. `domains?: Domain[]` per rol in `ROLE_META` (`lib/types.ts:17`).
- **Migration:** bestaande scenario's blijven werken (`domain === undefined` → MANDAAT valt op slider). Bestaande per-optie `allowedRole` blijft leidend zolang `owner` niet gezet.

### Gap 9 — Rol-set uitbreiden of remappen
- **Gap:** spec-rollen `SECURITY_LEAD`, `RETAINER_LIAISON`, `BUSINESS_OWNER`, `FINANCE_PROC`, `CRISIS_LEAD` ↔ huidige `ciso`, `ceo`, `ops_manager`, `cfo`. Sommige zijn synoniem, `RETAINER_LIAISON` echt nieuw.
- **Needed for:** §4.1 (mapping rol→domein), §7.5 (retainer-partij).
- **Proposal:** géén hernoeming (breaking). Kleinst mogelijk: **behoud bestaande `Role`-set, map spec-namen intern**. Voor `RETAINER_LIAISON` optioneel `retainer_liaison` toevoegen als extra rol (achter een feature-flag), maar dit is te kiezen door de gebruiker — vraag in Aannamelijst.
- **Migration:** identity-mapping, bestaande scenario's ongewijzigd.

### Gap 10 — `escalationTrigger { atInject, targetHours }` op DecisionPoint
- **Gap:** geen escalatie-klok gekoppeld aan beslispunt.
- **Needed for:** §2 (data-model), §7.2 MANDAAT (`L = mediaan(t_escalatie − t_trigger) / t_doel`), §7.5 (per-partij vensters).
- **Proposal:** `escalationTrigger?: { atInject: string; targetHours: number }` op `DecisionNodeData` (en optioneel op `RoleAction`).
- **Migration:** ontbrekend → term uit MANDAAT valt weg, herweging over resterende termen (spec §7.9).

### Gap 11 — Rol-multiplexing en NPC-marker
- **Gap:** `Participant.role?: Role` is single-role. Geen NPC-vlag.
- **Needed for:** §4.2d (multiplexing), §7.2 (`p_i*` normaliseert naar gecombineerde rollen), §7.6 VOLHOUD (`N_eff` op basis van taakverdeling).
- **Proposal:** twee minimale additions.
  1. `Participant.playsRoles?: Role[]` naast bestaande `role`. Als `playsRoles` gezet is en niet-leeg, is dit gezaghebbend; anders wordt `role` als singleton geïnterpreteerd.
  2. `SessionState.npcRoles?: Role[]` — rollen die de facilitator speelt; besluiten van deze rollen tellen niet mee in scoring.
- **Migration:** ontbrekende velden → single-role gedrag zoals nu.

### Gap 12 — Facilitator-slider-invoer per procesdimensie in `REVIEW`
- **Gap:** huidige `FacilitatorRoundScore.score: -1 | 0 | 1` is één cijfer voor de héle ronde; §7.9 vereist per-dimensie slider 1–5 als terugval.
- **Needed for:** §7.9 (elk van de 7 procesdimensies wanneer meet-mechaniek ontbreekt), §7.5 (`q_j` handmatig), §7.6 (`O` overdrachtskwaliteit).
- **Proposal:** `SessionState.facilitatorProcessScores?: Array<{ roundIndex: number; dimensionId: ProcessDimensionId; value: 1|2|3|4|5; scoredAt: string }>`. UI: extra sliders in de REVIEW-fase van elke ronde (bestaande review-fase, geen aparte scoreomgeving).
- **Migration:** ontbrekend → dimensie levert `null` met reden "geen slider ingevuld en geen meet-data", weggenomen uit weging conform §7.9.

### Gap 13 — Gedeelde expressietaal voor `availableIf` en edge-condities
- **Gap:** vandaag zijn er drie parallel mini-DSL's: (a) `scoreRange {min, max}`, (b) special-node `predicate {op, value}`, (c) chaser-conditie discriminated union. Geen algemene edge-conditie, geen algemene optie-guard.
- **Needed for:** §2 (`Option.availableIf`), §6 (knock-on regels), §8 ("Één expressietaal, één parser, gedeeld met `availableIf`").
- **Proposal:** kleinst-mogelijke, backwards-compatible tussenoplossing:
  - Nieuw type `Expr = { kind: 'cumOutcome'; dim: OutcomeDimensionKey; op: '<'|'<='|'>'|'>='|'=='; value: number } | { kind: 'flag'; key: string; value?: boolean } | { kind: 'and' | 'or'; children: Expr[] } | { kind: 'not'; child: Expr }`. Discriminated union, geen string-parser.
  - `Option.availableIf?: Expr` op `DecisionNodeData.options[]`.
  - `GraphEdge.condition?: Expr` (opt-in, edges zonder condition gedragen zich zoals nu — via `sourceHandle`).
  - Chaser-condities kunnen op termijn migreren naar dit type; niet in scope hier.
- **Migration:** ontbrekende `availableIf` en `edge.condition` → gedrag onveranderd. Bestaande `scoreRange`/`predicate` blijven werken (parallel), migratie later.

### Gap 14 — `Option.effects: StateEffect[]` met `SET_FLAG`, `UNLOCK_INJECT`
- **Gap:** geen effect-mechaniek op een optie. Wel bestaan `flags`, chaser-op-flag en `pushesInject` op `RoleAction` (`lib/types.ts:191`), maar er is geen uniforme `effects[]`-lijst.
- **Needed for:** §2 (voorbeeld option-effects `SET_FLAG`, `UNLOCK_INJECT`), §6 (knock-on regels executeren aan einde ronde), §14 in de spec's "grijze optie met reden".
- **Proposal:** `effects?: StateEffect[]` op `DecisionNodeData.options[]` (en optioneel op `RoleAction`).
  - `type StateEffect = { type: 'SET_FLAG'; flag: string; value?: boolean } | { type: 'UNLOCK_INJECT'; injectId: string; probability?: number } | { type: 'BLOCK_OPTION'; optionId: string; reason: string }`
- **Migration:** ontbrekend → geen effecten, zoals nu.

### Gap 15 — Externe partijen als config-array met `w_j` en `κ_j`
- **Gap:** externe partijen zijn niet gemodelleerd als graph-config. Alleen NCSC/AP/IR-retainer bestaan als hard-coded machinerie.
- **Needed for:** §7.5 EXTERN.
- **Proposal:** `ScenarioGraph.externalParties?: Array<{ id: string; label: string; weight: number; toleranceHours: number; window?: { openHour: number; closeHour: number } }>`.
- **Migration:** ontbrekend → EXTERN valt op slider (§7.9). Bestaande scoring van AP/NCSC via `NotificationDraft.submittedAt` blijft de gezaghebbende bron voor die twee, `externalParties[]` breidt uit.

### Gap 16 — Herzieningsactie als expliciet event
- **Gap:** een participant die zijn besluit wijzigt overschrijft de vorige entry (`lib/session-store.ts:1193`), er blijft geen "herzien"-event over.
- **Needed for:** §7.4 ADAPT (`Se` = juiste herzieningen / materiële events).
- **Proposal:** wijziging is klein: **in plaats van overschrijven een tweede entry appenden** met dezelfde `participantId+roundIndex`, en de "actuele keuze" bepalen door hoogste `submittedAt`. Nieuw timeline-event `'decision_revised'`.
- **Migration:** rapportage die "de decision" van een participant per ronde gebruikt (`SubmittedDecision`) blijft werken (laatste entry). Nieuwe scoring leest de historie.

### Gap 17 — Aannames tagging bij besluit
- **Gap:** `SubmittedDecision.reasoning: string` is vrije tekst. Geen structuur voor premissen, feit/aanname-labels, falsificatietriggers.
- **Needed for:** §7.3 AANNAME.
- **Proposal:** `SubmittedDecision.premises?: Array<{ text: string; kind: 'fact' | 'assumption'; source?: string; falsificationTrigger?: string }>` naast bestaande `reasoning`.
- **Migration:** ontbrekend → AANNAME-dimensie valt op slider.

### Gap 18 — Unified append-only event stream met `kind`
- **Gap:** log data is verspreid over 6 `SessionState`-velden (`timeline`, `assessmentEvents`, `submittedDecisions`, `factChecks`, `injectAnnotations`, `pushedInjects`).
- **Needed for:** §2 ("EventLog append-only"), §9 (herberekenen uit log, idempotent).
- **Proposal:** geen dataduplicatie, wel een **read-view**: pure functie `getEventLog(session: SessionState): ExerciseEvent[]` die de 6 bronnen samenvoegt tot één chronologische discriminated-union stream. Blijft achter een export in het scoring-package; bestaande sessie-state ongewijzigd.
- **Migration:** N/A — read-view, geen schema-verandering.

### Gap 19 — Fase-overgangen als eigen event
- **Gap:** alleen `discussion_phase_changed` wordt als timeline-event geëmit; de vier RoundPhase-transities (inject→discussion→decision→review) niet allemaal.
- **Needed for:** §7.1 (start OVERLEG, vastklik KEUZE), §3 (fase-anker voor alle scoring).
- **Proposal:** timeline-event `'round_phase_changed'` met `{ roundIndex, fromPhase, toPhase }` op elke transitie in `round-phases.ts` en `session-store.ts`-mutaties die `roundPhase` wijzigen.
- **Migration:** additieve emissie; consumers negeren onbekende event-types.

### Gap 20 — Facilitator-inject markering op de inject zelf
- **Gap:** facilitator-inject onderscheidt zich nu alleen via timeline-event-type + aanwezigheid in `pushedInjects`; op de inject-payload staat geen `source: FACILITATOR`.
- **Needed for:** §3.1 ("verschijnen in het log als `source: FACILITATOR`"). Kleine gap, cosmetisch maar spec-vereiste.
- **Proposal:** `Inject.source?: 'scenario' | 'facilitator'` (`Inject.source: string` bestaat al — `lib/types.ts:443` — als vrije "MDR SOC" string; hernoemen of nieuw veld). Kleinst mogelijk: nieuw discriminatie-veld `Inject.origin?: 'scenario' | 'facilitator'`, default `'scenario'`.
- **Migration:** ontbrekend → gedrag onveranderd, defaults `'scenario'`.

### Gap 21 — Uitbreidbare placeholder-lijst per oefening
- **Gap:** `DynamicFillToken` is een fixed union van 5 tokens (`lib/graph/types.ts:71`). Spec-voorbeeld `{{TOPKLANT_1}}`, `{{ERP}}` kan een auteur niet toevoegen.
- **Needed for:** §2 (sleutel-waardelijst per oefening).
- **Proposal:** `ExerciseConfig.placeholders?: Record<string, string>` — vrije sleutel-waarde-map. `dynamic-fill.ts` gebruikt deze naast de bestaande fixed tokens; onbekende tokens uit deze map worden ingevuld.
- **Migration:** ontbrekend → gedrag onveranderd. Bestaande 5 tokens blijven werken.

### Gap 22 — Blokkerende validatie op onopgeloste placeholders + missing outcome-fields
- **Gap:** `validateGraph()` valideert een breed pakket, maar niet: onopgeloste `{{token}}`, ronde zonder `outcomeWeights`, optie zonder `outcomeVector`, decision zonder `domain`/`owner`, misroute zonder `correctRoute`, ronde zonder `designTimeMinutes`, ontbrekende externe-partij-refs, knock-on regel naar niet-bestaande node.
- **Needed for:** §2 (harde fout bij onopgeloste placeholder), §8 (blokkerende validatie-checklist).
- **Proposal:** toevoegen aan `validateGraph()` (`lib/graph/validate.ts:11`), elk als `severity: "error"`, gated door `graph.features.outcomeScoring` waar het over uitkomstvector-velden gaat (§7.9 tolerantie).
- **Migration:** bestaande scenario's zonder de nieuwe velden blijven valid zolang `features.outcomeScoring !== true`. Nieuwe scenario's kunnen opt-in strengere validatie krijgen.

### Gap 23 — `Option.debriefNote` naam-consolidatie (cosmetisch)
- **Gap:** spec noemt `debriefNote`; code heeft `facilitatorCommentary` **en** `lessonLearned` (beide op optie én op RoleAction).
- **Needed for:** §2 (JSON-schema in de spec toont `debriefNote`).
- **Proposal:** géén hernoeming (breaking). In `ALIGNMENT.md`/scoring-package: `debriefNote := lessonLearned ?? facilitatorCommentary`. Auteur kan beide invullen; scoring gebruikt de expliciete `lessonLearned` als canonieke bron.
- **Migration:** N/A.

### Gap 24 — Multi-instance decisions (§5.1 vier gelijktijdige beslispunten per ronde)
- **Gap:** de spec beschrijft in §5.1 vier gelijktijdige DecisionPoints in ronde 2, elk met eigen domein/eigenaar. De builder ondersteunt meerdere `decision` nodes in een graaf, maar de engine (`stepFromNode`, `lib/graph/engine.ts:52`) is single-active — er is altijd één `currentNodeId`.
- **Needed for:** §5.1 (gelijktijdige beslispunten per rol per ronde).
- **Proposal:** onderzoek pas te doen zodra §5 basisondersteuning staat. Kleinst mogelijk: `DecisionNodeData.parallel?: boolean` op dochter-nodes van dezelfde ronde, engine verzamelt ze samen tot ronde-KEUZE-set. Buiten scope voor deze eerste ronde; **vermeld als open architectuur-vraag**.
- **Migration:** N/A — nog geen concreet voorstel, alleen agenda-item.

---

## 3. Assumption list

### 3.1 De vijf vragen uit §12 van de spec (verbatim)

1. Staat er al een richttijd per ronde in de builder, of wordt `designTimeMinutes` een nieuw veld?
2. Kent de builder domein of eigenaar per beslispunt, of is dat nu impliciet?
3. Zit het crucial/info-onderscheid al op injects, en onder welke naam?
4. Bestaat `visibleTo` per rol al, of ziet iedereen nu alles?
5. Loopt de klok in de app synchroon met scenariotijd, of per ronde versneld? Dit raakt `Δ_ref`, `κ_deel` en `κ_j` direct.

**Voorlopige antwoorden uit code-lezing (te bevestigen):**
- (1) `RoundNodeData.timerMinutes` is een **countdown**, geen ontwerp-referentietijd. `designTimeMinutes` wordt een nieuw veld — zie gap 1.
- (2) Nee. Eigenaarschap is versnipperd (per-optie `allowedRole` + per-actie `allowedRoles`), domein bestaat niet. Zie gap 8.
- (3) Nee. Dichtstbijzijnd is `urgency` (presentatie) en `nis2Relevant` (compliance-flag) — semantisch anders. Zie gap 3.
- (4) Nee. `targetRoles` bepaalt de push-recipient (routing), niet exclusieve zichtbaarheid. Iedereen ziet alle scenario-injects in de feed. Zie gap 4.
- (5) Sessie-klok loopt in **realtime** met de RoundPhase-fasen (`ROUND_PHASE_TIMINGS`, `lib/engine/round-phases.ts:11`). Fase-durations schalen met de ronde-budget-seconds — een ronde is dus tijds-gecomprimeerd t.o.v. scenariotijd, maar duurmetingen binnen de fase zijn realtime wall-clock. `Δ_ref` moet dus in **realtime-minuten** worden geconfigureerd. `κ_j` (spec 7.5, in uren) moet **in scenariotijd** worden geconfigureerd of expliciet omgerekend — vraag: welke van de twee wordt de canonieke tijdruimte voor `κ_j` en `t_j`? Voorstel: **realtime** in de app (want dat is wat de spelers ervaren), met een `scenarioSpeedFactor` op de graph indien latere ronden per gecomprimeerd (nu impliciet 1×). Te bevestigen.

### 3.2 Overige aannames (correcteer waar nodig)

1. De huidige `AssessmentDimensionKey`-set (8 procesdimensies) blijft naast een nieuwe `OutcomeDimensionKey`-set bestaan; ze worden niet samengevoegd. Spec §7.8 zegt "uitkomst en proces náást elkaar rapporteren, nooit optellen" — ik interpreteer dat óók als "twee aparte types in het model".
2. `bobPhase` op ronde is een label voor de participants, staat orthogonaal op de scoring, blijft ongewijzigd.
3. Bestaande `evaluationAspects: EvaluationAspect[]` op nodes (`lib/graph/types.ts:30`) is een opt-in UI-filter voor de inspector, geen scoring-configuratie. Ik gebruik dit niet in `@exercise/scoring`; scoring leest de daadwerkelijke velden. Bevestig?
4. `graph.features` (`GraphFeatures`, `lib/graph/types.ts:244`) heeft nu `reliability | compliance | scoring`. Ik stel voor een vierde flag `outcomeScoring: boolean` toe te voegen zodra gap 2 landt — zo kan een auteur per scenario opt-inen. Alternatief: opnieuw definiëren van `scoring` als "outcomeScoring inbegrepen". Bevestig welke.
5. Rollen: spec `RETAINER_LIAISON` heeft geen direct equivalent. Wordt dat een nieuwe rol (`retainer_liaison`) of een sub-rol van `ciso`/`ceo`? Advies: nieuwe rol, maar bevestig.
6. Rollen: spec `CRISIS_LEAD` interpreteer ik als synoniem van `ceo` in de huidige set (crisis-leiding), niet als aparte rol. Bevestig.
7. Rollen: `SECURITY_LEAD` = `ciso`. Bevestig.
8. Rollen: `BUSINESS_OWNER` = `ops_manager`, `FINANCE_PROC` = `cfo`. Bevestig.
9. `SupervisionArea` (`lib/engine/supervision.ts:14`) is NIS2-audit-getagd, **niet** de operationele domein-as uit spec §4.1. Ik behandel de twee als orthogonaal; `Domain` wordt een nieuwe as. Bevestig — of moet één van de twee gemergeed worden?
10. De huidige `special`-nodes (`journalist_qa`, `ap_notification`, `ransomware_negotiation`) blijven als losse mini-flow-simulaties bestaan en scoren onafhankelijk van de zes uitkomstdimensies. Spec §11 sluit "vrije-tekstantwoorden door AI beoordeeld" uit — `journalist_qa` en `ransomware_negotiation` gebruiken vaste `SpecialChoice`-opties (`lib/types.ts:489`), dus geen AI-vrije-tekst. In lijn met spec. Bevestig.
11. Rol-multiplexing (gap 11): huidige `ROLE_FALLBACK` (`lib/types.ts:134`) is *routing*-fallback (afwezige rol → andere rol krijgt de inject). Dat is niet hetzelfde als spec-multiplexing (één persoon speelt meerdere rollen). Ik behandel ze als aparte concepten en laat de fallback ongewijzigd. Bevestig.
12. Er is nu **geen** één-file JSON-export voor een scenario-graaf, alleen persist via `db.ts`/`template-store.ts`. Spec §8 vereist "exporteerbaar en importeerbaar als één leesbaar JSON-bestand en te diffen in git". Ik neem aan dat dit óók een deliverable is voor de `@exercise/scoring`-fase of daarvoor; bevestig timing.
13. De scoring-package `@exercise/scoring` wordt **puur** (geen state, geen I/O). Alle handmatige facilitator-invoer (§7.9 sliders) komt via de bestaande `REVIEW`-fase in de UI; het scoring-package leest ze uit de session-state. Bevestig dat de scoring-package geen eigen UI krijgt (spec zegt: "geen aparte facilitator-scoreomgeving; de review-fase ís die plek").
14. `scoringVersion` (spec §9): ik stel voor `@exercise/scoring` exporteert een constante `SCORING_VERSION = '1.0.0'` die in elk rapport verschijnt. Nieuwe formule-tweaks bumpen de patch-versie; gewicht-updates bumpen minor; dimensie-toevoeging bumpen major. Bevestig.
15. Property-tests en golden vectors (spec §9): unit-tests draaien via Vitest of Jest — repo heeft nog geen test-framework aan boord (`package.json` te checken). Aannemen dat Vitest wordt geïntroduceerd samen met `@exercise/scoring`. Bevestig.

---

# Deel B — Adaptieve rolbezetting, twee modi, Event Mode

Deel B modificeert Deel A op drie punten en voegt een tweede uitvoeringsmodus (Event Mode) toe met reveal + leaderboard + PDF. Dit deel breidt de mapping en de gap-lijst uit; het vervangt niets. Waar Deel B expliciet iets in Deel A wijzigt is dat gemarkeerd (**"Wijzigt Deel A §X"**).

## 4. Mapping table — Deel B

### 4.1 Adaptieve rolbezetting (Deel B §1) — wijzigt Deel A §4

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| `domainOwnership` — geordende eigenaarsketen per domein (§1.1) | **`— missing —`** | dichtstbijzijnd `ROLE_FALLBACK` (`lib/types.ts:134`) is *routing*-fallback per rol (afwezige rol → wie krijgt de inject), niet per domein en niet met `CRISIS_LEAD` als expliciet sluitstuk | zie gap 25 |
| `effectiveOwner(domain)` bij sessie-start (§1.2) | **`— missing —`** | resolutie gebeurt nergens; besluit-eigenaarschap is nu ad-hoc per-optie `allowedRole` (`lib/graph/types.ts:91`) | zie gap 26. Direct afhankelijk van gap 8 (`domain` op DecisionNode) uit Deel A |
| `roleResolution` als immutable snapshot in event-log (§1.2) | **`— missing —`** | `injectRoutePlan` (`lib/types.ts:719`) is een routing-snapshot met versionering (`plottedAt`, `presentRolesAtPlot`), semantisch verwant maar op *inject*-niveau, niet op *domein*-niveau | zie gap 26 |
| `visibleTo`-doorroutering bij onbezette rol (§1.3) | Deels: `ROLE_FALLBACK` in `inject-routing.ts:11` routeert een missing target-role naar een fallback-rol | `lib/inject-routing.ts:20-27` | mechaniek bestaat, maar (a) op *rol*-niveau i.p.v. *domein*, (b) faalt bij `visibleTo`-mechaniek (gap 4) die nog niet bestaat |
| Co-sign vervalt op onbezette rol (§1.3) | **`— missing —`** | afhankelijk van gap 7 (`requiresCosign`) — zodra die bestaat moet de resolutie hem uitfilteren wanneer geen bezetting |
| `distinctOwners` — aantal verschillende eigenaren over beslispunten (§1.5) | **`— missing —`** | af te leiden zodra gap 8 (`domain`, `owner`) én gap 25/26 er zijn — geen apart veld nodig, wél een `roleResolutionSummary` in scoring-package |
| `rolCoverage` — bezette domeinen / totaal (§1.5) | **`— missing —`** | idem — af te leiden. Moet in kop van elk rapport. Zie gap 26 (bijproduct) |
| `DecisionPoint.required: boolean` (§1.6) | **`— missing —`** | `DecisionNodeData.advancesGraph?: boolean` (`lib/graph/types.ts:104`) is een gerelateerd maar orthogonaal veld (bepaalt of de graph blokkeert op de decision, niet of het beslispunt op de setlist staat) | zie gap 27 |
| `required=false` vervalt onder team-drempel (§1.6) | **`— missing —`** | | zie gap 27 |

### 4.2 Twee modi (Deel B §2, §3) — wijzigt Deel A §7.9

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| `mode: 'ASSESSMENT' | 'EVENT'` op de oefening | **`— missing —`** | dichtstbijzijnd `ExerciseConfig.aiIntensity` / `specialsMode` (`lib/types.ts:558-559`) — dat zijn feature-flags, geen uitvoeringsmodus. `SimulationMode = 'event' | 'training'` (`lib/types.ts:146`) bestaat, maar wordt in het huidige model bijna nergens gebruikt (`SessionState.mode`, `lib/types.ts:699`) en betekent iets anders (competitie-tone vs. leer-tone) — semantiek moet expliciet worden neergezet | zie gap 28. `SimulationMode` kan mogelijk hergebruikt, mits herbevestigd. Zie assumption 3.16 |
| Meetbaarheids-matrix per (dimensie × modus) (§3) | **`— missing —`** | dit is scoring-package logica — dimensie `MANDAAT`/`DELEN` vallen in `EVENT` uit de weging | scoring-package deliverable |
| Dimensie-return `{ value, dataQuality, reason }` (§3) | Deels: `AssessmentEvent { value, source, note }` (`lib/engine/types.ts:68`) bevat `note`, geen structurele `dataQuality` of `reason` | | scoring-package output-shape, geen store-schema-wijziging |

### 4.3 Event Mode — architectuur (Deel B §4)

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Groep als eerste-klas-entiteit (`Group`) (§4.1) | **`— missing —`** | `Participant` (`lib/types.ts:578`) is individu. `SessionState.participants: Participant[]` heeft geen team-groepering behalve via `Participant.team?: string` (vrije string, niet gemodelleerd als entiteit met eigen state) | zie gap 30 |
| Groep-inzending idempotent op `(groep, beslispunt)` (§4.3) | Deels: `submittedDecisions` filtert op `(participantId, roundIndex)` (`lib/session-store.ts:1193`) — dus per participant per ronde, niet per groep per beslispunt | zie gap 30, gap 36 |
| Host-scherm / facilitator-scherm / iPad-scherm (§4.1) | **`— missing —`** | huidige UI kent facilitator (`app/admin/dashboard`) en participant (`app/join`). Er is geen apart "host presenter"-scherm gecombineerd met "los facilitator-scherm" | UI-deliverable, niet builder-schema |
| `LOCK` fase (§4.2) | **`— missing —`** | huidige RoundPhase = `'inject' | 'discussion' | 'decision' | 'review'` (`lib/types.ts:147`). `LOCK` is een nieuwe transitie tussen `decision` en `review` (of tussen `KEUZE` en `REVEAL` in EVENT-terminologie) — server-side moment waarop niets meer kan wijzigen | zie gap 31 |
| REVEAL fase (§4.2) | Deels: bestaande `review`-fase kan semantisch dienen als REVEAL, maar de EVENT-reveal heeft eigen inhoud (verdeling van keuzes, weging pas nu tonen, causale keten). Zie gap 34 |
| Server-side tijdstempels (§4.3) | Server-side is dominant: `pushTimeline(session, ..., data)` gebruikt `Date.now()` (server), `SubmittedDecision.submittedAt = new Date().toISOString()` (server, in `session-store.ts:1187`) | `lib/session-store.ts` throughout | ✓ voor de meeste events. Uitzondering: `factCheck.taggedAt`, `injectAnnotation.createdAt`, `participantFeedback.submittedAt` — verifiëren welke client-side kunnen zijn |
| Join met code of QR, geen account (§4.3) | `SessionState.joinCode: string` (`lib/types.ts:687`) — ✓ bestaat | | QR-genereren is UI-taak |
| Host kan ronde forceren, niet-inzending mag markeren (§4.3) | Deels: facilitator kan al `next_round` triggeren zonder dat elke participant heeft ingezonden. Wat mist: **niet-inzending als eigen keuze** met een uitkomstvector (Deel B §7.1) — zie gap 32 |

### 4.4 Leaderboard, reveal en punten (Deel B §5, §6) — wijzigt Deel A §11

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Punten `punten(r) = round(100 · (RONDE_UITKOMST(r) + 1) / 2)` (§5.1) | **`— missing —`** | afgeleid uit uitkomstvector (gap 2), pure scoring-functie in scoring-package. Geen schema-wijziging nodig |
| Tie-break: zwaarste dimensie, dan besluitmoment (§5.1) | **`— missing —`** | scoring-package, geen store-schema |
| Reveal-opbouw (weging, keuze-verdeling, vector-per-optie, stand) (§5.2) | **`— missing —`** | rendering-taak; leest uit scoring-package output. Vereist dat weging **niet vroeger** aan participants wordt getoond — zie gap 34 (anti-gaming: weging pas onthullen tijdens reveal) |
| Verdeling van keuzes over groepen (§5.2 punt 2) | Deels: `submittedDecisions` bevat wie-wat-koos; groeperen per groep vereist eerst gap 30 (Group) |
| PDF-renderer `ASSESSMENT` variant (§6) | **`— missing —`** | `lib/report/export.ts` bestaat (9.8K) — te onderzoeken of het al PDF is of alleen JSON/markdown-export | zie gap 37. Buiten scoring-package, aparte renderer die scores als input krijgt |
| PDF-renderer `EVENT` one-pager (§6) | **`— missing —`** | zie gap 37 |
| Anti-gaming: gewichten per ronde niet vooraf tonen (§5.3) | **`— missing —`** — huidige builder toont geen gewichten omdat er nog geen zijn; zodra gap 2 landt moet reveal-gating er meteen op | zie gap 34 |
| Opties niet in vaste volgorde presenteren (§5.3) | **`— missing —`** | UI-render-optie, geen schema — implementatie-detail |
| Geen tussenstand tijdens de ronde (§5.3) | **`— missing —`** — huidige mode-flow zou een client-side "live score" kunnen tonen; moet server-side geblokkeerd worden tot na LOCK | zie gap 34 |

### 4.5 Deel B §7 — extra mechanica

| Model quantity | Where it lives now | Field path | Notes |
|---|---|---|---|
| Impliciete "geen besluit"-optie per beslispunt met eigen vector (§7.1) | **`— missing —`** | er is geen impliciete-optie mechaniek. Timer verloopt → geen event, geen scoring | zie gap 32 |
| `implicit: true` marker op impliciete opties (§7.1) | **`— missing —`** | onderdeel van gap 32 |
| Zekerheidstap 1–5 per inzending (§7.2) | **`— missing —`** | `SubmittedDecision` heeft `reasoning: string`, geen numerieke zekerheid | zie gap 33. Vervangt in EVENT-mode de premissen-mechaniek uit Deel A §7.3 (gap 17) |
| `KALIBRATIE = − corr(zekerheid, RONDE_UITKOMST)` (§7.2) | **`— missing —`** | scoring-package afleiding zodra gap 33 er is |
| Divergentiemeter — entropie over keuzeverdeling per beslispunt (§7.3) | **`— missing —`** | pure afleiding uit `submittedDecisions` + groepen (gap 30). Geen store-schema |
| Scenario health report — cross-oefening statistiek (§7.4) | **`— missing —`** | vereist scenario-versionering + cross-session store. Buiten `@exercise/scoring`; separate deliverable | zie gap 38 |
| Rolkaarten (papier, generator uit scenario) (§7.5) | **`— missing —`** | generator leest `visibleTo` (gap 4) + `owner`/`domain` (gap 8) + `roleResolution` (gap 26). Rendering-taak |
| Groepsdruk-inject "3 van 9 groepen hebben geïsoleerd" (§7.6) | **`— missing —`** | groep-model (gap 30) is de bron; host-scherm rendert. Optionele feature per ronde — flag op ronde |
| Dry-run modus (facilitator speelt alleen) (§7.7) | **`— missing —`** | testing-modus; QA-tool. Buiten builder-schema |
| Ronde-`escalationHeadline: string` — verplicht (§7.8) | **`— missing —`** | `RoundNodeData` heeft `title`, `situation_update`, `openingPrompts[]`, `facilitatorPerspective` — geen expliciete "één regel escalatie voor de host om voor te lezen" | zie gap 29 |

---

## 5. Gap list — Deel B

Doorlopende nummering vanaf gap 24. Aannames identiek aan Deel A: elke gap komt neer op **kleinst mogelijke additie, backwards compatible, default is huidige gedrag**.

### Gap 25 — `ScenarioGraph.domainOwnership`
- **Gap:** geen geordende eigenaars-fallbackketen per domein. Huidige `ROLE_FALLBACK` is per-rol en dient routing, niet eigenaarschap.
- **Needed for:** Deel B §1.1, §1.2 (effectiveOwner resolutie), §1.3 (doorroutering onbezette rol).
- **Proposal:** `ScenarioGraph.domainOwnership?: Partial<Record<Domain, Role[]>>` — geordende lijst per domein, laatste positie is meestal `CRISIS_LEAD` (of `ceo` in huidige rol-set) als sluitstuk. Default-implementatie zit in het scoring-package (spec §1.1 tabel) en wordt gebruikt wanneer de graph het veld niet definieert.
- **Migration:** afwezig → gebruik defaults uit spec §1.1. Bestaande scenario's ongewijzigd.

### Gap 26 — `SessionState.roleResolution` (immutable snapshot)
- **Gap:** geen éénmalige rol-resolutie bij sessie-start.
- **Needed for:** Deel B §1.2 (reproduceerbaarheid), §1.5 (`rolCoverage`, `distinctOwners` in rapport-kop).
- **Proposal:** `SessionState.roleResolution?: { resolvedAt: number; effectiveOwners: Record<Domain, Role | 'NPC'>; rolCoverage: number; distinctOwners: number }`. Berekend en gefreezed bij `session_started`; nooit meer gemuteerd.
- **Migration:** afwezig → scoring-package berekent runtime uit `participants` + `domainOwnership`, maar zonder de vaste snapshot is de score niet meer reproduceerbaar bij late participant-wijziging. Voor bestaande sessies: N/A (die hebben geen Deel B nodig).

### Gap 27 — `DecisionNodeData.required`
- **Gap:** beslispunten kunnen niet als "optioneel" gemarkeerd worden voor kleine teams.
- **Needed for:** Deel B §1.6 (beslisdruk schalen).
- **Proposal:** `required?: boolean` op `DecisionNodeData`, default `true`. Aparte drempel `graph.optionalDecisionThreshold?: number` (aantal `distinctOwners`) waaronder `required=false` beslispunten worden overgeslagen; default 3.
- **Migration:** afwezig → alle beslispunten worden gespeeld (huidige gedrag).

### Gap 28 — `SessionState.mode: 'ASSESSMENT' | 'EVENT'`
- **Gap:** de tweelaags uitvoeringsmodus bestaat niet als expliciete state. `SimulationMode = 'event' | 'training'` (`lib/types.ts:146`) heeft de juiste string maar wordt semantisch verwarrend (Deel B `EVENT` = zaalevent, huidige `SimulationMode.event` = competitieve tone).
- **Needed for:** Deel B §2 (twee modi als ontwerp-eis), §3 (dimensie-meetbaarheid per modus).
- **Proposal:** twee opties:
  - **Optie A** (kleinst): hergebruik `SimulationMode`, herbenoem semantiek in documentatie zonder code-hernoeming. Betekenis wordt: `'event'` = zaalevent met host, `'training'` = één-team assessment.
  - **Optie B**: nieuw veld `ExerciseConfig.executionMode?: 'assessment' | 'event'`, default `'assessment'`, orthogonaal aan `SimulationMode`.
- Voorstel: **Optie A**, mits bevestiging dat huidig gebruik van `SimulationMode` beperkt is. Optie B als de huidige semantiek elders is verankerd.
- **Migration:** Optie A: bestaande sessies met `mode: 'training'` blijven "assessment"-modus; `mode: 'event'` bestaande sessies moeten worden nagelopen. Zie assumption 3.16.

### Gap 29 — `RoundNodeData.escalationHeadline`
- **Gap:** ronde heeft geen expliciete "één regel escalatie voor het host-scherm"-veld.
- **Needed for:** Deel B §7.8 (verplicht per ronde) én §4.1 (grote scherm-inhoud).
- **Proposal:** `escalationHeadline?: string` op `RoundNodeData`. In EVENT-mode blokkerend valideren als leeg; in ASSESSMENT-mode waarschuwing.
- **Migration:** afwezig → bestaande scenario's krijgen een waarschuwing (niet-blokkerend) om achteraf in te vullen.

### Gap 30 — `Group` als eerste-klas-entiteit
- **Gap:** in EVENT is een groep de scoring-eenheid, niet een participant. Op dit moment zit team-informatie in de vrije-tekstveld `Participant.team?: string`.
- **Needed for:** Deel B §4 (statemachine per groep), §5 (leaderboard per groep), §6 (one-pager per groep), §7.3 (divergentie tussen groepen).
- **Proposal:** nieuwe entiteit `Group { id: string; name: string; participantIds: string[]; joinedAt: number }` op `SessionState.groups?: Group[]`. Deelnemer wordt lid van een groep via nieuw veld `Participant.groupId?: string` (bestaande `team` blijft als display-string). Beslissingen in EVENT-mode: `SubmittedDecision.groupId?: string` — één submissie per groep per beslispunt, idempotent op dat paar.
- **Migration:** afwezig → ASSESSMENT-mode werkt zoals nu (`groups`, `groupId` en `SubmittedDecision.groupId` allemaal `undefined`).

### Gap 31 — `LOCK` fase op RoundPhase
- **Gap:** geen expliciete "geen mutaties meer, reveal-berekening klaar"-toestand tussen `decision` en `review`.
- **Needed for:** Deel B §4.2 (statemachine), §5.3 (anti-gaming: geen tussenstand tijdens ronde), §5.2 (reveal-opbouw).
- **Proposal:** uitbreiden `RoundPhase = 'inject' | 'discussion' | 'decision' | 'lock' | 'review'`. `lock` is server-authoritatief; alle mutation-endpoints controleren op `session.roundPhase !== 'lock'` voor decision-inzendingen. `session-store.ts:1171` — bestaande check op `inject|review` uitbreiden.
- **Migration:** default `discussion → decision → review` (huidige transitie). Nieuwe transitie `decision → lock → review` alleen in EVENT-mode of expliciet.

### Gap 32 — Impliciete "geen besluit" optie met vector
- **Gap:** timer verloopt = geen event = geen scoring-input. Deel B §7.1 vereist dat non-decision een keuze is met eigen vector.
- **Needed for:** Deel B §7.1 (timer echt maken, leaderboard sluitend).
- **Proposal:** op `DecisionNodeData.options[]` kan één optie `implicit?: boolean` hebben, en de auteur vult `outcomeVector` (gap 2) voor deze optie in. Bij LOCK zonder inzending schrijft het scoring-package een virtuele `SubmittedDecision { actionId: <implicit-id>, submittedAt: <lock-time>, implicit: true }`. Als geen `implicit`-optie gedefinieerd is: fallback-vector uit spec §7.1 (`{ CONT: -1, FOR: 0, BC: -1, JUR: -1, VER: 0, KOS: 0 }`).
- **Migration:** afwezig → huidige gedrag (geen scoring bij time-out) in ASSESSMENT-mode. In EVENT-mode wordt fallback-vector gebruikt bij time-out; bestaande scenario's kunnen `implicit`-opties toevoegen.

### Gap 33 — `zekerheid: 1..5` per inzending
- **Gap:** geen numerieke zekerheid per keuze.
- **Needed for:** Deel B §7.2 (KALIBRATIE), en in EVENT-mode als vervanging voor gap 17 (premissen-mechaniek).
- **Proposal:** `SubmittedDecision.confidence?: 1 | 2 | 3 | 4 | 5` toevoegen (`lib/types.ts:274`). UI: één tik bij het bevestigen van de inzending.
- **Migration:** afwezig → KALIBRATIE valt weg uit rapport. In EVENT-mode kan het optioneel verplicht worden gesteld op UI-niveau, in ASSESSMENT-mode blijft het optioneel.

### Gap 34 — Reveal-gating: gewichten en score verborgen tot na LOCK
- **Gap:** zodra gewichten (gap 2 — `outcomeWeights` op ronde) bestaan, moet de participant-view ze niet vroeg tonen. En de tussenstand mag pas na LOCK berekend worden.
- **Needed for:** Deel B §5.3 (anti-gaming), §5.2 (reveal is het product).
- **Proposal:** twee stukken.
  1. Server-side: participant-projectie (`toParticipantState()` in `session-store.ts`) stript `outcomeWeights` uit `RoundNodeData` en alle score-informatie tot `session.roundPhase === 'review'` of later.
  2. Client-side: `activeDecision` projectie stript `outcomeVector` uit opties tijdens `discussion`/`decision`/`lock`, onthult tijdens `review`. Bestaande `qualityRank` reveal (`ActiveDecisionState.options[].qualityRank`, `lib/types.ts:757` — al gescrubd tijdens play) is het model — zelfde patroon toepassen.
- **Migration:** additieve regels in bestaande projectie-functie; geen schema-wijziging.

### Gap 35 — Server-time bevestigen voor alle scoring-events
- **Gap:** Deel B §4.3 eist dat *alle* scoring-relevante tijdstempels van de server komen. `factCheck.taggedAt` en `injectAnnotation.createdAt` — verifiëren of die server-side of client-side worden gezet.
- **Needed for:** Deel B §4.3 (aanvechtbaar leaderboard voorkomen).
- **Proposal:** audit van de 5-6 timestamp-velden in `SessionState` — elke die scoring-input is (BESLUIT, ADAPT, DELEN) moet server-side gezet worden bij API-ontvangst. Waar client-side: verplaatsen naar server. Detail-audit hoort in fase 1 als voorbereiding op scoring-package.
- **Migration:** interne wijziging, geen schema.

### Gap 36 — Idempotente inzending op `(group, decisionPoint)`
- **Gap:** huidige idempotentie is `(participantId, roundIndex)` (`lib/session-store.ts:1193`). In EVENT-mode moet dat `(groupId, decisionNodeId)` worden zodat één iPad die dubbel klikt niet twee submissies produceert.
- **Needed for:** Deel B §4.3 (idempotentie bij verbindingsverlies).
- **Proposal:** submit-endpoint accepteert `groupId` én `decisionNodeId` en filtert bestaande submissies op dat paar. Bestaande `(participantId, roundIndex)`-pad blijft voor ASSESSMENT.
- **Migration:** afhankelijk van gap 30 (Group). Zonder Group: geen wijziging.

### Gap 37 — PDF-renderer (twee varianten)
- **Gap:** `lib/report/export.ts` (9.8K) bestaat maar dekking onbekend; spec-vereiste is PDF-export.
- **Needed for:** Deel B §6.
- **Proposal:** aparte package `@exercise/report` naast `@exercise/scoring`. Renderer krijgt `ScoringResult` (uit scoring-package) + `SessionState` als input, produceert twee PDF-varianten. Buiten scoring-package — die blijft puur.
- **Migration:** N/A — nieuwe deliverable.

### Gap 38 — Scenario health cross-session store
- **Gap:** geen store waarin geaggregeerde statistiek over meerdere oefeningen van hetzelfde scenario staat.
- **Needed for:** Deel B §7.4 (scenario health report).
- **Proposal:** buiten scope voor Fase 0-3 (spec-scoring); noteren als toekomstige deliverable.
- **Migration:** N/A.

### Gap 39 — Domain-fallback bij `visibleTo` en misroute
- **Gap:** wanneer `visibleTo` (gap 4) een onbezette rol noemt, moet de inject naar `effectiveOwner(domainOfRole)` gaan. Zelfde voor `correctRoute` in een misroute (gap 6).
- **Needed for:** Deel B §1.3.
- **Proposal:** implementatie-regel in scoring/engine: elk gebruik van een `Role`-veld dat bezet moet zijn, gaat door `effectiveOwnerFor(role)` — helperfunctie in het scoring-package. Als de rol één domein heeft, resolve naar dat domein; anders naar de eerste domein in de rol-`domains[]` (gap 8, `Role.domains`).
- **Migration:** vergt gap 8, 25, 26. Geen schema-wijziging.

### Gap 40 — Fasetimer per ronde in EVENT-mode
- **Gap:** Deel B tabel §2 zegt "vaste fasetimer, host bepaalt" voor EVENT vs. "teamtempo, richttijd per ronde" voor ASSESSMENT. Nu heeft `RoundNodeData.timerMinutes` één betekenis.
- **Needed for:** Deel B §2, §3 (in EVENT `Δ_ref = fasetimer`).
- **Proposal:** interpretatie-regel: in EVENT-mode wordt `timerMinutes` de harde fasetimer; in ASSESSMENT-mode is `timerMinutes` de zichtbare countdown en `designTimeMinutes` (gap 1) de scoring-noemer. Geen nieuw veld — semantische regel.
- **Migration:** geen. Vergt gap 1 + gap 28.

---

## 6. Assumption list — Deel B

### 6.1 De vijf vragen uit Deel B §9 (verbatim)

1. Zijn de fallbackketens in §1.1 zoals wij het zouden doen, of wijkt jullie praktijk af per domein?
2. In Event Mode: één vaste fasetimer voor alle rondes, of per ronde instelbaar?
3. Mag een groep in Event Mode een keuze herzien binnen de `KEUZE`-fase? Dit raakt `ADAPT` direct.
4. Krijgen deelnemers hun one-pager tijdens het evenement of na goedkeuring door ons?
5. Is `RETAINER_LIAISON` in Event Mode een groepsrol, of spelen wij die altijd vanaf het podium?

**Voorlopige antwoorden uit code-lezing (te bevestigen):**
- (1) Onbeantwoordbaar uit code — dit is beleid, geen artefact in het repo. De spec-defaults in Deel B §1.1 zijn een redelijke start; wachten op bevestiging of afwijking per domein.
- (2) Uit code niet te bepalen. Voorstel gap 40: hergebruik `timerMinutes` met modus-afhankelijke semantiek. Bevestig of dat volstaat, of dat EVENT een aparte `fixedPhaseTimerSeconds` op ronde nodig heeft.
- (3) Uit code: huidig `submittedDecisions`-mechanisme staat overschrijving toe (`existingDecisions` filter, `lib/session-store.ts:1193`). Als herzien mag: hou het huidige gedrag, maar leg **elke wijziging** als apart event vast (gap 16 uit Deel A). Als herzien niet mag in EVENT: server-side reject na eerste submit per `(group, decisionNodeId)`. Voorkeur nog niet bepaald.
- (4) Beleid — geen antwoord uit code. Renderer (gap 37) moet beide flows ondersteunen (direct downloaden vs. later releasen).
- (5) Beleid — geen antwoord uit code. Raakt gap 9 (rol-set uitbreiden). Zo lang `RETAINER_LIAISON` geen groepsrol is: hoeft ook niet in de rol-enum van de app; wél als domein-eigenaar in `domainOwnership` (gap 25). Als het een groepsrol wordt: wél `retainer_liaison` toevoegen aan `Role`.

### 6.2 Overige aannames — Deel B

3.16. **`SimulationMode` hergebruik**: gap 28 stelt Optie A voor (hergebruik van bestaand veld met nieuwe semantiek). Snelle grep toont dat `SessionState.mode` bijna nergens dwingend gebruikt wordt (`session-store.ts` initialisatie + `lib/types.ts:699` decl). Optie A lijkt veilig, maar bevestig dat er geen `SimulationMode.event`-tak in de UI is die iets anders doet dan Deel B EVENT bedoelt. Anders Optie B.

3.17. **`CRISIS_LEAD` als sluitstuk**: in huidige rol-set is `ceo` het dichtstbijzijnde equivalent (`team: 'crisis_management'`, beslist over losgeld, coördineert publieke communicatie). Voorstel: `CRISIS_LEAD` mapt op `ceo` in de default `domainOwnership`. Bevestig — of moet dit een separate rol worden?

3.18. **Groep-model vs. bestaande `team`-string**: `Participant.team?: string` is nu vrije tekst, waarschijnlijk niet gebruikt voor scoring. Ik neem aan dat gap 30 (`Group` entiteit) additief is en `team`-string mag blijven bestaan als display-veld. Bevestig.

3.19. **Fase-transities in EVENT vs. ASSESSMENT**: in ASSESSMENT gaat de flow direct van `decision` naar `review`; in EVENT komt `lock` ertussen. Dat vergt een modus-afhankelijke transitie in de statemachine. Ik neem aan dat één engine met een `if (mode === 'event')`-tak volstaat, geen aparte engine. Bevestig.

3.20. **PDF-renderer**: `lib/report/export.ts` bestaat maar ik heb 'm niet in detail bekeken. Als het al PDF genereert (bijv. via een lib) hoeven we alleen de payload aan te passen; anders is het een nieuwe renderer. Onderzoek in fase 6 (per bouwvolgorde Deel B §8), niet nu.

3.21. **Scenario-versionering voor "health report"** (gap 38): `ScenarioGraph.version: number` bestaat al (`lib/graph/types.ts:259`). Aggregatie zou op `(graph.id, graph.version)` moeten sleutelen — anders vermengt "health"-statistiek versies waarin de vector-vulling wezenlijk verschilt. Bevestig later; nu buiten scope.

3.22. **`domainOwnership` in graph vs. globaal**: gap 25 zet het op `ScenarioGraph` (per scenario). Alternatief: op `SessionState`/`ExerciseConfig` (per klant/oefening), zodat één scenario in twee organisaties met andere rol-structuren speelt. Beide zijn valide; voorstel: op `ScenarioGraph` **met** override-optie op `ExerciseConfig`. Bevestig.

3.23. **Bouwvolgorde**: Deel B §8 wijzigt de bouwvolgorde t.o.v. Deel A. Deze `ALIGNMENT.md` update is Fase 0 (uitgebreid). Voorstel voor Fase 1 blijft `@exercise/scoring` inclusief `mode` en `roleResolution` als input. Bevestig dat de volgorde in Deel B §8 leidt.

3.24. **PDF, leaderboard, punten expliciet in-scope volgens Deel B §11-wijziging** — dit vervangt Deel A §11 "buiten scope". Ik interpreteer dit als: PDF-renderer, leaderboard-berekening en punten-formule zijn in-scope voor de rebuild, maar (a) in aparte packages/renderers naast `@exercise/scoring`, en (b) klantprofielen, kroonjuweel-herkenning en AI-tailoring blijven buiten scope. Bevestig.

Stop hier. Wacht op review van Deel A + Deel B mapping + gaps + aannames vóór de volgende fase (`@exercise/scoring` + rol-resolutie in de engine + `OPSCHONING.md`).
