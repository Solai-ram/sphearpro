import { useState } from 'react';
import {
  Calendar,
  Printer,
  Copy,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Play,
  ChevronDown,
  Check,
  X,
  Columns,
} from 'lucide-react';

export type ReportDateRange = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

function formatDateOnly(value?: string | Date) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface HospitalReportQueryBarProps {
  startDate: string;
  endDate: string;
  onDateChange: (range: ReportDateRange) => void;
  onExecute: () => void;
  onReset: () => void;
  isLoading?: boolean;
  onExportCsv?: () => void;
  onCopy?: () => void;
  onPrint?: () => void;
  onColumnView?: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  groupLabel?: string;
  onToggleGroup?: () => void;
  isGrouped?: boolean;
}

export function HospitalReportQueryBar({
  startDate,
  endDate,
  onDateChange,
  onExecute,
  onReset,
  isLoading = false,
  onExportCsv,
  onCopy,
  onPrint,
  onColumnView,
  pageSize,
  onPageSizeChange,
  groupLabel,
  onToggleGroup,
  isGrouped = false,
}: HospitalReportQueryBarProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [copied, setCopied] = useState(false);

  const handleApplyPreset = (preset: string) => {
    const now = new Date();
    let s = new Date();
    let e = new Date();

    switch (preset) {
      case 'today':
        s = now;
        e = now;
        break;
      case 'yesterday':
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        e = s;
        break;
      case 'last7':
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        e = now;
        break;
      case 'last30':
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        e = now;
        break;
      case 'thisMonth':
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        e = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
    }

    const sIso = toIso(s);
    const eIso = toIso(e);
    setTempStart(sIso);
    setTempEnd(eIso);
    onDateChange({ startDate: sIso, endDate: eIso });
    setIsPopupOpen(false);
  };

  const handleCopyClick = () => {
    if (onCopy) {
      onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrintClick = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 pt-1">
      {/* Left: Export Tools */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={handlePrintClick}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
          title="Print Report"
        >
          <Printer className="w-3.5 h-3.5 text-blue-600" />
          Print
        </button>

        {onCopy && (
          <button
            type="button"
            onClick={handleCopyClick}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            title="Copy Table to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}

        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            title="Export to Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel
          </button>
        )}

        <button
          type="button"
          onClick={handlePrintClick}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
          title="Save as PDF"
        >
          <FileText className="w-3.5 h-3.5 text-rose-600" />
          PDF
        </button>

        {onColumnView && (
          <button
            type="button"
            onClick={onColumnView}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium cursor-pointer shadow-2xs"
            title="Configure Visible Columns"
          >
            <Columns className="w-3.5 h-3.5 text-blue-600" />
            Column View
          </button>
        )}

        {pageSize !== undefined && onPageSizeChange && (
          <div className="inline-flex items-center gap-1 border border-gray-300 rounded bg-white px-2 py-1 shadow-2xs">
            <span className="text-gray-500">Page Length:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-transparent font-medium text-gray-800 focus:outline-hidden cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>All</option>
            </select>
          </div>
        )}
      </div>

      {/* Right: Group, Date Range Pill, GO, RESET */}
      <div className="flex flex-wrap items-center gap-2 text-xs relative">
        {onToggleGroup && (
          <button
            type="button"
            onClick={onToggleGroup}
            className={`px-3 py-1.5 rounded font-semibold tracking-wide transition-colors cursor-pointer ${
              isGrouped ? 'bg-blue-600 text-white' : 'bg-[#3c6382] text-white hover:bg-[#2b4c65]'
            }`}
          >
            {groupLabel || (isGrouped ? 'GROUPED' : 'NO GROUP')}
          </button>
        )}

        {/* Date Range Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setTempStart(startDate);
              setTempEnd(endDate);
              setIsPopupOpen((p) => !p);
            }}
            className="px-3 py-1.5 rounded bg-[#1e272e] hover:bg-[#2f3640] text-white font-mono text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            title="Change Query date range"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {formatDateOnly(startDate)} TO {formatDateOnly(endDate)}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Date Range Popover */}
          {isPopupOpen && (
            <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95 space-y-3 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="font-bold text-gray-800 text-xs">Select Date Range</span>
                <button
                  type="button"
                  onClick={() => setIsPopupOpen(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('today')}
                  className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('yesterday')}
                  className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('last7')}
                  className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('last30')}
                  className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('thisMonth')}
                  className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('lastMonth')}
                  className="p-1.5 rounded text-left hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Last Month
                </button>
              </div>

              {/* Custom inputs */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <span className="font-semibold text-gray-600 block text-[11px] uppercase">
                  Custom Range
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">FROM</label>
                    <input
                      type="date"
                      value={tempStart}
                      onChange={(e) => setTempStart(e.target.value)}
                      className="input h-8 text-xs py-0 px-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">TO</label>
                    <input
                      type="date"
                      value={tempEnd}
                      onChange={(e) => setTempEnd(e.target.value)}
                      className="input h-8 text-xs py-0 px-2"
                    />
                  </div>
                </div>
              </div>

              {/* Apply / Cancel */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPopupOpen(false)}
                  className="px-3 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDateChange({ startDate: tempStart, endDate: tempEnd });
                    setIsPopupOpen(false);
                  }}
                  className="px-4 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* GO Button */}
        <button
          type="button"
          onClick={onExecute}
          disabled={isLoading}
          className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          GO
        </button>

        {/* RESET Button */}
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          RESET
        </button>
      </div>
    </div>
  );
}
