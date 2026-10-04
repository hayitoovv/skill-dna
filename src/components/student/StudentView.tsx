import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import { Icon, Logo } from "../common/Icons";
import { directionsData, sampleTasksByDirection } from "../../data/ontology";
import type { DirectionCode, LayerKey, LayerItem, User } from "../../types";
import { api } from "../../services/api";
import { printCredential } from "./certificatePrint";
import CareerCoachModal from "./CareerCoachModal";
import EvidenceGraphModal from "./EvidenceGraphModal";

export type PageKey = "dashboard" | "dna" | "tasks" | "career" | "certificates" | "settings";

const pageTitles: Record<PageKey, string> = {
  dashboard: "Boshqaruv paneli",
  dna: "Mening Skill DNA’m",
  tasks: "Topshiriqlar",
  career: "Karyera yo‘li",
  certificates: "Sertifikatlar",
  settings: "Sozlamalar",
};

function PageIntro({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="welcome-row inner-intro">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {action}
    </section>
  );
}

function SkillChart({
  selected,
  layerScores,
  trigger,
}: {
  selected: string;
  layerScores: Record<LayerKey, number>;
  trigger?: any;
}) {
  const [animProgress, setAnimProgress] = useState(0);

  useEffect(() => {
    setAnimProgress(0);
    let start: number | null = null;
    let frameId: number;
    const duration = 1800; // Sekinroq, silliq va qulay tezlik

    const step = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // Buttery-smooth easeOutCubic
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimProgress(ease);

      if (t < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setAnimProgress(1);
      }
    };

    const timer = setTimeout(() => {
      frameId = requestAnimationFrame(step);
    }, 60);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frameId);
    };
  }, [trigger, layerScores]);

  // Center is (150, 132).
  // Axis line endpoints:
  // KNOW: (150, 29), DO: (260, 109), ADAPT: (218, 238), DEFEND: (82, 238), PROVE: (40, 109)
  const calcAxisPoint = (targetX: number, targetY: number, score: number) => {
    const fraction = ((score || 0) / 100) * animProgress;
    const x = Math.round(150 + fraction * (targetX - 150));
    const y = Math.round(132 + fraction * (targetY - 132));
    return `${x},${y}`;
  };

  const kScore = layerScores.KNOW ?? 0;
  const dScore = layerScores.DO ?? 0;
  const aScore = layerScores.ADAPT ?? 0;
  const dfScore = layerScores.DEFEND ?? 0;
  const pScore = layerScores.PROVE ?? 0;

  const pKnow = calcAxisPoint(150, 29, kScore);
  const pDo = calcAxisPoint(260, 109, dScore);
  const pAdapt = calcAxisPoint(218, 238, aScore);
  const pDefend = calcAxisPoint(82, 238, dfScore);
  const pProve = calcAxisPoint(40, 109, pScore);

  const polygonPoints = `${pKnow} ${pDo} ${pAdapt} ${pDefend} ${pProve}`;

  const avgScore = Math.round(
    kScore * 0.15 +
      dScore * 0.3 +
      aScore * 0.2 +
      dfScore * 0.2 +
      pScore * 0.15
  );

  const displayScore = Math.round(avgScore * animProgress);

  return (
    <div className="chart-shell">
      <svg viewBox="0 0 300 265" className="radar" aria-label="Besh qatlam bo‘yicha ko‘nikma diagrammasi">
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
          points={polygonPoints}
          style={{ opacity: animProgress > 0.02 ? 1 : 0 }}
        />
        <g
          className="radar-points"
          style={{ opacity: animProgress > 0.05 ? 1 : 0, transition: "opacity 0.2s ease" }}
        >
          <circle cx={pKnow.split(",")[0]} cy={pKnow.split(",")[1]} r={selected === "KNOW" ? "6" : "4"} />
          <circle cx={pDo.split(",")[0]} cy={pDo.split(",")[1]} r={selected === "DO" ? "6" : "4"} />
          <circle cx={pAdapt.split(",")[0]} cy={pAdapt.split(",")[1]} r={selected === "ADAPT" ? "6" : "4"} />
          <circle cx={pDefend.split(",")[0]} cy={pDefend.split(",")[1]} r={selected === "DEFEND" ? "6" : "4"} />
          <circle cx={pProve.split(",")[0]} cy={pProve.split(",")[1]} r={selected === "PROVE" ? "6" : "4"} />
        </g>
        <g className="radar-labels">
          <text x="150" y="14" textAnchor="middle">
            KNOW
          </text>
          <text x="277" y="106" textAnchor="middle">
            DO
          </text>
          <text x="224" y="257" textAnchor="middle">
            ADAPT
          </text>
          <text x="72" y="257" textAnchor="middle">
            DEFEND
          </text>
          <text x="20" y="106" textAnchor="middle">
            PROVE
          </text>
        </g>
      </svg>
      <div className="chart-score">
        <strong>{displayScore}</strong>
        <span>/100</span>
        <small>Skill Score</small>
      </div>
    </div>
  );
}

/** Small pill that tells the viewer whether a section shows backend data or bundled demo content. */
function SourceBadge({ live, style }: { live: boolean; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.02em",
        padding: "3px 10px",
        borderRadius: "999px",
        background: live ? "var(--success-soft)" : "var(--warning-soft)",
        color: live ? "var(--success-fg)" : "var(--warning-fg)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <i
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: live ? "var(--success-400)" : "var(--warning-400)",
        }}
      />
      {live ? "Jonli ma’lumot" : "Demo ma’lumot"}
    </span>
  );
}

const LAYER_META: Record<string, { tone: string; icon: string; label: string }> = {
  KNOW: { tone: "blue", icon: "file", label: "Nazariy bilim" },
  DO: { tone: "emerald", icon: "code", label: "Amaliy ijro" },
  ADAPT: { tone: "violet", icon: "settings", label: "Moslashuvchanlik" },
  DEFEND: { tone: "amber", icon: "briefcase", label: "Yechimni himoya (Viva)" },
  PROVE: { tone: "rose", icon: "award", label: "Real dalillar" },
};
const LAYER_ORDER: LayerKey[] = ["KNOW", "DO", "ADAPT", "DEFEND", "PROVE"];

const CONFIDENCE_PARTS: { key: string; label: string; hint: string }[] = [
  { key: "coverage", label: "Qamrov", hint: "Qatlamlarning qancha qismida dalil bor" },
  { key: "consistency", label: "Barqarorlik", hint: "Natijalar bir-biriga qanchalik yaqin" },
  { key: "volume", label: "Hajm", hint: "Dalillar soni yetarlimi" },
  { key: "recency", label: "Yangilik", hint: "Dalillar qanchalik yaqinda olingan" },
  { key: "verification", label: "Tasdiqlash", hint: "Inson (o‘qituvchi) tasdiqlagan ulush" },
];

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });
};
const round1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);
const levelNum = (level?: string | null) => {
  const m = /^L(\d)/.exec(level ?? "");
  return m ? Number(m[1]) : 0;
};

/** "Nega?" — explains a live Skill Score via GET /skills/{id}/score. */
function WhyScoreModal({ skillId, skillName, onClose }: { skillId: string | null; skillName: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "live" | "offline">("loading");

  useEffect(() => {
    if (!skillId) {
      setState("offline");
      return;
    }
    setState("loading");
    api
      .getSkillScore(skillId)
      .then((res) => {
        setData(res);
        setState("live");
      })
      .catch(() => setState("offline"));
  }, [skillId]);

  const parts: Record<string, number> = data?.confidence_parts ?? {};
  const blockers: string[] = data?.level_blockers ?? [];
  const flags: any[] = data?.open_flags ?? [];
  const evidence: any[] = data?.evidence ?? [];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", display: "grid", placeItems: "center", color: "#fff" }}>
            <Icon name="search" size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", margin: 0, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              Nega shu ball? {state !== "loading" && <SourceBadge live={state === "live"} />}
            </h2>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>{data?.skill?.name ?? skillName} · formula {data?.formula_version ?? "—"}</span>
          </div>
        </div>

        {state === "loading" && <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)" }}>Tahlil yuklanmoqda...</div>}

        {state === "offline" && (
          <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
            Ballning batafsil tushuntirishi (Confidence tarkibi va daraja to‘siqlari) faqat serverga ulanganda ko‘rsatiladi. Hozir demo
            profil ko‘rsatilmoqda, shuning uchun taxminiy raqamlar keltirilmaydi.
          </p>
        )}

        {state === "live" && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              {[
                ["Skill Score", `${round1(data.score) ?? 0}/100`],
                ["Confidence", `${round1(data.confidence) ?? 0}%`],
                ["Daraja", data.level ?? "L0"],
              ].map(([k, v]) => (
                <div key={k} style={{ flex: "1 1 120px", padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", display: "block" }}>{k}</span>
                  <strong style={{ fontSize: "17px", color: "var(--navy)" }}>{v}</strong>
                </div>
              ))}
            </div>

            <p className="card-kicker" style={{ marginBottom: "8px" }}>CONFIDENCE TARKIBI</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "16px" }}>
              {CONFIDENCE_PARTS.map((p) => {
                const v = parts[p.key];
                const pct = v == null ? null : Math.round(v * 100);
                return (
                  <div key={p.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span>
                        <strong style={{ color: "var(--navy)" }}>{p.label}</strong>{" "}
                        <span style={{ color: "var(--muted)", fontSize: "12px" }}>· {p.hint}</span>
                      </span>
                      <b>{pct == null ? "—" : `${pct}%`}</b>
                    </div>
                    <div className="progress-track" style={{ marginTop: "4px" }}>
                      <div className="progress-fill" style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="card-kicker" style={{ marginBottom: "8px" }}>KEYINGI DARAJA TO‘SIQLARI</p>
            {blockers.length === 0 ? (
              <p style={{ fontSize: "13.5px", color: "var(--muted)", margin: "0 0 14px" }}>To‘siqlar yo‘q.</p>
            ) : (
              <ul style={{ margin: "0 0 14px", paddingLeft: "18px", fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}

            {flags.length > 0 && (
              <div style={{ padding: "10px 12px", borderRadius: "9px", background: "var(--danger-soft)", color: "var(--danger-fg)", fontSize: "13px", marginBottom: "14px" }}>
                {flags.length} ta ochiq integrity bayrog‘i bor — moderator qaroridan keyin ball yakunlanadi.
              </div>
            )}

            {evidence.length > 0 && (
              <>
                <p className="card-kicker" style={{ marginBottom: "8px" }}>DALILLAR ({evidence.length})</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                  {evidence.slice(0, 8).map((ev) => (
                    <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "13px", padding: "7px 10px", background: "var(--surface-2)", borderRadius: "8px" }}>
                      <span style={{ minWidth: 0 }}>
                        <b>{ev.layer}</b> · {ev.title}
                        {ev.human_verified && <span style={{ color: "var(--success-fg)", fontWeight: 700 }}> · inson tasdiqlagan</span>}
                      </span>
                      <b style={{ whiteSpace: "nowrap" }}>{round1(ev.score)}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <button className="primary-button full" onClick={onClose}>
          Tushunarli
        </button>
      </div>
    </div>
  );
}

/** Read-only details of a live task (non-DO layers have their own flows elsewhere). */
function TaskInfoModal({ task, skillName, onClose }: { task: any; skillName?: string; onClose: () => void }) {
  const spec = task?.spec ?? {};
  const questions: any[] = Array.isArray(spec.questions) ? spec.questions : [];
  const requirements: string[] = Array.isArray(spec.requirements) ? spec.requirements : [];
  const meta = LAYER_META[task.layer] ?? LAYER_META.DO;
  const layerHint: Record<string, string> = {
    KNOW: "Nazariy test: savollarga javob berasiz, natija avtomatik tekshiriladi.",
    ADAPT: "Parametrli chellinj: avvalgi yechimingizni yangi cheklovga moslashtirasiz.",
    DEFEND: "AI Viva: yechimingizni og‘zaki himoya qilasiz. Buning uchun ‘viva_record’ roziligi kerak.",
    PROVE: "Real loyiha: repozitoriy havolasini topshirasiz, o‘qituvchi tomonidan tasdiqlanadi.",
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <div className={`task-card-icon ${meta.tone}`}>
            <Icon name={meta.icon as any} />
          </div>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              {task.layer} · {meta.label}
            </p>
            <h2 style={{ fontSize: "19px", margin: 0 }}>{task.title}</h2>
          </div>
        </div>
        <p style={{ fontSize: "13.5px", color: "var(--muted)", margin: "0 0 12px" }}>
          {skillName ? `${skillName} · ` : ""}
          {task.difficulty} · {task.duration_minutes} daqiqa · +{task.reward_points} ball · {task.ai_mode}
        </p>
        {layerHint[task.layer] && <p style={{ fontSize: "14px", lineHeight: 1.6, margin: "0 0 14px" }}>{layerHint[task.layer]}</p>}
        {questions.length > 0 && (
          <>
            <p className="card-kicker" style={{ marginBottom: "6px" }}>SAVOLLAR</p>
            <ol style={{ margin: "0 0 14px", paddingLeft: "20px", fontSize: "13.5px", lineHeight: 1.6 }}>
              {questions.map((q, i) => (
                <li key={typeof q === "string" ? q : q.id ?? i}>{typeof q === "string" ? q : q.text}</li>
              ))}
            </ol>
          </>
        )}
        {requirements.length > 0 && (
          <>
            <p className="card-kicker" style={{ marginBottom: "6px" }}>TALABLAR</p>
            <ul style={{ margin: "0 0 14px", paddingLeft: "20px", fontSize: "13.5px", lineHeight: 1.6 }}>
              {requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}
        <button className="primary-button full" onClick={onClose}>
          Tushunarli
        </button>
      </div>
    </div>
  );
}

export default function StudentView({
  direction,
  activePage,
  onStartAssessment,
  goToPage,
  user,
  assessmentKey,
}: {
  direction: DirectionCode;
  activePage: PageKey;
  onStartAssessment: () => void;
  goToPage: (page: PageKey) => void;
  user?: User | null;
  assessmentKey?: number;
}) {
  const validDirection: DirectionCode = (direction && ["software", "computer", "ai"].includes(direction))
    ? direction
    : "software";
  const currentDir = directionsData[validDirection] || directionsData.software;
  const demoSkill = currentDir?.skills?.[0] || directionsData.software.skills[0];

  // Profile form state (synced with user and backend /api/v1/auth/me)
  const [profileName, setProfileName] = useState(user?.name || "Talaba");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [profilePhone, setProfilePhone] = useState(user?.phone || "");
  const [profileBio, setProfileBio] = useState(
    user?.bio || "Dasturiy ta’minot va zamonaviy backend texnologiyalari bo‘yicha talaba."
  );
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || "TL");

  const userName = profileName ? profileName.trim().split(" ")[0] : (user?.name ? user.name.trim().split(" ")[0] : "Talaba");
  const isDemoStudent =
    user?.email === "shoxrux@edu.uz" ||
    user?.id === "usr-student" ||
    user?.id === "usr-student-1" ||
    user?.email === "azizbek.sobirov@gmail.com";

  // Live Skill DNA from the backend (null while loading or when the backend is unreachable)
  const [liveDna, setLiveDna] = useState<any>(null);
  const [dnaSource, setDnaSource] = useState<"loading" | "live" | "offline">("loading");

  useEffect(() => {
    if (user) {
      if (user.name) setProfileName(user.name);
      if (user.email) setProfileEmail(user.email);
      if (user.phone) setProfilePhone(user.phone);
      if (user.bio) setProfileBio(user.bio);
      if (user.avatar) setProfileAvatar(user.avatar);

      api
        .getDnaProfile()
        .then((res) => {
          setLiveDna(res);
          setDnaSource("live");
        })
        .catch(() => setDnaSource("offline"));

      api
        .getMe()
        .then((me) => {
          if (me) {
            if (me.full_name) setProfileName(me.full_name);
            if (me.email) setProfileEmail(me.email);
            if (me.phone) setProfilePhone(me.phone);
            if (me.avatar) setProfileAvatar(me.avatar);
            if (me.bio) setProfileBio(me.bio);
          }
        })
        .catch(() => {});
    }
  }, [user, assessmentKey]);

  // Live data always wins; the bundled demo profile is shown only offline for the demo accounts
  const live = dnaSource === "live" ? liveDna : null;
  const livePrimary = live?.primary_skill ?? null;
  const isNewUser = live ? !livePrimary : !isDemoStudent;
  const primarySkill = livePrimary
    ? {
        ...demoSkill,
        name: livePrimary.name,
        score: livePrimary.score,
        confidence: livePrimary.confidence,
        level: livePrimary.level.split(" ")[0],
        evidenceCount: livePrimary.evidenceCount,
        verifiedCount: livePrimary.evidenceCount,
      }
    : demoSkill;

  const liveLayers: Partial<Record<LayerKey, number | null>> = live?.layers ?? {};
  const layerScores: Record<LayerKey, number> = isNewUser
    ? { KNOW: 0, DO: 0, ADAPT: 0, DEFEND: 0, PROVE: 0 }
    : live
    ? {
        KNOW: liveLayers.KNOW ?? 0,
        DO: liveLayers.DO ?? 0,
        ADAPT: liveLayers.ADAPT ?? 0,
        DEFEND: liveLayers.DEFEND ?? 0,
        PROVE: liveLayers.PROVE ?? 0,
      }
    : primarySkill.layers;

  const layers: LayerItem[] = [
    { key: "KNOW", label: "Nazariy bilim", score: layerScores.KNOW, weight: "15%", weightNum: 0.15, tone: "blue", icon: "file" },
    { key: "DO", label: "Amaliy ijro", score: layerScores.DO, weight: "30%", weightNum: 0.30, tone: "emerald", icon: "code" },
    { key: "ADAPT", label: "Moslashuvchanlik", score: layerScores.ADAPT, weight: "20%", weightNum: 0.20, tone: "violet", icon: "settings" },
    { key: "DEFEND", label: "Yechimni himoya (Viva)", score: layerScores.DEFEND, weight: "20%", weightNum: 0.20, tone: "amber", icon: "briefcase" },
    { key: "PROVE", label: "Real dalillar", score: layerScores.PROVE, weight: "15%", weightNum: 0.15, tone: "rose", icon: "award" },
  ];

  const overallScoreVal = isNewUser ? 0 : primarySkill.score;
  const confidenceVal = isNewUser ? 0 : primarySkill.confidence;
  const evidenceCountVal = isNewUser ? 0 : live ? live.evidence_count : primarySkill.evidenceCount;
  const verifiedCountVal = isNewUser ? 0 : primarySkill.verifiedCount;
  const levelVal = isNewUser ? "L0 · BOSHLANG‘ICH" : livePrimary ? livePrimary.level.replace(" ", " · ") : `${primarySkill.level} · MUTAXASSIS`;

  // Coverage = share of layer weight that has any evidence (section 6.3)
  const coverageVal = isNewUser
    ? 0
    : Math.round(layers.reduce((sum, l) => sum + (live ? (liveLayers[l.key] != null ? l.weightNum : 0) : l.weightNum), 0) * 100);

  const [selectedLayer, setSelectedLayer] = useState<LayerKey>("DO");
  const selected = layers.find((l) => l.key === selectedLayer) ?? layers[1];
  const tasks = sampleTasksByDirection[validDirection] || sampleTasksByDirection.software;

  const [taskFilter, setTaskFilter] = useState("Barchasi");
  const visibleTasks =
    taskFilter === "Barchasi" ? tasks : tasks.filter((t) => t.layer === taskFilter);

  const [shared, setShared] = useState(false);
  const [settingsTab, setSettingsTab] = useState("Profil");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [coachModalOpen, setCoachModalOpen] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [infoTask, setInfoTask] = useState<any>(null);

  // ---------- Live tasks for the direction's skills ----------
  const [liveTasks, setLiveTasks] = useState<any[] | null>(null);
  const [skillNames, setSkillNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLiveTasks(null);
    Promise.all([api.getSkills(validDirection), api.getTasks()])
      .then(([skills, all]) => {
        if (cancelled) return;
        const names: Record<string, string> = {};
        (skills ?? []).forEach((sk: any) => (names[sk.id] = sk.name));
        setSkillNames(names);
        setLiveTasks((all ?? []).filter((t: any) => names[t.skill_id] && t.status !== "archived"));
      })
      .catch(() => !cancelled && setLiveTasks(null));
    return () => {
      cancelled = true;
    };
  }, [user, validDirection, assessmentKey]);
  const tasksLive = liveTasks !== null;
  const liveSkillById: Record<string, any> = {};
  (live?.skills ?? []).forEach((sk: any) => (liveSkillById[sk.id] = sk));
  const liveVisibleTasks = (liveTasks ?? []).filter((t) => taskFilter === "Barchasi" || t.layer === taskFilter);
  const nextLiveTask =
    liveTasks?.find((t) => t.layer === "DO" && t.skill_id === livePrimary?.id) ?? liveTasks?.find((t) => t.layer === "DO") ?? null;

  // ---------- Live career target ----------
  const [careerData, setCareerData] = useState<any>(null);
  const [careerList, setCareerList] = useState<any[]>([]);
  const [careerLoading, setCareerLoading] = useState(false);
  useEffect(() => {
    if (!user) return;
    api
      .getCareerTarget()
      .then(setCareerData)
      .catch(() => setCareerData(null));
    api
      .getCareers()
      .then((rows) => setCareerList(rows ?? []))
      .catch(() => setCareerList([]));
  }, [user, assessmentKey]);
  const careerLive = !!careerData;
  const selectCareer = (id: string) => {
    if (!id || id === careerData?.id) return;
    setCareerLoading(true);
    api
      .getCareerMatch(id)
      .then(setCareerData)
      .catch(() => {})
      .finally(() => setCareerLoading(false));
  };

  // ---------- Live credentials ----------
  const [credentials, setCredentials] = useState<any[] | null>(null);
  const [issuing, setIssuing] = useState<string | null>(null);
  const [issueMsg, setIssueMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, any>>({});
  const loadCredentials = () =>
    api
      .getCredentials()
      .then((rows) => setCredentials(rows ?? []))
      .catch(() => setCredentials(null));
  useEffect(() => {
    if (user) loadCredentials();
  }, [user, assessmentKey]);
  const credsLive = credentials !== null;
  const issueFor = async (skill: any) => {
    setIssuing(skill.id);
    setIssueMsg(null);
    try {
      const res = await api.issueCredential(skill.id);
      setIssueMsg({ ok: true, text: `Sertifikat chiqarildi: ${res?.title ?? skill.name}` });
      await loadCredentials();
    } catch (err: any) {
      setIssueMsg({ ok: false, text: err?.message || "Sertifikat chiqarib bo‘lmadi." });
    } finally {
      setIssuing(null);
    }
  };
  const verifyCred = async (id: string) => {
    setVerifyResult((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await api.verifyCredential(id);
      setVerifyResult((prev) => ({ ...prev, [id]: res }));
    } catch (err: any) {
      setVerifyResult((prev) => ({ ...prev, [id]: { error: err?.message || "Tekshirib bo‘lmadi" } }));
    }
  };
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setShared(true);
  };

  // ---------- Live consents (section 13.2) ----------
  const [consents, setConsents] = useState<{ type: string; granted: boolean; granted_at: string | null }[] | null>(null);
  const [consentBusy, setConsentBusy] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    api
      .getConsents()
      .then(setConsents)
      .catch(() => setConsents(null));
  }, [user]);
  const toggleConsent = async (type: string, granted: boolean) => {
    setConsentBusy(type);
    setConsentError(null);
    try {
      await api.setConsent(type, granted);
      setConsents(await api.getConsents());
    } catch (err: any) {
      setConsentError(err?.message || "Rozilikni saqlab bo‘lmadi.");
    } finally {
      setConsentBusy(null);
    }
  };

  // Animation controller: stores linear time progress from 0 to 1
  const [animTime, setAnimTime] = useState(0);

  useEffect(() => {
    setAnimTime(0);
    let start: number | null = null;
    let frameId: number;
    const duration = 1800; // Silliq va sokin 1.8 soniya

    const step = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setAnimTime(t);

      if (t < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setAnimTime(1);
      }
    };

    const timer = setTimeout(() => {
      frameId = requestAnimationFrame(step);
    }, 60);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frameId);
    };
  }, [activePage, direction]);

  // Buttery-smooth cubic ease-out
  const mainEase = 1 - Math.pow(1 - animTime, 3);

  // Staggered calculation for the 5-layer cards in linear time (Dashboard)
  const getLayerProgress = (index: number) => {
    const start = 0.04 + index * 0.07;
    const span = 0.58;
    if (animTime <= start) return 0;
    const localT = Math.min(1, (animTime - start) / span);
    return 1 - Math.pow(1 - localT, 3);
  };

  // Staggered calculation for skills list and gaps (DNA & Career pages)
  const getDnaSkillProgress = (index: number) => {
    const start = 0.05 + index * 0.08;
    const span = 0.58;
    if (animTime <= start) return 0;
    const localT = Math.min(1, (animTime - start) / span);
    return 1 - Math.pow(1 - localT, 3);
  };

  const animatedConfidenceScore = Math.round(confidenceVal * mainEase);
  const animatedConfidenceWidth = (confidenceVal * mainEase).toFixed(1);
  const animatedCoverage = Math.round(coverageVal * mainEase);

  return (
    <>
      {activePage === "dashboard" && (
        <div className="page">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{currentDir.categoryBadge} · BOSHQARUV PANELI</p>
              <h1>Xayrli kun, {userName}</h1>
              <p className="subtitle">
                Yo‘nalish: <strong>{currentDir.title}</strong> ·{" "}
                {isNewUser
                  ? "Hali baholash boshlanmagan (0%). Boshlash uchun topshiriqni tanlang."
                  : "5 qatlamli amaliy dalillar orqali o‘lchanmoqda."}
              </p>
            </div>
            <button className="primary-button" onClick={onStartAssessment}>
              {isNewUser ? "Baholashni boshlash" : "Baholashni davom ettirish"}{" "}
              <Icon name="arrow" size={18} />
            </button>
          </section>

          <section className="summary-grid">
            <article className="card dna-card">
              <div className="card-heading">
                <div>
                  <p className="card-kicker">ASOSIY KO‘NIKMA (CORE SKILL)</p>
                  <h2>{primarySkill.name}</h2>
                </div>
                <span className="level-badge">{levelVal}</span>
              </div>
              <div className="dna-body">
                <SkillChart
                  selected={selectedLayer}
                  layerScores={layerScores}
                  trigger={`${activePage}_${direction}_${isNewUser}`}
                />
                <div className="score-summary">
                  <div className="confidence-head">
                    <span>
                      Ishonchlilik (Confidence)
                      {live && livePrimary && (
                      <button
                        type="button"
                        onClick={() => setWhyOpen(true)}
                        title="Ball qanday hisoblangan?"
                        style={{ marginLeft: "8px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--accent)", borderRadius: "999px", padding: "1px 9px", fontSize: "11.5px", fontWeight: 800, cursor: "pointer" }}
                      >
                        nega?
                      </button>
                    )}
                    </span>
                    <strong>{animatedConfidenceScore}%</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${animatedConfidenceWidth}%` }}
                    />
                  </div>
                  <p>
                    {isNewUser
                      ? "Hali dalillar mavjud emas · 0 ta dalil qayd etilgan"
                      : `${confidenceVal >= 70 ? "Yuqori" : confidenceVal >= 40 ? "O‘rtacha" : "Past"} ishonchlilik · ${evidenceCountVal} ta dalil, ${verifiedCountVal} tasdiqlangan`}
                  </p>
                  <div className="selected-layer">
                    <div className={`layer-icon ${selected.tone}`}>
                      <Icon name={selected.icon as any} />
                    </div>
                    <div>
                      <span>Tanlangan qatlam</span>
                      <strong>
                        {selected.key} · {selected.label}
                      </strong>
                    </div>
                    <b>{selected.score}</b>
                  </div>
                  <button className="text-button" onClick={() => goToPage("dna")}>
                    To‘liq profilni ko‘rish <Icon name="arrow" size={16} />
                  </button>
                </div>
              </div>
            </article>

            <article className="card next-card">
              <div className="next-top">
                <span className="small-badge">
                  <Icon name="clock" size={15} /> KEYINGI QADAM
                </span>
                <span className="time">≈ {nextLiveTask ? `${nextLiveTask.duration_minutes} daqiqa` : tasks[0].duration}</span>
              </div>
              <div className="task-visual">
                <Icon name="code" size={36} />
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <p className="task-type">{nextLiveTask ? nextLiveTask.layer : tasks[0].layer} · AMALIY TOPSHIRIQ</p>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: (nextLiveTask ? nextLiveTask.ai_mode : tasks[0].aiMode) === "AI-free" ? "var(--danger-400)" : "var(--success-400)",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {nextLiveTask ? nextLiveTask.ai_mode : tasks[0].aiMode}
                </span>
                <SourceBadge live={!!nextLiveTask} />
              </div>
              <h2>{nextLiveTask ? nextLiveTask.title : tasks[0].title}</h2>
              <p>
                {nextLiveTask
                  ? `${skillNames[nextLiveTask.skill_id] ?? ""} · ${nextLiveTask.difficulty} darajadagi amaliy topshiriq. Kodingiz avtotestlar bilan tekshiriladi.`
                  : "Mavjud yechimni parametrli yangi cheklovga moslang va qaroringizni asoslang."}
              </p>
              <div className="task-meta">
                <span>
                  <Icon name="file" size={16} /> {nextLiveTask ? nextLiveTask.difficulty : "4 ta avtotest"}
                </span>
                <span>
                  <Icon name="award" size={16} /> {nextLiveTask ? `+${nextLiveTask.reward_points} ball` : tasks[0].reward}gacha
                </span>
              </div>
              <button className="dark-button" onClick={onStartAssessment}>
                Topshiriqni boshlash <Icon name="arrow" size={17} />
              </button>
            </article>
          </section>

          <section className="layers-section">
            <div className="section-heading">
              <div>
                <h2>5 qatlamli baholash modeli</h2>
                <p>Har bir qatlam ko‘nikmangizning alohida jihatini isbotlaydi.</p>
              </div>
              <span>
                Umumiy qamrov <strong>{animatedCoverage}%</strong>
              </span>
            </div>
            <div className="layer-grid">
              {layers.map((layer, index) => {
                const lProgress = getLayerProgress(index);
                const layerDisplayScore = Math.round(layer.score * lProgress);
                const layerWidth = (layer.score * lProgress).toFixed(1);

                return (
                  <button
                    key={layer.key}
                    className={`layer-card ${selectedLayer === layer.key ? "selected" : ""}`}
                    onClick={() => setSelectedLayer(layer.key)}
                  >
                    <div className={`layer-icon ${layer.tone}`}>
                      <Icon name={layer.icon as any} />
                    </div>
                    <div className="layer-name">
                      <strong>{layer.key}</strong>
                      <span>{layer.label}</span>
                    </div>
                    <div className="layer-score">
                      <strong>{layerDisplayScore}</strong>
                      <span>Vazn: {layer.weight}</span>
                    </div>
                    <div className="mini-track">
                      <span style={{ width: `${layerWidth}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activePage === "dna" && (
        <div className="page">
          <PageIntro
            kicker="KOMPETENSIYA PROFILI"
            title={`Mening Skill DNA’m — ${currentDir.title}`}
            description="Ko‘nikmalaringiz nazariya emas, tekshirilgan amaliy dalillar (Evidence Graph) orqali o‘lchanadi."
            action={
              <button className="primary-button" onClick={onStartAssessment}>
                Yangi dalil qo‘shish <Icon name="arrow" size={18} />
              </button>
            }
          />

          <section className="profile-hero card">
            <div className="profile-chart">
              <div className="card-heading">
                <div>
                  <p className="card-kicker">ASOSIY YO‘NALISH</p>
                  <h2>{currentDir.title}</h2>
                </div>
                <span className="level-badge">{levelVal}</span>
              </div>
              <SkillChart
                selected={selectedLayer}
                layerScores={layerScores}
                trigger={`${activePage}_${direction}_${isNewUser}`}
              />
            </div>
            <div className="profile-stats">
              <div className="big-score">
                <span>
                  UMUMIY NATIJA
                  {live && livePrimary && (
                    <button
                      type="button"
                      onClick={() => setWhyOpen(true)}
                      title="Ball qanday hisoblangan?"
                      style={{ marginLeft: "8px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--accent)", borderRadius: "999px", padding: "1px 9px", fontSize: "11.5px", fontWeight: 800, cursor: "pointer", letterSpacing: 0 }}
                    >
                      nega?
                    </button>
                  )}
                </span>
                <strong>
                  {Math.round(overallScoreVal * mainEase)}
                  <small>/100</small>
                </strong>
                <p>
                  {live
                    ? livePrimary?.level_blockers?.length
                      ? livePrimary.level_blockers[0]
                      : isNewUser
                      ? "Birinchi dalilni qo‘shing — L1 UNDERSTAND darajasi ochiladi"
                      : "Keyingi daraja uchun to‘siqlar yo‘q"
                    : isNewUser
                    ? "Keyingi darajagacha 20 ball (L1 UNDERSTAND)"
                    : "Keyingi darajagacha 9 ball (L4 CREATE)"}
                </p>
              </div>
              <div className="stat-pair">
                <div>
                  <span>Ishonchlilik</span>
                  <strong>{Math.round(confidenceVal * mainEase)}%</strong>
                </div>
                <div style={{ cursor: "pointer" }} onClick={() => setEvidenceModalOpen(true)} title="Evidence Graph (Dalillar zanjiri)ni ko‘rish">
                  <span>Dalillar</span>
                  <strong>{Math.round(evidenceCountVal * mainEase)} ta ↗</strong>
                </div>
              </div>
              <div className="level-path">
                <div className={isNewUser ? "level-current" : "level-done"} style={{ transform: "scale(1)" }}>
                  {isNewUser ? "L0" : <Icon name="check" size={14} />}
                </div>
                <span className="level-line">
                  <em style={{ width: isNewUser ? "0%" : `${Math.min(100, Math.max(0, (mainEase - 0.1) * 350))}%` }} />
                </span>
                <div className={isNewUser ? "" : "level-done"} style={{ transform: `scale(${mainEase > 0.35 && !isNewUser ? 1 : 0.85})` }}>
                  {isNewUser ? "L1" : <Icon name="check" size={14} />}
                </div>
                <span className="level-line">
                  <em style={{ width: isNewUser ? "0%" : `${Math.min(100, Math.max(0, (mainEase - 0.35) * 350))}%` }} />
                </span>
                <div className={isNewUser ? "" : "level-current"} style={{ transform: `scale(${mainEase > 0.6 && !isNewUser ? 1 : 0.85})` }}>
                  {isNewUser ? "L2" : primarySkill.level}
                </div>
                <span className="level-line">
                  <em style={{ width: "0%" }} />
                </span>
                <div>L4</div>
                <span className="level-line">
                  <em style={{ width: "0%" }} />
                </span>
                <div>L5</div>
              </div>
              <div className="level-labels">
                <span>Boshlang‘ich</span>
                <b>Mutaxassis</b>
                <span>Master</span>
              </div>
            </div>
          </section>

          <section className="detail-layout">
            <div>
              <div className="section-heading">
                <div>
                  <h2>Yo‘nalish ko‘nikmalari ro‘yxati</h2>
                  <p>Ushbu sohadagi asosiy kompetensiyalar</p>
                </div>
                {dnaSource !== "loading" && <SourceBadge live={!!live} />}
              </div>
              <div className="dna-layer-list">
                {(live
                  ? (live.skills ?? []).map((sk: any) => ({
                      id: sk.id,
                      name: sk.name,
                      isCore: sk.isCore,
                      score: Math.round(sk.score ?? 0),
                      level: (sk.level ?? "L0").split(" ")[0],
                      evidenceCount: sk.evidenceCount ?? 0,
                      confidence: Math.round(sk.confidence ?? 0),
                    }))
                  : currentDir.skills
                ).map((sk: { id: string; name: string; isCore?: boolean; score: number; level: string; evidenceCount: number; confidence: number }, index: number) => {
                  const sProgress = getDnaSkillProgress(index);
                  const targetScore = isNewUser ? 0 : sk.score;
                  const currentScore = Math.round(targetScore * sProgress);
                  const currentWidth = (targetScore * sProgress).toFixed(1);
                  const skillLevel = isNewUser ? "L0" : sk.level;
                  const skillEvCount = isNewUser ? 0 : sk.evidenceCount;
                  const skillConf = isNewUser ? 0 : sk.confidence;

                  return (
                    <div
                      key={sk.id}
                      className="card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "15px", color: "var(--navy)" }}>{sk.name}</strong>
                          {sk.isCore && (
                            <span style={{ fontSize: "12px", color: "var(--warning-400)", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <Icon name="star" size={12} /> Core
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                          {skillLevel} · {skillEvCount} ta dalil · {skillConf}% ishonchlilik
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div className="row-bar" style={{ width: "120px" }}>
                          <i style={{ width: `${currentWidth}%` }} />
                        </div>
                        <b style={{ fontSize: "17px", color: "var(--navy)", minWidth: "26px", textAlign: "right" }}>
                          {currentScore}
                        </b>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="card layer-detail">
              <div className={`layer-icon ${selected.tone}`}>
                <Icon name={selected.icon as any} />
              </div>
              <p className="eyebrow">
                {selected.key} · VAZN {selected.weight}
              </p>
              <h2>{selected.label}</h2>
              <p>
                Ushbu qatlamdagi natijangiz {selected.score}/100. So‘nggi 30 kunda tekshirilgan faoliyat qayd etilgan.
              </p>
              <div className="detail-metric">
                <span>Eng yaxshi natija</span>
                <strong>{selected.score}</strong>
              </div>
              <div className="detail-metric">
                <span>Topshirilganlar</span>
                <strong>{primarySkill.evidenceCount} ta</strong>
              </div>
              <div className="detail-metric">
                <span>Oxirgi faoliyat</span>
                <strong>{live ? fmtDate(livePrimary?.computed_at) : "Bugun"}</strong>
              </div>
              <button className="dark-outline" onClick={onStartAssessment}>
                Qatlamni rivojlantirish <Icon name="arrow" size={16} />
              </button>
            </aside>
          </section>
        </div>
      )}

      {activePage === "tasks" && (
        <div className="page">
          <PageIntro
            kicker="AMALIY BAHOLASH"
            title={`Topshiriqlar — ${currentDir.title}`}
            description="Real vaziyatlarga asoslangan topshiriqlar, random chellinjlar va AI Viva orqali ko‘nikmalaringizni isbotlang."
          />
          <div className="filter-row">
            <div className="filter-tabs">
              {["Barchasi", "KNOW", "DO", "ADAPT", "DEFEND", "PROVE"].map((item) => (
                <button
                  className={taskFilter === item ? "active" : ""}
                  onClick={() => setTaskFilter(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            <SourceBadge live={tasksLive} />
          </div>
          {tasksLive ? (
            liveVisibleTasks.length === 0 ? (
              <section className="card" style={{ textAlign: "center", padding: "36px 24px", color: "var(--muted)", fontSize: "14px" }}>
                Bu qatlam uchun hozircha faol topshiriqlar yo‘q.
              </section>
            ) : (
              LAYER_ORDER.filter((lk) => liveVisibleTasks.some((t) => t.layer === lk)).map((lk) => (
                <section key={lk} style={{ marginBottom: "22px" }}>
                  <div className="section-heading compact" style={{ marginBottom: "10px" }}>
                    <div>
                      <h2 style={{ fontSize: "17px" }}>
                        {lk} · {LAYER_META[lk].label}
                      </h2>
                      <p>{liveVisibleTasks.filter((t) => t.layer === lk).length} ta topshiriq</p>
                    </div>
                  </div>
                  <div className="tasks-grid">
                    {liveVisibleTasks
                      .filter((t) => t.layer === lk)
                      .map((task) => {
                        const meta = LAYER_META[task.layer] ?? LAYER_META.DO;
                        const skill = liveSkillById[task.skill_id];
                        const layerScore: number | null = skill?.layers?.[task.layer] ?? null;
                        return (
                          <article className="card task-card" key={task.id}>
                            <div className="task-card-top">
                              <div className={`task-card-icon ${meta.tone}`}>
                                <Icon name={meta.icon as any} />
                              </div>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    padding: "3px 8px",
                                    borderRadius: "4px",
                                    background: task.ai_mode === "AI-free" ? "var(--danger-soft)" : "var(--success-soft)",
                                    color: task.ai_mode === "AI-free" ? "var(--danger)" : "var(--success)",
                                    fontWeight: 700,
                                  }}
                                >
                                  {task.ai_mode}
                                </span>
                                <span>{task.difficulty}</span>
                              </div>
                            </div>
                            <p>
                              {task.layer} QATLAMI · {skillNames[task.skill_id] ?? ""}
                            </p>
                            <h2>{task.title}</h2>
                            <div className="task-card-meta">
                              <span>
                                <Icon name="clock" size={15} />
                                {task.duration_minutes} daqiqa
                              </span>
                              <span>
                                <Icon name="award" size={15} />+{task.reward_points} ball
                              </span>
                            </div>
                            <div className="task-progress">
                              <div>
                                <span>Qatlam natijasi</span>
                                <b>{layerScore == null ? "Dalil yo‘q" : `${Math.round(layerScore)}/100`}</b>
                              </div>
                              <i>
                                <em style={{ width: `${((layerScore ?? 0) * mainEase).toFixed(1)}%` }} />
                              </i>
                            </div>
                            <button
                              className={task.layer === "DO" ? "primary-button full" : "dark-outline"}
                              style={task.layer === "DO" ? undefined : { width: "100%", justifyContent: "center" }}
                              onClick={() => (task.layer === "DO" ? onStartAssessment() : setInfoTask(task))}
                            >
                              {task.layer === "DO" ? (layerScore == null ? "Topshiriqni boshlash" : "Qayta topshirish") : "Batafsil"}
                              <Icon name="arrow" size={16} />
                            </button>
                          </article>
                        );
                      })}
                  </div>
                </section>
              ))
            )
          ) : (
          <div className="tasks-grid">
            {visibleTasks.map((task) => (
              <article className="card task-card" key={task.title}>
                <div className="task-card-top">
                  <div className={`task-card-icon ${task.tone}`}>
                    <Icon name={task.icon as any} />
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        background: task.aiMode === "AI-free" ? "var(--danger-soft)" : "var(--success-soft)",
                        color: task.aiMode === "AI-free" ? "var(--danger)" : "var(--success)",
                        fontWeight: 700,
                      }}
                    >
                      {task.aiMode}
                    </span>
                    <span>{task.level}</span>
                  </div>
                </div>
                <p>{task.layer} QATLAMI</p>
                <h2>{task.title}</h2>
                <div className="task-card-meta">
                  <span>
                    <Icon name="clock" size={15} />
                    {task.duration}
                  </span>
                  <span>
                    <Icon name="award" size={15} />
                    {task.reward}
                  </span>
                </div>
                <div className="task-progress">
                  <div>
                    <span>Jarayon</span>
                    <b>{Math.round((isNewUser ? 0 : 40) * mainEase)}%</b>
                  </div>
                  <i>
                    <em style={{ width: `${((isNewUser ? 0 : 40) * mainEase).toFixed(1)}%` }} />
                  </i>
                </div>
                <button
                  className="primary-button full"
                  onClick={onStartAssessment}
                >
                  {isNewUser ? "Topshiriqni boshlash" : task.status}
                  <Icon name="arrow" size={16} />
                </button>
              </article>
            ))}
          </div>
          )}
        </div>
      )}

      {activePage === "career" && (
        <div className="page">
          <PageIntro
            kicker="CAREER DNA & AI COACH"
            title="Karyera yo‘li va Moslik"
            description="Hozirgi ko‘nikmalaringizdan maqsadli rolingizgacha bo‘lgan shaxsiy rivojlanish xaritasi."
            action={
              <button className="primary-button" onClick={() => setCoachModalOpen(true)}>
                AI Coach bilan suhbat <Icon name="arrow" size={18} />
              </button>
            }
          />
          {careerLive ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", margin: "0 0 12px" }}>
                <SourceBadge live />
                {careerList.length > 1 && (
                  <>
                    <span style={{ fontSize: "12.5px", color: "var(--muted)", marginLeft: "6px" }}>Boshqa rollar:</span>
                    {careerList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCareer(c.id)}
                        disabled={careerLoading}
                        style={{
                          padding: "5px 11px",
                          borderRadius: "14px",
                          fontSize: "12.5px",
                          cursor: "pointer",
                          border: c.id === careerData.id ? "1.5px solid var(--accent-400)" : "1px solid var(--border)",
                          background: c.id === careerData.id ? "var(--accent-soft)" : "var(--surface-2)",
                          color: "var(--ink-2)",
                          fontWeight: c.id === careerData.id ? 700 : 500,
                        }}
                      >
                        {c.roleName} · {c.matchPct == null ? "—" : `${round1(c.matchPct)}%`}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <section className="career-hero card">
                <div>
                  <span className="small-badge">
                    <Icon name="briefcase" size={15} /> MAQSADLI ROL
                  </span>
                  <h2>{careerData.roleName ?? "Kasb profili tanlanmagan"}</h2>
                  <p>
                    {!careerData.roleName
                      ? careerData.coachTip
                      : careerData.matchPct == null
                      ? `Majburiy ko‘nikma yetishmaydi${
                          careerData.missing_must?.length
                            ? ` (${careerData.gaps
                                ?.filter((g: any) => careerData.missing_must.includes(g.skill))
                                .map((g: any) => g.name)
                                .join(", ")})`
                            : ""
                        } — moslik foizi shu ko‘nikma isbotlangandan keyin hisoblanadi.`
                      : `Siz ushbu rol talablariga ${round1(careerData.matchPct)}% mos kelasiz.${
                          careerData.explanation?.strongest?.length ? ` Kuchli tomon: ${careerData.explanation.strongest.join("; ")}.` : ""
                        }`}
                  </p>
                </div>
                <div className="match-ring">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" />
                    <circle
                      className="match-value"
                      cx="60"
                      cy="60"
                      r="50"
                      style={{
                        strokeDasharray: `${Math.round(314 * ((careerData.matchPct ?? 0) / 100) * mainEase)} 314`,
                        animation: "none",
                      }}
                    />
                  </svg>
                  <strong>
                    {careerData.matchPct == null ? "—" : Math.round(careerData.matchPct * mainEase)}
                    {careerData.matchPct != null && <small>%</small>}
                  </strong>
                  <span>moslik</span>
                </div>
              </section>

              <section className="career-layout">
                <div className="card roadmap">
                  <div className="section-heading compact">
                    <div>
                      <h2>Shaxsiy rivojlanish xaritasi (30/60/90 reja)</h2>
                      <p>Eng katta bo‘shliqlar bo‘yicha tavsiya etilgan qadamlar</p>
                    </div>
                    <span>
                      Taxminiy muddat <strong>{careerData.roadmap?.length ? `${careerData.roadmap.length * 30} kun` : "—"}</strong>
                    </span>
                  </div>
                  {(careerData.roadmap ?? []).length === 0 && (
                    <p style={{ fontSize: "14px", color: "var(--muted)" }}>Barcha talablar bajarilgan — reja talab qilinmaydi.</p>
                  )}
                  {(careerData.roadmap ?? []).map((step: any, index: number) => {
                    const state = step.status === "done" || step.status === "completed" ? "done" : step.status === "current" ? "current" : "next";
                    return (
                      <div className={`roadmap-row ${state}`} key={`${step.phase}-${step.title}`}>
                        <div className="road-node">{state === "done" ? <Icon name="check" size={16} /> : index + 1}</div>
                        <div>
                          <strong>{step.title}</strong>
                          <span>
                            {step.target_layer} qatlami · qayta baholash: {fmtDate(step.reassess_on)}
                          </span>
                        </div>
                        <b>{step.phase}</b>
                      </div>
                    );
                  })}
                </div>

                <aside className="card gaps-card">
                  <p className="card-kicker">ASOSIY SKILL GAP’LAR</p>
                  <h2>Rivojlantirish kerak</h2>
                  {(careerData.gaps ?? []).length === 0 && (
                    <p style={{ fontSize: "14px", color: "var(--muted)" }}>Bo‘shliqlar yo‘q.</p>
                  )}
                  {(careerData.gaps ?? []).map((gap: any, index: number) => {
                    const gProgress = getDnaSkillProgress(index);
                    const cur = gap.current ?? 0;
                    return (
                      <div className="gap-item" key={gap.skill ?? gap.name}>
                        <div>
                          <strong>
                            {gap.name}
                            {gap.must && <span style={{ color: "var(--danger)", fontSize: "11px", fontWeight: 800, marginLeft: "6px" }}>MAJBURIY</span>}
                          </strong>
                          <span>
                            {Math.round(cur * gProgress)}/{gap.needed} <b>+{round1(gap.gap)} kerak</b>
                          </span>
                        </div>
                        <i>
                          <em style={{ width: `${(cur * gProgress).toFixed(1)}%` }} />
                        </i>
                      </div>
                    );
                  })}
                  <div
                    className="coach-tip"
                    style={{ cursor: "pointer" }}
                    onClick={() => setCoachModalOpen(true)}
                    title="AI Career Coach bilan suhbatlashish"
                  >
                    <div className="proof-icon">
                      <Icon name="dna" />
                    </div>
                    <div>
                      <strong>AI Career Coach tavsiyasi</strong>
                      <span>
                        {careerData.coachTip} <b style={{ color: "var(--teal)", marginLeft: "4px" }}>AI bilan suhbatlashish ↗</b>
                      </span>
                    </div>
                  </div>
                </aside>
              </section>
            </>
          ) : (
            <>
              <SourceBadge live={false} style={{ marginBottom: "12px" }} />
          <section className="career-hero card">
            <div>
              <span className="small-badge">
                <Icon name="briefcase" size={15} /> MAQSADLI ROL
              </span>
              <h2>{currentDir.careerTarget.roleName}</h2>
              <p>
                {isNewUser
                  ? "Siz hali baholash topshiriqlarini topshirmadingiz (0% moslik). Rivojlanish xaritasi va moslik ko‘rsatkichini shakllantirish uchun birinchi topshiriqni bajaring."
                  : `Siz ushbu rol talablariga ${currentDir.careerTarget.matchPct}% mos kelasiz. Yetishmayotgan asosiy kompetensiyalarni rivojlantiring.`}
              </p>
            </div>
            <div className="match-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" />
                <circle
                  className="match-value"
                  cx="60"
                  cy="60"
                  r="50"
                  style={{
                    strokeDasharray: `${Math.round(314 * ((isNewUser ? 0 : currentDir.careerTarget.matchPct) / 100) * mainEase)} 314`,
                    animation: "none",
                  }}
                />
              </svg>
              <strong>
                {Math.round((isNewUser ? 0 : currentDir.careerTarget.matchPct) * mainEase)}
                <small>%</small>
              </strong>
              <span>moslik</span>
            </div>
          </section>

          <section className="career-layout">
            <div className="card roadmap">
              <div className="section-heading compact">
                <div>
                  <h2>Shaxsiy rivojlanish xaritasi (30/60/90 reja)</h2>
                  <p>L4 darajasiga tavsiya etilgan qadamlar</p>
                </div>
                <span>
                  Taxminiy muddat <strong>8 hafta</strong>
                </span>
              </div>
              {(isNewUser
                ? [
                    ["current", "Asosiy nazariya va kod yechimlari", "0 / 4 topshiriq", "Boshlash"],
                    ["next", "Parametrli chellinjlar va moslashuv", "0 / 4 topshiriq", "Kutilmoqda"],
                    ["next", "AI Viva orqali yechimni himoya qilish", "0 / 2 sessiya", "Keyingi"],
                    ["locked", "Loyiha va Open-Source hissasi (PROVE)", "L4 bosqichida ochiladi", "Qulflangan"],
                  ]
                : [
                    ["done", "Asosiy nazariya va kod yechimlari", "Bajarildi · 90/100", "Tekshirilgan"],
                    ["current", "Parametrli chellinjlar va moslashuv", "2 / 4 topshiriq", "Jarayonda"],
                    ["next", "AI Viva orqali yechimni himoya qilish", "0 / 2 sessiya", "Keyingi"],
                    ["locked", "Loyiha va Open-Source hissasi (PROVE)", "L4 bosqichida ochiladi", "Qulflangan"],
                  ]
              ).map(([state, title, text, tag], index) => (
                <div className={`roadmap-row ${state}`} key={title}>
                  <div className="road-node">{state === "done" ? <Icon name="check" size={16} /> : index + 1}</div>
                  <div>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </div>
                  <b>{tag}</b>
                </div>
              ))}
            </div>

            <aside className="card gaps-card">
              <p className="card-kicker">ASOSIY SKILL GAP’LAR</p>
              <h2>Rivojlantirish kerak</h2>
              {currentDir.careerTarget.gaps.map((gap, index) => {
                const gProgress = getDnaSkillProgress(index);
                const targetCurrent = isNewUser ? 0 : gap.current;
                const currentScore = Math.round(targetCurrent * gProgress);
                const currentWidth = (targetCurrent * gProgress).toFixed(1);
                const neededDiff = isNewUser ? gap.needed : gap.needed - gap.current;
                return (
                  <div className="gap-item" key={gap.skill}>
                    <div>
                      <strong>{gap.skill}</strong>
                      <span>
                        {currentScore}/100 <b>+{neededDiff} kerak</b>
                      </span>
                    </div>
                    <i>
                      <em style={{ width: `${currentWidth}%` }} />
                    </i>
                  </div>
                );
              })}
              <div
                className="coach-tip"
                style={{ cursor: "pointer" }}
                onClick={() => setCoachModalOpen(true)}
                title="AI Career Coach bilan suhbatlashish"
              >
                <div className="proof-icon">
                  <Icon name="dna" />
                </div>
                <div>
                  <strong>AI Career Coach tavsiyasi</strong>
                  <span>
                    Avval eng katta bo‘shliqqa ega ko‘nikmani yakunlang — bu qolgan kompetensiyalarga ham ijobiy ta’sir ko‘rsatadi. <b style={{ color: "var(--teal)", marginLeft: "4px" }}>AI bilan suhbatlashish ↗</b>
                  </span>
                </div>
              </div>
            </aside>
          </section>
            </>
          )}
        </div>
      )}

      {activePage === "certificates" && (
        <div className="page">
          <PageIntro
            kicker="OPEN BADGES 3.0 / W3C VC"
            title="Sertifikatlar va Raqamli nishonlar"
            description="Ish beruvchilar dunyoning istalgan nuqtasidan ochiq tekshira oladigan, dalillarga asoslangan raqamli sertifikatlaringiz."
          />
          {credsLive ? (
            <>
              <SourceBadge live style={{ marginBottom: "12px" }} />
              {(() => {
                const issued = (credentials ?? []).filter((c) => c.status === "issued");
                const best = [...issued].sort((a, b) => levelNum(b.level) - levelNum(a.level))[0];
                return best ? (
                  <section className="certificate-summary card">
                    <div className="cert-seal">
                      <Icon name="award" size={33} />
                    </div>
                    <div>
                      <span>ENG YUQORI DARAJA</span>
                      <h2>{best.title}</h2>
                      <p>
                        {fmtDate(best.issued_at)} da berilgan · {issued.length} ta faol sertifikat
                      </p>
                    </div>
                    <span className="verified large">
                      <Icon name="check" /> Open Badges 3.0
                    </span>
                  </section>
                ) : (
                  <section className="card" style={{ textAlign: "center", padding: "36px 24px", margin: "0 0 20px" }}>
                    <div className="cert-seal" style={{ margin: "0 auto 16px" }}>
                      <Icon name="award" size={33} />
                    </div>
                    <h2 style={{ fontSize: "20px", marginBottom: "8px", color: "var(--navy)" }}>Hozircha faol sertifikatlar mavjud emas</h2>
                    <p style={{ maxWidth: "540px", margin: "0 auto", color: "var(--muted)", fontSize: "14px", lineHeight: "1.6" }}>
                      Sertifikat ko‘nikma kamida L3 darajaga va 60% Confidence’ga yetganda, ochiq integrity bayroqlari bo‘lmasa chiqariladi.
                    </p>
                  </section>
                );
              })()}

              {(credentials ?? []).length > 0 && (
                <div className="cert-grid">
                  {(credentials ?? []).map((c) => {
                    const lvl = levelNum(c.level);
                    const tone = lvl >= 4 ? "emerald" : lvl === 3 ? "blue" : "violet";
                    const vr = verifyResult[c.id];
                    const revoked = c.status !== "issued";
                    return (
                      <article className="certificate card" key={c.id} style={revoked ? { opacity: 0.75 } : undefined}>
                        <div className={`certificate-band ${tone}`}>
                          <Logo size="sm" showTagline={false} />
                          <div className="cert-mini-seal">
                            <Icon name="award" />
                          </div>
                        </div>
                        <div className="certificate-body">
                          <p>
                            SKILL DNA SERTIFIKATI ·{" "}
                            <span style={{ color: revoked ? "var(--danger)" : "var(--success-fg)", fontWeight: 800 }}>
                              {revoked ? "BEKOR QILINGAN" : "FAOL"}
                            </span>
                          </p>
                          <h2>{c.title}</h2>
                          <strong>{c.level}</strong>
                          <div>
                            <span>Sertifikat ID</span>
                            <b>{c.code}</b>
                          </div>
                          <div>
                            <span>{revoked ? "Bekor qilingan sana" : "Berilgan sana"}</span>
                            <b>{fmtDate(revoked ? c.revoked_at : c.issued_at)}</b>
                          </div>
                          {vr && (
                            <div
                              style={{
                                fontSize: "12.5px",
                                padding: "6px 9px",
                                borderRadius: "8px",
                                background: vr.loading ? "var(--surface-2)" : vr.valid ? "var(--success-soft)" : "var(--danger-soft)",
                                color: vr.loading ? "var(--muted)" : vr.valid ? "var(--success-fg)" : "var(--danger-fg)",
                                display: "block",
                              }}
                            >
                              {vr.loading
                                ? "Tekshirilmoqda..."
                                : vr.error
                                ? vr.error
                                : vr.valid
                                ? `Haqiqiy · imzo ${vr.signature_valid ? "to‘g‘ri" : "noto‘g‘ri"} · ${vr.issuer?.name ?? ""}`
                                : `Yaroqsiz · holat: ${vr.status}${vr.signature_valid === false ? " · imzo noto‘g‘ri" : ""}`}
                            </div>
                          )}
                          <div className="certificate-actions">
                            <button onClick={() => copyLink(c.verify_url)}>Ulashish</button>
                            <button onClick={() => verifyCred(c.id)}>Tekshirish</button>
                          </div>
                          <button
                            className="secondary-button"
                            style={{ width: "100%", marginTop: "8px" }}
                            onClick={() => printCredential(c, profileName).catch((e: Error) => setIssueMsg({ ok: false, text: e.message }))}
                          >
                            <Icon name="download" size={14} /> QR bilan PDF
                          </button>
                          <a
                            href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/v1/verify/${c.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: "12px", color: "var(--accent)", display: "block", marginTop: "6px" }}
                          >
                            Ochiq tekshiruv havolasi ↗
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {live && (live.skills ?? []).some((sk: any) => (sk.evidenceCount ?? 0) > 0) && (
                <section className="card" style={{ padding: "18px 20px", marginTop: "20px" }}>
                  <div className="section-heading compact" style={{ marginBottom: "10px" }}>
                    <div>
                      <h2>Sertifikat chiqarish</h2>
                      <p>Talab: kamida L3 daraja, 60% Confidence va ochiq integrity bayroqlari yo‘q.</p>
                    </div>
                  </div>
                  {(live.skills ?? [])
                    .filter((sk: any) => (sk.evidenceCount ?? 0) > 0)
                    .map((sk: any) => {
                      const eligible = levelNum(sk.level) >= 3 && (sk.confidence ?? 0) >= 60 && !(sk.open_flags ?? []).length;
                      const has = (credentials ?? []).some((c) => c.status === "issued" && c.title === `${sk.name} — ${sk.level}`);
                      return (
                        <div
                          key={sk.id}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderTop: "1px solid var(--border-soft)" }}
                        >
                          <div>
                            <strong style={{ fontSize: "14.5px", color: "var(--navy)" }}>{sk.name}</strong>
                            <span style={{ display: "block", fontSize: "12.5px", color: "var(--muted)" }}>
                              {sk.level} · {Math.round(sk.score ?? 0)}/100 · {Math.round(sk.confidence ?? 0)}% Confidence
                              {(sk.open_flags ?? []).length ? " · ochiq integrity bayrog‘i" : ""}
                            </span>
                          </div>
                          <button
                            className={eligible && !has ? "primary-button" : "dark-outline"}
                            style={{ width: "auto", whiteSpace: "nowrap" }}
                            disabled={issuing === sk.id || has}
                            onClick={() => issueFor(sk)}
                            title={eligible ? "" : "Talablar hali bajarilmagan — server sababini ko‘rsatadi"}
                          >
                            {issuing === sk.id ? "Chiqarilmoqda..." : has ? "Chiqarilgan ✓" : "Chiqarish"}
                          </button>
                        </div>
                      );
                    })}
                  {issueMsg && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "9px 12px",
                        borderRadius: "9px",
                        fontSize: "13.5px",
                        background: issueMsg.ok ? "var(--success-soft)" : "var(--danger-soft)",
                        color: issueMsg.ok ? "var(--success-fg)" : "var(--danger-fg)",
                      }}
                    >
                      {issueMsg.text}
                    </div>
                  )}
                </section>
              )}
              {shared && (
                <div className="toast">
                  <Icon name="check" /> Sertifikat tekshiruv havolasi (OB 3.0) nusxalandi
                  <button onClick={() => setShared(false)}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <SourceBadge live={false} style={{ marginBottom: "12px" }} />
          {isNewUser ? (
            <section className="card" style={{ textAlign: "center", padding: "50px 24px", margin: "20px 0" }}>
              <div className="cert-seal" style={{ margin: "0 auto 16px" }}>
                <Icon name="award" size={33} />
              </div>
              <h2 style={{ fontSize: "20px", marginBottom: "8px", color: "var(--navy)" }}>Hozircha faol sertifikatlar mavjud emas</h2>
              <p style={{ maxWidth: "540px", margin: "0 auto 24px", color: "var(--muted)", fontSize: "14px", lineHeight: "1.6" }}>
                Skill DNA sertifikatlari va Open Badges 3.0 nishonlari ko‘nikmalaringizni 5 qatlamli amaliy topshiriqlar va AI Viva orqali tasdiqlaganingizdan so‘ng avtomatik tarzda shakllanadi.
              </p>
              <button className="primary-button" style={{ margin: "0 auto", display: "inline-flex" }} onClick={onStartAssessment}>
                Birinchi topshiriqni boshlash <Icon name="arrow" size={16} />
              </button>
            </section>
          ) : (
            <>
              <section className="certificate-summary card">
                <div className="cert-seal">
                  <Icon name="award" size={33} />
                </div>
                <div>
                  <span>ENG YUQORI DARAJA</span>
                  <h2>{primarySkill.name} · {primarySkill.level}</h2>
                  <p>2026-yil may oyida tasdiqlangan · {primarySkill.evidenceCount} ta dalil</p>
                </div>
                <span className="verified large">
                  <Icon name="check" /> Open Badges 3.0
                </span>
              </section>

              <div className="cert-grid">
                {[
                  [primarySkill.name, primarySkill.level, "SD-26-SK-01928", "8 may, 2026", "emerald"],
                  ["KNOW Nazariy bilim sertifikati", "L3", "SD-26-TH-00841", "22 aprel, 2026", "blue"],
                  ["DO Amaliy dasturlash sertifikati", "L3", "SD-26-PR-00637", "4 mart, 2026", "violet"],
                ].map(([title, level, id, date, tone]) => (
                  <article className="certificate card" key={title}>
                    <div className={`certificate-band ${tone}`}>
                      <Logo size="sm" showTagline={false} />
                      <div className="cert-mini-seal">
                        <Icon name="award" />
                      </div>
                    </div>
                    <div className="certificate-body">
                      <p>SKILL DNA SERTIFIKATI</p>
                      <h2>{title}</h2>
                      <strong>{level} · MUTAXASSIS</strong>
                      <div>
                        <span>Sertifikat ID</span>
                        <b>{id}</b>
                      </div>
                      <div>
                        <span>Berilgan sana</span>
                        <b>{date}</b>
                      </div>
                      <div className="certificate-actions">
                        <button onClick={() => setShared(true)}>Ulashish</button>
                        <button>Yuklab olish</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {shared && (
                <div className="toast">
                  <Icon name="check" /> Sertifikat tekshiruv havolasi (OB 3.0) nusxalandi
                  <button onClick={() => setShared(false)}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
            </>
          )}
            </>
          )}
        </div>
      )}

      {activePage === "settings" && (
        <div className="page">
          <PageIntro
            kicker="HISOB VA XAVFSIZLIK"
            title="Sozlamalar va Rozilik (Consent)"
            description="Profil ma’lumotlari, AI Viva audio yozuvlari va ish beruvchilarga ma’lumot ulashish roziligini boshqaring."
          />
          <section className="settings-layout">
            <div className="card settings-nav">
              {["Profil", "Rozilik (Consent)", "Bildirishnomalar", "Xavfsizlik"].map((item, index) => (
                <button
                  className={settingsTab === item ? "active" : ""}
                  onClick={() => setSettingsTab(item)}
                  key={item}
                >
                  <Icon name={index === 0 ? "file" : index === 1 ? "shield" : index === 2 ? "bell" : "settings"} />
                  {item}
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </div>

            <div className="card settings-panel">
              <div className="settings-title">
                <div>
                  <h2>{settingsTab}</h2>
                  <p>
                    {settingsTab === "Profil"
                      ? "Shaxsiy va kasbiy profilingiz ma’lumotlari."
                      : settingsTab === "Rozilik (Consent)"
                      ? "Tizim ma’lumotlaridan foydalanish bo‘yicha alohida roziliklar."
                      : `${settingsTab} parametrlarini o‘zingizga moslang.`}
                  </p>
                </div>
                <span className="national-badge">
                  <Icon name="check" size={14} /> Ma’lumotlar O‘zbekistonda saqlanadi
                </span>
              </div>

              {settingsTab === "Profil" && (
                <>
                  <div className="profile-photo-row">
                    <div className="settings-avatar">{profileAvatar}</div>
                    <div>
                      <strong>Profil rasmi</strong>
                      <span>JPG yoki PNG, maksimal 2 MB</span>
                      <button type="button">Rasmni almashtirish</button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label>
                      To‘liq ism
                      <input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Ism va familiyangizni kiriting"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="example@mail.com"
                      />
                    </label>
                    <label>
                      Telefon raqami
                      <input
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+998 90 123 45 67"
                      />
                    </label>
                    <label>
                      Kasbiy yo‘nalish
                      <input
                        value={currentDir.title}
                        readOnly
                        style={{ background: "var(--surface-2)", cursor: "not-allowed" }}
                      />
                    </label>
                    <label className="full-field">
                      Qisqacha bio
                      <textarea
                        value={profileBio}
                        onChange={(e) => setProfileBio(e.target.value)}
                        placeholder="O‘zingiz haqingizda qisqacha ma’lumot..."
                      />
                    </label>
                  </div>
                </>
              )}

              {settingsTab === "Rozilik (Consent)" && consents && (
                <>
                  <SourceBadge live style={{ marginBottom: "10px" }} />
                  <div className="preference-list">
                    {[
                      {
                        type: "data_processing",
                        title: "Shaxsiy ma’lumotlar va natijalarni qayta ishlashga roziman",
                        desc: "Topshiriq natijalari va dalillaringiz asosida Skill DNA hisoblanishi uchun zarur.",
                      },
                      {
                        type: "viva_record",
                        title: "AI Viva audio va transkript yozuvlarini saqlashga roziman",
                        desc: "AI Viva (DEFEND qatlami) uchun talab qilinadi — rozilik bo‘lmasa yangi Viva sessiyasini boshlab bo‘lmaydi.",
                      },
                      {
                        type: "employer_share",
                        title: "Tasdiqlangan Skill DNA profilimni ish beruvchilarga ko‘rsatish",
                        desc: "Ish beruvchilar faqat shu rozilikni bergan talabalarni qidiruvda ko‘radi.",
                      },
                    ].map((item) => {
                      const c = consents.find((x) => x.type === item.type);
                      const granted = !!c?.granted;
                      const busy = consentBusy === item.type;
                      return (
                        <div key={item.type}>
                          <div>
                            <strong>{item.title}</strong>
                            <span>
                              {item.desc} {granted ? `Berilgan: ${fmtDate(c?.granted_at)}.` : "Hozir berilmagan."} Istalgan vaqtda bekor qilishingiz mumkin.
                            </span>
                          </div>
                          <button
                            className={`toggle ${granted ? "on" : ""}`}
                            aria-label={item.title}
                            aria-pressed={granted}
                            disabled={busy}
                            style={busy ? { opacity: 0.6 } : undefined}
                            onClick={() => toggleConsent(item.type, !granted)}
                          >
                            <i />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {consentError && (
                    <div style={{ marginTop: "10px", padding: "9px 12px", borderRadius: "9px", fontSize: "13.5px", background: "var(--danger-soft)", color: "var(--danger-fg)" }}>
                      {consentError}
                    </div>
                  )}
                </>
              )}

              {settingsTab === "Rozilik (Consent)" && !consents && (
                <>
                  <SourceBadge live={false} style={{ marginBottom: "10px" }} />
                <div className="preference-list">
                  {[
                    "AI Viva audio va transkript yozuvlarini saqlashga roziman",
                    "Tasdiqlangan Skill DNA profilimni ish beruvchilarga ko‘rsatish",
                    "AI-assisted rejimida yozilgan promptlarim tahlil qilinishiga roziman",
                    "Universitet rektoratiga o‘zlashtirish hisobotlarimni ko‘rsatish",
                  ].map((item, index) => (
                    <div key={item}>
                      <div>
                        <strong>{item}</strong>
                        <span>
                          {index === 1
                            ? "Faqat L3 va undan yuqori tasdiqlangan dalillar ko‘rinadi."
                            : "Istalgan vaqtda rozilikni bekor qilish huquqiga egasiz."}
                        </span>
                      </div>
                      <button className="toggle on" aria-label={item}>
                        <i />
                      </button>
                    </div>
                  ))}
                </div>
                </>
              )}

              {settingsTab !== "Profil" && settingsTab !== "Rozilik (Consent)" && (
                <div className="preference-list">
                  {[
                    "Muhim faoliyat haqida xabar berish",
                    "Haftalik natijalar hisoboti",
                    "Yangi topshiriqlar tavsiyasi",
                  ].map((item, index) => (
                    <div key={item}>
                      <div>
                        <strong>{item}</strong>
                        <span>Ilova ichida va email orqali boshqaring.</span>
                      </div>
                      <button className={`toggle ${index !== 2 ? "on" : ""}`} aria-label={item}>
                        <i />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="settings-footer">
                <button
                  className="primary-button"
                  onClick={async () => {
                    if (user) {
                      try {
                        await api.updateMe({
                          full_name: profileName,
                          phone: profilePhone,
                          bio: profileBio,
                        });
                        const newAvatar = profileName
                          ? profileName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()
                          : profileAvatar;
                        setProfileAvatar(newAvatar);
                        const updated = {
                          ...user,
                          name: profileName,
                          email: profileEmail,
                          phone: profilePhone,
                          bio: profileBio,
                          avatar: newAvatar,
                        };
                        localStorage.setItem("skill_dna_user", JSON.stringify(updated));
                      } catch (err) {
                        console.error("Profile update failed:", err);
                      }
                    }
                    setSettingsSaved(true);
                    setTimeout(() => setSettingsSaved(false), 2200);
                  }}
                >
                  O‘zgarishlarni saqlash
                </button>
                {settingsSaved && (
                  <span>
                    <Icon name="check" size={15} /> Saqlandi
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* AI Career Coach Chat Modal */}
      <CareerCoachModal
        isOpen={coachModalOpen}
        onClose={() => setCoachModalOpen(false)}
        targetRole={careerLive ? careerData.roleName : currentDir.careerTarget.roleName}
        matchPct={careerLive ? careerData.matchPct : currentDir.careerTarget.matchPct}
        careerId={careerLive ? careerData.id ?? undefined : undefined}
        live={careerLive}
      />

      {/* Verifiable Evidence Graph Modal */}
      <EvidenceGraphModal
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        skillName={primarySkill.name}
        skillId={livePrimary?.id}
      />

      {whyOpen && (
        <WhyScoreModal skillId={livePrimary?.id ?? null} skillName={primarySkill.name} onClose={() => setWhyOpen(false)} />
      )}

      {infoTask && <TaskInfoModal task={infoTask} skillName={skillNames[infoTask.skill_id]} onClose={() => setInfoTask(null)} />}
    </>
  );
}
