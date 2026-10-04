"""Request dependencies: authentication and role-based access (section 2.3 / 13.1)."""
import uuid
from typing import Callable, Optional

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import decode_claims
from app.models import User

# Role names as stored in users.role
STUDENT = "student"
TEACHER = "teacher"
EMPLOYER = "employer"
UNIVERSITY = "university"
MODERATOR = "moderator"
SUPER_ADMIN = "super_admin"
STAFF_ROLES = (TEACHER, UNIVERSITY, MODERATOR, SUPER_ADMIN)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Avtorizatsiyadan o‘tilmagan yoki sessiya muddati tugagan.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Resolves the user from a Bearer access token only. Never trusts query parameters."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    claims = decode_claims(authorization.split(" ", 1)[1].strip(), "access")
    if not claims or not claims.get("sub"):
        return None
    try:
        uid = uuid.UUID(claims["sub"])
    except ValueError:
        return None
    res = await db.execute(select(User).where(User.id == uid, User.is_deleted.is_(False)))
    user = res.scalars().first()
    if user and user.status != "active":
        return None
    if user:
        user.token_mfa = bool(claims.get("mfa"))  # transient attribute, not a column
    return user


async def get_current_user(user: Optional[User] = Depends(get_current_user_optional)) -> User:
    if not user:
        raise _UNAUTHORIZED
    return user


def require_roles(*roles: str) -> Callable:
    """Dependency factory: the caller must hold one of the given roles (super_admin always passes)."""
    allowed = set(roles) | {SUPER_ADMIN}

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu amal uchun ruxsat yo‘q (RBAC).",
            )
        if settings.MFA_ENFORCED and user.role in settings.MFA_REQUIRED_ROLES and not getattr(user, "token_mfa", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="mfa_required: bu rol uchun ikki bosqichli tasdiqni yoqing va kod bilan qayta kiring.",
            )
        return user

    return checker


_FORBIDDEN_OTHER = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Boshqa foydalanuvchi ma’lumotiga ruxsat yo‘q.")


async def ensure_can_view(db: AsyncSession, viewer: User, owner_id: uuid.UUID) -> None:
    """Owners see their own records. Moderators and super admins see everyone. Teachers and university
    admins see only students of their own organisation (multi-tenancy, section 13.1). Employers never
    pass here: they reach students only through consent-limited endpoints (section 10.4)."""
    if viewer.id == owner_id or viewer.role in (MODERATOR, SUPER_ADMIN):
        return
    if viewer.role in (TEACHER, UNIVERSITY):
        owner_org = (await db.execute(select(User.org_id).where(User.id == owner_id))).scalar()
        if owner_org is not None and owner_org == viewer.org_id:
            return
    raise _FORBIDDEN_OTHER


def client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
