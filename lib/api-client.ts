import type { ExerciseConfig, InjectType, Role, RoundPhase, SessionReport, SimulationMode, Urgency } from "./types"

async function post<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json()) as T
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? "Request failed"
    throw new Error(err)
  }
  return json
}

async function get<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" })
  const json = (await res.json()) as T
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? "Request failed"
    throw new Error(err)
  }
  return json
}

export const api = {
  createSession: (config: ExerciseConfig & { mode?: SimulationMode }) =>
    post<{ ok: true; sessionId: string; joinCode: string; aiGenerated?: boolean }>("/api/session/create", config),
  joinSession: (input: { name: string; joinCode: string; role?: Role }) =>
    post<{ ok: true; participantId: string; sessionId: string }>("/api/session/join", input),
  startSession: () => post<{ ok: true }>("/api/session/start"),
  nextRound: () => post<{ ok: true }>("/api/session/next-round"),
  prevRound: () => post<{ ok: true }>("/api/session/prev-round"),
  pushInject: (input: { roundIndex: number; injectId: string }) =>
    post<{ ok: true }>("/api/session/push-inject", input),
  surpriseInject: (input: { title: string; content: string; type?: InjectType; urgency?: Urgency }) =>
    post<{ ok: true }>("/api/session/surprise-inject", input),
  resetSession: () => post<{ ok: true }>("/api/session/reset"),
  setPhase: (phase: RoundPhase) =>
    post<{ ok: true }>("/api/session/set-phase", { phase }),
  submitDecision: (input: { participantId: string; participantName: string; roundIndex: number; actionId: string; reasoning: string }) =>
    post<{ ok: true }>("/api/session/submit-decision", input),
  assignRole: (input: { participantId: string; role: Role }) =>
    post<{ ok: true }>("/api/session/assign-role", input),
  getReport: () =>
    get<SessionReport>("/api/session/report"),
}
