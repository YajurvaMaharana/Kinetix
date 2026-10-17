"use client";

import React, { useState } from "react";
import { Sliders, Play, RotateCcw, ScanFace, ShieldAlert } from "lucide-react";
import { evaluateSession } from "@/lib/api";
import { Assessment, SessionRequest } from "@/lib/types";
import FaceLivenessModal from "@/components/FaceLivenessModal";

export default function SimulatorPage() {
  const [speed, setSpeed] = useState<number>(45);
  const [faceConfidence, setFaceConfidence] = useState<number>(0.95);
  const [mockLocation, setMockLocation] = useState<boolean>(false);
  const [vpnDetected, setVpnDetected] = useState<boolean>(false);
  const [payoutAccountChanged, setPayoutAccountChanged] = useState<boolean>(false);
  const [withdrawalRequested, setWithdrawalRequested] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [result, setResult] = useState<Assessment | null>(null);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState<boolean>(false);

  const handleRunSimulation = async () => {
    setEvaluating(true);
    try {
      const mockSession: SessionRequest = {
        session_id: `sim_${Date.now()}`,
        rider_id: "rider_simulated_user",
        driver_id: "drv_sim_01",
        timestamp: new Date().toISOString(),
        device_passport: {
          device_id_hash: "sim_hash_12345",
          device_model: "Simulator Device v2",
          os_version: "Android 14",
          app_version: "2.4.1",
          ip_address: "192.0.2.1",
          vpn_detected: vpnDetected,
          mock_location_detected: mockLocation,
          rooted_or_jailbroken: false,
        },
        biometrics: {
          face_present: true,
          face_match_confidence: faceConfidence,
          liveness_score: faceConfidence > 0.5 ? 0.92 : 0.2,
          biometric_backend: "simulated",
        },
        telemetry: {
          speed_kmh: speed,
          acceleration_variance: speed > 100 ? 0.8 : 0.15,
          gyro_stability: 0.9,
          typing_cadence_cpm: 210,
          route_deviation_pct: mockLocation ? 65 : 2.0,
          trip_distance_km: 10,
          elapsed_minutes: 15,
        },
        location: {
          lat: 37.7749,
          lng: -122.4194,
          accuracy_meters: mockLocation ? 1.0 : 5.0,
          zone_risk_level: mockLocation ? "HIGH" : "LOW",
        },
        financial: {
          fare_amount: 25.0,
          currency: "USD",
          payment_method: "apple_pay",
          tip_amount: 4.0,
          promo_applied: false,
          payout_account_changed: payoutAccountChanged,
          withdrawal_requested: withdrawalRequested,
          withdrawal_amount: withdrawalRequested ? 250.0 : 0.0,
        },
      };

      // Calculate client-side simulated assessment if backend endpoint is not yet mounted
      try {
        const remoteRes = await evaluateSession(mockSession);
        setResult(remoteRes);
      } catch {
        // Fallback local heuristic simulation
        let score = 95.0;
        if (mockLocation) score -= 50;
        if (vpnDetected) score -= 15;
        if (faceConfidence < 0.6) score -= 35;
        if (speed > 120) score -= 30;
        if (payoutAccountChanged) score -= 25;
        score = Math.max(5, Math.min(99, score));

        const verdict = score > 75 ? "ALLOW" : score > 40 ? "CHALLENGE" : "INVESTIGATE";
        setResult({
          assessment_id: `eval_sim_${Date.now()}`,
          session_id: mockSession.session_id,
          rider_id: mockSession.rider_id,
          trust_score: score,
          verdict,
          risk_tier: score > 75 ? "LOW" : score > 40 ? "MEDIUM" : "HIGH",
          threat_tags: mockLocation
            ? ["GEO_SPOOF"]
            : faceConfidence < 0.6
            ? ["ACCOUNT_HANDOFF"]
            : payoutAccountChanged
            ? ["PAYOUT_RISK"]
            : ["CLEAN"],
          factors: [
            {
              name: "Biometric Consistency",
              category: "BIOMETRIC",
              impact: faceConfidence >= 0.7 ? "POSITIVE" : "NEGATIVE",
              weight: 0.35,
              score: faceConfidence,
              description: `Face similarity confidence: ${(faceConfidence * 100).toFixed(0)}%`,
            },
            {
              name: "Location Integrity",
              category: "LOCATION",
              impact: mockLocation ? "NEGATIVE" : "POSITIVE",
              weight: 0.35,
              score: mockLocation ? 0.05 : 0.95,
              description: mockLocation ? "Mock location provider active" : "Genuine GPS sensors",
            },
          ],
          challenge: verdict === "CHALLENGE" ? {
            challenge_id: "chlg_sim_1",
            session_id: mockSession.session_id,
            challenge_type: "FACE_LIVENESS",
            status: "PENDING",
            expires_at: new Date(Date.now() + 300000).toISOString(),
            created_at: new Date().toISOString(),
          } : null,
          payout_decision: (payoutAccountChanged || withdrawalRequested) ? {
            status: "ESCROW_HOLD",
            hold_reason: "Destination account updated within 24-hour protection window. Requires liveness selfie + analyst clearance.",
            hold_period_hours: 24,
          } : undefined,
          case_id: verdict === "INVESTIGATE" ? "case_sim_01" : null,
          evaluated_at: new Date().toISOString(),
        });
      }
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sliders className="h-6 w-6 text-cyan-400" />
          Interactive Threat Simulator
        </h1>
        <p className="text-xs text-slate-400">
          Inject real-time anomalies: adjust velocity, face confidence, and mock GPS providers.
        </p>
      </div>

      {/* Held Payout Banner (Member C Requirement) */}
      {(payoutAccountChanged || result?.payout_decision?.status === "ESCROW_HOLD" || (result?.threat_tags && result.threat_tags.includes("PAYOUT_RISK"))) && (
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-colors shadow-sm"
            >
              <ScanFace className="h-3.5 w-3.5 text-amber-400" />
              Resolve with Facial Liveness
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-5">
          <h2 className="text-sm font-semibold text-slate-200">Session Parameter Sliders</h2>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Vehicle Speed: {speed} km/h</span>
              <span className={speed > 100 ? "text-amber-400" : "text-emerald-400"}>
                {speed > 100 ? "High Velocity" : "Urban Normal"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Face Match Confidence: {(faceConfidence * 100).toFixed(0)}%</span>
              <span className={faceConfidence < 0.6 ? "text-rose-400" : "text-emerald-400"}>
                {faceConfidence < 0.6 ? "Suspected Handoff" : "Verified Identity"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={faceConfidence}
              onChange={(e) => setFaceConfidence(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={mockLocation}
                onChange={(e) => setMockLocation(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 accent-indigo-600"
              />
              Inject Mock Location (GPS Spoof)
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={vpnDetected}
                onChange={(e) => setVpnDetected(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 accent-indigo-600"
              />
              Simulate Datacenter VPN
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={payoutAccountChanged}
                onChange={(e) => {
                  setPayoutAccountChanged(e.target.checked);
                  if (e.target.checked) setWithdrawalRequested(true);
                }}
                className="rounded border-slate-700 bg-slate-800 accent-amber-500"
              />
              Payout Account Modified (24h Window)
            </label>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={handleRunSimulation}
              disabled={evaluating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 transition-all disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              {evaluating ? "Evaluating Live..." : "Run Real-time Assessment"}
            </button>

            <button
              type="button"
              onClick={() => setIsFaceModalOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
            >
              <ScanFace className="h-4 w-4 text-cyan-400" />
              Open Biometric Liveness Modal
            </button>
          </div>
        </div>

        {/* Output Assessment Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Simulation Output Verdict</h2>
            {result && (
              <span className="font-mono text-xs text-slate-400">{result.assessment_id}</span>
            )}
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div>
                  <div className="text-xs text-slate-400">Calculated Trust Score</div>
                  <div className="text-3xl font-extrabold text-white font-mono">
                    {result.trust_score.toFixed(1)} / 100
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Engine Verdict</div>
                  <span
                    className={`inline-block rounded-md border px-2.5 py-1 text-xs font-bold ${
                      result.verdict === "ALLOW"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : result.verdict === "CHALLENGE"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {result.verdict}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Active Threat Tags:</div>
                <div className="flex flex-wrap gap-2">
                  {result.threat_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-mono text-indigo-300 border border-indigo-500/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Factor Contributions:</div>
                <div className="space-y-1.5 text-xs font-mono">
                  {result.factors.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded bg-slate-950/80 p-2 text-slate-300"
                    >
                      <span>{f.name}</span>
                      <span
                        className={
                          f.impact === "POSITIVE"
                            ? "text-emerald-400"
                            : f.impact === "NEGATIVE"
                            ? "text-rose-400"
                            : "text-slate-400"
                        }
                      >
                        {(f.score * 100).toFixed(0)}% ({f.impact})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {result.challenge && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <ScanFace className="h-4 w-4" /> Challenge Required: {result.challenge.challenge_type}
                    </span>
                    <span className="font-mono text-[10px] text-amber-400/80 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-700/50">
                      {result.challenge.challenge_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Risk tier step-up required due to biometric/behavioral anomaly. Complete 1:1 facial liveness verification to restore session.
                  </p>
                  <button
                    onClick={() => setIsFaceModalOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/50 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all shadow-sm"
                  >
                    <ScanFace className="h-4 w-4 text-amber-400" />
                    Complete Face Liveness Challenge
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center text-slate-500">
              <RotateCcw className="h-8 w-8 stroke-1 text-slate-600 mb-2" />
              <p className="text-xs">Adjust sliders and click &quot;Run Real-time Assessment&quot;</p>
            </div>
          )}
        </div>
      </div>

      <FaceLivenessModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        challengeId={result?.challenge?.challenge_id || "chlg_demo_face_01"}
        riderId={result?.rider_id || "rider_simulated_user"}
        onVerified={(res) => {
          if (result) {
            setResult({
              ...result,
              verdict: (res.new_verdict === "ALLOW" || res.new_verdict === "CHALLENGE" || res.new_verdict === "INVESTIGATE" ? res.new_verdict : "ALLOW") as "ALLOW" | "CHALLENGE" | "INVESTIGATE",
              trust_score: res.passed ? Math.min(100, result.trust_score + 15) : Math.max(10, result.trust_score - 40),
              threat_tags: res.passed ? ["CLEAN"] : ["ACCOUNT_HANDOFF"],
              challenge: res.passed ? null : result.challenge,
            });
          }
        }}
      />
    </div>
  );
}

