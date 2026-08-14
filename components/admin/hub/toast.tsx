"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { CheckCircle, AlertCircle, Info, X } from "lucide-react"

type ToastKind = "success" | "error" | "info"
interface Toast {
  id: string
  kind: ToastKind
  message: string
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    setToasts(prev => [...prev, { id, kind, message }])
  }, [])
  useEffect(() => {
    if (toasts.length === 0) return
    const oldest = toasts[0]
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== oldest.id))
    }, 4000)
    return () => clearTimeout(timer)
  }, [toasts])
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => {
          const Icon = t.kind === "success" ? CheckCircle : t.kind === "error" ? AlertCircle : Info
          const cls = t.kind === "success"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
            : t.kind === "error"
              ? "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100"
              : "border-primary/40 bg-primary/10 text-foreground"
          return (
            <div key={t.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 shadow-md text-sm ${cls}`}>
              <Icon className="size-4 shrink-0 mt-0.5" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="opacity-60 hover:opacity-100">
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

// SaveStatus indicator — voor autosave-flows. Return een render-string
// + kleur op basis van state.
export type SaveState = "idle" | "saving" | "saved" | "error"
export function saveStatusText(state: SaveState, updatedAgo?: string): { label: string; className: string } {
  if (state === "saving") return { label: "Bezig met opslaan…", className: "text-muted-foreground" }
  if (state === "error")  return { label: "Opslaan mislukt", className: "text-destructive" }
  if (state === "saved")  return { label: updatedAgo ? `Opgeslagen ${updatedAgo}` : "Opgeslagen", className: "text-emerald-600 dark:text-emerald-400" }
  return { label: "", className: "text-muted-foreground" }
}
