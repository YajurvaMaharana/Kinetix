"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FolderKanban,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  X,
  Lock,
  Lightbulb,
  TrendingUp,
  Smartphone,
  Network,
  Banknote,
  Eye,
  FileCheck,
} from "lucide-react";
import {
  getCases,
  getCaseDetail,
  actOnCase,
  getPolicyFeedbackSummary,
  getActiveRole,
  CaseFilterParams,
} from "@/lib/api";
import {
  Case,
  CaseDetailResponse,
  PolicyFeedbackSummary,
  Role,
  MetricComparisonItem,
} from "@/lib/types";

interface RadarMetric {
  label: string;
  baseline: number;
  observed: number;
}

function RadarChart({ metrics }: { metrics: RadarMetric[] }) {
  const size = 300;
  const center = size / 2;
  const radius = 100;
  const totalAxes = Math.max(metrics.length, 3);

  const getCoordinates = (value: number, index: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = radius * Math.min(Math.max(value, 0.05), 1.0);
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const concentricLevels = [0.25, 0.5, 0.75, 1.0];

  const baselinePoints = metrics
    .map((m, i) => {
      const { x, y } = getCoordinates(m.baseline, i);
      return `${x},${y}`;
    })
    .join(" ");

  const observedPoints = metrics
    .map((m, i) => {
      const { x, y } = getCoordinates(m.observed, i);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/60 border border-slate-800">
      <div className="flex items-center justify-between w-full mb-2 text-xs">
        <span className="font-semibold text-slate-300">Biometric &amp; Telemetry Deviation Radar</span>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400/80"></span>
            Baseline Median
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            Current Session
          </span>
        </div>
      </div>

      <svg width={size} height={size} className="overflow-visible">
        {concentricLevels.map((lvl) => {
          const webPoints = Array.from({ length: totalAxes })
            .map((_, i) => {
              const { x, y } = getCoordinates(lvl, i);
              return `${x},${y}`;
            })
            .join(" ");
          return (
            <polygon
              key={lvl}
              points={webPoints}
              fill="none"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray={lvl === 1.0 ? "none" : "2,2"}
            />
          );
        })}

        {metrics.map((m, i) => {
          const edge = getCoordinates(1.0, i);
          const labelAngle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
          const labelDist = radius + 22;
          const lx = center + labelDist * Math.cos(labelAngle);
          const ly = center + labelDist * Math.sin(labelAngle);

          return (
            <g key={i}>
              <line
                x1={center}
                y1={center}
                x2={edge.x}
                y2={edge.y}
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-slate-400 text-[10px] font-mono select-none"
              >
                {m.label}
              </text>
            </g>
          );
        })}

        <polygon
          points={baselinePoints}
          fill="rgba(34, 211, 238, 0.2)"
          stroke="#22d3ee"
          strokeWidth="2"
        />

        <polygon
          points={observedPoints}
          fill="rgba(244, 63, 94, 0.25)"
          stroke="#f43f5e"
          strokeWidth="2.5"
        />

        {metrics.map((m, i) => {
          const { x, y } = getCoordinates(m.observed, i);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.5"
              fill="#f43f5e"
              stroke="#ffffff"
              strokeWidth="1"
            />
          );
        })}
      </svg>
    </div>
  );
}

function CasesContent() {
  const [searchParams] = useSearchParams();
  const urlCaseId = searchParams.get("id");

  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeRole, setActiveRoleState] = useState<Role>("analyst");

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [threatTagFilter, setThreatTagFilter] = useState<string>("ALL");
  const [riderSearch, setRiderSearch] = useState<string>("");
  const [sortOption, setSortOption] = useState<string>("created_at:desc");

  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<boolean>(false);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [reviewNote, setReviewNote] = useState<string>("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackSummary, setFeedbackSummary] = useState<PolicyFeedbackSummary | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);

  useEffect(() => {
    setActiveRoleState(getActiveRole());
    const onRoleChange = () => setActiveRoleState(getActiveRole());
    window.addEventListener("trustjuggler:role_changed", onRoleChange);
    return () => window.removeEventListener("trustjuggler:role_changed", onRoleChange);
  }, []);

  const fetchCasesList = useCallback(async () => {
    setLoading(true);
    try {
      const filters: CaseFilterParams = {
        status: statusFilter === "ALL" ? undefined : statusFilter,
        severity: severityFilter === "ALL" ? undefined : severityFilter,
        threat_tag: threatTagFilter === "ALL" ? undefined : threatTagFilter,
        rider: riderSearch.trim() || undefined,
        sort: sortOption,
      };
      const data = await getCases(filters, activeRole);
      setCases(data);
    } catch {
      setCases([
        {
          case_id: "case_spoof_9004",
          session_id: "sess_spoof_android_44",
          rider_id: "rider_***_7719",
          rider_name: "Alex *** (Masked)",
          severity: "HIGH",
          status: "OPEN",
          risk_score: 72.4,
          threat_tag: "GEO_SPOOF",
          threat_tags: ["GEO_SPOOF", "EMULATOR_DETECTED"],
          threat_summary: "GPS route jump (>150 km/h) & Android x86 emulator detected during trip.",
          assigned_to: null,
          age_minutes: 14,
          age_display: "14m ago",
          created_at: new Date(Date.now() - 14 * 60000).toISOString(),
        },
        {
          case_id: "case_ring_9005",
          session_id: "sess_syndicate_node_102",
          rider_id: "rider_***_014",
          rider_name: "Morgan *** (Masked)",
          severity: "CRITICAL",
          status: "IN_REVIEW",
          risk_score: 89.1,
          threat_tag: "COLLUSION_RING",
          threat_tags: ["COLLUSION_RING", "PAYOUT_RISK"],
          threat_summary: "Linked to active fraud syndicate CLUSTER-RING-409 (14 nodes, recycled bank account).",
          assigned_to: "analyst_sarah_m",
          age_minutes: 42,
          age_display: "42m ago",
          created_at: new Date(Date.now() - 42 * 60000).toISOString(),
        },
        {
          case_id: "case_handoff_8992",
          session_id: "sess_handoff_evening_89",
          rider_id: "rider_***_6021",
          rider_name: "Taylor *** (Masked)",
          severity: "MEDIUM",
          status: "RESOLVED_FALSE_POSITIVE",
          risk_score: 54.0,
          threat_tag: "ORDINARY_CHANGE",
          threat_tags: ["ORDINARY_CHANGE"],
          threat_summary: "New mobile device and location shift cleared via facial biometric verification.",
          assigned_to: "analyst_david_k",
          age_minutes: 180,
          age_display: "3h ago",
          created_at: new Date(Date.now() - 180 * 60000).toISOString(),
        },
        {
          case_id: "case_payout_8920",
          session_id: "sess_payout_hijack_03",
          rider_id: "rider_***_4488",
          rider_name: "Jordan *** (Masked)",
          severity: "HIGH",
          status: "OPEN",
          risk_score: 78.5,
          threat_tag: "PAYOUT_RISK",
          threat_tags: ["PAYOUT_RISK", "ACCOUNT_HANDOFF"],
          threat_summary: "Payout destination changed, followed by immediate maximum withdrawal attempt.",
          assigned_to: null,
          age_minutes: 95,
          age_display: "1.5h ago",
          created_at: new Date(Date.now() - 95 * 60000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, threatTagFilter, riderSearch, sortOption, activeRole]);

  useEffect(() => {
    fetchCasesList();
  }, [fetchCasesList]);

  const openCaseDetail = useCallback(async (caseId: string) => {
    setSelectedCaseId(caseId);
    setDetailLoading(true);
    setActionError(null);
    setActionSuccess(null);
    setReviewNote("");

    try {
      const detail = await getCaseDetail(caseId, activeRole);
      setCaseDetail(detail);
    } catch {
      const fallbackTarget = cases.find((c) => (c.case_id || c.id) === caseId);
      setCaseDetail({
        case: fallbackTarget || {
          case_id: caseId,
          session_id: "sess_sample_fallback",
          rider_id: "rider_***_7719",
          severity: "HIGH",
          status: "OPEN",
          risk_score: 72.4,
          threat_tag: "GEO_SPOOF",
          threat_tags: ["GEO_SPOOF", "EMULATOR_DETECTED"],
          threat_summary: "GPS route jump (>150 km/h) & Android x86 emulator detected during trip.",
          assigned_to: null,
          created_at: new Date().toISOString(),
        },
        assessment: {
          risk_score: 72.4,
          verdict: "CHALLENGE",
          classification: "CHALLENGE",
          threat_tags: ["GEO_SPOOF", "EMULATOR_DETECTED"],
          confidence: 0.94,
          factors: [
            {
              name: "Synthetic GPS Spoof Route",
              code: "GPS_SPOOFING",
              category: "LOCATION",
              impact: "NEGATIVE",
              weight: 0.85,
              score: 75.0,
              description: "Implied velocity exceeded 185 km/h with zero GPS variance.",
            },
            {
              name: "Android x86 Emulator Detected",
              code: "DEVICE_EMULATOR",
              category: "DEVICE",
              impact: "NEGATIVE",
              weight: 0.75,
              score: 70.0,
              description: "Build fingerprint reports goldfish/ranchu emulator signature.",
            },
          ],
        },
        baseline_vs_session: [
          { metric: "typing_speed_cpm", observed: 120.0, baseline_median: 215.0, deviation_pct: -44.1, unit: "cpm", is_anomaly: true },
          { metric: "speed_kmh", observed: 185.0, baseline_median: 42.0, deviation_pct: 340.4, unit: "km/h", is_anomaly: true },
          { metric: "acceleration_variance", observed: 0.02, baseline_median: 0.85, deviation_pct: -97.6, unit: "m/s²", is_anomaly: true },
          { metric: "gyro_stability", observed: 0.99, baseline_median: 0.65, deviation_pct: 52.3, unit: "pts", is_anomaly: false },
          { metric: "route_deviation_pct", observed: 88.0, baseline_median: 4.5, deviation_pct: 1855.5, unit: "%", is_anomaly: true },
          { metric: "face_match_confidence", observed: 0.32, baseline_median: 0.88, deviation_pct: -63.6, unit: "ratio", is_anomaly: true },
        ],
        rider_trust_score: { score: 64.0, trust_health: 70.0, tier: "ESTABLISHED", trend: "DEGRADING", bonus_points: 0 },
        device_passport: {
          device_id: "dev_***_a19f",
          hardware_profile: "Android SDK built for x86",
          os_version: "Android 13.0",
          trust_level: "PROVISIONAL",
          emulator_flag: true,
          rooted_flag: false,
          mock_location_flag: true,
          linked_rider_count: 3,
          network_reputation: 0.25,
        },
        cluster: {
          cluster_id: "cluster_ring_409",
          cluster_name: "BLR-Indiranagar Device Farm Ring",
          risk_tier: "CRITICAL",
          size: 14,
          shared_identifiers: ["mock_device_uuid_09", "bank_token_9921"],
        },
        challenge_history: [
          { challenge_id: "chal_otp_7719", challenge_type: "SMS_OTP", level: 1, reason_code: "NEW_DEVICE", status: "PASSED", created_at: new Date().toISOString() }
        ],
        payouts: [
          { payout_id: "pay_hold_392", amount: 1450.0, currency: "INR", status: "HELD", risk_at_request: 72.4, reason: "Held: Destination account token changed within 24h protection window.", created_at: new Date().toISOString() }
        ],
        audit_trail: [
          { log_id: "log_101", action: "EVALUATION_TRIGGERED_CASE", actor_id: "system:risk_engine", details: "Severity escalated to HIGH.", timestamp: new Date().toISOString() }
        ],
      });
    } finally {
      setDetailLoading(false);
    }
  }, [activeRole, cases]);

  useEffect(() => {
    if (urlCaseId) {
      openCaseDetail(urlCaseId);
    }
  }, [urlCaseId, openCaseDetail]);

  const closeDrawer = () => {
    setSelectedCaseId(null);
    setCaseDetail(null);
    setActionError(null);
    setActionSuccess(null);
    setReviewNote("");
  };

  const handleAction = async (action: string) => {
    if (!selectedCaseId) return;
    if (!reviewNote.trim()) {
      setActionError("A detailed reviewer note is mandatory before submitting any decision.");
      return;
    }

    setActionInProgress(action);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updatedDetail = await actOnCase(
        selectedCaseId,
        { action, note: reviewNote.trim() },
        activeRole
      );
      setActionSuccess(`Action '${action.replace("_", " ").toUpperCase()}' executed successfully.`);

      if (updatedDetail && updatedDetail.case) {
        setCaseDetail(updatedDetail);
      } else {
        setCaseDetail((prev) => {
          if (!prev) return null;
          let newStatus = prev.case.status;
          let newSeverity = prev.case.severity;
          if (action === "false_positive") newStatus = "RESOLVED_FALSE_POSITIVE";
          else if (action === "confirm_fraud") newStatus = "CONFIRMED_FRAUD";
          else if (action === "escalate") newSeverity = "CRITICAL";
          else if (action === "clear") newStatus = "RESOLVED";

          return {
            ...prev,
            case: { ...prev.case, status: newStatus, severity: newSeverity },
            audit_trail: [
              {
                log_id: `log_${Date.now()}`,
                action: `CASE_ACTION_${action.toUpperCase()}`,
                actor_id: `reviewer:${activeRole}`,
                details: reviewNote.trim(),
                timestamp: new Date().toISOString(),
              },
              ...prev.audit_trail,
            ],
          };
        });
      }

      fetchCasesList();
      setReviewNote("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setActionInProgress(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCaseIds.length === cases.length) {
      setSelectedCaseIds([]);
    } else {
      setSelectedCaseIds(cases.map((c) => c.case_id || c.id || ""));
    }
  };

  const toggleSelectCase = (caseId: string) => {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  const handleBulkAction = async (action: string) => {
    if (selectedCaseIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      for (const id of selectedCaseIds) {
        try {
          await actOnCase(id, { action, note: `Bulk action '${action}' applied.` }, activeRole);
        } catch {
          // continue
        }
      }
      setSelectedCaseIds([]);
      fetchCasesList();
    } finally {
      setBulkActionLoading(false);
    }
  };

  const openFeedbackSummary = async () => {
    setShowFeedbackModal(true);
    setFeedbackLoading(true);
    try {
      const summary = await getPolicyFeedbackSummary(activeRole);
      setFeedbackSummary(summary);
    } catch {
      setFeedbackSummary({
        total_reviewed: 24,
        total_confirmed_fraud: 16,
        total_false_positives: 8,
        overall_precision: 0.667,
        tag_feedback: [
          {
            threat_tag: "ORDINARY_CHANGE",
            classification: "CHALLENGE",
            total_reviews: 7,
            confirmed_fraud_count: 2,
            false_positive_count: 5,
            observed_precision: 0.286,
            suggested_threshold_nudge: "ordinary_change flagged CHALLENGE had 71.4% false positives -> consider raising threshold",
          },
        ],
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const radarData: RadarMetric[] = useMemo(() => {
    if (!caseDetail?.baseline_vs_session || caseDetail.baseline_vs_session.length === 0) {
      return [
        { label: "Typing", baseline: 0.65, observed: 0.25 },
        { label: "Speed", baseline: 0.45, observed: 0.95 },
        { label: "Accel Var", baseline: 0.7, observed: 0.1 },
        { label: "Gyro", baseline: 0.6, observed: 0.9 },
        { label: "Route Dev", baseline: 0.2, observed: 0.85 },
        { label: "Biometrics", baseline: 0.85, observed: 0.3 },
      ];
    }

    const keyMetricsMap: Record<string, string> = {
      typing_speed_cpm: "Typing",
      speed_kmh: "Speed",
      acceleration_variance: "Accel Var",
      gyro_stability: "Gyro",
      route_deviation_pct: "Route Dev",
      face_match_confidence: "Biometrics",
    };

    return Object.entries(keyMetricsMap).map(([key, label]) => {
      const item = caseDetail.baseline_vs_session.find((m) => m.metric === key);
      if (!item) return { label, baseline: 0.5, observed: 0.5 };

      let baseNorm = 0.5;
      let obsNorm = 0.5;

      if (key === "typing_speed_cpm") {
        baseNorm = Math.min(item.baseline_median / 300, 1.0);
        obsNorm = Math.min(item.observed / 300, 1.0);
      } else if (key === "speed_kmh") {
        baseNorm = Math.min(item.baseline_median / 120, 1.0);
        obsNorm = Math.min(item.observed / 120, 1.0);
      } else if (key === "acceleration_variance") {
        baseNorm = Math.min(item.baseline_median / 2.0, 1.0);
        obsNorm = Math.min(item.observed / 2.0, 1.0);
      } else if (key === "gyro_stability" || key === "face_match_confidence") {
        baseNorm = Math.min(Math.max(item.baseline_median, 0), 1.0);
        obsNorm = Math.min(Math.max(item.observed, 0), 1.0);
      } else if (key === "route_deviation_pct") {
        baseNorm = Math.min(item.baseline_median / 50, 1.0);
        obsNorm = Math.min(item.observed / 50, 1.0);
      }

      return { label, baseline: baseNorm, observed: obsNorm };
    });
  }, [caseDetail]);

  const totalCount = cases.length;
  const criticalCount = cases.filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH").length;
  const openCount = cases.filter((c) => c.status === "OPEN" || c.status === "IN_REVIEW").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span>Investigations</span>
            <span>/</span>
            <span className="text-slate-200">Review Console</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-indigo-400" />
            Case Management &amp; Review Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Analyst queue for escalated rideshare sessions, device farm collusion, and fraud decisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openFeedbackSummary}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors shadow-sm cursor-pointer"
          >
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Policy Feedback &amp; Nudges
          </button>
          <button
            onClick={fetchCasesList}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Queue</div>
          <div className="text-xl font-bold font-mono text-white mt-1">{totalCount}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Open / In Review</div>
          <div className="text-xl font-bold font-mono text-amber-300 mt-1">{openCount}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Critical &amp; High</div>
          <div className="text-xl font-bold font-mono text-rose-300 mt-1">{criticalCount}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">Active Role</div>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-1 capitalize">{activeRole}</div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Filter className="h-4 w-4 text-indigo-400" />
          Queue Filters &amp; Sort
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="RESOLVED_FALSE_POSITIVE">Resolved (False Positive)</option>
              <option value="CONFIRMED_FRAUD">Confirmed Fraud</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Threat Tag</label>
            <select
              value={threatTagFilter}
              onChange={(e) => setThreatTagFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Threat Tags</option>
              <option value="GEO_SPOOF">Geo Spoof</option>
              <option value="EMULATOR_DETECTED">Emulator Detected</option>
              <option value="COLLUSION_RING">Collusion Ring</option>
              <option value="ACCOUNT_HANDOFF">Account Handoff</option>
              <option value="PAYOUT_RISK">Payout Risk</option>
              <option value="ORDINARY_CHANGE">Ordinary Change</option>
              <option value="DEVICE_ANOMALY">Device Anomaly</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Search Rider</label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="rider_id..."
                value={riderSearch}
                onChange={(e) => setRiderSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Sort Order</label>
            <div className="relative">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-8 pr-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="created_at:desc">Newest First</option>
                <option value="created_at:asc">Oldest First</option>
                <option value="risk_score:desc">Highest Risk</option>
                <option value="severity:desc">Severity Priority</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {selectedCaseIds.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              {selectedCaseIds.length}
            </span>
            cases selected for bulk operation
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction("escalate")}
              disabled={bulkActionLoading}
              className="px-3 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Bulk Escalate
            </button>
            <button
              onClick={() => setSelectedCaseIds([])}
              className="px-2.5 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 font-mono text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white cursor-pointer">
                    {selectedCaseIds.length > 0 && selectedCaseIds.length === cases.length ? (
                      <CheckSquare className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Case ID</th>
                <th className="py-3 px-3">Rider (Masked)</th>
                <th className="py-3 px-3">Risk</th>
                <th className="py-3 px-3">Threat Tags</th>
                <th className="py-3 px-3">Age</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No cases match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                cases.map((c) => {
                  const caseId = c.case_id || c.id || "";
                  const isSelected = selectedCaseIds.includes(caseId);
                  const isCritical = c.severity === "CRITICAL";
                  const isHigh = c.severity === "HIGH";
                  const isMedium = c.severity === "MEDIUM";
                  const riskVal = c.risk_score !== undefined ? c.risk_score : 50.0;

                  return (
                    <tr
                      key={caseId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? "bg-indigo-950/20" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleSelectCase(caseId)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-indigo-400" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isCritical
                              ? "bg-red-500/10 text-red-400 border-red-500/30"
                              : isHigh
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : isMedium
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isCritical
                                ? "bg-red-400"
                                : isHigh
                                ? "bg-rose-400"
                                : isMedium
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            }`}
                          />
                          {c.severity}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono font-medium text-indigo-300 whitespace-nowrap">
                        {caseId}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-200">{c.rider_id}</div>
                        {c.rider_name && (
                          <div className="text-[10px] text-slate-400">{c.rider_name}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full ${
                                riskVal >= 75
                                  ? "bg-red-500"
                                  : riskVal >= 50
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(riskVal, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-slate-300">
                            {riskVal.toFixed(1)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(c.threat_tags && c.threat_tags.length > 0
                            ? c.threat_tags
                            : c.threat_tag
                            ? [c.threat_tag]
                            : ["UNKNOWN"]
                          ).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {c.age_display || `${c.age_minutes || 0}m ago`}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            c.status === "OPEN"
                              ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                              : c.status === "IN_REVIEW"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              : c.status === "CONFIRMED_FRAUD"
                              ? "bg-red-500/10 text-red-300 border border-red-500/20"
                              : c.status === "RESOLVED_FALSE_POSITIVE"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openCaseDetail(caseId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium transition-colors text-xs shadow-sm cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCaseId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-indigo-400">
                    {caseDetail?.case.case_id || selectedCaseId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      caseDetail?.case.severity === "CRITICAL"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : caseDetail?.case.severity === "HIGH"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {caseDetail?.case.severity || "HIGH"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                    {caseDetail?.case.status || "OPEN"}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Rider: <strong className="font-mono text-slate-200">{caseDetail?.case.rider_id}</strong></span>
                  {caseDetail?.case.session_id && (
                    <span>• Session: <strong className="font-mono text-slate-300">{caseDetail.case.session_id}</strong></span>
                  )}
                </div>
              </div>

              <button
                onClick={closeDrawer}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detailLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                  <span className="text-xs">Loading complete 360° investigation dossier...</span>
                </div>
              ) : (
                <>
                  {actionError && (
                    <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{actionError}</span>
                    </div>
                  )}
                  {actionSuccess && (
                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{actionSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                        Risk Assessment &amp; Factor Waterfall
                      </h3>
                      <span className="font-mono text-xs text-slate-400">
                        Score: <strong className="text-rose-400">{caseDetail?.assessment?.risk_score?.toFixed(1) || "72.4"}</strong> / 100
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(caseDetail?.assessment?.factors || []).map((factor, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-200">
                                {factor.name || factor.code}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-mono text-slate-400 uppercase">
                                {factor.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">{factor.description}</p>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-mono font-bold ${
                                factor.impact === "POSITIVE"
                                  ? "text-emerald-400"
                                  : factor.impact === "NEGATIVE"
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {factor.impact === "POSITIVE" ? "-" : "+"}
                              {Math.abs(factor.score || 0).toFixed(0)} pts
                            </span>
                            <div className="text-[9px] text-slate-500 font-mono">
                              weight: {((factor.weight || 0.5) * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                      Baseline vs Current Session Comparison
                    </h3>

                    <RadarChart metrics={radarData} />

                    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-900/80 font-mono uppercase text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">Biometric / Telemetry Metric</th>
                            <th className="py-2 px-3 text-right">Session Observed</th>
                            <th className="py-2 px-3 text-right">Rider Baseline</th>
                            <th className="py-2 px-3 text-right">Deviation</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {(caseDetail?.baseline_vs_session || []).map((row: MetricComparisonItem, idx: number) => {
                            const isAnomaly = row.is_anomaly;
                            const dev = row.deviation_pct;
                            return (
                              <tr key={idx} className={isAnomaly ? "bg-red-500/5" : ""}>
                                <td className="py-2 px-3 font-sans text-slate-200">
                                  {row.metric.replace(/_/g, " ")}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-100 font-bold">
                                  {row.observed.toFixed(2)} {row.unit}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400">
                                  {row.baseline_median.toFixed(2)} {row.unit}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right ${
                                    dev > 0
                                      ? "text-rose-400"
                                      : dev < 0
                                      ? "text-amber-400"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {dev > 0 ? `+${dev.toFixed(1)}%` : `${dev.toFixed(1)}%`}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isAnomaly ? (
                                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                                      ANOMALY
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px]">
                                      NORMAL
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                      <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Smartphone className="h-4 w-4 text-indigo-400" />
                        Device Passport
                      </div>
                      <div className="text-[11px] space-y-1 font-mono text-slate-400">
                        <div>
                          Model:{" "}
                          <span className="text-slate-200">
                            {caseDetail?.device_passport?.hardware_profile || "Android x86"}
                          </span>
                        </div>
                        <div>
                          OS:{" "}
                          <span className="text-slate-200">
                            {caseDetail?.device_passport?.os_version || "Android 13"}
                          </span>
                        </div>
                        <div>
                          Trust Level:{" "}
                          <span className="text-amber-300 font-bold">
                            {caseDetail?.device_passport?.trust_level || "PROVISIONAL"}
                          </span>
                        </div>
                        <div className="flex gap-2 pt-1 text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              caseDetail?.device_passport?.emulator_flag
                                ? "bg-red-500/20 text-red-400 font-bold"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            Emulator: {caseDetail?.device_passport?.emulator_flag ? "YES" : "NO"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              caseDetail?.device_passport?.mock_location_flag
                                ? "bg-red-500/20 text-red-400 font-bold"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            Mock GPS: {caseDetail?.device_passport?.mock_location_flag ? "YES" : "NO"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                      <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Network className="h-4 w-4 text-purple-400" />
                        Syndicate Cluster
                      </div>
                      {caseDetail?.cluster ? (
                        <div className="text-[11px] space-y-1 font-mono text-slate-400">
                          <div>
                            Name:{" "}
                            <span className="text-purple-300 font-bold">
                              {caseDetail.cluster.cluster_name}
                            </span>
                          </div>
                          <div>
                            Size:{" "}
                            <span className="text-slate-200">
                              {caseDetail.cluster.size} linked identities
                            </span>
                          </div>
                          <div>
                            Risk Tier:{" "}
                            <span className="text-red-400 font-bold">
                              {caseDetail.cluster.risk_tier}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-1">
                            Shared: {caseDetail.cluster.shared_identifiers.join(", ")}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 py-3">
                          No collusion ring or device farm linkages detected.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-400" />
                      Payout Protection &amp; Challenge Flow
                    </h3>

                    {(caseDetail?.payouts || []).length > 0 ? (
                      <div className="space-y-2">
                        {caseDetail?.payouts.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between"
                          >
                            <div>
                              <div className="text-xs font-mono font-bold text-slate-200">
                                {p.amount} {p.currency}
                              </div>
                              <div className="text-[10px] text-slate-400">{p.reason}</div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                p.status === "HELD"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : p.status === "BLOCKED"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                              }`}
                            >
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">No active payout holds for this case.</div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-indigo-400" />
                      Investigation Audit Trail
                    </h3>

                    <div className="space-y-2 border-l border-slate-800 ml-2 pl-3">
                      {(caseDetail?.audit_trail || []).map((log, idx) => (
                        <div key={idx} className="relative space-y-0.5">
                          <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <span className="text-indigo-300 font-semibold">{log.action}</span>
                            <span>•</span>
                            <span>{log.actor_id}</span>
                            <span>•</span>
                            <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {log.details && (
                            <p className="text-[11px] text-slate-300 bg-slate-950/50 p-2 rounded border border-slate-800/80">
                              {log.details}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Reviewer Decision Note <span className="text-red-400">* Required</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain the factual rationale for this review decision (mandated by policy)..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleAction("false_positive")}
                  disabled={!reviewNote.trim() || !!actionInProgress}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  False Positive
                </button>

                <button
                  onClick={() => handleAction("confirm_fraud")}
                  disabled={!reviewNote.trim() || !!actionInProgress}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Confirm Fraud
                </button>

                <button
                  onClick={() => handleAction("request_reverify")}
                  disabled={!reviewNote.trim() || !!actionInProgress}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-Verify Face
                </button>

                <button
                  onClick={() => handleAction("restrict")}
                  disabled={!reviewNote.trim() || !!actionInProgress}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Restrict
                </button>

                <button
                  onClick={() => handleAction("escalate")}
                  disabled={!reviewNote.trim() || !!actionInProgress}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Escalate
                </button>

                <button
                  onClick={() => handleAction("clear")}
                  disabled={!reviewNote.trim() || !!actionInProgress}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  Clear Legitimate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Policy Feedback Summary &amp; Nudges</h3>
                  <p className="text-[11px] text-slate-400">
                    Reviewer actions continuously evaluate threshold boundary precision.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="p-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {feedbackLoading ? (
                <div className="py-12 flex justify-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">Total Reviewed</div>
                      <div className="text-xl font-bold font-mono text-white mt-1">
                        {feedbackSummary?.total_reviewed || 0}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <div className="text-[10px] text-emerald-400 uppercase font-mono">Confirmed Fraud</div>
                      <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                        {feedbackSummary?.total_confirmed_fraud || 0}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <div className="text-[10px] text-amber-400 uppercase font-mono">Overall Precision</div>
                      <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                        {((feedbackSummary?.overall_precision || 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Tag-Specific Performance &amp; Adaptive Tuning Recommendations
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="py-2.5 px-3">Threat Tag</th>
                            <th className="py-2.5 px-3">Classification</th>
                            <th className="py-2.5 px-3 text-right">Confirmed</th>
                            <th className="py-2.5 px-3 text-right">False Pos</th>
                            <th className="py-2.5 px-3 text-right">Precision</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-[11px] font-mono">
                          {(feedbackSummary?.tag_feedback || []).map((item, idx) => (
                            <React.Fragment key={idx}>
                              <tr className="hover:bg-slate-900/40">
                                <td className="py-2.5 px-3 font-semibold text-slate-200">
                                  {item.threat_tag}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">{item.classification}</td>
                                <td className="py-2.5 px-3 text-right text-emerald-400">
                                  {item.confirmed_fraud_count}
                                </td>
                                <td className="py-2.5 px-3 text-right text-rose-400">
                                  {item.false_positive_count}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-amber-300">
                                  {(item.observed_precision * 100).toFixed(0)}%
                                </td>
                              </tr>
                              {item.suggested_threshold_nudge && (
                                <tr className="bg-amber-500/5">
                                  <td colSpan={5} className="py-2 px-3 text-[11px] text-amber-300/90 font-sans">
                                    <div className="flex items-center gap-1.5">
                                      <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                      <span><strong>Suggested Nudge:</strong> {item.suggested_threshold_nudge}</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="text-xs">Loading Case Management Console...</span>
        </div>
      }
    >
      <CasesContent />
    </Suspense>
  );
}
