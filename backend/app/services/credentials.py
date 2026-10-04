"""Open Badges 3.0 / W3C Verifiable Credentials (sections 3.4-C, 14).

Credentials are signed as JWT-VC with an ES256 (P-256) key. The issuer is a did:web identifier;
its public key is published at /.well-known/did.json so anyone can verify a credential outside
the platform. A credential is revoked when later evidence drops the skill below the issued level.
"""
import hashlib
import json
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from jose import jwk, jwt, JWTError

from app.core.config import settings

ALGORITHM = "ES256"
KEY_ID = "key-1"
# Issue when the skill reaches at least L3 with reasonable confidence; L5 already requires a human verifier (6.4)
MIN_LEVEL = "L3"
MIN_CONFIDENCE = 60.0


def _load_or_create_key() -> ec.EllipticCurvePrivateKey:
    path = settings.CREDENTIAL_SIGNING_KEY_PATH
    if os.path.exists(path):
        with open(path, "rb") as f:
            return serialization.load_pem_private_key(f.read(), password=None)
    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        # Another worker created the key first: use that one so every worker signs with the same key
        with open(path, "rb") as f:
            return serialization.load_pem_private_key(f.read(), password=None)
    with os.fdopen(fd, "wb") as f:
        f.write(pem)
    return key


_key: Optional[ec.EllipticCurvePrivateKey] = None


def _private_key() -> ec.EllipticCurvePrivateKey:
    global _key
    if _key is None:
        _key = _load_or_create_key()
    return _key


def _private_pem() -> bytes:
    return _private_key().private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                        serialization.NoEncryption())


def _public_pem() -> bytes:
    return _private_key().public_key().public_bytes(serialization.Encoding.PEM,
                                                    serialization.PublicFormat.SubjectPublicKeyInfo)


def verification_method() -> str:
    return f"{settings.CREDENTIAL_ISSUER_DID}#{KEY_ID}"


def did_document() -> Dict:
    public_jwk = jwk.construct(_public_pem().decode(), ALGORITHM).to_dict()
    public_jwk = {k: v.decode() if isinstance(v, bytes) else v for k, v in public_jwk.items()}
    return {
        "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
        "id": settings.CREDENTIAL_ISSUER_DID,
        "verificationMethod": [{
            "id": verification_method(), "type": "JsonWebKey2020", "controller": settings.CREDENTIAL_ISSUER_DID,
            "publicKeyJwk": {**public_jwk, "kid": KEY_ID},
        }],
        "assertionMethod": [verification_method()],
    }


def subject_identifier(email: str) -> Tuple[str, str]:
    """Salted hash of the email (OB 3.0 IdentityObject) so the credential doesn't expose it."""
    salt = secrets.token_hex(8)
    digest = hashlib.sha256((email.strip().lower() + salt).encode()).hexdigest()
    return f"sha256${digest}", salt


def level_allows_issue(level: str, confidence: float) -> bool:
    return level[:2] >= MIN_LEVEL and level[:2] != "L0" and confidence >= MIN_CONFIDENCE


def build_credential(
    *, credential_id: uuid.UUID, student_email: str, student_name: str, skill_code: str, skill_name: str,
    direction: str, level: str, score: float, confidence: float, framework_refs: Dict, layers: Dict,
) -> Dict:
    identity, salt = subject_identifier(student_email)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    verify_url = f"{settings.CREDENTIAL_VERIFY_BASE_URL.rstrip('/')}/{credential_id}"
    alignments = [
        {"type": ["Alignment"], "targetName": f"{fw}: {ref}", "targetFramework": fw, "targetCode": str(ref)}
        for fw, ref in (framework_refs or {}).items() if fw in ("SFIA", "ESCO", "DigComp")
    ]
    return {
        "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
        "id": f"urn:uuid:{credential_id}",
        "type": ["VerifiableCredential", "OpenBadgeCredential"],
        "issuer": {"id": settings.CREDENTIAL_ISSUER_DID, "type": ["Profile"], "name": settings.CREDENTIAL_ISSUER_NAME},
        "validFrom": now,
        "name": f"{skill_name} — {level}",
        "credentialSubject": {
            "type": ["AchievementSubject"],
            "identifier": [{"type": "IdentityObject", "identityHash": identity, "identityType": "emailAddress",
                            "hashed": True, "salt": salt}],
            "achievement": {
                "id": f"urn:skilldna:achievement:{skill_code}:{level.split(' ')[0]}",
                "type": ["Achievement"],
                "name": f"{skill_name} ({level})",
                "description": f"{direction} yo‘nalishida {skill_name} ko‘nikmasi 5 qatlamli dalil (KNOW·DO·ADAPT·DEFEND·PROVE) asosida tasdiqlangan.",
                "criteria": {"narrative": "Daraja Skill Score, Confidence va majburiy dalil qatlamlari bo‘yicha SKILL DNA v2.0 qoidalari asosida berildi."},
                "alignment": alignments,
            },
            "result": [
                {"type": ["Result"], "value": level, "resultDescription": "level"},
                {"type": ["Result"], "value": f"{score:.0f}", "resultDescription": "skill_score"},
                {"type": ["Result"], "value": f"{confidence:.0f}", "resultDescription": "confidence"},
            ],
            "evidenceLayers": {k: v for k, v in (layers or {}).items() if v is not None},
        },
        "credentialStatus": {"id": verify_url, "type": "SkillDnaStatus"},
        "evidence": [{"id": verify_url, "type": ["Evidence"], "name": "SKILL DNA Evidence Graph"}],
    }


def sign(credential: Dict) -> str:
    claims = {
        "iss": settings.CREDENTIAL_ISSUER_DID,
        "jti": credential["id"],
        "nbf": int(datetime.now(timezone.utc).timestamp()),
        "vc": credential,
    }
    return jwt.encode(claims, _private_pem().decode(), algorithm=ALGORITHM, headers={"kid": verification_method()})


def verify_signature(token: str) -> Optional[Dict]:
    try:
        return jwt.decode(token, _public_pem().decode(), algorithms=[ALGORITHM], options={"verify_aud": False})
    except JWTError:
        return None


def payload_digest(credential: Dict) -> str:
    return hashlib.sha256(json.dumps(credential, sort_keys=True).encode()).hexdigest()
