"""Question bank rules — pure functions (no database): validation, CSV rows and the per-attempt random draw."""
import csv
import io
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

KNOW_DRAW = 10  # questions per KNOW attempt (fewer when the bank is smaller)
MIN_OPTIONS, MAX_OPTIONS = 2, 6
LEVELS = ("L1", "L2", "L3", "L4", "L5")
LETTERS = "ABCDEF"


@dataclass
class QuestionData:
    text: str
    options: List[str]
    answer_index: int
    explanation: Optional[str] = None
    difficulty: str = "L2"
    skill_code: Optional[str] = None


def validate(q: QuestionData) -> List[str]:
    """Problems with a question, in Uzbek; empty when it is valid."""
    errors = []
    if len((q.text or "").strip()) < 5:
        errors.append("Savol matni juda qisqa")
    opts = [o.strip() for o in q.options if o and o.strip()]
    if not MIN_OPTIONS <= len(opts) <= MAX_OPTIONS:
        errors.append(f"Javob variantlari {MIN_OPTIONS}–{MAX_OPTIONS} ta bo‘lishi kerak")
    elif len({o.lower() for o in opts}) != len(opts):
        errors.append("Javob variantlari takrorlanmasligi kerak")
    if not 0 <= q.answer_index < len(opts):
        errors.append("To‘g‘ri javob ko‘rsatilmagan")
    if q.difficulty not in LEVELS:
        errors.append("Daraja L1–L5 bo‘lishi kerak")
    return errors


def clean(q: QuestionData) -> QuestionData:
    opts = [o.strip() for o in q.options if o and o.strip()]
    return QuestionData(text=q.text.strip(), options=opts, answer_index=q.answer_index,
                        explanation=(q.explanation or "").strip() or None, difficulty=q.difficulty, skill_code=q.skill_code)


# ---------- CSV import ----------
CSV_HEADER = ["skill_code", "savol", "A", "B", "C", "D", "togri_javob", "izoh", "daraja"]


@dataclass
class ImportResult:
    rows: List[QuestionData] = field(default_factory=list)
    errors: List[Dict] = field(default_factory=list)  # {"line": n, "errors": [...]}


def parse_csv(text: str) -> ImportResult:
    """Rows: skill_code, savol, A..D (E, F optional), togri_javob (letter), izoh, daraja.
    The delimiter (comma or semicolon — Excel in uz/ru locales saves with ';') is detected."""
    out = ImportResult()
    sample = text[:4096]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")), delimiter=delimiter)
    headers = {h.strip().lower(): h for h in (reader.fieldnames or [])}
    if "skill_code" not in headers or "savol" not in headers:
        out.errors.append({"line": 1, "errors": [f"Sarlavha qatori kerak: {delimiter.join(CSV_HEADER)}"]})
        return out
    for n, raw in enumerate(reader, start=2):
        row = {k.strip().lower(): (v or "").strip() for k, v in raw.items() if k}
        if not any(row.values()):
            continue
        options = [row.get(letter.lower(), "") for letter in LETTERS]
        while options and not options[-1]:
            options.pop()
        letter = row.get("togri_javob", "").upper()[:1]
        q = QuestionData(text=row.get("savol", ""), options=options, answer_index=LETTERS.find(letter) if letter else -1,
                         explanation=row.get("izoh") or None, difficulty=(row.get("daraja") or "L2").upper(),
                         skill_code=row.get("skill_code", "").upper())
        errors = validate(q) if any(options) else ["Javob variantlari yo‘q"]
        if not q.skill_code:
            errors.append("skill_code yo‘q")
        if errors:
            out.errors.append({"line": n, "errors": errors})
        else:
            out.rows.append(clean(q))
    return out


# ---------- Random draw for an attempt ----------
def draw(questions: Sequence[Tuple[str, str, List[str], int]], rng: random.Random, k: int = KNOW_DRAW) -> List[Dict]:
    """Pick up to k questions and shuffle each one's options, remapping the correct answer.
    Input rows: (id, text, options, answer_index). Output carries answer_index (kept server-side)."""
    picked = rng.sample(list(questions), min(k, len(questions)))
    out = []
    for qid, text, options, answer in picked:
        order = list(range(len(options)))
        rng.shuffle(order)
        out.append({"id": qid, "text": text, "options": [options[i] for i in order], "answer_index": order.index(answer)})
    return out
