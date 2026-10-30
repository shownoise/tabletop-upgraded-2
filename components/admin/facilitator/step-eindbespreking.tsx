"use client"

// Stap 4 — eindbespreking. Alle gespeelde rondes achter elkaar, opgebouwd uit
// dezelfde `DecisionReviewCard` die de deelnemer ziet, met keuzes, scores,
// dimensies en gespreksvragen.
//
// Bewust gescheiden: "oefening beëindigen" (commandobalk boven — deelnemers
// krijgen hun eindscherm, de sessie blijft bewaard) en "sessie verwijderen"
// (onderaan deze stap — gooit keuzes, scores en terugblik weg). Die twee mogen
// niet op één knop; dat was eerder het geval en kostte een hele terugblik.

import Link from "next/link"
import { useMemo } from "react"
import { AlertTriangle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { tr, type Lang } from "@/lib/i18n"
import type { SessionState } from "@/lib/types"
import { DebriefOverview } from "./debrief-overview"
import { buildRoundReviews, facilitatorScoreTotal } from "./review-items"
import type { FacilitatorActions } from "./facilitator-shell"

export function StepEindbespreking({
  session,
  lang,
  actions,
}: {
  session: SessionState
  lang: Lang
  actions: FacilitatorActions
}) {
  const rounds = useMemo(() => buildRoundReviews(session), [session])
  const total = useMemo(() => facilitatorScoreTotal(session), [session])
  const isEnded = session.status === "ended"

  return (
    <div className="flex flex-col gap-6">
      <section
        className={`rounded-xl border px-5 py-4 ${isEnded ? "border-primary/30 bg-primary/5" : "border-amber-500/40 bg-amber-500/5"}`}
      >
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {isEnded ? "Oefening beëindigd" : "Oefening loopt nog"}
        </p>
        <p className="mt-1 text-sm text-foreground">
          {isEnded
            ? "De deelnemers zien hun eindscherm. Hieronder staat per gespeelde ronde dezelfde bespreking die zij voor zich hebben."
            : "Hieronder staat alles wat tot nu toe is gespeeld. Beëindig de oefening met de knop rechtsboven; deelnemers krijgen dan hun eindscherm."}
        </p>
        {/* Het echte sessie-id, niet /admin/report: die laatste leest altijd de
            sessie die nú in de store staat. Met het id blijft deze link naar
            déze oefening wijzen, ook nadat er een volgende is gestart. */}
        <Link
          href={`/admin/report/${encodeURIComponent(session.id)}`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/20"
        >
          <FileText className="size-3" /> Naar rapport
        </Link>
      </section>

      <DebriefOverview rounds={rounds} total={total} showAnswerModel />

      {/* Onomkeerbaar, dus onderaan en los van alles. */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-destructive">
          <AlertTriangle className="size-3" /> Sessie verwijderen
        </p>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Dit is iets anders dan de oefening beëindigen. Verwijderen gooit de keuzes,
          scores en deze terugblik definitief weg — ook het rapport is daarna niet
          meer te maken. Doe dit pas als het nagesprek klaar is.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={actions.destroySession}
          disabled={actions.working !== null}
          className="mt-3 gap-2 border-destructive/40 font-mono uppercase tracking-wider text-destructive"
        >
          {tr(lang, "destroySession")}
        </Button>
      </section>
    </div>
  )
}
