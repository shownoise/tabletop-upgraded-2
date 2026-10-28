"use client"

// De facilitatorconsole. Dit bestand doet nog precies drie dingen: de
// sessiestate binnenhalen, de acties bundelen, en de juiste stap renderen.
//
// Waarom: dit was 700 regels met fase, timer, deelnemers, injectbeheer,
// specials, reveal, review en feedback onder elkaar op één pagina. Tijdens een
// live sessie moest de facilitator langs alle injectteksten scrollen om bij de
// review te komen (issue #105, probleem 1). De inhoud staat nu per stap in
// components/admin/facilitator/, elk met een eigen URL.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSessionStream } from "@/lib/use-session-stream"
import { api, ApiError } from "@/lib/api-client"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { FacilitatorShell, type FacilitatorActions } from "./facilitator/facilitator-shell"
import { resolveStep, type FacilitatorStep } from "./facilitator/steps"
import { StepEindbespreking } from "./facilitator/step-eindbespreking"
import { StepGereedschap } from "./facilitator/step-gereedschap"
import { StepReview } from "./facilitator/step-review"
import { StepRonde } from "./facilitator/step-ronde"
import { StepSessie } from "./facilitator/step-sessie"

// `step` ontbreekt op /admin/dashboard zelf: die URL blijft werken en kiest de
// stap op basis van de sessiestatus. De stap-URL's geven hun eigen stap mee,
// zodat een refresh daar dezelfde stap teruggeeft.
export function ControlDashboard({ step }: { step?: FacilitatorStep } = {}) {
  const [lang, setLang] = useLang()
  const router = useRouter()
  const { state, connected } = useSessionStream()
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const session = state.session

  async function run(label: string, fn: () => Promise<unknown>) {
    setWorking(label)
    setError(null)
    try { await fn() }
    catch (err) { setError(err instanceof Error ? err.message : "Actie mislukt") }
    finally { setWorking(null) }
  }

  async function startSession() {
    await run("start", async () => {
      try {
        await api.startSession()
      } catch (err) {
        // 409 → nog niet iedereen staat op klaar. De facilitator mag forceren.
        // Op de status kijken, niet op de tekst: die tekst moest daarvoor
        // technisch blijven en was voor de facilitator onleesbaar.
        const nogNietKlaar = err instanceof ApiError && err.status === 409
        const msg = err instanceof Error ? err.message : String(err)
        if (nogNietKlaar && window.confirm(`${msg}\n\nToch beginnen? Wie later aanhaakt kan gewoon nog meedoen.`)) {
          await api.startSession({ force: true })
        } else {
          throw err
        }
      }
    })
  }

  // Beëindigen en verwijderen zijn twee acties. Beëindigen bewaart de sessie,
  // zodat het eindscherm van de deelnemer en het rapport blijven werken;
  // verwijderen gooit alles weg. Ze stonden eerder op één knop.
  async function endExercise() {
    if (!confirm("Oefening nu beëindigen? Deelnemers zien hun eindscherm met scores. De sessie blijft bewaard.")) return
    await run("end", () => api.endSessionForced())
  }

  async function destroySession() {
    if (!confirm("Sessie definitief verwijderen? Keuzes, scores en de terugblik gaan verloren. Dit kan niet ongedaan worden gemaakt.")) return
    await run("reset", () => api.resetSession())
    router.push("/admin")
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tr(lang, "noActiveSession")}</h1>
          <p className="max-w-md text-muted-foreground">
            {connected ? tr(lang, "configureExercise") : "Verbinden met de live sessie…"}
          </p>
        </div>
        <Button asChild><Link href="/admin">{tr(lang, "configureExercise")}</Link></Button>
      </div>
    )
  }

  const actions: FacilitatorActions = { working, run, startSession, endExercise, destroySession }
  const activeStep = step ?? resolveStep(session)

  return (
    <FacilitatorShell
      session={session}
      connected={connected}
      step={activeStep}
      lang={lang}
      setLang={setLang}
      actions={actions}
      error={error}
    >
      {activeStep === "sessie" && <StepSessie session={session} lang={lang} />}
      {activeStep === "ronde" && <StepRonde session={session} lang={lang} actions={actions} />}
      {activeStep === "review" && <StepReview session={session} lang={lang} />}
      {activeStep === "eindbespreking" && <StepEindbespreking session={session} lang={lang} actions={actions} />}
      {activeStep === "gereedschap" && <StepGereedschap session={session} lang={lang} actions={actions} />}
    </FacilitatorShell>
  )
}
