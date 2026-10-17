import { HealthStatus, Role, SessionRequest, Assessment, Case, Cluster, Payout, PolicySim } from "./types";

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
 * Runs policy simulation across threshold cut-lines.
 */
export async function simulatePolicy(cutLines: Record<string, number>, role?: Role): Promise<PolicySim> {
  return apiFetch<PolicySim>("/policies/simulate", {
    method: "POST",
    body: JSON.stringify(cutLines),
    role,
  });
}
