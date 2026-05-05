"use client"

import { useState } from "react"
import { MessageSquare, FileText, Newspaper, CheckCircle, Loader2, AlertTriangle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import type { SessionState, SpecialEvent, SpecialType } from "@/lib/types"

const SPECIAL_META: Record<SpecialType, { label: string; desc: string; icon: React.ReactNode; preferredRoles: string }> = {
  ransomware_negotiation: {
    label: "Ransomware Negotiation",
    desc: "Opens a live chat with the ransomware gang — assigned to CFO or CEO.",
    icon: <MessageSquare className="size-4" />,
    preferredRoles: "CFO / CEO",
  },
  ap_notification: {
    label: "AP Notification",
    desc: "Forces the team to complete an AP breach notification form — assigned to Legal or CISO.",
    icon: <FileText className="size-4" />,
    preferredRoles: "Legal / CISO",
  },
  journalist_qa: {
    label: "Journalist Q&A",
    desc: "A journalist asks probing questions — assigned to Head of Comms or CEO.",
    icon: <Newspaper className="size-4" />,
    preferredRoles: "Head of Comms / CEO",
  },
}

function SpecialCard({ special }: { special: SpecialEvent }) {
  const meta = SPECIAL_META[special.type]
  const isCompleted = special.status === "completed"

  return (
    <div className={`rounded-lg border px-4 py-3 flex flex-col gap-2 ${isCompleted ? "border-border bg-card/50 opacity-60" : "border-primary/40 bg-primary/5"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={isCompleted ? "text-muted-foreground" : "text-primary"}>{meta.icon}</span>
          <span className="font-mono text-xs font-medium text-foreground">{meta.label}</span>
        </div>
        {isCompleted ? (
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <CheckCircle className="size-3" /> Done
          </span>
        ) : (
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" /> Active
          </span>
        )}
      </div>
      {special.assignedParticipantName && (
        <p className="text-[11px] text-muted-foreground">
          Assigned to: <span className="text-foreground font-medium">{special.assignedParticipantName}</span>
          {special.assignedRole && ` (${special.assignedRole.replace(/_/g, " ")})`}
        </p>
      )}
      {special.type !== "ap_notification" && (
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-muted-foreground">
            {special.messages.length} berichten
          </p>
          {special.mode === "static" && special.totalScore !== undefined && (
            <span className={`font-mono text-[10px] ${
              special.totalScore > 0 ? "text-primary" : special.totalScore < 0 ? "text-destructive" : "text-muted-foreground"
            }`}>
              Score: {special.totalScore > 0 ? "+" : ""}{special.totalScore}
            </span>
          )}
        </div>
      )}
      {special.type === "ap_notification" && special.formData && (
        <p className="text-[11px] text-primary">Formulier ingediend</p>
      )}
    </div>
  )
}

export function SpecialsPanel({ session }: { session: SessionState }) {
  const [working, setWorking] = useState<SpecialType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mode = session.config.specialsMode
  if (!mode || mode === "off") return null

  const activeSpecials = (session.specialEvents ?? []).filter(s => s.status === "active")
  const allSpecials = session.specialEvents ?? []

  async function trigger(type: SpecialType) {
    setWorking(type)
    setError(null)
    try {
      await api.triggerSpecial(type)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger special")
    } finally {
      setWorking(null)
    }
  }

  const modeLabel = mode === "ai" ? "AI" : "Scripted"

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="size-3.5 text-primary" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Special Events</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 rounded-full px-2 py-0.5">
          {modeLabel}
        </span>
      </div>

      {/* Positioning note */}
      <div className="rounded-md border border-border bg-background/60 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
        Specials simuleren situaties die <span className="text-foreground">specialistische expertise</span> vereisen — ransomware-onderhandeling, GDPR-meldingen en crisiswoordvoering. Ontbreekt deze expertise intern, dan modelleert een special het inschakelen van een externe specialist. Informeer deelnemers dat dit in de praktijk een dedicated rol vereist.
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Active specials */}
      {allSpecials.length > 0 && (
        <div className="flex flex-col gap-2">
          {allSpecials.map(sp => <SpecialCard key={sp.id} special={sp} />)}
        </div>
      )}

      {/* Trigger buttons */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Trigger a special event</span>
        {(Object.entries(SPECIAL_META) as [SpecialType, typeof SPECIAL_META[SpecialType]][]).map(([type, meta]) => {
          const alreadyActive = activeSpecials.some(s => s.type === type)
          return (
            <button
              key={type}
              onClick={() => trigger(type)}
              disabled={working !== null || alreadyActive}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                alreadyActive
                  ? "border-border bg-card/30 opacity-50 cursor-not-allowed"
                  : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {working === type ? (
                <Loader2 className="size-4 shrink-0 text-primary animate-spin mt-0.5" />
              ) : (
                <span className="text-muted-foreground shrink-0 mt-0.5">{meta.icon}</span>
              )}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-foreground">{meta.label}</span>
                  {alreadyActive && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-primary">Active</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{meta.desc}</p>
                <p className="font-mono text-[10px] text-muted-foreground/70 mt-0.5">→ {meta.preferredRoles}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
