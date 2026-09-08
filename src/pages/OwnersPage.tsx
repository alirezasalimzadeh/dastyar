import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Search, Building2, Phone, Clock, ArrowLeft, Trash2, X, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { normalizePhone, validatePhone, formatDate, timeAgo, toEnglishDigits, toPersianDigits, COLLEAGUE_TAG } from '@/lib/constants';
import { Badge, EmptyState, Spinner, Modal, PageHeader, Pagination, ConfirmDialog, CopyButton, SortSelect } from '@/components/ui';
import type { Owner } from '@/lib/types';
import { getColleagueRef, useColleagues, visibleOwnerTags, withColleagueRef } from '@/lib/colleagues';
import { CallFormModal, CallRecordCard } from '@/components/calls';
import { FollowupFormModal, FollowupRecordCard } from '@/components/followups';

const PAGE_SIZE = 20;

type OwnerRow = Owner & {
  properties?: { status: string }[] | null;
  calls?: { call_date: string }[] | null;
};

const OWNER_SORTS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'name', label: 'نام (الفبا)' },
  { value: 'last_call', label: 'آخرین تماس' },
  { value: 'last_contact', label: 'آخرین ارتباط' },
  { value: 'active_props', label: 'بیشترین فایل فعال' },
];

export function OwnersPage({ initialId, onNavigate }: { initialId?: string; onNavigate?: (page: string, params?: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const colleagues = useColleagues();
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (initialId) { setSelectedId(initialId); setView('detail'); }
  }, [initialId]);

  const loadOwners = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('owners')
      .select('*, properties(status), calls(call_date)');
    const ownerRows = ((data as OwnerRow[]) ?? []).filter((owner) => !owner.tags?.includes(COLLEAGUE_TAG));
    setOwners(ownerRows);
    setTotal(ownerRows.length);
    setLoading(false);
  }, []);

  useEffect(() => { loadOwners(); }, [loadOwners]);

  const visibleOwners = useMemo(() => {
    const q = toEnglishDigits(search.trim()).toLowerCase();
    let rows = owners.map((o) => {
      const propsArr = o.properties ?? [];
      const activeCount = propsArr.filter((pr) => pr.status === 'active').length;
      const lastCall = (o.calls ?? []).reduce<string | null>(
        (acc, c) => (c.call_date && (!acc || c.call_date > acc) ? c.call_date : acc),
        null,
      );
      const lastContact = [lastCall, o.last_contact].filter(Boolean).sort().pop() ?? null;
      return { ...o, activeCount, totalCount: propsArr.length, lastCall, lastContact };
    });
    if (q) {
      rows = rows.filter((o) =>
        (o.name ?? '').toLowerCase().includes(q) ||
        toEnglishDigits(o.phone ?? '').includes(q) ||
        toEnglishDigits(o.secondary_phone ?? '').includes(q),
      );
    }
    const byDateDesc = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');
    switch (sortKey) {
      case 'oldest': rows.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')); break;
      case 'name': rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fa')); break;
      case 'last_call': rows.sort((a, b) => byDateDesc(a.lastCall, b.lastCall)); break;
      case 'last_contact': rows.sort((a, b) => byDateDesc(a.lastContact, b.lastContact)); break;
      case 'active_props': rows.sort((a, b) => b.activeCount - a.activeCount); break;
      default: rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    }
    return rows;
  }, [owners, search, sortKey]);

  const colleagueOf = (owner: Owner) => colleagues.find((colleague) => colleague.id === getColleagueRef(owner.tags));

  if (view === 'detail' && selectedId) {
    return (
      <OwnerDetail
        ownerId={selectedId}
        onBack={() => { setView('list'); setSelectedId(null); }}
        onPropertyOpen={(propertyId) => onNavigate?.('properties', { id: propertyId })}
      />
    );
  }

  const totalPages = Math.ceil(visibleOwners.length / PAGE_SIZE);
  const pageItems = visibleOwners.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      <PageHeader title="مالکین" subtitle={`${total} مالک`} actions={
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /><span className="hidden sm:inline">مالک جدید</span></button>
      } />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input pr-10" placeholder="جستجو با نام یا تلفن..." />
        </div>
      </div>

      <SortSelect value={sortKey} options={OWNER_SORTS} onChange={(v) => { setSortKey(v); setPage(1); }} />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : visibleOwners.length === 0 ? (
        <EmptyState icon={<Building2 size={48} />} title="مالکی یافت نشد" action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> مالک جدید</button>} />
      ) : (
        <>
          <div className="space-y-3">
              {pageItems.map((o) => (
                <div key={o.id} onClick={() => { setSelectedId(o.id); setView('detail'); }} className="card px-4 py-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">{o.name?.[0] ?? '؟'}</div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{o.name}</p>
                        {colleagueOf(o) && <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">همکار: {colleagueOf(o)?.name}</span>}
                        {visibleOwnerTags(o.tags).slice(0, 2).map((t, i) => <span key={i} className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{t}</span>)}
                      </div>
                      <div className="flex items-center gap-0.5 text-xs text-slate-400">
                        <span dir="ltr">{o.phone}</span>
                        <CopyButton text={o.phone} />
                        {o.secondary_phone && <><span className="text-slate-300 mx-1">•</span><span dir="ltr">{o.secondary_phone}</span><CopyButton text={o.secondary_phone} /></>}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[11px]">
                        <span className={o.lastCall ? 'text-slate-500' : 'text-slate-400'}>
                          آخرین تماس: {o.lastCall ? timeAgo(o.lastCall) : 'بدون تماس'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className={o.activeCount > 0 ? 'text-slate-600 font-medium' : 'text-slate-400'}>
                          {toPersianDigits(o.activeCount)} فایل فعال از {toPersianDigits(o.totalCount)} فایل
                        </span>
                      </div>
                    </div>
                    <Badge color={o.status === 'active' ? 'green' : o.status === 'blacklisted' ? 'red' : 'gray'}>{o.status === 'active' ? 'فعال' : o.status === 'blacklisted' ? 'لیست سیاه' : 'غیرفعال'}</Badge>
                  </div>
                </div>
              ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {showCreate && <OwnerForm onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); loadOwners(); }} />}
    </div>
  );
}

function OwnerDetail({ ownerId, onBack, onPropertyOpen }: { ownerId: string; onBack: () => void; onPropertyOpen: (propertyId: string) => void }) {
  const colleagues = useColleagues();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const [ownerRes, propsRes, callsRes, followupsRes] = await Promise.all([
      supabase.from('owners').select('*').eq('id', ownerId).maybeSingle(),
      supabase.from('properties').select('id, title, transaction_type, status, sale_price, deposit_price').eq('owner_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('calls').select('*, properties(title)').eq('owner_id', ownerId).order('call_date', { ascending: false }).limit(20),
      supabase.from('follow_ups').select('*, properties(title)').eq('owner_id', ownerId).order('due_date', { ascending: false }).limit(20),
    ]);
    setOwner(ownerRes.data as Owner);
    setProperties(propsRes.data ?? []);
    setCalls(callsRes.data ?? []);
    setFollowups(followupsRes.data ?? []);
    setLoading(false);
  }, [ownerId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleDelete = async () => { await supabase.from('owners').delete().eq('id', ownerId); onBack(); };

  if (loading || !owner) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  const referringColleague = colleagues.find((colleague) => colleague.id === getColleagueRef(owner.tags));

  return (
    <div className="animate-fade-in space-y-4">
      <button onClick={onBack} className="detail-back"><ArrowLeft size={16} /> بازگشت</button>
      <div className="detail-hero detail-hero-blue">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-blue-600"><Building2 size={14} /> پرونده مالک</p>
        <div className="flex items-start gap-4">
          <div className="detail-avatar bg-blue-100 text-blue-700">{owner.name?.[0] ?? '؟'}</div>
          <div className="flex-1">
            <h2 className="text-xl font-extrabold text-slate-800">{owner.name}</h2>
            <p className="text-sm text-slate-500" dir="ltr">{owner.phone}</p>
            {owner.secondary_phone && <p className="text-xs text-slate-400" dir="ltr">{owner.secondary_phone}</p>}
          </div>
          <Badge color={owner.status === 'active' ? 'green' : 'red'}>{owner.status === 'active' ? 'فعال' : 'غیرفعال'}</Badge>
        </div>
        {referringColleague && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">
            این مالک توسط همکار «{referringColleague.name}» معرفی شده است.
          </div>
        )}
        <div className="flex gap-2 mt-5 flex-wrap border-t border-slate-200/70 pt-4">
          <a href={`tel:${normalizePhone(owner.phone)}`} className="btn-primary"><Phone size={16} /> تماس</a>
          <button onClick={() => setShowCallModal(true)} className="btn-secondary"><Phone size={16} /> ثبت تماس</button>
          <button onClick={() => setShowFollowupModal(true)} className="btn-secondary"><Clock size={16} /> پیگیری</button>
          <button onClick={() => setShowEdit(true)} className="btn-secondary"><Pencil size={16} /> ویرایش مالک</button>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger" aria-label="حذف مالک"><Trash2 size={16} /></button>
        </div>
        {owner.notes && <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mt-4">{owner.notes}</p>}
        {visibleOwnerTags(owner.tags).length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{visibleOwnerTags(owner.tags).map((t, i) => <Badge key={i} color="blue">{t}</Badge>)}</div>}
      </div>

      <div className="detail-section !p-0 overflow-hidden">
        <h3 className="detail-section-title !mb-0 px-5 py-4"><Building2 size={17} className="text-blue-500" /> املاک مالک <span className="mr-auto text-xs font-normal text-slate-400">{properties.length} ملک</span></h3>
        {properties.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {properties.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPropertyOpen(p.id)}
                className="w-full px-5 py-3 flex items-center justify-between gap-3 text-right hover:bg-slate-50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900">{p.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">مشاهده جزئیات ملک</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color={p.status === 'active' ? 'green' : 'gray'}>{p.status === 'active' ? 'فعال' : p.status}</Badge>
                  <ArrowLeft size={16} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        ) : <EmptyState title="ملکی ثبت نشده" />}
      </div>

      <div className="detail-section !p-0 overflow-hidden">
        <h3 className="detail-section-title !mb-0 px-5 py-4"><Phone size={17} className="text-blue-500" /> تماس‌ها <span className="mr-auto text-xs font-normal text-slate-400">{calls.length} تماس</span></h3>
        {calls.length > 0 ? (
          <div className="space-y-3 p-3">{calls.map((call) => <CallRecordCard key={call.id} call={call} targetName={owner.name} />)}</div>
        ) : <EmptyState icon={<Phone size={36} />} title="تماسی ثبت نشده" />}
      </div>

      <div className="detail-section !p-0 overflow-hidden">
        <h3 className="detail-section-title !mb-0 px-5 py-4"><Clock size={17} className="text-amber-500" /> پیگیری‌ها <span className="mr-auto text-xs font-normal text-slate-400">{followups.length} مورد</span></h3>
        {followups.length > 0 ? <div className="space-y-3 p-3">{followups.map((item) => <FollowupRecordCard key={item.id} followup={item} targetName={owner.name} onChanged={loadDetail} />)}</div> : <EmptyState icon={<Clock size={36} />} title="پیگیری‌ای ثبت نشده" />}
      </div>

      {showCallModal && (
        <CallFormModal ownerId={ownerId} ownerName={owner.name} allowPropertySelection onClose={() => setShowCallModal(false)} onSaved={loadDetail} />
      )}
      {showFollowupModal && (
        <FollowupFormModal ownerId={ownerId} ownerName={owner.name} allowPropertySelection onClose={() => setShowFollowupModal(false)} onSaved={loadDetail} />
      )}
      {showEdit && (
        <OwnerForm
          owner={owner}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadDetail(); }}
        />
      )}
      <ConfirmDialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} title="حذف مالک" message="آیا از حذف این مالک مطمئن هستید؟" confirmLabel="حذف" danger />
    </div>
  );
}

function OwnerForm({ owner, onClose, onSaved }: { owner?: Owner; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const colleagues = useColleagues();
  const isEditing = Boolean(owner);
  const [name, setName] = useState(owner?.name ?? '');
  const [phone, setPhone] = useState(owner?.phone ?? '');
  const [secondaryPhone, setSecondaryPhone] = useState(owner?.secondary_phone ?? '');
  const [notes, setNotes] = useState(owner?.notes ?? '');
  const [tags, setTags] = useState(visibleOwnerTags(owner?.tags).join('، '));
  const [colleagueId, setColleagueId] = useState(getColleagueRef(owner?.tags));
  const [status, setStatus] = useState<Owner['status']>(owner?.status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('نام الزامی است'); return; }
    if (!phone.trim()) { setError('تلفن الزامی است'); return; }
    if (!validatePhone(phone)) { setError('فرمت تلفن صحیح نیست'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      phone: normalizePhone(phone),
      secondary_phone: secondaryPhone ? normalizePhone(secondaryPhone) : null,
      notes: notes.trim() || null,
      tags: withColleagueRef(tags ? tags.split('،').map((tag) => tag.trim()).filter(Boolean) : [], colleagueId),
      status,
      ...(!isEditing ? { assigned_consultant_id: user?.id } : {}),
    };
    const { data, error: saveError } = isEditing && owner
      ? await supabase.from('owners').update(payload).eq('id', owner.id).select().single()
      : await supabase.from('owners').insert(payload).select().single();
    if (saveError || !data) {
      setError(saveError?.message ?? 'ذخیره مالک انجام نشد.');
      setSaving(false);
      return;
    }
    await supabase.from('activities').insert({
      user_id: user?.id,
      entity_type: 'owner',
      entity_id: data.id,
      action: isEditing ? 'owner_updated' : 'owner_created',
      description: isEditing ? `مالک ${name} ویرایش شد` : `مالک جدید ${name} ثبت شد`,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={isEditing ? 'ویرایش مالک' : 'مالک جدید'}>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        <div><label className="label">نام *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام و نام خانوادگی" /></div>
        <div><label className="label">تلفن *</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09123456789" dir="ltr" /></div>
        <div><label className="label">تلفن ثانویه</label><input className="input" value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} placeholder="02112345678" dir="ltr" /></div>
        <div>
          <label className="label">همکار معرف <span className="font-normal text-slate-400">(اختیاری)</span></label>
          <select className="input" value={colleagueId} onChange={(e) => setColleagueId(e.target.value)}>
            <option value="">این مالک متعلق به خودم است</option>
            {colleagues.map((colleague) => (
              <option key={colleague.id} value={colleague.id} disabled={colleague.status === 'inactive' && colleague.id !== colleagueId}>
                {colleague.name}{colleague.agency_name ? ` — ${colleague.agency_name}` : ''}{colleague.status === 'inactive' ? ' (غیرفعال)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div><label className="label">تگ‌ها (با ویرگول جدا کنید)</label><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="سرمایه‌گذار، فوری" /></div>
        <div><label className="label">یادداشت</label><textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {isEditing && (
          <div>
            <label className="label">وضعیت</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Owner['status'])}>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
              <option value="blacklisted">لیست سیاه</option>
            </select>
          </div>
        )}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : isEditing ? 'ذخیره تغییرات' : 'ذخیره'}</button>
      </div>
    </Modal>
  );
}
