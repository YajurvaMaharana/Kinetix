"use client";

import React from "react";
import { FolderKanban, Clock } from "lucide-react";

export default function CasesPage() {
  const sampleCases = [
    {
      id: "case_spoof_9004",
      rider: "rider_global_susp_7719",
      severity: "HIGH",
      status: "OPEN",
      summary: "GPS spoofing and Android x86 emulator detected during trip",
      assignedTo: "Unassigned",
      created: "10 mins ago",
    },
    {
      id: "case_ring_9005",
      rider: "rider_syndicate_node_014",
      severity: "CRITICAL",
      status: "IN_REVIEW",
      summary: "Linked to active syndicate CLUSTER-RING-409 (14 nodes, recycled bank account)",
      assignedTo: "analyst_sarah_m",
      created: "25 mins ago",
    },
    {
      id: "case_handoff_8992",
      rider: "rider_us_south_6021",
      severity: "MEDIUM",
      status: "RESOLVED_LEGIT",
      summary: "Mid-trip face challenge succeeded after passenger device handoff cleared",
      assignedTo: "analyst_david_k",
      created: "2 hours ago",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-amber-400" />
            Case Management Queue
          </h1>
          <p className="text-xs text-slate-400">
            Analyst review workspace for escalated anomalies, fraud rings, and appeal reviews.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {sampleCases.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:border-slate-700"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-300">{c.id}</span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                    c.severity === "CRITICAL"
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : c.severity === "HIGH"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {c.severity}
                </span>
                <span className="text-xs text-slate-400 font-mono">({c.rider})</span>
              </div>
              <p className="text-xs text-slate-200">{c.summary}</p>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {c.created}
                </span>
                <span>Assignee: {c.assignedTo}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-800 px-2.5 py-1 text-xs font-mono text-slate-300">
                {c.status}
              </span>
              <button className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
                Review Case
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
