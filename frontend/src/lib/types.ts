/**
 * TrustJuggler v2 Contract TypeScript Definitions
 * Aligned with docs/api-contract.md and shared/fixtures/
 */

export type Role = "admin" | "analyst" | "investigator" | "finance" | "rider" | "system";

export type Verdict = "ALLOW" | "CHALLENGE" | "INVESTIGATE" | "BLOCK";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ThreatTag =
  | "CLEAN"
  | "ORDINARY_CHANGE"
  | "DEVICE_ANOMALY"
  | "GEO_SPOOF"
  | "ACCOUNT_HANDOFF"
  | "COLLUSION_RING"
  | "DEVICE_FARM"
  | "EMULATOR_DETECTED"
  | "PAYOUT_RISK";

export interface DevicePassport {
  device_id_hash: string;
  device_model: string;
  os_version: string;
  app_version: string;
  ip_address: string;
  carrier?: string;
  vpn_detected: boolean;
  mock_location_detected: boolean;
  rooted_or_jailbroken: boolean;
  screen_resolution?: string;
  battery_drain_rate_pct_hr?: number;
  first_seen?: string;
  last_seen?: string;
  associated_identities_count?: number;
}

export interface BiometricsTelemetry {
  face_present: boolean;
  face_match_confidence: number;
  liveness_score: number;
  biometric_backend: "simulated" | "deepface" | "insightface";
}

export interface MotionTelemetry {
  speed_kmh: number;
  acceleration_variance: number;
  gyro_stability: number;
  typing_cadence_cpm: number;
  route_deviation_pct: number;
  trip_distance_km: number;
  elapsed_minutes: number;
}

export interface LocationTelemetry {
  lat: number;
  lng: number;
  accuracy_meters: number;
  geofence_id?: string;
  zone_risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface FinancialTelemetry {
  fare_amount: number;
  currency: string;
  payment_method: string;
  tip_amount: number;
  promo_applied: boolean;
}

export interface SessionRequest {
  session_id: string;
  rider_id: string;
  driver_id: string;
  timestamp: string;
  device_passport: DevicePassport;
  biometrics: BiometricsTelemetry;
  telemetry: MotionTelemetry;
  location: LocationTelemetry;
  financial: FinancialTelemetry;
}

export interface Factor {
  name: string;
  category: "DEVICE" | "BIOMETRIC" | "TELEMETRY" | "LOCATION" | "GRAPH" | "PAYOUT";
  impact: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  weight: number;
  score: number;
  description: string;
}

export interface Challenge {
  challenge_id: string;
  session_id: string;
  challenge_type: "FACE_LIVENESS" | "DEVICE_REAUTH" | "SMS_OTP" | "STEP_UP";
  status: "PENDING" | "PASSED" | "FAILED" | "EXPIRED";
  expires_at: string;
  created_at: string;
}

export interface Case {
  case_id: string;
  session_id: string;
  rider_id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED_LEGIT" | "CONFIRMED_FRAUD";
  assigned_to: string | null;
  threat_summary?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Cluster {
  cluster_id: string;
  name: string;
  nodes_count: number;
  shared_identifiers: string[];
  risk_score: number;
  status: "ACTIVE" | "MONITORED" | "DISRUPTED";
}

export interface PayoutDecision {
  status: "APPROVED" | "ESCROW_HOLD" | "DENIED";
  hold_reason: string | null;
  hold_period_hours: number;
}

export interface Payout {
  payout_id: string;
  rider_id: string;
  driver_id?: string;
  amount: number;
  currency: string;
  destination_account: string;
  status: "RELEASED" | "ESCROW_HOLD" | "BLOCKED";
  hold_reason?: string | null;
  hold_expires_at?: string | null;
  created_at: string;
}

export interface TrustScore {
  score: number; // 0.0 - 100.0
  trend: "STABLE" | "IMPROVING" | "DEGRADING";
  confidence: number;
  last_updated: string;
}

export interface PolicySim {
  policy_id: string;
  cut_lines: {
    allow_threshold: number;
    challenge_threshold: number;
    investigate_threshold: number;
    block_threshold: number;
  };
  sessions_evaluated: number;
  simulated_pass_rate: number;
  simulated_friction_rate: number;
  simulated_fraud_catch_rate: number;
  estimated_chargeback_reduction_pct?: number;
}

export interface Assessment {
  assessment_id: string;
  session_id: string;
  rider_id: string;
  trust_score: number;
  verdict: Verdict;
  risk_tier: RiskTier;
  threat_tags: ThreatTag[];
  factors: Factor[];
  challenge: Challenge | null;
  case_id: string | null;
  payout_decision?: PayoutDecision;
  evaluated_at: string;
}

export interface HealthStatus {
  status: string;
  model_version: string;
  policy_version: string;
}

export interface FaceEnrollResponse {
  template_id: string;
  rider_id: string;
  model_name: string;
  template_version: string;
  raw_image_stored: boolean;
  embedding_hash: string;
  retention_until?: string | null;
  created_at: string;
}

export interface LivenessPrompt {
  challenge_id: string;
  prompt: string;
  nonce: string;
  expires_at: string;
}

export interface FaceVerifyResponse {
  challenge_id: string;
  session_id: string;
  rider_id: string;
  passed: boolean;
  similarity: number;
  threshold: number;
  liveness_score: number;
  liveness_passed: boolean;
  spoof_type?: string | null;
  prompt_results?: Record<string, unknown> | null;
  new_verdict: string;
  device_trusted: boolean;
  raw_image_stored: boolean;
  message: string;
  fallback_available: boolean;
  fallback_options: string[];
}

export interface ChallengeFallbackResponse {
  challenge_id: string;
  status: string;
  fallback_type: string;
  new_verdict?: string | null;
  case_id?: string | null;
  message: string;
}
