// موتور تطبیق — نقطهٔ ورود: `matchEligibility`
// فاز ۱ (سخت) و سپس فاز ۲ (قوی). امتیازدهی/رتبه‌بندی/نمایش (فاز ۳) جداست.

import { evaluateHardCompatibility } from './hard';
import { evaluateStrongConstraints } from './constraints';
import { type MatchEligibilityOutput } from './types';
import type { Customer, Property } from '@/lib/types';

export function matchEligibility(customer: Customer, property: Property): MatchEligibilityOutput {
  const hardResult = evaluateHardCompatibility(customer, property);

  // رد در فاز ۱ → STOP (فاصلهٔ فاز ۲ اصلاً محاسبه نمی‌شود)
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
      distances: strong.distances,
    },
  };
}

export { RejectionReason, WarningCode } from './types';
export * from './config';
export type * from './types';
