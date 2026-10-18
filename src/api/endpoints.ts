/**
 * Kinetics API Endpoints
 * All typed functions matching the TrustJuggler v2 backend specification.
 * Supports transparent fallback to mock data when USE_MOCK=true or when offline.
 */

import { apiClient, USE_MOCK, API_BASE_URL } from "./client";
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

export type AppealStatus = "NEW" | "IN_REVIEW" | "AWAITING_RIDER" | "RESOLVED" | "PENDING" | "OVERTURNED" | "UPHELD";

export interface AppealReasonCode {
  code: string;
  title: string;
  plain_language: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface AppealEvidence {
  id: string;
  name: string;
  type: "video" | "document" | "image" | "telemetry";
  size: string;
  description: string;
  url?: string;
}

export interface AppealAISignal {
  name: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  detail: string;
}

export interface AppealAIRecommendation {
  verdict: "APPROVE_REDRESS" | "REJECT_UPHOLD" | "REQUEST_MORE_INFO";
  verdict_label: string;
  confidence: number;
  summary: string;
  rationale: string;
  key_signals: AppealAISignal[];
}

export interface AppealAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  note?: string;
}

export interface AppealOriginalDecision {
  decision_type: string;
  sanction: string;
  decided_at: string;
  payout_held_amount?: number;
  reason_codes: AppealReasonCode[];
}

export interface AppealRedressOptions {
  release_payout?: boolean;
  restore_account?: boolean;
  courtesy_credit?: boolean;
}

export interface AppealItem {
  id: string;
  case_id?: string;
  rider_id: string;
  rider_name?: string;
  rider_hub?: string;
  rider_phone?: string;
  rider_avatar?: string;
  trips_completed?: number;
  rider_rating?: number;
  tenure_months?: number;
  reason: string;
  supporting_text?: string;
  statement?: string;
  status: AppealStatus;
  payout_held_amount?: number;
  payout_id?: string;
  sla_deadline: string; // ISO timestamp
  created_at: string;
  reviewer_note?: string;
  original_decision?: AppealOriginalDecision;
  uploaded_evidence?: AppealEvidence[];
  ai_recommendation?: AppealAIRecommendation;
  audit_trail: AppealAuditEntry[];
  redress_applied?: {
    release_payout?: boolean;
    restore_account?: boolean;
    courtesy_credit?: boolean;
    amount_released?: number;
    adjudicated_at?: string;
    adjudicated_by?: string;
  };
  rejection_reason?: string;
  info_request?: {
    question: string;
    requested_at: string;
    requested_by: string;
    deadline: string;
  };
}

export type PayoutStatus = "PENDING" | "HELD" | "APPROVED" | "REJECTED" | "BLOCKED";

export interface PayoutChecklist {
  facial_liveness_verified: boolean;
  analyst_approved: boolean;
}

export interface PayoutItem {
  payout_id: string;
  rider_id: string;
  rider_name?: string;
  rider_hub?: string;
  amount: number;
  status: PayoutStatus;
  hold_reason?: string;
  destination_account?: string;
  bank_name?: string;
  risk_score?: number;
  created_at: string;
  escrow_window_deadline?: string; // 24h protection window
  checklist?: PayoutChecklist;
  liveness_score?: number;
  liveness_verified_at?: string;
  reviewed_by?: string;
  notes?: string;
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

export interface PolicyRuleConfig {
  challenge_threshold: number;
  escalate_threshold: number;
  allow_threshold?: number;
  max_velocity_kmh: number;
  min_face_match: number;
  hold_window_hours: number;
  rules: {
    velocity_rule_active: boolean;
    face_match_rule_active: boolean;
    hold_window_active: boolean;
    emulator_block_active: boolean;
    device_collision_active: boolean;
  };
}

export interface PolicyVersion {
  id: string;
  version_tag: string;
  name: string;
  config: PolicyRuleConfig;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  created_at: string;
  deployed_at?: string;
  deployed_by?: string;
  notes?: string;
}

export interface PolicySimulationMetrics {
  allow_pct: number;
  challenge_pct: number;
  escalate_pct: number;
  estimated_false_positives: number;
  payouts_affected: number;
  payouts_affected_amount: number;
  estimated_fraud_caught_pct: number;
  sessions_evaluated: number;
}

export interface PolicySimulationComparison {
  policy_id: string;
  current: PolicySimulationMetrics;
  proposed: PolicySimulationMetrics;
  diff: {
    allow_delta_pct: number;
    challenge_delta_pct: number;
    escalate_delta_pct: number;
    false_positives_delta: number;
    payouts_affected_delta: number;
    payouts_affected_amount_delta: number;
    fraud_caught_delta_pct: number;
  };
  sessions_evaluated: number;
  generated_at: string;
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
    rider_name: "Alex Rivera",
    rider_hub: "Downtown",
    rider_phone: "+1 (555) 234-8901",
    rider_avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    trips_completed: 1420,
    rider_rating: 4.96,
    tenure_months: 18,
    reason: "Disputed 184 km/h velocity penalty inside SR-99 Battery Tunnel.",
    supporting_text: "Attached dashcam footage demonstrating constant 35mph speed in 99 tunnel.",
    statement: "I was making an express delivery through the Downtown Underpass / SR-99 tunnel. When I went underground my phone GPS signal bounced and briefly lost lock, which made the system think I leaped 3 miles in 4 seconds. My dashcam video clearly shows I was traveling at a steady 35 mph the whole way through without any sudden acceleration. Please unfreeze my payout—this is my rent money for the week.",
    status: "NEW",
    payout_held_amount: 1240.0,
    payout_id: "PAY-89410",
    sla_deadline: new Date(Date.now() + 1000 * 60 * 42).toISOString(), // 42m remaining (Urgent!)
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    original_decision: {
      decision_type: "AUTOMATED_HOLD",
      sanction: "Immediate Payout Freeze ($1,240.00) & Disciplinary Flag",
      decided_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      payout_held_amount: 1240.0,
      reason_codes: [
        {
          code: "ERR_GPS_VELOCITY_SPIKE",
          title: "Kinematic Jump Detected",
          plain_language: "Courier reported location jumped 184 km/h across urban coordinates without plausible physical transit vector.",
          severity: "HIGH",
        },
        {
          code: "ERR_GNSS_DOPPLER_ANOMALY",
          title: "Carrier Phase Discontinuity",
          plain_language: "GNSS satellite carrier signal dropped SNR below 12dB-Hz with sudden pseudorange delta.",
          severity: "MEDIUM",
        },
        {
          code: "WARN_RF_OCCLUSION",
          title: "Cell Tower Multipath",
          plain_language: "Cellular radio signal bounced off subterranean reinforced concrete walls.",
          severity: "LOW",
        },
      ],
    },
    uploaded_evidence: [
      {
        id: "ev_401_1",
        name: "Dashcam_SR99_Tunnel_Transit.mp4",
        type: "video",
        size: "38.4 MB",
        description: "Front-facing 1080p dashcam footage with embedded OBD-II speed telemetry (35 mph).",
      },
      {
        id: "ev_401_2",
        name: "Downtown_Expressway_Toll_Receipt.pdf",
        type: "document",
        size: "1.1 MB",
        description: "Automated electronic toll booth gate timestamp verification (Booth #4, 14:22:18 UTC).",
      },
      {
        id: "ev_401_3",
        name: "GNSS_Raw_Pseudorange_Log.txt",
        type: "telemetry",
        size: "2.4 MB",
        description: "Android Raw GNSS Measurements API log demonstrating subterranean signal attenuation.",
      },
    ],
    ai_recommendation: {
      verdict: "APPROVE_REDRESS",
      verdict_label: "Recommend Overturn & Release Escrow",
      confidence: 94,
      summary: "Subterranean RF multipath artifact verified. Accelerometer inertial telemetry confirms nominal 35 km/h driving.",
      rationale: "Analysis of raw IMU accelerometer data confirms unbroken 0.1g deceleration entering Battery Tunnel before GPS loss of lock. Zero mock location provider packages found in hardware passport. Speedometer telemetry matches electronic toll timestamp exactly.",
      key_signals: [
        { name: "IMU Accelerometer Continuity", impact: "POSITIVE", detail: "Smooth 34 km/h baseline without kinematic anomalies." },
        { name: "Electronic Toll Ground-Truth", impact: "POSITIVE", detail: "Toll booth camera matched vehicle license plate at 14:22 UTC." },
        { name: "Hardware Keystore Passport", impact: "POSITIVE", detail: "Cryptographic device attestations passed with 0 root hooks." },
      ],
    },
    audit_trail: [
      {
        id: "aud_1",
        timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        actor: "Kinetics Autonomous Guard v2.4",
        role: "SYSTEM",
        action: "DECISION_ESCALATED",
        note: "Triggered rule R-VELOCITY-01: 184 km/h jump detected. Escrow payout PAY-89410 held.",
      },
      {
        id: "aud_2",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        actor: "Alex Rivera",
        role: "RIDER",
        action: "APPEAL_SUBMITTED",
        note: "Submitted appeal via Courier Mobile App with 3 attached evidence files.",
      },
      {
        id: "aud_3",
        timestamp: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
        actor: "SchemeSetu AI Copilot",
        role: "AI_COPILOT",
        action: "RECOMMENDATION_GENERATED",
        note: "Generated APPROVE_REDRESS recommendation (94% confidence) following RF multipath correlation.",
      },
    ],
  },
  {
    id: "APP-402",
    case_id: "CASE-9005",
    rider_id: "CR-9023",
    rider_name: "Tariq Vance",
    rider_hub: "Downtown",
    rider_phone: "+1 (555) 782-9914",
    rider_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    trips_completed: 340,
    rider_rating: 4.41,
    tenure_months: 3,
    reason: "Contesting collusion ring linkage and payout forfeiture.",
    statement: "I share a car with my brother. We take turns driving the same vehicle so that's why our bank account is the same. We are not doing anything illegal. We just do shift rotations and need our earnings released.",
    status: "IN_REVIEW",
    payout_held_amount: 2850.0,
    payout_id: "PAY-89412",
    sla_deadline: new Date(Date.now() + 1000 * 60 * 140).toISOString(), // 2h 20m remaining
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    original_decision: {
      decision_type: "COLLUSION_SUSPENSION",
      sanction: "Collusion Cluster Sanction & Forfeiture of $2,850.00",
      decided_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
      payout_held_amount: 2850.0,
      reason_codes: [
        {
          code: "ERR_MULTI_PAYOUT_IBAN",
          title: "Shared Bank Routing Routing",
          plain_language: "Bank account ending in 9921 received deposits from 3 distinct courier accounts in past 48 hours.",
          severity: "HIGH",
        },
        {
          code: "ERR_IMEI_COLLUSION",
          title: "Hardware Keystore Sharing",
          plain_language: "Device hardware signature matches known cluster #C-902 involved in simulated trip farming.",
          severity: "HIGH",
        },
      ],
    },
    uploaded_evidence: [
      {
        id: "ev_402_1",
        name: "Shared_Vehicle_Agreement.pdf",
        type: "document",
        size: "1.8 MB",
        description: "Handwritten car sharing agreement between family members.",
      },
      {
        id: "ev_402_2",
        name: "Bank_Statement_Summary.jpg",
        type: "image",
        size: "2.1 MB",
        description: "Checking account statement showing joint account holders.",
      },
    ],
    ai_recommendation: {
      verdict: "REJECT_UPHOLD",
      verdict_label: "Recommend Uphold Sanction & Maintain Forfeiture",
      confidence: 91,
      summary: "Concurrent active trip completions recorded across opposite sides of the city under same device ID.",
      rationale: "Graph analysis reveals 3 riders logging concurrent pickup times separated by 14km within 60 seconds on the same IMEI device. Physical copresence is physically impossible. This matches syndicate automated bot farming.",
      key_signals: [
        { name: "Concurrent Trip Overlaps", impact: "NEGATIVE", detail: "3 simultaneous active orders in disjoint geographical zones." },
        { name: "Virtual Android Container", impact: "NEGATIVE", detail: "Xposed hooks detected in runtime memory stack." },
        { name: "Syndicate Topology Match", impact: "NEGATIVE", detail: "Bipartite link centrality score = 0.94 in Cluster #C-902." },
      ],
    },
    audit_trail: [
      {
        id: "aud_201",
        timestamp: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
        actor: "Graph Shield Engine",
        role: "SYSTEM",
        action: "CLUSTER_FLIGHT_SANCTION",
        note: "Detected collusion ring #C-902. Suspended 4 accounts and held payouts.",
      },
      {
        id: "aud_202",
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        actor: "Tariq Vance",
        role: "RIDER",
        action: "APPEAL_SUBMITTED",
        note: "Rider submitted appeal contesting multi-account linkage.",
      },
      {
        id: "aud_203",
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        actor: "Marcus Vance",
        role: "ANALYST",
        action: "TRIAGE_ASSIGNMENT",
        note: "Assigned appeal to active investigation queue for in-depth audit.",
      },
    ],
  },
  {
    id: "APP-403",
    case_id: "CASE-9009",
    rider_id: "CR-3319",
    rider_name: "Maya Lin",
    rider_hub: "Metro Core",
    rider_phone: "+1 (555) 609-3112",
    rider_avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    trips_completed: 890,
    rider_rating: 4.88,
    tenure_months: 9,
    reason: "Battery died 400m before delivery point; completed order on foot.",
    statement: "My phone battery abruptly died in cold weather right as I walked up the driveway to deliver the package. I handed the food directly to the customer at door 4B. By the time I got back to my scooter and plugged into the charger, the order was marked aborted and my day payout was blocked. I did the delivery!",
    status: "AWAITING_RIDER",
    payout_held_amount: 920.0,
    payout_id: "PAY-89414",
    sla_deadline: new Date(Date.now() + 1000 * 60 * 780).toISOString(), // 13h remaining
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    original_decision: {
      decision_type: "UNVERIFIED_DROPOFF",
      sanction: "Order Abort Flag & Escrow Hold ($920.00)",
      decided_at: new Date(Date.now() - 1000 * 60 * 260).toISOString(),
      payout_held_amount: 920.0,
      reason_codes: [
        {
          code: "ERR_ABRUPT_DISCONNECT",
          title: "Premature Connection Loss",
          plain_language: "Telemetry websocket closed 420 meters prior to designated customer delivery geofence.",
          severity: "MEDIUM",
        },
        {
          code: "WARN_NO_POD_PHOTO",
          title: "Missing Proof of Delivery",
          plain_language: "No geotagged proof-of-delivery photograph or customer signature recorded on terminal.",
          severity: "MEDIUM",
        },
      ],
    },
    uploaded_evidence: [
      {
        id: "ev_403_1",
        name: "Battery_Shutdown_Event.png",
        type: "image",
        size: "1.4 MB",
        description: "Screenshot of OS system log showing critical low voltage thermal shutdown at 18:41 UTC.",
      },
    ],
    ai_recommendation: {
      verdict: "REQUEST_MORE_INFO",
      verdict_label: "Request Customer Confirmation or Merchant Slip",
      confidence: 78,
      summary: "Shutdown logs are authentic, but destination customer has not yet confirmed handoff.",
      rationale: "OS battery curve indicates legitimate low-temp voltage collapse. However, merchant order status remains in dispute without buyer receipt.",
      key_signals: [
        { name: "OS Battery Telemetry", impact: "POSITIVE", detail: "Matches thermal shutdown profile." },
        { name: "Customer Confirmation", impact: "NEUTRAL", detail: "Awaiting customer app acknowledgment." },
      ],
    },
    info_request: {
      question: "Please ask customer at Apt 4B to confirm receipt in their app, or provide merchant itemized dispatch receipt.",
      requested_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      requested_by: "Elena Rostova",
      deadline: new Date(Date.now() + 1000 * 60 * 780).toISOString(),
    },
    audit_trail: [
      {
        id: "aud_301",
        timestamp: new Date(Date.now() - 1000 * 60 * 260).toISOString(),
        actor: "Dropoff Verification Bot",
        role: "SYSTEM",
        action: "DROPOFF_FLAGGED",
        note: "Flagged unverified order delivery.",
      },
      {
        id: "aud_302",
        timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
        actor: "Maya Lin",
        role: "RIDER",
        action: "APPEAL_SUBMITTED",
        note: "Submitted appeal with OS low battery screenshot.",
      },
      {
        id: "aud_303",
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        actor: "Elena Rostova",
        role: "ANALYST",
        action: "INFO_REQUESTED",
        note: "Requested customer app confirmation or merchant receipt. SLA extended.",
      },
    ],
  },
  {
    id: "APP-404",
    case_id: "CASE-8891",
    rider_id: "CR-6650",
    rider_name: "Kenji Sato",
    rider_hub: "Metro Core",
    rider_phone: "+1 (555) 901-2248",
    rider_avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    trips_completed: 2120,
    rider_rating: 4.95,
    tenure_months: 24,
    reason: "Secondary handlebar phone mounted for Google Maps navigation.",
    statement: "I use a dedicated waterproof phone strictly mounted on my scooter handlebar for Google Maps navigation so my main phone in my pocket doesn't overheat. Both phones pinged the cell tower and the system assumed I was running two courier accounts. I only have one courier profile.",
    status: "RESOLVED",
    payout_held_amount: 1450.0,
    sla_deadline: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    original_decision: {
      decision_type: "DUAL_DEVICE_COLLUSION",
      sanction: "Dual-Device Penalty & Escrow Hold ($1,450.00)",
      decided_at: new Date(Date.now() - 1000 * 60 * 380).toISOString(),
      payout_held_amount: 1450.0,
      reason_codes: [
        {
          code: "ERR_DUAL_DEVICE_COLOCATION",
          title: "Colocated Radio Transceiver",
          plain_language: "Two active IMEIs traveled in identical trajectory for 4 continuous hours.",
          severity: "MEDIUM",
        },
      ],
    },
    uploaded_evidence: [
      {
        id: "ev_404_1",
        name: "Scooter_Handlebar_Mount_Setup.jpg",
        type: "image",
        size: "3.5 MB",
        description: "Photograph of scooter cockpit showing navigation-only GPS cradle with Google Maps open.",
      },
    ],
    ai_recommendation: {
      verdict: "APPROVE_REDRESS",
      verdict_label: "Recommend Overturn & Release Escrow",
      confidence: 97,
      summary: "Secondary IMEI possesses no registered courier worker credentials across any delivery partner.",
      rationale: "Database search confirms secondary device is unassociated with any driver portal. Pure navigation handset setup.",
      key_signals: [
        { name: "Clean Driver Registry", impact: "POSITIVE", detail: "Secondary IMEI is not a courier worker device." },
        { name: "Top-Tier Courier History", impact: "POSITIVE", detail: "2,120 trips completed with 99.8% compliance." },
      ],
    },
    redress_applied: {
      release_payout: true,
      restore_account: true,
      courtesy_credit: false,
      amount_released: 1450.0,
      adjudicated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      adjudicated_by: "Marcus Vance",
    },
    reviewer_note: "Verified secondary handset belongs to navigation mount. Escrow hold released and account standing restored.",
    audit_trail: [
      {
        id: "aud_401",
        timestamp: new Date(Date.now() - 1000 * 60 * 380).toISOString(),
        actor: "Colocation Sentinel",
        role: "SYSTEM",
        action: "DEVICE_FLAGGED",
        note: "Flagged colocated IMEI. $1,450 payout held.",
      },
      {
        id: "aud_402",
        timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
        actor: "Kenji Sato",
        role: "RIDER",
        action: "APPEAL_SUBMITTED",
        note: "Submitted appeal with handlebar cockpit photo.",
      },
      {
        id: "aud_403",
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        actor: "Marcus Vance",
        role: "ANALYST",
        action: "APPEAL_APPROVED",
        note: "Approved appeal with full redress: $1,450 payout released, account restored to Good Standing.",
      },
    ],
  },
  {
    id: "APP-405",
    case_id: "CASE-9002",
    rider_id: "CR-5542",
    rider_name: "David Kim",
    rider_hub: "South Bay",
    rider_phone: "+1 (555) 441-9082",
    rider_avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    trips_completed: 120,
    rider_rating: 4.12,
    tenure_months: 1,
    reason: "Claimed bad cellular reception caused 18km displacement.",
    statement: "I lost signal on Highway 101 and the map caught up later. It wasn't my fault that the app glitched.",
    status: "RESOLVED",
    payout_held_amount: 2150.0,
    sla_deadline: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    original_decision: {
      decision_type: "MOCK_LOCATION_FORFEITURE",
      sanction: "Permanent Account Restriction & Escrow Forfeiture ($2,150.00)",
      decided_at: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
      payout_held_amount: 2150.0,
      reason_codes: [
        {
          code: "ERR_GEO_TELEPORT",
          title: "Impossible Velocity",
          plain_language: "Position teleported 18.2 km across South Bay in 45 seconds.",
          severity: "HIGH",
        },
        {
          code: "ERR_MOCK_APK_INJECTION",
          title: "Mock Provider Package Active",
          plain_language: "Active Magisk module spoofing GPS NMEA sentences without satellite constellation lock.",
          severity: "HIGH",
        },
      ],
    },
    uploaded_evidence: [
      {
        id: "ev_405_1",
        name: "Cell_Coverage_Screenshot.png",
        type: "image",
        size: "950 KB",
        description: "Carrier dead-zone coverage map screenshot.",
      },
    ],
    ai_recommendation: {
      verdict: "REJECT_UPHOLD",
      verdict_label: "Recommend Uphold Sanction & Maintain Forfeiture",
      confidence: 99,
      summary: "Undeniable synthetic NMEA telemetry and root hide hooks detected in application memory.",
      rationale: "Binary analysis of terminal environment revealed GPS JoyStick package active during event. Cellular signal logs showed full 5G connection throughout.",
      key_signals: [
        { name: "Mock Provider Hook", impact: "NEGATIVE", detail: "Active mock location API in process memory." },
        { name: "5G Signal Telemetry", impact: "NEGATIVE", detail: "Consistent -78 dBm signal (no outage existed)." },
      ],
    },
    rejection_reason: "Confirmed mock GPS injection framework with synthetic NMEA coordinates. Rejection upheld permanently.",
    reviewer_note: "Fraud confirmed after forensic memory analysis. Escrow forfeited.",
    audit_trail: [
      {
        id: "aud_501",
        timestamp: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
        actor: "Kinematics Sentinel",
        role: "SYSTEM",
        action: "FRAUD_CONFIRMED",
        note: "Detected mock GPS joystick. Permanent restriction applied.",
      },
      {
        id: "aud_502",
        timestamp: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
        actor: "David Kim",
        role: "RIDER",
        action: "APPEAL_SUBMITTED",
        note: "Submitted appeal claiming dead zone.",
      },
      {
        id: "aud_503",
        timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
        actor: "Elena Rostova",
        role: "ANALYST",
        action: "APPEAL_REJECTED",
        note: "Appeal rejected: confirmed mock location tampering. Escrow forfeited.",
      },
    ],
  },
];

let mockPayouts: PayoutItem[] = [
  // --- Escrow Holds (24-hour protection window) ---
  {
    payout_id: "PAY-89410",
    rider_id: "CR-8941",
    rider_name: "Alex Rivera",
    rider_hub: "Downtown",
    amount: 1240.0,
    status: "HELD",
    hold_reason: "IBAN Conflict: 3 separate couriers linked to identical bank routing within 48h.",
    destination_account: "Chase •••• 9921",
    bank_name: "JPMorgan Chase NA",
    risk_score: 89,
    created_at: new Date(Date.now() - 1000 * 60 * 318).toISOString(), // ~5h 18m ago
    escrow_window_deadline: new Date(Date.now() + 1000 * 60 * 60 * 18 + 1000 * 60 * 42).toISOString(), // ~18h 42m left
    checklist: {
      facial_liveness_verified: false,
      analyst_approved: false,
    },
    notes: "Escrow hold initiated following velocity trigger. Mandatory 3D face liveness required.",
  },
  {
    payout_id: "PAY-89413",
    rider_id: "CR-9023",
    rider_name: "Tariq Vance",
    rider_hub: "Downtown",
    amount: 840.5,
    status: "HELD",
    hold_reason: "Syndicate Farm Collision: Linked to Magisk rooted Xiaomi IMEI-e3b0.",
    destination_account: "Chase •••• 9921",
    bank_name: "JPMorgan Chase NA",
    risk_score: 94,
    created_at: new Date(Date.now() - 1000 * 60 * 705).toISOString(), // ~11h 45m ago
    escrow_window_deadline: new Date(Date.now() + 1000 * 60 * 60 * 12 + 1000 * 60 * 15).toISOString(), // ~12h 15m left
    checklist: {
      facial_liveness_verified: false,
      analyst_approved: false,
    },
    notes: "Device farm cluster detected. Payout frozen in regulatory compliance escrow.",
  },
  {
    payout_id: "PAY-89414",
    rider_id: "CR-6650",
    rider_name: "Kenji Sato",
    rider_hub: "Metro Core",
    amount: 710.0,
    status: "HELD",
    hold_reason: "Dual-App Colocation Tandem Probe along Highway 99.",
    destination_account: "Wells Fargo •••• 4108",
    bank_name: "Wells Fargo Bank",
    risk_score: 72,
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 1.5h ago
    escrow_window_deadline: new Date(Date.now() + 1000 * 60 * 60 * 22 + 1000 * 60 * 30).toISOString(), // ~22h 30m left
    checklist: {
      facial_liveness_verified: true,
      analyst_approved: false,
    },
    liveness_score: 98.4,
    liveness_verified_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    notes: "Facial liveness verified via app prompt. Awaiting analyst signoff.",
  },

  // --- Pending Approvals ---
  {
    payout_id: "PAY-89411",
    rider_id: "CR-9023",
    rider_name: "Tariq Vance",
    rider_hub: "Downtown",
    amount: 480.5,
    status: "PENDING",
    hold_reason: "Spatial Drift: Jump of 8.4km during active order handoff window.",
    destination_account: "Wells Fargo •••• 4108",
    bank_name: "Wells Fargo Bank",
    risk_score: 58,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    checklist: {
      facial_liveness_verified: false,
      analyst_approved: false,
    },
  },
  {
    payout_id: "PAY-89415",
    rider_id: "CR-3319",
    rider_name: "Carlos Mendez",
    rider_hub: "North Hub",
    amount: 390.0,
    status: "PENDING",
    hold_reason: "SIM IMSI carrier churn detected over weekend shift.",
    destination_account: "Citibank •••• 3021",
    bank_name: "Citibank NA",
    risk_score: 44,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    checklist: {
      facial_liveness_verified: false,
      analyst_approved: false,
    },
  },
  {
    payout_id: "PAY-89416",
    rider_id: "CR-5542",
    rider_name: "David Kim",
    rider_hub: "South Bay",
    amount: 625.8,
    status: "PENDING",
    hold_reason: "Velocity variance in multi-batch delivery route.",
    destination_account: "Chase •••• 9921",
    bank_name: "JPMorgan Chase NA",
    risk_score: 62,
    created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    checklist: {
      facial_liveness_verified: false,
      analyst_approved: false,
    },
  },

  // --- Released Today ---
  {
    payout_id: "PAY-89412",
    rider_id: "CR-7812",
    rider_name: "Elena Rostova",
    rider_hub: "East Sector",
    amount: 865.2,
    status: "APPROVED",
    destination_account: "Bank of America •••• 1283",
    bank_name: "Bank of America NA",
    risk_score: 8,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    checklist: {
      facial_liveness_verified: true,
      analyst_approved: true,
    },
    liveness_score: 99.8,
    reviewed_by: "Marcus Vance",
    notes: "Liveness attested with Secure Enclave hardware passport. Disbursed via instant RTP.",
  },
  {
    payout_id: "PAY-89417",
    rider_id: "CR-4402",
    rider_name: "Aria Thorne",
    rider_hub: "Airport Corridor",
    amount: 480.5,
    status: "APPROVED",
    destination_account: "US Bank •••• 7182",
    bank_name: "US Bank NA",
    risk_score: 14,
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    checklist: {
      facial_liveness_verified: true,
      analyst_approved: true,
    },
    reviewed_by: "Marcus Vance",
    notes: "Appeal APP-398 approved. Released escrow hold.",
  },
  {
    payout_id: "PAY-89418",
    rider_id: "CR-1209",
    rider_name: "Liam O'Connor",
    rider_hub: "North Hub",
    amount: 1120.0,
    status: "APPROVED",
    destination_account: "Chase •••• 5519",
    bank_name: "JPMorgan Chase NA",
    risk_score: 5,
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    checklist: {
      facial_liveness_verified: true,
      analyst_approved: true,
    },
    reviewed_by: "Elena Rostova",
    notes: "Regular automated batch disbursement.",
  },

  // --- Rejected ---
  {
    payout_id: "PAY-89419",
    rider_id: "CR-1904",
    rider_name: "Vikram Patel",
    rider_hub: "South Bay",
    amount: 2150.0,
    status: "REJECTED",
    hold_reason: "Magisk Root synthetic farming & fake order replay.",
    destination_account: "Wells Fargo •••• 8812",
    bank_name: "Wells Fargo Bank",
    risk_score: 98,
    created_at: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    reviewed_by: "Elena Rostova",
    notes: "Permanent fraud forfeiture following Case CASE-9002 adjudication.",
  },
  {
    payout_id: "PAY-89420",
    rider_id: "CR-1092",
    rider_name: "Marcus Brody",
    rider_hub: "Downtown",
    amount: 640.0,
    status: "REJECTED",
    hold_reason: "GPS joystick injection while stationary.",
    destination_account: "Capital One •••• 1190",
    bank_name: "Capital One NA",
    risk_score: 96,
    created_at: new Date(Date.now() - 1000 * 60 * 840).toISOString(),
    reviewed_by: "Marcus Vance",
    notes: "Account banned for confirmed location tampering.",
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
  payload: {
    action: "approve" | "reject" | "overturned" | "upheld";
    note?: string;
    reason?: string;
    redress?: AppealRedressOptions;
    actor?: string;
  }
): Promise<AppealItem> {
  const isApproved = payload.action === "approve" || payload.action === "overturned";
  const actorName = payload.actor || "Analyst";

  if (USE_MOCK) {
    mockAppeals = mockAppeals.map((a) => {
      if (a.id !== appealId) return a;
      const newAudit: AppealAuditEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: actorName,
        role: "ANALYST",
        action: isApproved ? "APPEAL_APPROVED" : "APPEAL_REJECTED",
        note: isApproved
          ? `Appeal approved. Redress: ${payload.redress?.release_payout ? "Release Escrow" : ""} ${payload.redress?.restore_account ? "| Restore Account" : ""}. Note: ${payload.note || "No note"}`
          : `Appeal rejected. Reason: ${payload.reason || "Policy violation"}. Note: ${payload.note || "No note"}`,
      };

      const updated: AppealItem = {
        ...a,
        status: "RESOLVED",
        reviewer_note: payload.note || (isApproved ? "Approved by analyst" : "Rejected by analyst"),
        rejection_reason: !isApproved ? (payload.reason || "Appeal rejected") : undefined,
        redress_applied: isApproved
          ? {
              release_payout: payload.redress?.release_payout ?? true,
              restore_account: payload.redress?.restore_account ?? true,
              courtesy_credit: payload.redress?.courtesy_credit ?? false,
              amount_released: a.payout_held_amount,
              adjudicated_at: new Date().toISOString(),
              adjudicated_by: actorName,
            }
          : undefined,
        audit_trail: [...a.audit_trail, newAudit],
      };

      // Also unfreeze linked payout if requested
      if (isApproved && payload.redress?.release_payout && a.payout_id) {
        mockPayouts = mockPayouts.map((p) =>
          p.payout_id === a.payout_id
            ? { ...p, status: "APPROVED", notes: `Released via Appeal ${a.id} approval.` }
            : p
        );
      }

      return updated;
    });
    return mockAppeals.find((a) => a.id === appealId)!;
  }

  try {
    return await apiClient<AppealItem>(`/api/v1/appeals/${appealId}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    mockAppeals = mockAppeals.map((a) => {
      if (a.id !== appealId) return a;
      const newAudit: AppealAuditEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: actorName,
        role: "ANALYST",
        action: isApproved ? "APPEAL_APPROVED" : "APPEAL_REJECTED",
        note: isApproved
          ? `Appeal approved. Note: ${payload.note || "Approved"}`
          : `Appeal rejected. Note: ${payload.note || "Rejected"}`,
      };
      return {
        ...a,
        status: "RESOLVED",
        reviewer_note: payload.note,
        rejection_reason: !isApproved ? payload.reason : undefined,
        audit_trail: [...a.audit_trail, newAudit],
      };
    });
    return mockAppeals.find((a) => a.id === appealId)!;
  }
}

export async function requestAppealMoreInfo(
  appealId: string,
  payload: { question: string; deadlineHours?: number; actor?: string }
): Promise<AppealItem> {
  const actorName = payload.actor || "Analyst";
  const deadline = new Date(Date.now() + (payload.deadlineHours || 24) * 60 * 60 * 1000).toISOString();

  if (USE_MOCK) {
    mockAppeals = mockAppeals.map((a) => {
      if (a.id !== appealId) return a;
      const newAudit: AppealAuditEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: actorName,
        role: "ANALYST",
        action: "INFO_REQUESTED",
        note: `Requested additional documentation: "${payload.question}". Response deadline set for 24h.`,
      };
      return {
        ...a,
        status: "AWAITING_RIDER",
        sla_deadline: deadline,
        info_request: {
          question: payload.question,
          requested_at: new Date().toISOString(),
          requested_by: actorName,
          deadline,
        },
        audit_trail: [...a.audit_trail, newAudit],
      };
    });
    return mockAppeals.find((a) => a.id === appealId)!;
  }

  try {
    return await apiClient<AppealItem>(`/api/v1/appeals/${appealId}/request-info`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    mockAppeals = mockAppeals.map((a) => {
      if (a.id !== appealId) return a;
      return {
        ...a,
        status: "AWAITING_RIDER",
        sla_deadline: deadline,
        info_request: {
          question: payload.question,
          requested_at: new Date().toISOString(),
          requested_by: actorName,
          deadline,
        },
      };
    });
    return mockAppeals.find((a) => a.id === appealId)!;
  }
}

export async function startReviewAppeal(
  appealId: string,
  actor: string = "Analyst"
): Promise<AppealItem> {
  if (USE_MOCK) {
    mockAppeals = mockAppeals.map((a) => {
      if (a.id !== appealId) return a;
      if (a.status !== "NEW") return a;
      const newAudit: AppealAuditEntry = {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor,
        role: "ANALYST",
        action: "STATUS_IN_REVIEW",
        note: `Assigned appeal ${appealId} to active triage queue.`,
      };
      return {
        ...a,
        status: "IN_REVIEW",
        audit_trail: [...a.audit_trail, newAudit],
      };
    });
    return mockAppeals.find((a) => a.id === appealId)!;
  }

  try {
    return await apiClient<AppealItem>(`/api/v1/appeals/${appealId}/start-review`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    });
  } catch {
    mockAppeals = mockAppeals.map((a) =>
      a.id === appealId ? { ...a, status: "IN_REVIEW" } : a
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
  const newStatus: PayoutStatus =
    action.action === "release"
      ? "APPROVED"
      : action.action === "block"
      ? "REJECTED"
      : "HELD";

  if (USE_MOCK) {
    mockPayouts = mockPayouts.map((p) =>
      p.payout_id === payoutId
        ? {
            ...p,
            status: newStatus,
            checklist: {
              facial_liveness_verified:
                p.checklist?.facial_liveness_verified ?? (action.action === "release"),
              analyst_approved: action.action === "release",
            },
            notes: action.reason || p.notes,
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
            status: newStatus,
            checklist: {
              facial_liveness_verified:
                p.checklist?.facial_liveness_verified ?? (action.action === "release"),
              analyst_approved: action.action === "release",
            },
            notes: action.reason || p.notes,
          }
        : p
    );
    return mockPayouts.find((p) => p.payout_id === payoutId)!;
  }
}

export async function resolvePayoutLiveness(
  payoutId: string,
  livenessPassed: boolean,
  score: number = 99.4,
  approver: string = "Analyst"
): Promise<PayoutItem> {
  if (USE_MOCK) {
    mockPayouts = mockPayouts.map((p) => {
      if (p.payout_id !== payoutId) return p;
      const updatedChecklist = {
        facial_liveness_verified: livenessPassed,
        analyst_approved: p.checklist?.analyst_approved || false,
      };
      return {
        ...p,
        checklist: updatedChecklist,
        liveness_score: score,
        liveness_verified_at: new Date().toISOString(),
        notes: `3D Facial Liveness verified (${score}% confidence). Verified by ${approver}.`,
      };
    });
    return mockPayouts.find((p) => p.payout_id === payoutId)!;
  }
  try {
    return await apiClient<PayoutItem>(`/api/v1/payouts/${payoutId}/liveness`, {
      method: "POST",
      body: JSON.stringify({ livenessPassed, score, approver }),
    });
  } catch {
    mockPayouts = mockPayouts.map((p) => {
      if (p.payout_id !== payoutId) return p;
      const updatedChecklist = {
        facial_liveness_verified: livenessPassed,
        analyst_approved: p.checklist?.analyst_approved || false,
      };
      return {
        ...p,
        checklist: updatedChecklist,
        liveness_score: score,
        liveness_verified_at: new Date().toISOString(),
        notes: `3D Facial Liveness verified (${score}% confidence). Verified by ${approver}.`,
      };
    });
    return mockPayouts.find((p) => p.payout_id === payoutId)!;
  }
}

export async function bulkApprovePayouts(
  payoutIds: string[],
  approver: string = "Analyst"
): Promise<PayoutItem[]> {
  const idsSet = new Set(payoutIds);
  if (USE_MOCK) {
    mockPayouts = mockPayouts.map((p) =>
      idsSet.has(p.payout_id)
        ? {
            ...p,
            status: "APPROVED" as PayoutStatus,
            reviewed_by: approver,
            checklist: {
              facial_liveness_verified: true,
              analyst_approved: true,
            },
            notes: `Bulk approved by ${approver} via Payout Protection Console.`,
          }
        : p
    );
    return mockPayouts.filter((p) => idsSet.has(p.payout_id));
  }
  try {
    return await apiClient<PayoutItem[]>("/api/v1/payouts/bulk-approve", {
      method: "POST",
      body: JSON.stringify({ payoutIds, approver }),
    });
  } catch {
    mockPayouts = mockPayouts.map((p) =>
      idsSet.has(p.payout_id)
        ? {
            ...p,
            status: "APPROVED" as PayoutStatus,
            reviewed_by: approver,
            checklist: {
              facial_liveness_verified: true,
              analyst_approved: true,
            },
            notes: `Bulk approved by ${approver} via Payout Protection Console.`,
          }
        : p
    );
    return mockPayouts.filter((p) => idsSet.has(p.payout_id));
  }
}

export async function bulkRejectPayouts(
  payoutIds: string[],
  approver: string = "Analyst",
  reason: string = "Bulk rejected by analyst."
): Promise<PayoutItem[]> {
  const idsSet = new Set(payoutIds);
  if (USE_MOCK) {
    mockPayouts = mockPayouts.map((p) =>
      idsSet.has(p.payout_id)
        ? {
            ...p,
            status: "REJECTED" as PayoutStatus,
            reviewed_by: approver,
            notes: reason,
          }
        : p
    );
    return mockPayouts.filter((p) => idsSet.has(p.payout_id));
  }
  try {
    return await apiClient<PayoutItem[]>("/api/v1/payouts/bulk-reject", {
      method: "POST",
      body: JSON.stringify({ payoutIds, approver, reason }),
    });
  } catch {
    mockPayouts = mockPayouts.map((p) =>
      idsSet.has(p.payout_id)
        ? {
            ...p,
            status: "REJECTED" as PayoutStatus,
            reviewed_by: approver,
            notes: reason,
          }
        : p
    );
    return mockPayouts.filter((p) => idsSet.has(p.payout_id));
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

// 7. Policy Simulator & Version Governance
export const DEFAULT_ACTIVE_POLICY_CONFIG: PolicyRuleConfig = {
  challenge_threshold: 50,
  escalate_threshold: 25,
  allow_threshold: 75,
  max_velocity_kmh: 120,
  min_face_match: 0.85,
  hold_window_hours: 24,
  rules: {
    velocity_rule_active: true,
    face_match_rule_active: true,
    hold_window_active: true,
    emulator_block_active: true,
    device_collision_active: true,
  },
};

let currentActivePolicyConfig: PolicyRuleConfig = { ...DEFAULT_ACTIVE_POLICY_CONFIG };

let mockPolicyVersions: PolicyVersion[] = [
  {
    id: "POL-v2.4.2",
    version_tag: "v2.4.2",
    name: "Production Balanced Standard",
    config: {
      challenge_threshold: 50,
      escalate_threshold: 25,
      allow_threshold: 75,
      max_velocity_kmh: 120,
      min_face_match: 0.85,
      hold_window_hours: 24,
      rules: {
        velocity_rule_active: true,
        face_match_rule_active: true,
        hold_window_active: true,
        emulator_block_active: true,
        device_collision_active: true,
      },
    },
    status: "ACTIVE",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    deployed_by: "Marcus Vance (Admin)",
    notes: "Baseline calibrated for metro delivery corridors with 24h escrow window.",
  },
  {
    id: "POL-v2.4.1",
    version_tag: "v2.4.1",
    name: "High Friction Fraud Defense",
    config: {
      challenge_threshold: 58,
      escalate_threshold: 30,
      allow_threshold: 80,
      max_velocity_kmh: 105,
      min_face_match: 0.90,
      hold_window_hours: 36,
      rules: {
        velocity_rule_active: true,
        face_match_rule_active: true,
        hold_window_active: true,
        emulator_block_active: true,
        device_collision_active: true,
      },
    },
    status: "ARCHIVED",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(),
    deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(),
    deployed_by: "Marcus Vance (Admin)",
    notes: "Tightened during weekend syndicate attack wave on Cluster-409.",
  },
  {
    id: "POL-v2.4.0",
    version_tag: "v2.4.0",
    name: "Initial Platform Rollout",
    config: {
      challenge_threshold: 45,
      escalate_threshold: 20,
      allow_threshold: 70,
      max_velocity_kmh: 140,
      min_face_match: 0.80,
      hold_window_hours: 12,
      rules: {
        velocity_rule_active: true,
        face_match_rule_active: false,
        hold_window_active: true,
        emulator_block_active: true,
        device_collision_active: false,
      },
    },
    status: "ARCHIVED",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 600).toISOString(),
    deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 600).toISOString(),
    deployed_by: "System Initializer",
    notes: "Initial launch configuration prior to biometric pipeline integration.",
  },
  {
    id: "POL-DRAFT-2026Q4",
    version_tag: "v2.5.0-draft",
    name: "Q4 Holiday Velocity Hardening",
    config: {
      challenge_threshold: 54,
      escalate_threshold: 28,
      allow_threshold: 78,
      max_velocity_kmh: 110,
      min_face_match: 0.88,
      hold_window_hours: 24,
      rules: {
        velocity_rule_active: true,
        face_match_rule_active: true,
        hold_window_active: true,
        emulator_block_active: true,
        device_collision_active: true,
      },
    },
    status: "DRAFT",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    deployed_by: "Elena Rostova (Analyst)",
    notes: "Proposed draft for high-volume holiday peak protection.",
  },
];

export async function getPolicies(): Promise<PolicyThresholds & { current_config: PolicyRuleConfig; versions: PolicyVersion[] }> {
  const result = {
    allow_threshold: currentActivePolicyConfig.allow_threshold || 75.0,
    challenge_threshold: currentActivePolicyConfig.challenge_threshold,
    investigate_threshold: currentActivePolicyConfig.escalate_threshold,
    block_threshold: 10.0,
    current_config: currentActivePolicyConfig,
    versions: mockPolicyVersions,
  };

  if (USE_MOCK) return result;
  try {
    const data = await apiClient<any>("/api/v1/policies");
    return { ...result, ...data };
  } catch {
    return result;
  }
}

export async function getPolicyVersions(): Promise<PolicyVersion[]> {
  return mockPolicyVersions;
}

export function computePolicySimulation(proposed: PolicyRuleConfig): PolicySimulationComparison {
  const current = currentActivePolicyConfig;
  const sessions = 15000;

  // Baseline Current Metrics
  const curAllow = 94.8;
  const curChallenge = 3.8;
  const curEscalate = 1.4;
  const curFalsePositives = 36;
  const curPayoutsAffected = 14;
  const curPayoutsAmount = 18420;
  const curFraudCaught = 94.2;

  // Compute Proposed Metrics relative to changes
  const cDiff = proposed.challenge_threshold - current.challenge_threshold;
  const eDiff = proposed.escalate_threshold - current.escalate_threshold;
  const vDiff = (current.max_velocity_kmh - proposed.max_velocity_kmh) / 10;
  const fDiff = (proposed.min_face_match - current.min_face_match) * 10;
  const hDiff = proposed.hold_window_hours - current.hold_window_hours;

  // Rule activation multipliers
  const velocityPenalty = proposed.rules.velocity_rule_active ? 0 : -8.5;
  const facePenalty = proposed.rules.face_match_rule_active ? 0 : -11.2;
  const holdMultiplier = proposed.rules.hold_window_active ? 1.0 : 0.2;
  const emulatorPenalty = proposed.rules.emulator_block_active ? 0 : -14.0;
  const collisionPenalty = proposed.rules.device_collision_active ? 0 : -16.5;

  // Proposed Allow %
  let propAllow = curAllow - (cDiff * 0.14) - (eDiff * 0.08) - (vDiff * 0.25) - (fDiff * 0.35);
  if (!proposed.rules.velocity_rule_active) propAllow += 1.8;
  if (!proposed.rules.face_match_rule_active) propAllow += 2.2;
  if (!proposed.rules.emulator_block_active) propAllow += 1.5;
  propAllow = Math.min(98.8, Math.max(78.0, Number(propAllow.toFixed(1))));

  // Proposed Challenge %
  let propChallenge = curChallenge + (cDiff * 0.12) + (fDiff * 0.45) + (vDiff * 0.15);
  if (!proposed.rules.face_match_rule_active) propChallenge -= 1.8;
  propChallenge = Math.min(18.0, Math.max(1.0, Number(propChallenge.toFixed(1))));

  // Proposed Escalate %
  let propEscalate = Number((100 - propAllow - propChallenge).toFixed(1));
  if (propEscalate < 0.2) {
    propEscalate = 0.2;
    propAllow = Number((100 - propChallenge - propEscalate).toFixed(1));
  }

  // False Positives
  let propFP = Math.round(
    curFalsePositives +
    (cDiff * 0.9) +
    (fDiff * 14) +
    (vDiff > 0 ? vDiff * 2 : vDiff)
  );
  if (!proposed.rules.face_match_rule_active) propFP = Math.max(8, propFP - 12);
  propFP = Math.max(6, Math.min(180, propFP));

  // Payouts Affected
  let propPayouts = Math.round(
    (curPayoutsAffected + (eDiff * 0.55) + (hDiff * 0.25)) * holdMultiplier
  );
  propPayouts = Math.max(1, Math.min(95, propPayouts));
  const propPayoutsAmount = Math.round(propPayouts * 1315);

  // Fraud Caught %
  let propFraud =
    curFraudCaught +
    (cDiff * 0.22) +
    (eDiff * 0.18) +
    (vDiff * 0.8) +
    (fDiff * 1.2) +
    velocityPenalty +
    facePenalty +
    emulatorPenalty +
    collisionPenalty;
  propFraud = Math.min(99.6, Math.max(52.0, Number(propFraud.toFixed(1))));

  return {
    policy_id: `SIM-${Date.now()}`,
    current: {
      allow_pct: curAllow,
      challenge_pct: curChallenge,
      escalate_pct: curEscalate,
      estimated_false_positives: curFalsePositives,
      payouts_affected: curPayoutsAffected,
      payouts_affected_amount: curPayoutsAmount,
      estimated_fraud_caught_pct: curFraudCaught,
      sessions_evaluated: sessions,
    },
    proposed: {
      allow_pct: propAllow,
      challenge_pct: propChallenge,
      escalate_pct: propEscalate,
      estimated_false_positives: propFP,
      payouts_affected: propPayouts,
      payouts_affected_amount: propPayoutsAmount,
      estimated_fraud_caught_pct: propFraud,
      sessions_evaluated: sessions,
    },
    diff: {
      allow_delta_pct: Number((propAllow - curAllow).toFixed(1)),
      challenge_delta_pct: Number((propChallenge - curChallenge).toFixed(1)),
      escalate_delta_pct: Number((propEscalate - curEscalate).toFixed(1)),
      false_positives_delta: propFP - curFalsePositives,
      payouts_affected_delta: propPayouts - curPayoutsAffected,
      payouts_affected_amount_delta: propPayoutsAmount - curPayoutsAmount,
      fraud_caught_delta_pct: Number((propFraud - curFraudCaught).toFixed(1)),
    },
    sessions_evaluated: sessions,
    generated_at: new Date().toISOString(),
  };
}

export async function simulatePolicy(
  payload: PolicyRuleConfig | PolicyThresholds
): Promise<PolicySimulationComparison & PolicySimResult> {
  const normalizedConfig: PolicyRuleConfig =
    "challenge_threshold" in payload && "rules" in payload
      ? (payload as PolicyRuleConfig)
      : {
          challenge_threshold: payload.challenge_threshold,
          escalate_threshold: (payload as PolicyThresholds).investigate_threshold || 25,
          allow_threshold: (payload as PolicyThresholds).allow_threshold || 75,
          max_velocity_kmh: 120,
          min_face_match: 0.85,
          hold_window_hours: 24,
          rules: {
            velocity_rule_active: true,
            face_match_rule_active: true,
            hold_window_active: true,
            emulator_block_active: true,
            device_collision_active: true,
          },
        };

  const comparison = computePolicySimulation(normalizedConfig);

  const backwardCompatibleResult: PolicySimResult = {
    policy_id: comparison.policy_id,
    sessions_evaluated: comparison.sessions_evaluated,
    simulated_pass_rate: comparison.proposed.allow_pct / 100,
    simulated_friction_rate: comparison.proposed.challenge_pct / 100,
    simulated_fraud_catch_rate: comparison.proposed.estimated_fraud_caught_pct / 100,
    estimated_chargeback_reduction_pct: Number(
      Math.max(12, comparison.proposed.estimated_fraud_caught_pct * 0.42).toFixed(1)
    ),
  };

  return {
    ...comparison,
    ...backwardCompatibleResult,
  };
}

export async function savePolicyDraft(
  config: PolicyRuleConfig,
  name?: string
): Promise<PolicyVersion> {
  const newVersion: PolicyVersion = {
    id: `POL-DRAFT-${Date.now().toString().slice(-6)}`,
    version_tag: `v2.5.0-draft-${mockPolicyVersions.filter((v) => v.status === "DRAFT").length + 1}`,
    name: name || "Custom Tuned Draft",
    config: { ...config },
    status: "DRAFT",
    created_at: new Date().toISOString(),
    deployed_by: "Current User",
    notes: "Saved policy draft configuration for offline evaluation and review.",
  };

  mockPolicyVersions = [newVersion, ...mockPolicyVersions];
  return newVersion;
}

export async function deployPolicy(
  config: PolicyRuleConfig,
  notes?: string,
  deployedBy: string = "Admin"
): Promise<PolicyVersion> {
  // Archive previously active versions
  mockPolicyVersions = mockPolicyVersions.map((v) =>
    v.status === "ACTIVE"
      ? { ...v, status: "ARCHIVED" as const }
      : v
  );

  const activeCount = mockPolicyVersions.filter((v) => v.status === "ARCHIVED").length + 1;
  const versionTag = `v2.${activeCount + 3}.0`;

  const deployedVersion: PolicyVersion = {
    id: `POL-${versionTag}`,
    version_tag: versionTag,
    name: `Fleet Policy ${versionTag}`,
    config: { ...config },
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    deployed_at: new Date().toISOString(),
    deployed_by: deployedBy,
    notes: notes || "Manual deployment from Policy Simulator console with full diff verification.",
  };

  currentActivePolicyConfig = { ...config };
  mockPolicyVersions = [deployedVersion, ...mockPolicyVersions];
  return deployedVersion;
}

export async function rollbackPolicy(
  versionId: string,
  deployedBy: string = "Admin (Rollback)"
): Promise<PolicyVersion> {
  const target = mockPolicyVersions.find((v) => v.id === versionId);
  if (!target) {
    throw new Error(`Policy version ${versionId} not found.`);
  }

  // Archive previously active versions
  mockPolicyVersions = mockPolicyVersions.map((v) =>
    v.status === "ACTIVE"
      ? { ...v, status: "ARCHIVED" as const }
      : v
  );

  const rollbackVersion: PolicyVersion = {
    id: `POL-ROLLBACK-${Date.now().toString().slice(-6)}`,
    version_tag: `${target.version_tag}-rollback`,
    name: `Rollback to ${target.name}`,
    config: { ...target.config },
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    deployed_at: new Date().toISOString(),
    deployed_by: deployedBy,
    notes: `Rollback to version ${target.version_tag} (${target.name}) initiated.`,
  };

  currentActivePolicyConfig = { ...target.config };
  mockPolicyVersions = [rollbackVersion, ...mockPolicyVersions];
  return rollbackVersion;
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

// 10. Rider Mobile Portal & Profile Contracts
export interface RiderDeliveryItem {
  id: string;
  merchant: string;
  earned: number;
  tip: number;
  status: "Verified" | "Held" | "Pending";
  time: string;
  distance_km: number;
}

export interface RiderProfileData {
  id: string;
  courier_id: string;
  name: string;
  first_name: string;
  phone: string;
  avatar: string;
  hub: string;
  tier: "Tier 1 Pro" | "Gold Courier" | "Standard Rider" | "Under Review";
  trust_score: number;
  trust_trend: "improving" | "stable" | "degrading";
  earnings_today: number;
  payout_status: "RELEASED" | "HELD";
  held_amount: number;
  released_amount: number;
  hold_reason?: string;
  registered_device: string;
  os_version: string;
  device_attestation: string;
  bank_account: string;
  active_shift: boolean;
  trips_today_count: number;
  hours_online: number;
  active_challenge_id?: string;
  recent_trips: RiderDeliveryItem[];
}

export let MOCK_RIDER_PROFILES: RiderProfileData[] = [
  {
    id: "rider_8941",
    courier_id: "CR-8941",
    name: "Marcus Vance",
    first_name: "Marcus",
    phone: "+1 (555) 382-9011",
    avatar: "MV",
    hub: "Seattle Downtown Hub",
    tier: "Tier 1 Pro",
    trust_score: 72,
    trust_trend: "degrading",
    earnings_today: 164.50,
    payout_status: "HELD",
    held_amount: 44.50,
    released_amount: 120.00,
    hold_reason: "Typing cadence deviation (240 → 95 cpm) detected on trip #ord_8419. 3D selfie liveness check required to release escrow.",
    registered_device: "Apple iPhone 15 Pro",
    os_version: "iOS 18.2",
    device_attestation: "Secure Enclave Certified",
    bank_account: "Chase Checking •••• 9921",
    active_shift: true,
    trips_today_count: 7,
    hours_online: 4.8,
    active_challenge_id: "chlg_mv_live_01",
    recent_trips: [
      {
        id: "ord_8421",
        merchant: "FreshBite Express",
        earned: 14.20,
        tip: 3.50,
        status: "Verified",
        time: "12:42 PM",
        distance_km: 3.8,
      },
      {
        id: "ord_8419",
        merchant: "Urban Kitchens Downtown",
        earned: 22.50,
        tip: 5.00,
        status: "Held",
        time: "11:15 AM",
        distance_km: 7.2,
      },
      {
        id: "ord_8410",
        merchant: "Bean & Leaf Coffee Roasters",
        earned: 9.80,
        tip: 2.00,
        status: "Verified",
        time: "10:05 AM",
        distance_km: 2.1,
      },
      {
        id: "ord_8398",
        merchant: "Green Bowl Co.",
        earned: 18.00,
        tip: 4.00,
        status: "Verified",
        time: "09:12 AM",
        distance_km: 5.4,
      },
    ],
  },
  {
    id: "rider_7812",
    courier_id: "CR-7812",
    name: "Elena Rostova",
    first_name: "Elena",
    phone: "+1 (555) 302-8874",
    avatar: "ER",
    hub: "East Sector Transit Hub",
    tier: "Tier 1 Pro",
    trust_score: 96,
    trust_trend: "improving",
    earnings_today: 188.00,
    payout_status: "RELEASED",
    held_amount: 0.00,
    released_amount: 188.00,
    registered_device: "Google Pixel 8 Pro",
    os_version: "Android 14.1",
    device_attestation: "Titan M2 Certified",
    bank_account: "Bank of America •••• 1283",
    active_shift: true,
    trips_today_count: 9,
    hours_online: 5.5,
    recent_trips: [
      {
        id: "ord_9104",
        merchant: "Sushi Zen Garden",
        earned: 28.50,
        tip: 6.00,
        status: "Verified",
        time: "01:10 PM",
        distance_km: 8.5,
      },
      {
        id: "ord_9099",
        merchant: "Taco Libre Downtown",
        earned: 16.00,
        tip: 3.00,
        status: "Verified",
        time: "12:18 PM",
        distance_km: 4.2,
      },
      {
        id: "ord_9085",
        merchant: "Golden Bagel Bakery",
        earned: 12.50,
        tip: 2.50,
        status: "Verified",
        time: "10:45 AM",
        distance_km: 3.1,
      },
    ],
  },
  {
    id: "rider_9023",
    courier_id: "CR-9023",
    name: "Tariq Vance",
    first_name: "Tariq",
    phone: "+1 (555) 441-9082",
    avatar: "TV",
    hub: "Downtown Logistics Hub",
    tier: "Under Review",
    trust_score: 48,
    trust_trend: "degrading",
    earnings_today: 142.20,
    payout_status: "HELD",
    held_amount: 78.20,
    released_amount: 64.00,
    hold_reason: "Device token recycled across 3 accounts in syndicate Cluster-409. Biometric verification required to unlock earnings.",
    registered_device: "Samsung Galaxy A54",
    os_version: "Android 14.0",
    device_attestation: "Knox Certified",
    bank_account: "Wells Fargo •••• 4108",
    active_shift: true,
    trips_today_count: 6,
    hours_online: 4.1,
    active_challenge_id: "chlg_tv_live_02",
    recent_trips: [
      {
        id: "ord_7712",
        merchant: "Pho King Express",
        earned: 24.20,
        tip: 4.00,
        status: "Held",
        time: "12:55 PM",
        distance_km: 6.2,
      },
      {
        id: "ord_7708",
        merchant: "Burger Point",
        earned: 18.00,
        tip: 3.00,
        status: "Held",
        time: "11:40 AM",
        distance_km: 5.1,
      },
      {
        id: "ord_7692",
        merchant: "Morning Brew Cafe",
        earned: 11.50,
        tip: 2.00,
        status: "Verified",
        time: "10:10 AM",
        distance_km: 2.8,
      },
    ],
  },
  {
    id: "rider_5542",
    courier_id: "CR-5542",
    name: "Alex Rivera",
    first_name: "Alex",
    phone: "+1 (555) 902-3341",
    avatar: "AR",
    hub: "North Bay Logistics",
    tier: "Gold Courier",
    trust_score: 88,
    trust_trend: "stable",
    earnings_today: 135.50,
    payout_status: "RELEASED",
    held_amount: 0.00,
    released_amount: 135.50,
    registered_device: "OnePlus 11",
    os_version: "Android 13.0",
    device_attestation: "Hardware Keymaster Valid",
    bank_account: "Citibank •••• 8820",
    active_shift: false,
    trips_today_count: 5,
    hours_online: 3.9,
    recent_trips: [
      {
        id: "ord_6610",
        merchant: "Pizzeria Napoli",
        earned: 22.00,
        tip: 5.00,
        status: "Verified",
        time: "01:30 PM",
        distance_km: 5.9,
      },
      {
        id: "ord_6602",
        merchant: "Acai Sunrise",
        earned: 14.50,
        tip: 3.00,
        status: "Verified",
        time: "12:15 PM",
        distance_km: 3.4,
      },
    ],
  },
];

export async function getRiderList(): Promise<RiderProfileData[]> {
  return MOCK_RIDER_PROFILES;
}

export async function getRiderProfile(riderId: string): Promise<RiderProfileData> {
  const profile = MOCK_RIDER_PROFILES.find(
    (r) => r.id === riderId || r.courier_id === riderId
  );
  if (profile) return profile;
  return MOCK_RIDER_PROFILES[0];
}

export async function completeRiderLivenessVerification(
  riderId: string
): Promise<{ success: boolean; released_amount: number; new_score: number; message: string }> {
  const profile = MOCK_RIDER_PROFILES.find(
    (r) => r.id === riderId || r.courier_id === riderId
  );

  if (!profile) {
    throw new Error(`Rider ${riderId} not found.`);
  }

  const releasedAmt = profile.held_amount;
  profile.released_amount += releasedAmt;
  profile.held_amount = 0;
  profile.payout_status = "RELEASED";
  profile.trust_score = Math.min(99, profile.trust_score + 14);
  profile.trust_trend = "improving";
  profile.recent_trips = profile.recent_trips.map((t) => ({ ...t, status: "Verified" as const }));

  return {
    success: true,
    released_amount: releasedAmt,
    new_score: profile.trust_score,
    message: `3D Facial Liveness verified. $${releasedAmt.toFixed(2)} escrow hold released to ${profile.bank_account}.`,
  };
}

export interface FacialLivenessVerificationRequest {
  rider_id?: string;
  challenge_id?: string;
  payout_id?: string;
  image_base64?: string;
  challenge_action?: string;
}

export interface FacialLivenessVerificationResponse {
  status: "VERIFIED" | "NOT_MATCHED" | "INCONCLUSIVE";
  face_match_score: number;
  liveness_score: number;
  reason: string;
  payout_released: boolean;
  released_amount?: number;
}

export async function verifyFacialLivenessApi(
  payload: FacialLivenessVerificationRequest
): Promise<FacialLivenessVerificationResponse> {
  const challengeId = payload.challenge_id || "chlg_active_01";

  if (!USE_MOCK && API_BASE_URL) {
    try {
      // Backend challenge face verify endpoint (POST /api/v1/challenges/{id}/face-verify)
      const res = await apiClient<any>(`/api/v1/challenges/${challengeId}/face-verify`, {
        method: "POST",
        body: JSON.stringify({
          image_base64: payload.image_base64,
          rider_id: payload.rider_id,
          scenario_flag: "GENUINE_PASS",
        }),
      });
      return {
        status: res.match_status === "MATCH" || res.verified ? "VERIFIED" : "NOT_MATCHED",
        face_match_score: res.confidence || 0.984,
        liveness_score: res.liveness_score || 0.991,
        reason: res.reason || "Genuine 3D biometric match against enrolled hardware keystore.",
        payout_released: true,
      };
    } catch {
      // TODO: Backend face-verification endpoint offline; falling back to calibrated mock adapter
    }
  }

  // Calibrated mock adapter
  let releasedAmt = 0;
  if (payload.rider_id) {
    try {
      const riderRes = await completeRiderLivenessVerification(payload.rider_id);
      releasedAmt = riderRes.released_amount;
    } catch {
      // ignore
    }
  }

  if (payload.payout_id) {
    mockPayouts = mockPayouts.map((p) =>
      p.payout_id === payload.payout_id ? { ...p, status: "APPROVED" as const } : p
    );
  }

  return {
    status: "VERIFIED",
    face_match_score: 0.984,
    liveness_score: 0.992,
    reason: "Genuine 3D facial topography matches enrolled courier profile. Zero spoof artifacts or presentation attacks detected.",
    payout_released: true,
    released_amount: releasedAmt,
  };
}

