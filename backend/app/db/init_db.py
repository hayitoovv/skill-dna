import asyncio
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models import (
    Organization, User, StudentProfile, Consent, UserRole,
    Direction, Skill, Rubric, Task, CareerProfile, SkillScore, Evidence
)

async def init_database():
    print("Creating all database tables in PostgreSQL (skill_dna)...")
    async with engine.begin() as conn:
        # Create all tables defined in models
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully!")

    async with AsyncSessionLocal() as session:
        # Check if already seeded
        res = await session.execute(select(Direction))
        if res.scalars().first():
            print("Database already seeded with initial directions and data.")
            return

        print("Seeding initial data...")

        # 1. Organizations
        tatu = Organization(
            name="Toshkent Axborot Texnologiyalari Universiteti (TATU)",
            type="university",
            settings={"country": "Uzbekistan", "city": "Tashkent"}
        )
        it_park = Organization(
            name="IT Park Uzbekistan Partner Companies",
            type="company",
            settings={"industry": "Information Technology"}
        )
        session.add_all([tatu, it_park])
        await session.flush()

        # 2. Pilot Directions
        dir_software = Direction(
            code="software",
            name="Dasturiy injiniring",
            description="Zamonaviy taqsimlangan tizimlar, microservices, REST/gRPC API va bulutli arxitekturalar.",
            version="2.0"
        )
        dir_computer = Direction(
            code="computer",
            name="Kompyuter injiniringi",
            description="O‘rnatilgan tizimlar (embedded), apparat vositalari, Linux tizim yadrosi va IoT tarmoqlari.",
            version="2.0"
        )
        dir_ai = Direction(
            code="ai",
            name="Sun’iy intellekt",
            description="Mashinali o‘rganish, Deep Learning neyrotarmoqlari, LLM prompt injiniringi va MLOps.",
            version="2.0"
        )
        session.add_all([dir_software, dir_computer, dir_ai])
        await session.flush()

        # 3. Skills for Dasturiy Injiniring
        sk_backend = Skill(
            direction_id=dir_software.id,
            code="SE-BACKEND",
            name="Backend va REST API",
            type="core",
            framework_refs={"SFIA": "PROG 4", "ESCO": "backend developer"}
        )
        sk_sql = Skill(
            direction_id=dir_software.id,
            code="SE-SQL",
            name="SQL va ma’lumotlar bazasi",
            type="core",
            framework_refs={"SFIA": "DBDS 3"}
        )
        sk_ds = Skill(
            direction_id=dir_software.id,
            code="SE-ALGO",
            name="Ma’lumotlar tuzilmasi va algoritmlar",
            type="core",
            framework_refs={"SFIA": "SWDN 3"}
        )
        sk_oop = Skill(
            direction_id=dir_software.id,
            code="SE-OOP",
            name="OOP va dizayn pattern’lari",
            type="sub",
            framework_refs={"SFIA": "SWDN 4"}
        )
        sk_devops = Skill(
            direction_id=dir_software.id,
            code="SE-DEVOPS",
            name="DevOps va CI/CD",
            type="cross",
            framework_refs={"SFIA": "RELM 3"}
        )

        session.add_all([sk_backend, sk_sql, sk_ds, sk_oop, sk_devops])
        await session.flush()

        # 4. Rubrics for Backend skill
        rubrics = [
            Rubric(
                skill_id=sk_backend.id,
                level=1,
                level_name="L1 UNDERSTAND",
                criteria={"description": "HTTP metodlari, status kodlari va resurs yo‘llarini farqlay oladi."}
            ),
            Rubric(
                skill_id=sk_backend.id,
                level=2,
                level_name="L2 APPLY",
                criteria={"description": "CRUD amallarini bajara oladi, kirish parametrlarini validatsiya qiladi."}
            ),
            Rubric(
                skill_id=sk_backend.id,
                level=3,
                level_name="L3 ANALYZE",
                criteria={"description": "Pagination, JWT autentifikatsiya va xatoliklarni xavfsiz boshqaradi."}
            ),
            Rubric(
                skill_id=sk_backend.id,
                level=4,
                level_name="L4 CREATE",
                criteria={"description": "Rate limiting, Redis keshlash, async workerlar va to‘liq avtotestlar yozadi."}
            ),
            Rubric(
                skill_id=sk_backend.id,
                level=5,
                level_name="L5 MASTER",
                criteria={"description": "High-load arxitektura, idempotency, event-driven integratsiya va zero-downtime deploy."}
            ),
        ]
        session.add_all(rubrics)

        # 5. Realistic Assessment Tasks
        tasks = [
            Task(
                skill_id=sk_backend.id,
                layer="DO",
                title="Rate Limiter & Secure Token Middleware",
                type="code",
                difficulty="L3",
                ai_mode="AI-assisted",
                duration_minutes=35,
                reward_points=15,
                spec={
                    "language": "python",
                    "description": "FastAPI yoki Flask ilovasida har bir mijoz IP manzili bo‘yicha daqiqasiga maksimal 60 ta so‘rov o‘tkazuvchi Token Bucket algoritmini yozing.",
                    "test_cases": [
                        {"name": "Normal traffic (under limit)", "expected": "200 OK"},
                        {"name": "Bursty traffic (over 60 req/min)", "expected": "429 Too Many Requests"},
                        {"name": "Header inspection (X-RateLimit-Remaining)", "expected": "Valid remaining count"},
                    ],
                    "initial_code": "def rate_limiter(request, client_ip: str) -> bool:\n    # Yechimingizni shu yerga yozing\n    pass\n"
                }
            ),
            Task(
                skill_id=sk_backend.id,
                layer="ADAPT",
                title="Parametrli Challenge: Kesh xatosi va Deadlock",
                type="challenge",
                difficulty="L3",
                ai_mode="AI-free",
                duration_minutes=25,
                reward_points=20,
                spec={
                    "description": "Tizimda birdaniga Redis kesh o‘chib qoldi va ma’lumotlar bazasida parallel tranzaksiyalar yuzaga keldi. Kodni optimallashtiring.",
                }
            ),
            Task(
                skill_id=sk_backend.id,
                layer="DEFEND",
                title="AI Viva: Yechim arxitekturasi himoyasi",
                type="viva",
                difficulty="L3",
                ai_mode="AI-free",
                duration_minutes=15,
                reward_points=20,
                spec={
                    "questions": [
                        "Nima uchun Token Bucket algoritmini tanladingiz, Leaky Bucket emas?",
                        "Agar ilova 10 ta serverda klaster holida ishlasa, xotiradagi hisoblagich qanday muammo keltiradi?",
                        "So‘rov rad etilganda Retry-After sarlavhasi nima uchun muhim?"
                    ]
                }
            ),
            Task(
                skill_id=sk_backend.id,
                layer="KNOW",
                title="Nazariy test: REST API & HTTP/2 Konsepsiyalari",
                type="test",
                difficulty="L2",
                ai_mode="AI-free",
                duration_minutes=15,
                reward_points=10,
                spec={
                    "questions_count": 10,
                    "passing_score": 75
                }
            ),
            Task(
                skill_id=sk_backend.id,
                layer="PROVE",
                title="Real loyiha: GitHub API & Mikroservis reposi",
                type="project",
                difficulty="L4",
                ai_mode="AI-assisted",
                duration_minutes=120,
                reward_points=25,
                spec={
                    "type": "github_repo",
                    "requirements": ["Docker compose", "CI GitHub Action", "Test coverage > 80%"]
                }
            )
        ]
        session.add_all(tasks)

        # 6. Default Users
        pwd_hash = get_password_hash("root123")
        student = User(
            org_id=tatu.id,
            full_name="Shoxrux Mirzayev",
            email="shoxrux@edu.uz",
            phone="+998901234567",
            hashed_password=pwd_hash,
            role=UserRole.STUDENT.value,
            locale="uz"
        )
        teacher = User(
            org_id=tatu.id,
            full_name="Akmal Rahimov",
            email="rahimov@edu.uz",
            hashed_password=pwd_hash,
            role=UserRole.TEACHER.value,
            locale="uz"
        )
        uni_admin = User(
            org_id=tatu.id,
            full_name="TATU Administratsiyasi",
            email="admin@tatu.uz",
            hashed_password=pwd_hash,
            role=UserRole.UNIVERSITY.value,
            locale="uz"
        )
        employer = User(
            org_id=it_park.id,
            full_name="EPAM / IT Park Talent Recruiter",
            email="recruiter@itpark.uz",
            hashed_password=pwd_hash,
            role=UserRole.EMPLOYER.value,
            locale="uz"
        )
        moderator = User(
            org_id=None,
            full_name="AI Integrity Moderator",
            email="moderator@skilldna.uz",
            hashed_password=pwd_hash,
            role=UserRole.MODERATOR.value,
            locale="uz"
        )
        session.add_all([student, teacher, uni_admin, employer, moderator])
        await session.flush()

        # 7. Student Profile & Initial Evidence
        st_profile = StudentProfile(
            user_id=student.id,
            direction_id=dir_software.id,
            course="3-kurs",
            group_id="941-21 DI",
            cohort="2023-2027"
        )
        session.add(st_profile)

        # Student consents
        consents = [
            Consent(user_id=student.id, type="viva_record", granted_at=datetime.now(timezone.utc)),
            Consent(user_id=student.id, type="employer_share", granted_at=datetime.now(timezone.utc)),
            Consent(user_id=student.id, type="data_processing", granted_at=datetime.now(timezone.utc)),
        ]
        session.add_all(consents)

        # Skill score for student (matching the UI: 83 score, 81% confidence, Level L3)
        score_record = SkillScore(
            user_id=student.id,
            skill_id=sk_backend.id,
            score=83.0,
            confidence=81.0,
            level="L3",
            components={
                "KNOW": 88.0,
                "DO": 85.0,
                "ADAPT": 78.0,
                "DEFEND": 82.0,
                "PROVE": 80.0
            },
            computed_at=datetime.now(timezone.utc),
            formula_version="2.0"
        )
        session.add(score_record)

        # Career Profile
        career_backend = CareerProfile(
            direction_id=dir_software.id,
            role_name="Senior Python Backend Injinir",
            description="High-load REST API, PostgreSQL, Redis va taqsimlangan microservice arxitekturasi bo‘yicha mutaxassis.",
            requirements={
                "SE-BACKEND": {"weight": 0.35, "min_score": 85},
                "SE-SQL": {"weight": 0.25, "min_score": 80},
                "SE-ALGO": {"weight": 0.20, "min_score": 75},
                "SE-DEVOPS": {"weight": 0.20, "min_score": 70},
            },
            development_roadmap=[
                {"phase": "30 kun", "title": "Kesh xatoliklari va RabbitMQ integratsiyasi", "status": "done"},
                {"phase": "60 kun", "title": "Distributed Tracing va OpenTelemetry", "status": "in_progress"},
                {"phase": "90 kun", "title": "Zero-downtime k8s deploy & load testing", "status": "upcoming"},
            ]
        )
        session.add(career_backend)

        await session.commit()
        print("Database seeded with sample users, directions, skills, tasks, and scores!")

if __name__ == "__main__":
    asyncio.run(init_database())
