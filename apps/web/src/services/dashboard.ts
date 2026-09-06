import { fetchApi, getAccessToken } from '../lib/api';

export interface DashboardMetrics {
  totalPatients: number;
  newPatients?: number;
  waitingQueue: number;
  todayOpCases: number;
  activeTherapyCases: number;
  todayTherapySessions: number;
  todayPresent: number;
  todayRevenue: number;
  pendingInvoices: number;
  outstanding: number;
  lowStockCount: number;
  whatsappFailed: number;
  whatsappQueued: number;
  aiRequestsToday: number;
  aiTokensToday: number;
  range?: { period: string; startDate: string; endDate: string };
}

export type DashboardChartPoint = {
  date: string;
  label: string;
  revenue: number;
  sessions: number;
  opCases: number;
};

export type DashboardCharts = {
  range: { period: string; startDate: string; endDate: string };
  series: DashboardChartPoint[];
  attendanceBreakdown: Array<{ status: string; count: number }>;
  revenueByType: Array<{ type: string; amount: number }>;
  totals: { revenue: number; sessions: number; opCases: number };
};

export type DashboardLayoutItem = {
  widgetId: string;
  key: string;
  title: string;
  category?: string;
  isVisible: boolean;
  positionX: number;
  positionY: number;
};

function rangeQuery(range?: { period: string; startDate?: string; endDate?: string }) {
  const params = new URLSearchParams();
  if (range?.period) params.set('period', range.period);
  if (range?.period === 'custom' && range.startDate) params.set('startDate', range.startDate);
  if (range?.period === 'custom' && range.endDate) params.set('endDate', range.endDate);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const dashboardApi = {
  getStats(range?: { period: string; startDate?: string; endDate?: string }): Promise<DashboardMetrics> {
    return fetchApi(`/dashboard/stats${rangeQuery(range)}`);
  },
  getToday(range?: { period: string; startDate?: string; endDate?: string }) {
    return fetchApi<{
      sessions: Array<{
        id: string;
        scheduledAt: string;
        status: string;
        therapyCase?: { title: string; patient?: { name: string } };
      }>;
    }>(`/dashboard/today${rangeQuery(range)}`);
  },
  getCharts(range?: { period: string; startDate?: string; endDate?: string }): Promise<DashboardCharts> {
    return fetchApi(`/dashboard/charts${rangeQuery(range)}`);
  },
  getLayout() {
    return fetchApi<DashboardLayoutItem[]>('/dashboard/layout');
  },
  saveLayout(widgets: Array<{ widgetId: string; positionX: number; positionY: number; isVisible: boolean }>) {
    return fetchApi('/dashboard/layout', { method: 'PATCH', body: JSON.stringify({ widgets }) });
  },
};

export const reportsApi = {
  clinical(startDate?: string, endDate?: string) {
    const q = new URLSearchParams();
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);
    return fetchApi<any>(`/reports/clinical?${q.toString()}`);
  },
  therapy(startDate?: string, endDate?: string) {
    const q = new URLSearchParams();
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);
    return fetchApi<any>(`/reports/therapy?${q.toString()}`);
  },
  financial(startDate?: string, endDate?: string) {
    const q = new URLSearchParams();
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);
    return fetchApi<any>(`/reports/financial?${q.toString()}`);
  },
  inventory() {
    return fetchApi<any>('/reports/inventory');
  },
  ai(startDate?: string, endDate?: string) {
    const q = new URLSearchParams();
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);
    return fetchApi<any>(`/reports/ai?${q.toString()}`);
  },
  async exportCsv(type: string, startDate?: string, endDate?: string) {
    const token = getAccessToken();
    const q = new URLSearchParams();
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);
    const response = await fetch(`/api/reports/export/${type}?${q.toString()}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
