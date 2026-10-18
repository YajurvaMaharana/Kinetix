import React, { useState, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, AlertCircle, Check } from "lucide-react";

interface CustomRangePopoverProps {
  initialFrom?: string;
  initialTo?: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (from: string, to: string) => void;
}

// Format Date to YYYY-MM-DD
function toDateInputString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CustomRangePopover({
  initialFrom,
  initialTo,
  isOpen,
  onClose,
  onApply,
}: CustomRangePopoverProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const [startDateStr, setStartDateStr] = useState<string>(() => {
    if (initialFrom) return toDateInputString(new Date(initialFrom));
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toDateInputString(d);
  });

  const [endDateStr, setEndDateStr] = useState<string>(() => {
    if (initialTo) return toDateInputString(new Date(initialTo));
    return toDateInputString(new Date());
  });

  // Calendar month viewing offsets
  const [leftMonthOffset, setLeftMonthOffset] = useState(-1); // previous month
  const [rightMonthOffset, setRightMonthOffset] = useState(0); // current month

  // Validation
  const validationError = useMemo(() => {
    if (!startDateStr || !endDateStr) {
      return "Please select both a start date and an end date.";
    }
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(endDateStr + "T23:59:59");
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return "Invalid date format.";
    }
    if (start > end) {
      return "Start date cannot be after end date.";
    }
    if (end > now || start > now) {
      return "Future dates are not permitted.";
    }
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      return "Date range cannot exceed 365 days (1 year max).";
    }
    return null;
  }, [startDateStr, endDateStr]);

  // Quick Presets
  const applyPreset = (preset: "yesterday" | "this_month" | "last_month") => {
    const now = new Date();
    if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      setStartDateStr(toDateInputString(y));
      setEndDateStr(toDateInputString(y));
    } else if (preset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDateStr(toDateInputString(firstDay));
      setEndDateStr(toDateInputString(now));
    } else if (preset === "last_month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDateStr(toDateInputString(firstDayLastMonth));
      setEndDateStr(toDateInputString(lastDayLastMonth));
    }
  };

  const handleApply = () => {
    if (validationError) return;
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(endDateStr + "T23:59:59.999");
    onApply(start.toISOString(), end.toISOString());
    onClose();
  };

  if (!isOpen) return null;

  // Calendar Month Generator
  const renderCalendarMonth = (offsetFromCurrent: number) => {
    const now = new Date();
    const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + offsetFromCurrent, 1);
    const year = targetMonthDate.getFullYear();
    const month = targetMonthDate.getMonth();
    const monthName = targetMonthDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const startObj = startDateStr ? new Date(startDateStr + "T00:00:00") : null;
    const endObj = endDateStr ? new Date(endDateStr + "T23:59:59") : null;

    const days = [];
    // Padding
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`pad-${i}`} className="h-7 w-7" />);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const isFuture = thisDate > today;
      const isStart = startObj && toDateInputString(thisDate) === startDateStr;
      const isEnd = endObj && toDateInputString(thisDate) === endDateStr;
      const inRange = startObj && endObj && thisDate >= startObj && thisDate <= endObj;

      days.push(
        <button
          key={`day-${d}`}
          type="button"
          disabled={isFuture}
          onClick={() => {
            if (isFuture) return;
            const str = toDateInputString(thisDate);
            if (!startDateStr || (startDateStr && endDateStr)) {
              setStartDateStr(str);
              setEndDateStr("");
            } else if (startDateStr && !endDateStr) {
              if (new Date(str) < new Date(startDateStr)) {
                setStartDateStr(str);
                setEndDateStr(startDateStr);
              } else {
                setEndDateStr(str);
              }
            }
          }}
          className={`h-7 w-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
            isFuture
              ? "text-gray-300 cursor-not-allowed"
              : isStart || isEnd
              ? "bg-[var(--primary)] text-white font-bold shadow-sm"
              : inRange
              ? "bg-[var(--lavender)] text-[var(--primary)] font-bold"
              : "text-[var(--ink)] hover:bg-[var(--surface-alt)]"
          }`}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="space-y-2">
        <div className="text-xs font-extrabold text-[var(--ink)] text-center py-1">
          {monthName}
        </div>
        <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-[var(--muted)] text-center">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Popover Card */}
      <div className="relative bg-[var(--surface)] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[var(--border)] space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="text-base font-extrabold text-[var(--ink)]">
              Select Custom Date Range
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mr-1">
            Quick Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset("yesterday")}
            className="px-3 py-1 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--ink)] transition-colors"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => applyPreset("this_month")}
            className="px-3 py-1 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--ink)] transition-colors"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => applyPreset("last_month")}
            className="px-3 py-1 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--ink)] transition-colors"
          >
            Last Month
          </button>
        </div>

        {/* Manual Date Input Fields */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--muted)] mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDateStr}
              max={toDateInputString(today)}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--ink)] font-bold focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--muted)] mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDateStr}
              max={toDateInputString(today)}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--ink)] font-bold focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>

        {/* Dual-Month Interactive Calendars */}
        <div className="p-4 bg-[var(--surface-alt)] rounded-xl border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => {
                setLeftMonthOffset((p) => p - 1);
                setRightMonthOffset((p) => p - 1);
              }}
              className="p-1 rounded-full hover:bg-[var(--surface)] text-[var(--ink)] transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
              Click a date to start, click another to set range
            </span>
            <button
              type="button"
              disabled={rightMonthOffset >= 0}
              onClick={() => {
                setLeftMonthOffset((p) => p + 1);
                setRightMonthOffset((p) => p + 1);
              }}
              className="p-1 rounded-full hover:bg-[var(--surface)] text-[var(--ink)] transition-colors disabled:opacity-30"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 pt-1">
            {renderCalendarMonth(leftMonthOffset)}
            {renderCalendarMonth(rightMonthOffset)}
          </div>
        </div>

        {/* Validation Error Message */}
        {validationError && (
          <div className="p-3 rounded-xl bg-[var(--status-escalate)]/10 border border-[var(--status-escalate)]/30 text-xs text-[var(--status-escalate)] flex items-center gap-2 font-bold animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--ink)] text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={Boolean(validationError)}
            className="px-5 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Custom Range</span>
          </button>
        </div>
      </div>
    </div>
  );
}
