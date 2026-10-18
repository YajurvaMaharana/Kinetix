import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { simulatePolicy, PolicySimResult } from "@/api/endpoints";
import {
  Scale,
  Sliders,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

export default function PoliciesPage() {
  const { role, canDeployPolicies, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState("sandbox");
  const [allowThreshold, setAllowThreshold] = useState(75);
  const [challengeThreshold, setChallengeThreshold] = useState(50);
  const [blockThreshold, setBlockThreshold] = useState(15);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<PolicySimResult>({
    policy_id: "SIM-2026-LIVE",
    sessions_evaluated: 10000,
    simulated_pass_rate: 0.948,
    simulated_friction_rate: 0.042,
    simulated_fraud_catch_rate: 0.986,
    estimated_chargeback_reduction_pct: 38.2,
  });

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await simulatePolicy({
        allow_threshold: allowThreshold,
        challenge_threshold: challengeThreshold,
        investigate_threshold: 25,
        block_threshold: blockThreshold,
      });
      setSimResult(res);
      showToast({
        type: "info",
        title: "Simulation Completed",
        message: `Evaluated ${res.sessions_evaluated.toLocaleString()} historical courier sessions.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Simulation Failed",
        message: err.message,
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleDeploy = () => {
    if (!canDeployPolicies || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Required",
        message: "Only Admin role can deploy policies to live fleet routers.",
      });
      return;
    }

    showToast({
      type: "success",
      title: "Policy Deployed to Edge Routers",
      message: `Cut-lines pushed: Allow ≥ ${allowThreshold}, Challenge ≥ ${challengeThreshold}, Block ≤ ${blockThreshold}.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Policy Orchestration"
        title="Risk Policy Simulator & Cut-Lines"
        subtitle="Tune automated hold thresholds and evaluate friction vs chargeback tradeoffs"
        secondaryAction={{
          label: "Run Stress Simulation",
          icon: Sliders,
          onClick: handleSimulate,
        }}
        primaryAction={{
          label: "Deploy Threshold Policy",
          icon: Sparkles,
          onClick: handleDeploy,
          disabled: !canDeployPolicies || isReadOnly,
          variant: "primary",
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "sandbox", label: "Simulation Sandbox" },
          { id: "active", label: "Active Live Cut-Lines" },
          { id: "audit", label: "Policy Change Ledger" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Threshold Sliders */}
        <div className="lg:col-span-6 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <h3 className="font-extrabold text-base text-[var(--ink)]">
                Dynamic Score Cut-Line Controls
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Drag to adjust autonomous triage thresholds
              </p>
            </div>
            <button
              onClick={() => {
                setAllowThreshold(75);
                setChallengeThreshold(50);
                setBlockThreshold(15);
              }}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]"
              title="Reset to defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Slider 1: Allow Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[var(--status-allow)]">
                <span className="w-2 h-2 rounded-full bg-[var(--status-allow)]" />
                Allow (Instant Payout) Floor
              </span>
              <span className="font-mono text-sm font-extrabold text-[var(--ink)]">
                ≥ {allowThreshold}
              </span>
            </div>
            <input
              type="range"
              min="60"
              max="95"
              value={allowThreshold}
              onChange={(e) => setAllowThreshold(Number(e.target.value))}
              className="w-full accent-[var(--status-allow)] cursor-pointer"
            />
            <p className="text-[11px] text-[var(--muted)]">
              Sessions scoring above {allowThreshold} automatically clear with 0 delay.
            </p>
          </div>

          {/* Slider 2: Challenge Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[var(--status-challenge)]">
                <span className="w-2 h-2 rounded-full bg-[var(--status-challenge)]" />
                Step-Up Challenge Floor
              </span>
              <span className="font-mono text-sm font-extrabold text-[var(--ink)]">
                ≥ {challengeThreshold}
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="70"
              value={challengeThreshold}
              onChange={(e) => setChallengeThreshold(Number(e.target.value))}
              className="w-full accent-[var(--status-challenge)] cursor-pointer"
            />
            <p className="text-[11px] text-[var(--muted)]">
              Sessions between {challengeThreshold} and {allowThreshold - 1} require 3D selfie or OTP verification.
            </p>
          </div>

          {/* Slider 3: Block Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[var(--status-escalate)]">
                <span className="w-2 h-2 rounded-full bg-[var(--status-escalate)]" />
                Instant Block / Case Threshold
              </span>
              <span className="font-mono text-sm font-extrabold text-[var(--ink)]">
                ≤ {blockThreshold}
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              value={blockThreshold}
              onChange={(e) => setBlockThreshold(Number(e.target.value))}
              className="w-full accent-[var(--status-escalate)] cursor-pointer"
            />
            <p className="text-[11px] text-[var(--muted)]">
              Sessions below {blockThreshold} lock payout escrows and quarantine the courier account.
            </p>
          </div>
        </div>

        {/* Right Column: Simulated Performance Metrics */}
        <div className="lg:col-span-6 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-6">
              <h3 className="font-extrabold text-base text-[var(--ink)]">
                Simulated Impact Forecast
              </h3>
              <span className="text-[10px] font-mono font-bold text-[var(--primary)] bg-[var(--lavender)] px-2.5 py-0.5 rounded-full">
                10,000 Session Replay
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Pass Rate (Zero Friction)</span>
                <div className="text-3xl font-extrabold text-[var(--status-allow)] mt-1">
                  {(simResult.simulated_pass_rate * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-1">
                  Autonomous payouts released
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Challenge Friction Rate</span>
                <div className="text-3xl font-extrabold text-[var(--status-challenge)] mt-1">
                  {(simResult.simulated_friction_rate * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-1">
                  Prompted for selfie check
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Fraud Catch Precision</span>
                <div className="text-3xl font-extrabold text-[var(--primary)] mt-1">
                  {(simResult.simulated_fraud_catch_rate * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-1">
                  Syndicates &amp; spoofing caught
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Chargeback Reduction</span>
                <div className="text-3xl font-extrabold text-[var(--accent)] mt-1">
                  +{simResult.estimated_chargeback_reduction_pct}%
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-1">
                  Est. $48,000 monthly savings
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--lavender)] border border-[var(--primary)]/20 text-xs text-[var(--muted)]">
            <div className="flex items-center gap-2 font-bold text-[var(--primary)] mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Recommended Threshold Configuration</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This balance maximizes courier retention while locking down ghost accounts and emulator syndicates before ACH cutoff.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
