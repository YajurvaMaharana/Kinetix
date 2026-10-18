export interface FleetAlert {
  id: string;
  courier_id: string;
  name: string;
  hub: string;
  risk_factor: string;
  ai_risk: number;
  status: "Allow" | "Challenge" | "Escalate";
  avatarBg: string;
}

export interface PayoutApproval {
  id: string;
  amount: number;
  type: string;
  reason: string;
  status: "IBAN Conflict" | "Spatial Drift" | "Velocity Jump";
  timestamp: string;
}

export interface RiderDelivery {
  id: string;
  merchant: string;
  earned: number;
  status: "Verified" | "GPS Pending" | "Escalated";
  time: string;
}

export const MOCK_STATS = {
  totalActiveCouriers: "42,810",
  activeCouriersGrowth: "+6.2% vs yesterday",
  collusionRings: "14",
  collusionHighPriority: "3 High Priority isolated by AI",
  payoutsUnderReview: "$18,420",
  payoutsPendingCount: "8 active challenges",
  automatedReleaseRate: "98.7%",
  automatedDisputeRate: "0.02% appeal index",
};

export const MOCK_ALERTS: FleetAlert[] = [
  {
    id: "al_1",
    courier_id: "CR-8941",
    name: "Alex Rivera",
    hub: "North Hub",
    risk_factor: "Mock GPS Velocity Jump",
    ai_risk: 89,
    status: "Escalate",
    avatarBg: "bg-rose-500/20 text-rose-400",
  },
  {
    id: "al_2",
    courier_id: "CR-9023",
    name: "Tariq Vance",
    hub: "Downtown",
    risk_factor: "Shared Device Fingerprint",
    ai_risk: 64,
    status: "Challenge",
    avatarBg: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "al_3",
    courier_id: "CR-7812",
    name: "Elena Rostova",
    hub: "East Sector",
    risk_factor: "Legitimate Route Trajectory",
    ai_risk: 11,
    status: "Allow",
    avatarBg: "bg-emerald-500/20 text-emerald-400",
  },
  {
    id: "al_4",
    courier_id: "CR-6650",
    name: "Kenji Sato",
    hub: "Metro Core",
    risk_factor: "Dual-App Active Delivery",
    ai_risk: 72,
    status: "Challenge",
    avatarBg: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "al_5",
    courier_id: "CR-5542",
    name: "David Kim",
    hub: "South Bay",
    risk_factor: "Teleportation Spoof",
    ai_risk: 94,
    status: "Escalate",
    avatarBg: "bg-rose-500/20 text-rose-400",
  },
];

export const MOCK_PENDING_PAYOUTS: PayoutApproval[] = [
  {
    id: "pay_1",
    amount: 1240.00,
    type: "Shift Batch 14B",
    reason: "3 separate riders registered to identical banking coordinates within 48h.",
    status: "IBAN Conflict",
    timestamp: "Next ACH: 42m",
  },
  {
    id: "pay_2",
    amount: 480.50,
    type: "Express Payout",
    reason: "GPS telemetry reveals an impossible jump of 8.4km during active order drop-off handoff.",
    status: "Spatial Drift",
    timestamp: "Pending Verification",
  },
];

export const MOCK_RIDER_DELIVERIES: RiderDelivery[] = [
  {
    id: "ord_8421",
    merchant: "FreshBite Express",
    earned: 14.20,
    status: "Verified",
    time: "12:42 PM",
  },
  {
    id: "ord_8419",
    merchant: "Urban Kitchens",
    earned: 22.50,
    status: "GPS Pending",
    time: "11:15 AM",
  },
  {
    id: "ord_8410",
    merchant: "Bean & Leaf Cafe",
    earned: 9.80,
    status: "Verified",
    time: "10:05 AM",
  },
];
