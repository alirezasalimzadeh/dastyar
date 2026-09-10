import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { Plus, Search, Users, Phone, X, Filter, ArrowLeft, ArrowUpDown, Trash2, Tag, Clock, Target, MapPin, Pencil, Key, ShoppingBag, Handshake, Wallet, Ruler, BedDouble, Building2, Landmark, Sparkles, StickyNote, UserPlus, CalendarClock, ChevronDown, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  TEMPERATURES,
  CUSTOMER_STATUSES,
  URGENCY_LEVELS,
  TRANSACTION_TYPES,
  CATEGORIES,
  PROPERTY_TYPES,
  CONTACT_SOURCES,
  formatPrice,
  formatDate,
  formatMoneyShort,
  timeAgo,
  getTemperatureInfo,
  getStatusInfo,
  getTransactionLabel,
  getCategoryLabel,
  getContactSourceLabel,
  normalizePhone,
  validatePhone,
  toEnglishDigits,
  toPersianDigits,
  stripPhoneSpaces,
  ROBAT_KARIM_COUNTY_NAME,
} from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, MoneyInput, PageHeader, Pagination, ConfirmDialog, CopyButton } from '@/components/ui';
import { useActiveCounties, useCountyNeighborhoods } from '@/lib/geo';
import type { Customer } from '@/lib/types';
import { getFieldSections, getFieldLabel, type FieldDef } from '@/lib/propertyFields';
import { useColleagues } from '@/lib/colleagues';
import { CallFormModal, CallRecordCard } from '@/components/calls';
import { FollowupFormModal, FollowupRecordCard } from '@/components/followups';

const PAGE_SIZE = 20;

// هویت بصری هر نوع معامله: بج رنگی + رنگ متن بودجه + رنگ آیکون‌های آمار
const TRANSACTION_STYLES: Record<string, { pill: string; value: string; icon: string; Icon: LucideIcon }> = {
  buy: { pill: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700', icon: 'text-emerald-500', Icon: ShoppingBag },
  rent: { pill: 'bg-blue-50 text-blue-700', value: 'text-blue-700', icon: 'text-blue-500', Icon: Key },
  sell: { pill: 'bg-amber-50 text-amber-700', value: 'text-amber-700', icon: 'text-amber-500', Icon: Tag },
  partnership: { pill: 'bg-purple-50 text-purple-700', value: 'text-purple-700', icon: 'text-purple-500', Icon: Handshake },
};

// کاشی آماری کوچک در کارت مشتری
function CardStat({ icon, label, value, tint, valueClass }: { icon: ReactNode; label: string; value: ReactNode; tint?: string; valueClass?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
        <span className={`shrink-0 ${tint ?? 'text-slate-400'}`}>{icon}</span>
        <span>{label}</span>
      </p>
      <p className={`mt-0.5 text-xs font-semibold leading-5 ${valueClass ?? 'text-slate-800'}`}>
        {value == null
          ? <span className="font-normal text-slate-300">ثبت نشده</span>
          : typeof value === 'string'
            ? <span className="block truncate">{value}</span>
            : value}
      </p>
    </div>
  );
}

type CustomerRow = Customer & { calls?: { call_date: string }[] | null };


const CUSTOMER_SORTS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'name', label: 'نام (الفبا)' },
  { value: 'budget', label: 'بیشترین بودجه' },
  { value: 'last_call', label: 'آخرین تماس' },
  { value: 'temperature', label: 'داغ‌ترین مشتری' },
  { value: 'urgency', label: 'فوری‌ترین' },
];

export function CustomersPage({ initialId, initialFilter }: { initialId?: string; initialFilter?: string }) {
  const { user } = useAuth();
  const colleagues = useColleagues();
  // نقشهٔ id شهر → نام، برای نمایش شهرِ موردنظر در کارت‌های لیست
  const [cityNames, setCityNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    supabase.from('cities').select('id, name').then(({ data }) => {
      if (active && data) setCityNames(Object.fromEntries((data as { id: string; name: string }[]).map((c) => [c.id, c.name])));
    });
    return () => { active = false; };
  }, []);
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    temperature: '',
    status: '',
    transaction_intention: '',
    urgency: '',
    lead_source: '',
    colleague: '',
    category: '',
    property_type: '',
  });

  useEffect(() => {
    if (initialId) {
      setSelectedId(initialId);
      setView('detail');
    } else if (initialFilter === 'hot') {
      setFilters((f) => ({ ...f, temperature: 'hot' }));
    }
  }, [initialId, initialFilter]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from('customers')
      .select('*, calls(call_date)', { count: 'exact' });
    setCustomers((data as CustomerRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const visibleCustomers = useMemo(() => {
    const q = toEnglishDigits(search.trim()).toLowerCase();
    let rows = customers.map((c) => {
      const lastCall = (c.calls ?? []).reduce<string | null>(
        (acc, x) => (x.call_date && (!acc || x.call_date > acc) ? x.call_date : acc),
        null,
      );
      const lastContact = [lastCall, c.last_contact].filter(Boolean).sort().pop() ?? null;
      return { ...c, lastCall, lastContact };
    });
    if (q) {
      rows = rows.filter((c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        toEnglishDigits(c.mobile ?? '').includes(q) ||
        toEnglishDigits(c.secondary_phone ?? '').includes(q),
      );
    }
    if (filters.temperature) rows = rows.filter((c) => c.temperature === filters.temperature);
    if (filters.status) rows = rows.filter((c) => c.status === filters.status);
    if (filters.transaction_intention) rows = rows.filter((c) => c.transaction_intention === filters.transaction_intention);
    if (filters.category) rows = rows.filter((c) => c.preferred_category === filters.category);
    if (filters.property_type) rows = rows.filter((c) => (c.preferred_property_types ?? []).includes(filters.property_type));
    if (filters.urgency) rows = rows.filter((c) => c.urgency === filters.urgency);
    if (filters.lead_source) rows = rows.filter((c) => c.lead_source === filters.lead_source);
    if (filters.colleague) {
      rows = rows.filter((c) => {
        const referrerId = (c.property_preferences as Record<string, unknown> | null)?.colleague_id as string | undefined;
        return filters.colleague === 'mine' ? !referrerId : referrerId === filters.colleague;
      });
    }

    const byDateDesc = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');
    const budgetOf = (c: CustomerRow) => c.budget_max ?? c.budget_min ?? -1;
    const tempRank: Record<string, number> = { hot: 0, warm: 1, cold: 2 };
    const urgencyRank: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    switch (sortKey) {
      case 'oldest': rows.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')); break;
      case 'name': rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fa')); break;
      case 'budget': rows.sort((a, b) => budgetOf(b) - budgetOf(a)); break;
      case 'last_call': rows.sort((a, b) => byDateDesc(a.lastContact, b.lastContact)); break;
      case 'temperature': rows.sort((a, b) => (tempRank[a.temperature ?? 'cold'] ?? 2) - (tempRank[b.temperature ?? 'cold'] ?? 2)); break;
      case 'urgency': rows.sort((a, b) => (urgencyRank[a.urgency ?? 'low'] ?? 3) - (urgencyRank[b.urgency ?? 'low'] ?? 3)); break;
      default: rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    }
    return rows;
  }, [customers, search, filters, sortKey]);

  if (view === 'create') {
    return <CustomerForm onBack={() => setView('list')} onSaved={() => { setView('list'); loadCustomers(); }} />;
  }

  if (view === 'edit' && selectedId) {
    return (
      <CustomerForm
        customerId={selectedId}
        onBack={() => setView('detail')}
        onSaved={() => { setView('detail'); loadCustomers(); }}
      />
    );
  }

  if (view === 'detail' && selectedId) {
    return (
      <CustomerDetail
        customerId={selectedId}
        onBack={() => { setView('list'); setSelectedId(null); }}
        onEdit={() => setView('edit')}
      />
    );
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const totalPages = Math.ceil(visibleCustomers.length / PAGE_SIZE);
  const pageItems = visibleCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="مشتریان"
        subtitle={`${total} مشتری`}
        actions={
          <button onClick={() => setView('create')} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">مشتری جدید</span>
          </button>
        }
      />

      {/* نوار ابزار: جستجو + مرتب‌سازی + فیلتر در یک سطر */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input h-10 pr-10"
            placeholder="جستجو با نام یا شماره..."
          />
        </div>
        <div className="relative w-36 shrink-0 sm:w-48">
          <ArrowUpDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-500" />
          <select
            aria-label="مرتب‌سازی"
            className="h-10 w-full appearance-none truncate rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-8 text-xs font-bold text-slate-700 shadow-sm outline-none transition-all hover:border-slate-400 focus:border-transparent focus:ring-2 focus:ring-slate-400"
            value={sortKey}
            onChange={(e) => { setSortKey(e.target.value); setPage(1); }}
          >
            {CUSTOMER_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          aria-label="فیلترها"
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-all active:scale-95 ${
            showFilters || activeFilterCount > 0
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          }`}
        >
          <Filter size={17} />
          {activeFilterCount > 0 && (
            <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
              {toPersianDigits(activeFilterCount)}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card p-4 mb-4 animate-slide-up space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">دمای مشتری</label>
              <select
                className="input"
                value={filters.temperature}
                onChange={(e) => { setFilters({ ...filters, temperature: e.target.value }); setPage(1); }}
              >
                <option value="">همه</option>
                {TEMPERATURES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">وضعیت</label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              >
                <option value="">همه</option>
                {CUSTOMER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">نوع معامله</label>
              <select
                className="input"
                value={filters.transaction_intention}
                onChange={(e) => { setFilters({ ...filters, transaction_intention: e.target.value }); setPage(1); }}
              >
                <option value="">همه</option>
                  {TRANSACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">دسته‌بندی</label>
                <select
                  className="input"
                  value={filters.category}
                  onChange={(e) => { setFilters({ ...filters, category: e.target.value, property_type: '' }); setPage(1); }}
                >
                  <option value="">همه</option>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">نوع ملک</label>
                <select
                  className="input"
                  value={filters.property_type}
                  onChange={(e) => { setFilters({ ...filters, property_type: e.target.value }); setPage(1); }}
                >
                  <option value="">همه</option>
                  {(filters.category
                    ? (PROPERTY_TYPES[filters.category] ?? [])
                    : Object.values(PROPERTY_TYPES).flat()
                  ).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">فوریت</label>
              <select
                className="input"
                value={filters.urgency}
                onChange={(e) => { setFilters({ ...filters, urgency: e.target.value }); setPage(1); }}
              >
                <option value="">همه</option>
                {URGENCY_LEVELS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">منبع آشنایی</label>
              <select
                className="input"
                value={filters.lead_source}
                onChange={(e) => { setFilters({ ...filters, lead_source: e.target.value }); setPage(1); }}
              >
                <option value="">همه</option>
                {CONTACT_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">همکار معرف</label>
              <select
                className="input"
                value={filters.colleague}
                onChange={(e) => { setFilters({ ...filters, colleague: e.target.value }); setPage(1); }}
              >
                <option value="">همه</option>
                <option value="mine">بدون همکار (مشتری من)</option>
                {colleagues.map((colleague) => <option key={colleague.id} value={colleague.id}>{colleague.name}</option>)}
              </select>
            </div>
          </div>
          {Object.values(filters).some(Boolean) && (
            <button
                onClick={() => { setFilters({ temperature: '', status: '', transaction_intention: '', urgency: '', lead_source: '', colleague: '', category: '', property_type: '' }); setPage(1); }}
              className="text-xs text-red-500 font-medium"
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
      )}

      {/* Customer List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : visibleCustomers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="مشتری‌ای یافت نشد"
          description="مشتری جدیدی ثبت کنید یا فیلترها را تغییر دهید"
          action={<button onClick={() => setView('create')} className="btn-primary"><Plus size={18} /> مشتری جدید</button>}
        />
      ) : (
        <>
          <div className="space-y-3">
              {pageItems.map((c) => {
                const colleagueId = (c.property_preferences as Record<string, unknown> | null)?.colleague_id as string | undefined;
                const referringColleague = colleagues.find((colleague) => colleague.id === colleagueId);
                const transactionLabel = c.transaction_intention ? getTransactionLabel(c.transaction_intention) : null;
                const txStyle = c.transaction_intention ? TRANSACTION_STYLES[c.transaction_intention] : undefined;
                const categoryLabel = c.preferred_category ? getCategoryLabel(c.preferred_category) : null;
                const typeLabels = c.preferred_property_types?.length
                  ? c.preferred_property_types.slice(0, 2).map((pt) => PROPERTY_TYPES[c.preferred_category!]?.find((p) => p.value === pt)?.label ?? pt).join('، ')
                  : null;
                const cityText = (c.preferred_city_ids ?? []).map((id) => cityNames[id]).filter(Boolean).join('، ');
                // داده‌های مالی/مشخصاتی مشتری (بودجه، متراژ، اتاق، امکانات) به‌ازای
                // هر نوع ملک در property_preferences ذخیره می‌شوند — اولین مقدار
                // غیرخالی را بین نوع‌های انتخابی می‌گیریم
                const firstPref = (key: string): unknown => {
                  for (const pt of c.preferred_property_types ?? []) {
                    const prefs = c.property_preferences?.[pt] as unknown as Record<string, unknown> | undefined;
                    const v = prefs?.[key];
                    if (v != null && String(v).trim() !== '') return v;
                  }
                  return undefined;
                };
                const num = (v: unknown): number | null => {
                  if (v == null || String(v).trim() === '') return null;
                  const n = Number(toEnglishDigits(String(v)));
                  return Number.isFinite(n) ? n : null;
                };
                const moneyRange = (min: unknown, max: unknown) => {
                  const m = num(min);
                  const x = num(max);
                  if (m == null && x == null) return null;
                  if (m != null && x != null) return `${formatMoneyShort(m)} تا ${formatMoneyShort(x)}`;
                  if (x != null) return `تا ${formatMoneyShort(x)}`;
                  return `از ${formatMoneyShort(m as number)}`;
                };
                // بودجهٔ اجاره: بازهٔ ودیعه + بازهٔ اجارهٔ ماهانه
                const depositRange = c.transaction_intention === 'rent' ? moneyRange(firstPref('deposit_min'), firstPref('deposit_max')) : null;
                const rentRange = c.transaction_intention === 'rent' ? moneyRange(firstPref('rent_min'), firstPref('rent_max')) : null;
                const budgetText = c.transaction_intention === 'rent'
                  ? null
                  : moneyRange(firstPref('budget_min'), firstPref('budget_max'));
                const areaText = (() => {
                  const a = num(firstPref('min_area') ?? c.min_area);
                  const b = num(firstPref('max_area') ?? c.max_area);
                  if (a == null && b == null) return null;
                  if (a != null && b != null) return `${toPersianDigits(a)} تا ${toPersianDigits(b)} متری`;
                  if (b != null) return `تا ${toPersianDigits(b)} متری`;
                  return `از ${toPersianDigits(a as number)} متری`;
                })();
                // کاشی چهارم: اولین فیلد مشخصاتِ خودِ نوع ملک (متراژ که جداست) —
                // برای انواع مسکونی همان «حداقل اتاق» است، برای مغازه/زمین «حداقل بر/دهنه»،
                // برای غرفه «طبقه مورد نظر» و ... یعنی هر دسته فیلد مناسب خودش را می‌بیند
                const specTile = (() => {
                  const pt = (c.preferred_property_types ?? [])[0];
                  if (!pt) return null;
                  const specs = getFieldSections(pt, c.transaction_role || 'buyer', c.transaction_intention ?? undefined)
                    .find((s) => s.title === 'مشخصات ملک');
                  const f = specs?.fields.find((fd) => fd.key !== 'min_area' && fd.key !== 'max_area');
                  if (!f) return null;
                  const raw = f.key === 'min_rooms' ? firstPref('min_rooms') ?? c.bedrooms : firstPref(f.key);
                  let value: string | null = null;
                  if (f.type === 'checkbox') value = raw === true ? 'بله' : raw === false ? 'خیر' : null;
                  else if (f.type === 'select') {
                    const s = String(raw ?? '').trim();
                    value = s ? getFieldLabel(f.key, s) : null;
                  } else {
                    const n = num(raw);
                    if (n != null) {
                      const meters = ['frontage', 'land_area', 'building_area', 'min_land_area', 'min_hall_area', 'hall_area', 'road_width'].includes(f.key);
                      value = meters ? `${toPersianDigits(n)} متر` : toPersianDigits(n);
                    } else {
                      const s = String(raw ?? '').trim();
                      value = s || null;
                    }
                  }
                  const Icon = f.key === 'min_rooms' ? BedDouble
                    : ['floor', 'total_floors', 'units_per_floor'].includes(f.key) ? Building2
                    : Landmark;
                  return { label: f.label, value, icon: <Icon size={13} /> };
                })();
                const amenities: string[] = [];
                for (const pt of c.preferred_property_types ?? []) {
                  const prefs = (c.property_preferences?.[pt] ?? null) as unknown as Record<string, unknown> | null;
                  if (!prefs) continue;
                  const section = getFieldSections(pt, c.transaction_role ?? 'owner', c.transaction_intention ?? undefined).find((s) => s.title === 'امکانات');
                  if (!section) continue;
                  for (const f of section.fields) {
                    const value = prefs[f.key];
                    if (value === true) {
                      // نمایش به‌صورت اسم؛ پسوند پرسشی فرم («می‌خواهد؟/دارد؟») حذف شود
                      amenities.push(f.label.replace(/\s*(می‌خواهد|دارد)؟\s*$/, '').trim());
                    } else if (typeof value === 'string' && value !== '') amenities.push(getFieldLabel(f.key, value));
                  }
                }
                const amenitiesText = amenities.length > 0
                  ? [...new Set(amenities)].slice(0, 4).join('، ') + (amenities.length > 4 ? ' …' : '')
                  : null;
                const sourceLabel = c.lead_source
                  ? c.lead_source === 'colleague_transfer' && referringColleague
                    ? `${getContactSourceLabel(c.lead_source)} — ${referringColleague.name}`
                    : getContactSourceLabel(c.lead_source)
                  : null;
                const TxIcon = txStyle?.Icon;
                return (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedId(c.id); setView('detail'); }}
                    className="card p-4 pr-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    {/* ۱. نوع معامله — بج رنگی با آیکون */}
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold ${txStyle?.pill ?? 'bg-slate-100 text-slate-400'}`}>
                      {TxIcon && <TxIcon size={14} />}
                      {transactionLabel ?? 'ثبت نشده'}
                    </span>

                    {/* ۲. نام و شماره‌ها */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="text-base font-extrabold text-slate-900">{c.name}</p>
                      <span className="text-xs font-semibold text-slate-600" dir="ltr">{c.mobile}</span>
                      <CopyButton text={c.mobile} />
                      {c.secondary_phone && (
                        <>
                          <span className="text-xs font-semibold text-slate-600" dir="ltr">{c.secondary_phone}</span>
                          <CopyButton text={c.secondary_phone} />
                        </>
                      )}
                    </div>

                    {/* ۳. دسته‌بندی و نوع ملک (بج رنگی) + ۴. شهر */}
                    {(categoryLabel || typeLabels) && (
                      <span className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${txStyle?.pill ?? 'bg-slate-100 text-slate-700'}`}>
                        {[categoryLabel, typeLabels].filter(Boolean).join(' • ')}
                      </span>
                    )}
                    {cityText && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-600">
                        <MapPin size={12} className="text-slate-400" /> شهر: {cityText}
                      </p>
                    )}

                    {/* ۵ تا ۸. کاشی‌های آماری */}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <CardStat
                        icon={<Wallet size={13} />}
                        label={c.transaction_intention === 'rent' ? 'ودیعه / اجاره' : 'بودجه'}
                        value={
                          c.transaction_intention === 'rent'
                            ? (depositRange || rentRange
                                ? (<>
                                    {depositRange && <span className="block truncate">ودیعه: {depositRange}</span>}
                                    {rentRange && <span className="block truncate">اجاره: {rentRange}</span>}
                                  </>)
                                : null)
                            : budgetText
                        }
                        tint={txStyle?.icon}
                        valueClass={c.transaction_intention === 'rent' ? undefined : txStyle?.value}
                      />
                      <CardStat icon={<Ruler size={13} />} label="متراژ" value={areaText} tint={txStyle?.icon} />
                      {specTile && (
                        <CardStat
                          icon={specTile.icon}
                          label={specTile.label}
                          value={specTile.value}
                          tint={txStyle?.icon}
                        />
                      )}
                      <CardStat icon={<Sparkles size={13} />} label="امکانات" value={amenitiesText} tint={txStyle?.icon} />
                    </div>

                    {/* ۹. منبع آشنایی */}
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <Target size={12} className="shrink-0 text-slate-400" />
                      <span>
                        <span className="text-slate-500">منبع آشنایی:</span>{' '}
                        {sourceLabel ?? <span className="text-slate-300">ثبت نشده</span>}
                      </span>
                    </p>

                    {/* ۱۰. آخرین یادداشت */}
                    {c.notes && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                        <StickyNote size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{c.notes}</span>
                      </p>
                    )}

                    {/* ۱۱ و ۲. همکار معرف + آخرین تماس و پیگیری */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] font-medium text-slate-500">
                      {referringColleague && (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                          <UserPlus size={12} /> همکار معرف: {referringColleague.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} className="text-slate-400" /> آخرین تماس: {c.lastContact ? timeAgo(c.lastContact) : 'بدون تماس'}
                      </span>
                      {c.next_followup && (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                          <CalendarClock size={11} /> پیگیری: {formatDate(c.next_followup)}
                        </span>
                      )}
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

// Customer Detail Page
function CustomerDetail({ customerId, onBack, onEdit }: { customerId: string; onBack: () => void; onEdit: () => void }) {
  const colleagues = useColleagues();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'calls' | 'followups' | 'matches' | 'activity'>('info');
  const [showCallModal, setShowCallModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const [custRes, callsRes, fuRes, actRes, matchRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).maybeSingle(),
      supabase.from('calls').select('*, properties(title)').eq('customer_id', customerId).order('call_date', { ascending: false }).limit(20),
      supabase.from('follow_ups').select('*, properties(title)').eq('customer_id', customerId).order('due_date', { ascending: false }).limit(20),
      supabase.from('activities').select('*').eq('entity_type', 'customer').eq('entity_id', customerId).order('created_at', { ascending: false }).limit(10),
      supabase.from('property_matches').select('*, properties(id, title, transaction_type, category, sale_price, deposit_price, monthly_rent, land_area, building_area, bedrooms, parking, elevator)').eq('customer_id', customerId).order('score', { ascending: false }).limit(5),
    ]);
    setCustomer(custRes.data as Customer);
    setCalls(callsRes.data ?? []);
    setFollowups(fuRes.data ?? []);
    setActivities(actRes.data ?? []);
    setMatches(matchRes.data ?? []);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleDelete = async () => {
    await supabase.from('customers').delete().eq('id', customerId);
    onBack();
  };

  if (loading || !customer) {
    return <div className="flex justify-center py-16"><Spinner size={32} /></div>;
  }

  const customerPreferences = customer.property_preferences as Record<string, unknown> | null;
  const custAddress = (customerPreferences?.address as string) || customer.address || '';
  const referringColleague = colleagues.find((colleague) => colleague.id === customerPreferences?.colleague_id);

  const temp = getTemperatureInfo(customer.temperature);
  const status = getStatusInfo(CUSTOMER_STATUSES, customer.status);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Back Button */}
      <button onClick={onBack} className="detail-back">
        <ArrowLeft size={16} />
        بازگشت
      </button>

      {/* Customer Header */}
      <div className="detail-hero detail-hero-orange">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-orange-600"><Users size={14} /> پرونده مشتری</p>
        <div className="flex items-start gap-4">
          <div className={`detail-avatar ${
            customer.temperature === 'hot' ? 'bg-red-100 text-red-600' :
            customer.temperature === 'warm' ? 'bg-orange-100 text-orange-600' :
            'bg-blue-100 text-blue-600'
          }`}>
            {customer.name?.[0] ?? '؟'}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-extrabold text-slate-800">{customer.name}</h2>
              <Badge color={temp.color}>{temp.icon} {temp.label}</Badge>
              <Badge color={status.color}>{status.label}</Badge>
            </div>
            <p className="text-sm text-slate-500" dir="ltr">{customer.mobile}</p>
            {customer.secondary_phone && <p className="text-xs text-slate-400" dir="ltr">{customer.secondary_phone}</p>}
            {custAddress && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span>{custAddress}</span>
              </p>
            )}
          </div>
        </div>

        {referringColleague && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">
            این مشتری توسط همکار «{referringColleague.name}» معرفی شده است.
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 mt-5 flex-wrap border-t border-slate-200/70 pt-4">
          <a href={`tel:${normalizePhone(customer.mobile)}`} className="btn-primary">
            <Phone size={16} /> تماس
          </a>
          <button onClick={() => setShowCallModal(true)} className="btn-secondary">
            ثبت تماس
          </button>
          <button onClick={() => setShowFollowupModal(true)} className="btn-secondary">
            پیگیری
          </button>
          <button onClick={onEdit} className="btn-secondary">
            <Pencil size={16} /> ویرایش مشتری
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger" aria-label="حذف مشتری">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs no-scrollbar">
        {[
          { key: 'info', label: 'اطلاعات' },
          { key: 'calls', label: 'تماس‌ها' },
          { key: 'followups', label: 'پیگیری‌ها' },
          { key: 'matches', label: 'تطبیق‌ها' },
          { key: 'activity', label: 'فعالیت‌ها' },
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

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="detail-section space-y-5">
          <h3 className="detail-section-title"><Target size={17} className="text-orange-500" /> نیازها و ترجیحات مشتری</h3>
          <div className="detail-info-grid">
            <InfoField label="نوع معامله" value={customer.transaction_intention ? getTransactionLabel(customer.transaction_intention) : '-'} />
            <InfoField label="دسته‌بندی" value={customer.preferred_category ? getCategoryLabel(customer.preferred_category) : '-'} />
            <InfoField label="انواع ملک مورد نظر" value={customer.preferred_property_types?.length
              ? customer.preferred_property_types.map((pt) => PROPERTY_TYPES[customer.preferred_category!]?.find((p) => p.value === pt)?.label ?? pt).join('، ')
              : '-'} />
            <InfoField label="فوریت" value={URGENCY_LEVELS.find(u => u.value === customer.urgency)?.label ?? '-'} />
            <InfoField
              label="منبع"
              value={customer.lead_source
                ? customer.lead_source === 'colleague_transfer' && referringColleague
                  ? `${getContactSourceLabel(customer.lead_source)} — ${referringColleague.name}`
                  : getContactSourceLabel(customer.lead_source)
                : '-'}
            />
            <InfoField label="آخرین تماس" value={customer.last_contact ? timeAgo(customer.last_contact) : '-'} />
            <InfoField label="پیگیری بعدی" value={customer.next_followup ? formatDate(customer.next_followup) : '-'} />
          </div>

          {/* Dynamic property preferences */}
          {customer.property_preferences && Object.keys(customer.property_preferences).length > 0 && (
            <CustomerPrefsDisplay prefs={customer.property_preferences} category={customer.preferred_category} propertyTypes={customer.preferred_property_types} role={customer.transaction_role} transactionIntention={customer.transaction_intention} />
          )}

          {customer.notes && (
            <div>
              <p className="label">یادداشت</p>
              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{customer.notes}</p>
            </div>
          )}
          {customer.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map((tag, i) => <Badge key={i} color="blue">{tag}</Badge>)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'calls' && (
        calls.length > 0 ? (
          <div className="space-y-3">{calls.map((call) => <CallRecordCard key={call.id} call={call} targetName={customer.name} />)}</div>
        ) : <EmptyState icon={<Phone size={36} />} title="تماسی ثبت نشده" />
      )}

      {activeTab === 'followups' && (
        followups.length > 0 ? (
          <div className="space-y-3">{followups.map((item) => <FollowupRecordCard key={item.id} followup={item} targetName={customer.name} onChanged={loadDetail} />)}</div>
        ) : <EmptyState icon={<Clock size={36} />} title="پیگیری‌ای ثبت نشده" />
      )}

      {activeTab === 'matches' && (
        <div className="space-y-3">
          {matches.length > 0 ? (
            matches.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-800">{m.properties?.title ?? 'فایل'}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: m.score >= 80 ? '#16a34a' : m.score >= 60 ? '#f97316' : '#64748b' }}>
                      {m.score}%
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{m.properties ? getTransactionLabel(m.properties.transaction_type) : ''} • {m.properties ? getCategoryLabel(m.properties.category) : ''}</p>
                {m.properties?.sale_price != null && <p className="text-xs text-slate-500 mt-1">{formatPrice(m.properties.sale_price)} ت</p>}
              </div>
            ))
          ) : (
            <EmptyState icon={<Target size={36} />} title="تطبیقی یافت نشده" description="با ثبت فایل‌های جدید، تطبیق‌ها به‌صورت خودکار محاسبه می‌شوند" />
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="card overflow-hidden">
          {activities.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {activities.map((act) => (
                <div key={act.id} className="px-5 py-3">
                  <p className="text-sm text-slate-700">{act.description ?? act.action}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(act.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="فعالیتی ثبت نشده" />
          )}
        </div>
      )}

      {/* Modals */}
      {showCallModal && (
        <CallFormModal customerId={customerId} customerName={customer.name} allowPropertySelection onClose={() => setShowCallModal(false)} onSaved={loadDetail} />
      )}
      {showFollowupModal && (
        <FollowupFormModal customerId={customerId} customerName={customer.name} allowPropertySelection onClose={() => setShowFollowupModal(false)} onSaved={loadDetail} />
      )}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="حذف مشتری"
        message="آیا از حذف این مشتری مطمئن هستید؟ این عمل قابل بازگشت نیست."
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
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

// Customer Preferences Display - shows dynamic property preferences
function CustomerPrefsDisplay({ prefs, category, propertyTypes, role, transactionIntention }: {
  prefs: Record<string, string | number | boolean | string[] | null>;
  category: string | null;
  propertyTypes: string[] | null;
  role: string | null;
  transactionIntention: string | null;
}) {
  const { counties: allCounties } = useActiveCounties();
  const { neighborhoods: rkNeighborhoods } = useCountyNeighborhoods(
    allCounties.find((c) => c.name === ROBAT_KARIM_COUNTY_NAME)?.id ?? null,
  );
  const countyName = (id?: string) => allCounties.find((c) => c.id === id)?.name;
  const nbhName = (id?: string) => rkNeighborhoods.find((n) => n.id === id)?.name;

  if (!prefs || Object.keys(prefs).length === 0) return null;
  const types = propertyTypes ?? [];
  const r = role ?? 'buyer';

  // Extract location info
  const loc = prefs.location as { county_id?: string; neighborhood_id?: string } | undefined;
  const hasLocation = loc && (loc.county_id || loc.neighborhood_id);

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      {hasLocation && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">موقعیت</p>
          <p className="text-sm text-slate-700">
            {[countyName(loc?.county_id), nbhName(loc?.neighborhood_id)].filter(Boolean).join('، ') || '-'}
          </p>
        </div>
      )}

      {types.map((pt) => {
        const typePrefs = prefs[pt] as unknown as Record<string, string | boolean> | undefined;
        if (!typePrefs || Object.keys(typePrefs).length === 0) return null;
        const typeLabel = category ? PROPERTY_TYPES[category]?.find((p) => p.value === pt)?.label ?? pt : pt;
        const sections = getFieldSections(pt, r, transactionIntention ?? undefined);

        return (
          <div key={pt} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-700 mb-2">{typeLabel}</p>
            {sections.map((section, si) => {
              const sectionFields = section.fields.filter((f) => f.type !== 'location');
              const filledFields = sectionFields.filter((f) => typePrefs[f.key] !== undefined && typePrefs[f.key] !== '' && typePrefs[f.key] !== false);
              if (filledFields.length === 0) return null;
              return (
                <div key={si} className="mb-2">
                  <p className="text-xs text-slate-400 mb-1">{section.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {filledFields.map((f) => {
                      const val = typePrefs[f.key];
                      const display = f.type === 'checkbox'
                        ? (val ? 'دارد' : '-')
                        : f.type === 'select'
                          ? getFieldLabel(f.key, val as string)
                          : String(val);
                      return <InfoField key={f.key} label={f.label} value={display} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Location Selector Component
function LocationSelector({ value, onChange }: { value: { county_id: string; neighborhood_id: string }; onChange: (v: { county_id: string; neighborhood_id: string }) => void }) {
  const { counties } = useActiveCounties();
  const selectedCounty = counties.find((c) => c.id === value.county_id);
  const isRobatKarim = selectedCounty?.name === ROBAT_KARIM_COUNTY_NAME;
  const { neighborhoods } = useCountyNeighborhoods(isRobatKarim ? value.county_id : null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="label">شهرستان</label>
        <select
          className="input"
          value={value.county_id}
          onChange={(e) => onChange({ county_id: e.target.value, neighborhood_id: '' })}
        >
          <option value="">انتخاب کنید</option>
          {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {isRobatKarim && (
        <div>
          <label className="label">محله</label>
          <select
            className="input"
            value={value.neighborhood_id}
            onChange={(e) => onChange({ ...value, neighborhood_id: e.target.value })}
          >
            <option value="">انتخاب کنید</option>
            {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// Dynamic Field Renderer
function DynamicField({ field, value, onChange }: { field: FieldDef; value: string | boolean; onChange: (v: string | boolean) => void }) {
  if (field.type === 'checkbox') {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`p-2 rounded-lg border-2 text-xs font-medium transition-all text-center ${
          value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {field.label}
      </button>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="label">{field.label}</label>
        <select className="input" value={value as string} onChange={(e) => onChange(e.target.value)}>
          <option value="">انتخاب کنید</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (field.label.includes('تومان')) {
    return (
      <div>
        <label className="label">{field.label}</label>
        <MoneyInput value={value as string} onChange={onChange} placeholder={field.placeholder} />
      </div>
    );
  }

  return (
    <div>
      <label className="label">{field.label}</label>
      <input
        className="input"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        dir={field.ltr ? 'ltr' : undefined}
      />
    </div>
  );
}

// Property Type Preferences Section
function PropertyTypePrefs({ propertyType, propertyTypeLabel, role, transactionType, prefs, onChange }: {
  propertyType: string;
  propertyTypeLabel: string;
  role: string;
  transactionType: string;
  prefs: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}) {
  const sections = getFieldSections(propertyType, role, transactionType);

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50/50">
      <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
        {propertyTypeLabel}
      </h4>
      {sections.map((section, si) => (
        <div key={si} className="space-y-2">
          <p className="text-xs font-medium text-slate-500">{section.title}</p>
          {section.fields.some((f) => f.type === 'location') ? null : (
            <div className="grid grid-cols-2 gap-3">
              {section.fields.map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={prefs[field.key] ?? (field.type === 'checkbox' ? false : '')}
                  onChange={(v) => onChange(field.key, v)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
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

// Customer create/edit form
function CustomerForm({ customerId, onBack, onSaved }: { customerId?: string; onBack: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const colleagues = useColleagues();
  const isEditing = Boolean(customerId);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(Boolean(customerId));
  const [saveError, setSaveError] = useState('');
  const [editingStatus, setEditingStatus] = useState<Customer['status']>('active');
  const [editingConsultantId, setEditingConsultantId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    secondary_phone: '',
    transaction_intention: '',
    transaction_role: '',
    preferred_category: '',
    preferred_property_types: [] as string[],
    urgency: 'normal',
    temperature: 'warm',
    lead_source: '',
    notes: '',
  });
  const [location, setLocation] = useState({ county_id: '', neighborhood_id: '' });
  const [address, setAddress] = useState('');
  const [colleagueId, setColleagueId] = useState('');
  const [typePrefs, setTypePrefs] = useState<Record<string, Record<string, string | boolean>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const loadCustomerForEdit = async () => {
      setFormLoading(true);
      const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSaveError(error?.message ?? 'اطلاعات مشتری برای ویرایش پیدا نشد.');
        setFormLoading(false);
        return;
      }
      const preferences = (data.property_preferences ?? {}) as Record<string, unknown>;
      const savedLocation = preferences.location as { county_id?: string; neighborhood_id?: string } | undefined;
      const savedTypePrefs: Record<string, Record<string, string | boolean>> = {};
      for (const [key, value] of Object.entries(preferences)) {
        if (key !== 'location' && key !== 'address' && value && typeof value === 'object' && !Array.isArray(value)) {
          savedTypePrefs[key] = value as Record<string, string | boolean>;
        }
      }
      setForm({
        name: data.name ?? [data.first_name, data.last_name].filter(Boolean).join(' '),
        mobile: data.mobile ?? '',
        secondary_phone: data.secondary_phone ?? '',
        transaction_intention: data.transaction_intention ?? '',
        transaction_role: data.transaction_role ?? '',
        preferred_category: data.preferred_category ?? '',
        preferred_property_types: Array.isArray(data.preferred_property_types) ? data.preferred_property_types : [],
        urgency: data.urgency ?? 'normal',
        temperature: data.temperature ?? 'warm',
        lead_source: data.lead_source ?? '',
        notes: data.notes ?? '',
      });
      setLocation({
        county_id: savedLocation?.county_id ?? '',
        neighborhood_id: savedLocation?.neighborhood_id ?? '',
      });
      setAddress((preferences.address as string) ?? data.address ?? '');
      setColleagueId((preferences.colleague_id as string) ?? '');
      setTypePrefs(savedTypePrefs);
      setEditingStatus((data.status as Customer['status']) ?? 'active');
      setEditingConsultantId(data.assigned_consultant_id ?? null);
      setFormLoading(false);
    };
    loadCustomerForEdit();
    return () => { cancelled = true; };
  }, [customerId]);

  const steps = [
    { title: 'اطلاعات تماس' },
    { title: 'نوع معامله' },
    { title: 'دسته‌بندی و نوع ملک' },
    { title: 'مشخصات و ترجیحات' },
    { title: 'اولویت و فوریت' },
  ];

  const validateStep = () => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!form.name.trim()) errs.name = 'نام الزامی است';
      if (!form.mobile.trim()) errs.mobile = 'موبایل الزامی است';
      else if (!validatePhone(form.mobile)) errs.mobile = 'فرمت موبایل صحیح نیست (09123456789)';
    }
    if (step === 2 && !form.preferred_category) errs.preferred_category = 'دسته‌بندی الزامی است';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) setStep(Math.min(step + 1, steps.length - 1));
  };

  const setTypePref = (type: string, key: string, value: string | boolean) => {
    setTypePrefs((prev) => ({
      ...prev,
      [type]: { ...(prev[type] ?? {}), [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!validateStep()) return;
    if (form.lead_source === 'colleague_transfer' && !colleagueId) {
      setSaveError('منبع «انتقال از همکار» انتخاب شده؛ لطفاً همکار را مشخص کنید.');
      return;
    }
    setSaving(true);
    setSaveError('');

    const propertyPreferences: Record<string, unknown> = {};
    if (location.county_id || location.neighborhood_id) {
      propertyPreferences.location = location;
    }
    if (address.trim()) {
      propertyPreferences.address = address.trim();
    }
    if (colleagueId) {
      propertyPreferences.colleague_id = colleagueId;
    }
    for (const type of form.preferred_property_types) {
      const prefs = typePrefs[type] ?? {};
      const cleaned: Record<string, string | boolean> = {};
      for (const [key, value] of Object.entries(prefs)) {
        if (value !== '' && value !== false) cleaned[key] = value;
      }
      if (Object.keys(cleaned).length > 0) propertyPreferences[type] = cleaned;
    }

    // ستون‌های قدیمی first_name/last_name در دیتابیس NOT NULL هستند و رکوردهای
    // تماس/پیگیری نام مشتری را از همین ستون‌ها می‌خوانند؛ برای جلوگیری از
    // خطا و نمایش خالی، همیشه همگام با نام کامل نگه‌داشته می‌شوند.
    const nameParts = form.name.trim().split(/\s+/).filter(Boolean);
    const payload = {
      name: form.name,
      first_name: nameParts[0] ?? form.name.trim(),
      last_name: nameParts.slice(1).join(' ') || null,
      mobile: normalizePhone(form.mobile),
      secondary_phone: form.secondary_phone ? normalizePhone(form.secondary_phone) : null,
      transaction_intention: form.transaction_intention || null,
      transaction_role: form.transaction_role || null,
      preferred_category: form.preferred_category || null,
      preferred_property_types: form.preferred_property_types.length ? form.preferred_property_types : null,
      property_preferences: propertyPreferences,
      urgency: form.urgency,
      temperature: form.temperature,
      lead_source: form.lead_source || null,
      notes: form.notes || null,
      assigned_consultant_id: editingConsultantId || user?.id,
      status: editingStatus,
    };
    const { data, error } = isEditing && customerId
      ? await supabase.from('customers').update(payload).eq('id', customerId).select().single()
      : await supabase.from('customers').insert(payload).select().single();

    if (error || !data) {
      setSaveError(error?.message ?? 'ذخیره مشتری انجام نشد.');
      setSaving(false);
      return;
    }
    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'customer',
      entity_id: data.id,
      action: isEditing ? 'customer_updated' : 'customer_created',
      description: isEditing ? `مشتری ${form.name} ویرایش شد` : `مشتری جدید ${form.name} ثبت شد`,
    });
    setSaving(false);
    onSaved();
  };

  const togglePropertyType = (value: string) => {
    setForm((f) => ({
      ...f,
      preferred_property_types: f.preferred_property_types.includes(value)
        ? f.preferred_property_types.filter((v) => v !== value)
        : [...f.preferred_property_types, value],
    }));
  };

  const roleLabels: Record<string, string> = { buyer: 'متقاضی', owner: 'مالک هستم', applicant: 'متقاضی هستم', builder: 'سازنده هستم', seller: 'مالک' };

  if (formLoading) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> بازگشت
      </button>

      <PageHeader title={isEditing ? 'ویرایش مشتری' : 'مشتری جدید'} subtitle={`مرحله ${step + 1} از ${steps.length}: ${steps[step].title}`} />

      {/* Progress Bar / step jump in edit mode */}
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
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-slate-900' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      )}

      <div className="card p-5 space-y-4">
        {step === 0 && (
          <>
            <div>
              <label className="label">نام و نام خانوادگی *</label>
              <input className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام و نام خانوادگی مشتری" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="label">موبایل *</label>
              <input className={`input ${errors.mobile ? 'input-error' : ''}`} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: stripPhoneSpaces(e.target.value) })} placeholder="09123456789" dir="ltr" />
              {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
            </div>
            <div>
              <label className="label">تلفن ثانویه</label>
              <input className="input" value={form.secondary_phone} onChange={(e) => setForm({ ...form, secondary_phone: stripPhoneSpaces(e.target.value) })} placeholder="02112345678" dir="ltr" />
            </div>
            <div>
              <label className="label">آدرس کامل</label>
              <textarea className="input min-h-[70px]" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="آدرس کامل مشتری..." />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <StepSummary items={[
              ...(form.name ? [{ label: 'نام', value: form.name }] : []),
              ...(form.mobile ? [{ label: 'موبایل', value: form.mobile }] : []),
            ]} />
            <div>
              <label className="label">نوع معامله</label>
              <div className="grid grid-cols-2 gap-2">
                {TRANSACTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setForm({ ...form, transaction_intention: t.value })}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      form.transaction_intention === t.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {form.transaction_intention && (
              <div>
                <label className="label">نقش در معامله</label>
                <div className="grid grid-cols-2 gap-2">
                  {(TRANSACTION_TYPES.find(t => t.value === form.transaction_intention)?.roles ?? []).map((r: string) => (
                    <button
                      key={r}
                      onClick={() => setForm({ ...form, transaction_role: r })}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        form.transaction_role === r ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {roleLabels[r] ?? r}
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
              ...(form.name ? [{ label: 'نام', value: form.name }] : []),
              ...(form.mobile ? [{ label: 'موبایل', value: form.mobile }] : []),
              ...(form.transaction_intention ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_intention) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: roleLabels[form.transaction_role] ?? form.transaction_role }] : []),
            ]} />
            <div>
              <label className="label">دسته‌بندی *</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, preferred_category: c.value, preferred_property_types: [] })}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      form.preferred_category === c.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {errors.preferred_category && <p className="text-xs text-red-500 mt-1">{errors.preferred_category}</p>}
            </div>
            {form.preferred_category && (
              <div>
                <label className="label">نوع ملک</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(PROPERTY_TYPES[form.preferred_category] ?? []).map((p) => (
                    <button
                      key={p.value}
                      onClick={() => togglePropertyType(p.value)}
                      className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        form.preferred_property_types.includes(p.value) ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <StepSummary items={[
              ...(form.name ? [{ label: 'نام', value: form.name }] : []),
              ...(form.mobile ? [{ label: 'موبایل', value: form.mobile }] : []),
              ...(form.transaction_intention ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_intention) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: roleLabels[form.transaction_role] ?? form.transaction_role }] : []),
              ...(form.preferred_category ? [{ label: 'دسته‌بندی', value: getCategoryLabel(form.preferred_category) }] : []),
              ...(form.preferred_property_types.length ? [{ label: 'انواع ملک', value: form.preferred_property_types.map((pt) => PROPERTY_TYPES[form.preferred_category]?.find((p) => p.value === pt)?.label ?? pt).join('، ') }] : []),
            ]} />
            {form.preferred_property_types.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">لطفاً در مرحله قبل حداقل یک نوع ملک انتخاب کنید</p>
            ) : (
              <>
                {/* Location - shared across all types */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">موقعیت (مشترک)</p>
                  <LocationSelector value={location} onChange={setLocation} />
                </div>

                {/* Per-type preferences */}
                {form.preferred_property_types.map((pt) => {
                  const typeLabel = PROPERTY_TYPES[form.preferred_category]?.find((p) => p.value === pt)?.label ?? pt;
                  return (
                    <PropertyTypePrefs
                      key={pt}
                      propertyType={pt}
                      propertyTypeLabel={typeLabel}
                      role={form.transaction_role || 'buyer'}
                      transactionType={form.transaction_intention || 'buy'}
                      prefs={typePrefs[pt] ?? {}}
                      onChange={(key, value) => setTypePref(pt, key, value)}
                    />
                  );
                })}
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <StepSummary items={[
              ...(form.name ? [{ label: 'نام', value: form.name }] : []),
              ...(form.mobile ? [{ label: 'موبایل', value: form.mobile }] : []),
              ...(form.transaction_intention ? [{ label: 'نوع معامله', value: getTransactionLabel(form.transaction_intention) }] : []),
              ...(form.transaction_role ? [{ label: 'نقش', value: roleLabels[form.transaction_role] ?? form.transaction_role }] : []),
              ...(form.preferred_category ? [{ label: 'دسته‌بندی', value: getCategoryLabel(form.preferred_category) }] : []),
              ...(form.preferred_property_types.length ? [{ label: 'انواع ملک', value: form.preferred_property_types.map((pt) => PROPERTY_TYPES[form.preferred_category]?.find((p) => p.value === pt)?.label ?? pt).join('، ') }] : []),
            ]} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">فوریت</label>
                <select className="input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                  <option value="low">کم</option>
                  <option value="normal">عادی</option>
                  <option value="high">زیاد</option>
                  <option value="critical">فوری</option>
                </select>
              </div>
              <div>
                <label className="label">دمای مشتری</label>
                <select className="input" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })}>
                  <option value="hot">داغ</option>
                  <option value="warm">گرم</option>
                  <option value="cold">سرد</option>
                </select>
              </div>
              <div>
                <label className="label">منبع آشنایی</label>
                <select className="input" value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })}>
                  <option value="">ثبت نشده</option>
                  {form.lead_source && !CONTACT_SOURCES.some((s) => s.value === form.lead_source) && (
                    <option value={form.lead_source}>{form.lead_source}</option>
                  )}
                  {CONTACT_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">یادداشت</label>
              <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="توضیحات اضافی..." />
            </div>
            <div>
              <label className="label">
                {form.lead_source === 'colleague_transfer'
                  ? 'کدام همکار؟ *'
                  : <><span>همکار معرف</span> <span className="font-normal text-slate-400">(اختیاری)</span></>}
              </label>
              <select className="input" value={colleagueId} onChange={(e) => setColleagueId(e.target.value)}>
                <option value="">{form.lead_source === 'colleague_transfer' ? 'همکار را انتخاب کنید' : 'این مشتری متعلق به خودم است'}</option>
                {colleagues.map((colleague) => (
                  <option key={colleague.id} value={colleague.id} disabled={colleague.status === 'inactive' && colleague.id !== colleagueId}>
                    {colleague.name}{colleague.agency_name ? ` — ${colleague.agency_name}` : ''}{colleague.status === 'inactive' ? ' (غیرفعال)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {isEditing && (
              <div>
                <label className="label">وضعیت مشتری</label>
                <select className="input" value={editingStatus} onChange={(e) => setEditingStatus(e.target.value as Customer['status'])}>
                  {CUSTOMER_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>
            )}
          </>
        )}

        {saveError && <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{saveError}</div>}

        {/* Navigation Buttons */}
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
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
                  مرحله قبل
                </button>
              )}
              {step < steps.length - 1 ? (
                <button onClick={handleNext} className="btn-primary flex-1">
                  مرحله بعد
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'در حال ذخیره...' : 'ثبت مشتری'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
