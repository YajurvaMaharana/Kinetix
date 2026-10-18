import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface RouteMeta {
  group: string;
  page: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/overview": { group: "Overview", page: "Fleet Fraud & Payout Command Center" },
  "/monitor/live": { group: "Monitor", page: "Live Telemetry & Anomaly Stream" },
  "/monitor/graph": { group: "Monitor", page: "Fraud Graph & Collusion Rings" },
  "/cases/investigations": { group: "Cases", page: "Security Investigations Dossier" },
  "/cases/appeals": { group: "Cases", page: "Human-in-the-Loop Appeals & Redress" },
  "/money/payouts": { group: "Money", page: "Payout Protection Vault & Escrows" },
  "/money/policies": { group: "Money", page: "Risk Policy Simulator & Cut-Lines" },
  "/lab/simulator": { group: "Lab", page: "Rider Telemetry & Attack Simulator" },
  "/lab/demo": { group: "Lab", page: "Scenario Controls & Database Seeding" },
  "/lab/evaluation": { group: "Lab", page: "Model Evaluation & Benchmark Curves" },
  "/rider-view": { group: "Rider View", page: "Courier Mobile Experience Preview" },
};

export default function Breadcrumb() {
  const location = useLocation();
  const current = ROUTE_META[location.pathname] || {
    group: "Kinetix",
    page: location.pathname.replace("/", "") || "Home",
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-2 pb-4 flex items-center justify-between text-xs text-[var(--muted)]">
      <div className="flex items-center gap-2">
        <Link
          to="/overview"
          className="hover:text-[var(--primary)] flex items-center gap-1 font-semibold transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Kinetix</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)]/60" />
        <span className="font-bold text-[var(--primary)]">{current.group}</span>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)]/60" />
        <span className="font-semibold text-[var(--ink)]">{current.page}</span>
      </div>

      <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--muted)]">
        <span>Autonomous Decision Window:</span>
        <span className="font-mono font-bold text-[var(--status-allow)] bg-[var(--status-allow)]/10 px-2 py-0.5 rounded-full">
          &lt; 140ms
        </span>
      </div>
    </div>
  );
}
