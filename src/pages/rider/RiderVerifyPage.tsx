import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import FaceLivenessModal from "@/components/FaceLivenessModal";
import {
  ScanFace,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Sparkles,
  Smartphone,
  Info,
} from "lucide-react";

export default function RiderVerifyPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [lastVerified, setLastVerified] = useState("Shift Start (8:00 AM Today)");
  const [verifiedCount, setVerifiedCount] = useState(14);

  const handleVerified = () => {
    setShowModal(false);
    setLastVerified("Just now");
    setVerifiedCount((prev) => prev + 1);
    showToast({
      type: "success",
      title: "Biometric Liveness Confirmed",
      message: "3D cryptographic face vector verified. Zero telemetry penalties active.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#2FBF8F]/25">
              <span>BIOMETRIC IDENTITY VAULT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231B33]">
              Facial Liveness Verification
            </h1>
            <p className="text-xs text-[#6B6480] mt-1">
              Verify your physical presence to clear payout holds, reset risk thresholds, and confirm shift custody
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="py-3.5 px-6 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Camera className="w-4 h-4" />
            <span>Start 3D Face Scan</span>
          </button>
        </div>
      </div>

      {/* Verification Status Overview */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-[#4A2C6D]/15 shadow-soft">
          <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
            Biometric Status
          </span>
          <div className="text-2xl font-black text-[#2FBF8F] mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            <span>Active &amp; Verified</span>
          </div>
          <p className="text-[11px] text-[#6B6480] mt-2">
            Zero fraud flags on device biometric token
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#4A2C6D]/15 shadow-soft">
          <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
            Last Verified
          </span>
          <div className="text-xl font-black text-[#231B33] mt-1">{lastVerified}</div>
          <p className="text-[11px] text-[#6B6480] mt-2">
            Biometric tokens remain valid for 24 hours
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#4A2C6D]/15 shadow-soft">
          <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
            Lifetime Passes
          </span>
          <div className="text-2xl font-black text-[#4A2C6D] mt-1">
            {verifiedCount} Checks
          </div>
          <p className="text-[11px] text-[#2FBF8F] font-bold mt-2">
            100% genuine pass rate
          </p>
        </div>
      </div>

      {/* Security & Privacy Commitment */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft space-y-4">
        <h2 className="text-base font-extrabold text-[#231B33]">Privacy &amp; Biometric Protection</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-xs text-[#6B6480] leading-relaxed">
          <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-1">
            <strong className="text-[#4A2C6D] block">Zero Raw Image Storage</strong>
            <span>
              Your camera feed is evaluated in real-time memory. Photos are never stored on platform servers or shared with merchants.
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-1">
            <strong className="text-[#2FBF8F] block">Sub-Second Processing</strong>
            <span>
              Liveness tests check optical micro-movements to ensure no static printed photos or video replays can spoof your account.
            </span>
          </div>
        </div>
      </div>

      {/* Liveness Modal */}
      <FaceLivenessModal
        isOpen={showModal}
        challengeId="VERIFY-CENTER-MANUAL"
        riderId={user?.email || "marcus.chen@example.com"}
        onClose={() => setShowModal(false)}
        onVerified={handleVerified}
      />
    </div>
  );
}
