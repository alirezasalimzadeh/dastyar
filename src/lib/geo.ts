import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Province, County, District, City, Neighborhood } from '@/lib/types';

// Resolve Tehran dynamically. Database seeds generate UUIDs, so a hard-coded ID
// cannot be assumed to match every installation.
let tehranProvinceIdPromise: Promise<string | null> | null = null;

export function getTehranProvinceId(): Promise<string | null> {
  if (tehranProvinceIdPromise) return tehranProvinceIdPromise;
  tehranProvinceIdPromise = (async () => {
    let { data } = await supabase.from('provinces').select('id').eq('slug', 'tehran').maybeSingle();
    if (!data) ({ data } = await supabase.from('provinces').select('id').eq('name', 'تهران').maybeSingle());
    const id = data?.id ?? null;
    if (!id) tehranProvinceIdPromise = null;
    return id;
  })().catch(() => {
    tehranProvinceIdPromise = null;
    return null;
  });
  return tehranProvinceIdPromise;
}

// شهرستان‌ها مقدارهای ثابت دیتابیس هستند؛ مرجع واحد، یک بار در هر نشست و
// در دسترس همه بخش‌های برنامه (آفلاین: از کش دادهٔ سرویس‌ورکر)
let countiesRows: County[] | null = null;
let countiesPromise: Promise<County[]> | null = null;

export function loadActiveCounties(): Promise<County[]> {
  if (countiesRows) return Promise.resolve(countiesRows);
  if (countiesPromise) return countiesPromise;
  countiesPromise = (async () => {
    const provinceId = await getTehranProvinceId();
    let query = supabase.from('counties').select('*').eq('active', true).order('name');
    if (provinceId) query = query.eq('province_id', provinceId);
    const { data, error } = await query;
    if (!error && (data?.length ?? 0) > 0) return data as County[];
    // اگر استان تهران پیدا نشد یا خالی بود، به همهٔ شهرستان‌های فعال بسط می‌یابد
    const fallback = await supabase.from('counties').select('*').eq('active', true).order('name');
    if (fallback.error || !fallback.data) throw new Error(fallback.error?.message ?? 'دریافت شهرستان‌ها انجام نشد.');
    return fallback.data as County[];
  })().catch((error) => {
    countiesPromise = null;
    throw error;
  });
  countiesPromise.then((rows) => { countiesRows = rows; }).catch(() => { countiesPromise = null; });
  return countiesPromise;
}

// خواندن شهرستان‌های فعال: یک‌بار از دیتابیس، بقیهٔ نشست از حافظه
export function useActiveCounties() {
  const [counties, setCounties] = useState<County[]>(countiesRows ?? []);
  const [loading, setLoading] = useState(countiesRows === null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (countiesRows) return;
    let active = true;
    loadActiveCounties()
      .then((rows) => {
        if (active) {
          setCounties(rows);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('دریافت شهرستان‌ها انجام نشد.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { counties, loading, error };
}

// محله‌های یک شهرستان — یک‌بار برای هر شهرستان و با کش؛ بدون await seed
const neighborhoodsByCounty = new Map<string, Neighborhood[]>();

export function useCountyNeighborhoods(countyId: string | null) {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>(countyId ? neighborhoodsByCounty.get(countyId) ?? [] : []);

  useEffect(() => {
    if (!countyId) {
      setNeighborhoods([]);
      return;
    }
    if (neighborhoodsByCounty.has(countyId)) {
      setNeighborhoods(neighborhoodsByCounty.get(countyId)!);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('neighborhoods')
        .select('*, cities!inner(county_id)')
        .eq('cities.county_id', countyId)
        .eq('active', true)
        .order('name');
      if (!active) return;
      const rows = (data as Neighborhood[]) ?? [];
      neighborhoodsByCounty.set(countyId, rows);
      setNeighborhoods(rows);
    })();
    return () => { active = false; };
  }, [countyId]);

  return { neighborhoods };
}

// Cache for geographic data
const cache = {
  provinces: null as Province[] | null,
  counties: new Map<string, County[]>(),
  districts: new Map<string, District[]>(),
  cities: new Map<string, City[]>(),
  neighborhoods: new Map<string, Neighborhood[]>(),
};

export function useProvinces() {
  const [provinces, setProvinces] = useState<Province[]>(cache.provinces ?? []);
  const [loading, setLoading] =useState(!cache.provinces);

  useEffect(() => {
    if (cache.provinces) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('provinces')
        .select('*')
        .eq('active', true)
        .order('name');
      if (active && data) {
        cache.provinces = data as Province[];
        setProvinces(data as Province[]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return { provinces, loading };
}

export function useCounties(provinceId: string | null) {
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provinceId) { setCounties([]); return; }
    if (cache.counties.has(provinceId)) {
      setCounties(cache.counties.get(provinceId)!);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('counties')
        .select('*')
        .eq('province_id', provinceId)
        .eq('active', true)
        .order('name');
      if (active && data) {
        cache.counties.set(provinceId, data as County[]);
        setCounties(data as County[]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [provinceId]);

  return { counties, loading };
}

export function useDistricts(countyId: string | null) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!countyId) { setDistricts([]); return; }
    if (cache.districts.has(countyId)) {
      setDistricts(cache.districts.get(countyId)!);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('districts')
        .select('*')
        .eq('county_id', countyId)
        .eq('active', true)
        .order('name');
      if (active && data) {
        cache.districts.set(countyId, data as District[]);
        setDistricts(data as District[]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [countyId]);

  return { districts, loading };
}

export function useCities(countyId: string | null, provinceId?: string | null) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!countyId && !provinceId) { setCities([]); return; }
    const cacheKey = countyId ?? `prov:${provinceId}`;
    if (cache.cities.has(cacheKey)) {
      setCities(cache.cities.get(cacheKey)!);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      let query = supabase.from('cities').select('*').eq('active', true);
      if (countyId) query = query.eq('county_id', countyId);
      else if (provinceId) query = query.eq('province_id', provinceId);
      query = query.order('name');
      const { data } = await query;
      if (active && data) {
        cache.cities.set(cacheKey, data as City[]);
        setCities(data as City[]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [countyId, provinceId]);

  return { cities, loading };
}

export function useNeighborhoods(cityId: string | null) {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cityId) { setNeighborhoods([]); return; }
    if (cache.neighborhoods.has(cityId)) {
      setNeighborhoods(cache.neighborhoods.get(cityId)!);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('neighborhoods')
        .select('*')
        .eq('city_id', cityId)
        .eq('active', true)
        .order('name');
      if (active && data) {
        cache.neighborhoods.set(cityId, data as Neighborhood[]);
        setNeighborhoods(data as Neighborhood[]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [cityId]);

  return { neighborhoods, loading };
}

// Search locations by name (for global search)
export function useLocationSearch(query: string) {
  const [results, setResults] = useState<{ type: string; id: string; name: string; parent: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const [provRes, cityRes, nbhRes] = await Promise.all([
      supabase.from('provinces').select('id, name').ilike('name', `%${q}%`).limit(5),
      supabase.from('cities').select('id, name, province_id').ilike('name', `%${q}%`).limit(10),
      supabase.from('neighborhoods').select('id, name, city_id').ilike('name', `%${q}%`).limit(10),
    ]);

    const combined: { type: string; id: string; name: string; parent: string }[] = [];
    provRes.data?.forEach((p) => combined.push({ type: 'province', id: p.id, name: p.name, parent: '' }));
    cityRes.data?.forEach((c) => combined.push({ type: 'city', id: c.id, name: c.name, parent: '' }));
    nbhRes.data?.forEach((n) => combined.push({ type: 'neighborhood', id: n.id, name: n.name, parent: '' }));
    setResults(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return { results, loading };
}

// Get location name by ID (with caching)
const nameCache = new Map<string, string>();

export async function getLocationName(table: string, id: string): Promise<string> {
  const key = `${table}:${id}`;
  if (nameCache.has(key)) return nameCache.get(key)!;
  const { data } = await supabase.from(table).select('name').eq('id', id).maybeSingle();
  const name = data?.name ?? '';
  nameCache.set(key, name);
  return name;
}
