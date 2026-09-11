import { Component, Suspense, lazy, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/pages/AuthPage';
import { Layout } from '@/components/Layout';
import { FullPageSpinner } from '@/components/ui';

// هر صفحه در یک فایل جدا بیلد می‌شود تا حجم بارگذاری اولیه کم شود
// و سرویس‌ورکر بتواند آن‌ها را برای حالت آفلاین کش کند
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const OwnersPage = lazy(() => import('@/pages/OwnersPage').then((m) => ({ default: m.OwnersPage })));
const BuildersPage = lazy(() => import('@/pages/BuildersPage').then((m) => ({ default: m.BuildersPage })));
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
  // هر ناوبری، صفحهٔ مقصد را تازه (remount) می‌کند — تا «رفتن به همان صفحه‌ای
  // که روی آن هستیم» (مثلاً دکمهٔ فایل‌ها در حالی که در جزئیات فایلیم)
  // به نمای تازهٔ فهرست برسد و نه بی‌اثر بماند
  const [navSeq, setNavSeq] = useState(0);

  const navigate = (newPage: string, newParams: Record<string, unknown> = {}) => {
    setHistory((h) => [...h, { page, params }]);
    setNavSeq((s) => s + 1);
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
      case 'builders':
        return <BuildersPage initialId={params.id as string | undefined} onNavigate={navigate} />;
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
    <Layout currentPage={page} onNavigate={navigate}>
      <PageErrorBoundary key={navSeq} onRetry={() => setNavSeq((s) => s + 1)}>
        <Suspense fallback={<FullPageSpinner />}>
          {renderPage()}
        </Suspense>
      </PageErrorBoundary>
    </Layout>
  );
}

/** اگر رندر صفحه خطا بدهد (مثلاً خطای شبکه/چانک در گوشی)، به‌جای صفحهٔ
 *  سفید، پیام + دکمهٔ تلاش دوباره نشان داده شود و منوها دست‌نخورده بمانند. */
class PageErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[page-error]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card mx-auto max-w-md space-y-3 p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-red-500" />
          <h2 className="text-sm font-bold text-slate-800">خطا در نمایش این صفحه</h2>
          <p className="text-xs leading-6 text-slate-500">ممکن است مشکل موقت شبکه یا بارگذاری باشد. یک بار دیگر امتحان کن.</p>
          <p dir="ltr" className="break-words rounded-lg bg-slate-50 p-2 text-left font-mono text-[10px] text-slate-400">
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <button
            type="button"
            className="btn-primary mx-auto"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry();
            }}
          >
            تلاش دوباره
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
