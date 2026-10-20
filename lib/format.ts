import type { Urgency, InjectType, InjectChannel } from "./types"
import { URGENCY_LABELS } from "./config/texts"

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function urgencyClasses(urgency: Urgency): string {
  switch (urgency) {
    case "critical": return "border-destructive/60 bg-destructive/10 text-destructive-foreground"
    case "high": return "border-primary/50 bg-primary/10 text-foreground"
    case "medium": return "border-border bg-card text-foreground"
    case "low": default: return "border-border bg-muted/40 text-muted-foreground"
  }
}

// Callers render these in uppercase badges, so uppercase here rather than
// leaking the raw enum value the way `urgency.toUpperCase()` did.
export function urgencyLabel(urgency: Urgency): string {
  return (URGENCY_LABELS[urgency] ?? urgency).toUpperCase()
}

export function injectTypeLabel(t: InjectType): string {
  switch (t) {
    case "alert": return "MELDING"
    case "intel": return "INTEL"
    case "media": return "PERS"
    case "executive": return "DIRECTIE"
    case "technical": return "TECHNISCH"
    case "regulatory": return "TOEZICHT"
    case "social": return "SOCIAL"
    case "internal": return "INTERN"
  }
}

export function channelLabel(c: InjectChannel): string {
  switch (c) {
    case "whatsapp": return "WhatsApp"
    case "slack": return "Slack"
    case "email": return "E-mail"
    case "siem_alert": return "SIEM"
    case "sms": return "SMS"
    case "phone": return "Telefoon"
    case "news_ticker": return "Nieuws"
    case "system_alert": return "Systeem"
    case "raw": default: return "Memo"
  }
}

export function channelIcon(c: InjectChannel): string {
  switch (c) {
    case "whatsapp": return "💬"
    case "slack": return "🟪"
    case "email": return "✉️"
    case "siem_alert": return "🔴"
    case "sms": return "📱"
    case "phone": return "📞"
    case "news_ticker": return "📰"
    case "system_alert": return "⚙️"
    case "raw": default: return "📋"
  }
}
