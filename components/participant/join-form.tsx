"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api-client"
import type { Role } from "@/lib/types"
import { ROLE_META } from "@/lib/types"

const NAME_KEY = "ctt:name"
const ID_KEY = "ctt:participantId"
const ROLE_KEY = "ctt:role"

const ALL_ROLES = Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]
const TECHNICAL_ROLES = ALL_ROLES.filter(([, m]) => m.team === "technical_it")
const CRISIS_ROLES = ALL_ROLES.filter(([, m]) => m.team === "crisis_management")

export function JoinForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [role, setRole] = useState<Role | "">("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Please enter your name.")
      return
    }
    if (!code.trim()) {
      setError("Please enter the join code.")
      return
    }
    setSubmitting(true)
    try {
      const res = await api.joinSession({
        name: name.trim(),
        joinCode: code.trim().toUpperCase(),
        role: role || undefined,
      })
      // Stash identity in sessionStorage so refresh keeps name visible.
      try {
        window.sessionStorage.setItem(NAME_KEY, name.trim())
        window.sessionStorage.setItem(ID_KEY, res.participantId)
        if (role) window.sessionStorage.setItem(ROLE_KEY, role)
      } catch {
        /* noop */
      }
      router.push("/play")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Your name
        </Label>
        <Input
          id="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. A. Hopper"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="code" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Join code
        </Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A1B2C3"
          maxLength={8}
          autoComplete="off"
          className="font-mono tracking-[0.25em]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Your role <span className="text-muted-foreground/50">(optional)</span>
        </Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role | "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select your role…" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Technical / IT</span>
            </div>
            {TECHNICAL_ROLES.map(([r, meta]) => (
              <SelectItem key={r} value={r}>
                <div className="flex flex-col gap-px">
                  <span>{meta.label}</span>
                  <span className="text-xs text-muted-foreground">{meta.description}</span>
                </div>
              </SelectItem>
            ))}
            <div className="px-2 py-1.5 mt-1 border-t border-border">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Crisis Management</span>
            </div>
            {CRISIS_ROLES.map(([r, meta]) => (
              <SelectItem key={r} value={r}>
                <div className="flex flex-col gap-px">
                  <span>{meta.label}</span>
                  <span className="text-xs text-muted-foreground">{meta.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Your role determines which actions you are authorized to take during decision phases.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={submitting} className="gap-2 font-mono uppercase tracking-wider">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Joining
          </>
        ) : (
          <>
            Join exercise
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  )
}
