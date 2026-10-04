"""Moderation, appeals, teacher and university endpoints (sections 2.3, 5.6, 7, 11, 12)."""
import statistics
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    MODERATOR, SUPER_ADMIN, TEACHER, UNIVERSITY, client_ip, get_current_user, require_roles,
)
from app.core.database import get_db
from app.models import (
    Appeal, Attempt, Direction, Evaluation, Evidence, IntegrityFlag, Skill, StudentProfile, Task, User, VivaSession,
)
from app.services import audit, challenges, integrity, skill_service

moderation_router = APIRouter()
appeals_router = APIRouter()
teacher_router = APIRouter()
university_router = APIRouter()

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
# Contradictions first (section 8: moderators see conflicting edges first)
TYPE_ORDER = {integrity.CROSS_LAYER_GAP: 0, integrity.VIVA_DISAGREEMENT: 1, integrity.SIMILARITY_HIGH: 2}


def _rank(score) -> tuple:
    return (score.level.split(" ")[0], score.score)


async def _org_students(db: AsyncSession, actor: User) -> List[User]:
    """Organisation-scoped student list (multi-tenancy); moderators and super admins see everyone."""
    q = select(User).where(User.role == "student", User.is_deleted.is_(False))
    if actor.role not in (MODERATOR, SUPER_ADMIN):
        q = q.where(User.org_id == actor.org_id)
    return list((await db.execute(q)).scalars().all())


# ---------------------------------------------------------------------------
# Moderation queue (section 7)
# ---------------------------------------------------------------------------

@moderation_router.get("/queue")
async def queue(status: str = "open", flag_type: Optional[str] = None,
                actor: User = Depends(require_roles(MODERATOR, TEACHER)), db: AsyncSession = Depends(get_db)):
    q = select(IntegrityFlag)
    if status == "open":
        q = q.where(IntegrityFlag.status.in_(integrity.OPEN_STATUSES))
    elif status != "all":
        q = q.where(IntegrityFlag.status == status)
    if flag_type:
        q = q.where(IntegrityFlag.type == flag_type)
    flags = (await db.execute(q)).scalars().all()
    visible = {u.id: u for u in await _org_students(db, actor)}
    skills = {str(s.id): s for s in (await db.execute(select(Skill))).scalars().all()}
    rows = []
    for f in flags:
        student = visible.get(f.user_id)
        if not student:
            continue
        sk = skills.get((f.details or {}).get("skill_id"))
        rows.append({
            "id": str(f.id), "type": f.type, "severity": f.severity, "status": f.status,
            "student": {"id": str(student.id), "name": student.full_name},
            "skill": {"id": str(sk.id), "name": sk.name} if sk else None,
            "attempt_id": str(f.attempt_id) if f.attempt_id else None,
            "details": {k: v for k, v in (f.details or {}).items() if k != "dedupe_key"},
            "created_at": f.created_at.isoformat(),
        })
    rows.sort(key=lambda r: (TYPE_ORDER.get(r["type"], 9), SEVERITY_ORDER.get(r["severity"], 9), r["created_at"]))
    return rows


class Resolution(BaseModel):
    decision: str = Field(description="dismissed | confirmed")
    notes: Optional[str] = None
    human_score: Optional[float] = Field(default=None, ge=0, le=100, description="Moderator re-grade for viva cases")


@moderation_router.post("/{flag_id}/resolve")
async def resolve(flag_id: uuid.UUID, payload: Resolution, request: Request,
                  actor: User = Depends(require_roles(MODERATOR, TEACHER)), db: AsyncSession = Depends(get_db)):
    if payload.decision not in ("dismissed", "confirmed"):
        raise HTTPException(status_code=400, detail="decision: dismissed yoki confirmed")
    flag = (await db.execute(select(IntegrityFlag).where(IntegrityFlag.id == flag_id))).scalars().first()
    if not flag or flag.status not in integrity.OPEN_STATUSES:
        raise HTTPException(status_code=404, detail="Ochiq bayroq topilmadi")
    if flag.user_id not in {u.id for u in await _org_students(db, actor)}:
        raise HTTPException(status_code=403, detail="Bu talaba sizning tashkilotingizga tegishli emas")

    flag.status = payload.decision
    flag.resolved_by = actor.id
    flag.details = {**(flag.details or {}), "resolution_notes": payload.notes, "resolved_at": datetime.now(timezone.utc).isoformat()}

    if flag.attempt_id:
        attempt_evidence = (await db.execute(select(Evidence).where(Evidence.attempt_id == flag.attempt_id))).scalars().all()
        if payload.decision == "confirmed" and flag.type in (integrity.SIMILARITY_HIGH, integrity.PROMPT_INJECTION):
            # A human confirmed the work isn't the student's own: that evidence stops counting
            for e in attempt_evidence:
                e.status = "rejected"
        if payload.human_score is not None:
            for e in attempt_evidence:
                if e.layer == "DEFEND":
                    e.score, e.verified_by, e.verified_at = payload.human_score, f"human:{actor.id}", datetime.now(timezone.utc)
            db.add(Evaluation(attempt_id=flag.attempt_id, grader="human", scores={"moderator": payload.human_score},
                              total_score=payload.human_score, rationale=payload.notes or "Moderator qayta baholadi",
                              model_ref=f"human:{actor.id}"))

    audit.record(db, actor_id=actor.id, action="moderation.resolve", entity="integrity_flag", entity_id=flag.id,
                 after={"decision": payload.decision, "type": flag.type}, ip=client_ip(request))
    await db.flush()
    skill_id = (flag.details or {}).get("skill_id")
    result = await skill_service.recompute(db, flag.user_id, uuid.UUID(skill_id)) if skill_id else None
    await db.commit()
    return {"id": str(flag.id), "status": flag.status,
            "skill": {"score": result.score, "confidence": result.confidence, "level": result.level} if result else None}


# ---------------------------------------------------------------------------
# Appeals (section 5.4: a human re-grades; the decision is recorded as evidence)
# ---------------------------------------------------------------------------

class AppealCreate(BaseModel):
    attempt_id: uuid.UUID
    reason: str = Field(min_length=10, max_length=2000)


@appeals_router.post("")
async def create_appeal(payload: AppealCreate, request: Request, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    attempt = (await db.execute(select(Attempt).where(Attempt.id == payload.attempt_id))).scalars().first()
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Urinish topilmadi")
    appeal = Appeal(user_id=user.id, attempt_id=attempt.id, reason=payload.reason, status="pending")
    db.add(appeal)
    audit.record(db, actor_id=user.id, action="appeal.create", entity="attempt", entity_id=attempt.id, ip=client_ip(request))
    await db.commit()
    return {"id": str(appeal.id), "status": appeal.status}


@appeals_router.get("")
async def list_appeals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Appeal)
    if user.role == "student":
        q = q.where(Appeal.user_id == user.id)
    elif user.role in (TEACHER, MODERATOR, SUPER_ADMIN):
        q = q.where(Appeal.user_id.in_([u.id for u in await _org_students(db, user)]))
    else:
        raise HTTPException(status_code=403, detail="Ruxsat yo‘q")
    rows = (await db.execute(q.order_by(Appeal.created_at.desc()))).scalars().all()
    return [{"id": str(a.id), "attempt_id": str(a.attempt_id) if a.attempt_id else None, "reason": a.reason,
             "status": a.status, "resolution_notes": a.resolution_notes, "created_at": a.created_at.isoformat()} for a in rows]


class AppealResolution(BaseModel):
    decision: str = Field(description="approved | rejected")
    notes: str
    new_score: Optional[float] = Field(default=None, ge=0, le=100)


@appeals_router.post("/{appeal_id}/resolve")
async def resolve_appeal(appeal_id: uuid.UUID, payload: AppealResolution, request: Request,
                         actor: User = Depends(require_roles(MODERATOR, TEACHER)), db: AsyncSession = Depends(get_db)):
    appeal = (await db.execute(select(Appeal).where(Appeal.id == appeal_id))).scalars().first()
    if not appeal or appeal.status not in ("pending", "under_review"):
        raise HTTPException(status_code=404, detail="Ochiq e’tiroz topilmadi")
    if payload.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision: approved yoki rejected")
    appeal.status, appeal.resolved_by, appeal.resolution_notes = payload.decision, actor.id, payload.notes

    skill_id = None
    if appeal.attempt_id:
        task = (await db.execute(select(Task).join(Attempt, Attempt.task_id == Task.id).where(Attempt.id == appeal.attempt_id))).scalars().first()
        skill_id = task.skill_id if task else None
        db.add(Evaluation(attempt_id=appeal.attempt_id, grader="human",
                          scores={"appeal": payload.decision, "new_score": payload.new_score},
                          total_score=payload.new_score if payload.new_score is not None else 0.0,
                          rationale=payload.notes, model_ref=f"human:{actor.id}"))
        if payload.decision == "approved" and payload.new_score is not None:
            for e in (await db.execute(select(Evidence).where(Evidence.attempt_id == appeal.attempt_id))).scalars().all():
                e.score, e.verified_by, e.verified_at, e.status = payload.new_score, f"human:{actor.id}", datetime.now(timezone.utc), "verified"

    audit.record(db, actor_id=actor.id, action="appeal.resolve", entity="appeal", entity_id=appeal.id,
                 after={"decision": payload.decision, "new_score": payload.new_score}, ip=client_ip(request))
    await db.flush()
    result = await skill_service.recompute(db, appeal.user_id, skill_id) if skill_id else None
    await db.commit()
    return {"id": str(appeal.id), "status": appeal.status,
            "skill": {"score": result.score, "level": result.level} if result else None}


# ---------------------------------------------------------------------------
# Teacher (section 11: gap map, PROVE queue, task authoring, remedial generator)
# ---------------------------------------------------------------------------

async def _group_rows(db: AsyncSession, actor: User, group_id: Optional[str]) -> Dict[str, Any]:
    students = await _org_students(db, actor)
    profiles = {p.user_id: p for p in (await db.execute(select(StudentProfile))).scalars().all()}
    if group_id:
        students = [s for s in students if profiles.get(s.id) and profiles[s.id].group_id == group_id]
    scores = await skill_service.latest_scores(db, [s.id for s in students]) if students else {}
    return {"students": students, "profiles": profiles, "scores": scores}


@teacher_router.get("/groups")
async def groups(actor: User = Depends(require_roles(TEACHER, UNIVERSITY)), db: AsyncSession = Depends(get_db)):
    data = await _group_rows(db, actor, None)
    counts = defaultdict(int)
    for s in data["students"]:
        p = data["profiles"].get(s.id)
        counts[(p.group_id if p and p.group_id else "—")] += 1
    return [{"group_id": g, "students": n} for g, n in sorted(counts.items())]


@teacher_router.get("/groups/{group_id}/gaps")
async def group_gaps(group_id: str, actor: User = Depends(require_roles(TEACHER, UNIVERSITY)), db: AsyncSession = Depends(get_db)):
    data = await _group_rows(db, actor, group_id)
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    per_skill: Dict[uuid.UUID, List] = defaultdict(list)
    for (uid, sid), sc in data["scores"].items():
        per_skill[sid].append(sc)
    out = []
    for sid, rows in per_skill.items():
        vals = [r.score for r in rows]
        layer_avgs = {}
        for layer in ("KNOW", "DO", "ADAPT", "DEFEND", "PROVE"):
            lv = [skill_service.layer_view(r)[layer] for r in rows if skill_service.layer_view(r)[layer] is not None]
            layer_avgs[layer] = round(statistics.mean(lv), 1) if lv else None
        out.append({
            "skill": {"id": str(sid), "code": skills[sid].code, "name": skills[sid].name},
            "students_scored": len(rows),
            "avg_score": round(statistics.mean(vals), 1),
            "below_70": sum(1 for v in vals if v < 70),
            "gap_pct": round(100 * sum(1 for v in vals if v < 70) / len(vals)),
            "layers": layer_avgs,
        })
    out.sort(key=lambda r: r["avg_score"])
    students = []
    for s in data["students"]:
        mine = [(skills[sid], sc) for (uid, sid), sc in data["scores"].items() if uid == s.id and sid in skills]
        best = max(mine, key=lambda x: _rank(x[1]), default=None)
        students.append({"id": str(s.id), "name": s.full_name, "email": s.email,
                         "level": best[1].level if best else "L0", "score": round(best[1].score) if best else 0,
                         "skills_scored": len(mine)})
    return {"group_id": group_id, "students_total": len(data["students"]), "skills": out, "students": students}


@teacher_router.get("/viva-results")
async def viva_results(group_id: Optional[str] = None, actor: User = Depends(require_roles(TEACHER, UNIVERSITY)),
                       db: AsyncSession = Depends(get_db)):
    """Completed AI Viva sessions of the teacher's students (section 11: "viva ko‘rib chiqish")."""
    data = await _group_rows(db, actor, group_id)
    students = {s.id: s for s in data["students"]}
    if not students:
        return []
    rows = (
        await db.execute(
            select(VivaSession, Attempt, Task)
            .join(Attempt, Attempt.id == VivaSession.attempt_id)
            .join(Task, Task.id == Attempt.task_id)
            .where(Attempt.user_id.in_(list(students)), VivaSession.ended_at.is_not(None))
            .order_by(VivaSession.ended_at.desc())
        )
    ).all()
    attempt_ids = [a.id for _, a, _ in rows]
    panels = {e.attempt_id: e for e in (await db.execute(
        select(Evaluation).where(Evaluation.attempt_id.in_(attempt_ids), Evaluation.grader == "viva_panel"))).scalars().all()} if rows else {}
    humans = {e.attempt_id: e for e in (await db.execute(
        select(Evaluation).where(Evaluation.attempt_id.in_(attempt_ids), Evaluation.grader == "human"))).scalars().all()} if rows else {}
    flags = defaultdict(list)
    if rows:
        for f in (await db.execute(select(IntegrityFlag).where(IntegrityFlag.attempt_id.in_(attempt_ids)))).scalars().all():
            flags[f.attempt_id].append({"type": f.type, "status": f.status})
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    out = []
    for session, attempt, task in rows:
        panel = panels.get(attempt.id)
        human = humans.get(attempt.id)
        out.append({
            "session_id": str(session.id),
            "attempt_id": str(attempt.id),
            "student": {"id": str(attempt.user_id), "name": students[attempt.user_id].full_name},
            "task": task.title,
            "skill": skills[task.skill_id].name if task.skill_id in skills else None,
            "ai_mode": attempt.ai_mode,
            "score": panel.total_score if panel else None,
            "criteria": panel.scores if panel else {},
            "panel_note": panel.rationale if panel else None,
            "human_score": human.total_score if human else None,
            "flags": flags.get(attempt.id, []),
            "questions": len((session.plan or {}).get("questions", [])),
            "clarifications_used": (session.plan or {}).get("clarifications_used", 0),
            "ended_at": session.ended_at.isoformat(),
        })
    return out


@teacher_router.get("/prove-queue")
async def prove_queue(actor: User = Depends(require_roles(TEACHER)), db: AsyncSession = Depends(get_db)):
    visible = {u.id: u for u in await _org_students(db, actor)}
    rows = (await db.execute(select(Evidence).where(Evidence.layer == "PROVE", Evidence.status == "pending"))).scalars().all()
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    return [{"id": str(e.id), "student": {"id": str(e.user_id), "name": visible[e.user_id].full_name},
             "skill": skills[e.skill_id].name if e.skill_id in skills else None, "title": e.title,
             "source_ref": e.source_ref, "submitted_at": e.created_at.isoformat()}
            for e in rows if e.user_id in visible]


class Verification(BaseModel):
    approved: bool
    score: float = Field(ge=0, le=100)
    notes: Optional[str] = None
    teach_back: bool = False  # the student explained/mentored others (L5 condition, section 6.4)


@teacher_router.post("/evidence/{evidence_id}/verify")
async def verify_evidence(evidence_id: uuid.UUID, payload: Verification, request: Request,
                          actor: User = Depends(require_roles(TEACHER)), db: AsyncSession = Depends(get_db)):
    e = (await db.execute(select(Evidence).where(Evidence.id == evidence_id))).scalars().first()
    if not e or e.status != "pending":
        raise HTTPException(status_code=404, detail="Tasdiqlanadigan dalil topilmadi")
    if e.user_id not in {u.id for u in await _org_students(db, actor)}:
        raise HTTPException(status_code=403, detail="Bu talaba sizning tashkilotingizga tegishli emas")
    e.status = "verified" if payload.approved else "rejected"
    e.score = payload.score
    e.verified_by = f"human:{actor.id}"
    e.verified_at = datetime.now(timezone.utc)
    if payload.teach_back:
        e.source_ref = f"teach_back:{e.source_ref or ''}"
    if e.attempt_id:
        db.add(Evaluation(attempt_id=e.attempt_id, grader="human", scores={"verification": payload.approved},
                          total_score=payload.score, rationale=payload.notes, model_ref=f"human:{actor.id}"))
    audit.record(db, actor_id=actor.id, action="evidence.verify", entity="evidence", entity_id=e.id,
                 after={"approved": payload.approved, "score": payload.score}, ip=client_ip(request))
    await db.flush()
    result = await skill_service.recompute(db, e.user_id, e.skill_id)
    await db.commit()
    return {"id": str(e.id), "status": e.status, "skill": {"score": result.score, "confidence": result.confidence, "level": result.level}}


class TaskCreate(BaseModel):
    skill_id: uuid.UUID
    layer: str
    title: str
    type: str = "code"
    spec: Dict[str, Any]
    ai_mode: str = "AI-free"
    difficulty: str = "L3"
    duration_minutes: int = 30


@teacher_router.post("/tasks")
async def create_task(payload: TaskCreate, request: Request, actor: User = Depends(require_roles(TEACHER, MODERATOR)),
                      db: AsyncSession = Depends(get_db)):
    if payload.layer not in ("KNOW", "DO", "ADAPT", "DEFEND", "PROVE"):
        raise HTTPException(status_code=400, detail="Noto‘g‘ri qatlam")
    if payload.ai_mode not in ("AI-free", "AI-assisted"):
        raise HTTPException(status_code=400, detail="ai_mode: AI-free yoki AI-assisted")
    if payload.layer == "ADAPT" and payload.spec.get("template") not in challenges.TEMPLATES:
        raise HTTPException(status_code=400, detail=f"ADAPT shabloni: {', '.join(challenges.TEMPLATES)}")
    # New tasks start as drafts; a second reviewer approves them (section 2.3)
    task = Task(skill_id=payload.skill_id, layer=payload.layer, title=payload.title, type=payload.type,
                spec=payload.spec, ai_mode=payload.ai_mode, difficulty=payload.difficulty,
                duration_minutes=payload.duration_minutes, status="draft", author_id=actor.id)
    db.add(task)
    audit.record(db, actor_id=actor.id, action="task.create", entity="task", entity_id=None,
                 after={"title": payload.title, "layer": payload.layer}, ip=client_ip(request))
    await db.commit()
    return {"id": str(task.id), "status": task.status}


@teacher_router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: uuid.UUID, request: Request, actor: User = Depends(require_roles(TEACHER, MODERATOR)),
                       db: AsyncSession = Depends(get_db)):
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalars().first()
    if not task or task.status != "draft":
        raise HTTPException(status_code=404, detail="Qoralama topshiriq topilmadi")
    if task.author_id == actor.id:
        raise HTTPException(status_code=400, detail="Topshiriqni muallifdan boshqa odam tasdiqlashi kerak.")
    task.status = "active"
    task.spec = {**(task.spec or {}), "reviewed_by": str(actor.id)}
    audit.record(db, actor_id=actor.id, action="task.approve", entity="task", entity_id=task.id, ip=client_ip(request))
    await db.commit()
    return {"id": str(task.id), "status": task.status}


class RemedialRequest(BaseModel):
    skill_id: uuid.UUID
    group_id: Optional[str] = None


DIRECTION_TEMPLATE = {"computer": "subnet_plan", "software": "business_rules", "ai": "imbalanced_metrics"}


@teacher_router.post("/remedial")
async def remedial(payload: RemedialRequest, request: Request, actor: User = Depends(require_roles(TEACHER)),
                   db: AsyncSession = Depends(get_db)):
    """Creates a draft ADAPT task for the group's weak skill; each student later gets a unique variant."""
    skill = (await db.execute(select(Skill).where(Skill.id == payload.skill_id))).scalars().first()
    if not skill:
        raise HTTPException(status_code=404, detail="Ko‘nikma topilmadi")
    direction = (await db.execute(select(Direction).where(Direction.id == skill.direction_id))).scalars().first()
    template = DIRECTION_TEMPLATE.get(direction.code if direction else "", "business_rules")
    data = await _group_rows(db, actor, payload.group_id)
    weak = [str(uid) for (uid, sid), sc in data["scores"].items() if sid == skill.id and sc.score < 70]
    task = Task(skill_id=skill.id, layer="ADAPT", title=f"Remedial challenge: {skill.name}", type="challenge",
                spec={"template": template, "changed": False, "remedial_for": weak, "group_id": payload.group_id},
                ai_mode="AI-free", difficulty="L3", duration_minutes=30, status="draft", author_id=actor.id)
    db.add(task)
    audit.record(db, actor_id=actor.id, action="task.remedial", entity="skill", entity_id=skill.id,
                 after={"students": len(weak)}, ip=client_ip(request))
    await db.commit()
    return {"task_id": str(task.id), "status": task.status, "template": template, "target_students": len(weak)}


# ---------------------------------------------------------------------------
# University analytics (section 11: direction/course/skill heatmap, curriculum gaps)
# ---------------------------------------------------------------------------

@university_router.get("/analytics")
async def analytics(actor: User = Depends(require_roles(UNIVERSITY)), db: AsyncSession = Depends(get_db)):
    students = await _org_students(db, actor)
    profiles = {p.user_id: p for p in (await db.execute(select(StudentProfile))).scalars().all()}
    directions = {d.id: d for d in (await db.execute(select(Direction))).scalars().all()}
    skills = {s.id: s for s in (await db.execute(select(Skill))).scalars().all()}
    scores = await skill_service.latest_scores(db, [s.id for s in students]) if students else {}

    by_direction: Dict[str, Dict] = {}
    levels = defaultdict(int)
    skill_vals: Dict[uuid.UUID, List[float]] = defaultdict(list)
    best_by_student: Dict[uuid.UUID, Any] = {}
    for (uid, sid), sc in scores.items():
        skill_vals[sid].append(sc.score)
        # A student's standing is their highest *level* (score breaks ties): a high score without the
        # required evidence layers is still L0 (section 6.4), so ranking by score alone misreports levels
        if uid not in best_by_student or _rank(sc) > _rank(best_by_student[uid]):
            best_by_student[uid] = sc
    for s in students:
        p = profiles.get(s.id)
        d = directions.get(p.direction_id) if p and p.direction_id else None
        key = d.code if d else "unknown"
        row = by_direction.setdefault(key, {"code": key, "name": d.name if d else "Belgilanmagan", "students": 0,
                                            "scores": [], "confidences": [], "courses": defaultdict(int)})
        row["students"] += 1
        row["courses"][(p.course if p and p.course else "—")] += 1
        best = best_by_student.get(s.id)
        levels[best.level.split(" ")[0] if best else "L0"] += 1
        if best:
            row["scores"].append(best.score)
            row["confidences"].append(best.confidence)

    gaps = sorted(
        ({"skill": skills[sid].name, "code": skills[sid].code, "avg_score": round(statistics.mean(v), 1),
          "students": len(v), "below_70_pct": round(100 * sum(1 for x in v if x < 70) / len(v))}
         for sid, v in skill_vals.items() if sid in skills),
        key=lambda g: g["avg_score"],
    )
    return {
        "students_total": len(students),
        "directions": [
            {"code": r["code"], "name": r["name"], "students": r["students"],
             "avg_score": round(statistics.mean(r["scores"]), 1) if r["scores"] else None,
             "avg_confidence": round(statistics.mean(r["confidences"]), 1) if r["confidences"] else None,
             "courses": dict(r["courses"])}
            for r in by_direction.values()
        ],
        "level_distribution": {k: levels.get(k, 0) for k in ("L0", "L1", "L2", "L3", "L4", "L5")},
        "curriculum_gaps": gaps[:10],
        "open_flags": len([1 for f in (await db.execute(select(IntegrityFlag).where(
            IntegrityFlag.status.in_(integrity.OPEN_STATUSES),
            IntegrityFlag.user_id.in_([s.id for s in students])))).scalars().all()]) if students else 0,
    }
