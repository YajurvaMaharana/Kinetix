import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import FacialLivenessModal from "@/components/FacialLivenessModal";
import {
  Banknote,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Camera,
  ChevronRight,
  X,
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
  FileQuestion,
  HelpCircle,
  Filter,
} from "lucide-react";

export interface PayoutRecord {
  id: string;
  amount: number;
  date: string;
  time: string;
  destination: string;
  status: "Released" | "Under review" | "Held";
  type: "Instant Cashout" | "Weekly ACH" | "Shift Escrow";
  reasonHeadline?: string;
  plainLanguageExplanation?: string;
  recommendedAction?: string;
}

export default function RiderPayoutsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<"All" | "Released" | "Under review" | "Held">("All");
  const [selectedPayout, setSelectedPayout] = useState<PayoutRecord | null>(null);
  const [showLivenessModal, setShowLivenessModal] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(142.8);
  const [cashingOut, setCashingOut] = useState(false);

  // Initial Payout List (Statutory mock data for logged-in rider)
  const [payouts, setPayouts] = useState<PayoutRecord[]>([
    {
      id: "PO-9842",
      amount: 44.5,
      date: "Today, Oct 17",
      time: "12:15 PM",
      destination: "Visa Debit ••4291",
      status: "Held",
      type: "Shift Escrow",
      reasonHeadline: "GPS signal jump detected during downtown drop-off",
      plainLanguageExplanation:
        "During order #TR-8938 at 12:15 PM, your device recorded an unusual 4.2-mile GPS hop within 30 seconds. This commonly happens when cellular antennas switch between tall buildings. Our automated protection paused this payout for 24 hours to ensure your account was not compromised.",
      recommendedAction:
        "Complete a 3-second 3D face verification to instantly confirm your identity and release these funds to your card.",
    },
    {
      id: "PO-9831",
      amount: 98.3,
      date: "Yesterday, Oct 16",
      time: "6:30 PM",
      destination: "Visa Debit ••4291",
      status: "Released",
      type: "Instant Cashout",
      plainLanguageExplanation:
        "All 8 deliveries verified with continuous sensor telemetry. Funds cleared via Visa Direct instant payment rails in 28 seconds.",
    },
    {
      id: "PO-9799",
      amount: 145.2,
      date: "Wed, Oct 15",
      time: "8:00 PM",
      destination: "Checking Account ••8012",
      status: "Released",
      type: "Weekly ACH",
      plainLanguageExplanation:
        "Automated shift batch payout processed with clean road-network matching.",
    },
    {
      id: "PO-9742",
      amount: 52.0,
      date: "Mon, Oct 13",
      time: "2:40 PM",
      destination: "Visa Debit ••4291",
      status: "Released",
      type: "Instant Cashout",
      plainLanguageExplanation:
        "Standard instant cashout cleared with zero driver friction.",
    },
  ]);

  // Handle Instant Cashout of Available Balance
  const handleCashoutAvailable = () => {
    if (availableBalance <= 0) return;
    setCashingOut(true);
    setTimeout(() => {
      const amountCashed = availableBalance;
      setAvailableBalance(0);
      const newPayout: PayoutRecord = {
        id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
        amount: amountCashed,
        date: "Just now",
        time: "Now",
        destination: "Visa Debit ••4291",
        status: "Released",
        type: "Instant Cashout",
        plainLanguageExplanation:
          "Instant transfer cleared via Visa Direct rails. Arrived in your bank in under 60 seconds.",
      };
      setPayouts((prev) => [newPayout, ...prev]);
      setCashingOut(false);
      showToast({
        type: "success",
        title: "Instant Cashout Successful!",
        message: `$${amountCashed.toFixed(2)} sent directly to Visa Debit ending in ••4291.`,
      });
    }, 1000);
  };

  // Handle Facial Verification for a Held Payout
  const handleVerifyPayout = () => {
    if (!selectedPayout) return;
    setShowLivenessModal(false);

    // Update the payout status to Released
    setPayouts((prev) =>
      prev.map((p) =>
        p.id === selectedPayout.id
          ? {
              ...p,
              status: "Released",
              plainLanguageExplanation:
                "Identity verified via 3D biometric selfie scan. Funds cleared instantly and disbursed to your debit card.",
            }
          : p
      )
    );

    setSelectedPayout((prev) =>
      prev
        ? {
            ...prev,
            status: "Released",
            plainLanguageExplanation:
              "Identity verified via 3D biometric selfie scan. Funds cleared instantly and disbursed to your debit card.",
          }
        : null
    );

    showToast({
      type: "success",
      title: "Payout Released!",
      message: `$${selectedPayout.amount.toFixed(2)} hold has been cleared and disbursed to your account.`,
    });
  };

  // Filtered List
  const filteredPayouts = payouts.filter((p) => {
    if (filter === "All") return true;
    return p.status === filter;
  });

  const totalHeld = payouts
    .filter((p) => p.status === "Held" || p.status === "Under review")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* HEADER & WALLET BALANCES */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-gray-100">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#2FBF8F]/25">
              <span>INSTANT ESCROW VAULT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231B33]">
              Rider Payouts &amp; Wallet
            </h1>
            <p className="text-xs text-[#6B6480] mt-1">
              Account: {user?.name || "Rider Partner"} • Linked to Visa Debit ••4291
            </p>
          </div>

          {/* Cash Out Button */}
          <button
            onClick={handleCashoutAvailable}
            disabled={availableBalance <= 0 || cashingOut}
            className="py-3 px-6 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {cashingOut ? (
              <span>Disbursing Funds...</span>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4" />
                <span>Cash Out Available (${availableBalance.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>

        {/* 3 Metrics Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10">
            <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
              Available to Cash Out
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#231B33] mt-1">
              ${availableBalance.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#2FBF8F] font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ready for 60s transfer</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10">
            <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
              Escrow Hold (Verification)
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
              ${totalHeld.toFixed(2)}
            </div>
            <div className="text-[11px] text-amber-700 font-bold mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{totalHeld > 0 ? "Unlockable with face scan" : "No active holds"}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10">
            <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
              Disbursed This Month
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#4A2C6D] mt-1">
              $1,489.20
            </div>
            <div className="text-[11px] text-[#6B6480] font-semibold mt-1">
              100% on-time settlement
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PAYOUTS HISTORY & FILTER CHIPS */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-[#231B33]">Payout Transactions</h2>
            <p className="text-[11px] text-[#6B6480]">Select any payout to view details or clear holds</p>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 overflow-x-auto text-xs font-bold">
            {(["All", "Released", "Under review", "Held"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  filter === status
                    ? "bg-[#4A2C6D] text-white shadow-xs"
                    : "text-[#6B6480] hover:text-[#231B33]"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Payouts Table / List */}
        <div className="space-y-3">
          {filteredPayouts.length === 0 ? (
            <div className="text-center py-12 text-[#6B6480] text-xs">
              No payouts found matching the filter "{filter}".
            </div>
          ) : (
            filteredPayouts.map((p) => {
              const isHeld = p.status === "Held" || p.status === "Under review";
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPayout(p)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    isHeld
                      ? "bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10"
                      : "bg-[#FFF9F2] border-[#4A2C6D]/10 hover:border-[#4A2C6D]/30 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        p.status === "Released"
                          ? "bg-[#2FBF8F]/15 text-[#2FBF8F]"
                          : "bg-amber-500/15 text-amber-700"
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#231B33]">
                          ${p.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-[#6B6480] font-mono">({p.id})</span>
                      </div>
                      <div className="text-[11px] text-[#6B6480]">
                        {p.type} • {p.date} at {p.time} • {p.destination}
                      </div>
                      {p.reasonHeadline && (
                        <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{p.reasonHeadline}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        p.status === "Released"
                          ? "bg-[#2FBF8F]/15 text-[#2FBF8F] border border-[#2FBF8F]/25"
                          : p.status === "Under review"
                          ? "bg-amber-500/15 text-amber-800 border border-amber-500/30"
                          : "bg-amber-500/15 text-amber-800 border border-amber-500/30"
                      }`}
                    >
                      {p.status}
                    </span>

                    <button
                      type="button"
                      className="text-xs font-bold text-[#4A2C6D] hover:underline flex items-center gap-1"
                    >
                      <span>Explain</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DETAIL DRAWER: PLAIN-LANGUAGE EXPLANATION OF HOLD */}
      {/* ========================================================= */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-[#231B33]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedPayout(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6480]">
                      PAYOUT AUDIT DETAIL
                    </span>
                    <h3 className="font-extrabold text-lg text-[#231B33]">
                      Payout {selectedPayout.id}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedPayout(null)}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-[#6B6480] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Amount & Status Card */}
                <div className="p-5 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/15 mb-6 text-center">
                  <span className="text-xs text-[#6B6480] font-bold">Transaction Amount</span>
                  <div className="text-3xl font-black text-[#231B33] mt-1">
                    ${selectedPayout.amount.toFixed(2)}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-white border border-[#4A2C6D]/15">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedPayout.status === "Released" ? "bg-[#2FBF8F]" : "bg-amber-500"
                      }`}
                    />
                    <span>Status: {selectedPayout.status}</span>
                  </div>
                </div>

                {/* Plain-Language Explanation Section */}
                <div className="space-y-4 text-xs text-[#231B33]">
                  {selectedPayout.status === "Held" || selectedPayout.status === "Under review" ? (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="font-extrabold text-amber-950 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Why is this payout temporarily held?</span>
                      </div>
                      <p className="text-amber-900/90 leading-relaxed text-[11px]">
                        {selectedPayout.plainLanguageExplanation}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#2FBF8F]/10 border border-[#2FBF8F]/25 space-y-1">
                      <div className="font-extrabold text-[#2FBF8F] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Payout Cleared &amp; Released</span>
                      </div>
                      <p className="text-[#6B6480] text-[11px] leading-relaxed">
                        {selectedPayout.plainLanguageExplanation}
                      </p>
                    </div>
                  )}

                  {/* Transaction Metadata */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between py-2 border-b border-gray-100 text-[11px]">
                      <span className="text-[#6B6480]">Shift Date &amp; Time</span>
                      <span className="font-bold text-[#231B33]">
                        {selectedPayout.date} at {selectedPayout.time}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100 text-[11px]">
                      <span className="text-[#6B6480]">Destination Account</span>
                      <span className="font-bold text-[#231B33]">
                        {selectedPayout.destination}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100 text-[11px]">
                      <span className="text-[#6B6480]">Processing Type</span>
                      <span className="font-bold text-[#231B33]">{selectedPayout.type}</span>
                    </div>
                  </div>

                  {/* Actions for Held Payout */}
                  {(selectedPayout.status === "Held" || selectedPayout.status === "Under review") && (
                    <div className="pt-4 space-y-3">
                      <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/15 text-[11px]">
                        <span className="font-extrabold text-[#4A2C6D] block mb-1">
                          Recommended Action:
                        </span>
                        <p className="text-[#6B6480] leading-relaxed">
                          {selectedPayout.recommendedAction}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowLivenessModal(true)}
                        className="w-full py-3.5 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Verify with Selfie Now (${selectedPayout.amount.toFixed(2)})</span>
                      </button>

                      <Link
                        to="/rider/appeals"
                        onClick={() => setSelectedPayout(null)}
                        className="w-full py-2.5 rounded-full bg-white border border-[#4A2C6D]/20 text-[#4A2C6D] font-bold text-xs hover:bg-[#FFF9F2] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileQuestion className="w-3.5 h-3.5" />
                        <span>Need Help? Raise an Appeal</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-6 border-t border-gray-100">
                <button
                  onClick={() => setSelectedPayout(null)}
                  className="w-full py-2.5 rounded-full bg-gray-100 text-[#231B33] font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FACIAL LIVENESS MODAL FOR PAYOUT UNLOCK */}
      {/* ========================================================= */}
      <FacialLivenessModal
        isOpen={showLivenessModal}
        challengeId={`PAYOUT-CHAL-${selectedPayout?.id || "9842"}`}
        riderId={user?.id || "usr_rider_01"}
        payoutAmount={selectedPayout?.amount}
        onClose={() => setShowLivenessModal(false)}
        onSuccess={handleVerifyPayout}
      />
    </div>
  );
}
