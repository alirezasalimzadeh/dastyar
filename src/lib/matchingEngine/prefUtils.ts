// موتور تطبیق — ابزار مشترک خواندن ترجیحات مشتری
// قرارداد داده (مطابق فرم موجود): همهٔ ترجیحات از property_preferences خوانده می‌شوند.
// اولویت: نوع سازگار برنده → سایر انواع مشتری → سایر کلیدهای موجود در ترجیحات.

import type { Customer } from '@/lib/types';

/** تبدیل امن به عدد (مقادیر فرم ممکن است string باشند) */
export function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** عددی «ثبت‌شده» (بزرگ‌تر از صفر)؛ صفر در ستون‌های عددی یعنی ثبت نشده */
export function positiveNum(v: unknown): number | null {
  const n = toNum(v);
  return n != null && n > 0 ? n : null;
}

interface Prefs {
  [key: string]: unknown;
}

function getPrefs(customer: Customer, bestCustomerType: string | null): Prefs[] {
  const pp = (customer.property_preferences ?? null) as Record<string, unknown> | null;
  if (!pp) return [];
  const order: string[] = [];
  if (bestCustomerType) order.push(bestCustomerType);
  for (const t of customer.preferred_property_types ?? []) if (!order.includes(t)) order.push(t);
  for (const k of Object.keys(pp)) {
    if (['location', 'address', 'colleague_id'].includes(k)) continue;
    const v = pp[k];
    if (v && typeof v === 'object' && !order.includes(k)) order.push(k);
  }
  return order.map((k) => (pp[k] as Prefs) ?? {});
}

/** اولین مقدار غیرخالی برای یک کلید در ترجیحات مشتری */
export function firstPrefValue(customer: Customer, bestCustomerType: string | null, key: string): unknown {
  for (const prefs of getPrefs(customer, bestCustomerType)) {
    const v = prefs[key];
    if (v != null && String(v).trim() !== '') return v;
  }
  return undefined;
}
