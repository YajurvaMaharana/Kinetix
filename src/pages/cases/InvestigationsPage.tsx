import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { listCases, takeCaseAction, CaseItem } from "@/api/endpoints";
import {
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Lock,
  User,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Sparkles,
} from "lucide-react";

export default function InvestigationsPage() {
  const { role, canManageCases, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await listCases();
        setCases(data);
        if (data.length > 0) setSelectedCase(data[0]);
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Failed to load cases",
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const handleAction = async (actionType: "overturn" | "restrict") => {
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can adjudicate cases. Auditor role is read-only.",
      });
      return;
    }

    if (!selectedCase) return;

    setActionLoading(true);
    try {
      await takeCaseAction(selectedCase.case_id, {
        action: actionType,
        note: note || `Analyst ${role} marked case as ${actionType}.`,
      });

      const updatedStatus = actionType === "overturn" ? "RESOLVED_LEGIT" : "RESTRICTED";
      setCases((prev) =>
        prev.map((c) =>
          c.case_id === selectedCase.case_id ? { ...c, status: updatedStatus } : c
        )
      );
      setSelectedCase((prev) => (prev ? { ...prev, status: updatedStatus } : null));
      setNote("");

      showToast({
        type: actionType === "overturn" ? "success" : "error",
        title:
          actionType === "overturn"
            ? "Case Resolved (Overturned)"
            : "Courier Account Restricted",
        message: `Case ${selectedCase.case_id} adjudicated successfully. Audit trail logged.`,
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

  const filtered = cases.filter((c) => {
    if (tab === "OPEN") return c.status === "OPEN";
    if (tab === "IN_REVIEW") return c.status === "IN_REVIEW";
    if (tab === "RESOLVED") return c.status === "RESOLVED_LEGIT";
    if (tab === "RESTRICTED") return c.status === "RESTRICTED";
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Analyst Adjudication"
        title="Security Investigations Dossier"
        subtitle="Flagged courier sessions requiring triage, telemetry audit & manual adjudication"
        primaryAction={{
          label: "Assign Next Priority Case",
          icon: Sparkles,
          onClick: () => {
            showToast({
              type: "info",
              title: "Next Case Assigned",
              message: "Assigned high-severity spoofing case CASE-9004 to active desk.",
            });
          },
          disabled: isReadOnly,
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "ALL", label: "All Cases", count: cases.length },
          { id: "OPEN", label: "Open Triage", count: cases.filter((c) => c.status === "OPEN").length },
          { id: "IN_REVIEW", label: "In Review", count: cases.filter((c) => c.status === "IN_REVIEW").length },
          { id: "RESOLVED", label: "Resolved Legit" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {loading ? (
        <SkeletonLoader type="split" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No cases in this queue"
          description="All flagged courier sessions under this filter have been adjudicated."
        />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Cases Queue */}
          <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft space-y-2 h-[580px] overflow-y-auto">
            <div className="px-2 py-1 text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
              <span>Security Case Queue</span>
              <span className="font-mono text-[10px] text-[var(--primary)] font-bold">
                {filtered.length} Active
              </span>
            </div>

            {filtered.map((c) => {
              const isSelected = selectedCase?.case_id === c.case_id;
              return (
                <button
                  key={c.case_id}
                  onClick={() => setSelectedCase(c)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between group ${
                    isSelected
                      ? "bg-[var(--lavender)] border-[var(--primary)] shadow-sm"
                      : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)]">
                      {c.case_id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.severity === "CRITICAL"
                          ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                          : c.severity === "HIGH"
                          ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                          : "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                      }`}
                    >
                      {c.severity}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-xs text-[var(--ink)]">
                    {c.rider_name || `Courier ${c.rider_id}`}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] line-clamp-1 mt-0.5">
                    {c.threat_summary}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--muted)]">
                    <span>Status: <strong>{c.status}</strong></span>
                    <span className="font-mono font-bold text-[var(--status-escalate)]">
                      Risk: {c.risk_score}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Case Dossier & Analyst Action Drawer */}
          {selectedCase && (
            <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                      CASE FILE • {selectedCase.case_id}
                    </span>
                    <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
                      {selectedCase.rider_name || `Courier ${selectedCase.rider_id}`}
                    </h3>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedCase.status === "RESOLVED_LEGIT"
                        ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                        : selectedCase.status === "RESTRICTED"
                        ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                        : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                    }`}
                  >
                    {selectedCase.status}
                  </span>
                </div>

                {/* Threat Summary Card */}
                <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--status-escalate)] mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Telemetry Anomaly Signature</span>
                  </div>
                  <p className="text-xs text-[var(--ink)] leading-relaxed">
                    {selectedCase.threat_summary}
                  </p>
                </div>

                {/* Courier & Telemetry Details */}
                <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Rider Account</span>
                    <div className="font-bold text-[var(--ink)] mt-0.5">{selectedCase.rider_id}</div>
                    <div className="text-[10px] text-[var(--muted)]">Assigned: {selectedCase.assigned_to || "Unassigned"}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Calculated AI Risk</span>
                    <div className="font-bold text-[var(--status-escalate)] mt-0.5">{selectedCase.risk_score}%</div>
                    <div className="text-[10px] text-[var(--muted)]">Severity Tier: {selectedCase.severity}</div>
                  </div>
                </div>

                {/* Adjudication Notes Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[var(--ink)]">
                    Analyst Reviewer Note (Mandatory for audit trail):
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter evidence notes, secondary verification findings, or escalation rationale..."
                    className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--muted)]">
                  {isReadOnly ? "Auditor view (actions disabled)" : "Analyst / Admin adjudication"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction("overturn")}
                    disabled={isReadOnly || actionLoading}
                    className="px-4 py-2 rounded-full bg-[var(--status-allow)] hover:bg-[#28ab80] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
                  >
                    Resolve as Genuine (Lift Hold)
                  </button>
                  <button
                    onClick={() => handleAction("restrict")}
                    disabled={isReadOnly || actionLoading}
                    className="px-4 py-2 rounded-full bg-[var(--status-escalate)] hover:bg-[#d43f44] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
                  >
                    Confirm Fraud (Restrict)
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
