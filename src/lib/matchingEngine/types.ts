// موتور تطبیق — ساختارهای استاندارد خروجی (فاز ۱ و ۲)
// فاز ۳ (امتیاز 0–100، وزن‌ها، رتبه‌بندی و UI) بعداً از همین خروجی استفاده می‌کند.

export type ConstraintStatus = 'PASS' | 'WARNING' | 'REJECT' | 'UNKNOWN';

// دلایل رد — machine-readable (برای UI و رتبه‌بندی فاز ۳)
export const RejectionReason = {
  TRANSACTION_INCOMPATIBLE: 'TRANSACTION_INCOMPATIBLE',
  CATEGORY_INCOMPATIBLE: 'CATEGORY_INCOMPATIBLE',
  PROPERTY_TYPE_INCOMPATIBLE: 'PROPERTY_TYPE_INCOMPATIBLE',
  BUDGET_TOO_HIGH: 'BUDGET_TOO_HIGH',
  DEPOSIT_TOO_HIGH: 'DEPOSIT_TOO_HIGH',
  RENT_TOO_HIGH: 'RENT_TOO_HIGH',
  AREA_TOO_LARGE: 'AREA_TOO_LARGE',
  INSUFFICIENT_ROOMS: 'INSUFFICIENT_ROOMS',
  LOCATION_OUTSIDE_REQUEST: 'LOCATION_OUTSIDE_REQUEST',
  // پروفایل مشتری ناقص است (نوع معامله/نقش ثبت نشده) — نه «ناسازگار»، فقط محاسبه‌شدنی نیست
  INCOMPLETE_CUSTOMER_PROFILE: 'INCOMPLETE_CUSTOMER_PROFILE',
} as const;
export type RejectionReasonCode = (typeof RejectionReason)[keyof typeof RejectionReason];

// هشدارها — machine-readable
export const WarningCode = {
  PROPERTY_TYPE_SUBSTITUTE: 'PROPERTY_TYPE_SUBSTITUTE',
  BUDGET_ABOVE_MAX: 'BUDGET_ABOVE_MAX',
  BUDGET_BELOW_MIN: 'BUDGET_BELOW_MIN',
  DEPOSIT_ABOVE_MAX: 'DEPOSIT_ABOVE_MAX',
  RENT_ABOVE_MAX: 'RENT_ABOVE_MAX',
  AREA_ABOVE_MAX: 'AREA_ABOVE_MAX',
  AREA_BELOW_MIN: 'AREA_BELOW_MIN',
  ONE_ROOM_SHORT: 'ONE_ROOM_SHORT',
  LOCATION_CITY_OUTSIDE: 'LOCATION_CITY_OUTSIDE',
  PARTNERSHIP_VALUE_GAP: 'PARTNERSHIP_VALUE_GAP',
  UNVERIFIABLE_PERMIT: 'UNVERIFIABLE_PERMIT',
  UNVERIFIABLE_COMMERCIAL: 'UNVERIFIABLE_COMMERCIAL',
} as const;
export type WarningCodeValue = (typeof WarningCode)[keyof typeof WarningCode];

export interface HardCompatibilityResult {
  transaction: ConstraintStatus;
  category: ConstraintStatus;
  propertyType: ConstraintStatus;
  /** بهترین ضریب سازگاری نوع ملک بین لیست مشتری و نوع فایل (1.0/0.9/0.85/0.6) */
  compatibilityFactor: number | null;
  /** true فقط وقتی factor = 0.6 (جایگزین واقعی) — فاز ۳ امتیاز نهایی را سقف 69 می‌کند */
  isSubstitutePropertyType: boolean;
}

export interface StrongConstraintsResult {
  financial: ConstraintStatus;
  area: ConstraintStatus;
  rooms: ConstraintStatus;
  location: ConstraintStatus;
  partnership: ConstraintStatus;
  permitCommercial: ConstraintStatus;
}

export interface MatchEligibilityOutput {
  /** false یعنی این جفت به عنوان کاندید به فاز ۳ نمی‌رود */
  compatible: boolean;
  hardCompatibility: HardCompatibilityResult;
  /** null وقتی فاز ۱ رد کرده (فاز ۲ اصلاً اجرا نشده) */
  strongConstraints: StrongConstraintsResult | null;
  rejectionReason: RejectionReasonCode | null;
  warnings: WarningCodeValue[];
  metadata: {
    isSubstitutePropertyType: boolean;
    compatibilityFactor: number | null;
    /** نوع ملکِ مشتری که برندهٔ سازگاری بود (مبنای خواندن ترجیحات در فاز ۲/۳) */
    bestType: string | null;
    /** فاصله‌های خام (d) برای استفادهٔ فاز ۳ در امتیازدهی */
    distances: Record<string, number | null>;
  };
}

// ---- فاز ۳: امتیازدهی ----

export type Tier = 'excellent' | 'good' | 'fair' | 'weak' | 'hidden';
export type Confidence = 'high' | 'medium' | 'low';
export type ScoreCap = 'SUBSTITUTE_PROPERTY_TYPE' | 'INCOMPLETE_PROPERTY_DATA';

export interface ScoredComponent {
  key: 'core' | 'financial' | 'location' | 'physical' | 'features';
  /** برچسب فارسی برای UI (مالي/موقعیت/...) */
  label: string;
  weight: number;
  /** امتیاز مؤلفه 0–1 (مؤلفه‌های غیرفعال با 0.5 خنثی نمایش می‌شوند) */
  value: number;
  active: boolean;
}

export interface MatchExplanation {
  positives: string[];
  warnings: string[];
  unverifiable: string[];
}

/** خروجی کامل موتور: فاز ۱ + ۲ + ۳. score فقط وقتی compatible=true ساخته می‌شود. */
export interface ScoredMatchOutput extends MatchEligibilityOutput {
  score: number | null;
  tier: Tier | null;
  confidence: Confidence | null;
  components: ScoredComponent[] | null;
  explanation: MatchExplanation | null;
  caps: ScoreCap[];
}
