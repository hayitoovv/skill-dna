"""Student rating: one comparable number per student and their rank inside the university.

Pure functions only (no database access) so the ranking rules can be tested directly.

Rating score = mean over the student's direction core skills of E_i = S_i * (0.8 + 0.2 * C_i / 100)
(the same confidence-adjusted score career matching uses). A skill without evidence counts as 0, so
the rating rewards covering the direction, not one lucky high score.
"""
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence

from app.services.career import SkillState, adjusted

RATING_VERSION = "v1.0"


def rating_score(skill_states: Iterable[Optional[SkillState]], skill_count: int) -> float:
    """Average confidence-adjusted score over `skill_count` direction skills; missing skills count as 0."""
    if skill_count <= 0:
        return 0.0
    total = sum(adjusted(s) for s in skill_states if s is not None)
    return round(total / skill_count, 1)


@dataclass
class RatedStudent:
    user_id: str
    score: float
    direction_id: Optional[str] = None
    group_id: Optional[str] = None


@dataclass
class RankedStudent:
    student: RatedStudent
    rank: int
    total: int


def rank(students: Sequence[RatedStudent]) -> List[RankedStudent]:
    """Standard competition ranking ("1, 2, 2, 4"): equal scores share a place, highest score first."""
    ordered = sorted(students, key=lambda s: (-s.score, s.user_id))
    out: List[RankedStudent] = []
    prev_score: Optional[float] = None
    current_rank = 0
    for i, s in enumerate(ordered, start=1):
        if s.score != prev_score:
            current_rank = i
            prev_score = s.score
        out.append(RankedStudent(student=s, rank=current_rank, total=len(ordered)))
    return out


def scoped(students: Sequence[RatedStudent], scope: str, direction_id: Optional[str], group_id: Optional[str]) -> List[RatedStudent]:
    """Students competing in a scope: the whole university, one direction or one group."""
    if scope == "direction":
        return [s for s in students if direction_id and s.direction_id == direction_id]
    if scope == "group":
        return [s for s in students if group_id and s.group_id == group_id]
    return list(students)


def position(ranked: Sequence[RankedStudent], user_id: str) -> Optional[RankedStudent]:
    return next((r for r in ranked if r.student.user_id == user_id), None)


def percentile_top(rank_value: int, total: int) -> Optional[int]:
    """“Top N%” for display: rank 1 of 100 -> 1, rank 37 of 1240 -> 3."""
    if total <= 0:
        return None
    return max(1, round(100 * rank_value / total))


def summary(students: Sequence[RatedStudent], user_id: str) -> Dict[str, Optional[Dict]]:
    """The student's place in each scope (None where the student has no direction/group)."""
    me = next((s for s in students if s.user_id == user_id), None)
    if not me:
        return {"university": None, "direction": None, "group": None}
    out: Dict[str, Optional[Dict]] = {}
    for scope in ("university", "direction", "group"):
        if scope == "direction" and not me.direction_id or scope == "group" and not me.group_id:
            out[scope] = None
            continue
        ranked = rank(scoped(students, scope, me.direction_id, me.group_id))
        mine = position(ranked, user_id)
        out[scope] = {"rank": mine.rank, "total": mine.total, "top_pct": percentile_top(mine.rank, mine.total)} if mine else None
    return out


def challenge_score(best_by_task: Dict[str, float], task_count: int) -> float:
    """Sponsored challenge result: mean of the best verified score per challenge task; unsolved tasks count as 0."""
    if task_count <= 0:
        return 0.0
    return round(sum(best_by_task.values()) / task_count, 1)
