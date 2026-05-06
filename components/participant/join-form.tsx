"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api-client"

const NAME_KEY  = "ctt:name"
const ID_KEY    = "ctt:participantId"
const CODE_KEY  = "ctt:joinCode"

export function JoinForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill from localStorage on mount
  useState(() => {
    try {
      const storedName = localStorage.getItem(NAME_KEY)
      const storedCode = localStorage.getItem(CODE_KEY)
      if (storedName) setName(storedName)
      if (storedCode) setCode(storedCode)
    } catch { /* noop */ }
  })

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
      // Send existing ID if available — server returns same participant instead of creating a new one
      let existingParticipantId: string | undefined
      try { existingParticipantId = localStorage.getItem(ID_KEY) ?? undefined } catch { /* noop */ }

      const res = await api.joinSession({
        name: name.trim(),
        joinCode: code.trim().toUpperCase(),
        existingParticipantId,
      })
      try {
        localStorage.setItem(NAME_KEY, name.trim())
        localStorage.setItem(ID_KEY, res.participantId)
        localStorage.setItem(CODE_KEY, code.trim().toUpperCase())
      } catch { /* noop */ }
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
