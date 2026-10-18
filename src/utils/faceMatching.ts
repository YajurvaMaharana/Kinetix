import * as faceapi from "@vladmandic/face-api";

const DB_NAME = "KineticsBiometricsDB";
const DB_VERSION = 2; // Incremented for template version 2 schema
const STORE_NAME = "face_templates";

let modelsLoadedPromise: Promise<boolean> | null = null;
let tfBackendName = "unknown";

/**
 * Initialize TFJS backend & load face-api models once
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoadedPromise) {
    return modelsLoadedPromise;
  }

  modelsLoadedPromise = (async () => {
    try {
      // Set TensorFlow backend
      const tf = (faceapi as any).tf;
      if (tf) {
        try {
          await tf.setBackend("webgl");
          tfBackendName = tf.getBackend();
        } catch {
          await tf.setBackend("cpu");
          tfBackendName = tf.getBackend();
        }
      }

      const modelPath = "/models";
      // Shared model suite: SSD MobileNet v1, 68-point landmarks, face recognition
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
      ]);
      console.log("[Biometrics Pipeline] Loaded SSD MobileNet v1, Landmarks, Recognition models from /models");
      return true;
    } catch (localErr) {
      console.warn("[Biometrics Pipeline] Local model load failed, falling back to CDN:", localErr);
      try {
        const cdnPath = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(cdnPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(cdnPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(cdnPath),
        ]);
        console.log("[Biometrics Pipeline] Loaded models from CDN");
        return true;
      } catch (cdnErr) {
        console.error("[Biometrics Pipeline] CDN load failed:", cdnErr);
        modelsLoadedPromise = null;
        throw new Error("Failed to load biometric neural models. Check network connection.");
      }
    }
  })();

  return modelsLoadedPromise;
}

export function getTfBackend(): string {
  const tf = (faceapi as any).tf;
  return tfBackendName || (tf ? tf.getBackend() : "webgl");
}

/**
 * Shared face descriptor function using SSD MobileNet v1 with minConfidence 0.6
 */
export async function getFaceDescriptor(
  inputElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<{ descriptor: number[] | null; detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null }> {
  await loadFaceApiModels();

  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 });

  const detection = await faceapi
    .detectSingleFace(inputElement as any, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection || !detection.descriptor) {
    return { descriptor: null, detection: null };
  }

  // Convert Float32Array to plain JS number array
  const descriptorArray = Array.from(detection.descriptor);
  return { descriptor: descriptorArray, detection };
}

export interface FrameQualityResult {
  ok: boolean;
  score: number;
  boxWidthRatio: number;
  brightness: number;
  blurScore: number;
  isFrontal: boolean;
  reasons: string[];
}

/**
 * Validate frame quality against strict thresholds:
 * - Single face detected with score >= 0.8
 * - Face box width >= 25% of frame width
 * - Average brightness between 60 and 200
 * - Blur check (Laplacian variance >= 80)
 * - Roughly frontal pose
 */
export function validateFrameQuality(
  canvas: HTMLCanvasElement,
  detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null,
  frameWidth: number,
  frameHeight: number
): FrameQualityResult {
  const reasons: string[] = [];
  if (!detection) {
    return {
      ok: false,
      score: 0,
      boxWidthRatio: 0,
      brightness: 0,
      blurScore: 0,
      isFrontal: false,
      reasons: ["No face detected"],
    };
  }

  const score = detection.detection.score;
  const box = detection.detection.box;
  const boxWidthRatio = box.width / frameWidth;

  if (score < 0.8) {
    reasons.push(`Low detection confidence (${(score * 100).toFixed(0)}% < 80%)`);
  }

  if (boxWidthRatio < 0.25) {
    reasons.push(`Move closer (face size ${(boxWidthRatio * 100).toFixed(0)}% < 25%)`);
  }

  // Measure Brightness & Blur from canvas context
  const ctx = canvas.getContext("2d");
  let brightness = 120;
  let blurScore = 150;

  if (ctx && frameWidth > 0 && frameHeight > 0) {
    try {
      const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
      const data = imageData.data;

      let sum = 0;
      const step = 4;
      for (let i = 0; i < data.length; i += step) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      brightness = sum / (data.length / 4);

      // Simple 3x3 Laplacian variance blur estimation
      let lapSum = 0;
      let lapSquareSum = 0;
      let sampleCount = 0;
      const w = Math.min(160, frameWidth);
      const h = Math.min(120, frameHeight);

      for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
          const idx = (y * w + x) * 4;
          const val = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

          const top = 0.299 * data[((y - 1) * w + x) * 4];
          const bottom = 0.299 * data[((y + 1) * w + x) * 4];
          const left = 0.299 * data[(y * w + (x - 1)) * 4];
          const right = 0.299 * data[(y * w + (x + 1)) * 4];

          const lap = 4 * val - top - bottom - left - right;
          lapSum += lap;
          lapSquareSum += lap * lap;
          sampleCount++;
        }
      }

      if (sampleCount > 0) {
        const mean = lapSum / sampleCount;
        blurScore = lapSquareSum / sampleCount - mean * mean;
      }
    } catch (e) {
      // ignore context read errors
    }
  }

  if (brightness < 60) {
    reasons.push(`Too dark (${brightness.toFixed(0)} < 60)`);
  } else if (brightness > 200) {
    reasons.push(`Too bright (${brightness.toFixed(0)} > 200)`);
  }

  if (blurScore < 80) {
    reasons.push(`Image too blurry (sharpness ${blurScore.toFixed(0)} < 80)`);
  }

  // Landmark pose check (yaw / roll)
  let isFrontal = true;
  if (detection.landmarks) {
    const nose = detection.landmarks.getNose()[3];
    const leftEye = detection.landmarks.getLeftEye()[0];
    const rightEye = detection.landmarks.getRightEye()[0];

    const eyeDistance = Math.abs(rightEye.x - leftEye.x);
    const eyeYDiff = Math.abs(rightEye.y - leftEye.y);

    // Roll check (eye level difference relative to distance)
    if (eyeYDiff / (eyeDistance || 1) > 0.35) {
      isFrontal = false;
      reasons.push("Head tilted");
    }

    // Yaw check (nose relative to eyes)
    const noseToLeft = Math.abs(nose.x - leftEye.x);
    const noseToRight = Math.abs(nose.x - rightEye.x);
    const ratio = noseToLeft / (noseToLeft + noseToRight || 1);
    if (ratio < 0.25 || ratio > 0.75) {
      isFrontal = false;
      reasons.push("Face turned too far");
    }
  }

  const ok = reasons.length === 0;
  return { ok, score, boxWidthRatio, brightness, blurScore, isFrontal, reasons };
}

/**
 * Open IndexedDB database
 */
function openBiometricsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: "userId" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredFaceTemplate {
  userId: string;
  templateVersion: 2;
  descriptors: number[][]; // 5 plain JS number arrays (length 128 each)
  createdAt: string;
  count: number;
}

/**
 * Save enrolled template with ALL 5 descriptors as plain number arrays (no averaging)
 */
export async function saveEnrolledTemplate(userId: string, descriptors: number[][]): Promise<void> {
  // Validate all descriptors
  const validated: number[][] = [];
  for (const desc of descriptors) {
    if (!Array.isArray(desc) || desc.length !== 128) {
      throw new Error("Invalid descriptor dimension. Must be 128 numbers.");
    }
    const cleanNumbers = desc.map((n) => (typeof n === "number" && !isNaN(n) ? n : 0));
    if (cleanNumbers.some((n) => isNaN(n))) {
      throw new Error("Descriptor contains NaN values.");
    }
    validated.push(cleanNumbers);
  }

  const db = await openBiometricsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: StoredFaceTemplate = {
      userId,
      templateVersion: 2,
      descriptors: validated,
      createdAt: new Date().toISOString(),
      count: validated.length,
    };

    const req = store.put(record);
    req.onsuccess = () => {
      localStorage.setItem(`kinetics_enrolled_face_${userId}`, "true");
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export type GetTemplateStatus = "OK" | "NOT_ENROLLED" | "OLD_VERSION" | "INVALID";

/**
 * Load enrolled template from IndexedDB and validate templateVersion: 2 & 128-number vectors
 */
export async function getEnrolledTemplate(
  userId: string
): Promise<{ status: GetTemplateStatus; template: StoredFaceTemplate | null }> {
  try {
    const db = await openBiometricsDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(userId);

      req.onsuccess = () => {
        const res = req.result as StoredFaceTemplate | undefined;
        if (!res) {
          resolve({ status: "NOT_ENROLLED", template: null });
          return;
        }

        if (res.templateVersion !== 2) {
          resolve({ status: "OLD_VERSION", template: null });
          return;
        }

        if (!Array.isArray(res.descriptors) || res.descriptors.length === 0) {
          resolve({ status: "INVALID", template: null });
          return;
        }

        // Validate each descriptor
        for (const desc of res.descriptors) {
          if (!Array.isArray(desc) || desc.length !== 128 || desc.some((n) => typeof n !== "number" || isNaN(n))) {
            resolve({ status: "INVALID", template: null });
            return;
          }
        }

        resolve({ status: "OK", template: res });
      };

      req.onerror = () => resolve({ status: "INVALID", template: null });
    });
  } catch (err) {
    console.warn("[Biometrics Pipeline] Read error:", err);
    return { status: "INVALID", template: null };
  }
}

/**
 * Calculate Euclidean Distance between two 128-float vectors
 */
export function computeEuclideanDistance(desc1: number[], desc2: number[]): number {
  if (!Array.isArray(desc1) || !Array.isArray(desc2) || desc1.length !== 128 || desc2.length !== 128) {
    return NaN;
  }
  let sumSquare = 0;
  for (let i = 0; i < 128; i++) {
    const diff = desc1[i] - desc2[i];
    if (isNaN(diff)) return NaN;
    sumSquare += diff * diff;
  }
  return Math.sqrt(sumSquare);
}

/**
 * Calculate median of an array of numbers
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return NaN;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export interface VerificationPipelineResult {
  decision: "MATCHED" | "NOT_MATCHED" | "INCONCLUSIVE" | "ERROR";
  medianDistance: number;
  perFrameMinDistances: number[];
  goodFramesCount: number;
  threshold: number;
  errorMessage?: string;
}

/**
 * Run verification decision using 5 live frames against enrolled template:
 * - Minimum Euclidean distance per frame against 5 enrolled descriptors
 * - Median distance decision against threshold (0.55)
 */
export function evaluateVerificationDecision(
  goodFrameDescriptors: number[][],
  enrolledDescriptors: number[][],
  threshold: number = 0.55
): VerificationPipelineResult {
  if (!enrolledDescriptors || enrolledDescriptors.length === 0) {
    return {
      decision: "ERROR",
      medianDistance: NaN,
      perFrameMinDistances: [],
      goodFramesCount: goodFrameDescriptors.length,
      threshold,
      errorMessage: "Face template problem, please re-enroll",
    };
  }

  if (goodFrameDescriptors.length < 3) {
    return {
      decision: "INCONCLUSIVE",
      medianDistance: NaN,
      perFrameMinDistances: [],
      goodFramesCount: goodFrameDescriptors.length,
      threshold,
      errorMessage: "Fewer than 3 good quality frames captured",
    };
  }

  const perFrameMinDistances: number[] = [];

  for (const liveDesc of goodFrameDescriptors) {
    const distances = enrolledDescriptors.map((enrolled) => computeEuclideanDistance(liveDesc, enrolled));

    if (distances.some((d) => isNaN(d))) {
      return {
        decision: "ERROR",
        medianDistance: NaN,
        perFrameMinDistances: [],
        goodFramesCount: goodFrameDescriptors.length,
        threshold,
        errorMessage: "Face template problem, please re-enroll",
      };
    }

    const minDist = Math.min(...distances);
    perFrameMinDistances.push(Number(minDist.toFixed(4)));
  }

  const medianDistance = Number(calculateMedian(perFrameMinDistances).toFixed(4));

  if (isNaN(medianDistance)) {
    return {
      decision: "ERROR",
      medianDistance: NaN,
      perFrameMinDistances,
      goodFramesCount: goodFrameDescriptors.length,
      threshold,
      errorMessage: "Face template problem, please re-enroll",
    };
  }

  const decision = medianDistance <= threshold ? "MATCHED" : "NOT_MATCHED";

  return {
    decision,
    medianDistance,
    perFrameMinDistances,
    goodFramesCount: goodFrameDescriptors.length,
    threshold,
  };
}
