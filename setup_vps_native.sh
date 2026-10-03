#!/bin/bash
# ====================================================================
# SKILL DNA — Ubuntu 22.04 / 24.04 Klassik O'rnatish Skripti
# Stack: PostgreSQL + Python 3 FastAPI (Systemd) + Nginx + React 19
# ====================================================================

set -e

# Ranglar
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${GREEN}🚀 SKILL DNA platformasini Ubuntu VPS ga o'rnatish boshlanmoqda...${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Root huquqini tekshirish
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Iltimos, ushbu skriptni root yoki sudo bilan ishga tushiring!${NC}"
  echo "Misol: sudo bash setup_vps_native.sh"
  exit 1
fi

PROJECT_DIR="/var/www/skill-dna"
CURRENT_DIR=$(pwd)

# 1. Tizimni yangilash va kerakli paketlarni o'rnatish
echo -e "\n${BLUE}1/6. Tizim yangilanmoqda va zarur kutubxonalar o'rnatilmoqda...${NC}"
apt update -y
apt install -y curl git ufw nginx postgresql postgresql-contrib \
    python3 python3-pip python3-venv build-essential libpq-dev

# Node.js 20 LTS o'rnatish (agar o'rnatilmagan yoki eskirgan bo'lsa)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo "Node.js 20 LTS o'rnatilmoqda..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo -e "${GREEN}✓ Node.js versiyasi: $(node -v)${NC}"
echo -e "${GREEN}✓ Python versiyasi: $(python3 --version)${NC}"

# 2. Loyiha papkasini /var/www/skill-dna ga ko'chirish / joylash
echo -e "\n${BLUE}2/6. Loyiha fayllari sozlanmoqda...${NC}"
mkdir -p "$PROJECT_DIR"
if [ "$CURRENT_DIR" != "$PROJECT_DIR" ]; then
    echo "Fayllar $PROJECT_DIR ga nusxalanmoqda..."
    cp -r "$CURRENT_DIR"/* "$PROJECT_DIR"/
fi
cd "$PROJECT_DIR"

# 3. PostgreSQL ma'lumotlar bazasini sozlash
echo -e "\n${BLUE}3/6. PostgreSQL ma'lumotlar bazasi sozlanmoqda...${NC}"
systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'root123';" || true
sudo -u postgres psql -c "CREATE DATABASE skill_dna OWNER postgres;" 2>/dev/null || echo "Baza allaqachon mavjud."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE skill_dna TO postgres;" || true

# 4. Backend (Python FastAPI) ni sozlash
echo -e "\n${BLUE}4/6. Python virtual muhiti va backend kutubxonalari o'rnatilmoqda...${NC}"
cd "$PROJECT_DIR/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# .env faylini yaratish
cat << 'EOF' > "$PROJECT_DIR/backend/.env"
PROJECT_NAME="SKILL DNA — AI Talent Intelligence Platform"
API_V1_STR="/api/v1"
SECRET_KEY="skilldna-production-secure-token-vps-2026"
POSTGRES_SERVER="127.0.0.1"
POSTGRES_PORT=5432
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="root123"
POSTGRES_DB="skill_dna"
DATABASE_URL="postgresql+asyncpg://postgres:root123@127.0.0.1:5432/skill_dna"
SYNC_DATABASE_URL="postgresql://postgres:root123@127.0.0.1:5432/skill_dna"
EOF

# Baza sxemasini initsializatsiya qilish va boshlang'ich ma'lumotlarni yozish
echo "PostgreSQL jadvallari va dastlabki ma'lumotlar kiritilmoqda..."
python3 -c "
import asyncio
from app.db.init_db import init_database
asyncio.run(init_database())
" || echo "Baza allaqachon initsializatsiya qilingan."

# Systemd xizmatini yaratish (Backend avtomatik 24/7 ishlashi uchun)
cat << 'EOF' > /etc/systemd/system/skilldna-backend.service
[Unit]
Description=SKILL DNA FastAPI Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/skill-dna/backend
EnvironmentFile=/var/www/skill-dna/backend/.env
ExecStart=/var/www/skill-dna/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4 --proxy-headers --forwarded-allow-ips='*'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable skilldna-backend
systemctl restart skilldna-backend
echo -e "${GREEN}✓ Backend xizmati muvaffaqiyatli ishga tushirildi (Port 8000)!${NC}"

# 5. Frontend (React 19 + Vite 8) ni yig'ish (Build)
echo -e "\n${BLUE}5/6. Frontend komponentlari yig'ilmoqda (Build)...${NC}"
cd "$PROJECT_DIR"
npm install
npm run build
echo -e "${GREEN}✓ Frontend muvaffaqiyatli build qilindi (dist papkasi tayyor)!${NC}"

# 6. Nginx veb-serverini sozlash
echo -e "\n${BLUE}6/6. Nginx konfiguratsiyasi sozlanmoqda...${NC}"
cat << 'EOF' > /etc/nginx/sites-available/skilldna
server {
    listen 80;
    server_name _;

    root /var/www/skill-dna/dist;
    index index.html;

    # Gzip siqish
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    # Statik fayllar keshi
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # React SPA yo'naltirish (Sahifa yangilanganda 404 bermasligi uchun)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API so'rovlarni FastAPI backendiga yo'naltirish
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger Docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host $host;
    }
}
EOF

# Nginx saytini faollashtirish
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/skilldna /etc/nginx/sites-enabled/skilldna
nginx -t
systemctl restart nginx

# Firewall portlarini ochish
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 TABRIKLAYMIZ! SKILL DNA PLATFORMASI VPS DA ISHGA TUSHDI!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "🌐 Veb-saytga kirish: ${BLUE}http://${SERVER_IP}${NC}"
echo -e "📚 API Hujjatlari (Swagger): ${BLUE}http://${SERVER_IP}/docs${NC}"
echo -e "🔍 Backend holatini tekshirish: ${BLUE}systemctl status skilldna-backend${NC}"
echo -e "📜 Backend loglarini ko'rish: ${BLUE}journalctl -u skilldna-backend -f${NC}"
echo -e "${GREEN}==================================================================${NC}"
