import { useState, useEffect, useRef, useCallback } from "react";
import { DateRangePreset, Granularity } from "@/context/DateRangeContext";
import { USE_MOCK, apiClient } from "@/api/client";
import { PayoutApproval, FleetAlert } from "@/data/mockData";

export interface ChartPoint {
  label: string;
  timestamp: string;
  nominal: number;
  challenges: number;
  spoofs: number;
}

export interface OverviewMetrics {
  activeCouriers: string;
  activeCouriersGrowth: string;
  collusionRings: string;
  collusionHighPriorityText: string;
  payoutsUnderReview: string;
  payoutsPendingCountText: string;
  automatedReleaseRate: string;
  disputeRateText: string;
  comparisonLabel: string;
}

export interface OverviewData {
  metrics: OverviewMetrics;
  chart: {
    points: ChartPoint[];
    granularity: Granularity;
    nominalTotal: number;
    challengeTotal: number;
    spoofTotal: number;
    callout1?: { time: string; title: string; subtitle: string };
    callout2?: { time: string; title: string; subtitle: string };
  };
  pendingPayouts: PayoutApproval[];
  alerts: FleetAlert[];
  fetchedAt: string; // HH:MM:SS
  source: "mock" | "api";
}

// Deterministic string hash
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

// Generate deterministic custom range data
function generateCustomRangeData(
  fromIso: string,
  toIso: string,
  granularity: Granularity
): OverviewData {
  const d1 = new Date(fromIso);
  const d2 = new Date(toIso);
  const diffTime = Math.max(1000 * 60 * 60 * 24, d2.getTime() - d1.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  let totalCouriers = 0;
  let totalRings = 0;
  let totalPayoutsAmount = 0;
  let sumReleaseRate = 0;

  const cur = new Date(d1);
  for (let i = 0; i < diffDays; i++) {
    const dayStr = cur.toISOString().slice(0, 10);
    const h = hashString(dayStr);

    // approx 6,000 couriers/day (5,800 + 0..400)
    totalCouriers += 5800 + (h % 400);

    // approx 1.8 rings/day (80% chance of 2, 20% chance of 1)
    totalRings += (h % 100) < 80 ? 2 : 1;

    // approx $2,600/day under review ($2,400 + 0..400)
    totalPayoutsAmount += 2400 + (h % 400);

    // release rate approx 98.7% +/- 0.5% (98.2% + 0..1%)
    sumReleaseRate += 98.2 + ((h % 100) / 100);

    cur.setDate(cur.getDate() + 1);
  }

  const avgReleaseRate = (sumReleaseRate / diffDays).toFixed(1);
  const highPriorityRings = Math.max(1, Math.round(totalRings * 0.22));
  const pendingCount = Math.max(2, Math.round(diffDays * 1.1));
  const growthPct = (3.5 + (hashString(fromIso + toIso) % 80) / 10).toFixed(1);
  const disputeRate = (0.015 + ((hashString(fromIso) % 20) / 1000)).toFixed(2);

  // Generate chart points according to granularity and range length
  let chartPoints: ChartPoint[] = [];
  if (granularity === "hourly") {
    // 24 points per day up to 48 points
    const totalHours = Math.min(48, Math.max(12, diffDays * 24));
    for (let h = 0; h < totalHours; h++) {
      const hStr = `${String(h % 24).padStart(2, "0")}:00`;
      const pHash = hashString(`${fromIso}_h_${h}`);
      chartPoints.push({
        label: hStr,
        timestamp: `${hStr} UTC`,
        nominal: 280 + (pHash % 120),
        challenges: 22 + (pHash % 18),
        spoofs: 4 + (pHash % 9),
      });
    }
  } else if (granularity === "daily") {
    // 1 point per day
    const ptCur = new Date(d1);
    for (let d = 0; d < diffDays; d++) {
      const label = ptCur.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const pHash = hashString(`${fromIso}_d_${d}`);
      chartPoints.push({
        label,
        timestamp: label,
        nominal: 5400 + (pHash % 1100),
        challenges: 420 + (pHash % 120),
        spoofs: 48 + (pHash % 32),
      });
      ptCur.setDate(ptCur.getDate() + 1);
    }
  } else {
    // weekly
    const weeks = Math.max(2, Math.ceil(diffDays / 7));
    const ptCur = new Date(d1);
    for (let w = 0; w < weeks; w++) {
      const label = `Wk ${w + 1} (${ptCur.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
      const pHash = hashString(`${fromIso}_w_${w}`);
      chartPoints.push({
        label,
        timestamp: label,
        nominal: 36000 + (pHash % 7000),
        challenges: 2800 + (pHash % 800),
        spoofs: 320 + (pHash % 140),
      });
      ptCur.setDate(ptCur.getDate() + 7);
    }
  }

  const nominalTotal = chartPoints.reduce((acc, p) => acc + p.nominal, 0);
  const challengeTotal = chartPoints.reduce((acc, p) => acc + p.challenges, 0);
  const spoofTotal = chartPoints.reduce((acc, p) => acc + p.spoofs, 0);

  // Dynamic Pending Payouts
  const pendingPayouts: PayoutApproval[] = [
    {
      id: `pay_c_1`,
      amount: Math.round((totalPayoutsAmount * 0.38) * 100) / 100,
      type: "Custom Range Escrow",
      reason: "Bipartite link centrality detected 3 shared routing numbers.",
      status: "IBAN Conflict",
      timestamp: "Next ACH: 35m",
    },
    {
      id: `pay_c_2`,
      amount: Math.round((totalPayoutsAmount * 0.24) * 100) / 100,
      type: "Express Disbursement",
      reason: "Kinematic GPS velocity jump detected across urban toll bridge.",
      status: "Velocity Jump",
      timestamp: "Pending Verification",
    },
    {
      id: `pay_c_3`,
      amount: Math.round((totalPayoutsAmount * 0.18) * 100) / 100,
      type: "Shift Batch",
      reason: "Accelerometer drift inconsistent with designated delivery route.",
      status: "Spatial Drift",
      timestamp: "Under Analyst Review",
    },
  ];

  // Dynamic Alerts
  const alerts: FleetAlert[] = [
    {
      id: "al_c1",
      courier_id: "CR-8941",
      name: "Alex Rivera",
      hub: "Downtown",
      risk_factor: "Mock GPS Velocity Jump",
      ai_risk: 89,
      status: "Escalate",
      avatarBg: "bg-rose-500/20 text-rose-400",
    },
    {
      id: "al_c2",
      courier_id: "CR-9023",
      name: "Tariq Vance",
      hub: "North Hub",
      risk_factor: "Shared Device Fingerprint",
      ai_risk: 64,
      status: "Challenge",
      avatarBg: "bg-amber-500/20 text-amber-400",
    },
    {
      id: "al_c3",
      courier_id: "CR-7812",
      name: "Elena Rostova",
      hub: "East Sector",
      risk_factor: "Legitimate Route Trajectory",
      ai_risk: 11,
      status: "Allow",
      avatarBg: "bg-emerald-500/20 text-emerald-400",
    },
    {
      id: "al_c4",
      courier_id: "CR-5542",
      name: "David Kim",
      hub: "South Bay",
      risk_factor: "Teleportation Spoof",
      ai_risk: 94,
      status: "Escalate",
      avatarBg: "bg-rose-500/20 text-rose-400",
    },
  ];

  return {
    metrics: {
      activeCouriers: totalCouriers.toLocaleString(),
      activeCouriersGrowth: `+${growthPct}% vs previous period`,
      collusionRings: totalRings.toString(),
      collusionHighPriorityText: `${highPriorityRings} High Priority`,
      payoutsUnderReview: `$${totalPayoutsAmount.toLocaleString()}`,
      payoutsPendingCountText: `${pendingCount} pending`,
      automatedReleaseRate: `${avgReleaseRate}%`,
      disputeRateText: `${disputeRate}% dispute`,
      comparisonLabel: "vs previous period",
    },
    chart: {
      points: chartPoints,
      granularity,
      nominalTotal,
      challengeTotal,
      spoofTotal,
      callout1: {
        time: "Mid-Period Peak",
        title: "Syndicate Burst",
        subtitle: `${Math.round(totalRings * 0.4)} Suspicious Vectors`,
      },
      callout2: {
        time: "Current Trajectory",
        title: "Model Baseline",
        subtitle: "99.1% Confidence Threshold",
      },
    },
    pendingPayouts,
    alerts,
    fetchedAt: new Date().toLocaleTimeString("en-US", { hour12: false }),
    source: "mock",
  };
}

// Generate exact preset mock data
function generatePresetMockData(preset: "today" | "7d" | "30d"): OverviewData {
  const fetchedAt = new Date().toLocaleTimeString("en-US", { hour12: false });

  if (preset === "today") {
    // 24 hourly points
    const points: ChartPoint[] = Array.from({ length: 24 }).map((_, i) => {
      const hStr = `${String(i).padStart(2, "0")}:00`;
      const isPeak = i >= 11 && i <= 14;
      const isNight = i < 6;
      return {
        label: hStr,
        timestamp: `${hStr} UTC`,
        nominal: isNight ? 110 + i * 15 : isPeak ? 680 + (i % 3) * 60 : 380 + (i % 5) * 45,
        challenges: isNight ? 8 : isPeak ? 48 + (i % 2) * 12 : 22 + (i % 3) * 6,
        spoofs: isPeak ? 14 : i === 19 ? 18 : 2 + (i % 3),
      };
    });

    const pendingPayouts: PayoutApproval[] = [
      {
        id: "pay_t1",
        amount: 1850.0,
        type: "Express Shift Batch",
        reason: "GPS telemetry indicates 8.4km jump during active delivery drop-off.",
        status: "Spatial Drift",
        timestamp: "Next ACH: 42m",
      },
      {
        id: "pay_t2",
        amount: 880.0,
        type: "Instant Cashout",
        reason: "Reported speed exceeded 110 km/h without vehicular handoff.",
        status: "Velocity Jump",
        timestamp: "Pending Verification",
      },
    ];

    const alerts: FleetAlert[] = [
      {
        id: "al_t1",
        courier_id: "CR-8941",
        name: "Alex Rivera",
        hub: "North Hub",
        risk_factor: "Mock GPS Velocity Jump",
        ai_risk: 89,
        status: "Escalate",
        avatarBg: "bg-rose-500/20 text-rose-400",
      },
      {
        id: "al_t2",
        courier_id: "CR-9023",
        name: "Tariq Vance",
        hub: "Downtown",
        risk_factor: "Shared Device Fingerprint",
        ai_risk: 64,
        status: "Challenge",
        avatarBg: "bg-amber-500/20 text-amber-400",
      },
      {
        id: "al_t3",
        courier_id: "CR-5542",
        name: "David Kim",
        hub: "South Bay",
        risk_factor: "Teleportation Spoof",
        ai_risk: 94,
        status: "Escalate",
        avatarBg: "bg-rose-500/20 text-rose-400",
      },
    ];

    return {
      metrics: {
        activeCouriers: "9,640",
        activeCouriersGrowth: "+1.8% vs yesterday",
        collusionRings: "3",
        collusionHighPriorityText: "1 High Priority",
        payoutsUnderReview: "$2,730",
        payoutsPendingCountText: "2 pending",
        automatedReleaseRate: "99.1%",
        disputeRateText: "0.01% dispute",
        comparisonLabel: "vs yesterday",
      },
      chart: {
        points,
        granularity: "hourly",
        nominalTotal: points.reduce((acc, p) => acc + p.nominal, 0),
        challengeTotal: points.reduce((acc, p) => acc + p.challenges, 0),
        spoofTotal: points.reduce((acc, p) => acc + p.spoofs, 0),
        callout1: { time: "14:22 UTC", title: "Ring Spoof Burst", subtitle: "6 Device Spoofs Detected" },
        callout2: { time: "19:40 UTC", title: "Mock GPS Burst", subtitle: "Velocity Vector > 140km/h" },
      },
      pendingPayouts,
      alerts,
      fetchedAt,
      source: "mock",
    };
  }

  if (preset === "7d") {
    // 7 daily points
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayIndex = new Date().getDay();
    const points: ChartPoint[] = Array.from({ length: 7 }).map((_, i) => {
      const dIndex = (todayIndex - (6 - i) + 7) % 7;
      const label = dayNames[dIndex];
      const isWeekend = dIndex === 0 || dIndex === 6;
      return {
        label,
        timestamp: `${label} Summary`,
        nominal: isWeekend ? 6800 : 5900 + (i % 3) * 350,
        challenges: isWeekend ? 490 : 410 + (i % 4) * 30,
        spoofs: isWeekend ? 58 : 34 + (i % 3) * 12,
      };
    });

    const pendingPayouts: PayoutApproval[] = [
      {
        id: "pay_1",
        amount: 1240.0,
        type: "Shift Batch 14B",
        reason: "3 separate riders registered to identical banking coordinates within 48h.",
        status: "IBAN Conflict",
        timestamp: "Next ACH: 42m",
      },
      {
        id: "pay_2",
        amount: 480.5,
        type: "Express Payout",
        reason: "GPS telemetry reveals an impossible jump of 8.4km during active order drop-off handoff.",
        status: "Spatial Drift",
        timestamp: "Pending Verification",
      },
      {
        id: "pay_3",
        amount: 2850.0,
        type: "Weekly Settlement",
        reason: "Collusion Cluster #C-902 member linked to multi-phone hardware passport.",
        status: "IBAN Conflict",
        timestamp: "Manual Review Required",
      },
      {
        id: "pay_4",
        amount: 3120.0,
        type: "Batch 18A",
        reason: "Telemetry discontinuity with 184 km/h displacement.",
        status: "Velocity Jump",
        timestamp: "Awaiting Analyst Approval",
      },
      {
        id: "pay_5",
        amount: 1450.0,
        type: "Dual Terminal Hold",
        reason: "Two phones pinging identical cell tower route simultaneously.",
        status: "Spatial Drift",
        timestamp: "In Triage Queue",
      },
      {
        id: "pay_6",
        amount: 2150.0,
        type: "Teleportation Investigation",
        reason: "Synthetic NMEA sentences detected without satellite constellation SNR.",
        status: "Velocity Jump",
        timestamp: "Escalated to Case",
      },
      {
        id: "pay_7",
        amount: 4280.0,
        type: "Syndicate Hold",
        reason: "Routing number shared across 5 suspended accounts.",
        status: "IBAN Conflict",
        timestamp: "Permanent Escrow Quarantine",
      },
      {
        id: "pay_8",
        amount: 2849.5,
        type: "High-Risk Batch",
        reason: "Mock location provider flag active during dropoff.",
        status: "Velocity Jump",
        timestamp: "Analyst Flagged",
      },
    ];

    const alerts: FleetAlert[] = [
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

    return {
      metrics: {
        activeCouriers: "42,810",
        activeCouriersGrowth: "+6.2% vs previous 7 days",
        collusionRings: "14",
        collusionHighPriorityText: "3 High Priority",
        payoutsUnderReview: "$18,420",
        payoutsPendingCountText: "8 pending",
        automatedReleaseRate: "98.7%",
        disputeRateText: "0.02% dispute",
        comparisonLabel: "vs previous 7 days",
      },
      chart: {
        points,
        granularity: "daily",
        nominalTotal: points.reduce((acc, p) => acc + p.nominal, 0),
        challengeTotal: points.reduce((acc, p) => acc + p.challenges, 0),
        spoofTotal: points.reduce((acc, p) => acc + p.spoofs, 0),
        callout1: { time: "Thu Shift", title: "Syndicate Surge", subtitle: "14 Rings Intercepted" },
        callout2: { time: "Sat Peak", title: "Weekend High Flow", subtitle: "98.8% Auto Released" },
      },
      pendingPayouts,
      alerts,
      fetchedAt,
      source: "mock",
    };
  }

  // 30d
  const points: ChartPoint[] = Array.from({ length: 30 }).map((_, i) => {
    const label = `Day ${i + 1}`;
    const pHash = hashString(`30d_${i}`);
    return {
      label,
      timestamp: `Day ${i + 1}`,
      nominal: 5200 + (pHash % 1400),
      challenges: 380 + (pHash % 140),
      spoofs: 36 + (pHash % 30),
    };
  });

  const pendingPayouts: PayoutApproval[] = [
    {
      id: "pay_30_1",
      amount: 14200.0,
      type: "Syndicate Escrow Batch #1",
      reason: "Bipartite link centrality detected 8 shared bank accounts.",
      status: "IBAN Conflict",
      timestamp: "31 total pending in queue",
    },
    {
      id: "pay_30_2",
      amount: 11450.0,
      type: "Automated Device Farm Batch",
      reason: "Root hide & synthetic location injection across 12 couriers.",
      status: "Velocity Jump",
      timestamp: "Quarantine Active",
    },
    {
      id: "pay_30_3",
      amount: 9800.0,
      type: "Ghost Order Ring",
      reason: "Dual-app colocation transit without customer physical handoff.",
      status: "Spatial Drift",
      timestamp: "Awaiting Forensic Audit",
    },
    {
      id: "pay_30_4",
      amount: 8750.0,
      type: "Express Telemetry Hold",
      reason: "Repeated GNSS Doppler phase shift jumps exceeding 160 km/h.",
      status: "Velocity Jump",
      timestamp: "Analyst Escrow Hold",
    },
  ];

  const alerts: FleetAlert[] = [
    {
      id: "al_30_1",
      courier_id: "CR-8941",
      name: "Alex Rivera",
      hub: "North Hub",
      risk_factor: "Mock GPS Velocity Jump",
      ai_risk: 89,
      status: "Escalate",
      avatarBg: "bg-rose-500/20 text-rose-400",
    },
    {
      id: "al_30_2",
      courier_id: "CR-9023",
      name: "Tariq Vance",
      hub: "Downtown",
      risk_factor: "Shared Device Fingerprint",
      ai_risk: 64,
      status: "Challenge",
      avatarBg: "bg-amber-500/20 text-amber-400",
    },
    {
      id: "al_30_3",
      courier_id: "CR-7812",
      name: "Elena Rostova",
      hub: "East Sector",
      risk_factor: "Legitimate Route Trajectory",
      ai_risk: 11,
      status: "Allow",
      avatarBg: "bg-emerald-500/20 text-emerald-400",
    },
    {
      id: "al_30_4",
      courier_id: "CR-6650",
      name: "Kenji Sato",
      hub: "Metro Core",
      risk_factor: "Dual-App Active Delivery",
      ai_risk: 72,
      status: "Challenge",
      avatarBg: "bg-amber-500/20 text-amber-400",
    },
    {
      id: "al_30_5",
      courier_id: "CR-5542",
      name: "David Kim",
      hub: "South Bay",
      risk_factor: "Teleportation Spoof",
      ai_risk: 94,
      status: "Escalate",
      avatarBg: "bg-rose-500/20 text-rose-400",
    },
    {
      id: "al_30_6",
      courier_id: "CR-4402",
      name: "Aria Thorne",
      hub: "Airport Corridor",
      risk_factor: "Inertial Sensor Anomaly",
      ai_risk: 68,
      status: "Challenge",
      avatarBg: "bg-amber-500/20 text-amber-400",
    },
    {
      id: "al_30_7",
      courier_id: "CR-1209",
      name: "Liam O'Connor",
      hub: "North Hub",
      risk_factor: "Clean Biometric Shift",
      ai_risk: 8,
      status: "Allow",
      avatarBg: "bg-emerald-500/20 text-emerald-400",
    },
    {
      id: "al_30_8",
      courier_id: "CR-1904",
      name: "Vikram Patel",
      hub: "South Bay",
      risk_factor: "Magisk Framework Signature",
      ai_risk: 98,
      status: "Escalate",
      avatarBg: "bg-rose-500/20 text-rose-400",
    },
  ];

  return {
    metrics: {
      activeCouriers: "168,350",
      activeCouriersGrowth: "+11.4% vs previous 30 days",
      collusionRings: "52",
      collusionHighPriorityText: "9 High Priority",
      payoutsUnderReview: "$74,980",
      payoutsPendingCountText: "31 pending",
      automatedReleaseRate: "98.2%",
      disputeRateText: "0.05% dispute",
      comparisonLabel: "vs previous 30 days",
    },
    chart: {
      points,
      granularity: "daily",
      nominalTotal: points.reduce((acc, p) => acc + p.nominal, 0),
      challengeTotal: points.reduce((acc, p) => acc + p.challenges, 0),
      spoofTotal: points.reduce((acc, p) => acc + p.spoofs, 0),
      callout1: { time: "Day 12", title: "Syndicate Disruption", subtitle: "52 Rings Isolated" },
      callout2: { time: "Day 27", title: "Policy v2.4 Rollout", subtitle: "Friction Reduced 14%" },
    },
    pendingPayouts,
    alerts,
    fetchedAt,
    source: "mock",
  };
}

export function useOverviewData(range: {
  preset: DateRangePreset;
  from: string;
  to: string;
  granularity: Granularity;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      if (USE_MOCK) {
        // Deterministic mock generation with brief simulated latency to show skeleton
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (controller.signal.aborted) return;

        let result: OverviewData;
        if (range.preset === "custom") {
          result = generateCustomRangeData(range.from, range.to, range.granularity);
        } else {
          result = generatePresetMockData(range.preset);
        }

        setData(result);
        setLoading(false);
        return;
      }

      // Live backend API call
      const queryParams = new URLSearchParams({
        from: range.from,
        to: range.to,
        granularity: range.granularity,
      });

      const response = await apiClient<any>(`/api/v1/metrics/summary?${queryParams.toString()}`, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      // Map API response to OverviewData
      const mapped: OverviewData = {
        metrics: {
          activeCouriers: response.active_couriers?.toLocaleString() || "42,810",
          activeCouriersGrowth: response.growth_text || "+6.2% vs previous period",
          collusionRings: (response.collusion_rings_detected || 14).toString(),
          collusionHighPriorityText: response.high_priority_text || "3 High Priority",
          payoutsUnderReview: `$${(response.payouts_under_review_amount || 18420).toLocaleString()}`,
          payoutsPendingCountText: `${response.payouts_pending_count || 8} pending`,
          automatedReleaseRate: `${response.automated_release_rate_pct || 98.7}%`,
          disputeRateText: `${response.chargeback_dispute_rate_pct || 0.02}% dispute`,
          comparisonLabel: range.preset === "today" ? "vs yesterday" : range.preset === "7d" ? "vs previous 7 days" : range.preset === "30d" ? "vs previous 30 days" : "vs previous period",
        },
        chart: response.chart || generatePresetMockData("7d").chart,
        pendingPayouts: response.pending_payouts || generatePresetMockData("7d").pendingPayouts,
        alerts: response.alerts || generatePresetMockData("7d").alerts,
        fetchedAt: new Date().toLocaleTimeString("en-US", { hour12: false }),
        source: "api",
      };

      setData(mapped);
      setLoading(false);
    } catch (err: any) {
      if (controller.signal.aborted) return;

      // Fallback to deterministic mock if backend is down
      const fallback =
        range.preset === "custom"
          ? generateCustomRangeData(range.from, range.to, range.granularity)
          : generatePresetMockData(range.preset);

      setData(fallback);
      setLoading(false);
    }
  }, [range.preset, range.from, range.to, range.granularity]);

  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  const updatePendingPayouts = useCallback((updater: (prev: PayoutApproval[]) => PayoutApproval[]) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pendingPayouts: updater(prev.pendingPayouts),
      };
    });
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    updatePendingPayouts,
  };
}
