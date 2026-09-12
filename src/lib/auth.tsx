// ============================================================================
// هویت محلی — بدون ورود و بدون سرور (از نسخهٔ ۷۰ به بعد)
//
// یک «کاربر محلی» با شناسهٔ پایدار (UUID) روی همین دستگاه ساخته می‌شود و
// ردیف پروفایلش در جدول محلی profiles ذخیره می‌شود. شکل `useAuth` دقیقاً
// همان قبل است (user / profile / loading / signOut) تا هیچ بخشی از برنامه
// دست نخورده بماند.
// ============================================================================
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { ensureLocalSeed } from './localdb/seed';

// شکل ردیف جدول profiles — مثل supabase بدون schema، فیلدها آزادند
export interface Profile {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface SessionUser {
  id: string;
  email: string | null;
  created_at: string;
}

interface AuthContextType {
  user: SessionUser | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: () => {},
  refreshProfile: async () => {},
});

const USER_ID_KEY = 'dastyar.local.user.id';

/** شناسهٔ کاربر محلی (پایدار روی دستگاه) + اطمینان از وجود ردیف پروفایل */
async function getOrCreateLocalUser(): Promise<SessionUser> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(USER_ID_KEY);
  } catch {
    // localStorage در دسترس نیست (نایم/حریم) — هر بار یه شناسهٔ جدید
  }
  if (!stored) {
    stored = crypto.randomUUID();
    try {
      localStorage.setItem(USER_ID_KEY, stored);
    } catch {
      // بی‌اهمیت
    }
  }

  const { data } = await supabase.from('profiles').select('*').eq('id', stored).maybeSingle();
  if (!data) {
    await supabase.from('profiles').upsert({
      id: stored,
      full_name: 'دستیار من',
      first_name: 'دستیار',
      last_name: 'من',
      role: 'system_admin',
      account_status: 'active',
    });
  }
  const row: Profile = (data as Profile | null) ?? ({} as Profile);
  return { id: stored, email: null, created_at: (row.created_at as string) ?? new Date().toISOString() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureLocalSeed();
        const u = await getOrCreateLocalUser();
        if (cancelled) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
        if (cancelled) return;
        setUser(u);
        setProfile((data as Profile | null) ?? null);
      } catch (err) {
        console.error('[dastyar-auth] خطا در راه‌اندازی هویت محلی', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const u = await getOrCreateLocalUser();
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  // «خروج» دیگر معنای لغو ورود ندارد؛ داده‌ها در این دستگاه می‌مانند
  const signOut = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
