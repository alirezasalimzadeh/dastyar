import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { COLLEAGUE_TAG } from '@/lib/constants';
import type { Owner } from '@/lib/types';

// لیست همکاران (rows در owners با تگ همکار) — برای انتخاب در فایل/مشتری
export function useColleagues() {
  const [colleagues, setColleagues] = useState<Pick<Owner, 'id' | 'name' | 'phone'>[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('owners')
        .select('id, name, phone')
        .contains('tags', [COLLEAGUE_TAG])
        .eq('status', 'active')
        .order('name');
      if (active) setColleagues((data as Pick<Owner, 'id' | 'name' | 'phone'>[]) ?? []);
    })();
    return () => { active = false; };
  }, []);

  return colleagues;
}
