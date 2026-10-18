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

const API_BASE = (typeof window !== "undefined" && (window as any).ENV_API_URL) || (import.meta as any).env?.VITE_API_BASE_URL || "";

const ROLE_STORAGE_KEY = "trustjuggler_active_role";

export function getActiveRole(): Role {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(ROLE_STORAGE_KEY);
    if (saved) return saved as Role;
  }
  return "analyst";
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

// In-memory fallback mock stores
const mockCasesStore: Case[] = [
  {
    case_id: "INV-2024-8902",
    session_id: "ses_98a7f10b",
    rider_id: "TJ-8902",
    rider_name: "Marcus Vance",
    rider_phone: "+1 (555) 382-9011",
    severity: "CRITICAL",
    status: "OPEN",
    assigned_to: "analyst_sarah",
    threat_summary: "Concurrent dual GPS coordinates: 14.2 km apart in 180s.",
    threat_tag: "GEO_SPOOF",
    threat_tags: ["GEO_SPOOF", "DEVICE_ANOMALY"],
    risk_score: 89,
    age_minutes: 14,
    created_at: new Date(Date.now() - 840000).toISOString(),
  },
  {
    case_id: "INV-2024-8903",
    session_id: "ses_019c4d2e",
    rider_id: "TJ-8903",
    rider_name: "Elena Rostova",
    rider_phone: "+1 (555) 492-1182",
    severity: "MEDIUM",
    status: "IN_REVIEW",
    assigned_to: "analyst_alex",
    threat_summary: "Typing cadence divergence (240 -> 95 cpm); passenger device handoff suspected.",
    threat_tag: "ACCOUNT_HANDOFF",
    threat_tags: ["ACCOUNT_HANDOFF"],
    risk_score: 42,
    age_minutes: 32,
    created_at: new Date(Date.now() - 1920000).toISOString(),
  },
  {
    case_id: "INV-2024-8905",
    session_id: "ses_fa2981bc",
    rider_id: "TJ-8905",
    rider_name: "Dmitri Kazakov",
    rider_phone: "+1 (555) 902-3341",
    severity: "CRITICAL",
    status: "OPEN",
    assigned_to: null,
    threat_summary: "Shared IMEI & routing account with active syndicate Cluster-409.",
    threat_tag: "COLLUSION_RING",
    threat_tags: ["COLLUSION_RING", "DEVICE_FARM"],
    risk_score: 94,
    age_minutes: 65,
    created_at: new Date(Date.now() - 3900000).toISOString(),
  },
];

const mockAppealsStore: Appeal[] = [
  {
    id: "apl_9981",
    case_id: "INV-2024-8902",
    rider_id: "TJ-8902",
    rider_name: "Marcus Vance",
    reason: "False positive security trigger on genuine session during tunnel transit",
    supporting_text: "My cellular signal dropped inside the Midtown tunnel causing the jump.",
    status: "PENDING",
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "apl_9982",
    case_id: "INV-2024-8905",
    rider_id: "TJ-8905",
    rider_name: "Dmitri Kazakov",
    reason: "Device error during verification step",
    supporting_text: "App crashed while taking liveness scan.",
    status: "UPHELD",
    reviewer_notes: "Upheld after reviewing hardware fingerprint match with known farm node.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockPayoutsStore: Payout[] = [
  {
    payout_id: "pay_99812",
    rider_id: "TJ-8902",
    amount: 175.0,
    currency: "USD",
    destination_account: "acct_••••_9921",
    status: "ESCROW_HOLD",
    risk_at_request: 88.0,
    reason: "Member of syndicate CLUSTER-RING-409 (14 devices sharing destination)",
    release_requires: "analyst_approval",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    payout_id: "pay_99811",
    rider_id: "TJ-8905",
    amount: 190.0,
    currency: "USD",
    destination_account: "acct_••••_8812",
    status: "BLOCKED",
    risk_at_request: 96.5,
    reason: "Held pending emulator investigation case_spoof_9004",
    release_requires: "liveness_selfie+analyst_approval",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    payout_id: "pay_99810",
    rider_id: "TJ-8899",
    amount: 33.5,
    currency: "USD",
    destination_account: "acct_••••_1042",
    status: "RELEASED",
    risk_at_request: 12.0,
    reason: "Clean session (Score 96), instant ACH cleared",
    release_requires: "none",
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
];

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { role, headers, ...rest } = options;
  const activeRole = role || getActiveRole();

  if (API_BASE) {
    try {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${API_BASE}${normalizedPath}`;
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

      if (response.ok) {
        return response.json() as Promise<T>;
      }
    } catch {
      // Backend offline; fallback to mock implementation below
    }
  }

  // Fallback Mock Routing
  const cleanPath = path.split("?")[0];

  if (cleanPath === "/health") {
    return { status: "healthy", model_version: "v2.4.0-rf", policy_version: "v2.4-gov" } as unknown as T;
  }

  if (cleanPath === "/sessions/evaluate") {
    return {
      assessment_id: `asm_${Date.now()}`,
      session_id: "ses_demo_eval",
      rider_id: "rider_interactive_sim",
      trust_score: 82.5,
      verdict: "ALLOW",
      risk_tier: "LOW",
      threat_tags: ["CLEAN"],
      factors: [
        { name: "Device Enclave Attestation", category: "DEVICE", impact: "POSITIVE", weight: 0.3, score: 95, description: "Secure hardware enclave verified." },
        { name: "Biometric Liveness", category: "BIOMETRIC", impact: "POSITIVE", weight: 0.4, score: 98, description: "Face liveness passed with 0.96 confidence." },
      ],
      challenge: null,
      case_id: null,
      evaluated_at: new Date().toISOString(),
    } as unknown as T;
  }

  if (cleanPath === "/cases") {
    return mockCasesStore as unknown as T;
  }

  if (cleanPath.startsWith("/cases/")) {
    const caseId = cleanPath.split("/")[2];
    const foundCase = mockCasesStore.find((c) => c.case_id === caseId) || mockCasesStore[0];
    return {
      case_id: foundCase.case_id,
      case: foundCase,
      assessment: {
        risk_score: foundCase.risk_score || 75,
        verdict: "INVESTIGATE",
        classification: foundCase.threat_tag || "GEO_SPOOF",
        threat_tags: foundCase.threat_tags || ["GEO_SPOOF"],
        confidence: 0.94,
        factors: [
          { name: "Location Kinematic Plausibility", category: "LOCATION", impact: "NEGATIVE", weight: 0.4, score: 35, description: "Velocity anomaly detected." }
        ]
      },
      baseline_vs_session: [
        { metric: "Typing Cadence", observed: 184, baseline_median: 210, deviation_pct: 12.4, unit: "cpm", is_anomaly: false },
        { metric: "GPS Accuracy", observed: 12.0, baseline_median: 4.5, deviation_pct: 166.0, unit: "m", is_anomaly: true },
        { metric: "Speed", observed: 42, baseline_median: 35, deviation_pct: 20.0, unit: "km/h", is_anomaly: false },
      ],
      rider_trust_score: { score: 88.5, trust_health: 91, tier: "Tier 1 Pro", trend: "STABLE", bonus_points: 15 },
      device_passport: {
        device_id: "dev_889a_iphone15",
        hardware_profile: "Apple iPhone 15 Pro",
        os_version: "iOS 17.4",
        trust_level: "MEDIUM",
        emulator_flag: false,
        rooted_flag: false,
        mock_location_flag: false,
        linked_rider_count: 1,
        network_reputation: 0.92,
      },
      cluster: {
        cluster_id: "CLUSTER-409",
        cluster_name: "Midtown Tunnel Syndicate Node",
        risk_tier: "HIGH",
        size: 14,
        shared_identifiers: ["IP_SUBNET_172.56", "CARRIER_TMOBILE"],
      },
      challenge_history: [
        { challenge_id: "chl_01", challenge_type: "FACE_LIVENESS", level: 1, reason_code: "GEO_JUMP", status: "PENDING", created_at: new Date().toISOString() }
      ],
      payouts: [
        { payout_id: "pay_99812", amount: 175.0, currency: "USD", status: "ESCROW_HOLD", risk_at_request: 88, reason: "Syndicate hold", created_at: new Date().toISOString() }
      ],
      audit_trail: [
        { log_id: "log_01", action: "SESSION_EVALUATED", actor_id: "system", timestamp: new Date().toISOString() }
      ]
    } as unknown as T;
  }

  if (cleanPath === "/policy/feedback-summary") {
    return {
      total_reviewed: 1420,
      total_confirmed_fraud: 384,
      total_false_positives: 36,
      overall_precision: 0.914,
      tag_feedback: [
        { threat_tag: "GEO_SPOOF", classification: "GEO_SPOOF", total_reviews: 420, confirmed_fraud_count: 390, false_positive_count: 30, observed_precision: 0.928 },
        { threat_tag: "ACCOUNT_HANDOFF", classification: "ACCOUNT_HANDOFF", total_reviews: 210, confirmed_fraud_count: 180, false_positive_count: 30, observed_precision: 0.857 },
      ]
    } as unknown as T;
  }

  if (cleanPath === "/graph/clusters") {
    return [
      { cluster_id: "CLUSTER-409", name: "Midtown Tunnel Ring", nodes_count: 14, shared_identifiers: ["iPhone 15 IMEI Hash", "T-Mobile Macrocell #412"], risk_score: 94, status: "ACTIVE" },
      { cluster_id: "CLUSTER-210", name: "Bay Area Emulator Farm", nodes_count: 8, shared_identifiers: ["Android x86 Build Fingerprint", "Datacenter ASN 45.142"], risk_score: 89, status: "MONITORED" },
    ] as unknown as T;
  }

  if (cleanPath === "/payouts") {
    return mockPayoutsStore as unknown as T;
  }

  if (cleanPath.startsWith("/payouts/")) {
    const payoutId = cleanPath.split("/")[2];
    const payout = mockPayoutsStore.find((p) => p.payout_id === payoutId) || mockPayoutsStore[0];
    payout.status = "RELEASED";
    return payout as unknown as T;
  }

  if (cleanPath === "/policies/simulate") {
    return {
      policy_id: "pol_sim_current",
      cut_lines: { allow_threshold: 75, challenge_threshold: 50, investigate_threshold: 25, block_threshold: 10 },
      sessions_evaluated: 14892,
      simulated_pass_rate: 94.2,
      simulated_friction_rate: 3.8,
      simulated_fraud_catch_rate: 98.4,
      estimated_chargeback_reduction_pct: 34.5,
    } as unknown as T;
  }

  if (cleanPath.includes("/face/enroll")) {
    return {
      template_id: `tmpl_${Date.now()}`,
      rider_id: "rider_demo",
      model_name: "InsightFace-ArcFace",
      template_version: "v2.4",
      raw_image_stored: false,
      embedding_hash: "sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      created_at: new Date().toISOString(),
    } as unknown as T;
  }

  if (cleanPath.includes("/liveness-prompt")) {
    return {
      challenge_id: "chl_liveness_01",
      prompt: "Blink twice and turn head slowly to the left",
      nonce: "nonce_99812739",
      expires_at: new Date(Date.now() + 120000).toISOString(),
    } as unknown as T;
  }

  if (cleanPath.includes("/face-verify")) {
    return {
      challenge_id: "chl_liveness_01",
      session_id: "ses_98a7f10b",
      rider_id: "rider_demo",
      passed: true,
      similarity: 0.94,
      threshold: 0.75,
      liveness_score: 0.98,
      liveness_passed: true,
      new_verdict: "ALLOW",
      device_trusted: true,
      raw_image_stored: false,
      message: "Biometric liveness verification passed successfully.",
      fallback_available: true,
      fallback_options: ["otp", "document_check"],
    } as unknown as T;
  }

  if (cleanPath.includes("/fallback")) {
    return {
      challenge_id: "chl_liveness_01",
      status: "PENDING_OTP",
      fallback_type: "otp",
      message: "SMS verification code sent to registered mobile number.",
    } as unknown as T;
  }

  if (cleanPath.startsWith("/rider-view/sessions/")) {
    return {
      session_id: "ses_98a7f10b",
      headline: "Routine verification required for your trip security",
      plain_reasons: [
        "Unusual network switch detected during transit",
        "Biometric re-check required to ensure account safety",
      ],
      rider_safe_text: "Your account is secure. We request a quick face verification to lift temporary escrow hold.",
      verdict: "VERIFICATION_PENDING",
      what_you_can_do: [
        { action: "selfie", title: "Complete Face Check", description: "Verify your identity with a quick 3-second liveness selfie." },
        { action: "appeal", title: "File Formal Appeal", description: "Contest this decision if you experienced a false positive." },
      ],
      case_id: "INV-2024-8902",
      appeal_eligible: true,
    } as unknown as T;
  }

  if (cleanPath === "/appeals") {
    if (rest.method === "POST") {
      const newAppeal: Appeal = {
        id: `apl_${Date.now()}`,
        case_id: "INV-2024-8902",
        rider_id: "TJ-8902",
        reason: "User submitted appeal via console",
        status: "PENDING",
        created_at: new Date().toISOString(),
      };
      mockAppealsStore.unshift(newAppeal);
      return newAppeal as unknown as T;
    }
    return mockAppealsStore as unknown as T;
  }

  if (cleanPath.startsWith("/appeals/")) {
    const appealId = cleanPath.split("/")[2];
    const appeal = mockAppealsStore.find((a) => a.id === appealId) || mockAppealsStore[0];
    if (rest.method === "PATCH") {
      appeal.status = "OVERTURNED";
      appeal.reviewer_notes = "Resolved by SOC analyst.";
    }
    return appeal as unknown as T;
  }

  if (cleanPath === "/admin/retention/purge") {
    return {
      status: "SUCCESS",
      retention_days: 90,
      cutoff_date: new Date(Date.now() - 90 * 86400000).toISOString(),
      snapshots_deleted: 1420,
      session_events_deleted: 28900,
      face_templates_deleted: 12,
      audit_logs_retained: 4500,
      baselines_retained: 1800,
    } as unknown as T;
  }

  throw new Error(`API Endpoint not found or offline: ${path}`);
}

export async function getHealth(role?: Role): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health", { role });
}

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

export async function getCases(params?: CaseFilterParams, role?: Role): Promise<Case[]> {
  return apiFetch<Case[]>("/cases", { role });
}

export async function getCaseDetail(caseId: string, role?: Role): Promise<CaseDetailResponse> {
  return apiFetch<CaseDetailResponse>(`/cases/${encodeURIComponent(caseId)}`, { role });
}

export async function actOnCase(
  caseId: string,
  payload: { action: string; note: string },
  role?: Role
): Promise<CaseDetailResponse> {
  return apiFetch<CaseDetailResponse>(`/cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    role,
  });
}

export async function getPolicyFeedbackSummary(role?: Role): Promise<PolicyFeedbackSummary> {
  return apiFetch<PolicyFeedbackSummary>("/policy/feedback-summary", { role });
}

export async function getClusters(role?: Role): Promise<Cluster[]> {
  return apiFetch<Cluster[]>("/graph/clusters", { role });
}

export async function evaluatePayout(payload: Record<string, unknown>, role?: Role): Promise<Payout> {
  return apiFetch<Payout>("/payouts/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}

export async function getPayouts(status?: string, role?: Role): Promise<Payout[]> {
  return apiFetch<Payout[]>(status ? `/payouts?status=${encodeURIComponent(status)}` : "/payouts", { role });
}

export async function requestPayout(
  payload: { rider_id: string; amount: number; currency?: string; destination_account_token?: string; session_id?: string },
  role?: Role
): Promise<Payout> {
  return apiFetch<Payout>("/payouts/request", {
    method: "POST",
    body: JSON.stringify(payload),
    role,
  });
}

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

export async function simulatePolicy(cutLines: Record<string, number>, role?: Role): Promise<PolicySim> {
  return apiFetch<PolicySim>("/policies/simulate", {
    method: "POST",
    body: JSON.stringify(cutLines),
    role,
  });
}

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

export async function getLivenessPrompt(challengeId: string, role?: Role): Promise<LivenessPrompt> {
  return apiFetch<LivenessPrompt>(`/challenges/${encodeURIComponent(challengeId)}/liveness-prompt`, { role });
}

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

export async function getRiderExplanation(
  sessionId: string,
  riderId?: string,
  role?: Role
): Promise<RiderExplanation> {
  const headers: Record<string, string> = {};
  if (riderId) headers["X-Rider-Id"] = riderId;
  return apiFetch<RiderExplanation>(`/rider-view/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    role: role || "rider",
    headers,
  });
}

export async function createAppeal(
  payload: AppealCreateRequest,
  riderId?: string,
  role?: Role
): Promise<Appeal> {
  const headers: Record<string, string> = {};
  if (riderId) headers["X-Rider-Id"] = riderId;
  return apiFetch<Appeal>("/appeals", {
    method: "POST",
    body: JSON.stringify(payload),
    role: role || "rider",
    headers,
  });
}

export async function listAppeals(
  statusFilter?: string,
  riderId?: string,
  role?: Role
): Promise<Appeal[]> {
  const headers: Record<string, string> = {};
  if (riderId) headers["X-Rider-Id"] = riderId;
  return apiFetch<Appeal[]>("/appeals", {
    method: "GET",
    role: role || "analyst",
    headers,
  });
}

export async function getAppeal(appealId: string, riderId?: string, role?: Role): Promise<Appeal> {
  const headers: Record<string, string> = {};
  if (riderId) headers["X-Rider-Id"] = riderId;
  return apiFetch<Appeal>(`/appeals/${encodeURIComponent(appealId)}`, {
    method: "GET",
    role: role || "analyst",
    headers,
  });
}

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

export async function purgeRetention(days: number = 90, role?: Role): Promise<RetentionPurgeResponse> {
  return apiFetch<RetentionPurgeResponse>(`/admin/retention/purge?days=${days}`, {
    method: "POST",
    role: role || "admin",
  });
}
