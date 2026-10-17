"use client";

import React, { useState } from "react";
import { Scale } from "lucide-react";

export default function PolicyPage() {
  const [allowThreshold, setAllowThreshold] = useState<number>(75);
  const [challengeThreshold, setChallengeThreshold] = useState<number>(50);
  const [investigateThreshold, setInvestigateThreshold] = useState<number>(25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Scale className="h-6 w-6 text-purple-400" />
          Policy Cut-Line Matrix &amp; Simulator
        </h1>
        <p className="text-xs text-slate-400">
          Calibrate trust score boundaries to balance passenger friction against fraud loss prevention.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Adjust Scoring Cut-Lines</h2>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>ALLOW Threshold (Frictionless)</span>
              <span className="font-mono text-emerald-400 font-bold">&gt;= {allowThreshold}</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={allowThreshold}
              onChange={(e) => setAllowThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>CHALLENGE Threshold (Biometric / OTP Step-up)</span>
              <span className="font-mono text-amber-400 font-bold">&gt;= {challengeThreshold}</span>
            </div>
            <input
              type="range"
              min="30"
              max="70"
              value={challengeThreshold}
              onChange={(e) => setChallengeThreshold(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>INVESTIGATE Threshold (Queue to Analyst)</span>
              <span className="font-mono text-rose-400 font-bold">&gt;= {investigateThreshold}</span>
            </div>
            <input
              type="range"
              min="10"
              max="45"
              value={investigateThreshold}
              onChange={(e) => setInvestigateThreshold(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Simulated Historical Impact</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-950 p-3">
              <span className="text-slate-400">Pass Rate (Zero Friction)</span>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">94.2%</div>
            </div>
            <div className="rounded-lg bg-slate-950 p-3">
              <span className="text-slate-400">Step-Up Friction Rate</span>
              <div className="text-xl font-bold text-amber-400 font-mono mt-1">4.8%</div>
            </div>
            <div className="rounded-lg bg-slate-950 p-3">
              <span className="text-slate-400">Syndicate Catch Rate</span>
              <div className="text-xl font-bold text-cyan-400 font-mono mt-1">98.1%</div>
            </div>
            <div className="rounded-lg bg-slate-950 p-3">
              <span className="text-slate-400">Est. Chargeback Cut</span>
              <div className="text-xl font-bold text-purple-400 font-mono mt-1">-34.5%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
