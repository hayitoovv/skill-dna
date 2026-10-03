from typing import List, Dict, Any

VIVA_PROMPTS_POOL = {
    "SE-BACKEND": [
        "Siz taklif qilgan Token Bucket yechimida xotira va hisoblash murakkabligi qanday baholanadi?",
        "Agar har bir IP uchun alohida ob’ekt yaratilsa, millionlab turli IP so‘rovlarida xotira to‘lib qolmasligi uchun qanday tozalash (eviction) mexanizmini qo‘llagan bo‘lardingiz?",
        "Distribyutiv (taqsimlangan) muhitda Redis cluster ishlatilganda, race condition xavfini qanday oldini olasiz (masalan, Lua script yoki distributed lock)?"
    ],
    "DEFAULT": [
        "Ushbu kodda eng zaif (bottleneck) bo‘lishi mumkin bo‘lgan nuqta qaysi?",
        "Kodingizga kutilmagan null yoki manfiy parametr kelsa, u qanday reaksiyaga kirishadi?",
        "Nima uchun ushbu arxitektura va dizayn patternini tanladingiz?"
    ]
}

def get_viva_initial_question(skill_code: str = "SE-BACKEND") -> str:
    pool = VIVA_PROMPTS_POOL.get(skill_code, VIVA_PROMPTS_POOL["DEFAULT"])
    return pool[0]

def evaluate_viva_turn(history: List[Dict[str, str]], student_answer: str) -> Dict[str, Any]:
    """
    Evaluates student defense response.
    Checks depth, technical terminology, rationale, and honesty.
    """
    length = len(student_answer.strip())
    # Deterministic heuristics for MVP evaluation
    keywords = ["redis", "xotira", "murakkablik", "lock", "algoritm", "kesh", "lua", "o(1)", "ttl", "thread", "async"]
    matched_keywords = [k for k in keywords if k in student_answer.lower()]

    if length < 25:
        score = 45.0
        feedback = "Javob juda qisqa va asoslanmagan. Iltimos, arxitekturaviy sabablarni tushuntirib bering."
        is_completed = False
        next_q = "Yechimingizdagi texnik qarorlarni batafsilroq asoslab bera olasizmi?"
    elif len(matched_keywords) >= 2 or length > 80:
        score = 88.0
        feedback = "Ajoyib! Texnik parametrlar va taqsimlangan tizim talablari to‘g‘ri tushunilgan."
        is_completed = len(history) >= 4  # 2 questions & 2 answers = complete
        next_q = "Oxirgi savol: Ushbu yechimni ishlab chiqarishga (production) chiqarishdan oldin qanday monitoring metrikalarini qo‘shgan bo‘lardingiz?"
    else:
        score = 72.0
        feedback = "Javob umumiy ma’noda to‘g‘ri, lekin kesh muddati va resurs xarajatlariga e’tibor qaratilmagan."
        is_completed = len(history) >= 4
        next_q = "Agar tizimga parallel 10,000 foydalanuvchi bir vaqtda kirsa, bu kod bardosh bera oladimi?"

    return {
        "score": score,
        "feedback": feedback,
        "next_question": next_q if not is_completed else None,
        "is_completed": is_completed
    }
