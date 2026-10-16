import random

from app.services import question_bank as qb


def test_validate():
    ok = qb.QuestionData("Qaysi metod idempotent?", ["PUT", "POST", "PATCH"], 0)
    assert qb.validate(ok) == []
    assert qb.validate(qb.QuestionData("Savol?", ["A"], 0))  # too few options
    assert qb.validate(qb.QuestionData("Uzun savol matni", ["A", "a"], 0))  # duplicate options
    assert qb.validate(qb.QuestionData("Uzun savol matni", ["A", "B"], 2))  # answer out of range
    assert qb.validate(qb.QuestionData("Uzun savol matni", ["A", "B"], 0, difficulty="L9"))


def test_draw_keeps_correct_answer_after_shuffle():
    pool = [(f"q{i}", f"Savol {i}", ["to‘g‘ri", "x", "y", "z"], 0) for i in range(30)]
    drawn = qb.draw(pool, random.Random("seed"))
    assert len(drawn) == qb.KNOW_DRAW
    assert len({d["id"] for d in drawn}) == qb.KNOW_DRAW
    for d in drawn:
        assert d["options"][d["answer_index"]] == "to‘g‘ri"


def test_draw_is_deterministic_per_seed_and_small_bank():
    pool = [("a", "A?", ["1", "2"], 1), ("b", "B?", ["1", "2"], 0)]
    assert qb.draw(pool, random.Random("s")) == qb.draw(pool, random.Random("s"))
    assert len(qb.draw(pool, random.Random("s"))) == 2


def test_parse_csv_semicolon_and_errors():
    text = ("skill_code;savol;A;B;C;D;togri_javob;izoh;daraja\n"
            "SE-SQL;Indeks nimani tezlashtiradi?;Qidiruvni;Yozishni;Hech narsani;;A;Izoh;L2\n"
            "SE-SQL;Xato qator;Bir;;;;C;;L2\n")
    out = qb.parse_csv(text)
    assert len(out.rows) == 1
    assert out.rows[0].options == ["Qidiruvni", "Yozishni", "Hech narsani"] and out.rows[0].answer_index == 0
    assert out.errors and out.errors[0]["line"] == 3


def test_parse_csv_requires_header():
    assert qb.parse_csv("a,b\n1,2\n").errors[0]["line"] == 1
