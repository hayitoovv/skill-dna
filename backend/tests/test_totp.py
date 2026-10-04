"""TOTP second factor (section 13.1), checked against the RFC 6238 test vector."""
from app.services import totp

# RFC 6238 Appendix B: ASCII "12345678901234567890" as base32, SHA1
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"


def test_rfc6238_vector():
    # T = 59s -> 94287082 (8 digits); our 6-digit code is its last six digits
    assert totp._code_at(RFC_SECRET, totp.current_step(59)) == "287082"
    assert totp._code_at(RFC_SECRET, totp.current_step(1111111109)) == "081804"


def test_verify_accepts_current_and_drift_and_rejects_replay():
    now = 1_700_000_000
    code = totp._code_at(RFC_SECRET, totp.current_step(now))
    step = totp.verify(RFC_SECRET, code, None, now=now)
    assert step == totp.current_step(now)
    # The same code can't be used twice
    assert totp.verify(RFC_SECRET, code, step, now=now) is None
    # One step of clock drift is tolerated, two are not
    prev = totp._code_at(RFC_SECRET, totp.current_step(now) - 1)
    assert totp.verify(RFC_SECRET, prev, None, now=now) is not None
    old = totp._code_at(RFC_SECRET, totp.current_step(now) - 3)
    assert totp.verify(RFC_SECRET, old, None, now=now) is None
    assert totp.verify(RFC_SECRET, "12ab56", None, now=now) is None


def test_secret_encryption_roundtrip_and_tamper():
    secret = totp.new_secret()
    token = totp.encrypt(secret)
    assert secret not in token
    assert totp.decrypt(token) == secret
    assert totp.decrypt(token[:-4] + "AAAA") is None


def test_recovery_codes_are_hashed_and_single_use():
    plain, hashes = totp.new_recovery_codes(3)
    assert all(p not in hashes for p in plain)
    remaining = totp.use_recovery_code(plain[0], hashes)
    assert remaining is not None and len(remaining) == 2
    assert totp.use_recovery_code(plain[0], remaining) is None


def test_provisioning_uri_shape():
    uri = totp.provisioning_uri("ABC", "mod@skilldna.uz")
    assert uri.startswith("otpauth://totp/SKILL%20DNA%3Amod%40skilldna.uz?secret=ABC")
