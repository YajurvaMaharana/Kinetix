"use client";

import React from "react";
import { GitFork, Users } from "lucide-react";

export default function GraphPage() {
  const clusters = [
    {
      id: "CLUSTER-RING-409",
      name: "Redmi Device Farm Syndicate #4",
      nodes: 14,
      riskScore: 98.4,
      status: "ACTIVE",
      sharedIds: ["DEV_HASH_778899", "ROUTING_ACCT_US_9921", "SF_TENDERLOIN_GPS_CELL"],
    },
    {
      id: "CLUSTER-RING-218",
      name: "Chicago Airport Coordinated Referral Circle",
      nodes: 8,
      riskScore: 84.1,
      status: "MONITORED",
      sharedIds: ["DEV_HASH_ORD_91", "BANK_IBAN_MOCK_33"],
    },
    {
      id: "CLUSTER-RING-104",
      name: "Emulated Driver Dispatch Ring",
      nodes: 6,
      riskScore: 91.0,
      status: "DISRUPTED",
      sharedIds: ["DEV_HASH_X86_001", "IP_DATACENTER_RANGE_45"],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <GitFork className="h-6 w-6 text-rose-400" />
          Syndicate Graph &amp; Collusion Engine
        </h1>
        <p className="text-xs text-slate-400">
          NetworkX graph clustering: detects multi-identity rings sharing hardware, bank routes, and GPS cells.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {clusters.map((c) => (
          <div
            key={c.id}
            className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-400">{c.id}</span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                    c.status === "ACTIVE"
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : c.status === "MONITORED"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">{c.name}</h3>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <Users className="h-3.5 w-3.5 text-slate-500" /> {c.nodes} Nodes
                </span>
                <span className="font-mono text-rose-400">Risk: {c.riskScore}%</span>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
              <span className="text-[11px] font-medium text-slate-400">Shared Identifiers:</span>
              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                {c.sharedIds.map((id) => (
                  <span
                    key={id}
                    className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-300 border border-slate-800"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
