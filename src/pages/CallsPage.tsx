import { useEffect, useState, useCallback } from 'react';
import { Phone, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CALL_RESULTS } from '@/lib/constants';
import { EmptyState, Spinner, PageHeader, Pagination } from '@/components/ui';
import { CallFormModal, CallRecordCard } from '@/components/calls';

const PAGE_SIZE = 20;

export function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [direction, setDirection] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadCalls = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const from = (page - 1) * PAGE_SIZE;
    const to = page * PAGE_SIZE - 1;
    let query = supabase.from('calls').select('*, customers(first_name, last_name, mobile), owners(name, phone), properties(title)', { count: 'exact' });
    if (filter) query = query.eq('result', filter);
    if (direction) query = query.eq('direction', direction);
    let response = await query.order('call_date', { ascending: false }).range(from, to);
    if (response.error) {
      let fallback = supabase.from('calls').select('*', { count: 'exact' });
      if (filter) fallback = fallback.eq('result', filter);
      if (direction) fallback = fallback.eq('direction', direction);
      response = await fallback.order('call_date', { ascending: false }).range(from, to) as typeof response;
    }
    if (response.error) setLoadError(response.error.message);
    setCalls(response.data ?? []);
    setTotal(response.count ?? 0);
    setLoading(false);
  }, [filter, direction, page]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="تماس‌ها"
        subtitle={`${total} تماس ثبت‌شده`}
        actions={<button type="button" onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={17} /> ثبت تماس</button>}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => { setFilter(''); setPage(1); }} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${!filter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>همه نتایج</button>
        {CALL_RESULTS.map((item) => <button key={item.value} onClick={() => { setFilter(item.value); setPage(1); }} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${filter === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{item.label}</button>)}
      </div>
      <div className="mb-4 flex gap-2 text-xs">
        <button onClick={() => { setDirection(''); setPage(1); }} className={`rounded-full border px-3 py-1 ${!direction ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>همه تماس‌ها</button>
        <button onClick={() => { setDirection('inbound'); setPage(1); }} className={`rounded-full border px-3 py-1 ${direction === 'inbound' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>ورودی</button>
        <button onClick={() => { setDirection('outbound'); setPage(1); }} className={`rounded-full border px-3 py-1 ${direction === 'outbound' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>خروجی</button>
      </div>

      {loadError && <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"><span>دریافت تماس‌ها انجام نشد: {loadError}</span><button onClick={loadCalls} className="font-bold">تلاش مجدد</button></div>}
      {loading ? <div className="flex justify-center py-16"><Spinner size={32} /></div> : calls.length === 0 ? (
        <EmptyState icon={<Phone size={48} />} title="تماسی ثبت نشده" description="اولین تماس با مشتری یا مالک را با جزئیات ثبت کنید." action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={17} /> ثبت تماس</button>} />
      ) : (
        <>
          <div className="space-y-3">{calls.map((call) => <CallRecordCard key={call.id} call={call} />)}</div>
          <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
        </>
      )}

      {showCreate && <CallFormModal allowTargetSelection onClose={() => setShowCreate(false)} onSaved={loadCalls} />}
    </div>
  );
}
