import type { ExerciseConfig, FactCheckTag, InjectType, NotificationDraft, NotificationType, RetainerActivationState, Role, RoundPhase, SessionReport, SimulationMode, SpecialEvent, SpecialType, SupervisionReportEdits, Urgency } from "./types"
import type { AssessmentDimensionId, SessionAssessment } from "./engine/types"
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
  surpriseInject: (input: { title: string; content: string; type?: InjectType; urgency?: Urgency }) =>
    post<{ ok: true }>("/api/session/surprise-inject", input),
  resetSession: () => post<{ ok: true }>("/api/session/reset"),
  setPhase: (phase: RoundPhase) =>
    post<{ ok: true }>("/api/session/set-phase", { phase }),
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
  scoreRound: (roundIndex: number, score: -1 | 0 | 1) =>
    post<{ ok: true }>("/api/session/score-round", { roundIndex, score }),
  logAssessmentEvent: (input: { dimensionId: AssessmentDimensionId; roundNumber: number; value: number; note?: string }) =>
    post<{ ok: boolean }>("/api/session/assessment", { ...input, source: "facilitator" }),
  getDebrief: () =>
    post<{ assessment: SessionAssessment }>("/api/session/debrief"),
  setDiscussionPhase: (input: { roundNumber: number; phaseIndex: number; action?: 'set' | 'extend' }) =>
    post<{ ok: true }>("/api/session/discussion-phase", input),
  setPhaseAutoAdvancePaused: (paused: boolean) =>
    post<{ ok: true }>("/api/session/phase-pause", { paused }),
  markReady: (participantId: string) =>
    post<{ ok: true }>("/api/session/ready", { participantId }),
  replotInjects: () =>
    post<{ ok: true; version?: number }>("/api/session/replot-injects", {}),
  tagInject: (input: { participantId: string; injectId: string; tag: FactCheckTag }) =>
    post<{ ok: true }>("/api/session/tag-inject", input),
  addAnnotation: (input: { participantId: string; injectId: string; start: number; end: number; tag: FactCheckTag }) =>
    post<{ ok: true; annotationId?: string }>("/api/session/annotate-inject", input),
  removeAnnotation: (input: { participantId: string; annotationId: string }) =>
    post<{ ok: true }>("/api/session/annotate-inject/remove", input),
  listNotifications: () =>
    get<{ notifications: NotificationDraft[] }>("/api/session/notifications"),
  upsertNotification: (input: { participantId: string; type: NotificationType; draftId?: string; content: NotificationDraft["content"]; submit?: boolean }) =>
    post<{ ok: true; draftId?: string }>("/api/session/notifications", input),
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
  updateRetainer: (input: { participantId: string; patch: Partial<RetainerActivationState> }) =>
    post<{ ok: true }>("/api/session/retainer-activation", input),
  dismissMeldplichtPrompt: (input: { promptId: string }) =>
    post<{ ok: true }>("/api/session/meldplicht-prompt/dismiss", input),
  triggerMeldplichtManual: (input: { type: NotificationType; summary?: string }) =>
    post<{ ok: true }>("/api/session/meldplicht-prompt/manual", input),
}
