import { useEffect, useState, useCallback } from 'react';
import { User, Phone, Mail, MapPin, Calendar, Briefcase, Edit, Save, X, Camera, TrendingUp, Award, Activity as ActivityIcon, Clock, CheckCircle2, Target, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getUserRoleLabel, formatDate, timeAgo, formatPrice, stripPhoneSpaces } from '@/lib/constants';
import { Spinner, PageHeader, StatCard, Modal } from '@/components/ui';

type Tab = 'overview' | 'edit' | 'activity';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    activeListings: 0, activeCustomers: 0, hotCustomers:  0,
    totalCalls: 0, successfulCalls: 0, pendingFollowups: 0, completedFollowups: 0,
    deals: 0, completedDeals: 0, totalDealValue: 0,
  thisMonthCalls: 0, thisMonthDeals: 0,
  avgResponseTime: 0,
  successRate: 0,
  activityScore: 0,
  streakDays: 0,
  lastActiveDate: '',
  matchCount: 0,
    });
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    first_name: '', last_name: '', mobile: '', email: '',
    city: '', areas_of_activity: '', years_of_experience: '', specialization: '', personal_notes: '',
  });

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      activePropsRes, activeCustRes, hotCustRes,
      callsRes, successCallsRes, pendingFuRes, completedFuRes,
      dealsRes, completedDealsRes, dealValuesRes, monthCallsRes, monthDealsRes, actRes, matchRes,
    ] = await Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('assigned_consultant_id', user.id).eq('status', 'active'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('assigned_consultant_id', user.id).eq('status', 'active'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('assigned_consultant_id', user.id).eq('temperature', 'hot'),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('consultant_id', user.id),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('consultant_id', user.id).in('result', ['answered', 'interested', 'introduced', 'viewing_scheduled', 'deal_done']),
      supabase.from('follow_ups').select('id', { count: 'exact', head: true }).eq('assigned_consultant_id', user.id).eq('status', 'pending'),
      supabase.from('follow_ups').select('id', { count: 'exact', head: true }).eq('assigned_consultant_id', user.id).eq('status', 'completed'),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('consultant_id', user.id),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('consultant_id', user.id).eq('status', 'completed'),
      supabase.from('deals').select('deal_value').eq('consultant_id', user.id).eq('status', 'completed'),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('consultant_id', user.id).gte('call_date', monthStart),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('consultant_id', user.id).gte('created_at', monthStart),
      supabase.from('activities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('property_matches').select('id', { count: 'exact', head: true }),
    ]);

    const totalDealValue = (dealValuesRes.data ?? []).reduce((sum: number, d: any) => sum + (d.deal_value ?? 0), 0);
    const successRate = (callsRes.count ?? 0) > 0 ? Math.round(((successCallsRes.count ?? 0) / (callsRes.count ?? 0)) * 100) : 0;
    const activityScore = Math.min(100, Math.round(((callsRes.count ?? 0) * 2 + (completedFuRes.count ?? 0) * 3 + (completedDealsRes.count ?? 0) * 10) / 5));

    // Calculate streak (simplified: days with activity in last 7 days)
    const recentDates = new Set<string>();
    (actRes.data ?? []).forEach((a: any) => {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      recentDates.add(key);
    });
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (recentDates.has(key)) streak++;
      else break;
    }

    setStats({
      activeListings: activePropsRes.count ?? 0, activeCustomers: activeCustRes.count ?? 0, hotCustomers: hotCustRes.count ?? 0,
      totalCalls: callsRes.count ?? 0, successfulCalls: successCallsRes.count ?? 0,
      pendingFollowups: pendingFuRes.count ?? 0, completedFollowups: completedFuRes.count ?? 0,
      deals: dealsRes.count ?? 0, completedDeals: completedDealsRes.count ?? 0,
      totalDealValue, thisMonthCalls: monthCallsRes.count ?? 0, thisMonthDeals: monthDealsRes.count ?? 0,
      avgResponseTime: 0, successRate, activityScore, streakDays: streak,
      lastActiveDate: actRes.data?.[0]?.created_at ?? '', matchCount: matchRes.count ?? 0,
    });
    setActivities(actRes.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
    if (profile) {
      setForm({
        first_name: profile.first_name ?? '', last_name: profile.last_name ?? '',
        mobile: profile.mobile ?? '', email: profile.email ?? '',
        city: profile.city ?? '', areas_of_activity: profile.areas_of_activity ?? '',
        years_of_experience: profile.years_of_experience?.toString() ?? '',
        specialization: profile.specialization ?? '', personal_notes: profile.personal_notes ?? '',
      });
    }
  }, [loadProfile, profile]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').update({
      first_name: form.first_name || null, last_name: form.last_name || null,
      mobile: form.mobile || null, email: form.email || null,
      city: form.city || null, areas_of_activity: form.areas_of_activity || null,
      years_of_experience: form.years_of_experience ? Number(form.years_of_experience) : null,
      specialization: form.specialization || null, personal_notes: form.personal_notes || null,
    }).eq('id', user?.id);
    await refreshProfile();
    setSaving(false);
    setTab('overview');
  };

  if (loading || !profile) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  const conversionRate = stats.totalCalls > 0 ? Math.round((stats.successfulCalls / stats.totalCalls) * 100) : 0;
  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.trim() || '؟';

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title="پروفایل" subtitle="مدیریت حساب کاربری و عملکرد" />

      {/* Profile Header Card */}
      <div className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-l from-slate-700 to-slate-900"></div>
        <div className="px-5 pb-5 -mt-10">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center text-2xl font-bold text-slate-700 border-4 border-white">
              {initials}
            </div>
            <div className="flex-1 pb-1">
              <h2 className="text-lg font-bold text-slate-800">{profile.first_name} {profile.last_name}</h2>
              <p className="text-sm text-slate-500">{getUserRoleLabel(profile.role)}</p>
            </div>
            <div className="flex gap-2 pb-1">
              <button onClick={() => setTab('edit')} className="btn-secondary text-sm"><Edit size={15} /> ویرایش</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-400">
            {profile.mobile && <span className="flex items-center gap-1" dir="ltr"><Phone size={12} /> {profile.mobile}</span>}
            {profile.email && <span className="flex items-center gap-1" dir="ltr"><Mail size={12} /> {profile.email}</span>}
            {profile.city && <span className="flex items-center gap-1"><MapPin size={12} /> {profile.city}</span>}
            <span className="flex items-center gap-1"><Calendar size={12} /> عضو از {formatDate(profile.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {([
          { key: 'overview', label: 'نمای کلی', icon: TrendingUp },
          { key: 'edit', label: 'ویرایش', icon: Edit },
          { key: 'activity', label: 'فعالیت‌ها', icon: ActivityIcon },
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

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Performance Score */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700">امتیاز عملکرد</h3>
              <Award size={18} className="text-amber-500" />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none" stroke="#64748b" strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 - (stats.activityScore / 100) * 2 * Math.PI * 34}
                    strokeLinecap="round" className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-slate-700">{stats.activityScore}</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xs text-slate-400">رشته فعالیت (روز)</p>
                  <p className="text-lg font-bold text-green-600">{stats.streakDays}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">نرخ موفقیت تماس</p>
                  <p className="text-lg font-bold text-blue-600">{stats.successRate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">تماس این ماه</p>
                  <p className="text-lg font-bold text-teal-600">{stats.thisMonthCalls}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">معامله این ماه</p>
                  <p className="text-lg font-bold text-orange-600">{stats.thisMonthDeals}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="فایل‌های فعال" value={stats.activeListings} icon={<Target size={18} />} color="blue" />
            <StatCard label="مشتریان فعال" value={stats.activeCustomers} color="teal" />
            <StatCard label="مشتریان داغ" value={stats.hotCustomers} color="red" />
            <StatCard label="تطبیق‌ها" value={stats.matchCount} color="slate" />
            <StatCard label="تماس‌ها" value={stats.totalCalls} color="slate" />
            <StatCard label="تماس‌های موفق" value={stats.successfulCalls} color="green" />
            <StatCard label="نرخ تبدیل" value={`${conversionRate}%`} color="green" />
            <StatCard label="پیگیری‌های معوق" value={stats.pendingFollowups} color="orange" />
          </div>

          {/* Deals Summary */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} className="text-green-600" />
              <h3 className="text-sm font-bold text-slate-700">خلاصه معاملات</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400">کل معاملات</p>
                <p className="text-xl font-bold text-slate-700">{stats.deals}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">تکمیل شده</p>
                <p className="text-xl font-bold text-green-600">{stats.completedDeals}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">ارزش کل</p>
                <p className="text-xl font-bold text-slate-700">{formatPrice(stats.totalDealValue)}</p>
              </div>
            </div>
          </div>

          {/* Professional Info */}
          {(profile.specialization || profile.areas_of_activity || profile.personal_notes || profile.years_of_experience != null) && (
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Briefcase size={16} /> اطلاعات حرفه‌ای</h3>
              {profile.specialization && <InfoRow label="تخصص" value={profile.specialization} />}
              {profile.areas_of_activity && <InfoRow label="مناطق فعالیت" value={profile.areas_of_activity} />}
              {profile.years_of_experience != null && <InfoRow label="سابقه" value={`${profile.years_of_experience} سال`} />}
              {profile.personal_notes && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">یادداشت شخصی</p>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{profile.personal_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Tab */}
      {tab === 'edit' && (
        <div className="card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">ویرایش پروفایل</h3>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm"><Save size={15} /> ذخیره</button>
              <button onClick={() => setTab('overview')} className="btn-secondary text-sm"><X size={15} /> انصراف</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">نام</label><input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><label className="label">نام خانوادگی</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div><label className="label">موبایل</label><input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: stripPhoneSpaces(e.target.value) })} dir="ltr" /></div>
            <div><label className="label">ایمیل</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></div>
            <div><label className="label">شهر</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><label className="label">سال‌های تجربه</label><input className="input" value={form.years_of_experience} onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })} dir="ltr" type="number" /></div>
            <div><label className="label">مناطق فعالیت</label><input className="input" value={form.areas_of_activity} onChange={(e) => setForm({ ...form, areas_of_activity: e.target.value })} placeholder="مثلا: سعادت‌آباد، زعفرانیه" /></div>
            <div><label className="label">تخصص</label><input className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="مثلا: آپارتمان مسکونی" /></div>
          </div>
          <div><label className="label">یادداشت شخصی</label><textarea className="input min-h-[80px]" value={form.personal_notes} onChange={(e) => setForm({ ...form, personal_notes: e.target.value })} /></div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="card overflow-hidden animate-fade-in">
          <h3 className="px-5 py-3 border-b border-slate-100 text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <Clock size={16} /> تاریخچه فعالیت
          </h3>
          {activities.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {activities.map((act) => (
                <div key={act.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 size={15} className="text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{act.description ?? act.action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(act.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-400">فعالیتی ثبت نشده</p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
}
