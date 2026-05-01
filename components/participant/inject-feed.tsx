"use client"

import { useEffect, useRef, useState } from "react"
import type { PushedInject, InjectChannel, Urgency } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import type { Role } from "@/lib/types"
import { formatTime } from "@/lib/format"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"

// ─────────────────── WhatsApp ───────────────────
function WhatsAppInject({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-[#128C7E]/50 bg-[#0a1f1c] overflow-hidden shadow-lg shadow-[#128C7E]/10">
      <div className="flex items-center gap-2.5 bg-[#075E54] px-4 py-2.5">
        <div className={`${big ? "size-10" : "size-8"} rounded-full bg-[#128C7E] flex items-center justify-center text-white font-bold ${big ? "text-sm" : "text-[10px]"}`}>
          {(inject.senderName ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`font-semibold text-white truncate ${big ? "text-base" : "text-sm"}`}>{inject.senderName ?? inject.source}</span>
          {inject.senderHandle && <span className="text-[10px] text-[#d1f4cc] truncate">{inject.senderHandle}</span>}
        </div>
        <span className="text-[10px] text-[#d1f4cc] shrink-0">{inject.timestamp ?? formatTime(pushedAt)}</span>
      </div>
      <div className="px-4 py-4">
        <div className="bg-[#1a3a35] rounded-xl rounded-tl-none px-4 py-3 max-w-[92%]">
          <p className={`leading-relaxed text-white ${big ? "text-base" : "text-sm"}`}>{inject.content}</p>
          <div className="flex items-center justify-end gap-1 mt-1.5">
            <span className="text-[10px] text-[#8aada8]">{inject.timestamp ?? formatTime(pushedAt)}</span>
            <span className="text-[#34b7f1]">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── Slack ───────────────────
function SlackInject({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  return (
    <div className="flex gap-3 rounded-xl border border-[#4A154B]/60 bg-[#1a0e1b] px-4 py-4 shadow-lg shadow-purple-900/20">
      <div className={`${big ? "size-11" : "size-9"} rounded-lg flex-shrink-0 bg-gradient-to-br from-[#E01E5A] to-[#ECB22E] flex items-center justify-center text-white font-bold ${big ? "text-sm" : "text-xs"} shadow-md`}>
        {(inject.senderName ?? "?").slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-bold text-white ${big ? "text-base" : "text-sm"}`}>{inject.senderName ?? inject.source}</span>
          {inject.senderHandle && <span className="text-[10px] text-[#E01E5A] font-mono">{inject.senderHandle}</span>}
          <span className="text-[10px] text-[#9b6b9b] ml-auto shrink-0">{inject.timestamp ?? formatTime(pushedAt)}</span>
        </div>
        <p className={`leading-relaxed text-[#d4c4d4] break-words ${big ? "text-base" : "text-sm"}`}>{inject.content}</p>
      </div>
    </div>
  )
}

// ─────────────────── Email ───────────────────
function EmailInject({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg">
      <div className="bg-[#1a1a2e] px-5 py-3 border-b border-border/60 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#7b8cde] uppercase tracking-widest shrink-0">FROM</span>
          <span className={`text-white font-medium truncate ${big ? "text-sm" : "text-xs"}`}>{inject.senderName ?? inject.source}</span>
          {inject.senderHandle && <span className="text-[10px] text-muted-foreground shrink-0">{"<"}{inject.senderHandle}{">"}</span>}
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{inject.timestamp ?? formatTime(pushedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#7b8cde] uppercase tracking-widest shrink-0">SUBJ</span>
          <span className={`text-white font-semibold truncate ${big ? "text-base" : "text-sm"}`}>{inject.title}</span>
        </div>
      </div>
      <div className="px-5 py-5">
        <p className={`leading-relaxed text-foreground whitespace-pre-line ${big ? "text-base" : "text-sm"}`}>{inject.content}</p>
      </div>
    </div>
  )
}

// ─────────────────── SIEM Alert ───────────────────
function SiemAlert({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  const isRed = inject.urgency === "critical"
  return (
    <div className={`rounded-xl border overflow-hidden shadow-xl font-mono ${isRed ? "border-destructive/80 bg-[#1a0505] shadow-red-900/30" : "border-primary/50 bg-[#0a0f1a] shadow-amber-900/20"}`}>
      <div className={`flex items-center gap-3 px-4 py-2.5 ${isRed ? "bg-destructive/25" : "bg-primary/15"}`}>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isRed ? "text-red-400" : "text-amber-400"}`}>
          {isRed ? "🔴 CRITICAL SIEM ALERT" : "⚠ SIEM ALERT"}
        </span>
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded font-bold ${isRed ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
          {inject.urgency.toUpperCase()}
        </span>
        <span className="text-[10px] text-muted-foreground">{inject.timestamp ?? formatTime(pushedAt)}</span>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          RULE: <span className={`${isRed ? "text-red-300" : "text-amber-300"} font-semibold`}>{inject.title}</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          SOURCE: <span className="text-foreground">{inject.senderName ?? inject.source}</span>
        </div>
        <div className={`rounded-lg bg-black/40 border ${isRed ? "border-red-900/50" : "border-primary/20"} p-4 font-mono`}>
          <p className={`leading-relaxed text-green-400 ${big ? "text-sm" : "text-xs"}`}>{inject.content}</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── Phone call ───────────────────
function PhoneCall({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#1c1c1e] to-[#0a0a0c] overflow-hidden shadow-xl">
      <div className="flex flex-col items-center gap-3 px-6 py-6">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">📞 Incoming Call</div>
        <div className={`${big ? "size-20" : "size-16"} rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border-2 border-primary/40 flex items-center justify-center font-bold text-primary ${big ? "text-3xl" : "text-2xl"} shadow-lg shadow-primary/20`}>
          {(inject.senderName ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="text-center">
          <div className={`font-semibold text-white ${big ? "text-xl" : "text-lg"}`}>{inject.senderName}</div>
          {inject.senderHandle && <div className="text-sm text-muted-foreground">{inject.senderHandle}</div>}
        </div>
      </div>
      <div className="px-6 pb-5">
        <div className="bg-black/30 rounded-xl px-4 py-3 border border-border">
          <p className={`text-muted-foreground leading-relaxed ${big ? "text-base" : "text-sm"}`}>{inject.content}</p>
        </div>
        <div className="text-center font-mono text-[10px] text-muted-foreground mt-2">{inject.timestamp ?? formatTime(pushedAt)}</div>
      </div>
    </div>
  )
}

// ─────────────────── News ticker ───────────────────
function NewsTickerInject({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  return (
    <div className="rounded-xl border border-destructive/70 bg-[#1a0800] overflow-hidden shadow-xl shadow-red-900/30">
      <div className="flex items-center gap-3 bg-destructive px-4 py-2">
        <span className="text-white font-bold text-xs uppercase tracking-wider animate-pulse">● BREAKING</span>
        <span className="text-white/80 text-xs font-semibold">{inject.senderName ?? inject.source}</span>
        <span className="ml-auto text-white/60 text-[10px]">{inject.timestamp ?? formatTime(pushedAt)}</span>
      </div>
      <div className="px-5 py-4">
        <div className={`font-bold text-white mb-2 ${big ? "text-xl" : "text-base"}`}>{inject.title}</div>
        <p className={`text-orange-200/80 leading-relaxed ${big ? "text-base" : "text-sm"}`}>{inject.content}</p>
      </div>
    </div>
  )
}

// ─────────────────── System alert ───────────────────
function SystemAlertInject({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  const isRed = inject.urgency === "critical" || inject.urgency === "high"
  return (
    <div className={`rounded-xl border font-mono overflow-hidden shadow-lg ${isRed ? "border-destructive/60 bg-[#100505]" : "border-border bg-card"}`}>
      <div className={`flex items-center gap-2 px-4 py-2 border-b text-[10px] uppercase tracking-wider ${isRed ? "border-destructive/40 bg-destructive/15" : "border-border bg-muted/20"}`}>
        <span className={isRed ? "text-red-400 font-bold" : "text-primary font-bold"}>⚙ SYS</span>
        <span className="text-muted-foreground">{inject.senderName ?? inject.source}</span>
        <span className="ml-auto text-muted-foreground">{inject.timestamp ?? formatTime(pushedAt)}</span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isRed ? "bg-destructive text-white" : "bg-primary/20 text-primary"}`}>
          {inject.urgency.toUpperCase()}
        </span>
      </div>
      <div className="px-4 py-3">
        <div className={`font-semibold mb-1 ${isRed ? "text-red-300" : "text-foreground"} ${big ? "text-base" : "text-sm"}`}>
          [{inject.urgency.toUpperCase()}] {inject.title}
        </div>
        <p className={`text-muted-foreground leading-relaxed ${big ? "text-sm" : "text-xs"}`}>{inject.content}</p>
      </div>
    </div>
  )
}

// ─────────────────── SMS ───────────────────
function SmsInject({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  return (
    <div className="rounded-2xl border border-border bg-[#0d0d14] overflow-hidden shadow-lg px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`${big ? "size-9" : "size-7"} rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ${big ? "text-sm" : "text-[10px]"}`}>
          {(inject.senderName ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <span className={`font-semibold text-white ${big ? "text-base" : "text-sm"}`}>{inject.senderName ?? inject.senderHandle ?? inject.source}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{inject.timestamp ?? formatTime(pushedAt)}</span>
      </div>
      <div className="bg-[#1e1e2e] rounded-2xl rounded-tl-none px-4 py-3 max-w-[88%]">
        <p className={`leading-relaxed text-white ${big ? "text-base" : "text-sm"}`}>{inject.content}</p>
      </div>
    </div>
  )
}

// ─────────────────── Raw / default ───────────────────
function RawInject({ inject, pushedAt, size }: InjectCardProps) {
  const big = size === "xl"
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {inject.source && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">▸ {inject.source}</span>}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{inject.timestamp ?? formatTime(pushedAt)}</span>
      </div>
      <h4 className={`font-semibold leading-snug mb-2 ${big ? "text-lg" : "text-base"}`}>{inject.title}</h4>
      <p className={`leading-relaxed text-muted-foreground ${big ? "text-base" : "text-sm"}`}>{inject.content}</p>
    </div>
  )
}

// ─────────────────── Card dispatcher ───────────────────
type InjectSize = "sm" | "md" | "xl"
interface InjectCardProps {
  inject: PushedInject["inject"]
  pushedAt: number
  size: InjectSize
}

function InjectCard(props: InjectCardProps) {
  const channel: InjectChannel = props.inject.channel ?? "raw"
  switch (channel) {
    case "whatsapp": return <WhatsAppInject {...props} />
    case "slack": return <SlackInject {...props} />
    case "email": return <EmailInject {...props} />
    case "siem_alert": return <SiemAlert {...props} />
    case "phone": return <PhoneCall {...props} />
    case "news_ticker": return <NewsTickerInject {...props} />
    case "system_alert": return <SystemAlertInject {...props} />
    case "sms": return <SmsInject {...props} />
    default: return <RawInject {...props} />
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
export function InjectFeed({ pushed, lang, participantRole }: { pushed: PushedInject[]; lang: Lang; participantRole?: Role }) {
  const participantTeam = participantRole ? ROLE_META[participantRole]?.team : undefined

  const filtered = pushed.filter(p => {
    const target = p.inject.targetTeam
    if (!target || target === "all") return true
    if (!participantTeam) return true
    return target === participantTeam
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
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card/50 px-6 py-16 text-center">
        <div className="relative">
          <div className="size-14 rounded-full border border-border bg-background flex items-center justify-center text-3xl">📡</div>
          <div className="absolute -top-1 -right-1 size-4 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <div className="size-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm uppercase tracking-wider text-muted-foreground">{tr(lang, "awaitingInjects")}</p>
          <div className="flex gap-1 justify-center mt-2">
            {[0, 1, 2].map(i => (
              <span key={i} className="size-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1" ref={topRef}>
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "incomingIntel")}</span>
        <span className="font-mono text-xs text-foreground bg-primary/10 border border-primary/30 rounded-full px-2.5 py-0.5">{sorted.length}</span>
      </div>
      <ol className="flex flex-col gap-5">
        {sorted.map((p, i) => {
          const size = getSize(p.inject.urgency, i, p.roundIndex < 0)
          const isSurprise = p.roundIndex < 0
          return (
            <li
              key={`${p.inject.id}-${p.pushedAt}`}
              className="animate-slide-in-up"
              style={{ animationDelay: `${Math.min(i, 5) * 0.04}s` }}
            >
              {/* Label strip */}
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <span className={`size-2 rounded-full shrink-0 ${
                  p.inject.urgency === "critical" ? "bg-destructive animate-pulse" :
                  p.inject.urgency === "high" ? "bg-primary" :
                  p.inject.urgency === "medium" ? "bg-yellow-500" : "bg-muted-foreground"
                }`} />
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {p.inject.urgency} · {p.inject.type}{isSurprise ? " · SURPRISE" : ""}
                </span>
                <span className="ml-auto font-mono text-[9px] text-muted-foreground">{formatTime(p.pushedAt)}</span>
              </div>
              <InjectCard inject={p.inject} pushedAt={p.pushedAt} size={size} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}
