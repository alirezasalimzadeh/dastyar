import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/pages/AuthPage';
import { Layout } from '@/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { OwnersPage } from '@/pages/OwnersPage';
import { ColleaguesPage } from '@/pages/ColleaguesPage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { MatchesPage } from '@/pages/MatchesPage';
import { CallsPage } from '@/pages/CallsPage';
import { FollowUpsPage } from '@/pages/FollowUpsPage';
import { TasksPage } from '@/pages/TasksPage';
import { DealsPage } from '@/pages/DealsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { FullPageSpinner } from '@/components/ui';

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
        return <PropertiesPage initialId={params.id as string | undefined} />;
      case 'matches':
        return <MatchesPage />;
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
      {renderPage()}
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
