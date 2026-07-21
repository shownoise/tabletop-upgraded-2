import { MessageSquare, Mail, Phone, Radio, Bell, FileText, AlertTriangle, Newspaper } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const CHANNEL_ICON: Record<string, LucideIcon> = {
  whatsapp: MessageSquare,
  slack: MessageSquare,
  teams: MessageSquare,
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  siem: Radio,
  siem_alert: Radio,
  edr: Radio,
  news: Newspaper,
  news_ticker: Newspaper,
  memo: FileText,
  ransom_note: AlertTriangle,
  system_alert: Bell,
  raw: FileText,
  internal: FileText,
}
