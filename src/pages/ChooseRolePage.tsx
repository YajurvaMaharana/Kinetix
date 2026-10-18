import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Shield, Smartphone, ArrowLeft, CheckCircle2, Lock, ArrowRight } from "lucide-react";

export default function ChooseRolePage() {
  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col justify-between py-8 px-6">
      {/* Top Header */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6B6480] hover:text-[#4A2C6D] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </Link>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
          CORE NETWORK ACTIVE • 99.98% INTEGRITY
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto w-full my-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#4A2C6D] text-white flex items-center justify-center text-3xl font-extrabold shadow-plum">
            K
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#231B33] tracking-tight">
          Welcome to Kinetics
        </h1>
        <p className="text-sm sm:text-base text-[#6B6480] mt-3 max-w-xl mx-auto">
          Choose how you want to continue to access your personalized portal and maintain real-time fleet equilibrium.
        </p>

        {/* Role Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 mt-12 text-left">
          {/* Admin / Analyst Card */}
          <div className="bg-white rounded-xl p-8 border border-[#4A2C6D]/15 shadow-plum flex flex-col justify-between relative overflow-hidden group hover:border-[#4A2C6D]/40 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#4A2C6D]/5 rounded-bl-full pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D]">
                  ENTERPRISE &amp; FLEET
                </span>
                <span className="text-xs font-mono font-semibold text-[#6B6480]">PORTAL ID: TJ-ADM-01</span>
              </div>

              <div className="w-12 h-12 rounded-xl bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center mb-4">
                <Shield className="w-6 h-6" />
              </div>

              <h3 className="text-2xl font-extrabold text-[#231B33] mb-2">Admin / Analyst</h3>
              <p className="text-xs sm:text-sm text-[#6B6480] leading-relaxed mb-6">
                Monitor risk, investigate cases, manage fraud policies and oversee payout approvals across your entire delivery fleet.
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 rounded-lg bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs font-semibold text-[#4A2C6D]">
                  🌐 Graph Investigations
                </span>
                <span className="px-3 py-1 rounded-lg bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs font-semibold text-[#4A2C6D]">
                  📊 Real-time Telemetry
                </span>
                <span className="px-3 py-1 rounded-lg bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs font-semibold text-[#4A2C6D]">
                  🛡️ Payout Controls
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-gray-100">
              <Link
                to="/admin/auth?mode=login"
                className="py-3 px-4 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-bold text-xs text-center transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <span>Login to Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/admin/auth?mode=register"
                className="py-3 px-4 rounded-full bg-[#FFF9F2] hover:bg-gray-100 border border-[#4A2C6D]/20 text-[#4A2C6D] font-bold text-xs text-center transition-all"
              >
                Request Access
              </Link>
            </div>
          </div>

          {/* Delivery Rider Card */}
          <div className="bg-white rounded-xl p-8 border border-[#4A2C6D]/15 shadow-plum flex flex-col justify-between relative overflow-hidden group hover:border-[#4A2C6D]/40 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2FBF8F]/5 rounded-bl-full pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F]">
                  COURIER &amp; DRIVER
                </span>
                <span className="text-xs font-mono font-semibold text-[#6B6480]">PORTAL ID: TJ-RDR-09</span>
              </div>

              <div className="w-12 h-12 rounded-xl bg-[#2FBF8F]/15 text-[#2FBF8F] flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>

              <h3 className="text-2xl font-extrabold text-[#231B33] mb-2">Delivery Rider</h3>
              <p className="text-xs sm:text-sm text-[#6B6480] leading-relaxed mb-6">
                Track earnings, check live trust scores, complete instant biometric verification, and unlock fast payouts.
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 rounded-lg bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs font-semibold text-[#231B33]">
                  ⚡ Instant Payouts
                </span>
                <span className="px-3 py-1 rounded-lg bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs font-semibold text-[#231B33]">
                  🛡️ Trust Score Badge
                </span>
                <span className="px-3 py-1 rounded-lg bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs font-semibold text-[#231B33]">
                  🔒 Zero-Delay Clearing
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-gray-100">
              <Link
                to="/rider/auth?mode=login"
                className="py-3 px-4 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-bold text-xs text-center transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <span>Rider Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/rider/auth?mode=register"
                className="py-3 px-4 rounded-full bg-[#FF6F61]/15 hover:bg-[#FF6F61]/25 text-[#FF6F61] font-bold text-xs text-center transition-all"
              >
                New Registration
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Trust Banner */}
        <div className="mt-12 bg-white rounded-xl p-4 border border-[#4A2C6D]/10 shadow-soft max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B6480]">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#2FBF8F]" />
            <span>Protected by autonomous multi-agent collusion defense &amp; tamper-resistant biometric telemetry.</span>
          </div>
          <div className="flex items-center gap-4 font-bold shrink-0">
            <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-[#4A2C6D]" /> SOC2 Certified</span>
            <span>&lt; 180ms Decisioning</span>
          </div>
        </div>
      </div>

      {/* Footer support */}
      <div className="max-w-5xl mx-auto w-full text-center text-xs text-[#6B6480] pb-4">
        Need help deciding? <a href="#support" className="text-[#4A2C6D] font-bold underline">Contact our Fleet Support Team</a> or explore the <a href="#docs" className="text-[#4A2C6D] font-bold underline">Documentation</a>.
      </div>
    </div>
  );
}
