import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Colleague } from '@/lib/types';

type ColleagueOption = Pick<Colleague, 'id' | 'name' | 'phone' | 'agency_name' | 'status'>;

export function useColleagues() {
  const [colleagues, setColleagues] = useState<ColleagueOption[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('colleagues')
        .select('id, name, phone, agency_name, status')
        .order('status')
        .order('name');
      if (active) setColleagues((data as ColleagueOption[]) ?? []);
    })();
    return () => { active = false; };
  }, []);

  return colleagues;
}
