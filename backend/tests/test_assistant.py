"""In-platform AI assistant (section 5.2)."""
import pytest

from app.services import assistant, llm


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(llm.settings, "ANTHROPIC_API_KEY", "")


def test_mode_defaults_to_guarded():
    assert assistant.mode_for({}) == "guarded"
    assert assistant.mode_for({"assistant_mode": "unguarded"}) == "unguarded"


def test_guarded_mode_strips_long_code_even_if_model_returns_it():
    long_code = "def f(x):\n    a = 1\n    b = 2\n    return a + b\n"
    reply, suggestion = assistant._enforce_guard(f"Mana yechim:\n```python\n{long_code}```", long_code)
    assert suggestion is None
    assert "def f" not in reply
    short = "x = sorted(items)\n"
    reply, suggestion = assistant._enforce_guard("Bu qatorni ko‘ring", short)
    assert suggestion == short


async def test_fallback_is_honest_and_gives_no_solution():
    out = await assistant.answer("guarded", "Xato chiqyapti, nima qilay?", "Pagination", "spec", "code", [])
    assert out["source"] == "heuristic-v1"
    assert "LLM ulanmagan" in out["reply"]
    assert out["code_suggestion"] is None and out["suggestion_id"] is None


def test_accepted_ratio_counts_only_decided_suggestions():
    entries = [
        {"suggestion_id": "a", "decision": "accepted"},
        {"suggestion_id": "b", "decision": "rejected"},
        {"suggestion_id": "c", "decision": None},
        {"suggestion_id": None, "decision": None},
    ]
    assert assistant.accepted_ratio(entries) == 0.5
    assert assistant.accepted_ratio([]) == 0.0


def test_ai_fluency_combines_tests_and_viva():
    assert assistant.ai_fluency_score(100, {"ai_usage": 80, "find_bug": 60, "ownership": 70}) == pytest.approx(82.0)
    assert assistant.ai_fluency_score(90, {}) is None
