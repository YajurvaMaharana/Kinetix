"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Banknote,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
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
    const onRoleChange = () => setActiveRoleState(getActiveRole());
    window.addEventListener("trustjuggler:role_changed", onRoleChange);
    return () => window.removeEventListener("trustjuggler:role_changed", onRoleChange);
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
          payout_id: "pay_sample_01",
          rider_id: "rider_hijack_victim",
          amount: 18500.0,
          currency: "INR",
          destination_account: "acct_****_9021",
          status: "HELD",
          risk_at_request: 68.5,
          reason: "Payout held: Payout account was updated within the 24-hour protection window. Requires facial liveness verification and analyst clearance.",
          release_requires: "liveness_selfie+analyst_approval",
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          payout_id: "pay_sample_02",
          rider_id: "rider_syndicate_node_014",
          amount: 175.0,
          currency: "USD",
          destination_account: "acct_****_9921",
          status: "BLOCKED",
          risk_at_request: 88.0,
          reason: "Payout blocked: Destination or identity linked to an organized syndicate fraud ring.",
          release_requires: "analyst_approval",
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          payout_id: "pay_sample_03",
          rider_id: "rider_clean_driver_007",
          amount: 45.0,
          currency: "USD",
          destination_account: "acct_****_1042",
          status: "APPROVED",
          risk_at_request: 12.0,
          reason: "Payout approved: Routine withdrawal within established baseline risk parameters.",
          release_requires: "none",
          created_at: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          payout_id: "pay_sample_04",
          rider_id: "rider_regular_user_42",
          amount: 60.0,
          currency: "USD",
          destination_account: "acct_****_3312",
          status: "RELEASED",
          risk_at_request: 18.0,
          reason: "Payout released: Facial liveness verification successfully confirmed.",
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

  const isAnalyst = activeRole === "analyst" || activeRole === "admin";

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Banknote className="h-6 w-6 text-emerald-400" />
            Payout Protection &amp; Escrow Safety
          </h1>
          <p className="text-xs text-slate-400">
            24-hour account modification protection window, anomaly gating, and two-phase biometric release.
          </p>
        </div>

        {/* Refresh & Role Indicator */}
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

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <span className="text-xs font-semibold text-slate-400 mr-2">Filter State:</span>
        {["ALL", "HELD", "BLOCKED", "APPROVED", "RELEASED"].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              selectedStatus === st
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Payouts Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/90 text-slate-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Payout ID</th>
              <th className="p-3.5">Rider / Recipient</th>
              <th className="p-3.5">Disbursement Amount</th>
              <th className="p-3.5">Destination Token</th>
              <th className="p-3.5">Escrow Status</th>
              <th className="p-3.5">Gating Rationale &amp; Requirements</th>
              <th className="p-3.5 text-right">Analyst Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                  No payout disbursements found matching status: {selectedStatus}
                </td>
              </tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.payout_id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Payout ID */}
                  <td className="p-3.5 font-bold text-indigo-300">
                    {p.payout_id}
                    <span className="block text-[10px] text-slate-500 font-normal">
                      {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>

                  {/* Rider */}
                  <td className="p-3.5 text-slate-300 font-sans font-medium">
                    {p.rider_id}
                  </td>

                  {/* Amount */}
                  <td className="p-3.5 font-extrabold text-white">
                    {p.currency === "USD" ? "$" : p.currency + " "}
                    {p.amount.toFixed(2)}
                  </td>

                  {/* Destination */}
                  <td className="p-3.5 text-slate-400">
                    {p.destination_account || p.destination_account_token || "Default Token"}
                  </td>

                  {/* Status Badge */}
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusBadge(
                        p.status
                      )}`}
                    >
                      {p.status === "HELD" && <Clock className="h-3 w-3" />}
                      {p.status === "BLOCKED" && <XCircle className="h-3 w-3" />}
                      {p.status === "RELEASED" && <CheckCircle2 className="h-3 w-3" />}
                      {p.status}
                    </span>
                  </td>

                  {/* Reason & Requirements */}
                  <td className="p-3.5 text-slate-300 font-sans max-w-sm space-y-1">
                    <p className="text-[11px] leading-relaxed">
                      {p.reason || p.hold_reason || "Standard withdrawal policy."}
                    </p>
                    {p.release_requires && p.release_requires !== "none" && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-mono">
                        <Lock className="h-3 w-3" />
                        <span>Requires: {p.release_requires}</span>
                      </div>
                    )}
                  </td>

                  {/* Analyst Action Buttons */}
                  <td className="p-3.5 text-right font-sans">
                    {p.status === "RELEASED" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Released
                      </span>
                    ) : isAnalyst ? (
                      <div className="flex items-center justify-end gap-2">
                        {/* Release Button */}
                        <button
                          onClick={() => handleAction(p.payout_id, "release")}
                          disabled={actionLoading === p.payout_id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-all disabled:opacity-50"
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
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600/20 border border-rose-500/40 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-600/30 transition-all disabled:opacity-50"
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
                        Analyst sign-off required
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
  );
}
