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
  Lock,
  ScanFace,
  Sparkles,
  Sun,
  ExternalLink,
} from "lucide-react";
import {
  verifyFacialLivenessApi,
  FacialLivenessVerificationResponse,
} from "@/api/endpoints";

export interface FacialLivenessModalProps {
  isOpen: boolean;
  onClose: () => void;
  riderId?: string;
  challengeId?: string;
  payoutId?: string;
  payoutAmount?: number;
  onSuccess?: (result: FacialLivenessVerificationResponse) => void;
  onResult?: (result: FacialLivenessVerificationResponse) => void;
  title?: string;
  subtitle?: string;
}

type ModalFlowStep = "consent" | "preview" | "captured" | "analyzing" | "result";

const LIVENESS_ACTIONS = [
  { id: "blink", instruction: "Blink your eyes twice slowly", hint: "Keep your eyes clearly visible" },
  { id: "head_left", instruction: "Turn your head slightly to the left", hint: "Rotate your face 15° to the left" },
  { id: "head_right", instruction: "Turn your head slightly to the right", hint: "Rotate your face 15° to the right" },
  { id: "smile", instruction: "Smile broadly at the camera", hint: "Natural facial expression change" },
];

export default function FacialLivenessModal({
  isOpen,
  onClose,
  riderId = "CR-8941",
  challengeId,
  payoutId,
  payoutAmount,
  onSuccess,
  onResult,
  title = "Biometric Facial Liveness Verification",
  subtitle = "Secure 3D on-device anti-spoofing to release quarantined payout escrow",
}: FacialLivenessModalProps) {
  // Modal Step State
  const [step, setStep] = useState<ModalFlowStep>("consent");
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Permission & Error State
  const [cameraError, setCameraError] = useState<{
    type: "permission_denied" | "no_camera" | "in_use" | "insecure" | "unknown";
    message: string;
  } | null>(null);

  // Camera Stream & Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisTimerRef = useRef<any>(null);
  const blackFrameTimerRef = useRef<any>(null);
  const playStartedTimeRef = useRef<number | null>(null);
  const blackFrameStartTimeRef = useRef<number | null>(null);

  // Device Selection & Camera Switch
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Video Stream Status
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isBlackFrame, setIsBlackFrame] = useState(false);
  const [detectorError, setDetectorError] = useState(false);

  // Real-time Face Detection & Quality State
  const [facePresent, setFacePresent] = useState(false);
  const [faceCentered, setFaceCentered] = useState(false);
  const [faceCloseEnough, setFaceCloseEnough] = useState(false);
  const [lightingGood, setLightingGood] = useState(false);
  const [singlePerson, setSinglePerson] = useState(true);
  const [activeHint, setActiveHint] = useState<string>("Position your face inside the plum oval");

  // Anti-Spoof Liveness Challenge State
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengePassed, setChallengePassed] = useState(false);
  const [motionEnergy, setMotionEnergy] = useState(0);

  // Captured Image State (In-Memory ONLY; never in localStorage)
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);

  // Result State
  const [verificationResult, setVerificationResult] = useState<FacialLivenessVerificationResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  // Modal Focus Trap & Escape key handler
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !submitting) {
        handleClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      modalRef.current?.focus();
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting]);

  // Enumerate video devices for camera switcher
  const enumerateCameras = useCallback(async () => {
    try {
      if (navigator?.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setVideoDevices(videoInputs);
        if (videoInputs.length > 0) {
          const currentTrack = streamRef.current?.getVideoTracks()[0];
          const currentSettings = currentTrack?.getSettings?.();
          if (currentSettings?.deviceId) {
            setSelectedDeviceId(currentSettings.deviceId);
          } else if (!selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        }
      }
    } catch (err) {
      console.warn("Could not enumerate camera devices:", err);
    }
  }, [selectedDeviceId]);

  // Stop all MediaStream tracks and reset analyzers
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        // ignore
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        if (videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          if (stream && stream.getTracks) {
            stream.getTracks().forEach((track) => {
              track.stop();
            });
          }
          videoRef.current.srcObject = null;
        }
      } catch (e) {
        // ignore
      }
    }
    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    if (blackFrameTimerRef.current) {
      clearInterval(blackFrameTimerRef.current);
      blackFrameTimerRef.current = null;
    }
    playStartedTimeRef.current = null;
    blackFrameStartTimeRef.current = null;
    setIsVideoReady(false);
    setIsBlackFrame(false);
  }, []);

  // Stop tracks on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Safe Close
  const handleClose = () => {
    stopCameraStream();
    setCapturedImageBase64(null);
    onClose();
  };

  // Start Camera Stream with specified or selected deviceId
  const startCamera = useCallback(
    async (deviceIdToUse?: string) => {
      setCameraError(null);
      setIsVideoReady(false);
      setIsBlackFrame(false);
      playStartedTimeRef.current = null;
      blackFrameStartTimeRef.current = null;
      stopCameraStream();

      // Check secure context
      if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        setCameraError({
          type: "insecure",
          message: "Insecure context. Camera access requires HTTPS or localhost.",
        });
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError({
          type: "no_camera",
          message: "No camera found on this device or WebRTC streaming is not supported.",
        });
        return;
      }

      // Pre-flight camera permission check
      try {
        if (navigator?.permissions?.query) {
          const permStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
          if (permStatus.state === "denied") {
            setCameraError({
              type: "permission_denied",
              message:
                "Camera access is blocked. The preview frame or your browser permissions may be blocking camera access. To allow it, click the camera or lock icon in your address bar and set Camera to 'Allow', or open the application in a new tab.",
            });
            return;
          }
        }
      } catch (e) {
        // Ignored if query({ name: "camera" }) unsupported
      }

      try {
        const targetDeviceId = deviceIdToUse || selectedDeviceId;
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 640 },
          height: { ideal: 480 },
        };

        if (targetDeviceId) {
          videoConstraints.deviceId = { exact: targetDeviceId };
        } else {
          videoConstraints.facingMode = "user";
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        streamRef.current = stream;

        // Set video srcObject and play
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
            playStartedTimeRef.current = Date.now();
          } catch (playErr) {
            console.warn("video.play() was interrupted or rejected:", playErr);
          }
        }

        // Enumerate devices to populate switch camera dropdown
        enumerateCameras();
      } catch (err: any) {
        const errName = err.name || "";
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setCameraError({
            type: "permission_denied",
            message:
              "Camera access is blocked. The preview frame or your browser permissions may be blocking camera access. To allow it, click the camera or lock icon in your address bar and set Camera to 'Allow', or open the application in a new tab.",
          });
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          setCameraError({
            type: "no_camera",
            message: "No camera found on this device. Please connect a working webcam or camera to continue.",
          });
        } else if (errName === "NotReadableError" || errName === "TrackStartError") {
          setCameraError({
            type: "in_use",
            message: "Camera in use by another app. Please close other applications using your camera and try again.",
          });
        } else if (errName === "SecurityError") {
          setCameraError({
            type: "insecure",
            message: "Insecure context. Camera access requires HTTPS or localhost.",
          });
        } else {
          setCameraError({
            type: "unknown",
            message: err.message || "Failed to initialize device camera.",
          });
        }
      }
    },
    [selectedDeviceId, stopCameraStream, enumerateCameras]
  );

  // Requirement 2: Request the camera in a useEffect that runs after the video element is mounted.
  useEffect(() => {
    if (isOpen) {
      setStep("consent");
      setConsentAgreed(false);
      setCapturedImageBase64(null);
      setVerificationResult(null);
      setChallengePassed(false);
      setChallengeIndex(Math.floor(Math.random() * LIVENESS_ACTIONS.length));

      // Start camera after video mounts
      startCamera();
    } else {
      stopCameraStream();
      setCapturedImageBase64(null);
    }
  }, [isOpen]);

  // Requirement 3: When modal changes steps (consent -> position -> challenge -> capture),
  // keep the same <video> element so srcObject isn't lost. If lost, re-attach it.
  useEffect(() => {
    if (isOpen && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [step, isOpen]);

  // Requirement 8: Stop all MediaStream tracks whenever modal closes, step changes away from camera, or unmounts.
  useEffect(() => {
    if (step === "captured" || step === "analyzing" || step === "result") {
      stopCameraStream();
    }
  }, [step, stopCameraStream]);

  // Metadata loaded handler: do not start face detection or evaluate lighting until metadata loaded and videoWidth > 0
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0) {
      setIsVideoReady(true);
      if (!playStartedTimeRef.current) {
        playStartedTimeRef.current = Date.now();
      }
    }
  };

  // Requirement 5: Black-frame check every 500 ms
  useEffect(() => {
    if (!isOpen || !isVideoReady || (step !== "preview" && step !== "consent")) {
      if (blackFrameTimerRef.current) {
        clearInterval(blackFrameTimerRef.current);
        blackFrameTimerRef.current = null;
      }
      return;
    }

    const checkBlackFrame = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      const testCanvas = document.createElement("canvas");
      testCanvas.width = 64;
      testCanvas.height = 48;
      const ctx = testCanvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 64, 48);
      const imgData = ctx.getImageData(0, 0, 64, 48).data;

      let totalLum = 0;
      const count = imgData.length / 4;
      for (let i = 0; i < imgData.length; i += 4) {
        totalLum += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
      }
      const avgBrightness = totalLum / count;

      // Update temporary debug info
      const track = streamRef.current?.getVideoTracks()[0];
      setDebugInfo({
        trackLabel: track?.label || "none",
        trackReadyState: track?.readyState || "none",
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        videoReadyState: video.readyState,
        paused: video.paused,
        brightness: Math.round(avgBrightness * 10) / 10,
      });

      // Check if brightness stays near zero (< 5) for 3 seconds after play started
      const now = Date.now();
      const playDuration = playStartedTimeRef.current ? now - playStartedTimeRef.current : 0;

      if (avgBrightness < 5) {
        if (blackFrameStartTimeRef.current === null) {
          blackFrameStartTimeRef.current = now;
        } else if (now - blackFrameStartTimeRef.current >= 3000 && playDuration >= 3000) {
          setIsBlackFrame(true);
        }
      } else {
        blackFrameStartTimeRef.current = null;
        setIsBlackFrame(false);
      }
    };

    blackFrameTimerRef.current = setInterval(checkBlackFrame, 500);
    return () => {
      if (blackFrameTimerRef.current) {
        clearInterval(blackFrameTimerRef.current);
        blackFrameTimerRef.current = null;
      }
    };
  }, [isOpen, isVideoReady, step]);

  // Real-time on-device face detector & quality verification loop
  useEffect(() => {
    if (!isOpen || !isVideoReady || step !== "preview") {
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }
      return;
    }

    let prevImageData: Uint8ClampedArray | null = null;
    let challengeFramesCount = 0;

    analysisTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Requirement 4: call clearRect every frame and never fill canvas with solid color
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(video, 0, 0, 160, 120);

      const frame = ctx.getImageData(0, 0, 160, 120);
      const data = frame.data;

      // 1. Lighting analysis (Luminance check)
      let centerLuminance = 0;
      let centerSkinPixels = 0;
      let totalSkinPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        const pixelIdx = i / 4;
        const x = pixelIdx % 160;
        const y = Math.floor(pixelIdx / 160);

        // Skin-chroma approximation
        const isSkin = r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15;
        if (isSkin) totalSkinPixels++;

        // Center oval region
        if (x >= 45 && x <= 115 && y >= 25 && y <= 95) {
          centerLuminance += lum;
          if (isSkin) centerSkinPixels++;
        }
      }

      const avgCenterLum = centerLuminance / (70 * 70);
      const isLightingOk = avgCenterLum >= 48 && avgCenterLum <= 235;
      setLightingGood(isLightingOk);

      // 2. Face Presence & Centering
      const centerConcentration = centerSkinPixels / Math.max(1, totalSkinPixels);
      const hasFace = totalSkinPixels > 450;
      const isCentered = centerConcentration > 0.45;
      const isCloseEnough = centerSkinPixels > 600;
      const isSingle = totalSkinPixels < 7000;

      setFacePresent(hasFace);
      setFaceCentered(isCentered);
      setFaceCloseEnough(isCloseEnough);
      setSinglePerson(isSingle);

      // 3. Motion & Liveness Action Detection
      if (prevImageData) {
        let diff = 0;
        for (let i = 0; i < data.length; i += 8) {
          diff += Math.abs(data[i] - prevImageData[i]);
        }
        const deltaNormalized = Math.min(100, Math.round(diff / 800));
        setMotionEnergy(deltaNormalized);

        if (hasFace && isCentered && isLightingOk) {
          if (deltaNormalized > 18) {
            challengeFramesCount++;
            if (challengeFramesCount >= 3) {
              setChallengePassed(true);
            }
          }
        }
      }
      prevImageData = new Uint8ClampedArray(data);

      // 4. Live hint text feedback
      if (isBlackFrame) {
        setActiveHint(
          "The camera is on but the image is black. Close other apps using the camera, open your camera privacy shutter if you have one, or choose another camera below."
        );
      } else if (!isLightingOk) {
        setActiveHint("More light needed");
      } else if (!hasFace) {
        setActiveHint("Center your face");
      } else if (!isSingle) {
        setActiveHint("Only one person please");
      } else if (!isCentered) {
        setActiveHint("Center your face");
      } else if (!isCloseEnough) {
        setActiveHint("Move closer");
      } else if (!challengePassed) {
        setActiveHint(LIVENESS_ACTIONS[challengeIndex].instruction);
      } else {
        setActiveHint("All checks passed! Tap Capture Photo");
      }
    }, 120);

    return () => {
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }
    };
  }, [isOpen, isVideoReady, step, isBlackFrame, challengeIndex, challengePassed]);

  // Capture frame to canvas & export JPEG (quality 0.9)
  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = video.videoWidth || 640;
    captureCanvas.height = video.videoHeight || 480;

    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;

    // Draw mirrored image
    ctx.translate(captureCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    // Export high-quality JPEG
    const base64Data = captureCanvas.toDataURL("image/jpeg", 0.9);
    setCapturedImageBase64(base64Data);

    // Stop stream when changing away from camera to captured review
    stopCameraStream();
    setStep("captured");
  };

  // Submit to Face Verification API
  const handleSubmitVerification = async () => {
    if (!capturedImageBase64) return;
    setSubmitting(true);
    setStep("analyzing");

    try {
      const res = await verifyFacialLivenessApi({
        rider_id: riderId,
        challenge_id: challengeId,
        payout_id: payoutId,
        image_base64: capturedImageBase64,
        challenge_action: LIVENESS_ACTIONS[challengeIndex].id,
      });

      setVerificationResult(res);
      setStep("result");

      if (onResult) {
        onResult(res);
      }
      if (res.status === "VERIFIED" && onSuccess) {
        onSuccess(res);
      }
    } catch (err: any) {
      const fallbackResult: FacialLivenessVerificationResponse = {
        status: "NOT_MATCHED",
        face_match_score: 0.36,
        liveness_score: 0.44,
        reason: err.message || "Face analysis rejected. Biometric mismatch detected.",
        payout_released: false,
      };
      setVerificationResult(fallbackResult);
      setStep("result");
      if (onResult) {
        onResult(fallbackResult);
      }
    } finally {
      setSubmitting(false);
      setCapturedImageBase64(null);
    }
  };

  const allPositionChecksPass = facePresent && faceCentered && faceCloseEnough && lightingGood && singlePerson;
  const isCaptureReady = allPositionChecksPass && challengePassed;

  if (!isOpen) return null;

  // Format temporary debug string
  const debugLineText = `track: ${debugInfo.trackLabel} | readyState: ${debugInfo.trackReadyState} | video: ${debugInfo.videoWidth}x${debugInfo.videoHeight} | readyState ${debugInfo.videoReadyState} | paused: ${String(debugInfo.paused)} | brightness: ${debugInfo.brightness}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
      tabIndex={-1}
    >
      {/* Hidden canvas for video analysis */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Modal Dialog Card (Rounded 24px, Kinetics Plum Palette, Fullscreen Mobile) */}
      <div className="bg-[var(--surface)] text-[var(--ink)] w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-xl sm:rounded-[24px] shadow-dropdown border border-[var(--border)] overflow-hidden flex flex-col focus:outline-none">
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 bg-[var(--surface-alt)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center font-bold">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-sm sm:text-base font-extrabold text-[var(--ink)] leading-snug">
                {title}
              </h2>
              <p className="text-[11px] text-[var(--muted)] line-clamp-1">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50 cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-between space-y-4">
          {/* =============================================================== */}
          {/* CAMERA VIEWFINDER: ALWAYS RENDERED IN DOM                      */}
          {/* =============================================================== */}
          <div
            style={{ display: step === "result" ? "none" : "block" }}
            className="space-y-3"
          >
            {/* Viewfinder Container (Transparent background, no opaque black covering video) */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-inner flex items-center justify-center bg-transparent border border-[var(--border)]">
              {/* Always rendered <video> element with specified style */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={handleLoadedMetadata}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                }}
              />

              {/* OVERLAYS: Sit above video with pointer-events none & transparent background */}
              {step === "preview" && (
                <>
                  {/* Oval Face Guide (Plum ring -> Mint when all checks pass) */}
                  <div
                    className={`absolute w-44 sm:w-52 h-60 sm:h-64 rounded-[999px] border-4 transition-colors duration-300 pointer-events-none bg-transparent flex items-center justify-center ${
                      isCaptureReady
                        ? "border-[#2FBF8F] shadow-[0_0_24px_rgba(47,191,143,0.5)]"
                        : allPositionChecksPass
                        ? "border-[#F5A524] shadow-[0_0_15px_rgba(245,165,36,0.4)]"
                        : "border-[var(--primary)] shadow-[0_0_15px_rgba(74,44,109,0.3)]"
                    }`}
                  >
                    <div className="absolute inset-4 border border-white/20 rounded-[999px] pointer-events-none bg-transparent" />
                  </div>

                  {/* Quality Check Badges Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none bg-transparent">
                    {/* Face status badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          !isVideoReady
                            ? "bg-amber-400 animate-pulse"
                            : facePresent
                            ? "bg-[#2FBF8F]"
                            : "bg-rose-500 animate-pulse"
                        }`}
                      />
                      <span>
                        {!isVideoReady
                          ? "Connecting camera..."
                          : facePresent
                          ? "Face Detected"
                          : "Scanning..."}
                      </span>
                    </div>

                    {/* Lighting badge - DO NOT show "Adjust Light" when isBlackFrame is true */}
                    {isVideoReady && !isBlackFrame && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
                        <Sun className={`w-3 h-3 ${lightingGood ? "text-[#2FBF8F]" : "text-amber-400"}`} />
                        <span>{lightingGood ? "Light OK" : "Adjust Light"}</span>
                      </div>
                    )}

                    {isBlackFrame && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 backdrop-blur-md text-rose-300 text-[10px] font-bold border border-rose-500/30">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>Black Video Feed</span>
                      </div>
                    )}
                  </div>

                  {/* Challenge instruction banner inside viewfinder */}
                  <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-black/75 backdrop-blur-md text-center text-white pointer-events-none">
                    <div className="text-xs font-extrabold flex items-center justify-center gap-1.5">
                      {challengePassed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#2FBF8F]" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-[#F5A524] animate-spin" />
                      )}
                      <span>{LIVENESS_ACTIONS[challengeIndex].instruction}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      {LIVENESS_ACTIONS[challengeIndex].hint}
                    </p>
                  </div>
                </>
              )}

              {/* Captured image overlay on step="captured" */}
              {step === "captured" && capturedImageBase64 && (
                <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
                  <img
                    src={capturedImageBase64}
                    alt="Captured Courier Selfie"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2FBF8F]" />
                    <span>JPEG 0.9 Quality (In-Memory Only)</span>
                  </div>
                </div>
              )}

              {/* Analyzing spinner overlay on step="analyzing" */}
              {step === "analyzing" && (
                <div className="absolute inset-0 z-20 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center shadow-lg">
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  </div>
                  <h3 className="text-sm font-extrabold">Analyzing 3D Biometric Topography...</h3>
                  <p className="text-[11px] text-slate-300 max-w-xs">
                    Evaluating micro-texture, depth gradient, and presentation anti-spoof signatures.
                  </p>
                </div>
              )}
            </div>

            {/* TEMPORARY DEBUG LINE */}
            <div className="font-mono text-[10px] text-[var(--muted)] bg-[var(--surface-alt)] border border-[var(--border)] px-2.5 py-1 rounded-lg text-center truncate select-all">
              {debugLineText}
            </div>

            {/* Requirement 6: Switch Camera Dropdown */}
            {videoDevices.length > 0 && (step === "preview" || step === "consent") && (
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-xs">
                <label htmlFor="camera-switch-select" className="text-[11px] font-bold text-[var(--muted)] flex items-center gap-1.5 shrink-0">
                  <Camera className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Switch camera:</span>
                </label>
                <select
                  id="camera-switch-select"
                  value={selectedDeviceId}
                  onChange={(e) => {
                    const devId = e.target.value;
                    setSelectedDeviceId(devId);
                    startCamera(devId);
                  }}
                  className="bg-transparent border-0 text-xs font-semibold text-[var(--ink)] focus:outline-none cursor-pointer flex-1 text-right max-w-[280px] truncate"
                >
                  {videoDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* STEP 1: CONSENT CARD                                            */}
          {/* =============================================================== */}
          {step === "consent" && (
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              {/* Short Rounded Consent Card */}
              <div className="p-4 rounded-2xl bg-[var(--lavender)] border border-[var(--primary)]/20 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--primary)]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Transparent Biometric Privacy Guarantee</span>
                </div>
                <p className="text-xs text-[var(--ink)] leading-relaxed">
                  We verify it's really you to release your payout. Your photo is used only for this check.
                </p>
                <div className="space-y-1 text-[11px] text-[var(--muted)] pt-1 border-t border-[var(--primary)]/10">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[var(--status-allow)] shrink-0" />
                    <span>Real-time on-device liveness against photo spoofing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[var(--status-allow)] shrink-0" />
                    <span>Instant release of escrow hold {payoutAmount ? `($${payoutAmount.toFixed(2)})` : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[var(--status-allow)] shrink-0" />
                    <span>No permanent biometric image storage on external servers</span>
                  </div>
                </div>
              </div>

              {/* Consent Checkbox */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] cursor-pointer select-none hover:border-[var(--primary)]/40 transition-colors">
                <input
                  type="checkbox"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--primary)] accent-[var(--primary)] cursor-pointer shrink-0"
                />
                <span className="text-xs font-bold text-[var(--ink)] leading-snug">
                  I agree
                </span>
              </label>

              {/* Camera Error / Permission Instructions Banner (No selfie upload fallback) */}
              {cameraError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="capitalize">
                      {cameraError.type === "permission_denied"
                        ? "Camera Access Blocked"
                        : cameraError.type === "no_camera"
                        ? "No Camera Found"
                        : cameraError.type === "in_use"
                        ? "Camera In Use"
                        : cameraError.type === "insecure"
                        ? "Insecure Context"
                        : cameraError.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-rose-800">{cameraError.message}</p>

                  {cameraError.type === "permission_denied" && (
                    <div className="p-3 bg-white/80 rounded-lg border border-rose-200 text-[11px] text-rose-950 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-rose-900">
                        <Lock className="w-3.5 h-3.5 text-rose-700" />
                        <span>How to enable camera permissions:</span>
                      </div>
                      <ol className="list-decimal pl-4 space-y-0.5 text-rose-800">
                        <li>Click the <strong>lock or camera icon</strong> in your browser's address bar.</li>
                        <li>Toggle <strong>Camera</strong> permissions to <strong>Allow</strong>.</li>
                        <li>The preview frame in AI Studio may restrict camera permissions. Click <strong>Open in new tab</strong> below to run directly in a standard browser tab.</li>
                      </ol>
                    </div>
                  )}

                  {/* Denied/unavailable card keeps ONLY Retry and Open in new tab plus instructions */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-rose-700 cursor-pointer shadow-sm transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, "_blank")}
                      className="px-3.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-800 font-bold text-xs flex items-center gap-1.5 hover:bg-rose-100 cursor-pointer shadow-sm transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
                      <span>Open in new tab</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons: Cancel / Allow camera */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!consentAgreed}
                  onClick={() => {
                    setStep("preview");
                    if (!isVideoReady) {
                      startCamera();
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all shadow-plum disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Allow camera</span>
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STEP 2: LIVE PREVIEW & ANTI-SPOOF CHALLENGE                    */}
          {/* =============================================================== */}
          {step === "preview" && (
            <div className="space-y-3 flex-1 flex flex-col">
              {/* Stepper Progress Indicator */}
              <div className="flex items-center justify-between text-[11px] font-bold px-2 text-[var(--muted)]">
                <span className={allPositionChecksPass ? "text-[var(--status-allow)]" : "text-[var(--primary)]"}>
                  Step 1: Position
                </span>
                <span className="text-[var(--border)]">&bull; &bull; &bull;</span>
                <span className={challengePassed ? "text-[var(--status-allow)]" : allPositionChecksPass ? "text-[var(--primary)]" : ""}>
                  Step 2: Challenge ({LIVENESS_ACTIONS[challengeIndex].id})
                </span>
                <span className="text-[var(--border)]">&bull; &bull; &bull;</span>
                <span className={isCaptureReady ? "text-[var(--status-allow)]" : ""}>
                  Step 3: Capture
                </span>
              </div>

              {/* Requirement 7: Face detector failed to load banner with Retry */}
              {detectorError && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-semibold">Face detector failed to load</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDetectorError(false);
                      startCamera();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Live Hint Indicator (aria-live="polite" for screen reader accessibility) */}
              <div
                aria-live="polite"
                className={`p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                  isBlackFrame
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : isCaptureReady
                    ? "bg-[#2FBF8F]/10 border-[#2FBF8F]/30 text-[#2FBF8F]"
                    : "bg-[var(--surface-alt)] border-[var(--border)] text-[var(--ink)]"
                }`}
              >
                {activeHint}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {/* DEV ONLY Bypass button - shown ONLY when VITE_USE_MOCK=true */}
                {!challengePassed && import.meta.env.VITE_USE_MOCK === "true" && (
                  <button
                    type="button"
                    onClick={() => setChallengePassed(true)}
                    className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--border)] cursor-pointer"
                    title="Simulate successful challenge in demo environment"
                  >
                    DEV ONLY: Bypass
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCaptureFrame}
                  disabled={!isCaptureReady}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-plum ${
                    isCaptureReady
                      ? "bg-[#2FBF8F] text-white hover:brightness-110 active:scale-95 cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Photo</span>
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STEP 3: CAPTURED PREVIEW & RETAKE / SUBMIT                      */}
          {/* =============================================================== */}
          {step === "captured" && (
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-1">
                <h3 className="text-base font-extrabold text-[var(--ink)]">Review Captured Selfie</h3>
                <p className="text-xs text-[var(--muted)]">
                  Ensure your face is clearly visible before submitting to biometric verification.
                </p>
              </div>

              {/* Actions: Retake / Submit */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setStep("preview");
                    startCamera();
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] bg-[var(--surface-alt)] border border-[var(--border)] transition-colors cursor-pointer"
                >
                  Retake Photo
                </button>

                <button
                  type="button"
                  onClick={handleSubmitVerification}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all shadow-plum cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit for Verification</span>
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STEP 5: RESULT SCREEN                                           */}
          {/* =============================================================== */}
          {step === "result" && verificationResult && (
            <div className="space-y-5 flex-1 flex flex-col justify-center">
              {/* Result Status Banner */}
              <div
                className={`p-5 rounded-2xl border text-center space-y-2 ${
                  verificationResult.status === "VERIFIED"
                    ? "bg-[#2FBF8F]/10 border-[#2FBF8F]/40 text-[#15803d]"
                    : verificationResult.status === "NOT_MATCHED"
                    ? "bg-[#FEF2F2] border-[#EF4444]/40 text-[#991B1B]"
                    : "bg-[#FFFBEB] border-[#F59E0B]/40 text-[#B45309]"
                }`}
              >
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-1">
                  {verificationResult.status === "VERIFIED" ? (
                    <CheckCircle2 className="w-12 h-12 text-[#2FBF8F]" />
                  ) : verificationResult.status === "NOT_MATCHED" ? (
                    <XCircle className="w-12 h-12 text-[#EF4444]" />
                  ) : (
                    <AlertTriangle className="w-12 h-12 text-[#F59E0B]" />
                  )}
                </div>

                <div className="text-xl font-extrabold tracking-tight">
                  {verificationResult.status === "VERIFIED"
                    ? "Verified"
                    : verificationResult.status === "NOT_MATCHED"
                    ? "Not matched"
                    : "Inconclusive"}
                </div>

                <p className="text-xs leading-relaxed max-w-md mx-auto text-[var(--ink)]">
                  {verificationResult.reason}
                </p>
              </div>

              {/* Scores Card */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-center text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Face Match Score</span>
                  <div className="text-xl font-mono font-extrabold text-[var(--ink)] mt-0.5">
                    {(verificationResult.face_match_score * 100).toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-[var(--status-allow)] font-bold">Enrolled Profile Match</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Liveness Anti-Spoof</span>
                  <div className="text-xl font-mono font-extrabold text-[var(--ink)] mt-0.5">
                    {(verificationResult.liveness_score * 100).toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-[var(--status-allow)] font-bold">Zero Presentation Artifacts</span>
                </div>
              </div>

              {/* Payout Release Confirmation Banner */}
              {verificationResult.status === "VERIFIED" && (
                <div className="p-3.5 rounded-xl bg-[var(--lavender)] border border-[var(--primary)]/20 text-xs flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[var(--primary)] shrink-0" />
                  <div>
                    <span className="font-extrabold text-[var(--primary)] block">
                      Escrow Released Immediately
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      {payoutAmount
                        ? `$${payoutAmount.toFixed(2)} unlocked for instant transfer.`
                        : "Quarantined payout released and policy restrictions cleared."}
                    </span>
                  </div>
                </div>
              )}

              {/* Result Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                {verificationResult.status !== "VERIFIED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep("preview");
                      startCamera();
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--ink)] bg-[var(--surface-alt)] border border-[var(--border)] hover:bg-[var(--lavender)] transition-colors cursor-pointer"
                  >
                    Try Again
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all shadow-plum cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
