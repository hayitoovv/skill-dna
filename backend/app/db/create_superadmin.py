"""Create a super admin, or promote an existing account. The password is typed in, never stored in code.

Usage (on the server, inside backend/):
    .venv/bin/python -m app.db.create_superadmin --email admin@example.uz --name "Ism Familiya"
"""
import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models import User
from app.services import audit

MIN_LENGTH = 12


def ask_password() -> str:
    while True:
        first = getpass.getpass(f"Parol (kamida {MIN_LENGTH} belgi): ")
        if len(first) < MIN_LENGTH:
            print(f"Parol juda qisqa — kamida {MIN_LENGTH} belgi kerak.")
            continue
        if first.lower() in {"root123", "password", "admin123"} or first.isdigit():
            print("Bu parol juda oson. Boshqasini tanlang.")
            continue
        if getpass.getpass("Parolni takrorlang: ") != first:
            print("Parollar mos kelmadi, qaytadan kiriting.")
            continue
        return first


async def main(email: str, name: str, keep_password: bool) -> None:
    email = email.strip().lower()
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if user:
            print(f"Mavjud akkaunt topildi: {user.full_name} ({user.role}) — super admin qilinadi.")
            if not keep_password:
                user.hashed_password = get_password_hash(ask_password())
            user.role, user.status = "super_admin", "active"
        else:
            user = User(full_name=name or "Super Admin", email=email, hashed_password=get_password_hash(ask_password()),
                        role="super_admin", status="active")
            db.add(user)
        await db.flush()
        audit.record(db, actor_id=None, action="admin.superadmin_cli", entity="user", entity_id=user.id,
                     after={"email": email, "role": "super_admin"})
        await db.commit()
    print(f"Tayyor: {email} endi super admin. Kirgach, Xavfsizlik bo‘limida ikki bosqichli tasdiqni (2FA) yoqing.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SKILL DNA super admin yaratish")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="")
    parser.add_argument("--keep-password", action="store_true", help="mavjud akkaunt parolini o‘zgartirmaslik")
    args = parser.parse_args()
    if not sys.stdin.isatty():
        sys.exit("Bu buyruqni interaktiv terminalda ishga tushiring (parol so‘raladi).")
    asyncio.run(main(args.email, args.name, args.keep_password))
