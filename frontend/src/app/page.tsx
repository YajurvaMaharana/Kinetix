"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Activity,
  CheckCircle2,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  Search,
  ShieldCheck,
  Fingerprint,
  Radio,
  MapPin,
  Clock,
  ChevronRight,
} from "lucide-react";
import { HealthStatus, Role } from "@/lib/types";
import { getHealth, getActiveRole } from "@/lib/api";

interface SessionDeskItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  riskScore: number;
  anomalyVector: string;
  anomalyDetail: string;
  mitigationSafeguard: string;
  status: "ESCALATED" | "EVALUATING" | "CHALLENGED" | "RESOLVED";
  statusColor: string;
  verdict: "BLOCK" | "CHALLENGE" | "INVESTIGATE" | "ALLOW";
  caseId: string;
}

const mockDeskSessions: SessionDeskItem[] = [
  {
    id: "ses_98a7f10b",
    name: "Marcus Vance",
    role: "Verified Courier · Tier 1",
    avatar: "MV",
    riskScore: 89,
    anomalyVector: "Unregistered iPhone 15",
    anomalyDetail: "Concurrent delivery ping 14km apart in 180s (Case #INV-8902)",
    mitigationSafeguard: "18-mo clean history; residential IP",
    status: "ESCALATED",
    statusColor: "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]",
    verdict: "INVESTIGATE",
    caseId: "INV-2024-8902",
  },
  {
    id: "ses_019c4d2e",
    name: "Elena Rostova",
    role: "Contract Rider · Downtown",
    avatar: "ER",
    riskScore: 42,
    anomalyVector: "Touch Kinematics Jitter",
    anomalyDetail: "Typing cadence drop from 240 to 95 cpm",
    mitigationSafeguard: "Native iOS Secure Enclave attestation valid",
    status: "CHALLENGED",
    statusColor: "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]",
    verdict: "CHALLENGE",
    caseId: "INV-2024-8903",
  },
  {
    id: "ses_fa2981bc",
    name: "Dmitri Kazakov",
    role: "Express Courier · SFO",
    avatar: "DK",
    riskScore: 94,
    anomalyVector: "Syndicate Farm Node #14",
    anomalyDetail: "Shared IMEI & routing account with Cluster 409 (Escrow Hold)",
    mitigationSafeguard: "No mitigating factors; auto-gated escrow",
    status: "ESCALATED",
    statusColor: "border-red-500/40 bg-red-500/10 text-red-400",
    verdict: "BLOCK",
    caseId: "INV-2024-8905",
  },
  {
    id: "ses_3b819f04",
    name: "Chen Wei",
    role: "Standard Passenger · Chicago",
    avatar: "CW",
    riskScore: 18,
    anomalyVector: "Interstate Geo-Transit",
    anomalyDetail: "Origin shift +540km post-flight landing",
    mitigationSafeguard: "Flight timeline matches ticket receipt OCR",
    status: "RESOLVED",
    statusColor: "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]",
    verdict: "ALLOW",
    caseId: "INV-2024-8899",
  },
  {
    id: "ses_7781a94d",
    name: "Sarah Jenkins",
    role: "On-Demand Driver · Austin",
    avatar: "SJ",
    riskScore: 61,
    anomalyVector: "Mock GPS Provider Flag",
    anomalyDetail: "Fused location provider reported fake provider",
    mitigationSafeguard: "Cell tower triangulation pending verification",
    status: "EVALUATING",
    statusColor: "border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA]",
    verdict: "CHALLENGE",
    caseId: "INV-2024-8908",
  },
];

const liveSignals = [
  {
    icon: Fingerprint,
    type: "HARDWARE_ATTESTATION",
    title: "Device Fingerprint Collision",
    desc: "Single IMEI hash (DEV_HASH_778899) claimed across 4 distinct driver IDs within 9 minutes.",
    source: "Edge Attestation Broker · Node #04",
    time: "4s ago",
    severity: "CRITICAL",
    badgeColor: "border-red-500/40 bg-red-500/10 text-red-400",
  },
  {
    icon: MapPin,
    type: "KINEMATIC_ANOMALY",
    title: "Impossible Velocity Spike (184 km/h)",
    desc: "Downtown Manhattan delivery route recorded impossible leap across 4 cross-streets without acceleration.",
    source: "Kinematics Vector Model v2.4",
    time: "28s ago",
    severity: "HIGH",
    badgeColor: "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]",
  },
  {
    icon: Radio,
    type: "BIOMETRIC_MISMATCH",
    title: "Face Liveness Verification Divergence",
    desc: "Secondary passenger selfie match confidence 0.38 against enrolled driver profile. Step-Up triggered.",
    source: "InsightFace Biometric Pipeline",
    time: "1m ago",
    severity: "MEDIUM",
    badgeColor: "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]",
  },
  {
    icon: ShieldCheck,
    type: "POLICY_CLEARANCE",
    title: "False-Positive Safeguard Applied",
    desc: "Courier Elena R. cleared automatically based on 18-month unblemished driver rating & carrier validation.",
    source: "Trust Governance Engine",
    time: "2m ago",
    severity: "CLEARED",
    badgeColor: "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]",
  },
];

type TimeRangeKey = "15m" | "1h" | "24h" | "7d";

interface TimeRangeData {
  range: TimeRangeKey;
  label: string;
  sublabel: string;
  timeAxis: string[];
  normalLinePath: string;
  normalAreaPath: string;
  anomalyLinePath: string;
  anomalyAreaPath: string;
  peakPoint: { cx: number; cy: number; normalCy: number };
  peakIncident: string;
  peakScore: number;
  peakSeverity: "HIGH" | "CRITICAL" | "BLOCK";
  eventsProcessed: string;
  avgLatency: string;
  anomalyRatio: string;
  brierScore: string;
  surgeTrend: string;
}

const timeSeriesDatasets: Record<TimeRangeKey, TimeRangeData> = {
  "15m": {
    range: "15m",
    label: "Last 15 Minutes",
    sublabel: "1-minute telemetry resolution · Real-time socket window",
    timeAxis: ["15:00", "15:03", "15:06", "15:09", "15:12", "15:15"],
    normalLinePath: "M 0 160 Q 95 150 190 155 T 380 145 T 570 150 T 760 148",
    normalAreaPath: "M 0 160 Q 95 150 190 155 T 380 145 T 570 150 T 760 148 L 760 200 L 0 200 Z",
    anomalyLinePath: "M 0 195 Q 150 190 300 185 Q 400 170 475 75 Q 520 85 570 185 T 760 192",
    anomalyAreaPath: "M 0 195 Q 150 190 300 185 Q 400 170 475 75 Q 520 85 570 185 T 760 192 L 760 200 L 0 200 Z",
    peakPoint: { cx: 475, cy: 75, normalCy: 148 },
    peakIncident: "15:11 UTC (Kinematic Cadence Jitter · 95 cpm)",
    peakScore: 72,
    peakSeverity: "HIGH",
    eventsProcessed: "3,140 events",
    avgLatency: "11.8ms",
    anomalyRatio: "1.8%",
    brierScore: "0.014",
    surgeTrend: "+0.4% vs median",
  },
  "1h": {
    range: "1h",
    label: "Last 1 Hour",
    sublabel: "5-minute rolling window · Ingested delivery velocity vs anomaly threshold",
    timeAxis: ["14:15", "14:30", "14:45", "15:00", "15:15"],
    normalLinePath: "M 0 170 Q 70 160 130 145 T 260 130 T 380 120 T 500 135 T 600 95 T 670 125 T 760 110",
    normalAreaPath: "M 0 170 Q 70 160 130 145 T 260 130 T 380 120 T 500 135 T 600 95 T 670 125 T 760 110 L 760 200 L 0 200 Z",
    anomalyLinePath: "M 0 200 Q 120 195 240 190 T 390 185 T 510 180 T 570 145 Q 590 55 605 52 Q 620 62 635 155 T 700 185 T 760 190",
    anomalyAreaPath: "M 0 200 Q 120 195 240 190 T 390 185 T 510 180 T 570 145 Q 590 55 605 52 Q 620 62 635 155 T 700 185 T 760 190 L 760 200 L 0 200 Z",
    peakPoint: { cx: 605, cy: 52, normalCy: 95 },
    peakIncident: "14:32 UTC (Dual GPS Jump · +14km in 180s)",
    peakScore: 89,
    peakSeverity: "CRITICAL",
    eventsProcessed: "14,892 events",
    avgLatency: "14.2ms",
    anomalyRatio: "3.4%",
    brierScore: "0.019",
    surgeTrend: "+2.1% vs median",
  },
  "24h": {
    range: "24h",
    label: "Last 24 Hours",
    sublabel: "Diurnal fleet telemetry · Rush-hour transit vs nighttime syndicate bursts",
    timeAxis: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "Now"],
    normalLinePath: "M 0 180 Q 95 190 190 165 T 380 110 T 570 130 T 760 150",
    normalAreaPath: "M 0 180 Q 95 190 190 165 T 380 110 T 570 130 T 760 150 L 760 200 L 0 200 Z",
    anomalyLinePath: "M 0 195 Q 60 190 120 185 Q 170 170 210 45 Q 250 80 320 185 T 500 188 T 760 190",
    anomalyAreaPath: "M 0 195 Q 60 190 120 185 Q 170 170 210 45 Q 250 80 320 185 T 500 188 T 760 190 L 760 200 L 0 200 Z",
    peakPoint: { cx: 210, cy: 45, normalCy: 165 },
    peakIncident: "03:15 UTC (Cluster-409 Midnight Batch Drain)",
    peakScore: 94,
    peakSeverity: "CRITICAL",
    eventsProcessed: "242,100 events",
    avgLatency: "15.8ms",
    anomalyRatio: "5.2%",
    brierScore: "0.023",
    surgeTrend: "+5.8% overnight surge",
  },
  "7d": {
    range: "7d",
    label: "Last 7 Days",
    sublabel: "Weekly aggregated baseline · Macro anomaly trends across transit corridors",
    timeAxis: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    normalLinePath: "M 0 145 Q 100 130 200 140 T 400 135 T 550 100 T 760 115",
    normalAreaPath: "M 0 145 Q 100 130 200 140 T 400 135 T 550 100 T 760 115 L 760 200 L 0 200 Z",
    anomalyLinePath: "M 0 190 Q 120 185 240 188 T 420 180 Q 500 160 540 38 Q 580 80 640 175 T 760 182",
    anomalyAreaPath: "M 0 190 Q 120 185 240 188 T 420 180 Q 500 160 540 38 Q 580 80 640 175 T 760 182 L 760 200 L 0 200 Z",
    peakPoint: { cx: 540, cy: 38, normalCy: 100 },
    peakIncident: "Friday 23:10 UTC (Redmi Farm Syndicate Ring · 14 Nodes)",
    peakScore: 96,
    peakSeverity: "BLOCK",
    eventsProcessed: "1,480,000 events",
    avgLatency: "16.4ms",
    anomalyRatio: "6.1%",
    brierScore: "0.026",
    surgeTrend: "+8.4% weekend cluster",
  },
};

export default function SecurityOverviewPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [activeRole, setActiveRoleState] = useState<Role>("analyst");
  const [timeRange, setTimeRange] = useState<"15m" | "1h" | "24h" | "7d">("1h");
  const [tableFilter, setTableFilter] = useState<"ALL" | "FLAGGED" | "CHALLENGED" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [signalFilter, setSignalFilter] = useState<string | null>(null);

  const fetchHealthStatus = useCallback(async () => {
    setLoadingHealth(true);
    setHealthError(null);
    const start = performance.now();
    try {
      const data = await getHealth();
      const elapsed = Math.round(performance.now() - start);
      setHealth(data);
      setLatencyMs(elapsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      setHealthError(msg);
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthStatus();
    setActiveRoleState(getActiveRole());

    const handleRoleChanged = () => {
      setActiveRoleState(getActiveRole());
      fetchHealthStatus();
    };
    window.addEventListener("trustjuggler:role_changed", handleRoleChanged);
    return () => window.removeEventListener("trustjuggler:role_changed", handleRoleChanged);
  }, [fetchHealthStatus]);

  const filteredSessions = useMemo(() => {
    return mockDeskSessions.filter((s) => {
      if (tableFilter === "FLAGGED" && s.status !== "ESCALATED") return false;
      if (tableFilter === "CHALLENGED" && s.status !== "CHALLENGED") return false;
      if (tableFilter === "RESOLVED" && s.status !== "RESOLVED") return false;
      if (
        searchQuery &&
        !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.anomalyVector.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tableFilter, searchQuery]);

  const filteredSignals = useMemo(() => {
    if (!signalFilter) return liveSignals;
    return liveSignals.filter((s) => s.type === signalFilter);
  }, [signalFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner & Breadcrumbs */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span>Security Operations Center</span>
            <span>/</span>
            <span className="text-slate-200">Autonomous Risk Synthesis</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>Security Overview</span>
            <span className="rounded-full bg-[#56D9F5]/10 border border-[#56D9F5]/30 px-2.5 py-0.5 text-xs font-mono font-semibold text-[#56D9F5]">
              SYNTHETIC SANDBOX • LIVE
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time multi-signal telemetry ingestion, hardware biometric attestation, and calibrated fraud prevention.
          </p>
        </div>

        {/* Live Controls & Health Ping */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Backend Connection Indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101521] px-3 py-1.5 text-xs font-mono">
            {loadingHealth ? (
              <span className="inline-block h-2 w-2 rounded-full bg-[#56D9F5] animate-ping" />
            ) : health?.status === "healthy" ? (
              <span className="inline-block h-2 w-2 rounded-full bg-[#34D399]" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-[#FB7185]" />
            )}
            <span className={health?.status === "healthy" ? "text-[#34D399]" : "text-[#FB7185]"}>
              {health ? `Backend: ${health.status}` : healthError ? "Backend: Offline" : "Backend: Connecting"}
            </span>
            {latencyMs !== null && <span className="text-slate-500">({latencyMs}ms)</span>}
          </div>

          <button
            onClick={fetchHealthStatus}
            disabled={loadingHealth}
            className="flex items-center gap-1.5 rounded-lg border border-[#56D9F5]/30 bg-[#56D9F5]/10 px-3 py-1.5 text-xs font-semibold text-[#56D9F5] hover:bg-[#56D9F5]/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingHealth ? "animate-spin" : ""}`} />
            Pings
          </button>
        </div>
      </div>

      {/* LEVEL 0: KPI METRICS DECK */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 relative overflow-hidden transition-all hover:border-slate-700">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Total Active Ingestion Sessions</span>
            <span className="rounded bg-[#56D9F5]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#56D9F5] flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +8.4%
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-white">14,892</span>
            {/* Sparkline SVG */}
            <svg aria-hidden="true" className="w-24 h-7 text-[#56D9F5]" fill="none" viewBox="0 0 112 32">
              <path d="M0 24 Q 28 8, 56 18 T 112 4" stroke="#56D9F5" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Across 18 urban markets · Ingestion stream active</p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 relative overflow-hidden transition-all hover:border-slate-700">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Calibrated High-Risk Flags</span>
            <span className="rounded bg-[#FB7185]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#FB7185] flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> -12.3% FP
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-[#FB7185]">167</span>
            <svg aria-hidden="true" className="w-24 h-7 text-[#FB7185]" fill="none" viewBox="0 0 112 32">
              <path d="M0 8 Q 28 22, 56 12 T 112 28" stroke="#FB7185" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Brier score 0.019 · Probabilistic Bayesian prior</p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 relative overflow-hidden transition-all hover:border-slate-700">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Collusion Ring Incursions</span>
            <span className="rounded bg-[#A78BFA]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#A78BFA]">
              14 Nodes Gated
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-[#A78BFA]">3 Active</span>
            <svg aria-hidden="true" className="w-24 h-7 text-[#A78BFA]" fill="none" viewBox="0 0 112 32">
              <path d="M0 20 Q 35 4, 70 24 T 112 8" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">NetworkX syndicate topology · Cluster 409 locked</p>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 relative overflow-hidden transition-all hover:border-slate-700">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Escrow Protected Payouts</span>
            <span className="rounded bg-[#34D399]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#34D399]">
              99.2% Cleared
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-[#34D399]">$42,850</span>
            <svg aria-hidden="true" className="w-24 h-7 text-[#34D399]" fill="none" viewBox="0 0 112 32">
              <path d="M0 26 Q 28 14, 56 16 T 112 6" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Automated hold prevents coordinated driver drain</p>
        </div>
      </section>



      {/* LEVEL 1: TIME-SERIES ANOMALY ACTIVITY & CALIBRATED RISK */}
      <section className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Time Series Area Chart */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#56D9F5]" />
                  Identity Risk Activity (Time-Series)
                </h2>
                <span className="rounded bg-[#56D9F5]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#56D9F5] border border-[#56D9F5]/30">
                  {timeSeriesDatasets[timeRange].label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {timeSeriesDatasets[timeRange].sublabel}
              </p>
            </div>

            {/* Functional Time-range selector buttons */}
            <div className="flex items-center gap-1 rounded-lg bg-[#080B12] p-1 border border-slate-800 text-xs font-mono" role="group" aria-label="Chart time range selector">
              {(["15m", "1h", "24h", "7d"] as const).map((range) => {
                const isSelected = timeRange === range;
                return (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    aria-pressed={isSelected}
                    aria-label={`Select ${range} time window`}
                    className={`rounded px-2.5 py-1 transition-all cursor-pointer font-bold ${
                      isSelected
                        ? "bg-[#56D9F5]/20 text-[#56D9F5] border border-[#56D9F5]/40 shadow-sm shadow-[#56D9F5]/15"
                        : "text-slate-400 hover:text-slate-200 hover:bg-[#101521] border border-transparent"
                    }`}
                  >
                    {range}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Area Chart SVG */}
          <div className="relative h-64 w-full overflow-hidden rounded-lg bg-[#080B12] border border-slate-800/80 p-2">
            <div className="absolute top-3 left-4 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 z-20">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#56D9F5]" /> Normal Telemetry Volume
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#FB7185]" /> Anomaly Vectors
              </span>
              <span className="rounded border border-slate-800 bg-[#101521] px-2 py-0.5 text-[10px] text-slate-400">
                Simulated Fixtures
              </span>
            </div>

            <svg className="w-full h-full relative z-10" preserveAspectRatio="none" viewBox="0 0 760 230">
              <defs>
                <linearGradient id="chartCyanGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#56D9F5" stopOpacity="0.35" />
                  <stop offset="85%" stopColor="#56D9F5" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#56D9F5" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="chartCoralGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#FB7185" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="60" x2="760" y2="60" stroke="#101521" strokeDasharray="2 2" strokeWidth="1" />
              <line x1="0" y1="120" x2="760" y2="120" stroke="#101521" strokeDasharray="2 2" strokeWidth="1" />
              <line x1="0" y1="180" x2="760" y2="180" stroke="#101521" strokeDasharray="2 2" strokeWidth="1" />

              {/* Normal Telemetry Area & Stroke */}
              <path
                d={timeSeriesDatasets[timeRange].normalAreaPath}
                fill="url(#chartCyanGrad)"
              />
              <path
                d={timeSeriesDatasets[timeRange].normalLinePath}
                fill="none"
                stroke="#56D9F5"
                strokeWidth="2.5"
              />

              {/* Anomaly Vectors Area & Stroke */}
              <path
                d={timeSeriesDatasets[timeRange].anomalyAreaPath}
                fill="url(#chartCoralGrad)"
              />
              <path
                d={timeSeriesDatasets[timeRange].anomalyLinePath}
                fill="none"
                stroke="#FB7185"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />

              {/* Peak Indicator Vertical Guideline & Points */}
              <line
                stroke="#56D9F5"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                x1={timeSeriesDatasets[timeRange].peakPoint.cx}
                x2={timeSeriesDatasets[timeRange].peakPoint.cx}
                y1="20"
                y2="200"
              />
              <circle
                cx={timeSeriesDatasets[timeRange].peakPoint.cx}
                cy={timeSeriesDatasets[timeRange].peakPoint.cy}
                fill="#FB7185"
                r="5"
                stroke="#080B12"
                strokeWidth="2"
              />
              <circle
                cx={timeSeriesDatasets[timeRange].peakPoint.cx}
                cy={timeSeriesDatasets[timeRange].peakPoint.normalCy}
                fill="#56D9F5"
                r="4"
                stroke="#080B12"
                strokeWidth="1.5"
              />

              {/* Time Axis Baseline & Dynamic Labels */}
              <line x1="0" y1="200" x2="760" y2="200" stroke="#1e293b" strokeWidth="1" />
              {timeSeriesDatasets[timeRange].timeAxis.map((tick, index, arr) => {
                const x = (index / (arr.length - 1)) * 710 + 25;
                return (
                  <g key={tick}>
                    <line x1={x} y1="200" x2={x} y2="205" stroke="#475569" strokeWidth="1" />
                    <text
                      x={x}
                      y="218"
                      textAnchor="middle"
                      className="fill-slate-500 font-mono text-[9px] select-none"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Time-Dependent Incident & Metric Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">
                {timeSeriesDatasets[timeRange].peakIncident}
              </span>
              <span
                className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${
                  timeSeriesDatasets[timeRange].peakSeverity === "BLOCK"
                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]"
                }`}
              >
                Score {timeSeriesDatasets[timeRange].peakScore}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Window: <strong className="text-slate-200">{timeSeriesDatasets[timeRange].eventsProcessed}</strong></span>
              <span className="text-[#34D399]">Avg Latency: {timeSeriesDatasets[timeRange].avgLatency}</span>
              <span className="text-slate-500">Anomaly Ratio: {timeSeriesDatasets[timeRange].anomalyRatio}</span>
            </div>
          </div>
        </div>

        {/* Right: Calibrated Risk & Misuse (Bayesian Decomposition) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#A78BFA]" />
                Calibrated Risk &amp; Misuse
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bayesian Calibration Index vs Raw Anomaly Heuristics
              </p>
            </div>
            <span className="rounded bg-[#101521] px-2.5 py-1 font-mono text-[11px] text-[#A78BFA] font-bold border border-[#A78BFA]/30">
              Brier: 0.019
            </span>
          </div>

          {/* Macro Safety Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Fleet Safety Cohort (Real-Time)</span>
              <span className="text-slate-200 font-bold">14,892 Total Active</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#080B12] overflow-hidden flex border border-slate-800 shadow-inner">
              <div className="h-full bg-[#34D399]" style={{ width: "91.2%" }} title="Verified Safe: 91.2%" />
              <div className="h-full bg-[#FBBF24]" style={{ width: "7.4%" }} title="Moderate Risk: 7.4%" />
              <div className="h-full bg-[#A78BFA]" style={{ width: "1.1%" }} title="Elevated Challenge: 1.1%" />
              <div className="h-full bg-[#FB7185]" style={{ width: "0.3%" }} title="Escalate/Review: 0.3%" />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono font-medium">
              <span className="text-[#34D399]">Safe: 91.2%</span>
              <span className="text-[#FBBF24]">Monitor: 7.4%</span>
              <span className="text-[#A78BFA]">Challenge: 1.1%</span>
              <span className="text-[#FB7185]">Review: 0.3%</span>
            </div>
          </div>

          {/* Calibrated Risk Explanation Pill */}
          <div className="rounded-lg border border-slate-800/90 bg-[#080B12] p-3 text-xs text-slate-300 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#56D9F5]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Calibrated Probability vs Guilt
            </div>
            <p className="text-[11px] text-slate-400">
              Risk scores represent Bayesian model posterior probability calibrated against false-positive baselines.
              Observed telemetry (location hops, device handoffs) triggers mitigating checks before any irreversible action.
            </p>
          </div>
        </div>
      </section>

      {/* LEVEL 2: LIVE SESSION INVESTIGATION DESK */}
      <section className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-[#56D9F5]" />
              Live Session Investigation Desk
            </h2>
            <p className="text-xs text-slate-400">
              Active sessions evaluated by composite <strong className="text-slate-300">Risk Score</strong> (0–100, where higher values represent elevated threat). Verdicts follow canonical policy: <span className="text-[#34D399]">ALLOW</span>, <span className="text-[#FBBF24]">CHALLENGE</span>, and <span className="text-[#FB7185]">ESCALATE</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search rider, session, vector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-800 bg-[#080B12] pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#56D9F5]/50 w-56 font-mono"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 rounded-lg bg-[#080B12] p-1 border border-slate-800 text-xs font-mono">
              {(["ALL", "FLAGGED", "CHALLENGED", "RESOLVED"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTableFilter(filter)}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    tableFilter === filter
                      ? "bg-[#56D9F5]/20 text-[#56D9F5] font-bold border border-[#56D9F5]/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-slate-800 bg-[#080B12] text-slate-400 font-sans uppercase text-[11px]">
              <tr>
                <th className="p-3">Session &amp; Subject</th>
                <th className="p-3">
                  {activeRole === "rider" ? "Account Standing" : "Risk Score (0–100)"}
                </th>
                <th className="p-3">
                  {activeRole === "rider" ? "Account Security Notice" : "Observed Anomaly Vector"}
                </th>
                <th className="p-3">Mitigating Safeguard</th>
                <th className="p-3">Engine Verdict</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#101521]">
              {filteredSessions.map((s) => (
                <tr key={s.id} className="hover:bg-[#141a29] transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5 font-sans">
                      <div className="h-8 w-8 rounded-full bg-[#1c2438] border border-slate-700 flex items-center justify-center font-bold text-xs text-[#56D9F5]">
                        {s.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{s.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 font-normal">{s.id}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{s.role}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {activeRole === "rider" ? (
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${
                          s.riskScore >= 75
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                            : s.riskScore >= 40
                            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                            : "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]"
                        }`}
                      >
                        {s.riskScore >= 75
                          ? "Security Check Required"
                          : s.riskScore >= 40
                          ? "Verification Pending"
                          : "In Good Standing"}
                      </span>
                    ) : (
                      <>
                        <span
                          className={`text-base font-extrabold ${
                            s.riskScore >= 75 ? "text-[#FB7185]" : s.riskScore >= 40 ? "text-[#FBBF24]" : "text-[#34D399]"
                          }`}
                        >
                          {s.riskScore}
                        </span>
                        <span className="text-slate-500 text-[11px]"> / 100</span>
                      </>
                    )}
                  </td>
                  <td className="p-3 font-sans">
                    {activeRole === "rider" ? (
                      <div>
                        <span className="font-semibold text-slate-200 block">
                          {s.riskScore >= 75
                            ? "Device & Location Verification Required"
                            : s.riskScore >= 40
                            ? "Routine Cadence & Biometric Verification"
                            : "Transit Corridor Cleared"}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Protected courier telemetry · Internal forensic diagnostics masked for privacy
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-semibold text-slate-200 block">{s.anomalyVector}</span>
                        <span className="text-[11px] text-slate-400">{s.anomalyDetail}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-sans">
                    <span className="text-[11px] text-[#34D399] flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      {s.mitigationSafeguard}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${s.statusColor}`}>
                      {s.verdict === "INVESTIGATE" || s.verdict === "BLOCK" ? "ESCALATE" : s.verdict}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {activeRole === "rider" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[#080B12] border border-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#34D399]" />
                        Account Secure
                      </span>
                    ) : (
                      <Link
                        href={`/cases?id=${s.caseId}`}
                        className="inline-flex items-center gap-1 rounded bg-[#56D9F5]/10 px-2.5 py-1 text-[11px] font-semibold text-[#56D9F5] border border-[#56D9F5]/30 hover:bg-[#56D9F5]/20 transition-colors"
                      >
                        Investigate Dossier
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* LEVEL 3: LIVE SECURITY SIGNALS & REAL-TIME AUDIT STREAM */}
      <section className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#FB7185]" />
              Live Security Signals &amp; Forensic Stream
            </h2>
            <p className="text-xs text-slate-400">
              Low-latency telemetry events ingested from vehicle and courier edge sensors
            </p>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            {[
              { label: "All Signals", key: null },
              { label: "Hardware", key: "HARDWARE_ATTESTATION" },
              { label: "Kinematics", key: "KINEMATIC_ANOMALY" },
              { label: "Biometrics", key: "BIOMETRIC_MISMATCH" },
              { label: "Policy", key: "POLICY_CLEARANCE" },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => setSignalFilter(chip.key)}
                className={`rounded px-2.5 py-1 transition-all ${
                  signalFilter === chip.key
                    ? "bg-[#A78BFA]/20 text-[#A78BFA] font-bold border border-[#A78BFA]/40"
                    : "text-slate-400 bg-[#080B12] border border-slate-800 hover:text-slate-200"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {filteredSignals.map((sig, i) => {
            const Icon = sig.icon;
            return (
              <div
                key={i}
                className="rounded-lg border border-slate-800/80 bg-[#080B12] p-3.5 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-[#101521] border border-slate-800 flex items-center justify-center text-[#56D9F5]">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-semibold text-xs text-slate-200">{sig.title}</span>
                  </div>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold ${sig.badgeColor}`}>
                    {sig.severity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{sig.desc}</p>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                  <span>{sig.source}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {sig.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Test Fixture Scenarios Reference */}
      <section className="rounded-xl border border-slate-800/90 bg-[#101521]/60 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/70 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                Standard Verification Fixtures (<code className="text-[#56D9F5]">shared/fixtures/</code>)
              </span>
              <span className="rounded bg-[#34D399]/10 px-1.5 py-0.2 text-[9px] font-mono text-[#34D399] border border-[#34D399]/30 font-semibold">
                Contract Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Evaluated on a 0–100 <strong className="text-slate-200">Trust Score</strong> scale, where higher trust indicates a healthier, verified account (100 = fully trusted, 0 = blocked). Decisions map to canonical policy verdicts: <span className="text-[#34D399]">ALLOW</span>, <span className="text-[#FBBF24]">CHALLENGE</span>, and <span className="text-[#FB7185]">ESCALATE</span>.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">5 contract-verified scenarios</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5 text-xs font-mono">
          {[
            {
              name: "1. Normal Commute",
              trustScore: 96.0,
              verdict: "ALLOW",
              tier: "LOW Risk Tier",
              subtext: "Clean Baseline",
              badgeStyle: "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]",
              scoreColor: "text-[#34D399]",
            },
            {
              name: "2. Ordinary Change",
              trustScore: 78.5,
              verdict: "ALLOW",
              tier: "LOW Risk Tier",
              subtext: "Hardware Attested",
              badgeStyle: "border-[#56D9F5]/40 bg-[#56D9F5]/10 text-[#56D9F5]",
              scoreColor: "text-[#56D9F5]",
            },
            {
              name: "3. Account Handoff",
              trustScore: 42.0,
              verdict: "CHALLENGE",
              tier: "MEDIUM Risk Tier",
              subtext: "Face Step-Up",
              badgeStyle: "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]",
              scoreColor: "text-[#FBBF24]",
            },
            {
              name: "4. GPS Spoof / Emu",
              trustScore: 18.0,
              verdict: "ESCALATE",
              tier: "HIGH Risk Tier",
              subtext: "Investigate Case",
              badgeStyle: "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]",
              scoreColor: "text-[#FB7185]",
            },
            {
              name: "5. Collusion Ring",
              trustScore: 8.0,
              verdict: "ESCALATE",
              tier: "CRITICAL Risk Tier",
              subtext: "Policy Block & Escrow",
              badgeStyle: "border-red-500/40 bg-red-500/10 text-red-400",
              scoreColor: "text-red-400",
            },
          ].map((item) => (
            <div key={item.name} className="rounded-lg border border-slate-800 bg-[#080B12] p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans font-semibold text-slate-200 truncate">{item.name}</span>
                <span className={`font-bold text-[9px] rounded px-1.5 py-0.2 border ${item.badgeStyle}`}>
                  {item.verdict}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/60">
                <span className="text-slate-400 text-[10px]">Trust Score:</span>
                <span className={`font-bold text-xs ${item.scoreColor}`}>{item.trustScore.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>{item.tier}</span>
                <span className="text-slate-400 font-sans text-[10px]">{item.subtext}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
