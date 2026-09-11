// موتور تطبیق — فاز ۱: سازگاری سخت (Hard Compatibility)
// ترتیب بررسی: ۱) نوع معامله+نقش ۲) دسته ۳) نوع ملک. هر REJECT یعنی STOP.

import { TRANSACTION_MATRIX, TYPE_LEVELS, typeCompatibility } from './config';
import {
  RejectionReason,
  WarningCode,
  type ConstraintStatus,
  type HardCompatibilityResult,
  type RejectionReasonCode,
  type WarningCodeValue,
} from './types';
import type { Customer, Property } from '@/lib/types';

export interface HardResult {
  /** PASS = مرحلهٔ بعد مجاز؛ REJECT = رد قطعی؛ UNKNOWN = پروفایل مشتری ناقص (محاسبه‌شدنی نیست) */
  status: 'PASS' | 'REJECT' | 'UNKNOWN';
  hard: HardCompatibilityResult;
  rejectionReason: RejectionReasonCode | null;
  warnings: WarningCodeValue[];
  /** نوع ملکِ مشتری که بهترین سازگاری را با فایل دارد (برای خواندن ترجیحات در فاز ۲) */
  bestCustomerType: string | null;
  compatibilityFactor: number | null;
}

const EMPTY_HARD: HardCompatibilityResult = {
  transaction: 'UNKNOWN',
  category: 'UNKNOWN',
  propertyType: 'UNKNOWN',
  compatibilityFactor: null,
  isSubstitutePropertyType: false,
};

/**
 * بهترین نوع ملک مشتری در برابر نوع فایل.
 * مشتری بدون نوع = بدون محدودیت (عامل 1.0؛ فقط دسته بررسی می‌شود).
 */
export function bestTypeMatch(customer: Customer, propertyType: string): { factor: number; type: string | null } {
  const types = customer.preferred_property_types ?? [];
  if (types.length === 0) return { factor: TYPE_LEVELS.EXACT, type: null };
  let factor = 0;
  let type: string | null = null;
  for (const t of types) {
    const f = typeCompatibility(t, propertyType);
    if (f > factor) {
      factor = f;
      type = t;
    }
  }
  return { factor, type };
}

export function evaluateHardCompatibility(customer: Customer, property: Property): HardResult {
  const warnings: WarningCodeValue[] = [];

  // ---- ۱. نوع معامله + نقش طرفین (ماتریس دوطرفه) ----
  const cTx = customer.transaction_intention;
  const cRole = customer.transaction_role;
  if (!cTx || !cRole) {
    return {
      status: 'UNKNOWN',
      hard: EMPTY_HARD,
      rejectionReason: RejectionReason.INCOMPLETE_CUSTOMER_PROFILE,
      warnings,
      bestCustomerType: null,
      compatibilityFactor: null,
    };
  }
  const allowed = TRANSACTION_MATRIX[cTx]?.[cRole] ?? [];
  const propKey = `${property.transaction_type}.${property.transaction_role}`;
  if (!allowed.includes(propKey)) {
    return {
      status: 'REJECT',
      hard: { ...EMPTY_HARD, transaction: 'REJECT' },
      rejectionReason: RejectionReason.TRANSACTION_INCOMPATIBLE,
      warnings,
      bestCustomerType: null,
      compatibilityFactor: null,
    };
  }

  // ---- ۲. سازگاری نوع ملک (بهترین جفت بین لیست مشتری و نوع فایل) ----
  const { factor, type } = bestTypeMatch(customer, property.property_type);
  const isSubstitute = factor === TYPE_LEVELS.SUBSTITUTE;
  if (isSubstitute) warnings.push(WarningCode.PROPERTY_TYPE_SUBSTITUTE);

  // ---- ۳. دسته ----
  // تساوی دقیق؛ یا استثنایی که در جدول سازگاری نوع صریحاً تعریف شده (مثل آپارتمان اداری↔آپارتمان)
  let category: ConstraintStatus;
  if (!customer.preferred_category) {
    return {
      status: 'UNKNOWN',
      hard: { ...EMPTY_HARD, transaction: 'PASS' },
      rejectionReason: RejectionReason.INCOMPLETE_CUSTOMER_PROFILE,
      warnings,
      bestCustomerType: type,
      compatibilityFactor: factor,
    };
  }
  if (customer.preferred_category === property.category) category = 'PASS';
  else if (factor > 0) category = 'PASS';
  else category = 'REJECT';
  if (category === 'REJECT') {
    return {
      status: 'REJECT',
      hard: { ...EMPTY_HARD, transaction: 'PASS', category: 'REJECT', compatibilityFactor: 0 },
      rejectionReason: RejectionReason.CATEGORY_INCOMPATIBLE,
      warnings,
      bestCustomerType: type,
      compatibilityFactor: 0,
    };
  }

  // ---- ۴. نوع ملک ----
  // مشتری بدون نوع = بدون محدودیت؛ وگرنه ضریب 0 = REJECT
  const propertyType: ConstraintStatus =
    factor > 0 || (customer.preferred_property_types ?? []).length === 0 ? 'PASS' : 'REJECT';
  if (propertyType === 'REJECT') {
    return {
      status: 'REJECT',
      hard: { ...EMPTY_HARD, transaction: 'PASS', category: 'PASS', propertyType: 'REJECT', compatibilityFactor: 0 },
      rejectionReason: RejectionReason.PROPERTY_TYPE_INCOMPATIBLE,
      warnings,
      bestCustomerType: null,
      compatibilityFactor: 0,
    };
  }

  return {
    status: 'PASS',
    hard: {
      transaction: 'PASS',
      category,
      propertyType,
      compatibilityFactor: factor,
      isSubstitutePropertyType: isSubstitute,
    },
    rejectionReason: null,
    warnings,
    bestCustomerType: type,
    compatibilityFactor: factor,
  };
}
