import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getRiderList,
  getRiderProfile,
  completeRiderLivenessVerification,
  RiderProfileData,
  MOCK_RIDER_PROFILES,
} from "@/api/endpoints";
import { RotateCcw, Zap, Smartphone } from "lucide-react";
import RiderInspectorPanel from "@/components/rider/RiderInspectorPanel";
import RiderPhoneFrame from "@/components/rider/RiderPhoneFrame";
import { RiderTab } from "@/components/rider/RiderBottomTabBar";

export default function RiderViewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [riders, setRiders] = useState<RiderProfileData[]>(MOCK_RIDER_PROFILES);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("rider_8941");
  const [currentRider, setCurrentRider] = useState<RiderProfileData>(MOCK_RIDER_PROFILES[0]);
  const [activePhoneTab, setActivePhoneTab] = useState<RiderTab>("home");
  const [livenessActive, setLivenessActive] = useState<boolean>(false);

  // Load riders from backend rider endpoints on mount
  useEffect(() => {
    async function loadData() {
      try {
        const list = await getRiderList();
        if (list && list.length > 0) {
          setRiders(list);
          const found = list.find((r) => r.id === selectedRiderId) || list[0];
          setCurrentRider(found);
        }
      } catch (err) {
        console.error("Failed to load rider profiles", err);
      }
    }
    loadData();
  }, []);

  // When selectedRiderId changes, sync currentRider and reset liveness flow
  useEffect(() => {
    const found = riders.find((r) => r.id === selectedRiderId) || riders[0];
    setCurrentRider(found);
    setLivenessActive(false);
  }, [selectedRiderId, riders]);

  // Handle successful in-phone liveness verification
  const handleLivenessSuccess = (releasedAmount: number, newScore: number) => {
    // Update local current rider state
    setCurrentRider((prev) => ({
      ...prev,
      payout_status: "RELEASED",
      held_amount: 0,
      released_amount: prev.released_amount + releasedAmount,
      trust_score: newScore,
      trust_trend: "improving",
      recent_trips: prev.recent_trips.map((t) => ({ ...t, status: "Verified" as const })),
    }));

    // Update riders master list
    setRiders((prev) =>
      prev.map((r) =>
        r.id === currentRider.id
          ? {
              ...r,
              payout_status: "RELEASED",
              held_amount: 0,
              released_amount: r.released_amount + releasedAmount,
              trust_score: newScore,
              trust_trend: "improving",
              recent_trips: r.recent_trips.map((t) => ({ ...t, status: "Verified" as const })),
            }
          : r
      )
    );

    showToast({
      type: "success",
      title: "3D Liveness Verified",
      message: `$${releasedAmount.toFixed(2)} hold released immediately to ${currentRider.first_name}'s bank wallet!`,
    });

    setLivenessActive(false);
  };

  // Reset held state for testing/demo purposes
  const handleResetToHeld = () => {
    const holdAmt = 44.5;
    setCurrentRider((prev) => ({
      ...prev,
      payout_status: "HELD",
      held_amount: holdAmt,
      released_amount: Math.max(0, prev.released_amount - holdAmt),
      trust_score: 72,
      trust_trend: "degrading",
      hold_reason:
        "Typing cadence deviation (240 → 95 cpm) detected on trip #ord_8419. 3D selfie liveness check required to release escrow.",
    }));

    setRiders((prev) =>
      prev.map((r) =>
        r.id === currentRider.id
          ? {
              ...r,
              payout_status: "HELD",
              held_amount: holdAmt,
              released_amount: Math.max(0, r.released_amount - holdAmt),
              trust_score: 72,
              trust_trend: "degrading",
              hold_reason:
                "Typing cadence deviation (240 → 95 cpm) detected on trip #ord_8419. 3D selfie liveness check required to release escrow.",
            }
          : r
      )
    );

    setLivenessActive(false);

    showToast({
      type: "info",
      title: "Simulation Reset",
      message: `Reset ${currentRider.first_name} to HELD state with $${holdAmt.toFixed(2)} escrow lock.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        badge="Courier Experience Portal"
        title="Courier Mobile Experience (Rider View)"
        subtitle="Simulated native companion app on iPhone 15 frame (390×844) with real-time trust ring, instant payout clearance, and biometric liveness."
        secondaryAction={{
          label: "Reset Payout Hold",
          icon: RotateCcw,
          onClick: handleResetToHeld,
        }}
        primaryAction={{
          label: "Trigger Shift Check-in",
          icon: Zap,
          onClick: () => {
            showToast({
              type: "info",
              title: "Shift Synchronized",
              message: `Active GPS & 40Hz road telemetry confirmed for ${currentRider.hub}.`,
            });
          },
          variant: "primary",
        }}
      />

      {/* Main Grid: Left Panel (Inspector) + Centered Phone Frame (390×844) */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left of the phone: Panel with "Previewing as" rider dropdown and key rider details */}
        <div className="lg:col-span-5">
          <RiderInspectorPanel
            riders={riders}
            selectedRiderId={selectedRiderId}
            currentRider={currentRider}
            onSelectRider={(id) => setSelectedRiderId(id)}
            onResetHold={handleResetToHeld}
            onTriggerLiveness={() => setLivenessActive(true)}
          />
        </div>

        {/* Center: Centered Phone Frame (390x844) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          <RiderPhoneFrame
            rider={currentRider}
            activeTab={activePhoneTab}
            onTabChange={setActivePhoneTab}
            livenessActive={livenessActive}
            onStartLiveness={() => setLivenessActive(true)}
            onCancelLiveness={() => setLivenessActive(false)}
            onLivenessSuccess={handleLivenessSuccess}
          />
        </div>
      </div>
    </div>
  );
}
