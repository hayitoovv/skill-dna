import { useState, useEffect, useMemo } from "react";
import { Icon } from "../common/Icons";
import { teacherGroupData } from "../../data/ontology";
import { api, hasSession } from "../../services/api";

type LayerKey = "KNOW" | "DO" | "ADAPT" | "DEFEND" | "PROVE";
const LAYER_KEYS: LayerKey[] = ["KNOW", "DO", "ADAPT", "DEFEND", "PROVE"];

// Live backend shapes (backend/app/api/v1/endpoints/staff.py)
interface LiveGroup {
  group_id: string;
  students: number;
}
interface LiveSkillGap {
  skill: { id: string; code: string; name: string };
  students_scored: number;
  avg_score: number;
  below_70: number;
  gap_pct: number;
  layers: Record<LayerKey, number | null>;
}
interface LiveGroupGaps {
  group_id: string;
  students_total: number;
  skills: LiveSkillGap[];
  students: { id: string; name: string; email: string; level: string; score: number; skills_scored: number }[];
}
interface LiveProveItem {
  id: string;
  student: { id: string; name: string };
  skill: string | null;
  title: string;
  source_ref: string | null;
  submitted_at: string;
}
interface ProveRow {
  id: string;
  studentName: string;
  studentAvatar?: string;
  studentGroup?: string;
  skillName: string;
  title: string;
  submittedAt?: string;
  type?: string;
  links?: string | null;
  targetLevel?: string;
  description?: string;
  testsPassed?: string;
  commitsCount?: number;
  plagiarismScore?: string;
  rubrics?: { codeQuality?: number; architecture?: number; unitTests?: number; docs?: number };
  live?: boolean;
}
interface RemedialTaskRow {
  id: string;
  skill: string;
  title: string;
  assignedStudentsCount: number | string;
  difficulty: string;
  aiMode: string;
  progress: string;
  status: string;
  scoreBoost: string;
  deadline: string;
}

// Unified student matrix row (demo rows carry full data; live rows only what the API returns)
interface MatrixRow {
  id: string;
  name: string;
  email: string;
  avatar: string;
  overallScore: number | null;
  level: string;
  confidence: number | null;
  evidenceCount: number | null;
  skillsScored: number | null;
  status: string;
  layers: Record<LayerKey, number> | null;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const heatmapStatus = (avg: number) =>
  avg >= 75 ? "Yaxshi" : avg >= 65 ? "O‘rtacha" : avg >= 55 ? "Bo‘shliq (Diqqat)" : "Katta bo‘shliq";

const liveStudentStatus = (score: number, skillsScored: number) => {
  if (skillsScored === 0) return "Baholanmagan";
  if (score >= 80) return "Bozorga tayyor";
  if (score >= 70) return "Faol rivojlanmoqda";
  if (score >= 60) return "Bo‘shliq aniqlangan";
  return "Remedial kerak";
};

const DEMO_PACKAGES = [
  {
    skill: "DevOps va CI/CD",
    skillId: "",
    title: "DevOps & CI/CD bo‘yicha 12 nafar talabaga",
    desc: "Dockerfile optimallash, GitHub Actions matrix build va Docker compose konfiguratsiyasi. Har bir talabaga individual sintaktik cheklov beriladi.",
  },
  {
    skill: "Ma’lumotlar tuzilmasi (DSA)",
    skillId: "",
    title: "DSA (Graf va Daraxtlar) bo‘yicha 8 nafar talabaga",
    desc: "Dijkstra, BFS/DFS va binary search bo‘yicha parametrli algoritmik chellinjlar va avtomatik sandbox tekshiruvi.",
  },
  {
    skill: "SQL va ma’lumotlar bazasi",
    skillId: "",
    title: "SQL Tranzaksiyalar & Indekslar (8 talaba)",
    desc: "Deadlock simulyatsiyasi, EXPLAIN ANALYZE hisoboti va MVCC izolatsiya sinovi bo‘yicha vazifalar to‘plami.",
  },
];

const VIVA_CRITERIA_LABELS: Record<string, string> = {
  ownership: "Yechimni tushuntirish va egalik",
  what_if: "Yangi shartga moslashish",
  find_bug: "Xatoni topish va tuzatish",
  trade_off: "Trade-off’larni asoslash",
  ai_usage: "AI’dan shaffof foydalanish",
};

// Maps a /teacher/viva-results row onto the card shape this page already renders
function liveVivaRow(r: any, groupId: string | null) {
  const criteria: Record<string, number> = r.criteria || {};
  const openFlag = (r.flags || []).some(
    (f: any) => ["pending", "under_review"].includes(f.status) && f.type !== "VIVA_SAMPLE_REVIEW"
  );
  const notes = [r.panel_note, r.human_score != null ? `Inson bahosi: ${r.human_score}` : null].filter(Boolean);
  return {
    id: r.session_id,
    sessionId: r.session_id,
    live: true,
    studentName: r.student.name,
    studentAvatar: r.student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
    studentGroup: groupId ?? "—",
    taskTitle: String(r.task).replace(/^(DO|ADAPT):\s*/, ""),
    date: new Date(r.ended_at).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" }),
    vivaScore: r.score != null ? Math.round(r.score) : "—",
    confidence: null,
    duration: `${r.questions} savol`,
    status: openFlag ? "flagged" : "passed",
    strengths: Object.entries(criteria).filter(([, v]) => v >= 75).map(([k]) => VIVA_CRITERIA_LABELS[k] ?? k),
    weaknesses: Object.entries(criteria).filter(([, v]) => v < 60).map(([k]) => VIVA_CRITERIA_LABELS[k] ?? k),
    teacherNote: notes.join(" · ") || "—",
    humanScore: r.human_score,
    dialogue: null,
  };
}

function DataSourceBadge({ mode }: { mode: "loading" | "live" | "demo" }) {
  const live = mode === "live";
  const loading = mode === "loading";
  return (
    <span
      title={live ? "Ma’lumotlar backenddan olindi" : loading ? "Ma’lumotlar yuklanmoqda" : "Backend mavjud emas yoki ruxsat yo‘q — namunaviy ma’lumotlar ko‘rsatilmoqda"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: live ? "var(--success-soft)" : loading ? "var(--surface-2)" : "var(--warning-soft)",
        color: live ? "var(--success)" : loading ? "var(--muted)" : "var(--warning)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: live ? "var(--success)" : loading ? "var(--muted)" : "var(--warning)",
        }}
      />
      {live ? "Jonli ma’lumot" : loading ? "Yuklanmoqda…" : "Demo ma’lumot"}
    </span>
  );
}

// 5-Layer Group Competency Definitions
interface LayerMetric {
  key: "KNOW" | "DO" | "ADAPT" | "DEFEND" | "PROVE";
  label: string;
  score: number;
  weight: string;
  tone: "blue" | "emerald" | "violet" | "amber" | "rose";
  icon: "file" | "code" | "settings" | "briefcase" | "award";
  desc: string;
  topStudent: string;
  lowStudent: string;
}

const groupLayers: LayerMetric[] = [
  {
    key: "KNOW",
    label: "Nazariy bilim",
    score: 82,
    weight: "15%",
    tone: "blue",
    icon: "file",
    desc: "Arxitektura va algoritmik tushunchalar mustahkam shakllangan.",
    topStudent: "Bobur Mirzayev (91)",
    lowStudent: "Jasur Qodirov (68)",
  },
  {
    key: "DO",
    label: "Amaliy ijro",
    score: 74,
    weight: "30%",
    tone: "emerald",
    icon: "code",
    desc: "Kod yozish va unit testlar bo‘yicha ko‘pchilik talabalar L3 darajada.",
    topStudent: "Azizbek Sobirov (88)",
    lowStudent: "Malika Umarova (55)",
  },
  {
    key: "ADAPT",
    label: "Moslashuvchanlik",
    score: 68,
    weight: "20%",
    tone: "violet",
    icon: "settings",
    desc: "Yangi talablar va refaktoring sinovlarida o‘rtacha qiyinchilik bor.",
    topStudent: "Madina Karimova (82)",
    lowStudent: "Rustam Xoliqov (52)",
  },
  {
    key: "DEFEND",
    label: "Viva & Himoya",
    score: 76,
    weight: "20%",
    tone: "amber",
    icon: "briefcase",
    desc: "AI Viva intervyularida talabalar arxitekturani yaxshi asoslab bermoqda.",
    topStudent: "Azizbek Sobirov (86)",
    lowStudent: "Jasur Qodirov (60)",
  },
  {
    key: "PROVE",
    label: "Real dalillar",
    score: 62,
    weight: "15%",
    tone: "rose",
    icon: "award",
    desc: "GitHub repolari va haqiqiy loyihalarni yuklashda faollikni oshirish kerak.",
    topStudent: "Bobur Mirzayev (85)",
    lowStudent: "Malika Umarova (42)",
  },
];

// Group Students Roster
interface GroupStudent {
  id: string;
  name: string;
  email: string;
  avatar: string;
  overallScore: number;
  level: "L2" | "L3" | "L4";
  confidence: number;
  evidenceCount: number;
  status: "Bozorga tayyor" | "Faol rivojlanmoqda" | "Bo‘shliq aniqlangan" | "Remedial kerak";
  topSkills: { name: string; score: number }[];
  layers: Record<"KNOW" | "DO" | "ADAPT" | "DEFEND" | "PROVE", number>;
}

const initialStudents: GroupStudent[] = [
  {
    id: "st-1",
    name: "Azizbek Sobirov",
    email: "azizbek.sobirov@bdtu.uz",
    avatar: "AS",
    overallScore: 83,
    level: "L4",
    confidence: 81,
    evidenceCount: 18,
    status: "Bozorga tayyor",
    topSkills: [
      { name: "Backend va REST API", score: 88 },
      { name: "SQL va ma’lumotlar bazasi", score: 84 },
      { name: "DevOps va CI/CD", score: 79 },
    ],
    layers: { KNOW: 85, DO: 88, ADAPT: 80, DEFEND: 86, PROVE: 77 },
  },
  {
    id: "st-2",
    name: "Madina Karimova",
    email: "madina.karimova@bdtu.uz",
    avatar: "MK",
    overallScore: 78,
    level: "L3",
    confidence: 76,
    evidenceCount: 14,
    status: "Faol rivojlanmoqda",
    topSkills: [
      { name: "OOP va dizayn pattern’lari", score: 85 },
      { name: "SQL va ma’lumotlar bazasi", score: 82 },
      { name: "Backend va REST API", score: 76 },
    ],
    layers: { KNOW: 83, DO: 76, ADAPT: 82, DEFEND: 78, PROVE: 71 },
  },
  {
    id: "st-3",
    name: "Bobur Mirzayev",
    email: "bobur.mirzayev@bdtu.uz",
    avatar: "BM",
    overallScore: 86,
    level: "L4",
    confidence: 84,
    evidenceCount: 21,
    status: "Bozorga tayyor",
    topSkills: [
      { name: "Kompyuter tarmoqlari", score: 91 },
      { name: "Linux Administration", score: 87 },
      { name: "Backend va REST API", score: 82 },
    ],
    layers: { KNOW: 91, DO: 86, ADAPT: 84, DEFEND: 86, PROVE: 85 },
  },
  {
    id: "st-4",
    name: "Jasur Qodirov",
    email: "jasur.qodirov@bdtu.uz",
    avatar: "JQ",
    overallScore: 63,
    level: "L2",
    confidence: 65,
    evidenceCount: 8,
    status: "Bo‘shliq aniqlangan",
    topSkills: [
      { name: "Ma’lumotlar tuzilmasi (DSA)", score: 62 },
      { name: "Backend va REST API", score: 65 },
      { name: "DevOps va CI/CD", score: 54 },
    ],
    layers: { KNOW: 68, DO: 64, ADAPT: 60, DEFEND: 60, PROVE: 52 },
  },
  {
    id: "st-5",
    name: "Malika Umarova",
    email: "malika.umarova@bdtu.uz",
    avatar: "MU",
    overallScore: 59,
    level: "L2",
    confidence: 62,
    evidenceCount: 6,
    status: "Remedial kerak",
    topSkills: [
      { name: "Backend va REST API", score: 60 },
      { name: "DevOps va CI/CD", score: 48 },
      { name: "Ma’lumotlar tuzilmasi (DSA)", score: 52 },
    ],
    layers: { KNOW: 70, DO: 55, ADAPT: 56, DEFEND: 63, PROVE: 42 },
  },
  {
    id: "st-6",
    name: "Rustam Xoliqov",
    email: "rustam.xoliqov@bdtu.uz",
    avatar: "RX",
    overallScore: 66,
    level: "L3",
    confidence: 68,
    evidenceCount: 9,
    status: "Faol rivojlanmoqda",
    topSkills: [
      { name: "DevOps va CI/CD", score: 68 },
      { name: "Linux Administration", score: 72 },
      { name: "SQL va ma’lumotlar bazasi", score: 64 },
    ],
    layers: { KNOW: 72, DO: 69, ADAPT: 52, DEFEND: 68, PROVE: 60 },
  },
];

interface TeacherPortalProps {
  activeTab?: "heatmap" | "queue" | "remedial" | "viva";
  onTabChange?: (tab: "heatmap" | "queue" | "remedial" | "viva") => void;
}

export default function TeacherPortal({
  activeTab = "heatmap",
  onTabChange,
}: TeacherPortalProps) {
  // Local or controlled tab state
  const [currentTab, setCurrentTab] = useState<"heatmap" | "queue" | "remedial" | "viva">(activeTab);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  const setTab = (tab: "heatmap" | "queue" | "remedial" | "viva") => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // State for PROVE Queue
  const [proveQueue, setProveQueue] = useState<ProveRow[]>(teacherGroupData.proveQueue);
  const [proveScore, setProveScore] = useState<number>(80);
  const [proveBusy, setProveBusy] = useState(false);

  // ---------------- Live backend data ----------------
  const [dataMode, setDataMode] = useState<"loading" | "live" | "demo">(hasSession() ? "loading" : "demo");
  const isLive = dataMode === "live";
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [liveGaps, setLiveGaps] = useState<LiveGroupGaps | null>(null);
  const [remedialSkillId, setRemedialSkillId] = useState<string>("");
  const [lastRemedial, setLastRemedial] = useState<{ target_students: number; template: string; status: string } | null>(null);

  const mapProve = (rows: LiveProveItem[]): ProveRow[] =>
    rows.map((r) => ({
      id: r.id,
      studentName: r.student?.name || "—",
      studentAvatar: initialsOf(r.student?.name || ""),
      skillName: r.skill || "—",
      title: r.title || "—",
      submittedAt: r.submitted_at ? formatDate(r.submitted_at) : "—",
      links: r.source_ref,
      live: true,
    }));

  const fallbackToDemo = () => {
    setDataMode("demo");
    setLiveGroups([]);
    setLiveGaps(null);
    setSelectedGroupId(null);
    setProveQueue(teacherGroupData.proveQueue);
    setRemedialTasks(teacherGroupData.remedialTasks);
  };

  // Initial load: groups -> gaps for first group, plus the PROVE queue.
  // Any failure (401/403/network) keeps the portal on demo data.
  useEffect(() => {
    if (!hasSession()) {
      setDataMode("demo");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [groups, queue] = await Promise.all([api.getTeacherGroups(), api.getProveQueue()]);
        const list: LiveGroup[] = Array.isArray(groups) ? groups : [];
        const first = list[0]?.group_id ?? null;
        const gaps: LiveGroupGaps | null = first ? await api.getGroupGaps(first) : null;
        if (cancelled) return;
        setLiveGroups(list);
        setSelectedGroupId(first);
        setLiveGaps(gaps);
        setProveQueue(mapProve(Array.isArray(queue) ? queue : []));
        setRemedialTasks([]);
        setDataMode("live");
      } catch {
        if (!cancelled) fallbackToDemo();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGroup = async (groupId: string) => {
    setSelectedGroupId(groupId);
    try {
      const gaps: LiveGroupGaps = await api.getGroupGaps(groupId);
      setLiveGaps(gaps);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Guruh ma’lumotlarini yuklab bo‘lmadi");
    }
  };

  const refreshProveQueue = async () => {
    try {
      const queue = await api.getProveQueue();
      setProveQueue(mapProve(Array.isArray(queue) ? queue : []));
    } catch {
      /* keep current list */
    }
  };
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [inspectedProveItem, setInspectedProveItem] = useState<ProveRow | null>(null);
  const [proveSearch, setProveSearch] = useState<string>("");
  const [proveTypeFilter, setProveTypeFilter] = useState<string>("all");
  const [teacherReviewNote, setTeacherReviewNote] = useState<string>("");

  // State for Radar and Layer Selection
  const [selectedLayerKey, setSelectedLayerKey] = useState<"KNOW" | "DO" | "ADAPT" | "DEFEND" | "PROVE">("DO");

  // State for Student Matrix
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixFilter, setMatrixFilter] = useState("Barchasi");
  const [inspectedStudent, setInspectedStudent] = useState<MatrixRow | null>(null);

  // State for Remedial Challenge Generator
  const [remedialTasks, setRemedialTasks] = useState<RemedialTaskRow[]>(teacherGroupData.remedialTasks);
  const [remedialModalOpen, setRemedialModalOpen] = useState(false);
  const [remedialSkill, setRemedialSkill] = useState("DevOps va CI/CD");
  const [remedialDifficulty, setRemedialDifficulty] = useState("L3");
  const [remedialAiMode, setRemedialAiMode] = useState("AI-assisted");
  const [generating, setGenerating] = useState(false);
  const [generatedSuccess, setGeneratedSuccess] = useState(false);
  const [generationStep, setGenerationStep] = useState(1);

  // State for AI Viva Results
  const [vivaResults, setVivaResults] = useState<any[]>(teacherGroupData.vivaResults);
  const [vivaSource, setVivaSource] = useState<"loading" | "live" | "demo">("demo");
  const [vivaSearch, setVivaSearch] = useState("");
  const [vivaFilter, setVivaFilter] = useState("all");
  const [inspectedViva, setInspectedViva] = useState<any | null>(null);
  const [playingVivaAudio, setPlayingVivaAudio] = useState(false);
  const [vivaAudioProgress, setVivaAudioProgress] = useState(30);

  // Floating Toast Alert
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Smooth entrance animation counter
  const [ease, setEase] = useState(0);
  useEffect(() => {
    let animId: number;
    let start: number | null = null;
    const duration = 1000;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const easeVal = 1 - Math.pow(1 - progress, 3);
      setEase(easeVal);
      if (progress < 1) animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ---------------- Derived values (live or demo) ----------------
  const liveSkills = useMemo(() => liveGaps?.skills ?? [], [liveGaps]);

  const liveLayerStats = useMemo(() => {
    const out = {} as Record<LayerKey, { score: number | null; skills: number }>;
    for (const key of LAYER_KEYS) {
      let sum = 0;
      let weight = 0;
      let skills = 0;
      for (const s of liveSkills) {
        const v = s.layers?.[key];
        if (v === null || v === undefined) continue;
        const w = Math.max(1, s.students_scored);
        sum += v * w;
        weight += w;
        skills += 1;
      }
      out[key] = { score: weight ? Math.round(sum / weight) : null, skills };
    }
    return out;
  }, [liveSkills]);

  const liveOverall = useMemo(() => {
    let sum = 0;
    let weight = 0;
    for (const s of liveSkills) {
      const w = Math.max(1, s.students_scored);
      sum += s.avg_score * w;
      weight += w;
    }
    return weight ? Math.round(sum / weight) : null;
  }, [liveSkills]);

  const layerScoreOf = (key: LayerKey): number | null =>
    isLive ? liveLayerStats[key].score : groupLayers.find((l) => l.key === key)?.score ?? null;
  const overallScore: number | null = isLive ? liveOverall : teacherGroupData.avgScore;
  const totalStudents = isLive ? liveGaps?.students_total ?? 0 : teacherGroupData.totalStudents;
  const groupLabel = isLive ? selectedGroupId ?? "—" : teacherGroupData.groupCode;

  const weakSkillsSorted = useMemo(
    () => [...liveSkills].sort((a, b) => b.gap_pct - a.gap_pct || a.avg_score - b.avg_score),
    [liveSkills]
  );
  const weakestSkill = weakSkillsSorted[0] ?? null;

  // Keep the live remedial skill selection valid for the current group
  useEffect(() => {
    if (!isLive) return;
    if (!liveSkills.some((s) => s.skill.id === remedialSkillId)) {
      setRemedialSkillId(weakSkillsSorted[0]?.skill.id ?? "");
    }
  }, [isLive, liveSkills, weakSkillsSorted, remedialSkillId]);

  const heatmapRows = isLive
    ? liveSkills.map((s) => ({
        skill: s.skill.name,
        skillId: s.skill.id,
        avgScore: s.avg_score,
        gapPct: s.gap_pct,
        status: heatmapStatus(s.avg_score),
      }))
    : teacherGroupData.skillHeatmap.map((h) => ({ ...h, skillId: "" }));

  const matrixRows: MatrixRow[] = useMemo(() => {
    if (isLive) {
      return (liveGaps?.students ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        avatar: initialsOf(s.name),
        overallScore: s.skills_scored > 0 ? s.score : null,
        level: s.level,
        confidence: null,
        evidenceCount: null,
        skillsScored: s.skills_scored,
        status: liveStudentStatus(s.score, s.skills_scored),
        layers: null,
      }));
    }
    return initialStudents.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      avatar: s.avatar,
      overallScore: s.overallScore,
      level: s.level,
      confidence: s.confidence,
      evidenceCount: s.evidenceCount,
      skillsScored: null,
      status: s.status,
      layers: s.layers,
    }));
  }, [isLive, liveGaps]);

  const remedialPackages = isLive
    ? weakSkillsSorted.slice(0, 3).map((s) => ({
        skill: s.skill.name,
        skillId: s.skill.id,
        title: `${s.skill.name} bo‘yicha ${s.below_70} nafar talabaga`,
        desc: `O‘rtacha ball: ${s.avg_score} · Bo‘shliq: ${s.gap_pct}% · Baholangan: ${s.students_scored} nafar talaba.`,
      }))
    : DEMO_PACKAGES;

  const openRemedialFor = (skillName: string, skillId: string) => {
    setRemedialSkill(skillName);
    if (skillId) setRemedialSkillId(skillId);
    setRemedialModalOpen(true);
    setGeneratedSuccess(false);
  };

  // Radar Polygon Points Calculation
  const radarPoints = useMemo(() => {
    const calcPoint = (targetX: number, targetY: number, score: number | null) => {
      const frac = ((score ?? 0) / 100) * ease;
      const x = Math.round(150 + frac * (targetX - 150));
      const y = Math.round(132 + frac * (targetY - 132));
      return `${x},${y}`;
    };

    const pKnow = calcPoint(150, 29, layerScoreOf("KNOW"));
    const pDo = calcPoint(260, 109, layerScoreOf("DO"));
    const pAdapt = calcPoint(218, 238, layerScoreOf("ADAPT"));
    const pDefend = calcPoint(82, 238, layerScoreOf("DEFEND"));
    const pProve = calcPoint(40, 109, layerScoreOf("PROVE"));

    return {
      polygon: `${pKnow} ${pDo} ${pAdapt} ${pDefend} ${pProve}`,
      pKnow,
      pDo,
      pAdapt,
      pDefend,
      pProve,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, isLive, liveLayerStats]);

  // Selected layer metric
  const selectedLayer = groupLayers.find((l) => l.key === selectedLayerKey) || groupLayers[1];
  const selectedLayerScore = layerScoreOf(selectedLayer.key);
  const selectedLayerDesc = isLive
    ? selectedLayerScore === null
      ? "Bu qatlam bo‘yicha guruhda hali baholar yo‘q."
      : `Guruh bo‘yicha o‘rtacha ${selectedLayerScore} ball — ${liveLayerStats[selectedLayer.key].skills} ta ko‘nikma ma’lumotlari asosida.`
    : selectedLayer.desc;

  // Filtered Students in Matrix
  const filteredStudents = useMemo(() => {
    return matrixRows.filter((st) => {
      const matchSearch =
        st.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        st.email.toLowerCase().includes(matrixSearch.toLowerCase());
      if (!matchSearch) return false;

      if (matrixFilter === "Barchasi") return true;
      if (matrixFilter === "L4") return st.level === "L4";
      if (matrixFilter === "L3") return st.level === "L3";
      if (matrixFilter === "L2") return st.level === "L2";
      if (matrixFilter === "Bo‘shliqdagilar") return st.status.includes("Bo‘shliq") || st.status.includes("Remedial");
      return true;
    });
  }, [matrixRows, matrixSearch, matrixFilter]);

  // Filtered PROVE Queue
  const filteredProveQueue = useMemo(() => {
    return proveQueue.filter((item) => {
      const matchSearch =
        proveSearch.trim() === "" ||
        item.studentName.toLowerCase().includes(proveSearch.toLowerCase()) ||
        item.skillName.toLowerCase().includes(proveSearch.toLowerCase()) ||
        item.title.toLowerCase().includes(proveSearch.toLowerCase());

      const matchType =
        isLive || proveTypeFilter === "all" || item.type === proveTypeFilter;

      return matchSearch && matchType;
    });
  }, [proveQueue, proveSearch, proveTypeFilter, isLive]);

  // Live AI Viva results for the selected group (GET /teacher/viva-results)
  useEffect(() => {
    if (!isLive) {
      setVivaSource("demo");
      setVivaResults(teacherGroupData.vivaResults);
      return;
    }
    let cancelled = false;
    setVivaSource("loading");
    api
      .getVivaResults(selectedGroupId ?? undefined)
      .then((rows) => {
        if (cancelled) return;
        setVivaResults(rows.map((r) => liveVivaRow(r, selectedGroupId)));
        setVivaSource("live");
      })
      .catch(() => {
        if (cancelled) return;
        setVivaResults(teacherGroupData.vivaResults);
        setVivaSource("demo");
      });
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedGroupId]);

  const openViva = async (v: any) => {
    setInspectedViva(v);
    setPlayingVivaAudio(false);
    if (!v.live || v.dialogue) return;
    try {
      const t = await api.getVivaTranscript(v.sessionId);
      const dialogue = t.turns.map((turn: any) => ({
        speaker: turn.role === "examiner" ? "AI Examiner" : `Talaba (${v.studentName.split(" ")[0]})`,
        text: turn.content,
      }));
      setInspectedViva((cur: any) => (cur && cur.id === v.id ? { ...cur, dialogue } : cur));
      setVivaResults((rows) => rows.map((row) => (row.id === v.id ? { ...row, dialogue } : row)));
    } catch {
      setInspectedViva((cur: any) => (cur && cur.id === v.id ? { ...cur, dialogue: [], transcriptError: true } : cur));
    }
  };

  // Filtered Viva Results
  const filteredVivaResults = useMemo(() => {
    return vivaResults.filter((item) => {
      const matchSearch =
        vivaSearch.trim() === "" ||
        item.studentName.toLowerCase().includes(vivaSearch.toLowerCase()) ||
        item.taskTitle.toLowerCase().includes(vivaSearch.toLowerCase());

      const matchStatus =
        vivaFilter === "all" || item.status === vivaFilter;

      return matchSearch && matchStatus;
    });
  }, [vivaResults, vivaSearch, vivaFilter]);

  // Handle Prove Approval
  const handleApproveProve = async (id: string, studentName: string, skill: string) => {
    if (isLive) {
      setProveBusy(true);
      try {
        const res = await api.verifyEvidence(id, true, proveScore, teacherReviewNote || undefined);
        setConfirmedId(id);
        setInspectedProveItem(null);
        setTeacherReviewNote("");
        const lvl = res?.skill?.level ? ` Yangi daraja: ${res.skill.level}.` : "";
        showToast(`${studentName}ning ${skill} bo‘yicha dalili tasdiqlandi.${lvl}`);
        await refreshProveQueue();
        if (selectedGroupId) void loadGroup(selectedGroupId);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Tasdiqlashda xatolik yuz berdi");
      } finally {
        setConfirmedId(null);
        setProveBusy(false);
      }
      return;
    }
    setConfirmedId(id);
    setTimeout(() => {
      setProveQueue((prev) => prev.filter((item) => item.id !== id));
      setConfirmedId(null);
      setInspectedProveItem(null);
      showToast(`${studentName}ning ${skill} bo‘yicha L4 sertifikati tasdiqlandi!`);
    }, 400);
  };

  // Handle Prove Rejection
  const handleRejectProve = async (id: string, studentName: string) => {
    if (isLive) {
      setProveBusy(true);
      try {
        await api.verifyEvidence(id, false, 0, teacherReviewNote || undefined);
        setInspectedProveItem(null);
        setTeacherReviewNote("");
        showToast(`${studentName}ning dalili rad etildi va qayta ishlashga qaytarildi.`);
        await refreshProveQueue();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Rad etishda xatolik yuz berdi");
      } finally {
        setProveBusy(false);
      }
      return;
    }
    setProveQueue((prev) => prev.filter((item) => item.id !== id));
    setInspectedProveItem(null);
    showToast(`${studentName}ga qayta ishlash uchun izoh yuborildi.`);
  };

  // Handle AI Remedial Generation Simulation
  const handleGenerateRemedial = async () => {
    if (isLive) {
      const skill = liveSkills.find((s) => s.skill.id === remedialSkillId);
      if (!skill) {
        showToast("Avval ko‘nikmani tanlang");
        return;
      }
      setGenerating(true);
      setGeneratedSuccess(false);
      setGenerationStep(1);
      const t1 = setTimeout(() => setGenerationStep(2), 500);
      const t2 = setTimeout(() => setGenerationStep(3), 1000);
      try {
        const res = await api.createRemedial(skill.skill.id, selectedGroupId ?? undefined);
        setLastRemedial({ target_students: res.target_students, template: res.template, status: res.status });
        setRemedialTasks((prev) => [
          {
            id: res.task_id,
            skill: skill.skill.name,
            title: `Remedial challenge: ${skill.skill.name}`,
            assignedStudentsCount: res.target_students,
            difficulty: "L3",
            aiMode: "AI-free",
            progress: res.status === "draft" ? "Qoralama · tasdiq kutilmoqda" : res.status,
            status: res.status,
            scoreBoost: "—",
            deadline: "—",
          },
          ...prev,
        ]);
        setGeneratedSuccess(true);
        showToast(`${skill.skill.name} bo‘yicha remedial topshiriq qoralamasi yaratildi (${res.target_students} nafar talaba).`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Topshiriq yaratishda xatolik yuz berdi");
      } finally {
        clearTimeout(t1);
        clearTimeout(t2);
        setGenerating(false);
      }
      return;
    }
    setGenerating(true);
    setGenerationStep(1);

    setTimeout(() => {
      setGenerationStep(2);
    }, 900);

    setTimeout(() => {
      setGenerationStep(3);
    }, 1800);

    setTimeout(() => {
      setGenerating(false);
      setGeneratedSuccess(true);
      // Append new task
      const newTask = {
        id: `rem-${Date.now()}`,
        skill: remedialSkill,
        title: `${remedialSkill} bo‘yicha individual parametrik chellinj`,
        assignedStudentsCount: 12,
        difficulty: remedialDifficulty,
        aiMode: remedialAiMode,
        progress: "0 / 12 bajarildi",
        status: "Faol",
        scoreBoost: "+14 ball",
        deadline: "14-aprel, 2026",
      };
      setRemedialTasks((prev) => [newTask, ...prev]);
      showToast(`${remedialSkill} bo‘yicha 12 ta parametrli topshiriq e’lon qilindi!`);
    }, 2600);
  };

  return (
    <div className="page">
      {/* Top Welcome Row */}
      <section className="welcome-row">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ margin: 0 }}>AKADEMIK NAZORAT · O‘QITUVCHI BOSHQARUV PANELI</p>
            <DataSourceBadge mode={dataMode} />
          </div>
          <h1>Guruh kompetensiya tahlili & AI Monitoring</h1>
          {isLive ? (
            <p className="subtitle">
              Guruh:{" "}
              {liveGroups.length > 1 ? (
                <select
                  value={selectedGroupId ?? ""}
                  onChange={(e) => void loadGroup(e.target.value)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--navy)",
                    background: "#ffffff",
                  }}
                >
                  {liveGroups.map((g) => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.group_id} ({g.students})
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{groupLabel}</strong>
              )}{" "}
              ({totalStudents} nafar talaba)
            </p>
          ) : (
            <p className="subtitle">
              Guruh: <strong>{teacherGroupData.groupCode}</strong> · Yo‘nalish: <strong>{teacherGroupData.directionName}</strong> (28 nafar talaba) · <strong>BSTU</strong>
            </p>
          )}
        </div>
        <div className="top-actions">
          <button
            className="primary-button"
            onClick={() => {
              setTab("remedial");
              setRemedialModalOpen(true);
              setGeneratedSuccess(false);
            }}
          >
            <Icon name="code" size={17} /> Remedial topshiriq generatsiyasi
          </button>
        </div>
      </section>

      {/* Overview Stat Cards with ease-in counting */}
      <section className="employer-stats-row">
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
            <Icon name="users" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Jami talabalar
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>{Math.round(totalStudents * ease)} nafar</strong>
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
            <Icon name="award" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              O‘rtacha Skill Score
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>
              {overallScore === null ? "—" : `${Math.round(overallScore * ease)} / 100`}
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
            <Icon name="check" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Tasdiqlash navbati (PROVE)
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>{proveQueue.length} ta so‘rov</strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "var(--violet-soft)",
              color: "var(--violet)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="file" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              AI Viva natijalari
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>
              {isLive && vivaSource !== "live" ? "—" : `${vivaResults.length} ta himoya`}
            </strong>
          </div>
        </div>
      </section>

      {/* Navigation Filter Tabs (4 modules) */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: "1.5px solid var(--border)",
          paddingBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("heatmap")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: currentTab === "heatmap" ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
            background: currentTab === "heatmap" ? "var(--navy)" : "#ffffff",
            color: currentTab === "heatmap" ? "#ffffff" : "var(--navy)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: currentTab === "heatmap" ? "0 4px 12px rgba(9, 9, 11, 0.12)" : "none",
          }}
        >
          <Icon name="chart" size={16} />
          <span>Guruh Skill Heatmap</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("queue")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: currentTab === "queue" ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
            background: currentTab === "queue" ? "var(--navy)" : "#ffffff",
            color: currentTab === "queue" ? "#ffffff" : "var(--navy)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: currentTab === "queue" ? "0 4px 12px rgba(9, 9, 11, 0.12)" : "none",
          }}
        >
          <Icon name="check" size={16} />
          <span>PROVE Tasdiqlash navbati</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "queue" ? "rgba(255,255,255,0.2)" : "var(--warning-soft)",
              color: currentTab === "queue" ? "#ffffff" : "var(--warning)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {proveQueue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("remedial")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: currentTab === "remedial" ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
            background: currentTab === "remedial" ? "var(--navy)" : "#ffffff",
            color: currentTab === "remedial" ? "#ffffff" : "var(--navy)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: currentTab === "remedial" ? "0 4px 12px rgba(9, 9, 11, 0.12)" : "none",
          }}
        >
          <Icon name="code" size={16} />
          <span>Remedial Generator</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "remedial" ? "rgba(255,255,255,0.2)" : "var(--accent-soft)",
              color: currentTab === "remedial" ? "#ffffff" : "var(--accent)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {remedialTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("viva")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: currentTab === "viva" ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
            background: currentTab === "viva" ? "var(--navy)" : "#ffffff",
            color: currentTab === "viva" ? "#ffffff" : "var(--navy)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: currentTab === "viva" ? "0 4px 12px rgba(9, 9, 11, 0.12)" : "none",
          }}
        >
          <Icon name="file" size={16} />
          <span>AI Viva natijalari</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "viva" ? "rgba(255,255,255,0.2)" : "var(--success-soft)",
              color: currentTab === "viva" ? "#ffffff" : "var(--success)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {vivaResults.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: GURUH SKILL HEATMAP & MATRITSA
         ========================================================================= */}
      {currentTab === "heatmap" && (
        <>
          {/* Hero Split Section: Group 5-Layer Radar + AI Remedial Recommendation Card */}
          <section className="summary-grid" style={{ marginBottom: "24px" }}>
            {/* Left: Group Competency Radar Card */}
            <article className="card dna-card">
              <div className="card-heading">
                <div>
                  <p className="card-kicker">GURUH MALAKA RADARI</p>
                  <h2>5 qatlamli o‘rtacha guruh profili</h2>
                </div>
                {isLive ? (
                  <span className="level-badge">Guruh: {groupLabel}</span>
                ) : (
                  <span className="level-badge">Bozorga moslik: {Math.round(74 * ease)}%</span>
                )}
              </div>

              <div className="dna-body">
                <div className="chart-shell">
                  <svg viewBox="0 0 300 265" className="radar" aria-label="Guruh ko‘nikma diagrammasi">
                    <g className="radar-grid">
                      <polygon points="150,29 260,109 218,238 82,238 40,109" />
                      <polygon points="150,61 226,116 197,205 103,205 74,116" />
                      <polygon points="150,93 192,123 176,173 124,173 108,123" />
                      <line x1="150" y1="132" x2="150" y2="29" />
                      <line x1="150" y1="132" x2="260" y2="109" />
                      <line x1="150" y1="132" x2="218" y2="238" />
                      <line x1="150" y1="132" x2="82" y2="238" />
                      <line x1="150" y1="132" x2="40" y2="109" />
                    </g>
                    <polygon
                      className="radar-area"
                      points={radarPoints.polygon}
                      style={{ opacity: ease > 0.05 ? 1 : 0 }}
                    />
                    <g
                      className="radar-points"
                      style={{ opacity: ease > 0.1 ? 1 : 0, transition: "opacity 0.2s ease" }}
                    >
                      <circle cx={radarPoints.pKnow.split(",")[0]} cy={radarPoints.pKnow.split(",")[1]} r={selectedLayerKey === "KNOW" ? "7" : "4"} />
                      <circle cx={radarPoints.pDo.split(",")[0]} cy={radarPoints.pDo.split(",")[1]} r={selectedLayerKey === "DO" ? "7" : "4"} />
                      <circle cx={radarPoints.pAdapt.split(",")[0]} cy={radarPoints.pAdapt.split(",")[1]} r={selectedLayerKey === "ADAPT" ? "7" : "4"} />
                      <circle cx={radarPoints.pDefend.split(",")[0]} cy={radarPoints.pDefend.split(",")[1]} r={selectedLayerKey === "DEFEND" ? "7" : "4"} />
                      <circle cx={radarPoints.pProve.split(",")[0]} cy={radarPoints.pProve.split(",")[1]} r={selectedLayerKey === "PROVE" ? "7" : "4"} />
                    </g>
                    <g className="radar-labels">
                      <text x="150" y="14" textAnchor="middle" style={{ cursor: "pointer" }} onClick={() => setSelectedLayerKey("KNOW")}>
                        KNOW
                      </text>
                      <text x="277" y="106" textAnchor="middle" style={{ cursor: "pointer" }} onClick={() => setSelectedLayerKey("DO")}>
                        DO
                      </text>
                      <text x="224" y="257" textAnchor="middle" style={{ cursor: "pointer" }} onClick={() => setSelectedLayerKey("ADAPT")}>
                        ADAPT
                      </text>
                      <text x="72" y="257" textAnchor="middle" style={{ cursor: "pointer" }} onClick={() => setSelectedLayerKey("DEFEND")}>
                        DEFEND
                      </text>
                      <text x="20" y="106" textAnchor="middle" style={{ cursor: "pointer" }} onClick={() => setSelectedLayerKey("PROVE")}>
                        PROVE
                      </text>
                    </g>
                  </svg>
                  <div className="chart-score">
                    <strong>{overallScore === null ? "—" : Math.round(overallScore * ease)}</strong>
                    <span>/100</span>
                    <small>Guruh bali</small>
                  </div>
                </div>

                <div className="score-summary">
                  {isLive ? (
                    <p>
                      {totalStudents} nafar talaba · {liveSkills.length} ta ko‘nikma bo‘yicha baholar asosida
                      {liveSkills.length === 0 ? " — guruhda hali baholangan ko‘nikmalar yo‘q." : ""}
                    </p>
                  ) : (
                    <>
                      <div className="confidence-head">
                        <span>Guruh ishonch darajasi</span>
                        <strong>{Math.round(71 * ease)}%</strong>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${(71 * ease).toFixed(1)}%` }} />
                      </div>
                      <p>Yuqori ishonchlilik · 28 ta talabaning 142 ta tekshirilgan dalillari asosida</p>
                    </>
                  )}

                  {/* Selected Layer Details */}
                  <div className="selected-layer">
                    <div className={`layer-icon ${selectedLayer.tone}`}>
                      <Icon name={selectedLayer.icon} />
                    </div>
                    <div>
                      <span>Tanlangan qatlam tahlili</span>
                      <strong>
                        {selectedLayer.key} · {selectedLayer.label} ({selectedLayerScore === null ? "—" : selectedLayerScore} ball)
                      </strong>
                    </div>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    {selectedLayerDesc}
                  </p>
                </div>
              </div>
            </article>

            {/* Right: AI Remedial Highlight Card */}
            <article className="card task-highlight">
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <p className="task-type">REMEDIAL CHELLINJ · AVTOMATIK TAVSIYA</p>
                {(!isLive || weakestSkill) && (
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      background: "var(--success-400)",
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    {isLive && weakestSkill ? `${weakestSkill.below_70} talaba` : "12 talaba"}
                  </span>
                )}
              </div>

              {isLive ? (
                weakestSkill ? (
                  <>
                    <h2>
                      {weakestSkill.skill.name} bo‘yicha {weakestSkill.gap_pct}% bo‘shliq aniqlandi
                    </h2>
                    <p>
                      Guruhda ushbu ko‘nikma bo‘yicha baholangan {weakestSkill.students_scored} nafar talabadan {weakestSkill.below_70} nafari 70 balldan past natija ko‘rsatgan.
                    </p>
                    <div className="task-meta">
                      <span>
                        <Icon name="users" size={16} /> {weakestSkill.students_scored} nafar baholangan
                      </span>
                      <span>
                        <Icon name="award" size={16} /> O‘rtacha {weakestSkill.avg_score} ball
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>Bo‘shliqlar hali aniqlanmagan</h2>
                    <p>Ushbu guruhda baholangan ko‘nikmalar yo‘q — talabalar topshiriq bajargach tavsiyalar shu yerda paydo bo‘ladi.</p>
                  </>
                )
              ) : (
                <>
                  <h2>DevOps & CI/CD bo‘yicha 46% bo‘shliq aniqlandi</h2>
                  <p>
                    Guruhning 12 nafar talabasida Docker va avtomatlashtirishda yetishmovchilik mavjud. Sun’iy intellekt individual parametrli kod topshiriqlari paketini tayyorladi.
                  </p>

                  <div className="task-meta">
                    <span>
                      <Icon name="file" size={16} /> 12 ta unikal variant
                    </span>
                    <span>
                      <Icon name="award" size={16} /> +14 ballgacha o‘sish
                    </span>
                  </div>
                </>
              )}

              <button
                className="dark-button"
                onClick={() => {
                  setTab("remedial");
                  if (isLive && weakestSkill) openRemedialFor(weakestSkill.skill.name, weakestSkill.skill.id);
                  else if (!isLive) openRemedialFor("DevOps va CI/CD", "");
                }}
              >
                Remedial generatoriga o‘tish <Icon name="arrow" size={17} />
              </button>
            </article>
          </section>

          {/* 5-Layer Group Competency Grid (Interactive Cards) */}
          <section className="layers-section" style={{ marginBottom: "28px" }}>
            <div className="section-heading">
              <div>
                <h2>5 qatlamli kompetensiya modeli (Guruh natijasi)</h2>
                <p>Har bir qatlam bo‘yicha guruhning o‘zlashtirishi va vazn ko‘rsatkichi.</p>
              </div>
              {isLive ? (
                <span>
                  Guruh bali <strong>{overallScore === null ? "—" : Math.round(overallScore * ease)}</strong>
                </span>
              ) : (
                <span>
                  Umumiy tayyorlik <strong>{Math.round(74 * ease)}%</strong>
                </span>
              )}
            </div>

            <div className="layer-grid">
              {groupLayers.map((layer) => {
                const score = layerScoreOf(layer.key);
                return (
                <div
                  key={layer.key}
                  className={`layer-card ${selectedLayerKey === layer.key ? "selected" : ""}`}
                  onClick={() => setSelectedLayerKey(layer.key)}
                >
                  <div className={`layer-icon ${layer.tone}`}>
                    <Icon name={layer.icon} />
                  </div>
                  <div className="layer-name">
                    <strong>{layer.key} · {layer.label}</strong>
                    <span>{layer.weight} vazn</span>
                  </div>
                  <div className="layer-score">
                    <strong>{score === null ? "—" : Math.round(score * ease)}</strong>
                    <span>/ 100</span>
                  </div>
                  <div className="mini-track">
                    <span style={{ width: `${((score ?? 0) * ease).toFixed(1)}%` }} />
                  </div>
                </div>
                );
              })}
            </div>
          </section>

          {/* Skill Heatmap Card */}
          <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
            <div className="card-heading" style={{ marginBottom: "18px" }}>
              <div>
                <p className="card-kicker">KOMPETENSIYA VA BO‘SHLIQLAR XARITASI</p>
                <h2>Fan va ko‘nikmalar bo‘yicha guruh holati</h2>
              </div>
              <span className="level-badge">{isLive ? `Guruh: ${groupLabel}` : "2026-yil Bahor semestri"}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {isLive && heatmapRows.length === 0 && (
                <div style={{ padding: "18px", textAlign: "center", fontSize: "13px", color: "var(--muted)" }}>
                  Bu guruhda hali baholangan ko‘nikmalar yo‘q.
                </div>
              )}
              {heatmapRows.map((item) => (
                <div
                  key={item.skill}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr 90px 140px auto",
                    alignItems: "center",
                    gap: "20px",
                    padding: "16px 20px",
                    borderRadius: "10px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: "15px", color: "var(--navy)" }}>
                      {item.skill}
                    </strong>
                    <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                      Bo‘shliq: {item.gapPct}%
                    </span>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", color: "var(--muted)" }}>Guruh o‘zlashtirishi</span>
                      <strong style={{ fontSize: "13.5px", color: "var(--navy)" }}>{Math.round(item.avgScore * ease)}%</strong>
                    </div>
                    <div className="progress-track" style={{ height: "8px", margin: 0 }}>
                      <div
                        style={{
                          width: `${(item.avgScore * ease).toFixed(1)}%`,
                          height: "100%",
                          borderRadius: "10px",
                          background:
                            item.avgScore >= 75
                              ? "linear-gradient(90deg, var(--success), var(--success-400))"
                              : item.avgScore >= 65
                              ? "linear-gradient(90deg, var(--accent-400), var(--accent-300))"
                              : "linear-gradient(90deg, var(--warning-400), var(--danger-400))",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: "20px", color: "var(--navy)" }}>
                      {Math.round(item.avgScore * ease)}
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}> / 100</span>
                  </div>

                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "5px 12px",
                        borderRadius: "20px",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        background:
                          item.status === "Yaxshi"
                            ? "var(--success-soft)"
                            : item.status.includes("O‘rtacha")
                            ? "var(--accent-soft)"
                            : "var(--danger-soft)",
                        color:
                          item.status === "Yaxshi"
                            ? "var(--success)"
                            : item.status.includes("O‘rtacha")
                            ? "var(--accent)"
                            : "var(--danger)",
                      }}
                    >
                      {item.status}
                    </span>
                  </div>

                  <button
                    className="ghost-button"
                    style={{ fontSize: "13px" }}
                    onClick={() => {
                      setTab("remedial");
                      setRemedialSkill(item.skill);
                      if (item.skillId) setRemedialSkillId(item.skillId);
                    }}
                  >
                    Topshiriq tuzish →
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Student Matrix Table */}
          <section className="card" style={{ padding: "26px" }}>
            <div className="card-heading" style={{ marginBottom: "18px" }}>
              <div>
                <p className="card-kicker">TALABALAR RO‘YXATI VA BAHOLARI</p>
                <h2>Guruh talabalari matritsasi ({filteredStudents.length})</h2>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Ism bo‘yicha qidirish..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                  }}
                />
                <select
                  value={matrixFilter}
                  onChange={(e) => setMatrixFilter(e.target.value)}
                  style={{
                    padding: "7px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                  }}
                >
                  <option value="Barchasi">Barchasi</option>
                  <option value="L4">L4 darajalilar</option>
                  <option value="L3">L3 darajalilar</option>
                  <option value="L2">L2 darajalilar</option>
                  <option value="Bo‘shliqdagilar">Bo‘shliqdagilar</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--muted)", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 10px" }}>Talaba</th>
                    <th style={{ padding: "12px 10px" }}>Daraja</th>
                    <th style={{ padding: "12px 10px" }}>Umumiy ball</th>
                    <th style={{ padding: "12px 10px" }}>KNOW / DO / ADAPT / DEFEND / PROVE</th>
                    <th style={{ padding: "12px 10px" }}>Holat</th>
                    <th style={{ padding: "12px 10px", textAlign: "right" }}>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: "18px 10px", textAlign: "center", fontSize: "13px", color: "var(--muted)" }}>
                        Talabalar topilmadi.
                      </td>
                    </tr>
                  )}
                  {filteredStudents.map((st) => (
                    <tr key={st.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                      <td style={{ padding: "14px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "var(--accent-soft)",
                              color: "var(--royal)",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 800,
                              fontSize: "13px",
                            }}
                          >
                            {st.avatar}
                          </div>
                          <div>
                            <strong style={{ fontSize: "14.5px", color: "var(--navy)" }}>{st.name}</strong>
                            <div style={{ fontSize: "12px", color: "var(--muted)" }}>{st.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: st.level === "L4" ? "var(--success-soft)" : "var(--accent-soft)",
                            color: st.level === "L4" ? "var(--success-fg)" : "var(--accent-hover)",
                            fontWeight: 800,
                            fontSize: "12px",
                          }}
                        >
                          {st.level}
                        </span>
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        <strong style={{ fontSize: "15px", color: "var(--navy)" }}>{st.overallScore ?? "—"}</strong>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>/100</span>
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        {st.layers ? (
                          <div style={{ display: "flex", gap: "6px", fontSize: "11.5px", fontWeight: 700 }}>
                            <span style={{ color: "var(--accent)" }}>K:{st.layers.KNOW}</span>
                            <span style={{ color: "var(--success)" }}>D:{st.layers.DO}</span>
                            <span style={{ color: "var(--violet)" }}>A:{st.layers.ADAPT}</span>
                            <span style={{ color: "var(--warning)" }}>DF:{st.layers.DEFEND}</span>
                            <span style={{ color: "var(--rose)" }}>P:{st.layers.PROVE}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 10px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background:
                              st.status === "Bozorga tayyor"
                                ? "var(--success-soft)"
                                : st.status.includes("Bo‘shliq")
                                ? "var(--warning-soft)"
                                : st.status.includes("Remedial")
                                ? "var(--danger-soft)"
                                : "var(--surface-3)",
                            color:
                              st.status === "Bozorga tayyor"
                                ? "var(--success)"
                                : st.status.includes("Bo‘shliq")
                                ? "var(--warning-fg)"
                                : st.status.includes("Remedial")
                                ? "var(--danger)"
                                : "var(--text-3)",
                          }}
                        >
                          {st.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 10px", textAlign: "right" }}>
                        <button
                          className="ghost-button"
                          style={{ padding: "6px 12px", fontSize: "12.5px" }}
                          onClick={() => setInspectedStudent(st)}
                        >
                          Profilni ko‘rish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* =========================================================================
          PAGE 1: PROVE TASDIQLASH NAVBATI
         ========================================================================= */}
      {currentTab === "queue" && (
        <>
          {/* Filter and Search Bar for PROVE Queue */}
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
                  PROVE MODULI · INSON SIKLI (HUMAN-IN-THE-LOOP)
                </p>
                <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                  Talabalarning real kod repozitoriylari, test qamrovi va portfoliolarini rasmiy tasdiqlash
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
                  placeholder="Talaba ismi, fan yoki repozitoriy..."
                  value={proveSearch}
                  onChange={(e) => setProveSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--border)",
                    fontSize: "13px",
                    outline: "none",
                    background: "var(--surface-2)",
                  }}
                />
              </div>
            </div>

            {/* Type Filter Chips (demo only — live evidence has no type field) */}
            {!isLive && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", minWidth: "90px" }}>
                DALIL TURI:
              </span>
              {[
                { key: "all", label: `Barchasi (${proveQueue.length})` },
                { key: "GitHub Repozitoriy", label: "💻 GitHub Repozitoriy" },
                { key: "Benchmarking Hisoboti", label: "📊 Benchmarking Hisoboti" },
                { key: "CI/CD Pipeline", label: "⚙️ CI/CD Pipeline" },
              ].map((tp) => (
                <button
                  key={tp.key}
                  type="button"
                  onClick={() => setProveTypeFilter(tp.key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: proveTypeFilter === tp.key ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
                    background: proveTypeFilter === tp.key ? "var(--navy)" : "#ffffff",
                    color: proveTypeFilter === tp.key ? "#ffffff" : "var(--navy)",
                    transition: "0.15s ease",
                  }}
                >
                  {tp.label}
                </button>
              ))}
            </div>
            )}
          </section>

          {/* Heading */}
          <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px" }}>
            <div>
              <h2>Tasdiqlanishi kutilayotgan dalillar ({filteredProveQueue.length})</h2>
              <p>Rasmiy Open Badges 3.0 L4 darajasini olish uchun talabalar tomonidan yuklangan amaliy dalillar</p>
            </div>
            {proveSearch && (
              <button
                type="button"
                onClick={() => setProveSearch("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--royal)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Filtrni tozalash
              </button>
            )}
          </div>

          {filteredProveQueue.length === 0 ? (
            <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--success-soft)", color: "var(--success)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <Icon name="checkCircle" size={28} />
              </div>
              <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: "17.5px" }}>
                Barcha dalillar tasdiqlangan!
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px" }}>
                Navbatda tekshirilishi kerak bo‘lgan yangi so‘rovlar mavjud emas.
              </p>
            </div>
          ) : (
            <div className={`candidates-grid ${filteredProveQueue.length === 1 ? "single-item" : ""}`}>
              {filteredProveQueue.map((item) => (
                <article
                  key={item.id}
                  className="candidate-card"
                  style={{
                    background: confirmedId === item.id ? "var(--success-soft)" : "white",
                    transition: "all 0.3s ease",
                  }}
                >
                  {/* Top info */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
                          color: "#ffffff",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 800,
                          fontSize: "15px",
                        }}
                      >
                        {item.studentAvatar || item.studentName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16.5px", color: "var(--navy)" }}>{item.studentName}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                          {!item.live && (
                            <>
                              <span style={{ fontSize: "12px", color: "var(--muted)" }}>{item.studentGroup || "DI-2023-4A"}</span>
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
                            {item.skillName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: "5px 11px",
                        borderRadius: "20px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        background: "var(--success-soft)",
                        color: "var(--success)",
                        border: "1px solid var(--success-ring)",
                      }}
                    >
                      Kutilmoqda (PROVE)
                    </span>
                  </div>

                  {/* Project details */}
                  <h4 style={{ margin: "0 0 6px", fontSize: "15.5px", color: "var(--navy)" }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: "0 0 14px", fontSize: "13px", color: "var(--text-3)", lineHeight: "1.5" }}>
                    {item.live
                      ? `Yuborilgan: ${item.submittedAt || "—"}`
                      : item.description || "Talaba tomonidan tayyorlangan amaliy loyiha va test qamrovi."}
                  </p>

                  {/* Automated Badges (demo only — not provided by the live queue) */}
                  {!item.live && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      marginBottom: "16px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ color: "var(--success)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Icon name="check" size={13} /> Testlar: {item.testsPassed || "95%"}
                    </span>
                    <span>•</span>
                    <span style={{ color: "var(--royal)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Icon name="code" size={13} /> {item.commitsCount || 20} commit
                    </span>
                    <span>•</span>
                    <span style={{ color: "var(--violet)" }}>
                      Plagiat: {item.plagiarismScore || "0%"}
                    </span>
                  </div>
                  )}

                  {/* Direct Link */}
                  {item.links ? (
                  <div style={{ marginBottom: "16px", fontSize: "13px" }}>
                    <a
                      href={/^https?:\/\//i.test(item.links) ? item.links : `https://${item.links}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "var(--royal)",
                        textDecoration: "underline",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Icon name="external" size={14} />
                      {item.links}
                    </a>
                  </div>
                  ) : (
                    <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--muted)" }}>Havola: —</div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="candidate-actions-row">
                    <button
                      type="button"
                      className="candidate-evidence-btn"
                      onClick={() => setInspectedProveItem(item)}
                    >
                      <Icon name="file" size={16} />
                      <span>Rubrika baholash</span>
                    </button>
                    <button
                      type="button"
                      className="candidate-invite-btn"
                      disabled={proveBusy}
                      onClick={() => {
                        // Live: approval needs a teacher-set score, so open the rubric modal first
                        if (item.live) setInspectedProveItem(item);
                        else void handleApproveProve(item.id, item.studentName, item.skillName);
                      }}
                    >
                      <Icon name="checkCircle" size={16} />
                      <span>{item.live ? "Baholash & tasdiqlash" : "Tasdiqlash & L4 berish"}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          PAGE 2: REMEDIAL CHALLENGE GENERATOR
         ========================================================================= */}
      {currentTab === "remedial" && (
        <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
          <div className="card-heading" style={{ marginBottom: "18px" }}>
            <div>
              <p className="card-kicker">ADAPTIV PEDAGOGIKA · AI CHALLENGE GENERATOR</p>
              <h2>Mustahkamlovchi (Remedial) topshiriqlar generatori</h2>
            </div>
            <span className="level-badge">AI Viva & Kod Sandbox</span>
          </div>

          <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "22px", maxWidth: "820px", lineHeight: "1.6" }}>
            Guruhda bo‘shliq aniqlangan ko‘nikmalar bo‘yicha har bir talabaga sun’iy intellekt orqali alohida parametrlar va unikal unit testlar bilan individual chellinjlar generatsiya qiling.
          </p>

          {/* Recommended AI Remedial Packages */}
          {isLive && remedialPackages.length === 0 && (
            <div style={{ padding: "18px", marginBottom: "28px", borderRadius: "14px", border: "1.5px dashed var(--border)", textAlign: "center", fontSize: "13px", color: "var(--muted)" }}>
              Bu guruhda hali baholangan ko‘nikmalar yo‘q — tavsiya etiladigan paketlar baholar paydo bo‘lgach shakllanadi.
            </div>
          )}
          {remedialPackages.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px", marginBottom: "28px" }}>
            {remedialPackages.map((pkg, idx) => {
              const primary = idx === 0;
              return (
                <div
                  key={pkg.skillId || pkg.skill}
                  style={{
                    padding: "22px",
                    borderRadius: "14px",
                    border: primary ? "1.5px solid var(--accent-ring)" : "1.5px solid var(--border)",
                    background: primary ? "linear-gradient(145deg, var(--accent-soft), var(--accent-soft))" : "var(--surface-2)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: primary ? "var(--accent-hover)" : "var(--text-3)", letterSpacing: "0.08em" }}>
                      TAVSIYA ETILGAN PAKET #{idx + 1}
                    </span>
                    <h3 style={{ fontSize: "17.5px", color: "var(--navy)", margin: "8px 0" }}>{pkg.title}</h3>
                    <p style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "16px", lineHeight: "1.5" }}>{pkg.desc}</p>
                  </div>
                  <button
                    type="button"
                    className={primary ? "primary-button" : "candidate-evidence-btn"}
                    style={{ width: "100%", fontSize: "13px" }}
                    onClick={() => openRemedialFor(pkg.skill, pkg.skillId)}
                  >
                    <Icon name="code" size={16} /> Ushbu paketni generatsiya qilish
                  </button>
                </div>
              );
            })}
          </div>
          )}

          {/* Active Remedial Tasks List */}
          <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
            <div>
              <h3>Faol Remedial topshiriqlari monitoringi</h3>
              <p>Talabalarga biriktirilgan individual mustahkamlovchi vazifalar holati</p>
            </div>
            <button
              type="button"
              className="primary-button"
              style={{ padding: "8px 16px", fontSize: "12.5px" }}
              onClick={() => {
                setRemedialModalOpen(true);
                setGeneratedSuccess(false);
              }}
            >
              <Icon name="plus" size={14} /> Yangi generatsiya
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {isLive && remedialTasks.length === 0 && (
              <div style={{ padding: "18px", borderRadius: "12px", border: "1px solid var(--border)", textAlign: "center", fontSize: "13px", color: "var(--muted)" }}>
                Bu sessiyada hali remedial topshiriq yaratilmagan.
              </div>
            )}
            {remedialTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "#ffffff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
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
                      {task.skill}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {task.difficulty} · {task.aiMode}
                    </span>
                  </div>
                  <strong style={{ fontSize: "15px", color: "var(--navy)" }}>{task.title}</strong>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                    Biriktirilgan: <strong>{task.assignedStudentsCount} nafar talaba</strong> · Muddat: {task.deadline}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11.5px", color: "var(--success)", fontWeight: 700 }}>
                      Kutilayotgan o‘sish: {task.scoreBoost}
                    </div>
                    <strong style={{ fontSize: "14px", color: "var(--navy)" }}>{task.progress}</strong>
                  </div>

                  {!isLive && (
                    <button
                      type="button"
                      className="candidate-evidence-btn"
                      style={{ padding: "8px 14px", fontSize: "12.5px" }}
                      onClick={() => showToast(`"${task.title}" bo‘yicha talabalar natijalari yangilandi!`)}
                    >
                      Natijalarni ko‘rish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          PAGE 3: AI VIVA NATIJALARI
         ========================================================================= */}
      {currentTab === "viva" && (
        <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
          <div className="card-heading" style={{ marginBottom: "18px" }}>
            <div>
              <p className="card-kicker">OG‘ZAKI HIMOYA VA AI EXAMINER NATIJALARI</p>
              <h2>Guruh talabalarining AI Viva natijalari ({filteredVivaResults.length})</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <DataSourceBadge mode={vivaSource} />
              <span className="level-badge">DEFEND Qatlami tekshiruvi</span>
            </div>
          </div>

          <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "20px", maxWidth: "800px" }}>
            Talabalarning yozgan kodini og‘zaki himoya qilish, algoritmik asoslash va savol-javoblar bo‘yicha AI Examiner audio transkriptlari va baholari.
          </p>

          {/* Search & Filter Bar */}
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
                placeholder="Talaba ismi yoki mavzu bo‘yicha..."
                value={vivaSearch}
                onChange={(e) => setVivaSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: "10px",
                  border: "1.5px solid var(--border)",
                  fontSize: "13px",
                  outline: "none",
                  background: "var(--surface-2)",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {[
                { key: "all", label: "Barchasi" },
                { key: "passed", label: "✅ O‘tganlar (Himoyalangan)" },
                { key: "flagged", label: "🚩 Shubhali (Bayroq qo‘yilgan)" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setVivaFilter(f.key)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: vivaFilter === f.key ? "1.5px solid var(--navy)" : "1.5px solid var(--border)",
                    background: vivaFilter === f.key ? "var(--navy)" : "#ffffff",
                    color: vivaFilter === f.key ? "#ffffff" : "var(--navy)",
                    transition: "0.15s ease",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Viva Results Cards */}
          <div className={`candidates-grid ${filteredVivaResults.length === 1 ? "single-item" : ""}`}>
            {filteredVivaResults.map((v) => {
              const isFlagged = v.status === "flagged";

              return (
                <article
                  key={v.id}
                  className="candidate-card"
                  style={{
                    borderLeft: isFlagged ? "4px solid var(--danger-400)" : "4px solid var(--success-400)",
                  }}
                >
                  {/* Top info */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: isFlagged
                            ? "linear-gradient(135deg, var(--danger-strong), var(--danger-fg))"
                            : "linear-gradient(135deg, var(--success-fg), var(--success))",
                          color: "#ffffff",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 800,
                          fontSize: "15px",
                        }}
                      >
                        {v.studentAvatar}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16.5px", color: "var(--navy)" }}>{v.studentName}</h3>
                        <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                          {v.studentGroup} · {v.date}{v.duration ? ` (${v.duration})` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 800,
                          background: isFlagged ? "var(--danger-soft)" : "var(--success-soft)",
                          color: isFlagged ? "var(--danger)" : "var(--success)",
                        }}
                      >
                        {v.vivaScore} ball{v.confidence != null ? ` (${v.confidence}% ishonch)` : ""}
                      </span>
                    </div>
                  </div>

                  <h4 style={{ margin: "0 0 8px", fontSize: "15px", color: "var(--navy)" }}>
                    {v.taskTitle}
                  </h4>

                  {/* Strengths & Weaknesses */}
                  <div style={{ marginBottom: "14px" }}>
                    {v.strengths.slice(0, 2).map((s: string, idx: number) => (
                      <div key={idx} style={{ fontSize: "12px", color: "var(--success-fg)", display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                        <span style={{ fontWeight: 800 }}>✓</span> {s}
                      </div>
                    ))}
                    {v.weaknesses.slice(0, 1).map((w: string, idx: number) => (
                      <div key={idx} style={{ fontSize: "12px", color: "var(--danger-fg)", display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ fontWeight: 800 }}>!</span> {w}
                      </div>
                    ))}
                  </div>

                  {/* Teacher Feedback Note */}
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      fontSize: "12px",
                      color: "var(--text-3)",
                      marginBottom: "16px",
                      fontStyle: "italic",
                    }}
                  >
                    <strong>O‘qituvchi xulosasi:</strong> "{v.teacherNote}"
                  </div>

                  {/* Action buttons */}
                  <div className="candidate-actions-row">
                    <button
                      type="button"
                      className="candidate-evidence-btn"
                      onClick={() => openViva(v)}
                    >
                      <Icon name="file" size={16} />
                      <span>Audio dialog & Transkript</span>
                    </button>

                    <button
                      type="button"
                      className="candidate-invite-btn"
                      onClick={() => showToast(`${v.studentName}ning Viva natijasi tasdiqlandi!`)}
                    >
                      <Icon name="checkCircle" size={16} />
                      <span>Bahoni tasdiqlash</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* 1. INSPECT STUDENT MODAL */}
      {inspectedStudent && (
        <div className="modal-backdrop employer-modal-backdrop" onClick={() => setInspectedStudent(null)}>
          <div className="modal employer-modal" style={{ width: "min(620px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setInspectedStudent(null)}>
              <Icon name="close" />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent-strong), var(--accent))",
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "19px",
                  fontWeight: 800,
                }}
              >
                {inspectedStudent.avatar}
              </div>
              <div>
                <h2 style={{ fontSize: "22px", margin: 0 }}>{inspectedStudent.name}</h2>
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                  {inspectedStudent.email} · Guruh: {groupLabel}
                </span>
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  padding: "6px 14px",
                  borderRadius: "14px",
                  fontSize: "13px",
                  fontWeight: 800,
                  background: inspectedStudent.level === "L4" ? "var(--success-soft)" : "var(--accent-soft)",
                  color: inspectedStudent.level === "L4" ? "var(--success-fg)" : "var(--accent-hover)",
                }}
              >
                {inspectedStudent.level}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", padding: "14px", background: "var(--surface-2)", borderRadius: "10px", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>UMUMIY BALL</span>
                <strong style={{ fontSize: "20px", color: "var(--navy)" }}>
                  {inspectedStudent.overallScore === null ? "—" : `${inspectedStudent.overallScore} / 100`}
                </strong>
              </div>
              {inspectedStudent.skillsScored !== null ? (
                <div>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>BAHOLANGAN KO‘NIKMA</span>
                  <strong style={{ fontSize: "20px", color: "var(--royal)" }}>{inspectedStudent.skillsScored} ta</strong>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>ISHONCHLILIK</span>
                  <strong style={{ fontSize: "20px", color: "var(--emerald)" }}>
                    {inspectedStudent.confidence === null ? "—" : `${inspectedStudent.confidence}%`}
                  </strong>
                </div>
              )}
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>TASDIQLANGAN DALIL</span>
                <strong style={{ fontSize: "20px", color: "var(--royal)" }}>
                  {inspectedStudent.evidenceCount === null ? "—" : `${inspectedStudent.evidenceCount} ta`}
                </strong>
              </div>
            </div>

            {inspectedStudent.layers ? (
              <>
                <h3 style={{ fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>5 qatlamli ko‘nikma profili:</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                  {LAYER_KEYS.map((layerKey) => (
                    <div key={layerKey}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "4px" }}>
                        <strong>{layerKey}</strong>
                        <span style={{ color: "var(--navy)", fontWeight: 700 }}>{inspectedStudent.layers![layerKey]} ball</span>
                      </div>
                      <div className="progress-track" style={{ height: "6px", margin: 0 }}>
                        <div style={{ width: `${inspectedStudent.layers![layerKey]}%`, height: "100%", background: "var(--accent)", borderRadius: "10px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "24px" }}>
                Qatlamlar bo‘yicha batafsil profil guruh hisobotida mavjud emas.
              </p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              {!isLive && (
                <button
                  className="primary-button"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setInspectedStudent(null);
                    showToast(`${inspectedStudent.name}ga tavsiya va rag‘bat yuborildi!`);
                  }}
                >
                  Rag‘batlantirish / Tavsiya yozish
                </button>
              )}
              <button className="dark-outline" style={{ width: "auto" }} onClick={() => setInspectedStudent(null)}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROVE INSPECTION & RUBRIC MODAL */}
      {inspectedProveItem && (
        <div className="modal-backdrop employer-modal-backdrop" onClick={() => setInspectedProveItem(null)}>
          <div className="modal employer-modal" style={{ maxWidth: "640px", borderRadius: "20px", padding: "28px" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setInspectedProveItem(null)}>
              <Icon name="close" />
            </button>

            <div className="modal-symbol" style={{ background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", color: "white" }}>
              <Icon name="shieldCheck" size={28} />
            </div>

            <p className="eyebrow">DALIL EKSPERTIZASI VA RUBRIKA BAHOLASH</p>
            <h2 style={{ fontSize: "20px", margin: "4px 0" }}>{inspectedProveItem.studentName} · {inspectedProveItem.title}</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
              Ko‘nikma: <strong>{inspectedProveItem.skillName}</strong>
              {inspectedProveItem.live ? (
                <> · Yuborilgan: <strong>{inspectedProveItem.submittedAt || "—"}</strong></>
              ) : (
                <> · Talab darajasi: <strong>{inspectedProveItem.targetLevel || "L4"}</strong></>
              )}
            </p>

            {/* Rubrics table */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left", marginBottom: "20px" }}>
              {inspectedProveItem.live ? (
                <div style={{ padding: "14px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <label style={{ display: "block", fontSize: "13.5px", fontWeight: 700, color: "var(--navy)", marginBottom: "10px" }}>
                    Dalil bahosi (0–100):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={proveScore}
                      onChange={(e) => setProveScore(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "var(--accent)" }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={proveScore}
                      onChange={(e) => setProveScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      style={{
                        width: "72px",
                        padding: "6px 8px",
                        borderRadius: "8px",
                        border: "1.5px solid var(--border)",
                        fontSize: "13px",
                        color: "var(--navy)",
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>
              ) : (
              <div style={{ padding: "14px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <strong style={{ fontSize: "13.5px", color: "var(--navy)", display: "block", marginBottom: "10px" }}>
                  Baholash rubrikalari mezonlari:
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px" }}>
                  <div style={{ padding: "8px 10px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ color: "var(--muted)" }}>Kod sifati & Clean Code</div>
                    <strong style={{ color: "var(--accent)", fontSize: "15px" }}>{inspectedProveItem.rubrics?.codeQuality || 90} / 100</strong>
                  </div>
                  <div style={{ padding: "8px 10px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ color: "var(--muted)" }}>Arxitektura & Patternlar</div>
                    <strong style={{ color: "var(--success)", fontSize: "15px" }}>{inspectedProveItem.rubrics?.architecture || 88} / 100</strong>
                  </div>
                  <div style={{ padding: "8px 10px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ color: "var(--muted)" }}>Avtomatlashgan Unit Testlar</div>
                    <strong style={{ color: "var(--violet)", fontSize: "15px" }}>{inspectedProveItem.rubrics?.unitTests || 94} / 100</strong>
                  </div>
                  <div style={{ padding: "8px 10px", borderRadius: "8px", background: "#ffffff", border: "1px solid var(--border)" }}>
                    <div style={{ color: "var(--muted)" }}>Hujjatlar & Readme</div>
                    <strong style={{ color: "var(--warning)", fontSize: "15px" }}>{inspectedProveItem.rubrics?.docs || 85} / 100</strong>
                  </div>
                </div>
              </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>
                  O‘QITUVCHI XULOSASI VA TAVSIYASI:
                </label>
                <textarea
                  rows={2}
                  placeholder="Loyiha sifati bo‘yicha talabaga rasmiy izoh qoldiring..."
                  value={teacherReviewNote}
                  onChange={(e) => setTeacherReviewNote(e.target.value)}
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
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="candidate-evidence-btn"
                disabled={proveBusy}
                onClick={() => void handleRejectProve(inspectedProveItem.id, inspectedProveItem.studentName)}
              >
                Qayta ishlashga qaytarish
              </button>
              <button
                type="button"
                className="candidate-invite-btn"
                style={{ flex: 1.5 }}
                disabled={proveBusy}
                onClick={() => void handleApproveProve(inspectedProveItem.id, inspectedProveItem.studentName, inspectedProveItem.skillName)}
              >
                <Icon name="checkCircle" size={16} />
                <span>{proveBusy ? "Yuborilmoqda..." : inspectedProveItem.live ? "Tasdiqlash" : "Tasdiqlash & L4 berish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. REMEDIAL CHALLENGE GENERATOR WIZARD MODAL */}
      {remedialModalOpen && (
        <div className="modal-backdrop employer-modal-backdrop" onClick={() => setRemedialModalOpen(false)}>
          <div className="modal employer-modal" style={{ width: "min(560px, 100%)", borderRadius: "20px", padding: "28px" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setRemedialModalOpen(false)}>
              <Icon name="close" />
            </button>

            <div className="modal-symbol" style={{ background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", color: "white" }}>
              <Icon name="code" size={28} />
            </div>

            <h2>AI Remedial Topshiriq Generatori</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>
              Guruhdagi bo‘shliq aniqlangan talabalar uchun parametrli, plagiatdan himoyalangan amaliy topshiriqlarni avtomatik shakllantirish.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "20px 0" }}>
              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: "6px" }}>
                  Mavzu yoki Bo‘shliq fani:
                </label>
                {isLive ? (
                  liveSkills.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                      Ushbu guruhda baholangan ko‘nikmalar yo‘q — remedial topshiriq yaratib bo‘lmaydi.
                    </div>
                  ) : (
                    <select
                      value={remedialSkillId}
                      onChange={(e) => {
                        setRemedialSkillId(e.target.value);
                        setGeneratedSuccess(false);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1.5px solid var(--border)",
                        fontSize: "13.5px",
                        color: "var(--navy)",
                      }}
                    >
                      {weakSkillsSorted.map((s) => (
                        <option key={s.skill.id} value={s.skill.id}>
                          {s.skill.name} ({s.gap_pct}% bo‘shliq · {s.below_70} talaba)
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  <select
                    value={remedialSkill}
                    onChange={(e) => setRemedialSkill(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1.5px solid var(--border)",
                      fontSize: "13.5px",
                      color: "var(--navy)",
                    }}
                  >
                    <option value="DevOps va CI/CD">DevOps va CI/CD (46% bo‘shliq)</option>
                    <option value="Ma’lumotlar tuzilmasi (DSA)">Ma’lumotlar tuzilmasi (DSA) (38% bo‘shliq)</option>
                    <option value="SQL va ma’lumotlar bazasi">SQL va indekslarni optimallash (22% bo‘shliq)</option>
                    <option value="OOP va dizayn pattern’lari">OOP va Clean Architecture (18% bo‘shliq)</option>
                  </select>
                )}
              </div>

              {isLive && (
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                  Topshiriq L3 · AI-free qoralama sifatida yaratiladi; e’lon qilishdan oldin ikkinchi ko‘rib chiquvchi tasdiqlaydi.
                </p>
              )}

              {!isLive && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: "6px" }}>
                    Qiyinlik darajasi:
                  </label>
                  <select
                    value={remedialDifficulty}
                    onChange={(e) => setRemedialDifficulty(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1.5px solid var(--border)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="L2">L2 · Boshlang‘ich / Asosiy</option>
                    <option value="L3">L3 · O‘rta / Amaliy</option>
                    <option value="L4">L4 · Murakkab / Arxitektura</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: "6px" }}>
                    AI Yordami rejimi:
                  </label>
                  <select
                    value={remedialAiMode}
                    onChange={(e) => setRemedialAiMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1.5px solid var(--border)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="AI-assisted">AI-assisted (Tavsiya etiladi)</option>
                    <option value="AI-free">AI-free (Nazorat ishi)</option>
                  </select>
                </div>
              </div>
              )}
            </div>

            {generating ? (
              <div style={{ padding: "16px 0", textAlign: "center" }}>
                <div className="progress-track" style={{ height: "8px", marginBottom: "12px" }}>
                  <div className="progress-fill" style={{ width: `${generationStep * 33}%`, transition: "width 0.4s ease" }} />
                </div>
                <span style={{ fontSize: "13px", color: "var(--navy)", fontWeight: 700 }}>
                  {generationStep === 1 && "1/3: Guruh ontologiyasi va bo‘shliqlari tahlil qilinmoqda..."}
                  {generationStep === 2 && "2/3: Har bir talaba uchun individual testlar shakllanmoqda..."}
                  {generationStep === 3 && "3/3: Baholash rubrikalari va sandbox paketi tayyorlanmoqda..."}
                </span>
              </div>
            ) : generatedSuccess && isLive ? (
              <div style={{ padding: "16px", borderRadius: "10px", background: "var(--success-soft)", border: "1px solid var(--success-ring)", marginBottom: "16px" }}>
                <strong style={{ color: "var(--success-fg)", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <Icon name="checkCircle" size={16} /> Remedial topshiriq qoralamasi yaratildi!
                </strong>
                <p style={{ color: "var(--success-fg)", fontSize: "12.5px", margin: 0 }}>
                  {lastRemedial
                    ? `${groupLabel} guruhidagi ${lastRemedial.target_students} nafar talabaga mo‘ljallangan · Shablon: ${lastRemedial.template} · Holat: ${lastRemedial.status}`
                    : "—"}
                </p>
              </div>
            ) : generatedSuccess ? (
              <div style={{ padding: "16px", borderRadius: "10px", background: "var(--success-soft)", border: "1px solid var(--success-ring)", marginBottom: "16px" }}>
                <strong style={{ color: "var(--success-fg)", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <Icon name="checkCircle" size={16} /> 12 ta parametrli topshiriq muvaffaqiyatli tayyorlandi!
                </strong>
                <p style={{ color: "var(--success-fg)", fontSize: "12.5px", margin: 0 }}>
                  Topshiriqlar {teacherGroupData.groupCode} guruhidagi tegishli talabalarning shaxsiy kabinetiga yuborildi.
                </p>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="primary-button full"
                onClick={() => void handleGenerateRemedial()}
                disabled={generating || (isLive && !remedialSkillId)}
              >
                {generating
                  ? "Generatsiya qilinmoqda..."
                  : isLive
                  ? "Remedial topshiriq qoralamasini yaratish"
                  : "AI bilan generatsiya qilish va tarqatish"}
              </button>
            </div>
            <button type="button" className="cancel-button" onClick={() => setRemedialModalOpen(false)}>
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {/* 4. VIVA TRANSCRIPT AUDIO & DIALOGUE MODAL */}
      {inspectedViva && (
        <div className="modal-backdrop employer-modal-backdrop" onClick={() => setInspectedViva(null)}>
          <div className="modal employer-modal" style={{ maxWidth: "660px", borderRadius: "20px", padding: "28px" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setInspectedViva(null)}>
              <Icon name="close" />
            </button>

            <div className="modal-symbol" style={{ background: "linear-gradient(160deg, #2b4fa8, #1e3a8a 45%, #0f2744)", color: "white" }}>
              <Icon name="file" size={28} />
            </div>

            <p className="eyebrow" style={{ color: "var(--royal)" }}>AI VIVA OG‘ZAKI HIMOYA DIALOGI</p>
            <h2 style={{ fontSize: "20px", margin: "4px 0" }}>{inspectedViva.studentName} · {inspectedViva.taskTitle}</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Baho: <strong>{inspectedViva.vivaScore} / 100</strong>
              {inspectedViva.live
                ? <> · {inspectedViva.duration} · matnli viva{inspectedViva.humanScore != null ? <> · inson bahosi: <strong>{inspectedViva.humanScore}</strong></> : null}</>
                : <> · Nutq ishonchliligi: <strong>{inspectedViva.confidence}%</strong> ({inspectedViva.duration})</>}
            </p>

            {/* Audio Wave Player Simulation (demo only: live vivas are text-based, section 5.4) */}
            {!inspectedViva.live && (
            <div
              style={{
                padding: "12px 18px",
                borderRadius: "12px",
                background: "var(--ink)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "18px",
              }}
            >
              <button
                type="button"
                onClick={() => setPlayingVivaAudio(!playingVivaAudio)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "none",
                  background: playingVivaAudio ? "var(--danger-400)" : "var(--accent)",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <Icon name={playingVivaAudio ? "close" : "play"} size={16} />
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  {playingVivaAudio ? "Audio yozuv ijro etilmoqda..." : "Viva audio yozuvi"}
                </div>
                <div style={{ height: "6px", background: "rgba(255,255,255,0.2)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: playingVivaAudio ? "65%" : "30%", height: "100%", background: "var(--info-400)", transition: "width 0.3s ease" }} />
                </div>
              </div>

              <span style={{ fontSize: "11px", color: "var(--subtle)" }}>
                05:12 / {inspectedViva.duration}
              </span>
            </div>
            )}

            {inspectedViva.live && !inspectedViva.dialogue && (
              <p style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "12px" }}>Transkript yuklanmoqda...</p>
            )}
            {inspectedViva.transcriptError && (
              <p style={{ fontSize: "12.5px", color: "var(--danger-fg)", marginBottom: "12px" }}>Transkriptni yuklab bo‘lmadi.</p>
            )}

            {/* Dialogue Exchanges */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left", maxHeight: "240px", overflowY: "auto", marginBottom: "20px" }}>
              {inspectedViva.dialogue?.map((d: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: d.speaker.includes("AI") ? "var(--accent-soft)" : "var(--surface-2)",
                    border: d.speaker.includes("AI") ? "1px solid var(--accent-ring)" : "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "12.5px", color: "var(--navy)" }}>{d.speaker}:</strong>
                    {d.score && (
                      <span style={{ fontSize: "11px", color: "var(--royal)", fontWeight: 700 }}>
                        Baho: {d.score}/100
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-2)" }}>"{d.text}"</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="candidate-evidence-btn"
                onClick={() => setInspectedViva(null)}
              >
                Yopish
              </button>
              <button
                type="button"
                className="candidate-invite-btn"
                style={{ flex: 1.5 }}
                onClick={() => {
                  setInspectedViva(null);
                  showToast(`${inspectedViva.studentName}ning himoya natijasi tasdiqlandi!`);
                }}
              >
                <Icon name="checkCircle" size={16} />
                <span>AI bahosini tasdiqlash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast */}
      {toastMessage && (
        <div className="toast">
          <Icon name="check" size={17} />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)}>
            <Icon name="close" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
