# خروجی اندروید و PWA دستیار

این پروژه دو روش نصب روی اندروید دارد و هر دو از همان کد وب استفاده می‌کنند.

## پیش‌نیاز اتصال

پیش از هر build نهایی، فایل `.env` باید شامل این دو مقدار باشد:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

کلید anon برای کلاینت Supabase طراحی شده است، اما فایل `.env` نباید در Git ثبت شود. اسکریپت ساخت اندروید در صورت نبودن این تنظیمات متوقف می‌شود تا APK بدون اتصال تولید نشود.

## ۱. PWA قابل نصب از Chrome

```bash
npm ci
npm run build
```

محتویات پوشه `dist/` را روی یک دامنه HTTPS منتشر کنید. سپس در Chrome اندروید:

1. سایت را باز کنید.
2. دکمه «نصب دستیار روی گوشی» را بزنید؛ یا از منوی Chrome گزینه **Install app / افزودن به صفحه اصلی** را انتخاب کنید.
3. آیکن «دستیار مشاور» مانند یک اپ مستقل در صفحه اصلی ظاهر می‌شود.

Service worker فقط در build نهایی و روی HTTPS (یا localhost) فعال می‌شود؛ باز کردن مستقیم `dist/index.html` با `file://` قابل نصب نیست.

## ۲. APK مستقل با Capacitor

### روش خط فرمان

پیش‌نیازها: Android Studio به‌روز یا JDK 21، Android SDK Platform 36 و تنظیم `ANDROID_HOME`.

```bash
npm ci
npm run android:apk
```

خروجی debug قابل نصب در این مسیر ساخته می‌شود:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### روش Android Studio

```bash
npm run android:open
```

پس از باز شدن پروژه و پایان Gradle Sync، از منوی **Build → Build App Bundle(s) or APK(s) → Build APK(s)** استفاده کنید.

برای انتشار عمومی در مارکت، به‌جای debug یک signing key امن بسازید و از **Build → Generate Signed App Bundle or APK** خروجی release امضاشده بگیرید. signing key و رمز آن نباید در Git ثبت شوند.

## نصب مستقیم APK

APK را به گوشی منتقل کنید، اجازه **Install unknown apps** را برای فایل‌منیجر یا مرورگر فعال کنید و فایل را باز کنید. شناسه بسته `ir.dastyar.crm` و نام اپ «دستیار مشاور» است؛ حداقل اندروید پشتیبانی‌شده API 24 (Android 7) است.
