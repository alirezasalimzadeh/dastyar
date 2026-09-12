// تست لایهٔ محلی: query-builder روی IndexedDB (fake-indexeddb در node)
// همهٔ الگوهای ۱۹۰ نقطهٔ استفادهٔ برنامه پوشش داده می‌شود.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalClient } from '../client';
import { clearTable } from '../db';

const db = createLocalClient();

async function reset() {
  for (const t of ['customers', 'owners', 'properties', 'calls', 'follow_ups', 'deals', 'neighborhoods', 'cities', 'counties', 'provinces']) {
    await clearTable(t);
  }
}

const seedOwners = async () => {
  const { data: a } = await db.from('owners').insert({ name: 'رضا', phone: '09121', tags: ['مالک'] });
  const { data: b } = await db.from('owners').insert({ name: 'سارا', phone: '09122', tags: ['سازنده'] });
  return { a: a as { id: string }, b: b as { id: string } };
};

describe('localdb: پایه', () => {
  beforeEach(async () => { await reset(); });

  it('insert + select * + maybeSingle', async () => {
    const { data, error } = await db.from('owners').insert({ name: 'علی', phone: '0911' });
    expect(error).toBeNull();
    expect((data as { id: string }).id).toBeTruthy();
    const { data: all } = await db.from('owners').select('*');
    expect(all).toHaveLength(1);
    const { data: single } = await db.from('owners').select('*').eq('name', 'علی').maybeSingle();
    expect((single as { name: string }).name).toBe('علی');
  });

  it('insert().select().single() — الگوی فرم‌ها', async () => {
    const { data, error } = await db.from('customers').insert({ name: 'مریم' }).select().single();
    expect(error).toBeNull();
    expect((data as { name: string }).name).toBe('مریم');
  });

  it('update + select + single — الگوی ویرایش', async () => {
    await db.from('owners').insert({ name: 'رضا', phone: '09121' });
    const { data: owner } = await db.from('owners').select('id').maybeSingle();
    const { data, error } = await db.from('owners').update({ phone: '09129' }).eq('id', (owner as { id: string }).id).select().single();
    expect(error).toBeNull();
    expect((data as { phone: string }).phone).toBe('09129');
  });

  it('delete با eq', async () => {
    await db.from('owners').insert({ name: 'رضا' });
    const { data: owner } = await db.from('owners').select('id').maybeSingle();
    await db.from('owners').delete().eq('id', (owner as { id: string }).id);
    const { data: all } = await db.from('owners').select('*');
    expect(all).toHaveLength(0);
  });
});

describe('localdb: فیلترها', () => {
  beforeEach(async () => { await reset(); });

  it('in / contains / ilike / gte / not-is-null', async () => {
    const { a } = await seedOwners();
    await db.from('properties').insert({ title: 'ف1', status: 'active', owner_id: a.id, is_hot: true });
    await db.from('properties').insert({ title: 'ف2', status: 'sold', owner_id: a.id, is_hot: false });
    await db.from('properties').insert({ title: 'ف3', status: 'active', owner_id: '', is_hot: null });

    const { data: inStatus } = await db.from('properties').select('id', { count: 'exact', head: true }).in('status', ['active', 'sold']);
    expect(inStatus).toBeNull();
    const { count: cIn } = await db.from('properties').select('id', { count: 'exact', head: true }).in('status', ['active']);
    expect(cIn).toBe(2);

    const { data: builders } = await db.from('owners').select('*').contains('tags', ['سازنده']);
    expect(builders).toHaveLength(1);

    const { data: like } = await db.from('owners').select('id, name').ilike('name', '%ر%');
    expect(like).toHaveLength(2); // رضا و سارا هر دو «ر» دارند

    const { count: cGte } = await db.from('properties').select('id', { count: 'exact', head: true }).gte('building_age', 5);
    expect(cGte).toBe(0);

    const { data: notNull } = await db.from('properties').select('id').not('is_hot', 'is', null);
    expect(notNull).toHaveLength(2);
  });

  it('count exact با فیلتر (بدون head)', async () => {
    await seedOwners();
    const { count } = await db.from('owners').select('id', { count: 'exact' }).eq('name', 'رضا');
    expect(count).toBe(1);
  });
});

describe('localdb: joinها', () => {
  beforeEach(async () => { await reset(); });

  it('owners ← properties/calls: آرایه (یک‌به‌بسیار)', async () => {
    const { a } = await seedOwners();
    await db.from('properties').insert({ title: 'فایل A', status: 'active', owner_id: a.id });
    await db.from('properties').insert({ title: 'فایل B', status: 'sold', owner_id: a.id });
    await db.from('calls').insert({ owner_id: a.id, call_date: '2026-01-01T00:00:00Z' });

    const { data } = await db.from('owners').select('*, properties(status), calls(call_date)').eq('id', a.id).maybeSingle();
    const row = data as { properties: { status: string }[]; calls: { call_date: string }[] };
    expect(row.properties).toHaveLength(2);
    expect(row.calls).toHaveLength(1);
  });

  it('properties ← owners/counties: شیء (چند-به-یک) + تصویر ستون‌ها', async () => {
    const { a } = await seedOwners();
    await db.from('properties').insert({ title: 'ف1', owner_id: a.id, county_id: 'c1', building_area: 100 });
    const { data } = await db.from('properties').select('*, owners(name, phone), counties(name)').maybeSingle();
    const row = data as { owners: { name: string; phone: string; id?: unknown }; counties: unknown };
    expect(row.owners.name).toBe('رضا');
    expect(row.owners.phone).toBe('09121');
    expect(row.owners.id).toBeUndefined(); // تصویر فقط دو ستون
    expect(row.counties).toBeNull();
  });

  it('calls ← customers/owners/properties + مرتب‌سازی نزولی', async () => {
    const { a } = await seedOwners();
    await db.from('customers').insert({ name: 'مریم', first_name: 'مریم', last_name: '', mobile: '0901' });
    await db.from('calls').insert({ customer_id: 'cx', owner_id: a.id, call_date: '2026-02-01T00:00:00Z' });
    await db.from('calls').insert({ customer_id: 'cx', owner_id: a.id, call_date: '2026-01-01T00:00:00Z' });

    const { data } = await db.from('calls')
      .select('*, customers(first_name, last_name), owners(name, phone), properties(title)')
      .order('call_date', { ascending: false })
      .limit(10);
    expect(data).toHaveLength(2);
    const first = (data as Array<Record<string, unknown>>)[0];
    expect(first.call_date).toBe('2026-02-01T00:00:00Z');
    expect((first.owners as { name: string }).name).toBe('رضا');
    expect(first.properties).toBeNull(); // بدون property_id
  });

  it('neighborhoods + cities!inner + eq روی ستون join', async () => {
    await db.from('counties').insert({ id: 'c-rk', name: 'رباط کریم' });
    await db.from('cities').insert({ id: 'city-rk', name: 'رباط کریم', county_id: 'c-rk' });
    await db.from('cities').insert({ id: 'city-sh', name: 'شهریار', county_id: 'c-sh' });
    await db.from('neighborhoods').insert({ id: 'n1', name: 'پرند', city_id: 'city-rk', active: true });
    await db.from('neighborhoods').insert({ id: 'n2', name: 'شهریارک', city_id: 'city-sh', active: true });

    const { data } = await db.from('neighborhoods')
      .select('*, cities!inner(county_id)')
      .eq('cities.county_id', 'c-rk')
      .eq('active', true)
      .order('name');
    expect(data).toHaveLength(1);
    const row = data as Array<{ name: string; cities: { county_id: string } }>;
    expect(row[0].name).toBe('پرند');
    expect(row[0].cities.county_id).toBe('c-rk');
  });

  it('__joins به خروجی نشت نکند', async () => {
    const { a } = await seedOwners();
    await db.from('properties').insert({ title: 'ف1', owner_id: a.id });
    const { data } = await db.from('properties').select('*').maybeSingle();
    expect((data as Record<string, unknown>).__joins).toBeUndefined();
  });
});

describe('localdb: upsert (ریستور)', () => {
  beforeEach(async () => { await reset(); });

  it('ignoreDuplicates: ردیف موجود رو نمی‌پوشاند', async () => {
    await db.from('owners').insert({ id: 'o1', name: 'قدیمی' });
    await db.from('owners').upsert([{ id: 'o1', name: 'تازه' }, { id: 'o2', name: 'جدید' }], { onConflict: 'id', ignoreDuplicates: true });
    const { data } = await db.from('owners').select('*').order('name');
    const names = (data as Array<{ id: string; name: string }>).map((r) => r.id);
    expect(names).toContain('o1');
    expect(names).toContain('o2');
    const o1 = (data as Array<{ id: string; name: string }>).find((r) => r.id === 'o1')!;
    expect(o1.name).toBe('قدیمی');
  });
});
