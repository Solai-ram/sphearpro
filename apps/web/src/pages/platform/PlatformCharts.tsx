import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const TOOLTIP_DARK = {
  backgroundColor: 'rgba(2, 6, 23, 0.94)',
  borderWidth: 0,
  textStyle: { color: '#e2e8f0', fontSize: 12 },
};

export function ResourceDonutChart({
  usedPercent,
  usedLabel,
  freeLabel,
  color,
  warn = false,
}: {
  usedPercent: number;
  usedLabel: string;
  freeLabel: string;
  color: string;
  warn?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, usedPercent));
  const freePct = Math.max(0, 100 - pct);
  const accent = warn ? '#fbbf24' : color;

  const option = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_DARK,
        trigger: 'item',
        formatter: (p: { name: string; percent: number; value: number }) =>
          `${p.name}<br/>${p.value.toFixed(1)}%`,
      },
      series: [
        {
          type: 'pie',
          radius: ['62%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: [
            {
              name: usedLabel,
              value: pct,
              itemStyle: { color: accent },
            },
            {
              name: freeLabel,
              value: freePct,
              itemStyle: { color: '#1e293b' },
            },
          ],
          emphasis: {
            scale: false,
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.35)' },
          },
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '40%',
          style: {
            text: `${pct}%`,
            fill: '#f8fafc',
            fontSize: 22,
            fontWeight: 650,
            align: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '56%',
          style: {
            text: 'used',
            fill: '#94a3b8',
            fontSize: 11,
            align: 'center',
          },
        },
      ],
    }),
    [pct, freePct, usedLabel, freeLabel, accent],
  );

  return <ReactECharts option={option} style={{ height: 160 }} opts={{ renderer: 'svg' }} />;
}

/** Compact donut for clinic card storage footprint on host disk. */
export function ClinicStorageMiniChart({
  storageBytes,
  diskTotalBytes,
}: {
  storageBytes: number;
  diskTotalBytes: number | null | undefined;
}) {
  const used = Math.max(0, storageBytes);
  const total = diskTotalBytes && diskTotalBytes > 0 ? diskTotalBytes : Math.max(used, 1);
  const pct =
    diskTotalBytes && diskTotalBytes > 0
      ? Math.min(100, Math.round((used / diskTotalBytes) * 1000) / 10)
      : used > 0
        ? 100
        : 0;
  const free = Math.max(0, total - used);
  const accent = pct >= 5 ? '#fbbf24' : '#38bdf8';

  const option = useMemo(
    () => ({
      series: [
        {
          type: 'pie',
          radius: ['58%', '88%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          silent: true,
          data: [
            { value: used || 0.0001, itemStyle: { color: accent } },
            { value: free, itemStyle: { color: '#1e293b' } },
          ],
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '38%',
          style: {
            text: diskTotalBytes ? `${pct}%` : '—',
            fill: '#f8fafc',
            fontSize: 13,
            fontWeight: 650,
            align: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '58%',
          style: {
            text: 'disk',
            fill: '#64748b',
            fontSize: 9,
            align: 'center',
          },
        },
      ],
    }),
    [used, free, pct, accent, diskTotalBytes],
  );

  return <ReactECharts option={option} style={{ height: 88, width: '100%' }} opts={{ renderer: 'svg' }} />;
}

export function ResourceCompareBarChart({
  diskPercent,
  memoryPercent,
}: {
  diskPercent: number;
  memoryPercent: number;
}) {
  const option = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_DARK,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (items: Array<{ seriesName: string; value: number }>) =>
          (items || [])
            .map((i) => `${i.seriesName}: <b>${i.value}%</b>`)
            .join('<br/>'),
      },
      grid: { left: 48, right: 16, top: 24, bottom: 28 },
      xAxis: {
        type: 'category',
        data: ['Disk', 'Memory'],
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          color: '#64748b',
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      },
      series: [
        {
          name: 'Usage',
          type: 'bar',
          barMaxWidth: 42,
          data: [
            {
              value: Math.min(100, Math.max(0, diskPercent)),
              itemStyle: {
                borderRadius: [8, 8, 0, 0],
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: diskPercent >= 85 ? '#fbbf24' : '#38bdf8' },
                    { offset: 1, color: diskPercent >= 85 ? '#d97706' : '#0284c7' },
                  ],
                },
              },
            },
            {
              value: Math.min(100, Math.max(0, memoryPercent)),
              itemStyle: {
                borderRadius: [8, 8, 0, 0],
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: memoryPercent >= 85 ? '#fbbf24' : '#a78bfa' },
                    { offset: 1, color: memoryPercent >= 85 ? '#d97706' : '#7c3aed' },
                  ],
                },
              },
            },
          ],
        },
      ],
    }),
    [diskPercent, memoryPercent],
  );

  return <ReactECharts option={option} style={{ height: 220 }} opts={{ renderer: 'svg' }} />;
}

export function SubscriptionStatusChart({
  status,
}: {
  status: {
    active: number;
    trialing: number;
    grace: number;
    pastDue: number;
    paymentFailed: number;
    expired: number;
    cancelled: number;
    suspended: number;
  };
}) {
  const rows = [
    { name: 'Active', value: status.active, color: '#34d399' },
    { name: 'Trialing', value: status.trialing, color: '#38bdf8' },
    { name: 'Grace', value: status.grace, color: '#fbbf24' },
    { name: 'Past due', value: status.pastDue, color: '#fb923c' },
    { name: 'Failed', value: status.paymentFailed, color: '#f87171' },
    { name: 'Expired', value: status.expired, color: '#94a3b8' },
    { name: 'Cancelled', value: status.cancelled, color: '#64748b' },
    { name: 'Suspended', value: status.suspended, color: '#e11d48' },
  ].filter((r) => r.value > 0);

  const option = useMemo(() => {
    if (!rows.length) {
      return {
        graphic: {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: { text: 'No subscriptions', fill: '#64748b', fontSize: 13 },
        },
      };
    }
    return {
      tooltip: {
        ...TOOLTIP_DARK,
        trigger: 'item',
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${p.name}<br/><b>${p.value}</b> (${p.percent}%)`,
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'middle',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['38%', '50%'],
          label: { show: false },
          data: rows.map((r) => ({
            name: r.name,
            value: r.value,
            itemStyle: { color: r.color },
          })),
        },
      ],
    };
  }, [rows]);

  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'svg' }} />;
}

const DISK_BREAKDOWN_COLORS: Record<string, string> = {
  database: '#38bdf8',
  application: '#a78bfa',
  os: '#fbbf24',
  free: '#334155',
};

export function DiskBreakdownChart({
  items,
}: {
  items: Array<{
    key: string;
    label: string;
    bytes: number;
    display: string;
    percentOfDisk: number;
  }>;
}) {
  const data = items.filter((i) => i.bytes > 0 || i.key === 'free');

  const option = useMemo(() => {
    if (!data.length) {
      return {
        graphic: {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: { text: 'No disk data', fill: '#64748b', fontSize: 13 },
        },
      };
    }
    return {
      tooltip: {
        ...TOOLTIP_DARK,
        trigger: 'item',
        formatter: (p: { name: string; value: number; percent: number; data: { display?: string } }) =>
          `${p.name}<br/><b>${p.data?.display || ''}</b> · ${p.percent}%`,
      },
      legend: {
        orient: 'vertical',
        right: 4,
        top: 'middle',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['46%', '72%'],
          center: ['36%', '50%'],
          label: { show: false },
          data: data.map((row) => ({
            name: row.label,
            value: Math.max(row.bytes, row.key === 'free' && row.bytes === 0 ? 0.0001 : row.bytes),
            display: row.display,
            itemStyle: { color: DISK_BREAKDOWN_COLORS[row.key] || '#64748b' },
          })),
        },
      ],
    };
  }, [data]);

  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'svg' }} />;
}
