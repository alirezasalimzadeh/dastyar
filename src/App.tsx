import { Suspense, lazy, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/pages/AuthPage';
import { Layout } from '@/components/Layout';
import { FullPageSpinner } from '@/components/ui';

// هر صفحه در یک فایل جدا بیلد می‌شود تا حجم بارگذاری اولیه کم شود
// و سرویس‌ورکر بتواند آن‌ها را برای حالت آفلاین کش کند
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const OwnersPage = lazy(() => import('@/pages/OwnersPage').then((m) => ({ default: m.OwnersPage })));
const ColleaguesPage = lazy(() => import('@/pages/ColleaguesPage').then((m) => ({ default: m.ColleaguesPage })));
const PropertiesPage = lazy(() => import('@/pages/PropertiesPage').then((m) => ({ default: m.PropertiesPage })));
const MatchesPage = lazy(() => import('@/pages/MatchesPage').then((m) => ({ default: m.MatchesPage })));
const CallsPage = lazy(() => import('@/pages/CallsPage').then((m) => ({ default: m.CallsPage })));
const FollowUpsPage = lazy(() => import('@/pages/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })));
const TasksPage = lazy(() => import('@/pages/TasksPage').then((m) => ({ default: m.TasksPage })));
const DealsPage = lazy(() => import('@/pages/DealsPage').then((m) => ({ default: m.DealsPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [params, setParams] = useState<Record<string, unknown>>({});
  // تاریخچهٔ ناوبری: برای اینکه «بازگشت» کاربر را به همان صفحه‌ای برگرداند که از آن آمده
  const [history, setHistory] = useState<{ page: string; params: Record<string, unknown> }[]>([]);

  const navigate = (newPage: string, newParams: Record<string, unknown> = {}) => {
    setHistory((h) => [...h, { page, params }]);
    setPage(newPage);
    setParams(newParams);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setPage(prev.page);
    setParams(prev.params);
  };

  if (loading) return <FullPageSpinner />;
  if (!user) return <AuthPage />;
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="card max-w-sm space-y-4 p-6 text-center">
          <h1 className="text-lg font-bold text-slate-800">حساب فعال نیست</h1>
          <p className="text-sm leading-6 text-slate-500">برای این حساب پروفایل فعال برنامه وجود ندارد.</p>
          <button type="button" onClick={signOut} className="btn-secondary w-full">بازگشت به ورود</button>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'customers':
        return <CustomersPage initialId={params.id as string | undefined} initialFilter={params.filter as string | undefined} onNavigate={navigate} onGoBack={goBack} />;
      case 'owners':
        return <OwnersPage initialId={params.id as string | undefined} onNavigate={navigate} />;
      case 'colleagues':
        return <ColleaguesPage onNavigate={navigate} />;
      case 'properties':
        return <PropertiesPage initialId={params.id as string | undefined} onNavigate={navigate} onGoBack={goBack} />;
      case 'matches':
        return <MatchesPage initialPropertyId={params.propertyId as string | undefined} initialCustomerId={params.customerId as string | undefined} onNavigate={navigate} onGoBack={goBack} canGoBack={history.length > 0} />;
      case 'calls':
        return <CallsPage />;
      case 'followups':
        return <FollowUpsPage initialFilter={params.filter as string | undefined} />;
      case 'tasks':
        return <TasksPage />;
      case 'deals':
        return <DealsPage initialId={params.id as string | undefined} />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <>
      <OverflowDebugger />
      <Layout currentPage={page} onNavigate={navigate}>
        <Suspense fallback={<FullPageSpinner />}>
          {renderPage()}
        </Suspense>
      </Layout>
    </>
  );
}

/** ابزار موقتِ تشخیص: اگر چیزی عرض صفحه را بیش از عرض گوشی کند،
 *  عناصر مقصر را در بنر قرمز بالای صفحه فهرست می‌کند (فقط وقتی overflow هست).
 *  بعد از عیب‌یابی حذف می‌شود. */
function OverflowDebugger() {
  useEffect(() => {
    const check = () => {
      const vw = window.innerWidth;
      const sw = document.documentElement.scrollWidth;
      let el = document.getElementById('__overflow_debug') as HTMLDivElement | null;
      if (sw <= vw + 1) {
        el?.remove();
        return;
      }
      const bad: string[] = [];
      document.querySelectorAll('body *').forEach((node) => {
        const target = node as HTMLElement;
        const r = target.getBoundingClientRect();
        if (r.width > 0 && (r.left < -1 || r.right > vw + 1)) {
          const cls = (typeof target.className === 'string' ? target.className : '')
            .trim().split(/\s+/).slice(0, 5).join('.');
          const text = target.childElementCount === 0 ? (target.textContent ?? '').trim().slice(0, 30) : '';
          bad.push(`${target.tagName.toLowerCase()}${cls ? `.${cls}` : ''} left=${Math.round(r.left)} right=${Math.round(r.right)} w=${Math.round(r.width)}${text ? ` «${text}»` : ''}`);
        }
      });
      if (!el) {
        el = document.createElement('div');
        el.id = '__overflow_debug';
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#b91c1c;color:#fff;font-family:monospace;font-size:10px;line-height:1.6;padding:8px 10px;white-space:pre-wrap;word-break:break-all;max-height:45vh;overflow:auto;direction:ltr;text-align:left;border-bottom:2px solid #7f1d1d;';
        document.body.appendChild(el);
      }
      el.textContent = `OVERFLOW: viewport=${vw}px document=${sw}px (excess=${sw - vw}px)\noffending elements (top 30):\n` + bad.slice(0, 30).join('\n');
    };
    const first = window.setTimeout(check, 800);
    const timer = window.setInterval(check, 1500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.getElementById('__overflow_debug')?.remove();
    };
  }, []);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
