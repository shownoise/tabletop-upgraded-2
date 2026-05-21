# Data model — TypeScript types voor de upgrades

Dit document beschrijft de nieuwe en aangepaste types die de upgrades nodig hebben. Bestaande types in `lib/template-types.ts` moeten worden uitgebreid, niet vervangen.

## Nieuwe types

### Attack chain

```typescript
export type AttackChainPhase = {
  id: string                          // 'T-21d-initial-access'
  t_offset: string                    // 'T-21d' of 'T+00:15'
  technique: string                   // korte beschrijving in lopende tekst
  mitre_attack?: string[]             // optioneel: ['T1566.001', 'T1078']
  artifacts: string[]                 // wat heeft deze fase achtergelaten?
  detectability: 'covert' | 'subtle' | 'noisy'
}

export type AttackChainTemplate = {
  id: ScenarioType                    // 'ransomware_double_extortion' etc.
  name: string                        // 'Ransomware (double extortion)'
  description: string                 // korte uitleg
  phases: AttackChainPhase[]          // in chronologische volgorde
  applicable_sectors?: string[]       // optioneel filter
}

export type ScenarioType =
  | 'ransomware_double_extortion'
  | 'insider_threat'
  | 'bec_cfo_fraud'
  | 'supply_chain_compromise'
  // uitbreidbaar — nieuwe scenario-types voegen hier toe
```

### Module library

```typescript
export type ModuleId =
  | 'detection_sensemaking'
  | 'triage_containment'
  | 'business_continuity'
  | 'crisis_communication'
  | 'legal_regulatory'
  | 'ransom_negotiation'
  | 'recovery_lessons'
  | 'insider_investigation'
  | 'supply_chain_response'
  | 'forensic_attribution'

export type ObservationLens =
  | 'symptoms'
  | 'impact'
  | 'external_reactions'
  | 'attacker_voice'

export type ModuleDefinition = {
  id: ModuleId
  name: string
  learning_goal: string
  default_lens: ObservationLens
  default_duration_minutes: number    // 30, 40, etc.
  default_channels: InjectChannel[]   // bv ['siem', 'teams', 'sms']
  framework_prompts: Record<DecisionFramework, string[]>
  scope_hints: string[]               // hint voor decision-generation
}
```

### Decision framework

```typescript
export type DecisionFramework =
  | 'bob'           // Beeldvorming-Oordeelsvorming-Besluitvorming
  | 'ooda'          // Observe-Orient-Decide-Act
  | 'dair'          // Detect-Assess-Inform-Respond
  | 'nist_ir'       // NIST SP 800-61 cycle
  | 'free'          // open vragen, geen vast framework
```

### Inject

```typescript
export type InjectChannel =
  | 'email'
  | 'sms'           // ook WhatsApp
  | 'teams'         // ook Slack
  | 'siem'
  | 'edr'
  | 'news'          // LinkedIn, X, persbericht
  | 'phone'         // uitgeschreven dialoog
  | 'memo'          // formeel intern document
  | 'ransom_note'

export type EmotionalTone =
  | 'clinical'      // SIEM-alert, formeel rapport
  | 'urgent'        // klant met deadline
  | 'panicked'      // medewerker in het veld
  | 'menacing'      // aanvaller
  | 'professional' // advocaat, toezichthouder

export type Inject = {
  id: string
  source_phase_id: string             // verwijst naar AttackChainPhase.id
  channel: InjectChannel
  sender: string                      // 'Marco van Planning' / 'AH Distributie B.V.'
  timestamp: string                   // '08:13' of '2025-04-08 06:31:17 UTC'
  emotional_tone: EmotionalTone
  content: string                     // de tekst, met inline markup tags
  is_handout?: boolean                // true voor grote documenten (RCA, ransom-pakket)
}
```

### Scenario (top-level)

```typescript
export type ScenarioInstance = {
  meta: {
    codename: string                  // 'STILVALLEN'
    client_profile: ClientProfile
    scenario_type: ScenarioType
    decision_framework: DecisionFramework
    generated_at: string
    language: 'nl' | 'en'
  }
  attack_chain: AttackChainPhase[]    // intern, niet zichtbaar voor deelnemers
  modules: ModuleInstance[]
  debrief_questions: string[]
  ir_observations: string[]           // wat wij als retainer zagen
}

export type ClientProfile = {
  sector: string                      // 'transport', 'food_production', etc.
  revenue_range: string               // '€25-50M'
  employee_count: number
  nis2_status: 'essential' | 'important' | 'not_applicable'
  critical_systems: string[]
  key_stakeholders: string[]          // 'shareholders', 'OR', 'RvC'
}

export type ModuleInstance = {
  id: string                          // uniek per oefening
  module_id: ModuleId                 // verwijst naar ModuleDefinition
  order: number                       // 1, 2, 3, ...
  t_offset: string                    // 'T+00:00', 'T+00:40'
  duration_minutes: number
  severity: 'medium' | 'high' | 'critical'
  visible_phases: string[]            // welke chain-fasen worden in deze module zichtbaar
  observation_lens: ObservationLens
  situation: string                   // verhalende situatie-update
  injects: Inject[]
  decisions: DecisionBox[]
  facilitator_notes: string[]
  handout?: Handout                   // optioneel
}

export type DecisionBox = {
  role: 'voorzitter' | 'ciso' | 'hoofd_it' | 'legal' | 'comms' | 'directie'
  questions: string[]
  scope: 'client' | 'shared'          // 'retainer'-scope is gefilterd weg
}

export type Handout = {
  type: 'four_domain_impact' | 'root_cause_analysis' | 'ransom_package' | 'rca_summary' | 'custom'
  title: string
  content: string                     // markdown
}
```

## Aanpassingen bestaande types

In `lib/template-types.ts` (huidige codebase):

```typescript
// VOOR (huidig)
export type Template = {
  id: string
  name: string
  rounds: TemplateRound[]            // vast 4 of 5 rondes
  // ...
}

// NA (na upgrade)
export type Template = {
  id: string
  name: string
  scenario_type: ScenarioType         // NIEUW — bepaalt attack chain
  decision_framework: DecisionFramework  // NIEUW
  modules: TemplateModuleSlot[]       // VERVANGT rounds — variabel aantal
  // ... rest blijft
}

export type TemplateModuleSlot = {
  module_id: ModuleId
  duration_minutes?: number           // override default
  custom_lens?: ObservationLens       // override default
  custom_channels?: InjectChannel[]   // override default
  facilitator_notes_extra?: string[]  // extra prompts voor deze template
}
```

## Migratie van bestaande templates

De twee builtin templates (`Ransomware Full Crisis` en `BEC/CFO Fraud`) moeten worden gemigreerd:

```typescript
// Ransomware Full Crisis → 
{
  scenario_type: 'ransomware_double_extortion',
  decision_framework: 'bob',
  modules: [
    { module_id: 'detection_sensemaking' },
    { module_id: 'business_continuity' },
    { module_id: 'crisis_communication' },
    { module_id: 'ransom_negotiation' },
  ]
}

// BEC/CFO Fraud →
{
  scenario_type: 'bec_cfo_fraud',
  decision_framework: 'bob',
  modules: [
    { module_id: 'detection_sensemaking' },
    { module_id: 'legal_regulatory' },
    { module_id: 'crisis_communication' },
  ]
}
```

Schrijf een migratiescript dat oude `rounds`-based templates omzet naar de nieuwe `modules`-based structuur, met sensible defaults op basis van round-titels.

## Validators die moeten worden toegevoegd

```typescript
// Check 1: elke inject verwijst naar een bestaande chain-fase
function validateInjectChainReference(scenario: ScenarioInstance): ValidationError[]

// Check 2: elke inject's source_phase_id zit in zijn module's visible_phases
function validateInjectVisibility(scenario: ScenarioInstance): ValidationError[]

// Check 3: elke module heeft minimaal 3 verschillende kanalen
function validateChannelDiversity(scenario: ScenarioInstance): ValidationError[]

// Check 4: geen decisions buiten klant-scope
function validateDecisionScope(scenario: ScenarioInstance): ValidationError[]

// Check 5: severity-curve loopt op of blijft gelijk
function validateSeverityProgression(scenario: ScenarioInstance): ValidationError[]

// Check 6: scenario-type matcht met attack chain en logische modules
function validateScenarioCoherence(scenario: ScenarioInstance): ValidationError[]
```

Validators draaien na AI-generatie en voor render. Errors worden teruggekoppeld aan de AI voor een correctie-ronde (max 2 retries), daarna wordt de oefening met warnings aan de gebruiker getoond.
