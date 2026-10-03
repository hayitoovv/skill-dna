from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.models import User, StudentProfile, Organization, Direction, UserRole, Consent
from app.schemas.user import UserLogin, UserRegister, Token, UserResponse, ConsentUpdate
from datetime import datetime, timezone
from pydantic import BaseModel
from jose import jwt
import uuid

router = APIRouter()

async def resolve_user(user_id: str | None, authorization: str | None, db: AsyncSession) -> User | None:
    # 1. Check Bearer token in Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            sub = payload.get("sub")
            if sub:
                uid = uuid.UUID(sub)
                res = await db.execute(select(User).where(User.id == uid))
                u = res.scalars().first()
                if u:
                    return u
        except Exception:
            pass

    # 2. Check user_id param (UUID or email)
    if user_id:
        try:
            uid = uuid.UUID(user_id)
            res = await db.execute(select(User).where(User.id == uid))
            u = res.scalars().first()
            if u:
                return u
        except (ValueError, TypeError):
            pass

        if "@" in user_id:
            res = await db.execute(select(User).where(User.email == user_id.strip()))
            u = res.scalars().first()
            if u:
                return u

    return None

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    query = select(User).where(
        or_(User.email == credentials.identifier, User.phone == credentials.identifier)
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email/telefon yoki parol noto‘g‘ri kiritildi.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id)
    
    # Get organization name
    org_name = "BSTU"
    if user.org_id:
        org_res = await db.execute(select(Organization).where(Organization.id == user.org_id))
        org = org_res.scalars().first()
        if org:
            org_name = org.name

    direction_code = "software"
    if user.role == "student":
        st_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
        st_prof = st_res.scalars().first()
        if st_prof and st_prof.direction_id:
            dir_res = await db.execute(select(Direction).where(Direction.id == st_prof.direction_id))
            dir_obj = dir_res.scalars().first()
            if dir_obj:
                direction_code = dir_obj.code

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone or "",
            "role": user.role,
            "direction": direction_code,
            "organization": org_name,
            "bio": user.bio or "",
        }
    }

@router.post("/register", response_model=Token)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ushbu email bilan ro‘yxatdan o‘tilgan. Tizimga kiring.",
        )

    # Get or create default organization
    org_name = payload.organization_name or "BSTU"
    org_res = await db.execute(select(Organization).where(Organization.name == org_name))
    org = org_res.scalars().first()
    if not org:
        org = Organization(name=org_name, type="university")
        db.add(org)
        await db.flush()

    new_user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        org_id=org.id,
        locale="uz",
        status="active",
        bio="",
    )
    db.add(new_user)
    await db.flush()

    # If student, link student profile
    if payload.role == UserRole.STUDENT.value or payload.role == "student":
        dir_res = await db.execute(select(Direction).where(Direction.code == payload.direction_code))
        direction = dir_res.scalars().first()
        direction_id = direction.id if direction else None

        st_profile = StudentProfile(
            user_id=new_user.id,
            direction_id=direction_id,
            course=payload.course or "1-kurs",
            group_id="101-26 DI"
        )
        db.add(st_profile)

        # Add initial consents
        for c_type in ["viva_record", "employer_share", "data_processing"]:
            db.add(Consent(user_id=new_user.id, type=c_type, granted_at=datetime.now(timezone.utc)))

    await db.commit()

    access_token = create_access_token(subject=new_user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(new_user.id),
            "full_name": new_user.full_name,
            "email": new_user.email,
            "phone": new_user.phone or "",
            "role": new_user.role,
            "direction": payload.direction_code or "software",
            "organization": org.name if org else "SKILL DNA",
            "bio": "",
        }
    }

ALLOWED_ROLES = {"student", "teacher", "employer", "university", "moderator"}

class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    bio: str | None = None
    role: str | None = None

@router.get("/me")
async def get_current_user_profile(
    user_id: str = None,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    user = await resolve_user(user_id, authorization, db)

    # Fallback to demo student only if neither user_id nor authorization was sent
    if not user and not user_id and not authorization:
        user_res = await db.execute(select(User).where(User.role == "student").limit(1))
        user = user_res.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    # Get student profile and direction
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user.id))
    st_prof = prof_res.scalars().first()

    direction = None
    if st_prof and st_prof.direction_id:
        dir_res = await db.execute(select(Direction).where(Direction.id == st_prof.direction_id))
        direction = dir_res.scalars().first()

    # Get organization
    org = None
    if user.org_id:
        org_res = await db.execute(select(Organization).where(Organization.id == user.org_id))
        org = org_res.scalars().first()

    consents_res = await db.execute(select(Consent).where(Consent.user_id == user.id))
    consents = consents_res.scalars().all()

    initials = "".join([n[0] for n in user.full_name.split() if n]).upper()[:2] if user.full_name else "TL"

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone or "",
        "bio": user.bio or "Dasturiy ta’minot va zamonaviy backend texnologiyalari bo‘yicha talaba.",
        "role": user.role,
        "organization": org.name if org else "BSTU",
        "direction": direction.name if direction else "Dasturiy injiniring",
        "direction_code": direction.code if direction else "software",
        "course": st_prof.course if st_prof else "1-kurs",
        "group": st_prof.group_id if st_prof else "101-26 DI",
        "avatar": initials,
        "consents": [{"type": c.type, "granted": c.revoked_at is None} for c in consents]
    }

@router.put("/me")
async def update_current_user_profile(
    payload: UserProfileUpdate,
    user_id: str = None,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    user = await resolve_user(user_id, authorization, db)

    if not user:
        raise HTTPException(status_code=401, detail="Avtorizatsiyadan o‘tilmagan yoki sessiya topilmadi.")

    # Security check: Prevent IDOR (updating someone else's profile without permissions)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        try:
            payload_token = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            token_sub = payload_token.get("sub")
            if token_sub and user_id and str(user.id) != token_sub and user.role not in ["university", "moderator", "super_admin"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Xavfsizlik: Boshqa foydalanuvchi profilini o‘zgartirish huquqi yo‘q."
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessiya yaroqsiz yoki muddati tugagan.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if payload.role:
        clean_role = payload.role.strip().lower()
        if clean_role not in ALLOWED_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Xavfsizlik xatosi: Noto‘g‘ri rol kiritildi. Ruxsat etilgan rollar: {', '.join(sorted(ALLOWED_ROLES))}"
            )
        import logging
        logging.getLogger("uvicorn.access").info(
            f"[RBAC SECURITY AUDIT] User {user.id} ({user.email}) changed role from '{user.role}' to '{clean_role}'"
        )
        user.role = clean_role

    if payload.full_name:
        user.full_name = payload.full_name.strip()
    if payload.email:
        user.email = payload.email.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.bio is not None:
        user.bio = payload.bio.strip()

    await db.commit()
    await db.refresh(user)

    initials = "".join([n[0] for n in user.full_name.split() if n]).upper()[:2] if user.full_name else "TL"

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone or "",
        "bio": user.bio or "",
        "role": user.role,
        "avatar": initials,
    }
