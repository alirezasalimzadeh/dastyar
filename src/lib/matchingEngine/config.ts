// موتور تطبیق — پیکربندی متمرکز
// همهٔ اعداد و جداول قابل تنظیم در این فایل است (طبق سند طراحی §۱۹).

// ---- سطوح سازگاری نوع ملک ----
export const TYPE_LEVELS = {
  EXACT: 1.0,
  VERY_CLOSE: 0.9,
  CLOSE: 0.85,
  SUBSTITUTE: 0.6,
} as const;

// سقف امتیاز نهایی (فاز ۳) برای جفت‌هایی که بهترین سازگاری‌ها SUBSTITUTE (0.6) است —
// در فاز ۱/۲ فقط metadata `isSubstitutePropertyType` برگردانده می‌شود.
export const SUBSTITUTE_SCORE_CAP = 69;

// ---- ماتریس سازگاری معامله × نقش (دوطرفهٔ عرضه/تقاضا) ----
// کلید: نوع معامله مشتری، سپس نقش مشتری → مقادیر مجاز «نوع معامله فایل.نقش فایل»
export const TRANSACTION_MATRIX: Record<string, Record<string, string[]>> = {
  buy: { buyer: ['sell.seller'] },
  sell: { seller: ['buy.buyer'] },
  rent: {
    applicant: ['rent.owner'],
    owner: ['rent.applicant'],
  },
  partnership: {
    owner: ['partnership.builder'],
    builder: ['partnership.owner'],
  },
};

// ---- سازگاری نوع ملک (دوطرفه؛ کلید مرتب‌شده «a|b») ----
// هر جفتی که اینجا نباشد = 0 = ناسازگار (محتاطانه، مطابق قاعدهٔ اول).
export const TYPE_COMPATIBILITY: Record<string, number> = {
  // مسکونی
  'apartment|house': TYPE_LEVELS.SUBSTITUTE,
  'apartment|office_apartment': TYPE_LEVELS.SUBSTITUTE, // استثنای صریح بین‌دسته‌ای
  'apartment|penthouse': TYPE_LEVELS.VERY_CLOSE,
  'apartment|residential_estate': TYPE_LEVELS.CLOSE,
  'apartment|suite': TYPE_LEVELS.CLOSE,
  'apartment|tower': TYPE_LEVELS.CLOSE,
  'apartment|villa': TYPE_LEVELS.SUBSTITUTE,
  'house|old_house': TYPE_LEVELS.SUBSTITUTE,
  'house|residential_land': TYPE_LEVELS.SUBSTITUTE,
  'house|villa': TYPE_LEVELS.VERY_CLOSE,
  'old_house|residential_land': TYPE_LEVELS.VERY_CLOSE,
  'penthouse|suite': TYPE_LEVELS.VERY_CLOSE,
  'penthouse|tower': TYPE_LEVELS.VERY_CLOSE,
  'residential_estate|house': TYPE_LEVELS.CLOSE,
  'residential_estate|villa': TYPE_LEVELS.CLOSE,
  'suite|tower': TYPE_LEVELS.VERY_CLOSE,
  'villa|old_house': TYPE_LEVELS.SUBSTITUTE,
  'villa|residential_land': TYPE_LEVELS.SUBSTITUTE,
  // صنعتی
  'factory|industrial_land': TYPE_LEVELS.SUBSTITUTE,
  'factory|industrial_unit': TYPE_LEVELS.CLOSE,
  'factory|workshop': TYPE_LEVELS.CLOSE,
  'garage|warehouse': TYPE_LEVELS.CLOSE,
  'industrial_land|industrial_unit': TYPE_LEVELS.SUBSTITUTE,
  'industrial_land|warehouse': TYPE_LEVELS.SUBSTITUTE,
  'industrial_land|workshop': TYPE_LEVELS.SUBSTITUTE,
  'industrial_unit|warehouse': TYPE_LEVELS.VERY_CLOSE,
  'industrial_unit|workshop': TYPE_LEVELS.CLOSE,
  // کشاورزی
  'agricultural_land|garden': TYPE_LEVELS.SUBSTITUTE,
  // تجاری
  'commercial_basement|mall_booth': TYPE_LEVELS.SUBSTITUTE,
  'commercial_basement|shop': TYPE_LEVELS.SUBSTITUTE,
  'commercial_land|shop': TYPE_LEVELS.SUBSTITUTE,
};

// انواعی که متراژ قابل‌مقایسه‌شان land_area است (§۸ سند)
export const LAND_AREA_TYPES = [
  'residential_land',
  'commercial_land',
  'industrial_land',
  'garden',
  'agricultural_land',
];

// انواع صنعتیِ ساختمانی (متراژ زمین + سالن جدا بررسی می‌شوند)
export const INDUSTRIAL_BUILDING_TYPES = [
  'factory',
  'workshop',
  'industrial_unit',
  'warehouse',
  'garage',
];

// ---- آستانه‌های محدودیت‌های قوی ----
export const STRONG_THRESHOLDS = {
  /** عبور قیمت/ودیعه/اجاره از سقف: عادی */
  moneyVetoNormal: 0.5,
  /** عبور از سقف: فایل قابل مذاکره (هرگز تا 2× بودجه) */
  moneyVetoNegotiable: 0.8,
  /** عبور متراژ از سقف */
  areaVeto: 0.5,
  /** کمبود اتاق که رد می‌شود (1 = WARNING) */
  roomsShortfallReject: 2,
  /** اختلاف ارزش شراکت که WARNING می‌شود (بدون REJECT) */
  partnershipRatioWarn: 3,
} as const;

/** ضریب سازگاری دوطرفهٔ دو نوع ملک (0 = ناسازگار) */
export function typeCompatibility(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return TYPE_LEVELS.EXACT;
  const key = [a, b].sort().join('|');
  return TYPE_COMPATIBILITY[key] ?? 0;
}
