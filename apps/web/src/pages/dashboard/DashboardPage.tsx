import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Pill,
  DollarSign,
  Clock,
  Loader2,
  AlertCircle,
  Package,
  MessageSquare,
  Brain,
  Stethoscope,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardApi, type DashboardCharts, type DashboardMetrics } from '../../services/dashboard';
import { useAuth } from '../../auth/AuthContext';
import { DASHBOARD_WIDGETS, primaryAppRole, type AppRole } from '../../auth/rbac';
import { DateRangeFilter, periodCaption, rangeForPeriod, type DateRangeValue } from '../../components/DateRangeFilter';
import {
  AttendanceDonut,
  OpCasesChart,
  RevenueMixChart,
  RevenueSessionsChart,
} from './DashboardCharts';

function rupees(value?: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const CAPTION: Record<AppRole, string> = {
  ADMIN: 'Clinic operations at a glance',
  DOCTOR: 'Your therapy appointments overview',
  RECEPTIONIST: 'Appointments and patient registration',
  BILLING: 'Collections and outstanding',
  INVENTORY: 'Stock health and alerts',
};

type KpiTone = 'blue' | 'amber' | 'sky' | 'violet' | 'emerald' | 'rose' | 'orange' | 'indigo';

const TONE: Record<KpiTone, { chip: string; soft: string; ring: string }> = {
  blue: { chip: 'bg-blue-600', soft: 'from-blue-50 to-white', ring: 'hover:border-blue-200' },
  amber: { chip: 'bg-amber-500', soft: 'from-amber-50 to-white', ring: 'hover:border-amber-200' },
  sky: { chip: 'bg-sky-500', soft: 'from-sky-50 to-white', ring: 'hover:border-sky-200' },
  violet: { chip: 'bg-violet-500', soft: 'from-violet-50 to-white', ring: 'hover:border-violet-200' },
  emerald: { chip: 'bg-emerald-600', soft: 'from-emerald-50 to-white', ring: 'hover:border-emerald-200' },
  rose: { chip: 'bg-rose-500', soft: 'from-rose-50 to-white', ring: 'hover:border-rose-200' },
  orange: { chip: 'bg-orange-500', soft: 'from-orange-50 to-white', ring: 'hover:border-orange-200' },
  indigo: { chip: 'bg-indigo-500', soft: 'from-indigo-50 to-white', ring: 'hover:border-indigo-200' },
};

function widgetCard(key: string, stats: DashboardMetrics | null, when: string, _role: AppRole) {
  const map: Record<string, { label: string; value: string | number; icon: typeof Users; href: string; tone: KpiTone; hint?: string }> = {
    total_patients: { label: 'Total patients', value: stats?.totalPatients || 0, icon: Users, href: '/patients', tone: 'blue', hint: 'Active registry' },
    today_op: { label: `OP cases ${when}`, value: stats?.todayOpCases || 0, icon: Stethoscope, href: '/patients', tone: 'sky' },
    active_therapy: { label: 'Active therapy', value: stats?.activeTherapyCases || 0, icon: Pill, href: '/therapy', tone: 'violet' },
    today_revenue: { label: `Revenue ${when}`, value: rupees(stats?.todayRevenue), icon: DollarSign, href: '/billing', tone: 'emerald' },
    outstanding: { label: 'Outstanding', value: rupees(stats?.outstanding), icon: DollarSign, href: '/billing', tone: 'rose', hint: 'Unpaid invoices' },
    low_stock: { label: 'Low stock', value: stats?.lowStockCount || 0, icon: Package, href: '/inventory', tone: 'orange' },
    // WhatsApp communication disabled in v1
    // whatsapp: { label: 'WhatsApp failed', value: stats?.whatsappFailed || 0, icon: MessageSquare, href: '/communication', tone: 'rose' },
    ai_usage: { label: `AI requests ${when}`, value: stats?.aiRequestsToday || 0, icon: Brain, href: '/ai', tone: 'indigo' },
  };
  return map[key];
}

function quickActions(role: AppRole) {
  const register = { to: '/patients/new', label: 'Register patient', icon: Users, primary: true };
  const therapy = { to: '/therapy/new', label: 'Therapy registration', icon: Pill, primary: false };
  const invoice = { to: '/billing/new', label: 'Generate invoice', icon: DollarSign, primary: true };
  const stock = { to: '/inventory', label: 'Inventory', icon: Package, primary: true };
  const daySchedule = { to: '/appointments/day', label: 'Day schedule', icon: Clock, primary: false };
  const appointments = { to: '/appointments', label: 'Assign doctors', icon: Stethoscope, primary: true };

  switch (role) {
    case 'DOCTOR':
      return [
        { to: '/doctor/sessions', label: 'My patients', icon: Stethoscope, primary: true },
        { ...register, primary: false },
      ];
    case 'RECEPTIONIST':
      return [register, appointments, daySchedule];
    case 'BILLING':
      return [invoice];
    case 'INVENTORY':
      return [stock];
    default:
      return [register, therapy, daySchedule, invoice];
  }
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { user } = useAuth();
  const role = primaryAppRole(user?.roles, user?.staffType) || 'DOCTOR';
  const [range, setRange] = useState<DateRangeValue>(() => rangeForPeriod('daily'));
  const [stats, setStats] = useState<DashboardMetrics | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [schedule, setSchedule] = useState<{ sessions: any[] }>({ sessions: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const when = useMemo(() => periodCaption(range), [range]);
  const allowedKeys = DASHBOARD_WIDGETS[role];
  const showSchedule = ['ADMIN', 'DOCTOR', 'RECEPTIONIST'].includes(role);
  const showFinanceCharts = ['ADMIN', 'BILLING'].includes(role);
  const showClinicalCharts = ['ADMIN', 'DOCTOR', 'RECEPTIONIST'].includes(role);
  const actions = quickActions(role);
  const firstName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [metrics, today, chartData] = await Promise.all([
          dashboardApi.getStats(range),
          showSchedule ? dashboardApi.getToday(range) : Promise.resolve({ sessions: [] }),
          dashboardApi.getCharts(range),
        ]);
        setStats(metrics);
        setSchedule({ sessions: today.sessions || [] });
        setCharts(chartData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [range.period, range.startDate, range.endDate, showSchedule]);

  if (isLoading && !stats) {
    return (
      <div className="p-16 flex flex-col items-center gap-3 text-gray-500">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm">Loading dashboard…</p>
      </div>
    );
  }

  const cards = allowedKeys
    .map((key) => widgetCard(key, stats, when, role))
    .filter((card): card is NonNullable<ReturnType<typeof widgetCard>> => Boolean(card));

  return (
    <div className="dashboard-modern space-y-5">
      <section className="dashboard-hero rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white p-5 sm:p-6 overflow-hidden relative">
        <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-200/90 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> {CAPTION[role]}
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 max-w-xl">
              Live clinic pulse for <span className="text-white font-medium">{when}</span>
              {charts?.totals ? ` · ₹${charts.totals.revenue.toLocaleString('en-IN')} collected in trend window` : ''}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {role === 'ADMIN' && (
              <Link to="/dashboard-builder" className="btn-secondary !bg-white/10 !text-white !border-white/20 hover:!bg-white/15">
                Customize
              </Link>
            )}
            {['ADMIN', 'BILLING', 'INVENTORY'].includes(role) && (
              <Link to="/reports" className="btn-secondary !bg-white !text-slate-900 !border-transparent hover:!bg-slate-100">
                Reports
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => {
          const tone = TONE[card.tone];
          return (
            <Link
              key={card.label}
              to={card.href}
              className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br ${tone.soft} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone.ring}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-10 h-10 rounded-xl ${tone.chip} text-white grid place-items-center shadow-sm`}>
                  <card.icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{card.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-600">{card.label}</p>
              {card.hint && <p className="mt-0.5 text-[11px] text-slate-400">{card.hint}</p>}
            </Link>
          );
        })}
        {role === 'ADMIN' && typeof stats?.newPatients === 'number' && range.period !== 'daily' && (
          <div className={`rounded-2xl border border-slate-200/90 bg-gradient-to-br ${TONE.blue.soft} p-4`}>
            <div className={`w-10 h-10 rounded-xl ${TONE.blue.chip} text-white grid place-items-center`}>
              <Users className="w-[18px] h-[18px]" />
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{stats.newPatients}</p>
            <p className="mt-1 text-sm font-medium text-slate-600">New patients {when}</p>
          </div>
        )}
      </div>

      {(showFinanceCharts || showClinicalCharts) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card dashboard-panel p-5 xl:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Revenue & sessions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {range.period === 'daily' ? 'Last 7 days trend' : `Trend for ${when}`}
                </p>
              </div>
            </div>
            <RevenueSessionsChart charts={charts} />
          </div>

          <div className="card dashboard-panel p-5">
            <h2 className="text-base font-semibold text-slate-900">Attendance mix</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-1">Therapy check-ins in range</p>
            <AttendanceDonut charts={charts} />
          </div>

          {showClinicalCharts && (
            <div className="card dashboard-panel p-5">
              <h2 className="text-base font-semibold text-slate-900">OP registrations</h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-1">New OP cases by day</p>
              <OpCasesChart charts={charts} />
            </div>
          )}

          {showFinanceCharts && (
            <div className={`card dashboard-panel p-5 ${showClinicalCharts ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
              <h2 className="text-base font-semibold text-slate-900">Revenue by service</h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-1">Billed mix across OP, therapy & products</p>
              <RevenueMixChart charts={charts} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {showSchedule && (
          <div className="card dashboard-panel p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Therapy schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Upcoming visits {when}</p>
              </div>
              <Link to="/appointments/day" className="text-sm font-medium text-blue-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {schedule.sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 transition-colors"
                >
                  <div className="w-[4.5rem] shrink-0 rounded-lg bg-white border border-slate-100 px-2 py-1.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                      {new Date(session.scheduledAt).toLocaleDateString('en-IN', { month: 'short' })}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                      {new Date(session.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit' })}
                    </p>
                    <p className="text-[11px] text-blue-600 font-medium">{time(session.scheduledAt)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{session.therapyCase?.patient?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{session.therapyCase?.title}</p>
                  </div>
                  <span className="badge-info shrink-0">Therapy</span>
                </div>
              ))}
              {schedule.sessions.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No therapy sessions {when}</p>
              )}
            </div>
          </div>
        )}

        <div className={`card dashboard-panel p-5 ${showSchedule ? '' : 'lg:col-span-3'}`}>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Quick actions</h2>
          <p className="text-xs text-slate-500 mb-4">Jump into frequent workflows</p>
          <div className="space-y-2.5">
            {actions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`${action.primary ? 'btn-primary' : 'btn-outline'} w-full !justify-start`}
              >
                <action.icon className="w-4 h-4 mr-2" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
