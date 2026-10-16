"""Student rating inside a university: GET /rating/me and GET /rating (leaderboard)."""
import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import EMPLOYER, MODERATOR, STUDENT, SUPER_ADMIN, get_current_user
from app.core.database import get_db
from app.models import Consent, Direction, Organization, Skill, StudentProfile, User
from app.services import rating, skill_service
from app.services.career import SkillState

router = APIRouter()

# Opt-in: without it other students see this student as "Talaba #XXXX" in the leaderboard
PUBLIC_CONSENT = "rating_public"


async def _org_for(db: AsyncSession, viewer: User, org_id: Optional[uuid.UUID]) -> uuid.UUID:
    """Everyone sees their own university; super admins and moderators may pick one."""
    if org_id and viewer.role in (SUPER_ADMIN, MODERATOR):
        return org_id
    if viewer.role == EMPLOYER:
        raise HTTPException(status_code=403, detail="Reyting faqat universitet ichida ko‘rinadi.")
    if viewer.org_id:
        return viewer.org_id
    first = (await db.execute(select(Organization.id).where(Organization.type == "university"))).scalars().first()
    if not first:
        raise HTTPException(status_code=404, detail="Universitet topilmadi")
    return first


async def _rated_students(db: AsyncSession, org_id: uuid.UUID) -> tuple[List[rating.RatedStudent], Dict[str, User], Dict[str, StudentProfile]]:
    users = (await db.execute(
        select(User).where(User.org_id == org_id, User.role == STUDENT, User.is_deleted.is_(False), User.status == "active")
    )).scalars().all()
    if not users:
        return [], {}, {}
    ids = [u.id for u in users]
    profiles = {p.user_id: p for p in (await db.execute(select(StudentProfile).where(StudentProfile.user_id.in_(ids)))).scalars().all()}

    core = (await db.execute(select(Skill).where(Skill.is_deleted.is_(False), Skill.type == "core"))).scalars().all()
    skills_by_dir: Dict[uuid.UUID, List[Skill]] = {}
    for sk in core:
        skills_by_dir.setdefault(sk.direction_id, []).append(sk)

    scores = await skill_service.latest_scores(db, ids)
    rated = []
    for u in users:
        p = profiles.get(u.id)
        dir_skills = skills_by_dir.get(p.direction_id, []) if p and p.direction_id else []
        states = []
        for sk in dir_skills:
            s = scores.get((u.id, sk.id))
            states.append(SkillState(score=s.score, confidence=s.confidence) if s else None)
        rated.append(rating.RatedStudent(
            user_id=str(u.id),
            score=rating.rating_score(states, len(dir_skills)),
            direction_id=str(p.direction_id) if p and p.direction_id else None,
            group_id=p.group_id if p else None,
        ))
    return rated, {str(u.id): u for u in users}, {str(k): v for k, v in profiles.items()}


@router.get("/me")
async def my_rating(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The student's rating score and place in their university, direction and group."""
    if user.role != STUDENT:
        raise HTTPException(status_code=400, detail="Reyting faqat talabalar uchun hisoblanadi.")
    if not user.org_id:
        return {"score": 0, "university": None, "direction": None, "group": None, "version": rating.RATING_VERSION}
    students, _, profiles = await _rated_students(db, user.org_id)
    me = next((s for s in students if s.user_id == str(user.id)), None)
    p = profiles.get(str(user.id))
    direction = (await db.execute(select(Direction).where(Direction.id == p.direction_id))).scalars().first() if p and p.direction_id else None
    return {
        "score": me.score if me else 0,
        **rating.summary(students, str(user.id)),
        "direction_name": direction.name if direction else None,
        "group_id": p.group_id if p else None,
        "version": rating.RATING_VERSION,
    }


@router.get("")
async def leaderboard(
    scope: str = Query("university", pattern="^(university|direction|group)$"),
    direction_id: Optional[uuid.UUID] = None,
    group_id: Optional[str] = None,
    org_id: Optional[uuid.UUID] = None,
    limit: int = Query(10, ge=1, le=200),
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Top students of a scope. Students see names only of classmates who opted in (rating_public);
    teachers and university staff of the same organisation see full names."""
    org = await _org_for(db, viewer, org_id)
    students, users, profiles = await _rated_students(db, org)

    # A student's own direction/group is the default scope filter
    mine = profiles.get(str(viewer.id))
    d_id = str(direction_id) if direction_id else (str(mine.direction_id) if mine and mine.direction_id else None)
    g_id = group_id or (mine.group_id if mine else None)
    ranked = rating.rank(rating.scoped(students, scope, d_id, g_id))

    staff_view = viewer.role != STUDENT
    public = set()
    if not staff_view and ranked:
        rows = (await db.execute(select(Consent.user_id).where(
            Consent.type == PUBLIC_CONSENT, Consent.revoked_at.is_(None),
            Consent.user_id.in_([uuid.UUID(r.student.user_id) for r in ranked]),
        ))).scalars().all()
        public = {str(x) for x in rows}

    def entry(r: rating.RankedStudent) -> Dict:
        uid = r.student.user_id
        is_me = uid == str(viewer.id)
        u = users[uid]
        show_name = staff_view or is_me or uid in public
        return {
            "rank": r.rank,
            "score": r.student.score,
            "name": u.full_name if show_name else f"Talaba #{uid[-4:].upper()}",
            "group": r.student.group_id,
            "is_me": is_me,
            "user_id": uid if staff_view else None,
        }

    top = [entry(r) for r in ranked[:limit]]
    me_entry = next((entry(r) for r in ranked if r.student.user_id == str(viewer.id)), None)
    groups = sorted({s.group_id for s in students if s.group_id})
    return {
        "scope": scope,
        "total": len(ranked),
        "top": top,
        "me": me_entry if me_entry and me_entry["rank"] > limit else None,
        "groups": groups if staff_view else None,
        "version": rating.RATING_VERSION,
    }
