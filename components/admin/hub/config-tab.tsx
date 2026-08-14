"use client"

import {
  ESCALATION_LABELS,
  URGENCY_LABELS,
  ROUND_PHASE_LABELS_NL,
  MELDPLICHT_TEXTS,
  BUTTON_LABELS,
  ERROR_MESSAGES,
  FACILITATOR_GUIDE,
} from "@/lib/config/texts"
import { useOverrides, StringField, SaveBar, StringArrayField } from "./override-editor"

// De teksten uit lib/config/texts.ts zijn de defaults. Overrides worden
// per-veld opgeslagen in AdminOverrides.texts met dot-path als sleutel.
// Runtime consumeert de defaults nog uit code — deze UI schrijft de
// overrides naar KV zodat de developers ze bij i18n-migratie kunnen
// oppikken. Zie docs/overdracht/status.md.

function pathVal(o: Record<string, string> | undefined, path: string): string | undefined {
  return o?.[path]
}

export function ConfigTab() {
  const { overrides, patch, save, reload, loading, saving, dirty, error } = useOverrides()
  const texts = overrides.texts ?? {}

  function set(path: string, v: string) {
    patch(prev => ({ ...prev, texts: { ...(prev.texts ?? {}), [path]: v } }))
  }
  function revert(path: string) {
    patch(prev => {
      const next = { ...(prev.texts ?? {}) }
      delete next[path]
      return { ...prev, texts: next }
    })
  }
  function setArray(prefix: string, arr: string[]) {
    // Sla array op als één JSON-string onder één key; ontcijferen bij render.
    set(`${prefix}:__array__`, JSON.stringify(arr))
  }
  function getArray(prefix: string): string[] | undefined {
    const raw = texts[`${prefix}:__array__`]
    if (!raw) return undefined
    try { return JSON.parse(raw) as string[] } catch { return undefined }
  }
  function revertArray(prefix: string) {
    patch(prev => {
      const next = { ...(prev.texts ?? {}) }
      delete next[`${prefix}:__array__`]
      return { ...prev, texts: next }
    })
  }

  if (loading) return <p className="text-sm text-muted-foreground">Laden…</p>

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Teksten</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vaste teksten die niet per scenario verschillen. Wijzigingen worden als override in KV bewaard;
          de standaardwaardes in <code className="font-mono text-xs">lib/config/texts.ts</code> blijven de fallback.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
          Aandacht: runtime van de app leest deze waardes nu nog uit code. Overrides worden opgeslagen zodat de
          developers ze bij de i18n-migratie kunnen oppakken. Zie <code className="font-mono">docs/overdracht/status.md</code>.
        </p>
      </div>

      {/* 1. Escalatie */}
      <Group title="Escalatieniveau" description="Labels in de participant-HUD.">
        <StringArrayField
          label="ESCALATION_LABELS"
          hint="Volgorde: normaal / verhoogd / hoog / kritiek"
          defaultValue={ESCALATION_LABELS}
          value={getArray("ESCALATION_LABELS")}
          onChange={v => setArray("ESCALATION_LABELS", v)}
          onRevert={() => revertArray("ESCALATION_LABELS")}
        />
      </Group>

      {/* 2. Urgency */}
      <Group title="Inject-urgency labels" description="Vertaling van Engelse urgency-waarden voor de UI.">
        {(Object.keys(URGENCY_LABELS) as Array<keyof typeof URGENCY_LABELS>).map(k => (
          <StringField
            key={k}
            label={`URGENCY_LABELS.${k}`}
            defaultValue={URGENCY_LABELS[k]}
            value={pathVal(texts, `URGENCY_LABELS.${k}`)}
            onChange={v => set(`URGENCY_LABELS.${k}`, v)}
            onRevert={() => revert(`URGENCY_LABELS.${k}`)}
          />
        ))}
      </Group>

      {/* 3. Fase-labels */}
      <Group title="Ronde-fase labels">
        {(Object.keys(ROUND_PHASE_LABELS_NL) as Array<keyof typeof ROUND_PHASE_LABELS_NL>).map(k => (
          <StringField
            key={k}
            label={`ROUND_PHASE_LABELS_NL.${k}`}
            defaultValue={ROUND_PHASE_LABELS_NL[k]}
            value={pathVal(texts, `ROUND_PHASE_LABELS_NL.${k}`)}
            onChange={v => set(`ROUND_PHASE_LABELS_NL.${k}`, v)}
            onRevert={() => revert(`ROUND_PHASE_LABELS_NL.${k}`)}
          />
        ))}
      </Group>

      {/* 4. Meldplicht */}
      <Group title="Meldplicht" description="Generieke wrappers. Concrete autoriteit komt uit regime.authorityLabel per scenario.">
        <StringField
          label="MELDPLICHT_TEXTS.panelHeading"
          defaultValue={MELDPLICHT_TEXTS.panelHeading}
          value={pathVal(texts, "MELDPLICHT_TEXTS.panelHeading")}
          onChange={v => set("MELDPLICHT_TEXTS.panelHeading", v)}
          onRevert={() => revert("MELDPLICHT_TEXTS.panelHeading")}
        />
        <StringField
          label="MELDPLICHT_TEXTS.cta_initial"
          defaultValue={MELDPLICHT_TEXTS.cta_initial}
          value={pathVal(texts, "MELDPLICHT_TEXTS.cta_initial")}
          onChange={v => set("MELDPLICHT_TEXTS.cta_initial", v)}
          onRevert={() => revert("MELDPLICHT_TEXTS.cta_initial")}
        />
        <StringField
          label="MELDPLICHT_TEXTS.cta_closing"
          defaultValue={MELDPLICHT_TEXTS.cta_closing}
          value={pathVal(texts, "MELDPLICHT_TEXTS.cta_closing")}
          onChange={v => set("MELDPLICHT_TEXTS.cta_closing", v)}
          onRevert={() => revert("MELDPLICHT_TEXTS.cta_closing")}
        />
        <StringField
          label="MELDPLICHT_TEXTS.status_notFiled"
          defaultValue={MELDPLICHT_TEXTS.status_notFiled}
          value={pathVal(texts, "MELDPLICHT_TEXTS.status_notFiled")}
          onChange={v => set("MELDPLICHT_TEXTS.status_notFiled", v)}
          onRevert={() => revert("MELDPLICHT_TEXTS.status_notFiled")}
          multiline
        />
        <StringField
          label="MELDPLICHT_TEXTS.fallbackAuthority"
          defaultValue={MELDPLICHT_TEXTS.fallbackAuthority}
          value={pathVal(texts, "MELDPLICHT_TEXTS.fallbackAuthority")}
          onChange={v => set("MELDPLICHT_TEXTS.fallbackAuthority", v)}
          onRevert={() => revert("MELDPLICHT_TEXTS.fallbackAuthority")}
        />
      </Group>

      {/* 5. Knoplabels */}
      <Group title="Knoplabels">
        {(Object.keys(BUTTON_LABELS) as Array<keyof typeof BUTTON_LABELS>).filter(k => typeof BUTTON_LABELS[k] === "string").map(k => {
          const val = BUTTON_LABELS[k] as string
          return (
            <StringField
              key={k}
              label={`BUTTON_LABELS.${k}`}
              defaultValue={val}
              value={pathVal(texts, `BUTTON_LABELS.${k}`)}
              onChange={v => set(`BUTTON_LABELS.${k}`, v)}
              onRevert={() => revert(`BUTTON_LABELS.${k}`)}
            />
          )
        })}
      </Group>

      {/* 6. Foutmeldingen */}
      <Group title="Foutmeldingen">
        {(Object.keys(ERROR_MESSAGES) as Array<keyof typeof ERROR_MESSAGES>).filter(k => typeof ERROR_MESSAGES[k] === "string").map(k => {
          const val = ERROR_MESSAGES[k] as string
          return (
            <StringField
              key={k}
              label={`ERROR_MESSAGES.${k}`}
              defaultValue={val}
              value={pathVal(texts, `ERROR_MESSAGES.${k}`)}
              onChange={v => set(`ERROR_MESSAGES.${k}`, v)}
              onRevert={() => revert(`ERROR_MESSAGES.${k}`)}
              multiline={val.length > 80}
            />
          )
        })}
      </Group>

      {/* 7. Facilitator guide */}
      <Group title="Facilitator guide" description="BOB-hint en event-mode help.">
        <StringField
          label="FACILITATOR_GUIDE.bobHint"
          defaultValue={FACILITATOR_GUIDE.bobHint}
          value={pathVal(texts, "FACILITATOR_GUIDE.bobHint")}
          onChange={v => set("FACILITATOR_GUIDE.bobHint", v)}
          onRevert={() => revert("FACILITATOR_GUIDE.bobHint")}
          multiline
        />
        <StringField
          label="FACILITATOR_GUIDE.eventMode.heading"
          defaultValue={FACILITATOR_GUIDE.eventMode.heading}
          value={pathVal(texts, "FACILITATOR_GUIDE.eventMode.heading")}
          onChange={v => set("FACILITATOR_GUIDE.eventMode.heading", v)}
          onRevert={() => revert("FACILITATOR_GUIDE.eventMode.heading")}
        />
        <StringField
          label="FACILITATOR_GUIDE.eventMode.intro"
          defaultValue={FACILITATOR_GUIDE.eventMode.intro}
          value={pathVal(texts, "FACILITATOR_GUIDE.eventMode.intro")}
          onChange={v => set("FACILITATOR_GUIDE.eventMode.intro", v)}
          onRevert={() => revert("FACILITATOR_GUIDE.eventMode.intro")}
          multiline
        />
      </Group>

      <SaveBar dirty={dirty} saving={saving} error={error} onSave={save} onDiscard={reload} />
    </section>
  )
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}
