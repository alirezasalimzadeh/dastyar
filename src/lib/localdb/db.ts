// لایهٔ IndexedDB — از idb استفاده می‌کند (پیش‌تر هم برای کش آفلاین بود)
// باز شدن دیتابیس deferred است تا import در محیط تست (بدون مرورگر) امن بماند.
import { openDB, type IDBPDatabase } from 'idb';
import { TABLES } from './schema';

const DB_NAME = 'dastyar-local-v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const table of TABLES) {
          if (!db.objectStoreNames.contains(table)) {
            db.createObjectStore(table, { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

/** همهٔ ردیف‌های یک جدول */
export async function allRows(table: string): Promise<Record<string, unknown>[]> {
  const db = await getDb();
  const rows = (await db.getAll(table)) as Record<string, unknown>[] | undefined;
  return rows ?? [];
}

/** درج/به‌روزرسانی یک ردیف */
export async function putRow(table: string, row: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  await db.put(table, row);
}

/** درج/به‌روزرسانی دسته‌ای */
export async function bulkPut(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(table, 'readwrite');
  for (const row of rows) tx.store.put(row);
  await tx.done;
}

/** حذف یک ردیف */
export async function deleteRow(table: string, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(table, id);
}

/** خالی کردن یک جدول */
export async function clearTable(table: string): Promise<void> {
  const db = await getDb();
  await db.clear(table);
}

/** تعداد ردیف‌های یک جدول */
export async function countRows(table: string): Promise<number> {
  const db = await getDb();
  return db.count(table);
}

/** حذف کامل دیتابیس محلی (پاک کردن همه‌چیز) */
export async function destroyDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve(); // اتصال باز دیگری نباید ما را قفل کند
  });
}
