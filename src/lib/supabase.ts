// ---------------------------------------------------------------------------
// اتصال به سرور خودِ شما (VPS) — ببینید: server/ و راهنمای-اجرا-روی-گوشی.md
// سرور = PostgreSQL + PostgREST + GoTrue (همان API که supabase-js می‌فهمد)
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'http://localhost';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'anon';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('[dastyar] VITE_SUPABASE_URL تنظیم نشده — فایل .env.production را ببینید');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});