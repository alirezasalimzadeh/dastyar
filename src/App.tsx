import { Suspense, lazy, useState } from 'react';
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

  const navigate = (newPage: string, newParams: Record<string, unknown> = {}) => {
    setPage(newPage);
    setParams(newParams);
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
        return <CustomersPage initialId={params.id as string | undefined} initialFilter={params.filter as string | undefined} />;
      case 'owners':
        return <OwnersPage initialId={params.id as string | undefined} onNavigate={navigate} />;
      case 'colleagues':
        return <ColleaguesPage onNavigate={navigate} />;
      case 'properties':
        return <PropertiesPage initialId={params.id as string | undefined} onNavigate={navigate} />;
      case 'matches':
        return <MatchesPage initialPropertyId={params.id as string | undefined} />;
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
      <Suspense fallback={<FullPageSpinner />}>
        {renderPage()}
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
