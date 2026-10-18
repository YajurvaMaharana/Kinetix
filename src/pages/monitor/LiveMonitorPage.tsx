import React, { useState, useEffect, useRef, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  fetchInitialLiveEvents,
  overrideSessionDecision,
  escalateSessionToCase,
  forceSessionChallenge,
  LiveStreamEvent,
} from "@/api/endpoints";
import {
  Activity,
  Play,
  Pause,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  Smartphone,
  Navigation,
  Radio,
  Zap,
  ArrowUpRight,
  TrendingUp,
  Clock,
  MapPin,
  Flame,
} from "lucide-react";

// Mini SVG Sparkline Component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 28;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="w-24 h-7 overflow-visible shrink-0" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function LiveMonitorPage() {
  const { role, canManageCases, isReadOnly } = useAuth();
  const { showToast } = useToast();

  // Live Stream State
  const [events, setEvents] = useState<LiveStreamEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());

  // Filter States
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | "ALLOW" | "CHALLENGE" | "ESCALATE">("ALL");
  const [hubFilter, setHubFilter] = useState<string>("ALL");
  const [riskRangeFilter, setRiskRangeFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Action Loading State
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Selected Event
  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0] || null;
  }, [events, selectedEventId]);

  // Load initial events
  useEffect(() => {
    let mounted = true;
    async function init() {
      const initial = await fetchInitialLiveEvents();
      if (mounted) {
        setEvents(initial);
        if (initial.length > 0) {
          setSelectedEventId(initial[0].id);
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Live Stream Generator / Polling Simulation (capped at 200 items FIFO)
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      if (document.hidden) return; // pause if tab is hidden

      const hubs = ["North Hub", "Downtown", "East Sector", "Metro Core", "South Bay"];
      const names = [
        { name: "Alex Rivera", rider_id: "CR-8941" },
        { name: "Tariq Vance", rider_id: "CR-9023" },
        { name: "Elena Rostova", rider_id: "CR-7812" },
        { name: "Kenji Sato", rider_id: "CR-6650" },
        { name: "David Kim", rider_id: "CR-5542" },
        { name: "Marcus Chen", rider_id: "CR-3319" },
        { name: "Aria Thorne", rider_id: "CR-4402" },
        { name: "Devon Miller", rider_id: "CR-7721" },
      ];
      const eventTypes = [
        "KINEMATICS_40HZ",
        "VELOCITY_CHECK",
        "DEVICE_PASSPORT",
        "COLLUSION_PROBE",
        "GEO_HOP",
        "PAYOUT_GATE",
      ];

      const chosenCourier = names[Math.floor(Math.random() * names.length)];
      const chosenHub = hubs[Math.floor(Math.random() * hubs.length)];
      const chosenType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      // Generate realistic risk score and verdict
      let riskScore = Math.floor(Math.random() * 100);
      let decision: "ALLOW" | "CHALLENGE" | "ESCALATE" = "ALLOW";
      let speed = Math.floor(18 + Math.random() * 25);

      if (chosenType === "VELOCITY_CHECK" || chosenType === "GEO_HOP") {
        if (Math.random() > 0.4) {
          riskScore = Math.floor(82 + Math.random() * 16);
          decision = "ESCALATE";
          speed = Math.floor(130 + Math.random() * 60);
        } else {
          riskScore = Math.floor(50 + Math.random() * 20);
          decision = "CHALLENGE";
        }
      } else if (chosenType === "COLLUSION_PROBE" || chosenType === "DEVICE_PASSPORT") {
        if (Math.random() > 0.5) {
          riskScore = Math.floor(55 + Math.random() * 22);
          decision = "CHALLENGE";
        } else {
          riskScore = Math.floor(10 + Math.random() * 25);
          decision = "ALLOW";
        }
      } else {
        riskScore = Math.floor(8 + Math.random() * 24);
        decision = "ALLOW";
      }

      const newId = `evt_${Date.now()}`;
      const newEvent: LiveStreamEvent = {
        id: newId,
        session_id: `sess_${Date.now().toString().slice(-6)}`,
        rider_id: chosenCourier.rider_id,
        rider_name: chosenCourier.name,
        event_type: chosenType,
        hub: chosenHub,
        risk_score: riskScore,
        decision,
        speed_kmh: speed,
        timestamp: new Date().toISOString(),
        device_info: {
          model: decision === "ESCALATE" ? "Xiaomi Redmi 12 (Rooted)" : "iPhone 15 Pro",
          os: decision === "ESCALATE" ? "Android 13" : "iOS 18.2",
          carrier: "T-Mobile US",
          ip_masked: "198.51.100.••",
          mock_location: decision === "ESCALATE",
          rooted: decision === "ESCALATE",
          battery_drain: `${(3.5 + Math.random() * 8).toFixed(1)}%/hr`,
        },
        signals: [
          {
            name: "Kinematic Trajectory",
            weight: 35,
            score: riskScore,
            impact: decision === "ALLOW" ? "POSITIVE" : "NEGATIVE",
            detail: `${speed} km/h recorded along ${chosenHub} delivery corridor.`,
          },
          {
            name: "Hardware Passport",
            weight: 35,
            score: decision === "ESCALATE" ? 90 : 15,
            impact: decision === "ALLOW" ? "POSITIVE" : "NEGATIVE",
            detail: decision === "ESCALATE" ? "Root binary & mock provider flags active." : "Cryptographic hardware signature authentic.",
          },
          {
            name: "Collusion Association",
            weight: 30,
            score: decision === "ESCALATE" ? 75 : 20,
            impact: "NEUTRAL",
            detail: "Analyzed bipartite entity linkage to banking and device pools.",
          },
        ],
        route: {
          distance_km: Number((2.5 + Math.random() * 12).toFixed(1)),
          waypoints: [
            { x: 15, y: 30 + Math.random() * 40 },
            { x: 55, y: 20 + Math.random() * 50 },
            { x: 110, y: 40 + Math.random() * 40 },
            { x: 170, y: 25 + Math.random() * 40 },
          ],
          speed_vector: `${speed} km/h (${decision === "ESCALATE" ? "Peak Anomaly" : "Normal Flow"})`,
          compliance_pct: decision === "ALLOW" ? 99.2 : decision === "CHALLENGE" ? 78.4 : 14.2,
        },
      };

      setEvents((prev) => {
        const next = [newEvent, ...prev].slice(0, 200); // Strict last 200 events FIFO
        return next;
      });

      // Highlight new row momentarily
      setNewRowIds((prev) => new Set(prev).add(newId));
      setTimeout(() => {
        setNewRowIds((prev) => {
          const updated = new Set(prev);
          updated.delete(newId);
          return updated;
        });
      }, 1500);
    }, 2800);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Decision filter
      if (decisionFilter !== "ALL" && e.decision !== decisionFilter) return false;
      // Hub filter
      if (hubFilter !== "ALL" && e.hub !== hubFilter) return false;
      // Risk range filter
      if (riskRangeFilter === "HIGH" && e.risk_score <= 70) return false;
      if (riskRangeFilter === "MEDIUM" && (e.risk_score < 40 || e.risk_score > 70)) return false;
      if (riskRangeFilter === "LOW" && e.risk_score >= 40) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRider = e.rider_name.toLowerCase().includes(q) || e.rider_id.toLowerCase().includes(q);
        const matchHub = e.hub.toLowerCase().includes(q);
        const matchType = e.event_type.toLowerCase().includes(q);
        if (!matchRider && !matchHub && !matchType) return false;
      }
      return true;
    });
  }, [events, decisionFilter, hubFilter, riskRangeFilter, searchQuery]);

  // Actions on Selected Event
  const handleEscalateToCase = async () => {
    if (!selectedEvent) return;
    if (isReadOnly) {
      showToast({
        type: "warning",
        title: "Action Restricted",
        message: "Auditor role has read-only access.",
      });
      return;
    }

    setActionInProgress("escalate");
    try {
      const res = await escalateSessionToCase(
        selectedEvent.session_id,
        selectedEvent.rider_id,
        `Flagged via Live Stream: ${selectedEvent.event_type} (${selectedEvent.speed_kmh} km/h) at ${selectedEvent.hub}`
      );

      // Update local event state
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === selectedEvent.id ? { ...ev, decision: "ESCALATE", risk_score: Math.max(ev.risk_score, 88) } : ev
        )
      );

      showToast({
        type: "error",
        title: "Escalated to Investigation Case",
        message: `${res.case_id} registered. Courier payouts placed on escrow hold.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Escalation Failed",
        message: err.message,
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleForceChallenge = async (challengeType: "FACE_LIVENESS" | "OTP") => {
    if (!selectedEvent) return;
    if (isReadOnly) {
      showToast({
        type: "warning",
        title: "Action Restricted",
        message: "Auditor role has read-only access.",
      });
      return;
    }

    setActionInProgress("challenge");
    try {
      const res = await forceSessionChallenge(selectedEvent.session_id, selectedEvent.rider_id, challengeType);

      setEvents((prev) =>
        prev.map((ev) => (ev.id === selectedEvent.id ? { ...ev, decision: "CHALLENGE" } : ev))
      );

      showToast({
        type: "warning",
        title: `Challenge Dispatched: ${challengeType}`,
        message: `Step-up verification challenge sent to courier ${selectedEvent.rider_id}.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Challenge Failed",
        message: err.message,
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkSafe = async () => {
    if (!selectedEvent) return;
    if (isReadOnly) {
      showToast({
        type: "warning",
        title: "Action Restricted",
        message: "Auditor role has read-only access.",
      });
      return;
    }

    setActionInProgress("safe");
    try {
      await overrideSessionDecision(
        selectedEvent.session_id,
        "ALLOW",
        `Analyst ${role} marked session safe after manual review.`
      );

      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === selectedEvent.id ? { ...ev, decision: "ALLOW", risk_score: 10 } : ev
        )
      );

      showToast({
        type: "success",
        title: "Decision Overridden: ALLOW",
        message: `Session marked safe. Full earnings dispatch restored for courier ${selectedEvent.rider_id}.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Override Failed",
        message: err.message,
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Format relative time helper
  const formatTimeAgo = (iso: string) => {
    const diffSeconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    return `${diffMinutes}m ago`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Live Telemetry Ingestion"
        title="Live Telemetry & Anomaly Stream"
        subtitle="Real-time 40Hz sensor fusion, GNSS velocity vectors, and autonomous triage decisions"
        primaryAction={{
          label: isPaused ? "Resume Live Stream" : "Pause Stream",
          icon: isPaused ? Play : Pause,
          onClick: () => setIsPaused(!isPaused),
          variant: isPaused ? "primary" : "secondary",
        }}
      />

      {/* TOP: 4 Compact Live KPI Cards with Sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Events / Min */}
        <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
              Events / Min
            </div>
            <div className="text-2xl font-extrabold text-[var(--ink)] mt-0.5">
              142 <span className="text-xs font-semibold text-[var(--muted)]">evt/m</span>
            </div>
            <div className="text-[10px] font-bold text-[var(--status-allow)] flex items-center gap-1 mt-1">
              <span>↑ +8.4%</span> vs peak hour
            </div>
          </div>
          <Sparkline data={[24, 30, 28, 42, 38, 55, 60, 52, 68]} color="var(--primary)" />
        </div>

        {/* Card 2: Challenge Rate */}
        <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
              Challenge Rate
            </div>
            <div className="text-2xl font-extrabold text-[var(--status-challenge)] mt-0.5">
              3.8%
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-1">
              Friction within SLA (&lt; 5%)
            </div>
          </div>
          <Sparkline data={[4.5, 4.2, 3.9, 4.8, 3.6, 3.8, 3.5, 4.0, 3.8]} color="var(--status-challenge)" />
        </div>

        {/* Card 3: Escalations */}
        <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
              Escalations
            </div>
            <div className="text-2xl font-extrabold text-[var(--status-escalate)] mt-0.5">
              0.8%
            </div>
            <div className="text-[10px] text-[var(--status-escalate)] font-semibold mt-1">
              Quarantined syndicates
            </div>
          </div>
          <Sparkline data={[1.2, 1.0, 0.9, 1.4, 0.8, 0.7, 0.9, 0.6, 0.8]} color="var(--status-escalate)" />
        </div>

        {/* Card 4: Avg Decision Time */}
        <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
              Avg Decision Time
            </div>
            <div className="text-2xl font-extrabold text-[var(--ink)] mt-0.5">
              16.4 <span className="text-xs font-semibold text-[var(--muted)]">ms</span>
            </div>
            <div className="text-[10px] text-[var(--status-allow)] font-bold mt-1">
              Sub-50ms P99 guaranteed
            </div>
          </div>
          <Sparkline data={[18, 17, 16, 19, 15, 17, 16, 15, 16.4]} color="var(--status-allow)" />
        </div>
      </div>

      {/* MAIN SPLIT VIEW: Left (2/3) Live Event Table + Right (1/3) Detail Drawer */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (2/3): Live Event Stream Table & Controls */}
        <div className="lg:col-span-8 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden flex flex-col">
          {/* Controls Bar */}
          <div className="p-4 border-b border-[var(--border-subtle)] space-y-3 bg-[var(--surface)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search courier, hub, or event type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-full pl-9 pr-4 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>

              {/* Status and Pause Indicator */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isPaused
                      ? "bg-amber-500/15 text-amber-700 border border-amber-300"
                      : "bg-[var(--status-allow)]/15 text-[var(--status-allow)] border border-[var(--status-allow)]/30"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPaused ? "bg-amber-500" : "bg-[var(--status-allow)] animate-pulse"
                    }`}
                  />
                  <span>{isPaused ? "Stream Paused" : "Live Streaming"}</span>
                </button>

                <span className="text-[11px] font-mono font-bold text-[var(--muted)] bg-[var(--surface-alt)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
                  {filteredEvents.length} / {events.length} Buffered
                </span>
              </div>
            </div>

            {/* Filter Pills & Selectors */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs font-bold">
              {/* Decision Tabs */}
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-1 rounded-full border border-[var(--border-subtle)]">
                {(["ALL", "ALLOW", "CHALLENGE", "ESCALATE"] as const).map((dec) => (
                  <button
                    key={dec}
                    onClick={() => setDecisionFilter(dec)}
                    className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                      decisionFilter === dec
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {dec === "ALL" ? "All Decisions" : dec}
                  </button>
                ))}
              </div>

              {/* Hub Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={hubFilter}
                  onChange={(e) => setHubFilter(e.target.value)}
                  className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-full px-3 py-1 text-[11px] text-[var(--ink)] focus:outline-none"
                >
                  <option value="ALL">All Hubs (18)</option>
                  <option value="North Hub">North Hub</option>
                  <option value="Downtown">Downtown</option>
                  <option value="East Sector">East Sector</option>
                  <option value="Metro Core">Metro Core</option>
                  <option value="South Bay">South Bay</option>
                </select>

                {/* Risk Range Dropdown */}
                <select
                  value={riskRangeFilter}
                  onChange={(e) => setRiskRangeFilter(e.target.value as any)}
                  className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-full px-3 py-1 text-[11px] text-[var(--ink)] focus:outline-none"
                >
                  <option value="ALL">All Risk Scores</option>
                  <option value="HIGH">High Risk (&gt;70%)</option>
                  <option value="MEDIUM">Medium (40-70%)</option>
                  <option value="LOW">Low Risk (&lt;40%)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[620px] overflow-y-auto divide-y divide-[var(--border-subtle)]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[var(--surface-alt)] text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider z-10">
                <tr>
                  <th className="py-2.5 px-3.5">Rider / Courier</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Hub</th>
                  <th className="py-2.5 px-3">Risk Score</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-xs font-semibold">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-[var(--muted)]">
                      No matching events found. Adjust filters or search query.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => {
                    const isSelected = selectedEvent?.id === ev.id;
                    const isNew = newRowIds.has(ev.id);

                    // Risk score color bar
                    const riskColor =
                      ev.risk_score > 70
                        ? "bg-[var(--status-escalate)]"
                        : ev.risk_score > 40
                        ? "bg-[var(--status-challenge)]"
                        : "bg-[var(--status-allow)]";

                    const riskTextColor =
                      ev.risk_score > 70
                        ? "text-[var(--status-escalate)]"
                        : ev.risk_score > 40
                        ? "text-[var(--status-challenge)]"
                        : "text-[var(--status-allow)]";

                    return (
                      <tr
                        key={ev.id}
                        onClick={() => setSelectedEventId(ev.id)}
                        className={`cursor-pointer transition-all duration-300 ${
                          isSelected
                            ? "bg-[var(--lavender)]"
                            : isNew
                            ? "bg-emerald-50/70"
                            : "hover:bg-[var(--surface-alt)]/60"
                        }`}
                      >
                        {/* 1. Rider */}
                        <td className="py-3 px-3.5 flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-[10px] shrink-0 ${
                              ev.decision === "ALLOW"
                                ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                                : ev.decision === "CHALLENGE"
                                ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                                : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                            }`}
                          >
                            {ev.rider_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-[var(--ink)] leading-snug">
                              {ev.rider_name}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--muted)]">{ev.rider_id}</div>
                          </div>
                        </td>

                        {/* 2. Event Type */}
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[10px] font-mono font-bold text-[var(--primary)]">
                            {ev.event_type}
                          </span>
                        </td>

                        {/* 3. Hub */}
                        <td className="py-3 px-3 text-[11px] text-[var(--muted)]">
                          {ev.hub}
                        </td>

                        {/* 4. Risk Score Bar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${riskColor} rounded-full`}
                                style={{ width: `${Math.min(100, ev.risk_score)}%` }}
                              />
                            </div>
                            <span className={`font-mono font-extrabold text-[11px] ${riskTextColor}`}>
                              {ev.risk_score}%
                            </span>
                          </div>
                        </td>

                        {/* 5. Decision Chip */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              ev.decision === "ALLOW"
                                ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                                : ev.decision === "CHALLENGE"
                                ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                                : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                ev.decision === "ALLOW"
                                  ? "bg-[var(--status-allow)]"
                                  : ev.decision === "CHALLENGE"
                                  ? "bg-[var(--status-challenge)]"
                                  : "bg-[var(--status-escalate)]"
                              }`}
                            />
                            {ev.decision}
                          </span>
                        </td>

                        {/* 6. Time */}
                        <td className="py-3 px-3 text-right text-[10px] font-mono text-[var(--muted)] whitespace-nowrap">
                          {formatTimeAgo(ev.timestamp)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (1/3): Detail Drawer for Selected Event */}
        {selectedEvent ? (
          <div className="lg:col-span-4 bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] shadow-soft space-y-5 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted)]">
                    <Radio className="w-3 h-3 text-[var(--primary)]" />
                    <span>SESSION {selectedEvent.session_id}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-[var(--ink)] mt-0.5">
                    {selectedEvent.rider_name}
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">
                    Courier ID: {selectedEvent.rider_id} • {selectedEvent.hub}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedEvent.decision === "ALLOW"
                      ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                      : selectedEvent.decision === "CHALLENGE"
                      ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                      : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                  }`}
                >
                  {selectedEvent.decision}
                </span>
              </div>

              {/* 1. Signal Contribution Breakdown */}
              <div className="mt-4 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Signal-Contribution Breakdown
                </span>

                <div className="space-y-2">
                  {selectedEvent.signals.map((sig, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--ink)]">{sig.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[var(--muted)]">
                            wt {sig.weight}%
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              sig.impact === "POSITIVE"
                                ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                                : sig.impact === "NEGATIVE"
                                ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {sig.impact}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] leading-relaxed">{sig.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Device Information */}
              <div className="mt-4 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[var(--primary)]" />
                    Device &amp; Handset Fingerprint
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      selectedEvent.device_info.mock_location
                        ? "text-[var(--status-escalate)]"
                        : "text-[var(--status-allow)]"
                    }`}
                  >
                    {selectedEvent.device_info.mock_location ? "SPOOF DETECTED" : "VERIFIED HARDWARE"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--muted)] pt-1">
                  <div>
                    <span className="block text-[10px] text-[var(--muted)]/70 uppercase">Handset</span>
                    <strong className="text-[var(--ink)]">{selectedEvent.device_info.model}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--muted)]/70 uppercase">Operating System</span>
                    <strong className="text-[var(--ink)]">{selectedEvent.device_info.os}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--muted)]/70 uppercase">Carrier &amp; IP</span>
                    <strong className="text-[var(--ink)]">{selectedEvent.device_info.carrier}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--muted)]/70 uppercase">Battery Drain</span>
                    <strong className="text-[var(--ink)]">{selectedEvent.device_info.battery_drain}</strong>
                  </div>
                </div>
              </div>

              {/* 3. Small GPS Route Map */}
              <div className="mt-4 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                  <span className="flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-[var(--primary)]" />
                    GPS Trajectory &amp; Speed Vector
                  </span>
                  <span className="font-mono text-[10px] text-[var(--primary)] font-bold">
                    {selectedEvent.route.compliance_pct}% Match
                  </span>
                </div>

                {/* SVG Route Visualization */}
                <div className="h-28 bg-[var(--surface)] rounded-lg border border-[var(--border-subtle)] p-2 relative overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 200 100">
                    {/* Simulated road grid lines */}
                    <line x1="0" y1="30" x2="200" y2="30" stroke="rgba(74,44,109,0.06)" strokeWidth="1" />
                    <line x1="0" y1="70" x2="200" y2="70" stroke="rgba(74,44,109,0.06)" strokeWidth="1" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(74,44,109,0.06)" strokeWidth="1" />
                    <line x1="150" y1="0" x2="150" y2="100" stroke="rgba(74,44,109,0.06)" strokeWidth="1" />

                    {/* Path */}
                    <polyline
                      fill="none"
                      stroke={selectedEvent.decision === "ESCALATE" ? "var(--status-escalate)" : "var(--primary)"}
                      strokeWidth="2.5"
                      strokeDasharray={selectedEvent.decision === "ESCALATE" ? "4 3" : "none"}
                      points={selectedEvent.route.waypoints.map((w) => `${w.x},${w.y}`).join(" ")}
                    />

                    {/* Waypoint circles */}
                    {selectedEvent.route.waypoints.map((w, i) => (
                      <circle
                        key={i}
                        cx={w.x}
                        cy={w.y}
                        r={i === 0 || i === selectedEvent.route.waypoints.length - 1 ? 4 : 2.5}
                        fill={
                          i === selectedEvent.route.waypoints.length - 1
                            ? "var(--status-allow)"
                            : "var(--primary)"
                        }
                      />
                    ))}
                  </svg>

                  <div className="absolute bottom-2 left-2 text-[10px] font-mono font-bold bg-[var(--surface)]/90 px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                    {selectedEvent.route.speed_vector}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Action Buttons: Escalate to case, Force challenge, Mark safe */}
            <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2">
              <div className="text-[10px] text-[var(--muted)] flex justify-between">
                <span>Adjudication Privileges:</span>
                <span className="font-bold text-[var(--ink)]">
                  {isReadOnly ? "Auditor (Read-Only)" : `${role} Authorized`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* 1. Mark Safe */}
                <button
                  onClick={handleMarkSafe}
                  disabled={isReadOnly || actionInProgress !== null || selectedEvent.decision === "ALLOW"}
                  className="py-2 px-2 rounded-xl bg-[var(--status-allow)] hover:bg-[#28ab80] text-white text-[11px] font-bold shadow-soft transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  title="Override verdict to Allow & release holds"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Mark Safe</span>
                </button>

                {/* 2. Force Challenge */}
                <button
                  onClick={() => handleForceChallenge("FACE_LIVENESS")}
                  disabled={isReadOnly || actionInProgress !== null || selectedEvent.decision === "CHALLENGE"}
                  className="py-2 px-2 rounded-xl bg-[var(--status-challenge)] hover:bg-[#e09419] text-white text-[11px] font-bold shadow-soft transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  title="Prompt courier for 3D liveness selfie"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Challenge</span>
                </button>

                {/* 3. Escalate to Case */}
                <button
                  onClick={handleEscalateToCase}
                  disabled={isReadOnly || actionInProgress !== null || selectedEvent.decision === "ESCALATE"}
                  className="py-2 px-2 rounded-xl bg-[var(--status-escalate)] hover:bg-[#d43f44] text-white text-[11px] font-bold shadow-soft transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  title="Create security investigation case and restrict payouts"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Escalate</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-4 bg-[var(--surface)] rounded-2xl p-8 border border-[var(--border)] shadow-soft text-center text-xs text-[var(--muted)]">
            Select an event from the live stream to inspect signal breakdown and trigger adjudication actions.
          </div>
        )}
      </div>
    </div>
  );
}
