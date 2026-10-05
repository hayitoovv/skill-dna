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
  requiredLayers: { key: string; label: string }[];
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
    requiredLayers: [{ key: "KNOW", label: "Nazariya" }],
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
      { key: "KNOW", label: "Nazariya" },
      { key: "DO", label: "Amaliy ijro" },
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
      { key: "DO", label: "Amaliy ijro" },
      { key: "ADAPT", label: "Moslashuv" },
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
      { key: "DO", label: "Amaliy ijro" },
      { key: "ADAPT", label: "Moslashuv" },
      { key: "DEFEND", label: "Viva himoya" },
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
      { key: "KNOW", label: "Nazariya" },
      { key: "DO", label: "Amaliy ijro" },
      { key: "ADAPT", label: "Moslashuv" },
      { key: "DEFEND", label: "Viva himoya" },
      { key: "PROVE", label: "Real dalillar" },
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
  const [modalOpen, setModalOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const currentRank = parseRank(currentLevel, isNewUser, currentScore);
  const nextMilestone = MILESTONES.find((m) => m.level > currentRank) ?? null;
  const remainingScore = nextMilestone ? Math.max(0, nextMilestone.minScore - currentScore) : 0;

  // Calculate overall track progress percentage (from 0% at L1 to 100% at L5)
  // L1 is at 0%, L2 at 25%, L3 at 50%, L4 at 75%, L5 at 100%
  const getOverallProgressPct = (): number => {
    if (isNewUser || currentScore <= 0) return 0;
    if (currentScore <= 40) return Math.min(25, Math.round((currentScore / 40) * 12));
    if (currentScore <= 55) return 25 + Math.round(((currentScore - 40) / 15) * 25);
    if (currentScore <= 70) return 50 + Math.round(((currentScore - 55) / 15) * 25);
    if (currentScore <= 82) return 75 + Math.round(((currentScore - 70) / 12) * 15);
    if (currentScore <= 90) return 90 + Math.round(((currentScore - 82) / 8) * 10);
    return 100;
  };

  const trackProgressPct = getOverallProgressPct();

  return (
    <div className="sr-container">
      {/* Header */}
      <div className="sr-header">
        <div className="sr-title-wrap">
          <Icon name="workflow" size={13} />
          <span>Yo‘l xaritasi (Roadmap)</span>
        </div>
        <button
          type="button"
          className="sr-detail-btn"
          onClick={() => setModalOpen(true)}
          title="To‘liq bosqichlar va talablar"
        >
          <span>Batafsil</span>
          <Icon name="arrow" size={12} />
        </button>
      </div>

      {/* 5-Step Milestone Track */}
      <div className="sr-track-wrapper">
        {/* Continuous background bar */}
        <div className="sr-line-bg" />
        {/* Dynamic progress bar */}
        <div
          className="sr-line-fill"
          style={{ width: `calc(${trackProgressPct}% * 0.88 + 6%)` }}
        />

        {/* 5 Nodes */}
        <div className="sr-nodes">
          {MILESTONES.map((m) => {
            const isCompleted = currentRank > m.level;
            const isCurrent = currentRank === m.level || (currentRank === 0 && m.level === 1);
            const isLocked = currentRank < m.level && !isCurrent;
            const isHovered = hoveredNode === m.level;

            return (
              <div
                key={m.code}
                className="sr-node-item"
                onMouseEnter={() => setHoveredNode(m.level)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setModalOpen(true)}
              >
                {/* Node Circle */}
                <div
                  className={`sr-node-circle ${
                    isCompleted ? "is-done" : isCurrent ? "is-current" : "is-locked"
                  }`}
                >
                  {isCompleted ? (
                    <Icon name="check" size={14} />
                  ) : (
                    <span>{m.code}</span>
                  )}
                  {isCurrent && <span className="sr-pulse-ring" />}
                </div>

                {/* Node Label */}
                <div className="sr-node-text">
                  <strong className={isCurrent ? "current-label" : ""}>{m.name}</strong>
                  <span className="sr-node-pts">≥{m.minScore}b</span>
                </div>

                {/* Popover on Hover */}
                {isHovered && (
                  <div className="sr-popover" onClick={(e) => e.stopPropagation()}>
                    <div className="sr-popover-head">
                      <strong>{m.code} · {m.name}</strong>
                      <span className={`sr-popover-tag ${isCompleted ? "tag-done" : isCurrent ? "tag-current" : "tag-lock"}`}>
                        {isCompleted ? "Erishildi" : isCurrent ? "Hozirgi" : "Qulflangan"}
                      </span>
                    </div>
                    <p className="sr-popover-desc">{m.description}</p>
                    <div className="sr-popover-info">
                      <div>
                        <span>Min. ball:</span>
                        <b>{m.minScore} / 100</b>
                      </div>
                      {m.minConfidence > 0 && (
                        <div>
                          <span>Ishonchlilik:</span>
                          <b>≥ {m.minConfidence}%</b>
                        </div>
                      )}
                      <div>
                        <span>Imtiyoz:</span>
                        <b className="sr-reward-text">{m.rewardBadge}</b>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact Next Goal Banner */}
      <div className="sr-goal-banner">
        <div className="sr-goal-info">
          <div className="sr-goal-icon">
            <Icon name={nextMilestone ? "target" : "award"} size={14} />
          </div>
          <div className="sr-goal-texts">
            <div className="sr-goal-title">
              <strong>
                {nextMilestone
                  ? `Keyingi: ${nextMilestone.code} · ${nextMilestone.name}`
                  : "Maksimal daraja: L5 · MASTER"}
              </strong>
              {nextMilestone && remainingScore > 0 && (
                <span className="sr-rem-badge">+{remainingScore} ball</span>
              )}
            </div>
            <span className="sr-goal-sub">
              {nextMilestone
                ? blockers && blockers.length > 0
                  ? blockers[0]
                  : nextMilestone.nextTip
                : "Barcha 5 kompetensiya qatlami to‘liq o‘zlashtirildi"}
            </span>
          </div>
        </div>

        {onStartAssessment && nextMilestone && (
          <button
            type="button"
            className="sr-goal-btn"
            onClick={onStartAssessment}
          >
            <span>Topshiriq</span>
            <Icon name="arrow" size={12} />
          </button>
        )}
      </div>

      {/* Full Screen Career Roadmap Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <div
            className="modal sr-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Yopish"
              onClick={() => setModalOpen(false)}
            >
              <Icon name="close" size={16} />
            </button>

            {/* Modal Header */}
            <div className="sr-modal-header">
              <div className="sr-modal-icon">
                <Icon name="workflow" size={20} />
              </div>
              <div>
                <h2>{directionTitle} — Yo‘l Xaritasi</h2>
                <p>5 ta kompetensiya qatlami bo‘yicha kasbiy o‘sish va darajalar tizimi</p>
              </div>
            </div>

            {/* Current Summary Strip */}
            <div className="sr-modal-status-bar">
              <div className="sr-status-cell">
                <span>Hozirgi daraja</span>
                <strong>{currentLevel}</strong>
              </div>
              <div className="sr-status-cell">
                <span>Umumiy ball</span>
                <strong style={{ color: "var(--navy)" }}>{currentScore} / 100</strong>
              </div>
              <div className="sr-status-cell">
                <span>Ishonchlilik</span>
                <strong style={{ color: "var(--emerald)" }}>{confidence}%</strong>
              </div>
            </div>

            {/* 5 Milestone Cards */}
            <div className="sr-modal-list">
              {MILESTONES.map((m) => {
                const isPassed = currentRank > m.level;
                const isNow = currentRank === m.level || (currentRank === 0 && m.level === 1);
                const isUpcoming = nextMilestone?.level === m.level;

                return (
                  <div
                    key={m.code}
                    className={`sr-modal-card ${
                      isPassed ? "card-passed" : isNow ? "card-now" : isUpcoming ? "card-upcoming" : "card-locked"
                    }`}
                  >
                    <div className="sr-card-head">
                      <div className="sr-card-left">
                        <div className="sr-badge-circle">
                          {isPassed ? (
                            <Icon name="check" size={16} />
                          ) : (
                            <span>{m.code}</span>
                          )}
                        </div>
                        <div>
                          <div className="sr-card-name-row">
                            <h3>{m.code} · {m.name}</h3>
                            <span className="sr-role-pill">{m.roleTitle}</span>
                          </div>
                          <span className="sr-card-title">{m.title}</span>
                        </div>
                      </div>

                      <div className="sr-card-badge-wrap">
                        {isPassed ? (
                          <span className="sr-state-pill pill-passed">
                            <Icon name="check" size={12} /> O‘zlashtirildi
                          </span>
                        ) : isNow ? (
                          <span className="sr-state-pill pill-now">
                            <Icon name="sparkles" size={12} /> Hozirgi daraja
                          </span>
                        ) : isUpcoming ? (
                          <span className="sr-state-pill pill-target">
                            <Icon name="target" size={12} /> Keyingi maqsad
                          </span>
                        ) : (
                          <span className="sr-state-pill pill-lock">
                            <Icon name="lock" size={12} /> Qulflangan
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="sr-card-desc">{m.description}</p>

                    <div className="sr-card-reqs-grid">
                      <div className="sr-req-item">
                        <span>Minimal ball:</span>
                        <strong>≥ {m.minScore} ball</strong>
                      </div>
                      <div className="sr-req-item">
                        <span>Ishonchlilik:</span>
                        <strong>{m.minConfidence > 0 ? `≥ ${m.minConfidence}%` : "Talab etilmaydi"}</strong>
                      </div>
                      <div className="sr-req-item">
                        <span>Qatlamlar:</span>
                        <div className="sr-layer-tags">
                          {m.requiredLayers.map((l) => (
                            <span key={l.key} className="sr-layer-tag">
                              {l.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="sr-req-item">
                        <span>Sertifikat / Imtiyoz:</span>
                        <strong className="sr-card-reward">{m.rewardBadge}</strong>
                      </div>
                    </div>

                    {isUpcoming && (
                      <div className="sr-card-tip">
                        <Icon name="sparkles" size={15} />
                        <span><strong>Keyingi qadam:</strong> {m.nextTip}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="sr-modal-foot">
              {onStartAssessment && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setModalOpen(false);
                    onStartAssessment();
                  }}
                >
                  <Icon name="lightning" size={15} />
                  <span>Topshiriqlarni bajarish</span>
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalOpen(false)}
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
