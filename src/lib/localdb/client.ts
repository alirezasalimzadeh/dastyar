/* eslint-disable @typescript-eslint/no-explicit-any -- این لایه عمداً شکل supabase-js بدون
   schema را بازتولید می‌کند (data: any[] برای select، any برای single و عملیات نوشتار)؛
   با unknown، ۱۹۰ نقطهٔ مصرف موجود (callbackهای forEach/filter و castingها) می‌شکست. */
// query-builder محلی — همان سطح API از supabase-js که برنامه استفاده می‌کند
// -------------------------------------------------------------
// همهٔ نقاط دسترسی فعلی (select با join، insert/update/delete/upsert،
// فیلتر، مرتب‌سازی، count) بدون تغییر کد روی این لایه اجرا می‌شوند؛ تنها
// تفاوت این است که داده‌ها در IndexedDB خود دستگاه هستند، نه در ابر.
import { allRows, bulkPut, deleteRow, putRow } from './db';
import { ONE_TO_MANY, RELATIONS } from './schema';

export interface QueryError { code?: string; message: string }
export interface QueryResult<TData = any[]> {
  // any[] — دقیقاً مثل supabase-js بدون schema (PostgrestResponse<T> = PostgrestSingleResponse<T[]>).
  // برای single/maybeSingle نوع TData به any تغییر می‌کند.
  data: TData | null;
  error: QueryError | null;
  count?: number;
}

type Row = Record<string, unknown> & { __joins?: Record<string, Row | Row[] | null> };

interface Filter {
  kind: 'eq' | 'neq' | 'in' | 'contains' | 'lt' | 'lte' | 'gt' | 'gte' | 'ilike' | 'notNull' | 'joinEq';
  field: string;
  value?: unknown;
  values?: unknown[];
}

interface JoinSpec { table: string; columns: string[]; inner: boolean; fk: string }

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}
function nowIso(): string { return new Date().toISOString(); }

/** پارس مشخصهٔ select: ستون‌ها + joinهای `table(cols)` و `table!inner(fk)` */
export function parseSelectSpec(spec: string): { columns: string[] | null; joins: JoinSpec[] } {
  const columns: string[] = [];
  const joins: JoinSpec[] = [];
  for (const raw of splitTopLevel(spec)) {
    const token = raw.trim();
    if (!token) continue;
    if (token === '*') continue;
    const parenIndex = token.indexOf('(');
    const tableMatch = token.match(/^([a-z_]+)(!(inner|left))?/);
    if (parenIndex > 0 && tableMatch) {
      const table = tableMatch[1];
      const inner = Boolean(tableMatch[2]);
      const cols = token.slice(parenIndex + 1, -1).split(',').map((c) => c.trim()).filter(Boolean);
      joins.push({ table, columns: cols, inner, fk: inner ? (cols[0] ?? '') : '' });
    } else {
      columns.push(token);
    }
  }
  return { columns: columns.length > 0 ? columns : null, joins };
}

function splitTopLevel(spec: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of spec) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(current); current = ''; } else { current += ch; }
  }
  if (current.trim()) out.push(current);
  return out;
}

/** حذف کلید داخلی __joins و تصویر برداشتن ستون‌ها — پیوست‌ها مثل PostgREST همیشه می‌مانند */
function project(row: Row, columns: string[] | null, joinTables: Set<string> = new Set()): Record<string, unknown> {
  const clean: Row = { ...row };
  delete clean.__joins;
  if (!columns) return clean;
  const out: Record<string, unknown> = {};
  for (const c of columns) if (c in clean) out[c] = clean[c];
  for (const t of joinTables) if (t in clean) out[t] = clean[t];
  return out;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  if (/^\d{4}-\d{2}-\d{2}T/.test(sa) && /^\d{4}-\d{2}-\d{2}T/.test(sb)) return sa.localeCompare(sb);
  if (/^\d+(\.\d+)?$/.test(sa) && /^\d+(\.\d+)?$/.test(sb)) return Number(sa) - Number(sb);
  return sa.localeCompare(sb, 'fa');
}

function matchesFilter(row: Row, f: Filter): boolean {
  switch (f.kind) {
    case 'eq': return row[f.field] === f.value;
    case 'neq': return row[f.field] !== f.value;
    case 'in': return f.values?.includes(row[f.field]) ?? false;
    case 'contains': {
      const arr = row[f.field];
      if (!Array.isArray(arr) || !f.values) return false;
      return f.values.every((v) => arr.includes(v));
    }
    case 'lt': return row[f.field] != null && compareValues(row[f.field], f.value) < 0;
    case 'lte': return row[f.field] != null && compareValues(row[f.field], f.value) <= 0;
    case 'gt': return row[f.field] != null && compareValues(row[f.field], f.value) > 0;
    case 'gte': return row[f.field] != null && compareValues(row[f.field], f.value) >= 0;
    case 'ilike': {
      const pattern = String(f.value ?? '');
      if (!/%|_/.test(pattern)) return String(row[f.field] ?? '').toLowerCase() === pattern.toLowerCase();
      const regex = new RegExp(
        '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$',
        'i',
      );
      return regex.test(String(row[f.field] ?? ''));
    }
    case 'notNull': return row[f.field] != null;
    case 'joinEq': {
      const [table, col] = f.field.split('.');
      const joined = row.__joins?.[table];
      if (!joined) return false;
      const list = Array.isArray(joined) ? joined : [joined];
      return list.some((r) => r[col] === f.value);
    }
    default: return false;
  }
}

class LocalQuery<TData = any[]> {
  private filters: Filter[] = [];
  private orderSpecs: Array<{ field: string; ascending: boolean; nullsFirst: boolean }> = [];
  private limitValue: number | null = null;
  private selectSpec: { columns: string[] | null; joins: JoinSpec[] } | null = null;
  private selectOpts: { count?: string; head?: boolean } | null = null;
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private opPayload: Row | Row[] | null = null;
  private opUpsertOpts: { ignoreDuplicates?: boolean } | null = null;
  private returnSelection = false;
  private singleMode = false;
  private maybeSingleMode = false;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;

  constructor(private table: string) {}

  private clone(): LocalQuery<TData> {
    const q = new LocalQuery<TData>(this.table);
    q.filters = [...this.filters];
    q.orderSpecs = [...this.orderSpecs];
    q.limitValue = this.limitValue;
    q.selectSpec = this.selectSpec;
    q.selectOpts = this.selectOpts;
    q.op = this.op;
    q.opPayload = this.opPayload;
    q.opUpsertOpts = this.opUpsertOpts;
    q.returnSelection = this.returnSelection;
    q.singleMode = this.singleMode;
    q.maybeSingleMode = this.maybeSingleMode;
    q.rangeFrom = this.rangeFrom;
    q.rangeTo = this.rangeTo;
    return q;
  }

  // ---- زنجیره (immutable، مثل supabase-js) ----
  select(spec = '*', opts: { count?: string; head?: boolean } = {}) {
    const q = this.clone();
    if (q.op === 'insert' || q.op === 'update' || q.op === 'delete') {
      q.returnSelection = true;
      return q;
    }
    q.selectSpec = parseSelectSpec(spec);
    q.selectOpts = opts;
    return q;
  }

  insert(payload: Row | Row[]): LocalQuery<any> { const q = this.clone() as unknown as LocalQuery<any>; q.op = 'insert'; q.opPayload = Array.isArray(payload) ? payload : [payload]; return q; }
  update(payload: Row): LocalQuery<any> { const q = this.clone() as unknown as LocalQuery<any>; q.op = 'update'; q.opPayload = payload; return q; }
  delete(): LocalQuery<any> { const q = this.clone() as unknown as LocalQuery<any>; q.op = 'delete'; return q; }
  upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}): LocalQuery<any> {
    const q = this.clone() as unknown as LocalQuery<any>; q.op = 'upsert'; q.opPayload = Array.isArray(rows) ? rows : [rows]; q.opUpsertOpts = opts; return q;
  }

  eq(field: string, value: unknown) {
    const q = this.clone();
    q.filters.push(field.includes('.') ? { kind: 'joinEq', field, value } : { kind: 'eq', field, value });
    return q;
  }
  neq(field: string, value: unknown) { const q = this.clone(); q.filters.push({ kind: 'neq', field, value }); return q; }
  in(field: string, values: unknown[]) { const q = this.clone(); q.filters.push({ kind: 'in', field, values }); return q; }
  contains(field: string, values: unknown[]) { const q = this.clone(); q.filters.push({ kind: 'contains', field, values }); return q; }
  lt(field: string, value: unknown) { const q = this.clone(); q.filters.push({ kind: 'lt', field, value }); return q; }
  lte(field: string, value: unknown) { const q = this.clone(); q.filters.push({ kind: 'lte', field, value }); return q; }
  gt(field: string, value: unknown) { const q = this.clone(); q.filters.push({ kind: 'gt', field, value }); return q; }
  gte(field: string, value: unknown) { const q = this.clone(); q.filters.push({ kind: 'gte', field, value }); return q; }
  ilike(field: string, pattern: string) { const q = this.clone(); q.filters.push({ kind: 'ilike', field, value: pattern }); return q; }
  not(field: string, op: string, value: unknown) {
    const q = this.clone();
    if (op === 'is' && value === null) q.filters.push({ kind: 'notNull', field });
    return q;
  }
  order(field: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const q = this.clone();
    q.orderSpecs.push({ field, ascending: opts.ascending ?? true, nullsFirst: opts.nullsFirst ?? false });
    return q;
  }
  limit(n: number) { const q = this.clone(); q.limitValue = n; return q; }

  /** range مثل PostgREST: از from تا to (هر دو شامل) — پس از مرتب‌سازی */
  range(from: number, to: number) {
    const q = this.clone();
    q.rangeFrom = from;
    q.rangeTo = to;
    return q;
  }
  single(): LocalQuery<any> {
    const q = this.clone() as unknown as LocalQuery<any>;
    q.singleMode = true;
    if (!q.selectSpec) q.selectSpec = { columns: null, joins: [] };
    if (!q.selectOpts) q.selectOpts = {};
    return q;
  }
  maybeSingle(): LocalQuery<any> {
    const base = this.clone() as unknown as LocalQuery<any>;
    return base.maybeSingleInner();
  }
  maybeSingleInner() {
    const q = this.clone();
    q.maybeSingleMode = true;
    if (!q.selectSpec) q.selectSpec = { columns: null, joins: [] };
    if (!q.selectOpts) q.selectOpts = {};
    return q;
  }

  // ---- لولهٔ خواندن: فیلتر پایه ← join ← فیلتر join ← count/مرتب/لیمیت/تصویر ----
  private async resolvedRows(): Promise<Row[]> {
    let rows = await allRows(this.table);
    const baseFilters = this.filters.filter((f) => f.kind !== 'joinEq');
    if (baseFilters.length > 0) rows = rows.filter((row) => baseFilters.every((f) => matchesFilter(row, f)));
    if (this.selectSpec && this.selectSpec.joins.length > 0) {
      rows = await this.expandJoins(rows, this.selectSpec.joins);
    }
    const joinFilters = this.filters.filter((f) => f.kind === 'joinEq');
    if (joinFilters.length > 0) rows = rows.filter((row) => joinFilters.every((f) => matchesFilter(row, f)));
    return rows;
  }

  private async expandJoins(rows: Row[], joins: JoinSpec[]): Promise<Row[]> {
    const joinData: Record<string, Row[]> = {};
    for (const t of new Set(joins.map((j) => j.table))) joinData[t] = await allRows(t);

    const result: Row[] = [];
    for (const row of rows) {
      const __joins: Record<string, Row | Row[] | null> = {};
      let dropped = false;
      for (const spec of joins) {
        // کلید واقعی join از RELATIONS؛ آرگومان join (مثل cities!inner(county_id)) تصویر ستون‌هاست
        const fk = RELATIONS[this.table]?.[spec.table] || spec.fk || '';
        // joinهای یک‌به‌بسیار: ستون خارجی روی «جدول مقصد» است و با id ردیف مبدأ مقایسه می‌شود
        const manySide = ONE_TO_MANY[this.table]?.includes(spec.table);
        const myId = manySide ? row.id : row[fk];
        const matches = myId == null ? [] : joinData[spec.table].filter((r) => (manySide ? r[fk] : r.id) === myId);
        if (matches.length === 0) {
          if (spec.inner) { dropped = true; break; }
          __joins[spec.table] = ONE_TO_MANY[this.table]?.includes(spec.table) ? [] : null;
          continue;
        }
        const projected = matches.map((m) => project(m, spec.columns.length > 0 ? spec.columns : null));
        __joins[spec.table] = ONE_TO_MANY[this.table]?.includes(spec.table) ? projected : (projected[0] ?? null);
      }
      if (dropped) continue;
      const finalRow: Row = { ...row, __joins };
      for (const [key, value] of Object.entries(__joins)) finalRow[key] = value;
      result.push(finalRow);
    }
    return result;
  }

  async exec(): Promise<QueryResult<TData>> {
    const noRowsError: QueryError = { code: 'LOCAL116', message: 'JSON object requested, multiple (or no) rows returned' };
    const ok = (data: any, count?: number) => ({ data, error: null, ...(count !== undefined ? { count } : {}) }) as QueryResult<TData>;

    // ---- نوشتار ----
    if (this.op === 'insert') {
      const payloads = (this.opPayload as Row[]) ?? [];
      const written: Row[] = [];
      for (const p of payloads) {
        const row = { ...p };
        if (!row.id) row.id = newId();
        if (!row.created_at) row.created_at = nowIso();
        if (!row.updated_at) row.updated_at = row.created_at;
        await putRow(this.table, row);
        written.push(row);
      }
      if (this.returnSelection) {
        const cols = this.selectSpec?.columns ?? null;
        const data = this.singleMode ? project(written[0], cols) : written.map((r) => project(r, cols));
        return ok(data);
      }
      // insert ساده: یک ردیف → همان ردیف (مثل مصرف فعلی اپ: data.id)؛ چند ردیف → آرایه
      return ok(written.length === 1 ? written[0] : written);
    }

    if (this.op === 'upsert') {
      const rows = [...((this.opPayload as Row[]) ?? [])];
      const existing = new Set((await allRows(this.table)).map((r) => r.id));
      const toWrite = this.opUpsertOpts?.ignoreDuplicates ? rows.filter((r) => !existing.has(r.id)) : rows;
      for (const row of toWrite) {
        if (!row.id) row.id = newId();
        if (!row.created_at) row.created_at = nowIso();
      }
      await bulkPut(this.table, toWrite);
      return ok([]);
    }

    if (this.op === 'delete') {
      const rows = await this.resolvedRows();
      for (const row of rows) await deleteRow(this.table, String(row.id));
      return ok([]);
    }

    if (this.op === 'update') {
      const rows = await this.resolvedRows();
      const payload = this.opPayload as Row;
      for (const row of rows) await putRow(this.table, { ...row, ...payload, updated_at: nowIso() });
      if (this.returnSelection) {
        const cols = this.selectSpec?.columns ?? null;
        if (this.singleMode) {
          if (rows.length !== 1) return { data: null, error: noRowsError };
          return ok(project({ ...rows[0], ...payload }, cols));
        }
        return ok(rows.map((r) => project({ ...r, ...payload }, cols)));
      }
      return ok([]);
    }

    // ---- select ----
    const rows = await this.resolvedRows();
    const count = this.selectOpts?.count === 'exact' ? rows.length : undefined;

    if (this.orderSpecs.length > 0) {
      rows.sort((a, b) => {
        for (const spec of this.orderSpecs) {
          const av = a[spec.field];
          const bv = b[spec.field];
          if (av == null && bv == null) continue;
          if (av == null) return spec.nullsFirst ? -1 : 1;
          if (bv == null) return spec.nullsFirst ? 1 : -1;
          const c = compareValues(av, bv);
          if (c !== 0) return spec.ascending ? c : -c;
        }
        return 0;
      });
    }

    const ranged = this.rangeFrom != null && this.rangeTo != null ? rows.slice(this.rangeFrom, this.rangeTo + 1) : rows;
    const limited = this.limitValue != null ? ranged.slice(0, this.limitValue) : ranged;
    const joinTables = new Set((this.selectSpec?.joins ?? []).map((j) => j.table));
    const projected = limited.map((r) => project(r, this.selectSpec?.columns ?? null, joinTables));

    let data: any;
    if (this.singleMode) {
      if (projected.length !== 1) return { data: null, error: noRowsError, ...(count !== undefined ? { count } : {}) };
      data = projected[0];
    } else if (this.maybeSingleMode) {
      if (projected.length > 1) return { data: null, error: noRowsError, ...(count !== undefined ? { count } : {}) };
      data = projected[0] ?? null;
    } else {
      data = projected;
    }

    return { data: this.selectOpts?.head ? null : data, error: null, ...(count !== undefined ? { count } : {}) };
  }

  // thenable — `await client.from(...)` مثل نسخهٔ supabase-js
  then<TResult1 = QueryResult<TData>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<TData>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<QueryResult<TData> | TResult> {
    return this.exec().catch(onrejected as ((reason: unknown) => TResult | PromiseLike<TResult>));
  }
}

export function from(table: string): LocalQuery<any[]> {
  return new LocalQuery<any[]>(table);
}

/** کلاینت محلی با همان شکل `supabase.from(...)` */
export interface LocalClient {
  from: (table: string) => LocalQuery<any[]>;
}

export function createLocalClient(): LocalClient {
  return { from };
}
