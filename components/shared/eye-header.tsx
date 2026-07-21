"use client"

import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LangToggle } from "@/components/lang-toggle"
import { useLang } from "@/lib/use-lang"

export function EyeHeader() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [lang, setLang] = useLang()

  const logo = mounted && resolvedTheme === "dark" ? "/eye-logo-wit.svg" : "/eye-logo-blauw.svg"

  return (
    <header className="sticky top-0 z-40 w-full border-b border-eye-lavender/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" aria-label="Eye Security" className="flex items-center">
          <Image src={logo} alt="Eye Security" width={104} height={26} priority className="h-6 w-auto" />
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/templates" className="hidden text-foreground/80 hover:text-foreground md:inline">Templates</Link>
          <LangToggle lang={lang} setLang={setLang} />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
