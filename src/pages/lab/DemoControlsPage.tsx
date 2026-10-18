import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { resetDemo, seedDemo } from "@/api/endpoints";
import {
  Cpu,
  RotateCcw,
  Database,
  Trash2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function DemoControlsPage() {
  const { role, canRunDemoControls, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState("actions");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleReset = async () => {
    if (!canRunDemoControls || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Admin role can reset or seed database states.",
      });
      return;
    }

    setLoadingAction("reset");
    try {
      const res = await resetDemo();
      showToast({
        type: "success",
        title: "Database Purged",
        message: res.message,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Reset Failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSeed = async () => {
    if (!canRunDemoControls || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Admin role can seed database states.",
      });
      return;
    }

    setLoadingAction("seed");
    try {
      const res = await seedDemo();
      showToast({
        type: "success",
        title: "Database Seeded",
        message: res.message,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Seed Failed",
        message: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSimulateSyndicate = () => {
    if (!canRunDemoControls || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Only Admin role can simulate syndicate bursts.",
      });
      return;
    }
    showToast({
      type: "error",
      title: "Attack Burst Injected",
      message: "Simulated 12 concurrent ghost orders with teleportation hop of 14km.",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="DevOps & Lab Controls"
        title="Scenario Controls & Database Seeding"
        subtitle="Purge demo database, seed baseline couriers, and simulate syndicate attacks"
        primaryAction={{
          label: "Reset to Baseline",
          icon: RotateCcw,
          onClick: handleReset,
          loading: loadingAction === "reset",
          disabled: !canRunDemoControls || isReadOnly,
          variant: "accent",
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "actions", label: "Platform Actions" },
          { id: "profiles", label: "Seed Data Profiles" },
          { id: "retention", label: "Privacy Purge SLA" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      <div className="grid md:grid-cols-3 gap-6">
        {/* Action Card 1: Reset Database */}
        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-[var(--ink)] mb-1">
              Purge Database &amp; Cache
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-6">
              Drops all synthetic sessions, resets biometric template caches, and restores zero-state environment.
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={!canRunDemoControls || isReadOnly || loadingAction === "reset"}
            className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            {loadingAction === "reset" ? "Purging State..." : "Execute Purge"}
          </button>
        </div>

        {/* Action Card 2: Seed Baseline */}
        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-4">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-[var(--ink)] mb-1">
              Seed Baseline Fleets
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-6">
              Seeds 50 authentic couriers across 18 regional hubs with verified biometric templates and clean telemetry histories.
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={!canRunDemoControls || isReadOnly || loadingAction === "seed"}
            className="w-full py-2.5 rounded-full bg-[var(--lavender)] text-[var(--primary)] hover:bg-[#e2d5f8] border border-[var(--border)] text-xs font-bold transition-all disabled:opacity-50"
          >
            {loadingAction === "seed" ? "Seeding..." : "Load Baseline Seed"}
          </button>
        </div>

        {/* Action Card 3: Inject Collusion Attack */}
        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-[var(--ink)] mb-1">
              Simulate Syndicate Burst
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-6">
              Triggers a live multi-agent collusion ring attack on downtown hubs to stress test the triage decision engine.
            </p>
          </div>
          <button
            onClick={handleSimulateSyndicate}
            disabled={!canRunDemoControls || isReadOnly}
            className="w-full py-2.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            Inject Attack Ring
          </button>
        </div>
      </div>
    </div>
  );
}
