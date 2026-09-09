// منبع فایل (آگهی): شخصی (مستقیم از مالک) / فایل همکار / فایل دیوار / فایل مدیر
// ---------------------------------
// «فایل همکار» از قبل در ستون owner_relationship (شناسه مالک همکار) و
// «فایل شخصی» در ستون owner_id نگهداری می‌شود. برای «فایل دیوار» و
// «فایل مدیر» (فایل سپرده‌شده از سمت مدیر املاک) — بدون تغییر اسکیمای
// دیتابیس — از مارکر در ستون متادیتا استفاده می‌کنیم:
//
//   [file_source:divar]
//   [file_source:manager]

const DIVAR_MARKER = /(?:^|\n)\[file_source:divar\](?=\n|$)/;
const MANAGER_MARKER = /(?:^|\n)\[file_source:manager\](?=\n|$)/;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export type FileSource = 'personal' | 'colleague' | 'divar' | 'manager';

export const FILE_SOURCE_LABELS: Record<FileSource, string> = {
  personal: 'مستقیم از مالک',
  colleague: 'فایل همکار',
  divar: 'فایل دیوار',
  manager: 'فایل مدیر',
};

/** آیا این فایل «فایل دیوار» است؟ */
export function hasDivarSource(metadata?: string | null): boolean {
  return Boolean(metadata?.match(DIVAR_MARKER));
}

/** آیا این فایل از سمت مدیر املاک سپرده شده؟ */
export function hasManagerSource(metadata?: string | null): boolean {
  return Boolean(metadata?.match(MANAGER_MARKER));
}

/** مارکر فایل دیوار را اضافه/حذف می‌کند (سایر مارکرها دست‌نخورده می‌مانند) */
export function markDivarSource(metadata: string | null, enabled: boolean): string | null {
  const rest = (metadata ?? '').replace(DIVAR_MARKER, '').trim();
  if (enabled) return [rest, '[file_source:divar]'].filter(Boolean).join('\n');
  return rest || null;
}

/** مارکر فایل مدیر را اضافه/حذف می‌کند (سایر مارکرها دست‌نخورده می‌مانند) */
export function markManagerSource(metadata: string | null, enabled: boolean): string | null {
  const rest = (metadata ?? '').replace(MANAGER_MARKER, '').trim();
  if (enabled) return [rest, '[file_source:manager]'].filter(Boolean).join('\n');
  return rest || null;
}

/** منبع اصلی فایل: دیوار > مدیر > همکار > شخصی (مستقیم از مالک) */
export function getFileSource(property: {
  owner_followup_status?: string | null;
  owner_relationship?: string | null;
  owner_id?: string | null;
}): FileSource {
  if (hasDivarSource(property.owner_followup_status)) return 'divar';
  if (hasManagerSource(property.owner_followup_status)) return 'manager';
  if (isUuid(property.owner_relationship)) return 'colleague';
  return 'personal';
}
