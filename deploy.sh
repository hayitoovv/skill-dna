#!/bin/bash
# ====================================================================
# SKILL DNA — VPS Avtomatlashtirilgan O'rnatish Skripti (Ubuntu/Debian)
# ====================================================================

set -e

echo "=========================================================="
echo "🚀 SKILL DNA platformasini VPS ga o'rnatish boshlanmoqda..."
echo "=========================================================="

# 1. Tizim paketlarini yangilash
echo "📦 Tizim paketlari yangilanmoqda..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git ufw

# 2. Docker va Docker Compose mavjudligini tekshirish / o'rnatish
if ! command -v docker &> /dev/null; then
    echo "🐳 Docker o'rnatilmoqda..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "✅ Docker muvaffaqiyatli o'rnatildi!"
else
    echo "✅ Docker tizimda mavjud."
fi

# 3. Fayllar ruxsatini sozlash
chmod +x backend/entrypoint.sh || true

# 4. .env faylini tekshirish
if [ ! -f .env ]; then
    echo "⚙️ .env fayli yaratilmoqda..."
    cp .env.production.example .env
fi

# 5. Xavfsizlik devori (UFW)
echo "🛡️ Portlar ochilmoqda (80, 443, 22)..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

# 6. Docker containerlarni qurish va ishga tushirish
echo "🏗️ Loyiha konteynerlari yig'ilmoqda va ishga tushirilmoqda..."
sudo docker compose down || true
sudo docker compose build --no-cache
sudo docker compose up -d

echo "=========================================================="
echo "🎉 TABRIKLAYMIZ! Loyiha muvaffaqiyatli ishga tushirildi!"
echo "=========================================================="
echo "🌐 Veb-sayt: http://$(curl -s ifconfig.me)"
echo "📚 API Hujjatlari: http://$(curl -s ifconfig.me)/docs"
echo "🔍 Holatni tekshirish: sudo docker compose ps"
echo "📜 Loglarni ko'rish: sudo docker compose logs -f"
echo "=========================================================="
