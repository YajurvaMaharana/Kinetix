"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Banknote, Lock } from "lucide-react";

interface PayoutItem {
  id: string;
  rider: string;
  amount: string;
  destination: string;
  status: "BLOCKED" | "ESCROW_HOLD" | "RELEASED";
  reason: string;
  badge: string;
  date: string;
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutItem[]>([
    {
      id: "pay_99812",
      rider: "rider_syndicate_node_014",
      amount: "$175.00",
      destination: "acct_••••_9921",
      status: "BLOCKED",
      reason: "Member of syndicate CLUSTER-RING-409 (14 devices sharing destination)",
      badge: "border-red-500/40 bg-red-500/10 text-red-400",
      date: "14:32 UTC",
    },
    {
      id: "pay_99811",
      rider: "rider_global_susp_7719",
      amount: "$190.00",
      destination: "acct_••••_8812",
      status: "ESCROW_HOLD",
      reason: "Held 24h pending emulator investigation case_spoof_9004",
      badge: "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]",
      date: "14:28 UTC",
    },
    {
      id: "pay_99810",
      rider: "rider_us_east_4102",
      amount: "$33.50",
      destination: "acct_••••_1042",
      status: "RELEASED",
      reason: "Clean session (Score 96), instant ACH cleared",
      badge: "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]",
      date: "14:15 UTC",
    },
    {
      id: "pay_99809",
      rider: "rider_us_midwest_1889",
      amount: "$64.00",
      destination: "acct_••••_3411",
      status: "RELEASED",
      reason: "Face similarity 0.98 validated, ordinary transit cleared",
      badge: "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]",
      date: "13:58 UTC",
    },
  ]);

  const [filter, setFilter] = useState<string>("ALL");

  const filteredPayouts = payouts.filter((p) => {
    if (filter === "ALL") return true;
    return p.status === filter;
  });

  const handleReleaseEscrow = (id: string) => {
    setPayouts((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "RELEASED" as const,
              reason: "Manual analyst override: cleared by SOC lead",
              badge: "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]",
            }
          : item
      )
    );
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
            <span className="text-slate-200">Financial Safety &amp; Escrow Gating</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Banknote className="h-7 w-7 text-[#34D399]" />
            <span>Payout Safety &amp; Automated Escrow</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated payment escrow rules protect rideshare drivers and platforms against coordinated collusion drains and chargebacks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#34D399]/10 border border-[#34D399]/30 px-3 py-1 text-xs font-mono font-semibold text-[#34D399] flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Escrow Guard Active
          </span>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Volume Disbursed Today</span>
          <div className="text-2xl font-extrabold font-mono text-white">$148,920.00</div>
          <span className="text-[11px] text-[#34D399] font-mono">99.1% Cleared without Friction</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Active Escrow Holds (24h Gated)</span>
          <div className="text-2xl font-extrabold font-mono text-[#FBBF24]">$1,290.00</div>
          <span className="text-[11px] text-slate-400 font-mono">3 Accounts under biometric re-auth</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Syndicate Loss Intercepted</span>
          <div className="text-2xl font-extrabold font-mono text-red-400">$42,850.00</div>
          <span className="text-[11px] text-red-400 font-mono">Zero loss to Cluster-409 ring</span>
        </div>
      </div>

      {/* Filter Tabs & Table */}
      <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#56D9F5]" />
            Real-Time Payout Disbursement Ledger
          </h2>

          <div className="flex items-center gap-1 rounded-lg bg-[#080B12] p-1 border border-slate-800 text-xs font-mono">
            {["ALL", "RELEASED", "ESCROW_HOLD", "BLOCKED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  filter === tab
                    ? "bg-[#56D9F5]/20 text-[#56D9F5] font-bold border border-[#56D9F5]/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-slate-800 bg-[#080B12] text-slate-400 font-sans uppercase text-[11px]">
              <tr>
                <th className="p-3">Payout ID</th>
                <th className="p-3">Rider / Subject</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Masked Account</th>
                <th className="p-3">State</th>
                <th className="p-3">Risk &amp; Gate Rationale</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#101521]">
              {filteredPayouts.map((p) => (
                <tr key={p.id} className="hover:bg-[#141a29] transition-colors">
                  <td className="p-3 font-bold text-[#56D9F5]">{p.id}</td>
                  <td className="p-3 text-slate-200 font-sans font-medium">{p.rider}</td>
                  <td className="p-3 font-bold text-white">{p.amount}</td>
                  <td className="p-3 text-slate-400">{p.destination}</td>
                  <td className="p-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${p.badge}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 font-sans">{p.reason}</td>
                  <td className="p-3 text-right">
                    {p.status === "ESCROW_HOLD" ? (
                      <button
                        onClick={() => handleReleaseEscrow(p.id)}
                        className="rounded bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-[#34D399]/20 transition-all cursor-pointer"
                      >
                        Release Hold
                      </button>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
