import React, { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  listAppeals,
  resolveAppeal,
  requestAppealMoreInfo,
  startReviewAppeal,
  AppealItem,
  AppealStatus,
  AppealEvidence,
  AppealRedressOptions,
} from "@/api/endpoints";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Search,
  RotateCcw,
  User,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
  HelpCircle,
  FileCode,
  Video,
  FileCheck2,
  DollarSign,
  Send,
  MessageSquare,
  Lock,
  ArrowRight,
  Eye,
  Check,
  X,
  PlusCircle,
  History,
  AlertTriangle,
} from "lucide-react";

// Helper to compute SLA countdown label and urgency
function getSLACountdown(deadlineIso: string, isResolved: boolean) {
  if (isResolved) {
    return {
      text: "SLA Met",
      urgent: false,
      breached: false,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    };
  }

  const diffMs = new Date(deadlineIso).getTime() - Date.now();
  if (diffMs <= 0) {
    const overdueMin = Math.abs(Math.floor(diffMs / 60000));
    const h = Math.floor(overdueMin / 60);
    const m = overdueMin % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return {
      text: `SLA Breached (-${timeStr})`,
      urgent: true,
      breached: true,
      color: "bg-rose-500/15 text-rose-600 border-rose-500/30 animate-pulse",
    };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return {
      text: `${minutes}m remaining`,
      urgent: true,
      breached: false,
      color: "bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold",
    };
  } else if (hours < 3) {
    return {
      text: `${hours}h ${minutes}m left`,
      urgent: true,
      breached: false,
      color: "bg-amber-500/10 text-amber-700 border-amber-500/25",
    };
  } else {
    return {
      text: `${hours}h ${minutes}m left`,
      urgent: false,
      breached: false,
      color: "bg-slate-500/10 text-slate-700 border-slate-500/20",
    };
  }
}

// Format date nicely
function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AppealsPage() {
  const { role, canManageCases, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "NEW" | "IN_REVIEW" | "AWAITING_RIDER" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState(false);
  const [evidenceModalItem, setEvidenceModalItem] = useState<AppealEvidence | null>(null);

  // Form states for modal actions
  const [redressOptions, setRedressOptions] = useState<AppealRedressOptions>({
    release_payout: true,
    restore_account: true,
    courtesy_credit: false,
  });
  const [approveNote, setApproveNote] = useState("");
  const [rejectReasonPreset, setRejectReasonPreset] = useState("Hardware root or mock location confirmed");
  const [rejectNote, setRejectNote] = useState("");
  const [infoQuestion, setInfoQuestion] = useState("");
  const [infoDeadlineHours, setInfoDeadlineHours] = useState(24);
  const [actionLoading, setActionLoading] = useState(false);

  // Refresh timer for SLA countdown ticker every 30 seconds
  const [, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTicker((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAppeals = useCallback(async () => {
    setLoading(true);
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
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAppealId, showToast]);

  useEffect(() => {
    loadAppeals();
  }, [loadAppeals]);

  // Selected appeal object
  const selectedAppeal = useMemo(() => {
    return appeals.find((a) => a.id === selectedAppealId) || appeals[0] || null;
  }, [appeals, selectedAppealId]);

  // Counts by status
  const counts = useMemo(() => {
    const res = {
      ALL: appeals.length,
      NEW: 0,
      IN_REVIEW: 0,
      AWAITING_RIDER: 0,
      RESOLVED: 0,
    };
    appeals.forEach((a) => {
      const normStatus = a.status === "PENDING" ? "NEW" : (a.status === "OVERTURNED" || a.status === "UPHELD") ? "RESOLVED" : a.status;
      if (normStatus === "NEW") res.NEW++;
      else if (normStatus === "IN_REVIEW") res.IN_REVIEW++;
      else if (normStatus === "AWAITING_RIDER") res.AWAITING_RIDER++;
      else if (normStatus === "RESOLVED") res.RESOLVED++;
    });
    return res;
  }, [appeals]);

  // Filtered appeals list
  const filteredAppeals = useMemo(() => {
    return appeals.filter((a) => {
      const normStatus = a.status === "PENDING" ? "NEW" : (a.status === "OVERTURNED" || a.status === "UPHELD") ? "RESOLVED" : a.status;
      if (statusFilter !== "ALL" && normStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = a.rider_name?.toLowerCase().includes(q);
        const matchesRiderId = a.rider_id?.toLowerCase().includes(q);
        const matchesId = a.id?.toLowerCase().includes(q);
        const matchesCase = a.case_id?.toLowerCase().includes(q);
        const matchesReason = a.reason?.toLowerCase().includes(q);
        if (!matchesName && !matchesRiderId && !matchesId && !matchesCase && !matchesReason) {
          return false;
        }
      }
      return true;
    });
  }, [appeals, statusFilter, searchQuery]);

  // Check permissions guard
  const verifyCanAdjudicate = () => {
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can adjudicate appeals and issue redress. Auditor role is strictly read-only.",
      });
      return false;
    }
    return true;
  };

  // 1. Approve with Redress Options
  const handleApprove = async () => {
    if (!verifyCanAdjudicate() || !selectedAppeal) return;
    setActionLoading(true);
    try {
      const updated = await resolveAppeal(selectedAppeal.id, {
        action: "approve",
        redress: redressOptions,
        note: approveNote || "Redress granted. Payout hold released and account standing restored.",
        actor: role ? `${role} Adjudicator` : "Risk Analyst",
      });

      setAppeals((prev) => prev.map((a) => (a.id === selectedAppeal.id ? updated : a)));
      setApproveModalOpen(false);
      setApproveNote("");

      showToast({
        type: "success",
        title: "Appeal Approved & Redress Executed",
        message: `Appeal ${selectedAppeal.id} approved. ${redressOptions.release_payout ? "Released escrow payout. " : ""}${redressOptions.restore_account ? "Courier restored to Active standing." : ""}`,
      });
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

  // 2. Reject with Reason
  const handleReject = async () => {
    if (!verifyCanAdjudicate() || !selectedAppeal) return;
    setActionLoading(true);
    try {
      const combinedReason = `${rejectReasonPreset}${rejectNote ? ` - ${rejectNote}` : ""}`;
      const updated = await resolveAppeal(selectedAppeal.id, {
        action: "reject",
        reason: combinedReason,
        note: rejectNote || "Sanction upheld after forensic evidence review.",
        actor: role ? `${role} Adjudicator` : "Risk Analyst",
      });

      setAppeals((prev) => prev.map((a) => (a.id === selectedAppeal.id ? updated : a)));
      setRejectModalOpen(false);
      setRejectNote("");

      showToast({
        type: "info",
        title: "Appeal Rejected",
        message: `Appeal ${selectedAppeal.id} rejected. Sanction and escrow hold maintained.`,
      });
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

  // 3. Request More Info
  const handleRequestInfo = async () => {
    if (!verifyCanAdjudicate() || !selectedAppeal) return;
    if (!infoQuestion.trim()) {
      showToast({
        type: "warning",
        title: "Question Required",
        message: "Please state what evidence or documentation the courier must upload.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const updated = await requestAppealMoreInfo(selectedAppeal.id, {
        question: infoQuestion,
        deadlineHours: infoDeadlineHours,
        actor: role ? `${role} Adjudicator` : "Risk Analyst",
      });

      setAppeals((prev) => prev.map((a) => (a.id === selectedAppeal.id ? updated : a)));
      setRequestInfoModalOpen(false);
      setInfoQuestion("");

      showToast({
        type: "info",
        title: "Information Requested",
        message: `Dispatch sent to courier ${selectedAppeal.rider_name || selectedAppeal.rider_id}. SLA extended by ${infoDeadlineHours} hours.`,
      });
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

  // Start Review (moves from NEW to IN_REVIEW)
  const handleStartReview = async () => {
    if (!verifyCanAdjudicate() || !selectedAppeal) return;
    setActionLoading(true);
    try {
      const updated = await startReviewAppeal(selectedAppeal.id, role ? `${role} Adjudicator` : "Risk Analyst");
      setAppeals((prev) => prev.map((a) => (a.id === selectedAppeal.id ? updated : a)));
      showToast({
        type: "info",
        title: "Triage In Progress",
        message: `Appeal ${selectedAppeal.id} moved to In Review queue.`,
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

  // Helper for status badge
  const renderStatusBadge = (status: AppealStatus) => {
    const norm = status === "PENDING" ? "NEW" : (status === "OVERTURNED" || status === "UPHELD") ? "RESOLVED" : status;
    switch (norm) {
      case "NEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-700 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
            New
          </span>
        );
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            In Review
          </span>
        );
      case "AWAITING_RIDER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-700 border border-sky-500/20">
            <Clock className="w-3 h-3 text-sky-600" />
            Awaiting Rider
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Dispute Resolution & Redress"
        title="Appeals & Courier Due Process"
        subtitle="Independent statutory appeals queue with explainable reason codes, telemetry evidence synthesis, and audit-verified redress."
        secondaryAction={{
          label: "Refresh Queue",
          icon: RotateCcw,
          onClick: loadAppeals,
          disabled: loading,
        }}
      />

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Appeals Queue (5 cols on lg) */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft p-4 space-y-4">
          {/* Header & Status Chips Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--primary)]" />
                <h2 className="text-sm font-bold text-[var(--ink)] uppercase tracking-wider">
                  Appeals Queue
                </h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--muted)]">
                {filteredAppeals.length} active
              </span>
            </div>

            {/* Status Chips Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-[var(--surface-alt)] rounded-xl border border-[var(--border)]">
              {(
                [
                  { id: "ALL", label: "All", count: counts.ALL },
                  { id: "NEW", label: "New", count: counts.NEW },
                  { id: "IN_REVIEW", label: "In Review", count: counts.IN_REVIEW },
                  { id: "AWAITING_RIDER", label: "Awaiting", count: counts.AWAITING_RIDER },
                  { id: "RESOLVED", label: "Resolved", count: counts.RESOLVED },
                ] as const
              ).map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? "bg-[var(--primary)]/10 text-[var(--primary)] font-extrabold"
                          : "bg-slate-200/80 text-slate-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search rider, case, or appeal ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Appeals List Cards */}
          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-3 py-2">
                <SkeletonLoader type="card" count={4} />
              </div>
            ) : filteredAppeals.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No appeals found"
                description={
                  searchQuery
                    ? "Try adjusting your search criteria."
                    : "No appeals currently match this status filter."
                }
              />
            ) : (
              filteredAppeals.map((appeal) => {
                const isSelected = selectedAppeal?.id === appeal.id;
                const isResolved =
                  appeal.status === "RESOLVED" ||
                  appeal.status === "OVERTURNED" ||
                  appeal.status === "UPHELD";
                const sla = getSLACountdown(appeal.sla_deadline, isResolved);

                return (
                  <div
                    key={appeal.id}
                    onClick={() => setSelectedAppealId(appeal.id)}
                    className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-[var(--surface)] border-[var(--primary)] ring-2 ring-[var(--primary)]/15 shadow-md"
                        : "bg-[var(--surface-alt)]/60 border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]"
                    }`}
                  >
                    {/* Top Row: Appeal ID, Status, SLA Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--ink)]">
                          {appeal.id}
                        </span>
                        {appeal.case_id && (
                          <span className="text-[10px] font-mono text-[var(--muted)]">
                            • {appeal.case_id}
                          </span>
                        )}
                      </div>

                      {/* Status Chip */}
                      <div>{renderStatusBadge(appeal.status)}</div>
                    </div>

                    {/* Rider Info & Hub */}
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                        <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>{appeal.rider_name || appeal.rider_id}</span>
                        <span className="text-[10px] font-mono text-[var(--muted)]">
                          ({appeal.rider_id})
                        </span>
                      </div>
                      {appeal.rider_hub && (
                        <span className="text-[10px] font-medium text-[var(--muted)] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {appeal.rider_hub}
                        </span>
                      )}
                    </div>

                    {/* Reason Snippet */}
                    <p className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed mb-2.5">
                      {appeal.statement || appeal.reason}
                    </p>

                    {/* Bottom Row: SLA Countdown & Held Amount */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60 text-[11px]">
                      {/* SLA Countdown pill */}
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${sla.color}`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{sla.text}</span>
                      </div>

                      {/* Escrow amount */}
                      {appeal.payout_held_amount && appeal.payout_held_amount > 0 && (
                        <div className="flex items-center gap-1 font-mono font-bold text-[var(--ink)]">
                          <DollarSign className="w-3 h-3 text-[var(--primary)]" />
                          <span>${appeal.payout_held_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} held</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Appeal Detail (7 cols on lg) */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedAppeal ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft p-12 text-center">
              <EmptyState
                icon={FileText}
                title="Select an appeal"
                description="Choose an appeal from the queue on the left to examine rider testimony, reason codes, evidence, and AI recommendations."
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Banner Card: ID, Status, Courier Header, Action Trigger Bar */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-lg font-black text-[var(--ink)]">
                        {selectedAppeal.id}
                      </span>
                      {renderStatusBadge(selectedAppeal.status)}
                      {selectedAppeal.case_id && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface-alt)] font-mono text-[var(--muted)]">
                          Case: {selectedAppeal.case_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      Submitted on {formatDate(selectedAppeal.created_at)}
                    </p>
                  </div>

                  {/* SLA Countdown & Priority */}
                  <div className="flex items-center gap-3">
                    {(() => {
                      const isResolved =
                        selectedAppeal.status === "RESOLVED" ||
                        selectedAppeal.status === "OVERTURNED" ||
                        selectedAppeal.status === "UPHELD";
                      const sla = getSLACountdown(selectedAppeal.sla_deadline, isResolved);
                      return (
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${sla.color}`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{sla.text}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Courier Profile Quick Strip */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    {selectedAppeal.rider_avatar ? (
                      <img
                        src={selectedAppeal.rider_avatar}
                        alt="Rider avatar"
                        className="w-10 h-10 rounded-full object-cover border border-[var(--border)] shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-sm">
                        {selectedAppeal.rider_name ? selectedAppeal.rider_name.charAt(0) : "R"}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {selectedAppeal.rider_name || "Courier"}
                      </div>
                      <div className="text-xs text-[var(--muted)] flex items-center gap-2">
                        <span className="font-mono">{selectedAppeal.rider_id}</span>
                        {selectedAppeal.rider_hub && <span>• {selectedAppeal.rider_hub} Hub</span>}
                      </div>
                    </div>
                  </div>

                  {/* Courier Stats */}
                  <div className="flex items-center gap-4 text-xs">
                    {selectedAppeal.rider_phone && (
                      <div className="flex items-center gap-1 text-[var(--muted)]">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{selectedAppeal.rider_phone}</span>
                      </div>
                    )}
                    {selectedAppeal.trips_completed && (
                      <div className="text-[var(--muted)]">
                        <span className="font-bold text-[var(--ink)]">{selectedAppeal.trips_completed}</span> trips
                      </div>
                    )}
                    {selectedAppeal.rider_rating && (
                      <div className="text-[var(--muted)]">
                        ⭐ <span className="font-bold text-[var(--ink)]">{selectedAppeal.rider_rating}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Action Button Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-[var(--muted)]">
                    {isReadOnly && (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                        <Lock className="w-3.5 h-3.5" /> Auditor Role (Read-only)
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Move to In Review if New */}
                    {selectedAppeal.status === "NEW" && (
                      <button
                        type="button"
                        onClick={handleStartReview}
                        disabled={actionLoading || isReadOnly}
                        className="px-3.5 py-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)] shadow-soft disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Start Triage</span>
                      </button>
                    )}

                    {/* Request More Info */}
                    <button
                      type="button"
                      onClick={() => setRequestInfoModalOpen(true)}
                      disabled={actionLoading || isReadOnly}
                      className="px-3.5 py-2 rounded-full border border-sky-500/30 bg-sky-500/10 text-xs font-bold text-sky-700 hover:bg-sky-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                      <span>Request More Info</span>
                    </button>

                    {/* Reject */}
                    <button
                      type="button"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={actionLoading || isReadOnly}
                      className="px-3.5 py-2 rounded-full border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-700 hover:bg-rose-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject (Uphold)</span>
                    </button>

                    {/* Approve with Redress */}
                    <button
                      type="button"
                      onClick={() => setApproveModalOpen(true)}
                      disabled={actionLoading || isReadOnly}
                      className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Approve with Redress</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 1: Rider's Statement */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                      Rider's Testimony & Statement
                    </h3>
                  </div>
                  <span className="text-[10px] text-[var(--muted)]">
                    Disputed Penalty
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--surface-alt)]/80 border border-[var(--border)] relative">
                  <div className="text-xs italic text-[var(--ink)] leading-relaxed relative z-10 font-medium">
                    "{selectedAppeal.statement || selectedAppeal.supporting_text || selectedAppeal.reason}"
                  </div>
                </div>

                {selectedAppeal.reason && (
                  <div className="text-xs text-[var(--muted)] flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--ink)]">Core grievance:</span>
                    <span>{selectedAppeal.reason}</span>
                  </div>
                )}
              </div>

              {/* SECTION 2: Original Decision with Reason Codes in Plain Language */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                      Original Sanction & Reason Codes (Plain Language)
                    </h3>
                  </div>
                  {selectedAppeal.original_decision?.decided_at && (
                    <span className="text-[10px] text-[var(--muted)]">
                      Sanctioned {formatDate(selectedAppeal.original_decision.decided_at)}
                    </span>
                  )}
                </div>

                {selectedAppeal.original_decision ? (
                  <div className="space-y-3">
                    {/* Sanction Summary Banner */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-bold text-amber-900">
                            {selectedAppeal.original_decision.sanction}
                          </div>
                          <div className="text-[11px] text-amber-700">
                            Type: {selectedAppeal.original_decision.decision_type}
                          </div>
                        </div>
                      </div>
                      {selectedAppeal.original_decision.payout_held_amount && (
                        <div className="text-right">
                          <span className="text-xs font-bold font-mono text-amber-900">
                            ${selectedAppeal.original_decision.payout_held_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <div className="text-[10px] text-amber-700">Escrow Held</div>
                        </div>
                      )}
                    </div>

                    {/* Reason Codes in Plain Language */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Triggered Statutory Reason Codes
                      </div>
                      {selectedAppeal.original_decision.reason_codes.map((rc) => (
                        <div
                          key={rc.code}
                          className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded">
                                {rc.code}
                              </span>
                              <span className="text-xs font-bold text-[var(--ink)]">
                                {rc.title}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--ink)]/80 leading-relaxed pl-1">
                              👉 {rc.plain_language}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                              rc.severity === "HIGH"
                                ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                : rc.severity === "MEDIUM"
                                ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {rc.severity} SEVERITY
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    Original decision reason codes unavailable for this historical case.
                  </p>
                )}
              </div>

              {/* SECTION 3: Uploaded Evidence */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-[var(--primary)]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                      Uploaded Evidence & Telemetry Attachments
                    </h3>
                  </div>
                  <span className="text-[10px] text-[var(--muted)]">
                    {selectedAppeal.uploaded_evidence?.length || 0} files submitted
                  </span>
                </div>

                {selectedAppeal.uploaded_evidence && selectedAppeal.uploaded_evidence.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedAppeal.uploaded_evidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-start gap-3 hover:border-[var(--primary)]/40 transition-all group"
                      >
                        <div className="p-2.5 rounded-lg bg-[var(--surface)] text-[var(--primary)] shadow-sm shrink-0">
                          {ev.type === "video" && <Video className="w-4 h-4 text-purple-600" />}
                          {ev.type === "document" && <FileText className="w-4 h-4 text-blue-600" />}
                          {ev.type === "image" && <Eye className="w-4 h-4 text-emerald-600" />}
                          {ev.type === "telemetry" && <FileCode className="w-4 h-4 text-amber-600" />}
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="text-xs font-bold text-[var(--ink)] truncate">
                            {ev.name}
                          </div>
                          <div className="text-[10px] text-[var(--muted)]">
                            {ev.size} • {ev.type.toUpperCase()}
                          </div>
                          <p className="text-[11px] text-[var(--ink)]/80 line-clamp-2 leading-tight">
                            {ev.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => setEvidenceModalItem(ev)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:underline pt-1"
                          >
                            <span>Inspect File</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] text-center text-xs text-[var(--muted)]">
                    No supplementary evidence files attached with this appeal.
                  </div>
                )}
              </div>

              {/* SECTION 4: AI Recommendation Card with Confidence */}
              <div className="bg-[var(--surface)] border-2 border-amber-500/30 rounded-2xl shadow-soft p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Sparkles className="w-32 h-32 text-amber-500" />
                </div>

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                        Autonomous AI Evidence Recommendation
                      </h3>
                      <p className="text-[10px] text-[var(--muted)]">
                        Grounded probabilistic synthesis across GPS, IMU accelerometer, and cell telemetry
                      </p>
                    </div>
                  </div>

                  {selectedAppeal.ai_recommendation && (
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-[var(--ink)]">
                        {selectedAppeal.ai_recommendation.confidence}%
                      </span>
                      <div className="text-[10px] text-[var(--muted)]">Confidence</div>
                    </div>
                  )}
                </div>

                {selectedAppeal.ai_recommendation ? (
                  <div className="space-y-3 relative z-10">
                    {/* Recommendation Verdict Banner */}
                    <div
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        selectedAppeal.ai_recommendation.verdict === "APPROVE_REDRESS"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900"
                          : selectedAppeal.ai_recommendation.verdict === "REJECT_UPHOLD"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-900"
                          : "bg-sky-500/10 border-sky-500/30 text-sky-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {selectedAppeal.ai_recommendation.verdict === "APPROVE_REDRESS" && (
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                        {selectedAppeal.ai_recommendation.verdict === "REJECT_UPHOLD" && (
                          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                        {selectedAppeal.ai_recommendation.verdict === "REQUEST_MORE_INFO" && (
                          <HelpCircle className="w-5 h-5 text-sky-600 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-extrabold uppercase tracking-wide">
                            {selectedAppeal.ai_recommendation.verdict_label}
                          </div>
                          <div className="text-[11px] opacity-90 mt-0.5">
                            {selectedAppeal.ai_recommendation.summary}
                          </div>
                        </div>
                      </div>

                      {/* Confidence Progress Meter */}
                      <div className="w-24 shrink-0 text-right">
                        <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              selectedAppeal.ai_recommendation.verdict === "APPROVE_REDRESS"
                                ? "bg-emerald-600"
                                : selectedAppeal.ai_recommendation.verdict === "REJECT_UPHOLD"
                                ? "bg-rose-600"
                                : "bg-sky-600"
                            }`}
                            style={{ width: `${selectedAppeal.ai_recommendation.confidence}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detailed Rationale */}
                    <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-xs text-[var(--ink)] leading-relaxed space-y-2">
                      <div className="font-bold text-[var(--ink)]">Synthesis Rationale:</div>
                      <p>{selectedAppeal.ai_recommendation.rationale}</p>
                    </div>

                    {/* Key Signals */}
                    {selectedAppeal.ai_recommendation.key_signals && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          Attested Supporting Signals
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {selectedAppeal.ai_recommendation.key_signals.map((sig, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] space-y-1 text-xs"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    sig.impact === "POSITIVE"
                                      ? "bg-emerald-500"
                                      : sig.impact === "NEGATIVE"
                                      ? "bg-rose-500"
                                      : "bg-slate-400"
                                  }`}
                                />
                                <span className="truncate">{sig.name}</span>
                              </div>
                              <p className="text-[10px] text-[var(--muted)] leading-tight">
                                {sig.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    AI evaluation pending for this appeal.
                  </p>
                )}
              </div>

              {/* SECTION 5: Audit Trail */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-soft p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[var(--primary)]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                      Statutory Audit Trail & Adjudication Log
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--muted)]">
                    {selectedAppeal.audit_trail?.length || 0} recorded events
                  </span>
                </div>

                {selectedAppeal.audit_trail && selectedAppeal.audit_trail.length > 0 ? (
                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
                    {selectedAppeal.audit_trail.map((log) => (
                      <div key={log.id} className="relative flex items-start gap-3 pl-7">
                        <div
                          className={`absolute left-1.5 top-1 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface)] ${
                            log.role === "ANALYST"
                              ? "bg-[var(--primary)]"
                              : log.role === "AI_COPILOT"
                              ? "bg-amber-500"
                              : log.role === "RIDER"
                              ? "bg-purple-500"
                              : "bg-slate-500"
                          }`}
                        />
                        <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-xs flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--ink)]">{log.actor}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  log.role === "ANALYST"
                                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                                    : log.role === "AI_COPILOT"
                                    ? "bg-amber-500/10 text-amber-700"
                                    : log.role === "RIDER"
                                    ? "bg-purple-500/10 text-purple-700"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {log.role}
                              </span>
                            </div>
                            <span className="text-[10px] text-[var(--muted)]">
                              {formatDate(log.timestamp)}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] font-semibold text-[var(--primary)]">
                            {log.action}
                          </div>
                          {log.note && (
                            <p className="text-[11px] text-[var(--ink)]/80 leading-relaxed">
                              {log.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No audit entries recorded yet.</p>
                )}
              </div>

              {/* Resolved Outcome Details (if applicable) */}
              {selectedAppeal.redress_applied && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Redress Executed & Case Concluded</span>
                  </div>
                  <div className="text-xs text-emerald-900 leading-relaxed">
                    This appeal was approved by{" "}
                    <span className="font-bold">{selectedAppeal.redress_applied.adjudicated_by || "Analyst"}</span> on{" "}
                    {formatDate(selectedAppeal.redress_applied.adjudicated_at || selectedAppeal.created_at)}.
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedAppeal.redress_applied.release_payout && (
                      <span className="px-2.5 py-1 rounded bg-white text-emerald-800 text-[11px] font-bold border border-emerald-200 shadow-sm flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Escrow Payout Released (${selectedAppeal.payout_held_amount?.toFixed(2) || "0.00"})
                      </span>
                    )}
                    {selectedAppeal.redress_applied.restore_account && (
                      <span className="px-2.5 py-1 rounded bg-white text-emerald-800 text-[11px] font-bold border border-emerald-200 shadow-sm flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Account Status Restored to Active
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedAppeal.rejection_reason && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Appeal Rejected - Sanction Maintained</span>
                  </div>
                  <p className="text-xs text-rose-900 leading-relaxed">
                    Reason: {selectedAppeal.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: Approve with Redress Options */}
      {/* ============================================================ */}
      {approveModalOpen && selectedAppeal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Approve Appeal & Grant Redress
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[var(--muted)]">
              Adjudicate appeal for <span className="font-bold text-[var(--ink)]">{selectedAppeal.rider_name || selectedAppeal.rider_id}</span> ({selectedAppeal.id}). Select all remedial statutory redress measures to apply:
            </div>

            {/* Redress Checkboxes */}
            <div className="space-y-3 p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] mb-1">
                Redress Options
              </div>

              {/* Option 1: Release Payout */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={redressOptions.release_payout}
                  onChange={(e) =>
                    setRedressOptions((prev) => ({ ...prev, release_payout: e.target.checked }))
                  }
                  className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <div className="text-xs">
                  <div className="font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors">
                    Release Escrow Payout (${selectedAppeal.payout_held_amount?.toFixed(2) || "0.00"})
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Disburses frozen balance immediately to courier's verified bank account.
                  </div>
                </div>
              </label>

              {/* Option 2: Restore Account */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={redressOptions.restore_account}
                  onChange={(e) =>
                    setRedressOptions((prev) => ({ ...prev, restore_account: e.target.checked }))
                  }
                  className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <div className="text-xs">
                  <div className="font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors">
                    Restore Account to Active Standing
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Clears temporary session locks, resets behavioral risk counters, and notifies courier.
                  </div>
                </div>
              </label>

              {/* Option 3: Courtesy Credit */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={redressOptions.courtesy_credit}
                  onChange={(e) =>
                    setRedressOptions((prev) => ({ ...prev, courtesy_credit: e.target.checked }))
                  }
                  className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <div className="text-xs">
                  <div className="font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors">
                    Issue Good-Faith Restitution Credit ($15.00)
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Optional platform courtesy bonus for false positive downtime.
                  </div>
                </div>
              </label>
            </div>

            {/* Note / Reviewer Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Adjudication Rationale & Notes (Logged to Audit Trail)
              </label>
              <textarea
                rows={3}
                placeholder="Enter justification for overturn (e.g. Verified tunnel GPS multipath with dashcam corroboration)..."
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 rounded-full border border-[var(--border)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? "Processing..." : "Confirm & Execute Redress"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: Reject Appeal (Uphold Sanction) */}
      {/* ============================================================ */}
      {rejectModalOpen && selectedAppeal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Reject Appeal & Uphold Sanction
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[var(--muted)]">
              Rejecting appeal <span className="font-bold text-[var(--ink)]">{selectedAppeal.id}</span> will uphold the disciplinary sanction and forfeit any frozen escrow funds.
            </div>

            {/* Preset Rejection Reasons */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Statutory Reason for Rejection
              </label>
              <select
                value={rejectReasonPreset}
                onChange={(e) => setRejectReasonPreset(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="Hardware root or mock location confirmed">
                  Hardware root or mock location provider confirmed in memory
                </option>
                <option value="Syndicate collusion ring association verified">
                  Syndicate collusion ring association verified via bipartite graph
                </option>
                <option value="Insufficient contradictory evidence provided">
                  Insufficient contradictory evidence provided to overturn telemetry
                </option>
                <option value="Impossible kinematic velocity confirmed by physics engine">
                  Impossible kinematic velocity confirmed by physics engine
                </option>
                <option value="Fraudulent order completion verified with merchant">
                  Fraudulent order completion verified with merchant
                </option>
              </select>
            </div>

            {/* Rejection Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Detailed Rejection Note (Visible to Courier in App)
              </label>
              <textarea
                rows={3}
                placeholder="Explain the technical or factual basis for upholding the sanction..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-full border border-[var(--border)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? "Processing..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: Request More Info */}
      {/* ============================================================ */}
      {requestInfoModalOpen && selectedAppeal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Request Additional Information from Courier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRequestInfoModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[var(--muted)]">
              Dispatch an official inquiry to <span className="font-bold text-[var(--ink)]">{selectedAppeal.rider_name || selectedAppeal.rider_id}</span>. This updates the appeal status to <span className="font-bold text-sky-700">Awaiting Rider</span> and extends the adjudication SLA deadline.
            </div>

            {/* Question Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Required Proof / Evidence Request
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Please upload unedited dashcam footage from 14:15 - 14:35 UTC or an itemized toll receipt..."
                value={infoQuestion}
                onChange={(e) => setInfoQuestion(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* Deadline Hours */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Rider Response Window
              </label>
              <div className="flex items-center gap-3">
                {[12, 24, 48, 72].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setInfoDeadlineHours(hours)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      infoDeadlineHours === hours
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {hours} Hours
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRequestInfoModalOpen(false)}
                className="px-4 py-2 rounded-full border border-[var(--border)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestInfo}
                disabled={actionLoading}
                className="px-5 py-2 rounded-full bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{actionLoading ? "Sending..." : "Dispatch Inquiry"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: Evidence Preview Modal */}
      {/* ============================================================ */}
      {evidenceModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-bold text-[var(--ink)] truncate max-w-sm">
                  {evidenceModalItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceModalItem(null)}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--ink)]">Type:</span>
                  <span className="font-mono uppercase">{evidenceModalItem.type}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--ink)]">Size:</span>
                  <span className="font-mono">{evidenceModalItem.size}</span>
                </div>
                <div className="text-xs pt-2 border-t border-[var(--border)] text-[var(--ink)] leading-relaxed">
                  <span className="font-bold">Summary:</span> {evidenceModalItem.description}
                </div>
              </div>

              {/* Visual simulated viewer */}
              {evidenceModalItem.type === "video" && (
                <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white space-y-2 p-6 text-center">
                  <Video className="w-10 h-10 text-purple-400" />
                  <div className="text-xs font-bold">1080p Front Dashcam Feed</div>
                  <div className="text-[11px] text-slate-400">
                    Embedded OBD-II Speedometer: 35.2 mph (constant velocity)
                  </div>
                </div>
              )}

              {evidenceModalItem.type === "image" && (
                <div className="aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-700 space-y-2 p-6 text-center border border-slate-200">
                  <Eye className="w-10 h-10 text-emerald-600" />
                  <div className="text-xs font-bold">High-Resolution Photo Attestation</div>
                  <div className="text-[11px] text-slate-500">
                    EXIF metadata confirmed: Capture time matches disputed session
                  </div>
                </div>
              )}

              {evidenceModalItem.type === "telemetry" && (
                <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                  <div>[GNSS_NMEA] SatConstellation: GPS (L1/L5), Galileo (E1/E5a)</div>
                  <div>[SNR_METRIC] Ingress Battery Tunnel: SNR dropped 42dB -&gt; 9dB</div>
                  <div>[ACCEL_IMU] Axis X: 0.02g, Axis Y: -0.01g, Axis Z: 0.98g (Steady transit)</div>
                  <div>[CARRIER_PHASE] Doppler drift calculated: 0.4 Hz/s</div>
                  <div>[VERDICT] Subterranean multipath artifact confirmed</div>
                </div>
              )}

              {evidenceModalItem.type === "document" && (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2 text-slate-700">
                  <FileText className="w-10 h-10 text-blue-600 mx-auto" />
                  <div className="text-xs font-bold">Verified Electronic Document</div>
                  <div className="text-[11px] text-slate-500">
                    Cryptographic signature from Port Authority Expressway Toll System
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setEvidenceModalItem(null)}
                className="px-4 py-2 rounded-full bg-[var(--primary)] text-white text-xs font-bold shadow-md"
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
