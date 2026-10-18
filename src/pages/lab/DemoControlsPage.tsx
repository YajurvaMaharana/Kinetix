import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  seedDemo,
  resetDemo,
  triggerGpsSpoofScenario,
  triggerCollusionRingScenario,
  triggerAccountHandoffScenario,
  triggerFastForwardHoldScenario,
  updateSimulationSpeed,
  DemoActionResponse,
} from "@/api/endpoints";
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Database,
  Trash2,
  Sparkles,
  Zap,
  Users,
  Smartphone,
  FastForward,
  Play,
  RotateCcw,
  Sliders,
  Terminal,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
  Lock,
  Unlock,
  Radio,
  SlidersHorizontal,
  Info,
} from "lucide-react";

export interface ActivityLogEntry {
  id: string;
  category: "data" | "scenario" | "speed" | "system";
  action: string;
  label: string;
  timestamp: string;
  statusCode: number;
  durationMs: number;
  traceId: string;
  message: string;
  payload: Record<string, any>;
  expanded?: boolean;
}

const INITIAL_LOG_ENTRIES: ActivityLogEntry[] = [
  {
    id: "log_init_01",
    category: "system",
    action: "SYSTEM_INITIALIZE",
    label: "Telemetry Pipeline Boot",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString(),
    statusCode: 200,
    durationMs: 34,
    traceId: "trc_boot_8921a",
    message: "Kinetix event bus connected. Ingestion endpoint /api/v1/telemetry/stream ready.",
    payload: {
      engine_version: "2.4.0",
      active_workers: 4,
      buffer_capacity: 10000,
      protocol: "WebSocket / SSE Hybrid",
    },
  },
  {
    id: "log_init_02",
    category: "data",
    action: "SEED_BASELINE_VERIFIED",
    label: "State Verification",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toLocaleTimeString(),
    statusCode: 200,
    durationMs: 48,
    traceId: "trc_chk_3301f",
    message: "Verified 50 registered couriers across 18 regional hubs. Local SQLite database online.",
    payload: {
      registered_couriers: 50,
      active_escrow_holds: 8,
      collusion_clusters: 3,
    },
  },
];

export default function DemoControlsPage() {
  const { role, login, canRunDemoControls, isReadOnly, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Loading states
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Simulation speed state (1 to 50 events/sec)
  const [simSpeed, setSimSpeed] = useState<number>(5);
  const [isUpdatingSpeed, setIsUpdatingSpeed] = useState<boolean>(false);

  // Activity log state
  const [logs, setLogs] = useState<ActivityLogEntry[]>(INITIAL_LOG_ENTRIES);
  const [logFilter, setLogFilter] = useState<"all" | "data" | "scenario" | "speed">("all");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState<boolean>(false);

  // Destructive Confirmation Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetConfirmInput, setResetConfirmInput] = useState<string>("");
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll console when new entries arrive
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Helper to add a log entry
  const appendLog = (
    category: "data" | "scenario" | "speed" | "system",
    label: string,
    res: DemoActionResponse
  ) => {
    const newEntry: ActivityLogEntry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      category,
      action: res.action,
      label,
      timestamp: new Date().toLocaleTimeString(),
      statusCode: res.status_code,
      durationMs: res.duration_ms,
      traceId: res.trace_id,
      message: res.message,
      payload: res.details || {},
      expanded: false,
    };
    setLogs((prev) => [...prev, newEntry]);
  };

  // 1. DATA: Seed demo data
  const handleSeedDemoData = async () => {
    if (!canRunDemoControls) {
      showToast({
        type: "warning",
        title: "Admin Clearance Required",
        message: "Only Administrator role can seed demo database states.",
      });
      return;
    }

    setLoadingAction("seed");
    try {
      const res = await seedDemo();
      appendLog("data", "Seed Demo Data", res);
      showToast({
        type: "success",
        title: "Demo Data Seeded",
        message: res.message,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Seed Failed",
        message: err.message || "Failed to seed demo data.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. DATA: Reset all data (triggered from confirmation modal)
  const handleConfirmResetAllData = async () => {
    if (!canRunDemoControls) return;

    setIsResetting(true);
    try {
      const res = await resetDemo();
      appendLog("data", "Reset All Platform Data", res);
      showToast({
        type: "success",
        title: "Platform Database Purged",
        message: res.message,
      });
      setIsResetModalOpen(false);
      setResetConfirmInput("");
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Reset Failed",
        message: err.message || "Failed to reset demo database.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  // 3. SCENARIOS
  const handleInjectGpsSpoof = async () => {
    if (!canRunDemoControls) return;
    setLoadingAction("gps_spoof");
    try {
      const res = await triggerGpsSpoofScenario();
      appendLog("scenario", "Inject GPS-Spoof Event", res);
      showToast({
        type: "warning",
        title: "GPS-Spoof Injected",
        message: res.message,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Scenario Failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSpawnCollusionRing = async () => {
    if (!canRunDemoControls) return;
    setLoadingAction("collusion_ring");
    try {
      const res = await triggerCollusionRingScenario();
      appendLog("scenario", "Spawn Collusion Ring", res);
      showToast({
        type: "error",
        title: "Collusion Ring Active",
        message: res.message,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Scenario Failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTriggerAccountHandoff = async () => {
    if (!canRunDemoControls) return;
    setLoadingAction("account_handoff");
    try {
      const res = await triggerAccountHandoffScenario();
      appendLog("scenario", "Trigger Account Handoff", res);
      showToast({
        type: "warning",
        title: "Account Handoff Detected",
        message: res.message,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Scenario Failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFastForwardHold = async () => {
    if (!canRunDemoControls) return;
    setLoadingAction("fast_forward");
    try {
      const res = await triggerFastForwardHoldScenario();
      appendLog("scenario", "Fast-Forward 24-Hour Hold", res);
      showToast({
        type: "info",
        title: "Time Advanced +24 Hours",
        message: res.message,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Scenario Failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. SIMULATION SPEED
  const handleSpeedChange = async (newSpeed: number) => {
    setSimSpeed(newSpeed);
    setIsUpdatingSpeed(true);
    try {
      const res = await updateSimulationSpeed(newSpeed);
      appendLog("speed", `Update Simulation Velocity (${newSpeed} evt/s)`, res);
    } catch (err: any) {
      console.error("Failed to update speed:", err);
    } finally {
      setIsUpdatingSpeed(false);
    }
  };

  // Toggle log expansion
  const toggleLogExpand = (id: string) => {
    setLogs((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, expanded: !entry.expanded } : entry
      )
    );
  };

  // Copy entry payload
  const handleCopyLogPayload = (entry: ActivityLogEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(entry.payload, null, 2));
    setCopiedLogId(entry.id);
    setTimeout(() => setCopiedLogId(null), 1800);
  };

  // Copy all logs
  const handleCopyAllLogs = () => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  // Clear logs
  const handleClearLogs = () => {
    setLogs([]);
    showToast({
      type: "info",
      title: "Activity Log Cleared",
      message: "Console buffer cleared.",
    });
  };

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter === "all") return true;
    return l.category === logFilter;
  });

  // Calculate throughput
  const throughputPerMin = simSpeed * 60;
  const realtimeMultiplier = (simSpeed / 5).toFixed(1);

  // =========================================================================
  // ACCESS RESTRICTED SCREEN (If not Admin)
  // =========================================================================
  if (role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <PageHeader
          badge="Security Clearance"
          title="Demo Controls & Scenario Lab"
          subtitle="Direct orchestration console for simulated fraud vectors and database states."
        />

        <div className="max-w-2xl mx-auto my-8 bg-white border border-rose-200 rounded-3xl p-8 sm:p-10 shadow-plum text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-mono font-bold tracking-wider uppercase">
              Admin Clearance Only (Role Restricted)
            </div>
            <h2 className="text-2xl font-black text-[var(--ink)] tracking-tight">
              Administrator Clearance Required
            </h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed max-w-lg mx-auto">
              The Demo Control Room grants direct execution authorization to wipe
              the SQLite database, trigger synthetic collusion rings, and modulate
              Kafka pipeline event dispatch velocity. Your current session is authenticated
              as <strong className="text-[var(--ink)]">{user?.name || "Guest"}</strong> ({role || "Unauthenticated"}).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-left flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold block text-amber-950 mb-0.5">
                Evaluation & Lab Testing Override
              </span>
              You can instantly switch to the <strong>Administrator</strong> persona
              below to test the live control room, synthetic triggers, and database seeding.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={async () => {
                try {
                  await login("admin@kinetics.demo", "Admin@123");
                  showToast({
                    type: "success",
                    title: "Authenticated as Admin",
                    message: "Granted full access to Lab Demo Controls as Elena Rostova.",
                  });
                } catch (err: any) {
                  showToast({
                    type: "error",
                    title: "Authentication Failed",
                    message: err.message || "Failed to switch to Admin.",
                  });
                }
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm shadow-plum transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock className="w-4 h-4 text-[var(--support)]" />
              Switch to Administrator (Elena Rostova)
            </button>
            <button
              onClick={() => navigate("/overview")}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
            >
              Return to Overview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ADMIN CONTROL ROOM VIEW
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        badge="SYS_ADMIN // KINETICS CONTROL ROOM"
        title="Demo Controls & Scenario Lab"
        subtitle="Orchestrate synthetic threats, modulate telemetry streams, and manage platform database states."
        primaryAction={{
          label: "Seed Demo Data",
          icon: Database,
          onClick: handleSeedDemoData,
          loading: loadingAction === "seed",
          variant: "primary",
        }}
        secondaryAction={{
          label: "Purge / Reset Database",
          icon: Trash2,
          onClick: () => setIsResetModalOpen(true),
          disabled: isReadOnly,
        }}
      />

      {/* Control Room Live Status Bar */}
      <div className="bg-[#0B101B] border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-300 shadow-plum flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-bold tracking-wider">
              CONTROL ROOM ACTIVE
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>ROLE:</span>
            <strong className="text-white">ADMIN ({user?.name || "Elena Rostova"})</strong>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>ENGINE:</span>
            <span className="text-cyan-300">v2.4 (Random Forest + Kinematics)</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>DATA STORE:</span>
            <span className="text-amber-300">Local SQLite / Fixture DB</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-300 font-semibold">
            {simSpeed} evt/s ({realtimeMultiplier}x)
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-semibold">
            ~{throughputPerMin} evt/min
          </span>
        </div>
      </div>

      {/* Main Control Room Layout: Left Grouped Cards (7 cols) + Right Activity Log Console (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: GROUPED CARDS (Data, Scenario Triggers, Simulation Speed)    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* ------------------------------------------------------------- */}
          {/* GROUP 1: DATA CONTROLS (Seed demo data, Reset all data)       */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-3xl border border-[var(--border)] p-6 sm:p-7 shadow-soft space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[var(--primary)] flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--ink)]">
                    Data Controls
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Baseline scenario fixtures and zero-state platform reset
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-[var(--primary)] text-[11px] font-mono font-bold border border-purple-200">
                DATABASE STATE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Seed Demo Data Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3 hover:border-purple-300 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[var(--primary)] font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Seed Demo Data</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Injects 50 baseline couriers, 3 collusion syndicates, 8 held payouts,
                    and 12,500 telemetry coordinates.
                  </p>
                </div>

                <button
                  onClick={handleSeedDemoData}
                  disabled={loadingAction !== null}
                  className="w-full py-2.5 px-4 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === "seed" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Seeding Baseline...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5 text-[var(--support)]" />
                      <span>Seed Demo Data</span>
                    </>
                  )}
                </button>
              </div>

              {/* Reset All Data Card (Destructive -> Confirmation Modal) */}
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col justify-between space-y-3 hover:border-rose-300 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Reset All Data</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 font-bold ml-auto">
                      Destructive
                    </span>
                  </div>
                  <p className="text-xs text-rose-900/80 leading-relaxed">
                    Drops all simulated fraud cases, purges transient telemetry buffers,
                    and restores clean zero-state database.
                  </p>
                </div>

                <button
                  onClick={() => setIsResetModalOpen(true)}
                  disabled={loadingAction !== null}
                  className="w-full py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset All Data...</span>
                </button>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* GROUP 2: SCENARIO TRIGGERS                                   */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-3xl border border-[var(--border)] p-6 sm:p-7 shadow-soft space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--ink)]">
                    Scenario Triggers
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Directly inject fraud vectors and operational anomalies into the live pipeline
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-mono font-bold border border-amber-200">
                THREAT INJECTION
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trigger 1: Inject a GPS-spoof event */}
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/90 flex flex-col justify-between space-y-3 hover:bg-amber-50 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                      <Zap className="w-4 h-4 text-amber-600" />
                      GPS-Spoof Event
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      SCORE: 96
                    </span>
                  </div>
                  <p className="text-xs text-amber-950/80 leading-relaxed">
                    Injects a 14.8km impossible teleportation hop in 3.4s (428 km/h).
                    Flags mock location provider and triggers payout escrow hold.
                  </p>
                </div>

                <button
                  onClick={handleInjectGpsSpoof}
                  disabled={loadingAction !== null}
                  className="w-full py-2.5 px-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === "gps_spoof" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Injecting Vector...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Inject GPS-Spoof</span>
                    </>
                  )}
                </button>
              </div>

              {/* Trigger 2: Spawn a collusion ring */}
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 flex flex-col justify-between space-y-3 hover:bg-purple-50 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-purple-900">
                      <Users className="w-4 h-4 text-purple-600" />
                      Collusion Ring
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                      5 NODES
                    </span>
                  </div>
                  <p className="text-xs text-purple-950/80 leading-relaxed">
                    Spawns 5-node syndicate (RING-409-ALPHA) sharing hardware
                    fingerprints with 18 ping-pong ghost orders.
                  </p>
                </div>

                <button
                  onClick={handleSpawnCollusionRing}
                  disabled={loadingAction !== null}
                  className="w-full py-2.5 px-3 rounded-full bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === "collusion_ring" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Spawning Ring...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Spawn Collusion Ring</span>
                    </>
                  )}
                </button>
              </div>

              {/* Trigger 3: Trigger an account handoff */}
              <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200 flex flex-col justify-between space-y-3 hover:bg-sky-50 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-sky-900">
                      <Smartphone className="w-4 h-4 text-sky-600" />
                      Account Handoff
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold">
                      DEVICE SWAP
                    </span>
                  </div>
                  <p className="text-xs text-sky-950/80 leading-relaxed">
                    Mid-shift credential transfer from iPhone to rooted Android 182km away.
                    Attestation fails; triggers biometric lock.
                  </p>
                </div>

                <button
                  onClick={handleTriggerAccountHandoff}
                  disabled={loadingAction !== null}
                  className="w-full py-2.5 px-3 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === "account_handoff" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Triggering Handoff...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Trigger Account Handoff</span>
                    </>
                  )}
                </button>
              </div>

              {/* Trigger 4: Fast-forward the 24-hour hold */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col justify-between space-y-3 hover:bg-emerald-50 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                      <FastForward className="w-4 h-4 text-emerald-600" />
                      Fast-Forward 24h Hold
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      +24 HOURS
                    </span>
                  </div>
                  <p className="text-xs text-emerald-950/80 leading-relaxed">
                    Advances platform clock +24h to evaluate escrow SLA timers.
                    Auto-releases eligible funds and alerts on SLA expirations.
                  </p>
                </div>

                <button
                  onClick={handleFastForwardHold}
                  disabled={loadingAction !== null}
                  className="w-full py-2.5 px-3 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === "fast_forward" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Advancing Clock...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Fast-Forward 24 Hours</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* GROUP 3: SIMULATION SPEED (Event-rate slider)                 */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-3xl border border-[var(--border)] p-6 sm:p-7 shadow-soft space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--ink)]">
                    Simulation Speed
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Adjust event-rate ingestion velocity across the live monitoring bus
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-mono font-bold border border-indigo-200">
                  {simSpeed} EVENTS / SEC
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-bold">
                  {realtimeMultiplier}x REALTIME
                </span>
              </div>
            </div>

            {/* Slider Control */}
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-[var(--ink)]">
                  <span>1 evt/s (Idle)</span>
                  <span className="text-[var(--primary)] text-sm font-mono font-extrabold">
                    {simSpeed} events/sec
                  </span>
                  <span>50 evt/s (Peak Burst)</span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={simSpeed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>

              {/* Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mr-1">
                  Speed Presets:
                </span>
                {[
                  { label: "1x (5 evt/s)", speed: 5 },
                  { label: "2x (10 evt/s)", speed: 10 },
                  { label: "4x (20 evt/s)", speed: 20 },
                  { label: "7x (35 evt/s)", speed: 35 },
                  { label: "10x (50 evt/s)", speed: 50 },
                ].map((preset) => (
                  <button
                    key={preset.speed}
                    onClick={() => handleSpeedChange(preset.speed)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      simSpeed === preset.speed
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Real-time telemetry metrics row */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs font-mono">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-[var(--muted)] uppercase font-sans">
                    Ingestion Throughput
                  </div>
                  <div className="text-sm font-black text-[var(--ink)] mt-0.5">
                    {throughputPerMin.toLocaleString()} / min
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-[var(--muted)] uppercase font-sans">
                    Buffer Latency
                  </div>
                  <div className="text-sm font-black text-emerald-600 mt-0.5">
                    {Math.max(1.2, +(18 / simSpeed).toFixed(1))} ms
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-[var(--muted)] uppercase font-sans">
                    Pipeline Mode
                  </div>
                  <div className="text-sm font-black text-indigo-600 mt-0.5">
                    {simSpeed > 25 ? "MICROBURST" : "CONTINUOUS"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: LIVE ACTIVITY LOG CONSOLE                                   */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-[#0A0E17] border border-slate-800 rounded-3xl shadow-plum overflow-hidden flex flex-col h-[780px]">
          {/* Console Header */}
          <div className="p-4 bg-[#0F1422] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              <div>
                <h4 className="text-xs font-mono font-bold text-slate-200 tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  LIVE ACTIVITY LOG CONSOLE
                </h4>
                <p className="text-[10px] text-slate-500 font-mono">
                  Listening for backend execution results
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAllLogs}
                title="Copy entire console log to clipboard"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors text-xs flex items-center gap-1 cursor-pointer"
              >
                {allCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleClearLogs}
                title="Clear console entries"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 transition-colors text-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Bar & Controls */}
          <div className="px-4 py-2.5 bg-[#0C111C] border-b border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 mr-1">FILTER:</span>
              {(["all", "data", "scenario", "speed"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setLogFilter(cat)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase cursor-pointer transition-colors ${
                    logFilter === cat
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span>Auto-scroll</span>
            </label>
          </div>

          {/* Log Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                <Terminal className="w-8 h-8 text-slate-700" />
                <p className="text-xs">No activity entries recorded for this filter.</p>
                <p className="text-[11px] text-slate-600">
                  Trigger a scenario or seed action on the left to stream events.
                </p>
              </div>
            ) : (
              filteredLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-[#0F1423] p-3 hover:border-slate-700 transition-all space-y-2"
                >
                  {/* Entry Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">
                        [{entry.timestamp}]
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                          entry.statusCode === 200
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-950/60 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {entry.statusCode} OK
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          entry.category === "scenario"
                            ? "bg-amber-950/60 text-amber-300"
                            : entry.category === "data"
                            ? "bg-purple-950/60 text-purple-300"
                            : entry.category === "speed"
                            ? "bg-indigo-950/60 text-indigo-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {entry.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] shrink-0">
                      <span>{entry.durationMs}ms</span>
                      <button
                        onClick={(e) => handleCopyLogPayload(entry, e)}
                        title="Copy JSON Payload"
                        className="hover:text-cyan-400 transition-colors p-0.5 cursor-pointer"
                      >
                        {copiedLogId === entry.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Summary Message */}
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {entry.message}
                  </p>

                  {/* Trace ID & Inspector Toggle */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="text-slate-500">
                      trace: <code className="text-slate-400">{entry.traceId}</code>
                    </span>

                    {entry.payload && Object.keys(entry.payload).length > 0 && (
                      <button
                        onClick={() => toggleLogExpand(entry.id)}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>{entry.expanded ? "Hide Payload" : "Inspect Payload"}</span>
                        {entry.expanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expandable JSON Payload */}
                  {entry.expanded && entry.payload && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[#070A11] border border-slate-800 text-[11px] text-slate-300 overflow-x-auto">
                      <pre className="font-mono text-[10.5px] leading-snug">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>

          {/* Console Footer Status */}
          <div className="p-3 bg-[#0B0F19] border-t border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>Buffer: {filteredLogs.length} events logged</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Ingestion Stream Synced
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL FOR DESTRUCTIVE ACTIONS ("Reset all data")             */}
      {/* ========================================================================= */}
      {isResetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-rose-200 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-600">
                  DESTRUCTIVE ACTION CONFIRMATION
                </span>
                <h3 className="text-xl font-black text-[var(--ink)]">
                  Reset All Platform Data?
                </h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  This action will immediately wipe all simulated fraud events, drop active
                  case files, and purge the local SQLite database to its zero-state baseline.
                </p>
              </div>
            </div>

            {/* Impact Details Checklist */}
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2.5 text-xs text-rose-950">
              <span className="font-bold block text-rose-900">
                The following resources will be permanently purged:
              </span>
              <ul className="space-y-1.5 text-rose-900/90 pl-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span><strong>18,450</strong> synthetic GPS telemetry coordinates & speed logs</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span><strong>42</strong> active investigation cases and appeal dispute filings</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span><strong>8</strong> active escrow holds ($7,850.50 in held rider balances)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span>In-memory facial liveness vectors and biometric template cache</span>
                </li>
              </ul>
            </div>

            {/* Type Confirmation Safeguard */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--ink)]">
                Type <span className="font-mono text-rose-600 font-black">RESET</span> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="RESET"
                className="w-full px-4 py-2.5 rounded-xl border border-rose-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetConfirmInput("");
                }}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetAllData}
                disabled={resetConfirmInput.trim().toUpperCase() !== "RESET" || isResetting}
                className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Platform State...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Wipe & Reset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
