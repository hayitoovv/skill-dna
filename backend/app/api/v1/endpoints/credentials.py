"""Credential issue / verify / revoke (sections 3.4-C, 12 "Credential", 14)."""
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import MODERATOR, UNIVERSITY, client_ip, ensure_can_view, get_current_user, require_roles
from app.core.database import get_db
from app.models import Credential, Direction, Skill, User
from app.services import audit, credentials, skill_service

router = APIRouter()
public_router = APIRouter()


class IssueRequest(BaseModel):
    skill_id: uuid.UUID


def _summary(c: Credential) -> dict:
    return {
        "id": str(c.id), "code": c.certificate_code, "title": c.title, "level": c.level, "status": c.status,
        "issued_at": c.issued_at.isoformat(), "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
        "verify_url": f"{credentials.settings.CREDENTIAL_VERIFY_BASE_URL.rstrip('/')}/{c.id}",
    }


@router.post("/issue")
async def issue(payload: IssueRequest, request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Credential talaba uchun chiqariladi.")
    skill = (await db.execute(select(Skill).where(Skill.id == payload.skill_id))).scalars().first()
    if not skill:
        raise HTTPException(status_code=404, detail="Ko‘nikma topilmadi")
    score = (await skill_service.latest_scores(db, [user.id])).get((user.id, skill.id))
    if not score or not credentials.level_allows_issue(score.level, score.confidence):
        raise HTTPException(
            status_code=400,
            detail=f"Credential uchun kamida {credentials.MIN_LEVEL} daraja va {credentials.MIN_CONFIDENCE:g}% Confidence kerak.",
        )
    if skill_service.meta_view(score).get("open_flags"):
        raise HTTPException(status_code=400, detail="Ochiq integrity bayrog‘i bor; moderator qaroridan keyin chiqariladi.")

    existing = (
        await db.execute(select(Credential).where(Credential.user_id == user.id, Credential.skill_id == skill.id,
                                                  Credential.status == "issued", Credential.level == score.level))
    ).scalars().first()
    if existing:
        return _summary(existing)

    direction = (await db.execute(select(Direction).where(Direction.id == skill.direction_id))).scalars().first()
    cred_id = uuid.uuid4()
    vc = credentials.build_credential(
        credential_id=cred_id, student_email=user.email, student_name=user.full_name, skill_code=skill.code,
        skill_name=skill.name, direction=direction.name if direction else "", level=score.level, score=score.score,
        confidence=score.confidence, framework_refs=skill.framework_refs, layers=skill_service.layer_view(score),
    )
    row = Credential(
        id=cred_id, user_id=user.id, skill_id=skill.id, certificate_code=f"SDNA-{secrets.token_hex(4).upper()}",
        title=f"{skill.name} — {score.level}", level=score.level,
        ob3_payload={"credential": vc, "jwt": credentials.sign(vc), "digest": credentials.payload_digest(vc)},
        status="issued", issued_at=datetime.now(timezone.utc),
    )
    db.add(row)
    audit.record(db, actor_id=user.id, action="credential.issue", entity="credential", entity_id=cred_id,
                 after={"skill": skill.code, "level": score.level}, ip=client_ip(request))
    await db.commit()
    return _summary(row)


@router.get("")
async def my_credentials(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Credential).where(Credential.user_id == user.id).order_by(Credential.issued_at.desc()))).scalars().all()
    return [_summary(c) for c in rows]


@router.get("/{credential_id}")
async def get_credential(credential_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Credential).where(Credential.id == credential_id))).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Credential topilmadi")
    await ensure_can_view(db, user, c.user_id)
    return {**_summary(c), "credential": c.ob3_payload.get("credential"), "jwt": c.ob3_payload.get("jwt")}


class RevokeRequest(BaseModel):
    reason: str


@router.post("/{credential_id}/revoke")
async def revoke(credential_id: uuid.UUID, payload: RevokeRequest, request: Request,
                 user: User = Depends(require_roles(MODERATOR, UNIVERSITY)), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Credential).where(Credential.id == credential_id))).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Credential topilmadi")
    c.status, c.revoked_at = "revoked", datetime.now(timezone.utc)
    audit.record(db, actor_id=user.id, action="credential.revoke", entity="credential", entity_id=c.id,
                 after={"reason": payload.reason}, ip=client_ip(request))
    await db.commit()
    return _summary(c)


@public_router.get("/verify/{credential_id}")
async def verify(credential_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Open verification: signature, revocation status and the public claims. No login needed."""
    c = (await db.execute(select(Credential).where(Credential.id == credential_id))).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Credential topilmadi")
    claims = credentials.verify_signature(c.ob3_payload.get("jwt", ""))
    signature_ok = bool(claims) and credentials.payload_digest(claims["vc"]) == c.ob3_payload.get("digest")
    vc = claims["vc"] if claims else {}
    return {
        "valid": signature_ok and c.status == "issued",
        "signature_valid": signature_ok,
        "status": c.status,
        "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
        "issuer": vc.get("issuer"),
        "name": vc.get("name"),
        "achievement": (vc.get("credentialSubject") or {}).get("achievement"),
        "result": (vc.get("credentialSubject") or {}).get("result"),
        "issued_at": c.issued_at.isoformat(),
    }


@public_router.get("/.well-known/did.json")
async def did_document():
    return credentials.did_document()
