import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getRiderProfile,
  completeRiderLivenessVerification,
  RiderProfileData,
  MOCK_RIDER_PROFILES,
} from "@/api/endpoints";
import { LogOut } from "lucide-react";
import RiderPhoneFrame from "@/components/rider/RiderPhoneFrame";
import { RiderTab } from "@/components/rider/RiderBottomTabBar";

export default function RiderDashboard() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [rider, setRider] = useState<RiderProfileData>(MOCK_RIDER_PROFILES[0]);
  const [activeTab, setActiveTab] = useState<RiderTab>("home");
  const [livenessActive, setLivenessActive] = useState<boolean>(false);

  useEffect(() => {
    async function fetchRider() {
      try {
        const id = user?.courierId || "CR-8941";
        const profile = await getRiderProfile(id);
        setRider(profile);
      } catch (err) {
        console.error("Could not fetch rider", err);
      }
    }
    fetchRider();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/choose-role");
  };

  const handleLivenessSuccess = (releasedAmount: number, newScore: number) => {
    setRider((prev) => ({
      ...prev,
      payout_status: "RELEASED",
      held_amount: 0,
      released_amount: prev.released_amount + releasedAmount,
      trust_score: newScore,
      trust_trend: "improving",
      recent_trips: prev.recent_trips.map((t) => ({ ...t, status: "Verified" as const })),
    }));

    showToast({
      type: "success",
      title: "Payout Released",
      message: `$${releasedAmount.toFixed(2)} transferred to your linked bank account.`,
    });

    setLivenessActive(false);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col justify-between py-6 px-4">
      {/* Top Bar for Desktop Preview */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between mb-4">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
            RIDER COMPANION (NATIVE SIMULATION)
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Centered Phone Frame (390x844) */}
      <div className="flex justify-center items-center">
        <RiderPhoneFrame
          rider={rider}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          livenessActive={livenessActive}
          onStartLiveness={() => setLivenessActive(true)}
          onCancelLiveness={() => setLivenessActive(false)}
          onLivenessSuccess={handleLivenessSuccess}
        />
      </div>
    </div>
  );
}
