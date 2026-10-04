"""Skill Score, Confidence Score and level rules — architecture document v2.0, section 6.

Pure functions only: no database access, so the formulas can be tested directly against the
worked example in section 6.5. Every stored result carries FORMULA_VERSION; when the formula
changes, scores are recomputed from evidence (skill_scores is derived data, section 4).
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from math import sqrt
from typing import Dict, Iterable, List, Optional, Sequence

FORMULA_VERSION = "v1.0"

LAYERS = ("KNOW", "DO", "ADAPT", "DEFEND", "PROVE")
LAYER_WEIGHTS: Dict[str, float] = {"KNOW": 0.15, "DO": 0.30, "ADAPT": 0.20, "DEFEND": 0.20, "PROVE": 0.15}

# 6.1: only the latest attempts count, newest weighted heaviest
RECENT_ATTEMPTS = 3
RECENT_ATTEMPT_WEIGHTS = (3.0, 2.0, 1.0)

# 6.3 constants
CONSISTENCY_SIGMA_CAP = 25.0
VOLUME_TARGET = 8
VERIFICATION_TARGET = 2
RECENCY_WINDOW_DAYS = 365
RECENCY_HALF_LIFE_DAYS = 182.5


@dataclass(frozen=True)
class EvidenceItem:
    layer: str
    score: float  # 0..100
    created_at: datetime
    human_verified: bool = False


@dataclass(frozen=True)
class LevelRule:
    code: str
    name: str
    min_score: float
    required_layers: tuple
    min_confidence: float


# 6.4 level table (initial thresholds, calibrated during the pilot)
LEVEL_RULES: tuple = (
    LevelRule("L1", "KNOW", 40, ("KNOW",), 0),
    LevelRule("L2", "APPLY", 55, ("KNOW", "DO"), 0),
    LevelRule("L3", "ADAPT", 70, ("DO", "ADAPT"), 50),
    LevelRule("L4", "CREATE", 82, ("DO", "ADAPT", "DEFEND"), 70),
    LevelRule("L5", "MASTER", 90, ("DO", "ADAPT", "DEFEND", "PROVE"), 85),
)


@dataclass
class ScoreResult:
    score: float
    confidence: float
    level: str  # e.g. "L4 CREATE" or "L0"
    layer_scores: Dict[str, float]
    confidence_parts: Dict[str, float]
    level_blockers: List[str] = field(default_factory=list)
    formula_version: str = FORMULA_VERSION

    @property
    def level_code(self) -> str:
        return self.level.split(" ")[0]


def layer_score(items: Sequence[EvidenceItem]) -> Optional[float]:
    """6.1: time-weighted average of the latest attempts in one layer (None if the layer is empty)."""
    if not items:
        return None
    recent = sorted(items, key=lambda e: e.created_at, reverse=True)[:RECENT_ATTEMPTS]
    weights = RECENT_ATTEMPT_WEIGHTS[: len(recent)]
    return sum(e.score * w for e, w in zip(recent, weights)) / sum(weights)


def skill_score(layer_scores: Dict[str, float]) -> float:
    """6.2: S = sum(w_L * s_L) / sum(w_L) over present layers only; a missing layer never lowers S."""
    present = {k: v for k, v in layer_scores.items() if k in LAYER_WEIGHTS and v is not None}
    if not present:
        return 0.0
    total_w = sum(LAYER_WEIGHTS[k] for k in present)
    return sum(LAYER_WEIGHTS[k] * v for k, v in present.items()) / total_w


def _population_sigma(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return sqrt(sum((v - mean) ** 2 for v in values) / len(values))


def recency(items: Iterable[EvidenceItem], now: Optional[datetime] = None) -> float:
    """Mean decay of evidence (half-life 6 months); evidence older than 12 months contributes 0."""
    now = now or datetime.now(timezone.utc)
    decays = []
    for e in items:
        created = e.created_at if e.created_at.tzinfo else e.created_at.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (now - created).total_seconds() / 86400)
        decays.append(0.5 ** (age_days / RECENCY_HALF_LIFE_DAYS) if age_days <= RECENCY_WINDOW_DAYS else 0.0)
    return sum(decays) / len(decays) if decays else 0.0


def confidence_parts(
    layer_scores: Dict[str, float],
    independent_evidence: int,
    recency_value: float,
    human_verified: int,
) -> Dict[str, float]:
    present = [k for k, v in layer_scores.items() if v is not None]
    return {
        "coverage": sum(LAYER_WEIGHTS[k] for k in present) / sum(LAYER_WEIGHTS.values()),
        "consistency": 1 - min(1.0, _population_sigma([layer_scores[k] for k in present]) / CONSISTENCY_SIGMA_CAP),
        "volume": min(1.0, independent_evidence / VOLUME_TARGET),
        "recency": recency_value,
        "verification": min(1.0, human_verified / VERIFICATION_TARGET),
    }


def confidence_score(parts: Dict[str, float]) -> float:
    """6.3: C = 100 * (0.35 Coverage + 0.25 Consistency + 0.15 Volume + 0.15 Recency + 0.10 Verification)."""
    return 100 * (
        0.35 * parts["coverage"]
        + 0.25 * parts["consistency"]
        + 0.15 * parts["volume"]
        + 0.15 * parts["recency"]
        + 0.10 * parts["verification"]
    )


def resolve_level(
    score: float,
    confidence: float,
    present_layers: Iterable[str],
    *,
    viva_flagged: bool = False,
    human_verified: int = 0,
    has_teach_back: bool = False,
    cap_code: Optional[str] = None,
) -> tuple:
    """6.4: level = highest rule whose score, required layers, confidence and extra conditions all hold.

    `cap_code` lets an open integrity flag hold the level (section 7.1: CROSS_LAYER_GAP stops high levels).
    Returns (level label, blockers explaining why the next level was not reached).
    """
    present = set(present_layers)
    achieved = "L0"
    blockers: List[str] = []
    for rule in LEVEL_RULES:
        reasons = []
        if score < rule.min_score:
            reasons.append(f"ball {rule.min_score:g} dan past")
        missing = [l for l in rule.required_layers if l not in present]
        if missing:
            reasons.append("yetishmayotgan qatlam: " + ", ".join(missing))
        if confidence < rule.min_confidence:
            reasons.append(f"Confidence {rule.min_confidence:g} dan past")
        if rule.code == "L4" and viva_flagged:
            reasons.append("viva bayrog‘i ochiq")
        if rule.code == "L5":
            if human_verified < 1:
                reasons.append("inson tasdig‘i yo‘q")
            if not has_teach_back:
                reasons.append("teach-back dalili yo‘q")
        if cap_code and rule.code > cap_code:
            reasons.append("ochiq integrity bayrog‘i yuqori darajani to‘xtatgan")
        if reasons:
            blockers = [f"{rule.code} {rule.name}: " + "; ".join(reasons)]
            break
        achieved = f"{rule.code} {rule.name}"
    return achieved, blockers


def compute(
    evidence: Sequence[EvidenceItem],
    *,
    now: Optional[datetime] = None,
    viva_flagged: bool = False,
    has_teach_back: bool = False,
    cap_code: Optional[str] = None,
) -> ScoreResult:
    """Full pipeline from evidence to score, confidence and level."""
    by_layer: Dict[str, List[EvidenceItem]] = {}
    for e in evidence:
        if e.layer in LAYER_WEIGHTS:
            by_layer.setdefault(e.layer, []).append(e)
    layer_scores = {l: layer_score(items) for l, items in by_layer.items()}
    layer_scores = {l: s for l, s in layer_scores.items() if s is not None}

    s = skill_score(layer_scores)
    human = sum(1 for e in evidence if e.human_verified)
    parts = confidence_parts(layer_scores, len(evidence), recency(evidence, now), human)
    c = confidence_score(parts)
    level, blockers = resolve_level(
        round(s), round(c), layer_scores.keys(),
        viva_flagged=viva_flagged, human_verified=human, has_teach_back=has_teach_back, cap_code=cap_code,
    )
    return ScoreResult(
        score=round(s, 1),
        confidence=round(c, 1),
        level=level,
        layer_scores={k: round(v, 1) for k, v in layer_scores.items()},
        confidence_parts={k: round(v, 3) for k, v in parts.items()},
        level_blockers=blockers,
    )
