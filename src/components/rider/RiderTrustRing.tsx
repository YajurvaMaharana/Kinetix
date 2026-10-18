import React from "react";
import { ShieldCheck, ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RiderTrustRingProps {
  score: number;
  tier: string;
  payoutStatus: "RELEASED" | "HELD";
  trend?: "improving" | "stable" | "degrading";
  size?: "sm" | "md";
}

export default function RiderTrustRing({
  score,
  tier,
  payoutStatus,
  trend = "stable",
  size = "md",
}: RiderTrustRingProps) {
  // SVG circular geometry
  const radius = size === "sm" ? 32 : 42;
  const strokeWidth = size === "sm" ? 5 : 6;
  const svgSize = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const getScoreColor = (val: number) => {
    if (val >= 80) return "#2FBF8F"; // Green / Allow
    if (val >= 50) return "#F5A524"; // Amber / Challenge
    return "#E5484D"; // Rose / Escalate
  };

  const scoreColor = getScoreColor(clampedScore);

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft flex items-center justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#4A2C6D]" />
          <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wide">
            Behavioral Trust
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-[#231B33]">{tier}</span>
          {trend === "improving" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
              <TrendingUp className="w-3 h-3" /> +14
            </span>
          )}
          {trend === "degrading" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
              <TrendingDown className="w-3 h-3" /> Check
            </span>
          )}
        </div>
        <div className="text-[10px]">
          {payoutStatus === "HELD" ? (
            <span className="text-[#F5A524] font-bold flex items-center gap-1">
              ⚠️ Escrow hold &bull; Verification required
            </span>
          ) : (
            <span className="text-[#2FBF8F] font-bold flex items-center gap-1">
              ✓ Verified &bull; Instant ACH active
            </span>
          )}
        </div>
      </div>

      {/* Circular SVG Gauge */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: `${svgSize}px`, height: `${svgSize}px` }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          className="transform -rotate-90"
        >
          {/* Background circle track */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="#F0EAFB"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated score arc */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-base font-extrabold font-mono text-[#231B33] leading-none">
            {clampedScore}
          </span>
          <span className="text-[8px] font-bold text-[#6B6480] uppercase tracking-wider mt-0.5">
            / 100
          </span>
        </div>
      </div>
    </div>
  );
}
