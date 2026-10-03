#!/bin/bash
# ====================================================================
# SKILL DNA — Ubuntu 22.04 / 24.04 Subpath O'rnatish Skripti
# Domen: https://english.ultrasoft.uz/skilldna
# Stack: PostgreSQL + Python 3 FastAPI (Systemd) + Nginx Subpath
# ====================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}==================================================================${NC}"
echo -e "${GREEN}🚀 SKILL DNA platformasini VPS ga o'rnatish (Subpath: /skilldna)${NC}"
echo -e "${BLUE}==================================================================${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Iltimos, ushbu skriptni root yoki sudo bilan ishga tushiring!${NC}"
  echo "Misol: sudo bash setup_vps_native.sh"
  exit 1
fi

PROJECT_DIR="/var/www/skill-dna"
CURRENT_DIR=$(pwd)

# 1. Tizimni yangilash va kerakli paketlarni o'rnatish
echo -e "\n${BLUE}1/5. Tizim paketlari tekshirilmoqda...${NC}"
apt update -y
apt install -y curl git ufw nginx postgresql postgresql-contrib \
    python3 python3-pip python3-venv build-essential libpq-dev

if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo "Node.js 20 LTS o'rnatilmoqda..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo -e "${GREEN}✓ Node.js versiyasi: $(node -v)${NC}"
echo -e "${GREEN}✓ Python versiyasi: $(python3 --version)${NC}"

# 2. Loyiha papkasini sozlash
echo -e "\n${BLUE}2/5. Loyiha papkasi sozlanmoqda...${NC}"
mkdir -p "$PROJECT_DIR"
if [ "$CURRENT_DIR" != "$PROJECT_DIR" ]; then
    echo "Fayllar $PROJECT_DIR ga ko'chirilmoqda..."
    cp -r "$CURRENT_DIR"/* "$PROJECT_DIR"/
fi
cd "$PROJECT_DIR"

# 3. PostgreSQL ma'lumotlar bazasini sozlash
echo -e "\n${BLUE}3/5. PostgreSQL ma'lumotlar bazasi sozlanmoqda...${NC}"
systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'root123';" || true
sudo -u postgres psql -c "CREATE DATABASE skill_dna OWNER postgres;" 2>/dev/null || echo "Baza allaqachon mavjud."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE skill_dna TO postgres;" || true

# 4. Backend (Python FastAPI) ni sozlash
echo -e "\n${BLUE}4/5. Python virtual muhiti va backend kutubxonalari sozlanmoqda...${NC}"
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

# Baza sxemasini initsializatsiya qilish
echo "PostgreSQL jadvallari yaratilmoqda..."
python3 -c "
import asyncio
from app.db.init_db import init_database
asyncio.run(init_database())
" || echo "Baza allaqachon initsializatsiya qilingan."

# Systemd xizmatini yaratish (Backend port 8000 da ishlaydi)
cat << 'EOF' > /etc/systemd/system/skilldna-backend.service
[Unit]
Description=SKILL DNA FastAPI Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/skill-dna/backend
EnvironmentFile=/var/www/skill-dna/backend/.env
ExecStart=/var/www/skill-dna/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 4 --proxy-headers --forwarded-allow-ips='*'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable skilldna-backend
systemctl restart skilldna-backend
echo -e "${GREEN}✓ Backend xizmati muvaffaqiyatli ishga tushirildi (Port 8001 da faol)!${NC}"

# 5. Frontend (React 19 + Vite 8) ni yig'ish (Subpath /skilldna/ uchun)
echo -e "\n${BLUE}5/5. Frontend yig'ilmoqda (Base path: /skilldna/)...${NC}"
cd "$PROJECT_DIR"
npm install
npm run build
ln -sfn "$PROJECT_DIR/dist" "$PROJECT_DIR/skilldna"
chmod -R 755 "$PROJECT_DIR"
echo -e "${GREEN}✓ Frontend muvaffaqiyatli build qilindi!${NC}"

# 6. Nginx Snippet faylini yaratish
echo -e "\n${BLUE}Nginx subpath konfiguratsiyasi tayyorlanmoqda...${NC}"
mkdir -p /etc/nginx/snippets
cat << 'EOF' > /etc/nginx/snippets/skilldna-subpath.conf
# ==========================================
# SKILL DNA Subpath: /skilldna
# ==========================================

location /skilldna {
    root /var/www/skill-dna;
    index index.html;
    try_files $uri $uri/ /skilldna/index.html;
}

location ^~ /skilldna/api/ {
    proxy_pass http://127.0.0.1:8001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_connect_timeout 60s;
}

location ^~ /skilldna/docs {
    proxy_pass http://127.0.0.1:8001/docs;
    proxy_set_header Host $host;
}

location ^~ /skilldna/openapi.json {
    proxy_pass http://127.0.0.1:8001/api/v1/openapi.json;
    proxy_set_header Host $host;
}

location ^~ /skilldna/health {
    proxy_pass http://127.0.0.1:8001/health;
    proxy_set_header Host $host;
}
EOF

# Mavjud english.ultrasoft.uz Nginx faylini qidirish
NGINX_TARGET=$(grep -rl "english.ultrasoft.uz" /etc/nginx/ 2>/dev/null | grep -v "skilldna" | head -n 1 || true)

if [ -n "$NGINX_TARGET" ] && [ -f "$NGINX_TARGET" ]; then
    echo -e "${YELLOW}Topildi: $NGINX_TARGET${NC}"
    cp "$NGINX_TARGET" "${NGINX_TARGET}.skilldna.bak"
    # Tozalash va yagona to'g'ri include qo'shish
    sed -i '/skilldna-subpath.conf/d' "$NGINX_TARGET"
    sed -i '/server_name english.ultrasoft.uz;/a \    include /etc/nginx/snippets/skilldna-subpath.conf;' "$NGINX_TARGET"
    echo "Nginx konfiguratsiyasi tekshirilmoqda..."
    if nginx -t; then
        systemctl reload nginx
        echo -e "${GREEN}✓ english.ultrasoft.uz ga /skilldna muvaffaqiyatli ulandi va Nginx reload qilindi!${NC}"
    else
        echo -e "${RED}Xatolik yuz berdi, avvalgi konfiguratsiya tiklanmoqda...${NC}"
        cp "${NGINX_TARGET}.skilldna.bak" "$NGINX_TARGET"
        nginx -t && systemctl reload nginx
    fi

else
    echo -e "${YELLOW}ℹ️ english.ultrasoft.uz fayli avtomatik topilmadi.${NC}"
    echo -e "${YELLOW}Mavjud Nginx konfiguratsiyangizga quyidagi qatorni qo'shib qo'ying:${NC}"
    echo -e "${GREEN}    include /etc/nginx/snippets/skilldna-subpath.conf;${NC}"
fi

echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 TAYYOR! SKILL DNA ISHGA TUSHIRILDI!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "🌐 Platforma havolasi: ${BLUE}https://english.ultrasoft.uz/skilldna${NC}"
echo -e "📚 API Swagger Docs:   ${BLUE}https://english.ultrasoft.uz/skilldna/docs${NC}"
echo -e "🔍 Backend holati:     ${BLUE}systemctl status skilldna-backend${NC}"
echo -e "${GREEN}==================================================================${NC}"
