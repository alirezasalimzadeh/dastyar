import { useEffect, useState, useCallback } from 'react';
import { Clock, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EmptyState, Spinner, PageHeader } from '@/components/ui';
import { FollowupFormModal, FollowupRecordCard } from '@/components/followups';

const todayLocal = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export function FollowUpsPage({ initialFilter }: { initialFilter?: string }) {
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [timeFilter, setTimeFilter] = useState(initialFilter ?? 'all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [showCreate, setShowCreate] = useState(false);

  const loadFollowups = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const today = todayLocal();
    let query = supabase.from('follow_ups').select('*, customers(first_name, last_name, mobile), owners(name, phone), properties(title)');
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    let response = await query.order('due_date', { ascending: statusFilter === 'pending' }).order('due_time', { ascending: true, nullsFirst: false }).limit(200);
    if (response.error) {
      let fallbackQuery = supabase.from('follow_ups').select('*');
      if (statusFilter !== 'all') fallbackQuery = fallbackQuery.eq('status', statusFilter);
      response = await fallbackQuery.order('due_date', { ascending: statusFilter === 'pending' }).order('due_time', { ascending: true, nullsFirst: false }).limit(200);
    }
    if (response.error) setLoadError(response.error.message);
    let rows = response.data ?? [];
    if (timeFilter === 'today') rows = rows.filter((item) => item.due_date === today);
    else if (timeFilter === 'overdue') rows = rows.filter((item) => new Date(`${item.due_date}T${item.due_time || '23:59:59'}`).getTime() < Date.now());
    else if (timeFilter === 'upcoming') rows = rows.filter((item) => new Date(`${item.due_date}T${item.due_time || '23:59:59'}`).getTime() >= Date.now());
    setFollowups(rows);
    setLoading(false);
  }, [statusFilter, timeFilter]);

  useEffect(() => { loadFollowups(); }, [loadFollowups]);

  return (
    <div className="animate-fade-in">
      <PageHeader title="پیگیری‌ها" subtitle={`${followups.length} مورد`} actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> پیگیری جدید</button>} />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { key: 'pending', label: 'در انتظار' },
          { key: 'completed', label: 'انجام‌شده' },
          { key: 'missed', label: 'از دست‌رفته' },
          { key: 'cancelled', label: 'لغوشده' },
          { key: 'all', label: 'همه وضعیت‌ها' },
        ].map((item) => <button key={item.key} onClick={() => setStatusFilter(item.key)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${statusFilter === item.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{item.label}</button>)}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { key: 'all', label: 'همه زمان‌ها' },
          { key: 'overdue', label: 'عقب‌افتاده' },
          { key: 'today', label: 'امروز' },
          { key: 'upcoming', label: 'آینده' },
        ].map((item) => <button key={item.key} onClick={() => setTimeFilter(item.key)} className={`shrink-0 rounded-full border px-3 py-1 ${timeFilter === item.key ? 'border-blue-300 bg-blue-50 font-medium text-blue-700' : 'border-slate-200 text-slate-500'}`}>{item.label}</button>)}
      </div>

      {loadError && <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"><span>دریافت پیگیری‌ها انجام نشد: {loadError}</span><button onClick={loadFollowups} className="font-bold">تلاش مجدد</button></div>}
      {loading ? <div className="flex justify-center py-16"><Spinner size={32} /></div> : followups.length === 0 ? (
        <EmptyState icon={<Clock size={48} />} title="پیگیری‌ای یافت نشد" description="برای مشتری یا مالک یک پیگیری زمان‌بندی‌شده ثبت کنید." action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={17} /> پیگیری جدید</button>} />
      ) : <div className="space-y-3">{followups.map((item) => <FollowupRecordCard key={item.id} followup={item} onChanged={loadFollowups} />)}</div>}

      {showCreate && <FollowupFormModal allowTargetSelection onClose={() => setShowCreate(false)} onSaved={loadFollowups} />}
    </div>
  );
}
