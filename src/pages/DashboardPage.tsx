import { useEffect, useState, useCallback } from 'react';
import {
  Phone,
  Clock,
  Flame,
  Users,
  Home,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Calendar,
  Target,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  formatPrice,
  formatDate,
  getTemperatureInfo,
  getTransactionLabel,
  getCategoryLabel,
  timeAgo,
  daysUntil,
} from '@/lib/constants';
import { StatCard, EmptyState, Spinner } from '@/components/ui';

interface DashboardData {
  todayFollowups: any[];
  overdueFollowups: any[];
  hotCustomers: any[];
  recentCalls: any[];
  newProperties: any[];
  newCustomers: any[];
  deals: any[];
  stats: {
    activeProperties: number;
    activeCustomers: number;
    hotCustomers: number;
    totalCalls: number;
    pendingFollowups: number;
    todayTasks: number;
    deals: number;
    completedDeals: number;
  };
}

export function DashboardPage({ onNavigate }: { onNavigate: (page: string, params?: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [
      todayFollowupsRes,
      overdueFollowupsRes,
      hotCustomersRes,
      recentCallsRes,
      newPropertiesRes,
      newCustomersRes,
      dealsRes,
      activePropsRes,
      activeCustRes,
      hotCustRes,
      callsRes,
      pendingFuRes,
      todayTasksRes,
      dealsCountRes,
      completedDealsRes,
    ] = await Promise.all([
      supabase.from('follow_ups').select('*, customers(first_name, last_name, mobile), owners(name, phone), properties(title)').eq('status', 'pending').eq('due_date', today).order('due_time').limit(10),
      supabase.from('follow_ups').select('*, customers(first_name, last_name, mobile), owners(name, phone), properties(title)').eq('status', 'pending').lt('due_date', today).order('due_date').limit(10),
      supabase.from('customers').select('*').eq('temperature', 'hot').eq('status', 'active').order('updated_at', { ascending: false }).limit(5),
      supabase.from('calls').select('*, customers(first_name, last_name), owners(name)').order('call_date', { ascending: false }).limit(5),
      supabase.from('properties').select('id, title, transaction_type, category, property_type, sale_price, deposit_price, monthly_rent, city_id, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
      supabase.from('customers').select('id, first_name, last_name, mobile, temperature, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('deals').select('*, customers(first_name, last_name), properties(title)').order('created_at', { ascending: false }).limit(5),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('status', 'active'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('temperature', 'hot').eq('status', 'active'),
      supabase.from('calls').select('id', { count: 'exact', head: true }),
      supabase.from('follow_ups').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('due_date', today),
      supabase.from('deals').select('id', { count: 'exact', head: true }),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    ]);

    setData({
      todayFollowups: todayFollowupsRes.data ?? [],
      overdueFollowups: overdueFollowupsRes.data ?? [],
      hotCustomers: hotCustomersRes.data ?? [],
      recentCalls: recentCallsRes.data ?? [],
      newProperties: newPropertiesRes.data ?? [],
      newCustomers: newCustomersRes.data ?? [],
      deals: dealsRes.data ?? [],
      stats: {
        activeProperties: activePropsRes.count ?? 0,
        activeCustomers: activeCustRes.count ?? 0,
        hotCustomers: hotCustRes.count ?? 0,
        totalCalls: callsRes.count ?? 0,
        pendingFollowups: pendingFuRes.count ?? 0,
        todayTasks: todayTasksRes.count ?? 0,
        deals: dealsCountRes.count ?? 0,
        completedDeals: completedDealsRes.count ?? 0,
      },
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size={32} />
      </div>
    );
  }

  const hasOverdue = data.overdueFollowups.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero - Most Important Action */}
      <div className="bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Target size={20} className="text-slate-300" />
          <h2 className="text-sm font-medium text-slate-300">مهم‌ترین کار الان</h2>
        </div>
        {hasOverdue ? (
          <div className="animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={20} className="text-red-400" />
              <span className="text-lg font-bold">پیگیری عقب‌افتاده</span>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              شما {data.overdueFollowups.length} پیگیری عقب‌افتاده دارید. همین حالا اقدام کنید!
            </p>
            <button
              onClick={() => onNavigate('followups', { filter: 'overdue' })}
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              مشاهده و اقدام
              <ArrowLeft size={16} />
            </button>
          </div>
        ) : data.todayFollowups.length > 0 ? (
          <div className="animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={20} className="text-yellow-400" />
              <span className="text-lg font-bold">پیگیری‌های امروز</span>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              امروز {data.todayFollowups.length} پیگیری برای انجام دارید.
            </p>
            <button
              onClick={() => onNavigate('followups', { filter: 'today' })}
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              مشاهده پیگیری‌ها
              <ArrowLeft size={16} />
            </button>
          </div>
        ) : data.hotCustomers.length > 0 ? (
          <div className="animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={20} className="text-orange-400" />
              <span className="text-lg font-bold">مشتریان داغ</span>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              {data.hotCustomers.length} مشتری داغ نیاز به توجه دارند.
            </p>
            <button
              onClick={() => onNavigate('customers', { filter: 'hot' })}
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              مشاهده مشتریان داغ
              <ArrowLeft size={16} />
            </button>
          </div>
        ) : (
          <div className="animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={20} className="text-green-400" />
              <span className="text-lg font-bold">همه چیز مرتب است</span>
            </div>
            <p className="text-sm text-slate-300">پیگیری عقب‌افتاده‌ای ندارید. کارتان عالی است!</p>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="فایل‌های فعال" value={data.stats.activeProperties} icon={<Home size={18} />} color="blue" onClick={() => onNavigate('properties')} />
        <StatCard label="مشتریان فعال" value={data.stats.activeCustomers} icon={<Users size={18} />} color="teal" onClick={() => onNavigate('customers')} />
        <StatCard label="مشتریان داغ" value={data.stats.hotCustomers} icon={<Flame size={18} />} color="red" onClick={() => onNavigate('customers', { filter: 'hot' })} />
        <StatCard label="پیگیری‌های معوق" value={data.stats.pendingFollowups} icon={<Clock size={18} />} color="orange" onClick={() => onNavigate('followups')} />
        <StatCard label="تماس‌ها" value={data.stats.totalCalls} icon={<Phone size={18} />} color="slate" onClick={() => onNavigate('calls')} />
        <StatCard label="وظایف امروز" value={data.stats.todayTasks} icon={<CheckCircle size={18} />} color="green" onClick={() => onNavigate('tasks')} />
        <StatCard label="معاملات" value={data.stats.deals} icon={<TrendingUp size={18} />} color="slate" onClick={() => onNavigate('deals')} />
        <StatCard label="معاملات موفق" value={data.stats.completedDeals} icon={<CheckCircle size={18} />} color="green" onClick={() => onNavigate('deals')} />
      </div>

      {/* Overdue Follow-ups */}
      {data.overdueFollowups.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-red-50 border-b border-red-100">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              <h3 className="text-sm font-bold text-red-700">پیگیری‌های عقب‌افتاده</h3>
            </div>
            <button onClick={() => onNavigate('followups', { filter: 'overdue' })} className="text-xs text-red-500 font-medium">
              مشاهده همه
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.overdueFollowups.slice(0, 3).map((fu: any) => (
              <div key={fu.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {fu.customers ? `${fu.customers.first_name} ${fu.customers.last_name}` : fu.owners?.name ?? 'نامشخص'}
                    </p>
                    <p className="text-xs text-slate-400">{fu.reason ?? 'پیگیری'}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs text-red-500 font-medium">{daysUntil(fu.due_date)} روز عقب</p>
                  <p className="text-[10px] text-slate-400">{formatDate(fu.due_date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Follow-ups & Hot Customers */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Today's Follow-ups */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-blue-500" />
              <h3 className="text-sm font-bold text-slate-700">پیگیری‌های امروز</h3>
            </div>
            <button onClick={() => onNavigate('followups', { filter: 'today' })} className="text-xs text-blue-500 font-medium">
              همه
            </button>
          </div>
          {data.todayFollowups.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.todayFollowups.slice(0, 4).map((fu: any) => (
                <div key={fu.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                      <Phone size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {fu.customers ? `${fu.customers.first_name} ${fu.customers.last_name}` : fu.owners?.name ?? 'نامشخص'}
                      </p>
                      <p className="text-xs text-slate-400">{fu.reason ?? 'پیگیری'} {fu.due_time ? `• ${fu.due_time}` : ''}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle size={40} />} title="پیگیری برای امروز ندارید" />
          )}
        </div>

        {/* Hot Customers */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-red-500" />
              <h3 className="text-sm font-bold text-slate-700">مشتریان داغ</h3>
            </div>
            <button onClick={() => onNavigate('customers', { filter: 'hot' })} className="text-xs text-red-500 font-medium">
              همه
            </button>
          </div>
          {data.hotCustomers.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.hotCustomers.map((cust: any) => (
                <div
                  key={cust.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onNavigate('customers', { id: cust.id })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600">
                      {cust.first_name?.[0] ?? '؟'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{cust.first_name} {cust.last_name}</p>
                      <p className="text-xs text-slate-400" dir="ltr">{cust.mobile}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(cust.last_contact)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Users size={40} />} title="مشتری داغ ندارید" />
          )}
        </div>
      </div>

      {/* New Properties & Recent Calls */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* New Properties */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Home size={18} className="text-teal-500" />
              <h3 className="text-sm font-bold text-slate-700">فایل‌های جدید</h3>
            </div>
            <button onClick={() => onNavigate('properties')} className="text-xs text-teal-500 font-medium">
              همه
            </button>
          </div>
          {data.newProperties.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.newProperties.map((prop: any) => (
                <div
                  key={prop.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onNavigate('properties', { id: prop.id })}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{prop.title}</p>
                    <p className="text-xs text-slate-400">
                      {getTransactionLabel(prop.transaction_type)} • {getCategoryLabel(prop.category)}
                    </p>
                  </div>
                  {prop.sale_price != null && (
                    <span className="text-xs font-medium text-slate-600">{formatPrice(prop.sale_price)}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Home size={40} />} title="فایلی ثبت نشده" />
          )}
        </div>

        {/* Recent Calls */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700">تماس‌های اخیر</h3>
            </div>
            <button onClick={() => onNavigate('calls')} className="text-xs text-slate-500 font-medium">
              همه
            </button>
          </div>
          {data.recentCalls.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.recentCalls.map((call: any) => (
                <div key={call.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <Phone size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {call.customers ? `${call.customers.first_name} ${call.customers.last_name}` : call.owners?.name ?? 'نامشخص'}
                      </p>
                      <p className="text-xs text-slate-400">{call.result ?? 'تماس'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(call.call_date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Phone size={40} />} title="تماسی ثبت نشده" />
          )}
        </div>
      </div>

      {/* Recent Deals */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-green-500" />
            <h3 className="text-sm font-bold text-slate-700">معاملات اخیر</h3>
          </div>
          <button onClick={() => onNavigate('deals')} className="text-xs text-green-500 font-medium">
            همه
          </button>
        </div>
        {data.deals.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.deals.map((deal: any) => (
              <div
                key={deal.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onNavigate('deals', { id: deal.id })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {deal.customers ? `${deal.customers.first_name} ${deal.customers.last_name}` : 'معامله'}
                    </p>
                    <p className="text-xs text-slate-400">{getTransactionLabel(deal.transaction_type)} • {deal.status}</p>
                  </div>
                </div>
                {deal.deal_value != null && (
                  <span className="text-xs font-medium text-slate-600">{formatPrice(deal.deal_value)} ت</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<TrendingUp size={40} />} title="معامله‌ای ثبت نشده" />
        )}
      </div>
    </div>
  );
}
