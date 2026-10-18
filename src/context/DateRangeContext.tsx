import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type DateRangePreset = "today" | "7d" | "30d" | "custom";
export type Granularity = "hourly" | "daily" | "weekly";

export interface DateRangeState {
  preset: DateRangePreset;
  from: string; // ISO 8601
  to: string; // ISO 8601
  granularity: Granularity;
  label: string;
  comparisonLabel: string;
  setPreset: (preset: "today" | "7d" | "30d") => void;
  setCustomRange: (fromDate: string, toDate: string) => void;
  setRange: (preset: DateRangePreset, from?: string, to?: string) => void;
}

const DateRangeContext = createContext<DateRangeState | undefined>(undefined);

// Helper to format date range label
function formatCustomLabel(fromIso: string, toIso: string): string {
  const d1 = new Date(fromIso);
  const d2 = new Date(toIso);
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const d1Str = d1.toLocaleDateString("en-US", options);
  const d2Str = d2.toLocaleDateString("en-US", options);
  return `${d1Str} - ${d2Str}`;
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial from URL if present, default to 7d
  const initialUrlRange = searchParams.get("range");
  const initialUrlFrom = searchParams.get("from");
  const initialUrlTo = searchParams.get("to");

  const [preset, setPresetState] = useState<DateRangePreset>(() => {
    if (initialUrlRange === "today" || initialUrlRange === "7d" || initialUrlRange === "30d" || initialUrlRange === "custom") {
      return initialUrlRange;
    }
    return "7d";
  });

  const [customDates, setCustomDates] = useState<{ from: string; to: string }>(() => {
    if (initialUrlRange === "custom" && initialUrlFrom && initialUrlTo) {
      return { from: initialUrlFrom, to: initialUrlTo };
    }
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 6);
    defaultStart.setHours(0, 0, 0, 0);
    const defaultEnd = new Date();
    defaultEnd.setHours(23, 59, 59, 999);
    return {
      from: defaultStart.toISOString(),
      to: defaultEnd.toISOString(),
    };
  });

  // Calculate from, to, granularity, and labels based on current preset
  const computedRange = useMemo(() => {
    const now = new Date();

    if (preset === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString(),
        to: end.toISOString(),
        granularity: "hourly" as Granularity,
        label: "Today",
        comparisonLabel: "vs yesterday",
      };
    }

    if (preset === "7d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString(),
        to: end.toISOString(),
        granularity: "daily" as Granularity,
        label: "Last 7 Days",
        comparisonLabel: "vs previous 7 days",
      };
    }

    if (preset === "30d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        from: start.toISOString(),
        to: end.toISOString(),
        granularity: "daily" as Granularity,
        label: "Last 30 Days",
        comparisonLabel: "vs previous 30 days",
      };
    }

    // Custom
    const d1 = new Date(customDates.from);
    const d2 = new Date(customDates.to);
    const diffDays = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));

    let granularity: Granularity = "daily";
    if (diffDays <= 2) {
      granularity = "hourly";
    } else if (diffDays <= 90) {
      granularity = "daily";
    } else {
      granularity = "weekly";
    }

    return {
      from: customDates.from,
      to: customDates.to,
      granularity,
      label: formatCustomLabel(customDates.from, customDates.to),
      comparisonLabel: "vs previous period",
    };
  }, [preset, customDates]);

  // Synchronize state changes to URL search params
  const updateUrl = useCallback(
    (newPreset: DateRangePreset, fromIso?: string, toIso?: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("range", newPreset);
          if (newPreset === "custom" && fromIso && toIso) {
            next.set("from", fromIso);
            next.set("to", toIso);
          } else {
            next.delete("from");
            next.delete("to");
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setPreset = useCallback(
    (newPreset: "today" | "7d" | "30d") => {
      setPresetState(newPreset);
      updateUrl(newPreset);
    },
    [updateUrl]
  );

  const setCustomRange = useCallback(
    (fromDate: string, toDate: string) => {
      const d1 = new Date(fromDate);
      d1.setHours(0, 0, 0, 0);
      const d2 = new Date(toDate);
      d2.setHours(23, 59, 59, 999);

      const fromIso = d1.toISOString();
      const toIso = d2.toISOString();

      setCustomDates({ from: fromIso, to: toIso });
      setPresetState("custom");
      updateUrl("custom", fromIso, toIso);
    },
    [updateUrl]
  );

  const setRange = useCallback(
    (newPreset: DateRangePreset, from?: string, to?: string) => {
      if (newPreset === "custom" && from && to) {
        setCustomRange(from, to);
      } else if (newPreset === "today" || newPreset === "7d" || newPreset === "30d") {
        setPreset(newPreset);
      }
    },
    [setCustomRange, setPreset]
  );

  const value: DateRangeState = {
    preset,
    from: computedRange.from,
    to: computedRange.to,
    granularity: computedRange.granularity,
    label: computedRange.label,
    comparisonLabel: computedRange.comparisonLabel,
    setPreset,
    setCustomRange,
    setRange,
  };

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): DateRangeState {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  return context;
}
