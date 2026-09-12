// اسکیمای پایگاه محلی (IndexedDB) — همهٔ جدول‌های برنامه + نقشهٔ ریلیشن‌ها
// -------------------------------------------------------------
// کل داده‌ها در حافظهٔ خود دستگاه نگهداری می‌شوند؛ بکاپ/ریستور با فایل JSON
// دستی بین دستگاه‌ها منتقل می‌شود (جزئیات در backup.ts).

/** همهٔ جدول‌های برنامه — هم برای ذخیره، هم برای بکاپ/ریستور */
export const TABLES = [
  // جغرافیا (داده‌های مرجع — seed در seed.ts)
  'provinces', 'counties', 'districts', 'cities', 'neighborhoods',
  // ساختار سازمانی
  'agencies', 'branches', 'profiles', 'tags', 'notifications',
  // داده‌های اصلی
  'customers', 'owners', 'properties', 'customer_preferred_cities',
  'customer_preferred_neighborhoods', 'customer_tags', 'property_tags',
  'property_requests', 'calls', 'follow_ups', 'tasks', 'deals',
  'property_matches', 'activities',
] as const;

export type TableName = (typeof TABLES)[number];

/**
 * ریلیشن‌های join — جدول مبدأ ← (جدول مقصد ← ستون خارجی).
 * query-builder برای `select('*, owners(name, phone)')` از این نقشه استفاده
 * می‌کند تا ردیف‌های مرتبط را پیوست کند.
 */
export const RELATIONS: Record<string, Record<string, string>> = {
  properties: {
    owners: 'owner_id',
    customers: 'customer_id',
    counties: 'county_id',
    neighborhoods: 'neighborhood_id',
    cities: 'city_id',
  },
  owners: {
    // مالک ← چند فایل/تماس (بسیار-به-یک برعکس: آرایه می‌گیرد)
    properties: 'owner_id',
    calls: 'owner_id',
    follow_ups: 'owner_id',
  },
  customers: {
    calls: 'customer_id',
    follow_ups: 'customer_id',
    deals: 'customer_id',
    property_matches: 'customer_id',
  },
  calls: {
    customers: 'customer_id',
    owners: 'owner_id',
    properties: 'property_id',
  },
  follow_ups: {
    customers: 'customer_id',
    owners: 'owner_id',
    properties: 'property_id',
    deals: 'deal_id',
  },
  deals: {
    customers: 'customer_id',
    owners: 'owner_id',
    properties: 'property_id',
  },
  property_matches: {
    customers: 'customer_id',
    properties: 'property_id',
  },
  neighborhoods: {
    cities: 'city_id',
    counties: 'county_id',
  },
  cities: {
    counties: 'county_id',
    provinces: 'province_id',
  },
  counties: {
    provinces: 'province_id',
  },
};

/**
 * joinهای «یک-به-بسیار»: جدول مبدأ که ردیف‌های متعدد مقابلش را دارد.
 * اینجا پیوست به‌جای یک اوبجکت، آرایه می‌دهد (مثل PostgREST).
 */
export const ONE_TO_MANY: Record<string, string[]> = {
  owners: ['properties', 'calls', 'follow_ups'],
  customers: ['calls', 'follow_ups', 'deals', 'property_matches'],
  properties: ['calls', 'follow_ups', 'deals', 'property_matches'],
  deals: ['follow_ups'],
};
