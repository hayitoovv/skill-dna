import { useState, useEffect, type ReactNode } from "react";
import { Icon, Logo } from "../common/Icons";
import { directionsData, sampleTasksByDirection } from "../../data/ontology";
import type { DirectionCode, LayerKey, LayerItem, User } from "../../types";
import { api } from "../../services/api";
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
  const primarySkill = currentDir?.skills?.[0] || directionsData.software.skills[0];

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

  const [completedScore, setCompletedScore] = useState<number | null>(() => {
    if (!user) return null;
    try {
      const saved = localStorage.getItem(`skill_dna_score_${user.id}`);
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });

  const [liveDna, setLiveDna] = useState<any>(null);

  useEffect(() => {
    if (user) {
      if (user.name) setProfileName(user.name);
      if (user.email) setProfileEmail(user.email);
      if (user.phone) setProfilePhone(user.phone);
      if (user.bio) setProfileBio(user.bio);
      if (user.avatar) setProfileAvatar(user.avatar);

      const queryId = user.id || user.email;

      if (queryId) {
        try {
          const saved = localStorage.getItem(`skill_dna_score_${user.id}`);
          setCompletedScore(saved ? parseFloat(saved) : null);
        } catch {}

        // Fetch live DNA profile
        api
          .getDnaProfile(queryId)
          .then((res) => {
            if (res) setLiveDna(res);
          })
          .catch(() => {});

        // Fetch live user profile from PostgreSQL
        api
          .getMe(queryId)
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
    }
  }, [user, assessmentKey]);

  // If new user who hasn't submitted assessments yet
  const isNewUser = !isDemoStudent && !completedScore && (!liveDna || liveDna.overall_score === 0);

  const layerScores: Record<LayerKey, number> = isNewUser
    ? { KNOW: 0, DO: 0, ADAPT: 0, DEFEND: 0, PROVE: 0 }
    : completedScore
    ? { KNOW: 85, DO: Math.round(completedScore), ADAPT: 75, DEFEND: 80, PROVE: 60 }
    : (liveDna?.layers || primarySkill.layers);

  const layers: LayerItem[] = [
    { key: "KNOW", label: "Nazariy bilim", score: layerScores.KNOW, weight: "15%", weightNum: 0.15, tone: "blue", icon: "file" },
    { key: "DO", label: "Amaliy ijro", score: layerScores.DO, weight: "30%", weightNum: 0.30, tone: "emerald", icon: "code" },
    { key: "ADAPT", label: "Moslashuvchanlik", score: layerScores.ADAPT, weight: "20%", weightNum: 0.20, tone: "violet", icon: "settings" },
    { key: "DEFEND", label: "Yechimni himoya (Viva)", score: layerScores.DEFEND, weight: "20%", weightNum: 0.20, tone: "amber", icon: "briefcase" },
    { key: "PROVE", label: "Real dalillar", score: layerScores.PROVE, weight: "15%", weightNum: 0.15, tone: "rose", icon: "award" },
  ];

  const overallScoreVal = isNewUser
    ? 0
    : completedScore
    ? Math.round(completedScore)
    : (liveDna?.overall_score ?? primarySkill.score);

  const confidenceVal = isNewUser
    ? 0
    : completedScore
    ? 78
    : (liveDna?.confidence ?? primarySkill.confidence);

  const evidenceCountVal = isNewUser
    ? 0
    : completedScore
    ? 1
    : (liveDna?.evidence_count ?? primarySkill.evidenceCount);

  const verifiedCountVal = isNewUser
    ? 0
    : completedScore
    ? 1
    : primarySkill.verifiedCount;

  const levelVal = isNewUser
    ? "L0 · BOSHLANG‘ICH"
    : completedScore
    ? "L3 · MUTAXASSIS"
    : `${primarySkill.level} · MUTAXASSIS`;

  const coverageVal = isNewUser ? 0 : completedScore ? 65 : 85;

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
                    <span>Ishonchlilik (Confidence)</span>
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
                      : `Yuqori ishonchlilik · ${evidenceCountVal} ta dalil, ${verifiedCountVal} tasdiqlangan`}
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
                <span className="time">≈ {tasks[0].duration}</span>
              </div>
              <div className="task-visual">
                <Icon name="code" size={36} />
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <p className="task-type">{tasks[0].layer} · AMALIY TOPSHIRIQ</p>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: tasks[0].aiMode === "AI-free" ? "var(--danger-400)" : "var(--success-400)",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {tasks[0].aiMode}
                </span>
              </div>
              <h2>{tasks[0].title}</h2>
              <p>Mavjud yechimni parametrli yangi cheklovga moslang va qaroringizni asoslang.</p>
              <div className="task-meta">
                <span>
                  <Icon name="file" size={16} /> 4 ta avtotest
                </span>
                <span>
                  <Icon name="award" size={16} /> {tasks[0].reward}gacha
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
                <span>UMUMIY NATIJA</span>
                <strong>
                  {Math.round(overallScoreVal * mainEase)}
                  <small>/100</small>
                </strong>
                <p>
                  {isNewUser
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
              </div>
              <div className="dna-layer-list">
                {currentDir.skills.map((sk, index) => {
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
                <strong>Bugun</strong>
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
          </div>
          <div className="tasks-grid">
            {visibleTasks.map((task, index) => (
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
        </div>
      )}

      {activePage === "certificates" && (
        <div className="page">
          <PageIntro
            kicker="OPEN BADGES 3.0 / W3C VC"
            title="Sertifikatlar va Raqamli nishonlar"
            description="Ish beruvchilar dunyoning istalgan nuqtasidan ochiq tekshira oladigan, dalillarga asoslangan raqamli sertifikatlaringiz."
          />
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

              {settingsTab === "Rozilik (Consent)" && (
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
                    const queryId = user?.id || user?.email;
                    if (queryId) {
                      try {
                        await api.updateMe(queryId, {
                          full_name: profileName,
                          email: profileEmail,
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
        targetRole={currentDir.careerTarget.roleName}
        matchPct={currentDir.careerTarget.matchPct}
      />

      {/* Verifiable Evidence Graph Modal */}
      <EvidenceGraphModal
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        skillName={primarySkill.name}
      />
    </>
  );
}
