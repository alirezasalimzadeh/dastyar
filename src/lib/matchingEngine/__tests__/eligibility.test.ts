// تست‌های موتور تطبیق — فاز ۱ (سخت) و فاز ۲ (قوی)
// همهٔ ۱۶ سناریوی خواسته‌شده + موارد تکمیلی.

import { describe, it, expect } from 'vitest';
import { matchEligibility, RejectionReason, WarningCode } from '@/lib/matchingEngine';
import type { Customer, Property } from '@/lib/types';

// ---- کارخانه‌های داده (مطابق ستون‌های واقعی جدول customers/properties) ----

const baseCustomer: Customer = {
  id: 'c1',
  name: 'مشتری تستی',
  first_name: 'مشتری',
  last_name: 'تستی',
  mobile: '09120000000',
  secondary_phone: '',
  address: '',
  customer_type: 'personal',
  transaction_intention: 'buy',
  transaction_role: 'buyer',
  budget_min: 0,
  budget_max: 0,
  preferred_category: 'residential',
  preferred_property_types: ['apartment'],
  preferred_province_ids: [],
  preferred_county_ids: [],
  preferred_city_ids: [],
  min_area: 0,
  max_area: 0,
  bedrooms: 0,
  required_features: [],
  preferred_floor: 0,
  parking_required: false,
  elevator_required: false,
  property_preferences: {},
  urgency: 'normal',
  temperature: 'warm',
  lead_source: 'test',
  assigned_consultant_id: '',
  notes: '',
  tags: [],
  last_contact: '',
  next_followup: '',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// property_preferences در واقعیت JSON است (در TS نوع توپ‌سطحی string|number|... دارد)؛
// فرم واقعی به‌صورت توپ‌در-توپ ذخیره می‌کند → در تست با کست عبور می‌کنیم
function makeCustomer(
  overrides: Partial<Omit<Customer, 'property_preferences'>> & { property_preferences?: Record<string, unknown> } = {},
): Customer {
  return { ...baseCustomer, ...overrides } as Customer;
}

const baseProperty: Property = {
  id: 'p1',
  title: 'فایل تستی',
  description: '',
  transaction_type: 'sell',
  transaction_role: 'seller',
  category: 'residential',
  property_type: 'apartment',
  status: 'active',
  is_hot: false,
  is_featured: false,
  is_active: true,
  owner_id: 'o1',
  assigned_consultant_id: '',
  province_id: 'prov-1',
  county_id: 'county-1',
  district_id: 'dist-1',
  city_id: 'city-1',
  neighborhood_id: 'hood-1',
  street: '',
  address: '',
  postal_code: '',
  latitude: 0,
  longitude: 0,
  land_area: 0,
  building_area: 0,
  rooms: 0,
  bedrooms: 0,
  floor: 0,
  total_floors: 0,
  unit_number: '',
  building_age: 0,
  parking: false,
  storage: false,
  elevator: false,
  balcony: false,
  yard: false,
  garden: false,
  pool: false,
  security: false,
  heating: '',
  cooling: '',
  sale_price: 0,
  deposit_price: 0,
  monthly_rent: 0,
  price_per_meter: 0,
  owner_requested_price: 0,
  participation_price: 0,
  negotiable: false,
  payment_conditions: '',
  commission: 0,
  owner_notes: '',
  owner_relationship: '',
  owner_followup_status: '',
  images: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeProperty(overrides: Partial<Property> = {}): Property {
  return { ...baseProperty, ...overrides };
}

const B = 1_000_000_000; // میلیارد

// ============================================================
// فاز ۱ — سازگاری سخت
// ============================================================

describe('فاز ۱: سازگاری سخت (ترتیب: معامله+نقش → دسته → نوع)', () => {
  it('خریدار + فایل فروش = قابل تطبیق (ساختار خروجی کامل)', () => {
    const out = matchEligibility(makeCustomer(), makeProperty());
    expect(out.compatible).toBe(true);
    expect(out.hardCompatibility.transaction).toBe('PASS');
    expect(out.hardCompatibility.category).toBe('PASS');
    expect(out.hardCompatibility.propertyType).toBe('PASS');
    expect(out.hardCompatibility.compatibilityFactor).toBe(1);
    expect(out.hardCompatibility.isSubstitutePropertyType).toBe(false);
    expect(out.strongConstraints).not.toBeNull();
    expect(out.rejectionReason).toBeNull();
    expect(out.metadata.isSubstitutePropertyType).toBe(false);
  });

  it('خریدار + فایل اجاره = REJECT (TRANSACTION_INCOMPATIBLE) و فاز ۲ اجرا نمی‌شود', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ transaction_type: 'rent', transaction_role: 'owner' }));
    expect(out.compatible).toBe(false);
    expect(out.hardCompatibility.transaction).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.TRANSACTION_INCOMPATIBLE);
    expect(out.strongConstraints).toBeNull();
  });

  it('خریدار + فایل شراکت = REJECT (TRANSACTION_INCOMPATIBLE)', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ transaction_type: 'partnership', transaction_role: 'owner' }));
    expect(out.compatible).toBe(false);
    expect(out.rejectionReason).toBe(RejectionReason.TRANSACTION_INCOMPATIBLE);
  });

  it('فایل تقاضا (خریدار) در برابر مشتری خریدار = REJECT (تقاضا↔تقاضا)', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ transaction_type: 'buy', transaction_role: 'buyer' }));
    expect(out.compatible).toBe(false);
    expect(out.rejectionReason).toBe(RejectionReason.TRANSACTION_INCOMPATIBLE);
  });

  it('جفت‌های معکوس هم مجازند: مالک اجاره‌دهنده + فایل مستأجر / سازنده + فایل مالک', () => {
    const rentOwner = makeCustomer({ transaction_intention: 'rent', transaction_role: 'owner' });
    expect(matchEligibility(rentOwner, makeProperty({ transaction_type: 'rent', transaction_role: 'applicant' })).compatible).toBe(true);
    const builder = makeCustomer({ transaction_intention: 'partnership', transaction_role: 'builder' });
    expect(matchEligibility(builder, makeProperty({ transaction_type: 'partnership', transaction_role: 'owner' })).compatible).toBe(true);
  });

  it('نقش مشتری ثبت نشده = پروفایل ناقص (INCOMPLETE_CUSTOMER_PROFILE، نه ناسازگاری)', () => {
    const out = matchEligibility(makeCustomer({ transaction_role: '' }), makeProperty());
    expect(out.compatible).toBe(false);
    expect(out.hardCompatibility.transaction).toBe('UNKNOWN');
    expect(out.rejectionReason).toBe(RejectionReason.INCOMPLETE_CUSTOMER_PROFILE);
  });

  it('آپارتمان + مغازه (دسته متفاوت، بدون جفت سازگار) = REJECT در مرحلهٔ دسته', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ category: 'commercial', property_type: 'shop' }));
    expect(out.compatible).toBe(false);
    expect(out.hardCompatibility.category).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.CATEGORY_INCOMPATIBLE);
  });

  it('آپارتمان + زمین مسکونی (هم‌دسته، جفت سازگار نیست) = REJECT در مرحلهٔ نوع', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ property_type: 'residential_land' }));
    expect(out.compatible).toBe(false);
    expect(out.hardCompatibility.category).toBe('PASS');
    expect(out.hardCompatibility.propertyType).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.PROPERTY_TYPE_INCOMPATIBLE);
  });

  it('آپارتمان + پنت‌هاوس = سازگار با ضریب 0.9', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ property_type: 'penthouse' }));
    expect(out.compatible).toBe(true);
    expect(out.hardCompatibility.compatibilityFactor).toBe(0.9);
    expect(out.hardCompatibility.isSubstitutePropertyType).toBe(false);
  });

  it('آپارتمان + خانه = سازگار با ضریب 0.6 + metadata جایگزین + هشدار', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ property_type: 'house' }));
    expect(out.compatible).toBe(true);
    expect(out.hardCompatibility.compatibilityFactor).toBe(0.6);
    expect(out.hardCompatibility.isSubstitutePropertyType).toBe(true);
    expect(out.metadata.isSubstitutePropertyType).toBe(true);
    expect(out.warnings).toContain(WarningCode.PROPERTY_TYPE_SUBSTITUTE);
  });

  it('استثنای بین‌دسته‌ای: مشتری آپارتمان اداری + فایل آپارتمان = 0.6 (نه REJECT دسته)', () => {
    const out = matchEligibility(
      makeCustomer({ preferred_category: 'office', preferred_property_types: ['office_apartment'] }),
      makeProperty({ category: 'residential', property_type: 'apartment' }),
    );
    expect(out.compatible).toBe(true);
    expect(out.hardCompatibility.compatibilityFactor).toBe(0.6);
    expect(out.hardCompatibility.isSubstitutePropertyType).toBe(true);
  });

  it('ماتریس صنعتی مطابق سند: کارخانه ↔ زمین صنعتی 0.6 / ↔ کارگاه 0.85 / ↔ سوله 0.85', () => {
    const c = makeCustomer({ preferred_category: 'industrial', preferred_property_types: ['factory'] });
    const industrial = (t: string) => matchEligibility(c, makeProperty({ category: 'industrial', property_type: t })).hardCompatibility;
    expect(industrial('industrial_land').compatibilityFactor).toBe(0.6);
    expect(industrial('industrial_land').isSubstitutePropertyType).toBe(true);
    expect(industrial('workshop').compatibilityFactor).toBe(0.85);
    expect(industrial('industrial_unit').compatibilityFactor).toBe(0.85);
    // کارخانه↔انبار در جدول سند تعریف نشده → 0 (قاعدهٔ محتاطانه)
    expect(industrial('warehouse').compatibilityFactor).toBe(0);
    expect(matchEligibility(c, makeProperty({ category: 'industrial', property_type: 'warehouse' })).rejectionReason).toBe(RejectionReason.PROPERTY_TYPE_INCOMPATIBLE);
    expect(industrial('garage').compatibilityFactor).toBe(0);
  });
});

// ============================================================
// فاز ۲ — مالی
// ============================================================

describe('فاز ۲: محدودیت مالی', () => {
  const buyer = (lo: number, hi: number) =>
    makeCustomer({ property_preferences: { apartment: { budget_min: lo, budget_max: hi } } });
  const priced = (price: number, negotiable = false) => makeProperty({ sale_price: price, negotiable });

  it('بودجهٔ .۵–۵ میلیارد + قیمت ۴.۸ = PASS', () => {
    const out = matchEligibility(buyer(4.5 * B, 5 * B), priced(4.8 * B));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.financial).toBe('PASS');
  });

  it('سقف ۵ میلیارد + قیمت ۷ (مذاکره‌ناپذیر) = WARNING — طبق فرمول d=40٪ < 50٪ (رد در 7.5B)', () => {
    const out = matchEligibility(buyer(4.5 * B, 5 * B), priced(7 * B));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.financial).toBe('WARNING');
    expect(out.warnings).toContain(WarningCode.BUDGET_ABOVE_MAX);
    expect(out.metadata.distances.budget).toBeCloseTo(0.4, 5);

    const hard = matchEligibility(buyer(4.5 * B, 5 * B), priced(7.5 * B));
    expect(hard.compatible).toBe(false);
    expect(hard.strongConstraints!.financial).toBe('REJECT');
    expect(hard.rejectionReason).toBe(RejectionReason.BUDGET_TOO_HIGH);
  });

  it('سقف ۵ + قیمت ۸.۹ با مذاکره = WARNING (d=78٪ < 80٪)', () => {
    const out = matchEligibility(buyer(4.5 * B, 5 * B), priced(8.9 * B, true));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.financial).toBe('WARNING');
  });

  it('سقف ۵ + قیمت ۹ با مذاکره = REJECT (d=80٪ — «قابل مذاکره» فایل کاملاً خارج از توان را نجات نمی‌دهد)', () => {
    const out = matchEligibility(buyer(4.5 * B, 5 * B), priced(9 * B, true));
    expect(out.compatible).toBe(false);
    expect(out.strongConstraints!.financial).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.BUDGET_TOO_HIGH);
  });

  it('قیمت پایین‌تر از کف بودجه = WARNING (رد نمی‌شود)', () => {
    const out = matchEligibility(buyer(4.5 * B, 5 * B), priced(2 * B));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.financial).toBe('WARNING');
    expect(out.warnings).toContain(WarningCode.BUDGET_BELOW_MIN);
  });

  it('اجاره: ودیعه و اجارهٔ ماهانه جدا بررسی می‌شوند (۵۰٪/۸۰٪)', () => {
    const renter = makeCustomer({
      transaction_intention: 'rent',
      transaction_role: 'applicant',
      property_preferences: { apartment: { deposit_min: 3 * B, deposit_max: 5 * B, rent_min: 10_000_000, rent_max: 20_000_000 } },
    });
    const file = (deposit: number, rent: number, negotiable = false) =>
      makeProperty({ transaction_type: 'rent', transaction_role: 'owner', deposit_price: deposit, monthly_rent: rent, negotiable });

    expect(matchEligibility(renter, file(4 * B, 15_000_000)).strongConstraints!.financial).toBe('PASS');
    // ودیعهٔ ۷.۵ = +۵۰٪ از سقف ۵ → REJECT
    const dep = matchEligibility(renter, file(7.5 * B, 15_000_000));
    expect(dep.strongConstraints!.financial).toBe('REJECT');
    expect(dep.rejectionReason).toBe(RejectionReason.DEPOSIT_TOO_HIGH);
    // اجارهٔ ۳۵ میلیون با مذاکره = +۷۵٪ < ۸۰٪ → WARNING
    const rnt = matchEligibility(renter, file(4 * B, 35_000_000, true));
    expect(rnt.strongConstraints!.financial).toBe('WARNING');
    expect(rnt.warnings).toContain(WarningCode.RENT_ABOVE_MAX);
  });

  it('اجاره بدون ودیعه: نبود ودیعه در فایل جریمه نمی‌شود (فقط اجارهٔ ماهانه چک می‌شود)', () => {
    const renter = makeCustomer({
      transaction_intention: 'rent',
      transaction_role: 'applicant',
      property_preferences: { apartment: { deposit_max: 5 * B, rent_min: 10_000_000, rent_max: 20_000_000 } },
    });
    const out = matchEligibility(renter, makeProperty({ transaction_type: 'rent', transaction_role: 'owner', deposit_price: 0, monthly_rent: 15_000_000 }));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.financial).toBe('PASS');
  });
});

// ============================================================
// فاز ۲ — متراژ
// ============================================================

describe('فاز ۲: متراژ', () => {
  const withArea = (min: number | null, max: number | null) =>
    makeCustomer({ property_preferences: { apartment: { ...(min != null ? { min_area: min } : {}), ...(max != null ? { max_area: max } : {}) } } });

  it('بازهٔ ۹۰–۱۲۰ + متراژ ۱۰۵ = PASS', () => {
    const out = matchEligibility(withArea(90, 120), makeProperty({ building_area: 105 }));
    expect(out.strongConstraints!.area).toBe('PASS');
  });

  it('بازهٔ ۹۰–۱۲ + متراژ ۱۲۵ = WARNING', () => {
    const out = matchEligibility(withArea(90, 120), makeProperty({ building_area: 125 }));
    expect(out.strongConstraints!.area).toBe('WARNING');
    expect(out.warnings).toContain(WarningCode.AREA_ABOVE_MAX);
  });

  it('بازهٔ ۹۰–۱۲ + متراژ ۳۰۰ = REJECT (AREA_TOO_LARGE)', () => {
    const out = matchEligibility(withArea(90, 120), makeProperty({ building_area: 300 }));
    expect(out.compatible).toBe(false);
    expect(out.strongConstraints!.area).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.AREA_TOO_LARGE);
  });

  it('بازهٔ متراژ ثبت نشده = UNKNOWN (هرگز REJECT)', () => {
    const out = matchEligibility(makeCustomer(), makeProperty({ building_area: 5000 }));
    expect(out.strongConstraints!.area).toBe('UNKNOWN');
    expect(out.compatible).toBe(true);
  });

  it('متراژ زمین برای انواع زمینی: عبور ≥۵۰٪ = REJECT', () => {
    const c = makeCustomer({ preferred_category: 'industrial', preferred_property_types: ['factory'], property_preferences: { factory: { min_land_area: 2000, max_land_area: 3000 } } });
    const warn = matchEligibility(c, makeProperty({ category: 'industrial', property_type: 'factory', land_area: 3500 }));
    expect(warn.strongConstraints!.area).toBe('WARNING');
    const rej = matchEligibility(c, makeProperty({ category: 'industrial', property_type: 'factory', land_area: 4500 }));
    expect(rej.strongConstraints!.area).toBe('REJECT');
    expect(rej.rejectionReason).toBe(RejectionReason.AREA_TOO_LARGE);
  });

  it('سالن صنعتی: کمتر از حداقل = WARNING (رد نمی‌شود)', () => {
    const c = makeCustomer({ preferred_category: 'industrial', preferred_property_types: ['factory'], property_preferences: { factory: { min_hall_area: 500 } } });
    const warn = matchEligibility(c, makeProperty({ category: 'industrial', property_type: 'factory', building_area: 300 }));
    expect(warn.strongConstraints!.area).toBe('WARNING');
    expect(warn.warnings).toContain(WarningCode.AREA_BELOW_MIN);
    const pass = matchEligibility(c, makeProperty({ category: 'industrial', property_type: 'factory', building_area: 800 }));
    expect(pass.strongConstraints!.area).toBe('PASS');
  });
});

// ============================================================
// فاز ۲ — اتاق
// ============================================================

describe('فاز ۲: اتاق', () => {
  const withRooms = (min: number) => makeCustomer({ property_preferences: { apartment: { min_rooms: min } } });

  it('حداقل ۲ + فایل ۱ خواب = WARNING', () => {
    const out = matchEligibility(withRooms(2), makeProperty({ bedrooms: 1 }));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.rooms).toBe('WARNING');
    expect(out.warnings).toContain(WarningCode.ONE_ROOM_SHORT);
  });

  it('حداقل ۲ + فایل ۰ خواب = REJECT (INSUFFICIENT_ROOMS)', () => {
    const out = matchEligibility(withRooms(2), makeProperty({ bedrooms: 0 }));
    expect(out.compatible).toBe(false);
    expect(out.strongConstraints!.rooms).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.INSUFFICIENT_ROOMS);
  });
});

// ============================================================
// فاز ۲ — موقعیت
// ============================================================

describe('فاز ۲: موقعیت (سلسله‌مراتبی، بدون خیابان)', () => {
  const withCounty = (county: string, hood?: string) =>
    makeCustomer({ property_preferences: { location: hood ? { county_id: county, neighborhood_id: hood } : { county_id: county } } });

  it('فرهنگٔ مشتری بدون موقعیت = UNKNOWN', () => {
    const out = matchEligibility(makeCustomer(), makeProperty());
    expect(out.strongConstraints!.location).toBe('UNKNOWN');
  });

  it('موقعیت فایل ثبت نشده = UNKNOWN (نه REJECT)', () => {
    const out = matchEligibility(withCounty('county-9'), makeProperty({ county_id: '', city_id: '', neighborhood_id: '' }));
    expect(out.strongConstraints!.location).toBe('UNKNOWN');
    expect(out.compatible).toBe(true);
  });

  it('شهرستان متفاوت و شناخته‌شده = REJECT (LOCATION_OUTSIDE_REQUEST)', () => {
    const out = matchEligibility(withCounty('county-9'), makeProperty({ county_id: 'county-2' }));
    expect(out.strongConstraints!.location).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.LOCATION_OUTSIDE_REQUEST);
  });

  it('همان شهرستان + همان محله = PASS؛ همان شهرستان + محلهٔ متفاوت و شناخته‌شده = REJECT', () => {
    const same = matchEligibility(withCounty('county-1', 'hood-1'), makeProperty({ county_id: 'county-1', neighborhood_id: 'hood-1' }));
    expect(same.strongConstraints!.location).toBe('PASS');
    const diffHood = matchEligibility(withCounty('county-1', 'hood-1'), makeProperty({ county_id: 'county-1', neighborhood_id: 'hood-9' }));
    expect(diffHood.strongConstraints!.location).toBe('REJECT');
    expect(diffHood.rejectionReason).toBe(RejectionReason.LOCATION_OUTSIDE_REQUEST);
  });

  it('شهر فایل در لیست preferred_city_ids نیست = REJECT', () => {
    const out = matchEligibility(
      makeCustomer({ preferred_city_ids: ['city-9'] }),
      makeProperty({ county_id: '', city_id: 'city-1' }),
    );
    expect(out.strongConstraints!.location).toBe('REJECT');
    expect(out.rejectionReason).toBe(RejectionReason.LOCATION_OUTSIDE_REQUEST);
  });
});

// ============================================================
// فاز ۲ — شراکت
// ============================================================

describe('فاز ۲: شراکت (هرگز REJECT مالی مستقیم)', () => {
  const partner = (landValue: number | null) =>
    makeCustomer({
      transaction_intention: 'partnership',
      transaction_role: 'owner',
      preferred_category: 'residential',
      preferred_property_types: ['residential_land'],
      property_preferences: { residential_land: landValue != null ? { land_value: landValue } : {} },
    });
  const file = (participation: number) =>
    makeProperty({ transaction_type: 'partnership', transaction_role: 'builder', property_type: 'residential_land', participation_price: participation });

  it('اختلاف ۴ برابر ارزش = WARNING (PARTNERSHIP_VALUE_GAP) ولی قابل تطبیق', () => {
    const out = matchEligibility(partner(5 * B), file(20 * B));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.partnership).toBe('WARNING');
    expect(out.warnings).toContain(WarningCode.PARTNERSHIP_VALUE_GAP);
  });

  it('اختلاف ۲ برابر = PASS', () => {
    const out = matchEligibility(partner(5 * B), file(10 * B));
    expect(out.strongConstraints!.partnership).toBe('PASS');
  });

  it('دادهٔ ارزش ثبت نشده = UNKNOWN', () => {
    const out = matchEligibility(partner(null), file(0));
    expect(out.strongConstraints!.partnership).toBe('UNKNOWN');
    expect(out.compatible).toBe(true);
  });
});

// ============================================================
// سناریوهای ترکیبی
// ============================================================

describe('سناریوهای ترکیبی', () => {
  it('ترجیحات کاملاً خالی = همهٔ محدودیت‌های قوی UNKNOWN ولی قابل تطبیق (رد خودکار به دلیل دادهٔ ناقص نمی‌شود)', () => {
    const out = matchEligibility(makeCustomer({ property_preferences: {} }), makeProperty({ sale_price: 50 * B, building_area: 9999, bedrooms: 0 }));
    expect(out.compatible).toBe(true);
    expect(out.strongConstraints!.financial).toBe('UNKNOWN');
    expect(out.strongConstraints!.area).toBe('UNKNOWN');
    expect(out.strongConstraints!.rooms).toBe('UNKNOWN');
    expect(out.strongConstraints!.location).toBe('UNKNOWN');
    expect(out.strongConstraints!.partnership).toBe('UNKNOWN');
    expect(out.rejectionReason).toBeNull();
  });

  it('رد فقط با یک دلیل machine-readable گزارش می‌شود (قیمت + متراژ هم‌زمان)', () => {
    const c = makeCustomer({ property_preferences: { apartment: { budget_max: 5 * B, max_area: 120 } } });
    const p = makeProperty({ sale_price: 12 * B, building_area: 300 });
    const out = matchEligibility(c, p);
    expect(out.compatible).toBe(false);
    expect(out.rejectionReason).toBe(RejectionReason.BUDGET_TOO_HIGH);
    expect(out.strongConstraints!.area).toBe('REJECT');
  });

  it('فروشنده + فایل خرید = قابل تطبیق (جفت معکوس عرضه/تقاضا)', () => {
    const seller = makeCustomer({ transaction_intention: 'sell', transaction_role: 'seller', preferred_category: 'residential', preferred_property_types: ['apartment'], budget_min: 3 * B, budget_max: 4 * B, property_preferences: {} });
    const out = matchEligibility(seller, makeProperty({ transaction_type: 'buy', transaction_role: 'buyer', sale_price: 0 }));
    expect(out.compatible).toBe(true);
  });
});
