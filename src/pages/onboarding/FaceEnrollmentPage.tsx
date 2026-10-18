import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Logo from "@/components/Logo";
import {
  saveEnrolledTemplate,
  getFaceDescriptor,
  validateFrameQuality,
  getTfBackend,
  loadFaceApiModels,
} from "@/utils/faceMatching";
import {
  ShieldCheck,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Sun,
  Lock,
  Check,
  Info,
} from "lucide-react";

type EnrollmentStep = "consent" | "capture" | "enrolled" | "error";

const POSE_SEQUENCE: { key: "front_1" | "front_2" | "front_3" | "left" | "right"; label: string; instruction: string }[] = [
  { key: "front_1", label: "Front View (1/3)", instruction: "Look directly at the camera" },
  { key: "front_2", label: "Front View (2/3)", instruction: "Blink or adjust posture slightly" },
  { key: "front_3", label: "Front View (3/3)", instruction: "Hold a neutral expression" },
  { key: "left", label: "Slightly Left", instruction: "Turn head 15° to the left" },
  { key: "right", label: "Slightly Right", instruction: "Turn head 15° to the right" },
];

export default function FaceEnrollmentPage() {
  const { user, updateOnboardingStatus } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const currentUserId = user?.id || "usr_rider_01";

  const [step, setStep] = useState<EnrollmentStep>("consent");
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | null>(null);

  // Camera & Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live quality status
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [qualityReasons, setQualityReasons] = useState<string[]>([]);
  const [isFrameValid, setIsFrameValid] = useState(false);

  // 5 Descriptors Capture
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedDescriptors, setCapturedDescriptors] = useState<number[][]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  // Error & Debug State
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    loadFaceApiModels().catch((err) => console.warn("Models load error:", err));
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsVideoReady(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(err.message || "Could not open camera device. Please grant permission.");
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Frame Quality Monitoring Loop
  useEffect(() => {
    if (step !== "capture" || !isVideoReady) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      // Draw RAW un-mirrored frame onto canvas at 640x480
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // DO NOT flip canvas! Draw raw video feed directly
      ctx.drawImage(video, 0, 0, 640, 480);

      // Evaluate face descriptor & quality on raw canvas
      const { detection } = await getFaceDescriptor(canvas);
      const quality = validateFrameQuality(canvas, detection, 640, 480);

      setIsFrameValid(quality.ok);
      setQualityReasons(quality.reasons);

      // Update Debug Info
      const dbg = `${currentUserId} | templateVersion: 2 | enrolled: ${capturedDescriptors.length}/5 | currentPose: ${POSE_SEQUENCE[currentPoseIndex]?.key} | score: ${(quality.score * 100).toFixed(0)}% | size: ${(quality.boxWidthRatio * 100).toFixed(0)}% | brightness: ${quality.brightness.toFixed(0)} | sharpness: ${quality.blurScore.toFixed(0)} | detector: SSD MobileNet v1 | backend: ${getTfBackend()}`;
      setDebugInfo(dbg);
    }, 200);

    return () => clearInterval(interval);
  }, [step, isVideoReady, currentPoseIndex, capturedDescriptors, currentUserId]);

  const handleAgreeConsent = () => {
    setConsentAgreed(true);
    setConsentTimestamp(new Date().toISOString());
    setStep("capture");
    startCamera();
  };

  const handleCaptureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsCapturing(true);

    try {
      // Capture RAW un-mirrored frame to canvas
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, 640, 480);
      }

      // Compute descriptor using SSD MobileNet v1 on un-mirrored canvas
      const { descriptor, detection } = await getFaceDescriptor(canvas);
      const quality = validateFrameQuality(canvas, detection, 640, 480);

      if (!quality.ok || !descriptor || descriptor.length !== 128) {
        const msg = quality.reasons.join("; ") || "Quality check failed. Please reposition your face.";
        showToast({ type: "warning", title: "Frame Rejected", message: msg });
        setIsCapturing(false);
        return;
      }

      const newDescriptors = [...capturedDescriptors, descriptor];
      setCapturedDescriptors(newDescriptors);

      if (currentPoseIndex + 1 < POSE_SEQUENCE.length) {
        setCurrentPoseIndex((prev) => prev + 1);
        showToast({
          type: "success",
          title: `Frame ${newDescriptors.length} Captured!`,
          message: `Next: ${POSE_SEQUENCE[currentPoseIndex + 1].instruction}`,
        });
      } else {
        // All 5 frames captured! Finalize enrollment
        await finalizeEnrollment(newDescriptors);
      }
    } catch (err: any) {
      showToast({ type: "error", title: "Capture Error", message: err.message || "Failed to capture frame." });
    } finally {
      setIsCapturing(false);
    }
  };

  const finalizeEnrollment = async (descriptors: number[][]) => {
    try {
      stopCamera();

      // Store ALL 5 descriptors as templateVersion: 2 in IndexedDB (NO averaging)
      await saveEnrolledTemplate(currentUserId, descriptors);

      // Mark onboarding
      updateOnboardingStatus({ faceEnrolled: true });

      setStep("enrolled");
      showToast({
        type: "success",
        title: "Face Enrolled Successfully!",
        message: "5 multi-pose 128-number vector descriptors registered to device vault.",
      });
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setStep("error");
    }
  };

  const handleResetEnrollment = () => {
    setCapturedDescriptors([]);
    setCurrentPoseIndex(0);
    setStep("capture");
    startCamera();
  };

  return (
    <div className="min-h-screen bg-[var(--surface-cream)] text-[var(--ink)] flex flex-col items-center justify-between p-4 sm:p-8">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Header */}
      <header className="w-full max-w-xl flex items-center justify-between py-4">
        <Logo />
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--lavender)] text-[var(--primary)] text-xs font-bold border border-[var(--primary)]/20">
          <span>Step 2 of 3 &bull; Face Enrollment</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-xl my-auto space-y-6">
        {/* STEP 1: CONSENT */}
        {step === "consent" && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-dropdown border border-[var(--border)] space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-[var(--ink)]">Biometric Facial Enrollment</h1>
                <p className="text-xs text-[var(--muted)]">5-Pose SSD MobileNet v1 Neural Pipeline</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-3 text-xs leading-relaxed text-[var(--ink)]">
              <h3 className="font-bold text-[var(--primary)] text-sm flex items-center gap-1.5">
                <Lock className="w-4 h-4" /> Transparent Biometric Privacy Agreement
              </h3>
              <p>
                <strong>What we collect:</strong> Five 128-number neural descriptor vectors extracted from 5 un-mirrored pose frames (3 front, 1 left, 1 right).
                <span className="text-[var(--primary)] font-semibold"> We NEVER store raw video or original photographs.</span>
              </p>
              <p>
                <strong>Why we collect it:</strong> To verify your physical identity during instant escrow releases and account updates.
              </p>
              <p>
                <strong>Storage:</strong> Descriptors are stored as plain numerical vectors in IndexedDB keyed strictly by your user ID ({currentUserId}).
              </p>
            </div>

            <label className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--lavender)]/50 border border-[var(--primary)]/30 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded text-[var(--primary)] accent-[var(--primary)] cursor-pointer shrink-0"
              />
              <span className="text-xs font-bold text-[var(--ink)] leading-snug">
                I give statutory consent to extract 5 un-mirrored facial pose vectors and store them locally for identity verification.
              </span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => navigate("/choose-role")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!consentAgreed}
                onClick={handleAgreeConsent}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all shadow-plum disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>I Agree, Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CAPTURE 5 FRAMES */}
        {step === "capture" && (
          <div className="bg-white rounded-3xl p-6 shadow-dropdown border border-[var(--border)] space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-[var(--ink)]">
                  Pose {capturedDescriptors.length + 1} of 5: {POSE_SEQUENCE[currentPoseIndex]?.label}
                </h2>
                <p className="text-xs text-[var(--primary)] font-bold">
                  {POSE_SEQUENCE[currentPoseIndex]?.instruction}
                </p>
              </div>
              <div className="text-xs font-extrabold px-3 py-1 rounded-full bg-[var(--lavender)] text-[var(--primary)]">
                {capturedDescriptors.length} / 5 Enrolled
              </div>
            </div>

            {/* Viewfinder: CSS scaleX(-1) for user comfort, but canvas captures RAW frame */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-[var(--border)] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
              />

              {/* Oval Guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`w-48 sm:w-56 h-64 sm:h-72 rounded-[999px] border-4 transition-colors duration-300 ${
                    isFrameValid
                      ? "border-[#2FBF8F] shadow-[0_0_24px_rgba(47,191,143,0.5)]"
                      : "border-[var(--primary)] shadow-[0_0_15px_rgba(74,44,109,0.3)]"
                  }`}
                />
              </div>

              {/* Status Badge */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isFrameValid ? "bg-[#2FBF8F]" : "bg-amber-400"}`} />
                  <span>{isFrameValid ? "Frame Quality Good" : "Position Face..."}</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold">
                  <span>RAW Un-mirrored Capture</span>
                </div>
              </div>
            </div>

            {/* Quality feedback banner */}
            <div
              className={`p-3 rounded-xl border text-center text-xs font-bold ${
                isFrameValid
                  ? "bg-[#2FBF8F]/10 border-[#2FBF8F]/30 text-[#15803d]"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-900"
              }`}
            >
              {isFrameValid
                ? `Ready to capture: ${POSE_SEQUENCE[currentPoseIndex]?.instruction}`
                : qualityReasons.join(" • ") || "Center your face in good lighting"}
            </div>

            {/* TEMPORARY DEBUG PANEL (mock mode only) */}
            <div className="p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] leading-relaxed border border-slate-700 select-all overflow-x-auto">
              {debugInfo || "Initializing SSD MobileNet v1 detector debug..."}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResetEnrollment}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] bg-[var(--surface-alt)] border border-[var(--border)] cursor-pointer"
              >
                Reset Poses
              </button>

              <button
                type="button"
                disabled={!isFrameValid || isCapturing}
                onClick={handleCaptureFrame}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold bg-[#2FBF8F] text-white hover:brightness-110 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isCapturing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span>Capture Pose ({capturedDescriptors.length + 1} of 5)</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ENROLLED SUCCESS */}
        {step === "enrolled" && (
          <div className="bg-white rounded-3xl p-8 shadow-dropdown border border-[var(--border)] text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-[#2FBF8F]/10 text-[#2FBF8F] border border-[#2FBF8F]/30 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Face Enrolled Successfully!</h2>
              <p className="text-xs text-[var(--muted)] mt-1 max-w-sm mx-auto">
                5 un-mirrored pose descriptors (templateVersion: 2) registered to IndexedDB for {currentUserId}.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)] text-left text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-[var(--ink)]">
                <span>User ID:</span>
                <span className="font-mono text-[var(--primary)]">{currentUserId}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-[var(--ink)]">
                <span>Template Version:</span>
                <span className="font-mono text-[var(--primary)]">2 (5 Descriptors)</span>
              </div>
              <div className="flex items-center justify-between font-bold text-[var(--ink)]">
                <span>Detector:</span>
                <span className="font-semibold text-[var(--ink)]">SSD MobileNet v1 (0.6 minConfidence)</span>
              </div>
              <div className="flex items-center justify-between font-bold text-[var(--ink)]">
                <span>RAW Frame Capture:</span>
                <span className="font-bold text-[#2FBF8F] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Un-mirrored 640x480
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/onboarding/profile")}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all shadow-plum cursor-pointer text-sm"
            >
              <span>Continue to Profile Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 4: ERROR */}
        {step === "error" && (
          <div className="bg-white rounded-3xl p-8 shadow-dropdown border border-[var(--border)] text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--ink)]">Enrollment Failed</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Could not store neural face template. Please try again.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetEnrollment}
              className="px-6 py-3 rounded-xl text-xs font-extrabold bg-[var(--primary)] text-white cursor-pointer"
            >
              Retry Enrollment
            </button>
          </div>
        )}
      </main>

      <footer className="w-full max-w-xl text-center text-[11px] text-[var(--muted)] py-2">
        Kinetix Biometric Vault &bull; 5-Pose SSD MobileNet Pipeline
      </footer>
    </div>
  );
}
