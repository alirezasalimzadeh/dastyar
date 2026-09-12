#!/bin/bash
# =============================================================================
# تولید کلیدهای JWT (JWT_SECRET + ANON_KEY) و ذخیره در server/.env
# فقط یک‌بار (هنگام راه‌اندازی اولیه) — اگر دوباره اجرا شود کلیدها عوض می‌شوند
# و همهٔ حساب‌های واردشده باید دوباره لاگین کنند.
# =============================================================================
set -e
cd "$(dirname "$0")"

command -v openssl >/dev/null || { echo 'openssl نصب نیست' >&2; exit 1; }

if [ -f .env ] && grep -q '^JWT_SECRET=' .env; then
  echo '⚠️  .env قبلاً کلید دارد. برای تازگی حذف کنید: sed -i "/^JWT_SECRET=/d;/^ANON_KEY=/d" .env'
  exit 1
fi

[ -f .env ] || cp .env.example .env

SECRET=$(openssl rand -hex 32)

# ساخت توکن JWT ساده (HS256) — همان فرمت کلیدهای Supabase
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
H=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
NOW=$(date +%s)
EXP=$(( NOW + 60*60*24*365*10 ))

make_token() {
  local enc_payload
  enc_payload=$(printf '%s' "$1" | b64url)
  local p="$H.$enc_payload"
  local sig
  sig=$(printf '%s' "$p" | openssl dgst -sha256 -hmac "$SECRET" -binary | b64url)
  echo "$p.$sig"
}

ANON=$(make_token "$(printf '{"role":"anon","iss":"supabase","iat":%d,"exp":%d}' "$NOW" "$EXP")")
SERVICE=$(make_token "$(printf '{"role":"service_role","iss":"supabase","iat":%d,"exp":%d}' "$NOW" "$EXP")")

# به .env اضافه کن
sed -i "/^JWT_SECRET=/d" .env
sed -i "/^ANON_KEY=/d" .env
sed -i "/^SERVICE_ROLE_KEY=/d" .env
{
  echo "JWT_SECRET=${SECRET}"
  echo "ANON_KEY=${ANON}"
  echo "SERVICE_ROLE_KEY=${SERVICE}"
} >> .env

echo "✅ کلیدها در server/.env ذخیره شد:"
echo "   JWT_SECRET = ${SECRET:0:12}… (فقط خودتان ببینید، به کسی ندهید)"
echo "   ANON_KEY   = ${ANON:0:30}…"
echo
echo "آدرس VITE برای ساختِ فرانت روی لپ‌تاپ (در .env.production):"
echo "   VITE_SUPABASE_URL=http://$(grep '^SITE_URL=' .env | cut -d= -f2)"
echo "   VITE_SUPABASE_ANON_KEY=${ANON}"
