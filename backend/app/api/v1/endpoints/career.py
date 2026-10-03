from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models import CareerProfile, Direction
from typing import List, Dict, Any

router = APIRouter()

class CoachChatRequest(BaseModel):
    message: str
    target_role: str = "Senior Python Backend Injinir"
    current_match_pct: float = 85.0

@router.get("/target")
async def get_career_target(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CareerProfile).limit(1))
    profile = res.scalars().first()

    return {
        "roleName": profile.role_name if profile else "Senior Python Backend Injinir",
        "description": profile.description if profile else "High-load REST API va taqsimlangan microservice arxitekturasi.",
        "matchPct": 85,
        "gaps": [
            {"skill": "DevOps va CI/CD", "current": 61, "needed": 70},
            {"skill": "Ma’lumotlar tuzilmasi", "current": 72, "needed": 75},
            {"skill": "SQL va DB indekslari", "current": 79, "needed": 80},
        ],
        "roadmap": [
            {"phase": "30 kun", "title": "Kesh xatoliklari va RabbitMQ integratsiyasi", "status": "done"},
            {"phase": "60 kun", "title": "Distributed Tracing va OpenTelemetry", "status": "current"},
            {"phase": "90 kun", "title": "Zero-downtime k8s deploy & load testing", "status": "upcoming"},
        ],
        "coachTip": "Avval DevOps va CI/CD ko‘nikmasidagi 9 ballik bo‘shliqni to‘ldiring — bu backend deployment ishonchliligini 2 barobar oshiradi."
    }

@router.post("/coach-chat")
async def chat_with_career_coach(payload: CoachChatRequest):
    """
    AI Career Coach interactive guidance based on Skill DNA gap analysis.
    """
    msg = payload.message.lower()
    
    if "qayerdan boshlay" in msg or "reja" in msg or "boshlash" in msg:
        reply = (
            "Hozirgi profilingiz tahliliga ko‘ra, sizda eng katta o‘sish nuqtasi — **DevOps va CI/CD** (61/100). "
            "Maqsadli Senior Backend roliga yetish uchun avval quyidagi 3 qadamni tavsiya qilaman:\n"
            "1. Dockerfile multi-stage build optimizatsiyasi;\n"
            "2. GitHub Actions orqali avtotestlarni pull-requestda avtomatlashtirish;\n"
            "3. NGINX reverse-proxy orqali SSL va yuklamani taqsimlash."
        )
    elif "viva" in msg or "himoya" in msg or "suhbat" in msg:
        reply = (
            "AI Viva suhbatida texnik savollarga javob berganda doim 'Nima uchun?' savoliga tayyor turing. "
            "Masalan: 'Nega PostgreSQLda B-Tree indeks tanladingiz?' deyilganda, uning logarifmik qidiruv tezligi "
            "va diapazonli (range query) so‘rovlardagi ustunligini ko‘rsating."
        )
    elif "maosh" in msg or "ish" in msg or "kompaniya" in msg:
        reply = (
            "Sizning hozirgi 85% mosligingiz va L3 darajangiz bilan IT Park rezident kompaniyalarida "
            "Middle Backend Injinir lavozimiga to‘liq mos kelasiz. L4 darajasiga chiqqaningizda (yana 9 ball), "
            "Senior rollar va xalqaro masofaviy vakansiyalar tavsiya etiladi."
        )
    else:
        reply = (
            f"Tushunarli! '{payload.target_role}' yo‘lida hozir 85% ko‘rsatkichdasiz. "
            "Keyingi qadam sifatida 'DevOps va CI/CD' bo‘yicha L3 amaliy topshirig‘ini yechib ko‘ring. "
            "Yana qanday savollaringiz bor?"
        )

    return {
        "reply": reply,
        "coach_avatar": "AI Career Coach",
        "recommended_action": "DO: Docker & CI/CD Pipeline challenge"
    }
