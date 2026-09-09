import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, ChevronLeft, ChevronRight, ChevronDown, LogOut, User, LayoutDashboard, Users, Pill, FileText, DollarSign, Package, FolderOpen, MessageSquare, Brain, BarChart2, Settings, Shield, RefreshCw, FlaskConical, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { canAccessPath, navForUser, primaryAppRole, type NavChild } from '../auth/rbac';
import { useSubscriptionAccess, isSubscriptionOpenPath, needsClinicSetup } from '../auth/SubscriptionAccess';
import { SubscriptionBanner } from './SubscriptionBanner';
import { PRODUCT_NAME } from '../lib/product';
import { ProductLogo } from './ProductLogo';

const icons = {
  dashboard: LayoutDashboard,
  patients: Users,
  appointments: Calendar,
  calendar: Calendar,
  day: Clock,
  therapy: Pill,
  lab: FlaskConical,
  billing: DollarSign,
  inventory: Package,
  documents: FolderOpen,
  communication: MessageSquare,
  ai: Brain,
  reports: BarChart2,
  users: Users,
  roles: Shield,
  audit: FileText,
  settings: Settings,
};

function hrefActive(href: string, pathname: string, search: string) {
  const [path, query] = href.split('?');
  if (pathname !== path) return false;
  if (!query) return true;
  return search.includes(query);
}

function sectionIsActive(item: { href: string; children?: readonly NavChild[] }, pathname: string, search: string) {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.children || []).some((child) => hrefActive(child.href, pathname, search));
}

function SidebarChildLinks({
  items,
  pathname,
  search,
  onNavigate,
}: {
  items: readonly NavChild[];
  pathname: string;
  search: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l border-white/10 pl-2">
      {items.map((child) => {
        const active = hrefActive(child.href, pathname, search);
        return (
          <NavLink
            key={child.href}
            to={child.href}
            title={child.name}
            onClick={onNavigate}
            className={`block px-2.5 py-1.5 rounded-md text-[13px] leading-5 transition-colors ${
              active ? 'nav-link-active' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            {child.name}
          </NavLink>
        );
      })}
    </div>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isRestricted } = useSubscriptionAccess();

  const roles = user?.roles || [];
  const filteredNav = navForUser(roles, user?.staffType);

  useEffect(() => {
    setSidebarOpen(false);
    setOpenMenus((menus) => {
      const next = { ...menus };
      for (const item of filteredNav) {
        if ('children' in item && item.children && sectionIsActive(item, location.pathname, location.search)) {
          next[item.name] = true;
        }
      }
      return next;
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.title = PRODUCT_NAME;
  }, []);

  if (user && !canAccessPath(location.pathname, user.roles, user.staffType)) {
    return <Navigate to="/dashboard" replace />;
  }

  // UX only — API SubscriptionGuard is the real control
  if (user && isRestricted && !isSubscriptionOpenPath(location.pathname)) {
    return <Navigate to="/subscription" replace />;
  }

  if (user && needsClinicSetup(user) && location.pathname !== '/setup' && !location.pathname.startsWith('/subscription')) {
    return <Navigate to="/setup" replace />;
  }

  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="h-screen overflow-hidden" style={{ background: 'var(--app-bg)', color: 'var(--text)' }}>
      <aside
        className={`sidebar-panel print:hidden fixed inset-y-0 left-0 z-50 border-r border-white/5 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col h-full">
          <div
            className={`flex items-center border-b border-white/10 px-3 ${
              collapsed ? 'h-auto min-h-16 flex-col justify-center gap-1 py-2' : 'h-16 justify-between gap-2'
            }`}
          >
            {!collapsed ? (
              <div className="flex min-w-0 items-center gap-2">
                <ProductLogo className="h-9 w-auto max-w-[148px] shrink-0" />
              </div>
            ) : (
              <ProductLogo variant="mark" className="h-9 w-9 rounded-lg shrink-0" />
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          <nav className="sidebar-scroll flex-1 overflow-y-auto py-3 px-2 space-y-0.5" role="navigation" aria-label="Main navigation">
            {filteredNav.map((item) => {
              const Icon = icons[item.icon as keyof typeof icons];
              const children = 'children' in item ? item.children : undefined;
              const branchOpen = Boolean(children) && Boolean(openMenus[item.name]);
              const sectionActive = Boolean(children) && sectionIsActive(item, location.pathname, location.search);
              if (children) {
                return (
                  <div key={item.name}>
                    <button
                      type="button"
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-200 ${
                        sectionActive || branchOpen
                          ? 'nav-link-active'
                          : 'text-inherit opacity-80 hover:opacity-100 hover:bg-white/10'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.name : undefined}
                      aria-expanded={branchOpen}
                      onClick={() => {
                        if (collapsed) {
                          setCollapsed(false);
                          setOpenMenus((menus) => ({ ...menus, [item.name]: true }));
                          return;
                        }
                        setOpenMenus((menus) => ({ ...menus, [item.name]: !menus[item.name] }));
                      }}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate flex-1 text-left">{item.name}</span>}
                      {!collapsed && (
                        <ChevronDown className={`w-4 h-4 shrink-0 opacity-70 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${branchOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    <div className={`sidebar-accordion ${branchOpen && !collapsed ? 'is-open' : ''}`}>
                      <div className="sidebar-accordion-panel">
                        <SidebarChildLinks
                          items={children}
                          pathname={location.pathname}
                          search={location.search}
                          onNavigate={closeMobile}
                        />
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors ${
                      isActive
                        ? 'nav-link-active'
                        : 'text-inherit opacity-80 hover:opacity-100 hover:bg-white/10'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10">
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-white">
                <User className="w-4 h-4" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-[11px] text-white/50 truncate uppercase tracking-wide">{primaryAppRole(roles, user?.staffType) || '—'}</p>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`min-w-0 print:pl-0 transition-[padding] duration-300 ease-in-out ${
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        <SubscriptionBanner />
        {user?.isSystemSupport && (
          <div className="print:hidden border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 dark:text-amber-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-semibold">Support session</span>
                {user.clinic?.name ? (
                  <>
                    {' '}
                    for <span className="font-semibold">{user.clinic.name}</span>
                  </>
                ) : null}
                — full ADMIN access for clinic support. Exit and sign in with platform credentials to
                return to the console.
              </p>
              <button
                type="button"
                onClick={logout}
                className="shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
              >
                Exit support
              </button>
            </div>
          </div>
        )}
        <header className="topbar-panel print:hidden sticky top-0 z-30 border-b">
          <div className="flex items-center justify-between h-14 px-3 sm:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  window.location.reload();
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Refresh page"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="hidden sm:inline-flex h-9 items-center gap-2 px-2.5 rounded-lg text-sm border" style={{ background: 'var(--surface-muted)', color: 'var(--muted)', borderColor: 'var(--border)' }}>
                <User className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-[10rem]">{user?.name || 'User'}</span>
              </div>
              <button
                onClick={logout}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main
          className="p-4 lg:p-6 overflow-y-auto overflow-x-hidden print:p-0 print:h-auto print:overflow-visible"
          style={{ height: 'calc(100vh - 3.5rem - 2rem)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
