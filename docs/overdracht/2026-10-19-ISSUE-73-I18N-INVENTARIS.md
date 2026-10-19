# Issue #73 — i18n en runtime-configuratie: inventarisatie + migratieontwerp

**Datum**: 2026-10-19 · **Status**: inventarisatie, geen code gewijzigd
**Opdracht uit #73**: "Inventariseer en ontwerp de migratie eerst."

Dit document is opgesplitst in twee emmers, omdat de helft nu al te bouwen is:

- **Bucket A** — pure presentatie. Raakt geen opgeslagen data, geen override-vorm,
  geen scenario's. Direct bouwen, geen goedkeuring nodig. **73 vindplaatsen in 25
  bestanden.**
- **Bucket B** — alles dat verandert hóe overrides worden opgeslagen, gelezen of
  geversioneerd. Vereist expliciete goedkeuring vanwege de hard-stop-regel op
  data-migratie.

---

## 1. Huidige toestand (geverifieerd in de code)

### 1.1 De centrale claim uit #73 is waar — met één uitzondering

> "Teksten en rol-overrides worden wél opgeslagen maar de runtime leest ze niet."

**Geverifieerd: waar voor `texts` en `roles`, niet waar voor `scoring`.**

De volledige keten:

| Stap | Plek |
|---|---|
| Schrijven (UI) | `components/admin/hub/config-tab.tsx` (texts), `components/admin/hub/roles-tab.tsx` (roles), `components/admin/hub/scoring-tab.tsx` (scoring) — alle drie via `useOverrides()` in `components/admin/hub/override-editor.tsx:34` |
| Transport | `PUT /api/admin/overrides` → `app/api/admin/overrides/route.ts:18` — vervangt de **hele** blob, geen deep merge |
| Opslag | `lib/admin/overrides.ts:35` — één KV-key `admin:overrides`; zonder KV-env een `globalThis`-variabele (`lib/admin/overrides.ts:42`) |
| Terugleesen (admin-UI) | `GET /api/admin/overrides` → `app/api/admin/overrides/route.ts:11` |
| Runtime-read | **Alleen** `lib/admin/apply.ts:16` → `installRuntimeOverrides(o.scoring)` |
| Enige aanroeper van dat pad | `app/api/session/score/route.ts:23` |

`lib/admin/apply.ts:16` pakt uitsluitend `o.scoring`. Er bestaat **nergens** in
`app/`, `components/` of `lib/` een read van `o.texts` of `o.roles` buiten de
admin-editor zelf (geverifieerd met een repo-brede grep op `loadOverrides`,
`installAdminOverrides`, `AdminOverrides`, `RoleOverride`, `resolvePath`).

Concreet:

- **`scoring`-overrides werken wél** — ze landen via `vectorOverrideFor()` in
  `lib/scoring/graph-adapter.ts:313` in de echte score.
- **`texts`-overrides doen niets.** Runtime leest `lib/config/texts.ts` direct.
- **`roles`-overrides doen niets.** Runtime leest `ROLE_META` /
  `ROLE_BRIEFINGS` direct (`lib/types.ts:55`).
- `resolvePath()` in `lib/admin/overrides.ts:85` is geschreven voor precies deze
  merge en wordt **nul keer** aangeroepen. Dead code die het halve ontwerp al bevat.

De UI is hier eerlijk over: `config-tab.tsx:65-68` en `roles-tab.tsx:49-51` tonen
een amber waarschuwing dat de runtime nog uit code leest. Dat is dus geen bug maar
bewust half afgebouwd werk.

### 1.2 Overrides zijn ná refresh zichtbaar — in het editorpaneel

De acceptatiecriterium-eis "zichtbaar na refresh" is **al gehaald voor het
editorpaneel** (KV-persistentie + `GET` bij mount) en **niet gehaald voor de app**.
Het onderscheid is belangrijk: er hoeft geen opslag bij, alleen een leespad.

### 1.3 Twee bekende gaten in de opslag zelf

1. **Geen versie-veld.** `AdminOverrides` (`lib/admin/overrides.ts:22`) heeft alleen
   `updatedAt`. Geen `version`, geen schema-stempel. Een toekomstige vormwijziging
   is daarmee niet te detecteren.
2. **Array-encoding is afwijkend van de eigen documentatie.**
   `lib/admin/overrides.ts:25` zegt dat array-items als `"ESCALATION_LABELS.0"`
   worden opgeslagen. `config-tab.tsx:40` doet iets anders: het serialiseert de hele
   array als JSON-string onder de key `ESCALATION_LABELS:__array__`. Rol-arrays
   (`authorities`) gaan weer anders: als echte `string[]` in `roles[rol].authorities`
   (`roles-tab.tsx:18`). **Drie encodings voor hetzelfde probleem.** Dit is
   Bucket-B-werk en de belangrijkste migratievraag.
3. `clearCache()` (`lib/admin/overrides.ts:80`) documenteert dat de write-API hem
   aanroept. Dat gebeurt niet (`app/api/admin/overrides/route.ts` importeert hem
   niet). Gevolg: op een multi-instance Vercel-deploy kan een andere instance tot 30s
   oude overrides tonen. Nu onschuldig omdat niets gelezen wordt; wordt relevant
   zodra het leespad bestaat.

### 1.4 De taalketen — dit is de kern van het probleem

| Feit | Plek |
|---|---|
| Taal staat in `localStorage` onder `ctt:lang` | `lib/use-lang.ts:6` |
| **Default is `"en"`** | `lib/use-lang.ts:9` |
| `<html lang="en">` hardcoded | `app/layout.tsx:47` |
| Aantal componenten dat `useLang()` aanroept | **6** (`app/page.tsx`, `play-view.tsx`, `report-view-wrapper.tsx`, `control-dashboard.tsx`, `eye-header.tsx`, `template-library.tsx`) |
| Aantal bestanden dat `tr(lang, …)` gebruikt | **11** |
| Aantal `.tsx`-bestanden in `app/` + `components/` (excl. `ui/`) | ~105 |

Dus: ~94 van ~105 componenten weten niet dat er een taal bestaat. Die hardcoden
hun strings — meestal NL (goed), soms EN (het probleem van #73).

**Gevolg 1 (ernstig):** het facilitator-eindrapport gaat volledig door `tr()`
(`components/admin/report-view.tsx:212-475`, 18 aanroepen) en krijgt zijn taal uit
`useLang()` via `report-view-wrapper.tsx:7`. Omdat de default `"en"` is, ziet een
Nederlandse facilitator die de toggle nooit heeft aangeraakt **het hele rapport in
het Engels**: "End-of-Scenario Report", "Executive Summary", "Decision quality",
"Process adherence", "Governance flags", "Per-round breakdown".

**Gevolg 2:** de presenter view (`components/admin/present-view.tsx`, via
`app/admin/present/page.tsx:4`) heeft **geen enkele** i18n-aansluiting — geen
`lang`-prop, geen `tr()`. Alles is daar hardcoded, en deels Engels. Dit is het
grote scherm voor een Nederlands publiek.

### 1.5 Vier concurrerende tekstbronnen

Er zijn nu vier onafhankelijke plekken waar een UI-label kan staan:

1. `lib/i18n.ts` — 2×~110 keys, EN + NL, via `tr(lang, key)`. 11 bestanden.
2. `lib/config/texts.ts` — NL-only constanten, geen vertaallaag (regel 10 zegt dat
   expliciet). 5 bestanden.
3. `ROLE_META` / `ROLE_BRIEFINGS` — rol-spec, leest `lib/config/texts.ts`
   (`lib/types.ts:4,55`).
4. Lokale `const X_LABELS` in een component — **28 stuks** gevonden.

Deze vier overlappen én spreken elkaar tegen. De harde bewijzen:

- `ROUND_PHASE_LABELS_NL` bestaat **twee keer**: `lib/types.ts:95` (`inject: 'Inject'`)
  en `lib/config/texts.ts:34` (`inject: 'Injects'`). Verschillende waarde, zelfde naam.
  `live-overview-panel.tsx:6` importeert uit `lib/types`, `config-tab.tsx:6` uit
  `lib/config/texts` — dus het admin-paneel bewerkt een constante die de runtime
  níet gebruikt.
- `ESCALATION_LABELS` bestaat **drie keer**: `lib/config/texts.ts:21` (NL),
  `control-dashboard.tsx:56` (EN), `present-view.tsx:17` (EN, caps).
- De zes scoringsdimensies hebben **acht** verschillende labelsets (zie Bucket A §A7).
  `VER` heet afwisselend "Verantwoording", "Vertrouwen", "Comms" en "Stakeholders".
- Urgency-labels bestaan in twee NL-varianten: `lib/i18n.ts:384` ("Gemiddeld") en
  `lib/config/texts.ts:26` ("midden").

### 1.6 Eén echte bug gevonden tijdens de inventarisatie

`components/participant/session-hud.tsx:106`:

```tsx
{tr(lang, "escalationLevel")}: {tr(lang, `escalation_${ESCALATION_LABELS[escalationIndex]}` as Parameters<typeof tr>[1])}
```

`ESCALATION_LABELS` komt hier uit `lib/config/texts.ts:21` en bevat
`["Normaal","Verhoogd","Hoog","Kritiek"]`. De samengestelde key wordt dus
`escalation_Normaal`. Die key bestaat niet in `lib/i18n.ts` (daar staan
`escalation_normal` … `escalation_critical`, regel 162-165 / 377-380). `tr()` valt
terug op de key zelf (`lib/i18n.ts:445`). De deelnemer ziet in de HUD letterlijk:

> `ESCALATIENIVEAU: ESCALATION_NORMAAL`

Dit is waarschijnlijk precies de "normal in een Nederlands scherm" uit `CONTEXT.md:71`
— alleen is het inmiddels door een halve fix veranderd in een zichtbare i18n-key.
De vier `escalation_*` keys in `lib/i18n.ts` zijn daardoor **onbereikbaar**.

### 1.7 Wat de bestaande overdrachtsdocumenten zeggen dat niet meer klopt

`docs/overdracht/P2-inventarisatie.md` en `docs/overdracht/configureerbaar.md`
bevatten goed werk, maar zijn op zes punten door de code achterhaald. Niet
corrigeren in dit document — hieronder staat waar ze misleiden:

| Oude bewering | Huidige code |
|---|---|
| `P2:18` — `classification?: 'feit' \| 'aanname' \| 'fabel'` | `lib/graph/types.ts` heeft alleen `'feit' \| 'aanname'`. `fabel` is verwijderd 2026-08-14 (optie A is gekozen). Restanten: zie Bucket A §A5. |
| `P2:25` — validate-melding "kies feit, aanname of fabel" | Nu `ERROR_MESSAGES.missingClassification` in `lib/config/texts.ts:101` → "kies feit of aanname". Opgelost. |
| `P2:146` / `conf:61` — `session-hud.tsx:12` bevat `["normal","elevated",…]` | Niet meer. `session-hud.tsx:11` importeert de NL-labels. Maar de render op regel 106 is nu kapot (§1.6). |
| `conf:62` — `inject-feed.tsx:730` rendert ruwe urgency | Opgelost: `inject-feed.tsx:71` heeft een eigen `urgencyLabel(lang, u)` via `tr()`. Het probleem is verhuisd naar `lib/format.ts:16` en `present-view.tsx:233`. |
| `conf:31-32` — `mandateSummary` / `authorities` staan in `lib/types.ts:44…` | Verhuisd naar `ROLE_BRIEFINGS` in `lib/config/texts.ts:128`. `ROLE_META` leest ze (`lib/types.ts:55`). |
| `conf:44` / `P2:78` — `modeHint_training` is NIS2-specifiek | Al generiek gemaakt: `lib/i18n.ts:374` zegt nu "meldplicht bij de bevoegde autoriteit conform het gekozen regime". |
| `conf:63` — "NL-vertalingen in `ROUND_PHASE_LABELS_NL` (te vinden elders)" | Gevonden: er zijn er **twee**, met verschillende waarden (§1.5). |

Het **regime-deel van #73 is grotendeels al data-driven** en dat bevestigt
`P2:65-69`: `lib/regulatory/regimes.ts` levert `authorityLabel` per regime, en
`lib/config/texts.ts:55-75` (`MELDPLICHT_TEXTS`) is bewust generiek met expliciete
fallback. Wat nog NIS2-hardcoded is: `lib/i18n.ts:194/409` (`exercise_goal_nis2_readiness`)
en `lib/i18n.ts:222/437` (`plan_nis2`). Beide zijn **inhoudelijk correct** — het zijn
expliciet de NIS2-varianten van een keuzelijst, geen generieke labels. Advies: laten staan.

---

## 2. Bucket A — nu te bouwen, raakt geen opgeslagen data

Regel voor deze emmer: alleen de string die de gebruiker leest verandert. Geen
enum-waarde in data, geen type, geen opslagvorm, geen scenario-inhoud.

### A1 — Urgency (= "escalatieniveau per inject", `CONTEXT.md:69`)

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 1 | `lib/format.ts:16` | `urgencyLabel()` = `urgency.toUpperCase()` → `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` | `LAAG` / `MIDDEN` / `HOOG` / `KRITIEK` — laat de functie `URGENCY_LABELS` uit `lib/config/texts.ts:24` lezen |
| 2 | `components/participant/urgent-inject-modal.tsx:35` | `CRITICAL` in de deelnemer-modal | via gefixte `urgencyLabel()` |
| 3 | `components/admin/inject-controls.tsx:223` | `CRITICAL` badge | via gefixte `urgencyLabel()` |
| 4 | `components/admin/inject-controls.tsx:344` | select-opties `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` | via gefixte `urgencyLabel()` |
| 5 | `components/admin/present-view.tsx:233` | `{inject.urgency}` → `CRITICAL` (caps via CSS) op het grote scherm | `KRITIEK` |
| 6 | `components/admin/builder/preview-dialog.tsx:99` | `critical` in de preview | `Kritiek` |
| 7 | `components/templates/format-builder.tsx:94` | `critical` | `Kritiek` |
| 8 | `components/admin/builder/nodes/inject-node.tsx:53` | `aria-label={d.urgency}` → screenreader zegt "medium" | `aria-label="Urgentie: midden"` |

Let op de bestaande NL-splitsing: `lib/i18n.ts:384` zegt "Gemiddeld",
`lib/config/texts.ts:26` zegt "midden". Kies er één (voorstel: `lib/config/texts.ts`
wint, want dat is de bron die het admin-paneel bewerkt) en laat `urgency_*` in
`lib/i18n.ts` dezelfde waarde krijgen.

### A2 — Escalatieniveau van de sessie

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 9 | `components/participant/session-hud.tsx:106` | **`ESCALATIENIVEAU: ESCALATION_NORMAAL`** — kapotte i18n-key, zie §1.6 | `ESCALATIENIVEAU: NORMAAL` — index direct in `ESCALATION_LABELS`, of lowercase-key bouwen |
| 10 | `components/admin/control-dashboard.tsx:56` + `:195` | lokale `["Normal","Elevated","High","Critical"]` → `NORMAL` badge | importeer `ESCALATION_LABELS` uit `lib/config/texts.ts`; verwijder de lokale const |
| 11 | `components/admin/present-view.tsx:17` + `:130` | `["NORMAL","ELEVATED","HIGH","CRITICAL"]` → `NORMAL` op het grote scherm | idem |
| 12 | `components/admin/present-view.tsx:128` | kop `Escalation` | `Escalatieniveau` |

### A3 — Fase-labels

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 13 | `lib/types.ts:95` vs `lib/config/texts.ts:34` | twee `ROUND_PHASE_LABELS_NL`, `inject` = `'Inject'` vs `'Injects'` | één bron (`lib/config/texts.ts`), re-export uit `lib/types.ts` of de import in `live-overview-panel.tsx:6` omzetten |
| 14 | `components/admin/present-view.tsx:9-15` | eigen `PHASE_LABELS`: `inject→BRIEFING`, `discussion→OVERLEG`, `decision→KEUZE`, `lock→VASTGEZET`, `review→REVEAL` | inhoudelijk oké (dit is de event-mode-woordenlijst uit `lib/scoring/event-mode.ts:12`) maar afwijkend van `ROUND_PHASE_LABELS_NL`. Voorstel: hernoem naar `EVENT_PHASE_LABELS` in `lib/config/texts.ts` en vervang `REVEAL` → `TERUGBLIK` |
| 15 | `components/admin/present-view.tsx:122` | fallback `phase.toUpperCase()` → ruwe enum als een nieuwe fase bijkomt | fallback op `ROUND_PHASE_LABELS_NL[phase]` |
| 16 | `app/observe/page.tsx:98-100` | hardcoded ternary `INJECT` / `DISCUSSIE` / `BESLISSING` / `REVIEW` | `ROUND_PHASE_LABELS_NL[phase].toUpperCase()` |
| 17 | `components/admin/control-dashboard.tsx:405` | `tr(lang, "phase_" + p)` → bij taal `en`: `Inject` / `Discussion` / `Decision` / `Review` | zie A12-#71 (taaldefault) |

### A4 — Fase/kop-labels op de presenter view (grote scherm, NL publiek)

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 18 | `components/admin/present-view.tsx:90` | `Waiting to start` | `Wachten op de facilitator` |
| 19 | `components/admin/present-view.tsx:103` | `Exercise Complete` | `Oefening afgerond` |
| 20 | `components/admin/present-view.tsx:115` | `Round` | `Ronde` |
| 21 | `components/admin/present-view.tsx:121` | `Phase` | `Fase` |
| 22 | `components/admin/present-view.tsx:136` | `Timer` | `Tijd` |
| 23 | `components/admin/present-view.tsx:170` | `Situation update` | `Situatieschets` (de term uit `CONTEXT.md:134`) |

### A5 — Inject-type en kanaal

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 24 | `lib/format.ts:18-29` | `injectTypeLabel()` → `ALERT` `INTEL` `MEDIA` `EXEC` `TECH` `REG` `SOCIAL` `INTERNAL` | `MELDING` `INTEL` `PERS` `DIRECTIE` `TECHNISCH` `TOEZICHT` `SOCIAL` `INTERN` |
| 25 | `components/participant/inject-feed.tsx:34-43` | eigen `INJECT_TYPE_LABELS` → `EXECUTIVE` `TECHNICAL` `REGULATORY` `SOCIAL` `INTERNAL` | zelfde set als #24; verwijder de duplicaat |
| 26 | `lib/format.ts:38` | kanaal `Phone` | `Telefoon` |
| 27 | `lib/format.ts:39` | kanaal `News` | `Nieuws` |
| 28 | `lib/format.ts:40` | kanaal `System` | `Systeem` |
| 29 | `lib/format.ts:41` | kanaal `Raw` | `Memo` (consistent met `inject-feed.tsx:31` dat al `MEMO` zegt) |
| 30 | `lib/format.ts:37` | kanaal `Email` | `E-mail` |
| 31 | `components/admin/present-view.tsx:230` | `{inject.channel ?? inject.type}` → `SIEM_ALERT`, `NEWS_TICKER` ruw | `channelLabel()` / `injectTypeLabel()` |
| 32 | `components/admin/builder/preview-dialog.tsx:99` | idem ruw | idem |
| 33 | `components/templates/format-builder.tsx:94` | `{inject.channel}` ruw | idem |
| 34 | `components/admin/premade-inject-panel.tsx:183` | `{entry.channel}` → `SIEM_ALERT` | `channelLabel()` |
| 35 | `components/admin/builder/nodes/inject-node.tsx:15-31` | vierde `CHANNEL_LABEL`-map (`raw: "Raw"`, `email: "Email"`) | consolideer met `lib/format.ts:31` |

### A6 — Classificatie `feit` / `aanname` / `fabel`

`fabel` is uit het datamodel verwijderd (`lib/graph/types.ts`, comment "verwijderd
2026-08-14") maar leeft nog in de UI. Deze vier zijn dode UI die een
niet-bestaande waarde aanbiedt:

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 36 | `components/admin/premade-inject-panel.tsx:100` | filterknop `FABEL` die nooit iets matcht | verwijder `'fabel'` uit de array |
| 37 | `components/admin/premade-inject-panel.tsx:16` | state-type `'feit' \| 'aanname' \| 'fabel' \| 'all'` | `'fabel'` eruit |
| 38 | `components/admin/premade-inject-panel.tsx:199-203` | `classPillColor` met `case 'fabel'` | case eruit |
| 39 | `components/admin/builder/inject-library-panel.tsx:84` | helptekst "…of feit/aanname/fabel…" | "…of feit/aanname…" |
| 40 | `components/admin/fact-check-panel.tsx:21` | `unverified: "Ongeverifieerd"` — key komt niet voor in `InjectReliability` (`fact` / `assumption` / `misleading`) | dode regel verwijderen |

Niet in Bucket A: de ground-truth-labels zelf (`fact`/`assumption`/`misleading` in
`fact-check-panel.tsx:18-22` en `inspector.tsx:314-316`) zijn al correct Nederlands.

### A7 — De zes scoringsdimensies: acht labelsets

Dit is géén `evaluationAspects` (zie `CONTEXT.md:14`). Het zijn de assen uit
`OUTCOME_DIMENSIONS` (`lib/scoring/constants.ts:6`).

| Plek | CONT | FOR | BC | JUR | VER | KOS |
|---|---|---|---|---|---|---|
| `components/admin/report-view.tsx:16` | Containment | Forensiek | Continuïteit | Juridisch | **Verantwoording** | Kosten |
| `components/admin/dimension-scores-section.tsx:12` | Containment | Forensiek | Bedrijfscontinuïteit | Juridisch & meldplicht | **Verantwoording & communicatie** | Kosten & schade-impact |
| `components/admin/assessment-report-view.tsx:12` | — | — | — | — | — | — |
| `components/admin/assessment-report-view.tsx:21` | Containment | Forensiek | Continuïteit | Juridisch | **Comms** | Kosten |
| `components/admin/live-overview-panel.tsx:11` | — | — | — | — | — | — |
| `components/admin/present-view.tsx:289` | Containment | Forensische integriteit | Bedrijfscontinuïteit | Juridisch | **Vertrouwen** | Kosten |
| `app/admin/report/one-pager/page.tsx:14` | Containment | Forensische integriteit | Bedrijfscontinuïteit | Juridisch | **Vertrouwen** | Kosten |
| `lib/scoring/round-review-narrative.ts:27` | Containment | Forensiek | Continuïteit | Juridisch | **Vertrouwen** | Kosten |
| `components/admin/hub/scoring-tab.tsx:19-21` | Containment | **Forensics** | **Business continuity** | Juridisch | **Stakeholders** | Kosten |

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 41 | `components/admin/hub/scoring-tab.tsx:20` | `Forensics` (Engels) | `Forensiek` |
| 42 | `components/admin/hub/scoring-tab.tsx:20` | `Business continuity` (Engels) | `Bedrijfscontinuïteit` |
| 43 | `components/admin/hub/scoring-tab.tsx:21` | `Stakeholders` (Engels) | `Verantwoording` |
| 44 | 8 maps hierboven | `VER` heet 4 dingen; `BC` en `FOR` elk 2 | **één** `OUTCOME_DIMENSION_LABELS` in `lib/config/texts.ts`, met optioneel een `…_SHORT`-variant voor radar-assen. `SCORING.md:26` is de scheidsrechter voor `VER`. |
| 45 | `lib/scoring/report-markdown.ts:24` | tabelkop in het rapport: `\| CONT \| FOR \| BC \| JUR \| VER \| KOS \|` | NL-labels |
| 46 | `lib/scoring/report-markdown.ts:33` | `- CONT: 1.2` | `- Containment: 1,2` |
| 47 | `lib/scoring/report-markdown.ts:57` | `- **CONT** (0.8): …` | NL-label |
| 48 | `lib/scoring/report-markdown.ts:40-41` | `## Rolresolutie` → `- EXTERNE_COMMS: COMMS` — ruwe `Domain` + ruwe `RoleId` | `- Externe communicatie: Hoofd Communicatie`; vereist een `DOMAIN_LABELS`-map voor `lib/scoring/constants.ts:10` en een `RoleId`→label-map |

### A8 — Rol-labels, teams en domeinen

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 49 | `components/admin/present-view.tsx:237` | `→ it_manager, ciso` op het grote scherm | `→ IT-manager, CISO` via `ROLE_META[r].label` |
| 50 | `components/admin/present-view.tsx:240` | `→ technical_it` | `→ Technisch / IT` — vergt een `TEAM_LABELS`-map (die bestaat alleen als i18n-key `team_technical_it`, `lib/i18n.ts:334`) |
| 51 | `components/admin/hub/roles-tab.tsx:63` | `Team: crisis_management · Domein: leadership` | NL-labels; `RoleDomain` (`lib/types.ts:22`) heeft nog nergens een labelmap |
| 52 | `app/admin/role-cards/page.tsx:107` | `MISROUTE → ciso` op de geprinte rolkaart | `VERKEERD GEROUTEERD → CISO` |
| 53 | `app/admin/role-cards/page.tsx:110` | `Inject abc123 — importance: crucial` | `Inject abc123 — gewicht: cruciaal` |
| 54 | `app/admin/role-cards/page.tsx:126` | `Domein: EXTERNE_COMMS` | `Domein: Externe communicatie` (zelfde map als #48) |
| 55 | `lib/i18n.ts:109-118` / `324-333` | rol-labels divergeren van `ROLE_META`: i18n zegt `role_legal: "Juridisch"` / `"Legal"`, `role_hr_lead: "HR Lead"`, `role_ops_manager: "Operationeel Manager"`; `ROLE_STRUCT` (`lib/types.ts:45-51`) zegt `Legal`, `HR-manager`, `Operationeel manager` | `ROLE_META` is per `codebase-map.md` de enige bron. Verwijder de `role_*` keys uit `lib/i18n.ts` óf genereer ze uit `ROLE_META` |
| 56 | `lib/i18n.ts:115` / `330` | `role_system_admin` bestaat nog als key; `system_admin` is geen `Role` meer (`lib/types.ts:9`) | dode key verwijderen |

### A9 — Sessiestatus en modus

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 57 | `components/admin/hub/sessions-list.tsx:94` | `{s.mode}` → `event` / `training` | `Evenement` / `Training` (bestaat al als `mode_event` in `lib/i18n.ts:370`) |
| 58 | `components/admin/hub/sessions-list.tsx:101` | `{s.status}` → `ENDED` / `ACTIVE` / `LOBBY` | `AFGEROND` / `LIVE` / `LOBBY` (bestaat al als `ended`/`live`/`lobby` in `lib/i18n.ts:298-300`) |
| 59 | `components/admin/hub/session-detail.tsx:332` | `Modus: event` | `Modus: Evenement` |
| 60 | `components/admin/hub/session-detail.tsx:336` | `Status: ended` | `Status: Afgerond` |
| 61 | `components/admin/hub/session-detail.tsx:355` | "…rondes in **event**-modus." | "…rondes in de **Evenement**-modus." |
| 62 | `components/admin/regulatory-obligations-panel.tsx:62` | `{obligation.status}` → `OPEN` / `FILED` / `EXPIRED` | `OPEN` / `INGEDIEND` / `VERSTREKEN` |

### A10 — Foutmeldingen en validatie

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 63 | `components/admin/builder/toolbar.tsx:259` | `{issue.severity}` → `ERROR` / `WARNING` naast de validatiemelding | `FOUT` / `WAARSCHUWING` |
| 64 | `components/admin/builder/toolbar.tsx:264` | knop `Close` | `Sluiten` |
| 65 | 24 plekken, o.a. `components/admin/hub/override-editor.tsx:18,29`, `hub/quality-scorer.tsx:92,134`, `hub/clients-list.tsx:13`, `hub/wizard-prompt-tab.tsx:35,45`, `hub/session-detail.tsx:240,263,287`, `hub/client-detail.tsx:92,128`, `hub/sessions-list.tsx:38`, `hub/scenarios-panel.tsx:103,153`, `hub/scenarios-tab.tsx:36,47,52`, `components/admin/reveal-panel.tsx:52`, `present-view.tsx:321` | `HTTP 500` als enige foutmelding voor de gebruiker | één helper `fetchError(res)` in `lib/config/texts.ts` → `Serverfout (500) — probeer opnieuw.` |
| 66 | `components/admin/hub/scenarios-tab.tsx:47,52` | `Save failed: HTTP 500` / `Delete failed: HTTP 500` | `Opslaan mislukt` / `Verwijderen mislukt` |

### A11 — Setup-form en specials (facilitator)

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 67 | `components/admin/setup-form.tsx:41-52` | 10 volledig Engelse modulenamen in het NL setup-scherm: `Detection & Sensemaking`, `Triage & Containment`, `Business Continuity`, `Crisis Communication`, `Legal & Regulatory`, `Ransom Negotiation`, `Recovery & Lessons Learned`, `Insider Investigation`, `Supply Chain Response`, `Forensic & Attribution` | `Detectie & beeldvorming`, `Triage & containment`, `Bedrijfscontinuïteit`, `Crisiscommunicatie`, `Juridisch & toezicht`, `Losgeldonderhandeling`, `Herstel & lessen`, `Insideronderzoek`, `Ketenrespons`, `Forensiek & attributie` |
| 68 | `components/participant/special-modal.tsx:11` | `Ransomware Negotiation` | `Ransomware-onderhandeling` |
| 69 | `lib/i18n.ts:412` (NL) | `exercise_goal_ransomware_tabletop: "Ransomware Tabletop"` | `Ransomware-tabletop` |
| 70 | `components/admin/hub/wizard-prompt-tab.tsx:22` | regelbeschrijving `reliability=misleading` zichtbaar in de UI | `ground truth = misleidend` |

### A12 — De taaldefault (grootste zichtbare winst, nog steeds Bucket A)

| # | file:line | Wat de gebruiker nu ziet | Voorstel |
|---|---|---|---|
| 71 | `lib/use-lang.ts:9` | default `"en"` → het complete facilitator-eindrapport (`report-view.tsx`, 18 `tr()`-aanroepen) staat in het **Engels** tot iemand de toggle omzet: `End-of-Scenario Report`, `Executive Summary`, `Decision quality`, `Process adherence`, `Role compliance`, `Governance flags`, `Per-round breakdown`, `Recommendations`, `Exercise Timeline`, `IR Plan Alignment`, `Improvement Actions` | default `"nl"` |
| 72 | `app/layout.tsx:47` | `<html lang="en">` — screenreaders en spellingchecker in het Engels | `lang="nl"` (of gekoppeld aan de toggle) |
| 73 | `components/admin/inject-controls.tsx:38` | default-prop `lang = "en"` | `lang = "nl"` |

**Dit is één regel code voor #71 en het haalt in één keer het grootste aantal
zichtbare Engelse woorden weg.** Het is geen opslagwijziging: `ctt:lang` in
localStorage blijft dezelfde key met dezelfde waarden, alleen de fallback bij
afwezigheid verandert.

**Totaal Bucket A: 73 vindplaatsen in 25 bestanden.**

---

## 3. Bucket B — ontwerp, vereist goedkeuring

### B1 — Eén bron voor tekst én configuratie

Doel uit #73: één vertaal-/configuratiebron voor facilitator, deelnemer, presenter,
rapport en foutmeldingen.

Voorgestelde eindvorm (3 lagen, met de vier huidige bronnen samengevoegd):

```
lib/config/
  catalog.ts       ← schema: welke keys bestaan, welk type, welke default
  nl.ts            ← alle NL-strings (bron: huidige lib/config/texts.ts + NL-helft i18n.ts
                      + de 28 lokale label-maps)
  en.ts            ← alle EN-strings (bron: EN-helft i18n.ts; incompleet, mag incompleet blijven)
  resolve.ts       ← resolveText(lang, key, overrides, vars) — één functie, één fallbackketen
```

Fallbackketen (vast, één keer gedefinieerd):

```
override[lang][key]  →  override["*"][key]  →  nl[key]  →  en[key]  →  key
```

`"*"` = taal-onafhankelijke override (de huidige overrides zijn dat impliciet;
zie B4). Keys blijven de bestaande dot-paths (`BUTTON_LABELS.finalizeDecision`),
zodat bestaande override-keys 1-op-1 geldig blijven.

`tr(lang, key)` blijft bestaan als dunne wrapper over `resolveText`, zodat de 11
bestaande bestanden niet hoeven te wijzigen.

### B2 — Versionering

Voeg aan `AdminOverrides` toe:

```ts
export const OVERRIDES_SCHEMA_VERSION = 2

export interface AdminOverrides {
  version?: number          // afwezig = v1 (de huidige blob)
  texts?: Record<string, OverrideValue>
  roles?: Partial<Record<Role, RoleOverride>>
  scoring?: Record<string, OutcomeVector>
  updatedAt?: number
  updatedBy?: string        // auth().user — nu niet vastgelegd
}
```

`version` afwezig → de loader draait `migrateV1toV2()` (zie B4) in-memory. Pas bij
de volgende `saveOverrides()` wordt v2 weggeschreven. Dat is een lazy migratie:
geen migratiescript, geen downtime, en een rollback naar de vorige deploy blijft
werken zolang v2 geen keys weggooit.

### B3 — Het ontbrekende leespad

Het leespad is de hele reden dat #73 bestaat. Ontwerp:

**Server-side** (API-routes, rapportgeneratie, `lib/scoring/report-markdown.ts`):
`await installAdminOverrides()` uitbreiden zodat hij naast `o.scoring` ook
`o.texts` en `o.roles` in een module-scope registry zet, en `resolveText()` /
`roleMeta()` daaruit laten lezen. Dit is precies waar `resolvePath()`
(`lib/admin/overrides.ts:85`, nu dead code) voor gemaakt is.

Belangrijk: `installAdminOverrides()` wordt nu op **één** plek aangeroepen
(`app/api/session/score/route.ts:23`). Elk server-pad dat tekst of rol-labels
rendert moet die aanroep krijgen. Minimaal: `app/api/session/report/route.ts`,
`app/api/session/supervision-report/route.ts`, `app/api/session/state/route.ts`,
`app/admin/report/one-pager/page.tsx`, `app/admin/role-cards/page.tsx`.

**Client-side**: de deelnemer- en presenterschermen zijn client components zonder
admin-auth. Twee opties:

- **B3a (voorkeur)** — overrides reizen mee in de sessie-payload. `createSession()`
  bakt een snapshot van de effectieve texts/roles in de `SessionState`, en
  `toParticipantState()` (`lib/session-store.ts`) geeft hem door. Voordeel: een
  lopende sessie verandert niet halverwege van taal of labels, en de SSE-stream
  heeft geen extra fetch nodig. Nadeel: **dit verandert de vorm van opgeslagen
  sessies** → zie §4.
- **B3b** — een publiek, cache-bare `GET /api/config/texts` die alleen de
  effectieve (gemergde) strings teruggeeft, zonder admin-auth. Voordeel: geen
  sessievorm-wijziging. Nadeel: extra request per client, en een lopende sessie kan
  halverwege van label veranderen.

B3a is inhoudelijk beter (een oefening moet reproduceerbaar zijn); B3b is
goedkoper en raakt geen opgeslagen data. **Dit is de keuze die ik niet voor je maak.**

### B4 — Migratie van bestaande overrides

Er bestaat nu precies één KV-key (`admin:overrides`). De migratie is daarom klein,
maar niet triviaal vanwege de drie array-encodings uit §1.3.

`migrateV1toV2(v1)`:

1. **Array-keys normaliseren.** Elke `texts`-key die eindigt op `:__array__` wordt
   `JSON.parse`'d en opgeslagen als echte array onder de key zonder suffix.
   Bij een parse-fout: key laten staan, waarschuwing loggen, default gebruiken.
   (Geldt nu alleen voor `ESCALATION_LABELS:__array__`, de enige array in
   `config-tab.tsx`.)
2. **Niet-bestaande keys markeren, niet weggooien.** Een override op een key die
   niet meer in `catalog.ts` staat gaat naar `texts._orphaned[key]`. Niets
   verdwijnt stil.
3. **`roles` ongewijzigd overnemen.** De vorm (`Partial<Record<Role, RoleOverride>>`)
   is al correct. Wel: een override op `system_admin` is nu onbereikbaar (geen `Role`
   meer) → naar `_orphaned`.
4. **`scoring` ongewijzigd overnemen.** Werkend pad, niet aanraken.
5. `version = 2` stempelen.

### B5 — Testplan

Nieuwe testbestanden, naast de bestaande suite in `lib/__tests__/`:

| Test | Wat hij vastzet |
|---|---|
| `lib/admin/__tests__/overrides-migration.test.ts` | `migrateV1toV2` op een v1-blob met `ESCALATION_LABELS:__array__`, een losse dot-path, een rol-override en een `system_admin`-override. Assert: array wordt array, orphans blijven bewaard, `scoring` bit-identiek. |
| idem | Idempotentie: `migrate(migrate(x)) === migrate(x)`. |
| idem | Een v2-blob gaat ongewijzigd door de migratie heen. |
| `lib/config/__tests__/resolve.test.ts` | De volledige fallbackketen, inclusief `vars`-substitutie en het geval "key bestaat nergens" (mag géén i18n-key renderen — dit is de bug uit §1.6, die hiermee onmogelijk wordt). |
| `lib/config/__tests__/catalog-completeness.test.ts` | Elke key in `nl.ts` staat in `catalog.ts` en vice versa. Voorkomt een herhaling van de `escalation_*`-keys die onbereikbaar waren. |
| `lib/config/__tests__/no-raw-enums.test.ts` | Statische guard: grep over `components/` + `app/` op `{…\.urgency}`, `{…\.status}`, `{…\.mode}`, `{…\.channel}`, `{…\.domain}` in JSX. Faalt op nieuwe regressies. Dit is wat Bucket A permanent houdt. |
| `lib/admin/__tests__/override-read-path.test.ts` | Na `saveOverrides({texts:{'BUTTON_LABELS.submitDecision':'X'}})` + `installAdminOverrides()` geeft `resolveText('nl','BUTTON_LABELS.submitDecision')` `'X'`. Dit is het criterium "runtime leest overrides" letterlijk als test. |
| `e2e/` (Playwright) | Facilitator zet een override, refresh, override is zichtbaar in het editorpaneel **én** in het deelnemer-scherm. Dit dekt het acceptatiecriterium "zichtbaar na refresh". |

### B6 — Regimeteksten

Al grotendeels data-driven (§1.7). Resterend Bucket-B-werk, klein:

- `lib/regulatory/regimes.ts` heeft één regime (`nl_avg_nis2`). Een tweede regime
  toevoegen is nu een code-wijziging. Als regimes override-baar moeten worden, hoort
  er een `regimes`-tak in `AdminOverrides` bij — met dezelfde versionering.
  `components/admin/hub/regimes-tab.tsx` bestaat al als paneel; check of die een
  write-pad heeft of alleen leest.
- `MELDPLICHT_TEXTS` (`lib/config/texts.ts:61-75`) is correct generiek en heeft een
  expliciete `fallbackAuthority`. Niets aan doen.

---

## 4. Wat breekt — per Bucket-B-onderdeel

| Wijziging | Wat breekt | Mitigatie |
|---|---|---|
| **B2 — `version`-veld toevoegen** | Niets direct: `version` is optioneel, afwezig = v1. Een oudere deploy die de blob terugleest ziet een onbekend veld en negeert het (TypeScript-interface, geen runtime-validatie). | Lazy migratie, pas wegschrijven bij de volgende save. |
| **B4 stap 1 — array-encoding normaliseren** | **Een bestaande override op `ESCALATION_LABELS` gaat verloren bij een rollback.** Na migratie staat de array onder `ESCALATION_LABELS`; een teruggedraaide deploy zoekt `ESCALATION_LABELS:__array__` en vindt niets → valt terug op de code-default. De facilitator ziet zijn aangepaste escalatielabels verdwijnen. | Schrijf tijdens de overgangsperiode **beide** keys weg (dual-write). Verwijder `:__array__` pas een deploy later. |
| **B4 stap 2 — orphans** | Niets breekt, maar `texts._orphaned` is een nieuwe sleutel in de blob die het editorpaneel niet kent en dus niet toont. Een facilitator kan niet zien dat zijn override geparkeerd is. | Een "verweesde overrides"-sectie in `config-tab.tsx`, read-only met een verwijder-knop. |
| **B3a — overrides in `SessionState` bakken** | **Dit is de echte data-migratie.** Bestaande, opgeslagen sessies in KV missen het nieuwe veld. `toParticipantState()` en de SSE-stream moeten `undefined` tolereren, anders crasht het laden van een afgeronde sessie in `/admin/sessions/[id]`. Verder worden sessie-blobs groter — relevant omdat de hele sessie door de SSE-stream gaat. | Veld optioneel maken en op `undefined` terugvallen op de code-defaults. Expliciete test: een v1-sessiesnapshot zonder het veld laadt en rendert. De bestaande `lib/__tests__/to-participant-state.test.ts` is de plek. |
| **B3b — publieke config-endpoint** | Raakt geen opgeslagen data. Wel: de effectieve teksten worden publiek leesbaar zonder auth. Dat zijn UI-labels, geen scenario-inhoud, dus laag risico — maar het moet een bewuste keuze zijn. | Endpoint geeft alleen `texts` en rol-`label`s terug; nooit `scoring` (dat verraadt de optie-waardering aan deelnemers) en nooit `ROLE_BRIEFINGS.notResponsibleFor` als dat facilitator-only is. |
| **B1 — `lib/i18n.ts` opslokken in `lib/config/`** | De `TKeys`-union verdwijnt als er van key-literal naar catalogus wordt gegaan. 11 bestanden met `tr(lang, "key")` verliezen dan hun compile-time check. | `tr()` als wrapper laten bestaan met dezelfde `TKeys`-signature. Geen van de 11 bestanden hoeft te wijzigen. |
| **A6 — `fabel` uit de UI** | Niets. `fabel` is al uit het type. Een opgeslagen scenario met `classification: "fabel"` zou nu al als "onbekend" renderen; `lib/graph/examples-schoolvereniging.ts` is bij de vorige migratie al opgeruimd (verifieer met een grep vóór het bouwen). | Grep `classification.*fabel` over `lib/graph/` en `backup/` voordat je de filterknop weghaalt. |
| **A12 #71 — default taal naar `nl`** | Niets in opslag. Een gebruiker die bewust op EN had gezet houdt zijn `ctt:lang`-waarde. Wel: de EN-helft van `lib/i18n.ts` wordt daarmee effectief ongeteste code — die is nu al incompleet (geen `role_*`-pariteit met `ROLE_META`, geen `escalation_*`-bereikbaarheid). | Bewuste keuze: is EN een echt ondersteunde taal of een restant? Als het een restant is, is het schrappen van `en` uit `Lang` een aparte, grotere beslissing die niet in #73 hoort. |

---

## 5. Aanbevolen volgorde

1. **Nu**: Bucket A, in deze volgorde van zichtbaar effect per regel code —
   #71 (taaldefault), #9 (de kapotte escalatie-key), A1 (urgency), A4 (presenter
   view), A7 (dimensies), de rest.
2. **Daarna, na goedkeuring**: B2 (versioneren) + B4 (migratie) + B5 (tests), met
   dual-write voor de array-key.
3. **Pas dan**: B3 — het leespad. Met de keuze tussen B3a en B3b expliciet gemaakt,
   want alleen B3a is een data-migratie.

Bucket A maakt Bucket B níet moeilijker: het consolideert de 28 lokale label-maps
naar `lib/config/texts.ts`, en dat is exact de bron die B1 nodig heeft. Het is
vooruitgeschoven werk, geen weggegooid werk.
