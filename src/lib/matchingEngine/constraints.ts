// موتور تطبیق — فاز ۲: محدودیت‌های قوی (Strong Constraints)
// هر محدودیت یکی از PASS / WARNING / REJECT / UNKNOWN دارد.
// UNKNOWN هرگز به REJECT تبدیل نمی‌شود (دادهٔ ناقص ≠ عدم تطبیق).

import { INDUSTRIAL_BUILDING_TYPES, LAND_AREA_TYPES, STRONG_THRESHOLDS } from './config';
import { firstPrefValue, positiveNum, toNum } from './prefUtils';
import { RejectionReason, WarningCode, type ConstraintStatus, type RejectionReasonCode, type WarningCodeValue } from './types';
import type { Customer, Property } from '@/lib/types';

// ---- ابزار محلی ----

export interface ConstraintOutcome {
  status: ConstraintStatus;
  code: RejectionReasonCode | null;
  warnings: WarningCodeValue[];
  /** فاصلهٔ خام برای فاز ۳ (مثلاً 0.2 یعنی ۲۰٪ خارج از بازه) */
  distance: number | null;
}

const UNKNOWN: ConstraintOutcome = { status: 'UNKNOWN', code: null, warnings: [], distance: null };
const worst = (a: ConstraintStatus, b: ConstraintStatus): ConstraintStatus =>
  a === 'REJECT' || b === 'REJECT' ? 'REJECT' : a === 'WARNING' || b === 'WARNING' ? 'WARNING' : a === 'PASS' || b === 'PASS' ? 'PASS' : 'UNKNOWN';

/**
 * تابع فاصلهٔ عمومی برای مقایسهٔ مقدار فایل با بازهٔ مشتری.
 * - داخل بازه → PASS
 * - بالای سقف: عبور ≥ veto → REJECT، وگرنه WARNING
 * - پایین کف: WARNING (در v1 رد نمی‌شود — فایل ارزان‌تر هنوز قابل معامله است)
 */
function rangeFit(value: number, lo: number | null, hi: number | null, veto: number): { status: ConstraintStatus; above: boolean; below: boolean; d: number } {
  if (hi != null && value > hi) {
    const d = (value - hi) / hi;
    if (d >= veto) return { status: 'REJECT', above: true, below: false, d };
    return { status: 'WARNING', above: true, below: false, d };
  }
  if (lo != null && value < lo) {
    const d = (lo - value) / lo;
    return { status: 'WARNING', above: false, below: true, d };
  }
  return { status: 'PASS', above: false, below: false, d: 0 };
}

// ---- ۱. مالی (قیمت/ودیعه/اجاره) ----

function financialConstraint(customer: Customer, property: Property, bestType: string | null): ConstraintOutcome {
  const tx = customer.transaction_intention;
  if (tx === 'partnership') return { ...UNKNOWN }; // منطق شراکت جداست

  if (tx === 'rent') {
    const veto = property.negotiable ? STRONG_THRESHOLDS.moneyVetoNegotiable : STRONG_THRESHOLDS.moneyVetoNormal;
    const depositLo = toNum(firstPrefValue(customer, bestType, 'deposit_min'));
    const depositHi = toNum(firstPrefValue(customer, bestType, 'deposit_max'));
    const rentLo = toNum(firstPrefValue(customer, bestType, 'rent_min'));
    const rentHi = toNum(firstPrefValue(customer, bestType, 'rent_max'));
    const propDeposit = positiveNum(property.deposit_price);
    const propRent = positiveNum(property.monthly_rent);

    let dep: ConstraintOutcome = { ...UNKNOWN };
    // ودیعهٔ صفر/غیرثبت در فایل = اجارهٔ خالص ماهانه → زیرمقدار ودیعه حذف می‌شود (نه جریمه)
    if (propDeposit != null && (depositLo != null || depositHi != null)) {
      const fit = rangeFit(propDeposit, depositLo, depositHi, veto);
      dep = {
        status: fit.status,
        code: fit.status === 'REJECT' ? RejectionReason.DEPOSIT_TOO_HIGH : null,
        warnings: fit.above ? [WarningCode.DEPOSIT_ABOVE_MAX] : [],
        distance: fit.d || null,
      };
    }
    let rent: ConstraintOutcome = { ...UNKNOWN };
    if (propRent != null && (rentLo != null || rentHi != null)) {
      const fit = rangeFit(propRent, rentLo, rentHi, veto);
      rent = {
        status: fit.status,
        code: fit.status === 'REJECT' ? RejectionReason.RENT_TOO_HIGH : null,
        warnings: fit.above ? [WarningCode.RENT_ABOVE_MAX] : [],
        distance: fit.d || null,
      };
    }
    return {
      status: worst(dep.status, rent.status),
      code: dep.code ?? rent.code,
      warnings: [...dep.warnings, ...rent.warnings],
      distance: dep.distance ?? rent.distance,
    };
  }

  // خرید / فروش
  const lo = toNum(firstPrefValue(customer, bestType, 'budget_min'));
  const hi = toNum(firstPrefValue(customer, bestType, 'budget_max'));
  if (lo == null && hi == null) return { ...UNKNOWN };
  const price = positiveNum(property.sale_price) ?? positiveNum(property.owner_requested_price);
  if (price == null) return { ...UNKNOWN }; // قیمت در فایل ثبت نشده

  const veto = property.negotiable ? STRONG_THRESHOLDS.moneyVetoNegotiable : STRONG_THRESHOLDS.moneyVetoNormal;
  const fit = rangeFit(price, lo, hi, veto);
  return {
    status: fit.status,
    code: fit.status === 'REJECT' ? RejectionReason.BUDGET_TOO_HIGH : null,
    warnings: fit.above ? [WarningCode.BUDGET_ABOVE_MAX] : fit.below ? [WarningCode.BUDGET_BELOW_MIN] : [],
    distance: fit.d || null,
  };
}

// ---- ۲. متراژ ----

function areaConstraint(customer: Customer, property: Property, bestType: string | null): ConstraintOutcome {
  const t = property.property_type;
  const land = positiveNum(property.land_area);
  const building = positiveNum(property.building_area);
  const isLand = LAND_AREA_TYPES.includes(t);
  const isIndustrial = INDUSTRIAL_BUILDING_TYPES.includes(t);
  const moneyVeto = STRONG_THRESHOLDS.areaVeto;

  const subs: ConstraintOutcome[] = [];

  if (isIndustrial) {
    // بازهٔ زمین
    const loL = toNum(firstPrefValue(customer, bestType, 'min_land_area'));
    const hiL = toNum(firstPrefValue(customer, bestType, 'max_land_area'));
    if (land != null && (loL != null || hiL != null)) {
      const fit = rangeFit(land, loL, hiL, moneyVeto);
      subs.push({
        status: fit.status,
        code: fit.status === 'REJECT' ? RejectionReason.AREA_TOO_LARGE : null,
        warnings: fit.above ? [WarningCode.AREA_ABOVE_MAX] : fit.below ? [WarningCode.AREA_BELOW_MIN] : [],
        distance: fit.d || null,
      });
    }
    // بازهٔ سالن
    const loH = toNum(firstPrefValue(customer, bestType, 'min_hall_area'));
    if (building != null && loH != null) {
      const fit = rangeFit(building, loH, null, moneyVeto);
      subs.push({
        status: fit.status,
        code: fit.status === 'REJECT' ? RejectionReason.AREA_TOO_LARGE : null,
        warnings: fit.below ? [WarningCode.AREA_BELOW_MIN] : [],
        distance: fit.d || null,
      });
    }
  } else {
    const comparable = isLand ? land : building ?? land;
    const lo = toNum(firstPrefValue(customer, bestType, 'min_area'));
    const hi = toNum(firstPrefValue(customer, bestType, 'max_area'));
    if (comparable != null && (lo != null || hi != null)) {
      const fit = rangeFit(comparable, lo, hi, moneyVeto);
      subs.push({
        status: fit.status,
        code: fit.status === 'REJECT' ? RejectionReason.AREA_TOO_LARGE : null,
        warnings: fit.above ? [WarningCode.AREA_ABOVE_MAX] : fit.below ? [WarningCode.AREA_BELOW_MIN] : [],
        distance: fit.d || null,
      });
    }
  }

  if (subs.length === 0) return { ...UNKNOWN };
  return subs.reduce((acc, s) => ({
    status: worst(acc.status, s.status),
    code: s.code ?? acc.code,
    warnings: [...acc.warnings, ...s.warnings],
    distance: s.distance ?? acc.distance,
  }));
}

// ---- ۳. اتاق ----

function roomsConstraint(customer: Customer, property: Property, bestType: string | null): ConstraintOutcome {
  const minRooms = toNum(firstPrefValue(customer, bestType, 'min_rooms'));
  if (minRooms == null) return { ...UNKNOWN };
  // صفر در اتاق یک مقدار است (0 خواب)؛ null = ثبت نشده
  const propRooms = toNum(property.bedrooms ?? property.rooms);
  if (propRooms == null) return { ...UNKNOWN };
  const shortfall = minRooms - propRooms;
  if (shortfall >= STRONG_THRESHOLDS.roomsShortfallReject) {
    return { status: 'REJECT', code: RejectionReason.INSUFFICIENT_ROOMS, warnings: [], distance: shortfall };
  }
  if (shortfall >= 1) {
    return { status: 'WARNING', code: null, warnings: [WarningCode.ONE_ROOM_SHORT], distance: shortfall };
  }
  return { status: 'PASS', code: null, warnings: [], distance: 0 };
}

// ---- ۴. موقعیت (سلسله‌مراتبی؛ بدون خیابان — ستون در دیتابیس نیست) ----

function locationConstraint(customer: Customer, property: Property): ConstraintOutcome {
  const pp = (customer.property_preferences ?? null) as Record<string, unknown> | null;
  const loc = (pp?.location ?? null) as { county_id?: string; neighborhood_id?: string; city_id?: string } | null;
  const cCounty = loc?.county_id || null;
  const cHood = loc?.neighborhood_id || null;
  const cCity = loc?.city_id || null;
  const cCities = (customer.preferred_city_ids ?? []).filter(Boolean);

  if (!cCounty && !cHood && !cCity && cCities.length === 0) return { ...UNKNOWN };

  const pCounty = property.county_id || null;
  const pCity = property.city_id || null;
  const pHood = property.neighborhood_id || null;

  // اختلاف شناخته‌شده = خارج از محدودهٔ درخواست
  if (cCounty && pCounty && cCounty !== pCounty) {
    return { status: 'REJECT', code: RejectionReason.LOCATION_OUTSIDE_REQUEST, warnings: [], distance: null };
  }
  if (cHood && pHood && cHood !== pHood) {
    return { status: 'REJECT', code: RejectionReason.LOCATION_OUTSIDE_REQUEST, warnings: [], distance: null };
  }
  if (cCity && pCity && cCity !== pCity) {
    return { status: 'REJECT', code: RejectionReason.LOCATION_OUTSIDE_REQUEST, warnings: [], distance: null };
  }
  if (cCities.length > 0 && pCity && !cCities.includes(pCity)) {
    return { status: 'REJECT', code: RejectionReason.LOCATION_OUTSIDE_REQUEST, warnings: [], distance: null };
  }

  // موقعیت فایل اصلاً ثبت نشده
  if (!pCounty && !pCity && !pHood) return { ...UNKNOWN };

  // تطبیق در سطح شهرستان (یا عمیق‌تر)
  if (pCounty && cCounty && pCounty === cCounty) return { status: 'PASS', code: null, warnings: [], distance: 0 };

  // شهرستان فایل نامشخص ولی شهرش با انتخاب مشتری هم‌خوان است
  if (!pCounty && pCity) {
    if (cCities.length > 0 && cCities.includes(pCity)) return { status: 'PASS', code: null, warnings: [], distance: 0 };
    if (cCity && cCity === pCity) return { status: 'PASS', code: null, warnings: [], distance: 0 };
    return { ...UNKNOWN };
  }

  return { ...UNKNOWN };
}

// ---- ۵. شراکت ----

function partnershipConstraint(customer: Customer, property: Property, bestType: string | null): ConstraintOutcome {
  if (customer.transaction_intention !== 'partnership') return { ...UNKNOWN };
  // مشتریِ مالک زمین: ارزش زمینش؛ مشتریِ سازنده: سقف بودجهٔ ساخت
  const custVal = customer.transaction_role === 'builder'
    ? toNum(firstPrefValue(customer, bestType, 'construction_budget_max')) ?? toNum(firstPrefValue(customer, bestType, 'construction_budget_min'))
    : toNum(firstPrefValue(customer, bestType, 'land_value'));
  const propVal = positiveNum(property.participation_price);
  if (custVal == null || propVal == null) return { ...UNKNOWN };
  const min = Math.min(custVal, propVal);
  const max = Math.max(custVal, propVal);
  const ratio = min > 0 ? max / min : null;
  if (ratio != null && ratio > STRONG_THRESHOLDS.partnershipRatioWarn) {
    return {
      status: 'WARNING',
      code: null,
      warnings: [WarningCode.PARTNERSHIP_VALUE_GAP],
      distance: ratio,
    };
  }
  return { status: 'PASS', code: null, warnings: [], distance: ratio };
}

// ---- ۶. مجوز / تجاری (فایل ستون ندارد → قابل تأیید نیست) ----

function permitCommercialConstraint(customer: Customer, property: Property, bestType: string | null): ConstraintOutcome {
  const needsPermit = firstPrefValue(customer, bestType, 'needs_permit') === true;
  const hasCommercial = firstPrefValue(customer, bestType, 'has_commercial') === true;
  if (!needsPermit && !hasCommercial) return { status: 'PASS', code: null, warnings: [], distance: null };
  // فایل هیچ ستونی برای جواز/تجاری ندارد → دادهٔ ناقص هرگز REJECT نمی‌شود
  const warnings: WarningCodeValue[] = [];
  if (needsPermit) warnings.push(WarningCode.UNVERIFIABLE_PERMIT);
  if (hasCommercial) warnings.push(WarningCode.UNVERIFIABLE_COMMERCIAL);
  return { status: 'WARNING', code: null, warnings, distance: null };
}

// ---- تجمیع ----

export interface StrongResult extends Record<'financial' | 'area' | 'rooms' | 'location' | 'partnership' | 'permitCommercial', ConstraintOutcome> {
  rejectedCode: RejectionReasonCode | null;
  warnings: WarningCodeValue[];
  distances: Record<string, number | null>;
}

export function evaluateStrongConstraints(customer: Customer, property: Property, bestCustomerType: string | null): StrongResult {
  const financial = financialConstraint(customer, property, bestCustomerType);
  const area = areaConstraint(customer, property, bestCustomerType);
  const rooms = roomsConstraint(customer, property, bestCustomerType);
  const location = locationConstraint(customer, property);
  const partnership = partnershipConstraint(customer, property, bestCustomerType);
  const permitCommercial = permitCommercialConstraint(customer, property, bestCustomerType);

  const all = [financial, area, rooms, location, partnership, permitCommercial];
  const rejectedCode = all.find((o) => o.status === 'REJECT')?.code ?? null;

  return {
    financial,
    area,
    rooms,
    location,
    partnership,
    permitCommercial,
    rejectedCode,
    warnings: all.flatMap((o) => o.warnings),
    distances: {
      budget: financial.distance,
      area: area.distance,
      rooms: rooms.distance,
      partnership: partnership.distance,
    },
  };
}
