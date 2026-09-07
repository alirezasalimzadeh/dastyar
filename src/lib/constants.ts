// Transaction types
export const TRANSACTION_TYPES = [
  { value: 'buy', label: 'خرید', buyerLabel: 'متقاضی', roles: ['buyer'] },
  { value: 'rent', label: 'اجاره', roles: ['owner', 'applicant'] },
  { value: 'partnership', label: 'مشارکت', roles: ['owner', 'builder'] },
  { value: 'sell', label: 'فروش', roles: ['seller'] },
] as const;

export const TRANSACTION_ROLES: Record<string, { value: string; label: string }[]> = {
  buy: [{ value: 'buyer', label: 'متقاضی' }],
  rent: [
    { value: 'owner', label: 'مالک هستم' },
    { value: 'applicant', label: 'متقاضی هستم' },
  ],
  partnership: [
    { value: 'owner', label: 'مالک هستم' },
    { value: 'builder', label: 'سازنده هستم' },
  ],
  sell: [{ value: 'seller', label: 'مالک' }],
};

// Property categories
export const CATEGORIES = [
  { value: 'residential', label: 'مسکونی' },
  { value: 'industrial', label: 'صنعتی' },
  { value: 'agricultural', label: 'کشاورزی' },
  { value: 'commercial', label: 'تجاری' },
  { value: 'office', label: 'اداری' },
] as const;

// Property types by category
export const PROPERTY_TYPES: Record<string, { value: string; label: string }[]> = {
  residential: [
    { value: 'apartment', label: 'آپارتمان' },
    { value: 'house', label: 'خانه ویلایی' },
    { value: 'villa', label: 'ویلا' },
    { value: 'suite', label: 'سوئیت' },
    { value: 'penthouse', label: 'پنت هاوس' },
    { value: 'tower', label: 'برج' },
    { value: 'old_house', label: 'کلنگی' },
    { value: 'residential_estate', label: 'مستغلات' },
    { value: 'residential_land', label: 'زمین مسکونی' },
  ],
  industrial: [
    { value: 'factory', label: 'کارخانه' },
    { value: 'workshop', label: 'کارگاه' },
    { value: 'industrial_unit', label: 'سوله' },
    { value: 'warehouse', label: 'انبار' },
    { value: 'garage', label: 'گاراژ' },
    { value: 'industrial_land', label: 'زمین صنعتی' },
  ],
  agricultural: [
    { value: 'garden', label: 'باغ و باغچه' },
    { value: 'agricultural_land', label: 'زمین کشاورزی' },
  ],
  commercial: [
    { value: 'shop', label: 'مغازه' },
    { value: 'mall_booth', label: 'غرفه داخل پاساژ' },
    { value: 'commercial_basement', label: 'زیرزمین تجاری' },
    { value: 'commercial_land', label: 'زمین تجاری' },
  ],
  office: [
    { value: 'office_apartment', label: 'آپارتمان اداری' },
  ],
};

// Property statuses
export const PROPERTY_STATUSES = [
  { value: 'active', label: 'فعال', color: 'green' },
  { value: 'pending', label: 'در انتظار', color: 'yellow' },
  { value: 'sold', label: 'فروخته شد', color: 'blue' },
  { value: 'rented', label: 'اجاره داده شد', color: 'blue' },
  { value: 'inactive', label: 'غیرفعال', color: 'gray' },
] as const;

// Customer temperature
export const TEMPERATURES = [
  { value: 'hot', label: 'داغ', color: 'red', icon: '🔥' },
  { value: 'warm', label: 'گرم', color: 'orange', icon: '🟡' },
  { value: 'cold', label: 'سرد', color: 'blue', icon: '🔵' },
] as const;

// Customer statuses
export const CUSTOMER_STATUSES = [
  { value: 'active', label: 'فعال', color: 'green' },
  { value: 'inactive', label: 'غیرفعال', color: 'gray' },
  { value: 'converted', label: 'تبدیل شده', color: 'blue' },
  { value: 'lost', label: 'از دست رفته', color: 'red' },
] as const;

// Urgency levels
export const URGENCY_LEVELS = [
  { value: 'low', label: 'کم', color: 'gray' },
  { value: 'normal', label: 'عادی', color: 'blue' },
  { value: 'high', label: 'زیاد', color: 'orange' },
  { value: 'critical', label: 'فوری', color: 'red' },
] as const;

// Call results
export const CALL_RESULTS = [
  { value: 'answered', label: 'پاسخ داد', color: 'green' },
  { value: 'no_answer', label: 'پاسخ نداد', color: 'gray' },
  { value: 'interested', label: 'علاقه‌مند است', color: 'green' },
  { value: 'needs_review', label: 'نیاز به بررسی دارد', color: 'yellow' },
  { value: 'introduced', label: 'فایل مناسب معرفی شد', color: 'blue' },
  { value: 'viewing_scheduled', label: 'بازدید تعیین شد', color: 'teal' },
  { value: 'deal_done', label: 'معامله انجام شد', color: 'green' },
  { value: 'disinterested', label: 'فعلاً منصرف شد', color: 'gray' },
  { value: 'wrong_number', label: 'شماره اشتباه', color: 'red' },
  { value: 'needs_followup', label: 'نیازمند پیگیری', color: 'orange' },
] as const;

// Follow-up statuses
export const FOLLOWUP_STATUSES = [
  { value: 'pending', label: 'در انتظار', color: 'yellow' },
  { value: 'completed', label: 'انجام شده', color: 'green' },
  { value: 'missed', label: 'از قلم افتاده', color: 'red' },
  { value: 'cancelled', label: 'لغو شده', color: 'gray' },
] as const;

// Task statuses
export const TASK_STATUSES = [
  { value: 'pending', label: 'در انتظار', color: 'yellow' },
  { value: 'in_progress', label: 'در حال انجام', color: 'blue' },
  { value: 'completed', label: 'انجام شده', color: 'green' },
  { value: 'cancelled', label: 'لغو شده', color: 'gray' },
] as const;

// Deal statuses
export const DEAL_STATUSES = [
  { value: 'negotiating', label: 'در مذاکره', color: 'yellow' },
  { value: 'agreement', label: 'توافق اولیه', color: 'blue' },
  { value: 'contracted', label: 'قرارداد بسته شد', color: 'teal' },
  { value: 'completed', label: 'تکمیل شد', color: 'green' },
  { value: 'cancelled', label: 'لغو شد', color: 'red' },
] as const;

// Priority levels
export const PRIORITIES = [
  { value: 'low', label: 'کم', color: 'gray' },
  { value: 'normal', label: 'عادی', color: 'blue' },
  { value: 'high', label: 'زیاد', color: 'orange' },
  { value: 'critical', label: 'فوری', color: 'red' },
] as const;

// User roles
export const USER_ROLES = [
  { value: 'manager', label: 'مدیر' },
  { value: 'office_manager', label: 'مدیر دفتر' },
  { value: 'consultant', label: 'مشاور' },
  { value: 'system_admin', label: 'ادمین سیستم' },
] as const;

// Geographic scope: Tehran province only, limited to these counties (شهرستان)
export const TEHRAN_PROVINCE_ID = 'f606df36-8387-4649-bdc1-94ca76d6774d';
export const ACTIVE_COUNTY_NAMES = ['رباط کریم', 'شهریار', 'اسلامشهر', 'گلستان', 'ورامین', 'قرچک'];
export const ROBAT_KARIM_COUNTY_NAME = 'رباط کریم';

// Colleagues (همکاران) are stored as owner rows carrying this tag
export const COLLEAGUE_TAG = 'همکار';

// Neighborhoods (محله) — only for Robat Karim county
export const ROBAT_KARIM_NEIGHBORHOODS = [
  'رباط کریم',
  'نصیرشهر',
  'پرند',
  'آبشناسان',
  'پرندک',
  'آلارد',
  'وهن آباد',
  'حصارمهتر',
  'انجم آباد',
  'شهرآباد',
  'یقه',
  'منجیل آباد',
  'امام زاده ابوطالب',
];

// Streets (خیابان) — only for the neighborhood رباط کریم
export const ROBAT_KARIM_STREETS = [
  'بلوار امام خمینی',
  'بلوار آزادگان',
  'رجایی',
  'فرهنگیان',
  'دادگستری',
  'بوستان ها',
  'گلستان ها',
  'انقلاب ها',
  'سپاه',
  'صیادشیرازی',
  'مصلی',
  'فرهنگ',
  'ملکی',
  'گرجی',
  'یادمان',
  'ترکاشوند',
  'بلوار کمالی',
  'نیروی انتظامی',
  'امام محمد تقی',
];

// Owner statuses
export const OWNER_STATUSES = [
  { value: 'active', label: 'فعال', color: 'green' },
  { value: 'inactive', label: 'غیرفعال', color: 'gray' },
  { value: 'blacklisted', label: 'لیست سیاه', color: 'red' },
] as const;

// Sales funnel stages
export const FUNNEL_STAGES = [
  { value: 'lead', label: 'Lead', color: 'gray' },
  { value: 'call', label: 'تماس', color: 'blue' },
  { value: 'followup', label: 'پیگیری', color: 'teal' },
  { value: 'introduce', label: 'معرفی فایل', color: 'cyan' },
  { value: 'viewing', label: 'بازدید', color: 'yellow' },
  { value: 'negotiation', label: 'مذاکره', color: 'orange' },
  { value: 'deal', label: 'معامله', color: 'green' },
] as const;

// Helper functions
export function getTransactionLabel(value: string): string {
  return TRANSACTION_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function getCategoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function getPropertyTypeLabel(category: string, value: string): string {
  return PROPERTY_TYPES[category]?.find((p) => p.value === value)?.label ?? value;
}

export function getTemperatureInfo(value: string) {
  return TEMPERATURES.find((t) => t.value === value) ?? TEMPERATURES[1];
}

export function getStatusInfo(statuses: readonly { value: string; label: string; color: string }[], value: string) {
  return statuses.find((s) => s.value === value) ?? statuses[0];
}

export function getCallResultInfo(value: string) {
  return CALL_RESULTS.find((c) => c.value === value) ?? CALL_RESULTS[0];
}

export function getUrgencyInfo(value: string) {
  return URGENCY_LEVELS.find((u) => u.value === value) ?? URGENCY_LEVELS[1];
}

export function getPriorityInfo(value: string) {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[1];
}

export function getDealStatusInfo(value: string) {
  return DEAL_STATUSES.find((d) => d.value === value) ?? DEAL_STATUSES[0];
}

export function getFollowupStatusInfo(value: string) {
  return FOLLOWUP_STATUSES.find((f) => f.value === value) ?? FOLLOWUP_STATUSES[0];
}

export function getTaskStatusInfo(value: string) {
  return TASK_STATUSES.find((t) => t.value === value) ?? TASK_STATUSES[0];
}

export function getUserRoleLabel(value: string): string {
  return USER_ROLES.find((r) => r.value === value)?.label ?? value;
}

// Format price in Persian
export function formatPrice(value?: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('fa-IR').format(value);
}

// Format price compactly (میلیارد / میلیون)
export function formatMoneyShort(value?: number | null): string {
  if (value == null) return '-';
  if (value >= 1_000_000_000) {
    return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} میلیارد`;
  }
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} میلیون`;
  }
  return new Intl.NumberFormat('fa-IR').format(value);
}

// Copy text to clipboard (with fallback for non-HTTPS contexts like LAN)
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Format price with unit (تومان)
export function formatToman(value?: number | null): string {
  if (value == null) return '-';
  return `${new Intl.NumberFormat('fa-IR').format(value)} تومان`;
}

// Format date in Persian
export function formatDate(date?: string | Date | null): string {
  if (!date) return '-';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  } catch {
    return '-';
  }
}

// Format date and time in Persian
export function formatDateTime(date?: string | Date | null): string {
  if (!date) return '-';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  } catch {
    return '-';
  }
}

// Relative time in Persian
export function timeAgo(date?: string | Date | null): string {
  if (!date) return '-';
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'همین الان';
  if (diffMins < 60) return `${new Intl.NumberFormat('fa-IR').format(diffMins)} دقیقه پیش`;
  if (diffHours < 24) return `${new Intl.NumberFormat('fa-IR').format(diffHours)} ساعت پیش`;
  if (diffDays < 30) return `${new Intl.NumberFormat('fa-IR').format(diffDays)} روز پیش`;
  return formatDate(date);
}

// Check if a date is overdue
export function isOverdue(date?: string | Date | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}

// Check if a date is today
export function isToday(date?: string | Date | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// Days until a date
export function daysUntil(date?: string | Date | null): number {
  if (!date) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

// Convert English digits to Persian
export function toPersianDigits(str: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (d) => persianDigits[parseInt(d)]);
}

// Convert Persian digits to English
export function toEnglishDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// Validate Iranian phone number
export function validatePhone(phone: string): boolean {
  const cleaned = toEnglishDigits(phone).replace(/\s/g, '');
  return /^09\d{9}$/.test(cleaned);
}

// Normalize phone number
export function normalizePhone(phone: string): string {
  return toEnglishDigits(phone).replace(/\s/g, '');
}
