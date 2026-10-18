import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import {
  Shield,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowRight,
  Activity,
  Zap,
  Cpu,
  BarChart3,
  Smartphone,
  Award,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33]">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 bg-[#FFF9F2]/90 backdrop-blur-md border-b border-[#4A2C6D]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="md" />

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#6B6480]">
            <a href="#overview" className="hover:text-[#4A2C6D] transition-colors">Overview</a>
            <a href="#how-it-works" className="hover:text-[#4A2C6D] transition-colors">How it works</a>
            <a href="#features" className="hover:text-[#4A2C6D] transition-colors">Features</a>
            <a href="#contact" className="hover:text-[#4A2C6D] transition-colors">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/choose-role"
              className="px-5 py-2.5 rounded-full text-sm font-bold text-[#4A2C6D] hover:bg-[#4A2C6D]/10 transition-all"
            >
              Login
            </Link>
            <Link
              to="/choose-role"
              className="px-6 py-2.5 rounded-full text-sm font-bold bg-[#4A2C6D] text-white shadow-plum hover:bg-[#392153] transition-all"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section (Reference Image 01) */}
      <section className="relative overflow-hidden pt-12 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4A2C6D]/10 border border-[#4A2C6D]/20 text-[#4A2C6D] text-xs font-bold">
              <Shield className="w-4 h-4 text-[#FF6F61]" />
              <span>Securing over 450,000 active delivery couriers</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] text-[#231B33]">
              Trust every rider. <br />
              <span className="text-[#4A2C6D]">Stop fraud before payout.</span>
            </h1>

            <p className="text-lg text-[#6B6480] max-w-xl leading-relaxed">
              Real-time AI behavioral intelligence detecting account sharing, GPS spoofing, and multi-app collusion before delivery disbursements occur.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/choose-role"
                className="px-8 py-3.5 rounded-full bg-[#4A2C6D] text-white font-bold shadow-plum hover:bg-[#392153] transition-all flex items-center gap-2"
              >
                <span>Register Fleet</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/choose-role"
                className="px-8 py-3.5 rounded-full bg-white border border-[#4A2C6D]/20 text-[#231B33] font-bold shadow-soft hover:bg-[#F0EAFB]/50 transition-all"
              >
                Sign In to Console
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-6 text-xs font-bold text-[#6B6480] border-t border-[#4A2C6D]/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#2FBF8F]" />
                <span>Sub-200ms Decisioning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#5FD3B3]" />
                <span>Zero Driver Friction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#4A2C6D]" />
                <span>SOC2 Type II Certified</span>
              </div>
            </div>
          </div>

          {/* Right Column: Courier Verification Engine Preview Widget */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl shadow-plum border border-[#4A2C6D]/15 p-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center font-bold">
                    🛡️
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#231B33]">Courier Verification Engine</h3>
                    <p className="text-xs text-[#6B6480]">Live Payout Interceptor • Session ID #TJ-89421</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[11px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
                  Verified Payout
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {/* Collusion Risk Card */}
                <div className="bg-[#FFF9F2] rounded-xl p-4 border border-[#4A2C6D]/10">
                  <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">Collusion Risk</span>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[#4A2C6D]">12%</span>
                    <span className="text-xs font-semibold text-[#2FBF8F]">Safe Margin</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#2FBF8F]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Allow Dispatch</span>
                  </div>
                </div>

                {/* Route Integrity Audit */}
                <div className="bg-[#FFF9F2] rounded-xl p-4 border border-[#4A2C6D]/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">Route Integrity</span>
                    <span className="text-xs font-bold text-[#4A2C6D]">14.8 km Verified</span>
                  </div>
                  <div className="h-16 bg-white rounded-lg border border-gray-200 p-2 flex items-end justify-between gap-1 mb-2">
                    <div className="w-full bg-[#F0EAFB] h-8 rounded-sm" />
                    <div className="w-full bg-[#4A2C6D] h-14 rounded-sm" />
                    <div className="w-full bg-[#5FD3B3] h-10 rounded-sm" />
                    <div className="w-full bg-[#FF6F61] h-12 rounded-sm" />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#6B6480] font-semibold">
                    <span>No Spoof Signatures</span>
                    <span>99.4% Match</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[#231B33]">
                    <Smartphone className="w-4 h-4 text-[#4A2C6D]" />
                    <span>GPS Telemetry: Authentic</span>
                  </div>
                  <span className="text-[#6B6480]">True altitude & gyro delta</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[#231B33]">
                    <Lock className="w-4 h-4 text-[#5FD3B3]" />
                    <span>Device Fingerprint: Verified</span>
                  </div>
                  <span className="text-[#6B6480]">Single-instance hardware key</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold">
                <span className="text-[#6B6480]">Instant Settlement Cleared</span>
                <span className="text-[#2FBF8F] font-extrabold text-sm">$1,240.50</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Telemetry Stats Banner */}
      <section className="bg-white border-y border-[#4A2C6D]/10 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B6480]">Ecosystem Telemetry</span>
            <h2 className="text-2xl font-extrabold text-[#231B33] mt-1">Real-world impact across 18 regional hubs</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#FFF9F2] rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft">
              <span className="text-sm font-semibold text-[#6B6480]">Riders Verified</span>
              <div className="text-3xl font-extrabold text-[#231B33] mt-2">482,910</div>
              <div className="mt-2 text-xs font-bold text-[#2FBF8F] inline-flex items-center gap-1">
                <span>↑ +18.4%</span> this month
              </div>
            </div>

            <div className="bg-[#FFF9F2] rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft">
              <span className="text-sm font-semibold text-[#6B6480]">Fraud Blocked</span>
              <div className="text-3xl font-extrabold text-[#FF6F61] mt-2">$3.42M</div>
              <div className="mt-2 text-xs font-semibold text-[#6B6480]">
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 font-bold mr-1">Prevented</span> ghost order disbursements
              </div>
            </div>

            <div className="bg-[#FFF9F2] rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft">
              <span className="text-sm font-semibold text-[#6B6480]">Avg Decision Time</span>
              <div className="text-3xl font-extrabold text-[#4A2C6D] mt-2">140ms</div>
              <div className="mt-2 text-xs font-semibold text-[#6B6480]">
                <span className="px-2 py-0.5 rounded bg-[#4A2C6D]/10 text-[#4A2C6D] font-bold mr-1">Edge AI</span> inline payout validation
              </div>
            </div>

            <div className="bg-[#FFF9F2] rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft">
              <span className="text-sm font-semibold text-[#6B6480]">Payouts Protected</span>
              <div className="text-3xl font-extrabold text-[#231B33] mt-2">99.98%</div>
              <div className="mt-2 text-xs font-semibold text-[#6B6480]">
                <span className="px-2 py-0.5 rounded bg-[#2FBF8F]/15 text-[#2FBF8F] font-bold mr-1">Accuracy</span> zero false release rate
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-[#F0EAFB] border border-[#4A2C6D]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4A2C6D] text-white flex items-center justify-center font-bold">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#231B33]">Multi-Agent Collusion Graph Interception</h4>
                <p className="text-xs text-[#6B6480]">Instantly isolates synchronized device clusters swapping accounts across gig delivery platforms.</p>
              </div>
            </div>
            <Link
              to="/choose-role"
              className="text-xs font-bold text-[#4A2C6D] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Explore Detection Engine</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* How TrustJuggler Works (Reference Image 02 - part 1) */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-xs font-bold mb-3">
              <span>END-TO-END ORCHESTRATION</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#231B33]">How TrustJuggler Works</h2>
            <p className="text-sm text-[#6B6480] mt-2">Continuous intelligence across every delivery milestone, preserving fairness without friction.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft relative">
              <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white font-bold text-xs flex items-center justify-center mb-4">
                01
              </div>
              <h3 className="font-bold text-base text-[#231B33] mb-2">Rider signs up</h3>
              <p className="text-xs text-[#6B6480] leading-relaxed">
                Instant KYC verification, sub-second biometric liveness attestation, and cryptographically signed device integrity checks.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] font-bold text-[#4A2C6D]">
                🔒 Zero-storage Biometrics
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft relative">
              <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white font-bold text-xs flex items-center justify-center mb-4">
                02
              </div>
              <h3 className="font-bold text-base text-[#231B33] mb-2">Behavior monitored live</h3>
              <p className="text-xs text-[#6B6480] leading-relaxed">
                Real-time continuous sensor fusion, accelerometer & gyroscope telemetry, and physical road-network route plausibility.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] font-bold text-[#FF6F61]">
                ⚡ 40Hz Inertial Ingestion
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft relative">
              <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white font-bold text-xs flex items-center justify-center mb-4">
                03
              </div>
              <h3 className="font-bold text-base text-[#231B33] mb-2">AI risk score</h3>
              <p className="text-xs text-[#6B6480] leading-relaxed">
                Multi-factor Graph Neural Networks (GNN) continuously detecting emulator clusters, synthetic identities, and account swaps.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] font-bold text-[#4A2C6D]">
                🌐 4.2M Node Link Graph
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft relative">
              <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white font-bold text-xs flex items-center justify-center mb-4">
                04
              </div>
              <h3 className="font-bold text-base text-[#231B33] mb-2">Triage Decisions</h3>
              <p className="text-xs text-[#6B6480] leading-relaxed">
                Dynamic routing protects delivery capital through contextual policies without burdening innocent couriers.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-[10px] font-bold">
                <div className="flex justify-between text-[#2FBF8F]"><span>Allow (Verified Payout)</span><span>97.4%</span></div>
                <div className="flex justify-between text-[#F5A524]"><span>Challenge (Liveness)</span><span>2.1%</span></div>
                <div className="flex justify-between text-[#E5484D]"><span>Escalate (Ring Risk)</span><span>0.5%</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Precision Defence for Delivery Fleets (Reference Image 02 - part 2) */}
      <section id="features" className="py-20 bg-white border-y border-[#4A2C6D]/10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-xs font-bold mb-3">
              <span>🛡️ ENGINEERED RESILIENCE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#231B33]">Precision Defence for Delivery Fleets</h2>
            <p className="text-sm text-[#6B6480] mt-2">Stop payout draining, organized syndicates, and GPS emulator spoofs with three purpose-built defense modules.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Module 1 */}
            <div className="bg-[#FFF9F2] rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft flex flex-col justify-between">
              <div>
                <div className="h-40 rounded-xl bg-white border border-gray-200 mb-6 flex items-center justify-center relative overflow-hidden p-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-pink-50 opacity-50" />
                  <div className="text-xs font-mono font-bold text-[#4A2C6D] bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
                    VELOCITY VIOLATION • Mock-Provider Delta: 184km/h
                  </div>
                </div>
                <div className="text-xs font-bold text-[#4A2C6D] uppercase tracking-wider mb-1">PHYSICAL VALIDATION</div>
                <h3 className="text-xl font-bold text-[#231B33] mb-3">GPS Spoof Detection</h3>
                <p className="text-xs text-[#6B6480] leading-relaxed mb-4">
                  Detects rooted handsets, Android mock-location flags, satellite SNR anomalies, and physically impossible teleportation hops in real time.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-[#231B33] font-semibold pt-4 border-t border-[#4A2C6D]/10">
                <li className="flex items-center gap-2">✓ Sub-millisecond mock-provider interception</li>
                <li className="flex items-center gap-2">✓ Satellite geometry & carrier-phase verification</li>
                <li className="flex items-center gap-2">✓ Dead-reckoning cross-validation against cell towers</li>
              </ul>
            </div>

            {/* Module 2 */}
            <div className="bg-[#FFF9F2] rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft flex flex-col justify-between">
              <div>
                <div className="h-40 rounded-xl bg-white border border-gray-200 mb-6 flex items-center justify-center relative overflow-hidden p-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-indigo-50 opacity-50" />
                  <div className="text-xs font-mono font-bold text-[#FF6F61] bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
                    SHARED IBAN RING • S1 - R1 - R2 Link Cluster
                  </div>
                </div>
                <div className="text-xs font-bold text-[#4A2C6D] uppercase tracking-wider mb-1">GRAPH INTELLIGENCE</div>
                <h3 className="text-xl font-bold text-[#231B33] mb-3">Collusion Graph Engine</h3>
                <p className="text-xs text-[#6B6480] leading-relaxed mb-4">
                  Exposes coordinated multi-accounting rings, shared bank accounts, device recycling farms, and ghost customer pairing rings.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-[#231B33] font-semibold pt-4 border-t border-[#4A2C6D]/10">
                <li className="flex items-center gap-2">✓ High-order entity link extraction</li>
                <li className="flex items-center gap-2">✓ Device fingerprint hashing & entropy checks</li>
                <li className="flex items-center gap-2">✓ Self-reinforcing merchant-courier kickback flags</li>
              </ul>
            </div>

            {/* Module 3 */}
            <div className="bg-[#FFF9F2] rounded-xl p-6 border border-[#4A2C6D]/10 shadow-soft flex flex-col justify-between">
              <div>
                <div className="h-40 rounded-xl bg-white border border-gray-200 mb-6 flex items-center justify-center relative overflow-hidden p-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 to-teal-50 opacity-50" />
                  <div className="text-xs font-mono font-bold text-[#2FBF8F] bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
                    INSTANT PAYOUT • Cleared in 0.28s
                  </div>
                </div>
                <div className="text-xs font-bold text-[#4A2C6D] uppercase tracking-wider mb-1">LIQUIDITY SHIELD</div>
                <h3 className="text-xl font-bold text-[#231B33] mb-3">Payout Protection Vault</h3>
                <p className="text-xs text-[#6B6480] leading-relaxed mb-4">
                  Autonomous micro-escrows and zero-second settlement gates prevent unauthorized batch cash-outs before ACH or Stripe rails clear.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-[#231B33] font-semibold pt-4 border-t border-[#4A2C6D]/10">
                <li className="flex items-center gap-2">✓ Smart risk-contingent hold thresholds</li>
                <li className="flex items-center gap-2">✓ Instant unlock for clean telemetry history</li>
                <li className="flex items-center gap-2">✓ Full chargeback immunity for verified runs</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Designed for Complete Ecosystem Harmony (Reference Image 02 - part 3) */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-xs font-bold mb-3">
              <span>⚖️ DUAL PERSPECTIVE PLATFORM</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#231B33]">Designed for Complete Ecosystem Harmony</h2>
            <p className="text-sm text-[#6B6480] mt-2">Empowering fraud investigators with macro controls while keeping hard-working drivers fast, verified, and well-paid.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Admin Card */}
            <div className="bg-[#4A2C6D] text-white rounded-xl p-8 shadow-plum flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6 text-[#FF6F61]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white/10 text-white">
                    OPERATIONS & SECURITY
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold mb-3">For Admins &amp; Risk Teams</h3>
                <p className="text-sm text-gray-300 leading-relaxed mb-6">
                  Gain situational omniscience. Detect cross-city collusion networks before payouts trigger, and tune automated risk policies dynamically.
                </p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-[#5FD3B3] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Real-time fleet fraud heatmaps</h4>
                      <p className="text-xs text-gray-300">Live geospatial cluster detection with speed anomaly alerts.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Cpu className="w-5 h-5 text-[#FFC24B] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Automated collusion ring clustering</h4>
                      <p className="text-xs text-gray-300">Self-assembling entity graphs surfacing multi-account device farms.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-[#5FD3B3] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Customizable threshold policy editor</h4>
                      <p className="text-xs text-gray-300">Simulate and push automated hold triggers without engineering sprints.</p>
                    </div>
                  </div>
                </div>
              </div>
              <Link
                to="/choose-role"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FF6F61] hover:bg-[#e05a4e] text-white font-bold text-sm transition-all shadow-md"
              >
                <span>Explore Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Rider Card */}
            <div className="bg-white rounded-xl p-8 border border-[#4A2C6D]/15 shadow-plum flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D]">
                    DRIVER EXPERIENCE
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-[#231B33] mb-3">For Honest Riders</h3>
                <p className="text-sm text-[#6B6480] leading-relaxed mb-6">
                  Eliminate wrongful deactivations. Get frictionless automated clearance, transparent live trust scores, and instantaneous daily payouts.
                </p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#2FBF8F] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-[#231B33]">Instant biometric self-clearance</h4>
                      <p className="text-xs text-[#6B6480]">Resolve occasional GPS drift with a rapid 3-second face verification.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-[#4A2C6D] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-[#231B33]">Real-time transparent trust badge</h4>
                      <p className="text-xs text-[#6B6480]">Full transparency into what factors maintain your tier-one status.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-[#FF6F61] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-[#231B33]">Zero-delay instant payout unlock</h4>
                      <p className="text-xs text-[#6B6480]">Clean telemetry immediately bypasses standard 48-hour escrow holds.</p>
                    </div>
                  </div>
                </div>
              </div>
              <Link
                to="/choose-role"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-bold text-sm transition-all shadow-md"
              >
                <span>View Rider Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stress Test Bar */}
      <section className="bg-white border-y border-[#4A2C6D]/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B6480]">Live Stress Test</span>
              <h3 className="font-extrabold text-lg text-[#231B33]">Experience the Triage Decision Engine</h3>
              <p className="text-xs text-[#6B6480]">Test custom fraud scenarios through our interactive sandbox to evaluate latency and precision.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/choose-role" className="px-4 py-2 rounded-full bg-[#F0EAFB] text-[#4A2C6D] text-xs font-bold hover:bg-[#e2d5f8] transition-all">
              Simulate Clean Run
            </Link>
            <Link to="/choose-role" className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-600 text-xs font-bold hover:bg-rose-500/20 transition-all">
              Simulate GPS Jump
            </Link>
            <Link to="/choose-role" className="px-4 py-2 rounded-full bg-amber-500/10 text-amber-700 text-xs font-bold hover:bg-amber-500/20 transition-all">
              Simulate Device Ring
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FFF9F2] border-t border-[#4A2C6D]/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#6B6480]">
          <div className="flex items-center gap-6 flex-wrap justify-center md:justify-start">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#2FBF8F]" />
              <span>SOC2 Type II Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#4A2C6D]" />
              <span>GDPR &amp; CCPA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#FF6F61]" />
              <span>PCI-DSS Level 1 Escrow</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#F5A524]" />
              <span>&lt; 45ms P99 Latency SLA</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="#security" className="hover:text-[#4A2C6D] font-semibold">Read Security Whitepaper ↗</a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-[#4A2C6D]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B6480]">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>© 2025 Kinetics (TrustJuggler Systems Inc.) All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:underline">Privacy Policy</a>
            <a href="#terms" className="hover:underline">Terms of Service</a>
            <a href="#compliance" className="hover:underline">Compliance &amp; Trust</a>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
              Systems Operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
