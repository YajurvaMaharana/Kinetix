"use client";

import React from "react";
import { Banknote } from "lucide-react";

export default function PayoutsPage() {
  const samplePayouts = [
    {
      id: "pay_99812",
      rider: "rider_syndicate_node_014",
      amount: "$175.00",
      destination: "acct_****_9921",
      status: "BLOCKED",
      reason: "Member of syndicate CLUSTER-RING-409",
      badge: "border-red-500/30 bg-red-500/10 text-red-400",
    },
    {
      id: "pay_99811",
      rider: "rider_global_susp_7719",
      amount: "$190.00",
      destination: "acct_****_8812",
      status: "ESCROW_HOLD",
      reason: "Held 24h pending emulator investigation case_spoof_9004",
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    },
    {
      id: "pay_99810",
      rider: "rider_us_east_4102",
      amount: "$33.50",
      destination: "acct_****_1042",
      status: "RELEASED",
      reason: "Clean session (Score 96), instant ACH cleared",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Banknote className="h-6 w-6 text-emerald-400" />
          Payout Safety &amp; Escrow Gating
        </h1>
        <p className="text-xs text-slate-400">
          Automated payment escrow rules protect against chargebacks and coordinated incentive drain.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
            <tr>
              <th className="p-3.5">Payout ID</th>
              <th className="p-3.5">Rider / Recipient</th>
              <th className="p-3.5">Disbursement Amount</th>
              <th className="p-3.5">Masked Account</th>
              <th className="p-3.5">Escrow State</th>
              <th className="p-3.5">Risk &amp; Gate Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {samplePayouts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3.5 font-bold text-indigo-300">{p.id}</td>
                <td className="p-3.5 text-slate-300 font-sans">{p.rider}</td>
                <td className="p-3.5 font-bold text-white">{p.amount}</td>
                <td className="p-3.5 text-slate-400">{p.destination}</td>
                <td className="p-3.5">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${p.badge}`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-3.5 text-slate-400 font-sans">{p.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
