from datetime import datetime, timezone

from app.services import companies


def _dt(y, m, d=1):
    return datetime(y, m, d, tzinfo=timezone.utc)


def test_usage_resets_each_month():
    now = _dt(2026, 10, 16)
    assert companies.current_usage("free", _dt(2026, 9, 1), 5, now) == (_dt(2026, 10, 1), 0)
    assert companies.current_usage("free", _dt(2026, 10, 1), 3, now) == (_dt(2026, 10, 1), 3)
    assert companies.current_usage("free", None, 0, now)[1] == 0


def test_plan_view_limits():
    v = companies.plan_view("free", _dt(2026, 10, 1), 4, _dt(2026, 10, 16))
    assert (v["limit"], v["used"], v["left"], v["resets_on"]) == (5, 4, 1, "2026-11-01")
    assert companies.plan_view("pro", None, 0, _dt(2026, 12, 5))["resets_on"] == "2027-01-01"
    assert companies.plan_view("unknown", None, 0, _dt(2026, 1, 1))["tier"] == "free"


def test_merge_hires_prefers_manual_figure():
    rows = companies.merge_hires([(2025, 18), (2024, 12)], [(2025, 3), (2026, 1)])
    assert rows[0] == {"year": 2026, "hired": 1, "manual": None, "platform": 1}
    assert rows[1] == {"year": 2025, "hired": 18, "manual": 18, "platform": 3}
    assert rows[2]["year"] == 2024 and rows[2]["hired"] == 12
