# 🚀 SKILL DNA — VPS Serverga Joylashtirish (Deployment Guide)

Ushbu qo‘llanma **SKILL DNA — AI Talent Intelligence Platform** loyihasini har qanday Linux VPS (Ubuntu, Debian, AlmaLinux) serveriga to‘liq ko‘chirish va 24/7 rejimida uzluksiz ishga tushirish uchun tayyorlangan.

---

## 1-USUL: Docker & Docker Compose orqali (Eng oson, tavsiya etiladi ⭐)

Docker orqali butun tizim (PostgreSQL bazasi, Python FastAPI backend va Nginx + React frontend) avtomatik tarzda, hech qanday versiya ziddiyatlarisiz 1 ta buyruq bilan ishga tushadi.

### 1-qadam: VPS ga SSH orqali ulanish
O‘z kompyuteringizdagi terminal (PowerShell yoki Git Bash) orqali serveringizga ulaning:
```bash
ssh root@SERVER_IP_MANZILI
```

### 2-qadam: Loyiha kodini VPS ga yuklash
Loyihani Git orqali klonlang (yoki SCP / FileZilla orqali serverga tashlang):
```bash
git clone https://github.com/SIZNING_PROFILINGIZ/AI-Talent-Intelligence-Platform.git
cd AI-Talent-Intelligence-Platform
```

*(Agar fayllarni to‘g‘ridan-to‘g‘ri o‘z kompyuteringizdan yubormoqchi bo‘lsangiz:)*
```bash
# Windows PowerShell-dan turib (loyiha papkasida):
scp -r * root@SERVER_IP_MANZILI:/var/www/skill-dna/
```

### 3-qadam: Avtomatik o‘rnatish skriptini ishga tushirish
Loyiha ichiga kiring va tayyor skriptni ishga tushiring:
```bash
chmod +x deploy.sh
./deploy.sh
```

**Bu skript nimalarni avtomatik bajaradi:**
1. Linux paketlarini yangilaydi;
2. Docker va Docker Compose plaginlarini o‘rnatadi;
3. 80 (HTTP), 443 (HTTPS) va 22 (SSH) portlarini xavfsiz ochadi;
4. PostgreSQL 16 ma'lumotlar bazasini ko‘taradi;
5. FastAPI backend-ni tayyorlaydi va jadvallarni avtomatik yaratadi (seeding);
6. React frontend-ni build qilib, Nginx orqali 80-portga ulaydi.

### 4-qadam: Natijani tekshirish
Brauzeringizda server IP manzilini oching:
- **Asosiy sayt:** `http://SERVER_IP_MANZILI`
- **Swagger API:** `http://SERVER_IP_MANZILI/docs`

---

## 2-USUL: Qo‘lda (Manual) o‘rnatish (Nginx + Systemd + PostgreSQL)

Agar serveringizda Docker ishlatmasdan, to‘g‘ridan-to‘g‘ri Linux xizmatlari sifatida ishlatmoqchi bo‘lsangiz:

### 1. Zarur vositalarni o‘rnatish:
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv postgresql postgresql-contrib nginx nodejs npm
```

### 2. PostgreSQL bazasini sozlash:
```bash
sudo -u postgres psql
```
PostgreSQL ichida:
```sql
CREATE DATABASE skill_dna;
CREATE USER postgres WITH PASSWORD 'root123';
GRANT ALL PRIVILEGES ON DATABASE skill_dna TO postgres;
\q
```

### 3. Backend-ni sozlash (Python FastAPI):
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Bazani initsializatsiya qilish:
python3 -c "import asyncio; from app.db.init_db import init_database; asyncio.run(init_database())"
```

Backend uchun Systemd xizmatini yaratish (`/etc/systemd/system/skilldna.service`):
```ini
[Unit]
Description=Skill DNA FastAPI Application
After=network.target postgresql.service

[Service]
User=root
WorkingDirectory=/var/www/skill-dna/backend
ExecStart=/var/www/skill-dna/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```
Xizmatni ishga tushirish:
```bash
sudo systemctl daemon-reload
sudo systemctl enable skilldna
sudo systemctl start skilldna
```

### 4. Frontend-ni build qilish:
```bash
cd /var/www/skill-dna
npm install
npm run build
# dist/ papkasi tayyor bo'ladi
```

### 5. Nginx konfiguratsiyasi:
`/etc/nginx/sites-available/skilldna`:
```nginx
server {
    listen 80;
    server_name SERVER_IP_YOKI_DOMAIN;

    root /var/www/skill-dna/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }
}
```
Aktivlashtirish:
```bash
sudo ln -s /etc/nginx/sites-available/skilldna /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 3. Bepul SSL (HTTPS) ulash (Ixtiyoriy, domen bo‘lsa)
Agar domeningiz bo‘lsa (masalan: `skilldna.uz`), Let's Encrypt orqali 1 daqiqada bepul SSL sertifikat o‘rnating:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sizning-domeningiz.uz
```

---

## Foydali buyruqlar (Docker rejimida):
- **Konteynerlar holati:** `sudo docker compose ps`
- **Loglarni jonli ko‘rish:** `sudo docker compose logs -f`
- **Qayta ishga tushirish:** `sudo docker compose restart`
- **To‘xtatish:** `sudo docker compose down`
