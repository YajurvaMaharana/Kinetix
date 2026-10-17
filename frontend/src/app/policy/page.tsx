"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Scale, Sliders, Sparkles } from "lucide-react";

export default function PolicyPage() {
  const [allowThreshold, setAllowThreshold] = useState<number>(75);
  const [challengeThreshold, setChallengeThreshold] = useState<number>(50);
  const [investigateThreshold, setInvestigateThreshold] = useState<number>(25);

  // Dynamic simulation based on cut-lines
  const simulatedPassRate = Math.min(98.5, Math.max(80.0, 100 - (allowThreshold - 50) * 0.4)).toFixed(1);
  const simulatedFrictionRate = Math.max(1.5, ((allowThreshold - challengeThreshold) * 0.18)).toFixed(1);
  const simulatedCatchRate = Math.min(99.5, 92.0 + (challengeThreshold - 30) * 0.25).toFixed(1);
  const chargebackCutPct = Math.min(48.0, 22.0 + (75 - investigateThreshold) * 0.4).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span className="text-slate-200">Policy Matrix &amp; Cut-Line Simulator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Scale className="h-7 w-7 text-[#A78BFA]" />
            <span>Policy Cut-Line Matrix &amp; Simulator</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Calibrate trust score boundaries to balance passenger and courier friction against fraud loss prevention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#A78BFA]/10 border border-[#A78BFA]/30 px-3 py-1 text-xs font-mono font-semibold text-[#A78BFA] flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Model Version v2.4-Gov
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cut-Line Sliders */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#56D9F5]" />
            Adjust Scoring Decision Boundaries
          </h2>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">ALLOW Threshold (Frictionless Dispatch)</span>
              <span className="text-[#34D399] font-bold">&gt;= {allowThreshold} pts</span>
            </div>
            <input
              type="range"
              min="60"
              max="95"
              value={allowThreshold}
              onChange={(e) => setAllowThreshold(Number(e.target.value))}
              className="w-full accent-[#34D399] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">CHALLENGE Threshold (Biometric / SMS Step-Up)</span>
              <span className="text-[#FBBF24] font-bold">&gt;= {challengeThreshold} pts</span>
            </div>
            <input
              type="range"
              min="35"
              max="65"
              value={challengeThreshold}
              onChange={(e) => setChallengeThreshold(Number(e.target.value))}
              className="w-full accent-[#FBBF24] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">ESCALATE Threshold (Queue to SOC Investigation Desk)</span>
              <span className="text-[#FB7185] font-bold">&gt;= {investigateThreshold} pts</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              value={investigateThreshold}
              onChange={(e) => setInvestigateThreshold(Number(e.target.value))}
              className="w-full accent-[#FB7185] cursor-pointer"
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3 text-xs text-slate-400 font-sans leading-relaxed">
            Scores below <span className="text-red-400 font-mono font-bold">&lt;{investigateThreshold}</span> trigger
            automated <strong>BLOCK</strong> &amp; immediate payout escrow lock.
          </div>
        </div>

        {/* Real-time Projection Impact */}
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#A78BFA]" />
            Simulated Historical Cohort Impact (14,892 Sessions)
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-[#080B12] p-3.5 space-y-1">
              <span className="text-slate-400 font-mono">Pass Rate (Zero Friction)</span>
              <div className="text-2xl font-extrabold text-[#34D399] font-mono">{simulatedPassRate}%</div>
              <span className="text-[10px] text-slate-500 font-sans">Trusted passenger experience</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#080B12] p-3.5 space-y-1">
              <span className="text-slate-400 font-mono">Step-Up Friction Rate</span>
              <div className="text-2xl font-extrabold text-[#FBBF24] font-mono">{simulatedFrictionRate}%</div>
              <span className="text-[10px] text-slate-500 font-sans">Active selfie or SMS step-up</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#080B12] p-3.5 space-y-1">
              <span className="text-slate-400 font-mono">Syndicate Intercept Rate</span>
              <div className="text-2xl font-extrabold text-[#56D9F5] font-mono">{simulatedCatchRate}%</div>
              <span className="text-[10px] text-slate-500 font-sans">Cluster 409 &amp; device farms</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#080B12] p-3.5 space-y-1">
              <span className="text-slate-400 font-mono">Est. Chargeback Reduction</span>
              <div className="text-2xl font-extrabold text-[#A78BFA] font-mono">-{chargebackCutPct}%</div>
              <span className="text-[10px] text-slate-500 font-sans">Projected platform savings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
