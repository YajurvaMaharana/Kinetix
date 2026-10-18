import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import FacialLivenessModal from "@/components/FacialLivenessModal";
import { FacialLivenessVerificationResponse } from "@/api/endpoints";
import {
  Camera,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Sparkles,
  Smartphone,
  Info,
  TestTube,
} from "lucide-react";

export default function RiderVerifyPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [lastVerified, setLastVerified] = useState("Shift Start (8:00 AM Today)");
  const [verifiedCount, setVerifiedCount] = useState(14);
  const [testResult, setTestResult] = useState<FacialLivenessVerificationResponse | null>(null);

  const handleVerified = (res: FacialLivenessVerificationResponse) => {
    setShowModal(false);
    setLastVerified("Just now");
    setVerifiedCount((prev) => prev + 1);
    setTestResult(res);

    showToast({
      type: "success",
      title: "Biometric Liveness & Match Verified",
      message: `Median Euclidean distance evaluated. Decision: ${res.status}`,
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
              Verify your physical presence against your 5-pose registered face template (SSD MobileNet v1)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Match Test Button */}
            <button
              onClick={() => setShowModal(true)}
              className="py-3 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              title="Runs 5-frame verification match test without triggering escrow releases"
            >
              <TestTube className="w-4 h-4" />
              <span>Match Test</span>
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="py-3 px-5 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Start 3D Face Scan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Test Result Display if match test was executed */}
      {testResult && (
        <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 border border-slate-700 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400">Match Test Verification Results</span>
            <span className="text-[10px] text-slate-400">{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1 border-t border-slate-800">
            <div>
              <span className="text-slate-400 block text-[10px]">Decision:</span>
              <strong className={testResult.status === "VERIFIED" || testResult.status === "MATCHED" ? "text-emerald-400" : "text-rose-400"}>
                {testResult.status}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Median Distance:</span>
              <strong className="text-amber-300">{testResult.similarity !== undefined ? testResult.similarity : "N/A"}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Policy Threshold:</span>
              <strong className="text-slate-200">0.55</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">User ID:</span>
              <strong className="text-slate-200">{user?.id || "usr_rider_01"}</strong>
            </div>
          </div>
        </div>
      )}

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
            5-Pose templateVersion: 2 active in IndexedDB
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#4A2C6D]/15 shadow-soft">
          <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
            Last Verified
          </span>
          <div className="text-xl font-black text-[#231B33] mt-1">{lastVerified}</div>
          <p className="text-[11px] text-[#6B6480] mt-2">
            Verification tokens valid for active shift
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
            <strong className="text-[#2FBF8F] block">SSD MobileNet v1 Neural Pipeline</strong>
            <span>
              Matches 5 live un-mirrored frames against your registered 5-pose template using median Euclidean distance (<span className="font-mono">threshold 0.55</span>).
            </span>
          </div>
        </div>
      </div>

      {/* Facial Liveness Modal */}
      <FacialLivenessModal
        isOpen={showModal}
        challengeId="VERIFY-CENTER-MANUAL"
        riderId={user?.id || "usr_rider_01"}
        onClose={() => setShowModal(false)}
        onSuccess={handleVerified}
        onResult={setTestResult}
      />
    </div>
  );
}
