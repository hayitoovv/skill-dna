from app.services import rating
from app.services.career import SkillState


def test_missing_skills_count_as_zero():
    # One 90-point skill out of four does not beat steady progress across the direction
    narrow = rating.rating_score([SkillState(90, 100), None, None, None], 4)
    broad = rating.rating_score([SkillState(60, 100)] * 4, 4)
    assert narrow == 22.5
    assert broad == 60.0
    assert broad > narrow


def test_confidence_adjusts_score():
    assert rating.rating_score([SkillState(80, 0)], 1) == 64.0
    assert rating.rating_score([SkillState(80, 100)], 1) == 80.0


def test_no_direction_skills():
    assert rating.rating_score([], 0) == 0.0


def test_competition_ranking_shares_places():
    s = [rating.RatedStudent("a", 70), rating.RatedStudent("b", 80), rating.RatedStudent("c", 70), rating.RatedStudent("d", 10)]
    ranks = {r.student.user_id: r.rank for r in rating.rank(s)}
    assert ranks == {"b": 1, "a": 2, "c": 2, "d": 4}


def test_summary_per_scope():
    s = [
        rating.RatedStudent("a", 90, "se", "g1"),
        rating.RatedStudent("b", 80, "se", "g2"),
        rating.RatedStudent("c", 70, "ai", "g1"),
        rating.RatedStudent("me", 60, "se", "g1"),
    ]
    out = rating.summary(s, "me")
    assert out["university"] == {"rank": 4, "total": 4, "top_pct": 100}
    assert out["direction"]["rank"] == 3 and out["direction"]["total"] == 3
    assert out["group"]["rank"] == 3 and out["group"]["total"] == 3


def test_summary_without_group():
    out = rating.summary([rating.RatedStudent("me", 50, "se", None)], "me")
    assert out["group"] is None
    assert out["university"]["rank"] == 1


def test_percentile():
    assert rating.percentile_top(37, 1240) == 3
    assert rating.percentile_top(1, 100) == 1
    assert rating.percentile_top(1, 0) is None


def test_challenge_score_counts_unsolved_tasks_as_zero():
    assert rating.challenge_score({"t1": 90, "t2": 70}, 4) == 40.0
    assert rating.challenge_score({}, 3) == 0.0
    assert rating.challenge_score({"t1": 80}, 0) == 0.0
