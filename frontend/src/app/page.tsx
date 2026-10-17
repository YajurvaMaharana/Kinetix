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
  Sliders,
  FolderKanban,
  GitFork,
  Banknote,
  Scale,
  Sparkles,
  ArrowRight,
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
    anomalyDetail: "Concurrent delivery ping 14km apart in 180s",
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
    anomalyDetail: "Shared IMEI & routing account with Cluster 409",
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
          {/* Active Role Pill */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101521] px-3 py-1.5 text-xs">
            <span className="text-slate-400">Persona:</span>
            <span className="font-mono font-bold text-[#A78BFA] uppercase">{activeRole}</span>
          </div>

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
            className="flex items-center gap-1.5 rounded-lg border border-[#56D9F5]/30 bg-[#56D9F5]/10 px-3 py-1.5 text-xs font-semibold text-[#56D9F5] hover:bg-[#56D9F5]/20 transition-all disabled:opacity-50"
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

      {/* QUICK SUBSYSTEM CONSOLES NAVIGATION HUB */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-[#56D9F5]" />
            Subsystem Operational Consoles
          </h2>
          <span className="text-[11px] font-mono text-slate-400">8 active telemetry targets</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Live Monitor",
              href: "/monitor",
              icon: ShieldAlert,
              desc: "Real-time rider sessions, risk tiers, and telemetry feeds.",
              accent: "hover:border-[#56D9F5]/50 group-hover:text-[#56D9F5]",
              badge: "LIVE FEED",
            },
            {
              title: "Rider Simulator",
              href: "/simulator",
              icon: Sliders,
              desc: "Inject handoffs, GPS spoofing, and emulator telemetry.",
              accent: "hover:border-[#A78BFA]/50 group-hover:text-[#A78BFA]",
              badge: "5 FIXTURES",
            },
            {
              title: "Investigations",
              href: "/cases",
              icon: FolderKanban,
              desc: "Analyst case dossier queue, manual review, and triage.",
              accent: "hover:border-[#FB7185]/50 group-hover:text-[#FB7185]",
              badge: "SOC QUEUE",
            },
            {
              title: "Fraud Graph",
              href: "/graph",
              icon: GitFork,
              desc: "Collusion ring cluster maps and device farm topology.",
              accent: "hover:border-[#34D399]/50 group-hover:text-[#34D399]",
              badge: "NETWORKX",
            },
            {
              title: "Payouts",
              href: "/payouts",
              icon: Banknote,
              desc: "Automated escrow hold and release controls for driver payouts.",
              accent: "hover:border-[#38BDF8]/50 group-hover:text-[#38BDF8]",
              badge: "ESCROW GUARD",
            },
            {
              title: "Policy Simulator",
              href: "/policy",
              icon: Scale,
              desc: "Adjust cut-lines and simulate friction vs fraud reduction.",
              accent: "hover:border-[#FBBF24]/50 group-hover:text-[#FBBF24]",
              badge: "CUT-LINES",
            },
            {
              title: "Demo Controls",
              href: "/demo",
              icon: Sparkles,
              desc: "1-click database reset, seed scenarios, and model retrain.",
              accent: "hover:border-[#F472B6]/50 group-hover:text-[#F472B6]",
              badge: "AUTOMATION",
            },
            {
              title: "Evaluation",
              href: "/evaluation",
              icon: CheckCircle2,
              desc: "Model benchmark metrics, ROC-AUC curve, and recall validation.",
              accent: "hover:border-[#2DD4BF]/50 group-hover:text-[#2DD4BF]",
              badge: "ROC-AUC 0.984",
            },
          ].map((card) => {
            const CardIcon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className={`group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-[#101521] p-4 transition-all hover:bg-[#131b2e] hover:shadow-lg hover:shadow-[#080B12] cursor-pointer select-none ${card.accent}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <CardIcon className="h-5 w-5 text-[#56D9F5] transition-transform group-hover:scale-110" />
                    <span className="rounded bg-[#080B12] border border-slate-800 px-2 py-0.5 text-[9px] font-mono font-bold text-slate-400">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white flex items-center justify-between">
                    <span>{card.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-[#56D9F5]" />
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed font-sans">{card.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* LEVEL 1: TIME-SERIES ANOMALY ACTIVITY & CALIBRATED RISK */}
      <section className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Time Series Area Chart */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#56D9F5]" />
                Identity Risk Activity (Time-Series)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingested delivery velocity vs synthetic anomaly score thresholds
              </p>
            </div>

            {/* Time toggles */}
            <div className="flex items-center gap-1 rounded-lg bg-[#080B12] p-1 border border-slate-800 text-xs font-mono">
              {(["15m", "1h", "24h", "7d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    timeRange === range
                      ? "bg-[#56D9F5]/20 text-[#56D9F5] font-bold border border-[#56D9F5]/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart SVG */}
          <div className="relative h-60 w-full overflow-hidden rounded-lg bg-[#080B12] border border-slate-800/80 p-2">
            <div className="absolute top-3 left-4 flex items-center gap-4 text-xs font-mono text-slate-400 z-20">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#56D9F5]" /> Normal Telemetry Volume
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#FB7185]" /> Anomaly Vectors
              </span>
            </div>

            <svg className="w-full h-full relative z-10" preserveAspectRatio="none" viewBox="0 0 760 220">
              <defs>
                <linearGradient id="chartCyanGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#56D9F5" stopOpacity="0.35" />
                  <stop offset="85%" stopColor="#56D9F5" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#56D9F5" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="chartCoralGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#FB7185" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 170 Q 70 160 130 145 T 260 130 T 380 120 T 500 135 T 600 95 T 670 125 T 760 110 L 760 210 L 0 210 Z"
                fill="url(#chartCyanGrad)"
              />
              <path
                d="M 0 170 Q 70 160 130 145 T 260 130 T 380 120 T 500 135 T 600 95 T 670 125 T 760 110"
                fill="none"
                stroke="#56D9F5"
                strokeWidth="2.5"
              />
              <path
                d="M 0 205 Q 120 200 240 195 T 390 190 T 510 185 T 570 150 Q 590 60 605 52 Q 620 62 630 160 T 700 190 T 760 195 L 760 210 L 0 210 Z"
                fill="url(#chartCoralGrad)"
              />
              <path
                d="M 0 205 Q 120 200 240 195 T 390 190 T 510 185 T 570 150 Q 590 60 605 52 Q 620 62 630 160 T 700 190 T 760 195"
                fill="none"
                stroke="#FB7185"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
              <line stroke="#56D9F5" strokeDasharray="3 3" strokeWidth="1.5" x1="605" x2="605" y1="15" y2="210" />
              <circle cx="605" cy="52" fill="#FB7185" r="5" stroke="#080B12" strokeWidth="2" />
              <circle cx="605" cy="95" fill="#56D9F5" r="4" stroke="#080B12" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Peak Incident: 14:32 UTC (Dual GPS Jump)</span>
            <span className="text-[#34D399]">Avg Engine Latency: 14.2ms</span>
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
              Active sessions queued for forensic inspection, step-up challenges, and triage
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
                <th className="p-3">Risk Score</th>
                <th className="p-3">Observed Anomaly Vector</th>
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
                    <span
                      className={`text-base font-extrabold ${
                        s.riskScore >= 75 ? "text-[#FB7185]" : s.riskScore >= 40 ? "text-[#FBBF24]" : "text-[#34D399]"
                      }`}
                    >
                      {s.riskScore}
                    </span>
                    <span className="text-slate-500 text-[11px]"> / 100</span>
                  </td>
                  <td className="p-3 font-sans">
                    <span className="font-semibold text-slate-200 block">{s.anomalyVector}</span>
                    <span className="text-[11px] text-slate-400">{s.anomalyDetail}</span>
                  </td>
                  <td className="p-3 font-sans">
                    <span className="text-[11px] text-[#34D399] flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      {s.mitigationSafeguard}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${s.statusColor}`}>
                      {s.verdict}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/cases?id=${s.caseId}`}
                      className="inline-flex items-center gap-1 rounded bg-[#56D9F5]/10 px-2.5 py-1 text-[11px] font-semibold text-[#56D9F5] border border-[#56D9F5]/30 hover:bg-[#56D9F5]/20 transition-colors"
                    >
                      Investigate Dossier
                      <ChevronRight className="h-3 w-3" />
                    </Link>
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
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">
            Standard Verification Fixtures (<code className="text-[#56D9F5]">shared/fixtures/</code>)
          </span>
          <span className="text-[11px] font-mono text-slate-500">5 contract-verified scenarios</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 text-xs font-mono">
          {[
            { name: "1. Normal Commute", score: 96, tag: "ALLOW", color: "text-[#34D399]" },
            { name: "2. Ordinary Change", score: 78.5, tag: "ALLOW", color: "text-[#56D9F5]" },
            { name: "3. Account Handoff", score: 42, tag: "CHALLENGE", color: "text-[#FBBF24]" },
            { name: "4. GPS Spoof / Emu", score: 18, tag: "INVESTIGATE", color: "text-[#FB7185]" },
            { name: "5. Collusion Ring", score: 8, tag: "BLOCK", color: "text-red-400" },
          ].map((item) => (
            <div key={item.name} className="rounded border border-slate-800 bg-[#080B12] p-2">
              <div className="text-[11px] font-sans text-slate-300 truncate">{item.name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-400 text-[10px]">Score: {item.score}</span>
                <span className={`font-bold text-[10px] ${item.color}`}>{item.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
