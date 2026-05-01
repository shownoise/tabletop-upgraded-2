"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldAlert, Loader2, Eye, EyeOff } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get("callbackUrl") ?? "/admin"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const { signIn } = await import("next-auth/react")
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError("Invalid email or password")
          return
        }

        router.push(callbackUrl)
        router.refresh()
      } catch {
        setError("Something went wrong. Try again.")
      }
    })
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* Grid bg */}
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-20" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
            <ShieldAlert className="size-6 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-lg font-bold tracking-wider text-foreground">CYBER_TABLETOP</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Facilitator access</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="you@organisation.nl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 pr-10 text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
                ✗ {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || !email || !password}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-mono text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <><Loader2 className="size-4 animate-spin" /> Signing in…</>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="text-center">
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            Participants don't need an account.<br />
            Use the join code at <span className="text-foreground">/join</span>
          </p>
        </div>
      </div>
    </div>
  )
}
