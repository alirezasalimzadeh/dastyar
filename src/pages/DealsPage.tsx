import { useEffect, useState, useCallback } from 'react';
import { Building2, CalendarDays, Handshake, Pencil, Percent, Plus, Trash2, TrendingUp, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { DEAL_STATUSES, TRANSACTION_TYPES, getDealStatusInfo, getTransactionLabel, formatPrice, moneyToPersianWords, rentToDepositEquivalent, commissionFromTransactionValue, formatDate, toEnglishDigits } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, MoneyInput, PageHeader, ConfirmDialog } from '@/components/ui';
import { isPropertyArchived } from '@/lib/propertyArchive';

const RENT_TERMS = /(?:^|\n)\[rent_terms:(\d*),(\d*)\](?=\n|$)/;
const readRentTerms = (notes?: string | null) => { const match = notes?.match(RENT_TERMS); return { deposit: match?.[1] ?? '', rent: match?.[2] ?? '' }; };
const visibleNotes = (notes?: string | null) => (notes ?? '').replace(RENT_TERMS, '').trim();
const writeRentTerms = (notes: string, deposit: string, rent: string, enabled: boolean) => [visibleNotes(notes), enabled ? `[rent_terms:${deposit},${rent}]` : ''].filter(Boolean).join('\n') || null;
const todayLocal = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };

export function DealsPage({ initialId }: { initialId?: string }) {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    let query = supabase.from('deals').select('*, customers(first_name, last_name, mobile), owners(name, phone), properties(title, owner_id)').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (typeFilter) query = query.eq('transaction_type', typeFilter);
    const response = await query;
    if (response.error) setLoadError(response.error.message);
    setDeals(response.data ?? []);
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { loadDeals(); }, [loadDeals]);
  useEffect(() => { if (initialId && deals.length) setEditingDeal(deals.find((deal) => deal.id === initialId) ?? null); }, [deals, initialId]);

  const handleDelete = async () => { if (deleteId) { await supabase.from('deals').delete().eq('id', deleteId); setDeleteId(null); loadDeals(); } };

  return (
    <div className="animate-fade-in">
      <PageHeader title="معاملات" subtitle={`${deals.length} معامله`} actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> معامله جدید</button>} />
      <div className="mb-3 flex flex-wrap gap-2"><button onClick={() => setStatusFilter('all')} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>همه</button>{DEAL_STATUSES.map((item) => <button key={item.value} onClick={() => setStatusFilter(item.value)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${statusFilter === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{item.label}</button>)}</div>
      <div className="mb-4"><select className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">همه انواع معامله</option>{TRANSACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>

      {loadError && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">دریافت معاملات انجام نشد: {loadError}</p>}
      {loading ? <div className="flex justify-center py-16"><Spinner size={32} /></div> : deals.length === 0 ? <EmptyState icon={<Handshake size={48} />} title="معامله‌ای ثبت نشده" action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> معامله جدید</button>} /> : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const status = getDealStatusInfo(deal.status);
            const rentTerms = readRentTerms(deal.notes);
            return (
              <article key={deal.id} className="card p-4 transition-all hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><TrendingUp size={19} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-800">{deal.customers ? `${deal.customers.first_name} ${deal.customers.last_name ?? ''}` : 'معامله بدون مشتری'}</h3><Badge color={status.color}>{status.label}</Badge><Badge color="blue">{getTransactionLabel(deal.transaction_type)}</Badge></div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{deal.properties?.title && <span className="flex items-center gap-1"><Building2 size={13} /> {deal.properties.title}</span>}{deal.owners?.name && <span className="flex items-center gap-1"><UserRound size={13} /> مالک: {deal.owners.name}</span>}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] text-slate-400">ارزش معامله</p><p className="mt-1 text-xs font-bold text-slate-700">{deal.deal_value != null ? `${formatPrice(deal.deal_value)} تومان` : '—'}</p></div>
                      <div className="rounded-lg bg-amber-50 px-3 py-2"><p className="text-[10px] text-amber-600">پورسانت کل</p><p className="mt-1 text-xs font-bold text-amber-800">{deal.commission != null ? `${formatPrice(deal.commission)} تومان` : '—'}</p></div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] text-slate-400">تاریخ قرارداد</p><p className="mt-1 text-xs font-medium text-slate-700">{deal.contract_date ? formatDate(deal.contract_date) : '—'}</p></div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] text-slate-400">تاریخ تکمیل</p><p className="mt-1 text-xs font-medium text-slate-700">{deal.completion_date ? formatDate(deal.completion_date) : '—'}</p></div>
                    </div>
                    {deal.transaction_type === 'rent' && (rentTerms.deposit || rentTerms.rent) && <p className="mt-2 text-[11px] text-slate-500">پول پیش: {formatPrice(Number(rentTerms.deposit || 0))} تومان • اجاره: {formatPrice(Number(rentTerms.rent || 0))} تومان</p>}
                    {deal.negotiation_status && <p className="mt-2 text-xs text-blue-700">مرحله مذاکره: {deal.negotiation_status}</p>}
                    {visibleNotes(deal.notes) && <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-500">{visibleNotes(deal.notes)}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2"><button onClick={() => setEditingDeal(deal)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800"><Pencil size={15} /></button><button onClick={() => setDeleteId(deal.id)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button></div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(showCreate || editingDeal) && <DealModal deal={editingDeal} onClose={() => { setShowCreate(false); setEditingDeal(null); }} onSaved={() => { setShowCreate(false); setEditingDeal(null); loadDeals(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="حذف معامله" message="آیا از حذف این معامله مطمئن هستید؟" confirmLabel="حذف" danger />
    </div>
  );
}

function DealModal({ deal, onClose, onSaved }: { deal?: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const existingRent = readRentTerms(deal?.notes);
  const [transactionType, setTransactionType] = useState(deal?.transaction_type ?? 'buy');
  const [customerId, setCustomerId] = useState(deal?.customer_id ?? '');
  const [propertyId, setPropertyId] = useState(deal?.property_id ?? '');
  const [ownerId, setOwnerId] = useState(deal?.owner_id ?? '');
  const [dealValue, setDealValue] = useState(deal?.transaction_type === 'rent' ? '' : deal?.deal_value != null ? String(deal.deal_value) : '');
  const [depositPrice, setDepositPrice] = useState(existingRent.deposit);
  const [monthlyRent, setMonthlyRent] = useState(existingRent.rent);
  const [status, setStatus] = useState(deal?.status ?? 'negotiating');
  const [negotiationStatus, setNegotiationStatus] = useState(deal?.negotiation_status ?? '');
  const [contractDate, setContractDate] = useState(deal?.contract_date ?? '');
  const [completionDate, setCompletionDate] = useState(deal?.completion_date ?? '');
  const [notes, setNotes] = useState(visibleNotes(deal?.notes));
  const [customers, setCustomers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { Promise.all([supabase.from('customers').select('id, first_name, last_name, mobile').order('first_name').limit(200), supabase.from('properties').select('id, title, owner_id, owner_followup_status').order('created_at', { ascending: false }).limit(200)]).then(([c, p]) => {
    setCustomers(c.data ?? []);
    // فایل‌های بایگانی‌شده در انتخاب فایل معامله نمایش داده نمی‌شوند
    setProperties((p.data ?? []).filter((item) => !isPropertyArchived(item)));
    if (!ownerId && propertyId) setOwnerId(p.data?.find((item) => item.id === propertyId)?.owner_id ?? '');
  }); }, []);
  const numericMoney = (value: string) => value ? Number(toEnglishDigits(value)) : 0;
  const rentalEquivalent = rentToDepositEquivalent(numericMoney(depositPrice), numericMoney(monthlyRent));
  const amount = transactionType === 'rent' ? rentalEquivalent : numericMoney(dealValue);
  const oneSideCommission = Math.round(amount * 0.01);
  const totalCommission = commissionFromTransactionValue(amount);

  const handleSave = async () => {
    if (!customerId) { setError('مشتری معامله را انتخاب کنید.'); return; }
    if (!propertyId) { setError('فایل ملکی معامله را انتخاب کنید.'); return; }
    if (amount <= 0) { setError('مبلغ یا شرایط مالی معامله را وارد کنید.'); return; }
    setSaving(true); setError('');
    const finalCompletionDate = status === 'completed' ? completionDate || todayLocal() : completionDate || null;
    const payload = { customer_id: customerId, owner_id: ownerId || null, property_id: propertyId, consultant_id: deal?.consultant_id || user?.id, transaction_type: transactionType, deal_value: amount, commission: totalCommission, status, negotiation_status: negotiationStatus.trim() || null, contract_date: contractDate || null, completion_date: finalCompletionDate, notes: writeRentTerms(notes, depositPrice, monthlyRent, transactionType === 'rent') };
    const response = deal ? await supabase.from('deals').update(payload).eq('id', deal.id).select().single() : await supabase.from('deals').insert(payload).select().single();
    if (response.error || !response.data) { setError(response.error?.message ?? 'ذخیره معامله انجام نشد.'); setSaving(false); return; }
    if (status === 'completed') {
      if (transactionType === 'rent') await supabase.from('properties').update({ status: 'rented', is_active: false }).eq('id', propertyId);
      if (transactionType === 'buy' || transactionType === 'sell') await supabase.from('properties').update({ status: 'sold', is_active: false }).eq('id', propertyId);
      await supabase.from('customers').update({ status: 'converted' }).eq('id', customerId);
    }
    const targets = [{ type: 'deal', id: response.data.id }, { type: 'customer', id: customerId }, ownerId ? { type: 'owner', id: ownerId } : null, { type: 'property', id: propertyId }].filter(Boolean) as { type: string; id: string }[];
    await supabase.from('activities').insert(targets.map((target) => ({ user_id: user?.id, entity_type: target.type, entity_id: target.id, action: deal ? 'deal_updated' : 'deal_created', description: `${deal ? 'معامله ویرایش شد' : 'معامله جدید ثبت شد'} — ${getTransactionLabel(transactionType)}`, metadata: { deal_id: response.data.id, status, deal_value: amount } })));
    setSaving(false); onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={deal ? 'ویرایش معامله' : 'ثبت معامله جدید'} size="xl">
      <div className="space-y-5">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><Handshake size={16} /> طرفین و فایل معامله</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="label">نوع معامله</label><select className="input" value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>{TRANSACTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="label">مشتری *</label><select className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">انتخاب مشتری</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name ?? ''} — {item.mobile}</option>)}</select></div><div><label className="label">فایل ملکی *</label><select className="input" value={propertyId} onChange={(event) => { const selected = properties.find((item) => item.id === event.target.value); setPropertyId(event.target.value); setOwnerId(selected?.owner_id ?? ''); }}><option value="">انتخاب فایل</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></div></section>

        {transactionType === 'rent' ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="label">پول پیش</label><MoneyInput value={depositPrice} onChange={setDepositPrice} placeholder="100000000" /></div><div><label className="label">اجاره ماهانه</label><MoneyInput value={monthlyRent} onChange={setMonthlyRent} placeholder="3000000" /></div><p className="sm:col-span-2 text-xs text-slate-500">ارزش معادل معامله: <strong>{formatPrice(rentalEquivalent)} تومان</strong></p></div> : <div><label className="label">ارزش معامله</label><MoneyInput value={dealValue} onChange={setDealValue} placeholder="2000000000" /></div>}
        {amount > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800"><Percent size={17} /> برآورد پورسانت</div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1.5 text-slate-700">سهم هر طرف (۱٪): {formatPrice(oneSideCommission)} تومان</span><span className="rounded-full bg-amber-500 px-3 py-1.5 font-bold text-white">مجموع (۲٪): {formatPrice(totalCommission)} تومان</span></div><p className="mt-3 border-t border-amber-100 pt-2 text-[11px] text-amber-800">{moneyToPersianWords(totalCommission)}</p></div>}

        <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><CalendarDays size={16} /> وضعیت و زمان‌بندی</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="label">وضعیت معامله</label><select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>{DEAL_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="label">تاریخ قرارداد</label><input type="date" className="input" value={contractDate} onChange={(event) => setContractDate(event.target.value)} /></div><div><label className="label">تاریخ تکمیل</label><input type="date" className="input" value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} /></div></div></section>
        <div><label className="label">مرحله یا نتیجه مذاکره</label><input className="input" value={negotiationStatus} onChange={(event) => setNegotiationStatus(event.target.value)} placeholder="مثلاً توافق روی مبلغ و در انتظار تنظیم قرارداد" /></div>
        <div><label className="label">یادداشت کامل معامله</label><textarea className="input min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="شرایط توافق، تعهدات طرفین و نکات مهم..." /></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ذخیره و همگام‌سازی...' : deal ? 'ذخیره تغییرات' : 'ثبت معامله'}</button>
      </div>
    </Modal>
  );
}
