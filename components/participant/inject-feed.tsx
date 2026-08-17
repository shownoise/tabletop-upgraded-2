"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Mail, MessageSquare, MessageCircle, AlertTriangle, Phone,
  Newspaper, Shield, Smartphone, FileText, ShieldAlert, EyeOff, Check,
} from "lucide-react"
import type { FactCheckTag, PushedInject, InjectChannel, InjectType, SessionState, Urgency } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { Role } from "@/lib/types"
import { getInjectRecipients, resolveInjectRecipients } from "@/lib/inject-routing"
import { buildTeamRoles } from "@/lib/team-roster"
import { InjectVerifyMenu } from "./inject-verify-menu"
import { InjectAnnotator } from "./inject-annotator"
import { api } from "@/lib/api-client"
import { formatTime } from "@/lib/format"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"
import { stripMarkdown } from "@/lib/render-markdown"

// ─────────────────── Channel config (brand colors stay hardcoded) ───────────────────
const CHANNEL_CONFIG: Record<string, { label: string; color: string; Icon: React.FC<{ className?: string; style?: React.CSSProperties }> }> = {
  whatsapp:     { label: "WHATSAPP",    color: "#25D366",             Icon: MessageCircle },
  slack:        { label: "TEAMS/SLACK", color: "var(--tt-purple)",    Icon: MessageSquare },
  email:        { label: "EMAIL",       color: "var(--tt-blue)",      Icon: Mail },
  siem_alert:   { label: "SIEM ALERT",  color: "var(--tt-red)",       Icon: AlertTriangle },
  phone:        { label: "PHONE",       color: "var(--tt-green)",     Icon: Phone },
  news_ticker:  { label: "BREAKING",    color: "var(--tt-red)",       Icon: Newspaper },
  system_alert: { label: "EDR/SYSTEM",  color: "var(--tt-warn)",      Icon: Shield },
  sms:          { label: "SMS",         color: "#25D366",             Icon: Smartphone },
  raw:          { label: "MEMO",        color: "var(--tt-dim)",       Icon: FileText },
}

const INJECT_TYPE_LABELS: Partial<Record<InjectType, string>> = {
  alert:      "ALERT",
  intel:      "INTEL",
  media:      "MEDIA",
  executive:  "EXECUTIVE",
  technical:  "TECHNICAL",
  regulatory: "REGULATORY",
  social:     "SOCIAL",
  internal:   "INTERNAL",
}

const CHANNEL_REMAP: Partial<Record<string, InjectChannel>> = {
  teams:       "slack",
  siem:        "siem_alert",
  edr:         "system_alert",
  news:        "news_ticker",
  memo:        "raw",
  ransom_note: "raw",
}

type InjectSize = "sm" | "md" | "xl"

interface InjectCardProps {
  inject: PushedInject["inject"]
  pushedAt: number
  size: InjectSize
  myTag?: FactCheckTag
  totalTags?: number
  hasSplit?: boolean
  reviewPhase?: boolean
  participantId?: string
  myAnnotations?: Array<{ id: string; start: number; end: number; tag: FactCheckTag }>
  onTag?: (tag: FactCheckTag) => void | Promise<void>
  isFactCheckTarget?: boolean
  lang: Lang
}

function urgencyLabel(lang: Lang, u: Urgency): string {
  return tr(lang, `urgency_${u}` as Parameters<typeof tr>[1])
}

const OWN_TAG_STYLE: Record<FactCheckTag, { border: string; pill: string; underline: string }> = {
  fact:       { border: "border-l-emerald-500", pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500", underline: "decoration-emerald-500/60" },
  assumption: { border: "border-l-yellow-500",  pill: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500",    underline: "decoration-yellow-500/60"  },
}

// ─────────────────── Shell (shared wrapper) ───────────────────
function Shell({
  channel,
  inject,
  pushedAt,
  size,
  subheader,
  myTag,
  participantId,
  myAnnotations,
  reviewPhase,
  isFactCheckTarget,
}: InjectCardProps & { channel: string; subheader?: React.ReactNode }) {
  const cfg = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.raw
  const { Icon } = cfg
  const big = size === "xl"
  const typeLabel = inject.type ? INJECT_TYPE_LABELS[inject.type] : undefined
  const showTeamBadge = inject.targetTeam && inject.targetTeam !== "all"
  const ownStyle = myTag ? OWN_TAG_STYLE[myTag] : undefined
  const borderStyle = ownStyle
    ? undefined
    : { borderLeft: `3px solid ${cfg.color}` }
  const borderCls = ownStyle ? `border-l-[3px] ${ownStyle.border}` : ""
  return (
    <div
      className={`border border-tt-border bg-tt-surface overflow-hidden ${borderCls}`}
      style={borderStyle}
    >
      {/* Channel strip */}
      <div className="flex items-center gap-2 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
        <Icon className="size-3 shrink-0" style={{ color: cfg.color }} />
        <span
          className="font-mono text-[10px] font-bold tracking-widest shrink-0"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        {typeLabel && (
          <span className="font-mono text-[8px] uppercase tracking-widest text-tt-dim border border-tt-border px-1 py-px shrink-0">
            {typeLabel}
          </span>
        )}
        {inject.nis2Relevant && (
          <span className="font-mono text-[8px] uppercase tracking-widest shrink-0 border px-1 py-px"
            style={{ color: "var(--tt-blue)", borderColor: "color-mix(in srgb, var(--tt-blue) 40%, transparent)" }}>
            NIS2
          </span>
        )}
        {showTeamBadge && (
          <span className="font-mono text-[8px] uppercase tracking-widest shrink-0 border border-tt-accent/30 px-1 py-px text-tt-accent">
            {inject.targetTeam === "technical_it" ? "IT" : "CRISIS"}
          </span>
        )}
        {inject.classification && (
          <span className="font-mono text-[8px] uppercase tracking-widest shrink-0 border border-tt-border px-1 py-px text-tt-dim"
                title="Type informatie zoals aangemerkt door de auteur">
            {inject.classification}
          </span>
        )}
        <span className="font-mono text-[10px] text-tt-dim truncate flex-1 min-w-0">
          {inject.senderName ?? inject.source}
          {inject.senderHandle && (
            <span className="ml-1 opacity-50">&lt;{inject.senderHandle}&gt;</span>
          )}
        </span>
        {ownStyle && (
          <span
            className={`font-mono text-[9px] uppercase tracking-widest shrink-0 border px-1 py-px ${ownStyle.pill}`}
            title="Alleen jij ziet dit — jouw eigen markering"
          >
            {myTag}
          </span>
        )}
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>

      {subheader}

      {/* Content */}
      <div
        className={`px-4 py-4 font-mono leading-relaxed text-tt-bright whitespace-pre-wrap ${
          big ? "text-sm" : "text-xs"
        }`}
      >
        <InjectBody
          text={stripMarkdown(inject.content)}
          injectId={inject.id}
          participantId={isFactCheckTarget ? participantId : undefined}
          annotations={myAnnotations ?? []}
          reviewLocked={reviewPhase}
        />
      </div>
    </div>
  )
}

interface InjectBodyProps {
  text: string
  injectId: string
  participantId?: string
  annotations: Array<{ id: string; start: number; end: number; tag: FactCheckTag }>
  reviewLocked?: boolean
}

function InjectBody(props: InjectBodyProps) {
  const { text, injectId, participantId, annotations, reviewLocked } = props
  if (participantId && !reviewLocked) {
    return (
      <InjectAnnotator
        injectId={injectId}
        participantId={participantId}
        content={text}
        annotations={annotations}
      />
    )
  }
  if (annotations.length === 0) return <>{text}</>
  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  const segs: Array<{ start: number; end: number; tag?: FactCheckTag }> = []
  let cursor = 0
  for (const a of sorted) {
    if (a.start > cursor) segs.push({ start: cursor, end: a.start })
    segs.push({ start: Math.max(a.start, cursor), end: a.end, tag: a.tag })
    cursor = Math.max(cursor, a.end)
  }
  if (cursor < text.length) segs.push({ start: cursor, end: text.length })
  return (
    <>
      {segs.map((seg, i) => {
        const slice = text.slice(seg.start, seg.end)
        if (!seg.tag) return <span key={i}>{slice}</span>
        return (
          <span key={i} className={`underline decoration-2 ${OWN_TAG_STYLE[seg.tag].underline}`}>{slice}</span>
        )
      })}
    </>
  )
}

interface FactCheckFooterProps {
  inject: PushedInject["inject"]
  participantId?: string
  myTag?: FactCheckTag
  totalTags: number
  hasSplit: boolean
  reviewPhase: boolean
  onTag: (tag: FactCheckTag) => void | Promise<void>
}

function FactCheckFooter(props: FactCheckFooterProps) {
  const { participantId, myTag, totalTags, hasSplit, reviewPhase, onTag } = props
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !participantId) return
    if (myTag) return
    const key = `tabletop:verify-hint:${participantId}`
    if (window.localStorage.getItem(key) !== "seen") setShowHint(true)
  }, [participantId, myTag])
  function dismissHint() {
    if (typeof window === "undefined" || !participantId) return
    window.localStorage.setItem(`tabletop:verify-hint:${participantId}`, "seen")
    setShowHint(false)
  }
  if (!participantId) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-b-none border border-t-0 border-tt-border/60 px-4 py-2 bg-tt-surface">
      <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
        {totalTags > 0
          ? `${totalTags} markering${totalTags === 1 ? "" : "en"}${hasSplit ? " · uitgesplitst" : ""}`
          : "Nog niet gemarkeerd"}
      </span>
      <InjectVerifyMenu
        currentTag={myTag}
        disabled={reviewPhase}
        onTag={onTag}
        showFirstHint={showHint && !myTag}
        onDismissHint={dismissHint}
      />
    </div>
  )
}

// ─────────────────── Email ───────────────────
function EmailInject(props: InjectCardProps) {
  return (
    <Shell
      channel="email"
      {...props}
      subheader={
        props.inject.title ? (
          <div className="flex items-center gap-3 px-4 py-2 bg-tt-blue/5 border-b border-tt-border">
            <span className="font-mono text-[10px] text-tt-dim shrink-0">SUBJECT</span>
            <span className="font-mono text-xs text-tt-blue truncate">{props.inject.title}</span>
          </div>
        ) : undefined
      }
    />
  )
}

// ─────────────────── Slack / Teams ───────────────────
function SlackInject(props: InjectCardProps) {
  return <Shell channel="slack" {...props} />
}

// ─────────────────── WhatsApp ───────────────────
function WhatsAppInject(props: InjectCardProps) {
  const { inject, pushedAt, size } = props
  const big = size === "xl"
  return (
    <div
      className="border border-tt-border bg-tt-surface overflow-hidden"
      style={{ borderLeft: "3px solid #25D366" }}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
        <MessageCircle className="size-3 shrink-0 text-[#25D366]" />
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-[#25D366]">
          WHATSAPP
        </span>
        {inject.nis2Relevant && (
          <span className="font-mono text-[8px] uppercase tracking-widest shrink-0 border px-1 py-px"
            style={{ color: "var(--tt-blue)", borderColor: "color-mix(in srgb, var(--tt-blue) 40%, transparent)" }}>
            NIS2
          </span>
        )}
        <span className="font-mono text-[10px] text-tt-dim truncate flex-1">
          {inject.senderName ?? inject.source}
        </span>
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>
      <div className="px-4 py-4">
        <div
          className={`bg-tt-green/8 border border-[#25D366]/20 px-4 py-3 max-w-[90%] font-mono leading-relaxed text-tt-bright ${
            big ? "text-sm" : "text-xs"
          }`}
        >
          {stripMarkdown(inject.content)}
          <div className="mt-1.5 flex items-center justify-end gap-1">
            <span className="text-[9px] text-tt-dim">{inject.timestamp ?? formatTime(pushedAt)}</span>
            <span className="text-[9px] text-[#25D366]">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── SIEM Alert ───────────────────
function SiemAlert(props: InjectCardProps) {
  const { inject, lang } = props
  const isRed = inject.urgency === "critical"
  return (
    <Shell
      channel="siem_alert"
      {...props}
      subheader={
        <div className="flex items-center gap-3 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
          <span className="font-mono text-[10px] text-tt-dim shrink-0">RULE</span>
          <span className="font-mono text-xs text-tt-red truncate flex-1">{inject.title}</span>
          <span
            className={`font-mono text-[9px] px-2 py-0.5 shrink-0 uppercase ${
              isRed ? "bg-tt-red/20 text-tt-red" : "bg-tt-warn/20 text-tt-warn"
            }`}
          >
            {urgencyLabel(lang, inject.urgency)}
          </span>
        </div>
      }
    />
  )
}

// ─────────────────── System / EDR alert ───────────────────
function SystemAlertInject(props: InjectCardProps) {
  const { inject, lang } = props
  const isRed = inject.urgency === "critical" || inject.urgency === "high"
  return (
    <Shell
      channel="system_alert"
      {...props}
      subheader={
        inject.title ? (
          <div className="flex items-center gap-3 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
            <span
              className={`font-mono text-xs truncate flex-1 uppercase ${
                isRed ? "text-tt-red" : "text-tt-warn"
              }`}
            >
              [{urgencyLabel(lang, inject.urgency)}] {inject.title}
            </span>
          </div>
        ) : undefined
      }
    />
  )
}

// ─────────────────── Phone call ───────────────────
function PhoneCall(props: InjectCardProps) {
  const { inject, pushedAt, size } = props
  const big = size === "xl"
  return (
    <div
      className="border border-tt-border bg-tt-surface overflow-hidden"
      style={{ borderLeft: "3px solid var(--tt-green)" }}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
        <Phone className="size-3 shrink-0 text-tt-green" />
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-tt-green">
          PHONE
        </span>
        <span className="font-mono text-[10px] text-tt-dim truncate flex-1">
          {inject.senderName ?? inject.source}
          {inject.senderHandle && <span className="ml-1 opacity-50">{inject.senderHandle}</span>}
        </span>
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>
      <div className="px-3 py-2 border-b border-tt-border">
        <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Inkomend gesprek — transcript</span>
      </div>
      <div className={`px-4 py-4 font-mono leading-relaxed text-tt-bright whitespace-pre-wrap ${big ? "text-sm" : "text-xs"}`}>
        {stripMarkdown(inject.content)}
      </div>
    </div>
  )
}

// ─────────────────── News ticker ───────────────────
function NewsTickerInject(props: InjectCardProps) {
  const { inject, pushedAt, size } = props
  const big = size === "xl"
  return (
    <div
      className="border border-tt-border bg-tt-surface overflow-hidden"
      style={{ borderLeft: "3px solid var(--tt-red)" }}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-tt-red/10 border-b border-tt-red/40">
        <Newspaper className="size-3 shrink-0 text-tt-red" />
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-tt-red animate-pulse">
          BREAKING
        </span>
        {inject.nis2Relevant && (
          <span className="font-mono text-[8px] uppercase tracking-widest shrink-0 border px-1 py-px"
            style={{ color: "var(--tt-blue)", borderColor: "color-mix(in srgb, var(--tt-blue) 40%, transparent)" }}>
            NIS2
          </span>
        )}
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {inject.senderName ?? inject.source}
        </span>
        <span className="font-mono text-[10px] text-tt-dim ml-auto shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>
      {inject.title && (
        <div className="px-4 pt-4 font-mono text-sm font-bold text-tt-red">
          {inject.title}
        </div>
      )}
      <div className={`px-4 py-4 font-mono whitespace-pre-wrap leading-relaxed text-tt-bright ${big ? "text-sm" : "text-xs"}`}>
        {stripMarkdown(inject.content)}
      </div>
    </div>
  )
}

// ─────────────────── SMS ───────────────────
function SmsInject(props: InjectCardProps) {
  return <Shell channel="sms" {...props} />
}

// ─────────────────── Raw / Memo ───────────────────
function RawInject(props: InjectCardProps) {
  const { inject } = props
  return (
    <Shell
      channel="raw"
      {...props}
      subheader={
        inject.title ? (
          <div className="px-4 py-2 border-b border-tt-border">
            <span className="font-mono text-xs text-tt-bright font-semibold">{inject.title}</span>
          </div>
        ) : undefined
      }
    />
  )
}

// ─────────────────── Card dispatcher ───────────────────
function InjectCard(props: InjectCardProps) {
  const raw = props.inject.channel ?? "raw"
  const channel = (CHANNEL_REMAP[raw] ?? raw) as InjectChannel
  switch (channel) {
    case "whatsapp":     return <WhatsAppInject {...props} />
    case "slack":        return <SlackInject {...props} />
    case "email":        return <EmailInject {...props} />
    case "siem_alert":   return <SiemAlert {...props} />
    case "phone":        return <PhoneCall {...props} />
    case "news_ticker":  return <NewsTickerInject {...props} />
    case "system_alert": return <SystemAlertInject {...props} />
    case "sms":          return <SmsInject {...props} />
    default:             return <RawInject {...props} />
  }
}

function computeTagStats(
  injectId: string,
  factChecks: SessionState["factChecks"],
  myParticipantId?: string,
): { totalTags: number; hasSplit: boolean; myTag?: FactCheckTag } {
  const list = (factChecks ?? []).filter(f => f.injectId === injectId)
  const totalTags = list.length
  const tags = new Set(list.map(f => f.tag))
  const hasSplit = tags.size > 1
  const myTag = myParticipantId ? list.find(f => f.participantId === myParticipantId)?.tag : undefined
  return { totalTags, hasSplit, myTag }
}

// ─────────────────── Size logic ───────────────────
function getSize(urgency: Urgency, index: number, isSurprise: boolean): InjectSize {
  if (isSurprise || urgency === "critical") return "xl"
  if (urgency === "high" && index === 0) return "xl"
  if (urgency === "high") return "md"
  return "sm"
}

// ─────────────────── Feed ───────────────────
function isSelfReferential(senderName: string | undefined, myRoleLabel: string): boolean {
  if (!senderName) return false
  const s = senderName.toLowerCase().trim()
  const r = myRoleLabel.toLowerCase().trim()
  return s === r || s.startsWith(r + " ") || s.startsWith(r + ",")
}

export function InjectFeed({
  pushed,
  lang,
  participantRole,
  participants,
  session,
  participantId,
}: {
  pushed: PushedInject[]
  lang: Lang
  participantRole?: Role
  participants?: Array<{ role?: Role | null }>
  session?: SessionState
  participantId?: string
}) {
  const myRoleLabel = participantRole ? ROLE_META[participantRole]?.label : undefined

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const teamRoles = useMemo(buildTeamRoles, [])
  const presentRoles = useMemo<Role[]>(
    () => (participants ?? []).map(p => p.role).filter((r): r is Role => !!r),
    [participants],
  )

  // Phase 6 — read this participant's view state from the session projection.
  const myView = participantId
    ? session?.participantViewState?.[participantId]
    : undefined
  const hiddenIds = new Set(myView?.hidden ?? [])
  const handledIds = new Set(myView?.handled ?? [])
  const classFilter = myView?.filters?.classification ?? []
  const hideHandledFilter = myView?.filters?.hideHandled === true

  const visibleByRole = pushed.filter((p) => {
    if (p.pushedAt > now) return false
    if (myRoleLabel && isSelfReferential(p.inject.senderName, myRoleLabel)) return false
    if (!participantRole) return true
    if (presentRoles.length === 0) {
      const inject = p.inject
      if (inject.targetRoles?.length) return inject.targetRoles.includes(participantRole)
      return true
    }
    const recipients = session
      ? getInjectRecipients(p.inject, session, teamRoles)
      : resolveInjectRecipients({ inject: p.inject, presentRoles, teamRoles })
    return recipients.includes(participantRole)
  })

  // Apply classification filter (if any active). Injects without classification
  // stay visible only when the filter is empty.
  const afterClassFilter = classFilter.length === 0
    ? visibleByRole
    : visibleByRole.filter(p => p.inject.classification && classFilter.includes(p.inject.classification))

  // Split: hidden vs shown. Sort newest-first.
  const afterHandledFilter = hideHandledFilter
    ? afterClassFilter.filter(p => !handledIds.has(p.inject.id))
    : afterClassFilter
  const shown = afterHandledFilter.filter(p => !hiddenIds.has(p.inject.id))
  const sorted = [...shown].sort((a, b) => b.pushedAt - a.pushedAt)
  const hiddenCount = afterClassFilter.filter(p => hiddenIds.has(p.inject.id)).length
  const handledCount = afterClassFilter.filter(p => handledIds.has(p.inject.id) && !hiddenIds.has(p.inject.id)).length
  const topRef = useRef<HTMLDivElement>(null)

  const prevCount = useRef(pushed.length)
  useEffect(() => {
    if (pushed.length > prevCount.current) {
      try {
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      } catch {
        const parent = topRef.current?.parentElement
        if (parent) parent.scrollTop = 0
      }
    }
    prevCount.current = pushed.length
  }, [pushed.length])

  const allHiddenByHandledFilter = hideHandledFilter && handledCount > 0 && shown.length === 0

  async function toggleHideHandledEmpty() {
    if (!participantId) return
    try {
      await api.updateMyView({
        participantId,
        patch: { filters: { classification: classFilter, hideHandled: false } },
      })
    } catch { /* ignore */ }
  }

  if (shown.length === 0) {
    // Distinguish: everything handled (via filter) vs role-filtered vs truly empty.
    if (allHiddenByHandledFilter) {
      return (
        <div className="flex flex-col items-center gap-3 border border-tt-border bg-tt-surface px-6 py-12 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">
            Alle {handledCount} injects zijn afgehandeld
          </div>
          <button
            type="button"
            onClick={toggleHideHandledEmpty}
            className="rounded-full border border-tt-accent bg-tt-accent/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-tt-accent hover:bg-tt-accent/20"
          >
            Toon afgehandelde
          </button>
        </div>
      )
    }
    const roleFiltered = pushed.length > 0 && shown.length === 0
    return (
      <div className="flex flex-col items-center gap-4 border border-tt-border bg-tt-surface px-6 py-16 text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">
          {roleFiltered ? "Geen injects voor jouw rol in deze ronde" : tr(lang, "awaitingInjects")}
        </div>
        {!roleFiltered && (
          <div className="flex gap-2 justify-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 bg-tt-dim dot-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const CLASSIFICATIONS: Array<'feit' | 'aanname'> = ['feit', 'aanname']

  async function toggleClassFilter(v: 'feit' | 'aanname') {
    if (!participantId) return
    const next = classFilter.includes(v)
      ? classFilter.filter(x => x !== v)
      : [...classFilter, v]
    try {
      await api.updateMyView({
        participantId,
        patch: { filters: { classification: next, hideHandled: hideHandledFilter } },
      })
    } catch { /* ignore */ }
  }

  async function toggleHideHandled() {
    if (!participantId) return
    try {
      await api.updateMyView({
        participantId,
        patch: { filters: { classification: classFilter, hideHandled: !hideHandledFilter } },
      })
    } catch { /* ignore */ }
  }

  async function markHandled(injectId: string) {
    if (!participantId) return
    try {
      await api.updateMyView({ participantId, patch: { addHandled: injectId } })
    } catch { /* ignore */ }
  }

  async function hideInject(injectId: string) {
    if (!participantId) return
    try {
      await api.updateMyView({ participantId, patch: { addHidden: injectId } })
    } catch { /* ignore */ }
  }

  async function showAllHidden() {
    if (!participantId) return
    try {
      await api.updateMyView({ participantId, patch: { clearHidden: true } })
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1" ref={topRef}>
        <span className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">
          {tr(lang, "incomingIntel")}
        </span>
        <span className="font-mono text-[10px] text-tt-accent border border-tt-accent/30 px-2 py-0.5">
          {sorted.length}
        </span>
      </div>
      {participantId && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-[10px]">
          <span className="font-mono uppercase tracking-widest text-tt-dim">Alleen tonen:</span>
          {CLASSIFICATIONS.map(v => {
            const on = classFilter.includes(v)
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleClassFilter(v)}
                className={`rounded-full border px-2 py-0.5 font-mono uppercase tracking-wider transition-colors ${
                  on ? "border-tt-accent bg-tt-accent/10 text-tt-accent" : "border-tt-border text-tt-dim hover:border-tt-accent/40"
                }`}
              >
                {v}
              </button>
            )
          })}
          {handledCount > 0 && (
            <button
              type="button"
              onClick={toggleHideHandled}
              title={hideHandledFilter ? "Toon ook afgehandelde" : "Verberg afgehandelde uit deze lijst"}
              className={`rounded-full border px-2 py-0.5 font-mono uppercase tracking-wider transition-colors ${
                hideHandledFilter ? "border-tt-accent bg-tt-accent/10 text-tt-accent" : "border-tt-border text-tt-dim hover:border-tt-accent/40"
              }`}
            >
              {hideHandledFilter ? `afgehandeld verborgen (${handledCount})` : `verberg afgehandeld (${handledCount})`}
            </button>
          )}
          {hiddenCount > 0 && (
            <span className="ml-auto flex items-center gap-2 font-mono text-tt-dim">
              {hiddenCount} verborgen
              <button
                type="button"
                onClick={showAllHidden}
                className="rounded border border-tt-border px-2 py-0.5 hover:border-tt-accent/40"
              >
                Toon alles
              </button>
            </span>
          )}
        </div>
      )}
      <ol
        className="flex flex-col gap-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label={tr(lang, "incomingIntel")}
      >
        {sorted.map((p, i) => {
          const size = getSize(p.inject.urgency, i, p.roundIndex < 0)
          const isSurprise = p.roundIndex < 0
          const dotColor =
            p.inject.urgency === "critical" ? "var(--tt-red)" :
            p.inject.urgency === "high"     ? "var(--tt-warn)" :
            p.inject.urgency === "medium"   ? "var(--tt-accent)" : "var(--tt-dim)"
          const isFactCheckTarget = p.inject.reliability !== undefined
          const reviewPhase = session?.roundPhase === "review"
          const { totalTags, hasSplit, myTag } = computeTagStats(p.inject.id, session?.factChecks, participantId)
          const isHandled = handledIds.has(p.inject.id)
          // Unread = not marked handled and not hidden (hidden ones are already gone).
          const isUnread = !isHandled
          return (
            <li
              key={`${p.inject.id}-${p.pushedAt}`}
              className="animate-slide-in-up"
              style={{ animationDelay: `${Math.min(i, 5) * 0.04}s` }}
            >
              {/* Urgency label strip */}
              <div className="flex items-center gap-2 px-1 mb-1">
                <span
                  className="size-1.5 shrink-0 dot-pulse"
                  style={{
                    backgroundColor: dotColor,
                    animationPlayState: p.inject.urgency === "critical" ? "running" : "paused",
                  }}
                />
                <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
                  {urgencyLabel(lang, p.inject.urgency)}
                  {isSurprise ? ` · ${tr(lang, "surprise")}` : ""}
                </span>
                {isUnread && participantId && (
                  <span className="size-1.5 rounded-full bg-tt-accent" aria-label="ongelezen" title="ongelezen" />
                )}
                <span className="ml-auto font-mono text-[9px] text-tt-dim">
                  {formatTime(p.pushedAt)}
                </span>
                {participantId && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => hideInject(p.inject.id)}
                      title="Verbergen"
                      className="rounded border border-tt-border p-0.5 text-tt-dim hover:border-tt-accent/40 hover:text-foreground"
                    >
                      <EyeOff className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => markHandled(p.inject.id)}
                      title="Afgehandeld"
                      className={`rounded border p-0.5 ${
                        isHandled
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-500"
                          : "border-tt-border text-tt-dim hover:border-tt-accent/40 hover:text-foreground"
                      }`}
                    >
                      <Check className="size-3" />
                    </button>
                  </div>
                )}
              </div>
              <InjectCard
                inject={p.inject}
                pushedAt={p.pushedAt}
                size={size}
                myTag={myTag}
                participantId={participantId}
                myAnnotations={(session?.injectAnnotations ?? []).filter(a => a.injectId === p.inject.id && a.participantId === participantId).map(a => ({ id: a.id, start: a.start, end: a.end, tag: a.tag }))}
                reviewPhase={reviewPhase}
                isFactCheckTarget={isFactCheckTarget}
                lang={lang}
              />
              {isFactCheckTarget && participantId && (
                <FactCheckFooter
                  inject={p.inject}
                  participantId={participantId}
                  myTag={myTag}
                  totalTags={totalTags}
                  hasSplit={hasSplit}
                  reviewPhase={reviewPhase}
                  onTag={async (tag) => {
                    try {
                      await api.tagInject({ participantId, injectId: p.inject.id, tag })
                    } catch { /* ignore */ }
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
