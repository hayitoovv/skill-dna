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
  sectorName: string;
  sectorRegion: string;
  elevation: string;
  coord: string;
  roleTitle: string;
  iconName: IconName;
  minScore: number;
  minConfidence: number;
  requiredLayers: { key: string; label: string; tone: string }[];
  rewardBadge: string;
  description: string;
  nextTip: string;
  mapPos: { x: number; y: number };
}

export const MILESTONES: Milestone[] = [
  {
    level: 1,
    code: "L1",
    name: "KNOW",
    title: "Nazariy poydevor",
    sectorName: "Nazariya Vohasi",
    sectorRegion: "Basecamp vodiysi",
    elevation: "120 m",
    coord: "41°18'N · 69°12'E",
    roleTitle: "Junior Nazariyotchi",
    iconName: "bookOpen",
    minScore: 40,
    minConfidence: 0,
    requiredLayers: [{ key: "KNOW", label: "Nazariya", tone: "blue" }],
    rewardBadge: "Skill DNA Profili",
    description: "Sohaning fundamental tamoyillari, atamalar va asosiy nazariy tushunchalar.",
    nextTip: "KNOW test sinovlaridan o‘tib, kamida 40 ball to‘plang.",
    mapPos: { x: 130, y: 390 },
  },
  {
    level: 2,
    code: "L2",
    name: "APPLY",
    title: "Amaliy ijro",
    sectorName: "Amaliyot Qal'asi",
    sectorRegion: "Code Forge tekisligi",
    elevation: "380 m",
    coord: "41°19'N · 69°14'E",
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
    mapPos: { x: 340, y: 220 },
  },
  {
    level: 3,
    code: "L3",
    name: "ADAPT",
    title: "Moslashuvchanlik",
    sectorName: "Moslashuv Kanyoni",
    sectorRegion: "Challenge darasi",
    elevation: "620 m",
    coord: "41°18'N · 69°16'E",
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
    mapPos: { x: 540, y: 360 },
  },
  {
    level: 4,
    code: "L4",
    name: "CREATE",
    title: "Yaratuvchanlik",
    sectorName: "Arxitektura Qoyasi",
    sectorRegion: "Viva balandligi",
    elevation: "840 m",
    coord: "41°20'N · 69°18'E",
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
    mapPos: { x: 740, y: 190 },
  },
  {
    level: 5,
    code: "L5",
    name: "MASTER",
    title: "Ekspert daraja",
    sectorName: "Mahorat Cho'qqisi",
    sectorRegion: "Zenith Sanctuary cho‘qqisi",
    elevation: "1000 m",
    coord: "41°21'N · 69°20'E",
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
    mapPos: { x: 910, y: 90 },
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

// Cubic bezier point calculator
function getPointOnBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
  return { x: Math.round(x), y: Math.round(y) };
}

// Get player position on the map path based on score
function getPlayerTrailPoint(score: number): { x: number; y: number } {
  if (score <= 40) {
    const t = Math.max(0.1, Math.min(1, score / 40));
    return getPointOnBezier({ x: 40, y: 440 }, { x: 70, y: 440 }, { x: 100, y: 390 }, { x: 130, y: 390 }, t);
  }
  if (score <= 55) {
    const t = Math.max(0, Math.min(1, (score - 40) / (55 - 40)));
    return getPointOnBezier({ x: 130, y: 390 }, { x: 210, y: 390 }, { x: 250, y: 220 }, { x: 340, y: 220 }, t);
  }
  if (score <= 70) {
    const t = Math.max(0, Math.min(1, (score - 55) / (70 - 55)));
    return getPointOnBezier({ x: 340, y: 220 }, { x: 430, y: 220 }, { x: 450, y: 360 }, { x: 540, y: 360 }, t);
  }
  if (score <= 82) {
    const t = Math.max(0, Math.min(1, (score - 70) / (82 - 70)));
    return getPointOnBezier({ x: 540, y: 360 }, { x: 630, y: 360 }, { x: 660, y: 190 }, { x: 740, y: 190 }, t);
  }
  const t = Math.max(0, Math.min(1, (score - 82) / (90 - 82)));
  return getPointOnBezier({ x: 740, y: 190 }, { x: 810, y: 190 }, { x: 840, y: 90 }, { x: 910, y: 90 }, t);
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
  const [viewMode, setViewMode] = useState<"hud" | "tree">("tree");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const currentRank = parseRank(currentLevel, isNewUser, currentScore);

  const nextMilestone = MILESTONES.find((m) => m.level > currentRank) ?? null;
  const currentMilestone = MILESTONES.find((m) => m.level === currentRank) ?? null;

  // Selected sector on the adventure map (defaults to the active next goal)
  const [selectedSector, setSelectedSector] = useState<number>(
    nextMilestone ? nextMilestone.level : currentRank || 1
  );

  const activeSectorMilestone = MILESTONES.find((m) => m.level === selectedSector) || MILESTONES[0];

  // Dynamic player map point
  const playerPos = getPlayerTrailPoint(currentScore);

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

  // Dossier status checks
  const dossierPassed = currentRank >= activeSectorMilestone.level;
  const dossierNext = nextMilestone?.level === activeSectorMilestone.level;
  const dossierLocked = !dossierPassed && !dossierNext;

  return (
    <div className="cyber-roadmap-widget">
      {/* Ambient background glows */}
      <div className="cyber-bg-glow cyber-bg-glow-1" />
      <div className="cyber-bg-glow cyber-bg-glow-2" />

      {/* Top HUD Control Bar */}
      <div className="cyber-hud-header">
        <div className="cyber-hud-left">
          <div className="cyber-symbol-box">
            <Icon name="dna" size={18} />
          </div>
          <div className="cyber-hud-title-wrap">
            <div className="cyber-live-badge">
              <span className="cyber-radar-ping" />
              <span>{currentLevel} · {currentScore} BALL</span>
            </div>
            <h3 className="cyber-main-title">{directionTitle} — Ko‘nikmalar Yo‘l Xaritasi</h3>
            <p className="cyber-sub-title">
              5 ta kompetensiya qatlami bo‘yicha kasbiy ekspeditsiya va o‘sish marshruti
            </p>
          </div>
        </div>

        <div className="cyber-hud-controls">
          <div className="cyber-toggle-group">
            <button
              type="button"
              className={`cyber-toggle-btn ${viewMode === "tree" ? "active" : ""}`}
              onClick={() => setViewMode("tree")}
              title="Topografik ekspeditsiya xaritasi"
            >
              <Icon name="workflow" size={13} />
              <span>Xarita 🗺</span>
            </button>
            <button
              type="button"
              className={`cyber-toggle-btn ${viewMode === "hud" ? "active" : ""}`}
              onClick={() => setViewMode("hud")}
              title="Ixcham HUD lazerli stepper"
            >
              <Icon name="grid" size={13} />
              <span>HUD</span>
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

      {/* MODE 2: REAL TOPOGRAPHIC EXPEDITION MAP (Visual Interactive Cartography) */}
      {viewMode === "tree" && (
        <div className="topo-map-container">
          {/* Topographic Toolbar */}
          <div className="topo-map-toolbar">
            <div className="topo-map-info">
              <div className="topo-radar-live">
                <span className="topo-radar-dot" />
                <span>TOPOGRAFIK EKSPEDITSIYA REJASI</span>
              </div>
              <div className="topo-coord-stamp">
                GPS: 41°19'N · 69°14'E | MASSHTAB: 1:25000 | BALANDLIK: ▲ 120M — 1000M
              </div>
            </div>

            <div className="topo-map-quick-sectors">
              <span className="topo-quick-lbl">Sektorlar:</span>
              {MILESTONES.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  className={`topo-sector-chip ${selectedSector === m.level ? "chip-active" : ""}`}
                  onClick={() => setSelectedSector(m.level)}
                  title={`${m.code} · ${m.sectorName} (${m.elevation})`}
                >
                  <span>{m.code}</span>
                  <small>▲{m.elevation}</small>
                </button>
              ))}

              <button
                type="button"
                className="topo-locate-btn"
                onClick={() => setSelectedSector(nextMilestone ? nextMilestone.level : currentRank || 1)}
                title="Sizning hozirgi pozitsiyangizga yo‘naltirish"
              >
                <Icon name="sparkles" size={13} />
                <span>Pozitsiyam</span>
              </button>
            </div>
          </div>

          {/* Scrollable / Scalable SVG Map Canvas */}
          <div className="topo-canvas-wrapper">
            <svg
              viewBox="0 0 1000 520"
              className="topo-svg-map"
              aria-label="Skill DNA Topografik Ekspeditsiya Xaritasi"
            >
              <defs>
                {/* Cartographic topo grid pattern */}
                <pattern id="topoGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="1" />
                  <circle cx="0" cy="0" r="1.5" fill="rgba(56, 189, 248, 0.15)" />
                </pattern>

                {/* Traversed road neon gradient */}
                <linearGradient id="traversedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="70%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>

                {/* Fog of war radial haze */}
                <radialGradient id="fogCloudGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(15, 23, 42, 0.95)" />
                  <stop offset="60%" stopColor="rgba(15, 23, 42, 0.75)" />
                  <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
                </radialGradient>

                {/* Active radar beacon gradient */}
                <radialGradient id="beaconWaveGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(56, 189, 248, 0.6)" />
                  <stop offset="50%" stopColor="rgba(56, 189, 248, 0.2)" />
                  <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
                </radialGradient>
              </defs>

              {/* Background map grid */}
              <rect width="1000" height="520" fill="url(#topoGrid)" />

              {/* Topographical Latitude / Longitude lines */}
              <g className="topo-coord-lines" stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3">
                <line x1="200" y1="0" x2="200" y2="520" />
                <line x1="400" y1="0" x2="400" y2="520" />
                <line x1="600" y1="0" x2="600" y2="520" />
                <line x1="800" y1="0" x2="800" y2="520" />
                <line x1="0" y1="130" x2="1000" y2="130" />
                <line x1="0" y1="260" x2="1000" y2="260" />
                <line x1="0" y1="390" x2="1000" y2="390" />
              </g>

              {/* Coordinate border ticks */}
              <text x="204" y="20" className="topo-grid-tick">69°12'E</text>
              <text x="404" y="20" className="topo-grid-tick">69°14'E</text>
              <text x="604" y="20" className="topo-grid-tick">69°16'E</text>
              <text x="804" y="20" className="topo-grid-tick">69°18'E</text>
              <text x="12" y="134" className="topo-grid-tick">41°21'N</text>
              <text x="12" y="264" className="topo-grid-tick">41°19'N</text>
              <text x="12" y="394" className="topo-grid-tick">41°18'N</text>

              {/* Topographic Contour Elevation Loops (Real Topo Elevation Circles) */}
              <g className="topo-contours">
                {/* Sector 5: Mahorat Cho'qqisi (Peak elevation: 1000m) */}
                <path
                  d="M 830 110 C 830 50, 970 40, 970 100 C 970 150, 860 160, 830 110 Z"
                  className="topo-contour topo-contour-low"
                />
                <path
                  d="M 860 100 C 860 65, 950 55, 950 95 C 950 130, 880 140, 860 100 Z"
                  className="topo-contour topo-contour-mid"
                />
                <path
                  d="M 885 92 C 885 75, 935 70, 935 90 C 935 110, 895 115, 885 92 Z"
                  className="topo-contour topo-contour-high"
                />
                <text x="945" y="65" className="topo-elevation-tag">▲ 1000m</text>

                {/* Sector 4: Arxitektura Qoyasi (Peak elevation: 840m) */}
                <path
                  d="M 670 210 C 660 145, 800 135, 810 195 C 815 250, 690 265, 670 210 Z"
                  className="topo-contour topo-contour-low"
                />
                <path
                  d="M 700 195 C 695 165, 775 160, 775 195 C 775 225, 710 230, 700 195 Z"
                  className="topo-contour topo-contour-mid"
                />
                <text x="785" y="165" className="topo-elevation-tag">▲ 840m</text>

                {/* Sector 3: Moslashuv Kanyoni (Canyon elevation: 620m) */}
                <path
                  d="M 460 345 C 460 285, 610 285, 620 355 C 625 415, 475 435, 460 345 Z"
                  className="topo-contour topo-contour-low"
                />
                <path
                  d="M 495 355 C 495 320, 585 320, 585 365 C 585 400, 505 405, 495 355 Z"
                  className="topo-contour topo-contour-mid"
                />
                <text x="595" y="325" className="topo-elevation-tag">▲ 620m</text>

                {/* Sector 2: Amaliyot Qal'asi (Plateau elevation: 380m) */}
                <path
                  d="M 260 235 C 255 165, 410 155, 420 225 C 425 275, 280 295, 260 235 Z"
                  className="topo-contour topo-contour-low"
                />
                <path
                  d="M 295 222 C 295 185, 385 180, 385 222 C 385 255, 310 260, 295 222 Z"
                  className="topo-contour topo-contour-mid"
                />
                <text x="395" y="185" className="topo-elevation-tag">▲ 380m</text>

                {/* Sector 1: Nazariya Vohasi (Basecamp elevation: 120m) */}
                <path
                  d="M 50 415 C 50 335, 205 325, 215 395 C 220 455, 75 470, 50 415 Z"
                  className="topo-contour topo-contour-low"
                />
                <path
                  d="M 85 395 C 85 355, 175 350, 175 395 C 175 430, 100 435, 85 395 Z"
                  className="topo-contour topo-contour-mid"
                />
                <text x="185" y="355" className="topo-elevation-tag">▲ 120m</text>
              </g>

              {/* Compass Rose (Windrose / Kompas) */}
              <g className="topo-compass-group" transform="translate(68, 68)">
                <circle cx="0" cy="0" r="32" className="compass-outer-ring" />
                <circle cx="0" cy="0" r="24" className="compass-inner-ring" />
                {/* 4 cardinal points */}
                <polygon points="0,-28 4,-8 0,0 -4,-8" fill="#38bdf8" />
                <polygon points="0,28 4,8 0,0 -4,8" fill="rgba(148, 163, 184, 0.4)" />
                <polygon points="28,0 8,4 0,0 8,-4" fill="rgba(148, 163, 184, 0.4)" />
                <polygon points="-28,0 -8,4 0,0 -8,-4" fill="rgba(148, 163, 184, 0.4)" />
                <circle cx="0" cy="0" r="3" fill="#ffffff" />
                <text x="0" y="-34" className="compass-n-label">N</text>
                <text x="34" y="3" className="compass-lbl">E</text>
                <text x="0" y="40" className="compass-lbl">S</text>
                <text x="-38" y="3" className="compass-lbl">W</text>
              </g>

              {/* Base Expedition Trail (Winding Mountain Highway) */}
              <path
                d="M 40 440 C 70 440, 100 390, 130 390 C 210 390, 250 220, 340 220 C 430 220, 450 360, 540 360 C 630 360, 660 190, 740 190 C 810 190, 840 90, 910 90"
                className="topo-road-base"
              />
              <path
                d="M 40 440 C 70 440, 100 390, 130 390 C 210 390, 250 220, 340 220 C 430 220, 450 360, 540 360 C 630 360, 660 190, 740 190 C 810 190, 840 90, 910 90"
                className="topo-road-dashes"
              />

              {/* Traversed Road Glow (From start to player position) */}
              <path
                d={`M 40 440 C 70 440, 100 390, 130 390 ${
                  currentScore > 40
                    ? `C 210 390, 250 220, ${playerPos.x} ${playerPos.y}`
                    : ""
                }`}
                className="topo-road-traversed"
              />

              {/* Active navigation energy vector towards next milestone */}
              {nextMilestone && (
                <line
                  x1={playerPos.x}
                  y1={playerPos.y}
                  x2={nextMilestone.mapPos.x}
                  y2={nextMilestone.mapPos.y}
                  className="topo-nav-vector"
                />
              )}

              {/* Fog of War for unreached sectors */}
              {MILESTONES.map((m) => {
                const isFogged = m.level > currentRank + 1;
                if (!isFogged) return null;

                return (
                  <g key={`fog-${m.code}`} className="topo-fog-zone">
                    <circle cx={m.mapPos.x} cy={m.mapPos.y} r="65" fill="url(#fogCloudGradient)" />
                    <text x={m.mapPos.x} y={m.mapPos.y - 36} className="topo-fog-tag">
                      🔒 KASHF QILINMAGAN
                    </text>
                  </g>
                );
              })}

              {/* 5 Sector Outpost Nodes */}
              {MILESTONES.map((m) => {
                const isPassed = currentRank >= m.level;
                const isNext = nextMilestone?.level === m.level;
                const isLocked = m.level > currentRank + 1;
                const isSelected = selectedSector === m.level;

                return (
                  <g
                    key={m.code}
                    className="topo-sector-node"
                    onClick={() => setSelectedSector(m.level)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Focus ring for selected sector */}
                    {isSelected && (
                      <circle
                        cx={m.mapPos.x}
                        cy={m.mapPos.y}
                        r="34"
                        className="topo-node-focus-ring"
                      />
                    )}

                    {/* Active next goal beacon radar waves */}
                    {isNext && (
                      <>
                        <circle
                          cx={m.mapPos.x}
                          cy={m.mapPos.y}
                          r="28"
                          className="topo-node-beacon-wave"
                        />
                        <circle
                          cx={m.mapPos.x}
                          cy={m.mapPos.y}
                          r="42"
                          className="topo-node-radar-wave"
                        />
                      </>
                    )}

                    {/* Outpost Base Perimeter Disc */}
                    <circle
                      cx={m.mapPos.x}
                      cy={m.mapPos.y}
                      r="22"
                      className={`topo-outpost-disc ${
                        isPassed ? "disc-passed" : isNext ? "disc-next" : "disc-locked"
                      }`}
                    />

                    {/* Outpost Code & Flag */}
                    <text
                      x={m.mapPos.x}
                      y={m.mapPos.y + 5}
                      className={`topo-outpost-code ${isPassed ? "code-passed" : isNext ? "code-next" : "code-locked"}`}
                    >
                      {m.code}
                    </text>

                    {/* Outpost Label HUD Badge */}
                    <g transform={`translate(${m.mapPos.x}, ${m.mapPos.y + 30})`}>
                      <rect
                        x="-70"
                        y="0"
                        width="140"
                        height="26"
                        rx="6"
                        className={`topo-label-box ${isSelected ? "box-selected" : ""}`}
                      />
                      <text x="0" y="12" className="topo-label-name">
                        {m.sectorName}
                      </text>
                      <text x="0" y="21" className="topo-label-meta">
                        ▲ {m.elevation} · ≥{m.minScore}b
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Dynamic Player Position Marker (Siz Shu Yerdasiz) */}
              <g className="topo-player-marker" transform={`translate(${playerPos.x}, ${playerPos.y})`}>
                {/* Sonar pulses */}
                <circle cx="0" cy="0" r="14" className="player-sonar-wave player-sonar-1" />
                <circle cx="0" cy="0" r="26" className="player-sonar-wave player-sonar-2" />

                {/* Pin core */}
                <circle cx="0" cy="0" r="9" className="player-pin-core" />
                <circle cx="0" cy="0" r="4" fill="#ffffff" />

                {/* Player Floating Callout Flag */}
                <g transform="translate(0, -38)">
                  <rect
                    x="-75"
                    y="-16"
                    width="150"
                    height="32"
                    rx="8"
                    className="player-hud-box"
                  />
                  <polygon points="-6,16 6,16 0,22" fill="#10b981" />
                  <text x="0" y="-3" className="player-hud-title">
                    📍 SIZ SHU YERDASIZ ({currentScore}b)
                  </text>
                  <text x="0" y="9" className="player-hud-sub">
                    {nextMilestone ? `➔ ${nextMilestone.code} (+${remainingScore}b qoldi)` : "MAKSIMAL BALANDLIK"}
                  </text>
                </g>
              </g>

              {/* Scale bar at bottom-left */}
              <g className="topo-scale-bar" transform="translate(40, 480)">
                <line x1="0" y1="0" x2="120" y2="0" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="2" />
                <line x1="0" y1="-4" x2="0" y2="4" stroke="rgba(148, 163, 184, 0.6)" strokeWidth="2" />
                <line x1="60" y1="-3" x2="60" y2="3" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1.5" />
                <line x1="120" y1="-4" x2="120" y2="4" stroke="rgba(148, 163, 184, 0.6)" strokeWidth="2" />
                <text x="60" y="14" className="topo-scale-text">0 — 20 BALL (25 KM) — 40 BALL</text>
              </g>

              {/* Map Legend at bottom-right */}
              <g className="topo-legend" transform="translate(680, 475)">
                <rect x="0" y="0" width="280" height="30" rx="8" className="topo-legend-box" />
                <circle cx="20" cy="15" r="5" fill="#10b981" />
                <text x="30" y="19" className="topo-legend-lbl">O‘zlashtirilgan</text>

                <circle cx="110" cy="15" r="5" fill="#38bdf8" />
                <text x="120" y="19" className="topo-legend-lbl">Faol yo‘l</text>

                <circle cx="190" cy="15" r="5" fill="#64748b" />
                <text x="200" y="19" className="topo-legend-lbl">Tuman (Qulflangan)</text>
              </g>
            </svg>
          </div>

          {/* Interactive Sector Reconnaissance Dossier Panel */}
          <div className="topo-dossier-card">
            <div className="topo-dossier-head">
              <div className="topo-dossier-left">
                <div
                  className={`topo-dossier-icon ${
                    dossierPassed ? "icon-passed" : dossierNext ? "icon-next" : "icon-locked"
                  }`}
                >
                  <Icon name={activeSectorMilestone.iconName} size={22} />
                </div>
                <div>
                  <div className="topo-dossier-kicker">
                    <span>SEKTOR 0{activeSectorMilestone.level}</span>
                    <span>•</span>
                    <span>{activeSectorMilestone.coord}</span>
                    <span>•</span>
                    <span>▲ {activeSectorMilestone.elevation}</span>
                  </div>
                  <h3 className="topo-dossier-title">
                    {activeSectorMilestone.code} · {activeSectorMilestone.sectorName}
                    <span className="topo-dossier-region">({activeSectorMilestone.sectorRegion})</span>
                  </h3>
                  <p className="topo-dossier-role">
                    Kasbiy maqom: <strong>{activeSectorMilestone.roleTitle}</strong>
                  </p>
                </div>
              </div>

              <div className="topo-dossier-badge-wrap">
                <span
                  className={`topo-status-tag ${
                    dossierPassed ? "tag-passed" : dossierNext ? "tag-next" : "tag-locked"
                  }`}
                >
                  {dossierPassed
                    ? "O‘zlashtirilgan hudud ✅"
                    : dossierNext
                    ? "Faol ekspeditsiya nishoni 🎯"
                    : "Kashf qilinmagan hudud 🔒"}
                </span>
                {dossierNext && remainingScore > 0 && (
                  <span className="topo-remaining-pill">+{remainingScore} ball yetishmayapti</span>
                )}
              </div>
            </div>

            <p className="topo-dossier-desc">{activeSectorMilestone.description}</p>

            <div className="topo-dossier-grid">
              <div className="topo-metric-box">
                <span className="topo-metric-lbl">TALAB ETILADIGAN BALL:</span>
                <strong className="topo-metric-val">≥ {activeSectorMilestone.minScore} / 100</strong>
                <div className="topo-metric-sub">
                  {currentScore >= activeSectorMilestone.minScore ? (
                    <span className="text-emerald">✅ Sizda {currentScore} ball (Yetarli)</span>
                  ) : (
                    <span className="text-amber">
                      Sizda {currentScore} ball ({activeSectorMilestone.minScore - currentScore} ball qoldi)
                    </span>
                  )}
                </div>
              </div>

              <div className="topo-metric-box">
                <span className="topo-metric-lbl">ISHONCHLILIK DARAJASI:</span>
                <strong className="topo-metric-val">≥ {activeSectorMilestone.minConfidence}%</strong>
                <div className="topo-metric-sub">
                  {confidence >= activeSectorMilestone.minConfidence ? (
                    <span className="text-emerald">✅ Sizda {confidence}% (Yetarli)</span>
                  ) : (
                    <span className="text-amber">
                      Sizda {confidence}% ({activeSectorMilestone.minConfidence - confidence}% yetishmayapti)
                    </span>
                  )}
                </div>
              </div>

              <div className="topo-metric-box">
                <span className="topo-metric-lbl">KERAKLI QOBILIYAT QATLAMLARI:</span>
                <div className="topo-chips-row">
                  {activeSectorMilestone.requiredLayers.map((l) => (
                    <span key={l.key} className={`chip-${l.tone}`}>
                      {l.key} ({l.label})
                    </span>
                  ))}
                </div>
              </div>

              <div className="topo-metric-box">
                <span className="topo-metric-lbl">OCHILADIGAN IMTIYOZ / MUKOFOR:</span>
                <strong className="topo-reward-highlight">{activeSectorMilestone.rewardBadge}</strong>
                <span className="topo-metric-sub">Rasmiy sertifikatsiya va vakolat</span>
              </div>
            </div>

            <div className="topo-dossier-action-bar">
              <div className="topo-dossier-tip">
                <Icon name="arrow" size={14} />
                <span>
                  <strong>Ekspeditsiya yo‘riqnomasi:</strong> {activeSectorMilestone.nextTip}
                </span>
              </div>

              {onStartAssessment && (
                <button
                  type="button"
                  className="primary-button topo-launch-btn"
                  onClick={onStartAssessment}
                >
                  <span>Topshiriqni boshlash</span>
                  <Icon name="arrow" size={14} />
                </button>
              )}
            </div>
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
              <p className="eyebrow" style={{ color: "#38bdf8" }}>KASBIY EKSPEDITSIYA MODELI</p>
              <h2 id="roadmap-modal-title" style={{ color: "#fff" }}>
                {directionTitle} — To‘liq Rivojlanish Yo‘l Xaritasi
              </h2>
              <p style={{ color: "#94a3b8" }}>
                Platformada kasbiy mahorat 5 ta rasmiy geografik sektor (L1–L5) orqali o‘lchanadi.
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
                      Maqsad: <b>{nextMilestone.code} · {nextMilestone.sectorName}</b> ({remainingScore} ball qoldi)
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

                return (
                  <div
                    key={m.code}
                    className={`cyber-modal-card ${isPassed ? "modal-passed" : isCurrent ? "modal-current" : "modal-locked"}`}
                  >
                    <div className="cyber-modal-card-top">
                      <div className="cyber-modal-stage-num">{m.code}</div>
                      <div>
                        <h3>{m.code} · {m.sectorName} ({m.title})</h3>
                        <div className="cyber-modal-role-pill">
                          {m.roleTitle} • ▲ {m.elevation} • {m.coord}
                        </div>
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
