"""Company plans (invite credits) and hiring statistics — pure functions, no database access."""
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

# Free tier keeps search open and lets an employer try the invite flow; Pro is for active hiring.
PLANS: Dict[str, Dict] = {
    "free": {"label": "Bepul", "monthly_invites": 5},
    "pro": {"label": "Pro", "monthly_invites": 100},
}


def month_start(now: datetime) -> datetime:
    return now.astimezone(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def next_month(start: datetime) -> datetime:
    return start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)


def current_usage(tier: str, period_start: Optional[datetime], credits_used: int, now: datetime) -> Tuple[datetime, int]:
    """(period start, credits used) for this month: a plan last used in an earlier month starts again at 0."""
    start = month_start(now)
    if period_start is None or period_start < start:
        return start, 0
    return period_start, credits_used


def plan_view(tier: str, period_start: Optional[datetime], credits_used: int, now: datetime) -> Dict:
    plan = PLANS.get(tier, PLANS["free"])
    start, used = current_usage(tier, period_start, credits_used, now)
    limit = plan["monthly_invites"]
    return {
        "tier": tier if tier in PLANS else "free",
        "label": plan["label"],
        "limit": limit,
        "used": used,
        "left": max(0, limit - used),
        "resets_on": next_month(start).date().isoformat(),
    }


def merge_hires(manual: Iterable[Tuple[int, int]], platform: Iterable[Tuple[int, int]]) -> List[Dict]:
    """Per-year hires, newest first. A manually entered figure is the official one for its year;
    platform hires (accepted invites) are shown alongside it, never added on top (they may be included)."""
    m: Dict[int, int] = {}
    for year, n in manual:
        m[year] = m.get(year, 0) + n
    p: Dict[int, int] = {}
    for year, n in platform:
        p[year] = p.get(year, 0) + n
    years = sorted(set(m) | set(p), reverse=True)
    return [{"year": y, "hired": m.get(y, p.get(y, 0)), "manual": m.get(y), "platform": p.get(y, 0)} for y in years]
