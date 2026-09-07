import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Search, Home, Phone, X, Filter, ArrowLeft, Trash2, Flame, Star, MapPin, Target, User, ImagePlus, Images, ChevronLeft, ChevronRight, Pencil, Maximize2, Handshake } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  TRANSACTION_TYPES,
  TRANSACTION_ROLES,
  CATEGORIES,
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  formatPrice,
  formatDate,
  getTransactionLabel,
  getCategoryLabel,
  getPropertyTypeLabel,
  getStatusInfo,
  normalizePhone,
  toEnglishDigits,
  timeAgo,
  TEHRAN_PROVINCE_ID,
  ACTIVE_COUNTY_NAMES,
  ROBAT_KARIM_COUNTY_NAME,
  ROBAT_KARIM_NEIGHBORHOODS,
  ROBAT_KARIM_STREETS,
} from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader, Pagination, ConfirmDialog, SortSelect } from '@/components/ui';
import { useActiveCounties, useCountyNeighborhoods } from '@/lib/geo';
import type { Property, Owner, Colleague } from '@/lib/types';
import { ownerToColleague, useColleagues } from '@/lib/colleagues';
import propertyPlaceholder from '@/assets/property-placeholder.jpg';
import {
  MAX_PROPERTY_IMAGES,
  MAX_PROPERTY_IMAGE_SIZE,
  PROPERTY_IMAGE_TYPES,
  preparePropertyImages,
} from '@/lib/propertyImages';

const PAGE_SIZE = 20;

type PropertyListItem = Property & {
  owners?: { name: string; phone: string } | null;
  provinces?: { name: string } | null;
  counties?: { name: string } | null;
  cities?: { name: string } | null;
  neighborhoods?: { name: string } | null;
};

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

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function PropertiesPage({ initialId }: { initialId?: string }) {
  const { user } = useAuth();
  const colleagueOptions = useColleagues();
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    transaction_type: '',
    category: '',
    status: '',
    is_hot: '',
  });

  useEffect(() => {
    if (initialId) {
      setSelectedId(initialId);
      setView('detail');
    }
  }, [initialId]);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from('properties')
      .select('*, owners(name, phone), provinces(name), counties(name), cities(name), neighborhoods(name)', { count: 'exact' });
    setProperties((data as PropertyListItem[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const visibleProperties = useMemo(() => {
    const q = toEnglishDigits(search.trim()).toLowerCase();
    let rows = properties;
    if (q) {
      rows = rows.filter((p) =>
        (p.title ?? '').toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q),
      );
    }
    if (filters.transaction_type) rows = rows.filter((p) => p.transaction_type === filters.transaction_type);
    if (filters.category) rows = rows.filter((p) => p.category === filters.category);
    if (filters.status) rows = rows.filter((p) => p.status === filters.status);
    if (filters.is_hot) rows = rows.filter((p) => (filters.is_hot === 'true') === !!p.is_hot);

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
  }, [properties, search, filters, sortKey]);

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

  const totalPages = Math.ceil(visibleProperties.length / PAGE_SIZE);
  const pageItems = visibleProperties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="فایل‌ها"
        subtitle={`${total} فایل`}
        actions={
          <button onClick={() => setView('create')} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">فایل جدید</span>
          </button>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pr-10"
            placeholder="جستجو با عنوان یا آدرس..."
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary ${Object.values(filters).some(Boolean) ? 'bg-slate-200' : ''}`}
        >
          <Filter size={18} />
        </button>
      </div>

      <SortSelect value={sortKey} options={PROPERTY_SORTS} onChange={(v) => { setSortKey(v); setPage(1); }} />

      {showFilters && (
        <div className="card p-4 mb-4 animate-slide-up">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">نوع معامله</label>
              <select className="input" value={filters.transaction_type} onChange={(e) => { setFilters({ ...filters, transaction_type: e.target.value }); setPage(1); }}>
                <option value="">همه</option>
                {TRANSACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">دسته‌بندی</label>
              <select className="input" value={filters.category} onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}>
                <option value="">همه</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">وضعیت</label>
              <select className="input" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
                <option value="">همه</option>
                {PROPERTY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">داغ</label>
              <select className="input" value={filters.is_hot} onChange={(e) => { setFilters({ ...filters, is_hot: e.target.value }); setPage(1); }}>
                <option value="">همه</option>
                <option value="true">داغ</option>
                <option value="false">عادی</option>
              </select>
            </div>
          </div>
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => { setFilters({ transaction_type: '', category: '', status: '', is_hot: '' }); setPage(1); }} className="text-xs text-red-500 font-medium mt-3">
              پاک کردن فیلترها
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : visibleProperties.length === 0 ? (
        <EmptyState
          icon={<Home size={48} />}
          title="فایلی یافت نشد"
          description="فایل جدیدی ثبت کنید یا فیلترها را تغییر دهید"
          action={<button onClick={() => setView('create')} className="btn-primary"><Plus size={18} /> فایل جدید</button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pageItems.map((p) => {
              const status = getStatusInfo(PROPERTY_STATUSES, p.status);
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

              return (
                <div
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setView('detail'); }}
                  className="card p-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
                >
                  <div className="relative -mx-4 -mt-4 mb-4 h-40 bg-slate-100 overflow-hidden">
                    <img
                      src={p.images?.[0] || propertyPlaceholder}
                      alt={p.images?.[0] ? p.title : 'تصویر پیش‌فرض ملک'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {p.images?.length > 1 && (
                      <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white" dir="ltr">
                        <Images size={13} /> {p.images.length}
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
                      {p.negotiable && <span className="badge bg-emerald-50 text-emerald-600">قابل مذاکره</span>}
                    </div>
                    <Badge color={status.color}>{status.label}</Badge>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 mb-1 truncate">{p.title}</h3>
                  <p className="text-xs text-slate-400 mb-2 truncate">
                    {getCategoryLabel(p.category)} • {getPropertyTypeLabel(p.category, p.property_type)}
                    {roleLabel ? ` • ${roleLabel}` : ''}
                  </p>

                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">
                    <MapPin size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate font-medium">{locationLine}</span>
                  </p>
                  {locationParts.length > 0 && (p.street || p.address) && (
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
                            <p className="text-[11px] text-slate-400 mb-0.5">رهن</p>
                            <p className="text-sm font-extrabold text-slate-800">
                              {formatPrice(p.deposit_price)} <span className="text-[10px] font-medium text-slate-400">تومان</span>
                            </p>
                          </div>
                        )}
                        {p.monthly_rent != null && (
                          <div>
                            <p className="text-[11px] text-slate-400 mb-0.5">اجاره ماهانه</p>
                            <p className="text-sm font-extrabold text-slate-800">
                              {p.monthly_rent === 0 ? 'بدون اجاره' : `${formatPrice(p.monthly_rent)} تومان`}
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
                      {sourceColleague ? <Handshake size={12} className="shrink-0 text-indigo-400" /> : <User size={12} className="shrink-0 text-slate-400" />}
                      <span className="truncate">
                        {sourceColleague ? `همکار: ${sourceColleague.name}` : p.owners?.name || 'بدون مالک'}
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
  const [property, setProperty] = useState<(PropertyListItem) | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [colleague, setColleague] = useState<Pick<Colleague, 'id' | 'name' | 'phone' | 'agency_name'> | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'matches' | 'calls' | 'followups'>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const [propRes, callsRes, fuRes, matchRes] = await Promise.all([
      supabase.from('properties').select('*, owners(name, phone), counties(name), neighborhoods(name)').eq('id', propertyId).maybeSingle(),
      supabase.from('calls').select('*').eq('property_id', propertyId).order('call_date', { ascending: false }).limit(10),
      supabase.from('follow_ups').select('*').eq('property_id', propertyId).order('due_date', { ascending: false }).limit(10),
      supabase.from('property_matches').select('*, customers(id, first_name, last_name, mobile, temperature)').eq('property_id', propertyId).order('score', { ascending: false }).limit(5),
    ]);
    setProperty(propRes.data as PropertyListItem);
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

  if (loading || !property) {
    return <div className="flex justify-center py-16"><Spinner size={32} /></div>;
  }

  const status = getStatusInfo(PROPERTY_STATUSES, property.status);

  return (
    <div className="animate-fade-in space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> بازگشت
      </button>

      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {property.is_hot && <Flame size={18} className="text-red-500" />}
              {property.is_featured && <Star size={18} className="text-yellow-500" />}
              <h2 className="text-lg font-bold text-slate-800">{property.title}</h2>
              {colleague && <Badge color="purple"><Handshake size={12} /> فایل همکار</Badge>}
            </div>
            <p className="text-xs text-slate-400">
              {getTransactionLabel(property.transaction_type)} • {getCategoryLabel(property.category)} • {getPropertyTypeLabel(property.category, property.property_type)}
            </p>
          </div>
          <Badge color={status.color}>{status.label}</Badge>
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

        <div className="flex gap-2 flex-wrap">
          {colleague ? (
            <a href={`tel:${normalizePhone(colleague.phone)}`} className="btn-primary">
              <Handshake size={16} /> تماس با همکار
            </a>
          ) : owner ? (
            <a href={`tel:${normalizePhone(owner.phone)}`} className="btn-primary">
              <Phone size={16} /> تماس با مالک
            </a>
          ) : null}
          <button onClick={onEdit} className="btn-secondary">
            <Pencil size={16} /> ویرایش آگهی
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger" aria-label="حذف آگهی">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

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
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[
          { key: 'info', label: 'اطلاعات' },
          { key: 'matches', label: 'تطبیق‌ها' },
          { key: 'calls', label: 'تماس‌ها' },
          { key: 'followups', label: 'پیگیری‌ها' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="card p-5 space-y-4">
          {property.description && <p className="text-sm text-slate-600">{property.description}</p>}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {property.land_area != null && <InfoField label="متراژ زمین" value={`${property.land_area} متر`} />}
            {property.building_area != null && <InfoField label="متراژ بنا" value={`${property.building_area} متر`} />}
            {property.bedrooms != null && <InfoField label="تعداد خواب" value={String(property.bedrooms)} />}
            {property.rooms != null && <InfoField label="تعداد اتاق" value={String(property.rooms)} />}
            {property.floor != null && <InfoField label="طبقه" value={String(property.floor)} />}
            {property.total_floors != null && <InfoField label="طبقات" value={String(property.total_floors)} />}
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
              {property.deposit_price != null && <InfoField label="رهن" value={`${formatPrice(property.deposit_price)} ت`} />}
              {property.monthly_rent != null && <InfoField label="اجاره" value={`${formatPrice(property.monthly_rent)} ت`} />}
              {property.price_per_meter != null && <InfoField label="قیمت هر متر" value={`${formatPrice(property.price_per_meter)} ت`} />}
              {property.commission != null && <InfoField label="پورسانت" value={`${formatPrice(property.commission)} ت`} />}
              <InfoField label="قابل مذاکره" value={property.negotiable ? 'بله' : 'خیر'} />
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
        <div className="card overflow-hidden">
          {calls.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {calls.map((call) => (
                <div key={call.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{call.result ?? 'تماس'}</span>
                    <span className="text-xs text-slate-400">{formatDate(call.call_date)}</span>
                  </div>
                  {call.notes && <p className="text-xs text-slate-500">{call.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Phone size={36} />} title="تماسی ثبت نشده" />
          )}
        </div>
      )}

      {activeTab === 'followups' && (
        <div className="card overflow-hidden">
          {followups.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {followups.map((fu) => (
                <div key={fu.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{fu.reason ?? 'پیگیری'}</p>
                    <p className="text-xs text-slate-400">{formatDate(fu.due_date)} {fu.due_time}</p>
                  </div>
                  <Badge color={fu.status === 'completed' ? 'green' : fu.status === 'pending' ? 'yellow' : 'red'}>
                    {fu.status === 'completed' ? 'انجام شده' : fu.status === 'pending' ? 'در انتظار' : fu.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="پیگیری‌ای ثبت نشده" />
          )}
        </div>
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

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="حذف فایل"
        message="آیا از حذف این فایل مطمئن هستید؟"
        confirmLabel="حذف"
        danger
      />
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-sm text-slate-700 mt-0.5">{value}</p>
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
  const { user } = useAuth();
  const { counties } = useActiveCounties();
  const colleagues = useColleagues();
  const isEditing = Boolean(propertyId);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(Boolean(propertyId));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);
  const [editingConsultantId, setEditingConsultantId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<Property['status']>('active');
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
    deposit_price: '',
    monthly_rent: '',
    negotiable: false,
    commission: '',
    contact_type: 'owner' as 'owner' | 'colleague',
    colleague_id: '',
    owner_name: '',
    owner_phone: '',
    owner_notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        land_area: text(data.land_area),
        building_area: text(data.building_area),
        bedrooms: text(data.bedrooms),
        rooms: text(data.rooms),
        floor: text(data.floor),
        total_floors: text(data.total_floors),
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
        deposit_price: text(data.deposit_price),
        monthly_rent: text(data.monthly_rent),
        negotiable: Boolean(data.negotiable),
        commission: text(data.commission),
        contact_type: isUuid(data.owner_relationship) ? 'colleague' : 'owner',
        colleague_id: isUuid(data.owner_relationship) ? data.owner_relationship : '',
        owner_name: text(ownerInfo?.name),
        owner_phone: text(ownerInfo?.phone),
        owner_notes: text(ownerInfo?.notes ?? data.owner_notes),
      });
      setExistingImages(Array.isArray(data.images) ? data.images : []);
      setEditingOwnerId(data.owner_id ?? null);
      setEditingConsultantId(data.assigned_consultant_id ?? null);
      setEditingStatus((data.status as Property['status']) ?? 'active');
      setFormLoading(false);
    };
    loadPropertyForEdit();
    return () => { cancelled = true; };
  }, [propertyId]);

  const selectedCounty = counties.find((c) => c.id === form.county_id);
  const isRobatKarim = selectedCounty?.name === ROBAT_KARIM_COUNTY_NAME;
  const { neighborhoods } = useCountyNeighborhoods(
    isRobatKarim ? form.county_id : null,
    isRobatKarim ? ROBAT_KARIM_NEIGHBORHOODS : [],
  );
  const showStreet = isRobatKarim && form.neighborhood_id === neighborhoods.find((n) => n.name === ROBAT_KARIM_COUNTY_NAME)?.id;

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
    if (step === 5 && form.contact_type === 'owner' && !form.owner_name.trim()) errs.owner_name = 'نام مالک الزامی است';
    if (step === 5 && form.contact_type === 'owner' && !form.owner_phone.trim()) errs.owner_phone = 'تلفن مالک الزامی است';
    if (step === 5 && form.contact_type === 'colleague' && !form.colleague_id) errs.colleague_id = 'انتخاب همکار الزامی است';
    setErrors(errs);
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

    // Update the current owner while editing, or create/find one for a new property.
    let ownerId: string | null = form.contact_type === 'owner' ? editingOwnerId : null;
    if (form.contact_type === 'owner' && editingOwnerId) {
      const { error: ownerUpdateError } = await supabase.from('owners').update({
        name: form.owner_name,
        phone: normalizePhone(form.owner_phone),
        notes: form.owner_notes || null,
      }).eq('id', editingOwnerId);
      if (ownerUpdateError) {
        setSaveError(`ویرایش اطلاعات مالک انجام نشد: ${ownerUpdateError.message}`);
        setSaving(false);
        return;
      }
    } else if (form.contact_type === 'owner' && form.owner_name && form.owner_phone) {
      const { data: existingOwner } = await supabase.from('owners').select('id').eq('phone', normalizePhone(form.owner_phone)).maybeSingle();
      if (existingOwner) {
        ownerId = existingOwner.id;
      } else {
        const { data: newOwner, error: ownerError } = await supabase.from('owners').insert({
          name: form.owner_name,
          phone: normalizePhone(form.owner_phone),
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
    const landArea = form.land_area ? Number(toEnglishDigits(form.land_area)) : null;

    const payload = {
      title: form.title,
      description: form.description || null,
      transaction_type: form.transaction_type,
      transaction_role: form.transaction_role || null,
      category: form.category,
      property_type: form.property_type,
      status: editingStatus,
      is_active: editingStatus === 'active',
      owner_id: ownerId,
      owner_relationship: form.contact_type === 'colleague' ? form.colleague_id : null,
      assigned_consultant_id: editingConsultantId || user?.id,
      province_id: TEHRAN_PROVINCE_ID,
      county_id: form.county_id || null,
      district_id: null,
      city_id: null,
      neighborhood_id: form.neighborhood_id || null,
      street: showStreet ? form.street || null : null,
      address: form.address || null,
      land_area: landArea,
      building_area: form.building_area ? Number(toEnglishDigits(form.building_area)) : null,
      bedrooms: form.bedrooms ? Number(toEnglishDigits(form.bedrooms)) : null,
      rooms: form.rooms ? Number(toEnglishDigits(form.rooms)) : null,
      floor: form.floor ? Number(toEnglishDigits(form.floor)) : null,
      total_floors: form.total_floors ? Number(toEnglishDigits(form.total_floors)) : null,
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
      deposit_price: form.transaction_type === 'rent' && form.deposit_price ? Number(toEnglishDigits(form.deposit_price)) : null,
      monthly_rent: form.transaction_type === 'rent' && form.monthly_rent ? Number(toEnglishDigits(form.monthly_rent)) : null,
      price_per_meter: salePrice != null && landArea != null && landArea > 0
        ? Math.round(salePrice / landArea)
        : null,
      negotiable: form.negotiable,
      commission: form.commission ? Number(toEnglishDigits(form.commission)) : null,
      owner_notes: form.contact_type === 'owner' ? form.owner_notes || null : null,
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

      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-slate-900' : 'bg-slate-200'}`} />
        ))}
      </div>

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
                <option value="">انتخاب کنید...</option>
                {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
                <input className="input" value={form.land_area} onChange={(e) => setForm({ ...form, land_area: e.target.value })} placeholder="120" dir="ltr" />
              </div>
              <div>
                <label className="label">متراژ بنا</label>
                <input className="input" value={form.building_area} onChange={(e) => setForm({ ...form, building_area: e.target.value })} placeholder="90" dir="ltr" />
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
                <label className="label">طبقه</label>
                <input className="input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="2" dir="ltr" />
              </div>
              <div>
                <label className="label">طبقات</label>
                <input className="input" value={form.total_floors} onChange={(e) => setForm({ ...form, total_floors: e.target.value })} placeholder="6" dir="ltr" />
              </div>
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
                  { key: 'balcony', label: 'بالکن' },
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
            {form.transaction_type === 'buy' || form.transaction_type === 'sell' ? (
              <div>
                <label className="label">قیمت فروش (تومان)</label>
                <input className="input" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="2000000000" dir="ltr" />
              </div>
            ) : form.transaction_type === 'rent' ? (
              <>
                <div>
                  <label className="label">رهن (تومان)</label>
                  <input className="input" value={form.deposit_price} onChange={(e) => setForm({ ...form, deposit_price: e.target.value })} placeholder="100000000" dir="ltr" />
                </div>
                <div>
                  <label className="label">اجاره ماهانه (تومان)</label>
                  <input className="input" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} placeholder="3000000" dir="ltr" />
                </div>
              </>
            ) : (
              <div>
                <label className="label">قیمت مشارکت (تومان)</label>
                <input className="input" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="مبلغ مشارکت" dir="ltr" />
              </div>
            )}
            <div>
              <label className="label">پورسانت (تومان)</label>
              <input className="input" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} placeholder="50000000" dir="ltr" />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.negotiable} onChange={(e) => setForm({ ...form, negotiable: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-700">قابل مذاکره</span>
              </label>
            </div>
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
              <label className="label">این فایل را از چه کسی گرفته‌اید؟ *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm({ ...form, contact_type: 'owner', colleague_id: '' })} className={`rounded-xl border-2 p-4 text-right transition ${form.contact_type === 'owner' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><User size={18} /> ارتباط مستقیم با مالک</span>
                  <span className="mt-1 block text-xs text-slate-400">شماره مالک در اختیار من است</span>
                </button>
                <button type="button" onClick={() => setForm({ ...form, contact_type: 'colleague' })} className={`rounded-xl border-2 p-4 text-right transition ${form.contact_type === 'colleague' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><Handshake size={18} /> فایل همکار</span>
                  <span className="mt-1 block text-xs text-slate-400">ارتباط و هماهنگی از طریق همکار است</span>
                </button>
              </div>
            </div>

            {form.contact_type === 'owner' ? (
              <>
                <div>
                  <label className="label">نام مالک *</label>
                  <input className={`input ${errors.owner_name ? 'input-error' : ''}`} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="نام و نام خانوادگی مالک" />
                  {errors.owner_name && <p className="mt-1 text-xs text-red-500">{errors.owner_name}</p>}
                </div>
                <div>
                  <label className="label">تلفن مالک *</label>
                  <input className={`input ${errors.owner_phone ? 'input-error' : ''}`} value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} placeholder="09123456789" dir="ltr" />
                  {errors.owner_phone && <p className="mt-1 text-xs text-red-500">{errors.owner_phone}</p>}
                </div>
                <div>
                  <label className="label">یادداشت مالک</label>
                  <textarea className="input min-h-[60px]" value={form.owner_notes} onChange={(e) => setForm({ ...form, owner_notes: e.target.value })} placeholder="نکات مربوط به مالک..." />
                </div>
              </>
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
            {isEditing && (
              <div>
                <label className="label">وضعیت آگهی</label>
                <select className="input" value={editingStatus} onChange={(event) => setEditingStatus(event.target.value as Property['status'])}>
                  {PROPERTY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
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
          {step > 0 && <button onClick={() => setStep(step - 1)} disabled={saving} className="btn-secondary flex-1">مرحله قبل</button>}
          {step < steps.length - 1 ? (
            <button onClick={handleNext} className="btn-primary flex-1">مرحله بعد</button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'در حال ذخیره...' : isEditing ? 'ذخیره تغییرات' : 'ثبت فایل'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
