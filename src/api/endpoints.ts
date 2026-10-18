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

export type CaseStatus = "OPEN" | "IN_REVIEW" | "ESCALATED" | "CLOSED" | "RESOLVED_LEGIT" | "RESTRICTED";

export interface CaseSignalEvidence {
  name: string;
  score: number;
  weight: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export interface CaseLinkedRider {
  rider_id: string;
  name: string;
  relationship: string;
  risk: number;
}

export interface CaseLinkedDevice {
  device_id: string;
  model: string;
  imei: string;
  os: string;
  root: boolean;
}

export interface CaseTimelineItem {
  id: string;
  timestamp: string;
  event: string;
  type: "alert" | "challenge" | "action" | "system";
  actor?: string;
}

export interface CaseNote {
  id: string;
  author: string;
  role: string;
  timestamp: string;
  content: string;
}

export interface CaseItem {
  case_id: string;
  session_id: string;
  rider_id: string;
  rider_name?: string;
  hub?: string;
  title?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: CaseStatus;
  outcome?: "fraud_confirmed" | "false_positive";
  assigned_to: string | null;
  threat_summary: string;
  risk_score: number;
  created_at: string;
  updated_at?: string;
  payout_held?: number;
  payout_frozen?: boolean;
  liveness_status?: "NOT_REQUESTED" | "PENDING" | "PASSED" | "FAILED";
  signals?: CaseSignalEvidence[];
  linked_riders?: CaseLinkedRider[];
  linked_devices?: CaseLinkedDevice[];
  timeline?: CaseTimelineItem[];
  notes?: CaseNote[];
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
    hub: "Downtown",
    title: "GPS Mock Provider Delta: 184 km/h jump",
    severity: "HIGH",
    status: "OPEN",
    assigned_to: "marcus_vance",
    threat_summary: "GPS Mock Provider Delta: 184 km/h jump during active delivery along 4th Ave.",
    risk_score: 89,
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    payout_held: 1240.0,
    payout_frozen: true,
    liveness_status: "FAILED",
    signals: [
      { name: "Mock Provider Flag", score: 98, weight: 0.35, severity: "HIGH", description: "Android LocationManager.isFromMockProvider returned TRUE during dropoff." },
      { name: "Kinematic Impossibility", score: 92, weight: 0.30, severity: "HIGH", description: "Calculated traversal velocity 184.2 km/h across 800m grid." },
      { name: "Accelerometer Divergence", score: 81, weight: 0.20, severity: "MEDIUM", description: "Zero vehicular vibration detected while coordinates shifted 1.4km." },
      { name: "Root & Hooking Integrity", score: 76, weight: 0.15, severity: "MEDIUM", description: "Substrate hooking framework detected in system runtime." },
    ],
    linked_riders: [
      { rider_id: "CR-9023", name: "Tariq Vance", relationship: "Shared hardware token IMEI-e3b0", risk: 84 },
      { rider_id: "CR-5542", name: "David Kim", relationship: "Linked Chase Checking •••• 9921", risk: 94 },
    ],
    linked_devices: [
      { device_id: "DEV-IMEI-e3b0", model: "Xiaomi Redmi 12 (Rooted)", imei: "864192040182941", os: "Android 13 (Magisk)", root: true },
    ],
    timeline: [
      { id: "tl-1", timestamp: "18m ago", event: "Sensor stream flagged abnormal kinematic acceleration (184 km/h)", type: "alert" },
      { id: "tl-2", timestamp: "17m ago", event: "Automated Challenge dispatched: Active 3D Face Liveness required", type: "challenge" },
      { id: "tl-3", timestamp: "12m ago", event: "Challenge failed: Courier aborted camera verification within 300s window", type: "challenge" },
      { id: "tl-4", timestamp: "10m ago", event: "Auto-hold triggered: Payout $1,240.00 frozen in risk escrow", type: "action" },
      { id: "tl-5", timestamp: "8m ago", event: "Case auto-generated and assigned to Marcus Vance (Lead Analyst)", type: "system", actor: "Risk Engine" },
    ],
    notes: [
      { id: "n-1", author: "Marcus Vance", role: "Lead Analyst", timestamp: "6m ago", content: "Reviewing telemetry logs. Courier appears to be using a location spoofing joystick app while parked at 2nd & Pike." },
    ],
  },
  {
    case_id: "CASE-9005",
    session_id: "sess_ring_9005",
    rider_id: "CR-9023",
    rider_name: "Tariq Vance",
    hub: "Downtown",
    title: "Collusion Cluster #C-902: 4 riders on single IMEI",
    severity: "CRITICAL",
    status: "IN_REVIEW",
    assigned_to: "elena_rostova",
    threat_summary: "Collusion Cluster #C-902: 4 couriers linked to single IMEI hardware key and common bank route.",
    risk_score: 94,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    payout_held: 840.5,
    payout_frozen: true,
    liveness_status: "PENDING",
    signals: [
      { name: "Hardware Key Collision", score: 99, weight: 0.40, severity: "HIGH", description: "Cryptographic hardware attestation collision with 3 active fleet accounts." },
      { name: "Simultaneous Session Auth", score: 95, weight: 0.30, severity: "HIGH", description: "3 distinct courier orders checked in within 90 seconds from 1 IP." },
      { name: "Bank Route Overlap", score: 88, weight: 0.30, severity: "HIGH", description: "JPMorgan Chase routing •••• 9921 shared across accounts." },
    ],
    linked_riders: [
      { rider_id: "CR-8941", name: "Alex Rivera", relationship: "Syndicate member #C-902", risk: 89 },
      { rider_id: "CR-5542", name: "David Kim", relationship: "Shared payout escrow account", risk: 94 },
    ],
    linked_devices: [
      { device_id: "DEV-IMEI-e3b0", model: "Xiaomi Redmi 12 (Rooted)", imei: "864192040182941", os: "Android 13 (Magisk)", root: true },
    ],
    timeline: [
      { id: "tl-1", timestamp: "45m ago", event: "Graph engine detected cluster #C-902 threshold breach (density 0.94)", type: "alert" },
      { id: "tl-2", timestamp: "35m ago", event: "Payout held: $840.50 marked under Syndicate Review", type: "action" },
      { id: "tl-3", timestamp: "20m ago", event: "Analyst Elena Rostova claimed case for device farm investigation", type: "system", actor: "Elena Rostova" },
    ],
    notes: [
      { id: "n-1", author: "Elena Rostova", role: "Fraud Analyst", timestamp: "15m ago", content: "Subpoenaed carrier logs confirm single base transceiver station cell for all 3 devices simultaneously." },
    ],
  },
  {
    case_id: "CASE-9007",
    session_id: "sess_hash_9007",
    rider_id: "CR-3319",
    rider_name: "Carlos Mendez",
    hub: "North Hub",
    title: "Device Fingerprint Hash Collision across 3 shifts",
    severity: "HIGH",
    status: "OPEN",
    assigned_to: null,
    threat_summary: "Device Fingerprint Hash Collision across 3 shifts on alternating morning routes.",
    risk_score: 82,
    created_at: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    payout_held: 390.0,
    payout_frozen: false,
    liveness_status: "NOT_REQUESTED",
    signals: [
      { name: "Canvas/WebGL Fingerprint", score: 89, weight: 0.40, severity: "HIGH", description: "100% hash equivalence with banned account CR-1092." },
      { name: "SIM IMSI Churn", score: 79, weight: 0.35, severity: "MEDIUM", description: "3 different prepaid SIM cards inserted over 48 hours." },
    ],
    linked_riders: [
      { rider_id: "CR-1092", name: "Marcus Brody (Banned)", relationship: "Prior account device holder", risk: 96 },
    ],
    linked_devices: [
      { device_id: "DEV-MOTO-91", model: "Motorola Moto G Power", imei: "359182049102918", os: "Android 12", root: false },
    ],
    timeline: [
      { id: "tl-1", timestamp: "1h ago", event: "Canvas hash match triggered high-risk alert", type: "alert" },
    ],
    notes: [],
  },
  {
    case_id: "CASE-9008",
    session_id: "sess_hop_9008",
    rider_id: "CR-7104",
    rider_name: "Siddharth Nair",
    hub: "Airport Corridor",
    title: "Velocity Hop & Spatio-temporal Teleportation",
    severity: "MEDIUM",
    status: "IN_REVIEW",
    assigned_to: "marcus_vance",
    threat_summary: "Instantaneous 12km position jump between Airport Cargo Terminal and West Seattle.",
    risk_score: 74,
    created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    payout_held: 512.0,
    payout_frozen: true,
    liveness_status: "PENDING",
    signals: [
      { name: "Cell Tower vs GPS Drift", score: 84, weight: 0.50, severity: "HIGH", description: "Cell tower triangulation indicates South Seattle while GPS reports West Seattle." },
      { name: "Order Acceptance Speed", score: 72, weight: 0.50, severity: "MEDIUM", description: "Batch accepted within 220ms of broadcast." },
    ],
    linked_riders: [],
    linked_devices: [
      { device_id: "DEV-PIXEL-7A", model: "Google Pixel 7a", imei: "354091829012391", os: "Android 14", root: false },
    ],
    timeline: [
      { id: "tl-1", timestamp: "2h ago", event: "Position teleportation spike detected", type: "alert" },
      { id: "tl-2", timestamp: "1h ago", event: "Payout held: $512.00 subject to route audit", type: "action" },
    ],
    notes: [
      { id: "n-1", author: "Marcus Vance", role: "Lead Analyst", timestamp: "40m ago", content: "Evaluating airport tunnel signal blackout vs intentional GPS coordinate inject." },
    ],
  },
  {
    case_id: "CASE-9009",
    session_id: "sess_escrow_9009",
    rider_id: "CR-5542",
    rider_name: "David Kim",
    hub: "South Bay",
    title: "Multi-courier Chase Escrow Syndicate Node",
    severity: "CRITICAL",
    status: "ESCALATED",
    assigned_to: "elena_rostova",
    threat_summary: "Multi-courier Chase Escrow Syndicate Node: beneficiary routing linked to 6 active fraud cases.",
    risk_score: 97,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    payout_held: 3420.0,
    payout_frozen: true,
    liveness_status: "FAILED",
    signals: [
      { name: "Syndicate Money Mule Vector", score: 99, weight: 0.50, severity: "HIGH", description: "Bank account linked to $14,200 in aggregate dispute flags." },
      { name: "Biometric Injection Attempt", score: 96, weight: 0.50, severity: "HIGH", description: "Virtual camera driver intercepted during liveness challenge." },
    ],
    linked_riders: [
      { rider_id: "CR-8941", name: "Alex Rivera", relationship: "Shared payout account", risk: 89 },
      { rider_id: "CR-9023", name: "Tariq Vance", relationship: "Shared payout account", risk: 94 },
    ],
    linked_devices: [
      { device_id: "DEV-ONEPLUS-11", model: "OnePlus 11", imei: "869102930192841", os: "OxygenOS 14 (Rooted)", root: true },
    ],
    timeline: [
      { id: "tl-1", timestamp: "3h ago", event: "Escalated by Chief Auditor to Legal & Compliance", type: "system" },
      { id: "tl-2", timestamp: "2h ago", event: "Freeze placed on total fleet balance ($3,420.00)", type: "action" },
    ],
    notes: [
      { id: "n-1", author: "Elena Rostova", role: "Fraud Analyst", timestamp: "1h ago", content: "Coordinating with banking compliance partner regarding shared Chase account." },
    ],
  },
  {
    case_id: "CASE-9010",
    session_id: "sess_colo_9010",
    rider_id: "CR-6650",
    rider_name: "Kenji Sato",
    hub: "Metro Core",
    title: "Dual-App Colocation Probe along Highway 99",
    severity: "HIGH",
    status: "ESCALATED",
    assigned_to: "marcus_vance",
    threat_summary: "Dual-App Colocation Probe: Two riders moving synchronously within 2 meters for 45 minutes.",
    risk_score: 86,
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    payout_held: 710.0,
    payout_frozen: true,
    liveness_status: "PENDING",
    signals: [
      { name: "Trajectory Overlap 98.4%", score: 94, weight: 0.60, severity: "HIGH", description: "Identical speed, heading, and stop duration with CR-4402." },
      { name: "Ghost Rider Indicator", score: 81, weight: 0.40, severity: "MEDIUM", description: "One physical vehicle carrying two dispatch phones." },
    ],
    linked_riders: [
      { rider_id: "CR-4402", name: "Aria Thorne", relationship: "Co-located delivery partner", risk: 68 },
    ],
    linked_devices: [
      { device_id: "DEV-PIXEL-8", model: "Google Pixel 8", imei: "354182049102941", os: "Android 14", root: false },
    ],
    timeline: [
      { id: "tl-1", timestamp: "4h ago", event: "Colocation engine flagged tandem trajectory", type: "alert" },
      { id: "tl-2", timestamp: "3h ago", event: "Case escalated to Senior Analyst Queue", type: "system" },
    ],
    notes: [],
  },
  {
    case_id: "CASE-9006",
    session_id: "sess_legit_9006",
    rider_id: "CR-7812",
    rider_name: "Elena Rostova",
    hub: "East Sector",
    title: "Routine route drift cleared by 3D liveness attestation",
    severity: "LOW",
    status: "CLOSED",
    outcome: "false_positive",
    assigned_to: "marcus_vance",
    threat_summary: "Routine route drift cleared by 3D liveness biometric attestation. Genuine traffic detour.",
    risk_score: 11,
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    payout_held: 0.0,
    payout_frozen: false,
    liveness_status: "PASSED",
    signals: [
      { name: "3D Liveness Attestation", score: 3, weight: 0.70, severity: "LOW", description: "Passed biometric face challenge with 99.8% confidence." },
      { name: "Secure Enclave Hardware", score: 5, weight: 0.30, severity: "LOW", description: "Apple Secure Enclave hardware key validated." },
    ],
    linked_riders: [],
    linked_devices: [
      { device_id: "DEV-IPHONE-15", model: "Apple iPhone 15 Pro", imei: "354910284910291", os: "iOS 18.2", root: false },
    ],
    timeline: [
      { id: "tl-1", timestamp: "6h ago", event: "Route drift flagged during road construction detour", type: "alert" },
      { id: "tl-2", timestamp: "5h ago", event: "Biometric challenge completed successfully by courier", type: "challenge" },
      { id: "tl-3", timestamp: "4h ago", event: "Case closed as False Positive (Legitimate Courier)", type: "action", actor: "Marcus Vance" },
    ],
    notes: [
      { id: "n-1", author: "Marcus Vance", role: "Lead Analyst", timestamp: "4h ago", content: "Detour was due to Alaskan Way Viaduct construction. Liveness check passed effortlessly. Hold released." },
    ],
  },
  {
    case_id: "CASE-9002",
    session_id: "sess_root_9002",
    rider_id: "CR-1904",
    rider_name: "Vikram Patel",
    hub: "South Bay",
    title: "Magisk Root Device Farm & GPS Joystick Emulation",
    severity: "CRITICAL",
    status: "CLOSED",
    outcome: "fraud_confirmed",
    assigned_to: "elena_rostova",
    threat_summary: "Confirmed GPS joystick emulation and fake order farming. Permanent account restriction.",
    risk_score: 98,
    created_at: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    payout_held: 2150.0,
    payout_frozen: true,
    liveness_status: "FAILED",
    signals: [
      { name: "Root Exploit Intercept", score: 99, weight: 0.50, severity: "HIGH", description: "Kernel-level Magisk bypass detected." },
      { name: "Synthetic Order Generation", score: 98, weight: 0.50, severity: "HIGH", description: "12 consecutive deliveries accepted with zero physical transit." },
    ],
    linked_riders: [],
    linked_devices: [
      { device_id: "DEV-ROOT-XIAOMI", model: "Xiaomi Poco F4", imei: "869102938192019", os: "Android 13", root: true },
    ],
    timeline: [
      { id: "tl-1", timestamp: "12h ago", event: "System identified synthetic order acceptance pattern", type: "alert" },
      { id: "tl-2", timestamp: "10h ago", event: "Fraud confirmed: Account permanently suspended and payout forfeited", type: "action", actor: "Elena Rostova" },
    ],
    notes: [
      { id: "n-1", author: "Elena Rostova", role: "Fraud Analyst", timestamp: "10h ago", content: "Vendor confirmed merchant orders were generated by automated script. Permanent ban enforced." },
    ],
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

export async function addCaseNote(
  caseId: string,
  noteContent: string,
  author: string = "Analyst",
  role: string = "Fraud Analyst"
): Promise<CaseItem> {
  const newNote: CaseNote = {
    id: `note-${Date.now()}`,
    author,
    role,
    timestamp: "Just now",
    content: noteContent,
  };
  const newTimelineItem: CaseTimelineItem = {
    id: `tl-${Date.now()}`,
    timestamp: "Just now",
    event: `Note added by ${author}: "${noteContent.slice(0, 40)}..."`,
    type: "action",
    actor: author,
  };

  if (USE_MOCK) {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            notes: [...(c.notes || []), newNote],
            timeline: [newTimelineItem, ...(c.timeline || [])],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
  try {
    return await apiClient<CaseItem>(`/api/v1/cases/${caseId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content: noteContent, author, role }),
    });
  } catch {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            notes: [...(c.notes || []), newNote],
            timeline: [newTimelineItem, ...(c.timeline || [])],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
}

export async function freezeCasePayout(
  caseId: string,
  freeze: boolean
): Promise<CaseItem> {
  const newTimelineItem: CaseTimelineItem = {
    id: `tl-${Date.now()}`,
    timestamp: "Just now",
    event: freeze ? "Payout frozen into risk hold escrow" : "Payout hold released to courier wallet",
    type: "action",
  };

  if (USE_MOCK) {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            payout_frozen: freeze,
            timeline: [newTimelineItem, ...(c.timeline || [])],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
  try {
    return await apiClient<CaseItem>(`/api/v1/cases/${caseId}/freeze`, {
      method: "POST",
      body: JSON.stringify({ frozen: freeze }),
    });
  } catch {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            payout_frozen: freeze,
            timeline: [newTimelineItem, ...(c.timeline || [])],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
}

export async function requestCaseLiveness(caseId: string): Promise<CaseItem> {
  const newTimelineItem: CaseTimelineItem = {
    id: `tl-${Date.now()}`,
    timestamp: "Just now",
    event: "Live 3D Biometric Liveness challenge dispatched to rider app",
    type: "challenge",
  };

  if (USE_MOCK) {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            liveness_status: "PENDING",
            timeline: [newTimelineItem, ...(c.timeline || [])],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
  try {
    return await apiClient<CaseItem>(`/api/v1/cases/${caseId}/liveness`, {
      method: "POST",
    });
  } catch {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            liveness_status: "PENDING",
            timeline: [newTimelineItem, ...(c.timeline || [])],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
}

export async function closeCaseWithOutcome(
  caseId: string,
  outcome: "fraud_confirmed" | "false_positive",
  note: string,
  author: string = "Analyst"
): Promise<CaseItem> {
  const status: CaseStatus = outcome === "fraud_confirmed" ? "RESTRICTED" : "RESOLVED_LEGIT";
  const newTimelineItem: CaseTimelineItem = {
    id: `tl-${Date.now()}`,
    timestamp: "Just now",
    event:
      outcome === "fraud_confirmed"
        ? `Case closed: Fraud Confirmed by ${author}. Courier restricted.`
        : `Case closed: False Positive by ${author}. Payout cleared.`,
    type: "action",
    actor: author,
  };
  const newNote: CaseNote = {
    id: `note-${Date.now()}`,
    author,
    role: "Adjudicator",
    timestamp: "Just now",
    content: `Outcome: ${outcome === "fraud_confirmed" ? "Fraud Confirmed" : "False Positive"}. ${note}`,
  };

  if (USE_MOCK) {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            status: "CLOSED",
            outcome,
            payout_frozen: outcome === "fraud_confirmed",
            timeline: [newTimelineItem, ...(c.timeline || [])],
            notes: [...(c.notes || []), newNote],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
  }
  try {
    return await apiClient<CaseItem>(`/api/v1/cases/${caseId}/close`, {
      method: "POST",
      body: JSON.stringify({ outcome, note, status }),
    });
  } catch {
    mockCases = mockCases.map((c) =>
      c.case_id === caseId
        ? {
            ...c,
            status: "CLOSED",
            outcome,
            payout_frozen: outcome === "fraud_confirmed",
            timeline: [newTimelineItem, ...(c.timeline || [])],
            notes: [...(c.notes || []), newNote],
            updated_at: new Date().toISOString(),
          }
        : c
    );
    return mockCases.find((c) => c.case_id === caseId)!;
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
export interface NetworkNode {
  id: string;
  name: string;
  type: "rider" | "device" | "bank" | "ring";
  risk_score: number;
  cluster_id?: string;
  cluster_name?: string;
  details: {
    subtitle: string;
    hub?: string;
    first_seen: string;
    last_seen: string;
    status: string;
    phone_or_account?: string;
    model_or_routing?: string;
  };
  history?: { timestamp: string; event: string; severity: "LOW" | "MEDIUM" | "HIGH" }[];
}

export interface NetworkEdge {
  source: string;
  target: string;
  relationship: "SHARES_DEVICE" | "SHARES_IBAN" | "COLOCATED_TRIP" | "RING_MEMBER";
  risk_flag: boolean;
}

export interface NetworkGraphResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  total_available: number;
}

export const INITIAL_NETWORK_GRAPH: NetworkGraphResponse = {
  total_available: 48,
  nodes: [
    // Ring Center Nodes
    {
      id: "ring_c902",
      name: "Ring #C-902 (Downtown)",
      type: "ring",
      risk_score: 94,
      cluster_id: "RING-C-902",
      cluster_name: "Downtown Courier Colocation Farm",
      details: {
        subtitle: "4 Couriers • Shared IMEI & SIM Routing",
        hub: "Downtown",
        first_seen: "2026-10-15 08:30",
        last_seen: "2 mins ago",
        status: "ACTIVE_ESCALATION",
      },
      history: [
        { timestamp: "14:22 UTC", event: "Simultaneous 4-order batching at 4th Ave dropoff", severity: "HIGH" },
        { timestamp: "12:15 UTC", event: "Identical device token recycled across 3 logins", severity: "HIGH" },
      ],
    },
    {
      id: "ring_b410",
      name: "Ring #B-410 (Airport)",
      type: "ring",
      risk_score: 88,
      cluster_id: "RING-B-410",
      cluster_name: "Airport Corridor Teleportation Ring",
      details: {
        subtitle: "7 Couriers • Mock GPS Velocity Spikes",
        hub: "North Hub",
        first_seen: "2026-10-16 11:00",
        last_seen: "12 mins ago",
        status: "MONITORING",
      },
      history: [
        { timestamp: "19:40 UTC", event: "GPS Velocity hop > 184 km/h", severity: "HIGH" },
      ],
    },

    // Courier / Rider Nodes
    {
      id: "rider_8941",
      name: "Alex Rivera",
      type: "rider",
      risk_score: 89,
      cluster_id: "RING-C-902",
      details: {
        subtitle: "Courier CR-8941",
        hub: "Downtown",
        first_seen: "2026-09-12",
        last_seen: "Just now",
        status: "CHALLENGED",
        phone_or_account: "+1 (555) 234-8901",
      },
      history: [
        { timestamp: "19:40 UTC", event: "Mock GPS Jump detected", severity: "HIGH" },
        { timestamp: "18:02 UTC", event: "Liveness prompt timed out", severity: "MEDIUM" },
      ],
    },
    {
      id: "rider_9023",
      name: "Tariq Vance",
      type: "rider",
      risk_score: 64,
      cluster_id: "RING-C-902",
      details: {
        subtitle: "Courier CR-9023",
        hub: "Downtown",
        first_seen: "2026-08-04",
        last_seen: "8m ago",
        status: "CHALLENGED",
        phone_or_account: "+1 (555) 782-9914",
      },
      history: [
        { timestamp: "14:22 UTC", event: "Colocated order with CR-8941", severity: "MEDIUM" },
      ],
    },
    {
      id: "rider_6650",
      name: "Kenji Sato",
      type: "rider",
      risk_score: 72,
      cluster_id: "RING-C-902",
      details: {
        subtitle: "Courier CR-6650",
        hub: "Metro Core",
        first_seen: "2026-07-19",
        last_seen: "22m ago",
        status: "SUSPENDED",
        phone_or_account: "+1 (555) 901-2248",
      },
      history: [
        { timestamp: "11:30 UTC", event: "Dual-app active transit flag", severity: "MEDIUM" },
      ],
    },
    {
      id: "rider_5542",
      name: "David Kim",
      type: "rider",
      risk_score: 94,
      cluster_id: "RING-B-410",
      details: {
        subtitle: "Courier CR-5542",
        hub: "South Bay",
        first_seen: "2026-10-01",
        last_seen: "32m ago",
        status: "ESCALATED",
        phone_or_account: "+1 (555) 441-9082",
      },
      history: [
        { timestamp: "10:15 UTC", event: "Teleportation hop 18.2km", severity: "HIGH" },
      ],
    },
    {
      id: "rider_7812",
      name: "Elena Rostova",
      type: "rider",
      risk_score: 11,
      details: {
        subtitle: "Courier CR-7812",
        hub: "East Sector",
        first_seen: "2026-04-10",
        last_seen: "14m ago",
        status: "ACTIVE_VERIFIED",
        phone_or_account: "+1 (555) 302-8874",
      },
      history: [
        { timestamp: "09:00 UTC", event: "3D Face verification passed", severity: "LOW" },
      ],
    },
    {
      id: "rider_3319",
      name: "Marcus Chen",
      type: "rider",
      risk_score: 14,
      details: {
        subtitle: "Courier CR-3319",
        hub: "Metro Core",
        first_seen: "2026-05-22",
        last_seen: "5m ago",
        status: "ACTIVE_VERIFIED",
        phone_or_account: "+1 (555) 609-3112",
      },
      history: [
        { timestamp: "08:15 UTC", event: "Shift check-in nominal", severity: "LOW" },
      ],
    },

    // Device Nodes
    {
      id: "dev_redmi_9921",
      name: "Redmi 12 (Rooted)",
      type: "device",
      risk_score: 92,
      cluster_id: "RING-C-902",
      details: {
        subtitle: "IMEI: 86492005...9921",
        model_or_routing: "Android 13.0 • Magisk SU",
        first_seen: "2026-10-10",
        last_seen: "2m ago",
        status: "SPOOF_CONFIRMED",
      },
    },
    {
      id: "dev_pixel_8819",
      name: "Pixel 8 Pro",
      type: "device",
      risk_score: 45,
      cluster_id: "RING-C-902",
      details: {
        subtitle: "IMEI: 35918209...8819",
        model_or_routing: "Android 14.1 • Google Fi",
        first_seen: "2026-09-01",
        last_seen: "18m ago",
        status: "CHALLENGED",
      },
    },
    {
      id: "dev_iphone_15",
      name: "iPhone 15 Pro",
      type: "device",
      risk_score: 8,
      details: {
        subtitle: "UDID: 00008110...15PRO",
        model_or_routing: "iOS 18.2 • Secure Enclave",
        first_seen: "2026-04-10",
        last_seen: "Just now",
        status: "GENUINE_PASSPORT",
      },
    },

    // Bank Account Nodes
    {
      id: "bank_chase_9921",
      name: "Chase Checking •••• 9921",
      type: "bank",
      risk_score: 95,
      cluster_id: "RING-C-902",
      details: {
        subtitle: "Routing: 021000021",
        model_or_routing: "JPMorgan Chase • NYC",
        first_seen: "2026-10-12",
        last_seen: "45m ago",
        status: "PAYOUT_ESCROW_LOCKED",
      },
      history: [
        { timestamp: "Yesterday", event: "3 separate courier registrations to same IBAN", severity: "HIGH" },
      ],
    },
    {
      id: "bank_wells_4108",
      name: "Wells Fargo •••• 4108",
      type: "bank",
      risk_score: 55,
      cluster_id: "RING-B-410",
      details: {
        subtitle: "Routing: 121000248",
        model_or_routing: "Wells Fargo Bank",
        first_seen: "2026-09-20",
        last_seen: "2h ago",
        status: "UNDER_REVIEW",
      },
    },
    {
      id: "bank_bofa_1283",
      name: "Bank of America •••• 1283",
      type: "bank",
      risk_score: 6,
      details: {
        subtitle: "Routing: 111000025",
        model_or_routing: "Bank of America",
        first_seen: "2026-04-10",
        last_seen: "1d ago",
        status: "VERIFIED_CLEAR",
      },
    },
    {
      id: "ring_a108",
      name: "Ring #A-108 (Ghost Orders)",
      type: "ring",
      risk_score: 99,
      cluster_id: "RING-A-108",
      cluster_name: "Ghost Customer Pairing Syndicate",
      details: {
        subtitle: "6 Couriers • Promo Injection Script",
        hub: "Metro Core",
        first_seen: "2026-10-14 06:10",
        last_seen: "1 min ago",
        status: "ACTIVE_ESCALATION",
      },
      history: [
        { timestamp: "15:02 UTC", event: "Synchronized fraudulent bonus harvest (12 coupons)", severity: "HIGH" },
      ],
    },
    {
      id: "rider_4490",
      name: "Arjun Nair",
      type: "rider",
      risk_score: 91,
      cluster_id: "RING-A-108",
      details: {
        subtitle: "Courier CR-4490",
        hub: "Metro Core",
        first_seen: "2026-10-04",
        last_seen: "4m ago",
        status: "ESCALATED",
        phone_or_account: "+1 (555) 771-3920",
      },
      history: [
        { timestamp: "15:00 UTC", event: "Zero-transit order marked delivered", severity: "HIGH" },
      ],
    },
    {
      id: "rider_1120",
      name: "Samantha Reed",
      type: "rider",
      risk_score: 87,
      cluster_id: "RING-A-108",
      details: {
        subtitle: "Courier CR-1120",
        hub: "Metro Core",
        first_seen: "2026-10-08",
        last_seen: "9m ago",
        status: "ESCALATED",
        phone_or_account: "+1 (555) 883-1492",
      },
      history: [
        { timestamp: "14:48 UTC", event: "Simultaneous geo-tag match with CR-4490", severity: "HIGH" },
      ],
    },
    {
      id: "dev_moto_g_4411",
      name: "Moto G Power (Rooted)",
      type: "device",
      risk_score: 88,
      cluster_id: "RING-A-108",
      details: {
        subtitle: "IMEI: 35290119...4411",
        model_or_routing: "Android 13 • KernelSU Hook",
        first_seen: "2026-10-07",
        last_seen: "3m ago",
        status: "SPOOF_CONFIRMED",
      },
    },
    {
      id: "bank_citibank_8820",
      name: "Citibank Pre-Paid •••• 8820",
      type: "bank",
      risk_score: 96,
      cluster_id: "RING-A-108",
      details: {
        subtitle: "Routing: 031100209",
        model_or_routing: "Citibank N.A. • Prepaid Bin",
        first_seen: "2026-10-09",
        last_seen: "12m ago",
        status: "PAYOUT_ESCROW_LOCKED",
      },
    },
    {
      id: "rider_7731",
      name: "Vikram Rao",
      type: "rider",
      risk_score: 42,
      cluster_id: "RING-B-410",
      details: {
        subtitle: "Courier CR-7731",
        hub: "North Hub",
        first_seen: "2026-09-15",
        last_seen: "25m ago",
        status: "CHALLENGED",
        phone_or_account: "+1 (555) 629-8804",
      },
    },
  ],
  edges: [
    // Ring Connections
    { source: "ring_c902", target: "rider_8941", relationship: "RING_MEMBER", risk_flag: true },
    { source: "ring_c902", target: "rider_9023", relationship: "RING_MEMBER", risk_flag: true },
    { source: "ring_c902", target: "rider_6650", relationship: "RING_MEMBER", risk_flag: true },
    { source: "ring_b410", target: "rider_5542", relationship: "RING_MEMBER", risk_flag: true },
    { source: "ring_b410", target: "rider_7731", relationship: "RING_MEMBER", risk_flag: true },
    { source: "ring_a108", target: "rider_4490", relationship: "RING_MEMBER", risk_flag: true },
    { source: "ring_a108", target: "rider_1120", relationship: "RING_MEMBER", risk_flag: true },

    // Device Links
    { source: "rider_8941", target: "dev_redmi_9921", relationship: "SHARES_DEVICE", risk_flag: true },
    { source: "rider_9023", target: "dev_redmi_9921", relationship: "SHARES_DEVICE", risk_flag: true },
    { source: "rider_6650", target: "dev_pixel_8819", relationship: "SHARES_DEVICE", risk_flag: false },
    { source: "rider_7812", target: "dev_iphone_15", relationship: "SHARES_DEVICE", risk_flag: false },
    { source: "rider_4490", target: "dev_moto_g_4411", relationship: "SHARES_DEVICE", risk_flag: true },
    { source: "rider_1120", target: "dev_moto_g_4411", relationship: "SHARES_DEVICE", risk_flag: true },

    // Bank Account Links
    { source: "rider_8941", target: "bank_chase_9921", relationship: "SHARES_IBAN", risk_flag: true },
    { source: "rider_9023", target: "bank_chase_9921", relationship: "SHARES_IBAN", risk_flag: true },
    { source: "rider_6650", target: "bank_chase_9921", relationship: "SHARES_IBAN", risk_flag: true },
    { source: "rider_5542", target: "bank_wells_4108", relationship: "SHARES_IBAN", risk_flag: true },
    { source: "rider_7731", target: "bank_wells_4108", relationship: "SHARES_IBAN", risk_flag: true },
    { source: "rider_7812", target: "bank_bofa_1283", relationship: "SHARES_IBAN", risk_flag: false },
    { source: "rider_3319", target: "bank_bofa_1283", relationship: "SHARES_IBAN", risk_flag: false },
    { source: "rider_4490", target: "bank_citibank_8820", relationship: "SHARES_IBAN", risk_flag: true },
    { source: "rider_1120", target: "bank_citibank_8820", relationship: "SHARES_IBAN", risk_flag: true },

    // Colocated Trips
    { source: "rider_8941", target: "rider_9023", relationship: "COLOCATED_TRIP", risk_flag: true },
    { source: "rider_4490", target: "rider_1120", relationship: "COLOCATED_TRIP", risk_flag: true },
  ],
};

export async function getNetworkGraphData(
  limit: number = 30,
  clusterId?: string
): Promise<NetworkGraphResponse> {
  if (USE_MOCK) {
    let nodes = [...INITIAL_NETWORK_GRAPH.nodes];
    if (clusterId && clusterId !== "ALL") {
      nodes = nodes.filter((n) => n.cluster_id === clusterId || n.id === clusterId.toLowerCase().replace("-", "_"));
    }
    const nodeIds = new Set(nodes.slice(0, limit).map((n) => n.id));
    const edges = INITIAL_NETWORK_GRAPH.edges.filter(
      (e) => {
        const s = typeof e.source === "object" ? (e.source as any).id : e.source;
        const t = typeof e.target === "object" ? (e.target as any).id : e.target;
        return nodeIds.has(s) && nodeIds.has(t);
      }
    );
    return {
      nodes: nodes.slice(0, limit),
      edges,
      total_available: INITIAL_NETWORK_GRAPH.nodes.length,
    };
  }
  try {
    return await apiClient<NetworkGraphResponse>(`/api/v1/graph/network?limit=${limit}`);
  } catch {
    let nodes = [...INITIAL_NETWORK_GRAPH.nodes];
    if (clusterId && clusterId !== "ALL") {
      nodes = nodes.filter((n) => n.cluster_id === clusterId || n.id === clusterId.toLowerCase().replace("-", "_"));
    }
    const nodeIds = new Set(nodes.slice(0, limit).map((n) => n.id));
    const edges = INITIAL_NETWORK_GRAPH.edges.filter(
      (e) => {
        const s = typeof e.source === "object" ? (e.source as any).id : e.source;
        const t = typeof e.target === "object" ? (e.target as any).id : e.target;
        return nodeIds.has(s) && nodeIds.has(t);
      }
    );
    return {
      nodes: nodes.slice(0, limit),
      edges,
      total_available: INITIAL_NETWORK_GRAPH.nodes.length,
    };
  }
}

export async function createInvestigationFromRing(
  ringOrNodeId: string,
  name: string,
  riskScore: number,
  details?: string
): Promise<{ case_id: string; message: string }> {
  try {
    return await apiClient<{ case_id: string; message: string }>("/api/v1/cases", {
      method: "POST",
      body: JSON.stringify({
        session_id: `ring_${ringOrNodeId}`,
        rider_id: ringOrNodeId,
        severity: riskScore > 80 ? "CRITICAL" : "HIGH",
        threat_summary: `Collusion Investigation: ${name}. ${details || "Multi-entity syndicate detected via graph community analysis."}`,
      }),
    });
  } catch {
    const caseId = `CASE-RING-${Math.floor(9200 + Math.random() * 700)}`;
    mockCases.unshift({
      case_id: caseId,
      session_id: `ring_${ringOrNodeId}`,
      rider_id: ringOrNodeId,
      rider_name: name,
      severity: riskScore > 80 ? "CRITICAL" : "HIGH",
      status: "OPEN",
      assigned_to: "Lead Investigator",
      threat_summary: `Collusion Investigation: ${name}. ${details || "Multi-entity syndicate detected via graph community analysis."}`,
      risk_score: riskScore,
      created_at: new Date().toISOString(),
    });
    return {
      case_id: caseId,
      message: `Formal case ${caseId} opened for ${name}. Dispatched to priority queue.`,
    };
  }
}

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
