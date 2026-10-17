"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function EvaluationPage() {
  const metrics = [
    { label: "Overall ROC-AUC", value: "0.984", change: "+0.02 vs v1 baseline", color: "text-emerald-400" },
    { label: "Spoofing Recall", value: "99.2%", change: "Zero GPS leaks", color: "text-cyan-400" },
    { label: "Handoff Detection", value: "95.6%", change: "Under 3 minutes to challenge", color: "text-indigo-400" },
    { label: "False Positive Rate", value: "0.8%", change: "Minimal passenger friction", color: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-teal-400" />
          Evaluation &amp; Model Benchmark
        </h1>
        <p className="text-xs text-slate-400">
          Continuous accuracy validation, cross-validation ROC-AUC scores, and fraud ring recall benchmarks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
            <span className="text-xs text-slate-400">{m.label}</span>
            <div className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</div>
            <p className="text-[11px] text-slate-500">{m.change}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
