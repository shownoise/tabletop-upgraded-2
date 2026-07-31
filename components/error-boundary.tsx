"use client"

import { Component, type ReactNode } from "react"

// Simple ErrorBoundary — vangt crashes af zodat de hele sessie niet uitvalt.
// Wrap kritieke views (dashboard, play-view, present) hiermee.

interface Props {
  children: ReactNode
  label?: string
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Log — geen server-post. Facilitator ziet fallback en kan reload.
    if (process.env.NODE_ENV !== "production") {
      console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`, error)
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-destructive">
            Fout in {this.props.label ?? "onderdeel"}
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Er is iets misgegaan bij het laden van dit deel. De sessie loopt door — refresh de pagina om opnieuw te proberen.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={this.reset}
              className="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-wider hover:bg-muted"
            >
              Opnieuw proberen
            </button>
            <button
              onClick={() => typeof window !== "undefined" && window.location.reload()}
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              Pagina verversen
            </button>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <details className="mt-2 max-w-md text-left">
              <summary className="cursor-pointer font-mono text-[10px] text-muted-foreground">Details</summary>
              <pre className="mt-1 rounded bg-muted p-2 text-[10px] text-muted-foreground overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
