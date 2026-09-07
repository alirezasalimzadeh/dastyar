import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ACTIVE_COUNTY_NAMES,
  ROBAT_KARIM_COUNTY_NAME,
  ROBAT_KARIM_NEIGHBORHOODS,
} from '@/lib/constants';
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

// One-time idempotent seeding of the geographic rows the app relies on.
let geoSeedPromise: Promise<void> | null = null;

export function ensureActiveGeo(): Promise<void> {
  if (geoSeedPromise) return geoSeedPromise;
  geoSeedPromise = (async () => {
    const tehranProvinceId = await getTehranProvinceId();
    if (!tehranProvinceId) {
      geoSeedPromise = null;
      return;
    }

    // ۱) شهرستان‌های جاافتاده استان تهران
    const { data: existingCounties } = await supabase
      .from('counties')
      .select('id, name, active')
      .eq('province_id', tehranProvinceId)
      .in('name', ACTIVE_COUNTY_NAMES);
    const have = new Set((existingCounties ?? []).map((c) => c.name));
    const missing = ACTIVE_COUNTY_NAMES.filter((n) => !have.has(n));
    for (const county of existingCounties ?? []) {
      if (!county.active) await supabase.from('counties').update({ active: true }).eq('id', county.id);
    }
    for (const name of missing) {
      await supabase
        .from('counties')
        .insert({ province_id: tehranProvinceId, name, slug: `auto-${name.replace(/\s+/g, '-')}`, active: true });
    }

    // ۲) شهر انکر برای محله‌های رباط کریم
    const { data: rkCounty } = await supabase
      .from('counties')
      .select('id')
      .eq('province_id', tehranProvinceId)
      .eq('name', ROBAT_KARIM_COUNTY_NAME)
      .maybeSingle();
    if (!rkCounty) return;
    let { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('county_id', rkCounty.id)
      .eq('name', ROBAT_KARIM_COUNTY_NAME)
      .maybeSingle();
    if (!city) {
      const { data: created } = await supabase
        .from('cities')
        .insert({ province_id: tehranProvinceId, county_id: rkCounty.id, name: ROBAT_KARIM_COUNTY_NAME, slug: 'robat-karim-city', active: true })
        .select()
        .maybeSingle();
      city = created;
    }
    if (!city) return;

    // ۳) محله‌های رباط کریم
    const { data: nbhs } = await supabase.from('neighborhoods').select('name').eq('city_id', city.id);
    const haveN = new Set((nbhs ?? []).map((n) => n.name));
    const missingN = ROBAT_KARIM_NEIGHBORHOODS.filter((n) => !haveN.has(n));
    if (missingN.length) {
      await supabase
        .from('neighborhoods')
        .insert(missingN.map((n) => ({ city_id: city.id, name: n, slug: `rk-${n.replace(/\s+/g, '-')}`, active: true })));
    }
  })().catch(() => {
    // اگر کاربر لاگین نیست یا خطای شبکه پیش آمد، دفعه بعد دوباره تلاش شود
    geoSeedPromise = null;
  });
  return geoSeedPromise;
}

// شهرستان‌های مورد استفاده را فوراً از داده موجود می‌گیرد. Seed در پس‌زمینه
// انجام می‌شود و شکست آن مانع نمایش گزینه‌های موجود نخواهد شد.
export function useActiveCounties() {
  const [counties, setCounties] = useState<County[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const provinceId = await getTehranProvinceId();
      let query = supabase.from('counties').select('*').in('name', ACTIVE_COUNTY_NAMES).order('name');
      if (provinceId) query = query.eq('province_id', provinceId);
      const { data } = await query;
      if (active && data) setCounties(data as County[]);
    };

    void load();
    void ensureActiveGeo().then(load);
    return () => { active = false; };
  }, []);

  return { counties };
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

// Neighborhoods of a county (via its cities), optionally limited to allowed names
export function useCountyNeighborhoods(countyId: string | null, allowedNames?: string[]) {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const namesKey = allowedNames ? allowedNames.join('|') : '';

  useEffect(() => {
    if (!countyId) { setNeighborhoods([]); return; }
    let active = true;
    (async () => {
      await ensureActiveGeo();
      let query = supabase
        .from('neighborhoods')
        .select('*, cities!inner(county_id)')
        .eq('cities.county_id', countyId)
        .eq('active', true)
        .order('name');
      if (allowedNames && allowedNames.length) query = query.in('name', allowedNames);
      const { data } = await query;
      if (active) setNeighborhoods((data as Neighborhood[]) ?? []);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countyId, namesKey]);

  return { neighborhoods };
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
