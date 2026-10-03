/**
 * SKILL DNA — Frontend API Service Client
 * Connects frontend React components to Python FastAPI + PostgreSQL backend.
 */

const API_BASE = "/api/v1";
const DIRECT_API_BASE = "http://127.0.0.1:8000/api/v1";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("skill_dna_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let primaryUrl = endpoint.startsWith("http") ? endpoint : `${API_BASE}${cleanEndpoint}`;

  try {
    let response = await fetch(primaryUrl, {
      ...options,
      headers,
    });

    // If 404/network issue with proxy, fallback to direct port 8000
    if (!response.ok && !endpoint.startsWith("http")) {
      try {
        const directResp = await fetch(`${DIRECT_API_BASE}${cleanEndpoint}`, {
          ...options,
          headers,
        });
        if (directResp.ok) {
          return await directResp.json();
        }
      } catch {}
    }

    if (!response.ok) {
      let errorMsg = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) errorMsg = errorData.detail;
      } catch {}
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (err: any) {
    console.warn(`[API] Request to ${endpoint} failed:`, err.message);
    throw err;
  }
}

export const api = {
  // System Health
  async checkHealth() {
    try {
      const res = await fetch("http://127.0.0.1:8000/health");
      return await res.json();
    } catch {
      return { status: "offline" };
    }
  },

  // Auth & Profile
  async login(identifier: string, password: string) {
    const data = await request<{ access_token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    if (data.access_token) {
      localStorage.setItem("skill_dna_token", data.access_token);
    }
    return data;
  },

  async register(payload: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    direction_code?: string;
    course?: string;
  }) {
    const data = await request<{ access_token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data.access_token) {
      localStorage.setItem("skill_dna_token", data.access_token);
    }
    return data;
  },

  async getMe(userId?: string) {
    const q = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    return await request<any>(`/auth/me${q}`);
  },

  async updateMe(
    userId: string,
    data: { full_name?: string; email?: string; phone?: string; bio?: string; role?: string }
  ) {
    const q = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    return await request<any>(`/auth/me${q}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Competency Ontology
  async getDirections() {
    return await request<any[]>("/directions");
  },

  async getSkillDetail(skillId: string) {
    return await request<any>(`/skills/${skillId}`);
  },

  // Student DNA Profile & Evidence Graph
  async getDnaProfile(userId?: string) {
    const q = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    return await request<any>(`/profile/dna${q}`);
  },

  async getEvidenceGraph(userId?: string) {
    const q = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    return await request<{ nodes: any[]; edges: any[] }>(`/profile/evidence-graph${q}`);
  },

  // Assessment Tasks & Sandbox
  async getTasks(layer?: string) {
    const q = layer && layer !== "Barchasi" ? `?layer=${layer}` : "";
    return await request<any[]>(`/tasks${q}`);
  },

  async startAttempt(taskId: string, userId: string, aiMode = "AI-assisted") {
    return await request<any>(`/tasks/attempt/start?user_id=${userId}`, {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, ai_mode: aiMode }),
    });
  },

  async submitAttempt(payload: {
    attempt_id: string;
    code_content?: string;
    answers?: any;
    ai_used?: boolean;
  }) {
    return await request<any>("/tasks/attempt/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // AI Viva (DEFEND)
  async startVivaSession(attemptId: string) {
    return await request<any>(`/viva/session/start?attempt_id=${attemptId}`, {
      method: "POST",
    });
  },

  async sendVivaMessage(sessionId: string, content: string) {
    return await request<any>("/viva/message", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, content }),
    });
  },

  // Career DNA & AI Coach
  async getCareerTarget() {
    return await request<any>("/career/target");
  },

  async chatWithCoach(message: string, targetRole = "Senior Python Backend Injinir") {
    return await request<any>("/career/coach-chat", {
      method: "POST",
      body: JSON.stringify({ message, target_role: targetRole }),
    });
  },
};
