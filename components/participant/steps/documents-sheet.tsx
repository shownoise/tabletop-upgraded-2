"use client"

import { useMemo, useState } from "react"
import { FileText, Search } from "lucide-react"
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { ROLE_META, type Role, type SessionState } from "@/lib/types"

// Je documenten, overal te openen.
//
// Ze stonden alleen op stap 1. De eigenaar: "ook moeten de documenten
// terugkomen in een menu zodat de klant daar terug naar kan refereren" — want
// je hebt ze juist nodig op het moment dat je kiest, niet aan het begin. Dit is
// daarom geen achtste stap maar een paneel dat van elke stap openklapt, en het
// keuzescherm verwijst er rechtstreeks naar.

export function documentsForRoles(session: SessionState, roles: Role[]) {
  return (session.documents ?? []).filter(d => d.targetRole && roles.includes(d.targetRole))
}

export function DocumentsSheet({
  session,
  roles,
  trigger,
  openDocumentId,
}: {
  session: SessionState
  roles: Role[]
  trigger: React.ReactNode
  // Welk document bij openen al uitgeklapt staat. Gebruikt door de tip op het
  // keuzescherm: die wijst één document aan, dus dan hoef je niet te zoeken.
  openDocumentId?: string
}) {
  const docs = documentsForRoles(session, roles)
  const [query, setQuery] = useState("")

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter(d =>
      d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q),
    )
  }, [docs, query])

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden /> Jouw documenten
          </SheetTitle>
          <SheetDescription>
            {docs.length === 0
              ? "Voor jouw rol zijn in deze oefening geen documenten vastgelegd."
              : "Wat jouw rol bij de hand heeft. Let ook op wat er ontbreekt — in een echte crisis is dat net zo bepalend."}
          </SheetDescription>
        </SheetHeader>

        {docs.length > 3 && (
          <div className="relative px-4">
            <Search className="absolute left-6 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Zoek in je documenten"
              className="pl-8"
            />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6">
          {shown.length === 0 && docs.length > 0 && (
            <p className="text-xs text-muted-foreground">Geen document met die tekst.</p>
          )}
          {shown.map(doc => (
            <details
              key={doc.id}
              open={doc.id === openDocumentId}
              className="rounded-lg border border-border bg-card px-3 py-2"
            >
              <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                {doc.title}
                {doc.targetRole && (
                  <span className="rounded-full border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {ROLE_META[doc.targetRole]?.label ?? doc.targetRole}
                  </span>
                )}
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                {doc.content}
              </pre>
            </details>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
