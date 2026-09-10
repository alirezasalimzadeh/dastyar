import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, FileText, Pencil, Phone, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { COLLEAGUE_TAG, normalizePhone, validatePhone, toEnglishDigits, toPersianDigits, stripPhoneSpaces } from '@/lib/constants';
import { colleagueTags, ownerToColleague } from '@/lib/colleagues';
import { Badge, ConfirmDialog, CopyButton, EmptyState, Modal, PageHeader, Spinner } from '@/components/ui';
import type { Colleague, Owner } from '@/lib/types';
import { getArchiveInfo } from '@/lib/propertyArchive';

type ColleagueRow = Colleague & { properties?: { id: string; status: string; title: string; owner_followup_status?: string | null }[] | null };

export function ColleaguesPage({ onNavigate }: { onNavigate?: (page: string, params?: Record<string, unknown>) => void }) {
  const [colleagues, setColleagues] = useState<ColleagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Colleague | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [colleagueRes, propertyRes] = await Promise.all([
      supabase.from('owners').select('*').contains('tags', [COLLEAGUE_TAG]).order('created_at', { ascending: false }),
      supabase.from('properties').select('id, status, title, owner_relationship'),
    ]);
    const properties = (propertyRes.data as { id: string; status: string; title: string; owner_relationship: string | null }[]) ?? [];
    setColleagues(((colleagueRes.data as Owner[]) ?? []).map((owner) => ({
      ...ownerToColleague(owner),
      properties: properties.filter((property) => property.owner_relationship === owner.id),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const query = toEnglishDigits(search.trim()).toLowerCase();
    if (!query) return colleagues;
    return colleagues.filter((colleague) =>
      colleague.name.toLowerCase().includes(query)
      || toEnglishDigits(colleague.phone).includes(query)
      || (colleague.agency_name ?? '').toLowerCase().includes(query),
    );
  }, [colleagues, search]);

  if (selectedId) {
    return (
      <ColleagueDetail
        colleagueId={selectedId}
        onBack={() => { setSelectedId(null); load(); }}
        onPropertyOpen={(propertyId) => onNavigate?.('properties', { id: propertyId })}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="همکاران"
        subtitle={`${toPersianDigits(colleagues.length)} همکار ثبت‌شده`}
        actions={(
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
            <Plus size={18} /><span className="hidden sm:inline">همکار جدید</span>
          </button>
        )}
      />

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="input h-10 pr-10" placeholder="جستجو با نام، موبایل یا آژانس..." />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={48} />}
          title="همکاری ثبت نشده"
          description="همکاران خود را ثبت کنید تا فایل‌های اشتراکی را به آن‌ها نسبت دهید."
          action={<button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={18} /> همکار جدید</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((colleague) => {
            const activeFiles = (colleague.properties ?? []).filter((property) => property.status === 'active').length;
            return (
              <button key={colleague.id} onClick={() => setSelectedId(colleague.id)} className="card p-4 text-right transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">{colleague.name[0] ?? '؟'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-slate-800">{colleague.name}</h3>
                      <Badge color={colleague.status === 'active' ? 'green' : 'gray'}>{colleague.status === 'active' ? 'فعال' : 'غیرفعال'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500" dir="ltr">{colleague.phone}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{colleague.agency_name || colleague.specialization || 'بدون اطلاعات تکمیلی'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><FileText size={14} /> {toPersianDigits(colleague.properties?.length ?? 0)} فایل مشترک</span>
                  <span>{toPersianDigits(activeFiles)} فایل فعال</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <ColleagueForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ColleagueDetail({ colleagueId, onBack, onPropertyOpen }: { colleagueId: string; onBack: () => void; onPropertyOpen: (propertyId: string) => void }) {
  const [colleague, setColleague] = useState<ColleagueRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [colleagueRes, propertyRes] = await Promise.all([
      supabase.from('owners').select('*').eq('id', colleagueId).maybeSingle(),
      supabase.from('properties').select('id, status, title, owner_followup_status').eq('owner_relationship', colleagueId).order('created_at', { ascending: false }),
    ]);
    setColleague(colleagueRes.data ? {
      ...ownerToColleague(colleagueRes.data as Owner),
      properties: propertyRes.data ?? [],
    } : null);
    setLoading(false);
  }, [colleagueId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!colleague) return;
    if ((colleague.properties?.length ?? 0) > 0) {
      await supabase.from('owners').update({ status: 'inactive' }).eq('id', colleague.id);
    } else {
      await supabase.from('owners').delete().eq('id', colleague.id);
    }
    onBack();
  };

  if (loading || !colleague) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  return (
    <div className="animate-fade-in space-y-4">
      <button onClick={onBack} className="detail-back"><ArrowLeft size={16} /> بازگشت</button>

      <div className="detail-hero detail-hero-indigo">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-indigo-600"><UserPlus size={14} /> پروفایل همکار</p>
        <div className="flex items-start gap-4">
          <div className="detail-avatar bg-indigo-100 text-indigo-700">{colleague.name[0] ?? '؟'}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-800">{colleague.name}</h2>
              <Badge color={colleague.status === 'active' ? 'green' : 'gray'}>{colleague.status === 'active' ? 'فعال' : 'غیرفعال'}</Badge>
            </div>
            {colleague.agency_name && <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Building2 size={14} /> {colleague.agency_name}</p>}
            {colleague.specialization && <p className="mt-1 text-xs text-slate-400">حوزه فعالیت: {colleague.specialization}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200/70 pt-4">
          <a href={`tel:${normalizePhone(colleague.phone)}`} className="btn-primary"><Phone size={16} /> تماس با همکار</a>
          <button onClick={() => setShowEdit(true)} className="btn-secondary"><Pencil size={16} /> ویرایش همکار</button>
          <button onClick={() => setShowDelete(true)} className="btn-danger" aria-label="حذف همکار"><Trash2 size={16} /></button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div><p className="text-xs text-slate-400">موبایل</p><div className="flex items-center gap-1 text-sm text-slate-700"><span dir="ltr">{colleague.phone}</span><CopyButton text={colleague.phone} /></div></div>
          {colleague.secondary_phone && <div><p className="text-xs text-slate-400">تلفن ثانویه</p><div className="flex items-center gap-1 text-sm text-slate-700"><span dir="ltr">{colleague.secondary_phone}</span><CopyButton text={colleague.secondary_phone} /></div></div>}
        </div>
        {colleague.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{colleague.notes}</p>}
      </div>

      <div className="detail-section !p-0 overflow-hidden">
        <div className="detail-section-title !mb-0 px-5 py-4">
          <FileText size={17} className="text-indigo-500" />
          <h3>فایل‌های این همکار</h3>
          <span className="mr-auto text-xs font-normal text-slate-400">{toPersianDigits(colleague.properties?.length ?? 0)} فایل</span>
        </div>
        {(colleague.properties?.length ?? 0) > 0 ? (
          <div className="divide-y divide-slate-100">
            {colleague.properties?.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={() => onPropertyOpen(property.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-right transition-colors hover:bg-slate-50 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 group-hover:text-slate-900">{property.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">مشاهده جزئیات ملک</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {getArchiveInfo(property.owner_followup_status)
                    ? <Badge color="gray">بایگانی</Badge>
                    : <Badge color={property.status === 'active' ? 'green' : 'gray'}>{property.status === 'active' ? 'فعال' : 'غیرفعال'}</Badge>}
                  <ArrowLeft size={16} className="text-slate-300 transition-colors group-hover:text-slate-600" />
                </div>
              </button>
            ))}
          </div>
        ) : <EmptyState icon={<FileText size={36} />} title="هنوز فایلی از این همکار ثبت نشده" />}
      </div>

      {showEdit && <ColleagueForm initial={colleague} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={(colleague.properties?.length ?? 0) > 0 ? 'غیرفعال‌کردن همکار' : 'حذف همکار'}
        message={(colleague.properties?.length ?? 0) > 0
          ? 'برای حفظ سابقه فایل‌های مشترک، این همکار حذف نمی‌شود و فقط غیرفعال خواهد شد.'
          : 'آیا از حذف این همکار مطمئن هستید؟'}
        confirmLabel={(colleague.properties?.length ?? 0) > 0 ? 'غیرفعال کن' : 'حذف'}
        danger
      />
    </div>
  );
}

function ColleagueForm({ initial, onClose, onSaved }: { initial: Colleague | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const isEditing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [secondaryPhone, setSecondaryPhone] = useState(initial?.secondary_phone ?? '');
  const [agencyName, setAgencyName] = useState(initial?.agency_name ?? '');
  const [specialization, setSpecialization] = useState(initial?.specialization ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState<Colleague['status']>(initial?.status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('نام همکار الزامی است'); return; }
    if (!phone.trim()) { setError('موبایل همکار الزامی است'); return; }
    if (!validatePhone(phone)) { setError('فرمت موبایل صحیح نیست (09123456789)'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      phone: normalizePhone(phone),
      secondary_phone: secondaryPhone ? normalizePhone(secondaryPhone) : null,
      notes: notes.trim() || null,
      tags: colleagueTags(agencyName, specialization),
      status,
      ...(!isEditing ? { assigned_consultant_id: user?.id } : {}),
    };
    const { data, error: saveError } = initial
      ? await supabase.from('owners').update(payload).eq('id', initial.id).select().single()
      : await supabase.from('owners').insert(payload).select().single();
    if (saveError || !data) {
      setError(saveError?.message ?? 'ذخیره همکار انجام نشد.');
      setSaving(false);
      return;
    }
    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'colleague',
      entity_id: data.id,
      action: isEditing ? 'colleague_updated' : 'colleague_created',
      description: isEditing ? `همکار ${name} ویرایش شد` : `همکار جدید ${name} ثبت شد`,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={isEditing ? 'ویرایش همکار' : 'همکار جدید'}>
      <div className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</div>}
        <div><label className="label">نام و نام خانوادگی *</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="نام همکار" /></div>
        <div><label className="label">موبایل *</label><input className="input" value={phone} onChange={(event) => setPhone(stripPhoneSpaces(event.target.value))} placeholder="09123456789" dir="ltr" /></div>
        <div><label className="label">تلفن ثانویه</label><input className="input" value={secondaryPhone} onChange={(event) => setSecondaryPhone(stripPhoneSpaces(event.target.value))} placeholder="02112345678" dir="ltr" /></div>
        <div><label className="label">نام آژانس یا دفتر</label><input className="input" value={agencyName} onChange={(event) => setAgencyName(event.target.value)} placeholder="مثلاً املاک مرکزی" /></div>
        <div><label className="label">حوزه فعالیت</label><input className="input" value={specialization} onChange={(event) => setSpecialization(event.target.value)} placeholder="مثلاً آپارتمان مسکونی غرب تهران" /></div>
        <div><label className="label">یادداشت</label><textarea className="input min-h-[70px]" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="شرایط همکاری، نحوه تسویه و نکات مهم..." /></div>
        {isEditing && (
          <div><label className="label">وضعیت</label><select className="input" value={status} onChange={(event) => setStatus(event.target.value as Colleague['status'])}><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></div>
        )}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : isEditing ? 'ذخیره تغییرات' : 'ثبت همکار'}</button>
      </div>
    </Modal>
  );
}
