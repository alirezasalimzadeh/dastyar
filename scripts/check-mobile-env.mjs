import { existsSync, readFileSync } from 'node:fs';

const values = { ...process.env };
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((key) => !values[key]);
if (missing.length) {
  console.error(`\nخطا: برای ساخت نسخه اندروید ابتدا ${missing.join(' و ')} را در فایل .env تنظیم کنید.\n`);
  process.exit(1);
}
console.log('تنظیمات اتصال Supabase برای ساخت اندروید موجود است.');
