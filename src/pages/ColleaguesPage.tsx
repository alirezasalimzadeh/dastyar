import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, UserPlus, Pencil, Trash2, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { normalizePhone, validatePhone, toEnglishDigits, toPersianDigits, COLLEAGUE_TAG } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader, ConfirmDialog, CopyButton } from '@/components/ui';
import type { Owner } from '@/lib/types';

type ColleagueRow = Owner & { properties?: { id: string }[] | null };

export function ColleaguesPage() {
  const { user } = useAuth();
  const [colleagues, setColleagues] = useState<ColleagueRow[]>([]);
  const [properties, setProperties] = useState<{ id: string; owner_relationship: string | null }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; property_preferences: Record<string, unknown> | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [deleting, setDeleting] = useState<ColleagueRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [colRes, propRes, custRes] = await Promise.all([
      supabase.from('owners').select('*, properties(id)').contains('tags', [COLLEAGUE_TAG]).order('created_at', { ascending: false }),
      supabase.from('properties').select('id, owner_relationship'),
      supabase.from('customers').select('id, property_preferences'),
    ]);
    setColleagues((colRes.data as ColleagueRow[]) ?? []);
    setProperties((propRes.data as { id: string; owner_relationship: string | null }[]) ?? []);
    setCustomers((custRes.data as { id: string; property_preferences: Record<string, unknown> | null }[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = toEnglishDigits(search.trim()).toLowerCase();
    let rows = colleagues;
    if (q) {
      rows = rows.filter((c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        toEnglishDigits(c.phone ?? '').includes(q),
      );
    }
    return rows;
  }, [colleagues, search]);

  const propCountOf = (id: string) => properties.filter((p) => p.owner_relationship === id).length;
  const custCountOf = (id: string) =>
    customers.filter((c) => (c.property_preferences as Record<string, unknown> | null)?.colleague_id === id).length;

  const handleDelete = async () => {
    if (!deleting) return;
    await supabase.from('owners').delete().eq('id', deleting.id);
    setDeleting(null);
    load();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="همکاران" subtitle={`${colleagues.length} همکار`} actions={
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
          <Plus size={18} /><span className="hidden sm:inline">همکار جدید</span>
        </button>
      } />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pr-10" placeholder="جستجو با نام یا تلفن..." />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={48} />}
          title="همکاری ثبت نشده"
          description="همکارانتان را ثبت کنید تا بتوانید فایل‌ها و متقاضی‌ها را به آن‌ها نسبت دهید"
          action={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary"><Plus size={18} /> همکار جدید</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100">
            {visible.map((c) => (
              <div key={c.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                    {c.name?.[0] ?? '؟'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      {c.status === 'inactive' && <Badge color="gray">غیرفعال</Badge>}
                    </div>
                    <div className="flex items-center gap-0.5 text-xs text-slate-400">
                      <span dir="ltr">{c.phone}</span>
                      <CopyButton text={c.phone} />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>{toPersianDigits(propCountOf(c.id))} فایل</span>
                      <span className="text-slate-300">•</span>
                      <span>{toPersianDigits(custCountOf(c.id))} متقاضی</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="ویرایش">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setDeleting(c)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="حذف">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <ColleagueForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="حذف همکار"
        message={`آیا از حذف ${deleting?.name ?? ''} مطمئن هستید؟ فایل‌ها و متقاضی‌های قبلی او باقی می‌مانند اما بدون همکار نمایش داده می‌شوند.`}
        confirmLabel="حذف"
        danger
      />
    </div>
  );
}

function ColleagueForm({ initial, onClose, onSaved }: { initial: Owner | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [secondaryPhone, setSecondaryPhone] = useState(initial?.secondary_phone ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('نام الزامی است'); return; }
    if (!phone.trim()) { setError('تلفن الزامی است'); return; }
    if (!validatePhone(phone)) { setError('فرمت تلفن صحیح نیست'); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      phone: normalizePhone(phone),
      secondary_phone: secondaryPhone ? normalizePhone(secondaryPhone) : null,
      notes: notes || null,
      status,
      tags: [COLLEAGUE_TAG],
    };
    const { error: saveError } = initial
      ? await supabase.from('owners').update(payload).eq('id', initial.id)
      : await supabase.from('owners').insert({ ...payload, assigned_consultant_id: user?.id });
    setSaving(false);
    if (saveError) { setError('ذخیره ناموفق بود'); return; }
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={initial ? 'ویرایش همکار' : 'همکار جدید'}>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        <div><label className="label">نام و نام خانوادگی *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام همکار" /></div>
        <div><label className="label">موبایل *</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09123456789" dir="ltr" /></div>
        <div><label className="label">تلفن ثانویه</label><input className="input" value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} placeholder="02112345678" dir="ltr" /></div>
        <div>
          <label className="label">وضعیت</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Owner['status'])}>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
        </div>
        <div><label className="label">یادداشت</label><textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تخصص، آژانس، نکات همکاری..." /></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
      </div>
    </Modal>
  );
}
