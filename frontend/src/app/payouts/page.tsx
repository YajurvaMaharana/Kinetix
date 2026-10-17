"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Banknote,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { getPayouts, patchPayout, getActiveRole } from "@/lib/api";
import { Payout, Role } from "@/lib/types";

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [activeRole, setActiveRoleState] = useState<Role>("analyst");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync active RBAC role
  useEffect(() => {
    setActiveRoleState(getActiveRole());
    const onRoleChanged = () => setActiveRoleState(getActiveRole());
    window.addEventListener("trustjuggler:role_changed", onRoleChanged);
    return () => window.removeEventListener("trustjuggler:role_changed", onRoleChanged);
  }, []);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const filter = selectedStatus === "ALL" ? undefined : selectedStatus;
      const data = await getPayouts(filter, activeRole);
      setPayouts(data);
    } catch {
      // Fallback sample data if backend endpoint is unavailable
      setPayouts([
        {
          payout_id: "pay_99812",
          rider_id: "rider_syndicate_node_014",
          amount: 175.0,
          currency: "USD",
          destination_account: "acct_••••_9921",
          status: "BLOCKED",
          risk_at_request: 88.0,
          reason: "Member of syndicate CLUSTER-RING-409 (14 devices sharing destination)",
          release_requires: "analyst_approval",
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          payout_id: "pay_99811",
          rider_id: "rider_global_susp_7719",
          amount: 190.0,
          currency: "USD",
          destination_account: "acct_••••_8812",
          status: "HELD",
          risk_at_request: 68.5,
          reason: "Held 24h pending emulator investigation case_spoof_9004",
          release_requires: "liveness_selfie+analyst_approval",
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          payout_id: "pay_99810",
          rider_id: "rider_us_east_4102",
          amount: 33.5,
          currency: "USD",
          destination_account: "acct_••••_1042",
          status: "RELEASED",
          risk_at_request: 12.0,
          reason: "Clean session (Score 96), instant ACH cleared",
          release_requires: "none",
          created_at: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          payout_id: "pay_99809",
          rider_id: "rider_us_midwest_1889",
          amount: 64.0,
          currency: "USD",
          destination_account: "acct_••••_3411",
          status: "RELEASED",
          risk_at_request: 14.0,
          reason: "Face similarity 0.98 validated, ordinary transit cleared",
          release_requires: "none",
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, activeRole]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleAction = async (payoutId: string, action: "release" | "block") => {
    setActionLoading(payoutId);
    setActionMessage(null);
    try {
      const updated = await patchPayout(
        payoutId,
        action,
        `Analyst manually ${action}d via dashboard`,
        activeRole
      );
      setPayouts((prev) =>
        prev.map((p) => (p.payout_id === payoutId ? { ...p, ...updated } : p))
      );
      setActionMessage({
        type: "success",
        text: `Payout ${payoutId} successfully marked as ${updated.status}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({
        type: "error",
        text: msg,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isAnalystOrFinance = activeRole === "analyst" || activeRole === "finance" || activeRole === "admin";

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return "border-blue-500/40 bg-blue-500/10 text-blue-300";
      case "HELD":
      case "ESCROW_HOLD":
        return "border-amber-500/40 bg-amber-500/10 text-amber-300 animate-pulse";
      case "BLOCKED":
        return "border-rose-500/40 bg-rose-500/10 text-rose-300";
      case "RELEASED":
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  };

  const filteredPayouts = payouts.filter((p) => {
    if (selectedStatus === "ALL") return true;
    if (selectedStatus === "HELD") {
      return p.status === "HELD" || p.status === "ESCROW_HOLD";
    }
    return p.status === selectedStatus;
  });

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
            24-hour account modification protection window, anomaly gating, and two-phase biometric release.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] font-mono text-slate-400">
            Active Role: <strong className="text-white capitalize">{activeRole}</strong>
          </span>
          <button
            onClick={fetchPayouts}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Role Adaptation Banner */}
      {activeRole === "finance" ? (
        <div className="rounded-xl border border-[#34D399]/40 bg-[#34D399]/10 p-3.5 flex items-center justify-between text-xs text-[#34D399]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[11px] block text-white">Finance Lead Console Active</span>
              <span>Full treasury authorization enabled. Payout hold releases and syndicate loss intercepts are logged to the audit ledger.</span>
            </div>
          </div>
          <span className="rounded bg-[#34D399]/20 px-2.5 py-1 text-[10px] font-mono font-bold text-white uppercase">Authorized</span>
        </div>
      ) : activeRole === "rider" ? (
        <div className="rounded-xl border border-[#56D9F5]/40 bg-[#56D9F5]/10 p-3.5 flex items-center justify-between text-xs text-[#56D9F5]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[11px] block text-white">Rider Account Disbursement View</span>
              <span>Displaying personal earnings status and payout safety locks. Manual escrow releases require Finance or Security Admin authorization.</span>
            </div>
          </div>
          <span className="rounded bg-[#56D9F5]/20 px-2.5 py-1 text-[10px] font-mono font-bold text-white uppercase">Rider Mode</span>
        </div>
      ) : null}

      {/* Action Toast Feedback */}
      {actionMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs ${
            actionMessage.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
              : "border-rose-500/40 bg-rose-950/30 text-rose-200"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

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

      {/* Filter Chips Bar & Table */}
      <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#56D9F5]" />
            Real-Time Payout Disbursement Ledger
          </h2>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#080B12] p-1 border border-slate-800 text-xs font-mono">
            {["ALL", "HELD", "BLOCKED", "APPROVED", "RELEASED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedStatus(tab)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  selectedStatus === tab
                    ? "bg-[#56D9F5]/20 text-[#56D9F5] font-bold border border-[#56D9F5]/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Payouts Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-slate-800 bg-[#080B12] text-slate-400 font-sans uppercase text-[11px]">
              <tr>
                <th className="p-3">Payout ID</th>
                <th className="p-3">Rider / Recipient</th>
                <th className="p-3">Disbursement Amount</th>
                <th className="p-3">Destination Token</th>
                <th className="p-3">Escrow Status</th>
                <th className="p-3">Gating Rationale &amp; Requirements</th>
                <th className="p-3 text-right">Analyst Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#101521]">
              {filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                    No payout disbursements found matching status: {selectedStatus}
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((p) => (
                  <tr key={p.payout_id} className="hover:bg-[#141a29] transition-colors">
                    {/* Payout ID */}
                    <td className="p-3 font-bold text-[#56D9F5]">
                      {p.payout_id}
                      <span className="block text-[10px] text-slate-500 font-normal">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "Just now"}
                      </span>
                    </td>

                    {/* Rider */}
                    <td className="p-3 text-slate-200 font-sans font-medium">
                      {p.rider_id}
                    </td>

                    {/* Amount */}
                    <td className="p-3 font-extrabold text-white">
                      {p.currency === "USD" ? "$" : (p.currency ? p.currency + " " : "$")}
                      {Number(p.amount).toFixed(2)}
                    </td>

                    {/* Destination */}
                    <td className="p-3 text-slate-400">
                      {p.destination_account || p.destination_account_token || "Default Token"}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusBadge(
                          p.status
                        )}`}
                      >
                        {(p.status === "HELD" || p.status === "ESCROW_HOLD") && <Clock className="h-3 w-3" />}
                        {p.status === "BLOCKED" && <XCircle className="h-3 w-3" />}
                        {p.status === "RELEASED" && <CheckCircle2 className="h-3 w-3" />}
                        {p.status}
                      </span>
                    </td>

                    {/* Reason & Requirements */}
                    <td className="p-3 text-slate-300 font-sans max-w-sm space-y-1">
                      <p className="text-[11px] leading-relaxed">
                        {activeRole === "rider"
                          ? (p.reason || p.hold_reason || "Standard withdrawal policy.")
                              .replace(/Member of syndicate CLUSTER-RING-409.*$/, "Destination account under standard verification review.")
                              .replace(/Held 24h pending emulator investigation.*$/, "Held 24h pending biometric device re-authentication.")
                          : (p.reason || p.hold_reason || "Standard withdrawal policy.")}
                      </p>
                      {p.release_requires && p.release_requires !== "none" && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-mono">
                          <Lock className="h-3 w-3" />
                          <span>Requires: {p.release_requires}</span>
                        </div>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="p-3 text-right font-sans">
                      {p.status === "RELEASED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Released
                        </span>
                      ) : isAnalystOrFinance ? (
                        <div className="flex items-center justify-end gap-2">
                          {/* Release Button */}
                          <button
                            onClick={() => handleAction(p.payout_id, "release")}
                            disabled={actionLoading === p.payout_id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
                            title="Release funds to destination account"
                          >
                            <Unlock className="h-3 w-3" />
                            Release
                          </button>

                          {/* Block Button */}
                          {p.status !== "BLOCKED" && (
                            <button
                              onClick={() => handleAction(p.payout_id, "block")}
                              disabled={actionLoading === p.payout_id}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600/20 border border-rose-500/40 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-600/30 transition-all disabled:opacity-50 cursor-pointer"
                              title="Block suspicious payout permanently"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              Block
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic flex items-center justify-end gap-1">
                          <UserCheck className="h-3 w-3" />
                          Review Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
