import { useMemo } from 'react';

export type DatePeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export type DateRangeValue = {
  period: DatePeriod;
  startDate: string;
  endDate: string;
};

function pad(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function rangeForPeriod(period: DatePeriod, startDate?: string, endDate?: string): DateRangeValue {
  const now = new Date();
  if (period === 'weekly') {
    const from = new Date(now);
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { period, startDate: pad(from), endDate: pad(to) };
  }
  if (period === 'monthly') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { period, startDate: pad(from), endDate: pad(to) };
  }
  if (period === 'custom') {
    return {
      period,
      startDate: startDate || pad(now),
      endDate: endDate || pad(now),
    };
  }
  return { period: 'daily', startDate: pad(now), endDate: pad(now) };
}

export function periodCaption(range: DateRangeValue) {
  if (range.period === 'daily') return 'today';
  if (range.period === 'weekly') return 'this week';
  if (range.period === 'monthly') return 'this month';
  return 'custom range';
}

const PERIODS: { id: DatePeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom', label: 'Custom' },
];

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}) {
  const caption = useMemo(() => periodCaption(value), [value]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="segmented">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={value.period === item.id ? 'is-on' : ''}
            onClick={() =>
              onChange(
                item.id === 'custom'
                  ? { period: 'custom', startDate: value.startDate, endDate: value.endDate }
                  : rangeForPeriod(item.id),
              )
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      {value.period === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input h-9 w-[9.5rem]"
            type="date"
            aria-label="From date"
            value={value.startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            className="input h-9 w-[9.5rem]"
            type="date"
            aria-label="To date"
            value={value.endDate}
            min={value.startDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          />
        </div>
      ) : (
        <p className="text-sm text-gray-500 capitalize">{caption}</p>
      )}
    </div>
  );
}
