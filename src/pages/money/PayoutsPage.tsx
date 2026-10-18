import React, { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  listPayouts,
  payoutAction,
  resolvePayoutLiveness,
  bulkApprovePayouts,
  bulkRejectPayouts,
  PayoutItem,
  PayoutStatus,
} from "@/api/endpoints";
import {
  Banknote,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Camera,
  User,
  Building2,
  CreditCard,
  X,
  Check,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";

// Format 24-hour protection countdown
function formatEscrowCountdown(deadlineString?: string): { text: string; urgent: boolean; expired: boolean } {
  if (!deadlineString) return { text: "24h Window", urgent: false, expired: false };
  const diffMs = new Date(deadlineString).getTime() - Date.now();
  if (diffMs <= 0) {
    return { text: "Window Expired (Auto-Eligible)", urgent: true, expired: true };
  }
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return {
    text: `${diffHours}h ${diffMins}m remaining`,
    urgent: diffHours < 4,
    expired: false,
  };
}

export default function PayoutsPage() {
  const { role, canApprovePayouts, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"HELD" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");

  // Selection & Bulk Actions
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<Set<string>>(new Set());

  // Row Drawer State
  const [drawerPayoutId, setDrawerPayoutId] = useState<string | null>(null);

  // Facial Liveness Modal
  const [livenessModalPayout, setLivenessModalPayout] = useState<PayoutItem | null>(null);
  const [livenessScanning, setLivenessScanning] = useState(false);
  const [livenessResult, setLivenessResult] = useState<{ passed: boolean; score: number } | null>(null);

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch payouts
  const fetchPayouts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listPayouts();
      setPayouts(data);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to load payouts",
        message: err.message || "Network error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // Drawer selected payout object
  const drawerPayout = useMemo(() => {
    return payouts.find((p) => p.payout_id === drawerPayoutId) || null;
  }, [payouts, drawerPayoutId]);

  // Summary Metrics
  const summary = useMemo(() => {
    const held = payouts.filter((p) => p.status === "HELD");
    const pending = payouts.filter((p) => p.status === "PENDING");
    const approved = payouts.filter((p) => p.status === "APPROVED");
    const rejected = payouts.filter((p) => p.status === "REJECTED" || p.status === "BLOCKED");

    return {
      heldAmount: held.reduce((sum, p) => sum + p.amount, 0),
      heldCount: held.length,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      releasedAmount: approved.reduce((sum, p) => sum + p.amount, 0),
      releasedCount: approved.length,
      rejectedCount: rejected.length,
      rejectedAmount: rejected.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [payouts]);

  // Filtered by Tab & Search
  const visiblePayouts = useMemo(() => {
    return payouts.filter((p) => {
      // Tab matching
      if (activeTab === "REJECTED") {
        if (p.status !== "REJECTED" && p.status !== "BLOCKED") return false;
      } else if (p.status !== activeTab) {
        return false;
      }

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = p.payout_id.toLowerCase().includes(q);
        const matchRider = (p.rider_name || "").toLowerCase().includes(q) || p.rider_id.toLowerCase().includes(q);
        const matchBank = (p.destination_account || "").toLowerCase().includes(q) || (p.bank_name || "").toLowerCase().includes(q);
        if (!matchId && !matchRider && !matchBank) return false;
      }
      return true;
    });
  }, [payouts, activeTab, searchQuery]);

  // Checkbox Selection
  const allVisibleSelected = visiblePayouts.length > 0 && visiblePayouts.every((p) => selectedPayoutIds.has(p.payout_id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedPayoutIds((prev) => {
        const next = new Set(prev);
        visiblePayouts.forEach((p) => next.delete(p.payout_id));
        return next;
      });
    } else {
      setSelectedPayoutIds((prev) => {
        const next = new Set(prev);
        visiblePayouts.forEach((p) => next.add(p.payout_id));
        return next;
      });
    }
  };

  const toggleSelectRow = (payoutId: string) => {
    setSelectedPayoutIds((prev) => {
      const next = new Set(prev);
      if (next.has(payoutId)) next.delete(payoutId);
      else next.add(payoutId);
      return next;
    });
  };

  // Single Action: Approve / Release
  const handleSingleApprove = async (payoutId: string) => {
    if (!canApprovePayouts || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can approve payouts.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const target = payouts.find((p) => p.payout_id === payoutId);
      const updated = await payoutAction(payoutId, {
        action: "release",
        reason: `Approved by ${role}. Payout cleared to destination account.`,
      });

      setPayouts((prev) => prev.map((p) => (p.payout_id === payoutId ? updated : p)));
      showToast({
        type: "success",
        title: "Payout Approved & Disbursed",
        message: `Released $${(target?.amount || 0).toFixed(2)} to ${target?.destination_account || "account"}.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Approve Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Single Action: Reject
  const handleSingleReject = async (payoutId: string) => {
    if (!canApprovePayouts || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can reject payouts.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const target = payouts.find((p) => p.payout_id === payoutId);
      const updated = await payoutAction(payoutId, {
        action: "block",
        reason: `Rejected by ${role}. Transferred to fraud quarantine escrow.`,
      });

      setPayouts((prev) => prev.map((p) => (p.payout_id === payoutId ? updated : p)));
      showToast({
        type: "error",
        title: "Payout Rejected",
        message: `$${(target?.amount || 0).toFixed(2)} quarantined for fraud audit.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Reject Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    if (!canApprovePayouts || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can approve payouts.",
      });
      return;
    }

    const ids = Array.from(selectedPayoutIds);
    if (ids.length === 0) return;

    setActionLoading(true);
    try {
      await bulkApprovePayouts(ids, role === "Admin" ? "System Admin" : "Lead Analyst");
      setPayouts((prev) =>
        prev.map((p) =>
          ids.includes(p.payout_id)
            ? {
                ...p,
                status: "APPROVED",
                checklist: { facial_liveness_verified: true, analyst_approved: true },
                reviewed_by: role || "Analyst",
              }
            : p
        )
      );
      setSelectedPayoutIds(new Set());
      showToast({
        type: "success",
        title: "Bulk Approved",
        message: `Successfully released ${ids.length} selected payouts.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Bulk Approve Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Reject
  const handleBulkReject = async () => {
    if (!canApprovePayouts || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can reject payouts.",
      });
      return;
    }

    const ids = Array.from(selectedPayoutIds);
    if (ids.length === 0) return;

    setActionLoading(true);
    try {
      await bulkRejectPayouts(ids, role === "Admin" ? "System Admin" : "Lead Analyst");
      setPayouts((prev) =>
        prev.map((p) =>
          ids.includes(p.payout_id)
            ? {
                ...p,
                status: "REJECTED",
                reviewed_by: role || "Analyst",
              }
            : p
        )
      );
      setSelectedPayoutIds(new Set());
      showToast({
        type: "error",
        title: "Bulk Rejected",
        message: `Quarantined ${ids.length} selected payouts.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Bulk Reject Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Export Audit Ledger (CSV Download)
  const handleExportAuditLedger = () => {
    const headers = [
      "Payout ID",
      "Courier ID",
      "Courier Name",
      "Amount (USD)",
      "Status",
      "Destination Account",
      "Bank Name",
      "Risk Score (%)",
      "Hold Reason",
      "Facial Liveness Verified",
      "Analyst Approved",
      "Created At",
    ];

    const rows = payouts.map((p) => [
      p.payout_id,
      p.rider_id,
      `"${p.rider_name || ""}"`,
      p.amount.toFixed(2),
      p.status,
      `"${p.destination_account || ""}"`,
      `"${p.bank_name || ""}"`,
      p.risk_score || 0,
      `"${(p.hold_reason || "").replace(/"/g, '""')}"`,
      p.checklist?.facial_liveness_verified ? "YES" : "NO",
      p.checklist?.analyst_approved ? "YES" : "NO",
      p.created_at,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payout_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      type: "success",
      title: "Ledger Exported",
      message: `Downloaded CSV ledger with ${payouts.length} payout records.`,
    });
  };

  // Resolve with Facial Liveness
  const openLivenessModal = (payout: PayoutItem) => {
    setLivenessModalPayout(payout);
    setLivenessResult(null);
    setLivenessScanning(false);
  };

  const executeLivenessScan = () => {
    setLivenessScanning(true);
    setTimeout(() => {
      setLivenessScanning(false);
      setLivenessResult({ passed: true, score: 99.4 });
    }, 1800);
  };

  const confirmLivenessVerification = async () => {
    if (!livenessModalPayout || !livenessResult) return;

    setActionLoading(true);
    try {
      const updated = await resolvePayoutLiveness(
        livenessModalPayout.payout_id,
        livenessResult.passed,
        livenessResult.score,
        role === "Admin" ? "System Admin" : "Lead Analyst"
      );

      setPayouts((prev) => prev.map((p) => (p.payout_id === updated.payout_id ? updated : p)));
      showToast({
        type: "success",
        title: "Facial Liveness Verified",
        message: `Step 1 checklist completed for ${livenessModalPayout.payout_id} (99.4% confidence).`,
      });
      setLivenessModalPayout(null);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Verification Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Payout Safety Engine"
        title="Payout Protection & Escrow Holds"
        subtitle="Dynamic risk-weighted payout holds, 24-hour protection windows, and biometric liveness release triggers"
        secondaryAction={{
          label: refreshing ? "Refreshing..." : "Refresh Payouts",
          icon: RefreshCw,
          onClick: () => fetchPayouts(true),
        }}
        primaryAction={{
          label: "Export Audit Ledger",
          icon: Download,
          onClick: handleExportAuditLedger,
          variant: "accent",
        }}
      />

      {/* =========================================================================
          SUMMARY STRIP (Held Amount | Pending Approvals | Released Today | Rejected)
         ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Held Amount */}
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-soft space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--status-escalate)]">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>Held Amount</span>
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[var(--status-escalate)]/15">
              {summary.heldCount} In Escrow
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[var(--ink)]">
            ${summary.heldAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Protected in 24h risk escrow pending proof
          </p>
        </div>

        {/* 2. Pending Approvals */}
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-soft space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--status-challenge)]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Pending Approvals</span>
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[var(--status-challenge)]/15">
              {summary.pendingCount} Queued
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[var(--ink)]">
            ${summary.pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Awaiting manual analyst triage signoff
          </p>
        </div>

        {/* 3. Released Today */}
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-soft space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--status-allow)]">
            <span className="flex items-center gap-1.5">
              <Unlock className="w-4 h-4" />
              <span>Released Today</span>
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[var(--status-allow)]/15">
              {summary.releasedCount} Cleared
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[var(--ink)]">
            ${summary.releasedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Disbursed to couriers via FedNow / RTP
          </p>
        </div>

        {/* 4. Rejected */}
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-soft space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[var(--status-escalate)]" />
              <span>Rejected / Quarantined</span>
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {summary.rejectedCount} Blocked
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[var(--ink)]">
            ${summary.rejectedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Permanently forfeited due to confirmed fraud
          </p>
        </div>
      </div>

      {/* =========================================================================
          TABS & BULK ACTIONS CONTROLS
         ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Tabs: Pending Approvals | Escrow Holds | Released | Rejected */}
        <SegmentedTabs
          tabs={[
            { id: "PENDING", label: "Pending Approvals", count: summary.pendingCount },
            { id: "HELD", label: "Escrow Holds", count: summary.heldCount, badge: "active" },
            { id: "APPROVED", label: "Released Today", count: summary.releasedCount },
            { id: "REJECTED", label: "Rejected", count: summary.rejectedCount },
          ]}
          activeTab={activeTab}
          onChange={(id) => {
            setActiveTab(id as any);
            setSelectedPayoutIds(new Set());
          }}
          className="mb-0"
        />

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, courier, or IBAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-full pl-8 pr-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] w-full shadow-soft transition-all"
          />
        </div>
      </div>

      {/* Floating Bulk Action Bar (when rows are selected) */}
      {selectedPayoutIds.size > 0 && (
        <div className="p-3 bg-[var(--lavender)] border border-[var(--primary)]/30 rounded-2xl flex items-center justify-between shadow-soft animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]">
            <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px]">
              {selectedPayoutIds.size}
            </span>
            <span>Payouts Selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkReject}
              disabled={actionLoading || isReadOnly}
              className="px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-rose-50 text-[var(--status-escalate)] border border-[var(--status-escalate)]/30 text-xs font-bold transition-all disabled:opacity-50"
            >
              Bulk Reject ({selectedPayoutIds.size})
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={actionLoading || isReadOnly}
              className="px-4 py-1.5 rounded-full bg-[var(--status-allow)] hover:opacity-90 text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50 flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Bulk Approve ({selectedPayoutIds.size})</span>
            </button>
            <button
              onClick={() => setSelectedPayoutIds(new Set())}
              className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAYOUTS TABLE
         ========================================================================= */}
      {loading ? (
        <SkeletonLoader type="table" />
      ) : visiblePayouts.length === 0 ? (
        <EmptyState
          title={`No ${activeTab.toLowerCase().replace("_", " ")} payouts found`}
          description="There are currently no disbursements in this tab matching your search criteria."
        />
      ) : (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-alt)] text-[var(--muted)] uppercase text-[10px] font-bold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="rounded text-[var(--primary)] focus:ring-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Payout ID</th>
                  <th className="py-3 px-4">Courier</th>
                  <th className="py-3 px-4">Destination Account</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">
                    {activeTab === "HELD" ? "24h Protection Window" : "Risk Score / Trigger"}
                  </th>
                  {activeTab === "HELD" && <th className="py-3 px-4">Release Checklist</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {visiblePayouts.map((payout) => {
                  const isChecked = selectedPayoutIds.has(payout.payout_id);
                  const escrowSla = formatEscrowCountdown(payout.escrow_window_deadline);

                  return (
                    <tr
                      key={payout.payout_id}
                      onClick={() => setDrawerPayoutId(payout.payout_id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-[var(--lavender)]/40"
                          : drawerPayoutId === payout.payout_id
                          ? "bg-[var(--surface-alt)]"
                          : "hover:bg-[var(--surface-alt)]/60"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(payout.payout_id)}
                          className="rounded text-[var(--primary)] focus:ring-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      {/* Payout ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[var(--primary)]">
                        {payout.payout_id}
                      </td>

                      {/* Courier */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[var(--ink)]">
                          {payout.rider_name || "Unknown Courier"}
                        </div>
                        <div className="text-[10px] text-[var(--muted)] font-mono">
                          {payout.rider_id} • {payout.rider_hub || "Metro Hub"}
                        </div>
                      </td>

                      {/* Destination Account */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-[var(--ink)]">
                          {payout.destination_account || "•••• 0000"}
                        </div>
                        <div className="text-[10px] text-[var(--muted)]">
                          {payout.bank_name || "Direct Deposit"}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-mono font-extrabold text-sm text-[var(--ink)]">
                        ${payout.amount.toFixed(2)}
                      </td>

                      {/* 24h Protection Window / Risk Trigger */}
                      <td className="py-3.5 px-4">
                        {activeTab === "HELD" ? (
                          <div className="space-y-0.5">
                            <div
                              className={`flex items-center gap-1 font-mono text-[11px] font-bold ${
                                escrowSla.expired
                                  ? "text-[var(--status-allow)]"
                                  : escrowSla.urgent
                                  ? "text-[var(--status-challenge)]"
                                  : "text-[var(--primary)]"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{escrowSla.text}</span>
                            </div>
                            <div className="text-[10px] text-[var(--muted)] truncate max-w-xs">
                              {payout.hold_reason}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5">
                              {payout.risk_score && payout.risk_score > 70 ? (
                                <span className="inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]">
                                  {payout.risk_score}% Risk
                                </span>
                              ) : payout.risk_score && payout.risk_score > 40 ? (
                                <span className="inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]">
                                  {payout.risk_score}% Risk
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-[var(--status-allow)]/15 text-[var(--status-allow)]">
                                  Low Risk
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--muted)] truncate max-w-xs mt-0.5">
                              {payout.hold_reason || "Normal dispatch clearance"}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Release Checklist (For Escrow Holds Tab) */}
                      {activeTab === "HELD" && (
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {/* Checklist Item 1: Facial liveness */}
                            <div className="flex items-center gap-1.5 text-[11px]">
                              {payout.checklist?.facial_liveness_verified ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-allow)]" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                              )}
                              <span
                                className={
                                  payout.checklist?.facial_liveness_verified
                                    ? "text-[var(--ink)] font-semibold"
                                    : "text-[var(--muted)]"
                                }
                              >
                                Facial liveness verified
                              </span>
                            </div>

                            {/* Checklist Item 2: Analyst approval */}
                            <div className="flex items-center gap-1.5 text-[11px]">
                              {payout.checklist?.analyst_approved ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-allow)]" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              <span
                                className={
                                  payout.checklist?.analyst_approved
                                    ? "text-[var(--ink)] font-semibold"
                                    : "text-[var(--muted)]"
                                }
                              >
                                Analyst approval
                              </span>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Status Chip */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            payout.status === "APPROVED"
                              ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                              : payout.status === "HELD"
                              ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                              : payout.status === "PENDING"
                              ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {payout.status === "APPROVED"
                            ? "Released"
                            : payout.status === "HELD"
                            ? "Escrow Hold"
                            : payout.status === "PENDING"
                            ? "Pending Review"
                            : "Rejected"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {payout.status === "HELD" && !payout.checklist?.facial_liveness_verified && (
                            <button
                              onClick={() => openLivenessModal(payout)}
                              className="px-2.5 py-1 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[11px] font-bold shadow-sm transition-all flex items-center gap-1"
                              title="Resolve with Facial Liveness"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Liveness</span>
                            </button>
                          )}

                          {(payout.status === "PENDING" || payout.status === "HELD") && (
                            <button
                              onClick={() => handleSingleApprove(payout.payout_id)}
                              disabled={actionLoading || isReadOnly}
                              className="px-2.5 py-1 rounded-full bg-[var(--status-allow)] hover:opacity-90 text-white text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                              title="Approve & Disburse Payout"
                            >
                              Approve
                            </button>
                          )}

                          <button
                            onClick={() => setDrawerPayoutId(payout.payout_id)}
                            className="p-1 rounded-full hover:bg-[var(--lavender)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                            title="Inspect Payout Dossier"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          ROW DRAWER (Slide-in Right Panel)
         ========================================================================= */}
      {drawerPayout && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerPayoutId(null)}
          />

          <div className="relative w-full max-w-lg bg-[var(--surface)] h-full shadow-2xl flex flex-col justify-between border-l border-[var(--border)] z-10 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)]">
                  {drawerPayout.payout_id}
                </span>

                <button
                  onClick={() => setDrawerPayoutId(null)}
                  className="p-1 rounded-full hover:bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <span className="text-2xl font-mono font-extrabold text-[var(--ink)]">
                  ${drawerPayout.amount.toFixed(2)}
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  Courier: <strong>{drawerPayout.rider_name}</strong> ({drawerPayout.rider_id})
                </span>
              </div>
            </div>

            {/* Drawer Body Scroll Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {/* Destination Bank Account */}
              <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2">
                <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">
                  Settlement Rail & Routing
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-[var(--ink)] text-sm">
                      {drawerPayout.bank_name || "Direct Deposit Account"}
                    </div>
                    <div className="font-mono text-[var(--muted)]">
                      {drawerPayout.destination_account || "•••• 0000"}
                    </div>
                  </div>
                  <CreditCard className="w-5 h-5 text-[var(--primary)]" />
                </div>
              </div>

              {/* Escrow Release Checklist */}
              <div className="p-4 rounded-xl bg-[var(--lavender)]/50 border border-[var(--primary)]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">
                    Statutory Release Checklist
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted)]">2 Steps Mandatory</span>
                </div>

                <div className="space-y-2">
                  {/* Step 1 */}
                  <div className="flex items-start justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      {drawerPayout.checklist?.facial_liveness_verified ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--status-allow)]" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <strong className="block text-[var(--ink)]">1. Facial Liveness Verified</strong>
                        <span className="text-[10px] text-[var(--muted)]">
                          {drawerPayout.checklist?.facial_liveness_verified
                            ? `Attested (${drawerPayout.liveness_score || 99.4}% confidence)`
                            : "Pending courier 3D camera challenge"}
                        </span>
                      </div>
                    </div>

                    {!drawerPayout.checklist?.facial_liveness_verified && (
                      <button
                        onClick={() => openLivenessModal(drawerPayout)}
                        className="px-2 py-0.5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold"
                      >
                        Resolve
                      </button>
                    )}
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      {drawerPayout.checklist?.analyst_approved ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--status-allow)]" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                      <div>
                        <strong className="block text-[var(--ink)]">2. Analyst Approval Signoff</strong>
                        <span className="text-[10px] text-[var(--muted)]">
                          {drawerPayout.checklist?.analyst_approved
                            ? `Signed off by ${drawerPayout.reviewed_by || "Analyst"}`
                            : "Requires Analyst or Admin review"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 24-Hour Protection Window Countdown */}
              {drawerPayout.escrow_window_deadline && (
                <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">
                      24h Protection Window:
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--primary)]">
                      {formatEscrowCountdown(drawerPayout.escrow_window_deadline).text}
                    </span>
                  </div>
                  <Clock className="w-4 h-4 text-[var(--muted)]" />
                </div>
              )}

              {/* Hold Reason & Risk Profile */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">
                  Risk & Anomaly Annotation
                </span>
                <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--ink)]">
                      Risk Tier: {drawerPayout.risk_score || 0}%
                    </span>
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      Hub: {drawerPayout.rider_hub || "Metro"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    {drawerPayout.hold_reason || "Normal dispatch routing with no telemetry anomalies."}
                  </p>
                  {drawerPayout.notes && (
                    <div className="pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--primary)] italic">
                      "{drawerPayout.notes}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Bottom Actions Toolbar */}
            <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--surface)]">
              <span className="text-[11px] text-[var(--muted)]">
                {isReadOnly ? "Auditor view (read-only)" : "Analyst authorization desk"}
              </span>

              <div className="flex items-center gap-2">
                {(drawerPayout.status === "PENDING" || drawerPayout.status === "HELD") && (
                  <>
                    <button
                      onClick={() => handleSingleReject(drawerPayout.payout_id)}
                      disabled={actionLoading || isReadOnly}
                      className="px-4 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-rose-50 text-[var(--status-escalate)] border border-[var(--status-escalate)]/30 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleSingleApprove(drawerPayout.payout_id)}
                      disabled={actionLoading || isReadOnly}
                      className="px-5 py-2 rounded-full bg-[var(--status-allow)] hover:opacity-90 text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
                    >
                      Approve & Disburse
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RESOLVE WITH FACIAL LIVENESS MODAL
         ========================================================================= */}
      {livenessModalPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setLivenessModalPayout(null)}
          />

          <div className="relative bg-[var(--surface)] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--border)] space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-extrabold text-[var(--ink)]">
                  Resolve with Facial Liveness
                </h3>
              </div>
              <button
                onClick={() => setLivenessModalPayout(null)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Verify biometric proof for courier <strong>{livenessModalPayout.rider_name}</strong> ({livenessModalPayout.rider_id}) to unlock payout <strong>{livenessModalPayout.payout_id}</strong> (${livenessModalPayout.amount.toFixed(2)}).
            </p>

            {/* Camera Viewfinder Simulation */}
            <div className="relative h-48 bg-slate-900 rounded-xl overflow-hidden border-2 border-[var(--primary)]/30 flex flex-col items-center justify-center text-white">
              {livenessScanning ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full border-4 border-[var(--support)] border-t-transparent animate-spin" />
                  <span className="text-xs font-mono font-bold text-[var(--support)]">
                    Scanning 3D Depth Map & Eye Blink...
                  </span>
                </div>
              ) : livenessResult ? (
                <div className="flex flex-col items-center gap-1.5 animate-in zoom-in-90">
                  <CheckCircle2 className="w-12 h-12 text-[var(--status-allow)]" />
                  <span className="text-sm font-extrabold text-white">
                    Biometric Liveness Confirmed
                  </span>
                  <span className="text-xs font-mono text-emerald-300">
                    Confidence: {livenessResult.score}% • Zero Spoof
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-300">
                  <Camera className="w-10 h-10 text-slate-400" />
                  <span className="text-xs font-mono">
                    Ready for 3D Camera Attestation Scan
                  </span>
                </div>
              )}

              {/* Viewfinder crosshairs */}
              <div className="absolute inset-4 border border-dashed border-white/20 pointer-events-none rounded-lg" />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLivenessModalPayout(null)}
                className="px-4 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--ink)] text-xs font-bold transition-all"
              >
                Cancel
              </button>

              {!livenessResult ? (
                <button
                  type="button"
                  onClick={executeLivenessScan}
                  disabled={livenessScanning}
                  className="px-5 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-soft transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{livenessScanning ? "Verifying..." : "Capture & Verify 3D Biometrics"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmLivenessVerification}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-full bg-[var(--status-allow)] hover:opacity-90 text-white text-xs font-bold shadow-soft transition-all"
                >
                  {actionLoading ? "Updating..." : "Save Liveness & Update Checklist"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
