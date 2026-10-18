"use client";

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Sliders,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  ExternalLink,
  Zap,
  Play,
  ScanFace,
} from "lucide-react";
import { evaluateSession } from "@/lib/api";
import { Assessment, SessionRequest, ThreatTag, FaceVerifyResponse } from "@/lib/types";
import FaceLivenessModal from "@/components/FaceLivenessModal";

interface ScenarioPreset {
  id: string;
  name: string;
  tag: string;
  description: string;
  speed: number;
  faceMatch: number;
  typingCadence: number;
  routeDeviation: number;
  mockGps: boolean;
  vpn: boolean;
  rooted: boolean;
  payoutAccountChanged?: boolean;
  expectedVerdict: "ALLOW" | "CHALLENGE" | "INVESTIGATE" | "BLOCK";
  badgeColor: string;
}

const scenarioPresets: ScenarioPreset[] = [
  {
    id: "SCN-01",
    name: "01. Normal Commute",
    tag: "BENCHMARK BASELINE",
    description: "Genuine iOS Secure Enclave hardware, 0.98 face match, organic swipe velocity.",
    speed: 38,
    faceMatch: 0.98,
    typingCadence: 230,
    routeDeviation: 1.8,
    mockGps: false,
    vpn: false,
    rooted: false,
    payoutAccountChanged: false,
    expectedVerdict: "ALLOW",
    badgeColor: "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]",
  },
  {
    id: "SCN-02",
    name: "02. Account Handoff",
    tag: "SUSPECTED HANDOFF",
    description: "Mid-trip typing cadence drop (240 -> 85 cpm), passenger face mismatch (0.38).",
    speed: 32,
    faceMatch: 0.38,
    typingCadence: 85,
    routeDeviation: 4.2,
    mockGps: false,
    vpn: false,
    rooted: false,
    payoutAccountChanged: false,
    expectedVerdict: "CHALLENGE",
    badgeColor: "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]",
  },
  {
    id: "SCN-03",
    name: "03. GPS Spoof & Velocity",
    tag: "EMULATOR & GEO-SPOOF",
    description: "Android x86 emulator, mock provider active, impossible 185 km/h jump across cells.",
    speed: 185,
    faceMatch: 0.88,
    typingCadence: 210,
    routeDeviation: 62.0,
    mockGps: true,
    vpn: true,
    rooted: false,
    payoutAccountChanged: false,
    expectedVerdict: "INVESTIGATE",
    badgeColor: "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]",
  },
  {
    id: "SCN-04",
    name: "04. Syndicate Collusion",
    tag: "CLUSTER-RING-409",
    description: "Shared Redmi device fingerprint, circular routing across 14 nodes, recycled bank account.",
    speed: 140,
    faceMatch: 0.15,
    typingCadence: 540,
    routeDeviation: 85.0,
    mockGps: true,
    vpn: true,
    rooted: true,
    payoutAccountChanged: true,
    expectedVerdict: "BLOCK",
    badgeColor: "border-red-500/40 bg-red-500/10 text-red-400",
  },
];

export default function SimulatorPage() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("SCN-01");
  const [speed, setSpeed] = useState<number>(38);
  const [faceConfidence, setFaceConfidence] = useState<number>(0.98);
  const [typingCadence, setTypingCadence] = useState<number>(230);
  const [routeDeviation, setRouteDeviation] = useState<number>(1.8);
  const [mockGps, setMockGps] = useState<boolean>(false);
  const [vpn, setVpn] = useState<boolean>(false);
  const [rooted, setRooted] = useState<boolean>(false);
  const [payoutAccountChanged, setPayoutAccountChanged] = useState<boolean>(false);

  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isSimulatedResponse, setIsSimulatedResponse] = useState<boolean>(true);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState<boolean>(false);

  const applyPreset = (preset: ScenarioPreset) => {
    setSelectedPresetId(preset.id);
    setSpeed(preset.speed);
    setFaceConfidence(preset.faceMatch);
    setTypingCadence(preset.typingCadence);
    setRouteDeviation(preset.routeDeviation);
    setMockGps(preset.mockGps);
    setVpn(preset.vpn);
    setRooted(preset.rooted);
    setPayoutAccountChanged(preset.payoutAccountChanged || false);
  };

  const runEvaluation = async () => {
    setEvaluating(true);
    const mockSession: SessionRequest = {
      session_id: `ses_sim_${Date.now()}`,
      rider_id: "rider_interactive_sim",
      driver_id: "drv_sim_01",
      timestamp: new Date().toISOString(),
      device_passport: {
        device_id_hash: rooted ? "SIM_ROOTED_HASH_99" : "SIM_DEVICE_HASH_44",
        device_model: mockGps ? "Android x86 Emulator" : "iPhone 15 Pro",
        os_version: mockGps ? "Android 11" : "iOS 17.4",
        app_version: "2.4.1",
        ip_address: vpn ? "45.142.122.8" : "172.56.21.90",
        vpn_detected: vpn,
        mock_location_detected: mockGps,
        rooted_or_jailbroken: rooted,
      },
      biometrics: {
        face_present: true,
        face_match_confidence: faceConfidence,
        liveness_score: faceConfidence >= 0.5 ? 0.95 : 0.22,
        biometric_backend: "simulated",
      },
      telemetry: {
        speed_kmh: speed,
        acceleration_variance: speed > 100 ? 0.85 : 0.12,
        gyro_stability: 0.92,
        typing_cadence_cpm: typingCadence,
        route_deviation_pct: routeDeviation,
        trip_distance_km: 12.5,
        elapsed_minutes: 18,
      },
      location: {
        lat: 37.7749,
        lng: -122.4194,
        accuracy_meters: mockGps ? 1.0 : 4.5,
        zone_risk_level: mockGps ? "CRITICAL" : "LOW",
      },
      financial: {
        fare_amount: 32.5,
        currency: "USD",
        payment_method: "apple_pay",
        tip_amount: 5.0,
        promo_applied: false,
        payout_account_changed: payoutAccountChanged,
        withdrawal_requested: payoutAccountChanged,
        withdrawal_amount: payoutAccountChanged ? 250.0 : 0.0,
      },
    };

    try {
      const remote = await evaluateSession(mockSession);
      setAssessment(remote);
      setIsSimulatedResponse(false);
    } catch {
      let score = 96.0;
      if (mockGps) score -= 45.0;
      if (rooted) score -= 35.0;
      if (vpn) score -= 15.0;
      if (faceConfidence < 0.5) score -= 35.0;
      else if (faceConfidence < 0.8) score -= 15.0;
      if (speed > 120) score -= 25.0;
      else if (speed > 80) score -= 10.0;
      if (routeDeviation > 40) score -= 15.0;
      if (typingCadence < 100 || typingCadence > 450) score -= 12.0;
      if (payoutAccountChanged) score -= 25.0;

      score = Math.max(5, Math.min(99, score));

      const verdict: "ALLOW" | "CHALLENGE" | "INVESTIGATE" | "BLOCK" =
        score >= 75 ? "ALLOW" : score >= 50 ? "CHALLENGE" : score >= 20 ? "INVESTIGATE" : "BLOCK";

      const tags: ThreatTag[] = [];
      if (mockGps) tags.push("GEO_SPOOF" as const);
      if (faceConfidence < 0.5) tags.push("ACCOUNT_HANDOFF" as const);
      if (rooted) tags.push("DEVICE_ANOMALY" as const);
      if (payoutAccountChanged) tags.push("PAYOUT_RISK" as const);
      if (score < 20 && mockGps) tags.push("COLLUSION_RING" as const);
      if (tags.length === 0) tags.push("CLEAN" as const);

      const factors = [
        {
          name: "Biometric Facial Congruence",
          category: "BIOMETRIC" as const,
          impact: (faceConfidence >= 0.7 ? "POSITIVE" : "NEGATIVE") as "POSITIVE" | "NEGATIVE",
          weight: 0.35,
          score: faceConfidence,
          description: `Similarity confidence: ${(faceConfidence * 100).toFixed(0)}%`,
        },
        {
          name: "GPS & Kinematic Plausibility",
          category: "LOCATION" as const,
          impact: (mockGps || speed > 120 ? "NEGATIVE" : "POSITIVE") as "POSITIVE" | "NEGATIVE",
          weight: 0.3,
          score: mockGps ? 0.05 : 0.95,
          description: mockGps ? "Mock location provider active" : "Organic velocity vector",
        },
        {
          name: "Hardware Integrity",
          category: "DEVICE" as const,
          impact: (rooted ? "NEGATIVE" : "POSITIVE") as "POSITIVE" | "NEGATIVE",
          weight: 0.25,
          score: rooted ? 0.1 : 0.98,
          description: rooted ? "Root / Jailbreak detected" : "Hardware Keystore Verified",
        },
        {
          name: "Tenure & Historical Baseline",
          category: "TELEMETRY" as const,
          impact: "POSITIVE" as const,
          weight: 0.1,
          score: 0.92,
          description: "Mitigating baseline weight applied",
        },
      ];

      setAssessment({
        assessment_id: `eval_sim_${Date.now()}`,
        session_id: mockSession.session_id,
        rider_id: mockSession.rider_id,
        trust_score: score,
        verdict,
        risk_tier: score >= 75 ? "LOW" : score >= 50 ? "MEDIUM" : score >= 20 ? "HIGH" : "CRITICAL",
        threat_tags: tags,
        factors,
        challenge:
          verdict === "CHALLENGE" || (faceConfidence < 0.6 && verdict === "ALLOW")
            ? {
                challenge_id: "chlg_sim_01",
                session_id: mockSession.session_id,
                challenge_type: "FACE_LIVENESS",
                status: "PENDING",
                expires_at: new Date(Date.now() + 300000).toISOString(),
                created_at: new Date().toISOString(),
              }
            : null,
        case_id: verdict === "INVESTIGATE" || verdict === "BLOCK" ? "INV-2024-8902" : null,
        payout_decision: payoutAccountChanged
          ? {
              status: "ESCROW_HOLD",
              hold_reason: "Destination account updated within 24-hour protection window. Requires liveness selfie + analyst clearance.",
              hold_period_hours: 24,
            }
          : {
              status: verdict === "BLOCK" ? "DENIED" : verdict === "INVESTIGATE" ? "ESCROW_HOLD" : "APPROVED",
              hold_reason: verdict === "BLOCK" ? "Syndicate cluster detected" : null,
              hold_period_hours: verdict === "INVESTIGATE" ? 24 : 0,
            },
        evaluated_at: new Date().toISOString(),
      });
      setIsSimulatedResponse(true);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    runEvaluation();
  }, [speed, faceConfidence, typingCadence, routeDeviation, mockGps, vpn, rooted, payoutAccountChanged]);

  const handleVerified = (res: FaceVerifyResponse) => {
    if (assessment) {
      setAssessment({
        ...assessment,
        verdict: (res.new_verdict === "ALLOW" || res.new_verdict === "CHALLENGE" || res.new_verdict === "INVESTIGATE" ? res.new_verdict : "ALLOW") as "ALLOW" | "CHALLENGE" | "INVESTIGATE",
        trust_score: res.passed ? Math.min(100, assessment.trust_score + 18) : Math.max(10, assessment.trust_score - 30),
        threat_tags: res.passed ? ["CLEAN"] : ["ACCOUNT_HANDOFF"],
        challenge: res.passed ? null : assessment.challenge,
        payout_decision: res.passed
          ? {
              status: "APPROVED",
              hold_reason: "Liveness verification successfully passed by driver.",
              hold_period_hours: 0,
            }
          : assessment.payout_decision,
      });
    }
  };

  const isPayoutHoldActive =
    payoutAccountChanged ||
    assessment?.payout_decision?.status === "ESCROW_HOLD" ||
    (assessment?.threat_tags && assessment.threat_tags.includes("PAYOUT_RISK"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span className="text-slate-200">Interactive Threat Simulator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Sliders className="h-7 w-7 text-[#56D9F5]" />
            <span>Rider Simulator &amp; Threat Generator</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inject synthetic kinematic anomalies, emulator flags, and biometric handoffs to evaluate engine sensitivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#56D9F5]/10 border border-[#56D9F5]/30 px-3 py-1 text-xs font-mono font-semibold text-[#56D9F5] flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Active Feedback Loop
          </span>
        </div>
      </div>

      {isPayoutHoldActive && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-4 shadow-lg shadow-amber-950/30 text-amber-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400 animate-pulse" />
              <span className="font-bold text-sm text-white">
                Payout Escrow Hold Active: 24-Hour Protection Window
              </span>
            </div>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/40">
              STATUS: HELD
            </span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            ⚠️ Disbursement of $250.00 is held under the 24-hour destination account modification window. Facial liveness re-verification and analyst clearance are required before funds release.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-500/20">
            <span className="text-[11px] font-mono text-amber-300/80">
              Release Requires: <code className="text-amber-200">liveness_selfie + analyst_approval</code>
            </span>
            <button
              onClick={() => setIsFaceModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-colors shadow-sm cursor-pointer"
            >
              <ScanFace className="h-3.5 w-3.5 text-amber-400" />
              Resolve with Facial Liveness
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#A78BFA]" />
            Scenario Library Presets
          </h2>
          <span className="text-xs text-slate-400 font-mono">4 contract fixtures</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {scenarioPresets.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  isSelected
                    ? "border-[#56D9F5] bg-[#141d2e] shadow-lg shadow-[#56D9F5]/10"
                    : "border-slate-800 bg-[#101521] hover:border-slate-700 hover:bg-[#121826]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#56D9F5]">{preset.id}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold ${preset.badgeColor}`}>
                    {preset.expectedVerdict === "INVESTIGATE" || preset.expectedVerdict === "BLOCK"
                      ? "ESCALATE"
                      : preset.expectedVerdict}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-white">{preset.name}</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed font-sans">{preset.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#56D9F5]" />
              Configuration Envelope
            </h2>
            <button
              onClick={() => applyPreset(scenarioPresets[0])}
              className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> Reset to Baseline
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Kinematic Speed:</span>
              <span className={speed > 100 ? "text-[#FB7185] font-bold" : "text-[#34D399] font-bold"}>
                {speed} km/h {speed > 100 ? "(Excessive Velocity Jump)" : "(Urban Range)"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="220"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-[#56D9F5] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Biometric Face Similarity:</span>
              <span
                className={
                  faceConfidence >= 0.7
                    ? "text-[#34D399] font-bold"
                    : faceConfidence >= 0.4
                    ? "text-[#FBBF24] font-bold"
                    : "text-[#FB7185] font-bold"
                }
              >
                {(faceConfidence * 100).toFixed(0)}%{" "}
                {faceConfidence < 0.5 ? "(Passenger Mismatch)" : "(Verified Driver)"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={faceConfidence}
              onChange={(e) => setFaceConfidence(Number(e.target.value))}
              className="w-full accent-[#56D9F5] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Touch Typing Cadence:</span>
              <span className="text-slate-200 font-bold">{typingCadence} cpm</span>
            </div>
            <input
              type="range"
              min="50"
              max="600"
              step="10"
              value={typingCadence}
              onChange={(e) => setTypingCadence(Number(e.target.value))}
              className="w-full accent-[#56D9F5] cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Route Trajectory Deviation:</span>
              <span className={routeDeviation > 30 ? "text-[#FB7185] font-bold" : "text-slate-200 font-bold"}>
                {routeDeviation.toFixed(1)}% {routeDeviation > 30 ? "(Geo-Hop Detected)" : "(Corridor Aligned)"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={routeDeviation}
              onChange={(e) => setRouteDeviation(Number(e.target.value))}
              className="w-full accent-[#56D9F5] cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <span className="text-xs font-semibold text-slate-300 block">Hardware &amp; Security Envelope Injections:</span>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-[#080B12] border border-slate-800 hover:border-slate-700">
              <input
                type="checkbox"
                checked={mockGps}
                onChange={(e) => setMockGps(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 accent-[#56D9F5]"
              />
              <span className="flex-1 font-mono">Inject Mock Location Provider (GPS Spoofing Active)</span>
              {mockGps && <span className="text-[10px] text-[#FB7185] font-mono font-bold">-45 PTS</span>}
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-[#080B12] border border-slate-800 hover:border-slate-700">
              <input
                type="checkbox"
                checked={vpn}
                onChange={(e) => setVpn(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 accent-[#56D9F5]"
              />
              <span className="flex-1 font-mono">Datacenter / Commercial Proxy IP (Non-Residential ASN)</span>
              {vpn && <span className="text-[10px] text-[#FBBF24] font-mono font-bold">-15 PTS</span>}
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-[#080B12] border border-slate-800 hover:border-slate-700">
              <input
                type="checkbox"
                checked={rooted}
                onChange={(e) => setRooted(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 accent-[#56D9F5]"
              />
              <span className="flex-1 font-mono">Rooted / Jailbroken Hardware Kernel Flag</span>
              {rooted && <span className="text-[10px] text-red-400 font-mono font-bold">-35 PTS</span>}
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-[#080B12] border border-slate-800 hover:border-slate-700">
              <input
                type="checkbox"
                checked={payoutAccountChanged}
                onChange={(e) => setPayoutAccountChanged(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 accent-amber-500"
              />
              <span className="flex-1 font-mono">Payout Account Modified (Triggers 24h Escrow Lock)</span>
              {payoutAccountChanged && <span className="text-[10px] text-amber-400 font-mono font-bold">24H HOLD</span>}
            </label>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              onClick={runEvaluation}
              disabled={evaluating}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              {evaluating ? "Evaluating Live..." : "Run Real-time Assessment"}
            </button>

            <button
              type="button"
              onClick={() => setIsFaceModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all cursor-pointer"
            >
              <ScanFace className="h-4 w-4 text-cyan-400" />
              Biometric Liveness Modal
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#34D399]" />
                Synthetic Assessment Result
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {evaluating ? "EVALUATING ENGINE..." : isSimulatedResponse ? "SYNTHETIC FIXTURE SIMULATOR" : "REMOTE API :8000 LIVE"}
              </span>
            </div>

            {assessment && (
              <span
                className={`rounded border px-2.5 py-1 text-xs font-mono font-extrabold ${
                  assessment.verdict === "ALLOW"
                    ? "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]"
                    : assessment.verdict === "CHALLENGE"
                    ? "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]"
                    : assessment.verdict === "INVESTIGATE"
                    ? "border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]"
                    : "border-red-500/40 bg-red-500/10 text-red-400"
                }`}
              >
                VERDICT: {assessment.verdict === "INVESTIGATE" || assessment.verdict === "BLOCK" ? "ESCALATE" : assessment.verdict}
              </span>
            )}
          </div>

          {assessment && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#080B12] p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-mono block">Calculated Trust Score</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={`text-4xl font-extrabold font-mono ${
                        assessment.trust_score >= 75
                          ? "text-[#34D399]"
                          : assessment.trust_score >= 50
                          ? "text-[#FBBF24]"
                          : assessment.trust_score >= 20
                          ? "text-[#FB7185]"
                          : "text-red-400"
                      }`}
                    >
                      {assessment.trust_score.toFixed(1)}
                    </span>
                    <span className="text-slate-500 text-sm font-mono">/ 100</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 font-mono block">Risk Tier</span>
                  <span className="text-lg font-bold font-mono text-white mt-1 block">
                    {assessment.risk_tier}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Synthesized Threat Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {assessment.threat_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-[#56D9F5]/10 px-2 py-0.5 text-xs font-mono font-semibold text-[#56D9F5] border border-[#56D9F5]/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Factor Influence Decomposition (SHAP Values)</span>
                  <span className="text-slate-400 font-mono text-[11px]">Weight Normalized</span>
                </div>
                <div className="space-y-1.5 font-mono text-xs">
                  {assessment.factors.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-[#080B12] border border-slate-800 p-2 text-slate-300"
                    >
                      <span className="font-sans text-xs">{f.name}</span>
                      <span
                        className={
                          f.impact === "POSITIVE"
                            ? "text-[#34D399] font-bold"
                            : "text-[#FB7185] font-bold"
                        }
                      >
                        {f.impact === "POSITIVE" ? "+" : "-"}
                        {(f.weight * 100).toFixed(0)}% ({f.description})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {assessment.challenge && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <ScanFace className="h-4 w-4" /> Challenge Required: {assessment.challenge.challenge_type}
                    </span>
                    <span className="font-mono text-[10px] text-amber-400/80 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-700/50">
                      {assessment.challenge.challenge_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Risk tier step-up required due to biometric/behavioral anomaly. Complete 1:1 facial liveness verification to restore session.
                  </p>
                  <button
                    onClick={() => setIsFaceModalOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/50 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all shadow-sm cursor-pointer"
                  >
                    <ScanFace className="h-4 w-4 text-amber-400" />
                    Complete Face Liveness Challenge
                  </button>
                </div>
              )}

              {assessment.case_id && (
                <div className="rounded-xl border border-slate-800 bg-[#121826] p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Escalation Handoff Available</span>
                    <span className="text-[11px] text-slate-400">
                      Case #{assessment.case_id} queued for analyst review in SOC desk.
                    </span>
                  </div>
                  <Link
                    to={`/cases?id=${assessment.case_id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#56D9F5]/10 px-3 py-1.5 text-xs font-semibold text-[#56D9F5] border border-[#56D9F5]/30 hover:bg-[#56D9F5]/20 transition-all cursor-pointer"
                  >
                    Open Investigation Dossier
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FaceLivenessModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        challengeId={assessment?.challenge?.challenge_id || "chlg_demo_face_01"}
        riderId={assessment?.rider_id || "rider_interactive_sim"}
        onVerified={handleVerified}
      />
    </div>
  );
}
