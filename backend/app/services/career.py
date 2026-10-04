"""Career DNA: job-profile match, gap priorities and 30/60/90 plan (section 10)."""
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List, Optional

from pydantic import BaseModel

from app.services import llm


@dataclass
class Requirement:
    skill_code: str
    importance: float  # r_i
    min_score: float  # t_i
    must: bool = False


@dataclass
class SkillState:
    score: float  # S_i
    confidence: float  # C_i
    name: str = ""


@dataclass
class MatchResult:
    match_pct: Optional[float]  # None when a must-have skill is missing (hard filter)
    gaps: List[Dict] = field(default_factory=list)
    strengths: List[Dict] = field(default_factory=list)
    missing_must: List[str] = field(default_factory=list)


def parse_requirements(raw: Dict) -> List[Requirement]:
    """Accepts {code: {importance|weight, min_score, must}} as stored in career_profiles/employer_criteria."""
    reqs = []
    for code, spec in (raw or {}).items():
        reqs.append(Requirement(
            skill_code=code,
            importance=float(spec.get("importance", spec.get("weight", 1.0))),
            min_score=float(spec.get("min_score", 70)),
            must=bool(spec.get("must", False)),
        ))
    return reqs


def adjusted(s: SkillState) -> float:
    """E_i = S_i * (0.8 + 0.2 * C_i / 100)."""
    return s.score * (0.8 + 0.2 * s.confidence / 100)


def match(requirements: List[Requirement], skills: Dict[str, SkillState]) -> MatchResult:
    """Match = 100 * sum(r_i * min(1, E_i / t_i)) / sum(r_i); Gap_i = max(0, t_i - E_i); priority = r_i * Gap_i."""
    if not requirements:
        return MatchResult(match_pct=None)
    missing_must = [r.skill_code for r in requirements if r.must and (r.skill_code not in skills or skills[r.skill_code].score <= 0)]
    num = den = 0.0
    gaps, strengths = [], []
    for r in requirements:
        st = skills.get(r.skill_code, SkillState(0.0, 0.0))
        e = adjusted(st)
        num += r.importance * min(1.0, e / r.min_score if r.min_score else 1.0)
        den += r.importance
        gap = max(0.0, r.min_score - e)
        row = {"skill": r.skill_code, "name": st.name or r.skill_code, "current": round(e, 1), "needed": r.min_score,
               "score": round(st.score, 1), "confidence": round(st.confidence, 1), "importance": r.importance,
               "must": r.must}
        if gap > 0:
            gaps.append({**row, "gap": round(gap, 1), "priority": round(r.importance * gap, 2)})
        else:
            strengths.append(row)
    gaps.sort(key=lambda g: -g["priority"])
    strengths.sort(key=lambda s: -s["importance"])
    pct = None if missing_must else round(100 * num / den, 1)
    return MatchResult(match_pct=pct, gaps=gaps, strengths=strengths, missing_must=missing_must)


def explanation(result: MatchResult) -> Dict:
    """The "nima uchun mos?" block: strongest evidence-backed skills and main gaps."""
    return {
        "strongest": [f"{s['name']}: {s['current']} (talab {s['needed']:g})" for s in result.strengths[:3]],
        "main_gaps": [f"{g['name']}: {g['current']} / {g['needed']:g} (−{g['gap']})" for g in result.gaps[:3]],
        "missing_must": result.missing_must,
    }


LAYER_ACTIONS = {
    "KNOW": "nazariy testni (KNOW) topshiring",
    "DO": "amaliy topshiriqni (DO) bajaring",
    "ADAPT": "random challenge (ADAPT) yeching",
    "DEFEND": "AI Viva’da yechimingizni himoya qiling (DEFEND)",
    "PROVE": "real loyiha yoki repo bilan dalil qo‘shing (PROVE)",
}


def plan_30_60_90(gaps: List[Dict], layers_by_skill: Dict[str, Dict[str, Optional[float]]], start: Optional[date] = None) -> List[Dict]:
    """Orders the top gaps into 30/60/90-day phases; each step targets the weakest or missing layer."""
    start = start or date.today()
    phases = []
    for i, label in enumerate(("30 kun", "60 kun", "90 kun")):
        if i >= len(gaps):
            break
        g = gaps[i]
        layers = layers_by_skill.get(g["skill"], {})
        missing = [l for l in ("KNOW", "DO", "ADAPT", "DEFEND", "PROVE") if layers.get(l) is None]
        target = missing[0] if missing else min((l for l in layers if layers[l] is not None), key=lambda l: layers[l], default="DO")
        phases.append({
            "phase": label,
            "skill": g["skill"],
            "title": f"{g['name']}: {LAYER_ACTIONS[target]}",
            "target_layer": target,
            "gap": g["gap"],
            "reassess_on": (start + timedelta(days=30 * (i + 1))).isoformat(),
            "status": "current" if i == 0 else "upcoming",
        })
    return phases


class CoachReply(BaseModel):
    reply: str
    recommended_action: str


async def coach_reply(message: str, role_name: str, result: MatchResult, plan: List[Dict]) -> Dict:
    """AI Career Coach gives recommendations only; it never assigns scores (section 10.3)."""
    context = {
        "target_role": role_name,
        "match_pct": str(result.match_pct),
        "gaps": "; ".join(f"{g['name']} {g['current']}/{g['needed']}" for g in result.gaps[:5]) or "yo‘q",
        "plan": "; ".join(f"{p['phase']}: {p['title']}" for p in plan) or "yo‘q",
        "student_message": message,
    }
    try:
        out = await llm.structured(
            system=(
                "Siz SKILL DNA AI Career Coach’siz. Faqat talabaning dalillarga asoslangan bo‘shliqlari va 30/60/90 "
                "rejasi asosida o‘zbek tilida qisqa, aniq tavsiya berasiz. Ball yoki daraja va’da qilmaysiz."
            ),
            instruction="Talaba savoliga 3–6 gapda javob bering va bitta keyingi aniq harakatni tavsiya qiling.",
            data=context,
            schema=CoachReply,
            effort="low",
        )
        return {"reply": out.reply, "recommended_action": out.recommended_action, "source": llm.model_ref()}
    except llm.LLMUnavailable:
        top = result.gaps[0] if result.gaps else None
        if top:
            step = plan[0]["title"] if plan else f"{top['name']} bo‘yicha topshiriq bajaring"
            reply = (
                f"“{role_name}” uchun hozirgi mosligingiz {result.match_pct if result.match_pct is not None else '—'}%. "
                f"Eng katta ustuvor bo‘shliq: {top['name']} ({top['current']} / {top['needed']:g}). "
                f"Keyingi qadam: {step}. Rejadagi qayta baholash sanasigacha shu bo‘shliqqa e’tibor qarating."
            )
            action = step
        else:
            reply = f"“{role_name}” talablariga barcha ko‘nikmalar bo‘yicha javob beryapsiz. PROVE dalillarini ko‘paytirib, Confidence’ni oshiring."
            action = "PROVE: real loyiha qo‘shing"
        return {"reply": reply, "recommended_action": action, "source": "heuristic-v1"}
