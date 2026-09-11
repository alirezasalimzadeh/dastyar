// تست‌های فاز ۴: persistMatches — top-20، حذف ردشده‌ها، پاک‌سازی ردیف‌های قدیمی

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mock supabase ----
const deleteCalls: unknown[] = [];
const upsertCalls: { rows: unknown[]; onConflict: string }[] = [];
let deleteResult: { error: { message: string } | null } = { error: null };
let upsertResult: { data: unknown[]; error: { message: string } | null } = { data: [], error: null };

const chainObj = {
  in: vi.fn(function (this: unknown) {
    return this;
  }),
  then: (resolve: (v: unknown) => void) => Promise.resolve(deleteResult).then(resolve),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => {
        deleteCalls.push(1);
        return chainObj;
      }),
      upsert: vi.fn((rows: unknown[], opts: { onConflict: string }) => {
        upsertCalls.push({ rows, onConflict: opts.onConflict });
        return Promise.resolve(upsertResult);
      }),
    })),
  },
}));

import { persistMatches } from '../persist';
import { scoreMatch } from '../index';
import { makeCustomer, makeProperty } from './fixtures';
import type { Customer, Property } from '@/lib/types';

const B = 1_000_000_000;

function buildPairs(n: number, opts: { withRejected?: boolean } = {}) {
  const pairs: { property: Property; customer: Customer; result: ReturnType<typeof scoreMatch> }[] = [];
  for (let i = 0; i < n; i++) {
    const p = makeProperty({ id: `p${i}`, sale_price: 4 * B + i * 1_000_000 });
    const c = makeCustomer({ id: `c${i}` });
    pairs.push({ property: p, customer: c, result: scoreMatch(c, p) });
  }
  if (opts.withRejected) {
    // خریدار + فایل اجاره = ناسازگار
    const c = makeCustomer({ id: 'crej' });
    const p = makeProperty({ id: 'prej', transaction_type: 'rent', transaction_role: 'owner' });
    pairs.push({ property: p, customer: c, result: scoreMatch(c, p) });
  }
  return pairs;
}

beforeEach(() => {
  deleteCalls.length = 0;
  upsertCalls.length = 0;
  deleteResult = { error: null };
  upsertResult = { data: [], error: null };
});

describe('فاز ۴: persistMatches', () => {
  it('فقط top-20 سازگار ذخیره می‌شود (نه همهٔ ۲۵ مورد)', async () => {
    const res = await persistMatches(buildPairs(25));
    expect(res.error).toBeNull();
    expect(res.saved).toBe(20);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].rows).toHaveLength(20);
    expect(upsertCalls[0].onConflict).toBe('property_id,customer_id');
    const scores = (upsertCalls[0].rows as { score: number }[]).map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('ردشده‌ها هرگز ذخیره نمی‌شوند (نه با امتیاز ۰)', async () => {
    const res = await persistMatches(buildPairs(5, { withRejected: true }));
    expect(res.saved).toBe(5);
    const rows = upsertCalls[0].rows as { customer_id: string }[];
    expect(rows.some((r) => r.customer_id === 'crej')).toBe(false);
  });

  it('ردیف‌های قدیمیِ همین گزینش قبل از نوشتن حذف می‌شوند (جلوگیری از زنده‌شدن دوباره)', async () => {
    await persistMatches(buildPairs(3));
    expect(deleteCalls).toHaveLength(1); // قبل از upsert
  });

  it('با گزینش خالی هیچ دسترسی به دیتابیس نمی‌شود', async () => {
    const res = await persistMatches([]);
    expect(res).toEqual({ saved: 0, error: null });
    expect(upsertCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(0);
  });

  it('خطای دیتابیس به صورت visible بازگردانده می‌شود (نه کرش)', async () => {
    upsertResult = { data: [], error: { message: 'permission denied' } };
    const res = await persistMatches(buildPairs(2));
    expect(res.saved).toBe(0);
    expect(res.error).toBe('permission denied');
  });

  it('سطرهای ذخیره‌شده score + factors (مؤلفه‌ها) + differences (هشدارها) دارند', async () => {
    await persistMatches(buildPairs(2));
    const row = upsertCalls[0].rows[0] as {
      property_id: string; customer_id: string; score: number;
      factors: { key: string }[]; differences: { type: string; text: string }[];
    };
    expect(row.property_id).toMatch(/^p\d+$/);
    expect(row.customer_id).toMatch(/^c\d+$/);
    expect(row.score).toBeGreaterThanOrEqual(0);
    expect(row.score).toBeLessThanOrEqual(100);
    expect(row.factors.map((f) => f.key)).toEqual(['core', 'financial', 'location', 'physical', 'features']);
    expect(Array.isArray(row.differences)).toBe(true);
  });
});
