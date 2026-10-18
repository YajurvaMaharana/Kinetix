import React, { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getRiderList,
  getRiderProfile,
  completeRiderLivenessVerification,
  RiderProfileData,
  MOCK_RIDER_PROFILES,
} from "@/api/endpoints";
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
  Camera,
  ScanFace,
  ArrowRight,
  Zap,
  RotateCcw,
  Clock,
  MapPin,
  Lock,
  Unlock,
  Check,
  X,
  ChevronDown,
  Navigation,
  CreditCard,
  User,
  Sparkles,
  RefreshCw,
  Eye,
  Info,
} from "lucide-react";
import FacialLivenessModal from "@/components/FacialLivenessModal";

export default function RiderViewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [riders, setRiders] = useState<RiderProfileData[]>(MOCK_RIDER_PROFILES);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("rider_8941");
  const [currentRider, setCurrentRider] = useState<RiderProfileData>(MOCK_RIDER_PROFILES[0]);
  const [activePhoneTab, setActivePhoneTab] = useState<"home" | "trips" | "wallet" | "profile">("home");

  // In-Phone Liveness Verification Flow State
  const [livenessFlowActive, setLivenessFlowActive] = useState(false);
  const [livenessStep, setLivenessStep] = useState<"instructions" | "scanning" | "success">("instructions");
  const [scanProgress, setScanProgress] = useState(0);
  const [useWebcam, setUseWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [isFacialModalOpen, setIsFacialModalOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load riders on mount
  useEffect(() => {
    async function loadData() {
      try {
        const list = await getRiderList();
        if (list && list.length > 0) {
          setRiders(list);
          const found = list.find((r) => r.id === selectedRiderId) || list[0];
          setCurrentRider(found);
        }
      } catch (err) {
        console.error("Failed to load rider profiles", err);
      }
    }
    loadData();
  }, []);

  // Sync rider when selectedRiderId changes
  useEffect(() => {
    const found = riders.find((r) => r.id === selectedRiderId) || riders[0];
    setCurrentRider(found);
    setLivenessFlowActive(false);
    setLivenessStep("instructions");
  }, [selectedRiderId, riders]);

  // Clean up webcam stream on unmount or when flow ends
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Stop camera helper
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setUseWebcam(false);
  };

  // Start webcam helper
  const startWebcam = async () => {
    setWebcamError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam not available in this browser environment.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setUseWebcam(true);
    } catch (err: any) {
      setWebcamError(err.message || "Camera access denied. Simulation active.");
      setUseWebcam(false);
    }
  };

  // Launch liveness flow via reusable FacialLivenessModal
  const handleStartLivenessFlow = () => {
    setIsFacialModalOpen(true);
  };

  // Run scanning animation in phone
  const handleBeginScanning = () => {
    setLivenessStep("scanning");
    setScanProgress(15);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          handleFinishVerification();
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  // Complete verification
  const handleFinishVerification = async () => {
    try {
      const res = await completeRiderLivenessVerification(currentRider.id);
      stopWebcam();
      setLivenessStep("success");

      // Update current rider state locally
      setCurrentRider((prev) => ({
        ...prev,
        payout_status: "RELEASED",
        held_amount: 0,
        released_amount: prev.released_amount + res.released_amount,
        trust_score: res.new_score,
        trust_trend: "improving",
        recent_trips: prev.recent_trips.map((t) => ({ ...t, status: "Verified" as const })),
      }));

      // Update riders list
      setRiders((prev) =>
        prev.map((r) =>
          r.id === currentRider.id
            ? {
                ...r,
                payout_status: "RELEASED",
                held_amount: 0,
                released_amount: r.released_amount + res.released_amount,
                trust_score: res.new_score,
                trust_trend: "improving",
                recent_trips: r.recent_trips.map((t) => ({ ...t, status: "Verified" as const })),
              }
            : r
        )
      );

      showToast({
        type: "success",
        title: "3D Liveness Verified",
        message: `$${res.released_amount.toFixed(2)} hold released immediately to ${currentRider.first_name}'s wallet!`,
      });

      // Auto return to dashboard after 2 seconds
      setTimeout(() => {
        setLivenessFlowActive(false);
        setLivenessStep("instructions");
      }, 2200);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Verification Failed",
        message: err.message || "Failed to process liveness challenge.",
      });
      setLivenessFlowActive(false);
    }
  };

  // Reset held state for demo testing
  const handleResetToHeld = () => {
    setCurrentRider((prev) => ({
      ...prev,
      payout_status: "HELD",
      held_amount: 44.50,
      released_amount: Math.max(0, prev.released_amount - 44.50),
      trust_score: 72,
      trust_trend: "degrading",
    }));

    setRiders((prev) =>
      prev.map((r) =>
        r.id === currentRider.id
          ? {
              ...r,
              payout_status: "HELD",
              held_amount: 44.50,
              released_amount: Math.max(0, r.released_amount - 44.50),
              trust_score: 72,
              trust_trend: "degrading",
            }
          : r
      )
    );

    showToast({
      type: "info",
      title: "Simulation Reset",
      message: `Reset ${currentRider.first_name} to HELD state with $44.50 escrow lock.`,
    });
  };

  // Trust score ring math (r = 44 -> 2 * PI * 44 = 276.46)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (currentRider.trust_score / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#2FBF8F"; // Green / Allow
    if (score >= 50) return "#F5A524"; // Amber / Challenge
    return "#E5484D"; // Rose / Escalate
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        badge="Driver Experience Portal"
        title="Courier Mobile Experience (Rider View)"
        subtitle="Simulated native companion app on iPhone 15 frame (390×844) with real-time trust ring and biometric escrow release."
        secondaryAction={{
          label: "Reset Payout Hold",
          icon: RotateCcw,
          onClick: handleResetToHeld,
        }}
        primaryAction={{
          label: "Trigger Shift Check-in",
          icon: Zap,
          onClick: () => {
            showToast({
              type: "info",
              title: "Shift Synchronized",
              message: `Active GPS & 40Hz road telemetry confirmed for ${currentRider.hub}.`,
            });
          },
          variant: "primary",
        }}
      />

      {/* Main Grid: Left Panel (Inspector) + Center (Phone Frame) */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* ================================================================= */}
        {/* LEFT PANEL: Rider Profile Inspector & Persona Switcher            */}
        {/* ================================================================= */}
        <div className="lg:col-span-5 space-y-5">
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
                  onChange={(e) => setSelectedRiderId(e.target.value)}
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
                    onClick={() => setSelectedRiderId(r.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
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
                <span>Security Profile &amp; Telemetry Data</span>
              </h3>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  currentRider.payout_status === "HELD"
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
            {currentRider.payout_status === "HELD" && currentRider.hold_reason && (
              <div className="p-3.5 rounded-xl bg-[var(--status-challenge)]/10 border border-[var(--status-challenge)]/30 space-y-1 text-xs">
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
                    onClick={handleStartLivenessFlow}
                    className="font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <span>Run Liveness Check</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* CENTER COLUMN: Centered Phone Frame (390 × 844)                   */}
        {/* ================================================================= */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          {/* Frame Label */}
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
            <Smartphone className="w-4 h-4 text-[var(--primary)]" />
            <span>Interactive Mobile Viewport (390 × 844)</span>
          </div>

          {/* Realistic iPhone 15 Chassis Container */}
          <div
            style={{ width: "390px", height: "844px" }}
            className="relative bg-[#181226] rounded-[52px] p-[10px] shadow-2xl shadow-purple-950/40 border-4 border-[#35254A] flex flex-col shrink-0 select-none overflow-hidden"
          >
            {/* Phone Bezel Buttons Simulation */}
            <div className="absolute -left-[6px] top-24 w-[3px] h-9 bg-[#4A3860] rounded-l" />
            <div className="absolute -left-[6px] top-36 w-[3px] h-12 bg-[#4A3860] rounded-l" />
            <div className="absolute -left-[6px] top-52 w-[3px] h-12 bg-[#4A3860] rounded-l" />
            <div className="absolute -right-[6px] top-32 w-[3px] h-16 bg-[#4A3860] rounded-r" />

            {/* Inner Screen Display (370 × 824) */}
            <div className="w-full h-full bg-[#FFF9F2] rounded-[42px] overflow-hidden flex flex-col justify-between relative text-[#231B33]">
              {/* Dynamic Island & Status Bar */}
              <div className="px-6 pt-3 pb-1 flex items-center justify-between z-20 shrink-0">
                <span className="text-[13px] font-extrabold tracking-tight">9:41</span>

                {/* Dynamic Island */}
                <div className="w-28 h-6 bg-black rounded-full flex items-center justify-between px-2.5 mx-auto shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-[#201c2b] ring-1 ring-zinc-800" />
                  {livenessFlowActive && (
                    <span className="w-2 h-2 rounded-full bg-[#2FBF8F] animate-pulse" />
                  )}
                  <div className="w-2.5 h-2.5 rounded-full bg-[#182030] ring-1 ring-zinc-800" />
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span>5G</span>
                  <div className="w-4 h-2.5 border border-[#231B33] rounded-[2px] p-[1px] flex items-center">
                    <div className="w-full h-full bg-[#231B33] rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* SCREEN CONTENT: EITHER DASHBOARD OR IN-PHONE LIVENESS FLOW */}
              {livenessFlowActive ? (
                /* =========================================================== */
                /* IN-PHONE LIVENESS FLOW VIEW                                 */
                /* =========================================================== */
                <div className="flex-1 flex flex-col justify-between p-5 bg-[#181226] text-white animate-in fade-in zoom-in-95 duration-200">
                  {/* Flow Header */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#5FD3B3]" />
                      <span className="text-xs font-bold tracking-tight text-slate-200">
                        3D Biometric Liveness
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        stopWebcam();
                        setLivenessFlowActive(false);
                      }}
                      className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Flow Viewfinder / States */}
                  {livenessStep === "instructions" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 px-2">
                      <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-dashed border-[#5FD3B3] flex items-center justify-center animate-pulse">
                        <ScanFace className="w-10 h-10 text-[#5FD3B3]" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-base font-extrabold text-white">
                          Unlock Your Payout (${currentRider.held_amount.toFixed(2)})
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed max-w-[280px]">
                          Please position your face in the camera circle. We verify passive 3D liveness to prevent unauthorized takeovers.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-left text-[11px] text-slate-300 space-y-1.5 w-full">
                        <div className="flex items-center gap-2 text-[#5FD3B3] font-bold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Ensure good lighting on your face</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#5FD3B3] font-bold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Remove heavy sunglasses or masks</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#5FD3B3] font-bold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Zero biometric data stored off-device</span>
                        </div>
                      </div>

                      <div className="w-full space-y-2 pt-2">
                        <button
                          onClick={() => {
                            startWebcam();
                            handleBeginScanning();
                          }}
                          className="w-full py-3 rounded-2xl bg-[#5FD3B3] text-[#181226] text-xs font-extrabold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#5FD3B3]/20"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Enable Camera &amp; Verify</span>
                        </button>

                        <button
                          onClick={handleBeginScanning}
                          className="w-full py-2.5 rounded-2xl bg-white/10 text-slate-300 text-xs font-bold hover:bg-white/20 transition-all"
                        >
                          Simulate Camera Scan
                        </button>
                      </div>
                    </div>
                  )}

                  {livenessStep === "scanning" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                      {/* Simulated or Live Oval Viewfinder */}
                      <div className="relative w-52 h-64 rounded-[999px] overflow-hidden border-4 border-[#5FD3B3] shadow-2xl shadow-[#5FD3B3]/30 bg-black flex items-center justify-center">
                        {useWebcam ? (
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover mirror"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col items-center justify-center text-slate-400 p-4">
                            <User className="w-24 h-24 text-slate-500 mb-2 opacity-60" />
                            <span className="text-[11px] text-slate-300 font-bold">
                              Scanning {currentRider.first_name}...
                            </span>
                          </div>
                        )}

                        {/* Scanner Laser Bar */}
                        <div
                          style={{ top: `${scanProgress}%` }}
                          className="absolute left-0 right-0 h-1 bg-[#5FD3B3] shadow-[0_0_12px_#5FD3B3] transition-all duration-300 pointer-events-none"
                        />

                        {/* Corner Reticles */}
                        <div className="absolute inset-3 border border-white/20 rounded-[900px] pointer-events-none" />
                      </div>

                      {/* Scanning Instructions Indicator */}
                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-[#5FD3B3] flex items-center justify-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            {scanProgress < 40
                              ? "Center your face in the oval..."
                              : scanProgress < 75
                              ? "Blink your eyes slowly..."
                              : "Analyzing micro-texture & depth..."}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Hold device still • InsightFace Pipeline v2.4
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${scanProgress}%` }}
                          className="h-full bg-[#5FD3B3] transition-all duration-300"
                        />
                      </div>
                    </div>
                  )}

                  {livenessStep === "success" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="w-20 h-20 rounded-full bg-[#2FBF8F]/20 border-2 border-[#2FBF8F] flex items-center justify-center shadow-lg shadow-[#2FBF8F]/30">
                        <CheckCircle2 className="w-10 h-10 text-[#2FBF8F]" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-lg font-extrabold text-white">
                          Identity Verified!
                        </h4>
                        <p className="text-xs text-[#2FBF8F] font-bold">
                          ${currentRider.held_amount > 0 ? currentRider.held_amount.toFixed(2) : "44.50"} Escrow Released Instantly
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-[240px] pt-1">
                          Funds dispatched to {currentRider.bank_account}. Trust score increased to {currentRider.trust_score}.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setLivenessFlowActive(false);
                          setLivenessStep("instructions");
                        }}
                        className="py-2.5 px-6 rounded-2xl bg-[#5FD3B3] text-[#181226] text-xs font-extrabold hover:brightness-110 active:scale-95 transition-all shadow-md"
                      >
                        Return to Dashboard
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* =========================================================== */
                /* MAIN PHONE DASHBOARD & TABS                                 */
                /* =========================================================== */
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  {/* Scrollable Viewport */}
                  <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3.5">
                    {/* Greeting & Shift Badge */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <h1 className="text-lg font-extrabold text-[#231B33]">
                          Good afternoon, {currentRider.first_name} 👋
                        </h1>
                        <p className="text-[11px] text-[#6B6480]">
                          Courier ID: {currentRider.courier_id} &bull; {currentRider.hub.split(" ")[0]} Hub
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                        {currentRider.avatar}
                      </div>
                    </div>

                    {/* Shift Active Pill */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
                      Shift Active &bull; Sensor Fusion Online
                    </div>

                    {/* Trust-Score Ring Card */}
                    <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#4A2C6D]" />
                          <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wide">
                            Behavioral Trust
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-[#231B33]">
                          {currentRider.tier}
                        </div>
                        <div className="text-[10px] text-[#6B6480]">
                          {currentRider.payout_status === "HELD" ? (
                            <span className="text-[#F5A524] font-bold">
                              ⚠️ Verification check required
                            </span>
                          ) : (
                            <span className="text-[#2FBF8F] font-bold">
                              ✓ Verified &bull; Instant ACH active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* SVG Ring */}
                      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                        <svg className="w-20 h-20 transform -rotate-90">
                          {/* Background Track */}
                          <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            stroke="#F0EAFB"
                            strokeWidth="6"
                            fill="transparent"
                          />
                          {/* Animated Value Arc */}
                          <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            stroke={getScoreColor(currentRider.trust_score)}
                            strokeWidth="6"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                            className="transition-all duration-700 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-base font-extrabold font-mono text-[#231B33]">
                            {currentRider.trust_score}
                          </span>
                          <span className="text-[8px] font-bold text-[#6B6480] uppercase">
                            / 100
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Today's Earnings Card */}
                    <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-[#6B6480]">
                        <span>TODAY'S EARNINGS</span>
                        <span className="text-[10px] font-mono font-bold text-[#4A2C6D] bg-[#F0EAFB] px-2 py-0.5 rounded-full">
                          {currentRider.trips_today_count} Trips
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-extrabold font-mono text-[#231B33]">
                          ${currentRider.earnings_today.toFixed(2)}
                        </div>
                        <div className="text-[11px] font-bold text-[#2FBF8F]">
                          +${(currentRider.earnings_today * 0.18).toFixed(2)} Tips
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#6B6480] pt-1 border-t border-[#4A2C6D]/10">
                        <span>Online: {currentRider.hours_online} hours</span>
                        <span>Avg: ${(currentRider.earnings_today / currentRider.trips_today_count).toFixed(2)}/trip</span>
                      </div>
                    </div>

                    {/* Payout Status Card (Released OR Held with "Verify now" button) */}
                    {currentRider.payout_status === "HELD" ? (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-[#F5A524]/40 shadow-soft space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#F5A524]">
                            <Lock className="w-4 h-4 shrink-0 text-[#F5A524]" />
                            <span>Payout Status: HELD</span>
                          </div>
                          <span className="text-xs font-mono font-extrabold text-[#F5A524] bg-amber-500/10 px-2 py-0.5 rounded">
                            ${currentRider.held_amount.toFixed(2)} Locked
                          </span>
                        </div>

                        <p className="text-[11px] text-[#6B6480] leading-snug">
                          A quick biometric liveness check is required to confirm it's you and release your instant payout.
                        </p>

                        <button
                          onClick={handleStartLivenessFlow}
                          className="w-full py-2.5 rounded-xl bg-[#F5A524] text-white text-xs font-extrabold hover:bg-amber-600 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Verify now (${currentRider.held_amount.toFixed(2)})</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-4 border border-[#2FBF8F]/40 shadow-soft space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#2FBF8F]">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2FBF8F]" />
                            <span>Payout Status: Released</span>
                          </div>
                          <span className="text-xs font-mono font-extrabold text-[#2FBF8F]">
                            ${currentRider.released_amount.toFixed(2)}
                          </span>
                        </div>

                        <p className="text-[11px] text-[#6B6480] leading-snug">
                          All earnings cleared. Automated instant ACH direct deposit ready for {currentRider.bank_account}.
                        </p>
                      </div>
                    )}

                    {/* Recent Trips Section */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[#231B33]">
                        <span>Recent Deliveries</span>
                        <span className="text-[10px] text-[#4A2C6D] font-bold">View all</span>
                      </div>

                      <div className="space-y-1.5">
                        {currentRider.recent_trips.map((trip) => (
                          <div
                            key={trip.id}
                            className="bg-white rounded-xl p-2.5 border border-[#4A2C6D]/10 flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-[#231B33]">{trip.merchant}</div>
                              <div className="text-[10px] text-[#6B6480] flex items-center gap-2">
                                <span>{trip.time}</span>
                                <span>&bull;</span>
                                <span>{trip.distance_km} km</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-extrabold font-mono text-[#231B33]">
                                +${trip.earned.toFixed(2)}
                              </div>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                  trip.status === "Verified"
                                    ? "bg-[#2FBF8F]/15 text-[#2FBF8F]"
                                    : "bg-[#F5A524]/15 text-[#F5A524]"
                                }`}
                              >
                                {trip.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM TAB BAR */}
                  <div className="border-t border-[#4A2C6D]/10 bg-white/90 backdrop-blur-md px-6 py-2 shrink-0">
                    <div className="flex items-center justify-between text-[#6B6480]">
                      <button
                        onClick={() => setActivePhoneTab("home")}
                        className={`flex flex-col items-center gap-0.5 ${
                          activePhoneTab === "home" ? "text-[#4A2C6D] font-bold" : "hover:text-[#231B33]"
                        }`}
                      >
                        <Home className="w-4 h-4" />
                        <span className="text-[10px]">Home</span>
                      </button>

                      <button
                        onClick={() => setActivePhoneTab("trips")}
                        className={`flex flex-col items-center gap-0.5 ${
                          activePhoneTab === "trips" ? "text-[#4A2C6D] font-bold" : "hover:text-[#231B33]"
                        }`}
                      >
                        <Navigation className="w-4 h-4" />
                        <span className="text-[10px]">Trips</span>
                      </button>

                      <button
                        onClick={() => setActivePhoneTab("wallet")}
                        className={`flex flex-col items-center gap-0.5 ${
                          activePhoneTab === "wallet" ? "text-[#4A2C6D] font-bold" : "hover:text-[#231B33]"
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        <span className="text-[10px]">Wallet</span>
                      </button>

                      <button
                        onClick={() => setActivePhoneTab("profile")}
                        className={`flex flex-col items-center gap-0.5 ${
                          activePhoneTab === "profile" ? "text-[#4A2C6D] font-bold" : "hover:text-[#231B33]"
                        }`}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-[10px]">Profile</span>
                      </button>
                    </div>

                    {/* Bottom Home Indicator Bar */}
                    <div className="w-32 h-1 bg-black/30 rounded-full mx-auto mt-2" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reusable Facial Liveness Modal */}
      <FacialLivenessModal
        isOpen={isFacialModalOpen}
        onClose={() => setIsFacialModalOpen(false)}
        riderId={currentRider.id}
        payoutAmount={currentRider.held_amount}
        title="Biometric Facial Liveness Verification"
        subtitle={`Release $${currentRider.held_amount.toFixed(2)} USD held escrow for courier ${currentRider.name}`}
        onSuccess={() => {
          handleFinishVerification();
        }}
      />
    </div>
  );
}
