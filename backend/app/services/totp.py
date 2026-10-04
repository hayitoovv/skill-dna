"""TOTP two-factor authentication (RFC 6238) for admin/moderator accounts (section 13.1).

Secrets are encrypted at rest with a key derived from SECRET_KEY. Each accepted time step is
remembered so a code can't be replayed, and recovery codes are stored only as hashes.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from typing import List, Optional, Tuple
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

PERIOD = 30
DIGITS = 6
WINDOW = 1  # accept one step of clock drift either way
ISSUER = "SKILL DNA"


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(("totp:" + settings.SECRET_KEY).encode()).digest())
    return Fernet(key)


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def encrypt(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt(token: str) -> Optional[str]:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


def provisioning_uri(secret: str, account: str) -> str:
    label = quote(f"{ISSUER}:{account}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER)}&algorithm=SHA1&digits={DIGITS}&period={PERIOD}"


def _code_at(secret: str, step: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10 ** DIGITS).zfill(DIGITS)


def current_step(now: Optional[float] = None) -> int:
    return int((now if now is not None else time.time()) // PERIOD)


def verify(secret: str, code: str, last_step: Optional[int], now: Optional[float] = None) -> Optional[int]:
    """Returns the matched time step if the code is valid and newer than `last_step` (replay protection)."""
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit() or len(code) != DIGITS:
        return None
    step = current_step(now)
    for s in range(step - WINDOW, step + WINDOW + 1):
        if last_step is not None and s <= last_step:
            continue
        if hmac.compare_digest(_code_at(secret, s), code):
            return s
    return None


def _hash_recovery(code: str) -> str:
    return hashlib.sha256(("recovery:" + settings.SECRET_KEY + ":" + code.strip().lower()).encode()).hexdigest()


def new_recovery_codes(n: int = 8) -> Tuple[List[str], List[str]]:
    """(plain codes shown once, hashes to store)."""
    plain = [f"{secrets.token_hex(3)}-{secrets.token_hex(3)}" for _ in range(n)]
    return plain, [_hash_recovery(c) for c in plain]


def use_recovery_code(code: str, hashes: List[str]) -> Optional[List[str]]:
    """Returns the remaining hashes if `code` matched one (it is consumed), else None."""
    h = _hash_recovery(code)
    if h in hashes:
        return [x for x in hashes if x != h]
    return None
