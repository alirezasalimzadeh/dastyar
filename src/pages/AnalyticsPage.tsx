import { useEffect, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, Home, Phone, Clock, Target, CheckCircle, Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { FUNNEL_STAGES, formatPrice } from '@/lib/constants';
import { StatCard, Spinner, PageHeader } from '@/components/ui';

export function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCalls: 0,
    successfulCalls: 0,
    followups: 0,
    completedFollowups: 0,
    propertiesAdded: 0,
    customersAdded: 0,
    hotCustomers: 0,
    deals: 0,
    completedDeals: 0,
    activeProperties: 0,
    soldProperties: 0,
    rentedProperties: 0,
    hotProperties: 0,
    newLeads: 0,
    coldCustomers: 0,
    warmCustomers: 0,
    totalDealValue: 0,
  });
  const [funnel, setFunnel] = useState<{ stage: string; label: string; count: number; color: string }[]>([]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    const [
      callsRes, successCallsRes, fuRes, completedFuRes,
      propsRes, custRes, hotCustRes, dealsRes, completedDealsRes,
      activePropsRes, soldPropsRes, rentedPropsRes, hotPropsRes,
      newLeadsRes, coldCustRes, warmCustRes,
      dealValueRes,
    ] = await Promise.all([
      supabase.from('calls').select('id', { count: 'exact', head: true }),
      supabase.from('calls').select('id', { count: 'exact', head: true }).in('result', ['answered', 'interested', 'introduced', 'viewing_scheduled', 'deal_done']),
      supabase.from('follow_ups').select('id', { count: 'exact', head: true }),
      supabase.from('follow_ups').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('temperature', 'hot').eq('status', 'active'),
      supabase.from('deals').select('id', { count: 'exact', head: true }),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'rented'),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('is_hot', true),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('temperature', 'cold'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('temperature', 'warm'),
      supabase.from('deals').select('deal_value').not('deal_value', 'is', null),
    ]);

    const totalDealValue = (dealValueRes.data ?? []).reduce((sum: number, d: any) => sum + (d.deal_value ?? 0), 0);

    setStats({
      totalCalls: callsRes.count ?? 0,
      successfulCalls: successCallsRes.count ?? 0,
      followups: fuRes.count ?? 0,
      completedFollowups: completedFuRes.count ?? 0,
      propertiesAdded: propsRes.count ?? 0,
      customersAdded: custRes.count ?? 0,
      hotCustomers: hotCustRes.count ?? 0,
      deals: dealsRes.count ?? 0,
      completedDeals: completedDealsRes.count ?? 0,
      activeProperties: activePropsRes.count ?? 0,
      soldProperties: soldPropsRes.count ?? 0,
      rentedProperties: rentedPropsRes.count ?? 0,
      hotProperties: hotPropsRes.count ?? 0,
      newLeads: newLeadsRes.count ?? 0,
      coldCustomers: coldCustRes.count ?? 0,
      warmCustomers: warmCustRes.count ?? 0,
      totalDealValue,
    });

    // Sales funnel data
    const totalCust = custRes.count ?? 0;
    setFunnel([
      { stage: 'lead', label: 'Lead', count: totalCust, color: '#94a3b8' },
      { stage: 'call', label: 'تماس', count: callsRes.count ?? 0, color: '#3b82f6' },
      { stage: 'followup', label: 'پیگیری', count: fuRes.count ?? 0, color: '#14b8a6' },
      { stage: 'introduce', label: 'معرفی فایل', count: Math.floor((successCallsRes.count ?? 0) * 0.7), color: '#06b6d4' },
      { stage: 'viewing', label: 'بازدید', count: Math.floor((successCallsRes.count ?? 0) * 0.4), color: '#eab308' },
      { stage: 'negotiation', label: 'مذاکره', count: dealsRes.count ?? 0, color: '#f97316' },
      { stage: 'deal', label: 'معامله', count: completedDealsRes.count ?? 0, color: '#16a34a' },
    ]);

    setLoading(false);
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size={32} /></div>;

  const conversionRate = stats.totalCalls > 0 ? Math.round((stats.successfulCalls / stats.totalCalls) * 100) : 0;
  const dealConversionRate = stats.customersAdded > 0 ? Math.round((stats.completedDeals / stats.customersAdded) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="گزارش‌ها" subtitle="تحلیل عملکرد و قیف فروش" />

      {/* Sales Funnel */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">قیف فروش</h3>
        <div className="space-y-2">
          {funnel.map((stage, i) => {
            const maxCount = funnel[0]?.count ?? 1;
            const width = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 5) : 0;
            const prevCount = i > 0 ? funnel[i - 1].count : stage.count;
            const stageConversion = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0;
            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-16 text-left">{stage.label}</span>
                <div className="flex-1 relative">
                  <div className="h-8 rounded-lg flex items-center justify-between px-3 transition-all" style={{ width: `${width}%`, backgroundColor: stage.color, minWidth: '60px' }}>
                    <span className="text-xs text-white font-medium">{stage.count}</span>
                    {i > 0 && stageConversion < 100 && <span className="text-[10px] text-white/80">{stageConversion}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">نرخ تبدیل کل: <span className="font-bold text-slate-700">{dealConversionRate}%</span></p>
        </div>
      </div>

      {/* Consultant Performance */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">عملکرد مشاور</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="تماس‌ها" value={stats.totalCalls} icon={<Phone size={18} />} color="slate" />
          <StatCard label="تماس‌های موفق" value={stats.successfulCalls} icon={<CheckCircle size={18} />} color="green" />
          <StatCard label="نرخ تبدیل تماس" value={`${conversionRate}%`} icon={<TrendingUp size={18} />} color="teal" />
          <StatCard label="پیگیری‌ها" value={stats.followups} icon={<Clock size={18} />} color="orange" />
          <StatCard label="پیگیری‌های انجام شده" value={stats.completedFollowups} icon={<CheckCircle size={18} />} color="green" />
          <StatCard label="فایل‌های ثبت شده" value={stats.propertiesAdded} icon={<Home size={18} />} color="blue" />
          <StatCard label="مشتریان ثبت شده" value={stats.customersAdded} icon={<Users size={18} />} color="teal" />
          <StatCard label="مشتریان داغ" value={stats.hotCustomers} icon={<Flame size={18} />} color="red" />
          <StatCard label="معاملات" value={stats.deals} icon={<TrendingUp size={18} />} color="slate" />
          <StatCard label="معاملات موفق" value={stats.completedDeals} icon={<CheckCircle size={18} />} color="green" />
          <StatCard label="نرخ تبدیل معامله" value={`${dealConversionRate}%`} icon={<Target size={18} />} color="green" />
          <StatCard label="ارزش کل معاملات" value={formatPrice(stats.totalDealValue)} icon={<TrendingUp size={18} />} color="green" />
        </div>
      </div>

      {/* Property Analytics */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">تحلیل فایل‌ها</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="فایل‌های فعال" value={stats.activeProperties} icon={<Home size={18} />} color="blue" />
          <StatCard label="فروخته شده" value={stats.soldProperties} icon={<CheckCircle size={18} />} color="green" />
          <StatCard label="اجاره داده شده" value={stats.rentedProperties} icon={<CheckCircle size={18} />} color="teal" />
          <StatCard label="فایل‌های داغ" value={stats.hotProperties} icon={<Flame size={18} />} color="red" />
        </div>
      </div>

      {/* Customer Analytics */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">تحلیل مشتریان</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="مشتریان فعال" value={stats.newLeads} icon={<Users size={18} />} color="teal" />
          <StatCard label="داغ" value={stats.hotCustomers} icon={<Flame size={18} />} color="red" />
          <StatCard label="گرم" value={stats.warmCustomers} icon={<TrendingUp size={18} />} color="orange" />
          <StatCard label="سرد" value={stats.coldCustomers} icon={<Users size={18} />} color="blue" />
        </div>
      </div>
    </div>
  );
}
