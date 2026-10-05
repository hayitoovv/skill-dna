import { useState } from "react";
import { Icon } from "../common/Icons";

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
  subtitle: string;
  minScore: number;
  minConfidence: number;
  requiredLayers: { key: string; label: string; tone: string }[];
  description: string;
  nextTip: string;
}

export const MILESTONES: Milestone[] = [
  {
    level: 1,
    code: "L1",
    name: "KNOW",
    title: "Nazariy bilim",
    subtitle: "Bazaviy tushunchalar",
    minScore: 40,
    minConfidence: 0,
    requiredLayers: [{ key: "KNOW", label: "Nazariya", tone: "blue" }],
    description: "Soha bo‘yicha nazariy asoslar, atamalar va test savollari orqali tushunchalarni egallash.",
    nextTip: "KNOW test sinovlaridan o‘tib, kamida 40 ball to‘plang.",
  },
  {
    level: 2,
    code: "L2",
    name: "APPLY",
    title: "Amaliy ijro",
    subtitle: "Kod va masalalar",
    minScore: 55,
    minConfidence: 0,
    requiredLayers: [
      { key: "KNOW", label: "Nazariya", tone: "blue" },
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
    ],
    description: "Nazariyani amaliyotda qo‘llash, toza kod yozish va amaliy topshiriqlarni mustaqil bajarish.",
    nextTip: "DO topshiriqlarida kod yozing va umumiy ballni 55 ga yetkazing.",
  },
  {
    level: 3,
    code: "L3",
    name: "ADAPT",
    title: "Moslashuvchanlik",
    subtitle: "Real keyslar",
    minScore: 70,
    minConfidence: 50,
    requiredLayers: [
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
      { key: "ADAPT", label: "Moslashuv", tone: "violet" },
    ],
    description: "Kutilmagan sharoitlar, o‘zgaruvchan talablar va murakkab keyslarni muvaffaqiyatli yechish.",
    nextTip: "ADAPT o‘zgaruvchan keyslarini yeching va ishonchlilikni 50% dan oshiring.",
  },
  {
    level: 4,
    code: "L4",
    name: "CREATE",
    title: "Yaratuvchanlik",
    subtitle: "Arxitektura & Himoya",
    minScore: 82,
    minConfidence: 70,
    requiredLayers: [
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
      { key: "ADAPT", label: "Moslashuv", tone: "violet" },
      { key: "DEFEND", label: "Viva himoya", tone: "amber" },
    ],
    description: "Murakkab tizimlar arxitekturasini loyihalash va AI Viva suhbatida o‘z yechimini himoya qilish.",
    nextTip: "AI Viva suhbatidan (DEFEND) o‘tib, ballni 82 ga, ishonchni 70% ga yetkazing.",
  },
  {
    level: 5,
    code: "L5",
    name: "MASTER",
    title: "Ekspert daraja",
    subtitle: "To‘liq isbotlangan mahorat",
    minScore: 90,
    minConfidence: 85,
    requiredLayers: [
      { key: "KNOW", label: "Nazariya", tone: "blue" },
      { key: "DO", label: "Amaliy ijro", tone: "emerald" },
      { key: "ADAPT", label: "Moslashuv", tone: "violet" },
      { key: "DEFEND", label: "Viva himoya", tone: "amber" },
      { key: "PROVE", label: "Real dalillar", tone: "rose" },
    ],
    description: "Barcha 5 qatlamni qamrab olgan, insoniy ekspertiza (PROVE), diplom va loyihalarda to‘liq tasdiqlangan mahorat.",
    nextTip: "PROVE qatlamida o‘qituvchi yoki ekspert tasdiqlagan sertifikat va dalillarni taqdim eting.",
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
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const currentRank = parseRank(currentLevel, isNewUser, currentScore);

  // Next milestone info
  const nextMilestone = MILESTONES.find((m) => m.level > currentRank) ?? null;
  const currentMilestone = MILESTONES.find((m) => m.level === currentRank) ?? null;

  // Segment progress percentage between milestone i and i + 1
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

  return (
    <div className="roadmap-widget">
      <div className="roadmap-head">
        <div className="roadmap-kicker">
          <Icon name="dna" size={14} />
          <span>KOMPETENSIYA YO‘L XARITASI</span>
        </div>
        <button
          type="button"
          className="roadmap-detail-btn"
          onClick={() => setModalOpen(true)}
          title="To‘liq yo‘l xaritasi va talablarni ko‘rish"
        >
          <span>Batafsil xarita</span>
          <Icon name="arrow" size={12} />
        </button>
      </div>

      {/* Stepper Track */}
      <div className="roadmap-stepper-container">
        <div className="roadmap-track">
          {MILESTONES.map((m, idx) => {
            const isCompleted = currentRank > m.level;
            const isCurrent = currentRank === m.level || (currentRank === 0 && m.level === 1);
            const isLocked = currentRank < m.level && !isCurrent;

            return (
              <div key={m.code} className="roadmap-step-wrapper">
                {idx > 0 && (
                  <div className="roadmap-connector">
                    <div
                      className="roadmap-connector-fill"
                      style={{
                        width: `${getLineProgress(MILESTONES[idx - 1].level, m.level)}%`,
                      }}
                    />
                  </div>
                )}

                <div
                  className="roadmap-step"
                  onClick={() => setActiveTooltip(activeTooltip === m.level ? null : m.level)}
                  onMouseEnter={() => setActiveTooltip(m.level)}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <div
                    className={`roadmap-node ${
                      isCompleted ? "completed" : isCurrent ? "current" : "locked"
                    }`}
                  >
                    {isCompleted ? (
                      <Icon name="check" size={15} />
                    ) : (
                      <span>{m.code}</span>
                    )}

                    {isCurrent && <span className="roadmap-pulse-ring" />}
                  </div>

                  <div className="roadmap-labels">
                    <strong className={`roadmap-step-code ${isCurrent ? "active-text" : ""}`}>
                      {m.name}
                    </strong>
                    <span className="roadmap-step-score">{m.minScore}b</span>
                  </div>

                  {/* Popover Tooltip on Hover/Click */}
                  {activeTooltip === m.level && (
                    <div className="roadmap-tooltip" onClick={(e) => e.stopPropagation()}>
                      <div className="roadmap-tooltip-head">
                        <strong>{m.code} · {m.name}</strong>
                        <span className={`roadmap-tooltip-badge ${isCompleted ? "badge-success" : isCurrent ? "badge-active" : "badge-locked"}`}>
                          {isCompleted ? "O‘zlashtirilgan" : isCurrent ? "Joriy pog‘ona" : "Qulflangan"}
                        </span>
                      </div>
                      <p className="roadmap-tooltip-desc">{m.title} — {m.description}</p>
                      <div className="roadmap-tooltip-facts">
                        <div>
                          <span>Minimal ball:</span>
                          <strong>{m.minScore} / 100</strong>
                        </div>
                        {m.minConfidence > 0 && (
                          <div>
                            <span>Ishonchlilik:</span>
                            <strong>≥ {m.minConfidence}%</strong>
                          </div>
                        )}
                        <div>
                          <span>Qatlamlar:</span>
                          <strong>{m.requiredLayers.map((l) => l.key).join(", ")}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Next Step / Goal Summary Card */}
      <div className="roadmap-next-card" onClick={() => setModalOpen(true)}>
        <div className="roadmap-next-icon">
          {nextMilestone ? <Icon name="target" size={18} /> : <Icon name="award" size={18} />}
        </div>
        <div className="roadmap-next-content">
          <div className="roadmap-next-title">
            <span>
              {nextMilestone
                ? `Keyingi pog‘ona: ${nextMilestone.code} · ${nextMilestone.name}`
                : "Eng yuqori pog‘ona: L5 · MASTER"}
            </span>
            {nextMilestone && remainingScore > 0 && (
              <span className="roadmap-points-pill">{remainingScore} ball qoldi</span>
            )}
          </div>
          <p className="roadmap-next-text">
            {nextMilestone
              ? blockers && blockers.length > 0
                ? blockers[0]
                : remainingScore > 0
                ? `${nextMilestone.title} darajasiga o‘tish uchun yana ${remainingScore} ball to‘plang.`
                : remainingConf > 0
                ? `Ishonchlilikni yana ${remainingConf}% ga oshiring.`
                : nextMilestone.nextTip
              : "Barcha 5 qatlam to‘liq o‘zlashtirilgan va tasdiqlangan!"}
          </p>

          {nextMilestone && (
            <div className="roadmap-mini-meter">
              <div
                className="roadmap-mini-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      10,
                      Math.round(
                        ((currentScore - (currentMilestone ? currentMilestone.minScore : 0)) /
                          (nextMilestone.minScore - (currentMilestone ? currentMilestone.minScore : 0))) *
                          100
                      )
                    )
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Full Roadmap Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <div
            className="modal roadmap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="roadmap-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Yopish"
              onClick={() => setModalOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>

            <div className="modal-symbol">
              <Icon name="dna" size={24} />
            </div>

            <div className="roadmap-modal-header">
              <p className="eyebrow">KOMPETENSIYA MODELI · 5 QATLAM</p>
              <h2 id="roadmap-modal-title">{directionTitle} — Rivojlanish Yo‘l Xaritasi</h2>
              <p>
                SKILL DNA platformasida kasbiy malaka rasmiy 5 bosqich (L1–L5) orqali o‘lchanadi.
                Har bir pog‘ona yangi amaliy qatlamlar va isbotlangan dalillar bilan ochiladi.
              </p>
            </div>

            {/* Current Position Banner inside Modal */}
            <div className="roadmap-modal-current">
              <div className="roadmap-modal-current-badge">
                <Icon name="sparkles" size={16} />
                <span>Hozirgi holatingiz:</span>
                <strong>{currentLevel}</strong>
              </div>
              <div className="roadmap-modal-stats">
                <span>Skill Score: <b>{currentScore}/100</b></span>
                <span className="sep">•</span>
                <span>Ishonchlilik: <b>{confidence}%</b></span>
                {nextMilestone && (
                  <>
                    <span className="sep">•</span>
                    <span style={{ color: "var(--accent)" }}>
                      Maqsad: <b>{nextMilestone.code} {nextMilestone.name}</b> ({remainingScore} ball qoldi)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Timeline Cards for all 5 milestones */}
            <div className="roadmap-timeline">
              {MILESTONES.map((m) => {
                const isPassed = currentRank > m.level;
                const isCurrent = currentRank === m.level || (currentRank === 0 && m.level === 1);
                const isLocked = currentRank < m.level && !isCurrent;

                return (
                  <div
                    key={m.code}
                    className={`roadmap-card-item ${
                      isPassed ? "is-passed" : isCurrent ? "is-current" : "is-locked"
                    }`}
                  >
                    <div className="roadmap-card-status">
                      <div className={`roadmap-card-pill ${isPassed ? "pill-passed" : isCurrent ? "pill-current" : "pill-locked"}`}>
                        {isPassed ? (
                          <><Icon name="checkCircle" size={15} /> O‘zlashtirildi</>
                        ) : isCurrent ? (
                          <><Icon name="target" size={15} /> Joriy daraja</>
                        ) : (
                          <><Icon name="lock" size={14} /> Qulflangan</>
                        )}
                      </div>
                      <span className="roadmap-card-level-tag">{m.code}</span>
                    </div>

                    <div className="roadmap-card-body">
                      <div className="roadmap-card-title-row">
                        <h3>{m.code} · {m.name} ({m.title})</h3>
                        <span className="roadmap-card-sub">{m.subtitle}</span>
                      </div>
                      <p className="roadmap-card-desc">{m.description}</p>

                      <div className="roadmap-card-requirements">
                        <div className="roadmap-req-item">
                          <span>Ball:</span>
                          <strong>≥ {m.minScore} ball</strong>
                          <small className={currentScore >= m.minScore ? "text-success" : "text-muted"}>
                            (sizda: {currentScore})
                          </small>
                        </div>

                        {m.minConfidence > 0 && (
                          <div className="roadmap-req-item">
                            <span>Ishonch:</span>
                            <strong>≥ {m.minConfidence}%</strong>
                            <small className={confidence >= m.minConfidence ? "text-success" : "text-muted"}>
                              (sizda: {confidence}%)
                            </small>
                          </div>
                        )}

                        <div className="roadmap-req-item full">
                          <span>Kerakli qatlamlar:</span>
                          <div className="roadmap-req-layers">
                            {m.requiredLayers.map((l) => (
                              <span key={l.key} className={`layer-chip chip-${l.tone}`}>
                                {l.key} ({l.label})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="roadmap-card-action-box">
                        <Icon name="arrow" size={14} />
                        <span><strong>Tavsiya:</strong> {m.nextTip}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="roadmap-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalOpen(false)}
              >
                Yopish
              </button>
              {onStartAssessment && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setModalOpen(false);
                    onStartAssessment();
                  }}
                >
                  <Icon name="arrow" size={16} />
                  <span>Baholash topshiriqlarini bajarish</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
