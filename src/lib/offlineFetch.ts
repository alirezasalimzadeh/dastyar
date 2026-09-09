import { openDB } from 'idb';

const CACHE_NAME = 'dastyar-data-v2';
const DB_NAME = 'dastyar-offline-v2';
const nativeFetch = globalThis.fetch.bind(globalThis);
let latestRestRequest: Request | null = null;

type QueuedRequest = {
  id?: number;
  url: string;
  method: string;
  headers: [string, string][];
  body: string | null;
  createdAt: string;
  failed?: boolean;
  lastError?: string;
};

const dbPromise = typeof indexedDB === 'undefined' ? null : openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('requests')) db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
  },
});

const tableFromUrl = (url: URL) => {
  const marker = '/rest/v1/';
  const index = url.pathname.indexOf(marker);
  return index < 0 ? '' : decodeURIComponent(url.pathname.slice(index + marker.length).split('/')[0]);
};

const userFromRequest = (request: Request) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || token.split('.').length < 2) return 'anonymous';
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).sub || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const cacheRequestFor = (request: Request) => {
  const url = new URL(request.url);
  url.searchParams.set('__dastyar_user', userFromRequest(request));
  return new Request(url.href, { method: 'GET' });
};

const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', 'content-range': Array.isArray(data) ? `0-${Math.max(0, data.length - 1)}/${data.length}` : '0-0/1' },
});

const parseFilter = (value: string) => {
  const dot = value.indexOf('.');
  return dot < 0 ? { operator: '', expected: value } : { operator: value.slice(0, dot), expected: value.slice(dot + 1) };
};

const matchesFilters = (record: Record<string, unknown>, url: URL) => {
  for (const [field, raw] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', '__dastyar_user'].includes(field) || field.includes('.')) continue;
    const { operator, expected } = parseFilter(raw);
    const actual = record[field];
    if (operator === 'eq' && String(actual ?? '') !== expected) return false;
    if (operator === 'neq' && String(actual ?? '') === expected) return false;
    if (operator === 'is' && expected === 'null' && actual != null) return false;
    if (operator === 'in') {
      const values = expected.replace(/^\(|\)$/g, '').split(',').map((item) => item.replace(/^"|"$/g, ''));
      if (!values.includes(String(actual ?? ''))) return false;
    }
    if (operator === 'gte' && String(actual ?? '') < expected) return false;
    if (operator === 'lte' && String(actual ?? '') > expected) return false;
    if (operator === 'ilike') {
      const needle = expected.replace(/\*/g, '').toLocaleLowerCase('fa');
      if (!String(actual ?? '').toLocaleLowerCase('fa').includes(needle)) return false;
    }
  }
  return true;
};

const queueRequest = async (request: Request, body: string | null) => {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.add('requests', {
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    body,
    createdAt: new Date().toISOString(),
  } satisfies QueuedRequest);
};

type ReplayResult = { status: 'ok' | 'failed' | 'network'; message?: string };

async function replayEntry(entry: QueuedRequest, authHeaders: Record<string, string>): Promise<ReplayResult> {
  const headers = new Headers(entry.headers);
  for (const [key, value] of Object.entries(authHeaders)) headers.set(key, value);
  try {
    const response = await nativeFetch(entry.url, { method: entry.method, headers, body: entry.body });
    // 409 یعنی رکورد قبلاً همگام شده (انتقال تکراری)؛ آن را هم موفقیت می‌شماریم
    if (response.ok || response.status === 409) return { status: 'ok' };
    let message = `کد پاسخ ${response.status}`;
    try {
      const text = await response.text();
      if (text) message = text.slice(0, 200);
    } catch {
      // پاسخ متنی ندارد
    }
    return { status: 'failed', message };
  } catch {
    return { status: 'network' };
  }
}

// همگام‌سازی صف آفلاین: هر مورد جداگانه پردازش می‌شود تا یک خطا کل صف را
// برای همیشه از کار نیاندازد؛ موارد شکست‌خورده علامت‌گذاری می‌شوند و از
// رابط کاربری قابل مشاهده و تکرار مجدد هستند.
async function flushQueue(currentRequest: Request | null, includeFailed = false) {
  if (!dbPromise || !navigator.onLine) return;
  const db = await dbPromise;
  const authHeaders: Record<string, string> = {};
  if (currentRequest) {
    const authorization = currentRequest.headers.get('authorization');
    const apiKey = currentRequest.headers.get('apikey');
    if (authorization) authHeaders.authorization = authorization;
    if (apiKey) authHeaders.apikey = apiKey;
  }
  const entries = (await db.getAll('requests')) as QueuedRequest[];
  for (const entry of entries) {
    if (entry.failed && !includeFailed) continue;
    const result = await replayEntry(entry, authHeaders);
    if (result.status === 'ok') {
      await db.delete('requests', entry.id!);
    } else if (result.status === 'failed') {
      await db.put('requests', { ...entry, failed: true, lastError: result.message });
    } else {
      break; // شبکه در دسترس نیست؛ در فرصت بعدی امتحان می‌شود
    }
  }
}

async function patchCachedQueries(request: Request, body: string | null) {
  if (!('caches' in globalThis)) return;
  const table = tableFromUrl(new URL(request.url));
  if (!table) return;
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const mutationUrl = new URL(request.url);
  const payload = body ? JSON.parse(body) : {};
  const incoming = Array.isArray(payload) ? payload : [payload];
  const patch = incoming[0] ?? {};

  for (const key of keys) {
    const keyUrl = new URL(key.url);
    if (tableFromUrl(keyUrl) !== table || keyUrl.searchParams.get('__dastyar_user') !== userFromRequest(request)) continue;
    const cached = await cache.match(key);
    if (!cached) continue;
    let data: unknown;
    try { data = await cached.json(); } catch { continue; }
    let rows = Array.isArray(data) ? data : data ? [data] : [];
    if (request.method === 'POST') {
      const additions = incoming.map((item) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item }));
      rows = [...additions.filter((item) => matchesFilters(item, keyUrl)), ...rows];
    } else if (request.method === 'PATCH') {
      rows = rows.map((item) => matchesFilters(item, mutationUrl) ? { ...item, ...patch, updated_at: new Date().toISOString() } : item);
    } else if (request.method === 'DELETE') {
      rows = rows.filter((item) => !matchesFilters(item, mutationUrl));
    }
    await cache.put(key, jsonResponse(Array.isArray(data) ? rows : rows[0] ?? null));
  }
}

async function offlineRead(request: Request) {
  const wantsObject = request.headers.get('accept')?.includes('application/vnd.pgrst.object+json');
  if ('caches' in globalThis) {
    const cache = await caches.open(CACHE_NAME);
    const exact = await cache.match(cacheRequestFor(request));
    if (exact) return exact;

    const requestUrl = new URL(request.url);
    const table = tableFromUrl(requestUrl);
    const user = userFromRequest(request);
    const collected = new Map<string, Record<string, unknown>>();
    for (const key of await cache.keys()) {
      const keyUrl = new URL(key.url);
      if (tableFromUrl(keyUrl) !== table || keyUrl.searchParams.get('__dastyar_user') !== user) continue;
      const response = await cache.match(key);
      if (!response) continue;
      try {
        const value = await response.json();
        const rows = Array.isArray(value) ? value : value ? [value] : [];
        rows.forEach((row, index) => collected.set(String(row.id ?? `${key.url}:${index}`), { ...collected.get(String(row.id)) , ...row }));
      } catch {
        // Ignore an invalid cache entry and continue with other cached queries.
      }
    }
    let rows = [...collected.values()].filter((row) => matchesFilters(row, requestUrl));
    const order = requestUrl.searchParams.get('order')?.split(',')[0];
    if (order) {
      const [field, direction] = order.split('.');
      rows.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * (direction === 'desc' ? -1 : 1));
    }
    const limit = Number(requestUrl.searchParams.get('limit') ?? rows.length);
    const offset = Number(requestUrl.searchParams.get('offset') ?? 0);
    rows = rows.slice(offset, offset + limit);
    return jsonResponse(wantsObject ? rows[0] ?? null : rows);
  }
  return jsonResponse(wantsObject ? null : []);
}

async function offlineMutation(request: Request, body: string | null) {
  const payload = body ? JSON.parse(body) : {};
  const filteredId = parseFilter(new URL(request.url).searchParams.get('id') ?? '').expected || undefined;
  const records = (Array.isArray(payload) ? payload : [payload]).map((item) => request.method === 'POST' ? ({
    id: item.id || crypto.randomUUID(),
    created_at: item.created_at || new Date().toISOString(),
    ...item,
  }) : ({ id: item.id || filteredId, ...item }));
  const queuedBody = request.method === 'POST'
    ? JSON.stringify(Array.isArray(payload) ? records : records[0])
    : body;
  await queueRequest(request, queuedBody);
  await patchCachedQueries(request, queuedBody);
  const wantsObject = request.headers.get('accept')?.includes('application/vnd.pgrst.object+json');
  return jsonResponse(wantsObject ? records[0] ?? null : records, request.method === 'POST' ? 201 : 200);
}

export async function offlineFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (!tableFromUrl(url)) return nativeFetch(request);
  latestRestRequest = request.clone();

  const isRead = request.method === 'GET' || request.method === 'HEAD';
  const body = isRead ? null : await request.clone().text();

  if (navigator.onLine) {
    try {
      await flushQueue(request);
      const response = await nativeFetch(request.clone());
      if (response.ok && isRead && 'caches' in globalThis) {
        await (await caches.open(CACHE_NAME)).put(cacheRequestFor(request), response.clone());
      }
      if (response.ok && !isRead) {
        const responseText = await response.clone().text();
        await patchCachedQueries(request, responseText || body);
      }
      if ([408, 502, 503, 504].includes(response.status)) {
        return isRead ? offlineRead(request) : offlineMutation(request, body);
      }
      return response;
    } catch {
      // Continue with the local cache/queue when the connection is unavailable.
    }
  }

  return isRead ? offlineRead(request) : offlineMutation(request, body);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // با بازگشت شبکه، صف (شامل موارد شکست‌خورده) را خودکار دوباره امتحان کن
    if (latestRestRequest) void flushQueue(latestRestRequest, true);
  });
}

export interface OfflineQueueItem {
  id: number;
  table: string;
  method: string;
  createdAt: string;
  failed: boolean;
  lastError?: string;
}

/** فهرست تغییرات ثبت‌شده در آفلاین برای نمایش در رابط کاربری */
export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  if (!dbPromise) return [];
  const db = await dbPromise;
  const entries = (await db.getAll('requests')) as QueuedRequest[];
  return entries.map((entry) => ({
    id: entry.id!,
    table: tableFromUrl(new URL(entry.url)),
    method: entry.method,
    createdAt: entry.createdAt,
    failed: Boolean(entry.failed),
    lastError: entry.lastError,
  }));
}

export async function getPendingOfflineCount() {
  if (!dbPromise) return 0;
  return (await dbPromise).count('requests');
}

/** همگام‌سازی دستی از رابط کاربری (با توکن نشست جاری) */
export async function syncOfflineQueue(auth: { authorization?: string | null; apikey?: string | null } = {}) {
  if (!dbPromise || !navigator.onLine) return;
  const db = await dbPromise;
  const authHeaders: Record<string, string> = {};
  if (auth.authorization) authHeaders.authorization = auth.authorization;
  if (auth.apikey) authHeaders.apikey = auth.apikey;
  const entries = (await db.getAll('requests')) as QueuedRequest[];
  for (const entry of entries) {
    const result = await replayEntry(entry, authHeaders);
    if (result.status === 'ok') {
      await db.delete('requests', entry.id!);
    } else if (result.status === 'failed') {
      await db.put('requests', { ...entry, failed: true, lastError: result.message });
    } else {
      break;
    }
  }
}

export async function removeOfflineEntry(id: number) {
  if (!dbPromise) return;
  await (await dbPromise).delete('requests', id);
}

export async function clearOfflineData() {
  if ('caches' in globalThis) await caches.delete(CACHE_NAME);
  if (dbPromise) (await dbPromise).clear('requests');
}
