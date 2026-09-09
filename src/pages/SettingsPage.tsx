import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Settings as SettingsIcon, MapPin, Plus, Edit2, X, Search, Power, Lock, Download, Upload, Database, Tag as TagIcon, AlertTriangle, CheckCircle2, Loader2, Clock, UserRound, Mail, Smartphone, ShieldCheck, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Spinner, Modal, PageHeader, ConfirmDialog } from '@/components/ui';
import type { Province, County, City, Neighborhood, Tag } from '@/lib/types';

type Tab = 'account' | 'security' | 'geographic' | 'tags' | 'backup';
type GeoLevel = 'provinces' | 'counties' | 'cities' | 'neighborhoods';

const TAG_COLORS = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'];

const BACKUP_TABLES = [
  'provinces', 'counties', 'districts', 'cities', 'neighborhoods',
  'agencies', 'branches', 'profiles', 'tags', 'customers', 'owners', 'properties',
  'customer_preferred_cities', 'customer_preferred_neighborhoods', 'customer_tags', 'property_tags',
  'calls', 'follow_ups', 'tasks', 'deals', 'property_matches', 'property_requests', 'activities', 'notifications',
];

function AccountInfoCard({ icon, label, value, color, ltr = false }: { icon: ReactNode; label: string; value: string; color: 'blue' | 'emerald' | 'violet' | 'amber'; ltr?: boolean }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="card flex items-center gap-3 p-4 transition-all hover:border-slate-300 hover:shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[color]}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="mt-1 truncate text-sm font-bold text-slate-700" dir={ltr ? 'ltr' : undefined}>{value}</p>
      </div>
    </div>
  );
}

const colorClasses: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  pink: 'bg-pink-100 text-pink-700 border-pink-200',
};

export function SettingsPage() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'system_admin' || profile?.role === 'manager';
  const [tab, setTab] = useState<Tab>('account');

  // Geographic
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('provinces');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  // Tags
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);

  // Security
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // Backup
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreData, setRestoreData] = useState<string>('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(geoLevel).select('*').order('name');
    if (search.trim()) query = query.ilike('name', `%${search}%`);
    query = query.limit(100);
    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  }, [geoLevel, search]);

  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    const { data } = await supabase.from('tags').select('*').order('created_at', { ascending: false });
    setTags((data as Tag[]) ?? []);
    setTagsLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { if (tab === 'tags') loadTags(); }, [tab, loadTags]);

  const toggleActive = async (item: any) => {
    await supabase.from(geoLevel).update({ active: !item.active }).eq('id', item.id);
    loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from(geoLevel).delete().eq('id', id);
    loadItems();
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'رمز جدید و تکرار آن یکسان نیستند' });
      return;
    }
    if (pwForm.next.length < 6) {
      setPwMsg({ type: 'error', text: 'رمز جدید باید حداقل ۶ کاراکتر باشد' });
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    setPwSaving(false);
    if (error) {
      setPwMsg({ type: 'error', text: error.message });
    } else {
      setPwMsg({ type: 'success', text: 'رمز عبور با موفقیت تغییر یافت' });
      setPwForm({ next: '', confirm: '' });
    }
  };

  // --- Backup ---
  const handleBackup = async () => {
    setBacking(true);
    setBackupMsg(null);
    try {
      const backup: Record<string, unknown[]> = {};
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select('*').limit(10000);
        if (error) { backup[table] = []; continue; }
        backup[table] = data ?? [];
      }
      const backupObj = { version: 1, created_at: new Date().toISOString(), data: backup };
      const json = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const ts = new Date().toISOString();
      setLastBackup(ts);
      setBackupMsg({ type: 'success', text: 'فایل پشتیبان با موفقیت دانلود شد' });
    } catch (e) {
      setBackupMsg({ type: 'error', text: 'خطا در تهیه پشتیبان' });
    }
    setBacking(false);
  };

  const handleRestoreFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setRestoreData(e.target?.result as string);
      setShowRestoreConfirm(true);
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    setRestoring(true);
    setBackupMsg(null);
    try {
      const parsed = JSON.parse(restoreData);
      const data = parsed.data as Record<string, any[]>;
      const tables = Object.keys(data);
      for (const table of tables) {
        const rows = data[table];
        if (!rows || !rows.length) continue;
        // Upsert rows
        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (error) {
          // If upsert fails (no unique constraint), try insert
          await supabase.from(table).insert(rows);
        }
      }
      setBackupMsg({ type: 'success', text: 'بازگردانی با موفقیت انجام شد' });
    } catch (e) {
      setBackupMsg({ type: 'error', text: 'فایل پشتیبان نامعتبر است' });
    }
    setRestoring(false);
    setShowRestoreConfirm(false);
    setRestoreData('');
  };

  const levelLabels: Record<GeoLevel, string> = {
    provinces: 'استان‌ها', counties: 'شهرستان‌ها', cities: 'شهرها', neighborhoods: 'محله‌ها',
  };
  const accountName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'کاربر دستیار';
  const accountRole = profile?.role === 'manager' ? 'مدیر' : profile?.role === 'office_manager' ? 'مدیر دفتر' : profile?.role === 'system_admin' ? 'مدیر سیستم' : 'مشاور';
  const accountActive = profile?.account_status === 'active';

  return (
    <div className="animate-fade-in">
      <PageHeader title="تنظیمات" subtitle="مدیریت حساب، داده‌ها و پشتیبان‌گیری" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar">
        {([
          { key: 'account', label: 'حساب کاربری', icon: SettingsIcon },
          { key: 'security', label: 'امنیت', icon: Lock },
          { key: 'backup', label: 'پشتیبان‌گیری', icon: Database },
          { key: 'tags', label: 'برچسب‌ها', icon: TagIcon },
          ...(isAdmin ? [{ key: 'geographic' as Tab, label: 'داده‌های جغرافیایی', icon: MapPin }] : []),
        ] as { key: Tab; label: string; icon: any }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {tab === 'account' && (
        <div className="space-y-4 animate-fade-in">
          <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-bl from-blue-50 via-white to-indigo-50 p-5 sm:p-6">
            <div className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl font-extrabold text-white shadow-lg shadow-blue-200">
                {profile?.first_name?.[0] ?? profile?.email?.[0]?.toUpperCase() ?? 'ک'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-800">{accountName}</h2>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${accountActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${accountActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {accountActive ? 'حساب فعال' : 'حساب غیرفعال'}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500" dir="ltr">{profile?.email ?? user?.email ?? 'ایمیل ثبت نشده'}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
                  <ShieldCheck size={14} /> {accountRole}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AccountInfoCard icon={<UserRound size={18} />} label="نام و نام خانوادگی" value={accountName} color="blue" />
            <AccountInfoCard icon={<Smartphone size={18} />} label="شماره موبایل" value={profile?.mobile ?? 'ثبت نشده'} ltr color="emerald" />
            <AccountInfoCard icon={<Mail size={18} />} label="ایمیل حساب" value={profile?.email ?? user?.email ?? 'ثبت نشده'} ltr color="violet" />
            <AccountInfoCard icon={<ShieldCheck size={18} />} label="سطح دسترسی" value={accountRole} color="amber" />
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <CalendarDays size={16} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700">اطلاعات حساب</h3>
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-x-reverse sm:divide-y-0">
              <div className="p-4"><p className="text-[11px] text-slate-400">تاریخ عضویت</p><p className="mt-1 text-sm font-semibold text-slate-700">{user?.created_at ? new Date(user.created_at).toLocaleDateString('fa-IR') : '—'}</p></div>
              <div className="p-4"><p className="text-[11px] text-slate-400">آخرین به‌روزرسانی</p><p className="mt-1 text-sm font-semibold text-slate-700">{profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString('fa-IR') : '—'}</p></div>
              <div className="p-4"><p className="text-[11px] text-slate-400">شناسه حساب</p><p className="mt-1 text-sm font-semibold text-slate-700" dir="ltr">{user?.id ? `${user.id.slice(0, 8)}…` : '—'}</p></div>
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-6 text-blue-700">
            <SettingsIcon size={17} className="mt-0.5 shrink-0" />
            <p>برای ویرایش نام، شماره تماس و سایر اطلاعات شخصی از صفحه «پروفایل» استفاده کنید. تنظیمات امنیتی و تغییر رمز عبور نیز در تب «امنیت» در دسترس است.</p>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <div className="space-y-4 animate-fade-in">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Lock size={16} /> تغییر رمز عبور</h3>
            <div><label className="label">رمز جدید</label><input className="input" type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} dir="ltr" /></div>
            <div><label className="label">تکرار رمز جدید</label><input className="input" type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} dir="ltr" /></div>
            {pwMsg && (
              <p className={`text-sm flex items-center gap-1.5 ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {pwMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                {pwMsg.text}
              </p>
            )}
            <button onClick={handleChangePassword} disabled={pwSaving || !pwForm.next || !pwForm.confirm} className="btn-primary text-sm">
              {pwSaving ? 'در حال ذخیره...' : 'تغییر رمز'}
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700">اطلاعات نشست</h3>
            <div className="flex items-center justify-between"><p className="text-xs text-slate-400">ایمیل ورود</p><p className="text-sm text-slate-700" dir="ltr">{user?.email ?? '-'}</p></div>
            <div className="flex items-center justify-between"><p className="text-xs text-slate-400">شناسه کاربر</p><p className="text-sm text-slate-700" dir="ltr">{user?.id?.slice(0, 8) ?? '-'}...</p></div>
            <div className="flex items-center justify-between"><p className="text-xs text-slate-400">آخرین به‌روزرسانی</p><p className="text-sm text-slate-700">{profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString('fa-IR') : '-'}</p></div>
          </div>
        </div>
      )}

      {/* Backup Tab */}
      {tab === 'backup' && (
        <div className="space-y-4 animate-fade-in">
          {/* Backup */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Download size={18} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-700">تهیه پشتیبان (بکاپ)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              با این کار، تمام داده‌های اپلیکیشن شامل فایل‌ها، مشتریان، مالکان، معاملات، تماس‌ها، پیگیری‌ها، وظایف و برچسب‌ها در یک فایل JSON دانلود می‌شود. این فایل را در جای امن نگه دارید.
            </p>
            <button onClick={handleBackup} disabled={backing} className="btn-primary text-sm">
              {backing ? <><Loader2 size={15} className="animate-spin" /> در حال تهیه پشتیبان...</> : <><Download size={15} /> دانلود فایل پشتیبان</>}
            </button>
            {lastBackup && (
              <p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> آخرین پشتیبان: {new Date(lastBackup).toLocaleDateString('fa-IR')}</p>
            )}
          </div>

          {/* Restore */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-orange-600" />
              <h3 className="text-sm font-bold text-slate-700">بازگردانی پشتیبان</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              فایل پشتیبان JSON را انتخاب کنید تا داده‌ها بازگردانی شوند. توجه: داده‌های موجود حذف نمی‌شوند و فقط داده‌های جدید اضافه می‌گردند.
            </p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg p-6 cursor-pointer hover:border-slate-300 transition-colors">
              <Upload size={20} className="text-slate-400" />
              <span className="text-sm text-slate-500">انتخاب فایل پشتیبان...</span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestoreFile(f); }}
              />
            </label>
          </div>

          {backupMsg && (
            <div className={`card p-4 flex items-center gap-2 ${backupMsg.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
              {backupMsg.type === 'success' ? <CheckCircle2 size={18} className="text-green-600" /> : <AlertTriangle size={18} className="text-red-500" />}
              <p className={`text-sm ${backupMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>{backupMsg.text}</p>
            </div>
          )}
        </div>
      )}

      {/* Tags Tab */}
      {tab === 'tags' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">مدیریت برچسب‌ها</h3>
            <button onClick={() => { setEditTag(null); setShowTagModal(true); }} className="btn-primary text-sm"><Plus size={15} /> برچسب جدید</button>
          </div>

          {tagsLoading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : tags.length === 0 ? (
            <EmptyState icon={<TagIcon size={48} />} title="برچسبی یافت نشد" description="برچسب‌ها برای دسته‌بندی مشتریان و مالکان استفاده می‌شوند" />
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-slate-100">
                {tags.map((tag) => (
                  <div key={tag.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses[tag.color] ?? colorClasses.slate}`}>
                        {tag.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditTag(tag); setShowTagModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"><Edit2 size={16} /></button>
                      <button onClick={async () => { await supabase.from('tags').delete().eq('id', tag.id); loadTags(); }} className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500"><X size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showTagModal && (
            <TagFormModal tag={editTag} onClose={() => { setShowTagModal(false); setEditTag(null); }} onSaved={() => { setShowTagModal(false); setEditTag(null); loadTags(); }} />
          )}
        </div>
      )}

      {/* Geographic Tab */}
      {tab === 'geographic' && isAdmin && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {(['provinces', 'counties', 'cities', 'neighborhoods'] as GeoLevel[]).map((level) => (
              <button key={level} onClick={() => { setGeoLevel(level); setSearch(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${geoLevel === level ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{levelLabels[level]}</button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pr-10" placeholder={`جستجو در ${levelLabels[geoLevel]}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button onClick={() => { setEditItem(null); setShowCreate(true); }} className="btn-primary"><Plus size={18} /><span className="hidden sm:inline">افزودن</span></button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={32} /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={<MapPin size={48} />} title="موردی یافت نشد" />
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        <MapPin size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{item.name}</p>
                        {item.official_code && <p className="text-xs text-slate-400" dir="ltr">کد: {item.official_code}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(item)} className={`p-1.5 rounded-lg ${item.active ? 'text-green-500 hover:bg-green-50' : 'text-slate-300 hover:bg-slate-50'}`} title={item.active ? 'غیرفعال کردن' : 'فعال کردن'}><Power size={16} /></button>
                      <button onClick={() => { setEditItem(item); setShowCreate(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500"><X size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <GeoFormModal level={geoLevel} item={editItem} onClose={() => { setShowCreate(false); setEditItem(null); }} onSaved={() => { setShowCreate(false); setEditItem(null); loadItems(); }} />
      )}

      <ConfirmDialog
        open={showRestoreConfirm}
        onClose={() => { setShowRestoreConfirm(false); setRestoreData(''); }}
        onConfirm={handleRestore}
        title="بازگردانی پشتیبان"
        message="آیا مطمئن هستید که می‌خواهید داده‌ها را از فایل پشتیبان بازگردانی کنید؟"
        confirmLabel="بازگردانی"
      />
    </div>
  );
}

function TagFormModal({ tag, onClose, onSaved }: { tag: Tag | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? 'slate');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (tag) {
      await supabase.from('tags').update({ name, color }).eq('id', tag.id);
    } else {
      await supabase.from('tags').insert({ name, color });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={tag ? 'ویرایش برچسب' : 'برچسب جدید'}>
      <div className="space-y-4">
        <div><label className="label">نام برچسب *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلا: VIP" /></div>
        <div>
          <label className="label">رنگ</label>
          <div className="flex flex-wrap gap-2">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${colorClasses[c]} ${color === c ? 'ring-2 ring-slate-400 ring-offset-1' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary w-full">
          {saving ? 'در حال ذخیره...' : 'ذخیره'}
        </button>
      </div>
    </Modal>
  );
}

function GeoFormModal({ level, item, onClose, onSaved }: { level: GeoLevel; item: any | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [officialCode, setOfficialCode] = useState(item?.official_code ?? '');
  const [provinceId, setProvinceId] = useState(item?.province_id ?? '');
  const [countyId, setCountyId] = useState(item?.county_id ?? '');
  const [cityId, setCityId] = useState(item?.city_id ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    supabase.from('provinces').select('*').eq('active', true).order('name').then(({ data }) => setProvinces((data as Province[]) ?? []));
  }, []);

  useEffect(() => {
    if (provinceId && (level === 'counties' || level === 'cities' || level === 'neighborhoods')) {
      supabase.from('counties').select('*').eq('province_id', provinceId).eq('active', true).order('name').then(({ data }) => setCounties((data as County[]) ?? []));
    }
  }, [provinceId, level]);

  useEffect(() => {
    if (countyId && (level === 'cities' || level === 'neighborhoods')) {
      supabase.from('cities').select('*').eq('county_id', countyId).eq('active', true).order('name').then(({ data }) => setCities((data as City[]) ?? []));
    }
  }, [countyId, level]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = { name, official_code: officialCode || null, active };
    if (level === 'counties' && provinceId) payload.province_id = provinceId;
    if (level === 'cities') {
      if (provinceId) payload.province_id = provinceId;
      if (countyId) payload.county_id = countyId;
    }
    if (level === 'neighborhoods' && cityId) payload.city_id = cityId;

    if (item) {
      await supabase.from(level).update(payload).eq('id', item.id);
    } else {
      await supabase.from(level).insert(payload);
    }
    setSaving(false);
    onSaved();
  };

  const levelLabel: Record<GeoLevel, string> = { provinces: 'استان', counties: 'شهرستان', cities: 'شهر', neighborhoods: 'محله' };

  return (
    <Modal open={true} onClose={onClose} title={item ? `ویرایش ${levelLabel[level]}` : `${levelLabel[level]} جدید`}>
      <div className="space-y-4">
        <div><label className="label">نام *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">کد رسمی</label><input className="input" value={officialCode} onChange={(e) => setOfficialCode(e.target.value)} dir="ltr" /></div>
        {level === 'counties' && (
          <div><label className="label">استان</label><select className="input" value={provinceId} onChange={(e) => setProvinceId(e.target.value)}><option value="">انتخاب...</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        )}
        {level === 'cities' && (
          <>
            <div><label className="label">استان</label><select className="input" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setCountyId(''); }}><option value="">انتخاب...</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="label">شهرستان</label><select className="input" value={countyId} onChange={(e) => setCountyId(e.target.value)}><option value="">انتخاب...</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </>
        )}
        {level === 'neighborhoods' && (
          <>
            <div><label className="label">استان</label><select className="input" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setCountyId(''); setCityId(''); }}><option value="">انتخاب...</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="label">شهرستان</label><select className="input" value={countyId} onChange={(e) => { setCountyId(e.target.value); setCityId(''); }}><option value="">انتخاب...</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">شهر</label><select className="input" value={cityId} onChange={(e) => setCityId(e.target.value)}><option value="">انتخاب...</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </>
        )}
        <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded" /><span className="text-sm text-slate-700">فعال</span></label></div>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary w-full">{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
      </div>
    </Modal>
  );
}
