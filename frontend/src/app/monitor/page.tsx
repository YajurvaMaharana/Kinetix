"use client";

import React from "react";
import { ShieldAlert, Activity, CheckCircle2, AlertTriangle, ShieldX } from "lucide-react";

export default function MonitorPage() {
  const sampleSessions = [
    {
      id: "sess_norm_9001",
      rider: "rider_us_east_4102",
      score: 96,
      tier: "LOW",
      verdict: "ALLOW",
      device: "iPhone 15 Pro",
      city: "New York, NY",
      status: "In Transit",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "sess_ord_chg_9002",
      rider: "rider_us_midwest_1889",
      score: 78.5,
      tier: "LOW",
      verdict: "ALLOW",
      device: "Galaxy S24 Ultra",
      city: "Chicago, IL",
      status: "In Transit",
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "sess_handoff_9003",
      rider: "rider_us_south_6021",
      score: 42,
      tier: "MEDIUM",
      verdict: "CHALLENGE",
      device: "Pixel 8",
      city: "Houston, TX",
      status: "Challenged",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "sess_spoof_9004",
      rider: "rider_global_susp_7719",
      score: 18,
      tier: "HIGH",
      verdict: "INVESTIGATE",
      device: "x86 Emulator",
      city: "Los Angeles, CA",
      status: "Escrow Held",
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
    {
      id: "sess_ring_9005",
      rider: "rider_syndicate_node_014",
      score: 8,
      tier: "CRITICAL",
      verdict: "BLOCK",
      device: "Redmi 9A Farm",
      city: "San Francisco, CA",
      status: "Blocked",
      color: "text-red-500 bg-red-500/10 border-red-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-indigo-400" />
            Live Behavioral Monitor
          </h1>
          <p className="text-xs text-slate-400">
            Real-time session stream, kinematic telemetry, and dynamic risk scoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs text-emerald-400">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Live Ingestion Active
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
            <tr>
              <th className="p-3.5">Session ID</th>
              <th className="p-3.5">Rider</th>
              <th className="p-3.5">Trust Score</th>
              <th className="p-3.5">Risk Tier</th>
              <th className="p-3.5">Verdict</th>
              <th className="p-3.5">Device Model</th>
              <th className="p-3.5">Location</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {sampleSessions.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3.5 font-semibold text-indigo-300">{s.id}</td>
                <td className="p-3.5 text-slate-300">{s.rider}</td>
                <td className="p-3.5 font-bold text-slate-100">{s.score} / 100</td>
                <td className="p-3.5">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>
                    {s.tier}
                  </span>
                </td>
                <td className="p-3.5">
                  <span className="font-semibold text-slate-200">{s.verdict}</span>
                </td>
                <td className="p-3.5 text-slate-400 font-sans">{s.device}</td>
                <td className="p-3.5 text-slate-400 font-sans">{s.city}</td>
                <td className="p-3.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-slate-300">
                    {s.verdict === "ALLOW" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : s.verdict === "BLOCK" ? (
                      <ShieldX className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
