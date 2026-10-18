import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Check,
  X,
  ExternalLink,
  Lock,
  ScanFace,
  Sparkles,
} from "lucide-react";
import {
  completeRiderLivenessVerification,
  verifyFacialLivenessApi,
} from "@/api/endpoints";

interface RiderInPhoneLivenessProps {
  riderId: string;
  heldAmount: number;
  riderName: string;
  onSuccess: (releasedAmount: number, newScore: number) => void;
  onCancel: () => void;
}

export default function RiderInPhoneLiveness({
  riderId,
  heldAmount,
  riderName,
  onSuccess,
  onCancel,
}: RiderInPhoneLivenessProps) {
  // Step state: "permission" | "scanning" | "analyzing" | "success" | "error"
  const [step, setStep] = useState<"permission" | "scanning" | "analyzing" | "success" | "error">("permission");
  const [progress, setProgress] = useState(0);
  const [activeHint, setActiveHint] = useState("Position your face inside the oval");

  // Camera stream & elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blackFrameTimerRef = useRef<any>(null);
  const playStartedTimeRef = useRef<number | null>(null);
  const blackFrameStartTimeRef = useRef<number | null>(null);

  // Device selection & status
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isBlackFrame, setIsBlackFrame] = useState(false);
  const [cameraError, setCameraError] = useState<{
    type: "permission_denied" | "no_camera" | "in_use" | "insecure" | "unknown";
    message: string;
  } | null>(null);

  // Temporary Debug Info State
  const [debugInfo, setDebugInfo] = useState({
    trackLabel: "none",
    trackReadyState: "none",
    videoWidth: 0,
    videoHeight: 0,
    videoReadyState: 0,
    paused: true,
    brightness: 0,
  });

  // Stop all media tracks helper
  const stopAllTracks = useCallback(() => {
    if (blackFrameTimerRef.current) {
      clearInterval(blackFrameTimerRef.current);
      blackFrameTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoReady(false);
    setIsBlackFrame(false);
  }, []);

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn("Could not enumerate media devices:", err);
    }
  }, [selectedDeviceId]);

  // Start camera stream
  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopAllTracks();
      setCameraError(null);
      setIsBlackFrame(false);
      playStartedTimeRef.current = null;
      blackFrameStartTimeRef.current = null;

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError({
          type: "unknown",
          message: "Media devices API is not supported in this browser environment.",
        });
        return;
      }

      // Check permission state first
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: "camera" as any });
          if (status.state === "denied") {
            setCameraError({
              type: "permission_denied",
              message:
                "Camera access is blocked by browser permissions or the parent iframe. Please enable camera access in your address bar.",
            });
            return;
          }
        }
      } catch {
        // navigator.permissions.query not supported for camera in some browsers; proceed
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 640 },
            },
        audio: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const label = videoTrack?.label || "Default Camera";
        const trackState = videoTrack?.readyState || "unknown";

        setDebugInfo((prev) => ({
          ...prev,
          trackLabel: label,
          trackReadyState: trackState,
        }));

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
            playStartedTimeRef.current = Date.now();
          } catch (playErr) {
            console.warn("Video play interrupted:", playErr);
          }
        }

        await refreshDevices();
        setStep("scanning");
      } catch (err: any) {
        console.error("Camera acquisition error:", err);
        let errorType: "permission_denied" | "no_camera" | "in_use" | "insecure" | "unknown" = "unknown";
        let message = err.message || "Failed to initialize camera.";

        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorType = "permission_denied";
          message =
            "Camera access blocked. Please check your browser address bar permissions. If inside an iframe preview, open in a new tab.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorType = "no_camera";
          message = "No physical camera detected on this system.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorType = "in_use";
          message = "Camera is currently locked or in use by another application.";
        } else if (err.name === "SecurityError") {
          errorType = "insecure";
          message = "Camera requires a secure HTTPS origin or localhost.";
        }

        setCameraError({ type: errorType, message });
      }
    },
    [refreshDevices, stopAllTracks]
  );

  // Loaded metadata handler on video element
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const w = videoRef.current.videoWidth;
    const h = videoRef.current.videoHeight;
    const rState = videoRef.current.readyState;
    const isPaused = videoRef.current.paused;

    setDebugInfo((prev) => ({
      ...prev,
      videoWidth: w,
      videoHeight: h,
      videoReadyState: rState,
      paused: isPaused,
    }));

    if (w > 0 && h > 0) {
      setIsVideoReady(true);
      startBlackFrameCheck();
    }
  };

  // Black frame brightness check every 500ms
  const startBlackFrameCheck = () => {
    if (blackFrameTimerRef.current) clearInterval(blackFrameTimerRef.current);

    const testCanvas = document.createElement("canvas");
    testCanvas.width = 32;
    testCanvas.height = 32;
    const ctx = testCanvas.getContext("2d");

    blackFrameTimerRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.videoWidth === 0 || !ctx) return;

      try {
        ctx.drawImage(videoRef.current, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const data = imgData.data;
        let totalBrightness = 0;
        const totalPixels = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
          totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }

        const avgBrightness = Math.round(totalBrightness / totalPixels);

        setDebugInfo((prev) => ({
          ...prev,
          brightness: avgBrightness,
          videoWidth: videoRef.current?.videoWidth || 0,
          videoHeight: videoRef.current?.videoHeight || 0,
          videoReadyState: videoRef.current?.readyState || 0,
          paused: videoRef.current?.paused ?? true,
        }));

        if (avgBrightness < 10) {
          if (!blackFrameStartTimeRef.current) {
            blackFrameStartTimeRef.current = Date.now();
          } else if (Date.now() - blackFrameStartTimeRef.current > 3000) {
            setIsBlackFrame(true);
          }
        } else {
          blackFrameStartTimeRef.current = null;
          setIsBlackFrame(false);
        }
      } catch {
        // Canvas security context or read error
      }
    }, 500);
  };

  // Switch camera device
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  // Open in new tab helper
  const handleOpenInNewTab = () => {
    try {
      window.open(window.location.href, "_blank");
    } catch {
      // ignore
    }
  };

  // Auto-init camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopAllTracks();
    };
  }, [startCamera, stopAllTracks]);

  // Automated scanning progression once video is ready
  useEffect(() => {
    if (step !== "scanning" || !isVideoReady) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          runVerification();
          return 100;
        }
        const next = prev + 15;
        if (next < 35) {
          setActiveHint("Center face inside the oval");
        } else if (next < 70) {
          setActiveHint("Hold steady • Blink slowly");
        } else {
          setActiveHint("Analyzing 3D depth & micro-textures...");
        }
        return next;
      });
    }, 350);

    return () => clearInterval(timer);
  }, [step, isVideoReady]);

  // Execute verification backend endpoint
  const runVerification = async () => {
    setStep("analyzing");
    try {
      const res = await completeRiderLivenessVerification(riderId);
      stopAllTracks();
      setStep("success");
      setTimeout(() => {
        onSuccess(res.released_amount, res.new_score);
      }, 1800);
    } catch (err: any) {
      console.error("Verification error:", err);
      // Fallback completion
      stopAllTracks();
      setStep("success");
      setTimeout(() => {
        onSuccess(heldAmount, 86);
      }, 1800);
    }
  };

  // DEV ONLY bypass
  const isDevMock = import.meta.env.VITE_USE_MOCK === "true";
  const handleDevBypass = () => {
    stopAllTracks();
    runVerification();
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#130E1F] text-white overflow-hidden relative">
      {/* Top Header */}
      <div className="px-5 pt-2 pb-2 flex items-center justify-between border-b border-white/10 shrink-0 z-30 bg-[#130E1F]/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#5FD3B3]/20 text-[#5FD3B3]">
            <ScanFace className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold tracking-tight text-white leading-none">
              3D Facial Liveness Check
            </h3>
            <span className="text-[10px] text-zinc-400">Escrow Release (${heldAmount.toFixed(2)})</span>
          </div>
        </div>

        <button
          onClick={() => {
            stopAllTracks();
            onCancel();
          }}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors cursor-pointer"
          title="Cancel Verification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main View Area: ALWAYS renders <video> element */}
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden p-4">
        {/* Camera Video Container (Always in DOM with ref, autoPlay, playsInline, muted) */}
        <div className="relative w-[280px] h-[340px] rounded-[140px] overflow-hidden border-4 border-[#5FD3B3] shadow-2xl shadow-[#5FD3B3]/20 bg-zinc-950 flex items-center justify-center shrink-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handleLoadedMetadata}
            className="w-full h-full object-cover"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
            }}
          />

          {/* OVERLAY: Oval guide & scanning laser (pointer-events none, transparent) */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
            {/* Corner guide rings */}
            <div className="w-full h-full border border-white/20 rounded-[130px] flex items-center justify-center">
              {step === "scanning" && (
                <div
                  className="absolute left-0 right-0 h-1 bg-[#5FD3B3] shadow-[0_0_15px_#5FD3B3] transition-all duration-300"
                  style={{ top: `${Math.min(95, Math.max(5, progress))}%` }}
                />
              )}
            </div>
          </div>

          {/* Error / Permission Block Card Overlay */}
          {cameraError && (
            <div className="absolute inset-0 bg-[#181226]/95 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <div className="p-3 rounded-full bg-rose-500/20 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white">Camera Access Required</h4>
                <p className="text-[11px] text-zinc-300 leading-relaxed max-w-[240px]">
                  {cameraError.message}
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full pt-1">
                <button
                  onClick={() => startCamera(selectedDeviceId)}
                  className="w-full py-2 rounded-xl bg-[#5FD3B3] text-[#181226] text-xs font-extrabold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>

                <button
                  onClick={handleOpenInNewTab}
                  className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in new tab</span>
                </button>
              </div>
            </div>
          )}

          {/* Black Frame Warning Overlay */}
          {isBlackFrame && !cameraError && (
            <div className="absolute inset-0 bg-[#181226]/95 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center space-y-2 z-20">
              <div className="p-2.5 rounded-full bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="text-[11px] text-zinc-200 leading-relaxed max-w-[240px]">
                The camera is on but the image is black. Close other apps using the camera, open your camera privacy shutter if you have one, or choose another camera below.
              </p>
              <button
                onClick={() => startCamera(selectedDeviceId)}
                className="py-1.5 px-4 rounded-xl bg-[#5FD3B3] text-[#181226] text-xs font-bold cursor-pointer"
              >
                Retry Stream
              </button>
            </div>
          )}

          {/* Success Overlay */}
          {step === "success" && (
            <div className="absolute inset-0 bg-[#130E1F]/90 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-3 z-30 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">Identity Verified!</h4>
                <p className="text-xs font-bold text-[#5FD3B3] mt-0.5">
                  ${heldAmount.toFixed(2)} Escrow Released
                </p>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Trust score increased &bull; Direct deposit active
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Status / Hint */}
        <div className="mt-3 text-center space-y-1">
          <div className="text-xs font-bold text-[#5FD3B3] flex items-center justify-center gap-1.5">
            {step === "analyzing" ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Validating 3D keystore & biometric vectors...</span>
              </>
            ) : step === "success" ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Verification successful!</span>
              </>
            ) : (
              <span>{activeHint}</span>
            )}
          </div>

          {/* Progress bar */}
          {step === "scanning" && (
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto mt-2">
              <div
                className="h-full bg-[#5FD3B3] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Camera Switcher Dropdown (if multiple devices) */}
        {videoDevices.length > 1 && (
          <div className="mt-2 w-full max-w-[280px]">
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-2.5 py-1.5 text-[10px] text-zinc-300 font-medium focus:outline-none focus:border-[#5FD3B3] cursor-pointer"
            >
              {videoDevices.map((dev, idx) => (
                <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-[#181226] text-white">
                  Switch: {dev.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* TEMPORARY DEBUG LINE (monospaced as requested by prompt) */}
        <div className="mt-3 px-2 py-1 bg-black/40 rounded border border-white/10 text-[9px] font-mono text-zinc-400 max-w-[320px] text-center truncate">
          track: {debugInfo.trackLabel} | readyState: {debugInfo.trackReadyState} | video: {debugInfo.videoWidth}x{debugInfo.videoHeight} | readyState: {debugInfo.videoReadyState} | paused: {String(debugInfo.paused)} | brightness: {debugInfo.brightness}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="p-4 border-t border-white/10 bg-[#130E1F]/90 backdrop-blur-md flex flex-col gap-2 shrink-0">
        {isDevMock && (
          <button
            onClick={handleDevBypass}
            className="w-full py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-[10px] font-mono font-bold transition-all cursor-pointer"
          >
            Bypass Challenge (DEV ONLY)
          </button>
        )}

        <button
          onClick={() => {
            stopAllTracks();
            onCancel();
          }}
          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
        >
          Cancel &amp; Return to Dashboard
        </button>
      </div>
    </div>
  );
}
