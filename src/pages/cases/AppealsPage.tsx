import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { listAppeals, resolveAppeal, AppealItem } from "@/api/endpoints";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  ShieldCheck,
  RotateCcw,
  PlusCircle,
} from "lucide-react";

export default function AppealsPage() {
  const { role, canManageCases, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<AppealItem | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await listAppeals();
        setAppeals(data);
        if (data.length > 0) setSelectedAppeal(data[0]);
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Failed to load appeals",
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const handleResolve = async (action: "overturned" | "upheld") => {
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can adjudicate appeals. Auditor role is read-only.",
      });
      return;
    }

    if (!selectedAppeal) return;

    setActionLoading(true);
    try {
      const updated = await resolveAppeal(selectedAppeal.id, {
        action,
        note: reviewerNote || `Appeal ${action} by analyst ${role}.`,
      });

      setAppeals((prev) =>
        prev.map((a) => (a.id === selectedAppeal.id ? { ...a, status: updated.status, reviewer_note: updated.reviewer_note } : a))
      );
      setSelectedAppeal((prev) => (prev ? { ...prev, status: updated.status, reviewer_note: updated.reviewer_note } : null));
      setReviewerNote("");

      showToast({
        type: action === "overturned" ? "success" : "info",
        title: action === "overturned" ? "Appeal Overturned" : "Appeal Upheld",
        message:
          action === "overturned"
            ? `Appeal ${selectedAppeal.id} overturned. Restrictions lifted, payout holds unlocked.`
            : `Appeal ${selectedAppeal.id} upheld. Restriction maintained with recorded rationale.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Resolution Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTestAppeal = () => {
    const newAppeal: AppealItem = {
      id: `APP-${Math.floor(400 + Math.random() * 90)}`,
      case_id: "CASE-9008",
      rider_id: "CR-7812",
      reason: "Delivery was delayed due to road construction detour on Mercer Street.",
      supporting_text: "City road closure notice verified by municipal transit feed.",
      status: "PENDING",
      created_at: new Date().toISOString(),
    };
    setAppeals((prev) => [newAppeal, ...prev]);
    setSelectedAppeal(newAppeal);
    showToast({
      type: "success",
      title: "Test Appeal Ingested",
      message: `Dispute ${newAppeal.id} added to the pending queue.`,
    });
  };

  const filtered = appeals.filter((a) => {
    if (tab === "PENDING") return a.status === "PENDING";
    if (tab === "OVERTURNED") return a.status === "OVERTURNED";
    if (tab === "UPHELD") return a.status === "UPHELD";
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Human Redress & Compliance"
        title="Human-in-the-Loop Appeals & Redress"
        subtitle="Courier dispute adjudication, false positive remediation & proof review"
        primaryAction={{
          label: "Submit Test Dispute",
          icon: PlusCircle,
          onClick: handleCreateTestAppeal,
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "ALL", label: "All Disputes", count: appeals.length },
          { id: "PENDING", label: "Pending Adjudication", count: appeals.filter((a) => a.status === "PENDING").length },
          { id: "OVERTURNED", label: "Overturned" },
          { id: "UPHELD", label: "Upheld" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {loading ? (
        <SkeletonLoader type="split" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No appeals in this queue"
          description="All driver appeals have been fully adjudicated."
        />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Appeals Queue */}
          <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft space-y-2 h-[560px] overflow-y-auto">
            <div className="px-2 py-1 text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
              <span>Dispute Queue</span>
              <span className="font-mono text-[10px] text-[var(--primary)] font-bold">
                {filtered.length} In Queue
              </span>
            </div>

            {filtered.map((a) => {
              const isSelected = selectedAppeal?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAppeal(a)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between group ${
                    isSelected
                      ? "bg-[var(--lavender)] border-[var(--primary)] shadow-sm"
                      : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)]">
                      {a.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        a.status === "PENDING"
                          ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                          : a.status === "OVERTURNED"
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-xs text-[var(--ink)]">
                    Courier {a.rider_id || "CR-DEMO"}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] line-clamp-1 mt-0.5">
                    {a.reason}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--muted)]">
                    <span>Case: {a.case_id || "Unlinked"}</span>
                    <span>2h SLA Active</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Appeal Dossier & Adjudication */}
          {selectedAppeal && (
            <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                      APPEAL FILE • {selectedAppeal.id}
                    </span>
                    <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
                      Courier {selectedAppeal.rider_id || "CR-DEMO"} Contestation
                    </h3>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedAppeal.status === "OVERTURNED"
                        ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                        : selectedAppeal.status === "UPHELD"
                        ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                        : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                    }`}
                  >
                    {selectedAppeal.status}
                  </span>
                </div>

                {/* Appeal Reason & Supporting Evidence */}
                <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] mb-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Rider Stated Reason:</span>
                    <p className="text-xs text-[var(--ink)] font-semibold mt-0.5">
                      "{selectedAppeal.reason}"
                    </p>
                  </div>

                  {selectedAppeal.supporting_text && (
                    <div className="pt-2 border-t border-[var(--border-subtle)]">
                      <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Supporting Evidence &amp; Telemetry:</span>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        {selectedAppeal.supporting_text}
                      </p>
                    </div>
                  )}
                </div>

                {selectedAppeal.reviewer_note && (
                  <div className="p-3 rounded-xl bg-[var(--lavender)] border border-[var(--primary)]/20 mb-4">
                    <span className="text-[10px] font-bold text-[var(--primary)] uppercase">Recorded Reviewer Decision Note:</span>
                    <p className="text-xs text-[var(--ink)] mt-0.5">{selectedAppeal.reviewer_note}</p>
                  </div>
                )}

                {/* Reviewer Note Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[var(--ink)]">
                    Analyst Adjudication Note:
                  </label>
                  <textarea
                    rows={2}
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    placeholder="Enter formal justification for lifting or maintaining verification holds..."
                    className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--muted)]">
                  Overturning immediately lifts holds &amp; restores earnings dispatch.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolve("overturned")}
                    disabled={isReadOnly || actionLoading || selectedAppeal.status === "OVERTURNED"}
                    className="px-4 py-2 rounded-full bg-[var(--status-allow)] hover:bg-[#28ab80] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
                  >
                    Overturn &amp; Restore
                  </button>
                  <button
                    onClick={() => handleResolve("upheld")}
                    disabled={isReadOnly || actionLoading || selectedAppeal.status === "UPHELD"}
                    className="px-4 py-2 rounded-full bg-[var(--status-escalate)] hover:bg-[#d43f44] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
                  >
                    Uphold Restriction
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
