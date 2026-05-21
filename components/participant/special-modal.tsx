"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle, FileText, Loader2, MessageSquare, Newspaper, Send, ThumbsDown, ThumbsUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api-client"
import type { SpecialChoice, SpecialEvent, SpecialMessage } from "@/lib/types"

const SPECIAL_LABELS: Record<string, string> = {
  ransomware_negotiation: "Ransomware Negotiation",
  ap_notification: "AP Meldingsformulier",
  journalist_qa: "NOS Interview",
}

const COUNTERPART_LABELS: Record<string, string> = {
  ransomware_negotiation: "DarkBridge Collective",
  ap_notification: "AP Formulier",
  journalist_qa: "Sanne Visser · NOS Nieuws",
}

const SPECIAL_ICONS: Record<string, React.ReactNode> = {
  ransomware_negotiation: <MessageSquare className="size-4" />,
  ap_notification: <FileText className="size-4" />,
  journalist_qa: <Newspaper className="size-4" />,
}

const QUALITY_STYLE: Record<string, string> = {
  bad: "border-destructive/40 bg-destructive/5 hover:bg-destructive/10 text-foreground",
  neutral: "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-foreground",
  good: "border-primary/40 bg-primary/5 hover:bg-primary/10 text-foreground",
}

const QUALITY_BADGE: Record<string, string> = {
  bad: "text-destructive border-destructive/40 bg-destructive/10",
  neutral: "text-amber-600 border-amber-500/40 bg-amber-500/10",
  good: "text-primary border-primary/40 bg-primary/10",
}

const QUALITY_LABEL: Record<string, string> = {
  bad: "Slecht",
  neutral: "Neutraal",
  good: "Goed",
}

const AP_FIELDS = [
  { key: "organization", label: "Naam organisatie", placeholder: "Juridische naam" },
  { key: "controller", label: "Contactpersoon verwerkingsverantwoordelijke", placeholder: "Naam en contactgegevens FG of verantwoordelijke" },
  { key: "nature", label: "Aard van de inbreuk", placeholder: "Type inbreuk (vertrouwelijkheid, integriteit, beschikbaarheid)" },
  { key: "categories", label: "Categorieën persoonsgegevens", placeholder: "bijv. klantnamen, e-mailadressen, financiële gegevens, gezondheidsdata" },
  { key: "subjects", label: "Geschat aantal betrokkenen", placeholder: "bijv. ca. 5.000 klanten" },
  { key: "consequences", label: "Waarschijnlijke gevolgen", placeholder: "Mogelijke schade voor betrokkenen" },
  { key: "measures", label: "Getroffen maatregelen", placeholder: "Acties om de inbreuk te beperken en gevolgen te mitigeren" },
  { key: "discovered", label: "Datum/tijd ontdekking", placeholder: "bijv. 2026-05-04 09:30" },
]

// ─── Message bubble ───────────────────────────────────────────

function MessageBubble({ msg, counterpartLabel }: { msg: SpecialMessage; counterpartLabel: string }) {
  const isCounterpart = msg.sender === "counterpart"

  return (
    <div className={`flex gap-3 ${isCounterpart ? "" : "flex-row-reverse"}`}>
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-bold uppercase ${
        isCounterpart
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-primary/40 bg-primary/10 text-primary"
      }`}>
        {isCounterpart ? "!" : "JIJ"}
      </div>
      <div className={`max-w-[85%] flex flex-col gap-1 ${isCounterpart ? "" : "items-end"}`}>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {isCounterpart ? counterpartLabel : (msg.participantName ?? "Jij")}
        </span>
        <div className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isCounterpart
            ? "bg-card border border-border"
            : "bg-primary/10 border border-primary/20"
        }`}>
          {msg.text}
            {/* Quality badge on participant messages (scripted choice or AI evaluation) */}
          {msg.choiceQuality && (
            <span className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${QUALITY_BADGE[msg.choiceQuality]}`}>
              {msg.choiceQuality === "good" ? <ThumbsUp className="size-2.5" /> : msg.choiceQuality === "bad" ? <ThumbsDown className="size-2.5" /> : null}
              {QUALITY_LABEL[msg.choiceQuality]}
              {msg.scoreImpact !== undefined && msg.scoreImpact !== 0 && (
                <span>{msg.scoreImpact > 0 ? `+${msg.scoreImpact}` : msg.scoreImpact}</span>
              )}
            </span>
          )}
        </div>
        <span className="font-mono text-[9px] text-muted-foreground/50">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {/* AI evaluation hint */}
        {msg.aiEvaluationHint && msg.choiceQuality && (
          <div className={`mt-1 rounded-lg border px-3 py-1.5 text-[11px] leading-relaxed ${QUALITY_BADGE[msg.choiceQuality]}`}>
            <span className="font-semibold">{QUALITY_LABEL[msg.choiceQuality]}: </span>{msg.aiEvaluationHint}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Choice hint tooltip ──────────────────────────────────────

function ChoiceHint({ hint, quality }: { hint: string; quality: SpecialChoice["quality"] }) {
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${QUALITY_BADGE[quality]}`}>
      <span className="font-semibold">{QUALITY_LABEL[quality]}: </span>{hint}
    </div>
  )
}

// ─── Scripted choice UI ───────────────────────────────────────

function ScriptedChoices({
  choices,
  onChoose,
  sending,
  lastChoiceId,
  lastHint,
  lastQuality,
}: {
  choices: SpecialChoice[]
  onChoose: (choice: SpecialChoice) => void
  sending: boolean
  lastChoiceId: string | null
  lastHint: string | null
  lastQuality: SpecialChoice["quality"] | null
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Kies jouw reactie:</span>
      {choices.map(choice => (
        <button
          key={choice.id}
          onClick={() => onChoose(choice)}
          disabled={sending || lastChoiceId !== null}
          className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-all hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="leading-relaxed">{choice.label}</span>
          {sending && lastChoiceId === choice.id && <Loader2 className="size-3.5 animate-spin shrink-0 ml-auto mt-0.5" />}
        </button>
      ))}
      {lastHint && lastQuality && (
        <ChoiceHint hint={lastHint} quality={lastQuality} />
      )}
    </div>
  )
}

// ─── Chat special (scripted or AI) ───────────────────────────

function ChatSpecial({
  special,
  participantId,
}: {
  special: SpecialEvent
  participantId: string
}) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastChoiceId, setLastChoiceId] = useState<string | null>(null)
  const [lastHint, setLastHint] = useState<string | null>(null)
  const [lastQuality, setLastQuality] = useState<SpecialChoice["quality"] | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const counterpartLabel = COUNTERPART_LABELS[special.type] ?? "Counterpart"

  // Clear pending state when new messages arrive via SSE
  useEffect(() => {
    setLastChoiceId(null)
    setLastHint(null)
    setLastQuality(null)
  }, [special.messages.length])

  // Fallback: if SSE doesn't deliver within 8s, unblock buttons
  useEffect(() => {
    if (!lastChoiceId) return
    const t = setTimeout(() => setLastChoiceId(null), 8000)
    return () => clearTimeout(t)
  }, [lastChoiceId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [special.messages.length])

  // Find the last counterpart message — it may have choices attached
  const lastCounterpartMsg = [...special.messages].reverse().find(m => m.sender === "counterpart")
  const pendingChoices = lastCounterpartMsg?.choices ?? []

  async function handleChoice(choice: SpecialChoice) {
    if (sending || lastChoiceId) return
    setSending(true)
    setLastChoiceId(choice.id)
    setLastHint(choice.hint)
    setLastQuality(choice.quality)
    setError(null)
    try {
      await api.chooseSpecial({ specialId: special.id, participantId, choiceId: choice.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verzenden mislukt")
      setLastChoiceId(null)
    } finally {
      setSending(false)
    }
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    try {
      await api.sendSpecialMessage({ specialId: special.id, participantId, text: trimmed })
      setText("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verzenden mislukt")
    } finally {
      setSending(false)
    }
  }

  const isCompleted = special.status === "completed"

  return (
    <>
      {/* Message history */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-4 min-h-0">
        {special.messages
          .filter(m => !m.choices || m.sender !== "counterpart" || special.messages.indexOf(m) === special.messages.length - 1 || m.text !== lastCounterpartMsg?.text)
          .map(msg => (
            <MessageBubble key={msg.id} msg={msg} counterpartLabel={counterpartLabel} />
          ))}
        <div ref={bottomRef} />
      </div>

      {/* Score indicator */}
      {special.mode === "static" && (special.totalScore ?? 0) !== 0 && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-mono ${
          (special.totalScore ?? 0) > 0 ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/5 text-destructive"
        }`}>
          Score: {(special.totalScore ?? 0) > 0 ? "+" : ""}{special.totalScore ?? 0} punten
        </div>
      )}

      {/* Input area */}
      {!isCompleted ? (
        special.mode === "static" ? (
          <ScriptedChoices
            choices={pendingChoices}
            onChoose={handleChoice}
            sending={sending}
            lastChoiceId={lastChoiceId}
            lastHint={lastHint}
            lastQuality={lastQuality}
          />
        ) : (
          <div className="border-t border-border pt-4 flex flex-col gap-2">
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" /> {error}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Typ uw reactie…"
                rows={3}
                className="resize-none font-mono text-sm"
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend() }}
              />
              <Button
                onClick={handleSend}
                disabled={sending || !text.trim()}
                className="self-end gap-2 font-mono uppercase tracking-wider"
              >
                {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Stuur
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">Cmd+Enter om te sturen</p>
          </div>
        )
      ) : (
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="size-4 text-primary" />
            Dit onderdeel is afgesloten.
          </div>
          {special.mode === "static" && (
            <div className={`rounded-lg border px-4 py-2.5 font-mono text-sm ${
              (special.totalScore ?? 0) >= 3
                ? "border-primary/40 bg-primary/5 text-primary"
                : (special.totalScore ?? 0) >= 0
                ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            }`}>
              Eindscore: {(special.totalScore ?? 0) > 0 ? "+" : ""}{special.totalScore ?? 0} punten
              {(special.totalScore ?? 0) >= 3
                ? " — Uitstekend crisis management"
                : (special.totalScore ?? 0) >= 0
                ? " — Redelijke respons, verbeterpunten mogelijk"
                : " — Kritieke fouten gemaakt"}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ─── AP notification form ─────────────────────────────────────

function ApFormSpecial({
  special,
  participantId,
}: {
  special: SpecialEvent
  participantId: string
}) {
  const [formData, setFormData] = useState<Record<string, string>>(special.formData ?? {})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCompleted = !!special.formData || special.status === "completed"

  function update(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await api.submitApForm({ specialId: special.id, participantId, formData })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verzenden mislukt")
    } finally {
      setSubmitting(false)
    }
  }

  if (isCompleted) {
    return (
      <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <CheckCircle className="size-5 text-primary shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-medium">Formulier ingediend</span>
            <span className="text-xs text-muted-foreground">De AP-melding is opgeslagen. De facilitator kan het inzien in het sessierapport.</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {AP_FIELDS.map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</span>
              <p className="min-h-[2.5rem] rounded-md border border-border bg-card px-3 py-2 text-sm">
                {formData[f.key] || <span className="italic text-muted-foreground">Niet ingevuld</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
          <strong>AVG Artikel 33</strong> verplicht melding bij de AP binnen <strong>72 uur</strong> na ontdekking van een datalek. Vul dit formulier zo volledig mogelijk in.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {AP_FIELDS.map(f => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</label>
            <Textarea
              value={formData[f.key] ?? ""}
              onChange={e => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={submit}
        disabled={submitting}
        className="gap-2 font-mono uppercase tracking-wider self-start"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        Indienen bij AP
      </Button>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────

export function SpecialModal({
  special,
  participantId,
  onClose,
}: {
  special: SpecialEvent
  participantId: string
  onClose: () => void
}) {
  const label = SPECIAL_LABELS[special.type] ?? special.type
  const icon = SPECIAL_ICONS[special.type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
              {icon}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Special Event</span>
              <span className="font-mono text-sm font-semibold">{label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {special.status === "active" && (
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-destructive">
                <span className="size-1.5 rounded-full bg-destructive animate-pulse" /> Live
              </span>
            )}
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-hidden px-6 pb-6 min-h-0">
          {special.type === "ap_notification" ? (
            <div className="overflow-y-auto flex-1 pt-4">
              <ApFormSpecial special={special} participantId={participantId} />
            </div>
          ) : (
            <ChatSpecial special={special} participantId={participantId} />
          )}
        </div>
      </div>
    </div>
  )
}
