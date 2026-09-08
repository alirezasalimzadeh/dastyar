#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL تنظیم نشده است." >&2
  echo "نمونه: DATABASE_URL='postgresql://...' npm run backup:postgres" >&2
  exit 1
fi

mkdir -p backups
file="backups/dastyar-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "$file"
echo "پشتیبان ساخته شد: $file"
