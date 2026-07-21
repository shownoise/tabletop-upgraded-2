"use client"

import Link from "next/link"
import { ArrowRight, Library } from "lucide-react"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const [lang] = useLang()

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col">
      <section className="eye-hero-gradient relative flex flex-1 items-center justify-center overflow-hidden px-6 py-20 md:px-10 md:py-28">
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-start gap-8 text-white">
          <span className="text-xs uppercase tracking-[0.28em] text-eye-lavender">
            {tr(lang, "tagline")}
          </span>
          <h1 className="text-5xl font-bold leading-tight md:text-6xl">
            Cyber Crisis Tabletop
          </h1>
          <p className="max-w-xl text-lg text-eye-lavender">
            Live, AI-gegenereerde incident-response oefeningen voor crisisteams. Realistisch, geregisseerd, meetbaar.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/admin">
                Ik ben facilitator
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-eye-indigo">
              <Link href="/join">
                Ik ben deelnemer
              </Link>
            </Button>
          </div>
          <Link
            href="/templates"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-eye-lavender/90 hover:text-white"
          >
            <Library className="size-4" /> Bekijk scenariotemplates
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-3 md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-muted-foreground">
          <span>Sessies zijn ephemeral en gedeeld via Vercel KV.</span>
          <span>v4.0 · Eye Security 2026</span>
        </div>
      </footer>
    </div>
  )
}
