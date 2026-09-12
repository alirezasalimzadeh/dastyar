#!/bin/bash
# =============================================================================
# دستیار مشاور — ساخت نسخهٔ سایت + آپلود به سرور
# (روی لپ‌تاپ اجرا می‌شود؛ سرور با server/deploy.sh راه‌اندازی شده باشد)
#
# تنظیم یک‌باره (در ترمینال، بعد از راه‌اندازی سرور):
#   export DEPLOY_HOST=آی‌پی-سرور
#   export DEPLOY_USER=root
#   export DEPLOY_DIR=/opt/dastyar/server/www
#   export VITE_SUPABASE_URL=http://آی‌پی-سرور
#   export VITE_SUPABASE_ANON_KEY=از-فایل-server/.env-سرور-سطر-ANON_KEY
#
# بعد از آن هر آپدیت با: bash scripts/deploy-vps.sh
# =============================================================================
set -e
cd "$(dirname "$0")/.."

: "${DEPLOY_HOST:?ابتدا export DEPLOY_HOST=آی‌پی-سرور کنید}"
: "${DEPLOY_USER:?ابتدا export DEPLOY_USER=نام-کاربر-سرور (مثلاً root) کنید}"
: "${DEPLOY_DIR:=/opt/dastyar/server/www}"
: "${VITE_SUPABASE_URL:?ابتدا export VITE_SUPABASE_URL=http://آی‌پی-سرور کنید}"
: "${VITE_SUPABASE_ANON_KEY:?ابتدا export VITE_SUPABASE_ANON_KEY=... کنید (از server/.env سرور)}"

echo "→ نصب وابستگی‌ها…"
npm ci

echo "→ ساخت نسخهٔ تولید (با آدرس سرور شما)…"
VITE_SUPABASE_URL="$VITE_SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" npm run build

echo "→ آپلود به $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_DIR"
ssh "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$DEPLOY_DIR'"
rsync -avz --delete --info=stats1 dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_DIR/"

echo "✅ سایت آپلود شد: $VITE_SUPABASE_URL"
