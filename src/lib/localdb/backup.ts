// بکاپ و ریستور دستی — تنها راه انتقال داده بین دستگاه‌ها
// -------------------------------------------------------------
// خروجی: یک فایل JSON از همهٔ جدول‌ها. انتقال: دستی (واتس‌اپ/ایمیل/کابل).
// ورودی: «جایگزینی کامل» — داده‌های دستگاه مقصد پاک و با بکاپ یکی می‌شود.
import { allRows, bulkPut, clearTable } from './db';
import { TABLES } from './schema';

const BACKUP_VERSION = 1;

export interface BackupObject {
  app: 'dastyar';
  version: number;
  created_at: string;
  data: Record<string, Record<string, unknown>[]>;
}

/** تهیهٔ فایل پشتیبان کامل از همهٔ جدول‌ها */
export async function exportBackup(): Promise<BackupObject> {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    data[table] = await allRows(table);
  }
  return {
    app: 'dastyar',
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    data,
  };
}

/** اعتبارسنجی محتوای فایل واردشده */
export function parseBackup(jsonText: string): BackupObject {
  const parsed = JSON.parse(jsonText) as Partial<BackupObject>;
  if (parsed.app !== 'dastyar' || typeof parsed.version !== 'number' || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('not-a-backup');
  }
  return parsed as BackupObject;
}

/**
 * بازگردانی با «جایگزینی کامل»: ابتدا هر جدولی که در بکاپ هست خالی می‌شود
 * و سپس ردیف‌های بکاپ نوشته می‌شوند. جدول‌هایی که در بکاپ نباشند دست‌نخورده
 * نمی‌مانند — برای یکنواختی، همهٔ جدول‌های شناخته‌شده جایگزین می‌شوند.
 */
export async function importBackup(backup: BackupObject): Promise<void> {
  for (const table of TABLES) {
    await clearTable(table);
    const rows = backup.data[table] ?? [];
    if (rows.length > 0) await bulkPut(table, rows);
  }
}
