// seed داده‌های مرجع جغرافیایی در اولین اجرای نسخهٔ محلی
// -------------------------------------------------------------
// همین مجموعه‌ای که قبلاً در دیتابیس ابری نگهداری می‌شد (شهرستان‌های فعال
// استان تهران + محله‌های رباط کریم). با شروع «از صفر»، این داده‌ها محلی
// seed می‌شوند و با بکاپ هم جابه‌جا می‌شوند.
import { allRows, bulkPut } from './db';
import { ACTIVE_COUNTY_NAMES, ROBAT_KARIM_COUNTY_NAME, ROBAT_KARIM_NEIGHBORHOODS } from '@/lib/constants';

const PROVINCE_ID = 'prov-tehran';

function id(prefix: string, name: string): string {
  // شناسهٔ پایدار و خوانا — بین دستگاه‌ها یکسان می‌ماند
  return `${prefix}-${name.replace(/\s+/g, '-').toLowerCase()}`;
}

// بدون cache: هر بار فقط ۴ خوانش سبک (gate = وجود داده) — اگر DB پاک
// شده باشد (مثلاً کاربر دادهٔ سایت را پاک کرد)، seed دوباره انجام می‌شود
export function ensureLocalSeed(): Promise<void> {
  return (async () => {
    try {
      // gate واقعی: وجود دادهٔ جغرافیایی (نه پرچم) — اگر بکاپ بازیابی شده
      // یا داده‌ای هست، seed دوباره اجرا نمی‌شود
      const [counties, cities, neighborhoods, provinces] = await Promise.all([
        allRows('counties'), allRows('cities'), allRows('neighborhoods'), allRows('provinces'),
      ]);
      if (counties.length > 0 || cities.length > 0 || neighborhoods.length > 0 || provinces.length > 0) {
        return;
      }

      const countyIds: Record<string, string> = {};
      const countyRows = ACTIVE_COUNTY_NAMES.map((name) => {
        countyIds[name] = id('county', name);
        return { id: countyIds[name], name, slug: `auto-${name.replace(/\s+/g, '-')}`, province_id: PROVINCE_ID, active: true };
      });

      const rkCityId = id('city', ROBAT_KARIM_COUNTY_NAME);
      const cityRows = [{
        id: rkCityId,
        name: ROBAT_KARIM_COUNTY_NAME,
        slug: 'robat-karim-city',
        province_id: PROVINCE_ID,
        county_id: countyIds[ROBAT_KARIM_COUNTY_NAME],
        active: true,
      }];

      const neighborhoodRows = ROBAT_KARIM_NEIGHBORHOODS.map((name) => ({
        id: id('nbh', name),
        name,
        slug: `rk-${name.replace(/\s+/g, '-')}`,
        city_id: rkCityId,
        county_id: countyIds[ROBAT_KARIM_COUNTY_NAME],
        active: true,
      }));

      const provinceRows = [{ id: PROVINCE_ID, name: 'تهران', slug: 'tehran', active: true }];

      await Promise.all([
        bulkPut('provinces', provinceRows),
        bulkPut('counties', countyRows),
        bulkPut('cities', cityRows),
        bulkPut('neighborhoods', neighborhoodRows),
      ]);
    } catch {
      // دفعهٔ بعد دوباره تلاش شود
    }
  })();
}
