from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import jwt, JWTError
import bcrypt
from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _encode(subject: Any, token_type: str, expires_delta: timedelta, mfa: bool = False) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject), "type": token_type, "mfa": mfa}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: Any, expires_delta: Optional[timedelta] = None, mfa: bool = False) -> str:
    return _encode(subject, "access", expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), mfa)


def create_refresh_token(subject: Any, mfa: bool = False) -> str:
    return _encode(subject, "refresh", timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), mfa)


def create_mfa_token(subject: Any) -> str:
    """Short-lived token proving the password step passed; exchanged for real tokens with a TOTP code."""
    return _encode(subject, "mfa", timedelta(minutes=5))


def decode_claims(token: str, expected_type: str) -> Optional[dict]:
    """Returns the claims if the token is valid and of the expected type, else None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    # Tokens issued before typed tokens existed carry no "type"; treat them as access tokens
    if payload.get("type", "access") != expected_type:
        return None
    return payload


def decode_token(token: str, expected_type: str) -> Optional[str]:
    claims = decode_claims(token, expected_type)
    return claims.get("sub") if claims else None
