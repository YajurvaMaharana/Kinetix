import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import FaceLivenessModal from "@/components/FaceLivenessModal";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  Banknote,
  Navigation,
  ArrowRight,
  TrendingUp,
  Info,
  X,
  Sparkles,
  Bike,
  HelpCircle,
  ChevronRight,
  Zap,
} from "lucide-react";

interface RiderTrip {
  id: string;
  merchant: string;
  dropoffAddress: string;
  fare: number;
  tip: number;
  time: string;
  status: "Verified" | "Under review" | "Released";
  flagReason?: string;
}

export default function RiderHomePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Payout and Verification States
  const [payoutStatus, setPayoutStatus] = useState<"Held" | "Released">("Held");
  const [heldAmount, setHeldAmount] = useState(44.5);
  const [releasedBalance, setReleasedBalance] = useState(142.8);
  const [todayEarnings, setTodayEarnings] = useState(187.3);
  const [weekEarnings, setWeekEarnings] = useState(864.2);
  const [trustScore, setTrustScore] = useState(96);
  const [showLivenessModal, setShowLivenessModal] = useState(false);
  const [showScoreDrawer, setShowScoreDrawer] = useState(false);

  // 24-Hour Countdown Timer for held funds
  const [timeLeft, setTimeLeft] = useState({ hours: 23, minutes: 42, seconds: 15 });

  useEffect(() => {
    if (payoutStatus !== "Held") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        }
        if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        }
        if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [payoutStatus]);

  // Recent Delivery Trips
  const [trips, setTrips] = useState<RiderTrip[]>([
    {
      id: "TR-8941",
      merchant: "FreshBite Express",
      dropoffAddress: "402 Pine St, Apt 4B",
      fare: 14.5,
      tip: 4.0,
      time: "1:45 PM",
      status: "Released",
    },
    {
      id: "TR-8938",
      merchant: "Urban Kitchens & Grill",
      dropoffAddress: "1208 4th Ave, Suite 200",
      fare: 22.0,
      tip: 6.5,
      time: "12:15 PM",
      status: "Under review",
      flagReason: "Minor GPS drift recorded near high-rise canyon",
    },
    {
      id: "TR-8931",
      merchant: "Bean & Leaf Coffee Co.",
      dropoffAddress: "800 Olive Way, Lobby",
      fare: 9.8,
      tip: 3.0,
      time: "10:30 AM",
      status: "Released",
    },
    {
      id: "TR-8924",
      merchant: "Sushi Tokyo Express",
      dropoffAddress: "1520 Westlake Ave N",
      fare: 18.2,
      tip: 5.0,
      time: "9:15 AM",
      status: "Released",
    },
  ]);

  // Handle Liveness Verification Success
  const handleLivenessVerified = () => {
    setShowLivenessModal(false);
    setPayoutStatus("Released");
    setReleasedBalance((prev) => prev + heldAmount);
    setHeldAmount(0);
    setTrustScore(98);

    // Update trips status
    setTrips((prev) =>
      prev.map((t) => (t.status === "Under review" ? { ...t, status: "Released" } : t))
    );

    showToast({
      type: "success",
      title: "Facial Liveness Verified!",
      message: "$44.50 hold unlocked immediately. Funds are now in your available balance.",
    });
  };

  // Trust score ring calculation
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (trustScore / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* GREETING & STATUS BANNER */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-black uppercase tracking-wider border border-[#2FBF8F]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F]" />
              <span>ACTIVE COURIER • {user?.vehicleType || "SCOOTER"} • {user?.city || "SEATTLE HUB"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231B33] tracking-tight">
              Good afternoon, {user?.name || "Marcus"}!
            </h1>
            <p className="text-xs text-[#6B6480] max-w-lg leading-relaxed">
              Your device and GPS telemetry are connected with high integrity. Keep your score above 90% for instant sub-minute payout clearing.
            </p>
          </div>

          {/* Trust Score Circular Ring */}
          <div className="flex items-center gap-4 bg-[#FFF9F2] p-4 rounded-2xl border border-[#4A2C6D]/10 shrink-0">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  stroke="#E8E2D9"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  stroke="#2FBF8F"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-[#231B33]">{trustScore}%</span>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#2FBF8F]">
                  Tier 1
                </span>
              </div>
            </div>

            <div className="space-y-1 text-left">
              <div className="text-xs font-extrabold text-[#231B33]">Trust Score</div>
              <div className="text-[11px] text-[#2FBF8F] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Excellent Standing</span>
              </div>
              <button
                type="button"
                onClick={() => setShowScoreDrawer(true)}
                className="text-[11px] font-bold text-[#4A2C6D] hover:underline flex items-center gap-1 pt-1"
              >
                <span>What affects my score?</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* EARNINGS SUMMARY CARDS */}
      {/* ========================================================= */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Today's Earnings */}
        <div className="bg-white rounded-3xl p-6 border border-[#4A2C6D]/15 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B6480]">
              Today's Earnings
            </div>
            <div className="text-3xl font-black text-[#231B33] mt-1 tracking-tight">
              ${todayEarnings.toFixed(2)}
            </div>
            <div className="mt-2 text-[11px] font-semibold text-[#6B6480] flex items-center gap-2">
              <span className="text-[#2FBF8F] font-bold">4 completed trips</span>
              <span>•</span>
              <span>4.2 hours online</span>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#2FBF8F]/15 text-[#2FBF8F] flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* This Week's Earnings */}
        <div className="bg-white rounded-3xl p-6 border border-[#4A2C6D]/15 shadow-soft flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#6B6480]">
              This Week's Total
            </div>
            <div className="text-3xl font-black text-[#4A2C6D] mt-1 tracking-tight">
              ${weekEarnings.toFixed(2)}
            </div>
            <div className="mt-2 text-[11px] font-semibold text-[#6B6480] flex items-center gap-2">
              <span className="text-[#4A2C6D] font-bold">42 trips finished</span>
              <span>•</span>
              <span>Next ACH: Mon 6:00 AM</span>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center shrink-0">
            <Banknote className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PAYOUT STATUS CARD (RELEASED / UNDER REVIEW / HELD) */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#4A2C6D]/15 shadow-soft relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#4A2C6D]/10 text-[#4A2C6D]">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#231B33]">Payout Settlement Status</h2>
              <p className="text-[11px] text-[#6B6480]">Instant escrow protection &amp; release tracking</p>
            </div>
          </div>

          {/* Status Badge */}
          {payoutStatus === "Held" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 text-xs font-black uppercase tracking-wider border border-amber-500/30">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Held • Action Needed</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-xs font-black uppercase tracking-wider border border-[#2FBF8F]/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>All Released</span>
            </div>
          )}
        </div>

        {/* Payout Amounts Split */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {/* Available / Released Balance */}
          <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10">
            <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
              Ready for Instant Cashout
            </span>
            <div className="text-2xl font-black text-[#231B33] mt-1">
              ${releasedBalance.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#2FBF8F] font-bold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Unlocked • Clears in 60s</span>
            </div>
          </div>

          {/* Held Payout with 24-Hour Countdown */}
          <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
                Temporary Escrow Hold
              </span>
              {payoutStatus === "Held" && (
                <span className="text-[10px] font-mono font-extrabold text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded-full">
                  {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              ${heldAmount.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#6B6480] mt-1">
              {payoutStatus === "Held" ? (
                <span>Trip #TR-8938 awaiting biometric verification</span>
              ) : (
                <span className="text-[#2FBF8F] font-bold">Zero active holds!</span>
              )}
            </div>
          </div>
        </div>

        {/* Held Action Notice & Verify Now Button */}
        {payoutStatus === "Held" ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-800 shrink-0 mt-0.5">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <div className="font-extrabold text-amber-950">
                  Quick Selfie Verification Required ($44.50)
                </div>
                <p className="text-amber-900/80 mt-0.5 leading-relaxed">
                  A momentary GPS drift was recorded between high-rise buildings on your 12:15 PM trip. Complete a 3-second 3D facial verification to release your payout immediately without waiting 24 hours.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLivenessModal(true)}
              className="py-3 px-6 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs shadow-md transition-all shrink-0 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Verify Now</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#2FBF8F]/10 border border-[#2FBF8F]/25 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 text-[#231B33]">
              <CheckCircle2 className="w-5 h-5 text-[#2FBF8F] shrink-0" />
              <span>All today's delivery payouts are verified and ready for instant transfer.</span>
            </div>
            <Link
              to="/rider/payouts"
              className="font-extrabold text-[#4A2C6D] hover:underline shrink-0"
            >
              Transfer Funds →
            </Link>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* RECENT TRIPS */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#4A2C6D]/15 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#231B33]">Recent Deliveries</h2>
            <p className="text-[11px] text-[#6B6480]">Today's completed trips with verified telemetry</p>
          </div>
          <Link
            to="/rider/trips"
            className="text-xs font-bold text-[#4A2C6D] hover:underline flex items-center gap-1"
          >
            <span>View All Trips</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 hover:border-[#4A2C6D]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-[#231B33]">{trip.merchant}</span>
                  <span className="text-[10px] font-mono text-[#6B6480]">({trip.id})</span>
                </div>
                <div className="text-[11px] text-[#6B6480] flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-[#FF6F61]" />
                  <span>{trip.dropoffAddress}</span>
                  <span>•</span>
                  <span>{trip.time}</span>
                </div>
                {trip.flagReason && (
                  <div className="text-[10px] text-amber-700 font-medium">
                    ⚠️ {trip.flagReason}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                <div className="text-right">
                  <div className="font-extrabold text-sm text-[#231B33]">
                    ${(trip.fare + trip.tip).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#6B6480]">
                    Fare ${trip.fare.toFixed(2)} + Tip ${trip.tip.toFixed(2)}
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    trip.status === "Released"
                      ? "bg-[#2FBF8F]/15 text-[#2FBF8F] border border-[#2FBF8F]/25"
                      : "bg-amber-500/15 text-amber-800 border border-amber-500/30"
                  }`}
                >
                  {trip.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DRAWER: WHAT AFFECTS MY SCORE (PLAIN LANGUAGE) */}
      {/* ========================================================= */}
      {showScoreDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#231B33]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowScoreDrawer(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#2FBF8F]/15 text-[#2FBF8F] flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-[#231B33]">What Affects My Trust Score?</h3>
                      <p className="text-[11px] text-[#6B6480]">Transparent rules in plain language</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowScoreDrawer(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-[#6B6480] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-5 text-xs text-[#231B33] leading-relaxed">
                  <p className="text-xs text-[#6B6480]">
                    Your trust score measures the authenticity and consistency of your delivery telemetry. A higher score unlocks instant sub-minute payouts and bypasses routine holds.
                  </p>

                  {/* Factor 1 */}
                  <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-1">
                    <div className="font-extrabold text-[#4A2C6D] flex items-center gap-2">
                      <span>1. Authentic GPS Telemetry</span>
                    </div>
                    <p className="text-[11px] text-[#6B6480]">
                      Your phone's location should follow realistic street speeds. Avoid "mock location" simulation apps, VPNs, or apps that distort GPS coordinates.
                    </p>
                  </div>

                  {/* Factor 2 */}
                  <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-1">
                    <div className="font-extrabold text-[#2FBF8F] flex items-center gap-2">
                      <span>2. Fast Selfie Liveness Checks</span>
                    </div>
                    <p className="text-[11px] text-[#6B6480]">
                      Completing prompt facial checks proves you are the authorized registered courier. Successful selfies immediately boost and protect your score.
                    </p>
                  </div>

                  {/* Factor 3 */}
                  <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-1">
                    <div className="font-extrabold text-[#FF6F61] flex items-center gap-2">
                      <span>3. Single Registered Device</span>
                    </div>
                    <p className="text-[11px] text-[#6B6480]">
                      Always deliver with your own smartphone. Frequently swapping accounts across multiple handsets or emulators triggers security flags.
                    </p>
                  </div>

                  {/* Factor 4 */}
                  <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-1">
                    <div className="font-extrabold text-[#231B33] flex items-center gap-2">
                      <span>4. Reasonable Drop-off Times</span>
                    </div>
                    <p className="text-[11px] text-[#6B6480]">
                      Delivery times that naturally reflect real-world traffic conditions and vehicle speeds keep your account in Tier 1 Standing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <button
                  onClick={() => setShowScoreDrawer(false)}
                  className="w-full py-3 rounded-full bg-[#4A2C6D] text-white font-extrabold text-xs hover:bg-[#392153] transition-colors"
                >
                  Got It, Thanks!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FACIAL LIVENESS MODAL */}
      {/* ========================================================= */}
      <FaceLivenessModal
        isOpen={showLivenessModal}
        challengeId="CHAL-PAYOUT-RELEASE-9041"
        riderId={user?.email || "marcus.chen@example.com"}
        onClose={() => setShowLivenessModal(false)}
        onVerified={handleLivenessVerified}
      />
    </div>
  );
}
