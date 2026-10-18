import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserCheck,
  UserX,
  ScanFace,
  Lock,
  KeyRound,
  X,
  FileCheck2,
  UserCog,
  Eye,
} from "lucide-react";
import { getLivenessPrompt, verifyFace, fallbackChallenge } from "@/lib/api";
import {
  FaceVerifyResponse,
  LivenessPrompt,
  ChallengeFallbackResponse,
} from "@/lib/types";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export interface FaceLivenessModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeId: string;
  riderId?: string;
  onVerified?: (res: FaceVerifyResponse) => void;
  onFallback?: (res: ChallengeFallbackResponse) => void;
}

export default function FaceLivenessModal({
  isOpen,
  onClose,
  challengeId,
  riderId,
  onVerified,
  onFallback,
}: FaceLivenessModalProps) {
  const [prompt, setPrompt] = useState<LivenessPrompt | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceVerifyResponse | null>(null);
  const [fallbackResult, setFallbackResult] = useState<ChallengeFallbackResponse | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API (getUserMedia) not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err: unknown) {
      setCameraError(getErrorMessage(err) || "Failed to access webcam. Simulator mode active.");
      setCameraActive(false);
    }
  }, []);

  const fetchPrompt = useCallback(async () => {
    if (!challengeId) return;
    setLoadingPrompt(true);
    setGeneralError(null);
    try {
      const p = await getLivenessPrompt(challengeId);
      setPrompt(p);
    } catch {
      setPrompt({
        challenge_id: challengeId,
        prompt: "Blink slowly and turn head slightly to the right",
        nonce: Math.random().toString(36).substring(2, 10),
        expires_at: new Date(Date.now() + 180000).toISOString(),
      });
    } finally {
      setLoadingPrompt(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setFallbackResult(null);
      setActiveScenario(null);
      setGeneralError(null);
      fetchPrompt();
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, fetchPrompt, startCamera, stopCamera]);

  if (!isOpen) return null;

  const handleSimulateScenario = async (
    scenario: "genuine_face" | "different_person" | "static_photo" | "replay"
  ) => {
    setActiveScenario(scenario);
    setVerifying(true);
    setGeneralError(null);
    setFallbackResult(null);

    try {
      const response = await verifyFace(challengeId, {
        scenario_flag: scenario,
        prompt_nonce: prompt?.nonce,
      });
      setResult(response);
      if (onVerified) {
        onVerified(response);
      }
    } catch (err: unknown) {
      setGeneralError(getErrorMessage(err) || "Biometric verification request failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleFallback = async (type: "otp" | "document_check" | "manual_review") => {
    setVerifying(true);
    setGeneralError(null);
    try {
      const response = await fallbackChallenge(challengeId, {
        fallback_type: type,
        reason: `Rider requested alternate verification: ${type}`,
      });
      setFallbackResult(response);
      if (onFallback) {
        onFallback(response);
      }
    } catch (err: unknown) {
      setGeneralError(getErrorMessage(err) || "Fallback request failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-950/40 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <ScanFace className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Biometric Face Re-Verification
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
                  Level 2 Step-Up
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                1:1 Template Match &amp; Passive Anti-Spoof Liveness
                {riderId ? ` • Rider: ${riderId}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Close Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ephemeral Liveness Instruction Card */}
        <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
              <Eye className="h-4 w-4 animate-pulse text-indigo-400" />
              <span>Active Challenge Prompt</span>
            </div>
            {prompt && (
              <span className="font-mono text-[10px] text-indigo-300/80 bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-700/50">
                Nonce: {prompt.nonce}
              </span>
            )}
          </div>
          <div className="mt-2 text-sm font-medium text-white">
            {loadingPrompt ? (
              <span className="text-slate-400 italic">Generating cryptographic prompt...</span>
            ) : prompt ? (
              <span className="text-amber-200 font-medium">👉 &quot;{prompt.prompt}&quot;</span>
            ) : (
              <span className="text-slate-400">No active prompt loaded.</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Perform the dynamic micro-motion within the reticle to prove physical presence.
          </p>
        </div>

        {/* Video Preview and Camera Viewport */}
        <div className="mt-4 relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
          {cameraActive ? (
            <div className="relative w-full h-[240px] flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100 opacity-90"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-52 rounded-[50%] border-2 border-dashed border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center justify-center">
                  <div className="text-[10px] font-mono text-cyan-300/80 bg-slate-900/80 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    Align Face
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-slate-500">
                <CameraOff className="h-6 w-6" />
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                {cameraError || "Camera preview is inactive. Use simulation buttons below to test biometric verification scenarios."}
              </p>
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors border border-slate-700"
              >
                <Camera className="h-3.5 w-3.5 text-cyan-400" />
                Enable Camera Preview
              </button>
            </div>
          )}

          <div className="w-full bg-slate-900/90 border-t border-slate-800/80 px-3 py-2 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Lock className="h-3.5 w-3.5" />
              Zero-Image Storage Policy
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              raw_image_stored: false • Fernet 128D
            </span>
          </div>
        </div>

        {/* Simulation Buttons */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Biometric Simulation Scenarios:</span>
            <span className="text-[11px] font-normal text-slate-400">
              Swappable backend: <code className="text-cyan-400">FACE_BACKEND=simulated</code>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <button
              onClick={() => handleSimulateScenario("genuine_face")}
              disabled={verifying}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                activeScenario === "genuine_face"
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500"
                  : "border-emerald-500/30 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40"
              } disabled:opacity-50`}
            >
              <UserCheck className="h-5 w-5 text-emerald-400" />
              <span className="text-xs font-bold">Genuine Face</span>
              <span className="text-[10px] opacity-80">Match ~0.88 (PASS)</span>
            </button>

            <button
              onClick={() => handleSimulateScenario("different_person")}
              disabled={verifying}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                activeScenario === "different_person"
                  ? "border-rose-500 bg-rose-500/20 text-rose-200 ring-1 ring-rose-500"
                  : "border-rose-500/30 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40"
              } disabled:opacity-50`}
            >
              <UserX className="h-5 w-5 text-rose-400" />
              <span className="text-xs font-bold">Different Person</span>
              <span className="text-[10px] opacity-80">Match ~0.25 (FAIL)</span>
            </button>

            <button
              onClick={() => handleSimulateScenario("static_photo")}
              disabled={verifying}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                activeScenario === "static_photo"
                  ? "border-amber-500 bg-amber-500/20 text-amber-200 ring-1 ring-amber-500"
                  : "border-amber-500/30 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40"
              } disabled:opacity-50`}
            >
              <ScanFace className="h-5 w-5 text-amber-400" />
              <span className="text-xs font-bold">Static Photo</span>
              <span className="text-[10px] opacity-80">Spoof (Liveness FAIL)</span>
            </button>

            <button
              onClick={() => handleSimulateScenario("replay")}
              disabled={verifying}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                activeScenario === "replay"
                  ? "border-purple-500 bg-purple-500/20 text-purple-200 ring-1 ring-purple-500"
                  : "border-purple-500/30 bg-purple-950/20 text-purple-300 hover:bg-purple-950/40"
              } disabled:opacity-50`}
            >
              <RefreshCw className="h-5 w-5 text-purple-400" />
              <span className="text-xs font-bold">Replay Attack</span>
              <span className="text-[10px] opacity-80">Video Spoof (FAIL)</span>
            </button>
          </div>
        </div>

        {/* Verification Result Display */}
        {result && (
          <div
            className={`mt-4 rounded-xl border p-4 space-y-3 ${
              result.passed
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                : "border-rose-500/40 bg-rose-950/30 text-rose-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-400" />
                )}
                <span className="font-bold text-sm">
                  {result.passed ? "Biometric Verification PASSED" : "Verification REJECTED"}
                </span>
              </div>
              <span
                className={`rounded-md px-2.5 py-0.5 text-xs font-extrabold font-mono border ${
                  result.new_verdict === "ALLOW"
                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                    : "border-rose-500/50 bg-rose-500/20 text-rose-300"
                }`}
              >
                Verdict: {result.new_verdict}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded bg-black/40 p-2.5 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">1:1 Face Similarity</span>
                <span className="text-base font-bold text-white">
                  {(result.similarity * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Threshold: {(result.threshold * 100).toFixed(0)}%
                </span>
              </div>

              <div className="rounded bg-black/40 p-2.5 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Liveness Confidence</span>
                <span className="text-base font-bold text-white">
                  {(result.liveness_score * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {result.spoof_type ? `Spoof: ${result.spoof_type}` : "Liveness Confirmed"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
              <span className="text-slate-300">{result.message}</span>
              {result.device_trusted && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Device Trusted (via selfie)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fallback Result Display */}
        {fallbackResult && (
          <div className="mt-4 rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-3.5 text-xs text-indigo-200 flex items-center justify-between">
            <div>
              <span className="font-bold block text-white">
                Alternate Step-Up Activated: {fallbackResult.fallback_type.toUpperCase()}
              </span>
              <span className="text-slate-400">{fallbackResult.message}</span>
            </div>
            {fallbackResult.case_id && (
              <span className="font-mono text-[10px] bg-indigo-900/50 px-2 py-1 rounded border border-indigo-700">
                Case: {fallbackResult.case_id}
              </span>
            )}
          </div>
        )}

        {generalError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{generalError}</span>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Cannot complete biometric verification?
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFallback("otp")}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              Use OTP Instead
            </button>

            <button
              onClick={() => handleFallback("document_check")}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              ID Check
            </button>

            <button
              onClick={() => handleFallback("manual_review")}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              <UserCog className="h-3.5 w-3.5" />
              Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
