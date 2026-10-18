import React from "react";
import { RiderProfileData } from "@/api/endpoints";
import RiderTrustRing from "./RiderTrustRing";
import RiderEarningsCard from "./RiderEarningsCard";
import RiderPayoutStatusCard from "./RiderPayoutStatusCard";
import RiderRecentTrips from "./RiderRecentTrips";
import RiderBottomTabBar, { RiderTab } from "./RiderBottomTabBar";
import RiderInPhoneLiveness from "./RiderInPhoneLiveness";

interface RiderPhoneFrameProps {
  rider: RiderProfileData;
  activeTab: RiderTab;
  onTabChange: (tab: RiderTab) => void;
  livenessActive: boolean;
  onStartLiveness: () => void;
  onCancelLiveness: () => void;
  onLivenessSuccess: (releasedAmount: number, newScore: number) => void;
}

export default function RiderPhoneFrame({
  rider,
  activeTab,
  onTabChange,
  livenessActive,
  onStartLiveness,
  onCancelLiveness,
  onLivenessSuccess,
}: RiderPhoneFrameProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* Viewport Dimension Indicator */}
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
        <span className="w-2 h-2 rounded-full bg-[#2FBF8F] animate-pulse" />
        <span>Mobile Viewport (390 × 844) &bull; iPhone 15 Chassis</span>
      </div>

      {/* Outer Phone Chassis: EXACTLY 390px by 844px */}
      <div
        style={{ width: "390px", height: "844px" }}
        className="relative bg-[#1A1428] rounded-[52px] p-[10px] shadow-2xl shadow-purple-950/40 border-4 border-[#37284F] flex flex-col shrink-0 select-none overflow-hidden"
      >
        {/* Hardware Side Buttons */}
        <div className="absolute -left-[6px] top-24 w-[3px] h-9 bg-[#4D3A66] rounded-l" />
        <div className="absolute -left-[6px] top-36 w-[3px] h-12 bg-[#4D3A66] rounded-l" />
        <div className="absolute -left-[6px] top-52 w-[3px] h-12 bg-[#4D3A66] rounded-l" />
        <div className="absolute -right-[6px] top-32 w-[3px] h-16 bg-[#4D3A66] rounded-r" />

        {/* Inner Screen Display (370 × 824) */}
        <div className="w-full h-full bg-[#FFF9F2] rounded-[42px] overflow-hidden flex flex-col justify-between relative text-[#231B33]">
          {/* Dynamic Island & Status Bar */}
          <div className="px-6 pt-3 pb-1 flex items-center justify-between z-30 shrink-0 select-none bg-transparent">
            <span className="text-[13px] font-extrabold tracking-tight">9:41</span>

            {/* Dynamic Island */}
            <div className="w-28 h-6 bg-black rounded-full flex items-center justify-between px-2.5 mx-auto shadow-sm">
              <div className="w-2 h-2 rounded-full bg-[#221D30] ring-1 ring-zinc-800" />
              {livenessActive && (
                <span className="w-2 h-2 rounded-full bg-[#5FD3B3] animate-pulse" />
              )}
              <div className="w-2.5 h-2.5 rounded-full bg-[#182030] ring-1 ring-zinc-800" />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span>5G</span>
              <div className="w-4 h-2.5 border border-[#231B33] rounded-[2px] p-[1px] flex items-center">
                <div className="w-full h-full bg-[#231B33] rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* SCREEN CONTENT: In-Phone Liveness Flow OR Main Dashboard */}
          {livenessActive ? (
            <RiderInPhoneLiveness
              riderId={rider.id}
              heldAmount={rider.held_amount}
              riderName={rider.name}
              onSuccess={onLivenessSuccess}
              onCancel={onCancelLiveness}
            />
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              {/* Scrollable Viewport */}
              <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3.5 scrollbar-thin">
                {/* Greeting & Hub Header */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h1 className="text-lg font-extrabold text-[#231B33]">
                      Good afternoon, {rider.first_name} 👋
                    </h1>
                    <p className="text-[11px] text-[#6B6480]">
                      Courier ID: {rider.courier_id} &bull; {rider.hub.split(" ")[0]} Hub
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {rider.avatar}
                  </div>
                </div>

                {/* Shift Active Pill */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
                  Shift Active &bull; Sensor Fusion Online
                </div>

                {/* 1. Trust-Score Ring */}
                <RiderTrustRing
                  score={rider.trust_score}
                  tier={rider.tier}
                  payoutStatus={rider.payout_status}
                  trend={rider.trust_trend}
                />

                {/* 2. Today's Earnings */}
                <RiderEarningsCard
                  earningsToday={rider.earnings_today}
                  tripsCount={rider.trips_today_count}
                  hoursOnline={rider.hours_online}
                />

                {/* 3. Payout Status (Released or Held with "Verify now" button) */}
                <RiderPayoutStatusCard
                  payoutStatus={rider.payout_status}
                  heldAmount={rider.held_amount}
                  releasedAmount={rider.released_amount}
                  bankAccount={rider.bank_account}
                  holdReason={rider.hold_reason}
                  onVerifyNow={onStartLiveness}
                />

                {/* 4. Recent Deliveries */}
                <RiderRecentTrips trips={rider.recent_trips} />
              </div>

              {/* 5. Bottom Tab Bar */}
              <RiderBottomTabBar
                activeTab={activeTab}
                onTabChange={onTabChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
