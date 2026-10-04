"""Checks the scoring formulas against architecture document v2.0, section 6."""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.scoring_engine import (
    EvidenceItem,
    compute,
    confidence_parts,
    confidence_score,
    layer_score,
    resolve_level,
    skill_score,
)

NOW = datetime(2026, 10, 1, tzinfo=timezone.utc)


def ev(layer, score, days_ago=1, human=False):
    return EvidenceItem(layer=layer, score=score, created_at=NOW - timedelta(days=days_ago), human_verified=human)


def worked_example_evidence():
    # Section 6.5: KNOW 90, DO 85, ADAPT 80, DEFEND 78, no PROVE; 6 independent evidence, 1 human-verified
    return [
        ev("KNOW", 90), ev("KNOW", 90),
        ev("DO", 85, human=True), ev("DO", 85),
        ev("ADAPT", 80),
        ev("DEFEND", 78),
    ]


def test_skill_score_ignores_missing_layers():
    # 6.5: S = 70.6 / 0.85 = 83
    s = skill_score({"KNOW": 90, "DO": 85, "ADAPT": 80, "DEFEND": 78})
    assert round(s) == 83
    # A missing layer must not pull the score down
    assert skill_score({"KNOW": 90}) == 90


def test_confidence_parts_match_worked_example():
    parts = confidence_parts({"KNOW": 90, "DO": 85, "ADAPT": 80, "DEFEND": 78}, 6, 1.0, 1)
    assert parts["coverage"] == pytest.approx(0.85)
    assert parts["consistency"] == pytest.approx(1 - 4.66 / 25, abs=0.002)
    assert parts["volume"] == pytest.approx(0.75)
    assert parts["verification"] == pytest.approx(0.5)
    assert round(confidence_score(parts)) == 81


def test_worked_example_reaches_l4_not_l5():
    result = compute(worked_example_evidence(), now=NOW)
    assert round(result.score) == 83
    assert round(result.confidence) == 81
    assert result.level == "L4 CREATE"
    # L5 is blocked: no PROVE layer and confidence below 85
    assert result.level_blockers and result.level_blockers[0].startswith("L5")
    assert "PROVE" in result.level_blockers[0]


def test_perfect_test_score_alone_does_not_give_master():
    # Score != Level: 100% on KNOW only is L1
    result = compute([ev("KNOW", 100), ev("KNOW", 100)], now=NOW)
    assert result.score == 100
    assert result.level == "L1 KNOW"


def test_layer_score_uses_latest_three_attempts_newest_heaviest():
    items = [ev("DO", 10, days_ago=40), ev("DO", 60, days_ago=3), ev("DO", 70, days_ago=2), ev("DO", 90, days_ago=1)]
    # Oldest attempt (10) is dropped; weights 3,2,1 on 90,70,60
    assert layer_score(items) == pytest.approx((90 * 3 + 70 * 2 + 60 * 1) / 6)


def test_open_viva_flag_blocks_l4():
    result = compute(worked_example_evidence(), now=NOW, viva_flagged=True)
    assert result.level == "L3 ADAPT"


def test_cross_layer_cap_holds_level():
    result = compute(worked_example_evidence(), now=NOW, cap_code="L3")
    assert result.level == "L3 ADAPT"


def test_l5_requires_human_verification_and_teach_back():
    strong = [ev(l, 95, human=True) for l in ("KNOW", "DO", "ADAPT", "DEFEND", "PROVE")] + [
        ev(l, 95) for l in ("KNOW", "DO", "ADAPT")
    ]
    assert compute(strong, now=NOW).level == "L4 CREATE"
    assert compute(strong, now=NOW, has_teach_back=True).level == "L5 MASTER"


def test_old_evidence_lowers_recency_not_score():
    fresh = compute(worked_example_evidence(), now=NOW)
    stale = compute(worked_example_evidence(), now=NOW + timedelta(days=400))
    assert stale.score == fresh.score
    assert stale.confidence < fresh.confidence


def test_no_evidence_is_level_zero():
    result = compute([], now=NOW)
    assert result.score == 0
    assert result.level == "L0"


def test_resolve_level_thresholds():
    assert resolve_level(55, 0, ["KNOW", "DO"])[0] == "L2 APPLY"
    assert resolve_level(70, 49, ["KNOW", "DO", "ADAPT"])[0] == "L2 APPLY"
    assert resolve_level(70, 50, ["KNOW", "DO", "ADAPT"])[0] == "L3 ADAPT"
