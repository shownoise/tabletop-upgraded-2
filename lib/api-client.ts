import type { ExerciseConfig, FactCheckTag, FiledMelding, InjectChannel, InjectType, MeldingType, RegulatoryObligationState, Role, RoundPhase, SessionReport, SimulationMode, SpecialEvent, SpecialType, SupervisionReportEdits, Urgency } from "./types"
import type { SupervisionReport } from "./engine/supervision"

async function post<T = unknown>(url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (networkErr) {
    console.error(`[api] POST ${url} network error:`, networkErr)
    throw networkErr
  }
  const json = (await res.json()) as T
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? "Request failed"
    console.error(`[api] POST ${url} ${res.status}:`, err)
    throw new Error(err)
  }
  return json
}

async function get<T = unknown>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { method: "GET" })
  } catch (networkErr) {
    console.error(`[api] GET ${url} network error:`, networkErr)
    throw networkErr
  }
  const json = (await res.json()) as T
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? "Request failed"
    console.error(`[api] GET ${url} ${res.status}:`, err)
    throw new Error(err)
  }
  return json
}

export const api = {
  createSession: (config: ExerciseConfig & { mode?: SimulationMode }) =>
    post<{ ok: true; sessionId: string; joinCode: string; aiGenerated?: boolean }>("/api/session/create", config),
  joinSession: (input: { name: string; joinCode: string; role?: Role; existingParticipantId?: string }) =>
    post<{ ok: true; participantId: string; sessionId: string }>("/api/session/join", input),
  startSession: (opts?: { force?: boolean }) => post<{ ok: true }>("/api/session/start", opts ?? {}),
  nextRound: () => post<{ ok: true }>("/api/session/next-round"),
  prevRound: () => post<{ ok: true }>("/api/session/prev-round"),
  pushInject: (input: { roundIndex: number; injectId: string }) =>
    post<{ ok: true }>("/api/session/push-inject", input),
  surpriseInject: (input: {
    title: string
    content: string
    type?: InjectType
    urgency?: Urgency
    // Phase 5 — library-inject fields. All optional; omitted = classic behaviour.
    channel?: InjectChannel
    senderName?: string
    targetRoles?: Role[]
    classification?: 'feit' | 'aanname' | 'fabel'
    libraryId?: string
  }) =>
    post<{ ok: true }>("/api/session/surprise-inject", input),
  resetSession: () => post<{ ok: true }>("/api/session/reset"),
  setPhase: (phase: RoundPhase, opts?: { force?: boolean; reason?: string }) =>
    post<{ ok: true }>("/api/session/set-phase", { phase, ...(opts ?? {}) }),
  endSessionForced: (input?: { reason?: string }) =>
    post<{ ok: true }>("/api/session/end", input ?? {}),
  submitDecision: (input: { participantId: string; participantName: string; roundIndex: number; actionId: string; reasoning: string; confidence?: 1 | 2 | 3 | 4 | 5; activeRole?: Role }) =>
    post<{ ok: true }>("/api/session/submit-decision", input),
  assignRole: (input: { participantId: string; role: Role; joinCode?: string }) =>
    post<{ ok: true }>("/api/session/assign-role", input),
  createGroup: (input: { name: string }) =>
    post<{ ok: true; groupId: string }>("/api/session/group/create", input),
  joinGroup: (input: { participantId: string; groupId: string }) =>
    post<{ ok: true }>("/api/session/group/join", input),
  forceLock: () =>
    post<{ ok: true }>("/api/session/force-lock"),
  getReport: () =>
    get<SessionReport>("/api/session/report"),
  triggerSpecial: (type: SpecialType) =>
    post<{ ok: true; special: SpecialEvent }>("/api/session/special/trigger", { type }),
  chooseSpecial: (input: { specialId: string; participantId: string; choiceId: string }) =>
    post<{ ok: true }>("/api/session/special/message", input),
  sendSpecialMessage: (input: { specialId: string; participantId: string; text: string }) =>
    post<{ ok: true }>("/api/session/special/message", input),
  submitApForm: (input: { specialId: string; participantId: string; formData: Record<string, string> }) =>
    post<{ ok: true }>("/api/session/special/form", input),
  completeSpecial: (specialId: string) =>
    post<{ ok: true }>("/api/session/special/complete", { specialId }),
  markReady: (participantId: string) =>
    post<{ ok: true }>("/api/session/ready", { participantId }),
  fileMelding: (input: { participantId: string; momentId: string; typeId: string; freeText?: string }) =>
    post<{ ok: true; melding: FiledMelding }>("/api/session/melding", input),
  replotInjects: () =>
    post<{ ok: true; version?: number }>("/api/session/replot-injects", {}),
  tagInject: (input: { participantId: string; injectId: string; tag: FactCheckTag }) =>
    post<{ ok: true }>("/api/session/tag-inject", input),
  addAnnotation: (input: { participantId: string; injectId: string; start: number; end: number; tag: FactCheckTag }) =>
    post<{ ok: true; annotationId?: string }>("/api/session/annotate-inject", input),
  removeAnnotation: (input: { participantId: string; annotationId: string }) =>
    post<{ ok: true }>("/api/session/annotate-inject/remove", input),
  fileRegulatoryObligation: (input: { participantId: string; milestoneId: string; freeText?: string; keyPoints?: string }) =>
    post<{ ok: true; obligation: RegulatoryObligationState }>("/api/session/regulatory-filing", input),
  getSupervisionReport: () =>
    get<{ report: SupervisionReport }>("/api/session/supervision-report"),
  updateSupervisionReport: async (edits: SupervisionReportEdits) => {
    const res = await fetch("/api/session/supervision-report", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edits }),
    })
    return (await res.json()) as { ok: true }
  },
  updateMyView: (input: {
    participantId: string
    patch: Partial<{
      hidden: string[]
      handled: string[]
      filters: { classification?: Array<'feit' | 'aanname' | 'fabel'> }
      addHidden: string
      removeHidden: string
      addHandled: string
      removeHandled: string
      clearHidden: boolean
    }>
  }) => post<{ ok: true }>("/api/session/participant-view", input),
}
