"use client"

import { useEffect, useRef } from "react"
import type { PushedInject, InjectChannel, Urgency } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { Role } from "@/lib/types"
import { formatTime } from "@/lib/format"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

// ─────────────────── Channel config (brand colors stay hardcoded) ───────────────────
const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
  whatsapp:     { label: "WHATSAPP",    color: "#25D366" },
  slack:        { label: "TEAMS/SLACK", color: "var(--tt-purple)" },
  email:        { label: "EMAIL",       color: "var(--tt-blue)" },
  siem_alert:   { label: "SIEM",        color: "var(--tt-red)" },
  phone:        { label: "PHONE",       color: "var(--tt-green)" },
  news_ticker:  { label: "BREAKING",    color: "var(--tt-red)" },
  system_alert: { label: "EDR/SYS",     color: "var(--tt-warn)" },
  sms:          { label: "SMS",         color: "#25D366" },
  raw:          { label: "MEMO",        color: "var(--tt-dim)" },
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
}

// ─────────────────── Shell (shared wrapper) ───────────────────
function Shell({
  channel,
  inject,
  pushedAt,
  size,
  subheader,
}: InjectCardProps & { channel: string; subheader?: React.ReactNode }) {
  const cfg = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.raw
  const big = size === "xl"
  return (
    <div
      className="border border-tt-border bg-tt-surface overflow-hidden"
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      {/* Channel strip */}
      <div className="flex items-center gap-3 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
        <span
          className="font-mono text-[10px] font-bold tracking-widest shrink-0"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span className="font-mono text-[10px] text-tt-dim truncate flex-1 min-w-0">
          {inject.senderName ?? inject.source}
          {inject.senderHandle && (
            <span className="ml-1 opacity-50">&lt;{inject.senderHandle}&gt;</span>
          )}
        </span>
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>

      {subheader}

      {/* Content */}
      <div
        className={`px-4 py-4 font-mono whitespace-pre-wrap leading-relaxed text-tt-bright ${
          big ? "text-sm" : "text-xs"
        }`}
      >
        {inject.content}
      </div>
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
      <div className="flex items-center gap-3 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-[#25D366]">
          WHATSAPP
        </span>
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
          {inject.content}
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
  const { inject } = props
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
            className={`font-mono text-[9px] px-2 py-0.5 shrink-0 ${
              isRed ? "bg-tt-red/20 text-tt-red" : "bg-tt-warn/20 text-tt-warn"
            }`}
          >
            {inject.urgency.toUpperCase()}
          </span>
        </div>
      }
    />
  )
}

// ─────────────────── System / EDR alert ───────────────────
function SystemAlertInject(props: InjectCardProps) {
  const { inject } = props
  const isRed = inject.urgency === "critical" || inject.urgency === "high"
  return (
    <Shell
      channel="system_alert"
      {...props}
      subheader={
        inject.title ? (
          <div className="flex items-center gap-3 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
            <span
              className={`font-mono text-xs truncate flex-1 ${
                isRed ? "text-tt-red" : "text-tt-warn"
              }`}
            >
              [{inject.urgency.toUpperCase()}] {inject.title}
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
      <div className="flex items-center gap-3 px-4 py-2 bg-tt-bright/5 border-b border-tt-border">
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-tt-green">
          📞 PHONE
        </span>
        <span className="font-mono text-[10px] text-tt-dim truncate flex-1">
          {inject.senderName ?? inject.source}
          {inject.senderHandle && <span className="ml-1 opacity-50">{inject.senderHandle}</span>}
        </span>
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>
      <div className={`px-4 py-4 font-mono leading-relaxed text-tt-bright whitespace-pre-wrap ${big ? "text-sm" : "text-xs"}`}>
        {inject.content}
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
      <div className="flex items-center gap-3 px-4 py-2 bg-tt-red/10 border-b border-tt-red/40">
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-tt-red animate-pulse">
          ● BREAKING
        </span>
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
        {inject.content}
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
}: {
  pushed: PushedInject[]
  lang: Lang
  participantRole?: Role
}) {
  const participantTeam = participantRole ? ROLE_META[participantRole]?.team : undefined
  const myRoleLabel = participantRole ? ROLE_META[participantRole]?.label : undefined

  const filtered = pushed.filter((p) => {
    const target = p.inject.targetTeam
    if (target && target !== "all" && participantTeam && target !== participantTeam) return false
    if (myRoleLabel && isSelfReferential(p.inject.senderName, myRoleLabel)) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => b.pushedAt - a.pushedAt)
  const topRef = useRef<HTMLDivElement>(null)

  const prevCount = useRef(pushed.length)
  useEffect(() => {
    if (pushed.length > prevCount.current) {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    prevCount.current = pushed.length
  }, [pushed.length])

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 border border-tt-border bg-tt-surface px-6 py-16 text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">
          {tr(lang, "awaitingInjects")}
        </div>
        <div className="flex gap-2 justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 bg-tt-dim dot-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    )
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
      <ol className="flex flex-col gap-4">
        {sorted.map((p, i) => {
          const size = getSize(p.inject.urgency, i, p.roundIndex < 0)
          const isSurprise = p.roundIndex < 0
          const dotColor =
            p.inject.urgency === "critical" ? "var(--tt-red)" :
            p.inject.urgency === "high"     ? "var(--tt-warn)" :
            p.inject.urgency === "medium"   ? "var(--tt-accent)" : "var(--tt-dim)"
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
                  {p.inject.urgency}
                  {isSurprise ? " · SURPRISE" : ""}
                </span>
                <span className="ml-auto font-mono text-[9px] text-tt-dim">
                  {formatTime(p.pushedAt)}
                </span>
              </div>
              <InjectCard inject={p.inject} pushedAt={p.pushedAt} size={size} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}
