/**
 * Kinetics API Client
 * Configured with baseURL from VITE_API_BASE_URL (default: http://localhost:8000)
 * Handles JSON serialization, role headers, error normalization, and mock fallback.
 */

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

export const USE_MOCK =
  (import.meta as any).env?.VITE_USE_MOCK === "true";

export interface ApiError {
  status: number;
  message: string;
  detail?: any;
}

export class NormalizedApiError extends Error {
  status: number;
  detail?: any;

  constructor(status: number, message: string, detail?: any) {
    super(message);
    this.name = "NormalizedApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface RequestOptions extends RequestInit {
  role?: string;
  timeoutMs?: number;
}

/**
 * Generic API request wrapper with normalized error handling
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { role, timeoutMs = 8000, ...customConfig } = options;

  // Retrieve current active role from localStorage or fallback
  const currentRole =
    role ||
    (typeof window !== "undefined"
      ? (localStorage.getItem("kinetics_active_role") || "Analyst").toLowerCase()
      : "analyst");

  // Ensure path starts with / and respects /api/v1 if not present
  const normalizedPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Role": currentRole,
    Accept: "application/json",
    ...(customConfig.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...customConfig,
      headers,
      signal: controller.signal,
    });
    clearTimeout(id);

    // Empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get("content-type");
    let data: any = null;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const errorMessage =
        (data && (data.detail || data.message || data.error)) ||
        `API request failed with status ${response.status}`;
      throw new NormalizedApiError(response.status, errorMessage, data);
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(id);
    if (error instanceof NormalizedApiError) {
      throw error;
    }
    if (error.name === "AbortError") {
      throw new NormalizedApiError(408, "Request timed out after 8s");
    }
    throw new NormalizedApiError(
      503,
      error.message || "Failed to connect to backend server"
    );
  }
}

/**
 * Quick health-check probe for the navbar status indicator
 */
export async function checkBackendHealth(): Promise<{ online: boolean; statusText: string }> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    }).catch(() =>
      fetch(`${API_BASE_URL}/api/v1/health`, {
        method: "GET",
        signal: controller.signal,
      })
    );
    clearTimeout(id);
    if (res && res.ok) {
      return { online: true, statusText: "API :8000 online" };
    }
    return { online: false, statusText: "offline" };
  } catch {
    return { online: false, statusText: "offline" };
  }
}
