#!/bin/bash
# =============================================================================
# راه‌اندازی سرور (روی خودِ VPS) — فقط یک‌بار
#
#   1) روی VPS: git clone <repo> /opt/dastyar
#   2) cd /opt/dastyar/server
#   3) cp .env.example .env   (ویرایش: رمز دیتابیس + SITE_URL)
#   4) bash deploy.sh
#
# از این به بعد برای آپدیتِ سایت فقط scripts/deploy-vps.sh روی لپ‌تاپ کافی است.
# =============================================================================
set -e
cd "$(dirname "$0")"

# ۱) نصب Docker (اگر نیست)
if ! command -v docker >/dev/null 2>&1; then
  echo '→ Docker پیدا نشد؛ نصب می‌شود…'
  curl -fsSL https://get.docker.com | sh
  echo '✅ Docker نصب شد'
fi

# ۲) .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo '❌ اول server/.env را ویرایش کنید (POSTGRES_PASSWORD + SITE_URL) و دوباره اجرا کنید.'
  exit 1
fi
if grep -q 'YOUR_VPS_IP_OR_DOMAIN' .env; then
  echo '❌ SITE_URL در .env هنوز پر نشده است.'
  exit 1
fi
if grep -q 'ChangeMe-Strong' .env; then
  echo '❌ POSTGRES_PASSWORD پیش‌فرض را عوض کنید.'
  exit 1
fi

# ۳) کلیدهای JWT
bash make-keys.sh

# ۴) پوشهٔ سایت (اگر خالی است یک پیام ساده بگذارد)
mkdir -p www
if [ ! -f www/index.html ]; then
  cat > www/index.html <<'HTML'
<!doctype html>
<html dir="rtl" lang="fa"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>دستیار مشاور</title></head>
<body style="font-family:sans-serif;text-align:center;padding:4rem">
<h1>🔧 سرور آماده است</h1>
<p>هنوز نسخهٔ سایت آپلود نشده — روی لپ‌تاپ <code>scripts/deploy-vps.sh</code> را اجرا کنید.</p>
</body></html>
HTML
fi

# ۵) استارت
echo '→ داکرکامپوز بالا می‌آید…'
docker compose up -d --build
sleep 8
docker compose ps
echo
echo '✅ کامل شد! سایت: http://' "$(grep '^SITE_URL=' .env | cut -d= -f2)"
echo 'اگر صفحهٔ «سرور آماده است» آمد، نسخهٔ سایت را با scripts/deploy-vps.sh آپلود کنید.'
