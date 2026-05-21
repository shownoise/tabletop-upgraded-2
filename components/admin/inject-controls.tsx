"use client"

import { useState } from "react"
import { AlertTriangle, Check, Loader2, Send, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Inject, InjectType, SessionState, Urgency } from "@/lib/types"
import { api } from "@/lib/api-client"
import { injectTypeLabel, urgencyClasses, urgencyLabel, channelLabel, channelIcon } from "@/lib/format"

const INJECT_TYPES: InjectType[] = ["alert","intel","media","executive","technical","regulatory","social","internal"]
const URGENCIES: Urgency[] = ["low", "medium", "high", "critical"]

export function InjectControls({ session, disabled, lang = "en" }: { session: SessionState; disabled?: boolean; lang?: import("@/lib/i18n").Lang }) {
  const currentIndex = session.currentRound
  const isLobby = session.status === "lobby"
  const isEnded = session.status === "ended"
  const round = currentIndex >= 0 ? session.scenario.rounds[currentIndex] : null

  const pushedIds = new Set(session.pushedInjects.map((p) => p.inject.id))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePush(injectId: string) {
    if (currentIndex < 0) return
    setBusy(injectId)
    setError(null)
    try {
      await api.pushInject({ roundIndex: currentIndex, injectId })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {(isLobby || isEnded) && (
        <div className="rounded-md border border-border bg-background px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {isLobby ? "Round controls unlock when you start the session." : "Exercise has ended. Reset to start a new one."}
        </div>
      )}

      {round && (
        <div className="flex flex-col gap-4">
          {/* Situation update */}
          <div className="rounded-md border border-border bg-background/50 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{round.situation_update}</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Planned injects ({round.injects.length})
              </span>
              <SurpriseInjectDialog disabled={disabled || isLobby || isEnded} />
            </div>

            <ul className="flex flex-col gap-3">
              {round.injects.map((inject) => {
                const pushed = pushedIds.has(inject.id)
                return (
                  <InjectRow
                    key={inject.id}
                    inject={inject}
                    pushed={pushed}
                    busy={busy === inject.id}
                    disabled={disabled || isLobby || isEnded || pushed || busy !== null}
                    onPush={() => handlePush(inject.id)}
                  />
                )
              })}
            </ul>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Round preview */}
      <details className="rounded-md border border-border bg-background">
        <summary className="cursor-pointer select-none px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
          Preview all rounds ({session.scenario.rounds.length})
        </summary>
        <ul className="divide-y divide-border">
          {session.scenario.rounds.map((r, i) => (
            <li key={i} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">R{i + 1} • {r.title}</span>
                <div className="flex items-center gap-2">
                  {r.timerMinutes && (
                    <span className="font-mono text-[10px] text-primary">⏱ {r.timerMinutes}m</span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.injects.length} injects
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.situation_update}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function InjectRow(props: { inject: Inject; pushed: boolean; busy: boolean; disabled: boolean; onPush: () => void }) {
  const { inject, pushed, busy, disabled, onPush } = props
  return (
    <li className={`flex flex-col gap-3 rounded-md border bg-background p-4 transition-colors ${pushed ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-border bg-transparent font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {injectTypeLabel(inject.type)}
        </Badge>
        <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-wider ${urgencyClasses(inject.urgency)}`}>
          {urgencyLabel(inject.urgency)}
        </Badge>
        {inject.channel && (
          <Badge variant="outline" className="border-border bg-card font-mono text-[10px] uppercase tracking-wider text-muted-foreground gap-1">
            <span>{channelIcon(inject.channel)}</span>
            {channelLabel(inject.channel)}
          </Badge>
        )}
        {inject.source && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">▸ {inject.source}</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-medium leading-snug">{inject.title}</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{inject.content}</p>
        {inject.senderName && (
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            Sender: {inject.senderName}{inject.senderHandle ? ` · ${inject.senderHandle}` : ""}
            {inject.timestamp ? ` · ${inject.timestamp}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant={pushed ? "outline" : "default"}
          disabled={disabled}
          onClick={onPush}
          className="gap-2 font-mono uppercase tracking-wider"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : pushed ? <Check className="size-3.5" /> : <Send className="size-3.5" />}
          {pushed ? "Pushed" : "Push to participants"}
        </Button>
      </div>
    </li>
  )
}

function SurpriseInjectDialog({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [type, setType] = useState<InjectType>("alert")
  const [urgency, setUrgency] = useState<Urgency>("critical")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await api.surpriseInject({ title, content, type, urgency })
      setOpen(false)
      setTitle("")
      setContent("")
      setType("alert")
      setUrgency("critical")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}
          className="gap-2 border-destructive/50 bg-destructive/10 font-mono uppercase tracking-wider text-destructive-foreground hover:bg-destructive/20">
          <Zap className="size-3.5" /> Surprise inject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" /> Trigger surprise inject
          </DialogTitle>
          <DialogDescription>
            Pushed instantly to every participant. Use sparingly — these break the planned narrative.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Twitter leak detected" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Content</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="resize-none" placeholder="Describe what just happened…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as InjectType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{injectTypeLabel(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{URGENCIES.map((u) => <SelectItem key={u} value={u}>{urgencyLabel(u)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive-foreground">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !title.trim() || !content.trim()} className="gap-2 font-mono uppercase tracking-wider">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            Trigger inject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
