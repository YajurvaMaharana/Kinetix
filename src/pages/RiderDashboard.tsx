import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { MOCK_RIDER_DELIVERIES } from "@/data/mockData";
import {
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Home,
  UserCheck,
  HelpCircle,
  LogOut,
  Camera,
  ArrowRight,
  Zap,
} from "lucide-react";

export default function RiderDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState(MOCK_RIDER_DELIVERIES);
  const [heldAmount, setHeldAmount] = useState(44.50);
  const [releasedAmount, setReleasedAmount] = useState(120.00);
  const [verifiedStatus, setVerifiedStatus] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleVerifyNow = () => {
    setTimeout(() => {
      setReleasedAmount(prev => prev + heldAmount);
      setHeldAmount(0);
      setVerifiedStatus(true);
      setDeliveries(prev => prev.map(d => ({ ...d, status: "Verified" as const })));
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col justify-between py-6 px-4">
      {/* Top Bar for Desktop Preview */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between mb-4">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
            RIDER PORTAL (MOBILE VIEW)
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Frame Container */}
      <div className="max-w-[400px] mx-auto w-full bg-[#231B33] rounded-[40px] p-4 shadow-plum border-4 border-[#4A2C6D]">
        <div className="bg-[#FFF9F2] rounded-[32px] overflow-hidden flex flex-col justify-between p-5 min-h-[780px] relative">
          
          {/* Phone Status Bar */}
          <div className="flex items-center justify-between text-xs font-bold text-[#231B33] mb-3">
            <span>9:41</span>
            <div className="w-20 h-4 bg-[#231B33] rounded-full mx-auto" />
            <div className="flex items-center gap-1">
              <span className="text-[10px]">5G</span>
              <div className="w-4 h-2.5 bg-[#231B33] rounded-sm" />
            </div>
          </div>

          {/* Header Greeting & Hub */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-extrabold text-[#231B33]">
                Good afternoon, {user?.name.split(" ")[0] || "Marcus"} 👋
              </h1>
              <p className="text-[11px] text-[#6B6480] mt-0.5">
                Courier ID: {user?.courierId || "CR-8941"} • {user?.hub || "Seattle Downtown Hub"}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#4A2C6D] text-white flex items-center justify-center font-bold">
              🚴
            </div>
          </div>

          {/* Shift Active Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[11px] font-bold mb-4 self-start">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
            Shift Active (GPS Telemetry Synced)
          </div>

          {/* Trust Score & Tier 1 Rating Card */}
          <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-[#2FBF8F]/10 border-4 border-[#2FBF8F] text-[#2FBF8F] font-extrabold text-sm">
                98%
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-[9px] font-bold uppercase tracking-wider mb-1">
                  🛡️ TIER 1 RATING
                </span>
                <h3 className="font-extrabold text-sm text-[#231B33]">Instant Payouts Enabled</h3>
                <p className="text-[10px] text-[#6B6480]">Automated clearing for all compliant orders</p>
              </div>
            </div>
          </div>

          {/* Route Accuracy & Metrics Mini Bar */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-white rounded-xl p-2.5 border border-gray-200">
              <div className="text-[10px] text-[#6B6480] font-bold">ROUTE ACCURACY</div>
              <div className="text-xs font-extrabold text-[#231B33] mt-0.5">99.4%</div>
            </div>
            <div className="bg-white rounded-xl p-2.5 border border-gray-200">
              <div className="text-[10px] text-[#6B6480] font-bold">LIVENESS</div>
              <div className="text-xs font-extrabold text-[#231B33] mt-0.5">2h ago</div>
            </div>
            <div className="bg-white rounded-xl p-2.5 border border-gray-200">
              <div className="text-[10px] text-[#6B6480] font-bold">AUDIT FLAGS</div>
              <div className="text-xs font-extrabold text-[#2FBF8F] mt-0.5">✓ 0</div>
            </div>
          </div>

          {/* Today's Earnings Card */}
          <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B6480]">TODAY'S EARNINGS</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold">+&nbsp;$22.00 tips</span>
            </div>
            <div className="text-3xl font-extrabold text-[#231B33] mb-2">$164.50</div>
            <div className="flex justify-between text-[11px] text-[#6B6480] mb-1.5 font-semibold">
              <span>Daily Target</span>
              <span>8 of 10 completed</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="w-4/5 h-full bg-[#4A2C6D] rounded-full" />
            </div>
          </div>

          {/* Payout Breakdown Card & Alert */}
          <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-xs text-[#231B33] flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-[#4A2C6D]" />
                <span>Payout Breakdown</span>
              </h4>
              <span className="text-[10px] text-[#2FBF8F] font-bold">REAL-TIME SYNC</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-[#FFF9F2] border border-gray-200">
                <div className="text-lg font-extrabold text-[#231B33]">${releasedAmount.toFixed(2)}</div>
                <div className="text-[10px] font-bold text-[#2FBF8F] mt-0.5">● RELEASED</div>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF9F2] border border-gray-200">
                <div className="text-lg font-extrabold text-[#FF6F61]">${heldAmount.toFixed(2)}</div>
                <div className="text-[10px] font-bold text-amber-600 mt-0.5">⏱ HELD FOR CHECK</div>
              </div>
            </div>

            {heldAmount > 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-start gap-2 text-[#231B33]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-relaxed">
                    Sudden GPS jump detected on 4th Ave dropoff. Complete a quick 5-second selfie to release funds instantly.
                  </span>
                </div>
                <button
                  onClick={handleVerifyNow}
                  className="w-full py-2 rounded-xl bg-[#FF6F61] hover:bg-[#e05a4e] text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Verify Now &amp; Release Funds</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All funds successfully released to your instant wallet!</span>
              </div>
            )}
          </div>

          {/* Recent Deliveries */}
          <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold text-xs text-[#231B33]">Recent Deliveries (Today)</h4>
              <span className="text-[10px] font-bold text-[#4A2C6D]">View All (8)</span>
            </div>

            <div className="space-y-2.5">
              {deliveries.map((item) => (
                <div key={item.id} className="p-2.5 rounded-xl bg-[#FFF9F2] border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#4A2C6D]/10 text-[#4A2C6D] flex items-center justify-center text-xs">
                      📦
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[#231B33]">Order #{item.id.replace("ord_", "")} • {item.merchant}</div>
                      <div className="text-[10px] text-[#6B6480]">Earned: ${item.earned.toFixed(2)} • {item.time}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === "Verified" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-700"}`}>
                    {item.status === "Verified" ? "✓ Verified" : "⏳ GPS Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro-Tip Card */}
          <div className="p-3 rounded-xl bg-[#F0EAFB] border border-[#4A2C6D]/20 text-[11px] text-[#231B33] flex items-start gap-2.5 mb-2">
            <span className="text-base">💡</span>
            <div>
              <span className="font-bold">Pro-Tip for Fast Payouts:</span> Keeping Wi-Fi enabled helps calibrate GPS accuracy and prevents wrongful fraud flags.
            </div>
          </div>

          {/* Bottom Mobile Navigation Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 py-2.5 px-6 flex items-center justify-between text-[10px] font-bold text-[#6B6480] shadow-sm mt-auto">
            <button className="flex flex-col items-center gap-1 text-[#4A2C6D]">
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button className="flex flex-col items-center gap-1 hover:text-[#4A2C6D]">
              <Banknote className="w-4 h-4" />
              <span>Payouts</span>
            </button>
            <button className="flex flex-col items-center gap-1 hover:text-[#4A2C6D]">
              <UserCheck className="w-4 h-4" />
              <span>Verify</span>
            </button>
            <button className="flex flex-col items-center gap-1 hover:text-[#4A2C6D]">
              <HelpCircle className="w-4 h-4" />
              <span>Help</span>
            </button>
          </div>

          {/* Bottom Home Indicator */}
          <div className="w-32 h-1 bg-[#231B33]/30 rounded-full mx-auto mt-2" />
        </div>
      </div>
    </div>
  );
}
