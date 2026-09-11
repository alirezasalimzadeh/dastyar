// موتور تطبیق — فاز ۱: سازگاری سخت (Hard Compatibility)
// ترتیب بررسی: ۱) نوع معامله+نقش ۲) دسته ۳) نوع ملک. هر REJECT یعنی STOP.

import { ROLE_LABELS, TRANSACTION_MATRIX, TYPE_LABELS, TYPE_LEVELS, typeCompatibility } from './config';
import {
  RejectionReason,
  WarningCode,
  type ConstraintStatus,
  type EligibilityLine,
  type HardCompatibilityResult,
  type RejectionReasonCode,
  type WarningCodeValue,
} from './types';
import { getCategoryLabel, getTransactionLabel } from '@/lib/constants';
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
  /** دلایل سازگاری فاز ۱ — هر بعد بررسی‌شده با وضعیت و مقادیر واقعی */
  lines: EligibilityLine[];
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
  const lines: EligibilityLine[] = [];
  const propTypeLabel = TYPE_LABELS[property.property_type] ?? property.property_type;
  const wantedTypes = (customer.preferred_property_types ?? []).filter(Boolean).map((t) => TYPE_LABELS[t] ?? t).join('، ');

  // ---- ۱. نوع معامله + نقش طرفین (ماتریس دوطرفه) ----
  const cTx = customer.transaction_intention;
  const cRole = customer.transaction_role;
  if (!cTx || !cRole) {
    lines.push({ kind: 'INFO', dimension: 'transaction', text: 'پروفایل مشتری ناقص است — نوع معامله یا نقش معامله‌ای ثبت نشده' });
    return {
      status: 'UNKNOWN',
      hard: EMPTY_HARD,
      rejectionReason: RejectionReason.INCOMPLETE_CUSTOMER_PROFILE,
      warnings,
      bestCustomerType: null,
      compatibilityFactor: null,
      lines,
    };
  }
  const allowed = TRANSACTION_MATRIX[cTx]?.[cRole] ?? [];
  const propKey = `${property.transaction_type}.${property.transaction_role}`;
  if (!allowed.includes(propKey)) {
    lines.push({
      kind: 'REJECT',
      dimension: 'transaction',
      text: `نوع معامله سازگار نیست: ${ROLE_LABELS[cRole] ?? cRole} (${getTransactionLabel(cTx)}) ↔ ${ROLE_LABELS[property.transaction_role] ?? property.transaction_role} (${getTransactionLabel(property.transaction_type)})`,
    });
    return {
      status: 'REJECT',
      hard: { ...EMPTY_HARD, transaction: 'REJECT' },
      rejectionReason: RejectionReason.TRANSACTION_INCOMPATIBLE,
      warnings,
      bestCustomerType: null,
      compatibilityFactor: null,
      lines,
    };
  }
  lines.push({ kind: 'PASS', dimension: 'transaction', text: `نوع معامله سازگار: ${getTransactionLabel(cTx)} ↔ ${getTransactionLabel(property.transaction_type)}` });

  // ---- ۲. سازگاری نوع ملک (بهترین جفت بین لیست مشتری و نوع فایل) ----
  const { factor, type } = bestTypeMatch(customer, property.property_type);
  const isSubstitute = factor === TYPE_LEVELS.SUBSTITUTE;
  if (isSubstitute) warnings.push(WarningCode.PROPERTY_TYPE_SUBSTITUTE);

  // ---- ۳. دسته ----
  // تساوی دقیق؛ یا استثنایی که در جدول سازگاری نوع صریحاً تعریف شده (مثل آپارتمان اداری↔آپارتمان)
  let category: ConstraintStatus;
  if (!customer.preferred_category) {
    lines.push({ kind: 'INFO', dimension: 'category', text: 'دستهٔ مورد نظر مشتری ثبت نشده است' });
    return {
      status: 'UNKNOWN',
      hard: { ...EMPTY_HARD, transaction: 'PASS' },
      rejectionReason: RejectionReason.INCOMPLETE_CUSTOMER_PROFILE,
      warnings,
      bestCustomerType: type,
      compatibilityFactor: factor,
      lines,
    };
  }
  if (customer.preferred_category === property.category) {
    category = 'PASS';
    lines.push({ kind: 'PASS', dimension: 'category', text: `دستهٔ ملک مطابق درخواست (${getCategoryLabel(customer.preferred_category)})` });
  } else if (factor > 0) {
    category = 'PASS';
    lines.push({ kind: 'PASS', dimension: 'category', text: `دستهٔ ملک از روی سازگاری نوع تأیید شد (${getCategoryLabel(property.category)})` });
  } else {
    category = 'REJECT';
  }
  if (category === 'REJECT') {
    lines.push({
      kind: 'REJECT',
      dimension: 'category',
      text: `دستهٔ ملک مطابقت ندارد: فایل (${getCategoryLabel(property.category)}) در برابر درخواست (${getCategoryLabel(customer.preferred_category)})`,
    });
    return {
      status: 'REJECT',
      hard: { ...EMPTY_HARD, transaction: 'PASS', category: 'REJECT', compatibilityFactor: 0 },
      rejectionReason: RejectionReason.CATEGORY_INCOMPATIBLE,
      warnings,
      bestCustomerType: type,
      compatibilityFactor: 0,
      lines,
    };
  }

  // ---- ۴. نوع ملک ----
  // مشتری بدون نوع = بدون محدودیت؛ وگرنه ضریب 0 = REJECT
  const propertyType: ConstraintStatus =
    factor > 0 || (customer.preferred_property_types ?? []).length === 0 ? 'PASS' : 'REJECT';
  if (propertyType === 'REJECT') {
    lines.push({
      kind: 'REJECT',
      dimension: 'propertyType',
      text: `نوع ملک سازگار نیست: فایل (${propTypeLabel}) در برابر انواع مورد نظر (${wantedTypes || '—'})`,
    });
    return {
      status: 'REJECT',
      hard: { ...EMPTY_HARD, transaction: 'PASS', category: 'PASS', propertyType: 'REJECT', compatibilityFactor: 0 },
      rejectionReason: RejectionReason.PROPERTY_TYPE_INCOMPATIBLE,
      warnings,
      bestCustomerType: null,
      compatibilityFactor: 0,
      lines,
    };
  }
  if ((customer.preferred_property_types ?? []).length === 0) {
    lines.push({ kind: 'INFO', dimension: 'propertyType', text: 'نوع ملک برای مشتری ثبت نشده — بدون محدودیت نوع' });
  } else if (factor === TYPE_LEVELS.EXACT) {
    lines.push({ kind: 'PASS', dimension: 'propertyType', text: `نوع ملک دقیقاً مطابق درخواست (${propTypeLabel})` });
  } else if (isSubstitute) {
    lines.push({ kind: 'WARNING', dimension: 'propertyType', text: `نوع ملک جایگزین است و تطبیق دقیق نیست (${propTypeLabel})` });
  } else {
    lines.push({ kind: 'WARNING', dimension: 'propertyType', text: `نوع ملک نزدیک به درخواست است (${propTypeLabel})` });
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
    lines,
  };
}
