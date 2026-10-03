#!/bin/bash
# ====================================================================
# SKILL DNA — Bir buyruq bilan loyihani yangilash (Git Update)
# ====================================================================

set -e

echo "=========================================================="
echo "🔄 GitHub dan yangi o'zgarishlar tortilmoqda..."
echo "=========================================================="
git pull origin main || git pull

echo -e "\n📦 1. Frontend kutubxonalari tekshirilmoqda va build qilinmoqda..."
npm install
npm run build

echo -e "\n🐍 2. Backend paketlari va bazasi yangilanmoqda..."
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python3 -c "
import asyncio
from app.db.init_db import init_database
asyncio.run(init_database())
" || true
deactivate
cd ..

echo -e "\n🚀 3. Backend va Nginx qayta ishga tushirilmoqda..."
sudo systemctl restart skilldna-backend
sudo systemctl reload nginx

echo "=========================================================="
echo "🎉 TIZIM YANGILANDI VA ISHLAMOQDA!"
echo "=========================================================="
