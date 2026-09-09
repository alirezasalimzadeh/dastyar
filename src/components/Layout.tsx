import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Home,
  Target,
  Phone,
  Clock,
  CheckSquare,
  Handshake,
  BarChart3,
  User,
  UserPlus,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
  Download,
  WifiOff,
  CloudUpload,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getUserRoleLabel, toPersianDigits, timeAgo } from '@/lib/constants';
import { getOfflineQueue, syncOfflineQueue, removeOfflineEntry, type OfflineQueueItem } from '@/lib/offlineFetch';
import { Modal } from '@/components/ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'مرکز فرماندهی', icon: <LayoutDashboard size={20} /> },
  { key: 'customers', label: 'مشتریان', icon: <Users size={20} /> },
  { key: 'owners', label: 'مالکین', icon: <Building2 size={20} /> },
  { key: 'colleagues', label: 'همکاران', icon: <UserPlus size={20} /> },
  { key: 'properties', label: 'فایل‌ها', icon: <Home size={20} /> },
  { key: 'matches', label: 'تطبیق‌ها', icon: <Target size={20} /> },
  { key: 'calls', label: 'تماس‌ها', icon: <Phone size={20} /> },
  { key: 'followups', label: 'پیگیری‌ها', icon: <Clock size={20} /> },
  { key: 'tasks', label: 'وظایف', icon: <CheckSquare size={20} /> },
  { key: 'deals', label: 'معاملات', icon: <Handshake size={20} /> },
  { key: 'analytics', label: 'گزارش‌ها', icon: <BarChart3 size={20} /> },
  { key: 'profile', label: 'پروفایل', icon: <User size={20} /> },
  { key: 'settings', label: 'تنظیمات', icon: <Settings size={20} /> },
];

const MOBILE_NAV_KEYS = ['dashboard', 'customers', 'properties', 'followups', 'profile'];

const TABLE_LABELS: Record<string, string> = {
  customers: 'مشتری',
  owners: 'مالک',
  properties: 'فایل',
  calls: 'تماس',
  follow_ups: 'پیگیری',
  activities: 'فعالیت',
  deals: 'معامله',
  tasks: 'وظیفه',
  property_matches: 'تطبیق',
};

export function Layout({
  currentPage,
  onNavigate,
  children,
}: {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  // صف تغییرات آفلاین همیشه برای کاربر قابل مشاهده باشد تا چیزی «گم» به نظر نرسد
  const refreshQueue = useCallback(() => {
    void getOfflineQueue().then(setOfflineQueue).catch(() => setOfflineQueue([]));
  }, []);

  useEffect(() => {
    refreshQueue();
    const interval = window.setInterval(refreshQueue, 10000);
    window.addEventListener('online', refreshQueue);
    window.addEventListener('offline', refreshQueue);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', refreshQueue);
      window.removeEventListener('offline', refreshQueue);
    };
  }, [refreshQueue]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const summary = await syncOfflineQueue({ authorization: token ? `Bearer ${token}` : null });
      if (!summary) {
        setSyncMessage({ ok: false, text: 'همگام‌سازی انجام نشد؛ اتصال اینترنت را بررسی کنید.' });
      } else if (summary.total === 0) {
        setSyncMessage({ ok: true, text: 'تغییری در صف نبود.' });
      } else if (summary.remaining === 0) {
        setSyncMessage({ ok: true, text: 'همهٔ تغییرات با موفقیت به سرور ارسال شد.' });
      } else {
        setSyncMessage({
          ok: false,
          text: `${toPersianDigits(summary.remaining)} از ${toPersianDigits(summary.total)} مورد ارسال نشد.${summary.lastError ? ` آخرین خطا: ${summary.lastError}` : ''}`,
        });
      }
    } catch (err) {
      console.error('[dastyar-sync] manual sync error', err);
      setSyncMessage({ ok: false, text: 'همگام‌سازی به پایان نرسید؛ جزئیات در کنسول مرورگر (F12) ثبت شد.' });
    } finally {
      setSyncing(false);
      refreshQueue();
    }
  };

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const handleNav = (key: string) => {
    onNavigate(key);
    setMobileMenuOpen(false);
  };

  const fullName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'کاربر';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-l border-slate-200 fixed inset-y-0 right-0 z-30">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <Home size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">دستیار مشاور</h1>
              <p className="text-[10px] text-slate-400">سیستم مدیریت املاک</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={`nav-item w-full ${currentPage === item.key ? 'nav-item-active' : 'nav-item-inactive'}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
              {profile?.first_name?.[0] ?? '؟'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{fullName}</p>
              <p className="text-[10px] text-slate-400">{getUserRoleLabel(profile?.role ?? 'consultant')}</p>
            </div>
          </div>
          <button onClick={signOut} className="nav-item w-full nav-item-inactive text-red-500 hover:bg-red-50">
            <LogOut size={18} />
            <span>خروج</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 -mr-2 text-slate-600">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
            <Home size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-slate-800">دستیار مشاور</span>
        </div>
        <button onClick={() => setShowSearch(!showSearch)} className="p-2 -ml-2 text-slate-600">
          <Search size={20} />
        </button>
      </header>

      {/* Mobile Search Bar */}
      {showSearch && (
        <div className="lg:hidden fixed top-14 inset-x-0 z-20 bg-white border-b border-slate-200 p-3 animate-slide-up">
          <input
            type="text"
            placeholder="جستجوی مشتری، فایل، مالک، شماره..."
            className="input"
            autoFocus
          />
        </div>
      )}

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 bg-white shadow-xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <Home size={18} className="text-white" />
                </div>
                <h1 className="text-sm font-bold text-slate-800">دستیار مشاور</h1>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={`nav-item w-full ${currentPage === item.key ? 'nav-item-active' : 'nav-item-inactive'}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-slate-100">
              <button onClick={signOut} className="nav-item w-full nav-item-inactive text-red-500 hover:bg-red-50">
                <LogOut size={18} />
                <span>خروج</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:mr-64 flex flex-col min-h-screen">
        <main className="flex-1 px-4 py-4 lg:px-8 lg:py-6 pt-16 lg:pt-6 pb-20 lg:pb-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {(!online || offlineQueue.length > 0) && (
        <div className="fixed left-3 top-16 z-40 flex flex-col items-start gap-2 lg:top-4">
          {!online && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
              <WifiOff size={14} /> حالت آفلاین؛ تغییرات بعداً همگام می‌شوند
            </div>
          )}
          {offlineQueue.length > 0 && (
            <button
              type="button"
              onClick={() => setShowQueue(true)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${offlineQueue.some((item) => item.failed) ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'}`}
            >
              {offlineQueue.some((item) => item.failed) ? <AlertTriangle size={14} /> : <CloudUpload size={14} />}
              {toPersianDigits(offlineQueue.length)} تغییر در صف همگام‌سازی — مشاهده
            </button>
          )}
        </div>
      )}

      {installPrompt && !installDismissed && (
        <div className="fixed bottom-20 left-3 right-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-xl lg:bottom-5 lg:left-5 lg:right-auto">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Download size={19} /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800">نصب دستیار روی گوشی</p><p className="text-[11px] text-slate-500">دسترسی سریع مثل یک اپلیکیشن</p></div>
          <button type="button" onClick={installApp} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">نصب</button>
          <button type="button" onClick={() => setInstallDismissed(true)} className="p-1 text-slate-400" aria-label="بستن"><X size={16} /></button>
        </div>
      )}

      <Modal open={showQueue} onClose={() => setShowQueue(false)} title="تغییرات در صف همگام‌سازی">
        <div className="space-y-3">
          <p className="text-xs leading-6 text-slate-500">
            تغییراتی که در حالت آفلاین ثبت می‌کنید اینجا نگهداری می‌شوند و پس از اتصال اینترنت به سرور ارسال می‌شوند؛ تا آن زمان در همین دستگاه قابل مشاهده و ویرایش هستند.
          </p>
          {syncMessage && (
            <p className={`rounded-lg p-2.5 text-xs leading-6 break-words ${syncMessage.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {syncMessage.text}
            </p>
          )}
          {offlineQueue.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">تغییری در صف نیست.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {offlineQueue.map((item) => (
                <div key={item.id} className={`rounded-lg border p-3 ${item.failed ? 'border-red-200 bg-red-50/60' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      {TABLE_LABELS[item.table] || item.table || 'رکورد'}
                      <span className="mr-1 text-[10px] font-normal text-slate-400">({item.method})</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => { void removeOfflineEntry(item.id).then(refreshQueue); }}
                      className="p-1 text-slate-400 hover:text-red-500"
                      aria-label="حذف از صف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {timeAgo(item.createdAt)}
                    {item.lastAttempt ? ` — آخرین تلاش: ${timeAgo(item.lastAttempt)}` : ''}
                  </p>
                  {item.lastError && (
                    <p className="mt-1 rounded bg-red-100/70 p-1.5 text-[11px] leading-5 text-red-700 break-words">{item.lastError}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowQueue(false)} className="btn-secondary">بستن</button>
            <button type="button" onClick={handleSync} disabled={syncing || !online} className="btn-primary">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'در حال همگام‌سازی...' : 'همگام‌سازی حالا'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-1.5">
        {MOBILE_NAV_KEYS.map((key) => {
          const item = NAV_ITEMS.find((n) => n.key === key)!;
          const active = currentPage === key;
          return (
            <button
              key={key}
              onClick={() => handleNav(key)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors ${
                active ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <div className={active ? '' : ''}>{item.icon}</div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
