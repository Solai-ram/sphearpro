import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { DashboardCharts } from '../../services/dashboard';

const PALETTE = ['#2563eb', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
};

const TYPE_LABEL: Record<string, string> = {
  OP_CONSULTATION: 'OP',
  THERAPY_SESSION: 'Therapy',
  THERAPY_PACKAGE: 'Package',
  PRODUCT: 'Product',
  OTHER: 'Other',
};

function emptyHint(title: string) {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-sm text-gray-400">
      <p className="font-medium text-gray-500">{title}</p>
      <p className="text-xs mt-1">No data in this period yet</p>
    </div>
  );
}

export function RevenueSessionsChart({ charts }: { charts: DashboardCharts | null }) {
  const option = useMemo(() => {
    const series = charts?.series || [];
    return {
      color: ['#2563eb', '#0d9488'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#94a3b8' } },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: {
        data: ['Revenue', 'Sessions'],
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { color: '#64748b', fontSize: 12 },
      },
      grid: { left: 48, right: 44, top: 36, bottom: 28 },
      xAxis: {
        type: 'category',
        data: series.map((row) => row.label),
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: '₹',
          nameTextStyle: { color: '#94a3b8', fontSize: 11, padding: [0, 0, 0, 8] },
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLabel: {
            color: '#94a3b8',
            fontSize: 11,
            formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v)),
          },
        },
        {
          type: 'value',
          name: 'Sessions',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          splitLine: { show: false },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
          minInterval: 1,
        },
      ],
      series: [
        {
          name: 'Revenue',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 3 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37, 99, 235, 0.28)' },
                { offset: 1, color: 'rgba(37, 99, 235, 0.02)' },
              ],
            },
          },
          data: series.map((row) => row.revenue),
        },
        {
          name: 'Sessions',
          type: 'bar',
          yAxisIndex: 1,
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#14b8a6' },
                { offset: 1, color: '#0d9488' },
              ],
            },
          },
          data: series.map((row) => row.sessions),
        },
      ],
    };
  }, [charts]);

  if (!charts?.series?.length) return emptyHint('Activity trend');
  return <ReactECharts option={option} style={{ height: 280 }} opts={{ renderer: 'svg' }} />;
}

export function OpCasesChart({ charts }: { charts: DashboardCharts | null }) {
  const option = useMemo(() => {
    const series = charts?.series || [];
    return {
      color: ['#0284c7'],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      grid: { left: 36, right: 12, top: 16, bottom: 28 },
      xAxis: {
        type: 'category',
        data: series.map((row) => row.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 22,
          data: series.map((row) => row.opCases),
          itemStyle: {
            borderRadius: [8, 8, 4, 4],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#38bdf8' },
                { offset: 1, color: '#0284c7' },
              ],
            },
          },
        },
      ],
    };
  }, [charts]);

  if (!charts?.series?.length) return emptyHint('OP registrations');
  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'svg' }} />;
}

export function AttendanceDonut({ charts }: { charts: DashboardCharts | null }) {
  const option = useMemo(() => {
    const rows = charts?.attendanceBreakdown || [];
    return {
      color: PALETTE,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '74%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
          label: { show: false },
          data: rows.map((row) => ({
            name: ATTENDANCE_LABEL[row.status] || row.status,
            value: row.count,
          })),
        },
      ],
    };
  }, [charts]);

  const total = (charts?.attendanceBreakdown || []).reduce((s, row) => s + row.count, 0);
  if (!total) return emptyHint('Attendance mix');
  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'svg' }} />;
}

export function RevenueMixChart({ charts }: { charts: DashboardCharts | null }) {
  const option = useMemo(() => {
    const rows = [...(charts?.revenueByType || [])].sort((a, b) => b.amount - a.amount);
    return {
      color: ['#6366f1'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const row = params[0];
          return `${row?.name}<br/>₹${Number(row?.value || 0).toLocaleString('en-IN')}`;
        },
      },
      grid: { left: 88, right: 24, top: 8, bottom: 8 },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
        },
      },
      yAxis: {
        type: 'category',
        data: rows.map((row) => TYPE_LABEL[row.type] || row.type),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#475569', fontSize: 12 },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          data: rows.map((row) => row.amount),
          itemStyle: {
            borderRadius: [0, 8, 8, 0],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#818cf8' },
                { offset: 1, color: '#4f46e5' },
              ],
            },
          },
        },
      ],
    };
  }, [charts]);

  if (!(charts?.revenueByType || []).length) return emptyHint('Revenue mix');
  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'svg' }} />;
}
