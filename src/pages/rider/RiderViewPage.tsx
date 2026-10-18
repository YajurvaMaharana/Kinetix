import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { MOCK_RIDER_DELIVERIES } from "@/data/mockData";
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Home,
  UserCheck,
  HelpCircle,
  Camera,
  ArrowRight,
  Zap,
} from "lucide-react";

export default function RiderViewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState("preview");
  const [deliveries, setDeliveries] = useState(MOCK_RIDER_DELIVERIES);
  const [heldAmount, setHeldAmount] = useState(44.5);
  const [releasedAmount, setReleasedAmount] = useState(120.0);
  const [verifying, setVerifying] = useState(false);

  const handleVerifyNow = () => {
    setVerifying(true);
    setTimeout(() => {
      setReleasedAmount((prev) => prev + heldAmount);
      setHeldAmount(0);
      setVerifying(false);
      setDeliveries((prev) => prev.map((d) => ({ ...d, status: "Verified" as const })));

      showToast({
        type: "success",
        title: "3D Liveness Verified",
        message: "$44.50 released instantly to your courier wallet!",
      });
    }, 900);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Driver Experience Suite"
        title="Courier Mobile Experience Preview"
        subtitle="Live simulation of the mobile rider view with trust score badge and instant wallet unlock"
        primaryAction={{
          label: "Simulate Trip Start",
          icon: Zap,
          onClick: () => {
            showToast({
              type: "info",
              title: "Shift Active",
              message: "Real-time 40Hz sensor fusion linked to Seattle Downtown Hub.",
            });
          },
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "preview", label: "Mobile Frame (390×844)" },
          { id: "telemetry", label: "Driver Privacy Settings" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      <div className="flex justify-center pb-8">
        {/* Mobile Device Frame */}
        <div className="w-full max-w-[400px] bg-[var(--ink)] rounded-[40px] p-4 shadow-plum border-4 border-[var(--primary)]">
          <div className="bg-[var(--background)] rounded-[32px] overflow-hidden flex flex-col justify-between p-5 min-h-[780px] relative text-[var(--ink)]">
            {/* Phone Status Bar */}
            <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)] mb-3">
              <span>9:41</span>
              <div className="w-20 h-4 bg-[var(--ink)] rounded-full mx-auto" />
              <div className="flex items-center gap-1">
                <span className="text-[10px]">5G</span>
                <div className="w-4 h-2.5 bg-[var(--ink)] rounded-sm" />
              </div>
            </div>

            {/* Header Greeting & Hub */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-extrabold text-[var(--ink)]">
                  Good afternoon, Marcus 👋
                </h1>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">
                  Courier ID: CR-8941 • Seattle Downtown Hub
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-bold">
                🚴
              </div>
            </div>

            {/* Shift Active Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--status-allow)]/15 text-[var(--status-allow)] text-[11px] font-bold mb-4 self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-allow)] animate-pulse" />
              Shift Active (GPS Telemetry Synced)
            </div>

            {/* Trust Score & Tier 1 Rating Card */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-[var(--status-allow)]/10 border-4 border-[var(--status-allow)] text-[var(--status-allow)] font-extrabold text-sm">
                  98%
                </div>
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[9px] font-bold uppercase tracking-wider mb-1">
                    🛡️ TIER 1 RATING
                  </span>
                  <h3 className="font-extrabold text-sm text-[var(--ink)]">Instant Payouts Enabled</h3>
                  <p className="text-[10px] text-[var(--muted)]">Automated clearing for all compliant orders</p>
                </div>
              </div>
            </div>

            {/* Route Accuracy & Metrics Mini Bar */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="bg-[var(--surface)] rounded-xl p-2.5 border border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--muted)] font-bold">ROUTE ACCURACY</div>
                <div className="text-xs font-extrabold text-[var(--ink)] mt-0.5">99.4%</div>
              </div>
              <div className="bg-[var(--surface)] rounded-xl p-2.5 border border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--muted)] font-bold">LIVENESS</div>
                <div className="text-xs font-extrabold text-[var(--ink)] mt-0.5">2h ago</div>
              </div>
              <div className="bg-[var(--surface)] rounded-xl p-2.5 border border-[var(--border-subtle)]">
                <div className="text-[10px] text-[var(--muted)] font-bold">AUDIT FLAGS</div>
                <div className="text-xs font-extrabold text-[var(--status-allow)] mt-0.5">✓ 0</div>
              </div>
            </div>

            {/* Today's Earnings Card */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)]">TODAY'S EARNINGS</span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--status-allow)]/15 text-[var(--status-allow)] text-[10px] font-bold">+ $22.00 tips</span>
              </div>
              <div className="text-3xl font-extrabold text-[var(--ink)] mb-2">$164.50</div>
              <div className="flex justify-between text-[11px] text-[var(--muted)] mb-1.5 font-semibold">
                <span>Daily Target</span>
                <span>8 of 10 completed</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                <div className="w-4/5 h-full bg-[var(--primary)] rounded-full" />
              </div>
            </div>

            {/* Payout Breakdown Card & Alert */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-[var(--ink)] flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Payout Breakdown</span>
                </h4>
                <span className="text-[10px] text-[var(--status-allow)] font-bold">REAL-TIME SYNC</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
                  <div className="text-lg font-extrabold text-[var(--ink)]">${releasedAmount.toFixed(2)}</div>
                  <div className="text-[10px] font-bold text-[var(--status-allow)] mt-0.5">● RELEASED</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
                  <div className="text-lg font-extrabold text-[var(--accent)]">${heldAmount.toFixed(2)}</div>
                  <div className="text-[10px] font-bold text-[var(--status-challenge)] mt-0.5">⏱ HELD FOR CHECK</div>
                </div>
              </div>

              {heldAmount > 0 ? (
                <div className="p-3 rounded-xl bg-[var(--status-challenge)]/10 border border-[var(--status-challenge)]/30 text-xs space-y-2">
                  <div className="flex items-start gap-2 text-[var(--ink)]">
                    <AlertTriangle className="w-4 h-4 text-[var(--status-challenge)] shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed">
                      Sudden GPS jump detected on 4th Ave dropoff. Complete a quick 5-second selfie to release funds instantly.
                    </span>
                  </div>
                  <button
                    onClick={handleVerifyNow}
                    disabled={verifying}
                    className="w-full py-2 rounded-xl bg-[var(--accent)] hover:bg-[#e05a4e] text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {verifying ? (
                      <span>Verifying 3D Face...</span>
                    ) : (
                      <>
                        <span>Verify Now &amp; Release Funds</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[var(--status-allow)]/10 border border-[var(--status-allow)]/30 text-xs text-[var(--status-allow)] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-allow)]" />
                  <span>All funds successfully released to instant wallet!</span>
                </div>
              )}
            </div>

            {/* Recent Deliveries */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-extrabold text-xs text-[var(--ink)]">Recent Deliveries (Today)</h4>
                <span className="text-[10px] font-bold text-[var(--primary)]">View All (8)</span>
              </div>

              <div className="space-y-2.5">
                {deliveries.map((item) => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xs">
                        📦
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[var(--ink)]">Order #{item.id.replace("ord_", "")} • {item.merchant}</div>
                        <div className="text-[10px] text-[var(--muted)]">Earned: ${item.earned.toFixed(2)} • {item.time}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === "Verified" ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]" : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"}`}>
                      {item.status === "Verified" ? "✓ Verified" : "⏳ GPS Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro-Tip Card */}
            <div className="p-3 rounded-xl bg-[var(--lavender)] border border-[var(--primary)]/20 text-[11px] text-[var(--ink)] flex items-start gap-2.5 mb-2">
              <span className="text-base">💡</span>
              <div>
                <span className="font-bold">Pro-Tip for Fast Payouts:</span> Keeping Wi-Fi enabled helps calibrate GPS accuracy and prevents wrongful fraud flags.
              </div>
            </div>

            {/* Bottom Mobile Navigation Bar */}
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] py-2.5 px-6 flex items-center justify-between text-[10px] font-bold text-[var(--muted)] shadow-sm mt-auto">
              <button className="flex flex-col items-center gap-1 text-[var(--primary)]">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
              <button className="flex flex-col items-center gap-1 hover:text-[var(--primary)]">
                <Banknote className="w-4 h-4" />
                <span>Payouts</span>
              </button>
              <button className="flex flex-col items-center gap-1 hover:text-[var(--primary)]">
                <UserCheck className="w-4 h-4" />
                <span>Verify</span>
              </button>
              <button className="flex flex-col items-center gap-1 hover:text-[var(--primary)]">
                <HelpCircle className="w-4 h-4" />
                <span>Help</span>
              </button>
            </div>

            {/* Bottom Home Indicator */}
            <div className="w-32 h-1 bg-[var(--ink)]/30 rounded-full mx-auto mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
