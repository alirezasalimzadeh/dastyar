// تست‌های موتور تطبیق — فاز ۳ (امتیازدهی، تیر، اعتماد، توضیح)
// شامل مثال‌های واقعی سند طراحی (§۱۷) و اصول درخواستی:
// - فقط compatible=true امتیاز می‌گیرد؛ REJECT هرگز امتیاز نمی‌گیرد
// - UNKNOWN جریمه نمی‌شود (0.5 خنثی + کاهش trust)
// - WARNING با منحنی کنترل‌شده افت دارد
// - ضریب نوع ملک اثر دارد؛ جفت 0.6 سقف 69
// - عدد از دادهٔ ناکافی ساخته نمی‌شود (confidence)
// - خروجی کاملاً قابل توضیح است (سطرهای ✓/⚠/ℹ با مقادیر واقعی)

import { describe, it, expect } from 'vitest';
import { scoreMatch, rankMatches, SCORE_WEIGHTS } from '@/lib/matchingEngine';
import type { ScoredMatchOutput } from '@/lib/matchingEngine';
import { makeCustomer, makeProperty } from './fixtures';
import type { Customer, Property } from '@/lib/types';

const B = 1_000_000_000; // میلیارد
const M = 1_000_000; // میلیون

const comp = (r: ScoredMatchOutput, key: string) => r.components!.find((c) => c.key === key)!;

describe('فاز ۳: اصول پایه', () => {
  it('جفت ردشده (فاز ۱) امتیاز نمی‌گیرد: خریدار + فایل اجاره', () => {
    const out = scoreMatch(makeCustomer(), makeProperty({ transaction_type: 'rent', transaction_role: 'owner' }));
    expect(out.compatible).toBe(false);
    expect(out.score).toBeNull();
    expect(out.tier).toBeNull();
    expect(out.confidence).toBeNull();
    expect(out.components).toBeNull();
    expect(out.explanation).toBeNull();
  });

  it('جفت ردشده (فاز ۲ — veto مالی) امتیاز نمی‌گیرد: سقف ۵ + قیمت ۱۲', () => {
    const c = makeCustomer({ property_preferences: { apartment: { budget_max: 5 * B } } });
    const out = scoreMatch(c, makeProperty({ sale_price: 12 * B }));
    expect(out.compatible).toBe(false);
    expect(out.score).toBeNull();
  });

  it('وزن‌ها دقیقاً 25/20/20/20/15 هستند (متمرکز در config)', () => {
    expect(SCORE_WEIGHTS).toEqual({ core: 20, financial: 25, location: 20, physical: 20, features: 15 });
  });

  it('ساختار خروجی کامل: score + tier + confidence + components + explanation', () => {
    const c = makeCustomer({ property_preferences: { apartment: { budget_min: 4 * B, budget_max: 5 * B } } });
    const out = scoreMatch(c, makeProperty({ sale_price: 4.8 * B }));
    expect(out.compatible).toBe(true);
    expect(typeof out.score).toBe('number');
    expect(['excellent', 'good', 'fair', 'weak', 'hidden']).toContain(out.tier);
    expect(['high', 'medium', 'low']).toContain(out.confidence);
    expect(out.components!.map((x) => x.key)).toEqual(['core', 'financial', 'location', 'physical', 'features']);
    expect(out.components!.every((x) => x.weight > 0 && x.value >= 0 && x.value <= 1)).toBe(true);
    expect(out.explanation!.positives.length + out.explanation!.warnings.length + out.explanation!.unverifiable.length).toBeGreaterThan(0);
  });
});

describe('فاز ۳: مثال‌های سند طراحی (§۱۷)', () => {
  // مثال A: ۹۵ — Excellent
  const customerA = (): Customer =>
    makeCustomer({
      property_preferences: {
        location: { county_id: 'county-1' },
        apartment: { budget_min: 4 * B, budget_max: 5 * B, min_area: 90, max_area: 120, min_rooms: 2, parking: true, elevator: true },
      },
    });
  const fileP1 = (): Property =>
    makeProperty({ building_area: 105, bedrooms: 2, sale_price: 4.8 * B, parking: true, elevator: true });

  it('مثال A: قیمت/متراژ/اتاق/موقعیت/امکانات همه تأیید → ۹۵ Excellent با اعتماد high', () => {
    const out = scoreMatch(customerA(), fileP1());
    expect(out.score).toBe(95);
    expect(out.tier).toBe('excellent');
    expect(out.confidence).toBe('high');
    expect(out.explanation!.positives).toEqual(
      expect.arrayContaining([
        expect.stringContaining('قیمت داخل بودجه'),
        expect.stringContaining('متراژ مناسب'),
        expect.stringContaining('حداقل تعداد خواب'),
        expect.stringContaining('پارکینگ'),
      ]),
    );
  });

  // مثال B: ۷۷ — Good (ودیعه ۲۰٪ بالاتر + یک اتاق کمتر)
  const customerB = (): Customer =>
    makeCustomer({
      transaction_intention: 'rent',
      transaction_role: 'applicant',
      property_preferences: {
        location: { county_id: 'county-1' },
        apartment: { deposit_min: 150 * M, deposit_max: 250 * M, rent_min: 5 * M, rent_max: 10 * M, min_area: 70, max_area: 100, min_rooms: 2 },
      },
    });
  const fileQ = (): Property =>
    makeProperty({ transaction_type: 'rent', transaction_role: 'owner', deposit_price: 300 * M, monthly_rent: 8 * M, building_area: 80, bedrooms: 1 });

  it('مثال B: ودیعه ۲۰٪ بالاتر + یک اتاق کمتر → ۷۷ Good با اعتماد medium', () => {
    const out = scoreMatch(customerB(), fileQ());
    expect(out.score).toBe(77);
    expect(out.tier).toBe('good');
    expect(out.confidence).toBe('medium');
    expect(comp(out, 'financial').value).toBeCloseTo(0.76, 2);
    expect(comp(out, 'physical').value).toBeCloseTo(0.775, 2);
    expect(out.explanation!.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ودیعه ۲۰٪ بالاتر'),
        expect.stringContaining('یک اتاق کمتر'),
      ]),
    );
  });

  it('مشتری کاملاً خالی (فقط معامله/دسته/نوع) → ۶۰ با اعتماد low — نه «۱۰۰٪ تطبیق»', () => {
    const c = makeCustomer({ property_preferences: {} });
    const out = scoreMatch(c, makeProperty({ sale_price: 4.8 * B, building_area: 105, bedrooms: 2 }));
    expect(out.score).toBe(60);
    expect(out.confidence).toBe('low');
    expect(out.tier).toBe('fair');
  });
});

describe('فاز ۳: اثر ضریب نوع ملک و سقف 69', () => {
  it('جفت 0.6 (آپارتمان + خانه): حتی با همه‌چیز ایده‌آل، حداکثر ۶۹', () => {
    const c = makeCustomer({
      property_preferences: {
        location: { county_id: 'county-1', neighborhood_id: 'hood-1' },
        apartment: { budget_min: 4 * B, budget_max: 5 * B, min_area: 90, max_area: 120, min_rooms: 2, parking: true },
      },
    });
    const p = makeProperty({ property_type: 'house', sale_price: 4.5 * B, building_area: 100, bedrooms: 2, parking: true });
    const out = scoreMatch(c, p);
    expect(out.hardCompatibility.compatibilityFactor).toBe(0.6);
    expect(out.metadata.isSubstitutePropertyType).toBe(true);
    expect(out.score).toBeLessThanOrEqual(69);
    expect(out.caps).toContain('SUBSTITUTE_PROPERTY_TYPE');
    expect(out.tier).toBe('fair'); // سقف 69 = بالاترین تیر «Fair»
    expect(out.explanation!.warnings).toContain('نوع ملک جایگزین است و تطبیق دقیق نیست.');
  });

  it('ضریب نوع در امتیاز اثر دارد: exact (1.0) > close (0.9) با بقیه ثابت', () => {
    const c = makeCustomer({ property_preferences: { apartment: { budget_min: 4 * B, budget_max: 5 * B } } });
    const base = { sale_price: 4.5 * B };
    const exact = scoreMatch(c, makeProperty(base));
    const close = scoreMatch(c, makeProperty({ ...base, property_type: 'penthouse' }));
    expect(comp(exact, 'core').value).toBe(1.0);
    expect(comp(close, 'core').value).toBe(0.9);
    expect(exact.score!).toBeGreaterThan(close.score!);
  });
});

describe('فاز ۳: WARNING با جریمه‌ی کنترل‌شده (منحنی‌های تصویب‌شده)', () => {
  const capped = () => makeCustomer({ property_preferences: { apartment: { budget_max: 5 * B } } });

  it('سقف ۵ + ۷ (مذاکره‌ناپذیر): d=40٪ → fit=0.2 (WARNING، نه REJECT) و امتیاز مالی عملاً می‌افتد', () => {
    const out = scoreMatch(capped(), makeProperty({ sale_price: 7 * B }));
    expect(out.compatible).toBe(true);
    expect(comp(out, 'financial').value).toBeCloseTo(0.2, 2);
    expect(out.explanation!.warnings).toEqual(expect.arrayContaining([expect.stringContaining('۴۰٪ بالاتر از سقف بودجه')]));
  });

  it('همان فایل با «قابل مذاکره»: fit=0.5 — دامنهٔ تحمل بیشتر، نه معافیت (۷ > ۵)', () => {
    const plain = scoreMatch(capped(), makeProperty({ sale_price: 7 * B }));
    const negotiable = scoreMatch(capped(), makeProperty({ sale_price: 7 * B, negotiable: true }));
    expect(comp(plain, 'financial').value).toBeCloseTo(0.2, 2);
    expect(comp(negotiable, 'financial').value).toBeCloseTo(0.5, 2);
    expect(negotiable.score!).toBeGreaterThan(plain.score!);
    // ولی همچنان ضعیف: هر دو زیر آستانهٔ نمایش ۵۵ با دادهٔ محدود
    expect(plain.score!).toBeLessThan(60);
  });
});

describe('فاز ۳: UNKNOWN جریمه نمی‌شود', () => {
  it('مؤلفه‌ای که مشتری درباره‌اش داده ندارد: 0.5 خنثی و trust کاهش می‌یابد (نه جریمه)', () => {
    const c = makeCustomer({ property_preferences: { apartment: { budget_min: 4 * B, budget_max: 5 * B } } });
    const out = scoreMatch(c, makeProperty({ sale_price: 4.8 * B }));
    // مالی تأیید شده، بقیه (موقعیت/فیزیکی/امکانات) خنثی
    expect(comp(out, 'financial').active).toBe(true);
    expect(comp(out, 'financial').value).toBe(1.0);
    expect(comp(out, 'location').active).toBe(false);
    expect(comp(out, 'location').value).toBe(0.5);
    expect(comp(out, 'physical').active).toBe(false);
    expect(comp(out, 'features').active).toBe(false);
    // trust = (20 core + 25 financial)/100 = 0.45 → low
    expect(out.confidence).toBe('low');
    expect(out.score).toBe(73); // 20 + 25 + 10 + 10 + 7.5
  });

  it('قیمت فایل ثبت نشده: مالی 0.5 خنثی + ℹ (نه REJECT و نه امتیاز صفر)', () => {
    const c = makeCustomer({ property_preferences: { apartment: { budget_max: 5 * B } } });
    const out = scoreMatch(c, makeProperty({ sale_price: 0 }));
    expect(out.compatible).toBe(true);
    expect(comp(out, 'financial').value).toBe(0.5);
    expect(out.explanation!.unverifiable).toEqual(expect.arrayContaining([expect.stringContaining('قیمت فایل ثبت نشده')]));
  });
});

describe('فاز ۳: سقف 74 برای دادهٔ ناقص فایل (≥۲ مورد REQUIRED ثبت‌نشده)', () => {
  it('دادهٔ کامل → بدون سقف؛ متراژ و اتاق فایل ثبت‌نشده → سقف 74 + هشدار', () => {
    const c = makeCustomer({
      property_preferences: {
        location: { county_id: 'county-1' },
        apartment: { budget_min: 4 * B, budget_max: 5 * B, min_area: 90, max_area: 120, min_rooms: 2 },
      },
    });
    const complete = scoreMatch(c, makeProperty({ sale_price: 4.8 * B, building_area: 105, bedrooms: 2 }));
    expect(complete.caps).not.toContain('INCOMPLETE_PROPERTY_DATA');
    expect(complete.score).toBeGreaterThan(74);

    const incomplete = scoreMatch(
      c,
      makeProperty({ sale_price: 4.8 * B, building_area: 0, land_area: 0, bedrooms: null as unknown as number, rooms: null as unknown as number }),
    );
    expect(incomplete.caps).toContain('INCOMPLETE_PROPERTY_DATA');
    expect(incomplete.score).toBeLessThanOrEqual(74);
    expect(incomplete.explanation!.warnings).toContain('اطلاعات فایل ناقص است');
  });
});

describe('فاز ۳: لولهٔ موقعیت', () => {
  const renter = (loc: Record<string, string>) =>
    makeCustomer({
      transaction_intention: 'rent',
      transaction_role: 'applicant',
      property_preferences: { location: loc },
    });
  const rentFile = (overrides: Partial<Property> = {}) =>
    makeProperty({ transaction_type: 'rent', transaction_role: 'owner', deposit_price: 0, monthly_rent: 8 * M, ...overrides });

  it('محلهٔ یکسان → 1.00؛ همان شهرستان (شهر نامشخص) → 0.60؛ شهر در لیست (شهرستان نامشخص) → 0.70', () => {
    const sameHood = scoreMatch(renter({ county_id: 'county-1', neighborhood_id: 'hood-1' }), rentFile());
    expect(comp(sameHood, 'location').value).toBe(1.0);

    const countyOnly = scoreMatch(renter({ county_id: 'county-1' }), rentFile({ city_id: '' }));
    expect(comp(countyOnly, 'location').value).toBe(0.6);

    const cityInList = scoreMatch(
      makeCustomer({ transaction_intention: 'rent', transaction_role: 'applicant', preferred_city_ids: ['city-1'] }),
      rentFile({ county_id: '' }),
    );
    expect(comp(cityInList, 'location').value).toBe(0.7);
  });

  it('فقط استان فایل مشخص → 0.3 + ⚠ فاصله جغرافیایی (تطبیق استان به‌تنهایی قوی نیست)', () => {
    const out = scoreMatch(renter({ county_id: 'county-9' }), rentFile({ county_id: '', city_id: '', neighborhood_id: '', province_id: 'prov-1' }));
    expect(comp(out, 'location').value).toBe(0.3);
    expect(out.explanation!.warnings).toEqual(expect.arrayContaining([expect.stringContaining('فاصله جغرافیایی')]));
  });
});

describe('فاز ۳: امکانات', () => {
  it('پارکینگ صریحاً ندارد → 0 + ⚠ «بدون پارکینگ»؛ امکانات بدون ستون فایل → 0.5 + ℹ', () => {
    const c = makeCustomer({ property_preferences: { apartment: { parking: true, fireplace: true } } });
    const out = scoreMatch(c, makeProperty({ parking: false }));
    // (3×0 + 1×0.5)/4 = 0.125
    expect(comp(out, 'features').value).toBeCloseTo(0.125, 3);
    expect(out.explanation!.warnings).toContain('بدون پارکینگ');
    expect(out.explanation!.unverifiable).toEqual(expect.arrayContaining([expect.stringContaining('آتشکده')]));
  });

  it('مشتری امکاناتی درخواست نکرده → مؤلفه خنثی، بدون جریمه', () => {
    const out = scoreMatch(makeCustomer(), makeProperty({ parking: false, elevator: false }));
    expect(comp(out, 'features').active).toBe(false);
    expect(comp(out, 'features').value).toBe(0.5);
  });
});

describe('فاز ۳: اجاره بدون ودیعه', () => {
  it('ودیعهٔ صفر فایل = اجارهٔ خالص ماهانه: زیرمقدار ودیعه حذف می‌شود (نه جریمه) + ℹ', () => {
    const c = makeCustomer({
      transaction_intention: 'rent',
      transaction_role: 'applicant',
      property_preferences: { apartment: { deposit_max: 300 * M, rent_min: 5 * M, rent_max: 10 * M } },
    });
    const out = scoreMatch(c, makeProperty({ transaction_type: 'rent', transaction_role: 'owner', deposit_price: 0, monthly_rent: 8 * M }));
    expect(comp(out, 'financial').value).toBe(1.0); // فقط اجاره چک می‌شود
    expect(out.explanation!.unverifiable).toContain('بدون ودیعه — اجارهٔ ماهانه خالص');
  });
});

describe('فاز ۳: رتبه‌بندی (§۱۶)', () => {
  const customer = () => makeCustomer({ property_preferences: { apartment: { budget_max: 5 * B, min_area: 90, max_area: 120 } } });

  it('ردشده‌ها وارد لیست نمی‌شوند؛ score نزولی ← ⚠ کمتر ← فاصلهٔ مالی کم‌تر', () => {
    const c = customer();
    const pA = makeProperty({ sale_price: 4.8 * B }); // ~۹۵؟ نه — فقط بودجه: 20+25+10+10+7.5=73
    const pB = makeProperty({ sale_price: 7 * B }); // 73-20+... مالی 0.2 → پایین‌تر
    const pC = makeProperty({ sale_price: 12 * B }); // REJECT (veto)
    const pD = makeProperty({ sale_price: 7 * B, building_area: 150 }); // همان امتیاز pB ولی ⚠ بیشتر (متراژ ۲۵٪ بالاتر از سقف)
    const items = [
      { id: 'A', result: scoreMatch(c, pA) },
      { id: 'B', result: scoreMatch(c, pB) },
      { id: 'C', result: scoreMatch(c, pC) },
      { id: 'D', result: scoreMatch(c, pD) },
    ];
    const ranked = rankMatches(items);
    expect(ranked.map((x) => x.id)).toEqual(['A', 'B', 'D']); // C ردشده حذف
    expect(items.find((x) => x.id === 'A')!.result.score!).toBeGreaterThan(items.find((x) => x.id === 'B')!.result.score!);
  });
});
