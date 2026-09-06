import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PRODUCT_NAME } from '../../lib/product';
import { ProductLogo } from '../../components/ProductLogo';

const nav = [
  { href: '/platform', label: 'Overview' },
  { href: '/platform/subscriptions', label: 'Clinics' },
  { href: '/platform/payments', label: 'Payments' },
  { href: '/platform/invoices', label: 'Invoices' },
  { href: '/platform/webhooks', label: 'Webhooks' },
];

export function PlatformLayout() {
  const { user, ready, hasRole, logout } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole('SUPER_ADMIN')) return <Navigate to="/dashboard" replace />;

  return (
    <div data-theme="midnight" className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.12),_transparent_55%)]" />
      <header className="relative border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <ProductLogo className="h-10 w-auto max-w-[160px]" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400/90">
                {PRODUCT_NAME}
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-white">Platform console</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline">{user.email}</span>
            <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300 ring-1 ring-sky-500/30">
              Super admin
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800"
              onClick={logout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        </div>
        <nav className="relative mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
          {nav.map((item) => {
            const active =
              item.href === '/platform'
                ? location.pathname === '/platform'
                : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? 'bg-sky-500 text-slate-950 font-medium'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="relative mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function usePlatformLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Request failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, setData, setError };
}
