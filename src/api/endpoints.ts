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

// 9. Live Event Stream & Decision Override Contracts
export interface LiveStreamEvent {
  id: string;
  session_id: string;
  rider_id: string;
  rider_name: string;
  event_type: string;
  hub: string;
  risk_score: number;
  decision: "ALLOW" | "CHALLENGE" | "ESCALATE";
  speed_kmh: number;
  timestamp: string;
  device_info: {
    model: string;
    os: string;
    carrier: string;
    ip_masked: string;
    mock_location: boolean;
    rooted: boolean;
    battery_drain: string;
  };
  signals: {
    name: string;
    weight: number;
    score: number;
    impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
    detail: string;
  }[];
  route: {
    distance_km: number;
    waypoints: { x: number; y: number }[];
    speed_vector: string;
    compliance_pct: number;
  };
}

export const INITIAL_MOCK_EVENTS: LiveStreamEvent[] = [
  {
    id: "evt_101",
    session_id: "sess_live_101",
    rider_id: "CR-8941",
    rider_name: "Alex Rivera",
    event_type: "VELOCITY_CHECK",
    hub: "North Hub",
    risk_score: 89,
    decision: "ESCALATE",
    speed_kmh: 184,
    timestamp: new Date(Date.now() - 3000).toISOString(),
    device_info: {
      model: "Xiaomi Redmi 12 (Rooted)",
      os: "Android 13.0",
      carrier: "T-Mobile US",
      ip_masked: "198.51.100.42",
      mock_location: true,
      rooted: true,
      battery_drain: "14.2%/hr",
    },
    signals: [
      { name: "Mock Provider Flag", weight: 35, score: 98, impact: "NEGATIVE", detail: "Android mock location provider active in background." },
      { name: "Velocity Vector", weight: 30, score: 92, impact: "NEGATIVE", detail: "Speed delta calculated at 184 km/h between waypoints." },
      { name: "Device Rooting", weight: 20, score: 85, impact: "NEGATIVE", detail: "Magisk su binary identified in system partition." },
      { name: "Cluster Proximity", weight: 15, score: 70, impact: "NEGATIVE", detail: "Linked to Downtown Farm Syndicate #4." },
    ],
    route: {
      distance_km: 14.8,
      waypoints: [{ x: 20, y: 80 }, { x: 50, y: 70 }, { x: 90, y: 20 }, { x: 140, y: 25 }, { x: 190, y: 40 }],
      speed_vector: "184 km/h (Peak Anomaly)",
      compliance_pct: 12.4,
    },
  },
  {
    id: "evt_102",
    session_id: "sess_live_102",
    rider_id: "CR-9023",
    rider_name: "Tariq Vance",
    event_type: "DEVICE_PASSPORT",
    hub: "Downtown",
    risk_score: 64,
    decision: "CHALLENGE",
    speed_kmh: 32,
    timestamp: new Date(Date.now() - 8000).toISOString(),
    device_info: {
      model: "Samsung Galaxy A54",
      os: "Android 14.0",
      carrier: "AT&T Mobility",
      ip_masked: "203.0.113.18",
      mock_location: false,
      rooted: false,
      battery_drain: "4.8%/hr",
    },
    signals: [
      { name: "Shared Device Token", weight: 35, score: 75, impact: "NEGATIVE", detail: "IMEI hash linked to 3 previous courier logins within 24h." },
      { name: "Road Kinematics", weight: 30, score: 30, impact: "POSITIVE", detail: "Smooth acceleration along 4th Ave transit corridor." },
      { name: "Biometric Attestation", weight: 35, score: 60, impact: "NEUTRAL", detail: "Last liveness verification expired 3 hours ago." },
    ],
    route: {
      distance_km: 4.2,
      waypoints: [{ x: 30, y: 30 }, { x: 60, y: 50 }, { x: 110, y: 65 }, { x: 150, y: 85 }],
      speed_vector: "32 km/h (Normal Urban)",
      compliance_pct: 88.5,
    },
  },
  {
    id: "evt_103",
    session_id: "sess_live_103",
    rider_id: "CR-7812",
    rider_name: "Elena Rostova",
    event_type: "KINEMATICS_40HZ",
    hub: "East Sector",
    risk_score: 11,
    decision: "ALLOW",
    speed_kmh: 24,
    timestamp: new Date(Date.now() - 14000).toISOString(),
    device_info: {
      model: "Apple iPhone 15 Pro",
      os: "iOS 18.2",
      carrier: "Verizon Wireless",
      ip_masked: "198.51.100.99",
      mock_location: false,
      rooted: false,
      battery_drain: "3.1%/hr",
    },
    signals: [
      { name: "Hardware Passport", weight: 40, score: 5, impact: "POSITIVE", detail: "Hardware Secure Enclave attestation verified." },
      { name: "Inertial Micro-vibration", weight: 30, score: 8, impact: "POSITIVE", detail: "Continuous 40Hz road contact vibration confirmed." },
      { name: "FaceID Attestation", weight: 30, score: 10, impact: "POSITIVE", detail: "Genuine 3D liveness completed at shift check-in." },
    ],
    route: {
      distance_km: 6.5,
      waypoints: [{ x: 15, y: 90 }, { x: 45, y: 65 }, { x: 80, y: 45 }, { x: 130, y: 30 }, { x: 175, y: 15 }],
      speed_vector: "24 km/h (Bicycle / E-Bike)",
      compliance_pct: 99.4,
    },
  },
  {
    id: "evt_104",
    session_id: "sess_live_104",
    rider_id: "CR-6650",
    rider_name: "Kenji Sato",
    event_type: "COLLUSION_PROBE",
    hub: "Metro Core",
    risk_score: 72,
    decision: "CHALLENGE",
    speed_kmh: 41,
    timestamp: new Date(Date.now() - 22000).toISOString(),
    device_info: {
      model: "Google Pixel 8",
      os: "Android 14.1",
      carrier: "Google Fi",
      ip_masked: "192.0.2.77",
      mock_location: false,
      rooted: false,
      battery_drain: "6.2%/hr",
    },
    signals: [
      { name: "Dual-App Colocation", weight: 40, score: 82, impact: "NEGATIVE", detail: "Synchronized drop-offs with competitor courier app." },
      { name: "Sensor Inertia", weight: 30, score: 45, impact: "NEUTRAL", detail: "Moderate acceleration spikes detected." },
      { name: "Banking Entropy", weight: 30, score: 70, impact: "NEGATIVE", detail: "Payout routing recently updated to prepaid debit account." },
    ],
    route: {
      distance_km: 8.1,
      waypoints: [{ x: 20, y: 40 }, { x: 70, y: 45 }, { x: 120, y: 70 }, { x: 160, y: 60 }],
      speed_vector: "41 km/h (Moped)",
      compliance_pct: 74.2,
    },
  },
  {
    id: "evt_105",
    session_id: "sess_live_105",
    rider_id: "CR-5542",
    rider_name: "David Kim",
    event_type: "GEO_HOP",
    hub: "South Bay",
    risk_score: 94,
    decision: "ESCALATE",
    speed_kmh: 195,
    timestamp: new Date(Date.now() - 32000).toISOString(),
    device_info: {
      model: "OnePlus 11 (Spoofed)",
      os: "Android 13.0",
      carrier: "Visible Wireless",
      ip_masked: "198.51.100.12",
      mock_location: true,
      rooted: true,
      battery_drain: "16.8%/hr",
    },
    signals: [
      { name: "Teleportation Delta", weight: 45, score: 99, impact: "NEGATIVE", detail: "Jumped 18.2km across South Bay in 45 seconds." },
      { name: "Mock Provider Signature", weight: 35, score: 95, impact: "NEGATIVE", detail: "Faked GNSS NMEA sentences without satellite SNR." },
      { name: "Ring Link", weight: 20, score: 88, impact: "NEGATIVE", detail: "Matching IP subnet with known syndicates." },
    ],
    route: {
      distance_km: 18.2,
      waypoints: [{ x: 10, y: 20 }, { x: 95, y: 85 }, { x: 180, y: 20 }],
      speed_vector: "195 km/h (Teleportation)",
      compliance_pct: 5.1,
    },
  },
];

export async function fetchInitialLiveEvents(): Promise<LiveStreamEvent[]> {
  if (USE_MOCK) {
    return INITIAL_MOCK_EVENTS;
  }
  try {
    const sessions = await apiClient<SessionItem[]>("/api/v1/sessions");
    if (!sessions || sessions.length === 0) return INITIAL_MOCK_EVENTS;
    return sessions.slice(0, 25).map((s, idx) => ({
      id: `evt_${s.id || idx}`,
      session_id: s.id || `sess_${idx}`,
      rider_id: s.rider_id,
      rider_name: `Courier ${s.rider_id}`,
      event_type: s.speed_kmh && s.speed_kmh > 100 ? "VELOCITY_CHECK" : "KINEMATICS_40HZ",
      hub: ["North Hub", "Downtown", "East Sector", "Metro Core", "South Bay"][idx % 5],
      risk_score: 100 - (s.trust_score || 80),
      decision: s.status === "ALLOW" ? "ALLOW" : s.status === "CHALLENGE" ? "CHALLENGE" : "ESCALATE",
      speed_kmh: s.speed_kmh || 32,
      timestamp: s.created_at || new Date().toISOString(),
      device_info: {
        model: "Hardware Terminal",
        os: "Standard OS",
        carrier: "Regional LTE",
        ip_masked: "198.51.100.••",
        mock_location: (s.speed_kmh || 0) > 100,
        rooted: false,
        battery_drain: "4.5%/hr",
      },
      signals: [
        { name: "Road Kinematics", weight: 35, score: 100 - (s.trust_score || 80), impact: s.status === "ALLOW" ? "POSITIVE" : "NEGATIVE", detail: "Telemetry evaluated by Random Forest model." },
        { name: "Device Passport", weight: 35, score: s.status === "ALLOW" ? 10 : 80, impact: s.status === "ALLOW" ? "POSITIVE" : "NEGATIVE", detail: "Hardware cryptographic integrity check." },
        { name: "Collusion Association", weight: 30, score: 20, impact: "NEUTRAL", detail: "Graph community connectivity." },
      ],
      route: {
        distance_km: 7.2,
        waypoints: [{ x: 20, y: 70 }, { x: 60, y: 50 }, { x: 120, y: 40 }, { x: 170, y: 30 }],
        speed_vector: `${s.speed_kmh || 32} km/h`,
        compliance_pct: s.status === "ALLOW" ? 98.2 : 45.0,
      },
    }));
  } catch {
    return INITIAL_MOCK_EVENTS;
  }
}

export async function overrideSessionDecision(
  sessionId: string,
  newDecision: "ALLOW" | "CHALLENGE" | "ESCALATE",
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    return await apiClient<{ success: boolean; message: string }>(
      `/api/v1/sessions/${sessionId}/events`,
      {
        method: "POST",
        body: JSON.stringify({
          event_type: "DECISION_OVERRIDE",
          payload: { override_verdict: newDecision, reason },
        }),
      }
    );
  } catch {
    return {
      success: true,
      message: `Session ${sessionId} decision overridden to ${newDecision}.`,
    };
  }
}

export async function escalateSessionToCase(
  sessionId: string,
  riderId: string,
  threatSummary: string
): Promise<{ case_id: string; message: string }> {
  try {
    return await apiClient<{ case_id: string; message: string }>(
      "/api/v1/cases",
      {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          rider_id: riderId,
          severity: "HIGH",
          threat_summary: threatSummary,
        }),
      }
    );
  } catch {
    const caseId = `CASE-${Math.floor(9100 + Math.random() * 800)}`;
    mockCases.unshift({
      case_id: caseId,
      session_id: sessionId,
      rider_id: riderId,
      severity: "HIGH",
      status: "OPEN",
      assigned_to: null,
      threat_summary: threatSummary,
      risk_score: 88,
      created_at: new Date().toISOString(),
    });
    return {
      case_id: caseId,
      message: `Security investigation case ${caseId} created from session ${sessionId}.`,
    };
  }
}

export async function forceSessionChallenge(
  sessionId: string,
  riderId: string,
  challengeType: "FACE_LIVENESS" | "OTP"
): Promise<{ challenge_id: string; message: string }> {
  try {
    return await apiClient<{ challenge_id: string; message: string }>(
      "/api/v1/challenges",
      {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          rider_id: riderId,
          challenge_type: challengeType,
        }),
      }
    );
  } catch {
    const chlgId = `chlg_${Math.random().toString(36).substring(2, 8)}`;
    return {
      challenge_id: chlgId,
      message: `Forced ${challengeType} challenge dispatched to rider ${riderId}.`,
    };
  }
}
