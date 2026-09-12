// تست مسیر کامل انتقال بین دستگاه‌ها: seed → داده → export → import روی «دستگاه دوم»
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bulkPut, clearTable, destroyDb, getDb } from '../db';
import { exportBackup, importBackup, parseBackup } from '../backup';
import { TABLES } from '../schema';
import { ensureLocalSeed } from '../seed';
import { createLocalClient } from '../client';

beforeEach(async () => {
  await destroyDb();
  try { localStorage.clear(); } catch { /* node */ }
  await getDb();
});

describe('localdb: roundtrip بکاپ بین دستگاه', () => {
  it('seed → داده → export → (دستگاه دوم) import → داده یکسان', async () => {
    const db = createLocalClient();

    // دستگاه اول: seed + چند داده کاربر
    await ensureLocalSeed();
    await db.from('customers').insert({ name: 'مریم', mobile: '09011112223' });
    await db.from('owners').insert({ name: 'رضا', phone: '09123334445' });
    const { data: cust } = await db.from('customers').select('id, name').maybeSingle();
    const { data: owner } = await db.from('owners').select('id').maybeSingle();
    await db.from('properties').insert({
      title: 'فایل آجر', transaction_type: 'sell', status: 'active',
      customer_id: (cust as { id: string }).id, owner_id: (owner as { id: string }).id,
    });

    // خروجی بکاپ
    const backup = await exportBackup();
    const json = JSON.stringify(backup, null, 2);
    expect(backup.app).toBe('dastyar');
    expect(backup.data.customers).toHaveLength(1);
    expect(backup.data.counties.some((c) => c.name === 'رباط کریم')).toBe(true);
    expect(backup.data.provinces.some((p) => p.name === 'تهران')).toBe(true);

    // فایل نامعتبر رد شود
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup('نه json')).toThrow();

    // دستگاه دوم: DB خالی
    for (const t of TABLES) await clearTable(t);
    const { count: before } = await db.from('properties').select('id', { count: 'exact' });
    expect(before).toBe(0);

    const parsed = parseBackup(json);
    await importBackup(parsed);

    // داده‌ها یکسان شدند
    const { data: cust2 } = await db.from('customers').select('name').maybeSingle();
    expect((cust2 as { name: string }).name).toBe('مریم');
    const { data: props } = await db.from('properties').select('*, customers(name), owners(name)');
    expect(props).toHaveLength(1);
    const row = (props as Array<{ customers: { name: string } }>)[0];
    expect(row.customers.name).toBe('مریم');
    // seed منطقه‌ها هم منتقل شده (دستگاه دوم seed جدا نمی‌زند)
    const { data: nbhs } = await db.from('neighborhoods').select('name');
    expect((nbhs as unknown[]).length).toBe(13);

    // جایگزینی کامل: دادهٔ قدیمی مقصد پاک شده
    await bulkPut('tasks', [{ id: 'task-خودم', title: 'وظیفهٔ قدیمی مقصد' }]);
    await importBackup(parseBackup(json));
    const { data: tasks } = await db.from('tasks').select('id');
    expect(tasks).toHaveLength(0);
  });

  it('seed دوباره اجرا نشود وقتی داده هست (بعد از ریستور)', async () => {
    const db = createLocalClient();
    await ensureLocalSeed();
    await db.from('owners').insert({ name: 'مالک پس از ریستور' });
    await ensureLocalSeed();
    const { count } = await db.from('owners').select('id', { count: 'exact' });
    expect(count).toBe(1);
    const { count: counties } = await db.from('counties').select('id', { count: 'exact' });
    expect(counties).toBe(6);
  });
});
