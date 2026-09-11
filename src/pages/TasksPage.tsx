import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, CheckSquare, Pencil, Play, Plus, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TASK_STATUSES, getTaskStatusInfo, getPriorityInfo, formatDate } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader } from '@/components/ui';

const todayLocal = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    let query = supabase.from('tasks').select('*, customers(first_name, last_name), owners(name), properties(title), deals(transaction_type)');
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (priorityFilter) query = query.eq('priority', priorityFilter);
    const response = await query.order('due_date', { ascending: statusFilter !== 'completed', nullsFirst: false }).order('due_time', { ascending: true, nullsFirst: false }).limit(200);
    if (response.error) setLoadError(response.error.message);
    let rows = response.data ?? [];
    const today = todayLocal();
    if (timeFilter === 'today') rows = rows.filter((task) => task.due_date === today);
    if (timeFilter === 'overdue') rows = rows.filter((task) => task.status !== 'completed' && task.status !== 'cancelled' && task.due_date && new Date(`${task.due_date}T${task.due_time || '23:59:59'}`).getTime() < Date.now());
    if (timeFilter === 'upcoming') rows = rows.filter((task) => !task.due_date || new Date(`${task.due_date}T${task.due_time || '23:59:59'}`).getTime() >= Date.now());
    setTasks(rows);
    setLoading(false);
  }, [priorityFilter, statusFilter, timeFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const changeStatus = async (task: any, status: string) => {
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', task.id);
    const targets = [
      task.customer_id ? { type: 'customer', id: task.customer_id } : null,
      task.owner_id ? { type: 'owner', id: task.owner_id } : null,
      task.property_id ? { type: 'property', id: task.property_id } : null,
      task.deal_id ? { type: 'deal', id: task.deal_id } : null,
    ].filter(Boolean) as { type: string; id: string }[];
    if (targets.length) await supabase.from('activities').insert(targets.map((target) => ({ user_id: user?.id, entity_type: target.type, entity_id: target.id, action: `task_${status}`, description: `وضعیت وظیفه «${task.title}» به ${getTaskStatusInfo(status).label} تغییر کرد`, metadata: { task_id: task.id } })));
    loadTasks();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="وظایف" subtitle={`${tasks.length} وظیفه`} actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> وظیفه جدید</button>} />

      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter('all')} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>همه</button>
        {TASK_STATUSES.map((item) => <button key={item.value} onClick={() => setStatusFilter(item.value)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${statusFilter === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{item.label}</button>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">همه اولویت‌ها</option><option value="critical">فوری</option><option value="high">زیاد</option><option value="normal">عادی</option><option value="low">کم</option></select>
        <select className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}><option value="all">همه زمان‌ها</option><option value="overdue">عقب‌افتاده</option><option value="today">امروز</option><option value="upcoming">آینده</option></select>
      </div>

      {loadError && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">دریافت وظایف انجام نشد: {loadError}</p>}
      {loading ? <div className="flex justify-center py-16"><Spinner size={32} /></div> : tasks.length === 0 ? <EmptyState icon={<CheckSquare size={48} />} title="وظیفه‌ای یافت نشد" action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={17} /> وظیفه جدید</button>} /> : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const priority = getPriorityInfo(task.priority);
            const status = getTaskStatusInfo(task.status);
            const dueAt = task.due_date ? new Date(`${task.due_date}T${task.due_time || '23:59:59'}`) : null;
            const overdue = dueAt && dueAt.getTime() < Date.now() && !['completed', 'cancelled'].includes(task.status);
            const target = task.customers ? `${task.customers.first_name} ${task.customers.last_name ?? ''}` : task.owners?.name || task.properties?.title || (task.deal_id ? 'معامله مرتبط' : 'وظیفه عمومی');
            return (
              <article key={task.id} className={`card p-4 ${overdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overdue ? 'bg-red-100 text-red-600' : task.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{overdue ? <AlertTriangle size={18} /> : task.status === 'completed' ? <CheckCircle2 size={19} /> : <CheckSquare size={18} />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className={`text-sm font-bold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h3><Badge color={priority.color}>{priority.label}</Badge><Badge color={overdue ? 'red' : status.color}>{overdue ? 'عقب‌افتاده' : status.label}</Badge></div>
                    <p className="mt-1 text-xs text-slate-500">{target}</p>
                    {(task.due_date || task.properties?.title) && <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">{task.due_date && <span className="flex items-center gap-1"><CalendarClock size={12} /> {formatDate(task.due_date)}{task.due_time ? `، ${String(task.due_time).slice(0, 5)}` : ''}</span>}{task.properties?.title && task.customers && <span>{task.properties.title}</span>}</div>}
                    {task.description && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white/70 px-3 py-2 text-xs leading-6 text-slate-600">{task.description}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {!['completed', 'cancelled'].includes(task.status) && <button onClick={() => changeStatus(task, task.status === 'pending' ? 'in_progress' : 'completed')} className="rounded-lg bg-emerald-600 p-2 text-white" title={task.status === 'pending' ? 'شروع انجام' : 'تکمیل'}>{task.status === 'pending' ? <Play size={15} /> : <CheckCircle2 size={15} />}</button>}
                    <button onClick={() => setEditingTask(task)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500" title="ویرایش"><Pencil size={14} /></button>
                    {!['completed', 'cancelled'].includes(task.status) && <button onClick={() => changeStatus(task, 'cancelled')} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:text-red-600" title="لغو"><XCircle size={14} /></button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(showCreate || editingTask) && <TaskModal task={editingTask} onClose={() => { setShowCreate(false); setEditingTask(null); }} onSaved={() => { setShowCreate(false); setEditingTask(null); loadTasks(); }} />}
    </div>
  );
}

function TaskModal({ task, onClose, onSaved }: { task?: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState(task?.priority ?? 'normal');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [dueTime, setDueTime] = useState(task?.due_time?.slice(0, 5) ?? '');
  const [status, setStatus] = useState(task?.status ?? 'pending');
  const [targetType, setTargetType] = useState(task?.customer_id ? 'customer' : task?.owner_id ? 'owner' : task?.property_id ? 'property' : task?.deal_id ? 'deal' : 'general');
  const [targetId, setTargetId] = useState(task?.customer_id || task?.owner_id || task?.property_id || task?.deal_id || '');
  const [customers, setCustomers] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('id, first_name, last_name, mobile').order('first_name').limit(200),
      supabase.from('owners').select('id, name, phone').order('name').limit(200),
      supabase.from('properties').select('id, title').order('created_at', { ascending: false }).limit(200),
      supabase.from('deals').select('id, transaction_type, customers(first_name, last_name), properties(title)').order('created_at', { ascending: false }).limit(100),
    ]).then(([c, o, p, d]) => { setCustomers(c.data ?? []); setOwners(o.data ?? []); setProperties(p.data ?? []); setDeals(d.data ?? []); });
  }, []);

  const options = targetType === 'customer' ? customers.map((item) => ({ id: item.id, label: `${item.first_name} ${item.last_name ?? ''} — ${item.mobile}` })) : targetType === 'owner' ? owners.map((item) => ({ id: item.id, label: `${item.name} — ${item.phone}` })) : targetType === 'property' ? properties.map((item) => ({ id: item.id, label: item.title })) : targetType === 'deal' ? deals.map((item) => ({ id: item.id, label: `${item.customers ? `${item.customers.first_name} ${item.customers.last_name ?? ''}` : 'معامله'} — ${item.properties?.title ?? item.transaction_type}` })) : [];

  const handleSave = async () => {
    if (!title.trim()) { setError('عنوان وظیفه را وارد کنید.'); return; }
    if (targetType !== 'general' && !targetId) { setError('مورد مرتبط با وظیفه را انتخاب کنید.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      title: title.trim(), description: description.trim() || null, priority, due_date: dueDate || null, due_time: dueTime || null, status,
      assigned_user_id: user?.id,
      customer_id: targetType === 'customer' ? targetId : null,
      owner_id: targetType === 'owner' ? targetId : null,
      property_id: targetType === 'property' ? targetId : null,
      deal_id: targetType === 'deal' ? targetId : null,
    };
    const response = task ? await supabase.from('tasks').update(payload).eq('id', task.id).select().single() : await supabase.from('tasks').insert(payload).select().single();
    if (response.error || !response.data) { setError(response.error?.message ?? 'ذخیره وظیفه انجام نشد.'); setSaving(false); return; }
    const linked = targetType !== 'general' ? { type: targetType, id: targetId } : { type: 'task', id: response.data.id };
    await supabase.from('activities').insert({ user_id: user?.id, entity_type: linked.type, entity_id: linked.id, action: task ? 'task_updated' : 'task_created', description: `${task ? 'وظیفه ویرایش شد' : 'وظیفه جدید ثبت شد'} — ${title.trim()}`, metadata: { task_id: response.data.id } });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={task ? 'ویرایش وظیفه' : 'وظیفه جدید'} size="lg">
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div><label className="label">عنوان وظیفه *</label><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً تماس با مالک و دریافت نتیجه نهایی" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="label">ارتباط وظیفه</label><select className="input" value={targetType} onChange={(event) => { setTargetType(event.target.value); setTargetId(''); }}><option value="general">وظیفه عمومی</option><option value="customer">مشتری</option><option value="owner">مالک</option><option value="property">فایل ملکی</option><option value="deal">معامله</option></select></div>
          {targetType !== 'general' && <div><label className="label">انتخاب مورد مرتبط *</label><select className="input" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">انتخاب کنید</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>}
        </div>
        <div><label className="label">شرح کامل</label><textarea className="input min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="جزئیات، خروجی مورد انتظار و نکات لازم..." /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><label className="label">تاریخ</label><input type="date" className="input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div><label className="label">ساعت</label><input type="time" className="input" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></div><div><label className="label">اولویت</label><select className="input" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">کم</option><option value="normal">عادی</option><option value="high">زیاد</option><option value="critical">فوری</option></select></div><div><label className="label">وضعیت</label><select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>{TASK_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : task ? 'ذخیره تغییرات' : 'ثبت وظیفه'}</button>
      </div>
    </Modal>
  );
}
