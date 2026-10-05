"""Auth, profile and consent endpoints (sections 2.3, 12 "Auth", 13.1, 13.2)."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_ip, get_current_user, require_roles, SUPER_ADMIN
from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_mfa_token,
    create_refresh_token,
    decode_claims,
    get_password_hash,
    verify_password,
)
from app.models import Consent, Direction, Organization, StudentProfile, User, UserMFA, UserPhoto
from app.schemas.user import ConsentUpdate, Token, UserLogin, UserRegister
from app.services import audit, photos, totp

router = APIRouter()

# Self-registration is limited to these roles; university admins, moderators and
# super admins are provisioned by an administrator (section 2.3).
SELF_REGISTER_ROLES = {"student", "teacher", "employer"}
ALL_ROLES = {"student", "teacher", "employer", "university", "moderator", "super_admin"}
CONSENT_TYPES = {"viva_record", "employer_share", "data_processing"}


def _initials(full_name: str) -> str:
    return "".join(n[0] for n in full_name.split() if n).upper()[:2] if full_name else "TL"


async def _user_context(db: AsyncSession, user: User) -> dict:
    org = None
    if user.org_id:
        org = (await db.execute(select(Organization).where(Organization.id == user.org_id))).scalars().first()
    profile = (await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))).scalars().first()
    direction = None
    if profile and profile.direction_id:
        direction = (await db.execute(select(Direction).where(Direction.id == profile.direction_id))).scalars().first()
    photo = (await db.execute(select(UserPhoto).where(UserPhoto.user_id == user.id))).scalars().first()
    return {"org": org, "profile": profile, "direction": direction, "photo": photos.data_url(photo) if photo else None}


async def _token_response(db: AsyncSession, user: User, mfa: bool = False) -> dict:
    ctx = await _user_context(db, user)
    return {
        "access_token": create_access_token(subject=user.id, mfa=mfa),
        "refresh_token": create_refresh_token(subject=user.id, mfa=mfa),
        "mfa": mfa,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone or "",
            "role": user.role,
            "direction": ctx["direction"].code if ctx["direction"] else "software",
            "organization": ctx["org"].name if ctx["org"] else "BSTU",
            "bio": user.bio or "",
            "photo": ctx["photo"],
        },
    }


async def _mfa_row(db: AsyncSession, user_id) -> Optional[UserMFA]:
    return (await db.execute(select(UserMFA).where(UserMFA.user_id == user_id))).scalars().first()


@router.post("/login")
async def login(credentials: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    query = select(User).where(
        or_(User.email == credentials.identifier, User.phone == credentials.identifier),
        User.is_deleted.is_(False),
    )
    user = (await db.execute(query)).scalars().first()

    if not user or not verify_password(credentials.password, user.hashed_password) or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email/telefon yoki parol noto‘g‘ri kiritildi.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    mfa = await _mfa_row(db, user.id)
    if mfa and mfa.enabled:
        # Password step passed; the second factor is completed at /auth/mfa/verify (section 13.1)
        audit.record(db, actor_id=user.id, action="auth.login_password_ok", entity="user", entity_id=user.id, ip=client_ip(request))
        await db.commit()
        return {"mfa_required": True, "mfa_token": create_mfa_token(user.id),
                "user": {"id": str(user.id), "full_name": user.full_name, "role": user.role}}

    audit.record(db, actor_id=user.id, action="auth.login", entity="user", entity_id=user.id, ip=client_ip(request))
    await db.commit()
    return await _token_response(db, user)


@router.post("/register", response_model=Token)
async def register(payload: UserRegister, request: Request, db: AsyncSession = Depends(get_db)):
    role = (payload.role or "student").strip().lower()
    if role not in SELF_REGISTER_ROLES:
        raise HTTPException(status_code=400, detail="Bu rol bilan o‘zingiz ro‘yxatdan o‘ta olmaysiz.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Parol kamida 8 belgidan iborat bo‘lishi kerak.")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Ushbu email bilan ro‘yxatdan o‘tilgan. Tizimga kiring.")

    org_name = payload.organization_name or "BSTU"
    org = (await db.execute(select(Organization).where(Organization.name == org_name))).scalars().first()
    if not org:
        org = Organization(name=org_name, type="company" if role == "employer" else "university")
        db.add(org)
        await db.flush()

    new_user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        hashed_password=get_password_hash(payload.password),
        role=role,
        org_id=org.id,
        locale="uz",
        status="active",
        bio="",
    )
    db.add(new_user)
    await db.flush()

    if role == "student":
        direction = (await db.execute(select(Direction).where(Direction.code == payload.direction_code))).scalars().first()
        db.add(
            StudentProfile(
                user_id=new_user.id,
                direction_id=direction.id if direction else None,
                course=payload.course or "1-kurs",
            )
        )
        # Only data processing is required to use the platform. Viva recording and sharing
        # with employers are separate opt-ins the student grants later (section 13.2).
        db.add(Consent(user_id=new_user.id, type="data_processing", granted_at=datetime.now(timezone.utc)))

    audit.record(
        db, actor_id=new_user.id, action="auth.register", entity="user", entity_id=new_user.id,
        after={"role": role, "email": new_user.email}, ip=client_ip(request),
    )
    await db.commit()
    return await _token_response(db, new_user)


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=Token)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    claims = decode_claims(payload.refresh_token, "refresh")
    user = None
    if claims and claims.get("sub"):
        try:
            user = (await db.execute(select(User).where(User.id == uuid.UUID(claims["sub"])))).scalars().first()
        except ValueError:
            user = None
    if not user or user.status != "active" or user.is_deleted:
        raise HTTPException(status_code=401, detail="Refresh token yaroqsiz.")
    return await _token_response(db, user, mfa=bool(claims.get("mfa")))


# ---------- Two-factor authentication (section 13.1) ----------

class MfaVerify(BaseModel):
    mfa_token: str
    code: str


@router.post("/mfa/verify", response_model=Token)
async def mfa_verify(payload: MfaVerify, request: Request, db: AsyncSession = Depends(get_db)):
    """Second login step: a TOTP code or a one-time recovery code."""
    claims = decode_claims(payload.mfa_token, "mfa")
    user = None
    if claims and claims.get("sub"):
        try:
            user = (await db.execute(select(User).where(User.id == uuid.UUID(claims["sub"])))).scalars().first()
        except ValueError:
            user = None
    mfa = await _mfa_row(db, user.id) if user else None
    if not user or not mfa or not mfa.enabled:
        raise HTTPException(status_code=401, detail="Sessiya muddati tugadi, qaytadan kiring.")
    secret = totp.decrypt(mfa.secret_encrypted)
    step = totp.verify(secret, payload.code, mfa.last_used_step) if secret else None
    if step is not None:
        mfa.last_used_step = step
        method = "totp"
    else:
        remaining = totp.use_recovery_code(payload.code, mfa.recovery_hashes or [])
        if remaining is None:
            audit.record(db, actor_id=user.id, action="auth.mfa_failed", entity="user", entity_id=user.id, ip=client_ip(request))
            await db.commit()
            raise HTTPException(status_code=401, detail="Kod noto‘g‘ri yoki allaqachon ishlatilgan.")
        mfa.recovery_hashes = remaining
        method = "recovery_code"
    audit.record(db, actor_id=user.id, action="auth.login", entity="user", entity_id=user.id,
                 after={"mfa": method}, ip=client_ip(request))
    await db.commit()
    return await _token_response(db, user, mfa=True)


@router.get("/mfa")
async def mfa_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    mfa = await _mfa_row(db, user.id)
    return {
        "enabled": bool(mfa and mfa.enabled),
        "required": settings.MFA_ENFORCED and user.role in settings.MFA_REQUIRED_ROLES,
        "recommended": user.role in settings.MFA_REQUIRED_ROLES,
        "session_verified": bool(getattr(user, "token_mfa", False)),
        "recovery_codes_left": len(mfa.recovery_hashes or []) if mfa and mfa.enabled else 0,
    }


@router.post("/mfa/setup")
async def mfa_setup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Starts enrolment: a new secret and otpauth URI (shown as a QR code). Not active until confirmed."""
    mfa = await _mfa_row(db, user.id)
    if mfa and mfa.enabled:
        raise HTTPException(status_code=400, detail="Ikki bosqichli tasdiq allaqachon yoqilgan.")
    secret = totp.new_secret()
    if mfa:
        mfa.secret_encrypted, mfa.last_used_step = totp.encrypt(secret), None
    else:
        db.add(UserMFA(user_id=user.id, secret_encrypted=totp.encrypt(secret), enabled=False, recovery_hashes=[]))
    await db.commit()
    return {"secret": secret, "otpauth_uri": totp.provisioning_uri(secret, user.email)}


class MfaCode(BaseModel):
    code: str


@router.post("/mfa/enable")
async def mfa_enable(payload: MfaCode, request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    mfa = await _mfa_row(db, user.id)
    if not mfa or mfa.enabled:
        raise HTTPException(status_code=400, detail="Avval sozlashni boshlang.")
    step = totp.verify(totp.decrypt(mfa.secret_encrypted) or "", payload.code, None)
    if step is None:
        raise HTTPException(status_code=400, detail="Kod noto‘g‘ri. Ilovadagi joriy 6 xonali kodni kiriting.")
    plain, hashes = totp.new_recovery_codes()
    mfa.enabled, mfa.last_used_step, mfa.recovery_hashes = True, step, hashes
    audit.record(db, actor_id=user.id, action="auth.mfa_enabled", entity="user", entity_id=user.id, ip=client_ip(request))
    await db.commit()
    # Recovery codes are shown exactly once; only their hashes are stored
    return {"enabled": True, "recovery_codes": plain}


@router.post("/mfa/disable")
async def mfa_disable(payload: MfaCode, request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    mfa = await _mfa_row(db, user.id)
    if not mfa or not mfa.enabled:
        raise HTTPException(status_code=400, detail="Ikki bosqichli tasdiq yoqilmagan.")
    if totp.verify(totp.decrypt(mfa.secret_encrypted) or "", payload.code, mfa.last_used_step) is None:
        raise HTTPException(status_code=400, detail="Kod noto‘g‘ri.")
    mfa.enabled, mfa.recovery_hashes = False, []
    audit.record(db, actor_id=user.id, action="auth.mfa_disabled", entity="user", entity_id=user.id, ip=client_ip(request))
    await db.commit()
    return {"enabled": False}


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


def _profile_payload(user: User, ctx: dict, consents: list[Consent]) -> dict:
    profile, direction, org = ctx["profile"], ctx["direction"], ctx["org"]
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone or "",
        "bio": user.bio or "",
        "role": user.role,
        "organization": org.name if org else "BSTU",
        "direction": direction.name if direction else None,
        "direction_code": direction.code if direction else None,
        "course": profile.course if profile else None,
        "group": profile.group_id if profile else None,
        "avatar": _initials(user.full_name),
        "photo": ctx["photo"],
        "consents": [
            {"id": str(c.id), "type": c.type, "granted": c.revoked_at is None, "granted_at": c.granted_at.isoformat() if c.granted_at else None}
            for c in consents
        ],
    }


@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ctx = await _user_context(db, user)
    consents = (await db.execute(select(Consent).where(Consent.user_id == user.id))).scalars().all()
    return _profile_payload(user, ctx, list(consents))


class PhotoUpload(BaseModel):
    data_url: str = Field(max_length=4_000_000)  # base64 of a <= 2 MB image


@router.put("/me/photo")
async def upload_photo(payload: PhotoUpload, request: Request, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    try:
        jpeg = photos.normalize(payload.data_url)
    except photos.PhotoError as e:
        raise HTTPException(status_code=400, detail=str(e))
    row = (await db.execute(select(UserPhoto).where(UserPhoto.user_id == user.id))).scalars().first()
    if row:
        row.data, row.content_type = jpeg, "image/jpeg"
    else:
        row = UserPhoto(user_id=user.id, content_type="image/jpeg", data=jpeg)
        db.add(row)
    audit.record(db, actor_id=user.id, action="profile.photo_update", entity="user", entity_id=user.id,
                 after={"bytes": len(jpeg)}, ip=client_ip(request))
    await db.commit()
    return {"photo": photos.data_url(row)}


@router.delete("/me/photo")
async def delete_photo(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(UserPhoto).where(UserPhoto.user_id == user.id))).scalars().first()
    if row:
        await db.delete(row)
        audit.record(db, actor_id=user.id, action="profile.photo_delete", entity="user", entity_id=user.id,
                     ip=client_ip(request))
        await db.commit()
    return {"photo": None}


@router.put("/me")
async def update_me(
    payload: UserProfileUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    before = {"full_name": user.full_name, "phone": user.phone, "bio": user.bio}
    if payload.full_name:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.bio is not None:
        user.bio = payload.bio.strip()[:1000]
    audit.record(
        db, actor_id=user.id, action="profile.update", entity="user", entity_id=user.id,
        before=before, after={"full_name": user.full_name, "phone": user.phone, "bio": user.bio}, ip=client_ip(request),
    )
    await db.commit()
    await db.refresh(user)
    ctx = await _user_context(db, user)
    consents = (await db.execute(select(Consent).where(Consent.user_id == user.id))).scalars().all()
    return _profile_payload(user, ctx, list(consents))


class RoleUpdate(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
async def set_user_role(
    user_id: str,
    payload: RoleUpdate,
    request: Request,
    actor: User = Depends(require_roles(SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Role assignment is an administrative action (section 2.3: "Foydalanuvchi va tizim sozlamalari")."""
    role = payload.role.strip().lower()
    if role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Noto‘g‘ri rol.")
    try:
        target = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalars().first()
    except ValueError:
        target = None
    if not target:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    audit.record(
        db, actor_id=actor.id, action="user.role_change", entity="user", entity_id=target.id,
        before={"role": target.role}, after={"role": role}, ip=client_ip(request),
    )
    target.role = role
    await db.commit()
    return {"id": str(target.id), "role": target.role}


# ---------- Consents (section 13.2: separate, revocable consent per purpose) ----------

@router.get("/consents")
async def list_consents(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Consent).where(Consent.user_id == user.id))).scalars().all()
    granted = {c.type: c for c in rows if c.revoked_at is None}
    return [
        {
            "type": t,
            "granted": t in granted,
            "id": str(granted[t].id) if t in granted else None,
            "granted_at": granted[t].granted_at.isoformat() if t in granted and granted[t].granted_at else None,
        }
        for t in sorted(CONSENT_TYPES)
    ]


@router.post("/consents")
async def set_consent(
    payload: ConsentUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.type not in CONSENT_TYPES:
        raise HTTPException(status_code=400, detail="Noma’lum consent turi.")
    now = datetime.now(timezone.utc)
    active = (
        await db.execute(
            select(Consent).where(Consent.user_id == user.id, Consent.type == payload.type, Consent.revoked_at.is_(None))
        )
    ).scalars().all()

    if payload.granted and not active:
        db.add(Consent(user_id=user.id, type=payload.type, granted_at=now))
    elif not payload.granted:
        for c in active:
            c.revoked_at = now

    audit.record(
        db, actor_id=user.id, action="consent.grant" if payload.granted else "consent.revoke",
        entity="consent", entity_id=payload.type, after={"granted": payload.granted}, ip=client_ip(request),
    )
    await db.commit()
    return {"type": payload.type, "granted": payload.granted}


@router.delete("/consents/{consent_type}")
async def revoke_consent(
    consent_type: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await set_consent(ConsentUpdate(type=consent_type, granted=False), request, user, db)


async def has_consent(db: AsyncSession, user_id, consent_type: str) -> bool:
    row = (
        await db.execute(
            select(Consent.id).where(Consent.user_id == user_id, Consent.type == consent_type, Consent.revoked_at.is_(None))
        )
    ).first()
    return row is not None
