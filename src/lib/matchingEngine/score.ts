// موتور تطبیق — فاز ۳: امتیازدهی (طبق سند طراحی §۵–§۱۱، §۱۳–§۵)
//
// اصول:
// - فقط جفت‌های compatible=true وارد امتیاز می‌شوند (REJECTهای فاز ۱/۲ هرگز امتیاز نمی‌گیرند).
// - UNKNOWN جریمه نمی‌شود: مؤلفه‌ای که مشتری درباره‌اش حرف نزده → 0.5 خنثی + از trust کسر.
// - WARNING با منحنی‌های fit کنترل‌شده کاهش امتیاز می‌دهد (نه کسر دلخواه).
// - ضریب سازگاری نوع ملک در مؤلفهٔ Core اثر دارد؛ جفت 0.6 سقف 69 دارد.
// - «عدد نباید از دادهٔ ناکافی ساخته شود» → confidence (high/medium/low) از وزن دادهٔ فعال.
// - هر امتیاز، سطر توضیح با مقادیر واقعی تولید می‌کند (نه ساختگی).

import {
  CONFIDENCE_THRESHOLDS,
  FLOOR_FIT,
  FEATURE_WEIGHTS,
  INCOMPLETE_DATA_CAP,
  INCOMPLETE_DATA_THRESHOLD,
  LAND_AREA_TYPES,
  LOCATION_SCORES,
  PHYSICAL_SUB_WEIGHTS,
  ROOMS_SHORTFALL_1_SCORE,
  SCORE_WEIGHTS,
  STRONG_THRESHOLDS,
  SUBSTITUTE_SCORE_CAP,
  TIER_THRESHOLDS,
  VERIFIABLE_FEATURES,
} from './config';
import { firstPrefValue, toNum } from './prefUtils';
import type { MatchEligibilityOutput, MatchExplanation, ScoredComponent } from './types';
import { formatMoneyShort, formatPrice, PROPERTY_TYPES } from '@/lib/constants';
import type { Customer, Property } from '@/lib/types';

// ---- ابزار مشترک ----

interface ComponentResult {
  value: number; // 0–1
  active: boolean; // مشتری درباره‌اش داده ثبت کرده؟ (برای trust)
  /** سهم فعال در trust (فیزیکی: جمع وزن زیرمقادارهای فعال) */
  activeFraction: number;
  positives: string[];
  warnings: string[];
  unverifiable: string[]; // ℹ
  /** موارد REQUIRED که در فایل ثبت نشده (برای سقف 74) */
  missingRequired: number;
}

const pct = (d: number) => formatPrice(Math.round(d * 100));
const rangeStr = (lo: number | null, hi: number | null) => {
  if (lo != null && hi != null) return `${formatMoneyShort(lo)} تا ${formatMoneyShort(hi)}`;
  if (hi != null) return `تا ${formatMoneyShort(hi)}`;
  return `از ${formatMoneyShort(lo)}`;
};

const TYPE_LABELS: Record<string, string> = Object.values(PROPERTY_TYPES).flat().reduce(
  (acc, { value, label }) => ({ ...acc, [value]: label }),
  {} as Record<string, string>,
);

/** تابع تناسب عمومی (§۶ سند): داخل بازه 1.0 / عبور بالا و پایین با منحنی تصویب‌شده */
function fitValue(v: number, lo: number | null, hi: number | null, negotiable: boolean): { value: number; above: boolean; below: boolean; d: number } {
  if (hi != null && v > hi) {
    const d = (v - hi) / hi;
    const slope = negotiable ? 1.25 : 2;
    return { value: Math.max(0, 1 - slope * d), above: true, below: false, d };
  }
  if (lo != null && v < lo) {
    const d = (lo - v) / lo;
    return { value: Math.max(0.4, 1 - d), above: false, below: true, d };
  }
  return { value: 1.0, above: false, below: false, d: 0 };
}

// ---- مؤلفهٔ Core (نوع معامله/دسته/نوع ملک) ----

function coreScore(elig: MatchEligibilityOutput, property: Property): ComponentResult {
  const factor = elig.hardCompatibility.compatibilityFactor ?? 1.0;
  const positives: string[] = [];
  const warnings: string[] = [];
  if (elig.metadata.isSubstitutePropertyType) {
    warnings.push('نوع ملک جایگزین است و تطبیق دقیق نیست.');
  } else if (factor < 1.0) {
    warnings.push(`نوع ملک نزدیک به درخواست است: ${TYPE_LABELS[property.property_type] ?? property.property_type}`);
  }
  return { value: factor, active: true, positives, warnings, unverifiable: [], missingRequired: 0, activeFraction: 1 };
}

// ---- مؤلفهٔ Financial ----

function financialScore(customer: Customer, property: Property, bestType: string | null): ComponentResult {
  const tx = customer.transaction_intention;
  const positives: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  let missingRequired = 0;

  if (tx === 'partnership') {
    // بُعد مشترک دقیق نیست → خنثی + بررسی نرم (بدون veto، مطابق §۷)
    const landValue = toNum(firstPrefValue(customer, bestType, 'land_value'));
    const participation = toNum(property.participation_price);
    if (landValue && participation && landValue > 0 && participation > 0) {
      const ratio = Math.max(landValue, participation) / Math.min(landValue, participation);
      if (ratio > STRONG_THRESHOLDS.partnershipRatioWarn) {
        warnings.push(`اختلاف ارزش شراکت ${formatPrice(Math.round(ratio))} برابر — برای گفت‌وگو`);
      } else {
        positives.push('ارزش شراکت در محدودهٔ معقول');
      }
    } else {
      notes.push('ارزش شراکت قابل محاسبه نیست (دادهٔ کافی نیست)');
    }
    return { value: 0.5, active: false, activeFraction: 0, positives, warnings, unverifiable: notes, missingRequired: 0 };
  }

  if (tx === 'rent') {
    const negotiable = property.negotiable;
    const depositLo = toNum(firstPrefValue(customer, bestType, 'deposit_min'));
    const depositHi = toNum(firstPrefValue(customer, bestType, 'deposit_max'));
    const rentLo = toNum(firstPrefValue(customer, bestType, 'rent_min'));
    const rentHi = toNum(firstPrefValue(customer, bestType, 'rent_max'));
    const propDeposit = toNum(property.deposit_price);
    const propRent = toNum(property.monthly_rent);

    const subs: { w: number; value: number }[] = [];
    if (propDeposit != null && propDeposit > 0 && (depositLo != null || depositHi != null)) {
      const fit = fitValue(propDeposit, depositLo, depositHi, negotiable);
      subs.push({ w: 0.6, value: fit.value });
      if (fit.above) warnings.push(`ودیعه ${pct(fit.d)}٪ بالاتر از سقف (${formatMoneyShort(propDeposit)} در برابر ${formatMoneyShort(depositHi)})${negotiable ? ' — قابل مذاکره' : ''}`);
      else if (fit.below) notes.push(`ودیعه پایین‌تر از کف (${formatMoneyShort(propDeposit)} در برابر ${rangeStr(depositLo, depositHi)})`);
      else positives.push(`ودیعه داخل بودجه (${formatMoneyShort(propDeposit)} در بازهٔ ${rangeStr(depositLo, depositHi)})`);
    } else if (propDeposit == null || propDeposit <= 0) {
      // اجارهٔ خالص ماهانه: زیرمقدار ودیعه حذف می‌شود (نه جریمه) — رفع #۱۲
      if (depositLo != null || depositHi != null) notes.push('بدون ودیعه — اجارهٔ ماهانه خالص');
    }
    if (propRent != null && propRent > 0 && (rentLo != null || rentHi != null)) {
      const fit = fitValue(propRent, rentLo, rentHi, negotiable);
      subs.push({ w: 0.4, value: fit.value });
      if (fit.above) warnings.push(`اجارهٔ ماهانه ${pct(fit.d)}٪ بالاتر از سقف (${formatMoneyShort(propRent)} در برابر ${formatMoneyShort(rentHi)})${negotiable ? ' — قابل مذاکره' : ''}`);
      else if (fit.below) notes.push(`اجارهٔ ماهانه پایین‌تر از کف (${formatMoneyShort(propRent)} در برابر ${rangeStr(rentLo, rentHi)})`);
      else positives.push(`اجارهٔ ماهانه در بودجه (${formatMoneyShort(propRent)} در بازهٔ ${rangeStr(rentLo, rentHi)})`);
    }
    if (subs.length === 0) {
      return { value: 0.5, active: false, activeFraction: 0, positives, warnings, unverifiable: notes, missingRequired: 0 };
    }
    const value = subs.reduce((s, x) => s + x.w * x.value, 0) / subs.reduce((s, x) => s + x.w, 0);
    return { value, active: true, activeFraction: 1, positives, warnings, unverifiable: notes, missingRequired};
  }

  // خرید / فروش
  const lo = toNum(firstPrefValue(customer, bestType, 'budget_min'));
  const hi = toNum(firstPrefValue(customer, bestType, 'budget_max'));
  if (lo == null && hi == null) {
    return { value: 0.5, active: false, activeFraction: 0, positives, warnings, unverifiable: notes, missingRequired: 0 };
  }
  const price = toNum(property.sale_price) ?? toNum(property.owner_requested_price);
  if (price == null || price <= 0) {
    missingRequired += 1;
    notes.push('قیمت فایل ثبت نشده — نیاز به بررسی');
    return { value: 0.5, active: true, activeFraction: 1, positives, warnings, unverifiable: notes, missingRequired};
  }
  const fit = fitValue(price, lo, hi, property.negotiable);
  if (fit.above) {
    warnings.push(`قیمت ${pct(fit.d)}٪ بالاتر از سقف بودجه (${formatMoneyShort(price)} در برابر ${formatMoneyShort(hi)})${property.negotiable ? ' — قابل مذاکره' : ''}`);
  } else if (fit.below) {
    notes.push(`قیمت پایین‌تر از کف بودجه (${formatMoneyShort(price)} در بازهٔ ${rangeStr(lo, hi)})`);
  } else {
    positives.push(`قیمت داخل بودجه (${formatMoneyShort(price)} در بازهٔ ${rangeStr(lo, hi)})`);
  }
  return { value: fit.value, active: true, activeFraction: 1, positives, warnings, unverifiable: notes, missingRequired};
}

// ---- مؤلفهٔ Location (لولهٔ سلسله‌مراتبی §۹) ----

function locationScore(customer: Customer, property: Property): ComponentResult {
  const pp = (customer.property_preferences ?? null) as Record<string, unknown> | null;
  const loc = (pp?.location ?? null) as { county_id?: string; neighborhood_id?: string } | null;
  const cCounty = loc?.county_id || null;
  const cHood = loc?.neighborhood_id || null;
  const cCities = (customer.preferred_city_ids ?? []).filter(Boolean);
  const cProvinces = (customer.preferred_province_ids ?? []).filter(Boolean);

  const positives: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  let missingRequired = 0;

  const active = Boolean(cCounty || cHood || cCities.length > 0);
  if (!active) {
    notes.push('مشتری موقعیتی ثبت نکرده');
    return { value: LOCATION_SCORES.noLocation, active: false, activeFraction: 0, positives, warnings, unverifiable: notes, missingRequired: 0 };
  }

  const pCounty = property.county_id || null;
  const pCity = property.city_id || null;
  const pHood = property.neighborhood_id || null;
  const pProvince = property.province_id || null;

  // (رد شده‌ها در فاز ۲ REJECT شده‌اند — اینجا فقط موارد سازگار می‌مانند)
  if (cHood && pHood && cHood === pHood) {
    positives.push('محلهٔ موردنظر');
    return { value: LOCATION_SCORES.sameHood, active: true, activeFraction: 1, positives, warnings, unverifiable: notes, missingRequired: 0 };
  }
  if (cCounty && pCounty && cCounty === pCounty) {
    if (!pCity) {
      positives.push('همان شهرستان (شهر فایل نامشخص)');
      return { value: LOCATION_SCORES.sameCountyCityUnknown, active: true, activeFraction: 1, positives, warnings, unverifiable: notes, missingRequired: 0 };
    }
    positives.push(cCities.length > 0 && cCities.includes(pCity) ? 'همان شهرستان (شهر در محدودهٔ مشتری)' : 'همان شهرستان');
    return { value: LOCATION_SCORES.sameCountyCityOk, active: true, activeFraction: 1, positives, warnings, unverifiable: notes, missingRequired: 0 };
  }
  // شهر فایل در لیست مشتری (شهرستان فایل نامشخص، یا مشتری اصلاً شهرستانی نگفته)
  if (pCity && cCities.length > 0 && cCities.includes(pCity)) {
    positives.push('شهر در محدودهٔ مشتری');
    return { value: LOCATION_SCORES.countyUnknownCityInList, active: true, activeFraction: 1, positives, warnings, unverifiable: notes, missingRequired: 0 };
  }
  if (!pCounty && !pCity && pProvince) {
    // فقط استان قابل مشاهده است — تطبیق استان به‌تنهایی قوی نیست (رفع شکایت «فاصله جغرافیایی»)
    missingRequired += 1;
    const provinceOk = cProvinces.length === 0 || cProvinces.includes(pProvince);
    warnings.push('فاصله جغرافیایی — فقط استان فایل مشخص است');
    return { value: provinceOk ? LOCATION_SCORES.provinceOnly : LOCATION_SCORES.provinceMismatch, active: true, positives, warnings, unverifiable: notes, missingRequired, activeFraction: 1 };
  }
  if (!pCounty && !pCity && !pHood) {
    missingRequired += 1;
    notes.push('موقعیت فایل ثبت نشده — نیاز به بررسی');
    return { value: LOCATION_SCORES.noLocation, active: true, positives, warnings, unverifiable: notes, missingRequired, activeFraction: 1 };
  }
  notes.push('موقعیت فایل کامل ثبت نشده — تطبیق کامل ممکن نیست');
  return { value: LOCATION_SCORES.noLocation, active: true, positives, warnings, unverifiable: notes, missingRequired, activeFraction: 1 };
}

// ---- مؤلفهٔ Physical (متراژ/اتاق/طبقه) ----

function physicalScore(customer: Customer, property: Property, bestType: string | null): ComponentResult {
  const positives: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  let missingRequired = 0;
  const isLand = LAND_AREA_TYPES.includes(property.property_type);
  const isIndustrial = ['factory', 'workshop', 'industrial_unit', 'warehouse', 'garage'].includes(property.property_type);

  const subs: { w: number; value: number }[] = [];

  // --- متراژ ---
  if (isIndustrial) {
    const loL = toNum(firstPrefValue(customer, bestType, 'min_land_area'));
    const hiL = toNum(firstPrefValue(customer, bestType, 'max_land_area'));
    const loH = toNum(firstPrefValue(customer, bestType, 'min_hall_area'));
    if (loL != null || hiL != null || loH != null) {
      const parts: number[] = [];
      const land = toNum(property.land_area);
      if ((loL != null || hiL != null) && land != null && land > 0) {
        const fit = fitValue(land, loL, hiL, false);
        parts.push(fit.value);
        if (fit.above) warnings.push(`متراژ زمین ${pct(fit.d)}٪ بیشتر از سقف (${formatPrice(land)} در برابر ${formatPrice(hiL)} متری)`);
        else if (fit.below) notes.push(`متراژ زمین کمتر از کف (${formatPrice(land)} در برابر ${formatPrice(loL)} متری)`);
        else positives.push(`متراژ زمین مناسب (${formatPrice(land)} متری)`);
      } else if (land == null || land <= 0) {
        missingRequired += 1;
        notes.push('متراژ زمین فایل ثبت نشده — نیاز به بررسی');
      }
      const hall = toNum(property.building_area);
      if (loH != null && hall != null && hall > 0) {
        const fit = fitValue(hall, loH, null, false);
        parts.push(fit.value);
        if (fit.below) warnings.push(`سالن کوچک‌تر از حداقل درخواستی (${formatPrice(hall)} در برابر ${formatPrice(loH)} متری)`);
        else positives.push(`سالن به اندازهٔ درخواست (${formatPrice(hall)} متری)`);
      } else if (loH != null && (hall == null || hall <= 0)) {
        missingRequired += 1;
        notes.push('متراژ سالن فایل ثبت نشده — نیاز به بررسی');
      }
      subs.push({ w: PHYSICAL_SUB_WEIGHTS.area, value: parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.5 });
    }
  } else {
    const lo = toNum(firstPrefValue(customer, bestType, 'min_area'));
    const hi = toNum(firstPrefValue(customer, bestType, 'max_area'));
    if (lo != null || hi != null) {
      const building = toNum(property.building_area);
      const land = toNum(property.land_area);
      const area = isLand ? land : building && building > 0 ? building : land; // #۸: برای آپارتمان اولویت با زیربنا
      if (area != null && area > 0) {
        const fit = fitValue(area, lo, hi, false);
        subs.push({ w: PHYSICAL_SUB_WEIGHTS.area, value: fit.value });
        if (fit.above) warnings.push(`متراژ ${pct(fit.d)}٪ بیشتر از سقف (${formatPrice(area)} در برابر ${formatPrice(hi)} متری)`);
        else if (fit.below) notes.push(`متراژ کمتر از کف درخواستی (${formatPrice(area)} در برابر ${formatPrice(lo)} متری)`);
        else positives.push(`متراژ مناسب (${formatPrice(area)} متری)`);
      } else {
        missingRequired += 1;
        notes.push('متراژ فایل ثبت نشده — نیاز به بررسی');
      }
    }
  }

  // --- اتاق ---
  const minRooms = toNum(firstPrefValue(customer, bestType, 'min_rooms'));
  if (minRooms != null) {
    const propRooms = toNum(property.bedrooms ?? property.rooms); // قرارداد #۶
    if (propRooms != null) {
      const shortfall = minRooms - propRooms;
      if (shortfall >= 1) {
        subs.push({ w: PHYSICAL_SUB_WEIGHTS.rooms, value: ROOMS_SHORTFALL_1_SCORE });
        warnings.push(`یک اتاق کمتر از حداقل درخواستی (${formatPrice(propRooms)} در برابر ${formatPrice(minRooms)} خواب)`);
      } else {
        subs.push({ w: PHYSICAL_SUB_WEIGHTS.rooms, value: 1.0 });
        positives.push(`حداقل تعداد خواب رعایت شده (${formatPrice(propRooms)} خواب)`);
      }
    } else {
      missingRequired += 1;
      notes.push('تعداد اتاق فایل ثبت نشده — نیاز به بررسی');
    }
  }

  // --- طبقه ---
  const prefFloor = toNum(firstPrefValue(customer, bestType, 'preferred_floor')) ?? (customer.preferred_floor > 0 ? customer.preferred_floor : null);
  if (prefFloor != null) {
    const propFloor = toNum(property.floor);
    if (propFloor != null) {
      const diff = Math.abs(propFloor - prefFloor);
      subs.push({
        w: PHYSICAL_SUB_WEIGHTS.floor,
        value: diff === 0 ? FLOOR_FIT.exact : diff === 1 ? FLOOR_FIT.adjacent : FLOOR_FIT.far,
      });
      if (diff === 0) positives.push(`طبقهٔ موردنظر (طبقهٔ ${formatPrice(propFloor)})`);
      else warnings.push(`طبقهٔ فایل ${formatPrice(propFloor)} — طبقهٔ موردنظر ${formatPrice(prefFloor)}`);
    } else {
      missingRequired += 1;
      notes.push('طبقهٔ فایل ثبت نشده — نیاز به بررسی');
    }
  }

  if (subs.length === 0) {
    return { value: 0.5, active: false, activeFraction: 0, positives, warnings, unverifiable: notes, missingRequired};
  }
  const value = subs.reduce((s, x) => s + x.w * x.value, 0) / subs.reduce((s, x) => s + x.w, 0);
  return { value, active: true, activeFraction: subs.reduce((s, x) => s + x.w, 0), positives, warnings, unverifiable: notes, missingRequired};
}

// ---- مؤلفهٔ Features ----

const FEATURE_LABELS: Record<string, string> = {
  parking: 'پارکینگ', storage: 'انباری', elevator: 'آسانسور', balcony: 'بالکن',
  yard: 'حیاط', garden: 'باغ', pool: 'استخر', security: 'امنیت',
  fireplace: 'آتشکده', fountain: 'آبنما', jacuzzi: 'جکوزی', gazebo: 'آلاچیق',
  bbq: 'باربیکیو', sauna: 'سونا', caretaker: 'سرایدری', mezzanine: 'بالکن تجاری',
  electric_shutter: 'کرکره برقی', signage: 'تابلوخور', restroom: 'سرویس بهداشتی',
  walled: 'چهاردیواری', water_well: 'چاه آب', office_space: 'فضای اداری',
  ceiling_crane: 'جرثقیل سقفی', water: 'آب', electricity: 'برق', gas: 'گاز',
};

function featuresScore(customer: Customer, property: Property, bestType: string | null): ComponentResult {
  const positives: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  const requested = Object.keys(FEATURE_WEIGHTS).filter(
    (k) => firstPrefValue(customer, bestType, k) === true,
  );
  if (requested.length === 0) {
    return { value: 0.5, active: false, activeFraction: 0, positives, warnings, unverifiable: notes, missingRequired: 0 };
  }

  let earned = 0;
  let total = 0;
  const has: string[] = [];
  const missing: string[] = [];
  const unverifiable: string[] = [];
  for (const k of requested) {
    const w = FEATURE_WEIGHTS[k] ?? 1;
    total += w;
    const col = VERIFIABLE_FEATURES[k];
    if (col) {
      const v = (property as unknown as Record<string, unknown>)[col];
      if (v === true) {
        earned += w;
        has.push(FEATURE_LABELS[k] ?? k);
      } else if (v === false) {
        missing.push(FEATURE_LABELS[k] ?? k);
      } else {
        earned += w * 0.5; // ثبت نشده (نه «ندارد»)
        notes.push(`${FEATURE_LABELS[k] ?? k} در فایل ثبت نشده`);
      }
    } else {
      earned += w * 0.5; // ستون در فایل وجود ندارد
      unverifiable.push(`${FEATURE_LABELS[k] ?? k} در فایل قابل تأیید نیست`);
    }
  }
  if (has.length > 0) positives.push(has.join('، '));
  if (missing.length > 0) warnings.push(`بدون ${missing.join('، ')}`);

  return { value: total > 0 ? earned / total : 0.5, active: true, activeFraction: 1, positives, warnings, unverifiable, missingRequired: 0 };
}

// ---- تجمیع (فرمول §۶) ----

export interface ScoredPart {
  score: number;
  tier: 'excellent' | 'good' | 'fair' | 'weak' | 'hidden';
  confidence: 'high' | 'medium' | 'low';
  components: ScoredComponent[];
  explanation: MatchExplanation;
  caps: ('SUBSTITUTE_PROPERTY_TYPE' | 'INCOMPLETE_PROPERTY_DATA')[];
}

export function calculateScore(
  customer: Customer,
  property: Property,
  elig: MatchEligibilityOutput,
): ScoredPart {
  const bestType = elig.metadata.bestType;

  const core = coreScore(elig, property);
  const financial = financialScore(customer, property, bestType);
  const location = locationScore(customer, property);
  const physical = physicalScore(customer, property, bestType);
  const features = featuresScore(customer, property, bestType);

  const all = { core, financial, location, physical, features };
  const keys: (keyof typeof all)[] = ['core', 'financial', 'location', 'physical', 'features'];
  const labels: Record<keyof typeof all, string> = {
    core: 'نوع ملک',
    financial: 'مالی',
    location: 'موقعیت',
    physical: 'فیزیکی',
    features: 'امکانات',
  };

  // فرمول: مخرج همیشه 100؛ مؤلفهٔ غیرفعال = 0.5 خنثی
  let score = 0;
  let activeWeight = 0;
  const components: ScoredComponent[] = [];
  for (const k of keys) {
    const c = all[k];
    const w = SCORE_WEIGHTS[k];
    score += w * (c.active ? c.value : 0.5);
    if (c.active) activeWeight += w * c.activeFraction;
    components.push({
      key: k,
      label: labels[k],
      weight: w,
      value: Math.round((c.active ? c.value : 0.5) * 1000) / 1000,
      active: c.active,
    });
  }

  // سقف‌ها
  const caps: ScoredPart['caps'] = [];
  if (elig.metadata.isSubstitutePropertyType) {
    caps.push('SUBSTITUTE_PROPERTY_TYPE');
  }
  const missingRequired = keys.reduce((s, k) => s + all[k].missingRequired, 0);
  if (missingRequired >= INCOMPLETE_DATA_THRESHOLD) {
    caps.push('INCOMPLETE_PROPERTY_DATA');
  }
  if (caps.includes('INCOMPLETE_PROPERTY_DATA')) score = Math.min(score, INCOMPLETE_DATA_CAP);
  if (caps.includes('SUBSTITUTE_PROPERTY_TYPE')) score = Math.min(score, SUBSTITUTE_SCORE_CAP);
  score = Math.max(0, Math.min(100, Math.round(score)));

  // تیر
  let tier: ScoredPart['tier'] = 'hidden';
  if (score >= TIER_THRESHOLDS.excellent) tier = 'excellent';
  else if (score >= TIER_THRESHOLDS.good) tier = 'good';
  else if (score >= TIER_THRESHOLDS.fair) tier = 'fair';
  else if (score >= TIER_THRESHOLDS.weak) tier = 'weak';

  // اعتماد (trust = وزن مؤلفه‌های فعال / 100)
  const trust = activeWeight / 100;
  const confidence: ScoredPart['confidence'] =
    trust >= CONFIDENCE_THRESHOLDS.high ? 'high' : trust >= CONFIDENCE_THRESHOLDS.medium ? 'medium' : 'low';

  // توضیح — هم‌زمان با محاسبه تولید شده (نه ساختگی)
  const explanation: MatchExplanation = {
    positives: keys.flatMap((k) => all[k].positives),
    warnings: caps.flatMap((c) =>
      c === 'SUBSTITUTE_PROPERTY_TYPE'
        ? []
        : c === 'INCOMPLETE_PROPERTY_DATA'
          ? ['اطلاعات فایل ناقص است']
          : [],
    ).concat(keys.flatMap((k) => all[k].warnings)),
    unverifiable: keys.flatMap((k) => all[k].unverifiable),
  };

  return { score, tier, confidence, components, explanation, caps };
}
