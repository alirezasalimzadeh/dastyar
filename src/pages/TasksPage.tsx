import { useEffect, useState, useCallback } from 'react';
import { CheckSquare, Plus, ArrowLeft, CheckCircle, Circle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TASK_STATUSES, PRIORITIES, getTaskStatusInfo, getPriorityInfo, formatDate, daysUntil } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader } from '@/components/ui';

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showCreate, setShowCreate] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('tasks').select('*').order('due_date', { ascending: true }).limit(50);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setTasks(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const toggleStatus = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    loadTasks();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="وظایف" actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /><span className="hidden sm:inline">وظیفه جدید</span></button>} />

      <div className="flex gap-2 mb-4">
        {TASK_STATUSES.map((s) => (
          <button key={s.value} onClick={() => setFilter(s.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{s.label}</button>
        ))}
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>همه</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<CheckSquare size={48} />} title="وظیفه‌ای یافت نشد" />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const priority = getPriorityInfo(task.priority);
            const status = getTaskStatusInfo(task.status);
            const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status === 'pending';
            return (
              <div key={task.id} className="card p-4 flex items-start gap-3">
                <button onClick={() => toggleStatus(task)} className="mt-0.5">
                  {task.status === 'completed' ? <CheckCircle size={20} className="text-green-500" /> : <Circle size={20} className="text-slate-300" />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-slate-400 mt-1">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge color={priority.color}>{priority.label}</Badge>
                    {task.due_date && <span className={`text-xs ${overdue ? 'text-red-500' : 'text-slate-400'}`}>{formatDate(task.due_date)}</span>}
                    {overdue && <Badge color="red">عقب‌افتاده</Badge>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <TaskModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); loadTasks(); }} />}
    </div>
  );
}

function TaskModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from('tasks').insert({
      title, description: description || null, priority,
      due_date: dueDate || null, status: 'pending',
      assigned_user_id: user?.id,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title="وظیفه جدید">
      <div className="space-y-4">
        <div><label className="label">عنوان *</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلا: تماس با مالک فایل X" /></div>
        <div><label className="label">توضیحات</label><textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">تاریخ</label><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div><label className="label">اولویت</label><select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">کم</option><option value="normal">عادی</option><option value="high">زیاد</option><option value="critical">فوری</option></select></div>
        </div>
        <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
      </div>
    </Modal>
  );
}
