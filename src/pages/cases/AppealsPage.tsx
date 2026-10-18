import React, { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  listAppeals,
  approveAppeal,
  rejectAppeal,
  requestMoreInfoForAppeal,
  AppealItem,
  AppealStatus,
  AppealEvidence,
} from "@/api/endpoints";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  User,
  Smartphone,
  Video,
  FileCheck,
  FileCode,
  Image as ImageIcon,
  ExternalLink,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  History,
  Lock,
  Unlock,
  Check,
  X,
  Eye,
  SlidersHorizontal,
} from "lucide-react";

// SLA countdown formatter
function formatSlaCountdown(deadlineString: string): { text: string; urgent: boolean; overdue: boolean } {
  const diffMs = new Date(deadlineString).getTime() - Date.now();
  if (diffMs <= 0) {
    const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
    if (overdueMins < 60) return { text: `Overdue -${overdueMins}m`, urgent: true, overdue: true };
    const overdueHours = Math.floor(overdueMins / 60);
    return { text: `Overdue -${overdueHours}h`, urgent: true, overdue: true };
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) {
    return { text: `${diffMins}m left`, urgent: true, overdue: false };
  }
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return {
    text: `${diffHours}h ${remainingMins}m left`,
    urgent: diffHours < 2,
    overdue: false,
  };
}

export default function AppealsPage() {
  const { role, canManageCases, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | AppealStatus>("ALL");
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);

  // Modals for actions
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [previewEvidence, setPreviewEvidence] = useState<AppealEvidence | null>(null);

  // Form states for modals
  const [redressOptions, setRedressOptions] = useState({
    release_payout: true,
    restore_account: true,
  });
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("Insufficient Evidence");
  const [rejectNote, setRejectNote] = useState("");
  const [infoRequestText, setInfoRequestText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Load appeals from backend
  const fetchAppeals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listAppeals();
      setAppeals(data);
      if (data.length > 0 && !selectedAppealId) {
        setSelectedAppealId(data[0].id);
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to load appeals",
        message: err.message || "Network error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedAppealId, showToast]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  // Selected Appeal
  const selectedAppeal = useMemo(() => {
    return appeals.find((a) => a.id === selectedAppealId) || appeals[0] || null;
  }, [appeals, selectedAppealId]);

  // Filtered queue
  const filteredAppeals = useMemo(() => {
    if (statusFilter === "ALL") return appeals;
    return appeals.filter((a) => a.status === statusFilter);
  }, [appeals, statusFilter]);

  // Action: Handle Approve
  const handleApprove = async () => {
    if (!selectedAppeal) return;
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Auditor role cannot approve appeals.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const updated = await approveAppeal(
        selectedAppeal.id,
        {
          release_payout: redressOptions.release_payout,
          restore_account: redressOptions.restore_account,
          note: approveNote || "Appeal approved following evidence review.",
        },
        role === "Admin" ? "System Admin" : "Lead Analyst"
      );

      setAppeals((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showToast({
        type: "success",
        title: "Appeal Approved",
        message: `Appeal ${selectedAppeal.id} approved. Redress dispatched: ${[
          redressOptions.release_payout ? "Payout Released" : null,
          redressOptions.restore_account ? "Account Restored" : null,
        ]
          .filter(Boolean)
          .join(", ")}.`,
      });
      setShowApproveModal(false);
      setApproveNote("");
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Approval Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Handle Reject
  const handleReject = async () => {
    if (!selectedAppeal) return;
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Auditor role cannot reject appeals.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const updated = await rejectAppeal(
        selectedAppeal.id,
        rejectReason,
        rejectNote.trim() || "Evidence provided failed to contradict telemetric records.",
        role === "Admin" ? "System Admin" : "Lead Analyst"
      );

      setAppeals((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showToast({
        type: "error",
        title: "Appeal Rejected",
        message: `Appeal ${selectedAppeal.id} upheld enforcement. Rejection rationale recorded.`,
      });
      setShowRejectModal(false);
      setRejectNote("");
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Rejection Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Handle Request More Info
  const handleRequestMoreInfo = async () => {
    if (!selectedAppeal) return;
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Auditor role cannot request additional info.",
      });
      return;
    }

    if (!infoRequestText.trim()) return;

    setActionLoading(true);
    try {
      const updated = await requestMoreInfoForAppeal(
        selectedAppeal.id,
        infoRequestText.trim(),
        role === "Admin" ? "System Admin" : "Lead Analyst"
      );

      setAppeals((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showToast({
        type: "info",
        title: "Information Requested",
        message: `Request dispatched to courier ${selectedAppeal.rider_id}. Status set to Awaiting Rider.`,
      });
      setShowRequestInfoModal(false);
      setInfoRequestText("");
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Request Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for evidence icon
  const getEvidenceIcon = (type: AppealEvidence["type"]) => {
    switch (type) {
      case "video":
        return <Video className="w-4 h-4 text-rose-500" />;
      case "pdf":
        return <FileCheck className="w-4 h-4 text-emerald-600" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-blue-500" />;
      case "log":
        return <FileCode className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Redress & Due Process"
        title="Appeals & Dispute Adjudication"
        subtitle="Review courier dispute statements, examine uploaded sensor evidence, and apply statutory redress"
        secondaryAction={{
          label: refreshing ? "Refreshing..." : "Refresh Appeals",
          icon: RefreshCw,
          onClick: () => fetchAppeals(true),
        }}
        primaryAction={{
          label: "Adjudicate Next In SLA",
          icon: Sparkles,
          onClick: () => {
            const nextUrgent = appeals.find((a) => a.status === "NEW" || a.status === "IN_REVIEW");
            if (nextUrgent) {
              setSelectedAppealId(nextUrgent.id);
              showToast({
                type: "info",
                title: "Selected High-Priority Appeal",
                message: `${nextUrgent.id} loaded into adjudication console.`,
              });
            }
          },
          disabled: isReadOnly,
        }}
      />

      {/* Segmented Filter Control */}
      <SegmentedTabs
        tabs={[
          { id: "ALL", label: "All Appeals", count: appeals.length },
          { id: "NEW", label: "New", count: appeals.filter((a) => a.status === "NEW").length },
          { id: "IN_REVIEW", label: "In Review", count: appeals.filter((a) => a.status === "IN_REVIEW").length },
          { id: "AWAITING_RIDER", label: "Awaiting Rider", count: appeals.filter((a) => a.status === "AWAITING_RIDER").length },
          { id: "RESOLVED", label: "Resolved", count: appeals.filter((a) => a.status === "RESOLVED").length },
        ]}
        activeTab={statusFilter}
        onChange={(id) => setStatusFilter(id as any)}
      />

      {loading ? (
        <SkeletonLoader type="split" />
      ) : filteredAppeals.length === 0 ? (
        <EmptyState
          title="No appeals in this queue"
          description="All courier submissions under this filter status have been resolved or triaged."
        />
      ) : (
        /* =========================================================================
            SPLIT VIEW: Left (5/12) Appeals Queue + Right (7/12) Appeal Dossier
           ========================================================================= */
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Appeals Queue */}
          <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft space-y-3 max-h-[780px] overflow-y-auto">
            <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
              <span>Appeals Docket</span>
              <span className="font-mono text-[10px] text-[var(--primary)] font-bold">
                {filteredAppeals.length} Items
              </span>
            </div>

            {filteredAppeals.map((appeal) => {
              const isSelected = selectedAppeal?.id === appeal.id;
              const sla = formatSlaCountdown(appeal.sla_deadline);

              return (
                <button
                  key={appeal.id}
                  onClick={() => setSelectedAppealId(appeal.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                    isSelected
                      ? "bg-[var(--lavender)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/50"
                      : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  {/* Top Bar: Appeal ID + Status Chip + SLA */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--ink)]">
                        {appeal.id}
                      </span>
                      {/* Status Chip */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          appeal.status === "NEW"
                            ? "bg-amber-500/15 text-amber-700"
                            : appeal.status === "IN_REVIEW"
                            ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                            : appeal.status === "AWAITING_RIDER"
                            ? "bg-blue-500/15 text-blue-700"
                            : appeal.resolution === "APPROVED"
                            ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                            : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                        }`}
                      >
                        {appeal.status === "RESOLVED"
                          ? appeal.resolution === "APPROVED"
                            ? "Resolved (Approved)"
                            : "Resolved (Rejected)"
                          : appeal.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* SLA Countdown Chip */}
                    <div
                      className={`flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        appeal.status === "RESOLVED"
                          ? "bg-[var(--surface)] text-[var(--muted)]"
                          : sla.overdue
                          ? "bg-[var(--status-escalate)] text-white"
                          : sla.urgent
                          ? "bg-amber-500/20 text-amber-800"
                          : "bg-[var(--surface)] text-[var(--muted)]"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{appeal.status === "RESOLVED" ? "Resolved" : sla.text}</span>
                    </div>
                  </div>

                  {/* Courier & Incident Title */}
                  <div className="font-extrabold text-xs text-[var(--ink)]">
                    {appeal.rider_name} • <span className="font-mono text-[var(--muted)]">{appeal.rider_id}</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-1 leading-relaxed">
                    {appeal.reason}
                  </p>

                  {/* Bottom Footer: Held Amount & Evidence Count */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--muted)]">
                    <span>
                      Held: <strong className="font-mono text-[var(--ink)]">${appeal.original_decision.held_amount.toFixed(2)}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <FileText className="w-3 h-3" />
                      <span>{appeal.uploaded_evidence.length} Evidence Docs</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Appeal Detail Dossier */}
          {selectedAppeal && (
            <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                {/* Dossier Header */}
                <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)]">
                        {selectedAppeal.id}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          selectedAppeal.status === "RESOLVED"
                            ? selectedAppeal.resolution === "APPROVED"
                              ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                              : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                            : selectedAppeal.status === "AWAITING_RIDER"
                            ? "bg-blue-500/15 text-blue-700"
                            : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                        }`}
                      >
                        {selectedAppeal.status === "RESOLVED"
                          ? `Resolved: ${selectedAppeal.resolution}`
                          : selectedAppeal.status.replace("_", " ")}
                      </span>
                      {selectedAppeal.case_id && (
                        <span className="text-[10px] font-mono text-[var(--muted)]">
                          Linked: {selectedAppeal.case_id}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-extrabold text-[var(--ink)]">
                      {selectedAppeal.reason}
                    </h3>
                    <div className="text-xs text-[var(--muted)] mt-1 flex items-center gap-2">
                      <span>Courier: <strong className="text-[var(--ink)]">{selectedAppeal.rider_name}</strong></span>
                      <span>•</span>
                      <span>Phone: <strong className="font-mono text-[var(--ink)]">{selectedAppeal.rider_phone || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Hub: <strong className="text-[var(--ink)]">{selectedAppeal.rider_hub || "Metro Core"}</strong></span>
                    </div>
                  </div>

                  {/* SLA Badge in Detail */}
                  <div className="text-right">
                    <span className="block text-[10px] text-[var(--muted)] uppercase font-bold">
                      SLA Target
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--primary)]">
                      {formatSlaCountdown(selectedAppeal.sla_deadline).text}
                    </span>
                  </div>
                </div>

                {/* 1. RIDER'S STATEMENT */}
                <div className="p-4 rounded-xl bg-[var(--lavender)]/40 border border-[var(--primary)]/20 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]">
                    <User className="w-4 h-4" />
                    <span>Courier Formal Statement:</span>
                  </div>
                  <p className="text-xs text-[var(--ink)] leading-relaxed italic bg-[var(--surface)] p-3 rounded-lg border border-[var(--border-subtle)]">
                    "{selectedAppeal.rider_statement}"
                  </p>
                </div>

                {/* 2. ORIGINAL DECISION & PLAIN LANGUAGE REASON CODES */}
                <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--status-escalate)]">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Original Automated Enforcement: {selectedAppeal.original_decision.enforcement_title}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--status-escalate)]">
                      Held: ${selectedAppeal.original_decision.held_amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Enforced Statutory Reason Codes (Plain Language):
                    </span>
                    <div className="space-y-1.5">
                      {selectedAppeal.original_decision.reason_codes.map((rc) => (
                        <div
                          key={rc.code}
                          className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-xs"
                        >
                          <span className="font-mono font-extrabold text-[10px] px-1.5 py-0.5 rounded bg-[var(--status-escalate)]/15 text-[var(--status-escalate)] shrink-0 mt-0.5">
                            {rc.code}
                          </span>
                          <div>
                            <strong className="block text-[var(--ink)] text-[11px] font-bold">
                              {rc.title}
                            </strong>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                              {rc.plain_language}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. UPLOADED EVIDENCE */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                    <span>Uploaded Evidence ({selectedAppeal.uploaded_evidence.length})</span>
                    <span className="text-[10px] text-[var(--muted)]">Cryptographically hashed attachments</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {selectedAppeal.uploaded_evidence.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setPreviewEvidence(ev)}
                        className="p-3 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] hover:border-[var(--primary)] cursor-pointer transition-all space-y-1.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-6 h-6 rounded-lg bg-[var(--surface)] flex items-center justify-center">
                            {getEvidenceIcon(ev.type)}
                          </div>
                          <span className="text-[10px] font-mono text-[var(--muted)]">
                            {ev.size}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-[var(--ink)] truncate group-hover:text-[var(--primary)] transition-colors">
                          {ev.name}
                        </div>
                        <p className="text-[10px] text-[var(--muted)] line-clamp-1">
                          {ev.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. AI RECOMMENDATION CARD WITH CONFIDENCE */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    selectedAppeal.ai_recommendation.verdict === "APPROVE"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : selectedAppeal.ai_recommendation.verdict === "REJECT"
                      ? "bg-rose-500/10 border-rose-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
                        SchemeSetu AI Copilot Recommendation
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                          selectedAppeal.ai_recommendation.verdict === "APPROVE"
                            ? "bg-[var(--status-allow)] text-white"
                            : selectedAppeal.ai_recommendation.verdict === "REJECT"
                            ? "bg-[var(--status-escalate)] text-white"
                            : "bg-[var(--status-challenge)] text-white"
                        }`}
                      >
                        {selectedAppeal.ai_recommendation.verdict}
                      </span>
                      <span className="text-xs font-mono font-bold text-[var(--ink)]">
                        {selectedAppeal.ai_recommendation.confidence}% Confidence
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--ink)] leading-relaxed font-medium">
                    {selectedAppeal.ai_recommendation.rationale}
                  </p>

                  <div className="pt-2 border-t border-black/10 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                      Suggested Redress Actions:
                    </span>
                    <ul className="text-[11px] text-[var(--ink)] list-disc list-inside space-y-0.5">
                      {selectedAppeal.ai_recommendation.suggested_redress.map((sr, idx) => (
                        <li key={idx}>{sr}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 5. AUDIT TRAIL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                    <span>Audit Trail ({selectedAppeal.audit_trail.length})</span>
                    <span className="text-[10px] font-mono text-[var(--muted)]">Tamper-evident log</span>
                  </div>

                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {selectedAppeal.audit_trail.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-xs flex items-start justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-[var(--ink)] font-bold">{entry.actor}</strong>
                            <span className="text-[10px] font-mono text-[var(--muted)]">({entry.role})</span>
                          </div>
                          <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                            {entry.action}
                          </p>
                          {entry.note && (
                            <p className="text-[10px] text-[var(--primary)] mt-0.5 italic">
                              "{entry.note}"
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[var(--muted)] shrink-0">
                          {entry.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 mt-4">
                <span className="text-[11px] text-[var(--muted)]">
                  {isReadOnly ? "Auditor view (actions read-only)" : "Analyst adjudication desk"}
                </span>

                <div className="flex items-center gap-2">
                  {/* Request More Info Button */}
                  <button
                    onClick={() => setShowRequestInfoModal(true)}
                    disabled={isReadOnly || actionLoading || selectedAppeal.status === "RESOLVED"}
                    className="px-3.5 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--ink)] text-xs font-bold border border-[var(--border)] transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[var(--status-challenge)]" />
                    <span>Request More Info</span>
                  </button>

                  {/* Reject Button */}
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={isReadOnly || actionLoading || selectedAppeal.status === "RESOLVED"}
                    className="px-4 py-2 rounded-full bg-[var(--status-escalate)] hover:opacity-90 text-white text-xs font-bold shadow-soft transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Appeal</span>
                  </button>

                  {/* Approve Button */}
                  <button
                    onClick={() => setShowApproveModal(true)}
                    disabled={isReadOnly || actionLoading || selectedAppeal.status === "RESOLVED"}
                    className="px-4 py-2 rounded-full bg-[var(--status-allow)] hover:opacity-90 text-white text-xs font-bold shadow-soft transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Appeal</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: APPROVE APPEAL WITH REDRESS OPTIONS
         ========================================================================= */}
      {showApproveModal && selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowApproveModal(false)} />
          <div className="relative bg-[var(--surface)] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--border)] space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--status-allow)]" />
                <h3 className="text-lg font-extrabold text-[var(--ink)]">
                  Approve Appeal & Grant Redress
                </h3>
              </div>
              <button
                onClick={() => setShowApproveModal(false)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              You are overturning the enforcement for appeal <strong>{selectedAppeal.id}</strong>. Select the statutory redress options to execute automatically:
            </p>

            {/* Redress Options Checkboxes */}
            <div className="space-y-3 p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redressOptions.release_payout}
                  onChange={(e) => setRedressOptions((prev) => ({ ...prev, release_payout: e.target.checked }))}
                  className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)] w-4 h-4"
                />
                <div>
                  <span className="font-bold text-xs text-[var(--ink)] block">
                    Release Held Payout (${selectedAppeal.original_decision.held_amount.toFixed(2)})
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    Unlocks escrowed earnings directly to courier's verified bank routing.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-[var(--border-subtle)]">
                <input
                  type="checkbox"
                  checked={redressOptions.restore_account}
                  onChange={(e) => setRedressOptions((prev) => ({ ...prev, restore_account: e.target.checked }))}
                  className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)] w-4 h-4"
                />
                <div>
                  <span className="font-bold text-xs text-[var(--ink)] block">
                    Restore Account Standing & Whitelist Route
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    Lifts dispatch restriction and resets velocity trust penalties.
                  </span>
                </div>
              </label>
            </div>

            {/* Reviewer Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Adjudication Rationale Note (Appended to Audit Trail):
              </label>
              <textarea
                rows={3}
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Enter justification (e.g., dashcam corroborated tunnel multipath)..."
                className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--ink)] text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading || (!redressOptions.release_payout && !redressOptions.restore_account)}
                className="px-5 py-2 rounded-full bg-[var(--status-allow)] hover:opacity-90 text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
              >
                {actionLoading ? "Executing Redress..." : "Confirm & Execute Redress"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: REJECT APPEAL
         ========================================================================= */}
      {showRejectModal && selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          <div className="relative bg-[var(--surface)] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--border)] space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-[var(--status-escalate)]" />
                <h3 className="text-lg font-extrabold text-[var(--ink)]">
                  Reject Appeal & Uphold Enforcement
                </h3>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Confirming this rejection maintains the suspension on courier <strong>{selectedAppeal.rider_id}</strong> and continues payout hold in escrow.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--ink)] block mb-1">
                  Primary Rejection Reason:
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--ink)] font-bold focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="Insufficient Evidence">Insufficient Evidence</option>
                  <option value="Evidence Inconsistent with Carrier Logs">Evidence Inconsistent with Carrier Logs</option>
                  <option value="Confirmed Sybil / Device Farm Syndicate">Confirmed Sybil / Device Farm Syndicate</option>
                  <option value="Synthetic Order Acceptance Replay">Synthetic Order Acceptance Replay</option>
                  <option value="Unsatisfactory Biometric Attestation">Unsatisfactory Biometric Attestation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink)] block mb-1">
                  Detailed Adjudication Note:
                </label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain why evidence does not override sensor telemetry..."
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--ink)] text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-5 py-2 rounded-full bg-[var(--status-escalate)] hover:opacity-90 text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: REQUEST MORE INFORMATION
         ========================================================================= */}
      {showRequestInfoModal && selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRequestInfoModal(false)} />
          <div className="relative bg-[var(--surface)] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--border)] space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[var(--status-challenge)]" />
                <h3 className="text-lg font-extrabold text-[var(--ink)]">
                  Request Additional Evidence from Courier
                </h3>
              </div>
              <button
                onClick={() => setShowRequestInfoModal(false)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Dispatches an automated push notification and SMS prompt to courier <strong>{selectedAppeal.rider_id}</strong>. The SLA window will be extended by 24 hours while awaiting submission.
            </p>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Quick Request Templates:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Merchant order pickup paper receipt",
                  "Front dashcam video footage (14:15 - 14:30 UTC)",
                  "Electronic toll or parking transponder record",
                  "Secondary device purchase or family plan receipt",
                ].map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setInfoRequestText(template)}
                    className="px-2.5 py-1 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-[11px] text-[var(--ink)] transition-colors"
                  >
                    + {template}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Request Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Evidence Specification for Courier:
              </label>
              <textarea
                rows={3}
                value={infoRequestText}
                onChange={(e) => setInfoRequestText(e.target.value)}
                placeholder="Specify the exact documentation or logs required..."
                className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRequestInfoModal(false)}
                className="px-4 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--ink)] text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestMoreInfo}
                disabled={actionLoading || !infoRequestText.trim()}
                className="px-5 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-soft transition-all disabled:opacity-50"
              >
                {actionLoading ? "Sending Prompt..." : "Send Request to Rider"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: EVIDENCE ATTACHMENT PREVIEW
         ========================================================================= */}
      {previewEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewEvidence(null)} />
          <div className="relative bg-[var(--surface)] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--border)] space-y-4 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                {getEvidenceIcon(previewEvidence.type)}
                <h3 className="text-base font-extrabold text-[var(--ink)] truncate max-w-xs">
                  {previewEvidence.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewEvidence(null)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">File Type:</span>
                <span className="font-mono font-bold uppercase text-[var(--ink)]">{previewEvidence.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">File Size:</span>
                <span className="font-mono font-bold text-[var(--ink)]">{previewEvidence.size}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">Recorded Timestamp:</span>
                <span className="font-mono text-[var(--ink)]">{previewEvidence.timestamp}</span>
              </div>
              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[var(--muted)] block mb-1">Analyst Annotation:</span>
                <p className="text-[var(--ink)] font-medium leading-relaxed">{previewEvidence.description}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewEvidence(null)}
                className="px-4 py-2 rounded-full bg-[var(--primary)] text-white text-xs font-bold shadow-soft"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
