"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Users, Shield, Loader2, KeyRound, Check } from "lucide-react"

interface User { id: string; email: string; name: string; role: string; createdAt: number }

// Nederlands, zoals de rest van het beheer. De omringende teksten op deze
// pagina zijn nog Engels; die laat ik staan, dat is i18n-werk.
function WachtwoordWijzigen({ gebruiker, eigenEmail }: { gebruiker: User; eigenEmail: string | null }) {
  const zelf = !!eigenEmail && gebruiker.email.toLowerCase() === eigenEmail.toLowerCase()
  const [open, setOpen] = useState(false)
  const [huidig, setHuidig] = useState("")
  const [nieuw, setNieuw] = useState("")
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState(false)

  async function opslaan(e: React.FormEvent) {
    e.preventDefault()
    setBezig(true); setFout(null)
    try {
      const res = await fetch("/api/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: gebruiker.id,
          ...(zelf ? { currentPassword: huidig } : {}),
          newPassword: nieuw,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setKlaar(true); setOpen(false); setHuidig(""); setNieuw("")
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Mislukt")
    } finally { setBezig(false) }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setKlaar(false) }}
        className="flex items-center gap-1.5 rounded border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {klaar ? <Check className="size-3 text-emerald-600" /> : <KeyRound className="size-3" />}
        {klaar ? "gewijzigd" : "wachtwoord"}
      </button>
    )
  }

  return (
    <form onSubmit={opslaan} className="flex flex-col gap-2 w-full max-w-xs">
      {zelf && (
        <input
          type="password" value={huidig} onChange={e => setHuidig(e.target.value)} required
          autoComplete="current-password" placeholder="huidig wachtwoord"
          className="rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
        />
      )}
      <input
        type="password" value={nieuw} onChange={e => setNieuw(e.target.value)} required minLength={10}
        autoComplete="new-password" placeholder="nieuw — min. 10 tekens"
        className="rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
      />
      {!zelf && (
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          reset door admin — het oude wachtwoord is niet nodig
        </p>
      )}
      {fout && <p className="font-mono text-[10px] text-destructive">✗ {fout}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={bezig} className="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary-foreground disabled:opacity-50">
          {bezig && <Loader2 className="size-3 animate-spin" />}opslaan
        </button>
        <button type="button" onClick={() => { setOpen(false); setFout(null) }} className="rounded border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          annuleren
        </button>
      </div>
    </form>
  )
}

export function UserManager() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "facilitator" })
  const [error, setError] = useState<string | null>(null)
  // Wie ben ik zelf: dat bepaalt of het veld "huidig wachtwoord" nodig is.
  const [eigenEmail, setEigenEmail] = useState<string | null>(null)

  useEffect(() => { fetch("/api/users").then(r => r.json()).then(setUsers).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then((d: { user?: { email?: string } }) => setEigenEmail(d?.user?.email ?? null))
      .catch(() => setEigenEmail(null))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true); setError(null)
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({ name: "", email: "", password: "", role: "facilitator" })
      const updated = await fetch("/api/users").then(r => r.json())
      setUsers(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally { setAdding(false) }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3 md:px-8">
          <Link href="/admin" className="flex size-8 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="font-mono text-sm text-foreground">User management</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 md:px-8 flex flex-col gap-6">
        {/* Current users */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Facilitator accounts</span>
            <span className="font-mono text-xs text-foreground">{users.length}</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {users.map(u => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full border border-border bg-background flex items-center justify-center font-mono text-[10px] uppercase text-muted-foreground">
                      {u.name.slice(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${u.role === "admin" ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                      {u.role}
                    </span>
                    <WachtwoordWijzigen gebruiker={u} eigenEmail={eigenEmail} />
                  </div>
                </li>
              ))}
              {users.length === 0 && (
                <li className="px-5 py-8 text-center font-mono text-xs text-muted-foreground uppercase tracking-wider">No users yet</li>
              )}
            </ul>
          )}
        </div>

        {/* Add user form */}
        <div className="rounded-xl border border-border bg-card px-5 py-5 flex flex-col gap-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Add facilitator account</span>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="Jan de Vries" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none">
                  <option value="facilitator">Facilitator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="jan@eye.security" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="min. 8 characters" />
            </div>
            {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 font-mono text-xs text-destructive">✗ {error}</div>}
            <button type="submit" disabled={adding} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add account
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card/50 px-5 py-4 flex items-start gap-3">
          <Shield className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Participant access</span>
            <p className="text-xs text-muted-foreground leading-relaxed">Participants don't need an account. They join via the 6-character code shown in the facilitator console. Only facilitators and admins need credentials here.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
