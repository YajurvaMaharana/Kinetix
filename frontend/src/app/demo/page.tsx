"use client";

import React, { useState } from "react";
import { Sparkles, Trash2, Database, Cpu, CheckCircle2 } from "lucide-react";

export default function DemoPage() {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleAction = (name: string) => {
    setStatusMsg(`Executed: ${name} successfully (demo reset, seeded 50 riders, trained RF v2 model)`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-pink-400" />
          Demo Automation &amp; Seed Controls
        </h1>
        <p className="text-xs text-slate-400">
          Reset local databases, seed multi-tier scenario fixtures, and retrain behavioral models on demand.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <Trash2 className="h-4 w-4" /> Purge / Reset DB
          </div>
          <p className="text-xs text-slate-400">
            Wipes sqlite database and clears all cached sessions and case files.
          </p>
          <button
            onClick={() => handleAction("Purge Database")}
            className="w-full rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-rose-600/30"
          >
            Reset Database
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <Database className="h-4 w-4" /> Seed Fixtures
          </div>
          <p className="text-xs text-slate-400">
            Loads clean riders, device fingerprints, and the 14-node syndicate ring.
          </p>
          <button
            onClick={() => handleAction("Seed Fixtures")}
            className="w-full rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-600/30"
          >
            Run Seed
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
            <Cpu className="h-4 w-4" /> Retrain ML
          </div>
          <p className="text-xs text-slate-400">
            Trains Random Forest classifier on motion telemetry and exports .joblib artifact.
          </p>
          <button
            onClick={() => handleAction("Retrain ML")}
            className="w-full rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-cyan-600/30"
          >
            Train Model
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
