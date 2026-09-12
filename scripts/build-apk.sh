#!/bin/bash
# =============================================================================
# دستیار مشاور — ساخت APK اندروید با یک دستور (روی لپ‌تاپ)
#
# پیش‌نیاز: «راه‌اندازی یک‌باره» بخش ۶ راهنمای-اجرا-روی-گوشی.md را انجام داده باشید
# (نصب Java 17 + ابزارهای اندروید). بعد از آن فقط همین اسکریپت کافی است:
#
#   git pull && bash scripts/build-apk.sh
#
# خروجی: android/app/build/outputs/apk/debug/app-debug.apk
# =============================================================================
set -e
cd "$(dirname "$0")/.."

# ۱) چک Java
if ! command -v javac >/dev/null 2>&1; then
  echo "❌ جاوا نصب نیست."
  echo "   اول «راه‌اندازی یک‌باره» بخش ۶ راهنما را انجام دهید (یا: sudo apt install -y openjdk-17-jdk)"
  exit 1
fi

# ۲) چک ابزارهای اندروید
if [ -z "$ANDROID_HOME" ] && [ -d "$HOME/android-sdk" ]; then
  export ANDROID_HOME="$HOME/android-sdk"
fi
if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "❌ ANDROID_HOME تنظیم نیست."
  echo "   اول «راه‌اندازی یک‌باره» بخش ۶ راهنما را انجام دهید."
  exit 1
fi

echo "→ نصب وابستگی‌های پروژه…"
npm ci

echo "→ ساخت نسخهٔ وب…"
npm run build

echo "→ به‌روزرسانی پروژهٔ اندروید…"
if [ ! -d android ]; then
  npx cap add android
fi
npx cap sync android

echo "→ ساخت APK (بار اول چند دقیقه طول می‌کشد)…"
cd android
./gradlew assembleDebug --no-daemon

APK=$(find app/build/outputs/apk/debug -name "*.apk" | head -1)
if [ -z "$APK" ]; then
  echo "❌ APK پیدا نشد — خروجی بالا را بخوانید."
  exit 1
fi

echo
echo "✅ APK آماده است:"
echo "   $(pwd)/$APK"
echo
echo "این فایل را به گوشی بفرستید (کابل، یا تلگرام/واتساپ «به خودتان») و روی آن بزنید تا نصب شود."
