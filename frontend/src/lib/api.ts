import {
  HealthStatus,
  Role,
  SessionRequest,
  Assessment,
  Case,
  CaseDetailResponse,
  PolicyFeedbackSummary,
  Cluster,
  Payout,
  PolicySim,
  FaceEnrollResponse,
  LivenessPrompt,
  FaceVerifyResponse,
  ChallengeFallbackResponse,
  RiderExplanation,
  Appeal,
  AppealCreateRequest,
  AppealActionRequest,
  RetentionPurgeResponse,
} from "./types";

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

export interface CaseFilterParams {
  status?: string;
  severity?: string;
  rider?: string;
  threat_tag?: string;
  date?: string;
  sort?: string;
  skip?: number;
  limit?: number;
}

/**
 * Fetches cases for fraud investigation with multi-criteria filters.
 */
export async function getCases(
  params?: CaseFilterParams,
  role?: Role
): Promise<Case[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.severity && params.severity !== "ALL") query.set("severity", params.severity);
  if (params?.rider) query.set("rider", params.rider);
  if (params?.threat_tag && params.threat_tag !== "ALL") query.set("threat_tag", params.threat_tag);
  if (params?.date) query.set("date", params.date);
  if (params?.sort) query.set("sort", params.sort);
  if (params?.skip !== undefined) query.set("skip", String(params.skip));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));

  const qs = query.toString();
  const path = qs ? `/cases?${qs}` : "/cases";
  return apiFetch<Case[]>(path, { role });
}

/**
 * Fetches 360-degree case dossier including assessment, biometric telemetry comparison,
 * trust history, device passport, fraud cluster, challenges, payouts, and audit trail.
 */
export async function getCaseDetail(caseId: string, role?: Role): Promise<CaseDetailResponse> {
  return apiFetch<CaseDetailResponse>(`/cases/${encodeURIComponent(caseId)}`, { role });
}

export interface CaseDecisionResult {
  status: string;
  case_id: string;
  new_status: string;
  action?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Submits an analyst review action / decision.
 * POST /api/v1/cases/{case_id}/decision
 */
export async function actOnCase(
  caseId: string,
  payload: { action: string; note?: string },
  role?: Role
): Promise<CaseDecisionResult> {
  const url = `${API_BASE}/cases/${encodeURIComponent(caseId)}/decision`;
  const activeRole = role || getActiveRole() || "analyst";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Role": activeRole,
      },
      body: JSON.stringify({
        action: payload.action,
        note: payload.note || "",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `Case decision request failed: url=${url}, status=${res.status} ${res.statusText}, body=${errText}`
      );
      let parsedDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedDetail = parsed.detail || parsed.message || errText;
      } catch {
        // preserve raw error text
      }
      throw new Error(`API Error [${res.status}] ${res.statusText}: ${parsedDetail}`);
    }

    const data = await res.json();
    return data as CaseDecisionResult;
  } catch (err) {
    console.error("actOnCase error:", err);
    throw err;
  }
}

/**
 * Retrieves policy feedback summary and suggested threshold nudges.
 */
export async function getPolicyFeedbackSummary(role?: Role): Promise<PolicyFeedbackSummary> {
  return apiFetch<PolicyFeedbackSummary>("/policy/feedback-summary", { role });
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

/**
 * Retrieves rider-safe explanation of session verdict, plain reasons, and resolution options.
 */
export async function getRiderExplanation(
  sessionId: string,
  riderId?: string,
  role?: Role
): Promise<RiderExplanation> {
  const headers: Record<string, string> = {};
  if (riderId) {
    headers["X-Rider-Id"] = riderId;
  }
  return apiFetch<RiderExplanation>(`/rider-view/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    role: role || "rider",
    headers,
  });
}

/**
 * Submits a new formal appeal on behalf of a rider.
 */
export async function createAppeal(
  payload: AppealCreateRequest,
  riderId?: string,
  role?: Role
): Promise<Appeal> {
  const headers: Record<string, string> = {};
  if (riderId) {
    headers["X-Rider-Id"] = riderId;
  }
  return apiFetch<Appeal>("/appeals", {
    method: "POST",
    body: JSON.stringify(payload),
    role: role || "rider",
    headers,
  });
}

/**
 * Lists appeals with optional status filter.
 */
export async function listAppeals(
  statusFilter?: string,
  riderId?: string,
  role?: Role
): Promise<Appeal[]> {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== "ALL") {
    params.set("status", statusFilter);
  }
  if (riderId) {
    params.set("rider_id", riderId);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const headers: Record<string, string> = {};
  if (riderId) {
    headers["X-Rider-Id"] = riderId;
  }
  return apiFetch<Appeal[]>(`/appeals${query}`, {
    method: "GET",
    role: role || "analyst",
    headers,
  });
}

/**
 * Retrieves a single appeal record.
 */
export async function getAppeal(
  appealId: string,
  riderId?: string,
  role?: Role
): Promise<Appeal> {
  const headers: Record<string, string> = {};
  if (riderId) {
    headers["X-Rider-Id"] = riderId;
  }
  return apiFetch<Appeal>(`/appeals/${encodeURIComponent(appealId)}`, {
    method: "GET",
    role: role || "analyst",
    headers,
  });
}

/**
 * Resolves an appeal with a ruling ('upheld' or 'overturned') and reviewer notes.
 */
export async function resolveAppeal(
  appealId: string,
  payload: AppealActionRequest,
  role?: Role
): Promise<Appeal> {
  return apiFetch<Appeal>(`/appeals/${encodeURIComponent(appealId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    role: role || "analyst",
  });
}

/**
 * Triggers admin data retention purge for raw telemetry older than N days.
 */
export async function purgeRetention(
  days: number = 90,
  role?: Role
): Promise<RetentionPurgeResponse> {
  return apiFetch<RetentionPurgeResponse>(`/admin/retention/purge?days=${days}`, {
    method: "POST",
    role: role || "admin",
  });
}
