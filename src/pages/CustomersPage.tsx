import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Search, Flame, Users, Phone, X, Filter, ArrowLeft, Trash2, Tag, Clock, Target, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  TEMPERATURES,
  CUSTOMER_STATUSES,
  URGENCY_LEVELS,
  TRANSACTION_TYPES,
  CATEGORIES,
  PROPERTY_TYPES,
  formatPrice,
  formatDate,
  formatMoneyShort,
  timeAgo,
  getTemperatureInfo,
  getStatusInfo,
  getTransactionLabel,
  getCategoryLabel,
  normalizePhone,
  validatePhone,
  toEnglishDigits,
  TEHRAN_PROVINCE_ID,
  ACTIVE_COUNTY_NAMES,
  ROBAT_KARIM_COUNTY_NAME,
  ROBAT_KARIM_NEIGHBORHOODS,
} from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader, Pagination, ConfirmDialog, CopyButton, SortSelect } from '@/components/ui';
import { useActiveCounties, useCountyNeighborhoods } from '@/lib/geo';
import type { Customer } from '@/lib/types';
import { getFieldSections, getFieldLabel, type FieldDef } from '@/lib/propertyFields';

const PAGE_SIZE = 20;

type CustomerRow = Customer & { calls?: { call_date: string }[] | null };

const INTENTION_COLORS: Record<string, string> = { buy: 'blue', rent: 'purple', partnership: 'teal', sell: 'orange' };

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
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
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
    if (filters.urgency) rows = rows.filter((c) => c.urgency === filters.urgency);

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

  if (view === 'detail' && selectedId) {
    return <CustomerDetail customerId={selectedId} onBack={() => { setView('list'); setSelectedId(null); }} />;
  }

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

      {/* Search & Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pr-10"
            placeholder="جستجو با نام یا شماره..."
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary ${Object.values(filters).some(Boolean) ? 'bg-slate-200' : ''}`}
        >
          <Filter size={18} />
        </button>
      </div>

      <SortSelect value={sortKey} options={CUSTOMER_SORTS} onChange={(v) => { setSortKey(v); setPage(1); }} />

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
          </div>
          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => { setFilters({ temperature: '', status: '', transaction_intention: '', urgency: '' }); setPage(1); }}
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
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {pageItems.map((c) => {
                const temp = getTemperatureInfo(c.temperature);
                const status = getStatusInfo(CUSTOMER_STATUSES, c.status);
                const urgencyInfo = URGENCY_LEVELS.find(u => u.value === c.urgency);
                const typeLabels = c.preferred_property_types?.length
                  ? c.preferred_property_types.slice(0, 2).map((pt) => PROPERTY_TYPES[c.preferred_category!]?.find((p) => p.value === pt)?.label ?? pt).join('، ')
                  : null;
                const budgetText = c.budget_min != null && c.budget_max != null
                  ? `${formatMoneyShort(c.budget_min)} تا ${formatMoneyShort(c.budget_max)}`
                  : c.budget_max != null
                    ? `تا ${formatMoneyShort(c.budget_max)}`
                    : c.budget_min != null
                      ? `از ${formatMoneyShort(c.budget_min)}`
                      : null;
                return (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedId(c.id); setView('detail'); }}
                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        c.temperature === 'hot' ? 'bg-red-100 text-red-600' :
                        c.temperature === 'warm' ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {c.name?.[0] ?? '؟'}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                          {c.temperature === 'hot' && <Flame size={14} className="text-red-500 flex-shrink-0" />}
                          {urgencyInfo && c.urgency === 'critical' && <span className="text-xs text-red-500 font-medium">فوری</span>}
                        </div>
                        <div className="flex items-center gap-0.5 text-xs text-slate-400">
                          <span dir="ltr">{c.mobile}</span>
                          <CopyButton text={c.mobile} />
                          <span className="text-slate-300 mx-1">•</span>
                          <span className={c.lastContact ? 'text-slate-500' : 'text-slate-400'}>
                            آخرین تماس: {c.lastContact ? timeAgo(c.lastContact) : 'بدون تماس'}
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px]">
                          {budgetText && <span className="text-slate-600 font-medium">بودجه: {budgetText}</span>}
                          {budgetText && c.preferred_category && <span className="text-slate-300">•</span>}
                          {c.preferred_category && <span className="text-slate-500">{getCategoryLabel(c.preferred_category)}</span>}
                          {typeLabels && <><span className="text-slate-300">•</span><span className="truncate text-slate-500">{typeLabels}</span></>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {c.temperature && <Badge color={temp.color}>{temp.icon} {temp.label}</Badge>}
                        {c.transaction_intention && <Badge color={INTENTION_COLORS[c.transaction_intention] ?? 'gray'}>{getTransactionLabel(c.transaction_intention)}</Badge>}
                        {c.next_followup && <Badge color="orange">پیگیری: {formatDate(c.next_followup)}</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// Customer Detail Page
function CustomerDetail({ customerId, onBack }: { customerId: string; onBack: () => void }) {
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
      supabase.from('calls').select('*').eq('customer_id', customerId).order('call_date', { ascending: false }).limit(10),
      supabase.from('follow_ups').select('*').eq('customer_id', customerId).order('due_date', { ascending: false }).limit(10),
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

  const custAddress = ((customer.property_preferences as Record<string, unknown> | null)?.address as string) || customer.address || '';

  const temp = getTemperatureInfo(customer.temperature);
  const status = getStatusInfo(CUSTOMER_STATUSES, customer.status);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Back Button */}
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        بازگشت
      </button>

      {/* Customer Header */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
            customer.temperature === 'hot' ? 'bg-red-100 text-red-600' :
            customer.temperature === 'warm' ? 'bg-orange-100 text-orange-600' :
            'bg-blue-100 text-blue-600'
          }`}>
            {customer.name?.[0] ?? '؟'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-800">{customer.name}</h2>
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

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <a href={`tel:${normalizePhone(customer.mobile)}`} className="btn-primary">
            <Phone size={16} /> تماس
          </a>
          <button onClick={() => setShowCallModal(true)} className="btn-secondary">
            ثبت تماس
          </button>
          <button onClick={() => setShowFollowupModal(true)} className="btn-secondary">
            پیگیری
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
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
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="نوع معامله" value={customer.transaction_intention ? getTransactionLabel(customer.transaction_intention) : '-'} />
            <InfoField label="دسته‌بندی" value={customer.preferred_category ? getCategoryLabel(customer.preferred_category) : '-'} />
            <InfoField label="انواع ملک مورد نظر" value={customer.preferred_property_types?.length
              ? customer.preferred_property_types.map((pt) => PROPERTY_TYPES[customer.preferred_category!]?.find((p) => p.value === pt)?.label ?? pt).join('، ')
              : '-'} />
            <InfoField label="فوریت" value={URGENCY_LEVELS.find(u => u.value === customer.urgency)?.label ?? '-'} />
            <InfoField label="منبع" value={customer.lead_source ?? '-'} />
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
        <div className="card overflow-hidden">
          {calls.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {calls.map((call) => (
                <div key={call.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{call.result ?? 'تماس'}</span>
                    <span className="text-xs text-slate-400">{timeAgo(call.call_date)}</span>
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
                    {fu.status === 'completed' ? 'انجام شده' : fu.status === 'pending' ? 'در انتظار' : fu.status === 'missed' ? 'عقب‌افتاده' : 'لغو'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Clock size={36} />} title="پیگیری‌ای ثبت نشده" />
          )}
        </div>
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
        <CallModal customerId={customerId} customerName={customer.name} onClose={() => setShowCallModal(false)} onSaved={loadDetail} />
      )}
      {showFollowupModal && (
        <FollowupModal customerId={customerId} onClose={() => setShowFollowupModal(false)} onSaved={loadDetail} />
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
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-sm text-slate-700 mt-0.5">{value}</p>
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
    ROBAT_KARIM_NEIGHBORHOODS,
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

// Call Modal
function CallModal({ customerId, customerName, onClose, onSaved }: { customerId: string; customerName: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('calls').insert({
      customer_id: customerId,
      consultant_id: user?.id,
      call_date: new Date().toISOString(),
      result: result || null,
      notes,
      next_action: nextAction || null,
      next_followup: nextFollowup || null,
    });
    if (nextFollowup) {
      await supabase.from('customers').update({ last_contact: new Date().toISOString(), next_followup: nextFollowup }).eq('id', customerId);
    } else {
      await supabase.from('customers').update({ last_contact: new Date().toISOString() }).eq('id', customerId);
    }
    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'customer',
      entity_id: customerId,
      action: 'call_recorded',
      description: `تماس با ${customerName} - ${result || 'ثبت شد'}`,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal open={true} onClose={onClose} title={`ثبت تماس با ${customerName}`}>
      <div className="space-y-4">
        <div>
          <label className="label">نتیجه تماس</label>
          <select className="input" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">انتخاب کنید...</option>
            {[
              { value: 'answered', label: 'پاسخ داد' },
              { value: 'no_answer', label: 'پاسخ نداد' },
              { value: 'interested', label: 'علاقه‌مند است' },
              { value: 'needs_review', label: 'نیاز به بررسی دارد' },
              { value: 'introduced', label: 'فایل مناسب معرفی شد' },
              { value: 'viewing_scheduled', label: 'بازدید تعیین شد' },
              { value: 'deal_done', label: 'معامله انجام شد' },
              { value: 'disinterested', label: 'فعلاً منصرف شد' },
              { value: 'wrong_number', label: 'شماره اشتباه' },
              { value: 'needs_followup', label: 'نیازمند پیگیری' },
            ].map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">یادداشت</label>
          <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="جزئیات تماس..." />
        </div>
        <div>
          <label className="label">اقدام بعدی</label>
          <input className="input" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="مثلا: ارسال پیامک فایل" />
        </div>
        <div>
          <label className="label">زمان پیگیری بعدی</label>
          <input type="date" className="input" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? 'در حال ذخیره...' : 'ذخیره'}
        </button>
      </div>
    </Modal>
  );
}

// Followup Modal
function FollowupModal({ customerId, onClose, onSaved }: { customerId: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('follow_ups').insert({
      entity_type: 'customer',
      entity_id: customerId,
      customer_id: customerId,
      reason: reason || null,
      due_date: dueDate,
      due_time: dueTime || null,
      priority,
      notes: notes || null,
      assigned_consultant_id: user?.id,
      status: 'pending',
    });
    await supabase.from('customers').update({ next_followup: dueDate }).eq('id', customerId);
    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'customer',
      entity_id: customerId,
      action: 'followup_created',
      description: `پیگیری جدید برای ${formatDate(dueDate)}`,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal open={true} onClose={onClose} title="ایجاد پیگیری">
      <div className="space-y-4">
        <div>
          <label className="label">دلیل پیگیری</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلا: تماس برای فایل جدید" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">تاریخ</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">ساعت</label>
            <input type="time" className="input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">اولویت</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">کم</option>
            <option value="normal">عادی</option>
            <option value="high">زیاد</option>
            <option value="critical">فوری</option>
          </select>
        </div>
        <div>
          <label className="label">یادداشت</label>
          <textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button onClick={handleSave} disabled={saving || !dueDate} className="btn-primary w-full">
          {saving ? 'در حال ذخیره...' : 'ذخیره'}
        </button>
      </div>
    </Modal>
  );
}

// Location Selector Component
function LocationSelector({ value, onChange }: { value: { county_id: string; neighborhood_id: string }; onChange: (v: { county_id: string; neighborhood_id: string }) => void }) {
  const { counties } = useActiveCounties();
  const selectedCounty = counties.find((c) => c.id === value.county_id);
  const isRobatKarim = selectedCounty?.name === ROBAT_KARIM_COUNTY_NAME;
  const { neighborhoods } = useCountyNeighborhoods(
    isRobatKarim ? value.county_id : null,
    isRobatKarim ? ROBAT_KARIM_NEIGHBORHOODS : [],
  );

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

// Customer Creation Form
function CustomerForm({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
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
  const [typePrefs, setTypePrefs] = useState<Record<string, Record<string, string | boolean>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    setSaving(true);

    const propertyPreferences: Record<string, unknown> = {};
    if (location.county_id || location.neighborhood_id) {
      propertyPreferences.location = location;
    }
    if (address.trim()) {
      propertyPreferences.address = address.trim();
    }
    for (const [type, prefs] of Object.entries(typePrefs)) {
      const cleaned: Record<string, string | boolean> = {};
      for (const [k, v] of Object.entries(prefs)) {
        if (v !== '' && v !== false) cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) propertyPreferences[type] = cleaned;
    }

    const payload = {
      name: form.name,
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
      assigned_consultant_id: user?.id,
      status: 'active',
    };
    const { data, error } = await supabase.from('customers').insert(payload).select().single();

    if (!error && data) {
      await supabase.from('activities').insert({
        user_id: user?.id,
        entity_type: 'customer',
        entity_id: data.id,
        action: 'customer_created',
        description: `مشتری جدید ${form.name} ثبت شد`,
      });
    }
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

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> بازگشت
      </button>

      <PageHeader title="مشتری جدید" subtitle={`مرحله ${step + 1} از ${steps.length}: ${steps[step].title}`} />

      {/* Progress Bar */}
      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-slate-900' : 'bg-slate-200'}`}
          />
        ))}
      </div>

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
              <input className={`input ${errors.mobile ? 'input-error' : ''}`} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="09123456789" dir="ltr" />
              {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
            </div>
            <div>
              <label className="label">تلفن ثانویه</label>
              <input className="input" value={form.secondary_phone} onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })} placeholder="02112345678" dir="ltr" />
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
                <label className="label">منبع مشتری</label>
                <input className="input" value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })} placeholder="مثلا: اینستاگرام، معرفی، تماس ورودی" />
              </div>
            </div>
            <div>
              <label className="label">یادداشت</label>
              <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="توضیحات اضافی..." />
            </div>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-2 pt-2">
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
        </div>
      </div>
    </div>
  );
}
