import { useState } from "react";
import { Icon } from "../common/Icons";
import type { IconName } from "../common/Icons";

export interface SkillRoadmapProps {
  currentLevel: string;
  currentScore: number;
  confidence: number;
  isNewUser?: boolean;
  onStartAssessment?: () => void;
  directionTitle?: string;
  blockers?: string[];
}

export interface Milestone {
  level: number;
  code: string;
  name: string;
  title: string;
  roleTitle: string;
  iconName: IconName;
  minScore: number;
  minConfidence: number;
  requiredLayers: { key: string; label: string; tone: string }[];
  rewardBadge: string;
  description: string;
  nextTip: string;
}

export const MILESTONES: Milestone[] = [
  {
    level: 1,
    code: "L1",
    name: "KNOW",
    title: "Nazariy poydevor",
    roleTitle: "Junior Nazariyotchi",
    iconName: "bookOpen",
    minScore: 40,
    minConfidence: 0,
    requiredLayers: [{ key: "KNOW", label: "Nazariya", tone: "blue" }],
    rewardBadge: "Skill DNA Profili",
    description: "Sohaning fundamental tamoyillari, atamalar va asosiy nazariy tushunchalar.",
    nextTip: "KNOW test sinovlaridan o‘tib, kamida 40 ball to‘plang.",
  },
  {
    level: 2,
    code: "L2",
    name: "APPLY",
    title: "Amaliy ijro",
    roleTitle: "Amaliy dasturchi",
    iconName: "code",
    minScore: 55,
    minConfidence: 0,
    requiredLayers: [
      { key: "KNOW", label: "Nazariya", tone: "blue" },
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
    ],
    rewardBadge: "Verified Pool (Ish beruvchilar)",
    description: "Haqiqiy kod yozish, algoritmik masalalar va amaliy topshiriqlarni mustaqil bajarish.",
    nextTip: "DO topshiriqlarida kod yozing va umumiy ballni 55 ga yetkazing.",
  },
  {
    level: 3,
    code: "L3",
    name: "ADAPT",
    title: "Moslashuvchanlik",
    roleTitle: "Problem Solver",
    iconName: "cpu",
    minScore: 70,
    minConfidence: 50,
    requiredLayers: [
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
      { key: "ADAPT", label: "Moslashuv", tone: "violet" },
    ],
    rewardBadge: "Adaptive Solver",
    description: "O‘zgaruvchan talablar, noaniq sharoitlar va murakkab ishlab chiqarish keyslarini yechish.",
    nextTip: "ADAPT o‘zgaruvchan keyslarini yeching va ishonchni 50% dan oshiring.",
  },
  {
    level: 4,
    code: "L4",
    name: "CREATE",
    title: "Yaratuvchanlik",
    roleTitle: "Tizimlar arxitektori",
    iconName: "layers",
    minScore: 82,
    minConfidence: 70,
    requiredLayers: [
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
      { key: "ADAPT", label: "Moslashuv", tone: "violet" },
      { key: "DEFEND", label: "Viva himoya", tone: "amber" },
    ],
    rewardBadge: "AI Viva Certified",
    description: "Murakkab tizimlar arxitekturasini loyihalash va AI Viva suhbatida o‘z yechimini himoya qilish.",
    nextTip: "AI Viva (DEFEND) suhbatidan o‘tib, ballni 82 ga, ishonchni 70% ga chiqaring.",
  },
  {
    level: 5,
    code: "L5",
    name: "MASTER",
    title: "Ekspert daraja",
    roleTitle: "Bosh ekspert / Lead",
    iconName: "award",
    minScore: 90,
    minConfidence: 85,
    requiredLayers: [
      { key: "KNOW", label: "Nazariya", tone: "blue" },
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
      { key: "ADAPT", label: "Moslashuv", tone: "violet" },
      { key: "DEFEND", label: "Viva himoya", tone: "amber" },
      { key: "PROVE", label: "Real dalillar", tone: "rose" },
    ],
    rewardBadge: "W3C / OB 3.0 Master",
    description: "Barcha 5 qatlamni to‘liq qamragan, insoniy ekspertiza (PROVE) va diplom bilan isbotlangan mahorat.",
    nextTip: "PROVE qatlamida ekspert tasdiqlagan diplom va loyiha dalillarini yuklang.",
  },
];

function parseRank(lvl: string, isNew?: boolean, score = 0): number {
  if (isNew) return 0;
  const m = lvl.match(/L([0-5])/i);
  if (m) return parseInt(m[1], 10);
  if (score >= 90) return 5;
  if (score >= 82) return 4;
  if (score >= 70) return 3;
  if (score >= 55) return 2;
  if (score >= 40) return 1;
  return 0;
}

export default function SkillRoadmap({
  currentLevel,
  currentScore,
  confidence,
  isNewUser = false,
  onStartAssessment,
  directionTitle = "Dasturiy injiniring",
  blockers = [],
}: SkillRoadmapProps) {
  const [viewMode, setViewMode] = useState<"hud" | "tree">("hud");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const currentRank = parseRank(currentLevel, isNewUser, currentScore);

  const nextMilestone = MILESTONES.find((m) => m.level > currentRank) ?? null;
  const currentMilestone = MILESTONES.find((m) => m.level === currentRank) ?? null;

  // Progress percentage between level fromLevel and toLevel
  const getLineProgress = (fromLevel: number, toLevel: number): number => {
    if (currentRank >= toLevel) return 100;
    if (currentRank < fromLevel) return 0;

    const fromMilestone = MILESTONES.find((m) => m.level === fromLevel);
    const toMilestone = MILESTONES.find((m) => m.level === toLevel);
    if (!toMilestone) return 0;

    const startScore = fromMilestone ? fromMilestone.minScore : 0;
    const targetScore = toMilestone.minScore;
    if (currentScore <= startScore) return 0;
    if (currentScore >= targetScore) return 100;

    const span = targetScore - startScore;
    const gained = currentScore - startScore;
    return Math.min(100, Math.max(0, Math.round((gained / span) * 100)));
  };

  const remainingScore = nextMilestone ? Math.max(0, nextMilestone.minScore - currentScore) : 0;
  const remainingConf = nextMilestone ? Math.max(0, nextMilestone.minConfidence - confidence) : 0;

  // Calculate overall next goal progress percentage
  const nextProgressPct = nextMilestone
    ? Math.min(
        100,
        Math.max(
          12,
          Math.round(
            ((currentScore - (currentMilestone ? currentMilestone.minScore : 0)) /
              (nextMilestone.minScore - (currentMilestone ? currentMilestone.minScore : 0))) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="cyber-roadmap-widget">
      {/* Top HUD Control Bar */}
      <div className="cyber-hud-top">
        <div className="cyber-hud-brand">
          <div className="cyber-hud-icon-box">
            <Icon name="dna" size={16} />
          </div>
          <div>
            <div className="cyber-hud-tag">KOMPETENSIYA YO‘L XARITASI</div>
            <div className="cyber-hud-status">
              <span className="cyber-live-dot" />
              <strong>{currentLevel}</strong>
              <span className="cyber-sub-score">• {currentScore} BALL</span>
            </div>
          </div>
        </div>

        <div className="cyber-hud-controls">
          <div className="cyber-toggle-group">
            <button
              type="button"
              className={`cyber-toggle-btn ${viewMode === "hud" ? "active" : ""}`}
              onClick={() => setViewMode("hud")}
              title="Ixcham HUD rejimi"
            >
              <Icon name="grid" size={13} />
              <span>HUD</span>
            </button>
            <button
              type="button"
              className={`cyber-toggle-btn ${viewMode === "tree" ? "active" : ""}`}
              onClick={() => setViewMode("tree")}
              title="Kengaytirilgan daraxt xaritasi"
            >
              <Icon name="workflow" size={13} />
              <span>Xarita</span>
            </button>
          </div>

          <button
            type="button"
            className="cyber-expand-btn"
            onClick={() => setModalOpen(true)}
            title="Katta ekranda to‘liq ko‘rish"
          >
            <Icon name="external" size={14} />
          </button>
        </div>
      </div>

      {/* MODE 1: Futuristic Laser Stepper (Compact HUD) */}
      {viewMode === "hud" && (
        <div className="cyber-hud-body">
          <div className="cyber-stepper-track">
            {MILESTONES.map((m, idx) => {
              const isCompleted = currentRank > m.level;
              const isCurrent = currentRank === m.level || (currentRank === 0 && m.level === 1);
              const isLocked = currentRank < m.level && !isCurrent;
              const lineProgress = idx > 0 ? getLineProgress(MILESTONES[idx - 1].level, m.level) : 0;

              return (
                <div key={m.code} className="cyber-step-wrapper">
                  {idx > 0 && (
                    <div className="cyber-laser-beam">
                      <div
                        className="cyber-laser-fill"
                        style={{ width: `${lineProgress}%` }}
                      >
                        {lineProgress > 0 && lineProgress < 100 && (
                          <span className="cyber-laser-spark" />
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className="cyber-node-group"
                    onClick={() => setActiveTooltip(activeTooltip === m.level ? null : m.level)}
                    onMouseEnter={() => setActiveTooltip(m.level)}
                    onMouseLeave={() => setActiveTooltip(null)}
                  >
                    <div
                      className={`cyber-node-badge ${
                        isCompleted ? "is-completed" : isCurrent ? "is-current" : "is-locked"
                      }`}
                    >
                      {isCompleted ? (
                        <Icon name="check" size={16} />
                      ) : isCurrent ? (
                        <span className="cyber-node-current-text">{m.code}</span>
                      ) : (
                        <span className="cyber-node-locked-text">{m.code}</span>
                      )}

                      {isCurrent && <span className="cyber-aura-ring" />}
                    </div>

                    <div className="cyber-node-meta">
                      <strong className={`cyber-node-name ${isCurrent ? "active-glow" : ""}`}>
                        {m.name}
                      </strong>
                      <span className="cyber-node-role">{m.roleTitle}</span>
                      <span className="cyber-node-pts">≥{m.minScore}b</span>
                    </div>

                    {/* Interactive Glassmorphism Tooltip Popover */}
                    {activeTooltip === m.level && (
                      <div className="cyber-popover" onClick={(e) => e.stopPropagation()}>
                        <div className="cyber-popover-header">
                          <div className="cyber-popover-title">
                            <strong>{m.code} · {m.name}</strong>
                            <span>{m.title}</span>
                          </div>
                          <span
                            className={`cyber-popover-status ${
                              isCompleted ? "popover-done" : isCurrent ? "popover-now" : "popover-lock"
                            }`}
                          >
                            {isCompleted ? "O‘zlashtirildi" : isCurrent ? "Hozirgi pog‘ona" : "Qulflangan"}
                          </span>
                        </div>
                        <p className="cyber-popover-desc">{m.description}</p>
                        <div className="cyber-popover-reqs">
                          <div className="cyber-req-row">
                            <span>Minimal ball:</span>
                            <b>{m.minScore} / 100</b>
                          </div>
                          {m.minConfidence > 0 && (
                            <div className="cyber-req-row">
                              <span>Ishonchlilik:</span>
                              <b>≥ {m.minConfidence}%</b>
                            </div>
                          )}
                          <div className="cyber-req-row">
                            <span>Kerakli qatlamlar:</span>
                            <b>{m.requiredLayers.map((l) => l.key).join(", ")}</b>
                          </div>
                          <div className="cyber-req-row">
                            <span>Imtiyoz:</span>
                            <b className="cyber-reward-highlight">{m.rewardBadge}</b>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gamified Quest & Next Target Banner */}
          <div className="cyber-quest-card">
            <div className="cyber-quest-left">
              <div className="cyber-quest-icon">
                {nextMilestone ? <Icon name={nextMilestone.iconName} size={20} /> : <Icon name="trophy" size={20} />}
              </div>
              <div className="cyber-quest-details">
                <div className="cyber-quest-title">
                  <span>
                    {nextMilestone
                      ? `KEYINGI MAQSAD: ${nextMilestone.code} · ${nextMilestone.name}`
                      : "MAKSIMAL DARAJA: L5 · MASTER"}
                  </span>
                  {nextMilestone && remainingScore > 0 && (
                    <span className="cyber-quest-pill">+{remainingScore} ball qoldi</span>
                  )}
                </div>
                <div className="cyber-quest-desc">
                  {nextMilestone
                    ? blockers && blockers.length > 0
                      ? blockers[0]
                      : remainingScore > 0
                      ? `${nextMilestone.title} darajasiga chiqish uchun yana ${remainingScore} ball to‘plang.`
                      : remainingConf > 0
                      ? `Ishonchlilikni yana ${remainingConf}% ga yetkazing.`
                      : nextMilestone.nextTip
                    : "Tabriklaymiz! Siz platformadagi barcha 5 qatlamni to‘liq zabt etdingiz."}
                </div>

                {nextMilestone && (
                  <div className="cyber-meter-shell">
                    <div className="cyber-meter-bar" style={{ width: `${nextProgressPct}%` }}>
                      <span className="cyber-meter-shine" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {onStartAssessment && (
              <button
                type="button"
                className="cyber-action-btn"
                onClick={onStartAssessment}
                title="Topshiriqni boshlash"
              >
                <span>Sinovdan o‘tish</span>
                <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: Visual Interactive Skill Tree (Inline Expanded) */}
      {viewMode === "tree" && (
        <div className="cyber-tree-body">
          <div className="cyber-tree-list">
            {MILESTONES.map((m) => {
              const isPassed = currentRank > m.level;
              const isCurrent = currentRank === m.level || (currentRank === 0 && m.level === 1);
              const isLocked = currentRank < m.level && !isCurrent;

              return (
                <div
                  key={m.code}
                  className={`cyber-tree-card ${isPassed ? "tree-passed" : isCurrent ? "tree-current" : "tree-locked"}`}
                >
                  <div className="cyber-tree-card-left">
                    <div className="cyber-tree-badge-box">
                      <Icon name={m.iconName} size={20} />
                    </div>
                    <div className="cyber-tree-code">{m.code}</div>
                  </div>

                  <div className="cyber-tree-card-mid">
                    <div className="cyber-tree-header-row">
                      <h4>{m.code} · {m.name} ({m.title})</h4>
                      <span className={`cyber-tree-status-tag ${isPassed ? "tag-passed" : isCurrent ? "tag-current" : "tag-locked"}`}>
                        {isPassed ? "O‘zlashtirilgan ✅" : isCurrent ? "Joriy pog‘ona 📍" : "Qulflangan 🔒"}
                      </span>
                    </div>
                    <p className="cyber-tree-desc">{m.description}</p>
                    <div className="cyber-tree-chips">
                      <span className="cyber-chip">Ball: <b>≥{m.minScore}</b></span>
                      {m.minConfidence > 0 && <span className="cyber-chip">Ishonch: <b>≥{m.minConfidence}%</b></span>}
                      <span className="cyber-chip reward">Imtiyoz: <b>{m.rewardBadge}</b></span>
                    </div>
                  </div>

                  <div className="cyber-tree-card-right">
                    {isCurrent && onStartAssessment ? (
                      <button type="button" className="cyber-tree-action-btn" onClick={onStartAssessment}>
                        Topshiriqni yechish <Icon name="arrow" size={13} />
                      </button>
                    ) : isPassed ? (
                      <span className="cyber-passed-badge"><Icon name="checkCircle" size={16} /> Tasdiqlangan</span>
                    ) : (
                      <span className="cyber-locked-badge"><Icon name="lock" size={14} /> Qulflangan</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Roadmap Modal (Opened via Expand button) */}
      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <div
            className="modal cyber-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="roadmap-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" aria-label="Yopish" onClick={() => setModalOpen(false)}>
              <Icon name="close" size={18} />
            </button>

            <div className="modal-symbol">
              <Icon name="dna" size={24} />
            </div>

            <div className="cyber-modal-head">
              <p className="eyebrow" style={{ color: "#38bdf8" }}>KASBIY KOMPETENSIYA MODELI</p>
              <h2 id="roadmap-modal-title" style={{ color: "#fff" }}>{directionTitle} — To‘liq Rivojlanish Yo‘l Xaritasi</h2>
              <p style={{ color: "#94a3b8" }}>
                Platformada kasbiy mahorat 5 ta rasmiy bosqich (L1–L5) orqali o‘lchanadi.
                Har bir bosqich yangi amaliy qatlamlar va isbotlangan dalillar bilan ochiladi.
              </p>
            </div>

            {/* Current Position Summary */}
            <div className="cyber-modal-pos-banner">
              <div className="cyber-modal-pos-left">
                <Icon name="sparkles" size={18} />
                <span>Sizning joriy holatingiz:</span>
                <strong>{currentLevel}</strong>
              </div>
              <div className="cyber-modal-pos-right">
                <span>Skill Score: <b>{currentScore} / 100</b></span>
                <span>•</span>
                <span>Ishonchlilik: <b>{confidence}%</b></span>
                {nextMilestone && (
                  <>
                    <span>•</span>
                    <span style={{ color: "#38bdf8" }}>
                      Maqsad: <b>{nextMilestone.code} {nextMilestone.name}</b> ({remainingScore} ball qoldi)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* All 5 Stage Cards in Modal */}
            <div className="cyber-modal-timeline">
              {MILESTONES.map((m) => {
                const isPassed = currentRank > m.level;
                const isCurrent = currentRank === m.level || (currentRank === 0 && m.level === 1);
                const isLocked = currentRank < m.level && !isCurrent;

                return (
                  <div
                    key={m.code}
                    className={`cyber-modal-card ${isPassed ? "modal-passed" : isCurrent ? "modal-current" : "modal-locked"}`}
                  >
                    <div className="cyber-modal-card-top">
                      <div className="cyber-modal-stage-num">{m.code}</div>
                      <div>
                        <h3>{m.code} · {m.name} — {m.title}</h3>
                        <div className="cyber-modal-role-pill">{m.roleTitle}</div>
                      </div>
                      <span className={`cyber-modal-state-badge ${isPassed ? "badge-done" : isCurrent ? "badge-active" : "badge-wait"}`}>
                        {isPassed ? "O‘zlashtirildi" : isCurrent ? "Joriy pog‘ona" : "Qulflangan"}
                      </span>
                    </div>

                    <p className="cyber-modal-desc">{m.description}</p>

                    <div className="cyber-modal-req-grid">
                      <div className="cyber-modal-req-box">
                        <span>Minimal ball:</span>
                        <b>≥ {m.minScore} ball</b>
                        <small>{currentScore >= m.minScore ? "✅ Yetarli" : `(${currentScore}/${m.minScore})`}</small>
                      </div>
                      <div className="cyber-modal-req-box">
                        <span>Ishonchlilik:</span>
                        <b>≥ {m.minConfidence}%</b>
                        <small>{confidence >= m.minConfidence ? "✅ Yetarli" : `(${confidence}/${m.minConfidence}%)`}</small>
                      </div>
                      <div className="cyber-modal-req-box">
                        <span>Kerakli qatlamlar:</span>
                        <div className="cyber-modal-chips">
                          {m.requiredLayers.map((l) => (
                            <span key={l.key} className={`chip-${l.tone}`}>{l.key}</span>
                          ))}
                        </div>
                      </div>
                      <div className="cyber-modal-req-box">
                        <span>Ochilgan imtiyoz:</span>
                        <b style={{ color: "#38bdf8" }}>{m.rewardBadge}</b>
                      </div>
                    </div>

                    <div className="cyber-modal-action-row">
                      <div className="cyber-modal-tip">
                        <Icon name="arrow" size={13} />
                        <span><strong>Tavsiya:</strong> {m.nextTip}</span>
                      </div>
                      {isCurrent && onStartAssessment && (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => {
                            setModalOpen(false);
                            onStartAssessment();
                          }}
                        >
                          Topshiriqni boshlash
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="cyber-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
