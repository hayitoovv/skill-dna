#!/bin/bash
# ====================================================================
# SKILL DNA — Bir buyruq bilan loyihani yangilash (Git Update)
# ====================================================================

set -e

echo "=========================================================="
echo "🔄 GitHub dan yangi o'zgarishlar tortilmoqda..."
echo "=========================================================="
# Git runs as the repository owner: a root-run pull leaves root-owned objects in .git
# and breaks later pulls by the normal user.
REPO_OWNER=$(stat -c %U .git)
as_owner() { if [ "$(id -un)" = "$REPO_OWNER" ]; then "$@"; else sudo -u "$REPO_OWNER" "$@"; fi; }
as_owner git pull --ff-only origin main
if command -v git-lfs &> /dev/null; then
    as_owner git lfs pull || true
fi

echo -e "\n📦 1. Frontend kutubxonalari tekshirilmoqda va build qilinmoqda..."
npm install
npm run build
cp -r public/* dist/ 2>/dev/null || true
ln -sfn dist skilldna
chmod -R 755 .

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
sudo systemctl restart skilldna-worker 2>/dev/null || true
sudo systemctl reload nginx

echo "=========================================================="
echo "🎉 TIZIM YANGILANDI VA ISHLAMOQDA!"
echo "=========================================================="
