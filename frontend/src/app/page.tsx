"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Sliders,
  ShieldCheck,
  Server,
  ArrowRight,
  ShieldAlert,
  GitFork,
  Banknote,
  Scale,
  Sparkles,
  FolderKanban,
} from "lucide-react";
import { HealthStatus, Role } from "@/lib/types";
import { getHealth, getActiveRole } from "@/lib/api";

export default function HomePage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [activeRole, setActiveRoleState] = useState<Role>("analyst");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const data = await getHealth();
      const elapsed = Math.round(performance.now() - start);
      setHealth(data);
      setLatencyMs(elapsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to backend server";
      setError(msg);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    setActiveRoleState(getActiveRole());

    const handleRoleChanged = () => {
      setActiveRoleState(getActiveRole());
      fetchStatus();
    };
    window.addEventListener("trustjuggler:role_changed", handleRoleChanged);
    return () => window.removeEventListener("trustjuggler:role_changed", handleRoleChanged);
  }, [fetchStatus]);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/60 to-indigo-950/40 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              TrustJuggler Platform v2.0
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Continuous Behavioral Trust &amp; Fraud Shield
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Real-time hardware attestation, biometric liveness verification, kinematic telemetry,
              syndicate ring detection, and automated payout escrow gating.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Re-ping /health
            </button>
          </div>
        </div>
      </div>

      {/* Backend Health Status Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Server className="h-4 w-4 text-indigo-400" />
            Backend Service Status
          </h2>
          <span className="text-xs text-slate-400">
            Active Role Header:{" "}
            <span className="font-mono text-indigo-400 font-semibold uppercase">{activeRole}</span>
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>System Health</span>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              {loading ? (
                <div className="h-6 w-20 animate-pulse rounded bg-slate-800" />
              ) : health?.status === "healthy" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="font-mono text-lg font-bold text-emerald-400 uppercase">
                    {health.status}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                  <span className="font-mono text-sm font-semibold text-rose-400">
                    {error ? "Offline / Error" : "Unknown"}
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {error ? (
                <span className="text-rose-400 break-all">{error}</span>
              ) : (
                `Endpoint: /api/v1/health`
              )}
            </p>
          </div>

          {/* Model Version Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>ML Model Version</span>
              <Cpu className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-6 w-28 animate-pulse rounded bg-slate-800" />
              ) : (
                <span className="font-mono text-base font-bold text-cyan-300">
                  {health?.model_version || "Unavailable"}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Random Forest + Kinematic Heuristics</p>
          </div>

          {/* Policy Version Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Policy Matrix</span>
              <Sliders className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-6 w-20 animate-pulse rounded bg-slate-800" />
              ) : (
                <span className="font-mono text-base font-bold text-amber-300">
                  {health?.policy_version || "Unavailable"}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Cut-lines: Allow / Challenge / Block</p>
          </div>

          {/* Ping Latency Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Round-trip Latency</span>
              <Activity className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-6 w-16 animate-pulse rounded bg-slate-800" />
              ) : (
                <span className="font-mono text-lg font-bold text-indigo-300">
                  {latencyMs !== null ? `${latencyMs} ms` : "--"}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Direct HTTP connection</p>
          </div>
        </div>
      </section>

      {/* Navigation Quick Links Grid */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-200">Subsystem Consoles</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Live Monitor",
              href: "/monitor",
              icon: ShieldAlert,
              desc: "Real-time rider sessions, risk tiers, and telemetry feeds.",
              color: "text-indigo-400",
            },
            {
              title: "Simulator",
              href: "/simulator",
              icon: Sliders,
              desc: "Inject handoffs, GPS spoofing, and bot telemetry in real time.",
              color: "text-cyan-400",
            },
            {
              title: "Case Manager",
              href: "/cases",
              icon: FolderKanban,
              desc: "Analyst queue for manual review, escalation, and disposition.",
              color: "text-amber-400",
            },
            {
              title: "Graph Syndicate",
              href: "/graph",
              icon: GitFork,
              desc: "NetworkX cluster map of collusion rings and shared device farms.",
              color: "text-rose-400",
            },
            {
              title: "Payout Gating",
              href: "/payouts",
              icon: Banknote,
              desc: "Automated escrow hold and release controls for driver payouts.",
              color: "text-emerald-400",
            },
            {
              title: "Policy Matrix",
              href: "/policy",
              icon: Scale,
              desc: "Simulate score thresholds and analyze friction vs fraud reduction.",
              color: "text-purple-400",
            },
            {
              title: "Demo Reset & Seed",
              href: "/demo",
              icon: Sparkles,
              desc: "1-click database wipe, baseline seed data, and model retrain.",
              color: "text-pink-400",
            },
            {
              title: "Evaluation Benchmark",
              href: "/evaluation",
              icon: CheckCircle2,
              desc: "Run fixture regression suite and evaluate ROC-AUC against baseline.",
              color: "text-teal-400",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/80"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                    <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-slate-300" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-100 group-hover:text-white">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-normal">{card.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Contract Fixture Test Scenarios */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            Standard Behavioral Test Fixtures (shared/fixtures/)
          </h2>
          <span className="text-xs text-slate-400">5 contract-verified scenarios</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "1. Normal Rider Session",
              tag: "ALLOW (Score: 96)",
              badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              desc: "Genuine iOS hardware attestation, baseline face similarity (0.98), urban kinematics.",
            },
            {
              title: "2. Ordinary Behavioral Change",
              tag: "ALLOW (Score: 78.5)",
              badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
              desc: "New Galaxy S24 device and interstate transit origin, but face match passes cleanly.",
            },
            {
              title: "3. Account Handoff",
              tag: "CHALLENGE (Score: 42)",
              badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              desc: "Face mismatch (0.38), typing cadence drop, and route deviation triggers Face Liveness.",
            },
            {
              title: "4. GPS Spoof & Emulator",
              tag: "INVESTIGATE (Score: 18)",
              badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
              desc: "Android x86 emulator, mock provider active, 220 km/h impossible velocity.",
            },
            {
              title: "5. Collusion Syndicate Ring",
              tag: "BLOCK (Score: 8)",
              badge: "bg-red-500/10 text-red-400 border-red-500/20",
              desc: "Shared Redmi fingerprint, circular routing across 14 nodes, payout denied.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${item.badge}`}
                >
                  {item.tag}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
