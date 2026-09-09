import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Consultant {
  id: string;
  name: string;
  role?: string | null;
}

/** فهرست مشاوران/کاربرهای تیم برای انتساب و انتقال فایل‌ها */
export function useConsultants() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .order('first_name');
      if (!active) return;
      setConsultants(
        ((data ?? []) as { id: string; first_name?: string | null; last_name?: string | null; role?: string | null }[])
          .map((p) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'نامشخص',
            role: p.role ?? null,
          })),
      );
    })();
    return () => { active = false; };
  }, []);

  return consultants;
}

export function consultantName(list: Consultant[], id?: string | null, fallback = 'نامشخص'): string {
  if (!id) return fallback;
  return list.find((c) => c.id === id)?.name ?? fallback;
}
