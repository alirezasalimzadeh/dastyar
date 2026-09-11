// موتور تطبیق — نقطه‌ی ورود
// `matchEligibility` = فاز ۱ (سخت) + فاز ۲ (قوی)
// `scoreMatch` = فاز ۱ + ۲ + ۳ (امتیاز + تیر + اعتماد + توضیح)
// امتیاز فقط برای جفت‌های compatible ساخته می‌شود (REJECT هرگز امتیاز نمی‌گیرد).

import { evaluateHardCompatibility } from './hard';
import { evaluateStrongConstraints } from './constraints';
import { calculateScore } from './score';
import { type MatchEligibilityOutput, type ScoredMatchOutput } from './types';
import type { Customer, Property } from '@/lib/types';

export function matchEligibility(customer: Customer, property: Property): MatchEligibilityOutput {
  const hardResult = evaluateHardCompatibility(customer, property);

  // رد در فاز ۱ → STOP (فاز ۲ اصلاً محاسبه نمی‌شود)
  if (hardResult.status !== 'PASS') {
    return {
      compatible: false,
      hardCompatibility: hardResult.hard,
      strongConstraints: null,
      rejectionReason: hardResult.rejectionReason,
      warnings: hardResult.warnings,
      metadata: {
        isSubstitutePropertyType: false,
        compatibilityFactor: hardResult.compatibilityFactor,
        bestType: hardResult.bestCustomerType,
        distances: {},
      },
    };
  }

  const strong = evaluateStrongConstraints(customer, property, hardResult.bestCustomerType);

  const strongKeys = ['financial', 'area', 'rooms', 'location', 'partnership', 'permitCommercial'] as const;
  const anyReject = strongKeys.some((k) => strong[k].status === 'REJECT');

  return {
    compatible: !anyReject,
    hardCompatibility: hardResult.hard,
    strongConstraints: {
      financial: strong.financial.status,
      area: strong.area.status,
      rooms: strong.rooms.status,
      location: strong.location.status,
      partnership: strong.partnership.status,
      permitCommercial: strong.permitCommercial.status,
    },
    rejectionReason: strong.rejectedCode,
    warnings: [...hardResult.warnings, ...strong.warnings],
    metadata: {
      isSubstitutePropertyType: hardResult.hard.isSubstitutePropertyType,
      compatibilityFactor: hardResult.compatibilityFactor,
      bestType: hardResult.bestCustomerType,
      distances: strong.distances,
    },
  };
}

/** خروجی کامل سه‌فازه: فقط جفت‌های compatible امتیاز/تیر/اعتماد/توضیح می‌گیرند */
export function scoreMatch(customer: Customer, property: Property): ScoredMatchOutput {
  const elig = matchEligibility(customer, property);
  if (!elig.compatible) {
    return { ...elig, score: null, tier: null, confidence: null, components: null, explanation: null, caps: [] };
  }
  return { ...elig, ...calculateScore(customer, property, elig) };
}

/**
 * رتبه‌بندی (§۱۶ سند): جفت‌های ردشده اصلاً وارد لیست نمی‌شوند (نه با امتیاز ۰).
 * score نزولی ← تعداد ⚠ کمتر ← فاصلهٔ مالی کم‌تر.
 */
export function rankMatches<T extends { result: ScoredMatchOutput }>(items: T[]): T[] {
  return items
    .filter((it) => it.result.score != null)
    .sort((a, b) => {
      const sb = b.result.score as number;
      const sa = a.result.score as number;
      if (sb !== sa) return sb - sa;
      const wa = a.result.explanation?.warnings.length ?? 0;
      const wb = b.result.explanation?.warnings.length ?? 0;
      if (wa !== wb) return wa - wb;
      return (a.result.metadata.distances.budget ?? 0) - (b.result.metadata.distances.budget ?? 0);
    });
}

export { calculateScore } from './score';
export { persistMatches } from './persist';
export type { PersistPair, PersistResult } from './persist';
export { RejectionReason, WarningCode } from './types';
export * from './config';
export type * from './types';
