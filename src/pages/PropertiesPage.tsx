import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Search, Home, Phone, X, Filter, ArrowLeft, Trash2, Flame, Star, MapPin, Target, User, UserCheck, ImagePlus, Images, ChevronLeft, ChevronRight, Pencil, Maximize2, Handshake, Percent, Clock, Archive, ArchiveRestore, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  TRANSACTION_TYPES,
  TRANSACTION_ROLES,
  CATEGORIES,
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  ARCHIVE_REASONS,
  formatPrice,
  moneyToPersianWords,
  rentToDepositEquivalent,
  commissionFromTransactionValue,
  formatDate,
  getTransactionLabel,
  getCategoryLabel,
  getPropertyTypeLabel,
  getStatusInfo,
  normalizePhone,
  validatePhone,
  toEnglishDigits,
  toPersianDigits,
  timeAgo,
  ROBAT_KARIM_COUNTY_NAME,
  ROBAT_KARIM_STREETS,
  COLLEAGUE_TAG,
} from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, MoneyInput, PageHeader, Pagination, ConfirmDialog, SortSelect } from '@/components/ui';
import { useActiveCounties, useCountyNeighborhoods } from '@/lib/geo';
import type { Property, Owner, Colleague } from '@/lib/types';
import { ownerToColleague, useColleagues } from '@/lib/colleagues';
import { CallFormModal, CallRecordCard } from '@/components/calls';
import { FollowupFormModal, FollowupRecordCard } from '@/components/followups';
import propertyPlaceholder from '@/assets/property-placeholder.jpg';
import {
  MAX_PROPERTY_IMAGES,
  MAX_PROPERTY_IMAGE_SIZE,
  PROPERTY_IMAGE_TYPES,
  preparePropertyImages,
} from '@/lib/propertyImages';
import { getArchiveInfo, markPropertyArchived, clearPropertyArchive, type ArchiveInfo } from '@/lib/propertyArchive';
import { getFileSource, hasDivarSource, markDivarSource, FILE_SOURCE_LABELS } from '@/lib/propertySource';
import { useConsultants, consultantName } from '@/lib/consultants';

const PAGE_SIZE = 20;

type PropertyListItem = Property & {
  owners?: { name: string; phone: string } | null;
  provinces?: { name: string } | null;
  counties?: { name: string } | null;
  cities?: { name: string } | null;
  neighborhoods?: { name: string } | null;
};

const EMPTY_PROPERTY_FILTERS = {
  transaction_type: '',
  transaction_role: '',
  category: '',
  property_type: '',
  status: '',
  county_id: '',
  min_price: '',
  max_price: '',
  min_deposit: '',
  max_deposit: '',
  min_rent: '',
  max_rent: '',
  min_area: '',
  max_area: '',
  min_bedrooms: '',
  source: '',
  is_hot: '',
  has_images: '',
  negotiable: '',
  parking: false,
  elevator: false,
  storage: false,
};

type PropertyFilters = typeof EMPTY_PROPERTY_FILTERS;

const PROPERTY_SORTS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'area_desc', label: 'بیشترین متراژ' },
  { value: 'price_per_meter', label: 'قیمت هر متر' },
  { value: 'title', label: 'عنوان (الفبا)' },
];

// تا وقتی ستون street در دیتابیس ساخته نشده، خیابان در payment_conditions ذخیره می‌شود
const getStreet = (p: { street?: string | null; payment_conditions?: string | null }) =>
  p.street ?? p.payment_conditions ?? '';

// Keep this apartment-only value in an existing, currently unused metadata column so
// older Supabase installations do not need a schema migration.
const UNITS_PER_FLOOR_MARKER = /(?:^|\n)\[units_per_floor:(\d+)\](?=\n|$)/;
const getUnitsPerFloor = (metadata?: string | null) => metadata?.match(UNITS_PER_FLOOR_MARKER)?.[1] ?? '';
const setUnitsPerFloor = (metadata: string, value: string) => {
  const rest = metadata.replace(UNITS_PER_FLOOR_MARKER, '').trim();
  return [rest, value ? `[units_per_floor:${value}]` : ''].filter(Boolean).join('\n') || null;
};

const RENT_BUDGET_MARKER = /(?:^|\n)\[rent_budget_mins:(\d*),(\d*)\](?=\n|$)/;
const getRentBudgetMins = (metadata?: string | null) => {
  const match = metadata?.match(RENT_BUDGET_MARKER);
  return { deposit: match?.[1] ?? '', rent: match?.[2] ?? '', isRange: Boolean(match) };
};
const setRentBudgetMins = (metadata: string, deposit: string, rent: string, enabled: boolean) => {
  const rest = metadata.replace(RENT_BUDGET_MARKER, '').trim();
  const marker = enabled ? `[rent_budget_mins:${deposit},${rent}]` : '';
  return [rest, marker].filter(Boolean).join('\n');
};

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// ستون‌های «فهرست سبک»: عکس‌ها به‌صورت base64 در ستون images دیتابیس ذخیره می‌شوند،
// بنابراین فرستادن آن‌ها برای همه فایل‌ها در هر بار لود، اصلی‌ترین دلیل سنگینی
// بارگذاری است. عکس‌ها فقط برای صفحهٔ جاری جداگانه و سبک بارگذاری می‌شوند.
const PROPERTY_LIST_COLUMNS = [
  'id', 'title', 'description', 'transaction_type', 'transaction_role', 'category', 'property_type',
  'status', 'is_hot', 'is_featured', 'is_active', 'owner_id', 'owner_relationship', 'assigned_consultant_id',
  // street موقتاً در انتخاب نیست: ستون هنوز در دیتابیس ساخته نشده و مقدار
  // خیابان در payment_conditions نگه داشته می‌شود (نمایش با getStreet درست است).
  'province_id', 'county_id', 'district_id', 'city_id', 'neighborhood_id', 'address',
  'land_area', 'building_area', 'bedrooms', 'rooms', 'floor', 'total_floors', 'unit_number', 'building_age',
  'parking', 'storage', 'elevator', 'balcony', 'yard', 'garden', 'pool', 'security', 'heating', 'cooling',
  'sale_price', 'deposit_price', 'monthly_rent', 'price_per_meter', 'participation_price', 'negotiable',
  'payment_conditions', 'commission', 'owner_notes', 'owner_followup_status', 'created_at',
].join(', ');

const databaseErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
};

export function PropertiesPage({ initialId }: { initialId?: string }) {
  const { user } = useAuth();
  const colleagueOptions = useColleagues();
  const { counties: filterCounties } = useActiveCounties();
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<PropertyFilters>({ ...EMPTY_PROPERTY_FILTERS });
  // نمای اصلی: فایل‌های فعال (بدون بایگانی) یا فایل‌های بایگانی‌شده
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    if (initialId) {
      setSelectedId(initialId);
      setView('detail');
    }
  }, [initialId]);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // فهرست سبک: بدون ستون images تا حجم هر بار لود کم بماند (عکس‌ها بعداً
      // فقط برای صفحهٔ جاری می‌آیند). اگر نصب فعلی ستون‌های متفاوتی داشته باشد،
      // به انتخاب کامل بازمی‌گردد تا هیچ فایلی گم نشود.
      const richResult = await supabase
        .from('properties')
        .select(`${PROPERTY_LIST_COLUMNS}, owners(name, phone), counties(name), neighborhoods(name)`, { count: 'exact' });

      if (!richResult.error) {
        // رشتهٔ انتخاب ستون‌ها داینامیک است؛ TypeScript نمی‌تواند نوع آن را از قبل پارس کند
        setProperties((richResult.data as unknown as PropertyListItem[]) ?? []);
        setTotal(richResult.count ?? (richResult.data?.length ?? 0));
        return;
      }

      // Some installations do not expose every geographic relationship in the
      // PostgREST schema cache. Retry with the full row so registered files remain visible.
      const fallbackResult = await supabase
        .from('properties')
        .select('*, owners(name, phone), counties(name), neighborhoods(name)', { count: 'exact' });
      if (fallbackResult.error) throw fallbackResult.error;
      setProperties((fallbackResult.data as PropertyListItem[]) ?? []);
      setTotal(fallbackResult.count ?? fallbackResult.data?.length ?? 0);
    } catch (error) {
      setProperties([]);
      setTotal(0);
      setLoadError(databaseErrorMessage(error, 'دریافت فایل‌ها انجام نشد.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // فایل‌های بایگانی‌شده در فهرست اصلی نمایش داده نمی‌شوند؛ فقط در نمای «بایگانی»
  const archivedCount = useMemo(
    () => properties.filter((p) => getArchiveInfo(p.owner_followup_status) !== null).length,
    [properties],
  );

  // فیلتر «دارای عکس / بدون عکس» به ستون عکس نیاز دارد که در فهرست سبک نمی‌آید؛
  // فقط وقتی این فیلتر فعال می‌شود، وضعیت عکس‌ها جداگانه (و یک‌بار) بارگذاری می‌شود
  const [allImages, setAllImages] = useState<Record<string, string[]> | null>(null);
  useEffect(() => {
    if (!filters.has_images) {
      setAllImages(null);
      return;
    }
    let active = true;
    supabase
      .from('properties')
      .select('id, images')
      .then(({ data }) => {
        if (!active || !data) return;
        const map: Record<string, string[]> = {};
        for (const row of data as { id: string; images: string[] | null }[]) map[row.id] = row.images ?? [];
        setAllImages(map);
      });
    return () => { active = false; };
  }, [filters.has_images]);

  const visibleProperties = useMemo(() => {
    const q = toEnglishDigits(search.trim()).toLowerCase();
    let rows = archiveView === 'archived'
      ? properties.filter((p) => getArchiveInfo(p.owner_followup_status) !== null)
      : properties.filter((p) => getArchiveInfo(p.owner_followup_status) === null);
    if (q) {
      rows = rows.filter((p) =>
        (p.title ?? '').toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q) ||
        (p.owners?.name ?? '').toLowerCase().includes(q) ||
        toEnglishDigits(p.owners?.phone ?? '').includes(q) ||
        (p.counties?.name ?? '').toLowerCase().includes(q) ||
        (p.neighborhoods?.name ?? '').toLowerCase().includes(q),
      );
    }
    if (filters.transaction_type) rows = rows.filter((p) => p.transaction_type === filters.transaction_type);
    if (filters.transaction_role) rows = rows.filter((p) => p.transaction_role === filters.transaction_role);
    if (filters.category) rows = rows.filter((p) => p.category === filters.category);
    if (filters.property_type) rows = rows.filter((p) => p.property_type === filters.property_type);
    if (filters.status) rows = rows.filter((p) => p.status === filters.status);
    if (filters.county_id) rows = rows.filter((p) => p.county_id === filters.county_id);
    if (filters.is_hot) rows = rows.filter((p) => (filters.is_hot === 'true') === !!p.is_hot);
    if (filters.has_images) {
      rows = rows.filter((p) => {
        const imageCount = allImages ? (allImages[p.id]?.length ?? 0) : (p.images?.length ?? 0);
        return (filters.has_images === 'true') === imageCount > 0;
      });
    }
    if (filters.negotiable) rows = rows.filter((p) => (filters.negotiable === 'true') === !!p.negotiable);
    if (filters.source === 'owner') rows = rows.filter((p) => Boolean(p.owner_id) && !isUuid(p.owner_relationship) && !hasDivarSource(p.owner_followup_status));
    if (filters.source === 'colleague') rows = rows.filter((p) => isUuid(p.owner_relationship) && !hasDivarSource(p.owner_followup_status));
    if (filters.source === 'divar') rows = rows.filter((p) => hasDivarSource(p.owner_followup_status));
    if (filters.parking) rows = rows.filter((p) => Boolean(p.parking));
    if (filters.elevator) rows = rows.filter((p) => Boolean(p.elevator));
    if (filters.storage) rows = rows.filter((p) => Boolean(p.storage));

    const numberFilter = (value: string) => value ? Number(toEnglishDigits(value)) : null;
    const minPrice = numberFilter(filters.min_price);
    const maxPrice = numberFilter(filters.max_price);
    const minDeposit = numberFilter(filters.min_deposit);
    const maxDeposit = numberFilter(filters.max_deposit);
    const minRent = numberFilter(filters.min_rent);
    const maxRent = numberFilter(filters.max_rent);
    const minArea = numberFilter(filters.min_area);
    const maxArea = numberFilter(filters.max_area);
    const minBedrooms = numberFilter(filters.min_bedrooms);
    if (filters.transaction_type === 'rent') {
      if (minDeposit != null) rows = rows.filter((p) => (p.deposit_price ?? -1) >= minDeposit);
      if (maxDeposit != null) rows = rows.filter((p) => (p.deposit_price ?? Number.POSITIVE_INFINITY) <= maxDeposit);
      if (minRent != null) rows = rows.filter((p) => (p.monthly_rent ?? -1) >= minRent);
      if (maxRent != null) rows = rows.filter((p) => (p.monthly_rent ?? Number.POSITIVE_INFINITY) <= maxRent);
    } else {
      if (minPrice != null) rows = rows.filter((p) => (p.sale_price ?? p.participation_price ?? -1) >= minPrice);
      if (maxPrice != null) rows = rows.filter((p) => (p.sale_price ?? p.participation_price ?? Number.POSITIVE_INFINITY) <= maxPrice);
    }
    if (minArea != null) rows = rows.filter((p) => (p.building_area ?? p.land_area ?? -1) >= minArea);
    if (maxArea != null) rows = rows.filter((p) => (p.building_area ?? p.land_area ?? Number.POSITIVE_INFINITY) <= maxArea);
    if (minBedrooms != null) rows = rows.filter((p) => (p.bedrooms ?? -1) >= minBedrooms);

    const priceOf = (p: PropertyListItem) => p.sale_price ?? p.participation_price ?? p.deposit_price ?? p.monthly_rent ?? -1;
    const areaOf = (p: PropertyListItem) => p.building_area ?? p.land_area ?? -1;
    switch (sortKey) {
      case 'oldest': rows = [...rows].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')); break;
      case 'price_desc': rows = [...rows].sort((a, b) => priceOf(b) - priceOf(a)); break;
      case 'price_asc': rows = [...rows].sort((a, b) => priceOf(a) - priceOf(b)); break;
      case 'area_desc': rows = [...rows].sort((a, b) => areaOf(b) - areaOf(a)); break;
      case 'price_per_meter': rows = [...rows].sort((a, b) => (b.price_per_meter ?? -1) - (a.price_per_meter ?? -1)); break;
      case 'title': rows = [...rows].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'fa')); break;
      default: rows = [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    }
    return rows;
  }, [properties, search, filters, sortKey, archiveView, allImages]);

  const totalPages = Math.ceil(visibleProperties.length / PAGE_SIZE);
  const pageItems = visibleProperties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // عکس‌های صفحهٔ جاری: فهرست سبک بدون عکس است، پس فقط ۲۰ فایل این صفحه عکس می‌گیرند
  const [pageImages, setPageImages] = useState<Record<string, string[]>>({});
  const pageIdsKey = useMemo(() => pageItems.map((p) => p.id).join(','), [pageItems]);
  useEffect(() => {
    if (!pageIdsKey) {
      setPageImages({});
      return;
    }
    let active = true;
    supabase
      .from('properties')
      .select('id, images')
      .in('id', pageIdsKey.split(','))
      .then(({ data }) => {
        if (!active || !data) return;
        const map: Record<string, string[]> = {};
        for (const row of data as { id: string; images: string[] | null }[]) map[row.id] = row.images ?? [];
        setPageImages(map);
      });
    return () => { active = false; };
  }, [pageIdsKey]);

  if (view === 'create') {
    return <PropertyForm onBack={() => setView('list')} onSaved={() => { setView('list'); loadProperties(); }} />;
  }

  if (view === 'edit' && selectedId) {
    return (
      <PropertyForm
        propertyId={selectedId}
        onBack={() => setView('detail')}
        onSaved={() => { setView('detail'); loadProperties(); }}
      />
    );
  }

  if (view === 'detail' && selectedId) {
    return (
      <PropertyDetail
        propertyId={selectedId}
        onBack={() => { setView('list'); setSelectedId(null); }}
        onEdit={() => setView('edit')}
      />
    );
  }

  const activeFilterCount = Object.values(filters).filter((value) => value === true || (typeof value === 'string' && value !== '')).length;
  const updateFilter = <K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ ...EMPTY_PROPERTY_FILTERS });
    setPage(1);
  };
  const removeFilter = (key: keyof PropertyFilters) => {
    setFilters((current) => {
      if (key === 'transaction_type') return { ...current, transaction_type: '', transaction_role: '', min_deposit: '', max_deposit: '', min_rent: '', max_rent: '' };
      if (key === 'category') return { ...current, category: '', property_type: '' };
      return { ...current, [key]: EMPTY_PROPERTY_FILTERS[key] };
    });
    setPage(1);
  };
  const filterChips: { key: keyof PropertyFilters; label: string }[] = [];
  const addChip = (key: keyof PropertyFilters, label: string, active = Boolean(filters[key])) => { if (active) filterChips.push({ key, label }); };
  addChip('transaction_type', TRANSACTION_TYPES.find((item) => item.value === filters.transaction_type)?.label ?? '');
  addChip('transaction_role', TRANSACTION_ROLES[filters.transaction_type]?.find((item) => item.value === filters.transaction_role)?.label ?? '');
  addChip('category', CATEGORIES.find((item) => item.value === filters.category)?.label ?? '');
  addChip('property_type', PROPERTY_TYPES[filters.category]?.find((item) => item.value === filters.property_type)?.label ?? '');
  addChip('county_id', filterCounties.find((item) => item.id === filters.county_id)?.name ?? '');
  addChip('status', PROPERTY_STATUSES.find((item) => item.value === filters.status)?.label ?? '');
  addChip('min_price', `قیمت از ${formatPrice(Number(filters.min_price))}`);
  addChip('max_price', `قیمت تا ${formatPrice(Number(filters.max_price))}`);
  addChip('min_deposit', `پول پیش از ${formatPrice(Number(filters.min_deposit))}`);
  addChip('max_deposit', `پول پیش تا ${formatPrice(Number(filters.max_deposit))}`);
  addChip('min_rent', `اجاره از ${formatPrice(Number(filters.min_rent))}`);
  addChip('max_rent', `اجاره تا ${formatPrice(Number(filters.max_rent))}`);
  addChip('min_area', `متراژ از ${toPersianDigits(filters.min_area)}`);
  addChip('max_area', `متراژ تا ${toPersianDigits(filters.max_area)}`);
  addChip('min_bedrooms', `${toPersianDigits(filters.min_bedrooms)} خواب و بیشتر`);
  addChip('source', filters.source === 'owner' ? 'مالک مستقیم' : filters.source === 'colleague' ? 'فایل همکار' : 'فایل دیوار');
  addChip('is_hot', filters.is_hot === 'true' ? 'فقط داغ' : 'فقط عادی');
  addChip('has_images', filters.has_images === 'true' ? 'دارای عکس' : 'بدون عکس');
  addChip('negotiable', filters.negotiable === 'true' ? 'قابل تبدیل/مذاکره' : 'غیرقابل تبدیل/مذاکره');
  addChip('parking', 'پارکینگ', filters.parking);
  addChip('elevator', 'آسانسور', filters.elevator);
  addChip('storage', 'انباری', filters.storage);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="فایل‌ها"
        subtitle={`${toPersianDigits(archiveView === 'archived' ? archivedCount : properties.length - archivedCount)} فایل`}
        actions={
          <button onClick={() => setView('create')} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">فایل جدید</span>
          </button>
        }
      />

      <div className="relative mb-3">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input pr-10"
          placeholder="عنوان، آدرس، مالک، تلفن یا موقعیت..."
        />
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-medium" role="tablist" aria-label="نمایش فایل‌ها">
          <button
            type="button"
            role="tab"
            aria-selected={archiveView === 'active'}
            onClick={() => { setArchiveView('active'); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 transition-colors ${archiveView === 'active' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            فایل‌های فعال
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={archiveView === 'archived'}
            onClick={() => { setArchiveView('archived'); setPage(1); }}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${archiveView === 'archived' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Archive size={13} />
            بایگانی
            <span className="opacity-70">{toPersianDigits(archivedCount)}</span>
          </button>
        </div>
        <select className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-400" value={filters.transaction_type} onChange={(e) => { setFilters((current) => ({ ...current, transaction_type: e.target.value, transaction_role: '', min_price: '', max_price: '', min_deposit: '', max_deposit: '', min_rent: '', max_rent: '' })); setPage(1); }}>
          <option value="">نوع معامله</option>
          {TRANSACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-400" value={filters.category} onChange={(e) => { setFilters((current) => ({ ...current, category: e.target.value, property_type: '' })); setPage(1); }}>
          <option value="">دسته‌بندی</option>
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-400" value={filters.county_id} onChange={(e) => updateFilter('county_id', e.target.value)}>
          <option value="">شهرستان</option>
          {filterCounties.map((county) => <option key={county.id} value={county.id}>{county.name}</option>)}
        </select>
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary relative shrink-0 ${showFilters ? 'border-slate-800 bg-slate-900 text-white hover:bg-slate-800' : ''}`}>
          <Filter size={16} /> فیلترهای بیشتر
          {activeFilterCount > 0 && <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${showFilters ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>{toPersianDigits(activeFilterCount)}</span>}
        </button>
        {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="shrink-0 px-2 text-xs font-medium text-red-500">پاک کردن</button>}
      </div>

      {filterChips.length > 0 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {filterChips.map((chip) => (
            <button key={chip.key} type="button" onClick={() => removeFilter(chip.key)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-600">
              {chip.label}<X size={12} />
            </button>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="card mb-4 overflow-hidden animate-slide-up border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">فیلتر حرفه‌ای فایل‌ها</h3>
              <p className="mt-0.5 text-[11px] text-slate-400">معیارها را ترکیب کنید تا سریع‌تر به فایل مناسب برسید.</p>
            </div>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="text-xs font-medium text-red-500 hover:text-red-700">پاک کردن همه</button>}
          </div>

          <div className="space-y-5 p-4">
            <section>
              <p className="mb-2 text-xs font-bold text-slate-600">جزئیات فایل</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">نقش در معامله</label>
                  <select className="input" value={filters.transaction_role} disabled={!filters.transaction_type} onChange={(e) => updateFilter('transaction_role', e.target.value)}>
                    <option value="">همه نقش‌ها</option>
                    {(TRANSACTION_ROLES[filters.transaction_type] ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">نوع دقیق ملک</label>
                  <select className="input" value={filters.property_type} disabled={!filters.category} onChange={(e) => updateFilter('property_type', e.target.value)}>
                    <option value="">همه انواع</option>
                    {(PROPERTY_TYPES[filters.category] ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">وضعیت فایل</label>
                  <select className="input" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                    <option value="">همه وضعیت‌ها</option>
                    {PROPERTY_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-bold text-slate-600">محدوده مالی و مشخصات</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {filters.transaction_type === 'rent' ? (
                  <>
                    <div><label className="label">حداقل پول پیش</label><MoneyInput value={filters.min_deposit} onChange={(value) => updateFilter('min_deposit', value)} placeholder="100000000" showWords={false} /></div>
                    <div><label className="label">حداکثر پول پیش</label><MoneyInput value={filters.max_deposit} onChange={(value) => updateFilter('max_deposit', value)} placeholder="500000000" showWords={false} /></div>
                    <div><label className="label">حداقل اجاره ماهانه</label><MoneyInput value={filters.min_rent} onChange={(value) => updateFilter('min_rent', value)} placeholder="3000000" showWords={false} /></div>
                    <div><label className="label">حداکثر اجاره ماهانه</label><MoneyInput value={filters.max_rent} onChange={(value) => updateFilter('max_rent', value)} placeholder="10000000" showWords={false} /></div>
                  </>
                ) : (
                  <>
                    <div><label className="label">حداقل قیمت کل</label><MoneyInput value={filters.min_price} onChange={(value) => updateFilter('min_price', value)} placeholder="1000000000" showWords={false} /></div>
                    <div><label className="label">حداکثر قیمت کل</label><MoneyInput value={filters.max_price} onChange={(value) => updateFilter('max_price', value)} placeholder="5000000000" showWords={false} /></div>
                  </>
                )}
                <div><label className="label">حداقل متراژ</label><input className="input" type="number" min="0" inputMode="numeric" value={filters.min_area} onChange={(e) => updateFilter('min_area', e.target.value)} placeholder="۷۰" /></div>
                <div><label className="label">حداکثر متراژ</label><input className="input" type="number" min="0" inputMode="numeric" value={filters.max_area} onChange={(e) => updateFilter('max_area', e.target.value)} placeholder="۱۵۰" /></div>
                <div><label className="label">حداقل خواب</label><select className="input" value={filters.min_bedrooms} onChange={(e) => updateFilter('min_bedrooms', e.target.value)}><option value="">مهم نیست</option>{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{toPersianDigits(count)} خواب و بیشتر</option>)}</select></div>

              </div>
            </section>

            <section className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-bold text-slate-600">ویژگی‌ها و منبع</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['parking', 'پارکینگ'],
                  ['elevator', 'آسانسور'],
                  ['storage', 'انباری'],
                ] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => updateFilter(key, !filters[key])} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${filters[key] ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{label}</button>
                ))}
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none" value={filters.source} onChange={(e) => updateFilter('source', e.target.value)}><option value="">هر منبعی</option><option value="owner">مالک مستقیم</option><option value="colleague">فایل همکار</option><option value="divar">فایل دیوار</option></select>
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none" value={filters.is_hot} onChange={(e) => updateFilter('is_hot', e.target.value)}><option value="">داغ یا عادی</option><option value="true">فقط فایل‌های داغ</option><option value="false">فقط فایل‌های عادی</option></select>
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none" value={filters.has_images} onChange={(e) => updateFilter('has_images', e.target.value)}><option value="">با عکس یا بدون عکس</option><option value="true">فقط دارای عکس</option><option value="false">فقط بدون عکس</option></select>
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none" value={filters.negotiable} onChange={(e) => updateFilter('negotiable', e.target.value)}><option value="">قابل تبدیل/مذاکره مهم نیست</option><option value="true">فقط قابل تبدیل/مذاکره</option><option value="false">غیرقابل تبدیل/مذاکره</option></select>
              </div>
            </section>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-500">{toPersianDigits(visibleProperties.length)} فایل مطابق معیارهای انتخابی</span>
              {activeFilterCount > 0 && <span className="font-bold text-slate-700">{toPersianDigits(activeFilterCount)} فیلتر فعال</span>}
            </div>
          </div>
        </div>
      )}

      <SortSelect value={sortKey} options={PROPERTY_SORTS} onChange={(v) => { setSortKey(v); setPage(1); }} />

      {loadError && !loading && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span><strong>دریافت فایل‌ها انجام نشد:</strong> {loadError}</span>
          <button type="button" onClick={loadProperties} className="shrink-0 font-bold">تلاش مجدد</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : loadError ? null : visibleProperties.length === 0 ? (
        <EmptyState
          icon={archiveView === 'archived' ? <Archive size={48} /> : <Home size={48} />}
          title={archiveView === 'archived' ? 'فایلی بایگانی نشده است' : 'فایلی یافت نشد'}
          description={archiveView === 'archived' ? 'آگهی‌هایی که منقضی شده‌اند و بایگانی می‌کنید، اینجا نمایش داده می‌شوند.' : 'فایل جدیدی ثبت کنید یا فیلترها را تغییر دهید'}
          action={archiveView === 'active' ? <button onClick={() => setView('create')} className="btn-primary"><Plus size={18} /> فایل جدید</button> : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pageItems.map((p) => {
              const status = getStatusInfo(PROPERTY_STATUSES, p.status);
              const archive = getArchiveInfo(p.owner_followup_status);
              const rentBudget = getRentBudgetMins(p.owner_followup_status);
              const sourceColleague = colleagueOptions.find((colleague) => colleague.id === p.owner_relationship);
              const locationParts = [p.neighborhoods?.name, p.counties?.name].filter(Boolean) as string[];
              const locationLine = locationParts.length > 0 ? locationParts.join('، ') : p.address || 'بدون موقعیت';
              const roleLabel = p.transaction_role
                ? TRANSACTION_ROLES[p.transaction_type]?.find((r) => r.value === p.transaction_role)?.label ?? p.transaction_role
                : '';

              const specs: string[] = [];
              if (p.building_area != null) specs.push(`${formatPrice(p.building_area)} متر بنا`);
              if (p.land_area != null) specs.push(`${formatPrice(p.land_area)} متر زمین`);
              if (p.bedrooms != null) specs.push(`${formatPrice(p.bedrooms)} خواب`);
              if (p.rooms != null) specs.push(`${formatPrice(p.rooms)} اتاق`);
              if (p.floor != null) specs.push(p.total_floors != null ? `طبقه ${formatPrice(p.floor)} از ${formatPrice(p.total_floors)}` : `طبقه ${formatPrice(p.floor)}`);
              if (p.unit_number) specs.push(`واحد ${p.unit_number}`);
              if (p.building_age != null) specs.push(`${formatPrice(p.building_age)} ساله`);
              if (p.parking) specs.push('پارکینگ');
              if (p.elevator) specs.push('آسانسور');
              if (p.storage) specs.push('انباری');
              if (p.balcony) specs.push('بالکن');
              if (p.yard) specs.push('حیاط');
              if (p.garden) specs.push('باغ');
              if (p.pool) specs.push('استخر');
              if (p.security) specs.push('امنیت');

              const hasRentPrice = p.deposit_price != null || p.monthly_rent != null;
              const cardImages = pageImages[p.id] ?? p.images ?? [];

              return (
                <div
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setView('detail'); }}
                  className={`card p-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all overflow-hidden ${archive ? 'opacity-70 hover:opacity-100' : ''}`}
                >
                  <div className="relative -mx-4 -mt-4 mb-4 h-40 bg-slate-100 overflow-hidden">
                    <img
                      src={cardImages[0] || propertyPlaceholder}
                      alt={cardImages[0] ? p.title : 'تصویر پیش‌فرض ملک'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {cardImages.length > 1 && (
                      <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white" dir="ltr">
                        <Images size={13} /> {cardImages.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge color={p.transaction_type === 'rent' ? 'purple' : p.transaction_type === 'partnership' ? 'teal' : 'blue'}>
                        {getTransactionLabel(p.transaction_type)}
                      </Badge>
                      {p.is_hot && <Flame size={15} className="text-red-500 shrink-0" />}
                      {p.is_featured && <Star size={15} className="text-yellow-500 shrink-0" />}
                      {p.negotiable && <span className="badge bg-emerald-50 text-emerald-600">{p.transaction_type === 'rent' ? 'قابل تبدیل' : 'قابل مذاکره'}</span>}
                      {hasDivarSource(p.owner_followup_status) && <span className="badge bg-emerald-50 text-emerald-700"><Globe size={11} /> دیوار</span>}
                    </div>
                    {archive ? (
                      <Badge color="gray"><Archive size={11} /> بایگانی‌شده</Badge>
                    ) : (
                      <Badge color={status.color}>{status.label}</Badge>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 mb-1 truncate">{p.title}</h3>
                  {archive && (
                    <p className="mb-1 truncate text-[11px] text-slate-400">
                      دلیل بایگانی: {archive.reason}{archive.archivedAt ? ` • ${formatDate(new Date(archive.archivedAt))}` : ''}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mb-2 truncate">
                    {getCategoryLabel(p.category)} • {getPropertyTypeLabel(p.category, p.property_type)}
                    {roleLabel ? ` • ${roleLabel}` : ''}
                  </p>

                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">
                    <MapPin size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate font-medium">{locationLine}</span>
                  </p>
                  {locationParts.length > 0 && (getStreet(p) || p.address) && (
                    <p className="text-[11px] text-slate-400 truncate mb-2 pr-4">
                      {[getStreet(p), p.address].filter(Boolean).join('، ')}
                    </p>
                  )}
                  <div className="h-2" />

                  {specs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {specs.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 mb-2.5">
                    {p.sale_price != null ? (
                      <>
                        <p className="text-[11px] text-slate-400 mb-0.5">قیمت فروش</p>
                        <p className="text-sm font-extrabold text-slate-800">
                          {formatPrice(p.sale_price)} <span className="text-[10px] font-medium text-slate-400">تومان</span>
                        </p>
                        {p.price_per_meter != null && (
                          <p className="text-[11px] text-slate-400 mt-0.5">هر متر: {formatPrice(p.price_per_meter)} تومان</p>
                        )}
                      </>
                    ) : hasRentPrice ? (
                      <div className="flex items-start gap-5">
                        {p.deposit_price != null && (
                          <div>
                            <p className="text-[11px] text-slate-400 mb-0.5">{p.transaction_role === 'applicant' ? 'بودجه رهن' : 'رهن'}</p>
                            <p className="text-sm font-extrabold text-slate-800">
                              {rentBudget.isRange && rentBudget.deposit ? `${formatPrice(Number(rentBudget.deposit))} تا ` : p.transaction_role === 'applicant' ? 'تا ' : ''}{formatPrice(p.deposit_price)} <span className="text-[10px] font-medium text-slate-400">تومان</span>
                            </p>
                          </div>
                        )}
                        {p.monthly_rent != null && (
                          <div>
                            <p className="text-[11px] text-slate-400 mb-0.5">{p.transaction_role === 'applicant' ? 'بودجه اجاره ماهانه' : 'اجاره ماهانه'}</p>
                            <p className="text-sm font-extrabold text-slate-800">
                              {p.monthly_rent === 0 ? 'بدون اجاره' : `${rentBudget.isRange && rentBudget.rent ? `${formatPrice(Number(rentBudget.rent))} تا ` : p.transaction_role === 'applicant' ? 'تا ' : ''}${formatPrice(p.monthly_rent)} تومان`}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-slate-500">{p.negotiable ? 'قیمت توافقی' : 'قیمت ثبت نشده'}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="flex items-center gap-1 text-slate-500 font-medium min-w-0">
                      {hasDivarSource(p.owner_followup_status) ? <Globe size={12} className="shrink-0 text-emerald-500" /> : sourceColleague ? <Handshake size={12} className="shrink-0 text-indigo-400" /> : <User size={12} className="shrink-0 text-slate-400" />}
                      <span className="truncate">
                        {hasDivarSource(p.owner_followup_status) ? 'فایل دیوار' : sourceColleague ? `همکار: ${sourceColleague.name}` : p.owners?.name || 'بدون مالک'}
                      </span>
                    </span>
                    <span className="text-slate-400 shrink-0">{timeAgo(p.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// Property Detail
function PropertyDetail({ propertyId, onBack, onEdit }: { propertyId: string; onBack: () => void; onEdit: () => void }) {
  const { user, profile } = useAuth();
  const consultants = useConsultants();
  const [property, setProperty] = useState<(PropertyListItem) | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [colleague, setColleague] = useState<Pick<Colleague, 'id' | 'name' | 'phone' | 'agency_name'> | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'matches' | 'calls' | 'followups'>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState<string>(ARCHIVE_REASONS[0].value);
  const [archiveCustom, setArchiveCustom] = useState('');
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const [richPropRes, callsRes, fuRes, matchRes] = await Promise.all([
      supabase.from('properties').select('*, owners(name, phone), counties(name), neighborhoods(name)').eq('id', propertyId).maybeSingle(),
      supabase.from('calls').select('*, customers(first_name, last_name), owners(name), properties(title)').eq('property_id', propertyId).order('call_date', { ascending: false }).limit(20),
      supabase.from('follow_ups').select('*, customers(first_name, last_name), owners(name), properties(title)').eq('property_id', propertyId).order('due_date', { ascending: false }).limit(20),
      supabase.from('property_matches').select('*, customers(id, first_name, last_name, mobile, temperature)').eq('property_id', propertyId).order('score', { ascending: false }).limit(5),
    ]);
    const propRes = richPropRes.error
      ? await supabase.from('properties').select('*').eq('id', propertyId).maybeSingle()
      : richPropRes;
    setProperty((propRes.data as PropertyListItem) ?? null);
    setOwner(null);
    setColleague(null);
    if (propRes.data?.owner_id) {
      const { data: ownerData } = await supabase.from('owners').select('*').eq('id', propRes.data.owner_id).maybeSingle();
      setOwner(ownerData as Owner);
    } else if (isUuid(propRes.data?.owner_relationship)) {
      const { data: colleagueData } = await supabase.from('owners').select('*').eq('id', propRes.data.owner_relationship).maybeSingle();
      if (colleagueData) setColleague(ownerToColleague(colleagueData as Owner));
    }
    setCalls(callsRes.data ?? []);
    setFollowups(fuRes.data ?? []);
    setMatches(matchRes.data ?? []);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (selectedImageIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedImageIndex(null);
      if (!property?.images?.length) return;
      if (event.key === 'ArrowLeft') setSelectedImageIndex((current) => current === null ? null : (current + 1) % property.images.length);
      if (event.key === 'ArrowRight') setSelectedImageIndex((current) => current === null ? null : (current - 1 + property.images.length) % property.images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedImageIndex, property?.images]);

  const handleDelete = async () => {
    await supabase.from('properties').delete().eq('id', propertyId);
    onBack();
  };

  const openArchiveModal = () => {
    setArchiveReason(ARCHIVE_REASONS[0].value);
    setArchiveCustom('');
    setShowArchiveModal(true);
  };

  const archiveReasonLabel = archiveReason === 'custom'
    ? archiveCustom.trim() || 'سایر'
    : ARCHIVE_REASONS.find((item) => item.value === archiveReason)?.label ?? 'سایر';

  const handleArchive = async () => {
    if (!property) return;
    setArchiveBusy(true);
    const metadata = markPropertyArchived(property.owner_followup_status ?? '', archiveReasonLabel);
    const { error } = await supabase
      .from('properties')
      .update({ is_active: false, owner_followup_status: metadata || null })
      .eq('id', propertyId);
    if (error) {
      setArchiveBusy(false);
      alert(databaseErrorMessage(error, 'بایگانی انجام نشد. لطفاً دوباره تلاش کنید.'));
      return;
    }
    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'property',
      entity_id: propertyId,
      action: 'property_archived',
      description: `آگهی «${property.title}» بایگانی شد (${archiveReasonLabel})`,
    });
    setShowArchiveModal(false);
    setArchiveBusy(false);
    loadDetail();
  };

  const handleRestore = async () => {
    if (!property) return;
    setArchiveBusy(true);
    const metadata = clearPropertyArchive(property.owner_followup_status ?? '');
    const { error } = await supabase
      .from('properties')
      .update({ is_active: true, owner_followup_status: metadata || null })
      .eq('id', propertyId);
    if (error) {
      setArchiveBusy(false);
      alert(databaseErrorMessage(error, 'بازگردانی انجام نشد. لطفاً دوباره تلاش کنید.'));
      return;
    }
    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'property',
      entity_id: propertyId,
      action: 'property_restored',
      description: `آگهی «${property.title}» از بایگانی بازگردانی شد`,
    });
    setArchiveBusy(false);
    loadDetail();
  };

  // دریافت فایل از هم‌تیمی (مثلاً انتقال مدیر): مالکیت فایل به کاربر جاری می‌رسد
  const handleClaim = async () => {
    if (!property || !user) return;
    setClaiming(true);
    const { error } = await supabase
      .from('properties')
      .update({ assigned_consultant_id: user.id })
      .eq('id', propertyId);
    if (error) {
      setClaiming(false);
      alert(databaseErrorMessage(error, 'انتقال فایل انجام نشد. لطفاً دوباره تلاش کنید.'));
      return;
    }
    const myName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'من';
    await supabase.from('activities').insert({
      user_id: user.id,
      entity_type: 'property',
      entity_id: propertyId,
      action: 'property_transferred',
      description: `مالکیت فایل «${property.title}» به ${myName} منتقل شد`,
    });
    setClaiming(false);
    loadDetail();
  };

  if (loading || !property) {
    return <div className="flex justify-center py-16"><Spinner size={32} /></div>;
  }

  const status = getStatusInfo(PROPERTY_STATUSES, property.status);
  const archive = getArchiveInfo(property.owner_followup_status);
  const detailRentBudget = getRentBudgetMins(property.owner_followup_status);
  const isDivar = hasDivarSource(property.owner_followup_status);
  // فایل من است یا منتقل‌شده از هم‌تیمی؟
  const isMyFile = property.assigned_consultant_id === user?.id;
  const fileOwnerName = consultantName(consultants, property.assigned_consultant_id, 'بدون انتساب');

  return (
    <div className="animate-fade-in space-y-4">
      <button onClick={onBack} className="detail-back">
        <ArrowLeft size={16} /> بازگشت
      </button>

      <div className="detail-hero detail-hero-indigo">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-indigo-600"><Home size={14} /> جزئیات آگهی</p>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {property.is_hot && <Flame size={18} className="text-red-500" />}
              {property.is_featured && <Star size={18} className="text-yellow-500" />}
              <h2 className="text-xl font-extrabold leading-8 text-slate-800">{property.title}</h2>
              {colleague && <Badge color="purple"><Handshake size={12} /> فایل همکار</Badge>}
              {isDivar && <Badge color="teal"><Globe size={12} /> فایل دیوار</Badge>}
            </div>
            <p className="text-xs text-slate-400">
              {getTransactionLabel(property.transaction_type)} • {getCategoryLabel(property.category)} • {getPropertyTypeLabel(property.category, property.property_type)}
            </p>
          </div>
          {archive ? (
            <Badge color="gray"><Archive size={12} /> بایگانی‌شده</Badge>
          ) : (
            <Badge color={status.color}>{status.label}</Badge>
          )}
        </div>

        {property.neighborhoods?.name && (
          <p className="text-sm text-slate-500 flex items-center gap-1 mb-1">
            <MapPin size={14} /> {property.neighborhoods.name}
          </p>
        )}
        {getStreet(property) && (
          <p className="text-sm text-slate-500 flex items-center gap-1 mb-1 pr-5">خیابان {getStreet(property)}</p>
        )}
        {property.address && (
          <p className="text-sm text-slate-500 flex items-center gap-1 mb-3">
            <MapPin size={14} className={property.neighborhoods?.name ? 'invisible' : ''} /> {property.address}
          </p>
        )}

        <div className="flex gap-2 flex-wrap border-t border-slate-200/70 pt-4 mt-4">
          {colleague ? (
            <a href={`tel:${normalizePhone(colleague.phone)}`} className="btn-primary">
              <Handshake size={16} /> تماس با همکار
            </a>
          ) : owner ? (
            <a href={`tel:${normalizePhone(owner.phone)}`} className="btn-primary">
              <Phone size={16} /> تماس با مالک
            </a>
          ) : null}
          {owner && <button type="button" onClick={() => setShowCallModal(true)} className="btn-secondary"><Phone size={16} /> ثبت تماس</button>}
          {owner && <button type="button" onClick={() => setShowFollowupModal(true)} className="btn-secondary"><Clock size={16} /> پیگیری</button>}
          <button onClick={onEdit} className="btn-secondary">
            <Pencil size={16} /> ویرایش آگهی
          </button>
          {archive ? (
            <button type="button" onClick={handleRestore} disabled={archiveBusy} className="btn-secondary">
              <ArchiveRestore size={16} /> بازگردانی
            </button>
          ) : (
            <button type="button" onClick={openArchiveModal} className="btn-secondary">
              <Archive size={16} /> بایگانی
            </button>
          )}
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger" aria-label="حذف آگهی">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {!isMyFile && (
        <div className="card flex flex-col gap-3 border-indigo-200 bg-indigo-50/60 p-4 animate-fade-in sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <User size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-indigo-900">
                {property.assigned_consultant_id ? `این فایل منتسب به «${fileOwnerName}» است` : 'این فایل هنوز به کسی انتساب نشده است'}
              </p>
              <p className="mt-0.5 text-xs text-indigo-700/70">
                اگر فایل از سمت مدیر یا هم‌تیمی برای شما ارسال شده، با «مال من است» آن را به نام خود اختصاص دهید.
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClaim} disabled={claiming} className="btn-primary shrink-0 sm:mr-auto">
            <UserCheck size={16} /> {claiming ? 'در حال انتقال...' : 'مال من است — اختصاص به خودم'}
          </button>
        </div>
      )}

      {archive && (
        <div className="card flex flex-col gap-3 border-slate-300 bg-slate-50 p-4 animate-fade-in sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
              <Archive size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-700">این آگهی بایگانی شده است</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {archive.reason}{archive.archivedAt ? ` • تاریخ بایگانی: ${formatDate(new Date(archive.archivedAt))}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={handleRestore} disabled={archiveBusy} className="btn-primary shrink-0 sm:mr-auto">
            <ArchiveRestore size={16} /> بازگردانی از بایگانی
          </button>
        </div>
      )}

      {property.images?.length > 0 ? (
        <section className="card p-3 sm:p-4 overflow-hidden" aria-label="آلبوم تصاویر فایل">
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Images size={18} /> تصاویر ملک
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">برای مشاهده بزرگ‌تر روی تصویر بزنید</p>
            </div>
            <button type="button" onClick={() => setSelectedImageIndex(0)} className="btn-secondary !px-3 !py-1.5 text-xs">
              <Maximize2 size={14} /> مشاهده همه
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500">{property.images.length}</span>
            </button>
          </div>

          {/* Mobile gallery: large cover plus a swipeable thumbnail rail */}
          <div className="sm:hidden">
            <button type="button" onClick={() => setSelectedImageIndex(0)} className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
              <img src={property.images[0]} alt={`${property.title} - تصویر اصلی`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white" dir="ltr">1 / {property.images.length}</span>
            </button>
            {property.images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar" dir="rtl">
                {property.images.slice(1).map((image, index) => (
                  <button key={`${image.slice(0, 60)}-${index}`} type="button" onClick={() => setSelectedImageIndex(index + 1)} className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    <img src={image} alt={`${property.title} - عکس ${index + 2}`} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop gallery: a compact real-estate style mosaic */}
          <div className="hidden sm:grid h-[360px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl">
            {property.images.slice(0, 5).map((image, index, previewImages) => {
              const count = previewImages.length;
              const tileClass = count === 1
                ? 'col-span-4 row-span-2'
                : count === 2
                  ? 'col-span-2 row-span-2'
                  : index === 0
                    ? 'col-span-2 row-span-2'
                    : count === 3
                      ? 'col-span-2'
                      : count === 4 && index === 3
                        ? 'col-span-2'
                        : '';
              const remaining = property.images.length - 5;
              const isLastPreview = index === 4 && remaining > 0;
              return (
                <button
                  key={`${image.slice(0, 60)}-${index}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className={`group relative overflow-hidden bg-slate-100 ${tileClass}`}
                  aria-label={`نمایش عکس ${index + 1}`}
                >
                  <img src={image} alt={`${property.title} - عکس ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-hover:brightness-90" loading={index === 0 ? 'eager' : 'lazy'} />
                  {index === 0 && <span className="absolute bottom-3 right-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white">تصویر اصلی</span>}
                  {isLastPreview && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white" dir="ltr">+{remaining}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="card overflow-hidden" aria-label="تصویر پیش‌فرض ملک">
          <div className="relative">
            <img src={propertyPlaceholder} alt="تصویر پیش‌فرض ملک" className="h-64 sm:h-[360px] w-full object-cover" />
            <span className="absolute bottom-3 right-3 rounded-md bg-black/55 px-2.5 py-1 text-xs text-white">تصویر پیش‌فرض</span>
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="detail-tabs no-scrollbar">
        {[
          { key: 'info', label: 'اطلاعات' },
          { key: 'matches', label: 'تطبیق‌ها' },
          { key: 'calls', label: 'تماس‌ها' },
          { key: 'followups', label: 'پیگیری‌ها' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`detail-tab ${activeTab === tab.key ? 'detail-tab-active' : 'detail-tab-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="detail-section space-y-5">
          <h3 className="detail-section-title"><Home size={17} className="text-indigo-500" /> مشخصات و امکانات</h3>
          {property.description && <p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{property.description}</p>}
          <div className="detail-info-grid">
            {property.land_area != null && <InfoField label="متراژ زمین" value={`${property.land_area} متر`} />}
            {property.building_area != null && <InfoField label="متراژ بنا" value={`${property.building_area} متر`} />}
            {property.bedrooms != null && <InfoField label="تعداد خواب" value={String(property.bedrooms)} />}
            {property.rooms != null && <InfoField label="تعداد اتاق" value={String(property.rooms)} />}
            {property.floor != null && <InfoField label="طبقه ملک" value={String(property.floor)} />}
            {property.total_floors != null && <InfoField label="تعداد کل طبقات" value={String(property.total_floors)} />}
            {getUnitsPerFloor(property.owner_followup_status) && <InfoField label="تعداد واحد در هر طبقه" value={getUnitsPerFloor(property.owner_followup_status)} />}
            {property.unit_number && <InfoField label="واحد ملک" value={property.unit_number} />}
            {property.building_age != null && <InfoField label="سن بنا" value={`${property.building_age} سال`} />}
            {property.parking && <InfoField label="پارکینگ" value="دارد" />}
            {property.elevator && <InfoField label="آسانسور" value="دارد" />}
            {property.storage && <InfoField label="انباری" value="دارد" />}
            {property.balcony && <InfoField label="بالکن" value="دارد" />}
            {property.yard && <InfoField label="حیاط" value="دارد" />}
            {property.garden && <InfoField label="باغ" value="دارد" />}
            {property.pool && <InfoField label="استخر" value="دارد" />}
            {property.security && <InfoField label="امنیت" value="دارد" />}
            {property.heating && <InfoField label="گرمایش" value={property.heating} />}
            {property.cooling && <InfoField label="سرمایش" value={property.cooling} />}
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">اطلاعات مالی</h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {property.sale_price != null && <InfoField label="قیمت فروش" value={`${formatPrice(property.sale_price)} ت`} />}
              {property.deposit_price != null && <InfoField label={property.transaction_role === 'applicant' ? 'بودجه رهن' : 'رهن'} value={`${detailRentBudget.isRange && detailRentBudget.deposit ? `${formatPrice(Number(detailRentBudget.deposit))} تا ` : property.transaction_role === 'applicant' ? 'تا ' : ''}${formatPrice(property.deposit_price)} ت`} />}
              {property.monthly_rent != null && <InfoField label={property.transaction_role === 'applicant' ? 'بودجه اجاره' : 'اجاره'} value={`${detailRentBudget.isRange && detailRentBudget.rent ? `${formatPrice(Number(detailRentBudget.rent))} تا ` : property.transaction_role === 'applicant' ? 'تا ' : ''}${formatPrice(property.monthly_rent)} ت`} />}
              {property.price_per_meter != null && <InfoField label="قیمت هر متر" value={`${formatPrice(property.price_per_meter)} ت`} />}
              {property.commission != null && <InfoField label="پورسانت" value={`${formatPrice(property.commission)} ت`} />}
              {property.transaction_type === 'rent' && <InfoField label="قابل تبدیل" value={property.negotiable ? 'بله' : 'خیر'} />}
            </div>
          </div>
          {colleague ? (
            <div className="border-t border-slate-100 pt-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-700 mb-3"><Handshake size={16} /> منبع فایل: همکار</h4>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="نام همکار" value={colleague.name} />
                <InfoField label="موبایل همکار" value={colleague.phone} />
                {colleague.agency_name && <InfoField label="آژانس / دفتر" value={colleague.agency_name} />}
              </div>
              <p className="mt-3 rounded-lg bg-indigo-50 p-2.5 text-xs text-indigo-600">این فایل متعلق به همکار است و ارتباط اصلی از طریق ایشان انجام می‌شود.</p>
            </div>
          ) : owner ? (
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">مالک</h4>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="نام" value={owner.name} />
                <InfoField label="تلفن" value={owner.phone} />
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">مالکیت و منبع فایل</h4>
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="مشاور مسئول" value={isMyFile ? 'خودم' : fileOwnerName} />
              <InfoField label="منبع فایل" value={FILE_SOURCE_LABELS[getFileSource(property)]} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="space-y-3">
          {matches.length > 0 ? (
            matches.map((m) => (
              <div key={m.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.customers?.first_name} {m.customers?.last_name}</p>
                  <p className="text-xs text-slate-400" dir="ltr">{m.customers?.mobile}</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: m.score >= 80 ? '#16a34a' : m.score >= 60 ? '#f97316' : '#64748b' }}>
                  {m.score}%
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={<Target size={36} />} title="تطبیقی یافت نشده" />
          )}
        </div>
      )}

      {activeTab === 'calls' && (
        calls.length > 0 ? (
          <div className="space-y-3">{calls.map((call) => <CallRecordCard key={call.id} call={call} targetName={owner?.name} />)}</div>
        ) : <EmptyState icon={<Phone size={36} />} title="تماسی ثبت نشده" />
      )}

      {activeTab === 'followups' && (
        followups.length > 0 ? (
          <div className="space-y-3">{followups.map((item) => <FollowupRecordCard key={item.id} followup={item} targetName={owner?.name} onChanged={loadDetail} />)}</div>
        ) : <EmptyState icon={<Clock size={36} />} title="پیگیری‌ای ثبت نشده" />
      )}

      {selectedImageIndex !== null && property.images?.[selectedImageIndex] && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="نمایش گالری تصاویر"
          onClick={() => setSelectedImageIndex(null)}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6" onClick={(event) => event.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{property.title}</p>
              <p className="text-[11px] text-white/50" dir="ltr">{selectedImageIndex + 1} / {property.images.length}</p>
            </div>
            <button type="button" onClick={() => setSelectedImageIndex(null)} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="بستن گالری">
              <X size={22} />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 py-3 sm:px-20" onClick={(event) => event.stopPropagation()}>
            <img
              src={property.images[selectedImageIndex]}
              alt={`${property.title} - عکس ${selectedImageIndex + 1}`}
              className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
            />
            {property.images.length > 1 && (
              <>
                <button type="button" onClick={() => setSelectedImageIndex((selectedImageIndex - 1 + property.images.length) % property.images.length)} className="absolute right-2 sm:right-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 active:scale-95" aria-label="عکس قبلی">
                  <ChevronRight size={30} />
                </button>
                <button type="button" onClick={() => setSelectedImageIndex((selectedImageIndex + 1) % property.images.length)} className="absolute left-2 sm:left-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 active:scale-95" aria-label="عکس بعدی">
                  <ChevronLeft size={30} />
                </button>
              </>
            )}
          </div>

          {property.images.length > 1 && (
            <div className="shrink-0 border-t border-white/10 px-3 py-3 sm:px-6" onClick={(event) => event.stopPropagation()}>
              <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto no-scrollbar" dir="rtl">
                {property.images.map((image, index) => (
                  <button
                    key={`${image.slice(0, 60)}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`h-14 w-20 sm:h-16 sm:w-24 shrink-0 overflow-hidden rounded-md border-2 transition ${selectedImageIndex === index ? 'border-white opacity-100' : 'border-transparent opacity-45 hover:opacity-80'}`}
                    aria-label={`رفتن به عکس ${index + 1}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCallModal && owner && (
        <CallFormModal
          ownerId={owner.id}
          ownerName={owner.name}
          propertyId={property.id}
          propertyTitle={property.title}
          onClose={() => setShowCallModal(false)}
          onSaved={loadDetail}
        />
      )}
      {showFollowupModal && owner && (
        <FollowupFormModal
          ownerId={owner.id}
          ownerName={owner.name}
          propertyId={property.id}
          propertyTitle={property.title}
          onClose={() => setShowFollowupModal(false)}
          onSaved={loadDetail}
        />
      )}
      <Modal open={showArchiveModal} onClose={() => setShowArchiveModal(false)} title="بایگانی آگهی" size="sm">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            با بایگانی، این آگهی از فهرست فایل‌های فعال و پیشنهادهای مشتریان خارج می‌شود، اما تمام اطلاعاتش حفظ می‌ماند و هر وقت خواستید می‌توانید بازگردانش.
          </p>
          <div>
            <label className="label">دلیل بایگانی</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ARCHIVE_REASONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setArchiveReason(item.value)}
                  className={`rounded-lg border-2 p-2.5 text-right text-sm font-medium transition-all ${
                    archiveReason === item.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {archiveReason === 'custom' && (
              <input
                className="input mt-2"
                value={archiveCustom}
                onChange={(event) => setArchiveCustom(event.target.value)}
                placeholder="دلیل را بنویسید..."
                autoFocus
              />
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowArchiveModal(false)} className="btn-secondary">
              انصراف
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiveBusy || (archiveReason === 'custom' && !archiveCustom.trim())}
              className="btn-primary"
            >
              {archiveBusy ? 'در حال بایگانی...' : 'بایگانی آگهی'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="حذف فایل"
        message="آیا از حذف این فایل مطمئن هستید؟ پس از حذف قابل بازیابی نیست. اگر آگهی فقط منقضی شده، از دکمه «بایگانی» استفاده کنید تا اطلاعاتش حفظ شود."
        confirmLabel="حذف"
        danger
      />
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

// Step Summary - shows what the user has selected in previous steps
function StepSummary({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
      <p className="text-xs font-medium text-slate-400 mb-2">اطلاعات وارد شده:</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-md px-2.5 py-1 text-xs border border-slate-200">
            <span className="text-slate-400">{item.label}: </span>
            <span className="text-slate-700 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyImagePicker({
  files,
  onChange,
  existingImages = [],
  onExistingImagesChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existingImages?: string[];
  onExistingImagesChange?: (images: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const totalImages = existingImages.length + files.length;

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const candidates = Array.from(incoming);
    const invalidType = candidates.some((file) => !PROPERTY_IMAGE_TYPES.includes(file.type));
    const tooLarge = candidates.some((file) => file.size > MAX_PROPERTY_IMAGE_SIZE);
    const unique = candidates.filter((candidate) => !files.some((file) =>
      file.name === candidate.name && file.size === candidate.size && file.lastModified === candidate.lastModified,
    ));
    const available = MAX_PROPERTY_IMAGES - totalImages;
    onChange([...files, ...unique.filter((file) => PROPERTY_IMAGE_TYPES.includes(file.type) && file.size <= MAX_PROPERTY_IMAGE_SIZE).slice(0, available)]);

    if (invalidType) setMessage('فقط فایل‌های JPG، PNG و WebP قابل انتخاب هستند.');
    else if (tooLarge) setMessage('حجم هر عکس باید حداکثر ۸ مگابایت باشد.');
    else if (unique.length > available) setMessage(`حداکثر ${MAX_PROPERTY_IMAGES} عکس می‌توانید اضافه کنید.`);
    else setMessage('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">آلبوم تصاویر <span className="font-normal text-slate-400">(اختیاری)</span></label>
        <p className="text-xs text-slate-400">تا ۱۰ عکس، هر عکس حداکثر ۸ مگابایت</p>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={totalImages >= MAX_PROPERTY_IMAGES}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-7 text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ImagePlus size={28} className="mx-auto mb-2" />
        <span className="block text-sm font-medium">انتخاب عکس‌ها</span>
        <span className="mt-1 block text-xs">انتخاب عکس الزامی نیست</span>
      </button>
      {message && <p className="text-xs text-amber-600">{message}</p>}
      {totalImages > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {existingImages.map((url, index) => (
            <div key={`${url.slice(0, 80)}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
              <img src={url} alt={`عکس فعلی ${index + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => onExistingImagesChange?.(existingImages.filter((_, imageIndex) => imageIndex !== index))} className="absolute left-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white hover:bg-black/80" aria-label={`حذف عکس ${index + 1}`}>
                <X size={15} />
              </button>
              {index === 0 && <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">تصویر اصلی</span>}
            </div>
          ))}
          {previews.map(({ file, url }, index) => {
            const displayIndex = existingImages.length + index;
            return (
              <div key={`${file.name}-${file.lastModified}`} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                <img src={url} alt={`پیش‌نمایش عکس ${displayIndex + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))} className="absolute left-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white hover:bg-black/80" aria-label={`حذف عکس ${displayIndex + 1}`}>
                  <X size={15} />
                </button>
                {displayIndex === 0 && <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">تصویر اصلی</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Property create/edit form (Multi-step dynamic form)
function PropertyForm({ propertyId, onBack, onSaved }: { propertyId?: string; onBack: () => void; onSaved: () => void }) {
  const { user, profile } = useAuth();
  const { counties, loading: countiesLoading, error: countiesError } = useActiveCounties();
  const colleagues = useColleagues();
  const consultants = useConsultants();
  const isEditing = Boolean(propertyId);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(Boolean(propertyId));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<Pick<Owner, 'id' | 'name' | 'phone' | 'notes' | 'status'>[]>([]);
  const [addingNewOwner, setAddingNewOwner] = useState(false);
  const [editingConsultantId, setEditingConsultantId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<Property['status']>('active');
  // اگر آگهی بایگانی باشد، وضعیت بایگانی در طول ویرایش حفظ می‌شود مگر اینکه کاربر وضعیت را عوض کند
  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(null);
  const [propertyMetadata, setPropertyMetadata] = useState('');
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    transaction_type: '',
    transaction_role: '',
    category: '',
    property_type: '',
    county_id: '',
    neighborhood_id: '',
    street: '',
    address: '',
    land_area: '',
    building_area: '',
    bedrooms: '',
    rooms: '',
    floor: '',
    total_floors: '',
    units_per_floor: '',
    unit_number: '',
    building_age: '',
    parking: false,
    storage: false,
    elevator: false,
    balcony: false,
    yard: false,
    garden: false,
    pool: false,
    security: false,
    sale_price: '',
    price_per_meter: '',
    deposit_price: '',
    deposit_price_min: '',
    monthly_rent: '',
    monthly_rent_min: '',
    rent_budget_mode: 'max' as 'max' | 'range',
    negotiable: false,
    commission: '',
    contact_type: 'owner' as 'owner' | 'colleague' | 'divar',
    colleague_id: '',
    owner_id: '',
    owner_name: '',
    owner_phone: '',
    owner_notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('owners').select('id, name, phone, notes, status, tags').order('name');
      if (!active) return;
      const owners = ((data as (Pick<Owner, 'id' | 'name' | 'phone' | 'notes' | 'status'> & { tags?: string[] })[]) ?? [])
        .filter((owner) => !owner.tags?.includes(COLLEAGUE_TAG));
      setOwnerOptions(owners);
      if (!propertyId && owners.length === 0) setAddingNewOwner(true);
    })();
    return () => { active = false; };
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    const loadPropertyForEdit = async () => {
      setFormLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*, owners(name, phone, notes)')
        .eq('id', propertyId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSaveError(error?.message ?? 'اطلاعات آگهی برای ویرایش پیدا نشد.');
        setFormLoading(false);
        return;
      }
      const ownerInfo = data.owners as { name?: string; phone?: string; notes?: string } | null;
      const text = (value: unknown) => value == null ? '' : String(value);
      const rentBudget = getRentBudgetMins(data.owner_followup_status);
      setForm({
        title: text(data.title),
        description: text(data.description),
        transaction_type: text(data.transaction_type),
        transaction_role: text(data.transaction_role),
        category: text(data.category),
        property_type: text(data.property_type),
        county_id: text(data.county_id),
        neighborhood_id: text(data.neighborhood_id),
        street: getStreet(data),
        address: text(data.address),
        land_area: data.land_area == null ? '' : String(Math.trunc(Number(data.land_area))),
        building_area: data.building_area == null ? '' : String(Math.trunc(Number(data.building_area))),
        bedrooms: text(data.bedrooms),
        rooms: text(data.rooms),
        floor: text(data.floor),
        total_floors: text(data.total_floors),
        units_per_floor: getUnitsPerFloor(data.owner_followup_status),
        unit_number: text(data.unit_number),
        building_age: text(data.building_age),
        parking: Boolean(data.parking),
        storage: Boolean(data.storage),
        elevator: Boolean(data.elevator),
        balcony: Boolean(data.balcony),
        yard: Boolean(data.yard),
        garden: Boolean(data.garden),
        pool: Boolean(data.pool),
        security: Boolean(data.security),
        sale_price: text(data.sale_price),
        price_per_meter: text(data.price_per_meter),
        deposit_price: text(data.deposit_price),
        deposit_price_min: rentBudget.deposit,
        monthly_rent: text(data.monthly_rent),
        monthly_rent_min: rentBudget.rent,
        rent_budget_mode: rentBudget.isRange ? 'range' : 'max',
        negotiable: Boolean(data.negotiable),
        commission: text(data.commission),
        contact_type: isUuid(data.owner_relationship) ? 'colleague' : hasDivarSource(data.owner_followup_status) ? 'divar' : 'owner',
        colleague_id: isUuid(data.owner_relationship) ? data.owner_relationship : '',
        owner_id: text(data.owner_id),
        owner_name: text(ownerInfo?.name),
        owner_phone: text(ownerInfo?.phone),
        owner_notes: text(ownerInfo?.notes ?? data.owner_notes),
      });
      setExistingImages(Array.isArray(data.images) ? data.images : []);
      setPropertyMetadata(text(data.owner_followup_status));
      setArchiveInfo(getArchiveInfo(data.owner_followup_status));
      setAddingNewOwner(!data.owner_id && !isUuid(data.owner_relationship));
      setEditingConsultantId(data.assigned_consultant_id ?? null);
      setEditingStatus((data.status as Property['status']) ?? 'active');
      setFormLoading(false);
    };
    loadPropertyForEdit();
    return () => { cancelled = true; };
  }, [propertyId]);

  const selectedCounty = counties.find((c) => c.id === form.county_id);
  const isRobatKarim = selectedCounty?.name === ROBAT_KARIM_COUNTY_NAME;
  const { neighborhoods } = useCountyNeighborhoods(isRobatKarim ? form.county_id : null);
  const showStreet = isRobatKarim && form.neighborhood_id === neighborhoods.find((n) => n.name === ROBAT_KARIM_COUNTY_NAME)?.id;

  const wholeArea = (value: string) =>
    toEnglishDigits(value).split(/[.٫]/)[0].replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  const numericValue = (value: string) => value ? Number(toEnglishDigits(value)) : 0;
  const totalCommission = (total: number) => String(commissionFromTransactionValue(total));

  const changeTotalPrice = (value: string) => setForm((current) => {
    const area = numericValue(current.land_area);
    const pricePerMeter = numericValue(current.price_per_meter);
    if (!value) return { ...current, sale_price: '', commission: '' };
    const total = numericValue(value);
    const commission = totalCommission(total);
    if (area > 0) return { ...current, sale_price: value, price_per_meter: String(Math.round(total / area)), commission };
    if (pricePerMeter > 0) return { ...current, sale_price: value, land_area: String(Math.round(total / pricePerMeter)), commission };
    return { ...current, sale_price: value, commission };
  });

  const changePricePerMeter = (value: string) => setForm((current) => {
    const area = numericValue(current.land_area);
    const total = numericValue(current.sale_price);
    if (!value) return { ...current, price_per_meter: '' };
    const pricePerMeter = numericValue(value);
    if (area > 0) {
      const calculatedTotal = pricePerMeter * area;
      return { ...current, price_per_meter: value, sale_price: String(calculatedTotal), commission: totalCommission(calculatedTotal) };
    }
    if (total > 0) return { ...current, price_per_meter: value, land_area: String(Math.round(total / pricePerMeter)), commission: totalCommission(total) };
    return { ...current, price_per_meter: value };
  });

  const changeArea = (rawValue: string) => setForm((current) => {
    const value = wholeArea(rawValue);
    if (!value) return { ...current, land_area: '' };
    const area = Number(value);
    const pricePerMeter = numericValue(current.price_per_meter);
    const total = numericValue(current.sale_price);
    if (pricePerMeter > 0) {
      const calculatedTotal = pricePerMeter * area;
      return { ...current, land_area: value, sale_price: String(calculatedTotal), commission: totalCommission(calculatedTotal) };
    }
    if (total > 0) return { ...current, land_area: value, price_per_meter: String(Math.round(total / area)), commission: totalCommission(total) };
    return { ...current, land_area: value };
  });

  const changeDepositPrice = (value: string) => setForm((current) => {
    const equivalentValue = rentToDepositEquivalent(numericValue(value), numericValue(current.monthly_rent));
    return { ...current, deposit_price: value, commission: equivalentValue > 0 ? totalCommission(equivalentValue) : '' };
  });

  const changeMonthlyRent = (value: string) => setForm((current) => {
    const equivalentValue = rentToDepositEquivalent(numericValue(current.deposit_price), numericValue(value));
    return { ...current, monthly_rent: value, commission: equivalentValue > 0 ? totalCommission(equivalentValue) : '' };
  });

  const transactionCommissionValue = form.transaction_type === 'rent'
    ? rentToDepositEquivalent(numericValue(form.deposit_price), numericValue(form.monthly_rent))
    : numericValue(form.sale_price);
  const oneSideCommission = Math.round(transactionCommissionValue * 0.01);
  const combinedCommission = commissionFromTransactionValue(transactionCommissionValue);

  const steps = [
    { title: 'نوع معامله', fields: ['transaction_type'] },
    { title: 'دسته‌بندی و نوع ملک', fields: ['category', 'property_type'] },
    { title: 'موقعیت', fields: ['province_id', 'city_id'] },
    { title: 'اطلاعات ملک', fields: ['title'] },
    { title: 'اطلاعات مالی', fields: [] },
    { title: 'منبع فایل و مخاطب', fields: ['contact_type'] },
    { title: 'تصاویر (اختیاری)', fields: [] },
  ];

  const validateStep = () => {
    const errs: Record<string, string> = {};
    if (step === 0 && !form.transaction_type) errs.transaction_type = 'نوع معامله الزامی است';
    if (step === 1) {
      if (!form.category) errs.category = 'دسته‌بندی الزامی است';
      if (!form.property_type) errs.property_type = 'نوع ملک الزامی است';
    }
    if (step === 2 && !form.county_id) errs.county_id = 'شهرستان الزامی است';
    if (step === 2 && !form.address.trim()) errs.address = 'آدرس کامل الزامی است';
    if (step === 3 && !form.title.trim()) errs.title = 'عنوان الزامی است';
    if (form.transaction_type === 'rent' && form.transaction_role === 'applicant' && form.rent_budget_mode === 'range') {
      const minDeposit = numericValue(form.deposit_price_min);
      const maxDeposit = numericValue(form.deposit_price);
      const minRent = numericValue(form.monthly_rent_min);
      const maxRent = numericValue(form.monthly_rent);
      if (Boolean(form.deposit_price_min) !== Boolean(form.deposit_price)) errs.rent_budget = 'لطفاً حداقل و حداکثر بودجه پول پیش را کامل وارد کنید.';
      else if (form.deposit_price_min && form.deposit_price && minDeposit >= maxDeposit) errs.rent_budget = 'حداقل بودجه پول پیش باید کمتر از حداکثر بودجه باشد.';
      else if (Boolean(form.monthly_rent_min) !== Boolean(form.monthly_rent)) errs.rent_budget = 'لطفاً حداقل و حداکثر بودجه اجاره ماهانه را کامل وارد کنید.';
      else if (form.monthly_rent_min && form.monthly_rent && minRent >= maxRent) errs.rent_budget = 'حداقل بودجه اجاره ماهانه باید کمتر از حداکثر بودجه باشد.';
    }
    if (step === 5 && form.contact_type === 'owner' && addingNewOwner && !form.owner_name.trim()) errs.owner_name = 'نام مالک الزامی است';
    if (step === 5 && form.contact_type === 'owner' && addingNewOwner && !form.owner_phone.trim()) errs.owner_phone = 'تلفن مالک الزامی است';
    else if (step === 5 && form.contact_type === 'owner' && addingNewOwner && !validatePhone(form.owner_phone)) errs.owner_phone = 'فرمت موبایل صحیح نیست (09123456789)';
    if (step === 5 && form.contact_type === 'owner' && !addingNewOwner && !form.owner_id) errs.owner_id = 'انتخاب مالک الزامی است';
    if (step === 5 && form.contact_type === 'colleague' && !form.colleague_id) errs.colleague_id = 'انتخاب همکار الزامی است';
    setErrors(errs);
    if (errs.rent_budget && step !== 4) setStep(4);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) setStep(Math.min(step + 1, steps.length - 1));
  };

  const handleSave = async () => {
    if (!validateStep()) return;
    setSaving(true);
    setSaveError('');

    // Images are compressed locally and saved directly in the existing images column.
    // No external storage bucket is required.
    const { images: preparedImages, failedImages } = imageFiles.length > 0
      ? await preparePropertyImages(imageFiles)
      : { images: [] as string[], failedImages: [] as { fileName: string; message: string }[] };

    // Select an existing owner, or create one inline when they are not in the list.
    // در فایل دیوار، مالک مستقیم اختیاری است.
    const wantsOwner = form.contact_type === 'owner' || form.contact_type === 'divar';
    let ownerId: string | null = wantsOwner && !addingNewOwner ? form.owner_id || null : null;
    if (wantsOwner && addingNewOwner && form.owner_name && form.owner_phone) {
      const normalizedPhone = normalizePhone(form.owner_phone);
      const { data: samePhoneRows } = await supabase.from('owners').select('id, tags').eq('phone', normalizedPhone);
      const existingOwner = samePhoneRows?.find((row) => !(row.tags as string[] | null)?.includes(COLLEAGUE_TAG));
      if (existingOwner) {
        ownerId = existingOwner.id;
      } else {
        const { data: newOwner, error: ownerError } = await supabase.from('owners').insert({
          name: form.owner_name.trim(),
          phone: normalizedPhone,
          notes: form.owner_notes || null,
          assigned_consultant_id: user?.id,
          status: 'active',
        }).select().single();
        if (ownerError || !newOwner) {
          setSaveError(`ثبت مالک انجام نشد: ${ownerError?.message ?? 'خطای نامشخص'}`);
          setSaving(false);
          return;
        }
        ownerId = newOwner.id;
      }
    }

    const usesSalePrice = ['buy', 'sell', 'partnership'].includes(form.transaction_type);
    const salePrice = usesSalePrice && form.sale_price ? Number(toEnglishDigits(form.sale_price)) : null;
    const landArea = form.land_area ? Math.trunc(Number(toEnglishDigits(form.land_area))) : null;
    const enteredPricePerMeter = usesSalePrice && form.price_per_meter
      ? Number(toEnglishDigits(form.price_per_meter))
      : null;
    const depositPrice = form.transaction_type === 'rent' && form.deposit_price
      ? Number(toEnglishDigits(form.deposit_price))
      : null;
    const monthlyRent = form.transaction_type === 'rent' && form.monthly_rent
      ? Number(toEnglishDigits(form.monthly_rent))
      : null;
    const commissionBase = form.transaction_type === 'rent'
      ? rentToDepositEquivalent(depositPrice ?? 0, monthlyRent ?? 0)
      : (salePrice ?? 0);

    const payload = {
      title: form.title,
      description: form.description || null,
      transaction_type: form.transaction_type,
      transaction_role: form.transaction_role || null,
      category: form.category,
      property_type: form.property_type,
      status: editingStatus,
      // آگهی بایگانی‌شده تا زمانی که کاربر وضعیتش را عوض نکند، از چرخه فعال خارج می‌ماند
      is_active: archiveInfo ? false : editingStatus === 'active',
      owner_id: ownerId,
      owner_relationship: form.contact_type === 'colleague' ? form.colleague_id : null,
      assigned_consultant_id: editingConsultantId || user?.id,
      province_id: selectedCounty?.province_id ?? null,
      county_id: form.county_id || null,
      district_id: null,
      city_id: null,
      neighborhood_id: form.neighborhood_id || null,
      street: showStreet ? form.street || null : null,
      address: form.address || null,
      land_area: landArea,
      building_area: form.building_area ? Math.trunc(Number(toEnglishDigits(form.building_area))) : null,
      bedrooms: form.bedrooms ? Number(toEnglishDigits(form.bedrooms)) : null,
      rooms: form.rooms ? Number(toEnglishDigits(form.rooms)) : null,
      floor: form.floor ? Number(toEnglishDigits(form.floor)) : null,
      total_floors: form.total_floors ? Number(toEnglishDigits(form.total_floors)) : null,
      unit_number: form.property_type === 'apartment' ? form.unit_number || null : null,
      building_age: form.building_age ? Number(toEnglishDigits(form.building_age)) : null,
      parking: form.parking,
      storage: form.storage,
      elevator: form.elevator,
      balcony: form.balcony,
      yard: form.yard,
      garden: form.garden,
      pool: form.pool,
      security: form.security,
      sale_price: salePrice,
      deposit_price: depositPrice,
      monthly_rent: monthlyRent,
      price_per_meter: enteredPricePerMeter ?? (
        salePrice != null && landArea != null && landArea > 0
          ? Math.round(salePrice / landArea)
          : null
      ),
      negotiable: form.negotiable,
      commission: commissionBase > 0 ? commissionFromTransactionValue(commissionBase) : null,
      owner_notes: wantsOwner ? form.owner_notes || null : null,
      owner_followup_status: markDivarSource(
        setUnitsPerFloor(
          setRentBudgetMins(
            propertyMetadata,
            form.deposit_price_min,
            form.monthly_rent_min,
            form.transaction_type === 'rent' && form.transaction_role === 'applicant' && form.rent_budget_mode === 'range',
          ),
          form.property_type === 'apartment' ? form.units_per_floor : '',
        ),
        form.contact_type === 'divar',
      ),
      images: [...existingImages, ...preparedImages],
    };
    let { data, error } = isEditing && propertyId
      ? await supabase.from('properties').update(payload).eq('id', propertyId).select().single()
      : await supabase.from('properties').insert(payload).select().single();
    // اگر ستون street هنوز در دیتابیس ساخته نشده باشد، فیلد را از درخواست حذف کن.
    // در صورت وجود مقدار خیابان، آن را موقتاً در payment_conditions نگه می‌داریم.
    const streetColumnMissing = error?.code === 'PGRST204' || error?.message?.includes("'street' column");
    if (error && streetColumnMissing) {
      const { street, ...withoutStreet } = payload;
      const fallbackPayload = street ? { ...withoutStreet, payment_conditions: street } : withoutStreet;
      ({ data, error } = isEditing && propertyId
        ? await supabase.from('properties').update(fallbackPayload).eq('id', propertyId).select().single()
        : await supabase.from('properties').insert(fallbackPayload).select().single());
    }

    if (error || !data) {
      setSaveError(error?.message ?? 'ثبت فایل انجام نشد. لطفاً دوباره تلاش کنید.');
      setSaving(false);
      return;
    }

    if (failedImages.length > 0) {
      const messages = [...new Set(failedImages.map((failure) => failure.message))].join('، ');
      window.alert(
        `${failedImages.length} عکس پردازش نشد.${preparedImages.length > 0 ? ` ${preparedImages.length} عکس با موفقیت ذخیره شد.` : ''}\nخطا: ${messages}`,
      );
    }

    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'property',
      entity_id: data.id,
      action: isEditing ? 'property_updated' : 'property_created',
      description: isEditing ? `آگهی ${form.title} ویرایش شد` : `فایل جدید ${form.title} ثبت شد`,
    });
    setSaving(false);
    onSaved();
  };

  if (formLoading) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> بازگشت
      </button>

      <PageHeader title={isEditing ? 'ویرایش آگهی' : 'فایل جدید'} subtitle={`مرحله ${step + 1} از ${steps.length}: ${steps[step].title}`} />

      {isEditing ? (
        <div className="mb-6">
          <p className="mb-2 text-xs text-slate-500">برای ویرایش، مستقیماً بخش موردنظر را انتخاب کنید:</p>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {steps.map((item, i) => (
              <button
                key={item.title}
                type="button"
                onClick={() => { setStep(i); setErrors({}); setSaveError(''); }}
                aria-current={i === step ? 'step' : undefined}
                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  i === step
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex gap-1 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-slate-900' : 'bg-slate-200'}`} />
          ))}
        </div>
      )}

      <div className="card p-5 space-y-4">
        {step === 0 && (
          <>
            <div>
              <label className="label">نوع معامله *</label>
              <div className="grid grid-cols-2 gap-2">
                {TRANSACTION_TYPES.map((t) => (
                  <button key={t.value} onClick={() => setForm({ ...form, transaction_type: t.value, transaction_role: '' })}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${form.transaction_type === t.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {form.transaction_type && (
              <div>
                <label className="label">نقش در معامله</label>
                <div className="grid grid-cols-2 gap-2">
                  {(TRANSACTION_ROLES[form.transaction_type] ?? []).map((r) => (
                    <button key={r.value} onClick={() => setForm({ ...form, transaction_role: r.value })}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${form.transaction_role === r.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <StepSummary items={[
              ...(form.transaction_type ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_type) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: TRANSACTION_ROLES[form.transaction_type]?.find((r) => r.value === form.transaction_role)?.label ?? form.transaction_role }] : []),
            ]} />
            <div>
              <label className="label">دسته‌بندی *</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.value} onClick={() => setForm({ ...form, category: c.value, property_type: '' })}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${form.category === c.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {form.category && (
              <div>
                <label className="label">نوع ملک *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(PROPERTY_TYPES[form.category] ?? []).map((p) => (
                    <button key={p.value} onClick={() => setForm({ ...form, property_type: p.value })}
                      className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${form.property_type === p.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <StepSummary items={[
              ...(form.transaction_type ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_type) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: TRANSACTION_ROLES[form.transaction_type]?.find((r) => r.value === form.transaction_role)?.label ?? form.transaction_role }] : []),
              ...(form.category ? [{ label: 'دسته‌بندی', value: getCategoryLabel(form.category) }] : []),
              ...(form.property_type ? [{ label: 'نوع ملک', value: getPropertyTypeLabel(form.category, form.property_type) }] : []),
              ...(selectedCounty ? [{ label: 'شهرستان', value: selectedCounty.name }] : []),
            ]} />
            <div>
              <label className="label">شهرستان *</label>
              <select
                className={`input ${errors.county_id ? 'input-error' : ''}`}
                value={form.county_id}
                onChange={(e) => { setForm({ ...form, county_id: e.target.value, neighborhood_id: '', street: '' }); }}
              >
                <option value="">{countiesLoading ? 'در حال دریافت شهرستان‌ها...' : 'انتخاب کنید...'}</option>
                {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {countiesError && <p className="text-xs text-red-600 mt-1">خطای دریافت شهرستان‌ها: {countiesError}</p>}
              {!countiesLoading && !countiesError && counties.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">هیچ شهرستانی در پایگاه داده یافت نشد.</p>
              )}
              {errors.county_id && <p className="text-xs text-red-500 mt-1">{errors.county_id}</p>}
            </div>
            {isRobatKarim && (
              <div>
                <label className="label">محله</label>
                <select
                  className="input"
                  value={form.neighborhood_id}
                  onChange={(e) => { setForm({ ...form, neighborhood_id: e.target.value, street: '' }); }}
                >
                  <option value="">انتخاب کنید...</option>
                  {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            )}
            {showStreet && (
              <div>
                <label className="label">خیابان</label>
                <select className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })}>
                  <option value="">انتخاب کنید...</option>
                  {ROBAT_KARIM_STREETS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">آدرس کامل *</label>
              <textarea
                className={`input min-h-[70px] ${errors.address ? 'input-error' : ''}`}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="پلاک، طبقه، واحد و توضیحات مسیر..."
              />
              {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <StepSummary items={[
              ...(form.transaction_type ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_type) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: TRANSACTION_ROLES[form.transaction_type]?.find((r) => r.value === form.transaction_role)?.label ?? form.transaction_role }] : []),
              ...(form.category ? [{ label: 'دسته‌بندی', value: getCategoryLabel(form.category) }] : []),
              ...(form.property_type ? [{ label: 'نوع ملک', value: getPropertyTypeLabel(form.category, form.property_type) }] : []),
              ...(form.address ? [{ label: 'آدرس', value: form.address }] : []),
            ]} />
            <div>
              <label className="label">عنوان فایل *</label>
              <input className={`input ${errors.title ? 'input-error' : ''}`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلا: آپارتمان 80 متری سه خواب سعادت‌آباد" />
            </div>
            <div>
              <label className="label">توضیحات</label>
              <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیحات فایل..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">متراژ زمین</label>
                <input className="input" type="text" inputMode="numeric" value={form.land_area} onChange={(e) => changeArea(e.target.value)} placeholder="120" dir="ltr" />
              </div>
              <div>
                <label className="label">متراژ بنا</label>
                <input className="input" type="text" inputMode="numeric" value={form.building_area} onChange={(e) => setForm({ ...form, building_area: wholeArea(e.target.value) })} placeholder="90" dir="ltr" />
              </div>
              <div>
                <label className="label">تعداد خواب</label>
                <input className="input" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder="2" dir="ltr" />
              </div>
              <div>
                <label className="label">تعداد اتاق</label>
                <input className="input" value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })} placeholder="3" dir="ltr" />
              </div>
              <div>
                <label className="label">{form.property_type === 'apartment' ? 'طبقه ملک' : 'طبقه'}</label>
                <input className="input" type="text" inputMode="numeric" value={form.floor} onChange={(e) => setForm({ ...form, floor: wholeArea(e.target.value) })} placeholder="2" dir="ltr" />
              </div>
              <div>
                <label className="label">{form.property_type === 'apartment' ? 'تعداد کل طبقات آپارتمان' : 'طبقات'}</label>
                <input className="input" type="text" inputMode="numeric" value={form.total_floors} onChange={(e) => setForm({ ...form, total_floors: wholeArea(e.target.value) })} placeholder="6" dir="ltr" />
              </div>
              {form.property_type === 'apartment' && (
                <>
                  <div>
                    <label className="label">تعداد واحد در هر طبقه</label>
                    <input className="input" type="text" inputMode="numeric" value={form.units_per_floor} onChange={(e) => setForm({ ...form, units_per_floor: wholeArea(e.target.value) })} placeholder="2" dir="ltr" />
                  </div>
                  <div>
                    <label className="label">واحد ملک</label>
                    <input className="input" type="text" inputMode="numeric" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: wholeArea(e.target.value) })} placeholder="4" dir="ltr" />
                  </div>
                </>
              )}
              <div>
                <label className="label">سن بنا</label>
                <input className="input" value={form.building_age} onChange={(e) => setForm({ ...form, building_age: e.target.value })} placeholder="5" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="label">امکانات</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[
                  { key: 'parking', label: 'پارکینگ' },
                  { key: 'storage', label: 'انباری' },
                  { key: 'elevator', label: 'آسانسور' },
                  { key: 'balcony', label: 'بالکن دارد' },
                  { key: 'yard', label: 'حیاط' },
                  { key: 'garden', label: 'باغ' },
                  { key: 'pool', label: 'استخر' },
                  { key: 'security', label: 'امنیت' },
                ].map((f) => (
                  <button key={f.key} onClick={() => setForm({ ...form, [f.key]: !form[f.key as keyof typeof form] } as any)}
                    className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${(form as any)[f.key] ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <StepSummary items={[
              ...(form.transaction_type ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_type) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: TRANSACTION_ROLES[form.transaction_type]?.find((r) => r.value === form.transaction_role)?.label ?? form.transaction_role }] : []),
              ...(form.category ? [{ label: 'دسته‌بندی', value: getCategoryLabel(form.category) }] : []),
              ...(form.property_type ? [{ label: 'نوع ملک', value: getPropertyTypeLabel(form.category, form.property_type) }] : []),
              ...(form.title ? [{ label: 'عنوان', value: form.title }] : []),
              ...(form.land_area ? [{ label: 'متراژ زمین', value: form.land_area }] : []),
              ...(form.building_area ? [{ label: 'متراژ بنا', value: form.building_area }] : []),
              ...(form.bedrooms ? [{ label: 'خواب', value: form.bedrooms }] : []),
            ]} />
            {form.transaction_type === 'rent' ? (
              form.transaction_role === 'applicant' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="label mb-0">بودجه رهن و اجاره</label>
                    <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
                      <button type="button" onClick={() => setForm({ ...form, rent_budget_mode: 'max', deposit_price_min: '', monthly_rent_min: '' })} className={`rounded-md px-3 py-1.5 ${form.rent_budget_mode === 'max' ? 'bg-white font-bold text-slate-800 shadow-sm' : 'text-slate-500'}`}>تا سقف</button>
                      <button type="button" onClick={() => setForm({ ...form, rent_budget_mode: 'range' })} className={`rounded-md px-3 py-1.5 ${form.rent_budget_mode === 'range' ? 'bg-white font-bold text-slate-800 shadow-sm' : 'text-slate-500'}`}>بازه</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">{form.rent_budget_mode === 'range' ? 'پول پیش؛ از' : 'حداکثر پول پیش'} (تومان)</label>
                      {form.rent_budget_mode === 'range' && <MoneyInput value={form.deposit_price_min} onChange={(value) => setForm({ ...form, deposit_price_min: value })} placeholder="400000000" wordsTone="indigo" />}
                      {form.rent_budget_mode === 'range' && <label className="mt-2 block text-xs text-slate-500">تا</label>}
                      <MoneyInput value={form.deposit_price} onChange={changeDepositPrice} placeholder="500000000" />
                    </div>
                    <div>
                      <label className="label">{form.rent_budget_mode === 'range' ? 'اجاره ماهانه؛ از' : 'حداکثر اجاره ماهانه'} (تومان)</label>
                      {form.rent_budget_mode === 'range' && <MoneyInput value={form.monthly_rent_min} onChange={(value) => setForm({ ...form, monthly_rent_min: value })} placeholder="4000000" wordsTone="indigo" />}
                      {form.rent_budget_mode === 'range' && <label className="mt-2 block text-xs text-slate-500">تا</label>}
                      <MoneyInput value={form.monthly_rent} onChange={changeMonthlyRent} placeholder="5000000" />
                    </div>
                  </div>
                  {errors.rent_budget && <p className="text-xs text-red-500">{errors.rent_budget}</p>}
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <input type="checkbox" checked={form.negotiable} onChange={(e) => setForm({ ...form, negotiable: e.target.checked })} className="h-4 w-4 rounded" />
                    <span className="text-sm font-medium text-slate-700">رهن و اجاره قابل تبدیل است</span>
                  </label>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">رهن (تومان)</label>
                    <MoneyInput value={form.deposit_price} onChange={changeDepositPrice} placeholder="100000000" />
                  </div>
                  <div>
                    <label className="label">اجاره ماهانه (تومان)</label>
                    <MoneyInput value={form.monthly_rent} onChange={changeMonthlyRent} placeholder="3000000" />
                  </div>
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <input type="checkbox" checked={form.negotiable} onChange={(e) => setForm({ ...form, negotiable: e.target.checked })} className="h-4 w-4 rounded" />
                    <span className="text-sm font-medium text-slate-700">رهن و اجاره قابل تبدیل است</span>
                  </label>
                </>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <div>
                  <label className="label">قیمت کل (تومان)</label>
                  <MoneyInput value={form.sale_price} onChange={changeTotalPrice} placeholder="2000000000" />
                </div>
                <div>
                  <label className="label">قیمت متری (تومان)</label>
                  <MoneyInput value={form.price_per_meter} onChange={changePricePerMeter} placeholder="20000000" wordsTone="indigo" />
                </div>
                <div>
                  <label className="label">متراژ (متر مربع)</label>
                  <input
                    className="input text-left font-medium tracking-wide"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={form.land_area}
                    onChange={(event) => changeArea(event.target.value)}
                    placeholder="100"
                  />
                  <p className="mt-1.5 min-h-5 px-1 text-[11px] leading-5 text-slate-500">فقط عدد صحیح بدون اعشار</p>
                </div>
                <p className="md:col-span-3 -mt-1 text-xs text-slate-500">با وارد کردن هر دو مقدار، مقدار سوم به‌صورت خودکار محاسبه می‌شود.</p>
              </div>
            )}
            {transactionCommissionValue > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4">
                <div className="mb-3 flex items-center gap-2 text-amber-800">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100"><Percent size={17} /></span>
                  <div>
                    <p className="text-sm font-bold">برآورد پورسانت</p>
                    {form.transaction_type === 'rent' && (
                      <p className="mt-0.5 text-[11px] font-normal text-slate-500">بر اساس ارزش معادل {formatPrice(transactionCommissionValue)} تومان</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                    سهم هر طرف (۱٪): {formatPrice(oneSideCommission)} تومان
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-500 px-3 py-1.5 font-bold text-white shadow-sm">
                    مجموع (۲٪): {formatPrice(combinedCommission)} تومان
                  </span>
                </div>
                <p className="mt-3 border-t border-amber-100 pt-2 text-[11px] leading-5 text-amber-800">
                  {moneyToPersianWords(combinedCommission)}
                </p>
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <StepSummary items={[
              ...(form.transaction_type ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_type) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: TRANSACTION_ROLES[form.transaction_type]?.find((r) => r.value === form.transaction_role)?.label ?? form.transaction_role }] : []),
              ...(form.category ? [{ label: 'دسته‌بندی', value: getCategoryLabel(form.category) }] : []),
              ...(form.property_type ? [{ label: 'نوع ملک', value: getPropertyTypeLabel(form.category, form.property_type) }] : []),
              ...(form.title ? [{ label: 'عنوان', value: form.title }] : []),
              ...(form.sale_price ? [{ label: 'قیمت', value: form.sale_price }] : []),
              ...(form.deposit_price ? [{ label: 'رهن', value: form.deposit_price }] : []),
              ...(form.monthly_rent ? [{ label: 'اجاره', value: form.monthly_rent }] : []),
            ]} />
            <div>
              <label className="label">این فایل از چه منبعی است؟ *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button type="button" onClick={() => setForm({ ...form, contact_type: 'owner', colleague_id: '' })} className={`rounded-xl border-2 p-3.5 text-right transition ${form.contact_type === 'owner' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><User size={18} /> شخصی (مالک مستقیم)</span>
                  <span className="mt-1 block text-xs text-slate-400">شماره مالک در اختیار من است</span>
                </button>
                <button type="button" onClick={() => setForm({ ...form, contact_type: 'colleague' })} className={`rounded-xl border-2 p-3.5 text-right transition ${form.contact_type === 'colleague' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><Handshake size={18} /> فایل همکار</span>
                  <span className="mt-1 block text-xs text-slate-400">ارتباط و هماهنگی از طریق همکار است</span>
                </button>
                <button type="button" onClick={() => setForm({ ...form, contact_type: 'divar', colleague_id: '' })} className={`rounded-xl border-2 p-3.5 text-right transition ${form.contact_type === 'divar' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><Globe size={18} /> فایل دیوار</span>
                  <span className="mt-1 block text-xs text-slate-400">آگهی از دیوار (مالک اختیاری)</span>
                </button>
              </div>
            </div>

            {form.contact_type === 'owner' || form.contact_type === 'divar' ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                {form.contact_type === 'divar' && (
                  <p className="rounded-lg bg-emerald-50 p-2.5 text-xs leading-5 text-emerald-700">
                    این فایل از دیوار است. اگر با مالک تماس مستقیم دارید، اطلاعاتش را ثبت کنید؛ در غیر این صورت این بخش را خالی بگذارید.
                  </p>
                )}
                {!addingNewOwner ? (
                  <>
                    <div>
                      <label className="label">{form.contact_type === 'divar' ? 'انتخاب مالک (اختیاری)' : 'انتخاب مالک *'}</label>
                      <select
                        className={`input ${errors.owner_id ? 'input-error' : ''}`}
                        value={form.owner_id}
                        onChange={(event) => {
                          const selected = ownerOptions.find((owner) => owner.id === event.target.value);
                          setForm({
                            ...form,
                            owner_id: event.target.value,
                            owner_name: selected?.name ?? '',
                            owner_phone: selected?.phone ?? '',
                            owner_notes: selected?.notes ?? '',
                          });
                        }}
                      >
                        <option value="">مالک را انتخاب کنید</option>
                        {ownerOptions.map((owner) => (
                          <option key={owner.id} value={owner.id} disabled={owner.status !== 'active' && owner.id !== form.owner_id}>
                            {owner.name} — {owner.phone}{owner.status !== 'active' ? ' (غیرفعال)' : ''}
                          </option>
                        ))}
                      </select>
                      {errors.owner_id && <p className="mt-1 text-xs text-red-500">{errors.owner_id}</p>}
                    </div>
                    {form.owner_id && (() => {
                      const selected = ownerOptions.find((owner) => owner.id === form.owner_id);
                      return selected ? (
                        <div className="rounded-lg bg-white p-3 text-xs text-slate-600 border border-slate-100">
                          <p className="font-bold text-slate-700">{selected.name}</p>
                          <p className="mt-1" dir="ltr">{selected.phone}</p>
                        </div>
                      ) : null;
                    })()}
                    <button
                      type="button"
                      onClick={() => {
                        setAddingNewOwner(true);
                        setForm({ ...form, owner_id: '', owner_name: '', owner_phone: '', owner_notes: '' });
                        setErrors({});
                      }}
                      className="btn-secondary w-full"
                    >
                      <Plus size={16} /> مالک در لیست نیست؛ افزودن مالک جدید
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700">افزودن مالک جدید</p>
                      {ownerOptions.length > 0 && (
                        <button type="button" onClick={() => { setAddingNewOwner(false); setForm({ ...form, owner_id: '', owner_name: '', owner_phone: '', owner_notes: '' }); setErrors({}); }} className="text-xs font-medium text-slate-500 hover:text-slate-700">انتخاب از لیست</button>
                      )}
                    </div>
                    <div>
                      <label className="label">{form.contact_type === 'divar' ? 'نام مالک (اختیاری)' : 'نام مالک *'}</label>
                      <input className={`input ${errors.owner_name ? 'input-error' : ''}`} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="نام و نام خانوادگی مالک" />
                      {errors.owner_name && <p className="mt-1 text-xs text-red-500">{errors.owner_name}</p>}
                    </div>
                    <div>
                      <label className="label">{form.contact_type === 'divar' ? 'تلفن مالک (اختیاری)' : 'تلفن مالک *'}</label>
                      <input className={`input ${errors.owner_phone ? 'input-error' : ''}`} value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} placeholder="09123456789" dir="ltr" />
                      {errors.owner_phone && <p className="mt-1 text-xs text-red-500">{errors.owner_phone}</p>}
                    </div>
                    <div>
                      <label className="label">یادداشت مالک</label>
                      <textarea className="input min-h-[60px]" value={form.owner_notes} onChange={(e) => setForm({ ...form, owner_notes: e.target.value })} placeholder="نکات مربوط به مالک..." />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <label className="label">انتخاب همکار *</label>
                <select className={`input ${errors.colleague_id ? 'input-error' : ''}`} value={form.colleague_id} onChange={(e) => setForm({ ...form, colleague_id: e.target.value })}>
                  <option value="">همکار را انتخاب کنید</option>
                  {colleagues.map((colleague) => (
                    <option key={colleague.id} value={colleague.id} disabled={colleague.status === 'inactive' && colleague.id !== form.colleague_id}>
                      {colleague.name}{colleague.agency_name ? ` — ${colleague.agency_name}` : ''}{colleague.status === 'inactive' ? ' (غیرفعال)' : ''}
                    </option>
                  ))}
                </select>
                {errors.colleague_id && <p className="mt-1 text-xs text-red-500">{errors.colleague_id}</p>}
                {!colleagues.some((colleague) => colleague.status === 'active') && <p className="mt-2 text-xs text-amber-600">ابتدا از بخش «همکاران» یک همکار فعال ثبت کنید.</p>}
                {form.colleague_id && (() => {
                  const selected = colleagues.find((colleague) => colleague.id === form.colleague_id);
                  return selected ? <div className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600"><p className="font-bold text-slate-700">{selected.name}</p><p className="mt-1" dir="ltr">{selected.phone}</p></div> : null;
                })()}
              </div>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <StepSummary items={[
              ...(form.title ? [{ label: 'عنوان', value: form.title }] : []),
              ...(form.contact_type === 'owner' && form.owner_name
                ? [{ label: 'مالک', value: form.owner_name }]
                : form.contact_type === 'colleague' && form.colleague_id
                  ? [{ label: 'همکار', value: colleagues.find((colleague) => colleague.id === form.colleague_id)?.name ?? 'انتخاب شده' }]
                  : []),
            ]} />
            <div>
              <label className="label">مشاور مسئول فایل</label>
              <select
                className="input"
                value={editingConsultantId ?? user?.id ?? ''}
                onChange={(event) => setEditingConsultantId(event.target.value || null)}
              >
                  {(user?.id
                    ? [
                        ...consultants.filter((c) => c.id === user.id),
                        ...consultants.filter((c) => c.id !== user.id),
                      ]
                    : consultants
                  ).map((consultant) => (
                    <option key={consultant.id} value={consultant.id}>
                      {consultant.id === user?.id ? `${consultant.name} (من)` : consultant.name}
                    </option>
                  ))}
                  {user?.id && !consultants.some((c) => c.id === user.id) && (
                    <option value={user.id}>
                      {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'من'} (من)
                    </option>
                  )}
                  {editingConsultantId && editingConsultantId !== user?.id && !consultants.some((c) => c.id === editingConsultantId) && (
                    <option value={editingConsultantId}>مشاور ثبت‌نشده</option>
                  )}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  فایل در «فایل‌های من» این مشاور دیده می‌شود؛ مدیر می‌تواند فایل را منتقل کند و گیرنده با «مال من است» آن را دریافت می‌کند.
                </p>
              </div>
            {isEditing && (
              <div>
                <label className="label">وضعیت آگهی</label>
                <select
                  className="input"
                  value={editingStatus}
                  onChange={(event) => {
                    setEditingStatus(event.target.value as Property['status']);
                    if (archiveInfo) {
                      // با تغییر وضعیت، آگهی به‌طور خودکار از بایگانی خارج می‌شود؛ وضعیت جدید مرجع اصلی است
                      setArchiveInfo(null);
                      setPropertyMetadata((current) => clearPropertyArchive(current));
                    }
                  }}
                >
                  {PROPERTY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>
            )}
            {isEditing && archiveInfo && (
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                <Archive size={15} className="mt-1 shrink-0 text-slate-400" />
                <span>
                  این آگهی <b>بایگانی</b> است ({archiveInfo.reason}). ذخیره بدون تغییر وضعیت، بایگانی را حفظ می‌کند؛
                  تغییر وضعیت آگهی را به‌طور خودکار از بایگانی خارج می‌کند.
                </span>
              </div>
            )}
            <PropertyImagePicker
              files={imageFiles}
              onChange={setImageFiles}
              existingImages={existingImages}
              onExistingImagesChange={setExistingImages}
            />
          </>
        )}

        {saveError && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{saveError}</p>}

        <div className="flex gap-2 pt-2">
          {isEditing ? (
            <>
              <button type="button" onClick={onBack} disabled={saving} className="btn-secondary flex-1">انصراف</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </>
          ) : (
            <>
              {step > 0 && <button onClick={() => setStep(step - 1)} disabled={saving} className="btn-secondary flex-1">مرحله قبل</button>}
              {step < steps.length - 1 ? (
                <button onClick={handleNext} className="btn-primary flex-1">مرحله بعد</button>
              ) : (
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'در حال ذخیره...' : 'ثبت فایل'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
