"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Users, Shield, Loader2 } from "lucide-react"

interface User { id: string; email: string; name: string; role: string; createdAt: number }

export function UserManager() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "facilitator" })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetch("/api/users").then(r => r.json()).then(setUsers).finally(() => setLoading(false)) }, [])

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
                <li key={u.id} className="flex items-center justify-between px-5 py-3.5">
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
