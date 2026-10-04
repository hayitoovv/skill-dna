"""In-platform AI assistant for AI-assisted tasks (section 5.2).

guarded   — explains syntax and concepts, points at the next step, never hands over a solution.
unguarded — free help, like real work conditions.

Every request, and every suggestion the student accepts or rejects, is written to ai_usage_logs.
Those logs plus the viva feed the cross-cutting AI Fluency skill.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.services import llm

MAX_TURNS_PER_ATTEMPT = 30

GUARDED_SYSTEM = (
    "Siz SKILL DNA platformasidagi o‘quv AI yordamchisisiz (guarded rejim). Talabaga sintaksis, tushunchalar va "
    "keyingi qadamni topishda yordam berasiz, lekin topshiriqning tayyor yechimini, to‘liq funksiyani yoki 3 qatordan "
    "uzun kod bermaysiz. Savol bilan yo‘naltiring, xatoni topishga undang. Javoblar o‘zbek tilida, qisqa."
)
UNGUARDED_SYSTEM = (
    "Siz SKILL DNA platformasidagi AI yordamchisisiz (unguarded rejim, real ish sharoitiga o‘xshash). Erkin yordam "
    "berasiz, kod taklif qilishingiz mumkin. Har doim taklifni qanday tekshirish kerakligini ham ayting, chunki talaba "
    "keyin AI Viva’da uni tushuntirib beradi. Javoblar o‘zbek tilida, qisqa."
)


class AssistantReply(BaseModel):
    reply: str
    code_suggestion: Optional[str] = Field(default=None, description="Taklif etilgan kod (bo‘lsa)")


def mode_for(task_spec: Dict) -> str:
    return "unguarded" if (task_spec or {}).get("assistant_mode") == "unguarded" else "guarded"


_CODE_BLOCK = re.compile(r"```(?:\w+)?\n(.*?)```", re.S)


def _enforce_guard(reply: str, suggestion: Optional[str]) -> tuple:
    """Defence in depth for guarded mode: strip long code even if the model produced it."""
    if suggestion and suggestion.count("\n") >= 3:
        suggestion = None
        reply += "\n\n(Guarded rejim: to‘liq kod ko‘rsatilmaydi — yuqoridagi yo‘nalish bo‘yicha o‘zingiz yozib ko‘ring.)"
    reply = _CODE_BLOCK.sub(lambda m: m.group(0) if m.group(1).count("\n") < 3 else "[kod yashirildi — guarded rejim]", reply)
    return reply, suggestion


def _heuristic(mode: str, question: str, task_title: str, task_description: str) -> AssistantReply:
    """Deterministic fallback when no LLM is configured: general, honest guidance only."""
    q = question.lower()
    if any(k in q for k in ("xato", "error", "exception", "ishlamayapti", "traceback")):
        tip = ("Xato xabarini oxiridan o‘qing: qaysi qator va qaysi turdagi xato? Shu qatordagi o‘zgaruvchilarning "
               "qiymatini print() bilan tekshiring va kutgan qiymatingiz bilan solishtiring.")
    elif any(k in q for k in ("test", "chekka", "edge")):
        tip = ("Chekka holatlarni sanab chiqing: bo‘sh kiritma, bitta element, chegaraviy qiymatlar, noto‘g‘ri turdagi "
               "kiritma. Har biri uchun funksiya nima qaytarishi kerakligini avval yozib oling.")
    elif any(k in q for k in ("qanday boshla", "boshlash", "qayerdan")):
        tip = ("Masalani 3 bosqichga ajrating: (1) kiritma va chiqishni aniq yozing, (2) oddiy misolni qo‘lda yeching, "
               "(3) shu qadamlarni kodga o‘giring. Avval eng sodda ishlaydigan variantni yozing, keyin yaxshilang.")
    else:
        tip = (f"“{task_title}” talabini qayta o‘qing va har bir shartni alohida tekshiruv sifatida yozing. "
               "Qaysi shart hali bajarilmaganini aniqlang va o‘sha joydan davom eting.")
    note = " (LLM ulanmagan — umumiy maslahat berilmoqda.)"
    return AssistantReply(reply=tip + note, code_suggestion=None)


async def answer(mode: str, question: str, task_title: str, task_description: str, code: str,
                 history: List[Dict]) -> Dict:
    transcript = "\n".join(f"{h['role']}: {h['content']}" for h in history[-8:])
    try:
        out = await llm.structured(
            system=GUARDED_SYSTEM if mode == "guarded" else UNGUARDED_SYSTEM,
            instruction="Talabaning savoliga javob bering. Kod taklif qilsangiz, uni code_suggestion maydoniga yozing.",
            data={"task_title": task_title, "task_description": task_description, "student_code": code or "",
                  "conversation": transcript, "student_question": question},
            schema=AssistantReply,
            effort="low",
        )
        source = llm.model_ref()
    except llm.LLMUnavailable:
        out = _heuristic(mode, question, task_title, task_description)
        source = "heuristic-v1"
    reply, suggestion = out.reply, out.code_suggestion
    if mode == "guarded":
        reply, suggestion = _enforce_guard(reply, suggestion)
    return {"reply": reply, "code_suggestion": suggestion, "source": source,
            "suggestion_id": uuid.uuid4().hex[:12] if suggestion else None}


def log_entry(mode: str, question: str, result: Dict) -> Dict:
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "prompt": question[:1000],
        "reply_chars": len(result["reply"]),
        "suggestion_id": result["suggestion_id"],
        "suggestion_chars": len(result["code_suggestion"] or ""),
        "decision": None,  # accepted / rejected, set when the student acts on the suggestion
        "source": result["source"],
    }


def accepted_ratio(entries: List[Dict]) -> float:
    decided = [e for e in entries if e.get("suggestion_id") and e.get("decision")]
    if not decided:
        return 0.0
    return round(sum(1 for e in decided if e["decision"] == "accepted") / len(decided), 3)


def ai_fluency_score(test_score: Optional[float], viva_criteria: Dict[str, float]) -> Optional[float]:
    """AI Fluency from an AI-assisted attempt (section 5.2): framing/verification shown by the tests,
    plus explaining AI use, finding bugs and owning the solution in the viva."""
    parts = [viva_criteria.get(k) for k in ("ai_usage", "find_bug", "ownership") if viva_criteria.get(k) is not None]
    if not parts:
        return None
    viva = sum(parts) / len(parts)
    return round(0.4 * (test_score or 0.0) + 0.6 * viva, 1)
