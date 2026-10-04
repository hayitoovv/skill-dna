"""OB 3.0 credential signing and verification (section 14)."""
import uuid

import pytest

from app.services import credentials


@pytest.fixture(autouse=True)
def temp_key(tmp_path, monkeypatch):
    monkeypatch.setattr(credentials.settings, "CREDENTIAL_SIGNING_KEY_PATH", str(tmp_path / "key.pem"))
    monkeypatch.setattr(credentials, "_key", None)


def make():
    return credentials.build_credential(
        credential_id=uuid.uuid4(), student_email="Talaba@Example.uz", student_name="Talaba", skill_code="SE-BACKEND",
        skill_name="Backend va REST API", direction="Dasturiy injiniring", level="L4 CREATE", score=83, confidence=81,
        framework_refs={"SFIA": "PROG 3", "pilot": True}, layers={"KNOW": 90, "DO": 85, "PROVE": None},
    )


def test_credential_is_ob3_shaped_and_hides_email():
    cred = make()
    assert "OpenBadgeCredential" in cred["type"]
    assert cred["issuer"]["id"].startswith("did:web:")
    ident = cred["credentialSubject"]["identifier"][0]
    assert ident["hashed"] is True and "example.uz" not in str(cred).lower()
    assert cred["credentialSubject"]["achievement"]["alignment"][0]["targetFramework"] == "SFIA"
    assert "PROVE" not in cred["credentialSubject"]["evidenceLayers"]


def test_signed_credential_verifies_and_tampering_fails():
    token = credentials.sign(make())
    claims = credentials.verify_signature(token)
    assert claims and claims["vc"]["name"].startswith("Backend")
    header, payload, sig = token.split(".")
    tampered = ".".join([header, payload[:-4] + ("AAAA" if payload[-4:] != "AAAA" else "BBBB"), sig])
    assert credentials.verify_signature(tampered) is None


def test_did_document_publishes_public_key_only():
    doc = credentials.did_document()
    jwk = doc["verificationMethod"][0]["publicKeyJwk"]
    assert jwk["kty"] == "EC" and "d" not in jwk


def test_issue_threshold():
    assert credentials.level_allows_issue("L3 ADAPT", 60)
    assert not credentials.level_allows_issue("L2 APPLY", 99)
    assert not credentials.level_allows_issue("L4 CREATE", 50)
    assert not credentials.level_allows_issue("L0", 100)
