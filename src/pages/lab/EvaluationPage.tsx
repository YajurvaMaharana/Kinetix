import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useToast } from "@/context/ToastContext";
import {
  Award,
  Download,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Zap,
  BarChart3,
  Lock,
} from "lucide-react";

export default function EvaluationPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("metrics");

  const handleDownload = () => {
    showToast({
      type: "success",
      title: "Model Card & Report Generated",
      message: "Exported evaluation metrics and ROC benchmark data to PDF.",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Model Quality & Compliance"
        title="Model Performance Evaluation"
        subtitle="Offline test set metrics, ROC curves, feature importances and sub-200ms latency SLAs"
        primaryAction={{
          label: "Export Evaluation Report",
          icon: Download,
          onClick: handleDownload,
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "metrics", label: "Model Metrics & SLA" },
          { id: "weights", label: "Feature Importance" },
          { id: "ethics", label: "Fairness & Privacy Audit" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* Benchmark Metric Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
            Overall Accuracy
          </span>
          <div className="text-3xl font-extrabold text-[var(--ink)] mt-2">99.4%</div>
          <div className="mt-2 text-xs font-bold text-[var(--status-allow)]">
            +0.6% vs baseline
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
            False Positive Rate
          </span>
          <div className="text-3xl font-extrabold text-[var(--status-allow)] mt-2">
            0.12%
          </div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            Preserves honest courier earnings
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
            ROC-AUC Score
          </span>
          <div className="text-3xl font-extrabold text-[var(--primary)] mt-2">0.998</div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            Class discrimination index
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft">
          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
            P99 Inference Latency
          </span>
          <div className="text-3xl font-extrabold text-[var(--accent)] mt-2">18ms</div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            Strict &lt; 200ms SLA compliant
          </div>
        </div>
      </div>

      {/* Feature Importance & Ethical Safeguards Split */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-4">
          <h3 className="font-extrabold text-base text-[var(--ink)]">
            Feature Importance (RandomForest + GNN Weights)
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Relative weight assigned to telemetry vectors during autonomous triage
          </p>

          <div className="space-y-3 pt-2">
            {[
              { name: "Cryptographic Device Passport (IMEI/SIM)", weight: 32 },
              { name: "Kinematic Road Plausibility (Speed/Gyro)", weight: 26 },
              { name: "Entity Graph Shared Identifiers (IBAN)", weight: 22 },
              { name: "Biometric 3D Liveness Nonce", weight: 14 },
              { name: "Typing Cadence & Touch Micro-Deltas", weight: 6 },
            ].map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[var(--ink)]">{f.name}</span>
                  <span className="font-mono text-[var(--primary)]">{f.weight}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--primary)] rounded-full"
                    style={{ width: `${f.weight * 2.5}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-base text-[var(--ink)] mb-1">
              Ethical AI &amp; Privacy Guarantees
            </h3>
            <p className="text-xs text-[var(--muted)] mb-4">
              Statutory compliance safeguards governing autonomous triage
            </p>

            <div className="space-y-3 text-xs text-[var(--muted)]">
              <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--status-allow)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--ink)]">Zero Raw Biometric Storage:</strong>
                  <p className="text-[11px] mt-0.5">Camera frames processed in volatile RAM only and discarded immediately.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--status-allow)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--ink)]">Zero Permanent Automated Bans:</strong>
                  <p className="text-[11px] mt-0.5">Every flagged courier has human appeal rights with 2-hour analyst SLA.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--status-allow)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--ink)]">Cryptographic Attestation:</strong>
                  <p className="text-[11px] mt-0.5">Hardware tokens verify device integrity without harvesting user data.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] text-[11px] text-[var(--muted)] flex items-center justify-between">
            <span>Audit status: <strong>CERTIFIED</strong></span>
            <span className="text-[var(--status-allow)] font-bold">SOC2 Type II</span>
          </div>
        </div>
      </div>
    </div>
  );
}
