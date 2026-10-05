/**
 * SKILL DNA — API client for the FastAPI backend (architecture document v2.0, section 12).
 * Auth is Bearer-only: short-lived access token + refresh token (section 13.1).
 */

const SUBPATH =
  import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : "";
const API_BASE = `${SUBPATH}/api/v1`;

const TOKEN_KEY = "skill_dna_token";
const REFRESH_KEY = "skill_dna_refresh";
/** Fired on window when the session is dead and the app must return to the login screen. */
export const SESSION_EXPIRED_EVENT = "skilldna:session-expired";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function storeTokens(data: { access_token?: string; refresh_token?: string }) {
  try {
    if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
  } catch {}
}

export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {}
}

export function hasSession(): boolean {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  let refreshToken: string | null = null;
  try {
    refreshToken = localStorage.getItem(REFRESH_KEY);
  } catch {}
  if (!refreshToken) return false;
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) return false;
      storeTokens(await r.json());
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {}
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && retry && (await refreshAccessToken())) {
    return request<T>(endpoint, options, false);
  }
  if (response.status === 401 && token && !endpoint.includes("/auth/login")) {
    // Session can't be renewed (expired refresh token or rotated server key): send the user back to login
    clearTokens();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  if (!response.ok) {
    let message = `Server xatosi: ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {}
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

const post = <T>(endpoint: string, body?: unknown) =>
  request<T>(endpoint, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export type Layer = "KNOW" | "DO" | "ADAPT" | "DEFEND" | "PROVE";

export const api = {
  async checkHealth() {
    try {
      const res = await fetch(`${SUBPATH}/health`);
      return await res.json();
    } catch {
      return { status: "offline" };
    }
  },

  // ---------- Auth, profile, consent ----------
  /** Returns tokens, or `{ mfa_required, mfa_token }` when the account has two-factor auth enabled. */
  async login(identifier: string, password: string) {
    const data = await post<any>("/auth/login", { identifier, password });
    if (!data.mfa_required) storeTokens(data);
    return data as { access_token?: string; refresh_token?: string; user: any; mfa_required?: boolean; mfa_token?: string };
  },

  async verifyMfa(mfaToken: string, code: string) {
    const data = await post<{ access_token: string; refresh_token: string; user: any }>("/auth/mfa/verify", { mfa_token: mfaToken, code });
    storeTokens(data);
    return data;
  },
  getMfaStatus: () => request<{ enabled: boolean; required: boolean; recommended: boolean; session_verified: boolean; recovery_codes_left: number }>("/auth/mfa"),
  setupMfa: () => post<{ secret: string; otpauth_uri: string }>("/auth/mfa/setup"),
  enableMfa: (code: string) => post<{ enabled: boolean; recovery_codes: string[] }>("/auth/mfa/enable", { code }),
  disableMfa: (code: string) => post<{ enabled: boolean }>("/auth/mfa/disable", { code }),

  async register(payload: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    direction_code?: string;
    course?: string;
  }) {
    const data = await post<{ access_token: string; refresh_token: string; user: any }>("/auth/register", payload);
    storeTokens(data);
    return data;
  },

  logout() {
    clearTokens();
  },

  getMe: () => request<any>("/auth/me"),
  updateMe: (data: { full_name?: string; phone?: string; bio?: string }) =>
    request<any>("/auth/me", { method: "PUT", body: JSON.stringify(data) }),
  getConsents: () => request<{ type: string; granted: boolean; granted_at: string | null }[]>("/auth/consents"),
  setConsent: (type: string, granted: boolean) => post<any>("/auth/consents", { type, granted }),

  // ---------- Ontology ----------
  getDirections: () => request<any[]>("/directions"),
  getSkills: (direction?: string) => request<any[]>(`/skills${direction ? `?direction=${direction}` : ""}`),
  getSkillDetail: (skillId: string) => request<any>(`/skills/${skillId}`),

  // ---------- Skill DNA & Evidence Graph ----------
  getDnaProfile: (userId?: string) => request<any>(`/profile/skill-dna${userId ? `?user_id=${userId}` : ""}`),
  getSkillScore: (skillId: string, userId?: string) =>
    request<any>(`/skills/${skillId}/score${userId ? `?user_id=${userId}` : ""}`),
  getEvidenceGraph: (skillId?: string) =>
    request<{ nodes: any[]; edges: any[] }>(`/profile/evidence-graph${skillId ? `?skill_id=${skillId}` : ""}`),

  // ---------- Assessment ----------
  getTasks: (layer?: Layer, skill?: string) => {
    const q = new URLSearchParams();
    if (layer) q.set("layer", layer);
    if (skill) q.set("skill", skill);
    const qs = q.toString();
    return request<any[]>(`/tasks${qs ? `?${qs}` : ""}`);
  },
  startAttempt: (taskId: string) => post<any>("/tasks/attempts", { task_id: taskId }),
  submitAttempt: (
    attemptId: string,
    payload: {
      code_content?: string;
      answers?: Record<string, unknown>;
      repo_url?: string;
      ai_prompts_count?: number;
      self_declared_contribution?: number;
      telemetry?: Record<string, number>;
    }
  ) => post<any>(`/tasks/attempts/${attemptId}/submit`, payload),
  getAttemptResult: (attemptId: string) => request<any>(`/tasks/attempts/${attemptId}/result`),
  requestChallenge: (taskId: string) => post<any>("/challenges/request", { task_id: taskId }),

  // ---------- AI Viva ----------
  startVivaSession: (attemptId: string, language = "uz") => post<any>("/viva/sessions", { attempt_id: attemptId, language }),
  sendVivaMessage: (sessionId: string, content: string) => post<any>(`/viva/sessions/${sessionId}/messages`, { content }),
  getVivaTranscript: (sessionId: string) => request<any>(`/viva/sessions/${sessionId}/transcript`),

  /**
   * Opens the viva WebSocket (section 12). Resolves once the server accepted the token sent as the
   * first message; rejects if the socket can't be established so callers fall back to REST.
   */
  openVivaSocket(sessionId: string, onEvent: (event: any) => void): Promise<{ answer: (text: string) => void; close: () => void }> {
    return new Promise((resolve, reject) => {
      let token: string | null = null;
      try {
        token = localStorage.getItem(TOKEN_KEY);
      } catch {}
      if (!token || typeof WebSocket === "undefined") return reject(new Error("WebSocket mavjud emas"));
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}${API_BASE}/viva/sessions/${sessionId}/ws`);
      let ready = false;
      const timer = window.setTimeout(() => {
        if (!ready) {
          ws.close();
          reject(new Error("WebSocket javob bermadi"));
        }
      }, 5000);
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
      ws.onmessage = (m) => {
        let data: any;
        try {
          data = JSON.parse(m.data);
        } catch {
          return;
        }
        if (!ready && data.type === "ready") {
          ready = true;
          window.clearTimeout(timer);
          resolve({ answer: (text) => ws.send(JSON.stringify({ type: "answer", content: text })), close: () => ws.close() });
          return;
        }
        onEvent(data);
      };
      ws.onerror = () => {
        if (!ready) {
          window.clearTimeout(timer);
          reject(new Error("WebSocket ulanmadi"));
        }
      };
      ws.onclose = () => {
        if (ready) onEvent({ type: "closed" });
      };
    });
  },

  // ---------- AI assistant (AI-assisted tasks, section 5.2) ----------
  getAssistantState: (attemptId: string) => request<any>(`/assistant/${attemptId}`),
  askAssistant: (attemptId: string, content: string, code: string) =>
    post<any>(`/assistant/${attemptId}/messages`, { content, code }),
  decideSuggestion: (attemptId: string, suggestionId: string, accepted: boolean) =>
    post<any>(`/assistant/${attemptId}/decisions`, { suggestion_id: suggestionId, accepted }),

  // ---------- Career ----------
  getCareers: () => request<any[]>("/careers"),
  getCareerMatch: (careerId: string) => request<any>(`/careers/${careerId}/match`),
  getCareerTarget: () => request<any>("/career/target"),
  chatWithCoach: (message: string, careerId?: string) => post<any>("/career/coach-chat", { message, career_id: careerId }),

  // ---------- Credentials ----------
  getCredentials: () => request<any[]>("/credentials"),
  issueCredential: (skillId: string) => post<any>("/credentials/issue", { skill_id: skillId }),
  verifyCredential: (id: string) => request<any>(`/verify/${id}`),

  // ---------- Appeals ----------
  createAppeal: (attemptId: string, reason: string) => post<any>("/appeals", { attempt_id: attemptId, reason }),
  getAppeals: () => request<any[]>("/appeals"),
  resolveAppeal: (id: string, decision: "approved" | "rejected", notes: string, newScore?: number) =>
    post<any>(`/appeals/${id}/resolve`, { decision, notes, new_score: newScore }),

  // ---------- Teacher ----------
  getTeacherGroups: () => request<any[]>("/teacher/groups"),
  getGroupGaps: (groupId: string) => request<any>(`/teacher/groups/${encodeURIComponent(groupId)}/gaps`),
  getProveQueue: () => request<any[]>("/teacher/prove-queue"),
  getVivaResults: (groupId?: string) =>
    request<any[]>(`/teacher/viva-results${groupId ? `?group_id=${encodeURIComponent(groupId)}` : ""}`),
  verifyEvidence: (evidenceId: string, approved: boolean, score: number, notes?: string) =>
    post<any>(`/teacher/evidence/${evidenceId}/verify`, { approved, score, notes }),
  createRemedial: (skillId: string, groupId?: string) => post<any>("/teacher/remedial", { skill_id: skillId, group_id: groupId }),

  // ---------- Moderation ----------
  getModerationQueue: (status = "open") => request<any[]>(`/moderation/queue?status=${status}`),
  resolveFlag: (flagId: string, decision: "dismissed" | "confirmed", notes?: string, humanScore?: number) =>
    post<any>(`/moderation/${flagId}/resolve`, { decision, notes, human_score: humanScore }),

  // ---------- Employer ----------
  createCriteria: (payload: {
    job_title: string;
    min_confidence: number;
    skills: { skill_code: string; min_score: number; importance?: number; must?: boolean }[];
  }) => post<any>("/employer/criteria", payload),
  getCriteriaMatches: (criteriaId: string) => request<any[]>(`/employer/criteria/${criteriaId}/matches`),
  getCandidate: (candidateId: string) => request<any>(`/employer/candidates/${candidateId}`),
  inviteCandidate: (candidateId: string, invite?: { job_title: string; message?: string }) =>
    post<any>(`/employer/candidates/${candidateId}/invite`, invite),
  getVerifiedCandidates: () => request<any[]>("/employer/verified-candidates"),
  getEmployerInvites: () => request<any[]>("/employer/invites"),
  withdrawInvite: (inviteId: string) => post<any>(`/employer/invites/${inviteId}/withdraw`),
  // Student side of invitations
  getMyInvites: () => request<any[]>("/career/invites"),
  respondInvite: (inviteId: string, decision: "accepted" | "declined") =>
    post<any>(`/career/invites/${inviteId}/respond`, { decision }),

  // ---------- Notifications ----------
  getNotifications: () => request<{ unread: number; items: any[] }>("/notifications"),
  readNotification: (id: string) => post<any>(`/notifications/${id}/read`),
  readAllNotifications: () => post<any>("/notifications/read-all"),

  // ---------- University ----------
  getUniversityAnalytics: () => request<any>("/university/analytics"),
};
