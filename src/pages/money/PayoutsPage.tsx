import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { listPayouts, payoutAction, PayoutItem } from "@/api/endpoints";
import {
  Banknote,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Send,
  Zap,
} from "lucide-react";

export default function PayoutsPage() {
  const { role, canApprovePayouts, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("HELD");
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [selectedPayout, setSelectedPayout] = useState<PayoutItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await listPayouts();
        setPayouts(data);
        if (data.length > 0) setSelectedPayout(data[0]);
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Failed to load payouts",
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const handleAction = async (action: "release" | "block") => {
    if (!canApprovePayouts || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can approve or block payouts. Auditor role is read-only.",
      });
      return;
    }

    if (!selectedPayout) return;

    setActionLoading(true);
    try {
      const updated = await payoutAction(selectedPayout.payout_id, {
        action,
        reason: `Manually adjudicated by ${role}.`,
      });

      setPayouts((prev) =>
        prev.map((p) => (p.payout_id === selectedPayout.payout_id ? { ...p, status: updated.status } : p))
      );
      setSelectedPayout((prev) => (prev ? { ...prev, status: updated.status } : null));

      showToast({
        type: action === "release" ? "success" : "error",
        title: action === "release" ? "Payout Released" : "Payout Blocked & Quarantined",
        message:
          action === "release"
            ? `Disbursed $${selectedPayout.amount.toFixed(2)} to ${selectedPayout.destination_account || "account"}.`
            : `Quarantined $${selectedPayout.amount.toFixed(2)}. Flagged for legal risk review.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Action Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchACH = () => {
    showToast({
      type: "info",
      title: "Batch ACH Triggered",
      message: "Sending $148,290 in compliant payouts to payment processor rails.",
    });
  };

  const filtered = payouts.filter((p) => {
    if (tab === "HELD") return p.status === "HELD" || p.status === "PENDING";
    if (tab === "APPROVED") return p.status === "APPROVED";
    if (tab === "BLOCKED") return p.status === "BLOCKED";
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Zero-Loss Liquidity"
        title="Payout Protection Vault & Escrows"
        subtitle="Autonomous micro-escrows and zero-second settlement gates for compliant runs"
        primaryAction={{
          label: "Batch Process ACH",
          icon: Zap,
          onClick: handleBatchACH,
          disabled: isReadOnly,
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "HELD", label: "Held For Review", count: payouts.filter((p) => p.status === "HELD" || p.status === "PENDING").length },
          { id: "APPROVED", label: "Dispatched Batches" },
          { id: "BLOCKED", label: "Quarantined" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {loading ? (
        <SkeletonLoader type="split" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No payouts currently under review"
          description="All courier payout requests have been autonomously cleared or dispatched."
        />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Payout List */}
          <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft space-y-2 h-[560px] overflow-y-auto">
            <div className="px-2 py-1 text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
              <span>Payout Gating Queue</span>
              <span className="font-mono text-[10px] text-[var(--primary)] font-bold">
                Next Window: 42m
              </span>
            </div>

            {filtered.map((p) => {
              const isSelected = selectedPayout?.payout_id === p.payout_id;
              return (
                <button
                  key={p.payout_id}
                  onClick={() => setSelectedPayout(p)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                    isSelected
                      ? "bg-[var(--lavender)] border-[var(--primary)] shadow-sm"
                      : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        p.status === "APPROVED"
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : p.status === "BLOCKED"
                          ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                          : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                      }`}
                    >
                      💵
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-[var(--ink)]">
                        ${p.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[var(--muted)] mt-0.5">
                        Courier: {p.rider_id} • {p.destination_account || "Direct ACH"}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.status === "APPROVED"
                        ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                        : p.status === "BLOCKED"
                        ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                        : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                    }`}
                  >
                    {p.status}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Column: Payout Detail & Actions */}
          {selectedPayout && (
            <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                      DISBURSEMENT FILE • {selectedPayout.payout_id}
                    </span>
                    <h3 className="text-2xl font-extrabold text-[var(--ink)] mt-0.5">
                      ${selectedPayout.amount.toFixed(2)} USD
                    </h3>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedPayout.status === "APPROVED"
                        ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                        : selectedPayout.status === "BLOCKED"
                        ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                        : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                    }`}
                  >
                    {selectedPayout.status}
                  </span>
                </div>

                {/* Hold Rationale Card */}
                {selectedPayout.hold_reason && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs mb-4 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Security Vault Hold Triggered</span>
                    </div>
                    <p className="text-[11px] text-[var(--ink)] leading-relaxed">
                      {selectedPayout.hold_reason}
                    </p>
                  </div>
                )}

                {/* Account Coordinates */}
                <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Beneficiary Courier</span>
                    <div className="font-extrabold text-sm text-[var(--ink)] mt-0.5">{selectedPayout.rider_id}</div>
                    <div className="text-[10px] text-[var(--muted)]">Shift: Active Dispatch Run</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Destination Bank Coordinate</span>
                    <div className="font-extrabold text-sm text-[var(--ink)] mt-0.5">
                      {selectedPayout.destination_account || "Verified ACH Routing"}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">Zero ACH Reversal History</div>
                  </div>
                </div>

                {/* Vault Guarantees */}
                <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2 text-xs text-[var(--muted)]">
                  <div className="flex items-center gap-2 text-[var(--ink)] font-bold">
                    <ShieldCheck className="w-4 h-4 text-[var(--status-allow)]" />
                    <span>Autonomous Escrow Protection Guarantee</span>
                  </div>
                  <p className="text-[11px]">
                    Releasing funds immediately authorizes payment gateway settlement with 100% platform chargeback immunity.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--muted)]">
                  {isReadOnly ? "Auditor view (read-only)" : "Authorizes instantaneous wire transfer"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction("release")}
                    disabled={isReadOnly || actionLoading || selectedPayout.status === "APPROVED"}
                    className="px-5 py-2.5 rounded-full bg-[var(--status-allow)] hover:bg-[#28ab80] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Release Funds Now</span>
                  </button>
                  <button
                    onClick={() => handleAction("block")}
                    disabled={isReadOnly || actionLoading || selectedPayout.status === "BLOCKED"}
                    className="px-5 py-2.5 rounded-full bg-[var(--status-escalate)] hover:bg-[#d43f44] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Block &amp; Quarantine</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
