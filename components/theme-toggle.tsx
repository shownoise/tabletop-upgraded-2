"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
      title="Toggle light/dark mode"
    >
      <Sun className="size-3.5 hidden dark:block" />
      <Moon className="size-3.5 block dark:hidden" />
    </button>
  )
}
