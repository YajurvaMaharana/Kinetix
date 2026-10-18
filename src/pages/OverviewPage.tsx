import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  MOCK_STATS,
  MOCK_ALERTS,
  MOCK_PENDING_PAYOUTS,
  PayoutApproval,
  FleetAlert,
} from "@/data/mockData";
import {
  ShieldAlert,
  Activity,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  TrendingUp,
  Clock,
} from "lucide-react";

export default function OverviewPage() {
  const { role, canDeployPolicies, canApprovePayouts, isReadOnly } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState("7d");
  const [alerts, setAlerts] = useState<FleetAlert[]>(MOCK_ALERTS);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutApproval[]>(MOCK_PENDING_PAYOUTS);

  const handlePayoutAction = (id: string, action: "release" | "block") => {
    if (isReadOnly) {
      showToast({
        type: "warning",
        title: "Action Restricted",
        message: "Auditor role has read-only permissions.",
      });
      return;
    }

    setPendingPayouts((prev) => prev.filter((p) => p.id !== id));
    showToast({
      type: action === "release" ? "success" : "error",
      title: action === "release" ? "Payout Released" : "Payout Blocked & Flagged",
      message:
        action === "release"
          ? "Funds dispatched to courier instant wallet."
          : "Payout quarantined and security case opened.",
    });
  };

  const handleExport = () => {
    showToast({
      type: "info",
      title: "Ledger Export Initiated",
      message: "Generating cryptographically signed audit ledger for the past 7 days.",
    });
  };

  const handleDeployPolicy = () => {
    if (!canDeployPolicies) {
      showToast({
        type: "warning",
        title: "Permission Required",
        message: "Only Admin role can deploy new risk policies. Switch to Admin in the top bar.",
      });
      return;
    }
    navigate("/money/policies");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Autonomous Ecosystem Integrity"
        title="Fleet Fraud & Payout Command Center"
        subtitle="Live risk orchestration across 18 delivery hubs • Real-time telemetry synced 3s ago"
        secondaryAction={{
          label: "Export Audit Ledger",
          icon: Download,
          onClick: handleExport,
        }}
        primaryAction={{
          label: "Deploy New Policy",
          icon: Sparkles,
          onClick: handleDeployPolicy,
          disabled: !canDeployPolicies,
          variant: "primary",
        }}
      />

      {/* Segmented Time Range Tabs */}
      <SegmentedTabs
        tabs={[
          { id: "today", label: "Today" },
          { id: "7d", label: "Last 7 Days (Active)" },
          { id: "30d", label: "Last 30 Days" },
          { id: "custom", label: "Custom Range" },
        ]}
        activeTab={timeRange}
        onChange={setTimeRange}
      />

      {/* 4 Key Metrics Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
              Total Active Couriers
            </span>
            <span className="p-2 rounded-xl bg-[var(--status-allow)]/15 text-[var(--status-allow)]">
              🚴
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            {MOCK_STATS.totalActiveCouriers}
          </div>
          <div className="mt-2 text-xs font-bold text-[var(--status-allow)] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{MOCK_STATS.activeCouriersGrowth}</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
              Collusion Rings Intercepted
            </span>
            <span className="p-2 rounded-xl bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]">
              🛡️
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            {MOCK_STATS.collusionRings}
          </div>
          <div className="mt-2 text-xs font-semibold text-[var(--muted)]">
            <span className="text-[var(--status-escalate)] font-bold">3 High Priority</span> isolated by AI
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
              Payouts Under Review
            </span>
            <span className="p-2 rounded-xl bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]">
              ⏳
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            {MOCK_STATS.payoutsUnderReview}
          </div>
          <div className="mt-2 text-xs font-semibold text-[var(--muted)]">
            <span className="text-[var(--status-challenge)] font-bold">
              {pendingPayouts.length} pending
            </span> active challenges
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
              Automated Release Rate
            </span>
            <span className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              ✨
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            {MOCK_STATS.automatedReleaseRate}
          </div>
          <div className="mt-2 text-xs font-semibold text-[var(--muted)]">
            <span className="text-[var(--status-allow)] font-bold">0.02% dispute</span> appeal index
          </div>
        </div>
      </div>

      {/* Middle Split View: Live Risk Trajectory Chart & Pending Payout Approvals */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Live Risk Trajectory & Anomaly Frequency (24h) */}
        <div className="lg:col-span-8 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-extrabold text-base text-[var(--ink)]">
                  Live Risk Trajectory &amp; Anomaly Frequency (24h)
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Telemetry streams evaluated across GPS shifts, batching cadence, &amp; device MAC vectors
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-allow)]" /> Nominal Flow
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-challenge)]" /> Challenge Queue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-escalate)]" /> Spoof Spikes
                </span>
              </div>
            </div>

            {/* SVG Chart Visualization */}
            <div className="h-64 bg-[var(--surface-alt)] rounded-xl border border-[var(--border-subtle)] relative p-4 flex items-end">
              <div className="absolute inset-x-4 inset-y-4 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-[var(--ink)]/40 w-full" />
                <div className="border-b border-[var(--ink)]/40 w-full" />
                <div className="border-b border-[var(--ink)]/40 w-full" />
                <div className="border-b border-[var(--ink)]/40 w-full" />
              </div>

              <svg
                className="absolute inset-0 w-full h-full p-4 overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 600 200"
              >
                {/* Nominal Flow Line */}
                <path
                  d="M 0 150 Q 150 130 300 110 T 600 90"
                  fill="none"
                  stroke="var(--status-allow)"
                  strokeWidth="3"
                />
                {/* Challenge Queue Line */}
                <path
                  d="M 0 180 Q 150 160 300 130 T 600 120"
                  fill="none"
                  stroke="var(--status-challenge)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                {/* Spoof Spikes Line */}
                <path
                  d="M 0 190 Q 200 190 320 80 Q 380 40 450 150 T 600 180"
                  fill="none"
                  stroke="var(--status-escalate)"
                  strokeWidth="3"
                />
              </svg>

              {/* Callout Badge 1 */}
              <div className="absolute top-12 left-[52%] bg-[var(--surface)] rounded-xl shadow-plum p-2.5 border border-[var(--border)] text-[10px]">
                <div className="font-bold text-[var(--ink)]">14:22 UTC • Ring Spoof Burst</div>
                <div className="text-[var(--muted)]">6 Device Spoofs Detected</div>
              </div>

              {/* Callout Badge 2 */}
              <div className="absolute top-6 right-8 bg-[var(--surface)] rounded-xl shadow-plum p-2.5 border border-[var(--border)] text-[10px]">
                <div className="font-bold text-[var(--status-escalate)]">19:40 UTC • Mock GPS Burst</div>
                <div className="text-[var(--muted)]">Velocity Vector &gt; 140km/h</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between text-xs text-[var(--muted)] font-semibold pt-4 mt-4 border-t border-[var(--border-subtle)]">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00 (Peak Shift)</span>
            <span>20:00</span>
            <span>Now</span>
          </div>
        </div>

        {/* Right: Pending Payout Approvals & Collusion Radar */}
        <div className="lg:col-span-4 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-base text-[var(--ink)]">
                Pending Payout Approvals ({pendingPayouts.length})
              </h3>
              <span className="text-[11px] font-mono font-bold text-[var(--status-challenge)] bg-[var(--status-challenge)]/10 px-2.5 py-0.5 rounded-full">
                Next ACH: 42m
              </span>
            </div>

            <div className="space-y-3">
              {pendingPayouts.length === 0 ? (
                <div className="text-center py-10 text-xs text-[var(--muted)]">
                  <CheckCircle2 className="w-8 h-8 text-[var(--status-allow)] mx-auto mb-2" />
                  All pending payouts have been successfully cleared.
                </div>
              ) : (
                pendingPayouts.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-extrabold text-[var(--ink)]">
                        ${item.amount.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === "IBAN Conflict"
                            ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                            : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      {item.reason}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        onClick={() => handlePayoutAction(item.id, "release")}
                        disabled={isReadOnly}
                        className="py-1.5 rounded-full bg-[var(--status-allow)] hover:bg-[#28ab80] text-white font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        Release
                      </button>
                      <button
                        onClick={() => handlePayoutAction(item.id, "block")}
                        disabled={isReadOnly}
                        className="py-1.5 rounded-full bg-[var(--status-escalate)] hover:bg-[#d43f44] text-white font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        Block &amp; Flag
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Multi-Agent Collusion Radar link */}
          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Multi-Agent Collusion Radar</span>
              </h4>
              <span className="text-[10px] font-mono text-[var(--muted)]">Graph Analysis</span>
            </div>
            <p className="text-[11px] text-[var(--muted)] mb-3">
              Graph analysis isolating 4 interconnected courier nodes sharing device UUIDs &amp; delivery endpoints.
            </p>
            <Link
              to="/monitor/graph"
              className="w-full py-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--primary)] font-bold text-xs hover:bg-[var(--lavender)] transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Open Graph Inspector</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Fleet Alerts & Triage Queue Table */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-lg text-[var(--ink)]">
                Recent Fleet Alerts &amp; Triage Queue
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">
                5 Priority
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Real-time anomalous courier sessions requiring automated or human adjudication
            </p>
          </div>

          <Link
            to="/cases/investigations"
            className="px-4 py-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] text-xs font-bold hover:bg-[var(--lavender)] transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>View Full Investigation Dossier</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[var(--primary)]" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                <th className="pb-3 px-4">Courier ID &amp; Name</th>
                <th className="pb-3 px-4">Route Hub</th>
                <th className="pb-3 px-4">Risk Factor Detected</th>
                <th className="pb-3 px-4">AI Risk</th>
                <th className="pb-3 px-4">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs font-semibold">
              {alerts.map((al) => (
                <tr key={al.id} className="hover:bg-[var(--surface-alt)]/60 transition-colors">
                  <td className="py-3.5 px-4 flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                        al.status === "Allow"
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : al.status === "Challenge"
                          ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                          : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                      }`}
                    >
                      {al.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="font-extrabold text-[var(--ink)]">{al.name}</div>
                      <div className="text-[10px] font-mono text-[var(--muted)]">{al.courier_id}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[var(--muted)]">{al.hub}</td>
                  <td className="py-3.5 px-4 text-[var(--ink)] font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-escalate)]" />
                    <span>{al.risk_factor}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono font-extrabold ${
                        al.ai_risk > 70
                          ? "text-[var(--status-escalate)]"
                          : al.ai_risk > 40
                          ? "text-[var(--status-challenge)]"
                          : "text-[var(--status-allow)]"
                      }`}
                    >
                      {al.ai_risk}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                        al.status === "Allow"
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : al.status === "Challenge"
                          ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                          : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          al.status === "Allow"
                            ? "bg-[var(--status-allow)]"
                            : al.status === "Challenge"
                            ? "bg-[var(--status-challenge)]"
                            : "bg-[var(--status-escalate)]"
                        }`}
                      />
                      {al.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equilibrium Core Banner at Bottom */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center font-bold text-xl shadow-sm">
            🛡️
          </div>
          <div>
            <h4 className="font-extrabold text-base text-[var(--ink)]">
              Kinetics Equilibrium Core Active
            </h4>
            <p className="text-xs text-[var(--muted)]">
              Continuous multi-tenant fraud guardian shielding $3.2M in daily gig worker disbursements.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-bold shrink-0">
          <div>
            <div className="text-[var(--muted)] text-[10px]">Engine Latency</div>
            <div className="text-[var(--ink)] font-mono text-sm">18ms</div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[var(--status-allow)]/15 text-[var(--status-allow)] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>High Fidelity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
