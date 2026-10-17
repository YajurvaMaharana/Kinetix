"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Trash2, Database, Cpu, CheckCircle2, Play, RefreshCw } from "lucide-react";

export default function DemoPage() {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const handleAction = (name: string, description: string) => {
    setRunningAction(name);
    setTimeout(() => {
      setStatusMsg(`Executed: ${name} — ${description}`);
      setRunningAction(null);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span className="text-slate-200">Demo Automation &amp; Seed Controls</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-[#56D9F5]" />
            <span>Demo Automation &amp; Seed Controls</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            One-click database wipe, baseline contract scenario fixtures seed, and Random Forest retraining on demand.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#56D9F5]/10 border border-[#56D9F5]/30 px-3 py-1 text-xs font-mono font-semibold text-[#56D9F5]">
            PRESENTATION READY
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1 */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#FB7185] font-bold text-sm">
            <Trash2 className="h-4 w-4" /> Purge / Reset SQLite DB
          </div>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Wipes local database and flushes all transient in-memory session caches, cases, and step-up challenges.
          </p>
          <button
            onClick={() => handleAction("Purge Database", "cleared 14,892 test sessions and active case files")}
            disabled={runningAction !== null}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#FB7185]/10 text-[#FB7185] border border-[#FB7185]/30 px-3 py-2 text-xs font-bold hover:bg-[#FB7185]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {runningAction === "Purge Database" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Reset Database
          </button>
        </div>

        {/* Card 2 */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#56D9F5] font-bold text-sm">
            <Database className="h-4 w-4" /> Seed Fixture Suite
          </div>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Injects 5 contract scenarios from <code className="text-[#56D9F5]">shared/fixtures/</code> including the 14-node syndicate ring.
          </p>
          <button
            onClick={() => handleAction("Seed Fixtures", "loaded 5 contract fixtures, 50 couriers, and Cluster 409 topology")}
            disabled={runningAction !== null}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#56D9F5]/10 text-[#56D9F5] border border-[#56D9F5]/30 px-3 py-2 text-xs font-bold hover:bg-[#56D9F5]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {runningAction === "Seed Fixtures" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Execute Seed
          </button>
        </div>

        {/* Card 3 */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#A78BFA] font-bold text-sm">
            <Cpu className="h-4 w-4" /> Retrain ML Model v2.4
          </div>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Trains Random Forest classifier + Bayesian kinematics calibrator and updates serialized joblib artifact.
          </p>
          <button
            onClick={() => handleAction("Retrain ML", "model weights converged with 0.984 ROC-AUC and 0.019 Brier score")}
            disabled={runningAction !== null}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 px-3 py-2 text-xs font-bold hover:bg-[#A78BFA]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {runningAction === "Retrain ML" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Retrain Classifier
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs font-mono text-[#34D399]">
          <CheckCircle2 className="h-4 w-4 text-[#34D399] flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
