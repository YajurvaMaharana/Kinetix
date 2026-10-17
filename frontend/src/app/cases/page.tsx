"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FolderKanban,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Smartphone,
  Fingerprint,
  MapPin,
  Camera,
  PauseCircle,
  FileCheck,
  ChevronRight,
  ShieldCheck,
  History,
  Scale,
  Users,
} from "lucide-react";

interface AuditEntry {
  time: string;
  actor: string;
  action: string;
  detail: string;
}

function CasesContent() {
  const searchParams = useSearchParams();
  const requestedCaseId = searchParams?.get("id");

  const [activeTab, setActiveTab] = useState<"DOSSIER" | "QUEUE">(
    requestedCaseId ? "DOSSIER" : "DOSSIER"
  );

  const [caseStatus, setCaseStatus] = useState<"ACTIVE_TRIAGE" | "CHALLENGED" | "RESTRICTED" | "RESOLVED_LEGIT">("ACTIVE_TRIAGE");
  const [resolutionNote, setResolutionNote] = useState<string | null>(null);

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([
    {
      time: "14:31:02 UTC",
      actor: "Edge Broker",
      action: "Session Initialized",
      detail: "Courier signed in on iPhone 15 Pro (hash: DEV_A3102)",
    },
    {
      time: "14:32:14 UTC",
      actor: "Heuristic Engine v2.4",
      action: "Anomaly Flagged",
      detail: "Concurrent secondary GPS detected 14.2 km apart",
    },
    {
      time: "14:34:22 UTC",
      actor: "Trust Engine",
      action: "Escalated to SOC",
      detail: "Composite risk score synthesized to 89 / 100",
    },
    {
      time: "14:35:00 UTC",
      actor: "Elena Rostova (Lead SOC)",
      action: "Case Claimed",
      detail: "Investigation opened under policy zero-lockout protocol",
    },
  ]);

  const handleTriggerStepUp = () => {
    setCaseStatus("CHALLENGED");
    setResolutionNote("Biometric Face Liveness Challenge pushed to driver mobile terminal.");
    setAuditLog((prev) => [
      {
        time: new Date().toISOString().slice(11, 19) + " UTC",
        actor: "Elena Rostova (Lead SOC)",
        action: "Biometric Step-Up Dispatched",
        detail: "Driver challenged to complete 3D facial depth verification within 180s.",
      },
      ...prev,
    ]);
  };

  const handleRestrictDispatch = () => {
    setCaseStatus("RESTRICTED");
    setResolutionNote("Dispatch offers suspended for 30 minutes pending identity clearance.");
    setAuditLog((prev) => [
      {
        time: new Date().toISOString().slice(11, 19) + " UTC",
        actor: "Elena Rostova (Lead SOC)",
        action: "Temporary Dispatch Restriction",
        detail: "Session paused from order allocation. Payout queued in escrow hold.",
      },
      ...prev,
    ]);
  };

  const handleClearCase = () => {
    setCaseStatus("RESOLVED_LEGIT");
    setResolutionNote("Case dismissed as False Positive: Residential IP & 18-month tenure verified.");
    setAuditLog((prev) => [
      {
        time: new Date().toISOString().slice(11, 19) + " UTC",
        actor: "Elena Rostova (Lead SOC)",
        action: "Case Cleared (False Positive)",
        detail: "Mitigating hardware migration record verified. Courier returned to good standing.",
      },
      ...prev,
    ]);
  };

  const queueCases = [
    {
      id: "INV-2024-8902",
      subject: "Marcus Vance",
      role: "Verified Courier · Tier 1",
      severity: "CRITICAL",
      score: 89,
      vector: "Dual Concurrent GPS Hop (14.2 km in 180s)",
      assignee: "Elena Rostova",
      status: caseStatus,
      time: "5m ago",
    },
    {
      id: "INV-2024-8905",
      subject: "Dmitri Kazakov",
      role: "Express Courier · SFO",
      severity: "CRITICAL",
      score: 94,
      vector: "Syndicate Farm Node #14 (Cluster 409)",
      assignee: "Sarah Jenkins",
      status: "ACTIVE_TRIAGE",
      time: "15m ago",
    },
    {
      id: "INV-2024-8903",
      subject: "Elena Rostova",
      role: "Contract Rider · Chicago",
      severity: "MEDIUM",
      score: 42,
      vector: "Touch Kinematics Cadence Divergence (240 -> 95 cpm)",
      assignee: "David Kim",
      status: "CHALLENGED",
      time: "45m ago",
    },
    {
      id: "INV-2024-8899",
      subject: "Chen Wei",
      role: "Standard Passenger · Seattle",
      severity: "LOW",
      score: 18,
      vector: "Interstate Transit Shift",
      assignee: "Automated",
      status: "RESOLVED_LEGIT",
      time: "2h ago",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span>Investigations</span>
            <span>/</span>
            <span className="text-slate-200">
              {activeTab === "DOSSIER" ? "Case #INV-2024-8902 (Marcus Vance)" : "Case Queue"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <FolderKanban className="h-7 w-7 text-[#FBBF24]" />
            <span>
              {activeTab === "DOSSIER"
                ? "Investigation Dossier: Marcus Vance"
                : "Security Operations Case Queue"}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            High-resolution forensic reconstruction, behavioral kinematics validation, and analyst decision triage.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-[#101521] border border-slate-800 p-1 text-xs font-mono">
            <button
              onClick={() => setActiveTab("DOSSIER")}
              className={`rounded px-3 py-1.5 font-semibold transition-all ${
                activeTab === "DOSSIER"
                  ? "bg-[#56D9F5]/20 text-[#56D9F5] border border-[#56D9F5]/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Active Dossier (#INV-8902)
            </button>
            <button
              onClick={() => setActiveTab("QUEUE")}
              className={`rounded px-3 py-1.5 font-semibold transition-all ${
                activeTab === "QUEUE"
                  ? "bg-[#56D9F5]/20 text-[#56D9F5] border border-[#56D9F5]/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Queue Overview ({queueCases.length})
            </button>
          </div>
        </div>
      </div>

      {/* VIEW A: QUEUE OVERVIEW */}
      {activeTab === "QUEUE" && (
        <section className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-[#A78BFA]" />
              Active SOC Analyst Queue
            </h2>
            <span className="text-xs text-slate-400 font-mono">4 Active Cases</span>
          </div>

          <div className="grid gap-3">
            {queueCases.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-800/80 bg-[#080B12] p-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#56D9F5]">{c.id}</span>
                    <span
                      className={`rounded border px-2 py-0.5 text-[9px] font-mono font-bold ${
                        c.severity === "CRITICAL"
                          ? "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]"
                          : c.severity === "HIGH"
                          ? "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]"
                          : "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]"
                      }`}
                    >
                      {c.severity}
                    </span>
                    <span className="text-xs font-bold text-white">{c.subject}</span>
                    <span className="text-xs text-slate-400">({c.role})</span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans">{c.vector}</p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
                    <span>Assignee: {c.assignee}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {c.time}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-extrabold text-sm text-[#FB7185]">{c.score} / 100</span>
                  <button
                    onClick={() => setActiveTab("DOSSIER")}
                    className="rounded-lg bg-[#56D9F5]/10 text-[#56D9F5] border border-[#56D9F5]/30 px-3 py-1.5 text-xs font-semibold hover:bg-[#56D9F5]/20 flex items-center gap-1 cursor-pointer"
                  >
                    Inspect Dossier
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* VIEW B: ACTIVE INVESTIGATION DOSSIER (#INV-2024-8902) */}
      {activeTab === "DOSSIER" && (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* LEFT COLUMN: EVIDENCE & TELEMETRY FORENSICS (8 Cols ~66%) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Subject Dossier Overview Banner */}
            <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#1c2438] to-[#101521] border border-[#56D9F5]/40 flex items-center justify-center font-bold text-xl text-[#56D9F5] shadow-lg shadow-[#56D9F5]/5">
                  MV
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl font-extrabold text-white">Marcus Vance</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-[#56D9F5] border border-slate-700">
                      Case #INV-2024-8902
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                    <span>
                      Subject: <strong className="text-slate-200">Verified Courier · Gold Tier</strong>
                    </span>
                    <span>•</span>
                    <span>Tenure: <strong className="text-[#34D399]">18 Months (Clean Record)</strong></span>
                    <span>•</span>
                    <span>Market: <strong className="text-slate-200">Brooklyn, NY (Zone 4)</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-slate-800 bg-[#080B12] px-3 py-2 text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Triage Lead</span>
                  <span className="text-xs font-bold text-white">Elena Rostova</span>
                  <span className="text-[10px] text-[#34D399] font-mono block">Claimed &amp; Active</span>
                </div>
              </div>
            </div>

            {/* SECTION 1: Chronological Session Telemetry Timeline */}
            <section className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <History className="h-4 w-4 text-[#56D9F5]" />
                    Chronological Session Telemetry Timeline
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sequence of edge events for active session <code className="text-[#56D9F5]">ses_98a7f10b</code>
                  </p>
                </div>
                <span className="rounded bg-[#56D9F5]/10 px-2.5 py-1 text-xs font-mono text-[#56D9F5] border border-[#56D9F5]/30">
                  5 Events Ingested
                </span>
              </div>

              {/* Timeline Items */}
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {[
                  {
                    time: "14:31:02 UTC",
                    title: "Session Authenticated via Biometric Face Match",
                    desc: "Driver selfie matched enrolled biometric profile with 0.98 similarity confidence.",
                    icon: Fingerprint,
                    color: "text-[#34D399] border-[#34D399]/40 bg-[#34D399]/10",
                  },
                  {
                    time: "14:32:14 UTC",
                    title: "Secondary Device Ingress Handshake",
                    desc: "Session token re-authenticated on unregistered hardware UUID (iPhone 15 Pro A3102).",
                    icon: Smartphone,
                    color: "text-[#FBBF24] border-[#FBBF24]/40 bg-[#FBBF24]/10",
                  },
                  {
                    time: "14:33:45 UTC",
                    title: "Concurrent Dual GPS Coordinates Emitted (Geo-Hop)",
                    desc: "Two distinct GPS positions reported simultaneously 14.2 km apart in under 180 seconds.",
                    icon: MapPin,
                    color: "text-[#FB7185] border-[#FB7185]/40 bg-[#FB7185]/10",
                  },
                  {
                    time: "14:34:10 UTC",
                    title: "Touch Kinematics & Accelerometer Divergence",
                    desc: "Typing cadence shifted abruptly from baseline 230 cpm to 85 cpm. Suspected co-rider handoff.",
                    icon: AlertTriangle,
                    color: "text-[#FB7185] border-[#FB7185]/40 bg-[#FB7185]/10",
                  },
                  {
                    time: "14:34:22 UTC",
                    title: "Composite Risk Score Synthesized to 89 · Escalated to SOC",
                    desc: "Autonomous Bayesian prior synthesized to 0.89 probability. Zero automated lockout safeguard triggered.",
                    icon: ShieldAlert,
                    color: "text-red-400 border-red-500/40 bg-red-500/10",
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={idx} className="relative space-y-1">
                      <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-[#101521] border-2 border-[#56D9F5]" />
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400 font-semibold">{item.time}</span>
                        <span className={`rounded border px-1.5 py-0.2 text-[9px] font-mono font-bold ${item.color}`}>
                          Step 0{idx + 1}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 2: Observed Anomaly Vectors (SHAP Decomposition) */}
            <section className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#FB7185]" />
                Observed Anomaly Vectors
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Dual Concurrent GPS</span>
                    <span className="font-mono text-xs font-extrabold text-[#FB7185]">+0.44 SHAP</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Impossible physical velocity (284 km/h) between ping A (Brooklyn) and ping B (Manhattan).
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Unregistered Hardware UUID</span>
                    <span className="font-mono text-xs font-extrabold text-[#FB7185]">+0.34 SHAP</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Active device iPhone 15 Pro does not match registered courier device Pixel 7 Pro.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Kinematic Curvature Shift</span>
                    <span className="font-mono text-xs font-extrabold text-[#A78BFA]">+0.22 SHAP</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Gyroscope turn radius jitter and typing cadence drop indicates passenger device handoff.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 3: Mitigating Context & False-Positive Safeguards */}
            <section className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="h-4 w-4 text-[#34D399]" />
                  Mitigating Context &amp; False-Positive Safeguards
                </h2>
                <span className="text-xs font-mono text-[#34D399] font-bold">Net Mitigation: -0.27 SHAP</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#34D399]" />
                      18-Month Clean History
                    </span>
                    <span className="font-mono text-xs text-[#34D399] font-bold">-0.15 SHAP</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Over 2,400 verified successful deliveries with 4.98 rating and zero previous chargebacks.
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#34D399]" />
                      Valid Residential Carrier IP
                    </span>
                    <span className="font-mono text-xs text-[#34D399] font-bold">-0.12 SHAP</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    T-Mobile residential IP ASN matches registered home corridor; no commercial VPN detected.
                  </p>
                </div>
              </div>

              {/* Zero Automated Lockout Safeguard Banner */}
              <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#56D9F5] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Zero Automated Lockout Safeguard:</strong> Platform policy forbids
                  automatic account deactivations for verified couriers with tenure &gt;12 months. Step-up challenge or
                  human analyst sign-off is mandatory before payout escrow termination.
                </div>
              </div>
            </section>

            {/* SECTION 4: Audit Trail Governance Log */}
            <section className="rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-slate-400" />
                Audit Trail &amp; Case Governance Log
              </h2>
              <div className="space-y-2 font-mono text-xs">
                {auditLog.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-[#080B12] p-2.5 border border-slate-800/80 gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#56D9F5] font-bold">{entry.time}</span>
                      <span className="text-slate-200 font-semibold">{entry.action}</span>
                      <span className="text-slate-400 font-sans text-[11px]">({entry.actor})</span>
                    </div>
                    <span className="text-slate-400 font-sans text-[11px]">{entry.detail}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: DECISION & TRIAGE CONSOLE (4 Cols ~34%, Sticky) */}
          <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-5 sticky top-24">
            <div className="border-b border-slate-800/80 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#56D9F5]" />
                Decision &amp; Triage Console
              </h2>
              <span className="text-xs font-mono text-slate-400">
                Case Status:{" "}
                <span className="font-bold text-[#FBBF24] uppercase">
                  {caseStatus.replace("_", " ")}
                </span>
              </span>
            </div>

            {/* Risk Scores Box */}
            <div className="rounded-xl border border-slate-800 bg-[#080B12] p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-mono text-slate-400">System Composite Risk</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-[#FB7185]">89</span>
                  <span className="text-xs text-slate-500 font-mono">/ 100</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Calibrated Misuse Prob</span>
                  <span className="text-[10px] text-slate-500 font-mono">Bayesian Model Prior v2.4</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-[#A78BFA]">0.89</span>
                  <span className="text-[10px] text-slate-500 font-mono block">Brier: 0.019</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">Backend Decision</span>
                <span className="rounded border border-[#FB7185]/40 bg-[#FB7185]/10 px-2 py-0.5 text-xs font-mono font-bold text-[#FB7185]">
                  ESCALATE (v2.4-Gov)
                </span>
              </div>
            </div>

            {/* Resolution Note Banner */}
            {resolutionNote && (
              <div className="rounded-lg border border-[#56D9F5]/40 bg-[#56D9F5]/10 p-3 text-xs text-[#56D9F5] leading-relaxed">
                <strong className="block font-semibold">Analyst Action Executed:</strong>
                {resolutionNote}
              </div>
            )}

            {/* Interactive Decision Actions */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-300 block">Available Triage Actions:</span>

              <button
                onClick={handleTriggerStepUp}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#56D9F5] py-2.5 px-4 text-xs font-bold text-[#003640] hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#56D9F5]/20 cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                Trigger Biometric Step-Up Challenge
              </button>

              <button
                onClick={handleRestrictDispatch}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/10 py-2.5 px-4 text-xs font-bold text-[#FBBF24] hover:bg-[#FBBF24]/20 active:scale-95 transition-all cursor-pointer"
              >
                <PauseCircle className="h-4 w-4" />
                Temporarily Restrict Session Dispatch
              </button>

              <button
                onClick={handleClearCase}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#34D399]/40 bg-[#34D399]/10 py-2.5 px-4 text-xs font-bold text-[#34D399] hover:bg-[#34D399]/20 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Clear Anomaly (Dismiss False Positive)
              </button>
            </div>

            {/* Escalation Policy Disclosure */}
            <div className="rounded-lg bg-[#080B12] p-3 text-[11px] text-slate-400 space-y-1 font-sans">
              <span className="font-semibold text-slate-300 block">SOC Compliance Notice:</span>
              <p>
                Analyst decisions are logged to the tamper-evident audit ledger. Never dismiss a case without inspecting
                the mitigating residential carrier logs.
              </p>
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
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-[#101521] text-xs font-mono text-slate-400">
          Loading investigation dossier...
        </div>
      }
    >
      <CasesContent />
    </Suspense>
  );
}
