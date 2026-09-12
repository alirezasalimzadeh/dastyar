import type { CapacitorConfig } from '@capacitor/cli';

// تنظیمات بسته‌بندی اندروید (APK) — راهنمای کامل: «راهنمای-اجرا-روی-گوشی.md»
const config: CapacitorConfig = {
  appId: 'ir.dastyar.mobile',
  appName: 'دستیار مشاور',
  webDir: 'dist',
  server: {
    // اپ داخل APK اجرا می‌شود (dist درون assets) — نه آدرس شبکه
    androidScheme: 'https',
  },
};

export default config;
