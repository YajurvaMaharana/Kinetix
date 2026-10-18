import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import SkeletonLoader from "@/components/SkeletonLoader";
import CustomRangePopover from "@/components/CustomRangePopover";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useDateRange, DateRangePreset } from "@/context/DateRangeContext";
import { useOverviewData, ChartPoint } from "@/hooks/useOverviewData";
import { PayoutApproval } from "@/data/mockData";
import {
  ShieldAlert,
  Activity,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  TrendingUp,
  Clock,
  Calendar,
  CalendarDays,
  Layers,
  Filter,
} from "lucide-react";

// Generate smooth SVG path from numerical values normalized to viewBox
function generateSvgPath(
  values: number[],
  viewBoxWidth: number,
  viewBoxHeight: number,
  paddingY: number = 20
): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    return `M 0 ${viewBoxHeight / 2} L ${viewBoxWidth} ${viewBoxHeight / 2}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableHeight = viewBoxHeight - paddingY * 2;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * viewBoxWidth;
    const y = viewBoxHeight - paddingY - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  // Build smooth bezier path
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    path += ` C ${cpX.toFixed(1)} ${p0.y.toFixed(1)}, ${cpX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return path;
}

export default function OverviewPage() {
  const { role, canDeployPolicies, isReadOnly } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Global Date Range Context
  const {
    preset,
    from,
    to,
    granularity,
    label,
    comparisonLabel,
    setRange,
    setCustomRange,
    setPreset,
  } = useDateRange();

  // Custom Range Popover Open State
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);

  // Synced telemetry ticker (updates every second)
  const [syncedSeconds, setSyncedSeconds] = useState(0);

  // Fetch data driven by Date Range
  const { data, loading, error, refetch, updatePendingPayouts } = useOverviewData({
    preset,
    from,
    to,
    granularity,
  });

  // Hover state for interactive chart tooltip
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Reset synced ticker whenever fresh data arrives
  useEffect(() => {
    setSyncedSeconds(0);
    const interval = setInterval(() => {
      setSyncedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.fetchedAt]);

  const handlePayoutAction = (id: string, action: "release" | "block") => {
    if (isReadOnly) {
      showToast({
        type: "warning",
        title: "Action Restricted",
        message: "Auditor role has read-only permissions.",
      });
      return;
    }

    updatePendingPayouts((prev) => prev.filter((p) => p.id !== id));
    showToast({
      type: action === "release" ? "success" : "error",
      title: action === "release" ? "Payout Released" : "Payout Blocked & Flagged",
      message:
        action === "release"
          ? "Funds dispatched to courier instant wallet."
          : "Payout quarantined and security case opened.",
    });
  };

  // Export audit ledger with selected date range in filename
  const handleExport = () => {
    const fromDateStr = from.slice(0, 10);
    const toDateStr = to.slice(0, 10);
    const filename = `audit-ledger-${fromDateStr}_to_${toDateStr}.csv`;

    const csvContent =
      "data:text/csv;charset=utf-8," +
      `Audit Ledger Export: ${from} to ${to}\n` +
      `Preset: ${preset}, Granularity: ${granularity}\n` +
      `Active Couriers,${data?.metrics.activeCouriers || "0"}\n` +
      `Collusion Rings,${data?.metrics.collusionRings || "0"}\n` +
      `Payouts Under Review,${data?.metrics.payoutsUnderReview || "$0"}\n` +
      `Automated Release Rate,${data?.metrics.automatedReleaseRate || "98.7%"}\n\n` +
      "Timestamp,Nominal_Flow,Challenges,Spoof_Spikes\n" +
      (data?.chart.points || [])
        .map((p) => `${p.timestamp},${p.nominal},${p.challenges},${p.spoofs}`)
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      type: "success",
      title: "Ledger Export Complete",
      message: `Downloaded ${filename} for period ${fromDateStr} to ${toDateStr}.`,
    });
  };

  const handleDeployPolicy = () => {
    if (!canDeployPolicies) {
      showToast({
        type: "warning",
        title: "Permission Required",
        message: "Only Admin role can deploy new risk policies. Switch to Admin in the top bar.",
      });
      return;
    }
    navigate("/money/policies");
  };

  // Handle clicking on preset pills
  const handlePillClick = (selectedPreset: "today" | "7d" | "30d" | "custom") => {
    if (selectedPreset === "custom") {
      setCustomPopoverOpen(true);
    } else {
      setRange(selectedPreset);
    }
  };

  // Chart computed values
  const chartPoints = useMemo(() => data?.chart.points || [], [data?.chart.points]);
  const nominalPath = useMemo(
    () => generateSvgPath(chartPoints.map((p) => p.nominal), 600, 200, 24),
    [chartPoints]
  );
  const challengePath = useMemo(
    () => generateSvgPath(chartPoints.map((p) => p.challenges), 600, 200, 24),
    [chartPoints]
  );
  const spoofPath = useMemo(
    () => generateSvgPath(chartPoints.map((p) => p.spoofs), 600, 200, 24),
    [chartPoints]
  );

  // Evenly spaced x-axis labels
  const axisLabels = useMemo(() => {
    if (chartPoints.length === 0) return [];
    if (chartPoints.length <= 7) return chartPoints.map((p) => p.label);
    const count = 6;
    const step = (chartPoints.length - 1) / (count - 1);
    return Array.from({ length: count }).map((_, i) => {
      const idx = Math.min(chartPoints.length - 1, Math.round(i * step));
      return chartPoints[idx].label;
    });
  }, [chartPoints]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Autonomous Ecosystem Integrity"
        title="Fleet Fraud & Payout Command Center"
        subtitle={`Live risk orchestration across 18 delivery hubs • Real-time telemetry synced ${syncedSeconds}s ago`}
        secondaryAction={{
          label: "Export Audit Ledger",
          icon: Download,
          onClick: handleExport,
        }}
        primaryAction={{
          label: "Deploy New Policy",
          icon: Sparkles,
          onClick: handleDeployPolicy,
          disabled: !canDeployPolicies,
          variant: "primary",
        }}
      />

      {/* Date Range Selector Pills */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "today", label: "Today" },
              { id: "7d", label: "Last 7 Days" },
              { id: "30d", label: "Last 30 Days" },
              {
                id: "custom",
                label: preset === "custom" ? label : "Custom Range",
                isCustom: true,
              },
            ].map((tab) => {
              const isActive = preset === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handlePillClick(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[var(--primary)] text-white shadow-md ring-2 ring-[var(--primary)]/20"
                      : "text-[var(--ink)] hover:bg-[var(--surface-alt)] border border-transparent"
                  }`}
                >
                  {tab.isCustom ? (
                    <CalendarDays className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 opacity-80" />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pr-2">
            <span className="text-[11px] font-bold text-[var(--muted)]">
              Comparison Baseline: <span className="text-[var(--ink)]">{comparisonLabel}</span>
            </span>
          </div>
        </div>

        {/* STEP 4: Temporary Debug Strip */}
        <div className="font-mono text-[11px] text-[var(--muted)] px-3.5 py-1.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div>
            range=<span className="font-bold text-[var(--ink)]">{preset}</span> |{" "}
            <span>{from}</span> -&gt; <span>{to}</span> | granularity=
            <span className="font-bold text-[var(--primary)]">{granularity}</span> | source=
            <span className="font-bold text-emerald-600">{data?.source || "mock"}</span> | fetched{" "}
            <span className="font-bold text-[var(--ink)]">{data?.fetchedAt || "--:--:--"}</span>
          </div>
          {loading && (
            <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold text-[10px] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
              <span>Fetching Range Telemetry...</span>
            </div>
          )}
        </div>
      </div>

      {/* Custom Range Popover Modal */}
      <CustomRangePopover
        isOpen={customPopoverOpen}
        initialFrom={from}
        initialTo={to}
        onClose={() => setCustomPopoverOpen(false)}
        onApply={(newFrom, newTo) => {
          setCustomRange(newFrom, newTo);
        }}
      />

      {/* 4 Key Metrics Cards */}
      {loading && !data ? (
        <SkeletonLoader type="metrics" count={4} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Active Couriers */}
          <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Total Active Couriers
              </span>
              <span className="p-2 rounded-xl bg-[var(--status-allow)]/15 text-[var(--status-allow)]">
                🚴
              </span>
            </div>
            <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
              {data?.metrics.activeCouriers || "0"}
            </div>
            <div className="mt-2 text-xs font-bold text-[var(--status-allow)] flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{data?.metrics.activeCouriersGrowth}</span>
            </div>
          </div>

          {/* Card 2: Collusion Rings Intercepted */}
          <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Collusion Rings Intercepted
              </span>
              <span className="p-2 rounded-xl bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]">
                🛡️
              </span>
            </div>
            <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
              {data?.metrics.collusionRings || "0"}
            </div>
            <div className="mt-2 text-xs font-semibold text-[var(--muted)]">
              <span className="text-[var(--status-escalate)] font-bold">
                {data?.metrics.collusionHighPriorityText}
              </span>{" "}
              isolated by AI
            </div>
          </div>

          {/* Card 3: Payouts Under Review */}
          <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Payouts Under Review
              </span>
              <span className="p-2 rounded-xl bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]">
                ⏳
              </span>
            </div>
            <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
              {data?.metrics.payoutsUnderReview || "$0"}
            </div>
            <div className="mt-2 text-xs font-semibold text-[var(--muted)]">
              <span className="text-[var(--status-challenge)] font-bold">
                {data?.metrics.payoutsPendingCountText}
              </span>{" "}
              active challenges
            </div>
          </div>

          {/* Card 4: Automated Release Rate */}
          <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Automated Release Rate
              </span>
              <span className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                ✨
              </span>
            </div>
            <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
              {data?.metrics.automatedReleaseRate || "98.7%"}
            </div>
            <div className="mt-2 text-xs font-semibold text-[var(--muted)]">
              <span className="text-[var(--status-allow)] font-bold">
                {data?.metrics.disputeRateText}
              </span>{" "}
              appeal index
            </div>
          </div>
        </div>
      )}

      {/* Middle Split View: Live Risk Trajectory Chart & Pending Payout Approvals */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Live Risk Trajectory & Anomaly Frequency Chart (8 cols) */}
        <div className="lg:col-span-8 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-extrabold text-base text-[var(--ink)]">
                  Risk Trajectory &amp; Anomaly Frequency (
                  {preset === "today"
                    ? "Today • 24 Hours"
                    : preset === "7d"
                    ? "Last 7 Days"
                    : preset === "30d"
                    ? "Last 30 Days"
                    : label}
                  )
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Telemetry streams evaluated across GPS shifts, batching cadence, &amp; device MAC vectors
                  ({granularity} sampling)
                </p>
              </div>

              {/* Dynamic Legend with Real Range Totals */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-allow)]" />
                  <span>Nominal ({data?.chart.nominalTotal.toLocaleString() || "0"})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-challenge)]" />
                  <span>Challenge ({data?.chart.challengeTotal.toLocaleString() || "0"})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-escalate)]" />
                  <span>Spoof ({data?.chart.spoofTotal.toLocaleString() || "0"})</span>
                </span>
              </div>
            </div>

            {/* SVG Chart Visualization */}
            <div className="h-64 bg-[var(--surface-alt)] rounded-xl border border-[var(--border-subtle)] relative p-4 flex items-end overflow-hidden group">
              {/* Grid Background Lines */}
              <div className="absolute inset-x-4 inset-y-4 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-[var(--ink)]/40 w-full" />
                <div className="border-b border-[var(--ink)]/40 w-full" />
                <div className="border-b border-[var(--ink)]/40 w-full" />
                <div className="border-b border-[var(--ink)]/40 w-full" />
              </div>

              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <SkeletonLoader type="card" count={1} />
                </div>
              ) : (
                <>
                  <svg
                    className="absolute inset-0 w-full h-full p-4 overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 600 200"
                  >
                    {/* Nominal Flow Line */}
                    <path
                      d={nominalPath}
                      fill="none"
                      stroke="var(--status-allow)"
                      strokeWidth="2.5"
                    />
                    {/* Challenge Queue Line */}
                    <path
                      d={challengePath}
                      fill="none"
                      stroke="var(--status-challenge)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    {/* Spoof Spikes Line */}
                    <path
                      d={spoofPath}
                      fill="none"
                      stroke="var(--status-escalate)"
                      strokeWidth="2.5"
                    />

                    {/* Interactive hover points */}
                    {chartPoints.map((pt, i) => {
                      const x = (i / Math.max(1, chartPoints.length - 1)) * 600;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={100}
                          r={hoveredIndex === i ? 6 : 3}
                          className="cursor-pointer fill-[var(--primary)] opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all"
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Active Tooltip on Hover */}
                  {hoveredIndex !== null && chartPoints[hoveredIndex] && (
                    <div className="absolute top-4 right-4 z-20 bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)] shadow-plum text-xs pointer-events-none animate-in fade-in">
                      <div className="font-extrabold text-[var(--ink)] mb-1">
                        {chartPoints[hoveredIndex].timestamp}
                      </div>
                      <div className="space-y-0.5 text-[11px]">
                        <div className="text-[var(--status-allow)] font-bold">
                          Nominal: {chartPoints[hoveredIndex].nominal.toLocaleString()}
                        </div>
                        <div className="text-[var(--status-challenge)] font-bold">
                          Challenge: {chartPoints[hoveredIndex].challenges.toLocaleString()}
                        </div>
                        <div className="text-[var(--status-escalate)] font-bold">
                          Spoof Spikes: {chartPoints[hoveredIndex].spoofs.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Range Callout Badges */}
                  {data?.chart.callout1 && (
                    <div className="absolute top-8 left-[35%] bg-[var(--surface)] rounded-xl shadow-plum p-2 border border-[var(--border)] text-[10px] pointer-events-none">
                      <div className="font-bold text-[var(--ink)]">
                        {data.chart.callout1.time} • {data.chart.callout1.title}
                      </div>
                      <div className="text-[var(--muted)]">{data.chart.callout1.subtitle}</div>
                    </div>
                  )}

                  {data?.chart.callout2 && (
                    <div className="absolute top-4 right-8 bg-[var(--surface)] rounded-xl shadow-plum p-2 border border-[var(--border)] text-[10px] pointer-events-none">
                      <div className="font-bold text-[var(--status-escalate)]">
                        {data.chart.callout2.time} • {data.chart.callout2.title}
                      </div>
                      <div className="text-[var(--muted)]">{data.chart.callout2.subtitle}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Dynamic X-Axis Labels */}
          <div className="flex justify-between text-xs text-[var(--muted)] font-semibold pt-4 mt-4 border-t border-[var(--border-subtle)]">
            {axisLabels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>

        {/* Right: Pending Payout Approvals Driven by Range (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-base text-[var(--ink)]">
                Pending Payout Approvals ({data?.pendingPayouts.length || 0})
              </h3>
              <span className="text-[11px] font-mono font-bold text-[var(--status-challenge)] bg-[var(--status-challenge)]/10 px-2.5 py-0.5 rounded-full">
                Next ACH: 42m
              </span>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {!data || data.pendingPayouts.length === 0 ? (
                <div className="text-center py-10 text-xs text-[var(--muted)]">
                  <CheckCircle2 className="w-8 h-8 text-[var(--status-allow)] mx-auto mb-2" />
                  All pending payouts have been successfully cleared for this range.
                </div>
              ) : (
                data.pendingPayouts.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-extrabold text-[var(--ink)]">
                        ${item.amount.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === "IBAN Conflict"
                            ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                            : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed">{item.reason}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        onClick={() => handlePayoutAction(item.id, "release")}
                        disabled={isReadOnly}
                        className="py-1.5 rounded-full bg-[var(--status-allow)] hover:bg-[#28ab80] text-white font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        Release
                      </button>
                      <button
                        onClick={() => handlePayoutAction(item.id, "block")}
                        disabled={isReadOnly}
                        className="py-1.5 rounded-full bg-[var(--status-escalate)] hover:bg-[#d43f44] text-white font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        Block &amp; Flag
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Multi-Agent Collusion Radar link */}
          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Multi-Agent Collusion Radar</span>
              </h4>
              <span className="text-[10px] font-mono text-[var(--muted)]">Graph Analysis</span>
            </div>
            <p className="text-[11px] text-[var(--muted)] mb-3">
              Graph analysis isolating {data?.metrics.collusionRings || "14"} interconnected courier nodes sharing
              device UUIDs &amp; delivery endpoints.
            </p>
            <Link
              to="/monitor/graph"
              className="w-full py-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--primary)] font-bold text-xs hover:bg-[var(--lavender)] transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Open Graph Inspector</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Fleet Alerts & Triage Queue Table Driven by Range */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-lg text-[var(--ink)]">
                Recent Fleet Alerts &amp; Triage Queue
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">
                {data?.alerts.length || 0} Priority
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Real-time anomalous courier sessions requiring automated or human adjudication within {label}
            </p>
          </div>

          <Link
            to="/cases/investigations"
            className="px-4 py-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] text-xs font-bold hover:bg-[var(--lavender)] transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>View Full Investigation Dossier</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[var(--primary)]" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                <th className="pb-3 px-4">Courier ID &amp; Name</th>
                <th className="pb-3 px-4">Route Hub</th>
                <th className="pb-3 px-4">Risk Factor Detected</th>
                <th className="pb-3 px-4">AI Risk</th>
                <th className="pb-3 px-4">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs font-semibold">
              {!data || data.alerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[var(--muted)]">
                    No active alerts detected within this period.
                  </td>
                </tr>
              ) : (
                data.alerts.map((al) => (
                  <tr key={al.id} className="hover:bg-[var(--surface-alt)]/60 transition-colors">
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                          al.status === "Allow"
                            ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                            : al.status === "Challenge"
                            ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                            : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                        }`}
                      >
                        {al.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-extrabold text-[var(--ink)]">{al.name}</div>
                        <div className="text-[10px] font-mono text-[var(--muted)]">
                          {al.courier_id}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted)]">{al.hub}</td>
                    <td className="py-3.5 px-4 text-[var(--ink)] font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-escalate)]" />
                      <span>{al.risk_factor}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-mono font-extrabold ${
                          al.ai_risk > 70
                            ? "text-[var(--status-escalate)]"
                            : al.ai_risk > 40
                            ? "text-[var(--status-challenge)]"
                            : "text-[var(--status-allow)]"
                        }`}
                      >
                        {al.ai_risk}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                          al.status === "Allow"
                            ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                            : al.status === "Challenge"
                            ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                            : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            al.status === "Allow"
                              ? "bg-[var(--status-allow)]"
                              : al.status === "Challenge"
                              ? "bg-[var(--status-challenge)]"
                              : "bg-[var(--status-escalate)]"
                          }`}
                        />
                        {al.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equilibrium Core Banner at Bottom */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center font-bold text-xl shadow-sm">
            🛡️
          </div>
          <div>
            <h4 className="font-extrabold text-base text-[var(--ink)]">
              Kinetix Equilibrium Core Active
            </h4>
            <p className="text-xs text-[var(--muted)]">
              Continuous multi-tenant fraud guardian shielding $3.2M in daily gig worker disbursements.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-bold shrink-0">
          <div>
            <div className="text-[var(--muted)] text-[10px]">Engine Latency</div>
            <div className="text-[var(--ink)] font-mono text-sm">18ms</div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[var(--status-allow)]/15 text-[var(--status-allow)] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>High Fidelity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
