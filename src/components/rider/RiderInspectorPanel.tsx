import React from "react";
import { RiderProfileData } from "@/api/endpoints";
import {
  UserCheck,
  ChevronDown,
  Info,
  MapPin,
  CheckCircle2,
  CreditCard,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  Zap,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface RiderInspectorPanelProps {
  riders: RiderProfileData[];
  selectedRiderId: string;
  currentRider: RiderProfileData;
  onSelectRider: (riderId: string) => void;
  onResetHold: () => void;
  onTriggerLiveness: () => void;
}

export default function RiderInspectorPanel({
  riders,
  selectedRiderId,
  currentRider,
  onSelectRider,
  onResetHold,
  onTriggerLiveness,
}: RiderInspectorPanelProps) {
  const isHeld = currentRider.payout_status === "HELD";

  return (
    <div className="space-y-5">
      {/* Persona Switcher Card */}
      <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] shadow-soft space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="font-extrabold text-sm text-[var(--ink)]">
              Previewing as Rider
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--lavender)] text-[var(--primary)]">
            Persona Selector
          </span>
        </div>

        {/* Dropdown Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--muted)]">Select Courier Profile</label>
          <div className="relative">
            <select
              value={selectedRiderId}
              onChange={(e) => onSelectRider(e.target.value)}
              className="w-full appearance-none bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] pr-10 cursor-pointer"
            >
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.courier_id}) — {r.payout_status === "HELD" ? `[HELD $${r.held_amount.toFixed(2)}]` : "[RELEASED]"}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[var(--muted)] absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Persona Quick Chips */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {riders.map((r) => {
            const isSelected = r.id === selectedRiderId;
            return (
              <button
                key={r.id}
                onClick={() => onSelectRider(r.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                  isSelected
                    ? "bg-[var(--lavender)] border-[var(--primary)] ring-1 ring-[var(--primary)]"
                    : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                  {r.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-[var(--ink)] truncate">{r.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        r.payout_status === "HELD" ? "bg-[var(--status-challenge)] animate-pulse" : "bg-[var(--status-allow)]"
                      }`}
                    />
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      Score {r.trust_score}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Key Rider Details Card */}
      <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] shadow-soft space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--primary)]" />
            <span>Key Courier Details</span>
          </h3>
          <span
            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              isHeld
                ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)] border border-[var(--status-challenge)]/30"
                : "bg-[var(--status-allow)]/15 text-[var(--status-allow)] border border-[var(--status-allow)]/30"
            }`}
          >
            {currentRider.payout_status}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--muted)]">Full Name &amp; ID:</span>
            <span className="font-bold text-[var(--ink)]">
              {currentRider.name} <code className="text-[11px] text-[var(--primary)]">({currentRider.courier_id})</code>
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--muted)]">Assigned Logistics Hub:</span>
            <span className="font-bold text-[var(--ink)] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
              {currentRider.hub}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--muted)]">Trust Tier:</span>
            <span className="font-bold text-[var(--primary)] bg-[var(--lavender)] px-2 py-0.5 rounded-md">
              {currentRider.tier}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--muted)]">Registered Hardware:</span>
            <span className="font-mono text-[11px] font-bold text-[var(--ink)]">
              {currentRider.registered_device} ({currentRider.os_version})
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--muted)]">Hardware Attestation:</span>
            <span className="font-bold text-[var(--status-allow)] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {currentRider.device_attestation}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
            <span className="text-[var(--muted)]">Banking Destination:</span>
            <span className="font-mono text-[11px] font-bold text-[var(--ink)] flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-[var(--primary)]" />
              {currentRider.bank_account}
            </span>
          </div>

          <div className="flex justify-between py-1.5">
            <span className="text-[var(--muted)]">Today's Shift Activity:</span>
            <span className="font-bold text-[var(--ink)]">
              {currentRider.trips_today_count} Deliveries &bull; {currentRider.hours_online}h online
            </span>
          </div>
        </div>

        {/* Escrow Trigger Explanation Banner */}
        {isHeld && currentRider.hold_reason && (
          <div className="p-3.5 rounded-xl bg-[var(--status-challenge)]/10 border border-[var(--status-challenge)]/30 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[var(--status-challenge)]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Escrow Trigger: Transparent Security Reason</span>
            </div>
            <p className="text-[11px] text-[var(--ink)] leading-relaxed">
              {currentRider.hold_reason}
            </p>
            <div className="pt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span>Protected by 24h Payout Policy</span>
              <button
                onClick={onTriggerLiveness}
                className="font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Run In-Phone Liveness</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Quick Simulation Actions */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <button
            onClick={onResetHold}
            className="flex-1 py-2 px-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-alt)] text-xs font-bold text-[var(--ink)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span>Reset Payout Hold</span>
          </button>
        </div>
      </div>
    </div>
  );
}
