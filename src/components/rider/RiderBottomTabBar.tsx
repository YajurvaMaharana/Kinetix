import React from "react";
import { Home, Navigation, Banknote, User } from "lucide-react";

export type RiderTab = "home" | "trips" | "wallet" | "profile";

interface RiderBottomTabBarProps {
  activeTab: RiderTab;
  onTabChange: (tab: RiderTab) => void;
}

export default function RiderBottomTabBar({
  activeTab,
  onTabChange,
}: RiderBottomTabBarProps) {
  const tabs = [
    { id: "home" as RiderTab, label: "Home", icon: Home },
    { id: "trips" as RiderTab, label: "Trips", icon: Navigation },
    { id: "wallet" as RiderTab, label: "Wallet", icon: Banknote },
    { id: "profile" as RiderTab, label: "Profile", icon: User },
  ];

  return (
    <div className="border-t border-[#4A2C6D]/10 bg-white/95 backdrop-blur-md px-6 py-2 shrink-0">
      <div className="flex items-center justify-between text-[#6B6480]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex flex-col items-center gap-1 transition-colors py-0.5 px-3 rounded-lg cursor-pointer ${
                isActive
                  ? "text-[#4A2C6D] font-bold"
                  : "text-[#6B6480] hover:text-[#231B33]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#4A2C6D] stroke-[2.5]" : "stroke-[1.75]"}`} />
              <span className="text-[10px]">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* iOS Home Indicator Bar */}
      <div className="w-32 h-1 bg-black/25 rounded-full mx-auto mt-2" />
    </div>
  );
}
