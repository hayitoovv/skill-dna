import { useState, useEffect, useCallback } from "react";
import { Icon } from "../common/Icons";
import { api, ApiError } from "../../services/api";
import {
  initialModeratorFlags,
  sampleVivaTranscripts,
  initialIntegrityRules,
} from "../../data/ontology";
import type {
  IntegrityFlag,
  VivaTranscriptItem,
  IntegrityRuleItem,
} from "../../types";

interface ModeratorQueueProps {
  activeTab?: "flags" | "transcripts" | "rules";
  onTabChange?: (tab: "flags" | "transcripts" | "rules") => void;
}

/* ------------------------------------------------------------------ */
/* Backend shapes (backend/app/api/v1/endpoints/staff.py, viva.py)     */
/* ------------------------------------------------------------------ */

interface LiveFlag {
  id: string;
  type: string;
  severity: string;
  status: string;
  student: { id: string; name: string };
  skill: { id: string; name: string } | null;
  attempt_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

interface LiveAppeal {
  id: string;
  attempt_id: string | null;
  reason: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
}

interface TranscriptState {
  status: "loading" | "ok" | "error";
  data?: any;
  error?: string;
}

/** Unified view model so the same card markup renders live and demo flags. */
interface FlagView {
  id: string;
  type: string;
  studentName: string;
  studentGroup?: string;
  skillName: string;
  severity: string;
  reason: string;
  status: "open" | "resolved";
  rawStatus: string;
  timestamp: string;
  metrics?: IntegrityFlag["metrics"];
  transcriptExcerpt?: IntegrityFlag["transcriptExcerpt"];
  facts: { label: string; value: string }[];
  vivaSessionId?: string;
  resolutionNotes?: string;
  isLive: boolean;
}

type DataMode = "loading" | "live" | "demo";

const OPEN_STATUSES = ["pending", "under_review", "open"];
const VIVA_TYPES = ["VIVA_DISAGREEMENT", "VIVA_SAMPLE_REVIEW"];

const FLAG_INFO: Record<string, { label: string; desc: string }> = {
  CROSS_LAYER_GAP: {
    label: "Qatlamlararo nomuvofiqlik",
    desc: "Bir ko‘nikma bo‘yicha qatlam ballari orasidagi farq ≥ 35 ball (masalan, DO yuqori, DEFEND past). Bayroq ochiq turganda daraja L3 da ushlab turiladi — bu jazo emas, inson qaror qilguncha kutish.",
  },
  VIVA_DISAGREEMENT: {
    label: "Viva baholovchilari kelishmovchiligi",
    desc: "AI Viva panelidagi baholovchilarning umumiy ballari orasidagi farq katta. Moderator transkriptni o‘qib, kerak bo‘lsa inson bahosini (0–100) kiritadi.",
  },
  SIMILARITY_HIGH: {
    label: "Yuqori o‘xshashlik",
    desc: "Yechim shu topshiriq bo‘yicha boshqa talaba yechimiga strukturaviy jihatdan juda o‘xshash (≥ 92%). Faqat moderator tasdiqlasa, ushbu urinish dalillari hisobdan chiqariladi.",
  },
  PASTE_BURST: {
    label: "Katta hajmli joylashtirish (paste)",
    desc: "AI-free rejimda katta hajmdagi matn joylashtirish qayd etildi. Bu faqat yordamchi signal, o‘zi hech narsani isbotlamaydi.",
  },
  TAB_ANOMALY: {
    label: "Oynadan tez-tez chiqish",
    desc: "AI-free rejimda oynadan ko‘p marta chiqish qayd etildi. Bu faqat yordamchi signal.",
  },
  VOLUME_ANOMALY: {
    label: "Hajm / tezlik anomaliyasi",
    desc: "Bir soatda g‘ayrioddiy ko‘p topshirish yoki amaliy topshiriq kutilganidan ancha tez bajarilgan.",
  },
  PROMPT_INJECTION: {
    label: "Baholovchini boshqarishga urinish",
    desc: "Javob yoki kodda AI baholovchini boshqarishga urinish belgilari topildi. Tizim bunga bo‘ysunmaydi; moderator tasdiqlasa, urinish dalillari hisobdan chiqariladi.",
  },
  VIVA_SAMPLE_REVIEW: {
    label: "Viva inson tekshiruvi (namuna)",
    desc: "Viva sessiyasi inson tekshiruviga yo‘naltirildi (tasodifiy 10% namuna yoki L4/L5 da’vosi). Daraja ushlab turilmaydi.",
  },
};

const TELEMETRY_LABELS: Record<string, string> = {
  paste_events: "Paste hodisalari",
  max_paste_chars: "Eng katta paste (belgi)",
  tab_switches: "Oynadan chiqishlar",
};

const GRADER_LABELS: Record<string, string> = {
  llm: "LLM baholovchi",
  heuristic: "Deterministik baholovchi",
  viva_panel: "Panel natijasi (median)",
  human: "Inson (moderator)",
};

const CRITERION_LABELS: Record<string, string> = {
  ownership: "Mualliflik",
  what_if: "What-if",
  find_bug: "Xatoni topish",
  trade_off: "Trade-off",
  ai_usage: "AI’dan foydalanish",
  moderator: "Moderator bahosi",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function liveFacts(d: Record<string, any>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (d.layer) out.push({ label: "Qatlam", value: String(d.layer) });
  if (typeof d.gap === "number") out.push({ label: "Qatlamlar farqi", value: `${d.gap} ball` });
  if (d.layers && typeof d.layers === "object") {
    for (const [k, v] of Object.entries(d.layers)) {
      if (typeof v === "number") out.push({ label: k, value: `${Math.round(v)}` });
    }
  }
  if (typeof d.spread === "number") out.push({ label: "Baholovchilar farqi", value: `${d.spread} ball` });
  if (d.reason) out.push({ label: "Yo‘naltirish sababi", value: String(d.reason) });
  if (typeof d.ratio === "number") out.push({ label: "O‘xshashlik", value: `${Math.round(d.ratio * 100)}%` });
  if (typeof d.submissions_last_hour === "number")
    out.push({ label: "Oxirgi soatdagi topshirishlar", value: String(d.submissions_last_hour) });
  if (typeof d.duration_seconds === "number") out.push({ label: "Bajarish vaqti", value: `${d.duration_seconds} s` });
  if (d.telemetry && typeof d.telemetry === "object") {
    for (const [k, v] of Object.entries(d.telemetry)) {
      if (typeof v === "number" || typeof v === "string") out.push({ label: TELEMETRY_LABELS[k] || k, value: String(v) });
    }
  }
  return out;
}

function liveToView(f: LiveFlag): FlagView {
  const d = f.details || {};
  const isOpen = OPEN_STATUSES.includes(f.status);
  return {
    id: f.id,
    type: f.type,
    studentName: f.student?.name || "—",
    skillName: f.skill?.name || "Ko‘nikma ko‘rsatilmagan",
    severity: f.severity === "critical" ? "high" : f.severity,
    reason: FLAG_INFO[f.type]?.desc || `${f.type} signali inson tekshiruviga yo‘naltirildi.`,
    status: isOpen ? "open" : "resolved",
    rawStatus: f.status,
    timestamp: fmtDate(f.created_at),
    facts: liveFacts(d),
    vivaSessionId: typeof d.viva_session_id === "string" ? d.viva_session_id : undefined,
    resolutionNotes: typeof d.resolution_notes === "string" ? d.resolution_notes : undefined,
    isLive: true,
  };
}

function demoToView(f: IntegrityFlag): FlagView {
  return {
    id: f.id,
    type: f.type,
    studentName: f.studentName,
    studentGroup: f.studentGroup,
    skillName: f.skillName,
    severity: f.severity,
    reason: f.reason,
    status: f.status === "resolved" ? "resolved" : "open",
    rawStatus: f.status,
    timestamp: f.timestamp,
    metrics: f.metrics,
    transcriptExcerpt: f.transcriptExcerpt,
    facts: [],
    isLive: false,
  };
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 3);
}

function errText(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return `${fallback} (${e.status}: ${e.message})`;
  return `${fallback} (tarmoq xatosi)`;
}

export default function ModeratorQueue({
  activeTab = "flags",
  onTabChange,
}: ModeratorQueueProps) {
  // Local or controlled tab
  const [currentTab, setCurrentTab] = useState<"flags" | "transcripts" | "rules">(activeTab);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  const setTab = (tab: "flags" | "transcripts" | "rules") => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Data mode: live backend vs. demo fallback
  const [mode, setMode] = useState<DataMode>("loading");
  const [liveFlags, setLiveFlags] = useState<LiveFlag[]>([]);
  const [appeals, setAppeals] = useState<LiveAppeal[] | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // State for Flags
  const [flags, setFlags] = useState<IntegrityFlag[]>(initialModeratorFlags);
  const [activeFlag, setActiveFlag] = useState<FlagView | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [humanScore, setHumanScore] = useState<string>("");
  const [resolving, setResolving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Appeals
  const [activeAppeal, setActiveAppeal] = useState<LiveAppeal | null>(null);
  const [appealNotes, setAppealNotes] = useState<string>("");
  const [appealScore, setAppealScore] = useState<string>("");

  // State for Viva Transcripts
  const [transcripts, setTranscripts] = useState<VivaTranscriptItem[]>(sampleVivaTranscripts);
  const [transcriptSearch, setTranscriptSearch] = useState<string>("");
  const [transcriptFilter, setTranscriptFilter] = useState<string>("all");
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>("vt-1");
  const [playingTranscriptId, setPlayingTranscriptId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(35);
  const [transcriptCache, setTranscriptCache] = useState<Record<string, TranscriptState>>({});

  // State for Integrity Rules (demo) and live ontology
  const [rules, setRules] = useState<IntegrityRuleItem[]>(initialIntegrityRules);
  const [directions, setDirections] = useState<any[] | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<TranscriptState | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isLive = mode === "live";

  /* ---------------- Data loading ---------------- */

  const loadAppeals = useCallback(async () => {
    try {
      setAppeals(await api.getAppeals());
    } catch {
      setAppeals(null);
    }
  }, []);

  const reloadQueue = useCallback(async (): Promise<boolean> => {
    try {
      const rows = await api.getModerationQueue("all");
      setLiveFlags(Array.isArray(rows) ? rows : []);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.getModerationQueue("all");
        if (cancelled) return;
        setLiveFlags(Array.isArray(rows) ? rows : []);
        setMode("live");
        setExpandedTranscriptId(null);
        loadAppeals();
      } catch {
        if (!cancelled) setMode("demo");
      }
    })();
    (async () => {
      try {
        const dirs = await api.getDirections();
        if (cancelled) return;
        const list = Array.isArray(dirs) ? dirs : [];
        setDirections(list);
        const first = list.flatMap((d: any) => d.skills || []).find((s: any) => s.pilot) || list[0]?.skills?.[0];
        if (first) setSelectedSkillId(first.id);
      } catch {
        if (!cancelled) setDirections(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAppeals]);

  useEffect(() => {
    if (!selectedSkillId) return;
    let cancelled = false;
    setSkillDetail({ status: "loading" });
    api
      .getSkillDetail(selectedSkillId)
      .then((data) => !cancelled && setSkillDetail({ status: "ok", data }))
      .catch((e) => !cancelled && setSkillDetail({ status: "error", error: errText(e, "Rubrika yuklanmadi") }));
    return () => {
      cancelled = true;
    };
  }, [selectedSkillId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const ok = await reloadQueue();
    if (ok) loadAppeals();
    setRefreshing(false);
    showToast(ok ? "Navbat yangilandi" : "Navbatni yangilab bo‘lmadi (tarmoq yoki ruxsat xatosi)");
  };

  const loadTranscript = (sessionId: string) => {
    const cached = transcriptCache[sessionId];
    if (cached && cached.status !== "error") return;
    setTranscriptCache((prev) => ({ ...prev, [sessionId]: { status: "loading" } }));
    api
      .getVivaTranscript(sessionId)
      .then((data) => setTranscriptCache((prev) => ({ ...prev, [sessionId]: { status: "ok", data } })))
      .catch((e) =>
        setTranscriptCache((prev) => ({
          ...prev,
          [sessionId]: { status: "error", error: errText(e, "Transkript yuklanmadi") },
        }))
      );
  };

  /* ---------------- Actions ---------------- */

  const openReview = (flag: FlagView) => {
    setActiveFlag(flag);
    setReviewNotes("");
    setHumanScore("");
    if (flag.isLive && flag.vivaSessionId) loadTranscript(flag.vivaSessionId);
  };

  const closeReview = () => {
    setActiveFlag(null);
    setReviewNotes("");
    setHumanScore("");
  };

  // Resolve Flag Action — the moderator decides; nothing is punished automatically
  const handleResolve = async (flag: FlagView, decision: "dismissed" | "confirmed") => {
    if (!flag.isLive) {
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, status: "resolved" } : f)));
      closeReview();
      showToast(
        `Demo rejim: "${decision === "dismissed" ? "asossiz" : "tasdiqlandi"}" qarori faqat ekranda belgilandi (serverga yuborilmadi)`
      );
      return;
    }

    let score: number | undefined;
    if (humanScore.trim() !== "") {
      const n = Number(humanScore);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        showToast("Inson bahosi 0–100 oralig‘ida bo‘lishi kerak");
        return;
      }
      score = n;
    }

    setResolving(true);
    try {
      const res = await api.resolveFlag(flag.id, decision, reviewNotes.trim() || undefined, score);
      closeReview();
      const base = decision === "dismissed" ? "Bayroq asossiz deb yopildi" : "Bayroq moderator tomonidan tasdiqlandi";
      const sk =
        res?.skill && typeof res.skill.score === "number"
          ? ` · ko‘nikma qayta hisoblandi: ${Math.round(res.skill.score)} ball, ${res.skill.level}`
          : "";
      showToast(base + sk);
      if (flag.vivaSessionId) {
        setTranscriptCache((prev) => {
          const next = { ...prev };
          delete next[flag.vivaSessionId as string];
          return next;
        });
      }
      await reloadQueue();
    } catch (e) {
      showToast(errText(e, "Qaror saqlanmadi"));
    } finally {
      setResolving(false);
    }
  };

  const handleResolveAppeal = async (decision: "approved" | "rejected") => {
    if (!activeAppeal) return;
    if (appealNotes.trim() === "") {
      showToast("Qaror asosini (izoh) yozing");
      return;
    }
    let score: number | undefined;
    if (appealScore.trim() !== "") {
      const n = Number(appealScore);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        showToast("Yangi ball 0–100 oralig‘ida bo‘lishi kerak");
        return;
      }
      score = n;
    }
    setResolving(true);
    try {
      await api.resolveAppeal(activeAppeal.id, decision, appealNotes.trim(), score);
      setActiveAppeal(null);
      setAppealNotes("");
      setAppealScore("");
      showToast(decision === "approved" ? "E’tiroz qabul qilindi" : "E’tiroz rad etildi");
      await loadAppeals();
      await reloadQueue();
    } catch (e) {
      showToast(errText(e, "E’tiroz qarori saqlanmadi"));
    } finally {
      setResolving(false);
    }
  };

  // Toggle Rule (demo only)
  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              isActive: !r.isActive,
            }
          : r
      )
    );
    const rule = rules.find((r) => r.id === ruleId);
    showToast(
      `"${rule?.name}" qoidasi ${!rule?.isActive ? "faollashtirildi" : "to‘xtatildi"}`
    );
  };

  // Change Threshold Slider (demo only)
  const handleThresholdChange = (ruleId: string, val: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, threshold: val } : r))
    );
  };

  // Play / Pause Audio Simulation (demo only)
  const handleTogglePlay = (id: string) => {
    if (playingTranscriptId === id) {
      setPlayingTranscriptId(null);
    } else {
      setPlayingTranscriptId(id);
      setAudioProgress(15);
    }
  };

  // Transcripts action (demo only)
  const handleTranscriptVerdict = (id: string, newStatus: "verified" | "flagged", label: string) => {
    setTranscripts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
    showToast(`Demo rejim: transkript holati yangilandi — ${label}`);
  };

  /* ---------------- Derived data ---------------- */

  const flagViews: FlagView[] = isLive ? liveFlags.map(liveToView) : flags.map(demoToView);

  // Filtered Flags
  const filteredFlags = flagViews.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      f.studentName.toLowerCase().includes(q) ||
      f.skillName.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q) ||
      f.reason.toLowerCase().includes(q);

    const matchesSeverity =
      selectedSeverity === "all" || f.severity === selectedSeverity;

    const matchesStatus =
      selectedStatus === "all" || f.status === selectedStatus;

    const matchesType =
      selectedType === "all" || f.type === selectedType;

    return matchesSearch && matchesSeverity && matchesStatus && matchesType;
  });

  // Live viva-related flags (have a viva session to open)
  const vivaFlags = flagViews.filter((f) => f.isLive && f.vivaSessionId);
  const filteredVivaFlags = vivaFlags.filter((f) => {
    const q = transcriptSearch.toLowerCase();
    const matchesSearch =
      transcriptSearch.trim() === "" ||
      f.studentName.toLowerCase().includes(q) ||
      f.skillName.toLowerCase().includes(q);
    const matchesStatus = transcriptFilter === "all" || f.status === transcriptFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Transcripts (demo)
  const filteredTranscripts = transcripts.filter((t) => {
    const matchesSearch =
      transcriptSearch.trim() === "" ||
      t.studentName.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
      t.taskTitle.toLowerCase().includes(transcriptSearch.toLowerCase());

    const matchesStatus =
      transcriptFilter === "all" || t.status === transcriptFilter;

    return matchesSearch && matchesStatus;
  });

  const openCount = flagViews.filter((f) => f.status === "open").length;
  const resolvedCount = flagViews.filter((f) => f.status === "resolved").length;
  const highRiskCount = flagViews.filter((f) => f.severity === "high" && f.status === "open").length;
  const pendingAppeals = (appeals || []).filter((a) => a.status === "pending" || a.status === "under_review");
  const ontologyLive = directions !== null;
  const liveSkillCount = (directions || []).reduce((n, d) => n + (d.skills?.length || 0), 0);
  const typeCounts = liveFlags.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});

  const activeIsViva =
    !!activeFlag && (VIVA_TYPES.includes(activeFlag.type) || !!activeFlag.vivaSessionId);

  /* ---------------- Render helpers ---------------- */

  const modeBadge = (m: DataMode, labelLive = "Jonli ma’lumot", labelDemo = "Demo ma’lumot") => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "20px",
        fontSize: "11.5px",
        fontWeight: 800,
        background: m === "live" ? "var(--success-soft)" : m === "demo" ? "var(--warning-soft)" : "var(--surface-3)",
        color: m === "live" ? "var(--success)" : m === "demo" ? "var(--warning-fg)" : "var(--text-3)",
        border:
          m === "live"
            ? "1px solid var(--success-ring)"
            : m === "demo"
            ? "1px solid var(--warning-ring)"
            : "1px solid var(--border)",
      }}
      title={
        m === "live"
          ? "Ma’lumotlar backend API’dan olinmoqda"
          : m === "demo"
          ? "Backend bilan bog‘lanib bo‘lmadi yoki bu rolga ruxsat yo‘q — namunaviy ma’lumot ko‘rsatilmoqda"
          : "Yuklanmoqda"
      }
    >
      {m === "live" && <span className="live-pulse-indicator" style={{ background: "var(--success)" }} />}
      {m === "live" ? labelLive : m === "demo" ? labelDemo : "Yuklanmoqda…"}
    </span>
  );

  const renderLiveTranscript = (sessionId: string, compact = false) => {
    const st = transcriptCache[sessionId];
    if (!st || st.status === "loading") {
      return <div style={{ fontSize: "12.5px", color: "var(--muted)", padding: "8px 0" }}>Transkript yuklanmoqda…</div>;
    }
    if (st.status === "error") {
      return (
        <div style={{ fontSize: "12.5px", color: "var(--danger-fg)", padding: "8px 0" }}>
          {st.error}{" "}
          <button
            type="button"
            onClick={() => loadTranscript(sessionId)}
            style={{ background: "none", border: "none", color: "var(--royal)", fontWeight: 700, cursor: "pointer" }}
          >
            Qayta urinish
          </button>
        </div>
      );
    }
    const data = st.data || {};
    const turns: any[] = Array.isArray(data.turns) ? data.turns : [];
    const evals: any[] = Array.isArray(data.evaluations) ? data.evaluations : [];
    let qNo = 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 700 }}>
          Sessiya holati: {data.status === "completed" ? "yakunlangan" : "faol"} · {turns.length} ta xabar
        </div>

        {turns.length === 0 ? (
          <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>Bu sessiyada hali dialog yozuvi yo‘q.</div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxHeight: compact ? "260px" : "none",
              overflowY: compact ? "auto" : "visible",
            }}
          >
            {turns.map((t) => {
              const isExaminer = t.role === "examiner" || t.role === "assistant";
              if (isExaminer) qNo += 1;
              return (
                <div
                  key={t.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: isExaminer ? "var(--surface-2)" : "#ffffff",
                    border: "1px solid var(--border)",
                    fontSize: "12.5px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: isExaminer ? "var(--navy)" : "var(--royal)",
                      marginBottom: "4px",
                    }}
                  >
                    <span>{isExaminer ? `🎙️ Savol #${qNo} (AI Examiner)` : "🗣️ Talaba javobi"}</span>
                    <span style={{ color: "var(--muted)", fontWeight: 600 }}>{fmtDate(t.ts)}</span>
                  </div>
                  <div
                    style={{
                      color: isExaminer ? "var(--ink-2)" : "var(--text-2)",
                      fontWeight: isExaminer ? 600 : 400,
                      fontStyle: isExaminer ? "normal" : "italic",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {t.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div>
          <div style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--navy)", marginBottom: "8px" }}>
            BAHOLOVCHILAR XULOSALARI ({evals.length})
          </div>
          {evals.length === 0 ? (
            <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>Hali baholash yozuvi yo‘q.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {evals.map((ev, i) => {
                const scores: Record<string, any> = ev.scores && typeof ev.scores === "object" ? ev.scores : {};
                const spans: any[] = Array.isArray(ev.spans) ? ev.spans : [];
                return (
                  <div
                    key={i}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: ev.grader === "human" ? "1.5px solid var(--success-ring)" : "1px solid var(--border)",
                      background: ev.grader === "viva_panel" ? "var(--accent-soft)" : "#ffffff",
                      fontSize: "12.5px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginBottom: "6px",
                      }}
                    >
                      <strong style={{ color: "var(--navy)" }}>
                        {GRADER_LABELS[ev.grader] || ev.grader}
                        {ev.model_ref ? (
                          <span style={{ color: "var(--muted)", fontWeight: 600 }}> · {ev.model_ref}</span>
                        ) : null}
                      </strong>
                      {typeof ev.total_score === "number" && (
                        <strong style={{ color: "var(--royal)" }}>{Math.round(ev.total_score)}/100</strong>
                      )}
                    </div>
                    {Object.keys(scores).length > 0 && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                        {Object.entries(scores).map(([k, v]) => (
                          <span
                            key={k}
                            style={{
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: "var(--surface-3)",
                              color: "var(--text-2)",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {CRITERION_LABELS[k] || k}: {v === null || v === undefined ? "—" : String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                    {ev.rationale && (
                      <div style={{ color: "var(--text-3)", fontSize: "12px", marginBottom: spans.length ? "6px" : 0 }}>
                        {ev.rationale}
                      </div>
                    )}
                    {spans.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {spans.map((s, j) => (
                          <div
                            key={j}
                            style={{
                              padding: "6px 10px",
                              borderLeft: "3px solid var(--royal)",
                              background: "var(--surface-2)",
                              borderRadius: "4px",
                              fontSize: "12px",
                              color: "var(--text-2)",
                            }}
                          >
                            <strong style={{ fontStyle: "normal" }}>{CRITERION_LABELS[s.criterion] || s.criterion}:</strong>{" "}
                            <em>“{s.quote}”</em>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabButtonStyle = (active: boolean) => ({
    padding: "9px 18px",
    borderRadius: "10px",
    border: active ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
    background: active ? "var(--navy)" : "#ffffff",
    color: active ? "#ffffff" : "var(--navy)",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.15s ease",
    boxShadow: active ? "0 4px 12px rgba(9, 9, 11, 0.12)" : "none",
  });

  return (
    <div className="page">
      {/* Top Welcome Row */}
      <section className="welcome-row">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ margin: 0 }}>INTEGRITY & HALOLLIK TIZIMI · MODERATSIYA ISH STOLI</p>
            {modeBadge(mode)}
            {isLive && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--royal)",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: refreshing ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Icon name="refresh" size={13} /> {refreshing ? "Yangilanmoqda…" : "Yangilash"}
              </button>
            )}
          </div>
          <h1>Fake Skill va Nomuvofiqliklar nazorati</h1>
          <p className="subtitle">
            Bayroq jazo emas: u faqat holatni inson ko‘rib chiqishiga yo‘naltiradi. Qarorni (asossiz yoki tasdiqlangan) moderator qabul qiladi.
          </p>
        </div>
      </section>

      {/* Internal Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "22px",
          borderBottom: "1.5px solid var(--border)",
          paddingBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={() => setTab("flags")} style={tabButtonStyle(currentTab === "flags")}>
          <Icon name="shield" size={16} />
          <span>Bayroqlar navbati</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "flags" ? "rgba(255,255,255,0.2)" : "var(--danger-soft)",
              color: currentTab === "flags" ? "#ffffff" : "var(--danger)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {openCount}
          </span>
        </button>

        <button type="button" onClick={() => setTab("transcripts")} style={tabButtonStyle(currentTab === "transcripts")}>
          <Icon name="file" size={16} />
          <span>Viva Transkript tekshiruvi</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "transcripts" ? "rgba(255,255,255,0.2)" : "var(--accent-soft)",
              color: currentTab === "transcripts" ? "#ffffff" : "var(--accent)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {isLive ? vivaFlags.length : mode === "demo" ? transcripts.length : 0}
          </span>
        </button>

        <button type="button" onClick={() => setTab("rules")} style={tabButtonStyle(currentTab === "rules")}>
          <Icon name="settings" size={16} />
          <span>Ontologiya & Rubrikalar</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "rules" ? "rgba(255,255,255,0.2)" : "var(--surface-3)",
              color: currentTab === "rules" ? "#ffffff" : "var(--text-3)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {ontologyLive ? `${liveSkillCount} ko‘nikma` : `${rules.filter((r) => r.isActive).length} faol`}
          </span>
        </button>
      </div>

      {/* Summary Stats Row */}
      <section className="employer-stats-row">
        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="alert" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Ochiq bayroqlar
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>
              {mode === "loading" ? "…" : `${openCount} ta holat`}
            </strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "var(--success-soft)",
              color: "var(--success)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="checkCircle" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Hal qilingan
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>
              {mode === "loading" ? "…" : `${resolvedCount} ta tekshiruv`}
            </strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "var(--warning-soft)",
              color: "var(--warning)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="shieldCheck" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Yuqori xavfli (High)
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>
              {mode === "loading" ? "…" : `${highRiskCount} ta zudlik bilan`}
            </strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="workflow" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              {isLive ? "Ochiq e’tirozlar" : "Avtomatik Rubrikalar"}
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>
              {isLive
                ? appeals === null
                  ? "—"
                  : `${pendingAppeals.length} ta e’tiroz`
                : mode === "loading"
                ? "…"
                : "5 ta faol filtr"}
            </strong>
          </div>
        </div>
      </section>

      {/* TAB 1: BAYROQLAR NAVBATI (FLAGS QUEUE) */}
      {currentTab === "flags" && (
        <>
          {/* Advanced Filter Card */}
          <section className="employer-filter-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                <p className="card-kicker" style={{ margin: 0 }}>
                  MODERATSIYA SARALASH VA QIDIRUV
                </p>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Qarama-qarshiliklar (CROSS_LAYER_GAP, VIVA_DISAGREEMENT) navbatning boshida turadi
                </span>
              </div>

              {/* Search box */}
              <div style={{ position: "relative", minWidth: "280px" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                >
                  <Icon name="search" size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Talaba ismi, ko‘nikma yoki bayroq turi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--border)",
                    fontSize: "13px",
                    outline: "none",
                    background: "var(--surface-2)",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                />
              </div>
            </div>

            {/* Severity and Status Filter Chips */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", minWidth: "90px" }}>
                  XAVFLILIK:
                </span>
                {[
                  { key: "all", label: "Barchasi" },
                  { key: "high", label: "🔴 Yuqori xavf (High)" },
                  { key: "medium", label: "🟡 O‘rta xavf (Medium)" },
                  { key: "low", label: "⚪ Past xavf (Low)" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedSeverity(s.key)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: selectedSeverity === s.key ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
                      background: selectedSeverity === s.key ? "var(--navy)" : "#ffffff",
                      color: selectedSeverity === s.key ? "#ffffff" : "var(--navy)",
                      transition: "0.15s ease",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", minWidth: "90px" }}>
                  HOLAT:
                </span>
                {[
                  { key: "all", label: `Barchasi (${flagViews.length})` },
                  { key: "open", label: `⏳ Kutilmoqda (${openCount})` },
                  { key: "resolved", label: `✅ Hal qilingan (${resolvedCount})` },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setSelectedStatus(st.key)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: selectedStatus === st.key ? "1.5px solid var(--royal)" : "1.5px solid var(--border)",
                      background: selectedStatus === st.key ? "var(--royal)" : "#ffffff",
                      color: selectedStatus === st.key ? "#ffffff" : "var(--navy)",
                      transition: "0.15s ease",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Live appeals (students contesting a grade) */}
          {isLive && appeals !== null && pendingAppeals.length > 0 && (
            <section className="card" style={{ padding: "20px 22px", marginBottom: "22px" }}>
              <p className="card-kicker" style={{ margin: 0 }}>
                TALABA E’TIROZLARI · INSON QAYTA BAHOLAYDI
              </p>
              <h2 style={{ margin: "4px 0 12px", fontSize: "17px" }}>Ochiq e’tirozlar ({pendingAppeals.length})</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pendingAppeals.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "220px" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>
                        <Icon name="clock" size={12} /> {fmtDate(a.created_at)} · urinish {a.attempt_id ? a.attempt_id.slice(0, 8) : "—"}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-2)", marginTop: "3px" }}>{a.reason}</div>
                    </div>
                    <button
                      type="button"
                      className="candidate-evidence-btn"
                      style={{ maxWidth: "200px" }}
                      onClick={() => {
                        setActiveAppeal(a);
                        setAppealNotes("");
                        setAppealScore("");
                      }}
                    >
                      <Icon name="edit" size={16} />
                      <span>Ko‘rib chiqish</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Flags List Heading */}
          <div
            className="section-heading"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "18px",
            }}
          >
            <div>
              <h2>Tekshiruv talab qilinadigan holatlar ({filteredFlags.length})</h2>
              <p>Kross-qatlam tahlili va baholovchilar ixtiloflari asosida inson ko‘rib chiqishiga yo‘naltirilgan holatlar</p>
            </div>
            {(searchQuery || selectedSeverity !== "all" || selectedStatus !== "all" || selectedType !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSeverity("all");
                  setSelectedStatus("all");
                  setSelectedType("all");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--royal)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Icon name="refresh" size={14} /> Filtrlarni tiklash
              </button>
            )}
          </div>

          {mode === "loading" ? (
            <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
              Moderatsiya navbati yuklanmoqda…
            </div>
          ) : filteredFlags.length === 0 ? (
            <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  borderRadius: "50%",
                  background: "var(--surface-3)",
                  color: "var(--muted)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Icon name="checkCircle" size={26} />
              </div>
              <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: "17px" }}>
                {isLive && flagViews.length === 0
                  ? "Navbatda hech qanday bayroq yo‘q"
                  : isLive && openCount === 0 && selectedStatus === "open"
                  ? "Hozircha ochiq bayroq yo‘q"
                  : "Hech qanday shubhali holat topilmadi"}
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px" }}>
                {isLive && flagViews.length === 0
                  ? "Tizim yangi signal aniqlasa, holat shu yerda paydo bo‘ladi."
                  : "Filtr mezonlarini o‘zgartiring yoki qidiruv so‘zini tozalang."}
              </p>
            </div>
          ) : (
            <div
              className={`candidates-grid ${filteredFlags.length === 1 ? "single-item" : ""}`}
            >
              {filteredFlags.map((flag) => {
                const isHigh = flag.severity === "high";
                const isMed = flag.severity === "medium";
                const isResolved = flag.status === "resolved";
                const resolvedLabel = flag.isLive
                  ? flag.rawStatus === "confirmed"
                    ? "Tasdiqlangan"
                    : flag.rawStatus === "dismissed"
                    ? "Asossiz"
                    : "Hal qilingan"
                  : "Hal qilingan";

                return (
                  <article
                    key={flag.id}
                    className="candidate-card"
                    style={{
                      opacity: isResolved ? 0.72 : 1,
                      borderLeft: isHigh
                        ? "4px solid var(--danger-400)"
                        : isMed
                        ? "4px solid var(--warning-400)"
                        : "4px solid var(--subtle)",
                    }}
                  >
                    {/* Top Row: Student info & Status */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "14px",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            minWidth: "44px",
                            borderRadius: "12px",
                            background: isHigh
                              ? "linear-gradient(135deg, var(--danger-strong), var(--danger-fg))"
                              : isMed
                              ? "linear-gradient(135deg, var(--warning-strong), var(--warning-fg))"
                              : "linear-gradient(135deg, var(--ink-2), var(--text-2))",
                            color: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 800,
                            fontSize: "15px",
                            boxShadow: "0 2px 8px rgba(9, 9, 11, 0.15)",
                          }}
                        >
                          {initials(flag.studentName)}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "16.5px", fontWeight: 700, color: "var(--navy)" }}>
                            {flag.studentName}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", flexWrap: "wrap" }}>
                            {flag.studentGroup && (
                              <>
                                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
                                  {flag.studentGroup}
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "6px",
                                background: "var(--accent-soft)",
                                color: "var(--royal)",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              {flag.skillName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        style={{
                          padding: "5px 11px",
                          borderRadius: "20px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          whiteSpace: "nowrap",
                          background: isResolved ? "var(--success-soft)" : isHigh ? "var(--danger-soft)" : "var(--warning-soft)",
                          color: isResolved ? "var(--success)" : isHigh ? "var(--danger-fg)" : "var(--warning-fg)",
                          border: isResolved ? "1px solid var(--success-ring)" : isHigh ? "1px solid var(--danger-ring)" : "1px solid var(--warning-ring)",
                        }}
                      >
                        {isResolved ? (
                          <>
                            <Icon name="check" size={13} /> {resolvedLabel}
                          </>
                        ) : (
                          <>
                            <span className="live-pulse-indicator" style={{ background: isHigh ? "var(--danger)" : "var(--warning)" }} />
                            Kutilmoqda
                          </>
                        )}
                      </span>
                    </div>

                    {/* Flag Type & Timestamp Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 800,
                          letterSpacing: "0.03em",
                          background: isHigh ? "var(--danger-soft)" : isMed ? "var(--warning-soft)" : "var(--surface-3)",
                          color: isHigh ? "var(--danger)" : isMed ? "var(--warning-fg)" : "var(--text-3)",
                        }}
                      >
                        {flag.type.replace(/_/g, " ")} · {flag.severity.toUpperCase()}
                      </span>
                      <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                        <Icon name="clock" size={12} /> {flag.timestamp}
                      </span>
                    </div>

                    {/* Live facts from flag details */}
                    {flag.facts.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px 14px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "#ffffff",
                          border: "1px dashed var(--border-strong)",
                          marginBottom: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {flag.facts.map((f) => (
                          <span key={f.label}>
                            {f.label}: <strong>{f.value}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Metric indicator (demo data) */}
                    {flag.metrics && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "#ffffff",
                          border: "1px dashed var(--border-strong)",
                          marginBottom: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {flag.metrics.doScore !== undefined && flag.metrics.defendScore !== undefined && (
                          <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "space-between" }}>
                            <span>
                              Amaliy ijro (DO): <strong>{flag.metrics.doScore}%</strong>
                            </span>
                            <span>
                              AI Viva (DEFEND): <strong>{flag.metrics.defendScore}%</strong>
                            </span>
                            <span style={{ color: "var(--danger)", fontWeight: 800 }}>
                              Farq: {flag.metrics.discrepancy} ball (≥ 35)
                            </span>
                          </div>
                        )}
                        {flag.metrics.model1Score !== undefined && flag.metrics.model2Score !== undefined && (
                          <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "space-between" }}>
                            <span>
                              Model #1: <strong>{flag.metrics.model1Score} b</strong>
                            </span>
                            <span>
                              Model #2: <strong>{flag.metrics.model2Score} b</strong>
                            </span>
                            <span style={{ color: "var(--warning)", fontWeight: 800 }}>
                              Kelishmovchilik: {flag.metrics.discrepancy} b
                            </span>
                          </div>
                        )}
                        {flag.metrics.similarityPct !== undefined && (
                          <div style={{ width: "100%", color: "var(--danger)", fontWeight: 700 }}>
                            AST Daraxt o‘xshashligi: <strong>{flag.metrics.similarityPct}%</strong> (Plagiat xavfi)
                          </div>
                        )}
                        {flag.metrics.latencySeconds !== undefined && (
                          <div style={{ width: "100%", color: "var(--warning-fg)", fontWeight: 700 }}>
                            Savoldan keyingi sukut davomiyligi: <strong>{flag.metrics.latencySeconds} soniya</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Narrative Reason Box */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        marginBottom: "16px",
                        fontSize: "12.5px",
                        color: "var(--text-2)",
                        lineHeight: "1.55",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          color: "var(--navy)",
                          fontSize: "11px",
                          fontWeight: 800,
                          marginBottom: "4px",
                        }}
                      >
                        <Icon name="alert" size={13} />
                        <span>{flag.isLive ? `SIGNAL: ${(FLAG_INFO[flag.type]?.label || flag.type).toUpperCase()}` : "ANOMALIYA TAVSIFI:"}</span>
                      </div>
                      {flag.reason}
                      {flag.resolutionNotes && (
                        <div style={{ marginTop: "6px", color: "var(--text-3)" }}>
                          <strong>Moderator izohi:</strong> {flag.resolutionNotes}
                        </div>
                      )}
                    </div>

                    {/* Action buttons (both aligned with equal height) */}
                    <div className="candidate-actions-row">
                      <button
                        type="button"
                        className="candidate-evidence-btn"
                        onClick={() => openReview(flag)}
                      >
                        <Icon name="file" size={16} />
                        <span>{flag.vivaSessionId || flag.transcriptExcerpt ? "Viva dialogini ko‘rish" : "Holatni ko‘rib chiqish"}</span>
                      </button>

                      {flag.status === "open" ? (
                        <button
                          type="button"
                          className="candidate-invite-btn"
                          disabled={resolving}
                          onClick={() => handleResolve(flag, "dismissed")}
                        >
                          <Icon name="checkCircle" size={16} />
                          <span>Asossiz (Oqlash)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="candidate-invite-btn is-invited"
                          disabled
                          style={{ cursor: "default" }}
                        >
                          <Icon name="check" size={16} />
                          <span>Ko‘rib chiqilgan</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: VIVA TRANSKRIPT TEKSHIRUVI (AI VIVA TRANSCRIPTS) */}
      {currentTab === "transcripts" && (
        <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div>
              <p className="card-kicker" style={{ margin: 0 }}>
                AI VIVA HIMOYA SESSIYALARI
              </p>
              <h2 style={{ margin: "4px 0" }}>
                {isLive ? "Inson tekshiruviga yo‘naltirilgan Viva sessiyalari" : "Talabalar og‘zaki audio transkriptlari"}
              </h2>
              <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                {isLive
                  ? "Savol-javob dialogi, har bir baholovchining ballari va talaba so‘zlaridan iqtiboslar"
                  : "Savol-javoblar audio yozuvi, nutq matni va avtomatlashtirilgan ishonchlilik indeksi"}
              </span>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder={isLive ? "Talaba yoki ko‘nikma nomi..." : "Talaba yoki topshiriq nomi..."}
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--border)",
                  fontSize: "13px",
                  outline: "none",
                  background: "var(--surface-2)",
                }}
              />
              <select
                value={transcriptFilter}
                onChange={(e) => setTranscriptFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--border)",
                  fontSize: "13px",
                  background: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="all">Barcha holatlar</option>
                {isLive ? (
                  <>
                    <option value="open">⏳ Tekshiruv kutilmoqda</option>
                    <option value="resolved">✅ Hal qilingan</option>
                  </>
                ) : (
                  <>
                    <option value="verified">✅ Tasdiqlangan</option>
                    <option value="flagged">🚩 Bayroq qo‘yilgan</option>
                    <option value="review_needed">⏳ Tekshiruv kutilmoqda</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {mode === "loading" && (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>Yuklanmoqda…</div>
          )}

          {/* LIVE transcripts */}
          {isLive && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {filteredVivaFlags.length === 0 && (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)", fontSize: "13.5px" }}>
                  {vivaFlags.length === 0
                    ? "Hozircha inson tekshiruviga yo‘naltirilgan Viva sessiyasi yo‘q."
                    : "Filtrga mos sessiya topilmadi."}
                </div>
              )}
              {filteredVivaFlags.map((f) => {
                const isExpanded = expandedTranscriptId === f.id;
                const spread = f.facts.find((x) => x.label === "Baholovchilar farqi");
                return (
                  <div
                    key={f.id}
                    style={{
                      borderRadius: "14px",
                      border: "1.5px solid var(--border)",
                      background: "#ffffff",
                      overflow: "hidden",
                      boxShadow: "0 2px 8px rgba(9, 9, 11, 0.03)",
                    }}
                  >
                    <div
                      style={{
                        padding: "16px 20px",
                        background: "var(--surface-2)",
                        borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: "var(--royal)",
                            color: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Icon name="file" size={16} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "16px", color: "var(--navy)" }}>{f.studentName}</strong>
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: f.status === "resolved" ? "var(--success-soft)" : "var(--warning-soft)",
                                color: f.status === "resolved" ? "var(--success)" : "var(--warning-fg)",
                              }}
                            >
                              {f.status === "resolved"
                                ? f.rawStatus === "confirmed"
                                  ? "Tasdiqlangan"
                                  : "Asossiz deb yopilgan"
                                : "Tekshiruv kutilmoqda"}
                            </span>
                          </div>
                          <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginTop: "2px" }}>
                            {f.skillName} · {FLAG_INFO[f.type]?.label || f.type} ·{" "}
                            <span style={{ color: "var(--muted)" }}>{f.timestamp}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        {spread && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>
                              BAHOLOVCHILAR FARQI
                            </div>
                            <strong style={{ fontSize: "16px", color: "var(--royal)" }}>{spread.value}</strong>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedTranscriptId(null);
                            } else {
                              setExpandedTranscriptId(f.id);
                              if (f.vivaSessionId) loadTranscript(f.vivaSessionId);
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border-strong)",
                            background: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "var(--navy)",
                            cursor: "pointer",
                          }}
                        >
                          {isExpanded ? "Yig‘ish ▲" : "Transkriptni ochish ▼"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && f.vivaSessionId && (
                      <div style={{ padding: "20px" }}>
                        {renderLiveTranscript(f.vivaSessionId)}
                        {f.status === "open" && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: "10px",
                              marginTop: "16px",
                              paddingTop: "14px",
                              borderTop: "1px solid var(--surface-3)",
                            }}
                          >
                            <button
                              type="button"
                              className="candidate-invite-btn"
                              style={{ maxWidth: "260px" }}
                              onClick={() => openReview(f)}
                            >
                              <Icon name="shield" size={16} />
                              <span>Qaror qabul qilish</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* DEMO transcripts */}
          {mode === "demo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {filteredTranscripts.map((t) => {
              const isExpanded = expandedTranscriptId === t.id;
              const isPlaying = playingTranscriptId === t.id;

              return (
                <div
                  key={t.id}
                  style={{
                    borderRadius: "14px",
                    border: "1.5px solid var(--border)",
                    background: "#ffffff",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(9, 9, 11, 0.03)",
                  }}
                >
                  {/* Card Header Bar */}
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "var(--surface-2)",
                      borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <button
                        type="button"
                        onClick={() => handleTogglePlay(t.id)}
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          border: "none",
                          background: isPlaying ? "var(--danger)" : "var(--royal)",
                          color: "#ffffff",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          boxShadow: "0 2px 6px rgba(30, 58, 138, 0.25)",
                          transition: "transform 0.15s ease",
                        }}
                        title={isPlaying ? "Audioni to‘xtatish" : "Audioni eshitish"}
                      >
                        <Icon name={isPlaying ? "close" : "play"} size={16} />
                      </button>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "16px", color: "var(--navy)" }}>{t.studentName}</strong>
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>({t.studentGroup})</span>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background:
                                t.status === "verified"
                                  ? "var(--success-soft)"
                                  : t.status === "flagged"
                                  ? "var(--danger-soft)"
                                  : "var(--warning-soft)",
                              color:
                                t.status === "verified"
                                  ? "var(--success)"
                                  : t.status === "flagged"
                                  ? "var(--danger)"
                                  : "var(--warning)",
                            }}
                          >
                            {t.status === "verified"
                              ? "Tasdiqlangan"
                              : t.status === "flagged"
                              ? "Bayroq qo‘yilgan"
                              : "Qayta tahlil"}
                          </span>
                        </div>
                        <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginTop: "2px" }}>
                          {t.taskTitle} · <span style={{ color: "var(--muted)" }}>{t.date} ({t.duration})</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>
                          VIVA BALI / INTEGRITY
                        </div>
                        <strong style={{ fontSize: "16px", color: "var(--royal)" }}>
                          {t.overallScore}/100{" "}
                          <span style={{ fontSize: "12px", color: t.integrityScore < 70 ? "var(--danger)" : "var(--success)" }}>
                            ({t.integrityScore}% ishonch)
                          </span>
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedTranscriptId(isExpanded ? null : t.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-strong)",
                          background: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--navy)",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Yig‘ish ▲" : "Tafsilotlar ▼"}
                      </button>
                    </div>
                  </div>

                  {/* Audio Playing Bar */}
                  {isPlaying && (
                    <div
                      style={{
                        padding: "12px 20px",
                        background: "var(--ink)",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                      }}
                    >
                      <Icon name="play" size={16} />
                      <span style={{ fontSize: "12px", fontWeight: 700 }}>
                        Audio ijro etilmoqda ({t.studentName})
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "4px",
                          background: "rgba(255, 255, 255, 0.2)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${audioProgress}%`,
                            height: "100%",
                            background: "var(--info-400)",
                            borderRadius: "4px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--subtle)" }}>03:45 / {t.duration}</span>
                    </div>
                  )}

                  {/* Expanded QA Pairs List */}
                  {isExpanded && (
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {t.qaPairs.map((qa, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "14px 16px",
                              borderRadius: "10px",
                              background: qa.flagRaised ? "var(--rose-soft)" : "var(--surface-2)",
                              border: qa.flagRaised ? "1.5px solid var(--rose-ring)" : "1px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "6px",
                              }}
                            >
                              <strong style={{ fontSize: "13px", color: "var(--navy)" }}>
                                🎙️ Savol #{idx + 1} (AI Examiner):
                              </strong>
                              <span
                                style={{
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  color: qa.evaluatorScore < 50 ? "var(--danger)" : "var(--success)",
                                }}
                              >
                                Baho: {qa.evaluatorScore}/100 · Nutq ishonchliligi: {qa.audioConfidence}%
                              </span>
                            </div>
                            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--ink-2)", fontWeight: 600 }}>
                              {qa.question}
                            </p>

                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: "8px",
                                background: "#ffffff",
                                border: "1px solid var(--border)",
                                fontSize: "12.5px",
                                color: "var(--text-2)",
                                fontStyle: "italic",
                              }}
                            >
                              <strong>Talaba javobi:</strong> "{qa.answer}"
                            </div>

                            {qa.flagRaised && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  fontSize: "12px",
                                  color: "var(--danger-fg)",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                <Icon name="alert" size={13} />
                                <span>Shubhali javob: Talaba o‘z yozgan kodi mohiyatini tushuntirib bera olmadi.</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Moderator Decision Footer */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "10px",
                          marginTop: "16px",
                          paddingTop: "14px",
                          borderTop: "1px solid var(--surface-3)",
                        }}
                      >
                        <button
                          type="button"
                          className="candidate-evidence-btn"
                          style={{ maxWidth: "220px" }}
                          onClick={() => handleTranscriptVerdict(t.id, "verified", "Transkript tasdiqlandi")}
                        >
                          <Icon name="checkCircle" size={16} />
                          <span>Tasdiqlash (Qoniqarli)</span>
                        </button>
                        <button
                          type="button"
                          className="candidate-invite-btn"
                          style={{ maxWidth: "240px", background: "var(--danger)" }}
                          onClick={() => handleTranscriptVerdict(t.id, "flagged", "Bayroq ro‘yxatiga kiritildi")}
                        >
                          <Icon name="shield" size={16} />
                          <span>Inson tekshiruviga yuborish</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </section>
      )}

      {/* TAB 3: ONTOLOGIYA & RUBRIKALAR */}
      {currentTab === "rules" && ontologyLive && (
        <>
          <section className="card" style={{ padding: "26px", marginBottom: "22px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "20px",
              }}
            >
              <div>
                <p className="card-kicker" style={{ margin: 0 }}>
                  KO‘NIKMALAR ONTOLOGIYASI · 5 DARAJALI RUBRIKALAR
                </p>
                <h2 style={{ margin: "4px 0" }}>Yo‘nalishlar va ko‘nikmalar</h2>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, maxWidth: "680px" }}>
                  ★ — pilot ko‘nikma. Ko‘nikmani tanlang va uning L1–L5 rubrikasini ko‘ring.
                </p>
              </div>
              {modeBadge("live")}
            </div>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* Directions & skills */}
              <div style={{ flex: "1 1 260px", minWidth: "240px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {(directions || []).length === 0 && (
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Ontologiyada hali yo‘nalish yo‘q.</div>
                )}
                {(directions || []).map((d) => (
                  <div key={d.id}>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--navy)", marginBottom: "6px" }}>
                      {d.name}{" "}
                      <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                        · {d.code} · v{d.version}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {(d.skills || []).map((s: any) => {
                        const active = selectedSkillId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSkillId(s.id)}
                            style={{
                              textAlign: "left",
                              padding: "7px 10px",
                              borderRadius: "8px",
                              border: active ? "1.5px solid var(--royal)" : "1px solid var(--border)",
                              background: active ? "var(--accent-soft)" : "#ffffff",
                              color: "var(--navy)",
                              fontSize: "12.5px",
                              fontWeight: active ? 700 : 500,
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <span>
                              {s.pilot && <span style={{ color: "var(--warning)" }}>★ </span>}
                              {s.name}
                            </span>
                            <span style={{ color: "var(--muted)", fontSize: "11px", whiteSpace: "nowrap" }}>{s.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rubric */}
              <div style={{ flex: "2 1 380px", minWidth: "280px" }}>
                {!skillDetail && (
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Rubrikani ko‘rish uchun ko‘nikmani tanlang.</div>
                )}
                {skillDetail?.status === "loading" && (
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Rubrika yuklanmoqda…</div>
                )}
                {skillDetail?.status === "error" && (
                  <div style={{ fontSize: "13px", color: "var(--danger-fg)" }}>{skillDetail.error}</div>
                )}
                {skillDetail?.status === "ok" && skillDetail.data && (
                  <div>
                    <div style={{ marginBottom: "12px" }}>
                      <h3 style={{ margin: "0 0 4px", fontSize: "17px", color: "var(--navy)" }}>
                        {skillDetail.data.pilot && <span style={{ color: "var(--warning)" }}>★ </span>}
                        {skillDetail.data.name}
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {skillDetail.data.code} · {skillDetail.data.type} · v{skillDetail.data.version}
                        {skillDetail.data.framework_refs?.SFIA ? ` · SFIA: ${skillDetail.data.framework_refs.SFIA}` : ""}
                      </div>
                      {skillDetail.data.framework_refs?.subskills && (
                        <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginTop: "6px" }}>
                          <strong>Sub-ko‘nikmalar:</strong> {String(skillDetail.data.framework_refs.subskills)}
                        </div>
                      )}
                    </div>
                    {(skillDetail.data.rubrics || []).length === 0 ? (
                      <div style={{ fontSize: "13px", color: "var(--muted)" }}>Bu ko‘nikma uchun rubrika hali kiritilmagan.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {(skillDetail.data.rubrics || []).map((r: any) => {
                          const c = r.criteria && typeof r.criteria === "object" ? r.criteria : {};
                          return (
                            <div
                              key={r.level}
                              style={{
                                padding: "12px 14px",
                                borderRadius: "10px",
                                border: "1px solid var(--border)",
                                background: "var(--surface-2)",
                                display: "flex",
                                gap: "12px",
                                alignItems: "flex-start",
                              }}
                            >
                              <span
                                style={{
                                  minWidth: "34px",
                                  height: "34px",
                                  borderRadius: "10px",
                                  background: "var(--navy)",
                                  color: "#ffffff",
                                  display: "grid",
                                  placeItems: "center",
                                  fontWeight: 800,
                                  fontSize: "13px",
                                }}
                              >
                                L{r.level}
                              </span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--navy)" }}>
                                  {r.level_name}{" "}
                                  <span style={{ color: "var(--muted)", fontWeight: 600 }}>· v{r.version}</span>
                                </div>
                                {typeof c.description === "string" && (
                                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginTop: "3px" }}>{c.description}</div>
                                )}
                                {Object.entries(c)
                                  .filter(([k]) => k !== "description")
                                  .map(([k, v]) => (
                                    <div key={k} style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
                                      <strong>{k}:</strong> {typeof v === "string" ? v : JSON.stringify(v)}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Integrity signal reference (read-only) */}
          <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
            <p className="card-kicker" style={{ margin: 0 }}>
              HALOLLIK SIGNALLARI · FAQAT YO‘NALTIRADI, JAZOLAMAYDI
            </p>
            <h2 style={{ margin: "4px 0 6px" }}>Bayroq turlari</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px", maxWidth: "720px" }}>
              Chegara qiymatlari backend konfiguratsiyasida belgilanadi. Har bir signal faqat holatni moderatorga yo‘naltiradi.
              {isLive ? " Hisoblagich — navbatdagi barcha (ochiq va hal qilingan) bayroqlar soni." : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Object.entries(FLAG_INFO).map(([code, info]) => (
                <div
                  key={code}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 800,
                        background: "var(--surface-3)",
                        color: "var(--text-3)",
                      }}
                    >
                      {code}
                    </span>
                    <strong style={{ fontSize: "14px", color: "var(--navy)" }}>{info.label}</strong>
                    {isLive && (
                      <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                        · navbatda: {typeCounts[code] || 0} ta
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", lineHeight: "1.5" }}>{info.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* TAB 3 (demo fallback): INTEGRITY RULES & THRESHOLDS */}
      {currentTab === "rules" && !ontologyLive && (
        <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "22px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <p className="card-kicker" style={{ margin: 0 }}>
                  ANTI-FRAUD VA INTEGRITY ALGORITMLARI
                </p>
                {modeBadge("demo")}
              </div>
              <h2 style={{ margin: "4px 0" }}>Halollik signallari chegaralari</h2>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, maxWidth: "680px" }}>
                Chegara qiymatlari (Thresholds). Buzilish aniqlansa, tizim bayroq yaratadi — bayroq jazo emas, holat faqat moderator ko‘rib chiqishiga yo‘naltiriladi.
              </p>
            </div>

            <button
              type="button"
              className="candidate-invite-btn"
              style={{ padding: "10px 18px", maxWidth: "220px" }}
              onClick={() => showToast("Demo rejim: o‘zgarishlar serverga saqlanmaydi")}
            >
              <Icon name="checkCircle" size={16} />
              <span>Qoidalarni saqlash</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {rules.map((rule) => {
              const isHigh = rule.severity === "high";
              const isMed = rule.severity === "medium";

              return (
                <div
                  key={rule.id}
                  style={{
                    padding: "20px 22px",
                    borderRadius: "14px",
                    border: "1.5px solid var(--border)",
                    background: rule.isActive ? "#ffffff" : "var(--surface-2)",
                    opacity: rule.isActive ? 1 : 0.6,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "10px",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            background: isHigh ? "var(--danger-soft)" : isMed ? "var(--warning-soft)" : "var(--surface-3)",
                            color: isHigh ? "var(--danger)" : isMed ? "var(--warning-fg)" : "var(--text-3)",
                          }}
                        >
                          {rule.code} · {rule.severity.toUpperCase()}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                          Ishga tushgan: {rule.triggeredCount} marta
                        </span>
                      </div>
                      <h3 style={{ margin: "2px 0", fontSize: "16.5px", color: "var(--navy)" }}>
                        {rule.name}
                      </h3>
                    </div>

                    {/* Toggle Switch */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: rule.isActive ? "var(--success)" : "var(--muted)" }}>
                        {rule.isActive ? "FAOL" : "TO‘XTATILGAN"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id)}
                        style={{
                          width: "48px",
                          height: "26px",
                          borderRadius: "14px",
                          border: "none",
                          background: rule.isActive ? "var(--success)" : "var(--border-strong)",
                          position: "relative",
                          cursor: "pointer",
                          transition: "background 0.2s ease",
                        }}
                        aria-label="Qoidani yoqish/o‘chirish"
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: rule.isActive ? "25px" : "3px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "#ffffff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: "8px 0 14px", fontSize: "13px", color: "var(--text-2)", lineHeight: "1.5" }}>
                    {rule.description}
                  </p>

                  {/* Interactive Slider & Formula */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "14px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--navy)",
                          marginBottom: "6px",
                        }}
                      >
                        <span>TRIGER CHEGARASI:</span>
                        <strong style={{ color: "var(--royal)", fontSize: "13.5px" }}>
                          ≥ {rule.threshold} {rule.unit}
                        </strong>
                      </div>
                      <input
                        type="range"
                        min={rule.category === "similarity" ? "50" : "10"}
                        max={rule.category === "similarity" ? "99" : "150"}
                        value={rule.threshold}
                        disabled={!rule.isActive}
                        onChange={(e) => handleThresholdChange(rule.id, Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--royal)", cursor: "pointer" }}
                      />
                    </div>

                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "#ffffff",
                        border: "1px solid var(--border-strong)",
                        fontSize: "12px",
                        color: "var(--text-3)",
                        maxWidth: "380px",
                      }}
                    >
                      <strong style={{ color: "var(--navy)" }}>Qoida mantig‘i:</strong> {rule.explanation}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Review Dialog Modal (Holat tahlili & Transkript ekspertizasi) */}
      {activeFlag && (
        <div
          className="modal-backdrop employer-modal-backdrop"
          role="presentation"
          onMouseDown={closeReview}
        >
          <div
            className="modal employer-modal"
            style={{ maxWidth: "700px", borderRadius: "20px", padding: "28px", maxHeight: "90vh", overflowY: "auto" }}
            role="dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={closeReview}>
              <Icon name="close" />
            </button>
            <div
              className="modal-symbol"
              style={{
                background:
                  activeFlag.severity === "high"
                    ? "linear-gradient(135deg, var(--danger-strong), var(--danger-fg))"
                    : "linear-gradient(160deg, #2b4fa8, #1e3a8a 45%, #0f2744)",
                color: "white",
              }}
            >
              <Icon name="shield" size={30} />
            </div>

            <p className="eyebrow" style={{ color: "var(--royal)" }}>
              HUMAN-IN-THE-LOOP · MODERATSIYA EKSPERTIZASI {activeFlag.isLive ? "" : "· DEMO"}
            </p>
            <h2 style={{ fontSize: "22px", margin: "4px 0" }}>
              {activeFlag.studentName} · Holat tahlili
            </h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
              Ko‘nikma: <strong>{activeFlag.skillName}</strong> · Turi: <strong>{activeFlag.type}</strong> ·{" "}
              {activeFlag.timestamp}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                textAlign: "left",
                marginBottom: "20px",
              }}
            >
              {/* Reason card */}
              <div
                style={{
                  padding: "13px 15px",
                  borderRadius: "12px",
                  background: "var(--rose-soft)",
                  border: "1px solid var(--rose-ring)",
                  fontSize: "12.5px",
                  color: "var(--rose-fg)",
                  lineHeight: "1.55",
                }}
              >
                <strong>Tizim signali:</strong> {activeFlag.reason}
                {activeFlag.facts.length > 0 && (
                  <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                    {activeFlag.facts.map((f) => (
                      <span key={f.label}>
                        {f.label}: <strong>{f.value}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Live viva transcript */}
              {activeFlag.isLive && activeFlag.vivaSessionId && (
                <div
                  style={{
                    padding: "15px",
                    borderRadius: "12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--navy)",
                      fontWeight: 800,
                      marginBottom: "8px",
                      fontSize: "11.5px",
                    }}
                  >
                    <Icon name="file" size={14} />
                    <span>AI VIVA HIMOYA DIALOGI VA BAHOLOVCHILAR:</span>
                  </div>
                  {renderLiveTranscript(activeFlag.vivaSessionId, true)}
                </div>
              )}

              {/* AI Viva Dialog Transcript (demo) */}
              {activeFlag.transcriptExcerpt && (
                <div
                  style={{
                    padding: "15px",
                    borderRadius: "12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    fontSize: "12.5px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--navy)",
                      fontWeight: 800,
                      marginBottom: "8px",
                      fontSize: "11.5px",
                    }}
                  >
                    <Icon name="file" size={14} />
                    <span>AI VIVA HIMOYA DIALOGI PARCHASI:</span>
                  </div>

                  <p style={{ margin: "0 0 6px", color: "var(--navy)", fontWeight: 600 }}>
                    🎙️ <strong>AI Examiner:</strong> "{activeFlag.transcriptExcerpt.question}"
                  </p>
                  <p
                    style={{
                      margin: "0 0 10px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid var(--border)",
                      color: "var(--text-2)",
                      fontStyle: "italic",
                    }}
                  >
                    🗣️ <strong>Talaba javobi:</strong> "{activeFlag.transcriptExcerpt.answer}"
                  </p>

                  <div style={{ color: "var(--danger-fg)", fontWeight: 700, fontSize: "12px" }}>
                    ⚖️ <strong>AI baholash xulosasi:</strong> {activeFlag.transcriptExcerpt.aiVerdict}
                  </div>
                </div>
              )}

              {activeFlag.status === "open" && (
                <>
                  {/* Moderator Notes Box */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "var(--muted)",
                        marginBottom: "6px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      MODERATOR QARORI ASOSI VA IZOHI (IXTIYORIY):
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Transkript yoki kod tahlili bo‘yicha xulosa yozing..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1.5px solid var(--border)",
                        fontSize: "12.5px",
                        outline: "none",
                        fontFamily: "inherit",
                        resize: "none",
                      }}
                    />
                  </div>

                  {/* Human re-grade for viva cases */}
                  {activeIsViva && (
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          color: "var(--muted)",
                          marginBottom: "6px",
                          letterSpacing: "0.04em",
                        }}
                      >
                        INSON QAYTA BAHOSI (0–100, IXTIYORIY):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="Masalan, 72"
                        value={humanScore}
                        onChange={(e) => setHumanScore(e.target.value)}
                        style={{
                          width: "160px",
                          padding: "9px 12px",
                          borderRadius: "10px",
                          border: "1.5px solid var(--border)",
                          fontSize: "13px",
                          outline: "none",
                        }}
                      />
                      <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "4px" }}>
                        Kiritilsa, DEFEND dalili shu inson bahosi bilan almashtiriladi va ko‘nikma qayta hisoblanadi.
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: "11.5px", color: "var(--muted)", lineHeight: "1.5" }}>
                    Avtomatik jazo yo‘q. «Asossiz» — bayroq yopiladi, dalillar o‘zgarmaydi. «Tasdiqlash» — moderator signalni asosli deb
                    topadi
                    {activeFlag.type === "SIMILARITY_HIGH" || activeFlag.type === "PROMPT_INJECTION"
                      ? "; bu turda urinish dalillari hisobdan chiqariladi."
                      : "."}
                  </div>
                </>
              )}
            </div>

            {/* Verdict Action Buttons */}
            {activeFlag.status === "open" ? (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="candidate-evidence-btn"
                  style={{ flex: 1 }}
                  disabled={resolving}
                  onClick={() => handleResolve(activeFlag, "dismissed")}
                >
                  <Icon name="checkCircle" size={16} />
                  <span>{resolving ? "Saqlanmoqda…" : "Asossiz deb topish (Oqlash)"}</span>
                </button>

                <button
                  type="button"
                  className="candidate-invite-btn"
                  style={{ flex: 1.2, background: "linear-gradient(135deg, var(--danger-fg), var(--danger-fg))" }}
                  disabled={resolving}
                  onClick={() => handleResolve(activeFlag, "confirmed")}
                >
                  <Icon name="shield" size={16} />
                  <span>{resolving ? "Saqlanmoqda…" : "Signalni tasdiqlash (Asosli)"}</span>
                </button>
              </div>
            ) : (
              <div style={{ fontSize: "12.5px", color: "var(--success)", fontWeight: 700 }}>
                <Icon name="check" size={14} /> Bu holat allaqachon ko‘rib chiqilgan
                {activeFlag.resolutionNotes ? ` — ${activeFlag.resolutionNotes}` : "."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Appeal resolution modal (live only) */}
      {activeAppeal && (
        <div
          className="modal-backdrop employer-modal-backdrop"
          role="presentation"
          onMouseDown={() => setActiveAppeal(null)}
        >
          <div
            className="modal employer-modal"
            style={{ maxWidth: "560px", borderRadius: "20px", padding: "28px" }}
            role="dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setActiveAppeal(null)}>
              <Icon name="close" />
            </button>
            <p className="eyebrow" style={{ color: "var(--royal)" }}>
              TALABA E’TIROZI · INSON QAYTA BAHOLAYDI
            </p>
            <h2 style={{ fontSize: "20px", margin: "4px 0 12px" }}>E’tirozni ko‘rib chiqish</h2>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: "13px",
                color: "var(--text-2)",
                marginBottom: "14px",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700, marginBottom: "4px" }}>
                {fmtDate(activeAppeal.created_at)}
              </div>
              {activeAppeal.reason}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left", marginBottom: "18px" }}>
              <textarea
                rows={2}
                placeholder="Qaror asosi (majburiy)..."
                value={appealNotes}
                onChange={(e) => setAppealNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid var(--border)",
                  fontSize: "12.5px",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "none",
                }}
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder="Yangi ball 0–100 (ixtiyoriy, qabul qilinganda)"
                value={appealScore}
                onChange={(e) => setAppealScore(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid var(--border)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="candidate-evidence-btn"
                style={{ flex: 1 }}
                disabled={resolving}
                onClick={() => handleResolveAppeal("rejected")}
              >
                <Icon name="close" size={16} />
                <span>Rad etish</span>
              </button>
              <button
                type="button"
                className="candidate-invite-btn"
                style={{ flex: 1 }}
                disabled={resolving}
                onClick={() => handleResolveAppeal("approved")}
              >
                <Icon name="checkCircle" size={16} />
                <span>Qabul qilish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="toast">
          <Icon name="check" /> {toastMessage}
          <button onClick={() => setToastMessage(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
