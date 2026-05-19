"use client"

import { useEffect, useRef } from "react"
import type { PushedInject, InjectChannel, Urgency } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { Role } from "@/lib/types"
import { formatTime } from "@/lib/format"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

// ─────────────────── Channel config ───────────────────
const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
  whatsapp:     { label: "WHATSAPP",    color: "#25D366" },
  slack:        { label: "TEAMS/SLACK", color: "#7b68ee" },
  email:        { label: "EMAIL",       color: "#40c4ff" },
  siem_alert:   { label: "SIEM",        color: "#ff4d3d" },
  phone:        { label: "PHONE",       color: "#40ffb3" },
  news_ticker:  { label: "BREAKING",    color: "#ff4d3d" },
  system_alert: { label: "EDR/SYS",     color: "#ffb340" },
  sms:          { label: "SMS",         color: "#25D366" },
  raw:          { label: "MEMO",        color: "#7a9090" },
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
      className="border border-[#2a3030] bg-[#111618] overflow-hidden"
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      {/* Channel strip */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/25 border-b border-[#2a3030]">
        <span
          className="font-mono text-[10px] font-bold tracking-widest shrink-0"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] truncate flex-1 min-w-0">
          {inject.senderName ?? inject.source}
          {inject.senderHandle && (
            <span className="ml-1 opacity-50">&lt;{inject.senderHandle}&gt;</span>
          )}
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>

      {/* Optional typed subheader (email subject, alert rule, etc.) */}
      {subheader}

      {/* Content */}
      <div
        className={`px-4 py-4 font-mono whitespace-pre-wrap leading-relaxed text-[#f0fafa] ${
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
          <div className="flex items-center gap-3 px-4 py-2 bg-[#0d1520] border-b border-[#2a3030]">
            <span className="font-mono text-[10px] text-[#7a9090] shrink-0">SUBJECT</span>
            <span className="font-mono text-xs text-[#40c4ff] truncate">{props.inject.title}</span>
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
      className="border border-[#2a3030] bg-[#111618] overflow-hidden"
      style={{ borderLeft: "3px solid #25D366" }}
    >
      <div className="flex items-center gap-3 px-4 py-2 bg-black/25 border-b border-[#2a3030]">
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-[#25D366]">
          WHATSAPP
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] truncate flex-1">
          {inject.senderName ?? inject.source}
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>
      <div className="px-4 py-4">
        <div
          className={`bg-[#1a3a35]/60 border border-[#25D366]/20 px-4 py-3 max-w-[90%] font-mono leading-relaxed text-[#f0fafa] ${
            big ? "text-sm" : "text-xs"
          }`}
        >
          {inject.content}
          <div className="mt-1.5 flex items-center justify-end gap-1">
            <span className="text-[9px] text-[#7a9090]">{inject.timestamp ?? formatTime(pushedAt)}</span>
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
        <div className="flex items-center gap-3 px-4 py-2 bg-black/30 border-b border-[#2a3030]">
          <span className="font-mono text-[10px] text-[#7a9090] shrink-0">RULE</span>
          <span className="font-mono text-xs text-[#ff4d3d] truncate flex-1">{inject.title}</span>
          <span
            className={`font-mono text-[9px] px-2 py-0.5 shrink-0 ${
              isRed
                ? "bg-[#ff4d3d]/20 text-[#ff4d3d]"
                : "bg-[#ffb340]/20 text-[#ffb340]"
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
          <div className="flex items-center gap-3 px-4 py-2 bg-black/30 border-b border-[#2a3030]">
            <span
              className={`font-mono text-xs truncate flex-1 ${
                isRed ? "text-[#ff4d3d]" : "text-[#ffb340]"
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
      className="border border-[#2a3030] bg-[#111618] overflow-hidden"
      style={{ borderLeft: "3px solid #40ffb3" }}
    >
      <div className="flex items-center gap-3 px-4 py-2 bg-black/25 border-b border-[#2a3030]">
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-[#40ffb3]">
          📞 PHONE
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] truncate flex-1">
          {inject.senderName ?? inject.source}
          {inject.senderHandle && <span className="ml-1 opacity-50">{inject.senderHandle}</span>}
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>
      <div className="px-4 py-4 font-mono leading-relaxed text-[#f0fafa] whitespace-pre-wrap">
        <div className={big ? "text-sm" : "text-xs"}>{inject.content}</div>
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
      className="border border-[#2a3030] bg-[#111618] overflow-hidden"
      style={{ borderLeft: "3px solid #ff4d3d" }}
    >
      <div className="flex items-center gap-3 px-4 py-2 bg-[#ff4d3d]/15 border-b border-[#ff4d3d]/40">
        <span className="font-mono text-[10px] font-bold tracking-widest shrink-0 text-[#ff4d3d] animate-pulse">
          ● BREAKING
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] shrink-0">
          {inject.senderName ?? inject.source}
        </span>
        <span className="font-mono text-[10px] text-[#7a9090] ml-auto shrink-0">
          {inject.timestamp ?? formatTime(pushedAt)}
        </span>
      </div>
      {inject.title && (
        <div className="px-4 pt-4 font-mono text-sm font-bold text-[#ff4d3d]">
          {inject.title}
        </div>
      )}
      <div className={`px-4 py-4 font-mono whitespace-pre-wrap leading-relaxed text-[#f0fafa] ${big ? "text-sm" : "text-xs"}`}>
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
          <div className="px-4 py-2 border-b border-[#2a3030]">
            <span className="font-mono text-xs text-[#f0fafa] font-semibold">{inject.title}</span>
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
      <div className="flex flex-col items-center gap-4 border border-[#2a3030] bg-[#111618] px-6 py-16 text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#7a9090]">
          {tr(lang, "awaitingInjects")}
        </div>
        <div className="flex gap-2 justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 bg-[#7a9090] dot-pulse"
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
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#7a9090]">
          {tr(lang, "incomingIntel")}
        </span>
        <span className="font-mono text-[10px] text-[#e8ff40] border border-[#e8ff40]/30 px-2 py-0.5">
          {sorted.length}
        </span>
      </div>
      <ol className="flex flex-col gap-4">
        {sorted.map((p, i) => {
          const size = getSize(p.inject.urgency, i, p.roundIndex < 0)
          const isSurprise = p.roundIndex < 0
          const urgencyColor =
            p.inject.urgency === "critical" ? "#ff4d3d" :
            p.inject.urgency === "high"     ? "#ffb340" :
            p.inject.urgency === "medium"   ? "#e8ff40" : "#7a9090"
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
                    backgroundColor: urgencyColor,
                    animationPlayState: p.inject.urgency === "critical" ? "running" : "paused",
                  }}
                />
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">
                  {p.inject.urgency}
                  {isSurprise ? " · SURPRISE" : ""}
                </span>
                <span className="ml-auto font-mono text-[9px] text-[#7a9090]">
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
