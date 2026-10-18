import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Shield,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Key,
  Building,
  Mail,
  Lock,
  User,
  Sparkles,
  Info,
} from "lucide-react";

export default function AdminAuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const [tab, setTab] = useState<"login" | "register">(initialTab);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Login Form States
  const [loginEmail, setLoginEmail] = useState("admin@kinetics.demo");
  const [loginPassword, setLoginPassword] = useState("Admin@123");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register Form States ("Request access")
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Synchronize URL tab parameter
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab === "register" || currentTab === "login") {
      setTab(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: "login" | "register") => {
    setTab(newTab);
    setSearchParams({ tab: newTab });
    setLoginError(null);
    setRegError(null);
    setRequestSubmitted(false);
  };

  // Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailTrim = loginEmail.trim();
    if (!emailTrim || !/\S+@\S+\.\S+/.test(emailTrim)) {
      setLoginError("Please enter a valid administrator work email.");
      return;
    }

    if (!loginPassword) {
      setLoginError("Please enter your administrator password.");
      return;
    }

    setLoginLoading(true);

    try {
      const loggedUser = await login(emailTrim, loginPassword);

      // Enforce strict portal role matching
      if (loggedUser.role !== "ADMIN") {
        sessionStorage.clear();
        setLoginError("This account doesn't have access to this portal. Please log in through the Rider or Analyst portal.");
        setLoginLoading(false);
        return;
      }

      showToast({
        type: "success",
        title: "Platform Administrator Authenticated",
        message: `Welcome back, ${loggedUser.name}! Session established with full governance privileges.`,
      });

      navigate("/overview");
    } catch (err: any) {
      const msg = err.message || "Authentication failed.";
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Register Handler ("Request access")
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!fullName.trim()) {
      setRegError("Please enter your full name.");
      return;
    }

    if (!workEmail.trim() || !/\S+@\S+\.\S+/.test(workEmail.trim())) {
      setRegError("Please enter a valid work email.");
      return;
    }

    if (!organization.trim()) {
      setRegError("Please specify your company or platform organization.");
      return;
    }

    // Invite code is strictly required for Admin access
    if (!inviteCode.trim()) {
      setRegError("An Admin Invite Code is strictly required to request administrative privileges.");
      return;
    }

    if (regPassword.length < 8) {
      setRegError("Password must be at least 8 characters long.");
      return;
    }

    if (regPassword !== confirmPassword) {
      setRegError("Passwords do not match.");
      return;
    }

    setRegLoading(true);

    try {
      const res = await register({
        name: fullName.trim(),
        email: workEmail.trim(),
        password: regPassword,
        role: "ADMIN",
        organization: organization.trim(),
        inviteCode: inviteCode.trim(),
      });

      setRequestSubmitted(true);
      showToast({
        type: "info",
        title: "Admin Request Submitted",
        message: "Your Admin account request is pending approval by an existing system administrator.",
      });
    } catch (err: any) {
      setRegError(err.message || "Failed to submit request.");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col justify-between py-8 px-4 sm:px-6">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between mb-6">
        <Link
          to="/choose-role"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6B6480] hover:text-[#4A2C6D] transition-colors bg-white/70 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-[#4A2C6D]/10 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change Role</span>
        </Link>
        <Logo size="sm" />
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto w-full bg-white rounded-3xl shadow-plum border border-[#4A2C6D]/15 p-7 sm:p-8 relative">
        {/* Portal Header & Badge */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6F61]/15 text-[#FF6F61] flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Shield className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6F61]/15 text-[#FF6F61] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#FF6F61]/25">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6F61]" />
            <span>ADMIN PORTAL</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#231B33]">Platform Governance</h1>
          <p className="text-xs text-[#6B6480] mt-1">Full control over policies, algorithms, and fleet security</p>
        </div>

        {/* Tab Controls: Login / Request Access */}
        {!requestSubmitted && (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTabChange("login")}
              className={`py-2.5 rounded-xl transition-all ${
                tab === "login"
                  ? "bg-[#4A2C6D] text-white shadow-sm font-extrabold"
                  : "text-[#6B6480] hover:text-[#231B33]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("register")}
              className={`py-2.5 rounded-xl transition-all ${
                tab === "register"
                  ? "bg-[#4A2C6D] text-white shadow-sm font-extrabold"
                  : "text-[#6B6480] hover:text-[#231B33]"
              }`}
            >
              Request Access
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* LOGIN TAB */}
        {/* ========================================================= */}
        {tab === "login" && !requestSubmitted && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1.5">
                Admin Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B6480] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@kinetics.demo"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D] focus:ring-1 focus:ring-[#4A2C6D] font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#231B33]">
                  Password
                </label>
                <span className="text-[11px] font-mono text-[#6B6480]">Demo: Admin@123</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B6480] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D] focus:ring-1 focus:ring-[#4A2C6D] font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6480] hover:text-[#231B33]"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Administrator Token...</span>
                </>
              ) : (
                <span>Sign In to Admin Portal</span>
              )}
            </button>

            {/* Quick Demo Pre-fill */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#6B6480]">
              <span>Demo credentials:</span>
              <button
                type="button"
                onClick={() => {
                  setLoginEmail("admin@kinetics.demo");
                  setLoginPassword("Admin@123");
                }}
                className="font-bold text-[#4A2C6D] hover:underline"
              >
                Auto-fill Seeded Admin
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* REQUEST ACCESS TAB */}
        {/* ========================================================= */}
        {tab === "register" && !requestSubmitted && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            {/* Governance Callout */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 text-[11px] flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
              <span>
                <strong>System Note:</strong> The first Admin is NEVER created from the UI; the backend seeds it. Additional admin accounts require an invite code and existing Admin approval.
              </span>
            </div>

            {regError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{regError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#6B6480] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Marcus Vance"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B6480] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="marcus.vance@company.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1">
                Organization / Security Department
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-[#6B6480] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Kinetics HQ Security &amp; Compliance"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                  required
                />
              </div>
            </div>

            {/* Admin Invite Code (Strictly Required for Admin) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#231B33]">
                  Admin Invite Code <span className="text-[#FF6F61]">*</span>
                </label>
                <span className="text-[10px] text-[#6B6480]">Code: KINETICS-ADMIN-2026</span>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 text-[#FF6F61] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="e.g. KINETICS-ADMIN-2026"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D] font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#231B33] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B6480]"
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#231B33] mb-1">
                  Confirm Password
                </label>
                <input
                  type={showRegPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat pass"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3.5 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {regLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Admin Request...</span>
                  </>
                ) : (
                  <span>Submit Admin Request</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* REQUEST SUBMITTED CONFIRMATION SCREEN */}
        {/* ========================================================= */}
        {requestSubmitted && (
          <div className="text-center py-4 space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
              <Clock className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-extrabold text-[#231B33]">
              Request submitted, waiting for approval
            </h2>

            <p className="text-xs text-[#6B6480] leading-relaxed max-w-sm mx-auto">
              Your Admin access request for <strong>{workEmail}</strong> has been created with <strong>PENDING</strong> status.
              In accordance with zero-trust governance protocols, an active Platform Administrator must review and activate your account.
            </p>

            <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 text-xs text-left space-y-1">
              <div className="font-bold text-[#231B33]">Security Protocol:</div>
              <ul className="text-[11px] text-[#6B6480] space-y-1 list-disc list-inside">
                <li>The first Admin was seeded by the system (admin@kinetics.demo).</li>
                <li>Your request is logged in the administrative audit queue.</li>
                <li>You cannot sign in until your status transitions from PENDING to ACTIVE.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setRequestSubmitted(false);
                  handleTabChange("login");
                }}
                className="w-full py-3 rounded-full bg-[#4A2C6D] text-white font-extrabold text-xs hover:bg-[#392153] transition-colors"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full text-center text-xs text-[#6B6480] pt-6 pb-2">
        <p>Statutory Risk Governance • SOC2 Type II Certified</p>
      </footer>
    </div>
  );
}
