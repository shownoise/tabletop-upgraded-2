"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Users, FolderKanban, Play, Settings, BarChart3, ChevronRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { ToastProvider } from "./toast"

// Gedeelde admin-shell: 3 nav-items links, Settings rechts. Breadcrumbs
// eronder tonen waar de gebruiker in de hiërarchie zit. Elke pagina rendert
// binnen deze shell.

const NAV_ITEMS = [
  { href: "/admin/clients",   label: "Klanten",     icon: Users },
  { href: "/admin/scenarios", label: "Scenario's",  icon: FolderKanban },
  { href: "/admin/sessions",  label: "Sessies",     icon: Play },
] as const

interface Crumb { label: string; href?: string }

export function AdminShell({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode
  breadcrumbs?: Crumb[]
}) {
  const path = usePathname()
  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:px-10">
            <Link href="/" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" />
              Home
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Admin</span>
            <ThemeToggle />
          </div>
          <nav className="mx-auto max-w-7xl px-6 md:px-10 flex items-center gap-1 border-t border-border/60">
            <div className="flex gap-1 flex-1">
              {NAV_ITEMS.map(item => {
                const active = path === item.href || path?.startsWith(item.href + "/")
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-b-2 border-primary text-foreground font-medium"
                        : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
            <div className="flex gap-1">
              <Link
                href="/admin/quality"
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  path?.startsWith("/admin/quality")
                    ? "border-b-2 border-primary text-foreground font-medium"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="size-3.5" />
                <span>Kwaliteit</span>
              </Link>
              <Link
                href="/admin/settings"
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  path?.startsWith("/admin/settings")
                    ? "border-b-2 border-primary text-foreground font-medium"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings className="size-3.5" />
                <span>Instellingen</span>
              </Link>
            </div>
          </nav>
        </header>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="border-b border-border/60 bg-muted/20">
            <div className="mx-auto max-w-7xl px-6 md:px-10 py-2 flex items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3" />}
                  {c.href ? (
                    <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
                  ) : (
                    <span className="text-foreground">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-6 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </ToastProvider>
  )
}
