import React, { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  listCases,
  updateCase,
  addCaseNote,
  freezeCasePayout,
  requestCaseLiveness,
  closeCaseWithOutcome,
  CaseItem,
  CaseStatus,
} from "@/api/endpoints";
import {
  FolderKanban,
  Table as TableIcon,
  Search,
  Filter,
  ArrowUpDown,
  User,
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Camera,
  FileText,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Smartphone,
  CreditCard,
  ArrowRight,
  RefreshCw,
  Flame,
  Activity,
  History,
  AlertCircle,
  GripVertical,
} from "lucide-react";

// Available Analysts for assignment
const ANALYSTS = [
  { id: "marcus_vance", name: "Marcus Vance", role: "Lead Analyst" },
  { id: "elena_rostova", name: "Elena Rostova", role: "Senior Fraud Analyst" },
  { id: "sarah_chen", name: "Sarah Chen", role: "Risk Specialist" },
  { id: "david_zhang", name: "David Zhang", role: "Device Forensics" },
];

// Helper to format age
function formatAge(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Columns definition for Kanban Board
const BOARD_COLUMNS: { id: CaseStatus; title: string; color: string; badgeBg: string }[] = [
  { id: "OPEN", title: "Open", color: "var(--status-challenge)", badgeBg: "bg-[var(--status-challenge)]/15" },
  { id: "IN_REVIEW", title: "In Review", color: "var(--primary)", badgeBg: "bg-[var(--primary)]/15" },
  { id: "ESCALATED", title: "Escalated", color: "var(--status-escalate)", badgeBg: "bg-[var(--status-escalate)]/15" },
  { id: "CLOSED", title: "Closed", color: "var(--status-allow)", badgeBg: "bg-[var(--status-allow)]/15" },
];

export default function InvestigationsPage() {
  const { role, canManageCases, isReadOnly } = useAuth();
  const { showToast } = useToast();

  // Primary view mode: "board" | "table"
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  // Cases state
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected case for wide right drawer
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"summary" | "evidence" | "timeline" | "notes">("summary");

  // Drawer action states
  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState<"fraud_confirmed" | "false_positive" | null>(null);
  const [closeNoteText, setCloseNoteText] = useState("");

  // Table view filters, sorting, and pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"case_id" | "risk_score" | "created_at" | "rider_name">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Drag and Drop state for Board
  const [draggedCaseId, setDraggedCaseId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CaseStatus | null>(null);

  // Load cases from backend
  const fetchCases = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listCases();
      setCases(data);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to load cases",
        message: err.message || "Network error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Selected Case Object
  const selectedCase = useMemo(() => {
    return cases.find((c) => c.case_id === selectedCaseId) || null;
  }, [cases, selectedCaseId]);

  // Filtered and Sorted Cases for Table
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = c.case_id.toLowerCase().includes(q);
        const matchRider = (c.rider_name || "").toLowerCase().includes(q) || c.rider_id.toLowerCase().includes(q);
        const matchTitle = (c.title || c.threat_summary || "").toLowerCase().includes(q);
        if (!matchId && !matchRider && !matchTitle) return false;
      }
      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "CLOSED") {
          if (c.status !== "CLOSED" && c.status !== "RESOLVED_LEGIT" && c.status !== "RESTRICTED") return false;
        } else if (c.status !== statusFilter) {
          return false;
        }
      }
      // Severity filter
      if (severityFilter !== "ALL" && c.severity !== severityFilter) return false;
      // Assignee filter
      if (assigneeFilter !== "ALL") {
        if (assigneeFilter === "UNASSIGNED" && c.assigned_to) return false;
        if (assigneeFilter !== "UNASSIGNED" && c.assigned_to !== assigneeFilter) return false;
      }
      return true;
    });
  }, [cases, searchQuery, statusFilter, severityFilter, assigneeFilter]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      let valA: any = a[sortField] || "";
      let valB: any = b[sortField] || "";
      if (sortField === "created_at") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredCases, sortField, sortDirection]);

  // Paginated cases
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedCases.slice(startIndex, startIndex + pageSize);
  }, [sortedCases, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedCases.length / pageSize));

  // Handle Sort Change
  const toggleSort = (field: "case_id" | "risk_score" | "created_at" | "rider_name") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Helper for status normalization in board columns
  const getCasesForColumn = (columnId: CaseStatus) => {
    return cases.filter((c) => {
      if (columnId === "CLOSED") {
        return c.status === "CLOSED" || c.status === "RESOLVED_LEGIT" || c.status === "RESTRICTED";
      }
      return c.status === columnId;
    });
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, caseId: string) => {
    e.dataTransfer.setData("text/plain", caseId);
    setDraggedCaseId(caseId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: CaseStatus) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: CaseStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const caseId = e.dataTransfer.getData("text/plain") || draggedCaseId;
    setDraggedCaseId(null);

    if (!caseId) return;

    const targetCase = cases.find((c) => c.case_id === caseId);
    if (!targetCase || targetCase.status === targetColumn) return;

    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Auditor role is read-only. Only Analysts and Admins can move case status.",
      });
      return;
    }

    // Optimistic UI update
    setCases((prev) =>
      prev.map((c) => (c.case_id === caseId ? { ...c, status: targetColumn } : c))
    );

    try {
      await updateCase(caseId, { status: targetColumn });
      showToast({
        type: "success",
        title: "Status Updated",
        message: `${caseId} moved to ${targetColumn.replace("_", " ")}.`,
      });
    } catch (err: any) {
      // Revert on failure
      setCases((prev) =>
        prev.map((c) => (c.case_id === caseId ? { ...c, status: targetCase.status } : c))
      );
      showToast({
        type: "error",
        title: "Move Failed",
        message: err.message || "Failed to update case status on backend.",
      });
    }
  };

  // Drawer Actions: Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newNoteText.trim()) return;

    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Auditor role cannot add notes.",
      });
      return;
    }

    setSubmittingNote(true);
    try {
      const updated = await addCaseNote(
        selectedCase.case_id,
        newNoteText.trim(),
        role === "Admin" ? "System Admin" : "Lead Analyst",
        role || "Analyst"
      );
      setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
      setNewNoteText("");
      showToast({
        type: "success",
        title: "Note Recorded",
        message: "Audit note appended to case history.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to Add Note",
        message: err.message,
      });
    } finally {
      setSubmittingNote(false);
    }
  };

  // Drawer Actions: Assign Case
  const handleAssignChange = async (newAssigneeId: string) => {
    if (!selectedCase) return;
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Auditor role cannot reassign cases.",
      });
      return;
    }

    const assignedValue = newAssigneeId === "unassigned" ? null : newAssigneeId;
    const assigneeName = ANALYSTS.find((a) => a.id === newAssigneeId)?.name || "Unassigned";

    setActionLoading(true);
    try {
      const updated = await updateCase(selectedCase.case_id, { assigned_to: assignedValue });
      setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
      showToast({
        type: "info",
        title: "Assignee Updated",
        message: `${selectedCase.case_id} assigned to ${assigneeName}.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to Reassign",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Drawer Actions: Toggle Payout Freeze
  const handleTogglePayoutFreeze = async () => {
    if (!selectedCase) return;
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can freeze/unfreeze payouts.",
      });
      return;
    }

    const nextFreezeState = !selectedCase.payout_frozen;
    setActionLoading(true);
    try {
      const updated = await freezeCasePayout(selectedCase.case_id, nextFreezeState);
      setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
      showToast({
        type: nextFreezeState ? "warning" : "success",
        title: nextFreezeState ? "Payout Frozen" : "Payout Unfrozen",
        message: nextFreezeState
          ? `$${selectedCase.payout_held?.toFixed(2) || "0.00"} locked in escrow.`
          : "Payout hold released to courier wallet.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Payout Action Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Drawer Actions: Request 3D Liveness
  const handleRequestLiveness = async () => {
    if (!selectedCase) return;
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Analysts and Admins can request liveness verification.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const updated = await requestCaseLiveness(selectedCase.case_id);
      setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
      showToast({
        type: "info",
        title: "Liveness Challenge Dispatched",
        message: `High-assurance 3D face prompt sent to courier ${selectedCase.rider_id}.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Challenge Dispatch Failed",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Drawer Actions: Close Case with Outcome
  const handleCloseCase = async () => {
    if (!selectedCase || !showCloseModal) return;
    if (!canManageCases || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Auditor role cannot close cases.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const updated = await closeCaseWithOutcome(
        selectedCase.case_id,
        showCloseModal,
        closeNoteText.trim() || `Adjudicated as ${showCloseModal.replace("_", " ")}.`,
        role === "Admin" ? "System Admin" : "Lead Analyst"
      );
      setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
      showToast({
        type: showCloseModal === "fraud_confirmed" ? "error" : "success",
        title: showCloseModal === "fraud_confirmed" ? "Fraud Confirmed" : "Case Closed (False Positive)",
        message:
          showCloseModal === "fraud_confirmed"
            ? `Account restricted and balance forfeited for ${selectedCase.rider_id}.`
            : `Hold released and courier account cleared.`,
      });
      setShowCloseModal(null);
      setCloseNoteText("");
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to Close Case",
        message: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        badge="Analyst Adjudication"
        title="Security Investigations & Triage"
        subtitle="Manage flagged courier sessions, syndicate ties, and dispatch biometric or payout interventions"
        secondaryAction={{
          label: refreshing ? "Refreshing..." : "Refresh Queue",
          icon: RefreshCw,
          onClick: () => fetchCases(true),
        }}
        primaryAction={{
          label: "Assign Next Priority Case",
          icon: Sparkles,
          onClick: () => {
            const nextUnassigned = cases.find((c) => !c.assigned_to && c.status !== "CLOSED");
            if (nextUnassigned) {
              handleAssignChange("marcus_vance");
              setSelectedCaseId(nextUnassigned.case_id);
              showToast({
                type: "info",
                title: "Assigned Next Priority Case",
                message: `${nextUnassigned.case_id} assigned to your active desk.`,
              });
            } else {
              showToast({
                type: "info",
                title: "Queue Clear",
                message: "No unassigned pending cases found in current backlog.",
              });
            }
          },
          disabled: isReadOnly,
        }}
      />

      {/* Segmented Control: Board | Table */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedTabs
          tabs={[
            { id: "board", label: "Board View", count: cases.length },
            { id: "table", label: "Table View", count: cases.length },
          ]}
          activeTab={viewMode}
          onChange={(id) => setViewMode(id as any)}
          className="mb-0"
        />

        <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)] bg-[var(--surface)] px-3 py-1.5 rounded-full border border-[var(--border)] shadow-soft">
          <Activity className="w-3.5 h-3.5 text-[var(--status-challenge)]" />
          <span>
            {cases.filter((c) => c.status !== "CLOSED" && c.status !== "RESOLVED_LEGIT").length} Active Triage Cases
          </span>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader type="split" />
      ) : (
        <>
          {/* =========================================================================
              VIEW 1: KANBAN BOARD VIEW (Draggable cards across 4 columns)
             ========================================================================= */}
          {viewMode === "board" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {BOARD_COLUMNS.map((col) => {
                const columnCases = getCasesForColumn(col.id);
                const isOver = dragOverColumn === col.id;

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`bg-[var(--surface)] rounded-2xl border p-4 shadow-soft transition-all min-h-[560px] flex flex-col ${
                      isOver
                        ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20 bg-[var(--lavender)]/20"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: col.color }}
                        />
                        <h3 className="font-extrabold text-sm text-[var(--ink)]">
                          {col.title}
                        </h3>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-full ${col.badgeBg}`}
                        style={{ color: col.color }}
                      >
                        {columnCases.length}
                      </span>
                    </div>

                    {/* Draggable Cards Stack */}
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[640px] pr-1">
                      {columnCases.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[var(--muted)] border-2 border-dashed border-[var(--border-subtle)] rounded-xl">
                          Drop case cards here
                        </div>
                      ) : (
                        columnCases.map((c) => {
                          const isSelected = selectedCaseId === c.case_id;
                          const isBeingDragged = draggedCaseId === c.case_id;

                          return (
                            <div
                              key={c.case_id}
                              draggable={!isReadOnly}
                              onDragStart={(e) => handleDragStart(e, c.case_id)}
                              onClick={() => setSelectedCaseId(c.case_id)}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none group relative ${
                                isSelected
                                  ? "bg-[var(--lavender)] border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)]"
                                  : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)] hover:shadow-soft"
                              } ${isBeingDragged ? "opacity-40 scale-95" : ""}`}
                            >
                              {/* Top Bar: ID + Severity & Risk Chip */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <GripVertical className="w-3 h-3 text-[var(--muted)] opacity-40 group-hover:opacity-100 transition-opacity" />
                                  <span className="font-mono text-[11px] font-bold text-[var(--ink)]">
                                    {c.case_id}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                      c.risk_score > 70
                                        ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                                        : c.risk_score > 40
                                        ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                                        : "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                                    }`}
                                  >
                                    {c.risk_score}%
                                  </span>
                                </div>
                              </div>

                              {/* Title / Threat Summary */}
                              <h4 className="font-bold text-xs text-[var(--ink)] leading-snug line-clamp-2">
                                {c.title || c.threat_summary}
                              </h4>

                              {/* Rider & Hub */}
                              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                                <span className="font-semibold text-[var(--ink)]">
                                  {c.rider_name || c.rider_id}
                                </span>
                                {c.hub && (
                                  <span className="text-[10px] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                                    {c.hub}
                                  </span>
                                )}
                              </div>

                              {/* Financial Hold Pill (if payout held) */}
                              {c.payout_held && c.payout_held > 0 ? (
                                <div className="mt-2 py-0.5 px-2 rounded-md bg-[var(--status-escalate)]/10 border border-[var(--status-escalate)]/20 text-[10px] font-mono font-bold text-[var(--status-escalate)] flex items-center justify-between">
                                  <span>HOLD ESCROW:</span>
                                  <span>${c.payout_held.toFixed(2)}</span>
                                </div>
                              ) : null}

                              {/* Bottom Footer: Assignee & Age */}
                              <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--muted)]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[9px] font-bold">
                                    {c.assigned_to
                                      ? c.assigned_to.charAt(0).toUpperCase()
                                      : "?"}
                                  </div>
                                  <span className="truncate max-w-[90px]">
                                    {c.assigned_to
                                      ? ANALYSTS.find((a) => a.id === c.assigned_to)?.name || c.assigned_to
                                      : "Unassigned"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-[var(--muted)]" />
                                  <span>{formatAge(c.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* =========================================================================
              VIEW 2: TABLE VIEW (Sort, Filter, Pagination)
             ========================================================================= */}
          {viewMode === "table" && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden space-y-4">
              {/* Filter Controls Bar */}
              <div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Search Input */}
                  <div className="relative min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search ID, courier or incident..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-full pl-8 pr-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] w-full transition-all"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-full px-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] font-bold"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="ESCALATED">Escalated</option>
                    <option value="CLOSED">Closed / Resolved</option>
                  </select>

                  {/* Severity Filter */}
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-full px-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] font-bold"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical Tier</option>
                    <option value="HIGH">High Severity</option>
                    <option value="MEDIUM">Medium Severity</option>
                    <option value="LOW">Low Severity</option>
                  </select>

                  {/* Assignee Filter */}
                  <select
                    value={assigneeFilter}
                    onChange={(e) => {
                      setAssigneeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-full px-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] font-bold"
                  >
                    <option value="ALL">All Assignees</option>
                    <option value="UNASSIGNED">Unassigned</option>
                    {ANALYSTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs font-mono text-[var(--muted)]">
                  Showing {sortedCases.length} matches
                </div>
              </div>

              {/* Cases Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-alt)] text-[var(--muted)] uppercase text-[10px] font-bold border-b border-[var(--border-subtle)]">
                    <tr>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-[var(--ink)]"
                        onClick={() => toggleSort("case_id")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Case ID</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Incident / Title</th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-[var(--ink)]"
                        onClick={() => toggleSort("rider_name")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Courier</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-[var(--ink)]"
                        onClick={() => toggleSort("risk_score")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Risk / Severity</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Assignee</th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-[var(--ink)]"
                        onClick={() => toggleSort("created_at")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Age</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {paginatedCases.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-xs text-[var(--muted)]">
                          No cases found matching your search or filter settings.
                        </td>
                      </tr>
                    ) : (
                      paginatedCases.map((c) => {
                        const isSelected = selectedCaseId === c.case_id;

                        return (
                          <tr
                            key={c.case_id}
                            onClick={() => setSelectedCaseId(c.case_id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-[var(--lavender)]/50"
                                : "hover:bg-[var(--surface-alt)]"
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-[var(--primary)]">
                              {c.case_id}
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <div className="font-bold text-[var(--ink)] truncate">
                                {c.title || c.threat_summary}
                              </div>
                              <div className="text-[10px] text-[var(--muted)] truncate">
                                {c.threat_summary}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-[var(--ink)]">{c.rider_name || c.rider_id}</div>
                              <div className="text-[10px] text-[var(--muted)] font-mono">{c.rider_id}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                                    c.risk_score > 70
                                      ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                                      : c.risk_score > 40
                                      ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                                      : "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                                  }`}
                                >
                                  {c.risk_score}% Risk
                                </span>
                                <span className="text-[10px] font-bold text-[var(--muted)]">
                                  {c.severity}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                  c.status === "CLOSED" || c.status === "RESOLVED_LEGIT"
                                    ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                                    : c.status === "ESCALATED" || c.status === "RESTRICTED"
                                    ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                                    : c.status === "IN_REVIEW"
                                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                                    : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                                }`}
                              >
                                {c.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-[var(--ink)] font-medium">
                              {c.assigned_to
                                ? ANALYSTS.find((a) => a.id === c.assigned_to)?.name || c.assigned_to
                                : "Unassigned"}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[var(--muted)]">
                              {formatAge(c.created_at)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCaseId(c.case_id);
                                }}
                                className="px-3 py-1 rounded-full bg-[var(--surface)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-[var(--primary)] font-bold text-[11px] transition-all inline-flex items-center gap-1"
                              >
                                <span>Inspect</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Bar */}
              <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-[var(--ink)] disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-[var(--ink)] disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          WIDE RIGHT DRAWER (Tabs: Summary | Evidence | Timeline | Notes + Actions)
         ========================================================================= */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCaseId(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-2xl bg-[var(--surface)] h-full shadow-2xl flex flex-col justify-between border-l border-[var(--border)] z-10 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)]">
                      {selectedCase.case_id}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        selectedCase.status === "CLOSED" || selectedCase.status === "RESOLVED_LEGIT"
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : selectedCase.status === "ESCALATED" || selectedCase.status === "RESTRICTED"
                          ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                          : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                      }`}
                    >
                      {selectedCase.status.replace("_", " ")}
                    </span>
                    <span className="text-xs font-bold text-[var(--muted)]">
                      Tier: {selectedCase.severity}
                    </span>
                  </div>

                  <h2 className="text-xl font-extrabold text-[var(--ink)] leading-snug">
                    {selectedCase.title || selectedCase.threat_summary}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                    <span>Courier: <strong className="text-[var(--ink)]">{selectedCase.rider_name || "Unknown"}</strong> ({selectedCase.rider_id})</span>
                    <span>•</span>
                    <span>Hub: <strong>{selectedCase.hub || "Metro Hub"}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-2xl font-mono font-extrabold text-[var(--status-escalate)]">
                      {selectedCase.risk_score}%
                    </span>
                    <span className="block text-[10px] text-[var(--muted)] font-bold">AI Risk</span>
                  </div>
                  <button
                    onClick={() => setSelectedCaseId(null)}
                    className="p-2 rounded-full hover:bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Segmented Sub-tabs */}
              <div className="flex items-center gap-2 mt-6 p-1 rounded-full bg-[var(--surface-alt)] border border-[var(--border-subtle)] w-fit">
                {[
                  { id: "summary", label: "Summary" },
                  { id: "evidence", label: "Evidence", count: (selectedCase.signals?.length || 0) + (selectedCase.linked_riders?.length || 0) },
                  { id: "timeline", label: "Timeline", count: selectedCase.timeline?.length || 0 },
                  { id: "notes", label: "Notes", count: selectedCase.notes?.length || 0 },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDrawerTab(t.id as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                      drawerTab === t.id
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span>{t.label}</span>
                    {t.count !== undefined && t.count > 0 && (
                      <span className={`text-[10px] font-mono px-1 rounded-full ${drawerTab === t.id ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--muted)]"}`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer Body Scroll Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: SUMMARY */}
              {drawerTab === "summary" && (
                <div className="space-y-6">
                  {/* Threat Description Banner */}
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--status-escalate)] mb-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Telemetry Anomaly Signature</span>
                    </div>
                    <p className="text-xs text-[var(--ink)] leading-relaxed font-medium">
                      {selectedCase.threat_summary}
                    </p>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)]">Payout Status</span>
                      <div className="text-base font-extrabold text-[var(--ink)]">
                        ${selectedCase.payout_held?.toFixed(2) || "0.00"}
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                        {selectedCase.payout_frozen ? (
                          <span className="text-[var(--status-escalate)] font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Frozen in Risk Escrow
                          </span>
                        ) : (
                          <span className="text-[var(--status-allow)] font-bold flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> Payout Active
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)]">Biometric Verification</span>
                      <div className="text-sm font-extrabold text-[var(--ink)] mt-1">
                        {selectedCase.liveness_status === "PASSED" ? (
                          <span className="text-[var(--status-allow)] flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Verified Genuine (Passed)
                          </span>
                        ) : selectedCase.liveness_status === "FAILED" ? (
                          <span className="text-[var(--status-escalate)] flex items-center gap-1">
                            <ShieldAlert className="w-4 h-4" /> 3D Liveness Failed
                          </span>
                        ) : selectedCase.liveness_status === "PENDING" ? (
                          <span className="text-[var(--status-challenge)] flex items-center gap-1">
                            <Clock className="w-4 h-4" /> Verification In Progress
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">Not Requested</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--muted)] pt-1">
                        Cryptographic 3D challenge channel
                      </div>
                    </div>
                  </div>

                  {/* Analyst Assignment Card */}
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">
                        Assigned Adjudicator
                      </span>
                      <span className="font-extrabold text-sm text-[var(--ink)]">
                        {selectedCase.assigned_to
                          ? ANALYSTS.find((a) => a.id === selectedCase.assigned_to)?.name || selectedCase.assigned_to
                          : "Unassigned Desk"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCase.assigned_to || "unassigned"}
                        onChange={(e) => handleAssignChange(e.target.value)}
                        disabled={isReadOnly || actionLoading}
                        className="bg-[var(--surface)] border border-[var(--border)] rounded-full px-3 py-1.5 text-xs text-[var(--ink)] font-bold focus:outline-none focus:border-[var(--primary)]"
                      >
                        <option value="unassigned">Unassigned</option>
                        {ANALYSTS.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Outcome Tag (if closed) */}
                  {selectedCase.outcome && (
                    <div
                      className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-bold ${
                        selectedCase.outcome === "fraud_confirmed"
                          ? "bg-[var(--status-escalate)]/15 border-[var(--status-escalate)] text-[var(--status-escalate)]"
                          : "bg-[var(--status-allow)]/15 border-[var(--status-allow)] text-[var(--status-allow)]"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Final Adjudication Outcome: {selectedCase.outcome === "fraud_confirmed" ? "FRAUD CONFIRMED (Permanent Account Restriction)" : "FALSE POSITIVE (Cleared & Funds Released)"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EVIDENCE */}
              {drawerTab === "evidence" && (
                <div className="space-y-6">
                  {/* Signals List */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
                      Automated Signals Breakdown ({selectedCase.signals?.length || 0})
                    </h4>
                    <div className="space-y-2.5">
                      {selectedCase.signals?.map((sig, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-[var(--ink)]">
                              {sig.name}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                sig.severity === "HIGH"
                                  ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                                  : sig.severity === "MEDIUM"
                                  ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                                  : "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                              }`}
                            >
                              Score: {sig.score}% • Weight: {Math.round(sig.weight * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                            {sig.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Linked Riders & Syndicates */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
                      Linked Riders & Syndicates ({selectedCase.linked_riders?.length || 0})
                    </h4>
                    {selectedCase.linked_riders && selectedCase.linked_riders.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCase.linked_riders.map((lr, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[var(--surface)] text-[var(--primary)] flex items-center justify-center font-bold">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-[var(--ink)]">{lr.name}</div>
                                <div className="text-[10px] text-[var(--muted)]">
                                  {lr.rider_id} • {lr.relationship}
                                </div>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-xs text-[var(--status-escalate)]">
                              {lr.risk}% Risk
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--muted)] italic p-3 bg-[var(--surface-alt)] rounded-xl border border-[var(--border-subtle)]">
                        No secondary couriers linked to this case file.
                      </div>
                    )}
                  </div>

                  {/* Linked Devices */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
                      Hardware & Device Attestation
                    </h4>
                    {selectedCase.linked_devices && selectedCase.linked_devices.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCase.linked_devices.map((ld, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[var(--surface)] text-[var(--primary)] flex items-center justify-center font-bold">
                                <Smartphone className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-[var(--ink)]">{ld.model}</div>
                                <div className="text-[10px] text-[var(--muted)] font-mono">
                                  IMEI: {ld.imei} • {ld.os}
                                </div>
                              </div>
                            </div>
                            {ld.root ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]">
                                ROOTED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--status-allow)]/15 text-[var(--status-allow)]">
                                SECURE
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--muted)] italic p-3 bg-[var(--surface-alt)] rounded-xl border border-[var(--border-subtle)]">
                        No anomalous device signatures recorded.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: TIMELINE */}
              {drawerTab === "timeline" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
                    Case Lifecycle & Audit Trail
                  </h4>
                  <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
                    {selectedCase.timeline?.map((item) => (
                      <div key={item.id} className="relative group">
                        <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[var(--surface)] border-2 border-[var(--primary)] group-hover:scale-125 transition-transform" />
                        <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono font-bold text-[var(--muted)]">
                              {item.timestamp}
                            </span>
                            {item.actor && (
                              <span className="font-bold text-[var(--primary)]">
                                by {item.actor}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--ink)] font-medium leading-relaxed">
                            {item.event}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: NOTES */}
              {drawerTab === "notes" && (
                <div className="space-y-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Analyst Notes Thread ({selectedCase.notes?.length || 0})
                  </h4>

                  {/* Add Note Input Form */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={3}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add investigation observation, evidence findings, or customer service escalation..."
                      disabled={isReadOnly || submittingNote}
                      className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isReadOnly || submittingNote || !newNoteText.trim()}
                        className="px-4 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-soft transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submittingNote ? "Submitting..." : "Add Note"}</span>
                      </button>
                    </div>
                  </form>

                  {/* Notes Feed */}
                  <div className="space-y-3 pt-2">
                    {selectedCase.notes?.length === 0 ? (
                      <div className="text-center py-6 text-xs text-[var(--muted)] italic">
                        No notes recorded yet. Add the first note above.
                      </div>
                    ) : (
                      selectedCase.notes?.map((n) => (
                        <div
                          key={n.id}
                          className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[var(--ink)]">{n.author}</span>
                              <span className="text-[10px] text-[var(--muted)] font-mono">
                                ({n.role})
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-[var(--muted)]">
                              {n.timestamp}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--ink)] leading-relaxed font-medium">
                            {n.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Bottom Actions Toolbar */}
            <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3">
              {/* Left Secondary Interventions */}
              <div className="flex items-center gap-2">
                {/* Freeze Payout Button */}
                <button
                  type="button"
                  onClick={handleTogglePayoutFreeze}
                  disabled={isReadOnly || actionLoading}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 disabled:opacity-50 ${
                    selectedCase.payout_frozen
                      ? "bg-[var(--status-escalate)]/10 text-[var(--status-escalate)] border-[var(--status-escalate)]/30 hover:bg-[var(--status-escalate)]/20"
                      : "bg-[var(--surface-alt)] text-[var(--ink)] border-[var(--border)] hover:border-[var(--primary)]"
                  }`}
                >
                  {selectedCase.payout_frozen ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unfreeze Payout</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Freeze Payout</span>
                    </>
                  )}
                </button>

                {/* Request Liveness Button */}
                <button
                  type="button"
                  onClick={handleRequestLiveness}
                  disabled={isReadOnly || actionLoading || selectedCase.liveness_status === "PENDING"}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--surface-alt)] text-[var(--ink)] border border-[var(--border)] hover:border-[var(--primary)] transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>
                    {selectedCase.liveness_status === "PENDING"
                      ? "Challenge Pending"
                      : "Request Liveness"}
                  </span>
                </button>
              </div>

              {/* Right Primary Resolution Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal("false_positive")}
                  disabled={isReadOnly || actionLoading || selectedCase.status === "CLOSED"}
                  className="px-3.5 py-1.5 rounded-full bg-[var(--status-allow)] hover:opacity-90 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>False Positive</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCloseModal("fraud_confirmed")}
                  disabled={isReadOnly || actionLoading || selectedCase.status === "CLOSED"}
                  className="px-3.5 py-1.5 rounded-full bg-[var(--status-escalate)] hover:opacity-90 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Fraud Confirmed</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Case Modal Dialog */}
      {showCloseModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCloseModal(null)} />
          <div className="relative bg-[var(--surface)] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--border)] space-y-4 z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[var(--ink)] flex items-center gap-2">
                {showCloseModal === "fraud_confirmed" ? (
                  <>
                    <ShieldAlert className="w-5 h-5 text-[var(--status-escalate)]" />
                    <span>Confirm Fraud & Restrict Account</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[var(--status-allow)]" />
                    <span>Resolve as False Positive</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowCloseModal(null)}
                className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {showCloseModal === "fraud_confirmed"
                ? `You are about to permanently restrict courier ${selectedCase.rider_id} (${selectedCase.rider_name || "Unknown"}) and forfeit any pending payouts ($${selectedCase.payout_held?.toFixed(2) || "0.00"}). This action is logged in statutory compliance records.`
                : `You are clearing courier ${selectedCase.rider_id} of all fraudulent signals. Any held payouts ($${selectedCase.payout_held?.toFixed(2) || "0.00"}) will be immediately released.`}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Adjudication Closing Rationale (Required):
              </label>
              <textarea
                rows={3}
                value={closeNoteText}
                onChange={(e) => setCloseNoteText(e.target.value)}
                placeholder="Enter regulatory or audit justification for closing this case..."
                className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(null)}
                className="px-4 py-2 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--border)] text-[var(--ink)] text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseCase}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-full text-white text-xs font-bold shadow-soft transition-all ${
                  showCloseModal === "fraud_confirmed"
                    ? "bg-[var(--status-escalate)] hover:opacity-90"
                    : "bg-[var(--status-allow)] hover:opacity-90"
                }`}
              >
                {actionLoading ? "Processing..." : "Confirm & Close Case"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
