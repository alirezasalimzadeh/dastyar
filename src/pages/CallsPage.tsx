import { useEffect, useState, useCallback } from 'react';
import { Phone, ArrowLeft, Plus, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CALL_RESULTS, getCallResultInfo, formatDate, timeAgo, formatDateTime } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader, Pagination } from '@/components/ui';

const PAGE_SIZE = 20;

export function CallsPage() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');

  const loadCalls = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('calls').select('*, customers(first_name, last_name), owners(name), properties(title)', { count: 'exact' });
    if (filter) query = query.eq('result', filter);
    query = query.order('call_date', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, count } = await query;
    setCalls(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [filter, page]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      <PageHeader title="تماس‌ها" subtitle={`${total} تماس`} />

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${!filter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>همه</button>
        {CALL_RESULTS.map((r) => (
          <button key={r.value} onClick={() => setFilter(r.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${filter === r.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{r.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : calls.length === 0 ? (
        <EmptyState icon={<Phone size={48} />} title="تماسی ثبت نشده" description="از صفحه مشتریان یا مالکین تماس ثبت کنید" />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {calls.map((call) => {
                const result = getCallResultInfo(call.result);
                const name = call.customers ? `${call.customers.first_name} ${call.customers.last_name}` : call.owners?.name ?? 'نامشخص';
                return (
                  <div key={call.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      {call.direction === 'inbound' ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                      <p className="text-xs text-slate-400">{call.properties?.title ?? ''}</p>
                    </div>
                    <div className="text-left">
                      <Badge color={result.color}>{result.label}</Badge>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(call.call_date)}</p>
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
