import React from "react";
import { Lock, CheckCircle2, Camera, ArrowRight, ShieldAlert } from "lucide-react";

interface RiderPayoutStatusCardProps {
  payoutStatus: "RELEASED" | "HELD";
  heldAmount: number;
  releasedAmount: number;
  bankAccount: string;
  onVerifyNow: () => void;
  holdReason?: string;
}

export default function RiderPayoutStatusCard({
  payoutStatus,
  heldAmount,
  releasedAmount,
  bankAccount,
  onVerifyNow,
  holdReason,
}: RiderPayoutStatusCardProps) {
  if (payoutStatus === "HELD") {
    return (
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/60 rounded-2xl p-4 border border-[#F5A524]/50 shadow-soft space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#D97706]">
            <span className="p-1 rounded-lg bg-amber-500/20 text-[#D97706]">
              <Lock className="w-3.5 h-3.5" />
            </span>
            <span>Payout Status: HELD</span>
          </div>
          <span className="text-xs font-mono font-extrabold text-[#B45309] bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
            ${heldAmount.toFixed(2)} Locked
          </span>
        </div>

        <p className="text-[11px] text-[#78350F] leading-snug">
          {holdReason ||
            "A quick biometric liveness check is required to verify courier identity and release instant funds."}
        </p>

        <button
          onClick={onVerifyNow}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F5A524] to-[#E68A00] text-white text-xs font-extrabold hover:brightness-105 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>Verify now (${heldAmount.toFixed(2)})</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>

        <div className="text-[10px] text-[#92400E] text-center font-medium">
          Protected by automated 24h escrow policy
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 rounded-2xl p-4 border border-[#2FBF8F]/40 shadow-soft space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-extrabold text-[#0D9488]">
          <span className="p-1 rounded-lg bg-[#2FBF8F]/20 text-[#0D9488]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488]" />
          </span>
          <span>Payout Status: Released</span>
        </div>
        <span className="text-xs font-mono font-extrabold text-[#065F46] bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
          ${releasedAmount.toFixed(2)} Cleared
        </span>
      </div>

      <p className="text-[11px] text-[#064E3B] leading-snug">
        All earnings cleared. Automated instant ACH direct deposit ready for{" "}
        <span className="font-semibold">{bankAccount}</span>.
      </p>

      <div className="text-[10px] text-emerald-700/80 font-medium flex items-center gap-1.5 pt-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F]" />
        <span>Next batch settlement in 18 minutes</span>
      </div>
    </div>
  );
}
