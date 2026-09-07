import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { COLLEAGUE_TAG } from '@/lib/constants';
import type { Colleague, Owner } from '@/lib/types';

const AGENCY_PREFIX = 'آژانس:';
const SPECIALIZATION_PREFIX = 'حوزه:';

export function ownerToColleague(owner: Owner): Colleague {
  return {
    id: owner.id,
    name: owner.name,
    phone: owner.phone,
    secondary_phone: owner.secondary_phone,
    agency_name: owner.tags?.find((tag) => tag.startsWith(AGENCY_PREFIX))?.slice(AGENCY_PREFIX.length) ?? '',
    specialization: owner.tags?.find((tag) => tag.startsWith(SPECIALIZATION_PREFIX))?.slice(SPECIALIZATION_PREFIX.length) ?? '',
    notes: owner.notes,
    status: owner.status === 'active' ? 'active' : 'inactive',
    assigned_consultant_id: owner.assigned_consultant_id,
    created_at: owner.created_at,
    updated_at: owner.updated_at,
  };
}

export function colleagueTags(agencyName: string, specialization: string) {
  return [
    COLLEAGUE_TAG,
    ...(agencyName.trim() ? [`${AGENCY_PREFIX}${agencyName.trim()}`] : []),
    ...(specialization.trim() ? [`${SPECIALIZATION_PREFIX}${specialization.trim()}`] : []),
  ];
}

type ColleagueOption = Pick<Colleague, 'id' | 'name' | 'phone' | 'agency_name' | 'status'>;

export function useColleagues() {
  const [colleagues, setColleagues] = useState<ColleagueOption[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('owners')
        .select('*')
        .contains('tags', [COLLEAGUE_TAG])
        .order('name');
      if (active) setColleagues(((data as Owner[]) ?? []).map(ownerToColleague));
    })();
    return () => { active = false; };
  }, []);

  return colleagues;
}
