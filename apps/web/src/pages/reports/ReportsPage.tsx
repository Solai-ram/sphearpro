import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import { ReportKpis, ReportPrintFrame } from '../../components/reports/ReportPrintFrame';
import { DateRangeFilter, rangeForPeriod, type DateRangeValue } from '../../components/DateRangeFilter';
import { reportsApi } from '../../services/dashboard';
import { billingApi } from '../../services/billing';
import { inventoryApi } from '../../services/inventory';
import { clinicalApi } from '../../services/clinical';
import { labApi } from '../../services/lab';
import type { OpCase } from '../../types/clinical';
import type { Product } from '../../types/inventory';
import type { ProductSale } from '../../types/inventory';
import type { LabDashboard, LabProcedure } from '../../types/lab';

type ReportId = 'clinical' | 'op' | 'therapy' | 'lab' | 'billing' | 'revenue' | 'stock' | 'sales' | 'returns' | 'ai';

const REPORTS: {
  id: ReportId;
  name: string;
  hint: string;
  ranged: boolean;
  csv?: 'clinical' | 'therapy' | 'financial' | 'inventory' | 'ai';
}[] = [
  { id: 'clinical', name: 'OP clinical', hint: 'OP cases registered in the period', ranged: true, csv: 'clinical' },
  { id: 'op', name: 'OP visits', hint: 'Visit register for the selected period', ranged: true },
  { id: 'therapy', name: 'Therapy', hint: 'Cases, sessions, attendance and package use', ranged: true, csv: 'therapy' },
  { id: 'lab', name: 'Audio', hint: 'Tests billed and procedure catalogue', ranged: false },
  { id: 'billing', name: 'Billing', hint: 'Invoices issued, billed vs collected', ranged: true },
  { id: 'revenue', name: 'Revenue', hint: 'Collections by payment mode and source', ranged: true, csv: 'financial' },
  { id: 'stock', name: 'Stock', hint: 'On-hand quantity, value and low stock', ranged: false, csv: 'inventory' },
  { id: 'sales', name: 'Sales', hint: 'Product sales by item and day', ranged: true },
  { id: 'returns', name: 'Item returns', hint: 'Return requests by status and product', ranged: true },
  { id: 'ai', name: 'AI usage', hint: 'Requests and tokens by provider', ranged: true, csv: 'ai' },
];

const TYPE_LABEL: Record<string, string> = {
  OP_VISIT: 'Consultation',
  LAB_TEST: 'Audio',
  PRODUCT: 'Product',
  THERAPY_PACKAGE: 'Therapy package',
  THERAPY_SESSION: 'Therapy session',
  OTHER: 'Other',
};

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  NET_BANKING: 'Net banking',
  WALLET: 'Wallet',
  OTHER: 'Other',
};

function money(value?: number | string | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRange(range: DateRangeValue) {
  const from = new Date(`${range.startDate}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const to = new Date(`${range.endDate}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return from === to ? from : `${from} – ${to}`;
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td className="text-center" colSpan={cols} style={{ color: '#5b6b7c' }}>{text}</td>
    </tr>
  );
}

export function ReportsPage() {
  const { type } = useParams<{ type?: string }>();
  if (!type) return <ReportsIndex />;
  if (!REPORTS.some((r) => r.id === type)) return <Navigate to="/reports" replace />;
  return <ReportViewer id={type as ReportId} />;
}

function ReportsIndex() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Open a report to preview on letterhead, then print or save as PDF.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORTS.map((report) => (
          <Link key={report.id} to={`/reports/${report.id}`} className="card p-4 hover:border-blue-300 transition-colors">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{report.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{report.hint}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReportViewer({ id }: { id: ReportId }) {
  const meta = REPORTS.find((r) => r.id === id)!;
  const [range, setRange] = useState<DateRangeValue>(() => rangeForPeriod('monthly'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await loadReport(id, range);
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, range.period, range.startDate, range.endDate]);

  return (
    <ReportPrintFrame
      title={`${meta.name} report`}
      subtitle={meta.hint}
      periodLabel={meta.ranged ? formatRange(range) : 'As of today'}
      loading={isLoading}
      error={error}
      onExport={meta.csv ? () => {
        reportsApi.exportCsv(meta.csv!, range.startDate, range.endDate).catch(() => undefined);
      } : undefined}
      filters={meta.ranged ? <DateRangeFilter value={range} onChange={setRange} /> : undefined}
    >
      {payload ? renderReport(id, payload) : null}
    </ReportPrintFrame>
  );
}

async function loadReport(id: ReportId, range: DateRangeValue) {
  const start = range.startDate;
  const end = range.endDate;
  if (id === 'clinical') return reportsApi.clinical(start, end);
  if (id === 'therapy') return reportsApi.therapy(start, end);
  if (id === 'ai') return reportsApi.ai(start, end);
  if (id === 'revenue') return billingApi.revenue(start, end, range.period);
  if (id === 'billing') return billingApi.billingReport({ period: range.period, startDate: start, endDate: end });
  if (id === 'stock') return inventoryApi.getStockReport();
  if (id === 'sales') return inventoryApi.getSalesReport({ period: range.period, startDate: start, endDate: end });
  if (id === 'returns') return inventoryApi.getReturnsReport({ period: range.period, startDate: start, endDate: end });
  if (id === 'lab') {
    const [dashboard, procedures] = await Promise.all([
      labApi.getDashboard(),
      labApi.getProcedures({ limit: 100 }),
    ]);
    return { dashboard, procedures: procedures.data || [] };
  }
  const list = await clinicalApi.getAll({
    page: 1,
    limit: 200,
    startDate: `${start}T00:00:00`,
    endDate: `${end}T23:59:59.999`,
  });
  return list;
}

function renderReport(id: ReportId, data: any) {
  if (id === 'clinical') return <ClinicalBody data={data} />;
  if (id === 'op') return <OpBody data={data} />;
  if (id === 'therapy') return <TherapyBody data={data} />;
  if (id === 'lab') return <LabBody dashboard={data.dashboard} procedures={data.procedures} />;
  if (id === 'billing') return <BillingBody data={data} />;
  if (id === 'revenue') return <RevenueBody data={data} />;
  if (id === 'stock') return <StockBody data={data} />;
  if (id === 'sales') return <SalesBody data={data} />;
  if (id === 'returns') return <ReturnsBody data={data} />;
  return <AiBody data={data} />;
}

function ClinicalBody({ data }: { data: any }) {
  return (
    <>
      <ReportKpis items={[
        { label: 'OP cases', value: data.opCases || 0 },
        { label: 'Follow-ups', value: data.followUps || 0 },
        { label: 'Prescriptions', value: data.prescriptions || 0 },
        { label: 'Diagnoses', value: (data.topDiagnoses || []).reduce((s: number, d: any) => s + Number(d.count || 0), 0) },
      ]} />
      <p className="report-section">Top diagnoses</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Code</th><th>Diagnosis</th><th className="num">Count</th></tr>
        </thead>
        <tbody>
          {(data.topDiagnoses || []).map((d: any, i: number) => (
            <tr key={i}><td>{d.code || '—'}</td><td>{d.description}</td><td className="num">{d.count}</td></tr>
          ))}
          {!(data.topDiagnoses || []).length && <EmptyRow cols={3} text="No diagnoses in this period." />}
        </tbody>
      </table>
    </>
  );
}

function OpBody({ data }: { data: { data?: OpCase[]; meta?: { total: number } } }) {
  const rows = data.data || [];
  return (
    <>
      <ReportKpis items={[
        { label: 'Visits', value: data.meta?.total ?? rows.length },
        { label: 'Open', value: rows.filter((c) => c.status === 'OPEN').length },
        { label: 'Closed', value: rows.filter((c) => c.status === 'CLOSED').length },
      ]} />
      <p className="report-section">Visit register</p>
      <table className="invoice-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Complaint</th>
            <th>Doctor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td>
                <span className="invoice-item-name">{c.patient?.name}</span>
                <span className="invoice-item-type">{c.patient?.patientNumber}</span>
              </td>
              <td>{c.chiefComplaint || '—'}</td>
              <td>{c.provider?.name || '—'}</td>
              <td>{c.status}</td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={5} text="No OP visits in this period." />}
        </tbody>
      </table>
    </>
  );
}

function TherapyBody({ data }: { data: any }) {
  const attendance = Object.entries(data.attendanceByStatus || {}) as [string, number][];
  return (
    <>
      <ReportKpis items={[
        { label: 'Active cases', value: data.activeCases || 0 },
        { label: 'Sessions', value: data.sessions || 0 },
        { label: 'Missed', value: data.missed || 0 },
        { label: 'Package use', value: `${data.packageUtilization || 0}%` },
      ]} />
      <p className="report-section">Attendance</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Status</th><th className="num">Count</th></tr>
        </thead>
        <tbody>
          {attendance.map(([status, count]) => (
            <tr key={status}><td>{status}</td><td className="num">{count}</td></tr>
          ))}
          {attendance.length === 0 && <EmptyRow cols={2} text="No attendance marked in this period." />}
        </tbody>
      </table>
    </>
  );
}

function LabBody({ dashboard, procedures }: { dashboard: LabDashboard; procedures: LabProcedure[] }) {
  const executed = dashboard?.executed;
  return (
    <>
      <ReportKpis items={[
        { label: 'Today', value: executed?.today?.tests || 0 },
        { label: 'This week', value: executed?.week?.tests || 0 },
        { label: 'This month', value: executed?.month?.tests || 0 },
        { label: 'Month billed', value: money(executed?.month?.revenue) },
      ]} />
      <p className="report-section">Top procedures</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Procedure</th><th>Department</th><th className="num">Tests</th><th className="num">Revenue</th></tr>
        </thead>
        <tbody>
          {(dashboard?.topProcedures || []).map((row) => (
            <tr key={row.name + row.department}>
              <td>{row.name}</td>
              <td>{row.department}</td>
              <td className="num">{row.tests}</td>
              <td className="num">{money(row.revenue)}</td>
            </tr>
          ))}
          {!(dashboard?.topProcedures || []).length && <EmptyRow cols={4} text="No billed audio tests yet." />}
        </tbody>
      </table>
      <p className="report-section">Catalogue</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Code</th><th>Name</th><th>Department</th><th className="num">Price</th></tr>
        </thead>
        <tbody>
          {procedures.map((p) => (
            <tr key={p.id}>
              <td>{p.code}</td>
              <td>{p.name}</td>
              <td>{p.department}</td>
              <td className="num">{money(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function BillingBody({ data }: { data: any }) {
  const summary = data?.summary || { invoices: 0, billed: 0, collected: 0, outstanding: 0 };
  return (
    <>
      <ReportKpis items={[
        { label: 'Invoices', value: summary.invoices },
        { label: 'Billed', value: money(summary.billed) },
        { label: 'Collected', value: money(summary.collected) },
        { label: 'Outstanding', value: money(summary.outstanding) },
      ]} />
      <p className="report-section">By category</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Category</th><th className="num">Lines</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {Object.entries(data?.byBillableType || {}).map(([key, val]: [string, any]) => (
            <tr key={key}>
              <td>{TYPE_LABEL[key] || key}</td>
              <td className="num">{val.count}</td>
              <td className="num">{money(val.amount)}</td>
            </tr>
          ))}
          {Object.keys(data?.byBillableType || {}).length === 0 && <EmptyRow cols={3} text="No bills in this period." />}
        </tbody>
      </table>
      <p className="report-section">Invoices</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Invoice</th><th>Patient</th><th>Status</th><th className="num">Billed</th><th className="num">Due</th></tr>
        </thead>
        <tbody>
          {(data?.invoices || []).map((inv: any) => (
            <tr key={inv.id}>
              <td>{inv.invoiceNumber}</td>
              <td>{inv.patient?.name}</td>
              <td>{inv.status}</td>
              <td className="num">{money(inv.grandTotal)}</td>
              <td className="num">{money(inv.outstanding)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function RevenueBody({ data }: { data: any }) {
  return (
    <>
      <ReportKpis items={[
        { label: 'Collected', value: money(data.collected) },
        { label: 'Refunded', value: money(data.refunded) },
        { label: 'Net', value: money(data.net) },
        { label: 'Payments', value: data.paymentCount || 0 },
      ]} />
      <p className="report-section">By payment mode</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Mode</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {Object.entries(data?.byMethod || {}).map(([key, val]) => (
            <tr key={key}><td>{METHOD_LABEL[key] || key}</td><td className="num">{money(val as number)}</td></tr>
          ))}
          {Object.keys(data?.byMethod || {}).length === 0 && <EmptyRow cols={2} text="No collections in this period." />}
        </tbody>
      </table>
      <p className="report-section">By source</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Source</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {Object.entries(data?.byBillableType || {}).map(([key, val]) => (
            <tr key={key}><td>{TYPE_LABEL[key] || key}</td><td className="num">{money(val as number)}</td></tr>
          ))}
          {Object.keys(data?.byBillableType || {}).length === 0 && <EmptyRow cols={2} text="No source split in this period." />}
        </tbody>
      </table>
      <p className="report-section">Payments</p>
      <table className="invoice-table">
        <thead>
          <tr><th>When</th><th>Patient</th><th>Invoice</th><th>Mode</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {(data?.payments || []).map((p: any) => (
            <tr key={p.id}>
              <td>{new Date(p.paidAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td>{p.patientName}</td>
              <td>{p.invoiceNumber}</td>
              <td>{METHOD_LABEL[p.method] || p.method}</td>
              <td className="num">{money(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function StockBody({ data }: { data: { summary?: any; byCategory?: any[]; items?: (Product & { stockValue?: number })[] } }) {
  const summary = data.summary || {};
  return (
    <>
      <ReportKpis items={[
        { label: 'Items', value: summary.items || 0 },
        { label: 'Units', value: summary.units || 0 },
        { label: 'Stock value', value: money(summary.value) },
        { label: 'Low stock', value: summary.lowStock || 0 },
      ]} />
      <p className="report-section">By category</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Category</th><th className="num">Items</th><th className="num">Units</th><th className="num">Value</th><th className="num">Low</th></tr>
        </thead>
        <tbody>
          {(data.byCategory || []).map((row) => (
            <tr key={row.category}>
              <td>{row.category}</td>
              <td className="num">{row.items}</td>
              <td className="num">{row.units}</td>
              <td className="num">{money(row.value)}</td>
              <td className="num">{row.lowStock}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="report-section">Item-wise stock</p>
      <table className="invoice-table">
        <thead>
          <tr><th>SKU</th><th>Item</th><th>Category</th><th className="num">On hand</th><th className="num">Value</th></tr>
        </thead>
        <tbody>
          {(data.items || []).map((p) => (
            <tr key={p.id}>
              <td>{p.sku}</td>
              <td>{p.name}{p.isLowStock ? ' (Low)' : ''}</td>
              <td>{p.category?.name || '—'}</td>
              <td className="num">{p.currentStock ?? 0}</td>
              <td className="num">{money(p.stockValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function SalesBody({ data }: { data: { summary?: any; byProduct?: any[]; sales?: ProductSale[] } }) {
  const summary = data.summary || { sales: 0, quantity: 0, revenue: 0 };
  return (
    <>
      <ReportKpis items={[
        { label: 'Bills', value: summary.sales },
        { label: 'Units sold', value: summary.quantity },
        { label: 'Revenue', value: money(summary.revenue) },
      ]} />
      <p className="report-section">By product</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Item</th><th className="num">Qty</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {(data.byProduct || []).map((row: any) => (
            <tr key={row.sku + row.name}>
              <td>
                <span className="invoice-item-name">{row.name}</span>
                <span className="invoice-item-type">{row.sku}</span>
              </td>
              <td className="num">{row.quantity}</td>
              <td className="num">{money(row.revenue)}</td>
            </tr>
          ))}
          {!(data.byProduct || []).length && <EmptyRow cols={3} text="No sales in this period." />}
        </tbody>
      </table>
      <p className="report-section">Sale lines</p>
      <table className="invoice-table">
        <thead>
          <tr><th>When</th><th>Patient</th><th>Item</th><th className="num">Qty</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {(data.sales || []).map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.soldAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td>{s.patient?.name}</td>
              <td>{s.product?.name}</td>
              <td className="num">{s.quantity}</td>
              <td className="num">{money(s.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ReturnsBody({
  data,
}: {
  data: {
    summary?: { requests: number; pending: number; approved: number; rejected: number; approvedQuantity: number };
    byProduct?: { name: string; sku: string; approved: number; pending: number; rejected: number }[];
    requests?: import('../../types/inventory').StockReturnRequest[];
  };
}) {
  const summary = data.summary || { requests: 0, pending: 0, approved: 0, rejected: 0, approvedQuantity: 0 };
  return (
    <>
      <ReportKpis items={[
        { label: 'Requests', value: summary.requests },
        { label: 'Approved', value: summary.approved },
        { label: 'Pending', value: summary.pending },
        { label: 'Units returned', value: summary.approvedQuantity },
      ]} />
      <p className="report-section">By product</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Item</th><th className="num">Approved</th><th className="num">Pending</th><th className="num">Rejected</th></tr>
        </thead>
        <tbody>
          {(data.byProduct || []).map((row) => (
            <tr key={row.sku + row.name}>
              <td>
                <span className="invoice-item-name">{row.name}</span>
                <span className="invoice-item-type">{row.sku}</span>
              </td>
              <td className="num">{row.approved}</td>
              <td className="num">{row.pending}</td>
              <td className="num">{row.rejected}</td>
            </tr>
          ))}
          {!(data.byProduct || []).length && <EmptyRow cols={4} text="No returns in this period." />}
        </tbody>
      </table>
      <p className="report-section">Return lines</p>
      <table className="invoice-table">
        <thead>
          <tr><th>When</th><th>Item</th><th className="num">Qty</th><th>Requested by</th><th>Status</th></tr>
        </thead>
        <tbody>
          {(data.requests || []).map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.requestedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td>{r.product?.name}</td>
              <td className="num">{r.quantity}</td>
              <td>{r.requester?.name}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function AiBody({ data }: { data: { rows?: any[] } }) {
  const rows = data.rows || [];
  const requests = rows.reduce((s, r) => s + Number(r.requests || 0), 0);
  const tokens = rows.reduce((s, r) => s + Number(r.promptTokens || 0) + Number(r.completionTokens || 0), 0);
  return (
    <>
      <ReportKpis items={[
        { label: 'Requests', value: requests },
        { label: 'Tokens', value: tokens.toLocaleString('en-IN') },
        { label: 'Providers', value: new Set(rows.map((r) => r.provider)).size },
      ]} />
      <p className="report-section">Usage</p>
      <table className="invoice-table">
        <thead>
          <tr><th>Provider</th><th>Type</th><th className="num">Requests</th><th className="num">Tokens</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.provider}</td>
              <td>{r.requestType}</td>
              <td className="num">{r.requests}</td>
              <td className="num">{Number(r.promptTokens || 0) + Number(r.completionTokens || 0)}</td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={4} text="No AI usage in this period." />}
        </tbody>
      </table>
    </>
  );
}
