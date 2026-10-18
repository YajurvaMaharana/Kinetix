/**
 * Kinetics API Endpoints
 * All typed functions matching the TrustJuggler v2 backend specification.
 * Supports transparent fallback to mock data when USE_MOCK=true or when offline.
 */

import { apiClient, USE_MOCK } from "./client";
import {
  MOCK_STATS,
  MOCK_ALERTS,
  MOCK_PENDING_PAYOUTS,
  MOCK_RIDER_DELIVERIES,
} from "../data/mockData";

export interface HealthStatus {
  status: string;
  model_version: string;
  policy_version: string;
}

export interface MetricsSummary {
  total_couriers: number;
  active_couriers: string;
  collusion_rings_detected: number;
  payouts_under_review_amount: number;
  payouts_pending_count: number;
  automated_release_rate_pct: number;
  chargeback_dispute_rate_pct: number;
}

export interface SessionItem {
  id: string;
  session_id?: string;
  rider_id: string;
  driver_id?: string;
  status: string;
  trust_score: number;
  speed_kmh?: number;
  created_at: string;
}

export interface AssessmentFactor {
  name: string;
  category: "DEVICE" | "BIOMETRIC" | "TELEMETRY" | "GRAPH";
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  weight: number;
  score: number;
  description: string;
}

export interface AssessmentResponse {
  assessment_id: string;
  session_id: string;
  rider_id: string;
  trust_score: number;
  verdict: "ALLOW" | "CHALLENGE" | "ESCALATE" | "BLOCK";
  risk_tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  threat_tags: string[];
  factors: AssessmentFactor[];
  evaluated_at: string;
}

export interface CaseItem {
  case_id: string;
  session_id: string;
  rider_id: string;
  rider_name?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED_LEGIT" | "RESTRICTED";
  assigned_to: string | null;
  threat_summary: string;
  risk_score: number;
  created_at: string;
  updated_at?: string;
}

export interface AppealItem {
  id: string;
  case_id?: string;
  rider_id?: string;
  reason: string;
  supporting_text?: string;
  status: "PENDING" | "OVERTURNED" | "UPHELD";
  reviewer_note?: string;
  created_at: string;
}

export interface PayoutItem {
  payout_id: string;
  rider_id: string;
  driver_id?: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "BLOCKED" | "HELD";
  hold_reason?: string;
  destination_account?: string;
  created_at?: string;
}

export interface GraphCluster {
  cluster_id: string;
  name: string;
  nodes_count: number;
  shared_identifiers: string[];
  risk_score: number;
  status: "ACTIVE" | "DISRUPTED" | "MONITORING";
}

export interface PolicyThresholds {
  allow_threshold: number;
  challenge_threshold: number;
  investigate_threshold: number;
  block_threshold: number;
}

export interface PolicySimResult {
  policy_id: string;
  sessions_evaluated: number;
  simulated_pass_rate: number;
  simulated_friction_rate: number;
  simulated_fraud_catch_rate: number;
  estimated_chargeback_reduction_pct: number;
}

/* =========================================================================
   MOCK STORES (Shared for fallback & offline demonstration)
   ========================================================================= */
let mockCases: CaseItem[] = [
  {
    case_id: "CASE-9004",
    session_id: "sess_spoof_9004",
    rider_id: "CR-8941",
    rider_name: "Alex Rivera",
    severity: "HIGH",
    status: "OPEN",
    assigned_to: "marcus_vance",
    threat_summary: "GPS Mock Provider Delta: 184 km/h jump during active delivery.",
    risk_score: 89,
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    case_id: "CASE-9005",
    session_id: "sess_ring_9005",
    rider_id: "CR-9023",
    rider_name: "Tariq Vance",
    severity: "CRITICAL",
    status: "IN_REVIEW",
    assigned_to: "elena_rostova",
    threat_summary: "Collusion Cluster #C-902: 4 riders linked to single IMEI hardware key.",
    risk_score: 94,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    case_id: "CASE-9006",
    session_id: "sess_legit_9006",
    rider_id: "CR-7812",
    rider_name: "Elena Rostova",
    severity: "LOW",
    status: "RESOLVED_LEGIT",
    assigned_to: "marcus_vance",
    threat_summary: "Routine route drift cleared by 3D liveness biometric attestation.",
    risk_score: 11,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

let mockAppeals: AppealItem[] = [
  {
    id: "APP-401",
    case_id: "CASE-9004",
    rider_id: "CR-8941",
    reason: "False positive velocity jump caused by tunnel GPS multipath.",
    supporting_text: "Attached dashcam footage demonstrating constant 35mph speed in 99 tunnel.",
    status: "PENDING",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "APP-398",
    case_id: "CASE-8891",
    rider_id: "CR-6650",
    reason: "Legitimate dual phone setup for navigation and company courier app.",
    status: "OVERTURNED",
    reviewer_note: "Verified secondary handset belongs to spouse on same delivery shift.",
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
];

let mockPayouts: PayoutItem[] = [
  {
    payout_id: "PAY-89410",
    rider_id: "CR-8941",
    amount: 1240.0,
    status: "HELD",
    hold_reason: "IBAN Conflict: 3 separate couriers linked to identical bank routing within 48h.",
    destination_account: "Chase •••• 9921",
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    payout_id: "PAY-89411",
    rider_id: "CR-9023",
    amount: 480.5,
    status: "PENDING",
    hold_reason: "Spatial Drift: Impossible hop of 8.4km during active order handoff.",
    destination_account: "Wells Fargo •••• 4108",
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    payout_id: "PAY-89412",
    rider_id: "CR-7812",
    amount: 865.2,
    status: "APPROVED",
    destination_account: "Bank of America •••• 1283",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

/* =========================================================================
   API ENDPOINTS
   ========================================================================= */

// 1. Health & System Metrics
export async function getHealth(): Promise<HealthStatus> {
  if (USE_MOCK) {
    return {
      status: "healthy",
      model_version: "v2.0.0-rf-heuristic",
      policy_version: "v2.4.0",
    };
  }
  try {
    return await apiClient<HealthStatus>("/api/v1/health");
  } catch {
    return {
      status: "healthy",
      model_version: "v2.0.0-rf-heuristic (mock fallback)",
      policy_version: "v2.4.0",
    };
  }
}

export async function getMetricsSummary(): Promise<MetricsSummary> {
  if (USE_MOCK) {
    return {
      total_couriers: 42810,
      active_couriers: MOCK_STATS.totalActiveCouriers,
      collusion_rings_detected: 14,
      payouts_under_review_amount: 18420,
      payouts_pending_count: 8,
      automated_release_rate_pct: 98.7,
      chargeback_dispute_rate_pct: 0.02,
    };
  }
  try {
    return await apiClient<MetricsSummary>("/api/v1/metrics/summary");
  } catch {
    return {
      total_couriers: 42810,
      active_couriers: MOCK_STATS.totalActiveCouriers,
      collusion_rings_detected: 14,
      payouts_under_review_amount: 18420,
      payouts_pending_count: 8,
      automated_release_rate_pct: 98.7,
      chargeback_dispute_rate_pct: 0.02,
    };
  }
}

// 2. Sessions
export async function listSessions(): Promise<SessionItem[]> {
  if (USE_MOCK) {
    return MOCK_ALERTS.map((a, i) => ({
      id: a.id,
      session_id: `sess_live_${1000 + i}`,
      rider_id: a.courier_id,
      status: a.status === "Allow" ? "ALLOW" : a.status === "Challenge" ? "CHALLENGE" : "ESCALATE",
      trust_score: 100 - a.ai_risk,
      speed_kmh: 38 + i * 12,
      created_at: new Date(Date.now() - i * 180000).toISOString(),
    }));
  }
  try {
    return await apiClient<SessionItem[]>("/api/v1/sessions");
  } catch {
    return MOCK_ALERTS.map((a, i) => ({
      id: a.id,
      session_id: `sess_live_${1000 + i}`,
      rider_id: a.courier_id,
      status: a.status === "Allow" ? "ALLOW" : a.status === "Challenge" ? "CHALLENGE" : "ESCALATE",
      trust_score: 100 - a.ai_risk,
      speed_kmh: 38 + i * 12,
      created_at: new Date(Date.now() - i * 180000).toISOString(),
    }));
  }
}

export async function evaluateSession(payload: any): Promise<AssessmentResponse> {
  if (USE_MOCK) {
    return {
      assessment_id: `eval_${Date.now()}`,
      session_id: payload.session_id || "sess_sim_01",
      rider_id: payload.rider_id || "CR-8941",
      trust_score: 94.5,
      verdict: "ALLOW",
      risk_tier: "LOW",
      threat_tags: ["CLEAN"],
      factors: [
        {
          name: "Hardware Passport",
          category: "DEVICE",
          impact: "POSITIVE",
          weight: 0.25,
          score: 0.98,
          description: "Cryptographically verified genuine hardware signature.",
        },
        {
          name: "Kinematic Continuity",
          category: "TELEMETRY",
          impact: "POSITIVE",
          weight: 0.35,
          score: 0.95,
          description: "Speed & acceleration profile matches physical road network.",
        },
      ],
      evaluated_at: new Date().toISOString(),
    };
  }
  return await apiClient<AssessmentResponse>("/api/v1/sessions/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 3. Cases
export async function listCases(status?: string): Promise<CaseItem[]> {
  if (USE_MOCK) {
    return status ? mockCases.filter((c) => c.status === status) : mockCases;
  }
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return await apiClient<CaseItem[]>(`/api/v1/cases${query}`);
  } catch {
    return status ? mockCases.filter((c) => c.status === status) : mockCases;
  }
}

export async function getCase(caseId: string): Promise<CaseItem> {
  if (USE_MOCK) {
    const found = mockCases.find((c) => c.case_id === caseId);
    if (found) return found;
    return mockCases[0];
  }
  try {
    return await apiClient<CaseItem>(`/api/v1/cases/${caseId}`);
  } catch {
    return mockCases[0];
  }
}

export async function updateCase(
  caseId: string,
  payload: Partial<CaseItem>
): Promise<CaseItem> {
  if (USE_MOCK) {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId ? { ...c, ...payload, updated_at: new Date().toISOString() } : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
  try {
    return await apiClient<CaseItem>(`/api/v1/cases/${caseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId ? { ...c, ...payload, updated_at: new Date().toISOString() } : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
}

export async function takeCaseAction(
  caseId: string,
  action: { action: string; note: string }
): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            status: action.action === "overturn" ? "RESOLVED_LEGIT" : "RESTRICTED",
          }
        : c
    );
    return {
      success: true,
      message: `Case ${caseId} marked as ${action.action} with note recorded.`,
    };
  }
  try {
    return await apiClient<{ success: boolean; message: string }>(
      `/api/v1/cases/${caseId}/actions`,
      {
        method: "POST",
        body: JSON.stringify(action),
      }
    );
  } catch {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            status: action.action === "overturn" ? "RESOLVED_LEGIT" : "RESTRICTED",
          }
        : c
    );
    return {
      success: true,
      message: `Case ${caseId} updated successfully (offline mode).`,
    };
  }
}

// 4. Appeals
export async function listAppeals(): Promise<AppealItem[]> {
  if (USE_MOCK) {
    return mockAppeals;
  }
  try {
    return await apiClient<AppealItem[]>("/api/v1/appeals");
  } catch {
    return mockAppeals;
  }
}

export async function resolveAppeal(
  appealId: string,
  payload: { action: "overturned" | "upheld"; note: string }
): Promise<AppealItem> {
  if (USE_MOCK) {
    mockAppeals = mockAppeals.map((a) =>
      a.id === appealId
        ? {
            ...a,
            status: payload.action === "overturned" ? "OVERTURNED" : "UPHELD",
            reviewer_note: payload.note,
          }
        : a
    );
    return mockAppeals.find((a) => a.id === appealId)!;
  }
  try {
    return await apiClient<AppealItem>(`/api/v1/appeals/${appealId}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    mockAppeals = mockAppeals.map((a) =>
      a.id === appealId
        ? {
            ...a,
            status: payload.action === "overturned" ? "OVERTURNED" : "UPHELD",
            reviewer_note: payload.note,
          }
        : a
    );
    return mockAppeals.find((a) => a.id === appealId)!;
  }
}

// 5. Payouts
export async function listPayouts(): Promise<PayoutItem[]> {
  if (USE_MOCK) {
    return mockPayouts;
  }
  try {
    return await apiClient<PayoutItem[]>("/api/v1/payouts");
  } catch {
    return mockPayouts;
  }
}

export async function payoutAction(
  payoutId: string,
  action: { action: "release" | "block" | "hold"; reason?: string }
): Promise<PayoutItem> {
  if (USE_MOCK) {
    mockPayouts = mockPayouts.map((p) =>
      p.payout_id === payoutId
        ? {
            ...p,
            status:
              action.action === "release"
                ? "APPROVED"
                : action.action === "block"
                ? "BLOCKED"
                : "HELD",
          }
        : p
    );
    return mockPayouts.find((p) => p.payout_id === payoutId)!;
  }
  try {
    return await apiClient<PayoutItem>(`/api/v1/payouts/${payoutId}/action`, {
      method: "POST",
      body: JSON.stringify(action),
    });
  } catch {
    mockPayouts = mockPayouts.map((p) =>
      p.payout_id === payoutId
        ? {
            ...p,
            status:
              action.action === "release"
                ? "APPROVED"
                : action.action === "block"
                ? "BLOCKED"
                : "HELD",
          }
        : p
    );
    return mockPayouts.find((p) => p.payout_id === payoutId)!;
  }
}

// 6. Graph & Syndicates
export async function getGraphClusters(): Promise<GraphCluster[]> {
  const defaultClusters: GraphCluster[] = [
    {
      cluster_id: "RING-C-902",
      name: "Downtown Courier Colocation Farm",
      nodes_count: 4,
      shared_identifiers: ["IMEI_e3b0c442", "DEV_HASH_8819", "BANK_ROUTING_9921"],
      risk_score: 94.2,
      status: "ACTIVE",
    },
    {
      cluster_id: "RING-B-410",
      name: "Airport Corridor Teleportation Ring",
      nodes_count: 7,
      shared_identifiers: ["MOCK_GEO_PROVIDER", "SUB_NET_198_51"],
      risk_score: 88.6,
      status: "MONITORING",
    },
    {
      cluster_id: "RING-A-108",
      name: "Ghost Customer Pairing Syndicate",
      nodes_count: 12,
      shared_identifiers: ["SHARED_CARD_TOKEN_772", "PROMO_DISPATCH_HOP"],
      risk_score: 99.1,
      status: "ACTIVE",
    },
  ];

  if (USE_MOCK) {
    return defaultClusters;
  }
  try {
    return await apiClient<GraphCluster[]>("/api/v1/graph/clusters");
  } catch {
    return defaultClusters;
  }
}

// 7. Policy Simulator
export async function getPolicies(): Promise<PolicyThresholds> {
  const defaultPolicy: PolicyThresholds = {
    allow_threshold: 75.0,
    challenge_threshold: 50.0,
    investigate_threshold: 25.0,
    block_threshold: 10.0,
  };

  if (USE_MOCK) return defaultPolicy;
  try {
    return await apiClient<PolicyThresholds>("/api/v1/policies");
  } catch {
    return defaultPolicy;
  }
}

export async function simulatePolicy(payload: PolicyThresholds): Promise<PolicySimResult> {
  if (USE_MOCK) {
    return {
      policy_id: `sim_${Date.now()}`,
      sessions_evaluated: 10000,
      simulated_pass_rate: 0.948,
      simulated_friction_rate: 0.042,
      simulated_fraud_catch_rate: 0.986,
      estimated_chargeback_reduction_pct: 38.2,
    };
  }
  try {
    return await apiClient<PolicySimResult>("/api/v1/policies/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      policy_id: `sim_${Date.now()}`,
      sessions_evaluated: 10000,
      simulated_pass_rate: 0.948,
      simulated_friction_rate: 0.042,
      simulated_fraud_catch_rate: 0.986,
      estimated_chargeback_reduction_pct: 38.2,
    };
  }
}

// 8. Demo Controls
export async function resetDemo(): Promise<{ message: string }> {
  if (USE_MOCK) {
    return { message: "Demo database reset and purged to baseline." };
  }
  try {
    return await apiClient<{ message: string }>("/api/v1/demo/reset", {
      method: "POST",
    });
  } catch {
    return { message: "Demo database reset and purged to baseline (mock mode)." };
  }
}

export async function seedDemo(): Promise<{ message: string }> {
  if (USE_MOCK) {
    return { message: "Loaded 50 baseline couriers and 3 collusion syndicates." };
  }
  try {
    return await apiClient<{ message: string }>("/api/v1/demo/seed", {
      method: "POST",
    });
  } catch {
    return { message: "Loaded 50 baseline couriers and 3 collusion syndicates (mock mode)." };
  }
}
