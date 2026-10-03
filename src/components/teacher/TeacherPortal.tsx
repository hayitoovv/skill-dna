import { useState, useEffect, useMemo } from "react";
import { Icon } from "../common/Icons";
import { teacherGroupData } from "../../data/ontology";

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
      { name: "Backend & REST API", score: 86 },
      { name: "SQL & Databases", score: 82 },
      { name: "OOP Patterns", score: 81 },
    ],
    layers: { KNOW: 88, DO: 86, ADAPT: 78, DEFEND: 84, PROVE: 79 },
  },
  {
    id: "st-2",
    name: "Bobur Mirzayev",
    email: "bobur.mirzayev@bdtu.uz",
    avatar: "BM",
    overallScore: 85,
    level: "L4",
    confidence: 84,
    evidenceCount: 21,
    status: "Bozorga tayyor",
    topSkills: [
      { name: "Backend & Microservices", score: 89 },
      { name: "DevOps & CI/CD", score: 82 },
      { name: "System Design", score: 85 },
    ],
    layers: { KNOW: 91, DO: 88, ADAPT: 82, DEFEND: 81, PROVE: 85 },
  },
  {
    id: "st-3",
    name: "Madina Karimova",
    email: "madina.karimova@bdtu.uz",
    avatar: "MK",
    overallScore: 79,
    level: "L3",
    confidence: 78,
    evidenceCount: 14,
    status: "Bozorga tayyor",
    topSkills: [
      { name: "SQL & Optimizatsiya", score: 86 },
      { name: "Backend REST", score: 78 },
      { name: "Algoritmlar", score: 75 },
    ],
    layers: { KNOW: 84, DO: 80, ADAPT: 76, DEFEND: 82, PROVE: 73 },
  },
  {
    id: "st-4",
    name: "Shaxzod Alimov",
    email: "shaxzod.alimov@bdtu.uz",
    avatar: "SA",
    overallScore: 78,
    level: "L3",
    confidence: 76,
    evidenceCount: 12,
    status: "Faol rivojlanmoqda",
    topSkills: [
      { name: "SQL va MB", score: 84 },
      { name: "Backend REST", score: 76 },
      { name: "Algoritmlar", score: 74 },
    ],
    layers: { KNOW: 82, DO: 79, ADAPT: 74, DEFEND: 80, PROVE: 71 },
  },
  {
    id: "st-5",
    name: "Sardor Ergashev",
    email: "sardor.ergashev@bdtu.uz",
    avatar: "SE",
    overallScore: 75,
    level: "L3",
    confidence: 73,
    evidenceCount: 10,
    status: "Faol rivojlanmoqda",
    topSkills: [
      { name: "DSA & Algoritmlar", score: 78 },
      { name: "Backend REST", score: 74 },
      { name: "SQL & MB", score: 72 },
    ],
    layers: { KNOW: 80, DO: 76, ADAPT: 71, DEFEND: 75, PROVE: 68 },
  },
  {
    id: "st-6",
    name: "Javohir Toshmatov",
    email: "javohir.toshmatov@bdtu.uz",
    avatar: "JT",
    overallScore: 71,
    level: "L3",
    confidence: 69,
    evidenceCount: 9,
    status: "Faol rivojlanmoqda",
    topSkills: [
      { name: "OOP Patterns", score: 77 },
      { name: "SQL & MB", score: 70 },
      { name: "DevOps", score: 62 },
    ],
    layers: { KNOW: 78, DO: 72, ADAPT: 67, DEFEND: 74, PROVE: 61 },
  },
  {
    id: "st-7",
    name: "Nilufar Rahimova",
    email: "nilufar.rahimova@bdtu.uz",
    avatar: "NR",
    overallScore: 72,
    level: "L3",
    confidence: 70,
    evidenceCount: 8,
    status: "Faol rivojlanmoqda",
    topSkills: [
      { name: "Backend REST", score: 75 },
      { name: "SQL & MB", score: 73 },
      { name: "Algoritmlar", score: 68 },
    ],
    layers: { KNOW: 79, DO: 73, ADAPT: 66, DEFEND: 73, PROVE: 63 },
  },
  {
    id: "st-8",
    name: "Jasur Qodirov",
    email: "jasur.qodirov@bdtu.uz",
    avatar: "JQ",
    overallScore: 64,
    level: "L2",
    confidence: 62,
    evidenceCount: 6,
    status: "Bo‘shliq aniqlangan",
    topSkills: [
      { name: "SQL & MB", score: 68 },
      { name: "Backend REST", score: 65 },
      { name: "DevOps & CI/CD", score: 48 },
    ],
    layers: { KNOW: 72, DO: 66, ADAPT: 58, DEFEND: 64, PROVE: 52 },
  },
  {
    id: "st-9",
    name: "Rustam Xoliqov",
    email: "rustam.xoliqov@bdtu.uz",
    avatar: "RX",
    overallScore: 63,
    level: "L2",
    confidence: 60,
    evidenceCount: 6,
    status: "Bo‘shliq aniqlangan",
    topSkills: [
      { name: "Backend REST", score: 66 },
      { name: "Algoritmlar (DSA)", score: 58 },
      { name: "DevOps & CI/CD", score: 50 },
    ],
    layers: { KNOW: 71, DO: 65, ADAPT: 56, DEFEND: 63, PROVE: 51 },
  },
  {
    id: "st-10",
    name: "Malika Umarova",
    email: "malika.umarova@bdtu.uz",
    avatar: "MU",
    overallScore: 59,
    level: "L2",
    confidence: 58,
    evidenceCount: 5,
    status: "Remedial kerak",
    topSkills: [
      { name: "Backend REST", score: 62 },
      { name: "Algoritmlar (DSA)", score: 51 },
      { name: "DevOps & CI/CD", score: 42 },
    ],
    layers: { KNOW: 67, DO: 59, ADAPT: 52, DEFEND: 61, PROVE: 48 },
  },
];

export default function TeacherPortal() {
  const [proveQueue, setProveQueue] = useState(teacherGroupData.proveQueue);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"heatmap" | "matrix" | "queue" | "remedial">("heatmap");
  const [selectedLayerKey, setSelectedLayerKey] = useState<"KNOW" | "DO" | "ADAPT" | "DEFEND" | "PROVE">("DO");

  // Filter and Search for Student Matrix
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixFilter, setMatrixFilter] = useState("Barchasi");

  // Inspect Student Modal State
  const [inspectedStudent, setInspectedStudent] = useState<GroupStudent | null>(null);

  // Remedial Generator Wizard State
  const [remedialModalOpen, setRemedialModalOpen] = useState(false);
  const [remedialSkill, setRemedialSkill] = useState("DevOps va CI/CD");
  const [remedialDifficulty, setRemedialDifficulty] = useState("L3");
  const [remedialAiMode, setRemedialAiMode] = useState("AI-assisted");
  const [generating, setGenerating] = useState(false);
  const [generatedSuccess, setGeneratedSuccess] = useState(false);

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
    const duration = 1200;
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

  // Radar Polygon Points Calculation
  const radarPoints = useMemo(() => {
    const calcPoint = (targetX: number, targetY: number, score: number) => {
      const frac = ((score / 100) * ease);
      const x = Math.round(150 + frac * (targetX - 150));
      const y = Math.round(132 + frac * (targetY - 132));
      return `${x},${y}`;
    };

    const pKnow = calcPoint(150, 29, 82);
    const pDo = calcPoint(260, 109, 74);
    const pAdapt = calcPoint(218, 238, 68);
    const pDefend = calcPoint(82, 238, 76);
    const pProve = calcPoint(40, 109, 62);

    return {
      polygon: `${pKnow} ${pDo} ${pAdapt} ${pDefend} ${pProve}`,
      pKnow,
      pDo,
      pAdapt,
      pDefend,
      pProve,
    };
  }, [ease]);

  // Selected layer metric
  const selectedLayer = groupLayers.find((l) => l.key === selectedLayerKey) || groupLayers[1];

  // Filtered Students in Matrix
  const filteredStudents = useMemo(() => {
    return initialStudents.filter((st) => {
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
  }, [matrixSearch, matrixFilter]);

  // Handle Prove Approval
  const handleApprove = (id: string, studentName: string, skill: string) => {
    setConfirmedId(id);
    setTimeout(() => {
      setProveQueue((prev) => prev.filter((item) => item.id !== id));
      setConfirmedId(null);
      showToast(`${studentName}ning "${skill}" bo‘yicha L4 sertifikati tasdiqlandi va zanjirga yozildi!`);
    }, 800);
  };

  // Handle Remedial Generator Action
  const handleGenerateRemedial = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGeneratedSuccess(true);
      showToast(`${remedialSkill} bo‘yicha 12 ta parametrli remedial topshiriq talabalar portaliga yuborildi!`);
    }, 1800);
  };

  return (
    <div className="page">
      {/* Welcome Banner */}
      <section className="welcome-row">
        <div>
          <p className="eyebrow">AKADEMIK NAZORAT · O‘QITUVCHI BOSHQARUV PANELI</p>
          <h1>Guruh kompetensiya tahlili & AI Monitoring</h1>
          <p className="subtitle">
            Guruh: <strong>{teacherGroupData.groupCode}</strong> · Yo‘nalish: <strong>{teacherGroupData.directionName}</strong> (28 nafar talaba) · <strong>BSTU</strong>
          </p>
        </div>
        <div className="top-actions">
          <button
            className="primary-button"
            onClick={() => {
              setRemedialModalOpen(true);
              setGeneratedSuccess(false);
            }}
          >
            <Icon name="code" size={17} /> Remedial topshiriq generatsiyasi
          </button>
        </div>
      </section>

      {/* Overview Stat Cards with ease-in counting */}
      <div className="task-overview" style={{ marginBottom: "24px" }}>
        <div className="card overview-stat">
          <div className="stat-icon blue">
            <Icon name="users" />
          </div>
          <div>
            <span>Jami talabalar</span>
            <strong>{Math.round(28 * ease)} nafar</strong>
          </div>
        </div>
        <div className="card overview-stat">
          <div className="stat-icon emerald">
            <Icon name="award" />
          </div>
          <div>
            <span>O‘rtacha Skill Score</span>
            <strong>{Math.round(73 * ease)} / 100</strong>
          </div>
        </div>
        <div className="card overview-stat">
          <div className="stat-icon violet">
            <Icon name="shield" />
          </div>
          <div>
            <span>O‘rtacha Ishonchlilik</span>
            <strong>{Math.round(71 * ease)}%</strong>
          </div>
        </div>
        <div className="card overview-stat">
          <div className="stat-icon amber">
            <Icon name="clock" />
          </div>
          <div>
            <span>Tasdiqlash navbatida (PROVE)</span>
            <strong>{proveQueue.length} ta</strong>
          </div>
        </div>
      </div>

      {/* Hero Split Section: Group 5-Layer Radar + AI Remedial Recommendation Card */}
      <section className="summary-grid" style={{ marginBottom: "24px" }}>
        {/* Left: Group Competency Radar Card */}
        <article className="card dna-card">
          <div className="card-heading">
            <div>
              <p className="card-kicker">GURUH MALAKA RADARI</p>
              <h2>5 qatlamli o‘rtacha guruh profili</h2>
            </div>
            <span className="level-badge">Bozorga moslik: {Math.round(74 * ease)}%</span>
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
                <strong>{Math.round(73 * ease)}</strong>
                <span>/100</span>
                <small>Guruh bali</small>
              </div>
            </div>

            <div className="score-summary">
              <div className="confidence-head">
                <span>Guruh ishonch darajasi</span>
                <strong>{Math.round(71 * ease)}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${(71 * ease).toFixed(1)}%` }} />
              </div>
              <p>Yuqori ishonchlilik · 28 ta talabaning 142 ta tekshirilgan dalillari asosida</p>

              {/* Selected Layer Details */}
              <div className="selected-layer">
                <div className={`layer-icon ${selectedLayer.tone}`}>
                  <Icon name={selectedLayer.icon} />
                </div>
                <div>
                  <span>Tanlangan qatlam tahlili</span>
                  <strong>
                    {selectedLayer.key} · {selectedLayer.label}
                  </strong>
                </div>
                <b>{Math.round(selectedLayer.score * ease)}</b>
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 10px" }}>
                {selectedLayer.desc}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569" }}>
                <span>Yetakchi: <strong style={{ color: "var(--navy)" }}>{selectedLayer.topStudent}</strong></span>
                <span>Yordam zarur: <strong style={{ color: "#ef4444" }}>{selectedLayer.lowStudent}</strong></span>
              </div>
            </div>
          </div>
        </article>

        {/* Right: Next-Card Style AI Remedial Recommendation */}
        <article className="card next-card">
          <div className="next-top">
            <span className="small-badge">
              <Icon name="lightning" size={15} /> AI PEDAGOGIK TAVSIYA
            </span>
            <span className="time">Bugun yangilandi</span>
          </div>

          <div className="task-visual">
            <Icon name="code" size={36} />
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <p className="task-type">REMEDIAL CHELLINJ · AVTOMATIK GENERATSIYA</p>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "4px",
                background: "#10b981",
                color: "white",
                fontWeight: 700,
              }}
            >
              12 talaba
            </span>
          </div>

          <h2>DevOps & CI/CD bo‘yicha 46% bo‘shliq aniqlandi</h2>
          <p>
            Guruhning 12 nafar talabasida Docker va avtomatlashtirishda yetishmovchilik mavjud. Sun’iy intellekt individual parametrli kod topshiriqlari paketini tayyorladi.
          </p>

          <div className="task-meta">
            <span>
              <Icon name="file" size={16} /> 12 ta variant
            </span>
            <span>
              <Icon name="award" size={16} /> +14 ballgacha o‘sish
            </span>
          </div>

          <button
            className="dark-button"
            onClick={() => {
              setRemedialModalOpen(true);
              setGeneratedSuccess(false);
            }}
          >
            AI bilan generatsiya qilish <Icon name="arrow" size={17} />
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
          <span>
            Umumiy tayyorlik <strong>{Math.round(74 * ease)}%</strong>
          </span>
        </div>

        <div className="layer-grid">
          {groupLayers.map((layer) => (
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
                <strong>{Math.round(layer.score * ease)}</strong>
                <span>/ 100</span>
              </div>
              <div className="mini-track">
                <span style={{ width: `${(layer.score * ease).toFixed(1)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Navigation Filter Tabs */}
      <div className="filter-row" style={{ marginBottom: "20px" }}>
        <div className="filter-tabs">
          <button
            className={activeTab === "heatmap" ? "active" : ""}
            onClick={() => setActiveTab("heatmap")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Icon name="chart" size={15} /> Guruh Skill Heatmap
          </button>
          <button
            className={activeTab === "matrix" ? "active" : ""}
            onClick={() => setActiveTab("matrix")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Icon name="users" size={15} /> Talabalar Matritsasi ({initialStudents.length})
          </button>
          <button
            className={activeTab === "queue" ? "active" : ""}
            onClick={() => setActiveTab("queue")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Icon name="shieldCheck" size={15} /> PROVE Tasdiqlash navbati ({proveQueue.length})
          </button>
          <button
            className={activeTab === "remedial" ? "active" : ""}
            onClick={() => setActiveTab("remedial")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Icon name="lightning" size={15} /> Remedial generator
          </button>
        </div>
      </div>

      {/* TAB 1: Skill Heatmap */}
      {activeTab === "heatmap" && (
        <section className="card" style={{ padding: "26px" }}>
          <div className="card-heading" style={{ marginBottom: "18px" }}>
            <div>
              <p className="card-kicker">KOMPETENSIYA VA BO‘SHLIQLAR XARITASI</p>
              <h2>Fan va ko‘nikmalar bo‘yicha guruh holati</h2>
            </div>
            <span className="level-badge">2026-yil Bahor semestri</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {teacherGroupData.skillHeatmap.map((item) => (
              <div
                key={item.skill}
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 1fr 90px 140px auto",
                  alignItems: "center",
                  gap: "20px",
                  padding: "16px 20px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid var(--border)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
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
                            ? "linear-gradient(90deg, #059669, #10b981)"
                            : item.avgScore >= 65
                            ? "linear-gradient(90deg, #3b82f6, #60a5fa)"
                            : "linear-gradient(90deg, #f59e0b, #ef4444)",
                      }}
                    />
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "20px", color: "var(--navy)", fontFamily: "Plus Jakarta Sans" }}>
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
                          ? "#ecfdf5"
                          : item.status.includes("O‘rtacha")
                          ? "#eff6ff"
                          : "#fef2f2",
                      color:
                        item.status === "Yaxshi"
                          ? "#059669"
                          : item.status.includes("O‘rtacha")
                          ? "#2563eb"
                          : "#dc2626",
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                <div>
                  <button
                    className="card-button"
                    style={{ padding: "7px 12px", fontSize: "12px", borderRadius: "7px", whiteSpace: "nowrap" }}
                    onClick={() => {
                      setRemedialSkill(item.skill);
                      setRemedialModalOpen(true);
                      setGeneratedSuccess(false);
                    }}
                  >
                    <Icon name="code" size={14} /> Remedial tuzish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 2: Student Competency Matrix */}
      {activeTab === "matrix" && (
        <section className="card" style={{ padding: "26px" }}>
          <div className="card-heading" style={{ marginBottom: "18px" }}>
            <div>
              <p className="card-kicker">TALABALAR KOMPETENSIYA MATRITSASI</p>
              <h2>Guruh talabalarining amaliy ko‘nikma reytingi</h2>
            </div>
            <span className="level-badge">{filteredStudents.length} nafar saralandi</span>
          </div>

          {/* Filter and Search Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              {["Barchasi", "L4", "L3", "L2", "Bo‘shliqdagilar"].map((f) => (
                <button
                  key={f}
                  onClick={() => setMatrixFilter(f)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: matrixFilter === f ? "var(--navy)" : "white",
                    color: matrixFilter === f ? "white" : "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div style={{ position: "relative", minWidth: "260px" }}>
              <input
                type="text"
                placeholder="Talaba ismi bo‘yicha qidiruv..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 14px 8px 36px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", left: "12px", top: "10px", color: "var(--muted)" }}>
                <Icon name="search" size={15} />
              </span>
            </div>
          </div>

          {/* Students Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                className="card"
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
                          color: "white",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "15px",
                          fontWeight: 800,
                        }}
                      >
                        {st.avatar}
                      </div>
                      <div>
                        <strong style={{ fontSize: "15.5px", color: "var(--navy)", display: "block" }}>
                          {st.name}
                        </strong>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>{st.email}</span>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "4px 9px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 800,
                        background: st.level === "L4" ? "#ecfdf5" : st.level === "L3" ? "#eff6ff" : "#fef3c7",
                        color: st.level === "L4" ? "#047857" : st.level === "L3" ? "#1d4ed8" : "#d97706",
                      }}
                    >
                      {st.level}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>SKILL SCORE</span>
                      <strong style={{ fontSize: "18px", color: "var(--navy)", fontFamily: "Plus Jakarta Sans" }}>
                        {st.overallScore} / 100
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>ISHONCHLILIK</span>
                      <strong style={{ fontSize: "18px", color: "var(--emerald)", fontFamily: "Plus Jakarta Sans" }}>
                        {st.confidence}%
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>DALILLAR</span>
                      <strong style={{ fontSize: "18px", color: "var(--royal)", fontFamily: "Plus Jakarta Sans" }}>
                        {st.evidenceCount} ta
                      </strong>
                    </div>
                  </div>

                  {/* Top Skills Preview */}
                  <div style={{ marginBottom: "14px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "6px" }}>
                      YETAKCHI KO‘NIKMALARI:
                    </span>
                    {st.topSkills.map((sk) => (
                      <div key={sk.name} style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "4px" }}>
                        <span style={{ color: "#334155" }}>{sk.name}</span>
                        <strong style={{ color: "var(--navy)" }}>{sk.score} ball</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="primary-button full"
                  style={{ fontSize: "13px", padding: "9px 14px", marginTop: "auto" }}
                  onClick={() => setInspectedStudent(st)}
                >
                  Profilni tekshirish & Dalillar <Icon name="arrow" size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: PROVE Verification Queue */}
      {activeTab === "queue" && (
        <section className="card" style={{ padding: "26px" }}>
          <div className="card-heading" style={{ marginBottom: "18px" }}>
            <div>
              <p className="card-kicker">PROVE MODULI · INSON SIKLI (HUMAN-IN-THE-LOOP)</p>
              <h2>Tasdiqlanishi kutilayotgan real dalillar va repozitoriylar</h2>
            </div>
            <span className="level-badge">{proveQueue.length} ta faol so‘rov</span>
          </div>

          {proveQueue.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--muted)" }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#ecfdf5", color: "#059669", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <Icon name="check" size={32} />
              </div>
              <h3 style={{ fontSize: "18px", color: "var(--navy)", margin: "0 0 6px" }}>Barcha dalillar ko‘rib chiqildi!</h3>
              <p style={{ fontSize: "14px" }}>
                Hozircha navbatda yangi dalillar yo‘q. Talabalar yangi loyihalar topshirganda bu yerda paydo bo‘ladi.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {proveQueue.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "20px 24px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: confirmedId === item.id ? "#ecfdf5" : "white",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(15, 39, 68, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          color: "var(--royal)",
                        }}
                      >
                        {item.type} · {item.skillName}
                      </span>
                      <h3 style={{ margin: "4px 0", fontSize: "17px", color: "var(--navy)" }}>{item.title}</h3>
                      <p style={{ fontSize: "13.5px", color: "var(--muted)" }}>
                        Talaba: <strong style={{ color: "var(--navy)" }}>{item.studentName}</strong> · Topshirilgan vaqti: {item.submittedAt}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "5px 12px",
                        borderRadius: "20px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        background: "#fef3c7",
                        color: "#d97706",
                      }}
                    >
                      Kutilmoqda
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "14px",
                      borderTop: "1px solid var(--border)",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "var(--royal)" }}>
                      <Icon name="external" size={16} />
                      <a href={`https://${item.links}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline", fontWeight: 600 }}>
                        {item.links}
                      </a>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className="dark-outline"
                        style={{ padding: "8px 16px", fontSize: "13px" }}
                        onClick={() => {
                          setProveQueue((prev) => prev.filter((p) => p.id !== item.id));
                          showToast(`Dalil rad etildi va izoh yuborildi.`);
                        }}
                      >
                        Rad etish
                      </button>
                      <button
                        className="primary-button"
                        style={{ padding: "8px 18px", fontSize: "13px" }}
                        onClick={() => handleApprove(item.id, item.studentName, item.skillName)}
                      >
                        <Icon name="check" size={15} /> Tasdiqlash & L4 berish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: Remedial Challenge Generator */}
      {activeTab === "remedial" && (
        <section className="card" style={{ padding: "26px" }}>
          <div className="card-heading" style={{ marginBottom: "18px" }}>
            <div>
              <p className="card-kicker">ADAPTIV PEDAGOGIKA · AI CHALLENGE GENERATOR</p>
              <h2>Mustahkamlovchi (Remedial) topshiriqlar generatori</h2>
            </div>
            <span className="level-badge">AI Viva & Kod sandbox</span>
          </div>
          <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "20px", maxWidth: "800px", lineHeight: "1.6" }}>
            Guruhda bo‘shliq aniqlangan ko‘nikmalar bo‘yicha har bir talabaga sun’iy intellekt orqali alohida parametrlar va test keyslar bilan mustahkamlovchi topshiriqlar generatsiya qiling.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            <div
              style={{
                padding: "24px",
                borderRadius: "14px",
                border: "1px solid #bfdbfe",
                background: "linear-gradient(145deg, #f0f7ff, #e0f2fe)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#1d4ed8", letterSpacing: "0.08em" }}>
                  TAVSIYA ETILGAN PAKET #1
                </span>
                <h3 style={{ fontSize: "18px", color: "var(--navy)", margin: "8px 0" }}>
                  DevOps & CI/CD bo‘yicha 12 nafar talabaga
                </h3>
                <p style={{ fontSize: "13.5px", color: "#334155", marginBottom: "16px", lineHeight: "1.5" }}>
                  Dockerfile optimallash, GitHub Actions matrix build va Docker compose konfiguratsiyasi. Har bir talabaga individual sintaktik cheklov beriladi.
                </p>
              </div>
              <button
                className="primary-button"
                style={{ width: "100%", fontSize: "13.5px" }}
                onClick={() => {
                  setRemedialSkill("DevOps va CI/CD");
                  setRemedialModalOpen(true);
                  setGeneratedSuccess(false);
                }}
              >
                <Icon name="play" size={16} /> Ushbu paketni generatsiya qilish
              </button>
            </div>

            <div
              style={{
                padding: "24px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#475569", letterSpacing: "0.08em" }}>
                  TAVSIYA ETILGAN PAKET #2
                </span>
                <h3 style={{ fontSize: "18px", color: "var(--navy)", margin: "8px 0" }}>
                  DSA (Graf va Daraxtlar) bo‘yicha 8 nafar talabaga
                </h3>
                <p style={{ fontSize: "13.5px", color: "#334155", marginBottom: "16px", lineHeight: "1.5" }}>
                  Dijkstra, BFS/DFS va binary search bo‘yicha parametrli algoritmik chellinjlar va avtomatik sandbox tekshiruvi.
                </p>
              </div>
              <button
                className="dark-outline"
                style={{ width: "100%", fontSize: "13.5px" }}
                onClick={() => {
                  setRemedialSkill("Ma’lumotlar tuzilmasi (DSA)");
                  setRemedialModalOpen(true);
                  setGeneratedSuccess(false);
                }}
              >
                <Icon name="play" size={16} /> Ushbu paketni generatsiya qilish
              </button>
            </div>
          </div>
        </section>
      )}

      {/* INSPECT STUDENT MODAL */}
      {inspectedStudent && (
        <div className="modal-backdrop" onClick={() => setInspectedStudent(null)}>
          <div className="modal" style={{ width: "min(620px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setInspectedStudent(null)}>
              <Icon name="close" />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
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
                  {inspectedStudent.email} · Guruh: {teacherGroupData.groupCode}
                </span>
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  padding: "6px 14px",
                  borderRadius: "14px",
                  fontSize: "13px",
                  fontWeight: 800,
                  background: inspectedStudent.level === "L4" ? "#ecfdf5" : "#eff6ff",
                  color: inspectedStudent.level === "L4" ? "#047857" : "#1d4ed8",
                }}
              >
                {inspectedStudent.level}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", padding: "14px", background: "#f8fafc", borderRadius: "10px", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>UMUMIY BALL</span>
                <strong style={{ fontSize: "20px", color: "var(--navy)" }}>{inspectedStudent.overallScore} / 100</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>ISHONCHLILIK</span>
                <strong style={{ fontSize: "20px", color: "var(--emerald)" }}>{inspectedStudent.confidence}%</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>TASDIQLANGAN DALIL</span>
                <strong style={{ fontSize: "20px", color: "var(--royal)" }}>{inspectedStudent.evidenceCount} ta</strong>
              </div>
            </div>

            <h3 style={{ fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>5 qatlamli ko‘nikma profili:</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {(["KNOW", "DO", "ADAPT", "DEFEND", "PROVE"] as const).map((layerKey) => (
                <div key={layerKey}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "4px" }}>
                    <strong>{layerKey}</strong>
                    <span style={{ color: "var(--navy)", fontWeight: 700 }}>{inspectedStudent.layers[layerKey]} ball</span>
                  </div>
                  <div className="progress-track" style={{ height: "6px", margin: 0 }}>
                    <div style={{ width: `${inspectedStudent.layers[layerKey]}%`, height: "100%", background: "#2563eb", borderRadius: "10px" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
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
              <button className="dark-outline" style={{ width: "auto" }} onClick={() => setInspectedStudent(null)}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMEDIAL CHALLENGE GENERATOR WIZARD MODAL */}
      {remedialModalOpen && (
        <div className="modal-backdrop" onClick={() => setRemedialModalOpen(false)}>
          <div className="modal" style={{ width: "min(540px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setRemedialModalOpen(false)}>
              <Icon name="close" />
            </button>

            <div className="modal-symbol">
              <Icon name="code" size={28} />
            </div>

            <h2>AI Remedial Topshiriq Generatori</h2>
            <p>
              Guruhdagi bo‘shliq aniqlangan talabalar uchun parametrli, plagiatdan himoyalangan amaliy topshiriqlarni avtomatik shakllantirish.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "20px 0" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                  Mavzu yoki Bo‘shliq fani:
                </label>
                <select
                  value={remedialSkill}
                  onChange={(e) => setRemedialSkill(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    color: "var(--navy)",
                  }}
                >
                  <option value="DevOps va CI/CD">DevOps va CI/CD (46% bo‘shliq)</option>
                  <option value="Ma’lumotlar tuzilmasi (DSA)">Ma’lumotlar tuzilmasi (DSA) (38% bo‘shliq)</option>
                  <option value="SQL va ma’lumotlar bazasi">SQL va indekslarni optimallash (22% bo‘shliq)</option>
                  <option value="OOP va dizayn pattern’lari">OOP va Clean Architecture (18% bo‘shliq)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                    Qiyinlik darajasi:
                  </label>
                  <select
                    value={remedialDifficulty}
                    onChange={(e) => setRemedialDifficulty(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13.5px",
                    }}
                  >
                    <option value="L2">L2 · Boshlang‘ich / Asosiy</option>
                    <option value="L3">L3 · O‘rta / Amaliy</option>
                    <option value="L4">L4 · Murakkab / Arxitektura</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                    AI Yordami:
                  </label>
                  <select
                    value={remedialAiMode}
                    onChange={(e) => setRemedialAiMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13.5px",
                    }}
                  >
                    <option value="AI-assisted">AI-assisted (Tavsiya etiladi)</option>
                    <option value="AI-free">AI-free (Nazorat ishi)</option>
                  </select>
                </div>
              </div>
            </div>

            {generating ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div className="progress-track" style={{ height: "8px", marginBottom: "12px" }}>
                  <div className="progress-fill" style={{ width: "85%" }} />
                </div>
                <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 600 }}>
                  Sun’iy intellekt 12 nafar talaba profili uchun individual parametrlar yaratmoqda...
                </span>
              </div>
            ) : generatedSuccess ? (
              <div style={{ padding: "16px", borderRadius: "10px", background: "#ecfdf5", border: "1px solid #a7f3d0", marginBottom: "16px" }}>
                <strong style={{ color: "#047857", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <Icon name="checkCircle" size={16} /> 12 ta parametrli topshiriq muvaffaqiyatli tayyorlandi!
                </strong>
                <p style={{ color: "#065f46", fontSize: "12.5px", margin: 0 }}>
                  Topshiriqlar {teacherGroupData.groupCode} guruhidagi tegishli talabalarning shaxsiy kabinetiga yuborildi.
                </p>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                className="primary-button full"
                onClick={handleGenerateRemedial}
                disabled={generating}
              >
                {generating ? "Generatsiya qilinmoqda..." : "AI bilan generatsiya qilish va tarqatish"}
              </button>
            </div>
            <button className="cancel-button" onClick={() => setRemedialModalOpen(false)}>
              Bekor qilish
            </button>
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
