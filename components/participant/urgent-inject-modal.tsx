"use client"

import { AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Inject } from "@/lib/types"
import type { Lang } from "@/lib/i18n"
import { tr } from "@/lib/i18n"
import { injectTypeLabel, urgencyClasses, urgencyLabel, channelLabel, channelIcon } from "@/lib/format"

export function UrgentInjectModal({ inject, onClose, lang }: { inject: Inject | null; onClose: () => void; lang: Lang }) {
  return (
    <Dialog open={inject !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-destructive/60 bg-card max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg border border-destructive/60 bg-destructive/10 pulse-ring">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <span className="font-mono text-xs uppercase tracking-wider text-destructive">
              {inject?.urgency === "critical" ? `⚠ ${tr(lang, "criticalInject")}` : tr(lang, "surpriseInject")}
            </span>
          </div>
          <DialogTitle className="text-balance text-xl leading-snug">{inject?.title ?? ""}</DialogTitle>
        </DialogHeader>

        {inject && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border bg-transparent font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {injectTypeLabel(inject.type)}
              </Badge>
              <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-wider ${urgencyClasses(inject.urgency)}`}>
                {urgencyLabel(inject.urgency)}
              </Badge>
              {inject.channel && inject.channel !== "raw" && (
                <Badge variant="outline" className="border-border bg-card font-mono text-[10px] uppercase tracking-wider text-muted-foreground gap-1">
                  <span>{channelIcon(inject.channel)}</span>{channelLabel(inject.channel)}
                </Badge>
              )}
              {inject.source && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">▸ {inject.source}</span>}
            </div>
            {inject.senderName && (
              <div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 border border-border">
                <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {inject.senderName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{inject.senderName}</span>
                  {inject.senderHandle && <span className="text-[10px] text-muted-foreground">{inject.senderHandle}</span>}
                </div>
                {inject.timestamp && <span className="ml-auto font-mono text-[10px] text-muted-foreground">{inject.timestamp}</span>}
              </div>
            )}
            <p className="text-base leading-relaxed text-foreground">{inject.content}</p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose} className="font-mono uppercase tracking-wider w-full">
            {tr(lang, "acknowledge")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
