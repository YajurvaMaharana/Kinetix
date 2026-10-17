"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { Role } from "@/lib/types";
import { getActiveRole, setActiveRole } from "@/lib/api";

const navItems = [
  { name: "Health & Overview", href: "/", icon: Activity },
  { name: "Monitor", href: "/monitor", icon: ShieldAlert },
  { name: "Simulator", href: "/simulator", icon: Sliders },
  { name: "Cases", href: "/cases", icon: FolderKanban },
  { name: "Graph", href: "/graph", icon: GitFork },
  { name: "Payouts", href: "/payouts", icon: Banknote },
  { name: "Policy", href: "/policy", icon: Scale },
  { name: "Demo", href: "/demo", icon: Sparkles },
  { name: "Evaluation", href: "/evaluation", icon: CheckCircle2 },
];

const roles: Role[] = ["analyst", "admin", "investigator", "finance", "rider", "system"];

export default function Navigation() {
  const pathname = usePathname();
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
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">TrustJuggler</span>
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/30">
                v2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none">Behavioral Trust Engine</p>
          </div>
        </Link>

        {/* Role Selector Header Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs">
            <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-slate-400 font-medium">Role:</span>
            <select
              value={currentRole}
              onChange={(e) => handleRoleSelect(e.target.value as Role)}
              className="bg-transparent font-semibold text-indigo-300 focus:outline-none cursor-pointer uppercase text-xs"
            >
              {roles.map((r) => (
                <option key={r} value={r} className="bg-slate-900 text-slate-200">
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-0.5 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>API :8000</span>
          </div>
        </div>
      </div>

      {/* Nav Links Bar */}
      <nav className="border-t border-slate-900 bg-slate-950 px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto py-1.5 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
