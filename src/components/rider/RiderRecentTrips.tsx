import React from "react";
import { RiderDeliveryItem } from "@/api/endpoints";
import { Package, Clock, Navigation, CheckCircle2, AlertTriangle } from "lucide-react";

interface RiderRecentTripsProps {
  trips: RiderDeliveryItem[];
  maxItems?: number;
  onViewAll?: () => void;
}

export default function RiderRecentTrips({
  trips,
  maxItems = 4,
  onViewAll,
}: RiderRecentTripsProps) {
  const displayTrips = trips.slice(0, maxItems);

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between text-xs font-bold text-[#231B33]">
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[#4A2C6D]" />
          <span>Recent Deliveries</span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[10px] text-[#4A2C6D] font-bold hover:underline cursor-pointer"
          >
            View all ({trips.length})
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {displayTrips.map((trip) => {
          const isVerified = trip.status === "Verified";
          return (
            <div
              key={trip.id}
              className="bg-white rounded-xl p-2.5 border border-[#4A2C6D]/10 hover:border-[#4A2C6D]/20 transition-all flex items-center justify-between shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center text-xs shrink-0 font-bold">
                  📦
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#231B33] truncate">
                    {trip.merchant}
                  </div>
                  <div className="text-[10px] text-[#6B6480] flex items-center gap-1.5">
                    <span>{trip.time}</span>
                    <span>&bull;</span>
                    <span>{trip.distance_km} km</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 pl-2">
                <div className="text-xs font-extrabold font-mono text-[#231B33]">
                  +${trip.earned.toFixed(2)}
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    isVerified
                      ? "bg-[#2FBF8F]/15 text-[#2FBF8F]"
                      : "bg-[#F5A524]/15 text-[#D97706]"
                  }`}
                >
                  {isVerified ? (
                    <>
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-2.5 h-2.5" />
                      <span>Held</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
