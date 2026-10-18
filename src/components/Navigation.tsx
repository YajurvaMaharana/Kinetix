import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShieldAlert,
  Activity,
  Sliders,
  FolderKanban,
  GitFork,
  Banknote,
  Scale,
  Sparkles,
  CheckCircle2,
  UserCheck,
  Eye,
  FileText,
} from "lucide-react";
import { Role } from "@/lib/types";
import { getActiveRole, setActiveRole } from "@/lib/api";

const navItems = [
  { name: "Security Overview", href: "/", icon: Activity },
  { name: "Live Monitor", href: "/monitor", icon: ShieldAlert },
  { name: "Rider Simulator", href: "/simulator", icon: Sliders },
  { name: "Investigations", href: "/cases", icon: FolderKanban },
  { name: "Fraud Graph", href: "/graph", icon: GitFork },
  { name: "Payouts", href: "/payouts", icon: Banknote },
  { name: "Policy Simulator", href: "/policy", icon: Scale },
  { name: "Appeals & Redress", href: "/appeals", icon: FileText },
  { name: "Rider View", href: "/rider/explain", icon: Eye },
  { name: "Demo Controls", href: "/demo", icon: Sparkles },
  { name: "Evaluation", href: "/evaluation", icon: CheckCircle2 },
];

const roles: Role[] = ["analyst", "admin", "investigator", "finance", "rider", "system"];

export default function Navigation() {
  const location = useLocation();
  const pathname = location.pathname;
  const [currentRole, setCurrentRole] = useState<Role>("analyst");

  useEffect(() => {
    setCurrentRole(getActiveRole());
    const handleRoleChanged = () => setCurrentRole(getActiveRole());
    window.addEventListener("trustjuggler:role_changed", handleRoleChanged);
    return () => window.removeEventListener("trustjuggler:role_changed", handleRoleChanged);
  }, []);

  const handleRoleSelect = (newRole: Role) => {
    setActiveRole(newRole);
    setCurrentRole(newRole);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/90 bg-[#080B12]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group cursor-pointer select-none">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#56D9F5]/30 to-[#A78BFA]/30 border border-[#56D9F5]/40 text-[#56D9F5] shadow-lg shadow-[#56D9F5]/10 group-hover:scale-105 transition-transform">
            <ShieldAlert className="h-5 w-5 text-[#56D9F5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">TrustJuggler</span>
              <span className="rounded bg-[#56D9F5]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#56D9F5] border border-[#56D9F5]/30">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none">Autonomous Identity Risk &amp; Collusion Engine</p>
          </div>
        </Link>

        {/* Role Selector Header Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#101521] px-2.5 py-1 text-xs">
            <UserCheck className="h-3.5 w-3.5 text-[#A78BFA]" />
            <span className="text-slate-400 font-medium">Role:</span>
            <select
              value={currentRole}
              onChange={(e) => handleRoleSelect(e.target.value as Role)}
              className="bg-transparent font-semibold text-[#56D9F5] focus:outline-none cursor-pointer uppercase text-xs"
            >
              {roles.map((r) => (
                <option key={r} value={r} className="bg-[#101521] text-slate-200">
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-0.5 text-[11px] text-[#34D399]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] animate-pulse" />
            <span className="font-mono">API :8000</span>
          </div>
        </div>
      </div>

      {/* Nav Links Bar */}
      <nav className="border-t border-slate-800/80 bg-[#080B12]/95 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto py-1.5 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none border ${
                  isActive
                    ? "bg-[#56D9F5]/15 text-[#56D9F5] border-[#56D9F5]/30 shadow-sm shadow-[#56D9F5]/10 font-semibold"
                    : "border-transparent text-slate-400 hover:bg-[#101521] hover:text-slate-200 hover:border-slate-800/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 pointer-events-none ${isActive ? "text-[#56D9F5]" : "text-slate-500"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
