import { HealthStatus, Role, SessionRequest, Assessment, Case, Cluster, Payout, PolicySim, FaceEnrollResponse, LivenessPrompt, FaceVerifyResponse, ChallengeFallbackResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Storage key for active user persona / RBAC role in local dev
 */
const ROLE_STORAGE_KEY = "trustjuggler_active_role";

export function getActiveRole(): Role {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(ROLE_STORAGE_KEY);
    if (saved) return saved as Role;
  }
  return (process.env.NEXT_PUBLIC_DEFAULT_ROLE as Role) || "analyst";
}

export function setActiveRole(role: Role): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
    window.dispatchEvent(new Event("trustjuggler:role_changed"));
  }
}

interface FetchOptions extends RequestInit {
  role?: Role;
}

/**
 * Unified API Client for TrustJuggler v2
 * Injects X-Role header automatically for role-based access & field masking.
 */
export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { role, headers, ...rest } = options;
  const activeRole = role || getActiveRole();

  // Normalize path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = path.startsWith("http") ? path : `${API_BASE}${normalizedPath}`;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Role": activeRole,
  };

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...defaultHeaders,
      ...(headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedDetail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      parsedDetail = parsed.detail || parsed.message || errorBody;
    } catch {
      // keep raw string
    }
    throw new Error(`API Error [${response.status}] ${response.statusText}: ${parsedDetail}`);
  }

  return response.json() as Promise<T>;
}

// -----------------------------------------------------------------------------
// Core Service Endpoints
// -----------------------------------------------------------------------------

/**
 * Checks system health, model version, and policy matrix version.
 */
export async function getHealth(role?: Role): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health", { role });
}

/**
 * Evaluates live session telemetry and biometric signatures.
 */
export async function evaluateSession(payload: SessionRequest, role?: Role): Promise<Assessment> {
  return apiFetch<Assessment>("/sessions/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}

/**
 * Fetches open cases for fraud investigation.
 */
export async function getCases(role?: Role): Promise<Case[]> {
  return apiFetch<Case[]>("/cases", { role });
}

/**
 * Retrieves discovered syndicate clusters from graph engine.
 */
export async function getClusters(role?: Role): Promise<Cluster[]> {
  return apiFetch<Cluster[]>("/graph/clusters", { role });
}

/**
 * Evaluates payout release with fraud ring gating.
 */
export async function evaluatePayout(payload: Record<string, unknown>, role?: Role): Promise<Payout> {
  return apiFetch<Payout>("/payouts/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}

/**
 * Lists payout disbursements with optional status filtering.
 */
export async function getPayouts(status?: string, role?: Role): Promise<Payout[]> {
  const path = status ? `/payouts?status=${encodeURIComponent(status)}` : "/payouts";
  return apiFetch<Payout[]>(path, { role });
}

/**
 * Submits a new payout request evaluated against safety policies.
 */
export async function requestPayout(
  payload: {
    rider_id: string;
    amount: number;
    currency?: string;
    destination_account_token?: string;
    session_id?: string;
  },
  role?: Role
): Promise<Payout> {
  return apiFetch<Payout>("/payouts/request", {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}

/**
 * Analyst action to release or block a held payout.
 */
export async function patchPayout(
  payoutId: string,
  action: "release" | "block",
  notes?: string,
  role?: Role
): Promise<Payout> {
  return apiFetch<Payout>(`/payouts/${encodeURIComponent(payoutId)}`, {
    method: "PATCH",
    body: JSON.stringify({ action, notes }),
    role,
  });
}


/**
 * Runs policy simulation across threshold cut-lines.
 */
export async function simulatePolicy(cutLines: Record<string, number>, role?: Role): Promise<PolicySim> {
  return apiFetch<PolicySim>("/policies/simulate", {
    method: "POST",
    body: JSON.stringify(cutLines),
    role,
  });
}

/**
 * Enrolls a rider face template (Fernet-encrypted vector, zero raw image storage).
 */
export async function enrollFace(
  riderId: string,
  payload: { image_base64?: string; scenario_flag?: string; embedding?: number[] } = {},
  role?: Role
): Promise<FaceEnrollResponse> {
  return apiFetch<FaceEnrollResponse>(`/riders/${encodeURIComponent(riderId)}/face/enroll`, {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}

/**
 * Generates an ephemeral cryptographic liveness prompt (blink, head turn, smile).
 */
export async function getLivenessPrompt(
  challengeId: string,
  role?: Role
): Promise<LivenessPrompt> {
  return apiFetch<LivenessPrompt>(`/challenges/${encodeURIComponent(challengeId)}/liveness-prompt`, {
    method: "GET",
    role,
  });
}

/**
 * Submits biometric verification (1:1 matching against enrolled template + liveness check).
 */
export async function verifyFace(
  challengeId: string,
  payload: { image_base64?: string; scenario_flag?: string; prompt_nonce?: string },
  role?: Role
): Promise<FaceVerifyResponse> {
  return apiFetch<FaceVerifyResponse>(`/challenges/${encodeURIComponent(challengeId)}/face-verify`, {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}

/**
 * Requests an alternate step-up challenge (e.g. OTP, document_check, manual_review).
 */
export async function fallbackChallenge(
  challengeId: string,
  payload: { fallback_type: "otp" | "document_check" | "manual_review"; reason?: string },
  role?: Role
): Promise<ChallengeFallbackResponse> {
  return apiFetch<ChallengeFallbackResponse>(`/challenges/${encodeURIComponent(challengeId)}/fallback`, {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}
