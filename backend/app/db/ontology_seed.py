"""Competency ontology seed — architecture document v2.0, sections 9 (skills, rubrics) and 10.1 (job profiles).

Idempotent: skills/profiles are upserted by code/name, tasks by title. Expected values for DO
tests are computed here by running trusted reference solutions, never typed by hand.
Run: python -m app.db.ontology_seed
"""
import asyncio
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models import CareerProfile, Direction, Rubric, Skill, Task

DIRECTIONS = {
    "computer": ("Kompyuter injiniringi", "Tarmoqlar, operatsion tizimlar, embedded va kompyuter arxitekturasi"),
    "software": ("Dasturiy injiniring", "Algoritmlar, backend, ma’lumotlar bazasi va dasturiy ta’minot muhandisligi"),
    "ai": ("Sun’iy intellekt", "Ma’lumot tahlili, mashinali o‘qitish va mas’uliyatli AI"),
    "general": ("Umumiy ko‘nikmalar", "Barcha yo‘nalishlar uchun umumiy (cross-cutting) ko‘nikmalar"),
}

# (code, name, subskills, DO sample, viva sample, pilot★, SFIA)
SKILLS: Dict[str, List[tuple]] = {
    "computer": [
        ("CE-NET", "Kompyuter tarmoqlari", "IP/subnet, routing, VLAN, DNS/DHCP", "Ko‘p bo‘limli tarmoq dizayni va konfiguratsiyasi", "Nega aynan shu routing usuli?", True, "NTDS"),
        ("CE-OS", "Operatsion tizimlar va Linux", "Jarayonlar, xotira, fayl tizimi, bash", "Linux serverni sozlash va avtomatlashtirish skripti", "Jarayon bloklansa nima bo‘ladi?", True, "ITOP"),
        ("CE-EMB", "Embedded / mikrokontroller", "GPIO, interrupt, protokollar (I2C/SPI/UART)", "Sensor o‘qish va boshqarish dasturi", "Interrupt va polling farqi, qachon qaysi biri?", True, None),
        ("CE-ARCH", "Kompyuter arxitekturasi", "CPU, kesh, xotira iyerarxiyasi, instruksiyalar", "Oddiy ISA yoki konveyer tahlili masalasi", "Kesh nega ishlashni tezlashtiradi?", True, None),
        ("CE-DIGI", "Raqamli mantiq", "Kombinatsion/ketma-ket sxemalar", "Sxema loyihalash va tekshirish", "Holat mashinasini qanday minimallashtirdingiz?", False, None),
        ("CE-LOWC", "C / past darajali dasturlash", "Ko‘rsatkichlar, xotira boshqaruvi", "Xotira xavfsiz modul yozish", "Bu yerda xotira oqishi qayerda?", False, "PROG"),
        ("CE-NETSEC", "Tarmoq xavfsizligi asoslari", "Firewall, TLS, autentifikatsiya", "Xavfsizlik siyosati va qoidalar", "Qaysi hujum turiga qarshi bu qoida?", False, "SCTY"),
        ("CE-HWDIAG", "Apparat diagnostikasi", "Nosozlikni lokalizatsiya qilish", "Nosozlik stsenariysini tahlil qilish", "Qanday ketma-ketlikda tekshirdingiz?", False, None),
        ("CE-IOT", "IoT", "Sensor→gateway→bulut, MQTT", "Sodda IoT oqimini loyihalash", "Qurilma uzilsa tizim nima qiladi?", False, None),
        ("CE-VIRT", "Virtualizatsiya va konteynerlar", "VM, Docker asoslari", "Konteynerlashtirilgan xizmat", "Konteyner va VM farqi amalda?", False, "ITOP"),
    ],
    "software": [
        ("SE-ALGO", "Ma’lumotlar tuzilmasi va algoritmlar", "Massiv, daraxt, graf, murakkablik", "Muammoga mos struktura tanlash va amalga oshirish", "Nega aynan shu struktura?", True, "PROG"),
        ("SE-OOP", "OOP va dizayn pattern’lari", "SOLID, kompozitsiya, pattern’lar", "Mavjud kodni refaktoring qilish", "Bu pattern qachon zarar?", True, "PROG"),
        ("SE-BACKEND", "Backend va REST API", "Resurs dizayni, autentifikatsiya, xatolar", "Testlangan REST API", "Idempotentlik nega muhim?", True, "PROG"),
        ("SE-SQL", "SQL va ma’lumotlar bazasi", "Normalizatsiya, indeks, tranzaksiya", "Sxema va optimallashtirilgan so‘rovlar", "Bu indeks nega tezlashtirdi?", True, "DBDS"),
        ("SE-FRONT", "Frontend", "Komponentlar, holat boshqaruvi, kirish imkoniyati", "Qayta ishlatiladigan UI modul", "Holatni nega shu yerda saqladingiz?", False, "PROG"),
        ("SE-GIT", "Git va jamoaviy ishlash", "Branch, PR, merge to‘qnashuvlari", "PR va kod review sharhlari", "Konflikt qanday yechildi?", False, None),
        ("SE-QA", "Testlash va QA", "Unit/integratsiya, mock, qamrov", "Mavjud modul uchun test to‘plami", "Bu test nimani aniqlamaydi?", False, "TEST"),
        ("SE-SYSDES", "System design", "Masshtablash, kesh, navbat", "Kichik tizim arxitekturasi", "Yuklama 10 baravar oshsa?", False, "ARCH"),
        ("SE-DEVOPS", "DevOps / CI-CD", "Pipeline, konteyner, monitoring", "CI pipeline sozlash", "Rollback strategiyasi?", False, "RELM"),
        ("SE-DEBUG", "Debugging", "Log, profilerlash, ildiz sababni topish", "Ichiga xato kiritilgan loyihani tuzatish", "Xatoni qanday lokalizatsiya qildingiz?", False, "PROG"),
    ],
    "ai": [
        ("AI-PYMATH", "Python va matematika asoslari", "Chiziqli algebra, ehtimollik, NumPy/pandas", "Ma’lumot bilan ishlash va hisoblash", "Bu formula nimani anglatadi?", True, None),
        ("AI-EDA", "Ma’lumot tahlili (EDA) va tayyorlash", "Tozalash, xususiyatlar, vizualizatsiya", "Datasetni tahlil qilish va hisobot", "Etishmayotgan qiymatlar bilan nima qildingiz?", True, None),
        ("AI-ML", "Klassik ML", "Regressiya, daraxtlar, validatsiya", "Model o‘qitish va solishtirish", "Overfitting’ni qanday aniqladingiz?", True, "MLNG"),
        ("AI-EVAL", "Model baholash", "Metrikalar, cross-validation, xatolar tahlili", "Metrika tanlash va asoslash", "Nega aynan shu metrika?", True, "MLNG"),
        ("AI-DL", "Deep learning", "Neyron tarmoqlar, optimizatsiya", "Kichik tarmoqni o‘qitish", "Gradient yo‘qolishi nima?", False, "MLNG"),
        ("AI-NLP", "NLP va LLM (RAG)", "Embedding, retrieval, prompt dizayni", "Sodda RAG tizimi", "Retrieval xatosini qanday aniqladingiz?", False, "MLNG"),
        ("AI-CV", "Computer vision", "CNN, augmentatsiya", "Tasniflash modeli", "Augmentatsiya nimaga yordam berdi?", False, "MLNG"),
        ("AI-MLOPS", "MLOps", "Versiyalash, deploy, monitoring", "Modelni xizmat sifatida chiqarish", "Model drift’ni qanday kuzatasiz?", False, "RELM"),
        ("AI-RESP", "Mas’uliyatli AI", "Xolislik, maxfiylik, izohlanuvchanlik", "Model xolisligini tekshirish", "Bu model kimga zarar berishi mumkin?", False, None),
        ("AI-FRAME", "Masalani qo‘yish", "Biznes masalani ML masalasiga aylantirish", "Muammoni formallashtirish hujjati", "ML bu yerda nega kerak (yoki kerak emas)?", False, None),
    ],
    "general": [
        ("GEN-PROBLEM", "Problem Solving", "Muammoni tahlil qilish, gipoteza, tekshirish", "Noaniq masalani bosqichlarga ajratish", "Qaysi gipotezani birinchi tekshirdingiz va nega?", False, None),
        ("GEN-COMM", "Communication", "Texnik tushuntirish, hujjatlash", "Yechimni texnik bo‘lmagan auditoriyaga tushuntirish", "Buni yangi jamoa a’zosiga qanday tushuntirasiz?", False, None),
        ("GEN-TEAM", "Teamwork", "Vazifa taqsimoti, review, kelishuv", "Jamoaviy loyihada hissa", "Kelishmovchilik qanday hal qilindi?", False, None),
        ("GEN-AIFLUENCY", "AI Fluency", "AI vositalarini samarali, tanqidiy va xavfsiz ishlatish", "AI-assisted topshiriqda natijani tekshirish", "AI taklifining qaysi qismini rad etdingiz va nega?", False, None),
    ],
}

# Section 9.4 rubric sample for Backend and REST API
BACKEND_RUBRIC = {
    1: ("L1 KNOW", "HTTP metodlari, status kodlari, REST prinsiplarini tushuntiradi"),
    2: ("L2 APPLY", "Berilgan spetsifikatsiya bo‘yicha ishlaydigan CRUD API yozadi, asosiy testlardan o‘tadi"),
    3: ("L3 ADAPT", "O‘zgargan talabga (yangi resurs, cheklov) API’ni xatosiz moslashtiradi, validatsiya va xato javoblarini to‘g‘ri boshqaradi"),
    4: ("L4 CREATE", "Noldan API loyihalaydi: autentifikatsiya, sahifalash, versiyalash, testlar; qarorlarini asoslab himoya qiladi"),
    5: ("L5 MASTER", "Murakkab (yuklama, xavfsizlik, migratsiya) muammolarni hal qiladi, boshqalarga tushuntira va kod reviewda yo‘naltira oladi"),
}


def generic_rubric(name: str, subskills: str, do_sample: str) -> Dict[int, tuple]:
    return {
        1: ("L1 KNOW", f"{subskills} bo‘yicha asosiy tushunchalarni to‘g‘ri tushuntiradi"),
        2: ("L2 APPLY", f"Berilgan spetsifikatsiya bo‘yicha “{do_sample}” turidagi topshiriqni bajaradi, asosiy tekshiruvlardan o‘tadi"),
        3: ("L3 ADAPT", f"O‘zgargan shart yoki cheklovga {name.lower()} yechimini xatosiz moslashtiradi, chekka holatlarni boshqaradi"),
        4: ("L4 CREATE", "Noldan yechim loyihalaydi, muqobillarni solishtiradi va qarorlarini viva’da asoslab himoya qiladi"),
        5: ("L5 MASTER", "Murakkab real muammolarni hal qiladi, boshqalarga tushuntira oladi va review’da yo‘naltiradi"),
    }


# Section 10.1 job profiles: skill code -> importance, minimum score, must-have
CAREERS = {
    "computer": [
        ("Network Engineer", "Korporativ tarmoqlarni loyihalash, sozlash va himoya qilish.",
         {"CE-NET": (3, 75, True), "CE-NETSEC": (2, 65, False), "CE-OS": (1, 60, False), "CE-VIRT": (1, 55, False)}),
        ("Embedded Engineer", "Mikrokontroller va qurilma dasturiy ta’minoti.",
         {"CE-EMB": (3, 75, True), "CE-LOWC": (2, 70, False), "CE-ARCH": (2, 65, False), "CE-DIGI": (1, 60, False)}),
        ("SysAdmin / DevOps", "Serverlar, konteynerlar va avtomatlashtirish.",
         {"CE-OS": (3, 75, True), "CE-VIRT": (2, 70, False), "CE-NET": (2, 65, False), "SE-DEVOPS": (1, 60, False)}),
        ("IoT Engineer", "Sensor → gateway → bulut tizimlari.",
         {"CE-IOT": (3, 70, True), "CE-EMB": (2, 70, False), "CE-NET": (1, 60, False), "CE-NETSEC": (1, 55, False)}),
    ],
    "software": [
        ("Backend Developer", "REST API, ma’lumotlar bazasi va server mantiqi.",
         {"SE-BACKEND": (3, 75, True), "SE-SQL": (2, 70, False), "SE-ALGO": (2, 65, False), "SE-QA": (1, 60, False), "SE-GIT": (1, 55, False)}),
        ("Frontend Developer", "Foydalanuvchi interfeyslari va holat boshqaruvi.",
         {"SE-FRONT": (3, 75, True), "SE-OOP": (1, 60, False), "SE-QA": (1, 60, False), "SE-GIT": (1, 55, False)}),
        ("Full-stack Developer", "Frontend va backendni birga olib boradi.",
         {"SE-BACKEND": (2, 70, True), "SE-FRONT": (2, 70, True), "SE-SQL": (2, 65, False), "SE-GIT": (1, 55, False)}),
        ("QA Engineer", "Testlash strategiyasi va avtomatlashtirish.",
         {"SE-QA": (3, 75, True), "SE-DEBUG": (2, 65, False), "SE-BACKEND": (1, 55, False), "SE-GIT": (1, 55, False)}),
        ("DevOps Engineer", "CI/CD, infratuzilma va monitoring.",
         {"SE-DEVOPS": (3, 75, True), "SE-SYSDES": (2, 65, False), "SE-GIT": (1, 60, False), "SE-DEBUG": (1, 55, False)}),
    ],
    "ai": [
        ("ML Engineer", "Modellarni o‘qitish, baholash va ishlab chiqarishga chiqarish.",
         {"AI-ML": (3, 75, True), "AI-EVAL": (2, 70, False), "AI-PYMATH": (2, 70, False), "AI-MLOPS": (1, 60, False)}),
        ("AI Engineer", "LLM va AI xizmatlarini mahsulotga integratsiya qilish.",
         {"AI-NLP": (3, 70, True), "AI-EVAL": (2, 65, False), "AI-RESP": (1, 60, False), "SE-BACKEND": (1, 60, False)}),
        ("Data Analyst", "Ma’lumot tahlili va hisobotlar.",
         {"AI-EDA": (3, 75, True), "AI-PYMATH": (2, 70, False), "AI-EVAL": (1, 60, False)}),
        ("NLP Engineer", "Matn bilan ishlovchi modellar va RAG tizimlari.",
         {"AI-NLP": (3, 75, True), "AI-DL": (2, 65, False), "AI-EVAL": (2, 65, False), "AI-PYMATH": (1, 60, False)}),
    ],
}

# KNOW question banks for pilot (★) skills: (text, options, correct index)
KNOW_BANK: Dict[str, List[tuple]] = {
    "CE-NET": [
        ("/26 prefiksli subnetda nechta foydalanish mumkin bo‘lgan host manzili bor?", ["62", "64", "30", "126"], 0),
        ("Bitta switch ichida trafikni mantiqiy ajratish uchun nima ishlatiladi?", ["VLAN", "NAT", "DNS", "ARP"], 0),
        ("DHCP protokolining asosiy vazifasi nima?", ["IP manzilni avtomatik berish", "Domen nomini IP ga aylantirish", "Paketlarni shifrlash", "Marshrutlarni almashish"], 0),
    ],
    "CE-OS": [
        ("Linuxda jarayonga SIGKILL yuborish buyrug‘i qaysi?", ["kill -9 PID", "kill -15 PID", "stop PID", "ps -9 PID"], 0),
        ("Virtual xotiraning asosiy afzalligi nima?", ["Har bir jarayonga alohida manzil maydoni beradi", "Diskni tezlashtiradi", "CPU chastotasini oshiradi", "Tarmoqni himoya qiladi"], 0),
        ("Deadlock uchun zarur shartlardan biri qaysi?", ["Aylanma kutish (circular wait)", "Cheksiz xotira", "Bitta jarayon", "Preemption mavjudligi"], 0),
    ],
    "CE-EMB": [
        ("Tashqi hodisaga darhol javob berish uchun polling o‘rniga odatda nima ishlatiladi?", ["Interrupt", "Busy loop", "sleep()", "Watchdog o‘chirish"], 0),
        ("I2C shinasida qurilmalar qanday farqlanadi?", ["Har bir qurilmaning manzili bilan", "Alohida chip select liniyasi bilan", "Faqat tezlik bilan", "UART porti bilan"], 0),
        ("Tugma signalidagi sakrashni (bounce) yo‘qotish usuli nima deyiladi?", ["Debouncing", "Multiplexing", "Aliasing", "Overclocking"], 0),
    ],
    "CE-ARCH": [
        ("Kesh nega tezlashtiradi?", ["Ma’lumotlarning vaqt va fazoviy lokalligi tufayli", "Diskni almashtirgani uchun", "Instruksiyalar sonini kamaytirgani uchun", "Tarmoqni tezlashtirgani uchun"], 0),
        ("Konveyerda (pipeline) data hazard nimadan kelib chiqadi?", ["Instruksiya oldingi instruksiya natijasiga bog‘liq bo‘lganda", "Xotira to‘lganda", "Kesh bo‘sh bo‘lganda", "CPU qizib ketganda"], 0),
        ("Xotira iyerarxiyasida eng tez daraja qaysi?", ["Registrlar", "L3 kesh", "RAM", "SSD"], 0),
    ],
    "SE-ALGO": [
        ("Saralangan massivda binary search murakkabligi qanday?", ["O(log n)", "O(n)", "O(n log n)", "O(1)"], 0),
        ("Eng qisqa yo‘lni og‘irliksiz grafda topish uchun qaysi algoritm mos?", ["BFS", "DFS", "Quick sort", "Binary search"], 0),
        ("Hash jadvalda o‘rtacha qidiruv murakkabligi qanday?", ["O(1)", "O(log n)", "O(n)", "O(n²)"], 0),
    ],
    "SE-OOP": [
        ("SOLID dagi “O” prinsipi nimani anglatadi?", ["Kengaytirishga ochiq, o‘zgartirishga yopiq", "Bitta obyekt — bitta klass", "Hamma narsa obyekt", "Faqat interfeyslardan foydalanish"], 0),
        ("Merosxo‘rlik o‘rniga kompozitsiyani tanlashning asosiy sababi?", ["Bog‘liqlikni kamaytirish va moslashuvchanlik", "Kodni uzaytirish", "Tezlikni kamaytirish", "Testlashni qiyinlashtirish"], 0),
        ("Obyekt yaratish mantiqini ajratib beruvchi pattern qaysi?", ["Factory", "Observer", "Adapter", "Decorator"], 0),
    ],
    "SE-BACKEND": [
        ("Qaysi HTTP metodi idempotent hisoblanadi?", ["PUT", "POST", "PATCH (har doim)", "CONNECT"], 0),
        ("Resurs yaratilganda qaysi status kodi qaytariladi?", ["201 Created", "200 OK", "204 No Content", "302 Found"], 0),
        ("So‘rov limitidan oshganda qaysi status kodi to‘g‘ri?", ["429 Too Many Requests", "403 Forbidden", "500 Internal Server Error", "404 Not Found"], 0),
    ],
    "SE-SQL": [
        ("Tranzaksiyaning ACID xususiyatlaridagi “I” nima?", ["Isolation", "Integrity", "Indexing", "Iteration"], 0),
        ("WHERE bo‘yicha tez-tez qidiriladigan ustunni tezlashtirish uchun nima qo‘shiladi?", ["Indeks", "Trigger", "View", "Sequence"], 0),
        ("Uchinchi normal shakl (3NF) nimani yo‘qotadi?", ["Tranzitiv bog‘liqlikni", "Barcha kalitlarni", "Indekslarni", "NULL qiymatlarni"], 0),
    ],
    "AI-PYMATH": [
        ("Ikki vektorning skalyar ko‘paytmasi nolga teng bo‘lsa, ular qanday?", ["Ortogonal", "Parallel", "Teng", "Birlik"], 0),
        ("Normal taqsimotda qiymatlarning taxminan 68% i qayerda yotadi?", ["O‘rtachadan ±1 standart og‘ish ichida", "±2 ichida", "±3 ichida", "Faqat o‘rtachada"], 0),
        ("NumPy da elementlar bo‘yicha ko‘paytirish operatori qaysi?", ["*", "@", "dot()", "**"], 0),
    ],
    "AI-EDA": [
        ("Chetga chiquvchi qiymatlar (outlier) ko‘p bo‘lsa, yetishmayotgan qiymatni to‘ldirish uchun nima barqarorroq?", ["Median", "O‘rtacha", "Maksimum", "Nol"], 0),
        ("Kategoriyali ustunni model uchun tayyorlashning keng tarqalgan usuli?", ["One-hot encoding", "Standartlashtirish", "Logarifmlash", "Saralash"], 0),
        ("Ikki sonli ustun orasidagi chiziqli bog‘liqlikni nima o‘lchaydi?", ["Korrelyatsiya koeffitsiyenti", "Moda", "Dispersiya", "Kvartil"], 0),
    ],
    "AI-ML": [
        ("Train aniqligi yuqori, test aniqligi past bo‘lsa, bu nima?", ["Overfitting", "Underfitting", "Normal holat", "Data leakage yo‘qligi"], 0),
        ("Model giperparametrlarini tanlashda qaysi to‘plamdan foydalaniladi?", ["Validation", "Test", "Faqat train", "Production"], 0),
        ("Qaror daraxtida overfittingni kamaytirish usuli?", ["Daraxt chuqurligini cheklash", "Chuqurlikni oshirish", "Ko‘proq xususiyat qo‘shish", "Learning rate ni oshirish"], 0),
    ],
    "AI-EVAL": [
        ("Nomutanosib datasetda accuracy nega chalg‘itadi?", ["Ko‘pchilik sinfni taxmin qilish ham yuqori accuracy beradi", "U har doim past bo‘ladi", "U faqat regressiyada ishlaydi", "U F1 ga teng"], 0),
        ("Recall formulasi qaysi?", ["TP / (TP + FN)", "TP / (TP + FP)", "(TP + TN) / N", "FP / (FP + TN)"], 0),
        ("Cross-validation nima uchun ishlatiladi?", ["Baholashning barqarorligini oshirish", "Modelni tezlashtirish", "Datasetni kattalashtirish", "Xususiyatlarni o‘chirish"], 0),
    ],
}

# DO tasks for pilot skills: description, initial code, trusted reference solution, test calls
DO_TASKS: Dict[str, Dict[str, Any]] = {
    "CE-NET": {
        "title": "Subnet kalkulyatori",
        "description": "`subnet_info(cidr: str) -> tuple` funksiyasini yozing: (tarmoq manzili, broadcast manzili, foydalanish mumkin bo‘lgan hostlar soni). /31 va /32 uchun hostlar soni 0 deb qaytarilsin.",
        "initial": "def subnet_info(cidr: str) -> tuple:\n    # (network, broadcast, usable_hosts)\n    pass\n",
        "reference": "import ipaddress\ndef subnet_info(cidr):\n    n = ipaddress.ip_network(cidr, strict=False)\n    hosts = n.num_addresses - 2 if n.prefixlen < 31 else 0\n    return (str(n.network_address), str(n.broadcast_address), hosts)\n",
        "calls": ["subnet_info('192.168.1.10/24')", "subnet_info('10.0.0.0/26')", "subnet_info('172.16.5.77/20')", "subnet_info('10.1.1.1/30')", "subnet_info('10.9.9.9/31')", "subnet_info('192.168.100.200/27')"],
    },
    "CE-OS": {
        "title": "Auth log tahlilchisi",
        "description": "`failed_logins(lines: list) -> dict` — 'Failed password for <user> from <ip>' qatorlari bo‘yicha har bir foydalanuvchi uchun muvaffaqiyatsiz urinishlar sonini qaytaring. 'invalid user <user>' ko‘rinishini ham hisobga oling.",
        "initial": "def failed_logins(lines: list) -> dict:\n    pass\n",
        "reference": "import re\ndef failed_logins(lines):\n    out = {}\n    for l in lines:\n        m = re.search(r'Failed password for (?:invalid user )?(\\S+) from', l)\n        if m:\n            out[m.group(1)] = out.get(m.group(1), 0) + 1\n    return out\n",
        "calls": [
            "failed_logins(['Failed password for root from 1.2.3.4 port 22', 'Accepted password for ali from 5.6.7.8', 'Failed password for root from 1.2.3.4 port 23'])",
            "failed_logins(['Failed password for invalid user admin from 9.9.9.9', 'Failed password for admin from 9.9.9.9'])",
            "failed_logins([])",
            "failed_logins(['session opened for user ali', 'Failed password for ali from 1.1.1.1', 'Failed password for vali from 2.2.2.2', 'Failed password for ali from 1.1.1.1'])",
        ],
    },
    "CE-EMB": {
        "title": "Tugma debounce simulyatsiyasi",
        "description": "`debounce(samples: list, stable: int) -> list` — 0/1 namunalar oqimida holat faqat yangi qiymat ketma-ket `stable` marta takrorlanganda o‘zgaradi. Boshlang‘ich holat 0. Har bir o‘zgarishda o‘sha namunaning indeksini qaytaring.",
        "initial": "def debounce(samples: list, stable: int) -> list:\n    pass\n",
        "reference": "def debounce(samples, stable):\n    state, run, cand, out = 0, 0, None, []\n    for i, s in enumerate(samples):\n        if s == state:\n            run, cand = 0, None\n            continue\n        if s == cand:\n            run += 1\n        else:\n            cand, run = s, 1\n        if run >= stable:\n            state, run, cand = s, 0, None\n            out.append(i)\n    return out\n",
        "calls": ["debounce([0,1,0,1,1,1,1,0,0,0], 3)", "debounce([1,1,1,1], 2)", "debounce([0,0,0], 1)", "debounce([1,0,1,1,0,0,0,1,1,1,1], 3)"],
    },
    "CE-ARCH": {
        "title": "Direct-mapped kesh simulyatori",
        "description": "`cache_hits(addresses: list, lines: int, block: int) -> int` — direct-mapped kesh (lines ta qator, block baytli blok) uchun murojaatlar ketma-ketligida nechta HIT bo‘lishini qaytaring. Kesh boshida bo‘sh.",
        "initial": "def cache_hits(addresses: list, lines: int, block: int) -> int:\n    pass\n",
        "reference": "def cache_hits(addresses, lines, block):\n    cache, hits = {}, 0\n    for a in addresses:\n        b = a // block\n        idx, tag = b % lines, b // lines\n        if cache.get(idx) == tag:\n            hits += 1\n        else:\n            cache[idx] = tag\n    return hits\n",
        "calls": ["cache_hits([0,4,8,0,4,8], 4, 4)", "cache_hits([0,64,0,64], 4, 16)", "cache_hits(list(range(0,64,4))*2, 4, 16)", "cache_hits([], 8, 8)", "cache_hits([1,2,3,17,1], 2, 16)"],
    },
    "SE-ALGO": {
        "title": "Eng ko‘p uchraydigan K ta element",
        "description": "`top_k(nums: list, k: int) -> list` — eng ko‘p uchraydigan k ta qiymatni chastota kamayishi, teng bo‘lsa qiymat o‘sishi tartibida qaytaring. Murakkablikni viva’da asoslaysiz.",
        "initial": "def top_k(nums: list, k: int) -> list:\n    pass\n",
        "reference": "from collections import Counter\ndef top_k(nums, k):\n    c = Counter(nums)\n    return [v for v, _ in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:k]]\n",
        "calls": ["top_k([1,1,1,2,2,3], 2)", "top_k([4,4,5,5,6], 2)", "top_k([], 3)", "top_k([7], 1)", "top_k([3,1,2,2,3,1,1], 3)", "top_k([10,9,9,8,8,8], 1)"],
    },
    "SE-OOP": {
        "title": "Ombor (Inventory) klassi",
        "description": "`Inventory` klassini yozing: `add(name, qty)` va `remove(name, qty)` zanjirlash uchun `self` qaytaradi; omborda yetarli bo‘lmasa `remove` hech narsani o‘zgartirmaydi. `count(name)` miqdorni, `items()` nomlarni alifbo tartibida (faqat miqdori > 0) qaytaradi.",
        "initial": "class Inventory:\n    def __init__(self):\n        pass\n",
        "reference": "class Inventory:\n    def __init__(self):\n        self._s = {}\n    def add(self, name, qty):\n        self._s[name] = self._s.get(name, 0) + qty\n        return self\n    def remove(self, name, qty):\n        if self._s.get(name, 0) >= qty:\n            self._s[name] -= qty\n        return self\n    def count(self, name):\n        return self._s.get(name, 0)\n    def items(self):\n        return sorted(k for k, v in self._s.items() if v > 0)\n",
        "calls": ["Inventory().add('olma', 3).add('olma', 2).count('olma')", "Inventory().add('nok', 1).remove('nok', 5).count('nok')", "Inventory().add('b', 1).add('a', 2).remove('b', 1).items()", "Inventory().count('yoq')", "Inventory().add('x', 2).remove('x', 2).items()"],
    },
    "SE-BACKEND": {
        "title": "API sahifalash (pagination) yordamchisi",
        "description": "`paginate(items: list, page: int, per_page: int) -> dict` — {'items', 'page', 'total_pages', 'has_next'} qaytaring. page 1 dan boshlanadi; page < 1 yoki per_page 1..100 oralig‘ida bo‘lmasa {'error': 'invalid_params'} qaytaring. Bo‘sh ro‘yxatda total_pages = 0.",
        "initial": "def paginate(items: list, page: int, per_page: int) -> dict:\n    pass\n",
        "reference": "def paginate(items, page, per_page):\n    if page < 1 or not (1 <= per_page <= 100):\n        return {'error': 'invalid_params'}\n    total = (len(items) + per_page - 1) // per_page\n    start = (page - 1) * per_page\n    return {'items': items[start:start + per_page], 'page': page, 'total_pages': total, 'has_next': page < total}\n",
        "calls": ["paginate(list(range(10)), 1, 3)", "paginate(list(range(10)), 4, 3)", "paginate([], 1, 10)", "paginate([1,2], 0, 10)", "paginate([1,2], 1, 101)", "paginate(list(range(5)), 9, 2)"],
    },
    "SE-SQL": {
        "title": "SQL: eng faol mijozlar",
        "description": "`QUERY` o‘zgaruvchisiga SQL yozing: har bir mijoz uchun (name, buyurtmalar soni, umumiy summa) — faqat 2 va undan ko‘p buyurtmasi borlar, summa kamayishi bo‘yicha. Jadval: customers(id, name), orders(id, customer_id, amount). `run(QUERY)` yordamchisi tayyor, uni o‘zgartirmang.",
        "initial": "import sqlite3\n\ndef run(sql):\n    db = sqlite3.connect(':memory:')\n    db.executescript('''\n        CREATE TABLE customers(id INTEGER PRIMARY KEY, name TEXT);\n        CREATE TABLE orders(id INTEGER PRIMARY KEY, customer_id INTEGER, amount INTEGER);\n        INSERT INTO customers VALUES (1,'Ali'),(2,'Vali'),(3,'Gani'),(4,'Sami');\n        INSERT INTO orders VALUES (1,1,100),(2,1,250),(3,2,80),(4,3,40),(5,3,60),(6,3,500),(7,4,999);\n    ''')\n    return [tuple(r) for r in db.execute(sql).fetchall()]\n\nQUERY = \"\"\"\n-- SQL ni shu yerga yozing\n\"\"\"\n",
        "reference": "import sqlite3\ndef run(sql):\n    db = sqlite3.connect(':memory:')\n    db.executescript('''\n        CREATE TABLE customers(id INTEGER PRIMARY KEY, name TEXT);\n        CREATE TABLE orders(id INTEGER PRIMARY KEY, customer_id INTEGER, amount INTEGER);\n        INSERT INTO customers VALUES (1,'Ali'),(2,'Vali'),(3,'Gani'),(4,'Sami');\n        INSERT INTO orders VALUES (1,1,100),(2,1,250),(3,2,80),(4,3,40),(5,3,60),(6,3,500),(7,4,999);\n    ''')\n    return [tuple(r) for r in db.execute(sql).fetchall()]\nQUERY = 'SELECT c.name, COUNT(o.id), SUM(o.amount) FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING COUNT(o.id) >= 2 ORDER BY SUM(o.amount) DESC'\n",
        "calls": ["run(QUERY)", "len(run(QUERY))", "run(QUERY)[0][0]"],
    },
    "AI-PYMATH": {
        "title": "Z-score normallashtirish",
        "description": "`zscore(values: list) -> list` — har bir qiymat uchun (x - o‘rtacha) / standart og‘ish (populyatsiya, ddof=0), 2 xonagacha yaxlitlab qaytaring. Standart og‘ish 0 bo‘lsa barcha natija 0.0.",
        "initial": "def zscore(values: list) -> list:\n    pass\n",
        "reference": "def zscore(values):\n    if not values:\n        return []\n    m = sum(values) / len(values)\n    sd = (sum((v - m) ** 2 for v in values) / len(values)) ** 0.5\n    return [0.0 if sd == 0 else round((v - m) / sd, 2) for v in values]\n",
        "calls": ["zscore([2, 4, 4, 4, 5, 5, 7, 9])", "zscore([5, 5, 5])", "zscore([])", "zscore([1, 2, 3])", "zscore([10, 0])"],
    },
    "AI-EDA": {
        "title": "Median bilan to‘ldirish",
        "description": "`fill_median(rows: list, col: str) -> list` — lug‘atlar ro‘yxatida `col` qiymati None bo‘lganlarini mavjud qiymatlar medianasi bilan to‘ldiring (asl ro‘yxatni o‘zgartirmang, yangisini qaytaring). Mavjud qiymat bo‘lmasa o‘zgarishsiz qaytaring.",
        "initial": "def fill_median(rows: list, col: str) -> list:\n    pass\n",
        "reference": "def fill_median(rows, col):\n    vals = sorted(r[col] for r in rows if r.get(col) is not None)\n    if not vals:\n        return [dict(r) for r in rows]\n    n = len(vals)\n    med = vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2\n    return [dict(r, **{col: med}) if r.get(col) is None else dict(r) for r in rows]\n",
        "calls": ["fill_median([{'a': 1}, {'a': None}, {'a': 3}], 'a')", "fill_median([{'a': None}, {'a': 4}, {'a': 1}, {'a': 10}, {'a': 2}], 'a')", "fill_median([{'a': None}], 'a')", "fill_median([], 'a')"],
    },
    "AI-ML": {
        "title": "k-NN klassifikatori",
        "description": "`knn(train: list, labels: list, point: tuple, k: int)` — Evklid masofasi bo‘yicha eng yaqin k ta qo‘shnining ko‘pchilik ovozini qaytaring; ovozlar teng bo‘lsa eng yaqin qo‘shnining yorlig‘i tanlanadi.",
        "initial": "def knn(train: list, labels: list, point: tuple, k: int):\n    pass\n",
        "reference": "from collections import Counter\ndef knn(train, labels, point, k):\n    d = sorted(((sum((a - b) ** 2 for a, b in zip(x, point)), i) for i, x in enumerate(train)))[:k]\n    votes = Counter(labels[i] for _, i in d)\n    top = max(votes.values())\n    for _, i in d:\n        if votes[labels[i]] == top:\n            return labels[i]\n",
        "calls": [
            "knn([(0,0),(1,1),(5,5),(6,6)], ['a','a','b','b'], (0.5,0.5), 3)",
            "knn([(0,0),(1,1),(5,5),(6,6)], ['a','a','b','b'], (5.5,5.5), 1)",
            "knn([(0,0),(2,2),(10,10),(11,11)], ['x','y','x','y'], (1,1), 2)",
            "knn([(1,2),(2,3),(3,4),(8,9)], ['p','p','q','q'], (7,8), 3)",
        ],
    },
    "AI-EVAL": {
        "title": "F1-score hisoblash",
        "description": "`f1(y_true: list, y_pred: list, positive=1) -> float` — F1-score ni 3 xonagacha yaxlitlab qaytaring; precision+recall = 0 bo‘lsa 0.0.",
        "initial": "def f1(y_true: list, y_pred: list, positive=1) -> float:\n    pass\n",
        "reference": "def f1(y_true, y_pred, positive=1):\n    tp = sum(1 for t, p in zip(y_true, y_pred) if t == positive and p == positive)\n    fp = sum(1 for t, p in zip(y_true, y_pred) if t != positive and p == positive)\n    fn = sum(1 for t, p in zip(y_true, y_pred) if t == positive and p != positive)\n    prec = tp / (tp + fp) if tp + fp else 0.0\n    rec = tp / (tp + fn) if tp + fn else 0.0\n    return round(2 * prec * rec / (prec + rec), 3) if prec + rec else 0.0\n",
        "calls": ["f1([1,0,1,1,0], [1,0,0,1,1])", "f1([0,0,0], [0,0,0])", "f1([1,1,1], [1,1,1])", "f1(['spam','ham','spam'], ['spam','spam','ham'], 'spam')", "f1([1,0,0,0,0,0,0,0,0,1], [0,0,0,0,0,0,0,0,0,0])"],
    },
}

ADAPT_TASKS = [
    ("CE-NET", "ADAPT: VLSM tarmoq rejasi", "subnet_plan", False),
    ("CE-NET", "ADAPT: Filial qo‘shildi — rejani qayta loyihalang", "subnet_plan", True),
    ("SE-BACKEND", "ADAPT: Buyurtma narxi biznes qoidalari", "business_rules", False),
    ("SE-BACKEND", "ADAPT: Yangi biznes talab — VIP chegirma", "business_rules", True),
    ("AI-EVAL", "ADAPT: Nomutanosib dataset metrikalari", "imbalanced_metrics", False),
    ("AI-EVAL", "ADAPT: Metrika talabi o‘zgardi", "imbalanced_metrics", True),
]


def build_tests(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Runs the trusted reference solution here to compute expected values for every test call."""
    ns: Dict[str, Any] = {}
    exec(compile(spec["reference"], "reference", "exec"), ns)
    tests = []
    for i, call in enumerate(spec["calls"]):
        tests.append({"name": f"test_{i + 1}", "call": call, "expected": repr(eval(call, ns)), "hidden": i >= 3})
    return tests


async def upsert_task(db: AsyncSession, skill: Skill, layer: str, title: str, **fields) -> None:
    task = (await db.execute(select(Task).where(Task.skill_id == skill.id, Task.title == title))).scalars().first()
    if task:
        for k, v in fields.items():
            setattr(task, k, v)
        task.layer = layer
    else:
        db.add(Task(skill_id=skill.id, layer=layer, title=title, **fields))


async def seed_ontology(db: AsyncSession) -> dict:
    stats = {"skills": 0, "rubrics": 0, "careers": 0, "tasks": 0}
    directions = {}
    for code, (name, desc) in DIRECTIONS.items():
        d = (await db.execute(select(Direction).where(Direction.code == code))).scalars().first()
        if not d:
            d = Direction(code=code, name=name, description=desc, version="2.0")
            db.add(d)
            await db.flush()
        else:
            d.name, d.description = name, desc
        directions[code] = d

    skills: Dict[str, Skill] = {}
    for dcode, rows in SKILLS.items():
        for code, name, subs, do_sample, viva, pilot, sfia in rows:
            refs = {"pilot": pilot, "subskills": subs, "do_sample": do_sample, "viva_sample": viva}
            if sfia:
                refs["SFIA"] = sfia
            sk = (await db.execute(select(Skill).where(Skill.code == code))).scalars().first()
            stype = "cross" if dcode == "general" else "core"
            if sk:
                sk.name, sk.type, sk.direction_id, sk.framework_refs = name, stype, directions[dcode].id, refs
            else:
                sk = Skill(direction_id=directions[dcode].id, code=code, name=name, type=stype, framework_refs=refs, version="1.0")
                db.add(sk)
                await db.flush()
            skills[code] = sk
            stats["skills"] += 1

            rubric = BACKEND_RUBRIC if code == "SE-BACKEND" else generic_rubric(name, subs, do_sample)
            existing = {r.level: r for r in (await db.execute(select(Rubric).where(Rubric.skill_id == sk.id))).scalars().all()}
            for level, (lname, text) in rubric.items():
                criteria = {"description": text}
                if level in existing:
                    existing[level].level_name, existing[level].criteria = lname, criteria
                else:
                    db.add(Rubric(skill_id=sk.id, level=level, level_name=lname, criteria=criteria, version="1.0"))
                stats["rubrics"] += 1

    for dcode, profiles in CAREERS.items():
        for role, desc, reqs in profiles:
            requirements = {c: {"importance": r, "min_score": t, "must": m} for c, (r, t, m) in reqs.items()}
            p = (await db.execute(select(CareerProfile).where(CareerProfile.role_name == role))).scalars().first()
            if p:
                p.direction_id, p.description, p.requirements = directions[dcode].id, desc, requirements
            else:
                db.add(CareerProfile(direction_id=directions[dcode].id, role_name=role, description=desc,
                                     requirements=requirements, development_roadmap=[]))
            stats["careers"] += 1

    # Retire the legacy job profile whose requirements predate the 10.1 profile list
    legacy = (await db.execute(select(CareerProfile).where(CareerProfile.role_name == "Senior Python Backend Injinir"))).scalars().first()
    if legacy:
        legacy.is_deleted = True

    # Retire legacy demo tasks that had no checkable content (no questions/tests/template)
    for t in (await db.execute(select(Task))).scalars().all():
        spec = t.spec or {}
        ungradable = (
            (t.layer == "KNOW" and not spec.get("questions"))
            or (t.layer == "DO" and not spec.get("tests"))
            or (t.layer == "ADAPT" and not spec.get("template"))
        )
        if ungradable:
            t.status = "archived"

    for code, questions in KNOW_BANK.items():
        sk = skills[code]
        await upsert_task(
            db, sk, "KNOW", f"KNOW: {sk.name} — nazariy test", type="test", ai_mode="AI-free", difficulty="L1",
            duration_minutes=10, reward_points=10, status="active",
            spec={"questions": [{"id": f"q{i + 1}", "text": q, "options": opts, "answer_index": ans}
                                for i, (q, opts, ans) in enumerate(questions)]},
        )
        stats["tasks"] += 1

    for code, spec in DO_TASKS.items():
        sk = skills[code]
        await upsert_task(
            db, sk, "DO", f"DO: {spec['title']}", type="code", ai_mode="AI-assisted", difficulty="L2",
            duration_minutes=30, reward_points=15, status="active",
            spec={"language": "python", "description": spec["description"], "initial_code": spec["initial"],
                  "tests": build_tests(spec)},
        )
        stats["tasks"] += 1

    for code, title, template, changed in ADAPT_TASKS:
        await upsert_task(
            db, skills[code], "ADAPT", title, type="challenge", ai_mode="AI-free", difficulty="L3",
            duration_minutes=25, reward_points=20, status="active", spec={"template": template, "changed": changed},
        )
        stats["tasks"] += 1

    for code, sk in skills.items():
        if (sk.framework_refs or {}).get("pilot"):
            await upsert_task(
                db, sk, "PROVE", f"PROVE: {sk.name} — real loyiha", type="project", ai_mode="AI-assisted", difficulty="L4",
                duration_minutes=0, reward_points=25, status="active",
                spec={"requirements": ["Ochiq repo havolasi va README", "Commit tarixi (o‘z hissangiz ko‘rinsin)",
                                       "Qisqa demo yoki himoya"], "verifier": "teacher"},
            )
            stats["tasks"] += 1
    return stats


async def main() -> None:
    async with AsyncSessionLocal() as db:
        stats = await seed_ontology(db)
        await db.commit()
    print("Ontology seeded:", stats)


if __name__ == "__main__":
    asyncio.run(main())
