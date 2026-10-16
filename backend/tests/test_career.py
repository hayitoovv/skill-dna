"""Career match formula (section 10.2)."""
from datetime import date

import pytest

from app.services.career import Requirement, SkillState, adjusted, match, parse_requirements, plan_30_60_90


def test_adjusted_score_weights_confidence():
    assert adjusted(SkillState(80, 100)) == pytest.approx(80)
    assert adjusted(SkillState(80, 0)) == pytest.approx(64)


def test_match_formula_and_gap_priority():
    reqs = [Requirement("BACKEND", 3, 80), Requirement("SQL", 1, 70)]
    skills = {"BACKEND": SkillState(80, 50, "Backend"), "SQL": SkillState(90, 100, "SQL")}
    r = match(reqs, skills)
    e_backend = 80 * (0.8 + 0.2 * 0.5)  # 72
    expected = 100 * (3 * min(1, e_backend / 80) + 1 * 1) / 4
    assert r.match_pct == pytest.approx(round(expected, 1))
    assert r.gaps[0]["skill"] == "BACKEND"
    assert r.gaps[0]["gap"] == pytest.approx(8.0)
    assert r.gaps[0]["priority"] == pytest.approx(24.0)
    assert [s["skill"] for s in r.strengths] == ["SQL"]


def test_missing_must_have_hides_match():
    reqs = [Requirement("BACKEND", 1, 80, must=True), Requirement("SQL", 1, 70)]
    r = match(reqs, {"SQL": SkillState(90, 90)})
    assert r.match_pct is None
    assert r.missing_must == ["BACKEND"]


def test_parse_requirements_accepts_legacy_weight_key():
    reqs = parse_requirements({"SE-BACKEND": {"weight": 0.35, "min_score": 85}})
    assert reqs[0].importance == 0.35 and reqs[0].min_score == 85 and not reqs[0].must


def test_plan_targets_missing_layer_first():
    gaps = [{"skill": "A", "name": "A", "gap": 10}, {"skill": "B", "name": "B", "gap": 5}]
    layers = {"A": {"KNOW": 80, "DO": 70, "ADAPT": None}, "B": {"KNOW": 90, "DO": 60, "ADAPT": 80, "DEFEND": 75, "PROVE": 70}}
    plan = plan_30_60_90(gaps, layers, start=date(2026, 10, 1))
    assert plan[0]["target_layer"] == "ADAPT"
    assert plan[1]["target_layer"] == "DO"  # weakest present layer
    assert plan[0]["reassess_on"] == "2026-10-31"
    assert len(plan) == 2


# ---------- Inclination (career recommendations) ----------
from app.services import career  # noqa: E402

def _reqs():
    return [career.Requirement("A", 3, 75, must=True), career.Requirement("B", 1, 50)]


def test_readiness_does_not_hard_filter_missing_must():
    states = {"B": career.SkillState(50, 100)}
    assert career.match(_reqs(), states).match_pct is None
    assert career.readiness(_reqs(), states) == 25.0  # only B (weight 1 of 4) is met


def test_interest_counts_attempts_up_to_cap():
    assert career.interest(_reqs(), {}) == 0.0
    assert career.interest(_reqs(), {"A": 3}) == 75.0
    assert career.interest(_reqs(), {"A": 10, "B": 9}) == 100.0


def test_inclination_weights():
    assert career.inclination(80, 50) == 71.0


def test_inclination_reasons():
    reasons = career.inclination_reasons(_reqs(), {"A": career.SkillState(81, 90)}, {"A": 2}, {"A": "Backend"})
    assert reasons[0] == "Eng kuchli tomon: Backend (81)"
    assert "2 ta topshiriq" in reasons[1]
