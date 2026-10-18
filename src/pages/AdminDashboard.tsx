import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { MOCK_STATS, MOCK_ALERTS, MOCK_PENDING_PAYOUTS } from "@/data/mockData";
import {
  ShieldAlert,
  Activity,
  FolderKanban,
  Banknote,
  Scale,
  FileText,
  Search,
  Bell,
  Download,
  Sparkles,
  ArrowUpRight,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<"Today" | "Last 7 Days (Active)" | "Last 30 Days" | "Custom">("Last 7 Days (Active)");
  const [activeNav, setActiveNav] = useState<string>("Overview");
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [pendingPayouts, setPendingPayouts] = useState(MOCK_PENDING_PAYOUTS);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleResolvePayout = (id: string, action: "release" | "block") => {
    setPendingPayouts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-[#4A2C6D]/15 flex flex-col justify-between hidden lg:flex sticky top-0 h-screen">
        <div>
          <div className="p-6 border-b border-[#4A2C6D]/10">
            <Logo size="md" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6480] mt-1 block">
              GUARDIAN OPS
            </span>
          </div>

          <nav className="p-4 space-y-1.5 text-xs font-bold">
            {[
              { label: "Overview", icon: Activity },
              { label: "Live Monitor", icon: ShieldAlert },
              { label: "Investigations", icon: FolderKanban },
              { label: "Payouts", icon: Banknote },
              { label: "Policies", icon: Scale },
              { label: "Appeals", icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveNav(item.label)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? "bg-[#4A2C6D] text-white shadow-plum" : "text-[#6B6480] hover:bg-[#FFF9F2] hover:text-[#231B33]"}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout at bottom of sidebar */}
        <div className="p-4 border-t border-[#4A2C6D]/10 bg-[#FFF9F2]/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#4A2C6D] text-white font-extrabold flex items-center justify-center text-xs">
                ER
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-[#231B33]">{user?.name || "Elena Rostova"}</h4>
                <p className="text-[10px] text-[#6B6480]">Lead Auditor</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-[#4A2C6D]/15 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#6B6480] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search riders, nodes, spoof flags..."
                className="w-full bg-[#FFF9F2] border border-[#4A2C6D]/20 rounded-full pl-10 pr-12 py-2 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
              />
              <span className="absolute right-3.5 top-2 text-[10px] font-mono font-bold text-[#6B6480] bg-white px-1.5 py-0.5 rounded border border-gray-200">
                ⌘K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#2FBF8F] animate-pulse" />
              All Systems Operational
            </div>

            <button className="relative p-2 rounded-xl bg-[#FFF9F2] text-[#6B6480] hover:text-[#231B33] border border-[#4A2C6D]/10">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white font-extrabold flex items-center justify-center text-xs">
                ER
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-extrabold text-[#231B33]">Elena Rostova</div>
                <div className="text-[10px] text-[#6B6480]">Super Admin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Title & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-xs font-bold mb-1">
                AUTONOMOUS ECOSYSTEM INTEGRITY
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231B33]">
                Fleet Fraud &amp; Payout Command Center
              </h1>
              <p className="text-xs sm:text-sm text-[#6B6480]">
                Live risk orchestration across 18 delivery hubs • <span className="text-[#2FBF8F] font-bold">Real-time telemetry synced 3s ago</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white rounded-xl border border-[#4A2C6D]/15 p-1 text-xs font-bold">
                {(["Today", "Last 7 Days (Active)", "Last 30 Days", "Custom"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${timeFilter === t ? "bg-[#4A2C6D] text-white shadow-sm" : "text-[#6B6480] hover:text-[#231B33]"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <button className="px-4 py-2 rounded-xl bg-white border border-[#4A2C6D]/20 text-[#231B33] text-xs font-bold shadow-soft hover:bg-gray-50 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-[#4A2C6D]" />
                <span>Export Audit Ledger</span>
              </button>

              <button className="px-4 py-2 rounded-xl bg-[#4A2C6D] text-white text-xs font-bold shadow-plum hover:bg-[#392153] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FFC24B]" />
                <span>Deploy New Policy</span>
              </button>
            </div>
          </div>

          {/* 4 Key Metrics Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#6B6480] uppercase tracking-wider">Total Active Couriers</span>
                <span className="p-2 rounded-lg bg-[#2FBF8F]/15 text-[#2FBF8F]">🚴</span>
              </div>
              <div className="text-3xl font-extrabold text-[#231B33]">{MOCK_STATS.totalActiveCouriers}</div>
              <div className="mt-2 text-xs font-bold text-[#2FBF8F]">
                {MOCK_STATS.activeCouriersGrowth}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#6B6480] uppercase tracking-wider">Collusion Rings Intercepted</span>
                <span className="p-2 rounded-lg bg-rose-500/15 text-rose-600">🛡️</span>
              </div>
              <div className="text-3xl font-extrabold text-[#231B33]">{MOCK_STATS.collusionRings}</div>
              <div className="mt-2 text-xs font-semibold text-[#6B6480]">
                <span className="text-rose-600 font-bold">3 High Priority</span> isolated by AI
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#6B6480] uppercase tracking-wider">Payouts Under Review</span>
                <span className="p-2 rounded-lg bg-amber-500/15 text-amber-600">⏳</span>
              </div>
              <div className="text-3xl font-extrabold text-[#231B33]">{MOCK_STATS.payoutsUnderReview}</div>
              <div className="mt-2 text-xs font-semibold text-[#6B6480]">
                <span className="text-amber-700 font-bold">8 pending</span> active challenges
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#6B6480] uppercase tracking-wider">Automated Release Rate</span>
                <span className="p-2 rounded-lg bg-[#4A2C6D]/10 text-[#4A2C6D]">✨</span>
              </div>
              <div className="text-3xl font-extrabold text-[#231B33]">{MOCK_STATS.automatedReleaseRate}</div>
              <div className="mt-2 text-xs font-semibold text-[#6B6480]">
                <span className="text-[#2FBF8F] font-bold">0.02% dispute</span> appeal index
              </div>
            </div>
          </div>

          {/* Middle Grid: Live Risk Trajectory Chart & Pending Payout Approvals */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Live Risk Trajectory & Anomaly Frequency (24h) */}
            <div className="lg:col-span-8 bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="font-extrabold text-base text-[#231B33]">Live Risk Trajectory &amp; Anomaly Frequency (24h)</h3>
                    <p className="text-xs text-[#6B6480]">Telemetry streams evaluated across GPS shifts, batching cadence, &amp; device MAC vectors</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2FBF8F]" /> Nominal Flow</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Challenge Queue</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Spoof Spikes</span>
                  </div>
                </div>

                {/* SVG Mock Chart */}
                <div className="h-64 bg-[#FFF9F2] rounded-xl border border-gray-200 relative p-4 flex items-end">
                  <div className="absolute inset-x-4 inset-y-4 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="border-b border-gray-400 w-full" />
                    <div className="border-b border-gray-400 w-full" />
                    <div className="border-b border-gray-400 w-full" />
                    <div className="border-b border-gray-400 w-full" />
                  </div>

                  <svg className="absolute inset-0 w-full h-full p-4 overflow-visible" preserveAspectRatio="none" viewBox="0 0 600 200">
                    {/* Nominal Flow Line */}
                    <path d="M 0 150 Q 150 130 300 110 T 600 90" fill="none" stroke="#2FBF8F" strokeWidth="3" />
                    {/* Challenge Queue Line */}
                    <path d="M 0 180 Q 150 160 300 130 T 600 120" fill="none" stroke="#F5A524" strokeWidth="2" strokeDasharray="4 4" />
                    {/* Spoof Spikes Line */}
                    <path d="M 0 190 Q 200 190 320 80 Q 380 40 450 150 T 600 180" fill="none" stroke="#E5484D" strokeWidth="3" />
                  </svg>

                  {/* Callout Badge 1 */}
                  <div className="absolute top-12 left-[52%] bg-white rounded-lg shadow-plum p-2 border border-gray-200 text-[10px]">
                    <div className="font-bold text-[#231B33]">14:22 UTC • Ring Spoof Burst</div>
                    <div className="text-gray-500">6 Device Spoofs Detected</div>
                  </div>

                  {/* Callout Badge 2 */}
                  <div className="absolute top-6 right-8 bg-white rounded-lg shadow-plum p-2 border border-gray-200 text-[10px]">
                    <div className="font-bold text-rose-600">19:40 UTC • Mock GPS Burst</div>
                    <div className="text-gray-500">Velocity Vector &gt; 140km/h</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-[#6B6480] font-semibold pt-4 mt-4 border-t border-gray-100">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00 (Peak Shift)</span>
                <span>20:00</span>
                <span>Now</span>
              </div>
            </div>

            {/* Pending Payout Approvals */}
            <div className="lg:col-span-4 bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-base text-[#231B33]">Pending Payout Approvals ({pendingPayouts.length})</h3>
                  <span className="text-[11px] font-mono font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                    Next ACH: 42m
                  </span>
                </div>

                <div className="space-y-4">
                  {pendingPayouts.length === 0 ? (
                    <div className="text-center py-12 text-xs text-[#6B6480]">
                      <CheckCircle2 className="w-8 h-8 text-[#2FBF8F] mx-auto mb-2" />
                      All pending payouts have been successfully cleared.
                    </div>
                  ) : (
                    pendingPayouts.map((item) => (
                      <div key={item.id} className="p-4 rounded-xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-extrabold text-[#231B33]">${item.amount.toFixed(2)}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.status === "IBAN Conflict" ? "bg-rose-500/15 text-rose-600" : "bg-amber-500/15 text-amber-700"}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B6480] leading-relaxed">
                          {item.reason}
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => handleResolvePayout(item.id, "release")}
                            className="py-1.5 rounded-lg bg-[#2FBF8F] hover:bg-[#28ab80] text-white font-bold text-xs transition-colors"
                          >
                            Release
                          </button>
                          <button
                            onClick={() => handleResolvePayout(item.id, "block")}
                            className="py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-colors"
                          >
                            Block &amp; Flag
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Multi-Agent Collusion Radar widget at bottom right */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-[#231B33] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#4A2C6D]" />
                    <span>Multi-Agent Collusion Radar</span>
                  </h4>
                  <span className="text-[10px] font-mono text-[#6B6480]">Graph Analysis</span>
                </div>
                <p className="text-[11px] text-[#6B6480] mb-3">
                  Graph analysis isolating 4 interconnected courier nodes sharing device UUIDs &amp; delivery endpoints.
                </p>
                <div className="h-28 rounded-xl bg-[#FFF9F2] border border-gray-200 p-3 flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">N1</div>
                    <div className="w-8 h-8 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">N2</div>
                    <div className="w-8 h-8 rounded-full bg-[#4A2C6D] text-white text-[10px] font-bold flex items-center justify-center shadow-md">UUID</div>
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">N3</div>
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">N4</div>
                  </div>
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 text-[10px] font-bold">
                    Ring #C-902 Flagged
                  </div>
                </div>
                <button className="w-full mt-3 py-2 rounded-xl bg-[#FFF9F2] border border-[#4A2C6D]/20 text-[#4A2C6D] font-bold text-xs hover:bg-[#F0EAFB] transition-colors flex items-center justify-center gap-1">
                  <span>Open Graph Inspector</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Fleet Alerts & Triage Queue Table */}
          <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-[#231B33]">Recent Fleet Alerts &amp; Triage Queue</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-xs font-bold">5 Priority</span>
                </div>
                <p className="text-xs text-[#6B6480]">Real-time anomalous courier sessions requiring automated or human adjudication</p>
              </div>

              <button className="px-4 py-2 rounded-xl bg-[#FFF9F2] border border-[#4A2C6D]/20 text-[#231B33] text-xs font-bold hover:bg-gray-50 flex items-center gap-1.5">
                <span>Filter Hubs</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-[11px] font-bold text-[#6B6480] uppercase tracking-wider">
                    <th className="pb-3 px-4">Courier ID &amp; Name</th>
                    <th className="pb-3 px-4">Route Hub</th>
                    <th className="pb-3 px-4">Risk Factor Detected</th>
                    <th className="pb-3 px-4">AI Risk</th>
                    <th className="pb-3 px-4">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                  {alerts.map((al) => (
                    <tr key={al.id} className="hover:bg-[#FFF9F2]/60 transition-colors">
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${al.avatarBg}`}>
                          {al.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <div className="font-extrabold text-[#231B33]">{al.name}</div>
                          <div className="text-[10px] font-mono text-[#6B6480]">{al.courier_id}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6480]">{al.hub}</td>
                      <td className="py-3.5 px-4 text-[#231B33] font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span>{al.risk_factor}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-mono font-extrabold ${al.ai_risk > 70 ? "text-rose-600" : al.ai_risk > 40 ? "text-amber-600" : "text-emerald-600"}`}>
                          {al.ai_risk}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${al.status === "Allow" ? "bg-emerald-500/15 text-emerald-600" : al.status === "Challenge" ? "bg-amber-500/15 text-amber-700" : "bg-rose-500/15 text-rose-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${al.status === "Allow" ? "bg-emerald-500" : al.status === "Challenge" ? "bg-amber-500" : "bg-rose-500"}`} />
                          {al.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equilibrium Core Banner at Bottom */}
          <div className="bg-white rounded-xl p-6 border border-[#4A2C6D]/15 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#F0EAFB] text-[#4A2C6D] flex items-center justify-center font-bold">
                🛡️
              </div>
              <div>
                <h4 className="font-extrabold text-base text-[#231B33]">TrustJuggler Equilibrium Core Active</h4>
                <p className="text-xs text-[#6B6480]">Continuous multi-tenant fraud guardian shielding $3.2M in daily gig worker disbursements.</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs font-bold shrink-0">
              <div>
                <div className="text-[#6B6480] text-[10px]">Engine Latency</div>
                <div className="text-[#231B33] font-mono text-sm">18ms</div>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>High Fidelity</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
