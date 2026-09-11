// سازندگان (شریک مشارکت) — مثل همکاران، به‌صورت ردیف جدول owners با تگ «سازنده»
// نگهداری می‌شوند؛ به‌این‌ترتیب بدون مهاجرت دیتابیس، بخش مستقل «سازندگان»
// با همان امکانات مالکین (فایل‌ها، تماس‌ها، پیگیری‌ها) می‌سازیم.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BUILDER_TAG, COLLEAGUE_TAG } from '@/lib/constants';
import type { Owner } from '@/lib/types';

export type PersonOption = Pick<Owner, 'id' | 'name' | 'phone' | 'secondary_phone' | 'status'> & { tags?: string[] };

const PERSON_SELECT = 'id, name, phone, secondary_phone, status, tags';

/** سازنده‌ها: ردیف‌های owners با تگ «سازنده» */
export function useBuilders(): PersonOption[] {
  const [rows, setRows] = useState<PersonOption[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('owners').select(PERSON_SELECT).order('name');
      if (active) setRows(((data as PersonOption[]) ?? []).filter((row) => row.tags?.includes(BUILDER_TAG)));
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

/** مالک‌های ساده (نه همکار، نه سازنده) — برای انتخاب «مالک» در فرم‌ها */
export function usePlainOwners(): PersonOption[] {
  const [rows, setRows] = useState<PersonOption[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('owners').select(PERSON_SELECT).order('name');
      if (active) setRows(((data as PersonOption[]) ?? []).filter((row) => !row.tags?.includes(BUILDER_TAG) && !row.tags?.includes(COLLEAGUE_TAG)));
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

/** بارگیری چند صاحب‌ملک بر اساس id — برای نمایش نام طرف مقابل در جزئیات */
export function useOwnersByIds(ids: Array<string | null | undefined>): Record<string, PersonOption> {
  const key = ids.filter(Boolean).join(',');
  const [map, setMap] = useState<Record<string, PersonOption>>({});
  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) { setMap({}); return; }
    let active = true;
    (async () => {
      const { data } = await supabase.from('owners').select(PERSON_SELECT).in('id', list);
      if (active) setMap(Object.fromEntries(((data as PersonOption[]) ?? []).map((row) => [row.id, row])));
    })();
    return () => { active = false; };
  }, [key]);
  return map;
}
