import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Smartphone,
  UserCheck,
  Shield,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Lock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

export default function ChooseRolePage() {
  const { isAuthenticated, user, logout, login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleQuickDemoLogin = async (email: string, pass: string, targetHome: string) => {
    try {
      const loggedIn = await login(email, pass);
      showToast({
        type: "success",
        title: `Signed in as ${loggedIn.role}`,
        message: `Welcome, ${loggedIn.name}! Session established.`,
      });
      navigate(targetHome);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Login Error",
        message: err.message || "Failed to sign in.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col justify-between py-8 px-4 sm:px-6">
      {/* Top Navbar */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6B6480] hover:text-[#4A2C6D] transition-colors bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full border border-[#4A2C6D]/10 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-[#FF6F61]" />
          <span>Back to Home</span>
        </Link>
        <Logo size="md" />
        <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-xs font-bold border border-[#2FBF8F]/25">
          <span className="w-2 h-2 rounded-full bg-[#2FBF8F] animate-pulse" />
          <span>Kinetics Statutory Gateway</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full my-auto text-center">
        {/* Existing Session Alert if already authenticated */}
        {isAuthenticated && user && (
          <div className="mb-8 max-w-xl mx-auto p-4 rounded-2xl bg-[#4A2C6D]/10 border border-[#4A2C6D]/20 text-[#231B33] text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="text-left">
              <span className="text-[11px] uppercase tracking-wider text-[#6B6480] font-black">Active Session:</span>
              <div className="font-extrabold text-sm text-[#4A2C6D]">
                {user.name} ({user.role})
              </div>
              <div className="text-[11px] text-[#6B6480]">{user.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate(user.role === "RIDER" ? "/rider/home" : "/overview")}
                className="px-4 py-2 rounded-full bg-[#4A2C6D] text-white font-bold text-xs hover:bg-[#392153] transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span>Go to Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => logout()}
                className="px-3.5 py-2 rounded-full bg-white text-[#FF6F61] border border-[#FF6F61]/30 font-bold text-xs hover:bg-[#FF6F61]/10 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-xs font-bold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6F61]" />
          <span>ROLE-BASED GOVERNANCE</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#231B33] tracking-tight">
          Select Your Kinetics Portal
        </h1>
        <p className="text-sm text-[#6B6480] mt-3 max-w-xl mx-auto leading-relaxed">
          Access permissions, telemetry streams, and security controls are strictly segregated by role.
          Choose your role below to enter the portal.
        </p>

        {/* 3 Dedicated Role Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-12 text-left">
          {/* CARD 1: RIDER */}
          <div className="bg-white rounded-3xl p-7 border border-[#4A2C6D]/15 shadow-soft flex flex-col justify-between hover:shadow-plum hover:border-[#4A2C6D]/30 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2FBF8F]/5 rounded-bl-[100px] pointer-events-none transition-all group-hover:scale-110" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] border border-[#2FBF8F]/25">
                  DELIVERY FLEET
                </span>
                <span className="text-xs font-mono font-bold text-[#6B6480]">RIDER</span>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#2FBF8F]/15 text-[#2FBF8F] flex items-center justify-center mb-5 shadow-sm">
                <Smartphone className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-extrabold text-[#231B33] mb-2">Rider</h2>
              <p className="text-xs text-[#6B6480] leading-relaxed mb-6">
                Mobile companion for couriers: review trust score, unlock escrow payout holds with 3D facial liveness, view completed trips, and raise dispute appeals.
              </p>

              {/* Demo Credentials Box */}
              <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs mb-6">
                <div className="flex items-center justify-between font-bold text-[#231B33] mb-1">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <KeyRound className="w-3.5 h-3.5 text-[#2FBF8F]" />
                    <span>Demo Rider Account:</span>
                  </span>
                  <button
                    onClick={() => handleQuickDemoLogin("rider@kinetics.demo", "Rider@123", "/rider/home")}
                    className="text-[10px] font-black uppercase tracking-wider text-[#4A2C6D] hover:underline"
                  >
                    1-Click In
                  </button>
                </div>
                <div className="font-mono text-[11px] text-[#6B6480]">
                  rider@kinetics.demo <span className="text-[#4A2C6D]/40">•</span> Rider@123
                </div>
              </div>
            </div>

            {/* Buttons: Login and Register */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <Link
                to="/auth/rider?tab=login"
                className="w-full py-3.5 px-4 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 group-hover:shadow-plum"
              >
                <span>Login as Rider</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/auth/rider?tab=register"
                className="w-full py-3 px-4 rounded-full bg-[#FFF9F2] hover:bg-white text-[#4A2C6D] border border-[#4A2C6D]/20 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Register New Rider</span>
              </Link>
            </div>
          </div>

          {/* CARD 2: ANALYST */}
          <div className="bg-white rounded-3xl p-7 border border-[#4A2C6D]/15 shadow-soft flex flex-col justify-between hover:shadow-plum hover:border-[#4A2C6D]/30 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#4A2C6D]/5 rounded-bl-[100px] pointer-events-none transition-all group-hover:scale-110" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#4A2C6D]/15 text-[#4A2C6D] border border-[#4A2C6D]/25">
                  OPERATIONS &amp; RISK
                </span>
                <span className="text-xs font-mono font-bold text-[#6B6480]">ANALYST</span>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center mb-5 shadow-sm">
                <UserCheck className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-extrabold text-[#231B33] mb-2">Analyst</h2>
              <p className="text-xs text-[#6B6480] leading-relaxed mb-6">
                Investigative command center: inspect GPS spoof telemetry, monitor collusion graphs, triage payout holds, and adjudicate rider appeals.
              </p>

              {/* Demo Credentials Box */}
              <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs mb-6">
                <div className="flex items-center justify-between font-bold text-[#231B33] mb-1">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <KeyRound className="w-3.5 h-3.5 text-[#4A2C6D]" />
                    <span>Demo Analyst Account:</span>
                  </span>
                  <button
                    onClick={() => handleQuickDemoLogin("analyst@kinetics.demo", "Analyst@123", "/overview")}
                    className="text-[10px] font-black uppercase tracking-wider text-[#4A2C6D] hover:underline"
                  >
                    1-Click In
                  </button>
                </div>
                <div className="font-mono text-[11px] text-[#6B6480]">
                  analyst@kinetics.demo <span className="text-[#4A2C6D]/40">•</span> Analyst@123
                </div>
              </div>
            </div>

            {/* Buttons: Login and Register */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <Link
                to="/auth/analyst?tab=login"
                className="w-full py-3.5 px-4 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 group-hover:shadow-plum"
              >
                <span>Login as Analyst</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/auth/analyst?tab=register"
                className="w-full py-3 px-4 rounded-full bg-[#FFF9F2] hover:bg-white text-[#4A2C6D] border border-[#4A2C6D]/20 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Request Access</span>
              </Link>
            </div>
          </div>

          {/* CARD 3: ADMIN */}
          <div className="bg-white rounded-3xl p-7 border border-[#4A2C6D]/15 shadow-soft flex flex-col justify-between hover:shadow-plum hover:border-[#4A2C6D]/30 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6F61]/5 rounded-bl-[100px] pointer-events-none transition-all group-hover:scale-110" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#FF6F61]/15 text-[#FF6F61] border border-[#FF6F61]/25">
                  SYSTEM GOVERNANCE
                </span>
                <span className="text-xs font-mono font-bold text-[#6B6480]">ADMIN</span>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#FF6F61]/15 text-[#FF6F61] flex items-center justify-center mb-5 shadow-sm">
                <Shield className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-extrabold text-[#231B33] mb-2">Admin</h2>
              <p className="text-xs text-[#6B6480] leading-relaxed mb-6">
                Executive governance: calibrate automated release rules, deploy ML policy engines, configure demo fault injectors, and manage user team access.
              </p>

              {/* Demo Credentials Box */}
              <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs mb-6">
                <div className="flex items-center justify-between font-bold text-[#231B33] mb-1">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <KeyRound className="w-3.5 h-3.5 text-[#FF6F61]" />
                    <span>Demo Admin Account:</span>
                  </span>
                  <button
                    onClick={() => handleQuickDemoLogin("admin@kinetics.demo", "Admin@123", "/overview")}
                    className="text-[10px] font-black uppercase tracking-wider text-[#4A2C6D] hover:underline"
                  >
                    1-Click In
                  </button>
                </div>
                <div className="font-mono text-[11px] text-[#6B6480]">
                  admin@kinetics.demo <span className="text-[#4A2C6D]/40">•</span> Admin@123
                </div>
              </div>
            </div>

            {/* Buttons: Login and Register */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <Link
                to="/auth/admin?tab=login"
                className="w-full py-3.5 px-4 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 group-hover:shadow-plum"
              >
                <span>Login as Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/auth/admin?tab=register"
                className="w-full py-3 px-4 rounded-full bg-[#FFF9F2] hover:bg-white text-[#4A2C6D] border border-[#4A2C6D]/20 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Request Admin Access</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Pending Account Notice Box */}
        <div className="mt-10 max-w-2xl mx-auto p-4 rounded-2xl bg-white border border-[#4A2C6D]/15 text-xs text-[#6B6480] shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 font-bold">
              ⏳
            </div>
            <div>
              <span className="font-extrabold text-[#231B33]">Test Pending Account Status:</span>
              <p className="text-[11px]">pending@kinetics.demo / Pending@123 (Analyst request awaiting approval)</p>
            </div>
          </div>
          <button
            onClick={() => handleQuickDemoLogin("pending@kinetics.demo", "Pending@123", "/overview")}
            className="px-3.5 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 font-extrabold text-[11px] border border-amber-500/30 shrink-0 transition-colors"
          >
            Test Rejection
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-[#6B6480] pt-12 pb-4">
        <p>Kinetics Delivery Intelligence • Statutory Governance Architecture • ISO 27001 &amp; SOC2 Type II Certified</p>
      </footer>
    </div>
  );
}
