// امکانات اندازه‌شدهٔ مغازه: برق ۳‌فاز (آمپر) و گاز تجاری (سایز متر)
// -------------------------------------------------------------
// در بازار: برق ۳‌فاز به «آمپر» (ظرفیت اتصال) و گاز به «سایز متر»
// (مترمکعب استاندارد در ساعت) اندازه می‌شود.
//
// مقدار واقعیِ فایل در ستون owner_followup_status به‌صورت مارکر نگهداری
// می‌شود (بدون نیاز به مهاجرت اسکیمای دیتابیس):
//
//   [shop_power:three_100]
//   [shop_gas:g16]

export const POWER_OPTIONS = [
  { value: 'single', label: 'تک‌فاز' },
  { value: 'three_32', label: '۳‌فاز ۳۲ آمپر' },
  { value: 'three_50', label: '۳‌فاز ۵۰ آمپر' },
  { value: 'three_63', label: '۳‌فاز ۶۳ آمپر' },
  { value: 'three_80', label: '۳‌فاز ۸۰ آمپر' },
  { value: 'three_100', label: '۳‌فاز ۱۰۰ آمپر' },
  { value: 'three_125', label: '۳‌فاز ۱۲۵ آمپر' },
  { value: 'three_160', label: '۳‌فاز ۱۶۰ آمپر' },
  { value: 'three_200', label: '۳‌فاز ۲۰۰ آمپر' },
  { value: 'three_250', label: '۳‌فاز ۲۵۰ آمپر' },
  { value: 'three_300', label: '۳‌فاز ۳۰۰ آمپر و بیشتر' },
] as const;

export const GAS_OPTIONS = [
  { value: 'g2', label: 'G2 (تا ۲ مترمکعب/ساعت)' },
  { value: 'g4', label: 'G4 (تا ۴ مترمکعب/ساعت)' },
  { value: 'g6', label: 'G6 (تا ۶ مترمکعب/ساعت)' },
  { value: 'g10', label: 'G10 (تا ۱۰ مترمکعب/ساعت)' },
  { value: 'g16', label: 'G16 (تا ۱۶ مترمکعب/ساعت)' },
  { value: 'g25', label: 'G25 (تا ۲۵ مترمکعب/ساعت)' },
  { value: 'g40', label: 'G40 (تا ۴۰ مترمکعب/ساعت)' },
  { value: 'g63', label: 'G63 و بیشتر (صنعتی)' },
  { value: 'lb', label: 'گاز به پوند (مصرف صنعتی سنگین)' },
] as const;

// انواع ملکی که برق ۳‌فاز / گاز تجاری برای‌شان معنی دارد
export const POWER_GAS_PROPERTY_TYPES = ['shop', 'factory', 'workshop', 'industrial_unit', 'warehouse', 'garage'];

export const POWER_LABELS: Record<string, string> = Object.fromEntries(POWER_OPTIONS.map((o) => [o.value, o.label]));
export const GAS_LABELS: Record<string, string> = Object.fromEntries(GAS_OPTIONS.map((o) => [o.value, o.label]));

// رتبهٔ ظرفیت برای مقایسهٔ تطبیق (بزرگ‌تر = ظرفیت بیشتر)
export const POWER_RANKS: Record<string, number> = {
  single: 1,
  three_32: 2,
  three_50: 3,
  three_63: 4,
  three_80: 5,
  three_100: 6,
  three_125: 7,
  three_160: 8,
  three_200: 9,
  three_250: 10,
  three_300: 11,
};

export const GAS_RANKS: Record<string, number> = {
  g2: 1,
  g4: 2,
  g6: 3,
  g10: 4,
  g16: 5,
  g25: 6,
  g40: 7,
  g63: 8,
  lb: 9,
};

const SHOP_POWER_MARKER = /(?:^|\n)\[shop_power:([a-z0-9_]+)\](?=\n|$)/;
const SHOP_GAS_MARKER = /(?:^|\n)\[shop_gas:([a-z0-9_]+)\](?=\n|$)/;

/** ظرفیت برق ثبت‌شده در فایل (مغازه) */
export function getShopPower(metadata?: string | null): string {
  return metadata?.match(SHOP_POWER_MARKER)?.[1] ?? '';
}

/** سایز متر گاز ثبت‌شده در فایل (مغازه) */
export function getShopGas(metadata?: string | null): string {
  return metadata?.match(SHOP_GAS_MARKER)?.[1] ?? '';
}

export function setShopPower(metadata: string | null, value: string): string | null {
  const rest = (metadata ?? '').replace(SHOP_POWER_MARKER, '').trim();
  if (value) return [rest, `[shop_power:${value}]`].filter(Boolean).join('\n');
  return rest || null;
}

export function setShopGas(metadata: string | null, value: string): string | null {
  const rest = (metadata ?? '').replace(SHOP_GAS_MARKER, '').trim();
  if (value) return [rest, `[shop_gas:${value}]`].filter(Boolean).join('\n');
  return rest || null;
}
