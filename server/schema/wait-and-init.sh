#!/bin/sh
# =============================================================================
# دستیار مشاور — اجرای یک‌باره: صبر تا ساخت auth.users توسط GoTrue، سپس:
#   ۱) تعیین رمز نقش dastyar (کاربر اتصال PostgREST)
#   ۲) نصب تریگر ثبت‌نام (پروفایل + ۱۶ تگ پیش‌فرض برای هر حساب جدید)
# =============================================================================
set -e

i=0
while [ "$i" -lt 60 ]; do
  if psql -h db -U supabase_admin -d postgres -tc "SELECT 1 FROM pg_tables WHERE schemaname='auth' AND tablename='users'" | grep -q 1; then
    # :'' در psql مقدار متغیر را به‌درستی برای SQL escape می‌کند (امن در برابر هر رمزی)
    psql -v ON_ERROR_STOP=1 -h db -U supabase_admin -d postgres \
      -v pw="$PGPASSWORD" \
      -c "ALTER ROLE dastyar PASSWORD :'pw'"
    psql -v ON_ERROR_STOP=1 -h db -U supabase_admin -d postgres -f /sql/0002_profile_trigger.sql
    echo "✅ تریگر ثبت‌نام نصب شد"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo '❌ auth.users پیدا نشد (GoTrue بالا نیامده است؟)' >&2
exit 1
