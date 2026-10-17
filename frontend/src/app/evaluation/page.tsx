"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Award, ShieldCheck, Target } from "lucide-react";

export default function EvaluationPage() {
  const metrics = [
    { label: "Overall ROC-AUC", value: "0.984", change: "+0.02 vs baseline v1.0", color: "text-[#34D399]" },
    { label: "GPS Spoof Recall", value: "99.2%", change: "Zero mock provider escapes", color: "text-[#56D9F5]" },
    { label: "Handoff Precision", value: "95.6%", change: "<180s to biometric step-up", color: "text-[#A78BFA]" },
    { label: "False Positive Rate", value: "0.8%", change: "Protected by 18-mo mitigating safeguard", color: "text-[#34D399]" },
  ];

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
            <span className="text-slate-200">Evaluation &amp; Accuracy Benchmarks</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-[#34D399]" />
            <span>Evaluation &amp; ML Model Benchmarks</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Continuous cross-validation against verified rideshare telemetry datasets, ROC-AUC calibration, and fraud recall.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#34D399]/10 border border-[#34D399]/30 px-3 py-1 text-xs font-mono font-semibold text-[#34D399] flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" />
            Brier Calibration: 0.019
          </span>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-800 bg-[#101521] p-4 space-y-2">
            <span className="text-xs text-slate-400 font-medium font-sans">{m.label}</span>
            <div className={`text-3xl font-extrabold font-mono ${m.color}`}>{m.value}</div>
            <p className="text-[11px] text-slate-500 font-sans">{m.change}</p>
          </div>
        ))}
      </div>

      {/* Detailed Validation Suite Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Target className="h-4 w-4 text-[#56D9F5]" />
            Confusion Matrix Performance (n = 25,000 trips)
          </h2>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between p-2.5 rounded-lg bg-[#080B12] border border-slate-800">
              <span className="text-slate-300">True Negatives (Legitimate Cleared):</span>
              <span className="text-[#34D399] font-bold">24,310 (99.2%)</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-[#080B12] border border-slate-800">
              <span className="text-slate-300">True Positives (Attacks Neutralized):</span>
              <span className="text-[#56D9F5] font-bold">482 (98.4%)</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-[#080B12] border border-slate-800">
              <span className="text-slate-300">False Positives (Step-Up Resolved):</span>
              <span className="text-[#FBBF24] font-bold">198 (0.8%)</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-[#080B12] border border-slate-800">
              <span className="text-slate-300">False Negatives (Undetected Leaks):</span>
              <span className="text-red-400 font-bold">10 (0.04%)</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#A78BFA]" />
            Fairness &amp; Bias Mitigation Guardrails
          </h2>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
            <div className="rounded-lg bg-[#080B12] border border-slate-800 p-3 space-y-1">
              <span className="font-bold text-white block">Demographic Parity in Facial Liveness:</span>
              <p className="text-slate-400 text-[11px]">
                InsightFace models evaluated across 6 Fitzpatrick skin tone scales maintain parity error delta below 1.2%.
              </p>
            </div>

            <div className="rounded-lg bg-[#080B12] border border-slate-800 p-3 space-y-1">
              <span className="font-bold text-white block">Zero Single-Point-of-Failure:</span>
              <p className="text-slate-400 text-[11px]">
                Hardware keystore checks, GPS velocity plausibility, and touch kinematics run as independent ensemble
                voters. No driver is blocked purely on network IP address or carrier changes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
