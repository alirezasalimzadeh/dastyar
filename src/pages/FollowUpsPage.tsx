import { useEffect, useState, useCallback } from 'react';
import { Clock, ArrowLeft, Plus, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { FOLLOWUP_STATUSES, PRIORITIES, getFollowupStatusInfo, getPriorityInfo, formatDate, daysUntil, toEnglishDigits } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader } from '@/components/ui';

export function FollowUpsPage({ initialFilter }: { initialFilter?: string }) {
  const { user } = useAuth();
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter ?? 'all');
  const [showCreate, setShowCreate] = useState(false);

  const loadFollowups = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('follow_ups').select('*, customers(first_name, last_name, mobile), owners(name, phone), properties(title)').eq('status', 'pending');
    if (filter === 'overdue') query = query.lt('due_date', today);
    else if (filter === 'today') query = query.eq('due_date', today);
    else if (filter === 'upcoming') query = query.gt('due_date', today);
    query = query.order('due_date', { ascending: true }).limit(50);
    const { data } = await query;
    setFollowups(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadFollowups(); }, [loadFollowups]);

  const handleComplete = async (id: string) => {
    await supabase.from('follow_ups').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    loadFollowups();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="پیگیری‌ها" actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /><span className="hidden sm:inline">پیگیری جدید</span></button>} />

      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: 'همه' },
          { key: 'overdue', label: 'عقب‌افتاده' },
          { key: 'today', label: 'امروز' },
          { key: 'upcoming', label: 'آینده' },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : followups.length === 0 ? (
        <EmptyState icon={<Clock size={48} />} title="پیگیری‌ای یافت نشد" />
      ) : (
        <div className="space-y-2">
          {followups.map((fu) => {
            const overdue = new Date(fu.due_date) < new Date() && fu.status === 'pending';
            const today = new Date(fu.du_date).toDateString() === new Date().toDateString();
            const name = fu.customers ? `${fu.customers.first_name} ${fu.customers.last_name}` : fu.owners?.name ?? 'نامشخص';
            const priority = getPriorityInfo(fu.priority);
            return (
              <div key={fu.id} className={`card p-4 ${overdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${overdue ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                    {overdue ? <AlertCircle size={18} /> : <Clock size={18} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-800">{name}</p>
                      <Badge color={priority.color}>{priority.label}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">{fu.reason ?? 'پیگیری'}</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Calendar size={12} /> {formatDate(fu.due_date)} {fu.due_time}
                      {overdue && <span className="text-red-500 font-medium">• {Math.abs(daysUntil(fu.due_date))} روز عقب</span>}
                    </p>
                  </div>
                  <button onClick={() => handleComplete(fu.id)} className="btn-success"><CheckCircle size={16} /><span className="hidden sm:inline">انجام شد</span></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <FollowupModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); loadFollowups(); }} />}
    </div>
  );
}

function FollowupModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState('customer');
  const [customerId, setCustomerId] = useState('');
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.trim().length >= 2) {
      supabase.from('customers').select('id, first_name, last_name, mobile').or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,mobile.ilike.%${search}%`).limit(10).then(({ data }) => setCustomers(data ?? []));
    } else setCustomers([]);
  }, [search]);

  const handleSave = async () => {
    if (!dueDate || !customerId) return;
    setSaving(true);
    await supabase.from('follow_ups').insert({
      entity_type: entityType, entity_id: customerId,
      customer_id: customerId, reason: reason || null,
      due_date: dueDate, due_time: dueTime || null, priority,
      notes: notes || null, assigned_consultant_id: user?.id, status: 'pending',
    });
    await supabase.from('customers').update({ next_followup: dueDate }).eq('id', customerId);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title="پیگیری جدید">
      <div className="space-y-4">
        <div>
          <label className="label">انتخاب مشتری</label>
          <input className="input mb-2" placeholder="جستجوی مشتری..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {customers.length > 0 && (
            <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto divide-y divide-slate-100">
              {customers.map((c) => (
                <button key={c.id} onClick={() => { setCustomerId(c.id); setSearch(`${c.first_name} ${c.last_name}`); setCustomers([]); }} className="w-full px-3 py-2 text-right hover:bg-slate-50 text-sm">
                  {c.first_name} {c.last_name} - <span dir="ltr">{c.mobile}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div><label className="label">دلیل</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلا: تماس برای فایل جدید" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">تاریخ *</label><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div><label className="label">ساعت</label><input type="time" className="input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} /></div>
        </div>
        <div><label className="label">اولویت</label><select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">کم</option><option value="normal">عادی</option><option value="high">زیاد</option><option value="critical">فوری</option></select></div>
        <div><label className="label">یادداشت</label><textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <button onClick={handleSave} disabled={saving || !dueDate || !customerId} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
      </div>
    </Modal>
  );
}
