// موتور تطبیق — فاز ۴: ذخیره‌سازی تطبیق‌ها (upsert top-20)
// جدول property_matches: UNIQUE(property_id, customer_id) → upsert امن.
// ردشده‌ها هرگز ذخیره نمی‌شوند (نه با امتیاز ۰ — «۰٪» خودش ادعاست)؛
// ردیف‌های قدیمیِ این گزینش قبل از نوشتن حذف می‌شوند تا «زنده‌شدن دوباره» نداشته باشیم.

import { rankMatches } from './index';
import type { ScoredMatchOutput } from './types';
import type { Customer, Property } from '@/lib/types';

export interface PersistPair {
  property: Property;
  customer: Customer;
  result: ScoredMatchOutput;
}

export interface PersistResult {
  saved: number;
  error: string | null;
}

export async function persistMatches(pairs: PersistPair[], limit = 20): Promise<PersistResult> {
  if (pairs.length === 0) return { saved: 0, error: null };

  // بارگذاری مؤخر — این ماژول در تست‌ها/محیط‌های بدون env فراخوانی نمی‌شود
  const { supabase } = await import('@/lib/supabase');

  const ranked = rankMatches(pairs).slice(0, limit);

  const propIds = [...new Set(pairs.map((p) => p.property.id))];
  const custIds = [...new Set(pairs.map((p) => p.customer.id))];

  // ۱) پاک‌سازی ردیف‌های قدیمی همین گزینش (شامل جفت‌هایی که حالا ناسازگار شده‌اند)
  const del = await supabase
    .from('property_matches')
    .delete()
    .in('property_id', propIds)
    .in('customer_id', custIds);
  if (del.error) return { saved: 0, error: del.error.message };

  // ۲) ثبت top-N سازگار
  if (ranked.length > 0) {
    const rows = ranked.map(({ property, customer, result }) => ({
      property_id: property.id,
      customer_id: customer.id,
      score: result.score ?? 0,
      factors: (result.components ?? []).map((c) => ({
        key: c.key,
        label: c.label,
        weight: c.weight,
        value: c.value,
        active: c.active,
      })),
      differences: [
        ...(result.explanation?.warnings ?? []).map((text) => ({ type: 'warning', text })),
        ...(result.explanation?.unverifiable ?? []).map((text) => ({ type: 'info', text })),
      ],
    }));
    const ins = await supabase.from('property_matches').upsert(rows, { onConflict: 'property_id,customer_id' });
    if (ins.error) return { saved: 0, error: ins.error.message };
  }

  return { saved: ranked.length, error: null };
}
