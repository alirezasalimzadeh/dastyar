import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, UserRound, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDate, getFollowupStatusInfo, getPriorityInfo } from '@/lib/constants';
import { Badge, Modal } from '@/components/ui';

const todayLocal = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

async function syncNextFollowup(table: 'customers' | 'owners', id: string, idColumn: 'customer_id' | 'owner_id') {
  const { data } = await supabase
    .from('follow_ups')
    .select('due_date, due_time')
    .eq(idColumn, id)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .order('due_time', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const next = data ? `${data.due_date}T${data.due_time || '09:00'}` : null;
  await supabase.from(table).update({ next_followup: next }).eq('id', id);
}

export async function changeFollowupStatus(followup: any, status: 'completed' | 'cancelled', userId?: string) {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  const { error } = await supabase.from('follow_ups').update({ status, completed_at: completedAt }).eq('id', followup.id);
  if (error) return error.message;

  await Promise.all([
    followup.customer_id ? syncNextFollowup('customers', followup.customer_id, 'customer_id') : Promise.resolve(),
    followup.owner_id ? syncNextFollowup('owners', followup.owner_id, 'owner_id') : Promise.resolve(),
  ]);
  const targets = [
    followup.customer_id ? { type: 'customer', id: followup.customer_id } : null,
    followup.owner_id ? { type: 'owner', id: followup.owner_id } : null,
    followup.property_id ? { type: 'property', id: followup.property_id } : null,
  ].filter(Boolean) as { type: string; id: string }[];
  if (targets.length) {
    await supabase.from('activities').insert(targets.map((target) => ({
      user_id: userId,
      entity_type: target.type,
      entity_id: target.id,
      action: status === 'completed' ? 'followup_completed' : 'followup_cancelled',
      description: `${status === 'completed' ? 'پیگیری انجام شد' : 'پیگیری لغو شد'} — ${followup.reason || 'بدون عنوان'}`,
      metadata: { followup_id: followup.id, property_id: followup.property_id || null },
    })));
  }
  return '';
}

type FollowupFormProps = {
  onClose: () => void;
  onSaved: () => void;
  customerId?: string;
  customerName?: string;
  ownerId?: string;
  ownerName?: string;
  propertyId?: string;
  propertyTitle?: string;
  allowTargetSelection?: boolean;
  allowPropertySelection?: boolean;
};

export function FollowupFormModal({
  onClose,
  onSaved,
  customerId: initialCustomerId = '',
  customerName,
  ownerId: initialOwnerId = '',
  ownerName,
  propertyId: initialPropertyId = '',
  propertyTitle,
  allowTargetSelection = false,
  allowPropertySelection = false,
}: FollowupFormProps) {
  const { user } = useAuth();
  const [targetType, setTargetType] = useState<'customer' | 'owner'>(initialOwnerId ? 'owner' : 'customer');
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name?: string | null; mobile: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState(todayLocal);
  const [dueTime, setDueTime] = useState('09:00');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!allowTargetSelection && !allowPropertySelection) return;
    let propertyQuery = supabase.from('properties').select('id, title').order('created_at', { ascending: false }).limit(200);
    if (!allowTargetSelection && initialOwnerId) propertyQuery = propertyQuery.eq('owner_id', initialOwnerId);
    Promise.all([
      allowTargetSelection ? supabase.from('customers').select('id, first_name, last_name, mobile').order('first_name').limit(200) : Promise.resolve({ data: [] }),
      allowTargetSelection ? supabase.from('owners').select('id, name, phone').order('name').limit(200) : Promise.resolve({ data: [] }),
      propertyQuery,
    ]).then(([customerRes, ownerRes, propertyRes]) => {
      setCustomers(customerRes.data ?? []);
      setOwners(ownerRes.data ?? []);
      setProperties(propertyRes.data ?? []);
    });
  }, [allowPropertySelection, allowTargetSelection, initialOwnerId]);

  const handleSave = async () => {
    const selectedCustomerId = targetType === 'customer' ? customerId || null : null;
    const selectedOwnerId = targetType === 'owner' ? ownerId || null : null;
    if (!selectedCustomerId && !selectedOwnerId) { setError('مخاطب پیگیری را انتخاب کنید.'); return; }
    if (!reason.trim()) { setError('موضوع پیگیری را وارد کنید.'); return; }
    if (!dueDate) { setError('تاریخ پیگیری را مشخص کنید.'); return; }

    setSaving(true);
    setError('');
    const { data: followup, error: saveError } = await supabase.from('follow_ups').insert({
      entity_type: selectedCustomerId ? 'customer' : 'owner',
      entity_id: selectedCustomerId ?? selectedOwnerId,
      customer_id: selectedCustomerId,
      owner_id: selectedOwnerId,
      property_id: propertyId || null,
      reason: reason.trim(),
      priority,
      due_date: dueDate,
      due_time: dueTime || null,
      assigned_consultant_id: user?.id,
      status: 'pending',
      notes: notes.trim() || null,
    }).select().single();
    if (saveError || !followup) {
      setError(saveError?.message ?? 'ثبت پیگیری انجام نشد.');
      setSaving(false);
      return;
    }

    await Promise.all([
      selectedCustomerId ? syncNextFollowup('customers', selectedCustomerId, 'customer_id') : Promise.resolve(),
      selectedOwnerId ? syncNextFollowup('owners', selectedOwnerId, 'owner_id') : Promise.resolve(),
    ]);
    const targets = [
      selectedCustomerId ? { type: 'customer', id: selectedCustomerId } : null,
      selectedOwnerId ? { type: 'owner', id: selectedOwnerId } : null,
      propertyId ? { type: 'property', id: propertyId } : null,
    ].filter(Boolean) as { type: string; id: string }[];
    if (targets.length) {
      await supabase.from('activities').insert(targets.map((target) => ({
        user_id: user?.id,
        entity_type: target.type,
        entity_id: target.id,
        action: 'followup_created',
        description: `پیگیری «${reason.trim()}» برای ${formatDate(dueDate)} ثبت شد`,
        metadata: { followup_id: followup.id, property_id: propertyId || null, priority },
      })));
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const fixedName = initialOwnerId ? ownerName : customerName;
  return (
    <Modal open={true} onClose={onClose} title="ثبت پیگیری جدید" size="lg">
      <div className="space-y-5">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><UserRound size={16} /> مخاطب و فایل مرتبط</h3>
          {allowTargetSelection ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label">نوع مخاطب</label><select className="input" value={targetType} onChange={(event) => setTargetType(event.target.value as 'customer' | 'owner')}><option value="customer">مشتری</option><option value="owner">مالک</option></select></div>
              <div><label className="label">انتخاب {targetType === 'customer' ? 'مشتری' : 'مالک'} *</label>{targetType === 'customer' ? <select className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">انتخاب کنید</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name ?? ''} — {item.mobile}</option>)}</select> : <select className="input" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">انتخاب کنید</option>{owners.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.phone}</option>)}</select>}</div>
              <div className="sm:col-span-2"><label className="label">فایل مرتبط <span className="font-normal text-slate-400">(اختیاری)</span></label><select className="input" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">بدون فایل مرتبط</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1.5 font-bold text-slate-700 shadow-sm">{initialOwnerId ? 'مالک' : 'مشتری'}: {fixedName ?? 'انتخاب‌شده'}</span>{(propertyTitle || (propertyId && !allowPropertySelection)) && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">فایل: {propertyTitle ?? 'فایل مرتبط'}</span>}</div>
              {allowPropertySelection && <div><label className="label">فایل مرتبط <span className="font-normal text-slate-400">(اختیاری)</span></label><select className="input" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">بدون فایل مرتبط</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>}
            </div>
          )}
        </section>

        <div><label className="label">موضوع پیگیری *</label><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثلاً ارسال فایل‌های پیشنهادی و دریافت نظر" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><label className="label">تاریخ *</label><input type="date" min={todayLocal()} className="input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
          <div><label className="label">ساعت</label><input type="time" className="input" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></div>
          <div><label className="label">اولویت</label><select className="input" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">کم</option><option value="normal">عادی</option><option value="high">زیاد</option><option value="critical">فوری</option></select></div>
        </div>
        <div><label className="label">توضیحات و نتیجه مورد انتظار</label><textarea className="input min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="جزئیات لازم برای انجام صحیح پیگیری..." /></div>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ثبت و همگام‌سازی...' : 'ثبت پیگیری'}</button>
      </div>
    </Modal>
  );
}

export function FollowupRecordCard({ followup, targetName: providedName, onChanged }: { followup: any; targetName?: string; onChanged?: () => void }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const customerName = followup.customers ? `${followup.customers.first_name ?? ''} ${followup.customers.last_name ?? ''}`.trim() : '';
  const targetName = customerName || followup.owners?.name || providedName || 'مخاطب نامشخص';
  const priority = getPriorityInfo(followup.priority);
  const status = getFollowupStatusInfo(followup.status);
  const dueAt = new Date(`${followup.due_date}T${followup.due_time || '23:59:59'}`);
  const overdue = followup.status === 'pending' && dueAt.getTime() < Date.now();
  const isToday = followup.due_date === todayLocal();

  const changeStatus = async (nextStatus: 'completed' | 'cancelled') => {
    setSaving(true);
    const message = await changeFollowupStatus(followup, nextStatus, user?.id);
    setError(message);
    setSaving(false);
    if (!message) onChanged?.();
  };

  return (
    <article className={`card p-4 ${overdue ? 'border-red-200 bg-red-50/30' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overdue ? 'bg-red-100 text-red-600' : isToday ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>{overdue ? <AlertTriangle size={18} /> : <CalendarClock size={18} />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-800">{followup.reason || 'پیگیری'}</p><Badge color={priority.color}>{priority.label}</Badge><Badge color={overdue ? 'red' : status.color}>{overdue ? 'عقب‌افتاده' : status.label}</Badge></div>
          <p className="mt-1 text-xs text-slate-500">{targetName}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400"><span>{formatDate(followup.due_date)}{followup.due_time ? `، ساعت ${String(followup.due_time).slice(0, 5)}` : ''}</span>{followup.properties?.title && <span className="flex items-center gap-1 text-blue-600"><FileText size={12} /> {followup.properties.title}</span>}</div>
          {followup.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white/70 px-3 py-2 text-xs leading-6 text-slate-600">{followup.notes}</p>}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        {followup.status === 'pending' && <div className="flex shrink-0 flex-col gap-2"><button type="button" disabled={saving} onClick={() => changeStatus('completed')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"><CheckCircle2 size={15} /><span className="hidden sm:inline">انجام شد</span></button><button type="button" disabled={saving} onClick={() => changeStatus('cancelled')} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500 hover:text-red-600"><XCircle size={14} /><span className="hidden sm:inline">لغو</span></button></div>}
      </div>
    </article>
  );
}
