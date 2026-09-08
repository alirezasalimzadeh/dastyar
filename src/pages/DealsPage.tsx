import { useEffect, useState, useCallback } from 'react';
import { Handshake, Plus, ArrowLeft, Trash2, TrendingUp, Percent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { DEAL_STATUSES, TRANSACTION_TYPES, getDealStatusInfo, getTransactionLabel, formatPrice, moneyToPersianWords, rentToDepositEquivalent, commissionFromTransactionValue, formatDate, toEnglishDigits } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, MoneyInput, PageHeader, ConfirmDialog } from '@/components/ui';

export function DealsPage({ initialId }: { initialId?: string }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('deals').select('*, customers(first_name, last_name), owners(name), properties(title)').order('created_at', { ascending: false }).limit(50);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setDeals(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const handleDelete = async () => {
    if (deleteId) { await supabase.from('deals').delete().eq('id', deleteId); setDeleteId(null); loadDeals(); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="معاملات" actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /><span className="hidden sm:inline">معامله جدید</span></button>} />

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>همه</button>
        {DEAL_STATUSES.map((s) => (
          <button key={s.value} onClick={() => setFilter(s.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${filter === s.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{s.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : deals.length === 0 ? (
        <EmptyState icon={<Handshake size={48} />} title="معامله‌ای ثبت نشده" action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> معامله جدید</button>} />
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => {
            const status = getDealStatusInfo(deal.status);
            return (
              <div key={deal.id} className="card p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><TrendingUp size={18} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-800">{deal.customers ? `${deal.customers.first_name} ${deal.customers.last_name}` : 'معامله'}</p>
                    <Badge color={status.color}>{status.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">{getTransactionLabel(deal.transaction_type)} • {deal.properties?.title ?? ''}</p>
                  {deal.deal_value != null && <p className="text-sm font-bold text-slate-700 mt-1">{formatPrice(deal.deal_value)} ت</p>}
                  {deal.contract_date && <p className="text-xs text-slate-400 mt-1">قرارداد: {formatDate(deal.contract_date)}</p>}
                </div>
                <button onClick={() => setDeleteId(deal.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <DealModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); loadDeals(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="حذف معامله" message="آیا از حذف این معامله مطمئن هستید؟" confirmLabel="حذف" danger />
    </div>
  );
}

function DealModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [transactionType, setTransactionType] = useState('buy');
  const [customerId, setCustomerId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [depositPrice, setDepositPrice] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [status, setStatus] = useState('negotiating');
  const [notes, setNotes] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [propSearch, setPropSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (custSearch.trim().length >= 2) {
      supabase.from('customers').select('id, first_name, last_name, mobile').or(`first_name.ilike.%${custSearch}%,mobile.ilike.%${custSearch}%`).limit(5).then(({ data }) => setCustomers(data ?? []));
    } else setCustomers([]);
  }, [custSearch]);

  useEffect(() => {
    if (propSearch.trim().length >= 2) {
      supabase.from('properties').select('id, title').ilike('title', `%${propSearch}%`).limit(5).then(({ data }) => setProperties(data ?? []));
    } else setProperties([]);
  }, [propSearch]);

  const numericMoney = (value: string) => value ? Number(toEnglishDigits(value)) : 0;
  const rentalEquivalent = rentToDepositEquivalent(numericMoney(depositPrice), numericMoney(monthlyRent));
  const dealAmount = transactionType === 'rent' ? rentalEquivalent : numericMoney(dealValue);
  const oneSideCommission = Math.round(dealAmount * 0.01);
  const standardCommission = commissionFromTransactionValue(dealAmount);

  const handleSave = async () => {
    setSaving(true);
    const { data: deal } = await supabase.from('deals').insert({
      customer_id: customerId || null, property_id: propertyId || null,
      consultant_id: user?.id, transaction_type: transactionType,
      deal_value: dealAmount > 0 ? dealAmount : null,
      commission: standardCommission > 0 ? standardCommission : null,
      status, notes: notes || null,
    }).select().single();
    if (deal) {
      await supabase.from('activities').insert({ user_id: user?.id, entity_type: 'deal', entity_id: deal.id, action: 'deal_created', description: 'معامله جدید ثبت شد' });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title="معامله جدید">
      <div className="space-y-4">
        <div><label className="label">نوع معامله</label><select className="input" value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>{TRANSACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div>
          <label className="label">مشتری</label>
          <input className="input mb-2" placeholder="جستجوی مشتری..." value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
          {customers.length > 0 && <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto divide-y divide-slate-100">{customers.map((c) => <button key={c.id} onClick={() => { setCustomerId(c.id); setCustSearch(`${c.first_name} ${c.last_name}`); setCustomers([]); }} className="w-full px-3 py-2 text-right hover:bg-slate-50 text-sm">{c.first_name} {c.last_name}</button>)}</div>}
        </div>
        <div>
          <label className="label">فایل</label>
          <input className="input mb-2" placeholder="جستجوی فایل..." value={propSearch} onChange={(e) => setPropSearch(e.target.value)} />
          {properties.length > 0 && <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto divide-y divide-slate-100">{properties.map((p) => <button key={p.id} onClick={() => { setPropertyId(p.id); setPropSearch(p.title); setProperties([]); }} className="w-full px-3 py-2 text-right hover:bg-slate-50 text-sm">{p.title}</button>)}</div>}
        </div>
        {transactionType === 'rent' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">پول پیش (تومان)</label>
                <MoneyInput value={depositPrice} onChange={setDepositPrice} placeholder="100000000" />
              </div>
              <div>
                <label className="label">اجاره ماهانه (تومان)</label>
                <MoneyInput value={monthlyRent} onChange={setMonthlyRent} placeholder="3000000" />
              </div>
            </div>
            {rentalEquivalent > 0 && (
              <p className="text-xs text-slate-500">
                ارزش معادل پول پیش: <strong>{formatPrice(rentalEquivalent)} تومان</strong>
                <span className="mr-1 text-slate-400">(هر ۳ میلیون اجاره = ۱۰۰ میلیون پول پیش)</span>
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="label">ارزش معامله (تومان)</label>
            <MoneyInput value={dealValue} onChange={setDealValue} placeholder="2000000000" />
          </div>
        )}
        {dealAmount > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4">
            <div className="mb-3 flex items-center gap-2 text-amber-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100"><Percent size={17} /></span>
              <div>
                <p className="text-sm font-bold">برآورد پورسانت</p>
                {transactionType === 'rent' && <p className="mt-0.5 text-[11px] font-normal text-slate-500">بر اساس ارزش معادل {formatPrice(dealAmount)} تومان</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                سهم هر طرف (۱٪): {formatPrice(oneSideCommission)} تومان
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-500 px-3 py-1.5 font-bold text-white shadow-sm">
                مجموع (۲٪): {formatPrice(standardCommission)} تومان
              </span>
            </div>
            <p className="mt-3 border-t border-amber-100 pt-2 text-[11px] leading-5 text-amber-800">
              {moneyToPersianWords(standardCommission)}
            </p>
          </div>
        )}
        <div><label className="label">وضعیت</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{DEAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div><label className="label">یادداشت</label><textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
      </div>
    </Modal>
  );
}
