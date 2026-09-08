import { useEffect, useState } from 'react';
import { Clock, FileText, PhoneIncoming, PhoneOutgoing, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CALL_RESULTS, formatDateTime, getCallResultInfo } from '@/lib/constants';
import { Badge, Modal } from '@/components/ui';

const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

type CallFormProps = {
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

export function CallFormModal({
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
}: CallFormProps) {
  const { user } = useAuth();
  const [targetType, setTargetType] = useState<'customer' | 'owner'>(initialOwnerId ? 'owner' : 'customer');
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name?: string | null; mobile: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; owner_id?: string | null }[]>([]);
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [callDate, setCallDate] = useState(localDateTime);
  const [duration, setDuration] = useState('');
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!allowTargetSelection && !allowPropertySelection) return;
    let propertyQuery = supabase.from('properties').select('id, title, owner_id').order('created_at', { ascending: false }).limit(200);
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
    if (!selectedCustomerId && !selectedOwnerId) {
      setError('لطفاً مشتری یا مالک تماس را انتخاب کنید.');
      return;
    }
    if (!callDate) {
      setError('تاریخ و ساعت تماس را وارد کنید.');
      return;
    }
    if (!result) {
      setError('نتیجه تماس را مشخص کنید.');
      return;
    }
    if (duration && (!Number.isInteger(Number(duration)) || Number(duration) < 0)) {
      setError('مدت تماس باید به دقیقه و به‌صورت عدد صحیح وارد شود.');
      return;
    }
    if (result === 'needs_followup' && !nextFollowup) {
      setError('برای تماس نیازمند پیگیری، زمان پیگیری بعدی را مشخص کنید.');
      return;
    }

    setSaving(true);
    setError('');
    const callTimestamp = new Date(callDate).toISOString();
    const followupTimestamp = nextFollowup ? new Date(nextFollowup).toISOString() : null;
    const { data: call, error: callError } = await supabase.from('calls').insert({
      customer_id: selectedCustomerId,
      owner_id: selectedOwnerId,
      property_id: propertyId || null,
      consultant_id: user?.id,
      call_date: callTimestamp,
      duration_minutes: duration ? Number(duration) : null,
      direction,
      result,
      notes: notes.trim() || null,
      next_action: nextAction.trim() || null,
      next_followup: followupTimestamp,
    }).select().single();

    if (callError || !call) {
      setError(callError?.message ?? 'ثبت تماس انجام نشد.');
      setSaving(false);
      return;
    }

    const syncJobs: PromiseLike<unknown>[] = [];
    const syncLastContact = async (table: 'customers' | 'owners', id: string) => {
      const { data: current } = await supabase.from(table).select('last_contact').eq('id', id).maybeSingle();
      const latestContact = current?.last_contact && current.last_contact > callTimestamp ? current.last_contact : callTimestamp;
      return supabase.from(table).update({ last_contact: latestContact, ...(followupTimestamp ? { next_followup: followupTimestamp } : {}) }).eq('id', id);
    };
    if (selectedCustomerId) syncJobs.push(syncLastContact('customers', selectedCustomerId));
    if (selectedOwnerId) syncJobs.push(syncLastContact('owners', selectedOwnerId));

    if (followupTimestamp) {
      const [dueDate, dueTimeWithSeconds] = nextFollowup.split('T');
      syncJobs.push(supabase.from('follow_ups').insert({
        entity_type: selectedCustomerId ? 'customer' : 'owner',
        entity_id: selectedCustomerId ?? selectedOwnerId,
        customer_id: selectedCustomerId,
        owner_id: selectedOwnerId,
        property_id: propertyId || null,
        reason: nextAction.trim() || 'پیگیری تماس',
        priority,
        due_date: dueDate,
        due_time: dueTimeWithSeconds || null,
        assigned_consultant_id: user?.id,
        status: 'pending',
        notes: notes.trim() || null,
      }));
    }

    const resultLabel = CALL_RESULTS.find((item) => item.value === result)?.label ?? result;
    const activityTargets = [
      selectedCustomerId ? { type: 'customer', id: selectedCustomerId } : null,
      selectedOwnerId ? { type: 'owner', id: selectedOwnerId } : null,
      propertyId ? { type: 'property', id: propertyId } : null,
    ].filter(Boolean) as { type: string; id: string }[];
    if (activityTargets.length) {
      syncJobs.push(supabase.from('activities').insert(activityTargets.map((target) => ({
        user_id: user?.id,
        entity_type: target.type,
        entity_id: target.id,
        action: 'call_recorded',
        description: `تماس ${direction === 'inbound' ? 'ورودی' : 'خروجی'} — ${resultLabel}`,
        metadata: { call_id: call.id, property_id: propertyId || null, duration_minutes: duration ? Number(duration) : null },
      }))));
    }
    await Promise.all(syncJobs);
    setSaving(false);
    onSaved();
    onClose();
  };

  const fixedTargetName = targetType === 'owner' ? ownerName : customerName;

  return (
    <Modal open={true} onClose={onClose} title="ثبت جزئیات تماس" size="lg">
      <div className="space-y-5">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><UserRound size={16} /> مخاطب و فایل مرتبط</h3>
          {allowTargetSelection ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">نوع مخاطب</label>
                <select className="input" value={targetType} onChange={(event) => setTargetType(event.target.value as 'customer' | 'owner')}>
                  <option value="customer">مشتری</option><option value="owner">مالک</option>
                </select>
              </div>
              <div>
                <label className="label">{targetType === 'customer' ? 'انتخاب مشتری' : 'انتخاب مالک'} *</label>
                {targetType === 'customer' ? (
                  <select className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">انتخاب کنید</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name ?? ''} — {item.mobile}</option>)}</select>
                ) : (
                  <select className="input" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">انتخاب کنید</option>{owners.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.phone}</option>)}</select>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="label">فایل مرتبط <span className="font-normal text-slate-400">(اختیاری)</span></label>
                <select className="input" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">بدون فایل مرتبط</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-3 py-1.5 font-bold text-slate-700 shadow-sm">{targetType === 'owner' ? 'مالک' : 'مشتری'}: {fixedTargetName ?? 'انتخاب‌شده'}</span>
                {(propertyTitle || (propertyId && !allowPropertySelection)) && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">فایل: {propertyTitle ?? 'فایل مرتبط'}</span>}
              </div>
              {allowPropertySelection && (
                <div>
                  <label className="label">فایل مرتبط با تماس <span className="font-normal text-slate-400">(اختیاری)</span></label>
                  <select className="input" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
                    <option value="">بدون فایل مرتبط</option>
                    {properties.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className="label">جهت تماس</label><div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"><button type="button" onClick={() => setDirection('outbound')} className={`rounded-md px-2 py-2 text-xs ${direction === 'outbound' ? 'bg-white font-bold shadow-sm' : 'text-slate-500'}`}>خروجی</button><button type="button" onClick={() => setDirection('inbound')} className={`rounded-md px-2 py-2 text-xs ${direction === 'inbound' ? 'bg-white font-bold shadow-sm' : 'text-slate-500'}`}>ورودی</button></div></div>
            <div><label className="label">تاریخ و ساعت تماس</label><input type="datetime-local" className="input" value={callDate} onChange={(event) => setCallDate(event.target.value)} /></div>
            <div><label className="label">مدت تماس (دقیقه)</label><input type="number" min="0" step="1" className="input" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="مثلاً ۵" /></div>
          </div>
        </section>

        <section>
          <label className="label">نتیجه تماس *</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CALL_RESULTS.map((item) => <button key={item.value} type="button" onClick={() => setResult(item.value)} className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${result === item.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{item.label}</button>)}
          </div>
        </section>

        <div><label className="label">شرح و جزئیات تماس</label><textarea className="input min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="موضوع گفتگو، نیاز مخاطب، توافق‌ها و نکات مهم..." /></div>
        <div><label className="label">اقدام بعدی</label><input className="input" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="مثلاً ارسال مشخصات فایل و تماس مجدد" /></div>

        <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800"><Clock size={16} /> پیگیری بعدی</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">زمان پیگیری <span className="font-normal text-slate-400">(اختیاری)</span></label><input type="datetime-local" className="input" value={nextFollowup} onChange={(event) => setNextFollowup(event.target.value)} /></div>
            <div><label className="label">اولویت</label><select className="input" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">کم</option><option value="normal">عادی</option><option value="high">زیاد</option><option value="critical">فوری</option></select></div>
          </div>
          {nextFollowup && <p className="mt-2 text-xs text-amber-700">پس از ثبت تماس، یک پیگیری مرتبط نیز به‌صورت خودکار ساخته می‌شود.</p>}
        </section>

        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ثبت و همگام‌سازی...' : 'ثبت تماس'}</button>
      </div>
    </Modal>
  );
}

export function CallRecordCard({ call, targetName: providedTargetName }: { call: any; targetName?: string }) {
  const result = getCallResultInfo(call.result);
  const customerName = call.customers ? `${call.customers.first_name ?? ''} ${call.customers.last_name ?? ''}`.trim() : '';
  const targetName = customerName || call.owners?.name || providedTargetName || 'مخاطب نامشخص';
  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${call.direction === 'inbound' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
          {call.direction === 'inbound' ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-800">{targetName}</p>
            <Badge color={result.color}>{result.label}</Badge>
            <span className="text-[11px] text-slate-400">{call.direction === 'inbound' ? 'ورودی' : 'خروجی'}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <span>{formatDateTime(call.call_date)}</span>
            {call.duration_minutes != null && <span>{call.duration_minutes} دقیقه</span>}
            {call.properties?.title && <span className="flex items-center gap-1 text-blue-600"><FileText size={12} /> {call.properties.title}</span>}
          </div>
          {call.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">{call.notes}</p>}
          {(call.next_action || call.next_followup) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {call.next_action && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">اقدام بعدی: {call.next_action}</span>}
              {call.next_followup && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">پیگیری: {formatDateTime(call.next_followup)}</span>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
