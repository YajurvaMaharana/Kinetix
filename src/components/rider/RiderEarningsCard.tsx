import React from "react";
import { Sparkles, Clock, TrendingUp } from "lucide-react";

interface RiderEarningsCardProps {
  earningsToday: number;
  tripsCount: number;
  hoursOnline: number;
  tips?: number;
}

export default function RiderEarningsCard({
  earningsToday,
  tripsCount,
  hoursOnline,
  tips,
}: RiderEarningsCardProps) {
  const calculatedTips = tips !== undefined ? tips : earningsToday * 0.18;
  const avgPerTrip = tripsCount > 0 ? (earningsToday / tripsCount).toFixed(2) : "0.00";
  const dailyTargetPct = Math.min(100, Math.round((tripsCount / 10) * 100));

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#4A2C6D]/15 shadow-soft space-y-2.5">
      <div className="flex items-center justify-between text-xs font-bold text-[#6B6480]">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#4A2C6D]" />
          <span className="tracking-wide">TODAY'S EARNINGS</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-[#4A2C6D] bg-[#F0EAFB] px-2 py-0.5 rounded-full">
          {tripsCount} Completed
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-extrabold font-mono text-[#231B33]">
          ${earningsToday.toFixed(2)}
        </div>
        <div className="text-[11px] font-bold text-[#2FBF8F] bg-[#2FBF8F]/10 px-2 py-0.5 rounded-md">
          +${calculatedTips.toFixed(2)} tips included
        </div>
      </div>

      {/* Daily Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-[#6B6480] font-medium">
          <span>Daily shift goal (10 trips)</span>
          <span className="font-bold text-[#231B33]">{dailyTargetPct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#4A2C6D] to-[#6A3F9D] rounded-full transition-all duration-500"
            style={{ width: `${dailyTargetPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#6B6480] pt-1.5 border-t border-[#4A2C6D]/10">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#6B6480]" />
          <span>Online: {hoursOnline} hours</span>
        </span>
        <span className="font-mono font-semibold text-[#231B33]">
          Avg: ${avgPerTrip}/delivery
        </span>
      </div>
    </div>
  );
}
