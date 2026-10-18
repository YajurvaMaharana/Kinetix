import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  Smartphone,
  Fingerprint,
  Gauge,
  Clock,
  Sparkles,
  ChevronRight,
  Radio,
  Lock,
  PauseCircle,
  Camera,
} from "lucide-react";

interface MonitorSession {
  id: string;
  name: string;
  courierId: string;
  avatar: string;
  score: number;
  calibratedRisk: number;
  rawAnomaly: number;
  tier: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  verdict: "BLOCK" | "CHALLENGE" | "INVESTIGATE" | "ALLOW";
  device: string;
  registeredDevice: string;
  os: string;
  ip: string;
  city: string;
  speedKmh: number;
  typingCadence: number;
  faceMatchScore: number;
  livenessScore: number;
  mockGps: boolean;
  vpn: boolean;
  rooted: boolean;
  status: "In Transit" | "Challenged" | "Escrow Held" | "Blocked" | "Cleared";
  anomalySummary: string;
  mitigation: string;
  timestamp: string;
  caseId: string;
}

const mockSessions: MonitorSession[] = [
  {
    id: "ses_98a7f10b",
    name: "Marcus Vance",
    courierId: "TJ-8902",
    avatar: "MV",
    score: 89,
    calibratedRisk: 0.89,
    rawAnomaly: 0.94,
    tier: "CRITICAL",
    verdict: "INVESTIGATE",
    device: "iPhone 15 Pro (A3102)",
    registeredDevice: "Pixel 7 Pro",
    os: "iOS 17.4",
    ip: "172.56.21.90 (T-Mobile)",
    city: "Brooklyn, NY",
    speedKmh: 42,
    typingCadence: 184,
    faceMatchScore: 0.94,
    livenessScore: 0.96,
    mockGps: false,
    vpn: false,
    rooted: false,
    status: "Escrow Held",
    anomalySummary: "Concurrent dual GPS coordinates: 14.2 km apart in 180s.",
    mitigation: "18-month clean tenure; residential IP matches home zone.",
    timestamp: "12s ago",
    caseId: "INV-2024-8902",
  },
  {
    id: "ses_fa2981bc",
    name: "Dmitri Kazakov",
    courierId: "TJ-8905",
    avatar: "DK",
    score: 94,
    calibratedRisk: 0.96,
    rawAnomaly: 0.98,
    tier: "CRITICAL",
    verdict: "BLOCK",
    device: "Redmi 9A Farm Emulated",
    registeredDevice: "Galaxy A12",
    os: "Android 10 (Custom ROM)",
    ip: "45.142.122.8 (Datacenter)",
    city: "San Francisco, CA",
    speedKmh: 184,
    typingCadence: 520,
    faceMatchScore: 0.12,
    livenessScore: 0.05,
    mockGps: true,
    vpn: true,
    rooted: true,
    status: "Blocked",
    anomalySummary: "Shared IMEI & routing account with active syndicate Cluster-409.",
    mitigation: "Zero mitigating evidence; payout auto-gated.",
    timestamp: "45s ago",
    caseId: "INV-2024-8905",
  },
  {
    id: "ses_019c4d2e",
    name: "Elena Rostova",
    courierId: "TJ-8903",
    avatar: "ER",
    score: 42,
    calibratedRisk: 0.42,
    rawAnomaly: 0.55,
    tier: "MEDIUM",
    verdict: "CHALLENGE",
    device: "Pixel 8 Pro",
    registeredDevice: "Pixel 8 Pro",
    os: "Android 14",
    ip: "107.115.34.12 (AT&T Mobility)",
    city: "Chicago, IL",
    speedKmh: 28,
    typingCadence: 95,
    faceMatchScore: 0.48,
    livenessScore: 0.91,
    mockGps: false,
    vpn: false,
    rooted: false,
    status: "Challenged",
    anomalySummary: "Typing cadence divergence (240 -> 95 cpm); passenger device handoff suspected.",
    mitigation: "Secure Enclave attestation valid; step-up verification prompted.",
    timestamp: "1m ago",
    caseId: "INV-2024-8903",
  },
  {
    id: "ses_7781a94d",
    name: "Sarah Jenkins",
    courierId: "TJ-8908",
    avatar: "SJ",
    score: 61,
    calibratedRisk: 0.61,
    rawAnomaly: 0.67,
    tier: "HIGH",
    verdict: "CHALLENGE",
    device: "Galaxy S23",
    registeredDevice: "Galaxy S23",
    os: "Android 14",
    ip: "166.198.24.11 (Verizon)",
    city: "Austin, TX",
    speedKmh: 55,
    typingCadence: 210,
    faceMatchScore: 0.88,
    livenessScore: 0.85,
    mockGps: true,
    vpn: false,
    rooted: false,
    status: "In Transit",
    anomalySummary: "Fused location provider reports mock location enabled.",
    mitigation: "Secondary cell-tower triangulation indicates legitimate corridor.",
    timestamp: "2m ago",
    caseId: "INV-2024-8908",
  },
  {
    id: "ses_3b819f04",
    name: "Chen Wei",
    courierId: "TJ-8899",
    avatar: "CW",
    score: 18,
    calibratedRisk: 0.12,
    rawAnomaly: 0.19,
    tier: "LOW",
    verdict: "ALLOW",
    device: "iPhone 14",
    registeredDevice: "iPhone 14",
    os: "iOS 17.3",
    ip: "67.180.12.98 (Comcast)",
    city: "Seattle, WA",
    speedKmh: 35,
    typingCadence: 220,
    faceMatchScore: 0.98,
    livenessScore: 0.99,
    mockGps: false,
    vpn: false,
    rooted: false,
    status: "Cleared",
    anomalySummary: "Clean session telemetry; baseline behavioral congruence.",
    mitigation: "Historical passenger profile verified.",
    timestamp: "3m ago",
    caseId: "INV-2024-8899",
  },
];

export default function LiveMonitorPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("ses_98a7f10b");
  const [tierFilter, setTierFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [search, setSearch] = useState("");
  const [challengeTriggered, setChallengeTriggered] = useState(false);
  const [holdTriggered, setHoldTriggered] = useState(false);
  const [simulatedLiveCount, setSimulatedLiveCount] = useState(14892);

  const selectedSession = useMemo(() => {
    return mockSessions.find((s) => s.id === selectedSessionId) || mockSessions[0];
  }, [selectedSessionId]);

  const filteredSessions = useMemo(() => {
    return mockSessions.filter((s) => {
      if (tierFilter !== "ALL" && s.tier !== tierFilter) return false;
      if (
        search &&
        !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.id.toLowerCase().includes(search.toLowerCase()) &&
        !s.courierId.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tierFilter, search]);

  const handleSimulateTick = () => {
    setSimulatedLiveCount((prev) => prev + Math.floor(Math.random() * 5) + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span className="text-slate-200">Live Surveillance &amp; Ingress Monitor</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 text-[#56D9F5]" />
            <span>Live Behavioral Monitor</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time delivery ingestion stream, hardware passport verification, and automated triage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs text-[#34D399]">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            <span className="font-mono font-bold">{simulatedLiveCount.toLocaleString()} Ingesting</span>
          </div>

          <button
            onClick={handleSimulateTick}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#101521] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#56D9F5]" />
            Simulate Pulse
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#101521] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#56D9F5]" />
              Active Ingress Stream
            </h2>
            <span className="text-xs text-slate-500 font-mono">14ms poll</span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-[#080B12] pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#56D9F5]/40 font-mono"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-[#080B12] p-1 border border-slate-800 text-[11px] font-mono overflow-x-auto no-scrollbar">
              {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  className={`rounded px-2 py-0.5 whitespace-nowrap transition-colors ${
                    tierFilter === tier
                      ? "bg-[#56D9F5]/20 text-[#56D9F5] font-bold border border-[#56D9F5]/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {filteredSessions.map((s) => {
              const isSelected = s.id === selectedSession.id;
              const isCritical = s.tier === "CRITICAL";
              const isHigh = s.tier === "HIGH";
              const isMed = s.tier === "MEDIUM";

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`rounded-xl border p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? "border-[#56D9F5] bg-[#141d2e] shadow-lg shadow-[#56D9F5]/5"
                      : "border-slate-800/80 bg-[#080B12] hover:border-slate-700 hover:bg-[#0d121c]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-9 w-9 rounded-lg border flex items-center justify-center font-bold text-xs ${
                          isSelected
                            ? "bg-[#56D9F5]/20 border-[#56D9F5] text-[#56D9F5]"
                            : "bg-[#101521] border-slate-800 text-slate-300"
                        }`}
                      >
                        {s.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{s.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">#{s.courierId}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{s.city}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-base font-extrabold font-mono ${
                          isCritical ? "text-[#FB7185]" : isHigh ? "text-[#FBBF24]" : isMed ? "text-[#A78BFA]" : "text-[#34D399]"
                        }`}
                      >
                        {s.score}
                        <span className="text-[10px] text-slate-500 font-normal"> / 100</span>
                      </div>
                      <span
                        className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-mono font-bold border ${
                          isCritical
                            ? "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]"
                            : isHigh
                            ? "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]"
                            : isMed
                            ? "border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA]"
                            : "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]"
                        }`}
                      >
                        {s.verdict === "INVESTIGATE" || s.verdict === "BLOCK" ? "ESCALATE" : s.verdict}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-300 line-clamp-1">{s.anomalySummary}</div>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                    <span className="truncate max-w-[180px]">{s.device}</span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {s.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-5 sticky top-24">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#56D9F5]" />
                Active Contextual Dossier
              </h2>
              <span className="font-mono text-xs text-slate-400">
                Session Token: <code className="text-[#56D9F5]">{selectedSession.id}</code>
              </span>
            </div>

            <Link
              to={`/cases?id=${selectedSession.caseId}`}
              className="inline-flex items-center gap-1 rounded-lg bg-[#56D9F5]/10 px-3 py-1.5 text-xs font-semibold text-[#56D9F5] border border-[#56D9F5]/30 hover:bg-[#56D9F5]/20 transition-all"
            >
              Full Case Investigation
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#080B12] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1c2438] to-[#101521] border border-[#56D9F5]/40 flex items-center justify-center font-bold text-lg text-[#56D9F5]">
                {selectedSession.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-white">{selectedSession.name}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                    ID: #{selectedSession.courierId}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Location: <span className="text-slate-200">{selectedSession.city}</span> · Status:{" "}
                  <span className="text-[#56D9F5] font-semibold">{selectedSession.status}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Composite Risk</span>
                <span
                  className={`text-2xl font-extrabold font-mono ${
                    selectedSession.score >= 75
                      ? "text-[#FB7185]"
                      : selectedSession.score >= 40
                      ? "text-[#FBBF24]"
                      : "text-[#34D399]"
                  }`}
                >
                  {selectedSession.score}
                  <span className="text-xs font-normal text-slate-500">/100</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Calibrated P(misuse)</span>
                <span className="text-2xl font-extrabold font-mono text-[#A78BFA]">
                  {selectedSession.calibratedRisk.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0d121c] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#FB7185] flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Observed Anomaly Trigger
              </span>
              <span className="text-[10px] font-mono text-slate-400">Heuristic Engine v2.4</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">{selectedSession.anomalySummary}</p>
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-xs text-[#34D399]">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>Mitigating Safeguard:</strong> {selectedSession.mitigation}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3.5 space-y-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-[#56D9F5]" /> Hardware Passport
              </span>
              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Current Device:</span>
                  <span className="text-slate-200">{selectedSession.device}</span>
                </div>
                <div className="flex justify-between">
                  <span>Registered Device:</span>
                  <span className="text-slate-400">{selectedSession.registeredDevice}</span>
                </div>
                <div className="flex justify-between">
                  <span>IP &amp; Carrier:</span>
                  <span className="text-slate-300 truncate max-w-[140px]">{selectedSession.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mock GPS / Root:</span>
                  <span className={selectedSession.mockGps || selectedSession.rooted ? "text-[#FB7185]" : "text-[#34D399]"}>
                    {selectedSession.mockGps ? "MOCK DETECTED" : selectedSession.rooted ? "ROOTED" : "CLEAN"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3.5 space-y-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Fingerprint className="h-3.5 w-3.5 text-[#A78BFA]" /> Biometric Attestation
              </span>
              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Face Similarity Match:</span>
                  <span
                    className={
                      selectedSession.faceMatchScore >= 0.7
                        ? "text-[#34D399]"
                        : selectedSession.faceMatchScore >= 0.4
                        ? "text-[#FBBF24]"
                        : "text-[#FB7185]"
                    }
                  >
                    {(selectedSession.faceMatchScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Liveness Score:</span>
                  <span className={selectedSession.livenessScore >= 0.8 ? "text-[#34D399]" : "text-[#FB7185]"}>
                    {(selectedSession.livenessScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Engine Backend:</span>
                  <span className="text-slate-200">Apple Secure Enclave</span>
                </div>
                <div className="flex justify-between">
                  <span>Step-Up Status:</span>
                  <span className={challengeTriggered ? "text-[#FBBF24] font-bold" : "text-slate-400"}>
                    {challengeTriggered ? "PENDING CHALLENGE" : "Passed Enrolment"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3.5 space-y-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-[#56D9F5]" /> Kinematics &amp; Motion
              </span>
              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Vehicle Speed:</span>
                  <span className="text-slate-200">{selectedSession.speedKmh} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span>Typing Cadence:</span>
                  <span className="text-slate-200">{selectedSession.typingCadence} cpm</span>
                </div>
                <div className="flex justify-between">
                  <span>Trajectory Jitter:</span>
                  <span className="text-[#34D399]">0.08 Variance (Normal)</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3.5 space-y-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#34D399]" /> Payout Safety Gating
              </span>
              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Fare Disbursal:</span>
                  <span className="text-slate-200 font-bold">$38.50 USD</span>
                </div>
                <div className="flex justify-between">
                  <span>Escrow Hold State:</span>
                  <span
                    className={
                      holdTriggered || selectedSession.status === "Escrow Held"
                        ? "text-[#FBBF24] font-bold"
                        : "text-[#34D399]"
                    }
                  >
                    {holdTriggered || selectedSession.status === "Escrow Held" ? "ESCROW HOLD (24h)" : "CLEARED"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Destination:</span>
                  <span className="text-slate-400">ACH •••• 9921</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setChallengeTriggered(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#56D9F5] px-3.5 py-2 text-xs font-bold text-[#003640] hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#56D9F5]/20 cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" />
              {challengeTriggered ? "Step-Up Challenge Dispatched" : "Trigger Biometric Step-Up"}
            </button>

            <button
              onClick={() => setHoldTriggered(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/10 px-3.5 py-2 text-xs font-bold text-[#FBBF24] hover:bg-[#FBBF24]/20 active:scale-95 transition-all cursor-pointer"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              {holdTriggered ? "Escrow Hold Applied" : "Place 24h Escrow Hold"}
            </button>

            <Link
              to={`/cases?id=${selectedSession.caseId}`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all cursor-pointer"
            >
              Open Full Case Dossier
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
