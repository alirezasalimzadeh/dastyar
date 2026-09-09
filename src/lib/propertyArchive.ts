// بایگانی آگهی‌ها (فایل‌ها)
// ----------------------------
// آگهی‌ها به دلایل مختلفی منقضی می‌شوند: اجاره شدن به مشتری یا متقاضی دیگر،
// پشیمانی مالک، منقضی شدن آگهی و... به جای حذف، فایل «بایگانی» می‌شود؛
// یعنی از چرخه فعال خارج می‌شود ولی تمام اطلاعاتش حفظ می‌ماند و قابل بازگشت است.
//
// برای اجتناب از تغییر اسکیمای دیتابیس (همان رویکرد units_per_floor و
// rent_budget_mins)، وضعیت بایگانی به‌صورت مارکر در ستون متادیتای
// owner_followup_status ذخیره می‌شود:
//
//   [archived:<timestamp_ms>|<reason (URL-encoded)>]
//
// هم‌زمان is_active فایل false می‌شود تا فایل‌های بایگانی به‌صورت
// خودکار از داشبورد، تطبیق مشتریان و سایر فهرست‌های فعال حذف شوند.

const ARCHIVE_MARKER = /(?:^|\n)\[archived:(\d+)\|([^\]]*)\](?=\n|$)/;

export interface ArchiveInfo {
  reason: string;
  archivedAt: number;
}

/** خواندن اطلاعات بایگانی از متادیتا؛ اگر فایل بایگانی نباشد null */
export function getArchiveInfo(metadata?: string | null): ArchiveInfo | null {
  const match = metadata?.match(ARCHIVE_MARKER);
  if (!match) return null;
  const archivedAt = Number(match[1]);
  let reason = 'دلیل ثبت نشده';
  try {
    reason = decodeURIComponent(match[2]) || reason;
  } catch {
    reason = match[2] || reason;
  }
  return { reason, archivedAt };
}

/** آیا این فایل بایگانی شده است؟ */
export function isPropertyArchived(property: { owner_followup_status?: string | null } | null | undefined): boolean {
  return getArchiveInfo(property?.owner_followup_status) !== null;
}

/**
 * مارکر بایگانی را به متادیتا اضافه (یا بازنویسی) می‌کند.
 * سایر مارکرها (units_per_floor، rent_budget_mins و...) دست‌نخورده می‌مانند.
 */
export function markPropertyArchived(metadata: string, reason: string, archivedAt = Date.now()): string {
  const rest = metadata.replace(ARCHIVE_MARKER, '').trim();
  const marker = `[archived:${archivedAt}|${encodeURIComponent(reason)}]`;
  return [rest, marker].filter(Boolean).join('\n');
}

/** مارکر بایگانی را از متادیتا حذف می‌کند (سایر مارکرها دست‌نخورده می‌مانند). */
export function clearPropertyArchive(metadata: string): string {
  return metadata.replace(ARCHIVE_MARKER, '').trim();
}
