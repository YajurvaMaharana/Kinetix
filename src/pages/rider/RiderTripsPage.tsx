import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  MapPin,
  Calendar,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export default function RiderTripsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"All" | "Verified" | "Under review">("All");

  const trips = [
    {
      id: "TR-8941",
      merchant: "FreshBite Express",
      pickup: "712 Pike St",
      dropoff: "402 Pine St, Apt 4B",
      distance: "2.4 km",
      time: "1:45 PM",
      date: "Today",
      fare: 14.5,
      tip: 4.0,
      status: "Verified",
      telemetry: "High-fidelity sensor match",
    },
    {
      id: "TR-8938",
      merchant: "Urban Kitchens & Grill",
      pickup: "1804 5th Ave",
      dropoff: "1208 4th Ave, Suite 200",
      distance: "1.8 km",
      time: "12:15 PM",
      date: "Today",
      fare: 22.0,
      tip: 6.5,
      status: "Under review",
      telemetry: "GPS multipath recorded in urban canyon",
    },
    {
      id: "TR-8931",
      merchant: "Bean & Leaf Coffee Co.",
      pickup: "411 University St",
      dropoff: "800 Olive Way, Lobby",
      distance: "0.9 km",
      time: "10:30 AM",
      date: "Today",
      fare: 9.8,
      tip: 3.0,
      status: "Verified",
      telemetry: "Authentic road-network path",
    },
    {
      id: "TR-8924",
      merchant: "Sushi Tokyo Express",
      pickup: "2010 8th Ave",
      dropoff: "1520 Westlake Ave N",
      distance: "3.1 km",
      time: "9:15 AM",
      date: "Today",
      fare: 18.2,
      tip: 5.0,
      status: "Verified",
      telemetry: "Authentic road-network path",
    },
    {
      id: "TR-8890",
      merchant: "Green Leaf Pho",
      pickup: "418 6th Ave S",
      dropoff: "1000 2nd Ave, Floor 14",
      distance: "1.4 km",
      time: "7:20 PM",
      date: "Yesterday",
      fare: 16.0,
      tip: 4.5,
      status: "Verified",
      telemetry: "Authentic road-network path",
    },
  ];

  const filtered = trips.filter((t) => {
    if (filter === "All") return true;
    return t.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#2FBF8F]/25">
              <span>TELEMETRY LOGS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231B33]">
              Delivery Trip History
            </h1>
            <p className="text-xs text-[#6B6480] mt-1">
              Courier: {user?.name || "Rider Partner"} • Verified sensor routes and GPS breadcrumbs
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs font-bold shrink-0">
            {(["All", "Verified", "Under review"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
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
      </div>

      {/* Trips List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft space-y-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 hover:border-[#4A2C6D]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-[#231B33]">{t.merchant}</span>
                <span className="text-[10px] font-mono text-[#6B6480]">({t.id})</span>
              </div>
              <div className="text-[11px] text-[#6B6480] flex items-center gap-2">
                <span>{t.pickup}</span>
                <span>→</span>
                <span>{t.dropoff}</span>
              </div>
              <div className="text-[10px] text-[#6B6480] flex items-center gap-2 pt-0.5">
                <span>{t.date} at {t.time}</span>
                <span>•</span>
                <span>{t.distance}</span>
                <span>•</span>
                <span className="text-[#2FBF8F] font-semibold">{t.telemetry}</span>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
              <div className="text-right">
                <div className="font-extrabold text-sm text-[#231B33]">
                  ${(t.fare + t.tip).toFixed(2)}
                </div>
                <div className="text-[10px] text-[#6B6480]">
                  Fare ${t.fare.toFixed(2)} + Tip ${t.tip.toFixed(2)}
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  t.status === "Verified"
                    ? "bg-[#2FBF8F]/15 text-[#2FBF8F] border border-[#2FBF8F]/25"
                    : "bg-amber-500/15 text-amber-800 border border-amber-500/30"
                }`}
              >
                {t.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
