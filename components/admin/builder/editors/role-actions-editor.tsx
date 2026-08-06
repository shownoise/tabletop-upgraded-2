"use client"

import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ROLE_META, ROLE_ORDER } from "@/lib/types"
import type { ChoiceQuality, Role, RoleAction } from "@/lib/types"
import { SUPERVISION_AREAS, type SupervisionArea } from "@/lib/engine/supervision"

const ALL_ROLES: readonly Role[] = ROLE_ORDER

const QUALITY_RANKS: Array<{ key: ChoiceQuality; label: string; className: string }> = [
  { key: 'best',  label: 'Best',      className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40' },
  { key: 'good',  label: 'Goed',      className: 'bg-sky-500/15 text-sky-600 border-sky-500/40' },
  { key: 'poor',  label: 'Kon beter', className: 'bg-amber-500/15 text-amber-600 border-amber-500/40' },
  { key: 'wrong', label: 'Fout',      className: 'bg-red-500/15 text-red-600 border-red-500/40' },
]

function makeId(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 8)}` }

interface Props {
  value: RoleAction[]
  onChange: (next: RoleAction[]) => void
  suggestedIdPrefix?: string
}

export function RoleActionsEditor({ value, onChange, suggestedIdPrefix = "act" }: Props) {
  function update(idx: number, patch: Partial<RoleAction>) {
    onChange(value.map((a, i) => i === idx ? { ...a, ...patch } : a))
  }

  function toggleRole(idx: number, role: Role) {
    const action = value[idx]
    const roles = action.allowedRoles.includes(role)
      ? action.allowedRoles.filter(r => r !== role)
      : [...action.allowedRoles, role]
    update(idx, { allowedRoles: roles })
  }

  function add() {
    onChange([
      ...value,
      {
        id: `${suggestedIdPrefix}-${makeId("a")}`,
        label: "",
        description: "",
        allowedRoles: [],
        isRecommended: false,
        irPlanAligned: true,
      },
    ])
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          No role actions yet. Add one to make this round decision-actionable.
        </p>
      )}
      {value.map((action, idx) => (
        <div key={action.id} className="flex flex-col gap-2 rounded border border-border bg-background p-2">
          <div className="flex items-center gap-2">
            <Input
              value={action.id}
              onChange={e => update(idx, { id: e.target.value })}
              placeholder="id (used to link decisions)"
              className="h-7 font-mono text-[11px]"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} className="h-7 text-destructive">
              <Trash2 className="size-3" />
            </Button>
          </div>
          <Input
            value={action.label}
            onChange={e => update(idx, { label: e.target.value })}
            placeholder="Label (shown to participant)"
            className="h-7"
          />
          <Textarea
            rows={2}
            value={action.description}
            onChange={e => update(idx, { description: e.target.value })}
            placeholder="Description"
            className="text-xs"
          />
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Allowed roles</Label>
            <div className="flex flex-wrap gap-1">
              {ALL_ROLES.map(role => {
                const active = action.allowedRoles.includes(role)
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(idx, role)}
                    className={`rounded border px-1.5 py-0.5 font-mono text-[9px] transition-colors ${
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {ROLE_META[role].label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={action.isRecommended ?? false}
                onChange={e => update(idx, { isRecommended: e.target.checked })}
                className="size-3"
              />
              <span>Recommended</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={action.irPlanAligned}
                onChange={e => update(idx, { irPlanAligned: e.target.checked })}
                className="size-3"
              />
              <span>IR-plan aligned</span>
            </label>
          </div>
          <Textarea
            rows={2}
            value={action.consequence ?? ""}
            onChange={e => update(idx, { consequence: e.target.value })}
            placeholder="Consequence (optional)"
            className="text-xs"
          />
          {/* Scoring block — qualityRank + commentary. Outcome vectors live on
              DecisionNode options, not on RoleActions. */}
          <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">Kwaliteit</Label>
              <div className="flex gap-1 flex-1">
                {QUALITY_RANKS.map(r => {
                  const on = action.qualityRank === r.key
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => update(idx, { qualityRank: on ? undefined : r.key })}
                      className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                        on ? r.className : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <Textarea
              rows={2}
              value={action.facilitatorCommentary ?? ""}
              onChange={e => update(idx, { facilitatorCommentary: e.target.value || undefined })}
              placeholder="IR-retainer perspectief — verschijnt in review-fase én rapport"
              className="text-[11px]"
            />
            <Textarea
              rows={2}
              value={action.lessonLearned ?? ""}
              onChange={e => update(idx, { lessonLearned: e.target.value })}
              placeholder="Lesson learned (1 zin voor debrief)"
              className="text-[11px]"
            />
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={action.respondsToMisleading ?? false}
                onChange={e => update(idx, { respondsToMisleading: e.target.checked || undefined })}
                className="size-3"
              />
              <span>Reactie op misleidend signaal</span>
            </label>
            <details className="text-[11px]">
              <summary className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer">
                Push respons-inject bij submit (IR-consult mechanic)
              </summary>
              <div className="mt-1 flex flex-col gap-1">
                <Input
                  value={action.pushesInject?.title ?? ""}
                  onChange={e => update(idx, {
                    pushesInject: e.target.value
                      ? { ...(action.pushesInject ?? { content: "" }), title: e.target.value }
                      : undefined,
                  })}
                  placeholder="Inject-titel (bijv. 'IR-partner reageert')"
                  className="h-7 text-[11px]"
                />
                <Textarea
                  rows={3}
                  value={action.pushesInject?.content ?? ""}
                  onChange={e => update(idx, {
                    pushesInject: {
                      title: action.pushesInject?.title ?? "IR-respons",
                      content: e.target.value,
                      channel: action.pushesInject?.channel,
                      onlyToSubmitter: action.pushesInject?.onlyToSubmitter,
                    },
                  })}
                  placeholder="Inhoud van response-inject"
                  className="text-[11px]"
                />
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={action.pushesInject?.onlyToSubmitter ?? false}
                    onChange={e => update(idx, {
                      pushesInject: action.pushesInject
                        ? { ...action.pushesInject, onlyToSubmitter: e.target.checked }
                        : undefined,
                    })}
                    className="size-3"
                    disabled={!action.pushesInject}
                  />
                  <span>Alleen naar indiener (anders naar hele team)</span>
                </label>
              </div>
            </details>
            <details className="text-[11px]">
              <summary className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer">
                Testgebieden (toezichthouder) ({action.supervisionAreas?.length ?? 0})
              </summary>
              <div className="mt-1 grid grid-cols-1 gap-1">
                {SUPERVISION_AREAS.map(a => {
                  const on = (action.supervisionAreas ?? []).includes(a.id)
                  return (
                    <label key={a.id} className="flex items-start gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const next: SupervisionArea[] = on
                            ? (action.supervisionAreas ?? []).filter(x => x !== a.id)
                            : [...(action.supervisionAreas ?? []), a.id]
                          update(idx, { supervisionAreas: next.length ? next : undefined })
                        }}
                        className="size-3 mt-0.5"
                      />
                      <span>
                        <span className="font-mono text-[10px] text-muted-foreground">{a.numberLabel}.</span>{" "}
                        <span>{a.label}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </details>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="size-3" />
        Add role action
      </Button>
    </div>
  )
}

