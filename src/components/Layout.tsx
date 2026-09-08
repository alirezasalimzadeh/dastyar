import { ReactNode, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getUserRoleLabel } from '@/lib/constants';

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

      {installPrompt && !installDismissed && (
        <div className="fixed bottom-20 left-3 right-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-xl lg:bottom-5 lg:left-5 lg:right-auto">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Download size={19} /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800">نصب دستیار روی گوشی</p><p className="text-[11px] text-slate-500">دسترسی سریع مثل یک اپلیکیشن</p></div>
          <button type="button" onClick={installApp} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">نصب</button>
          <button type="button" onClick={() => setInstallDismissed(true)} className="p-1 text-slate-400" aria-label="بستن"><X size={16} /></button>
        </div>
      )}

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
