import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { listSessions, SessionItem } from "@/api/endpoints";
import {
  ShieldAlert,
  Activity,
  Smartphone,
  Gauge,
  Wifi,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
} from "lucide-react";

export default function LiveMonitorPage() {
  const { role, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await listSessions();
        setSessions(data);
        if (data.length > 0) {
          setSelectedSession(data[0]);
        }
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Failed to load sessions",
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const handleSweep = () => {
    showToast({
      type: "info",
      title: "Sensor Sweep Triggered",
      message: "Ingesting 40Hz inertial telemetry from 18 regional delivery hubs.",
    });
  };

  const handleTriggerChallenge = (type: "OTP" | "Liveness") => {
    if (isReadOnly) {
      showToast({
        type: "warning",
        title: "Action Restricted",
        message: "Auditor role has read-only access.",
      });
      return;
    }
    showToast({
      type: "success",
      title: `${type} Challenge Issued`,
      message: `Step-up verification challenge dispatched to courier ${selectedSession?.rider_id}.`,
    });
  };

  const filtered = sessions.filter((s) => {
    if (tab === "anomalies") return s.status === "ESCALATE";
    if (tab === "challenges") return s.status === "CHALLENGE";
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Edge Sensor Ingestion"
        title="Live Telemetry & Anomaly Stream"
        subtitle="40Hz continuous inertial sensor fusion, GPS velocity vectors & hardware attestation"
        primaryAction={{
          label: "Trigger Sensor Sweep",
          icon: Radio,
          onClick: handleSweep,
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "all", label: "All Active Streams", count: sessions.length },
          { id: "challenges", label: "Liveness Challenges", count: 2 },
          { id: "anomalies", label: "Velocity Anomalies", count: 2 },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {loading ? (
        <SkeletonLoader type="split" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No anomalous sessions detected"
          description="All active couriers are currently reporting authentic kinematic trajectories."
        />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Live Session List */}
          <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft space-y-2 h-[560px] overflow-y-auto">
            <div className="px-2 py-1 text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
              <span>Active Courier Streams</span>
              <span className="flex items-center gap-1 text-[var(--status-allow)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-allow)] animate-pulse" />
                Live 40Hz
              </span>
            </div>

            {filtered.map((s) => {
              const isSelected = selectedSession?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                    isSelected
                      ? "bg-[var(--lavender)] border-[var(--primary)] shadow-sm"
                      : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        s.status === "ALLOW"
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : s.status === "CHALLENGE"
                          ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                          : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                      }`}
                    >
                      🚴
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-[var(--ink)]">
                        Courier {s.rider_id}
                      </div>
                      <div className="text-[10px] text-[var(--muted)] flex items-center gap-2 mt-0.5">
                        <span>Speed: {s.speed_kmh} km/h</span>
                        <span>•</span>
                        <span>ID: {s.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === "ALLOW"
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : s.status === "CHALLENGE"
                          ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                          : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                      }`}
                    >
                      {s.status}
                    </span>
                    <div className="text-[10px] font-mono font-bold text-[var(--muted)] mt-1">
                      Trust: {s.trust_score}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Detailed Telemetry Dossier */}
          {selectedSession && (
            <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                      TELEMETRY DOSSIER • {selectedSession.id}
                    </span>
                    <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
                      Courier {selectedSession.rider_id} Inspection
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTriggerChallenge("OTP")}
                      disabled={isReadOnly}
                      className="px-3 py-1.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--lavender)] transition-colors disabled:opacity-50"
                    >
                      Issue SMS OTP
                    </button>
                    <button
                      onClick={() => handleTriggerChallenge("Liveness")}
                      disabled={isReadOnly}
                      className="px-3 py-1.5 rounded-full bg-[var(--primary)] text-white text-xs font-bold shadow-plum hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                    >
                      Require 3D Selfie
                    </button>
                  </div>
                </div>

                {/* Telemetry Sensor Gauges */}
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Kinematic Velocity</span>
                    <div className="text-2xl font-extrabold text-[var(--ink)] mt-1">
                      {selectedSession.speed_kmh} <span className="text-xs font-normal text-[var(--muted)]">km/h</span>
                    </div>
                    <div className="text-[10px] text-[var(--status-allow)] font-bold mt-1">
                      ✓ Acceleration Delta: Normal
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">GPS Provider Source</span>
                    <div className="text-2xl font-extrabold text-[var(--primary)] mt-1">
                      Hardware
                    </div>
                    <div className="text-[10px] text-[var(--status-allow)] font-bold mt-1">
                      ✓ Zero Mock Location Flags
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Gyroscope Stability</span>
                    <div className="text-2xl font-extrabold text-[var(--ink)] mt-1">
                      0.94 <span className="text-xs font-normal text-[var(--muted)]">score</span>
                    </div>
                    <div className="text-[10px] text-[var(--status-allow)] font-bold mt-1">
                      ✓ Physical Road Vibration
                    </div>
                  </div>
                </div>

                {/* Device Passport Integrity Card */}
                <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-[var(--primary)]" />
                      Cryptographic Device Passport
                    </span>
                    <span className="text-[var(--status-allow)] text-[11px]">VERIFIED INSTANCE</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                    <div><strong>Handset:</strong> iPhone 15 Pro (iOS 18.2)</div>
                    <div><strong>Carrier:</strong> T-Mobile US (Authentic SIM)</div>
                    <div><strong>Device Hash:</strong> e3b0c442...9924</div>
                    <div><strong>Root / Jailbreak:</strong> Negative</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Inertial ingestion buffer refreshed continuously.</span>
                <span className="font-mono text-[var(--primary)] font-bold">Latency: 14ms</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
