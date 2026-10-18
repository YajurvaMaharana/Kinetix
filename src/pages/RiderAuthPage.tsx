import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Smartphone,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  ShieldCheck,
  Bike,
  MapPin,
  Lock,
  User,
  Phone,
  Mail,
  Sparkles,
} from "lucide-react";

export default function RiderAuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const [tab, setTab] = useState<"login" | "register">(initialTab);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Login Form States
  const [loginEmail, setLoginEmail] = useState("rider@kinetics.demo");
  const [loginPassword, setLoginPassword] = useState("Rider@123");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register Form States
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [vehicleType, setVehicleType] = useState<"Bike" | "Scooter" | "Cycle">("Bike");
  const [city, setCity] = useState("Seattle");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Liveness Modal State
  const [showLivenessModal, setShowLivenessModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<any>(null);

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
  };

  // Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailTrim = loginEmail.trim();
    if (!emailTrim || !/\S+@\S+\.\S+/.test(emailTrim)) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    if (!loginPassword) {
      setLoginError("Please enter your password.");
      return;
    }

    setLoginLoading(true);

    try {
      const loggedUser = await login(emailTrim, loginPassword);

      // Verify account role matches the Rider portal
      if (loggedUser.role !== "RIDER") {
        // Log out immediately from context if role mismatches
        sessionStorage.clear();
        setLoginError("This account doesn't have access to this portal. Please log in through the Admin or Analyst portal.");
        setLoginLoading(false);
        return;
      }

      showToast({
        type: "success",
        title: "Courier Authentication Successful",
        message: `Welcome back, ${loggedUser.name}! Opening your rider dashboard.`,
      });

      navigate("/rider/home");
    } catch (err: any) {
      const msg = err.message || "Failed to sign in.";
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Register Handler - Step 1: Validate & Register account
  const handleRegisterNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!fullName.trim()) {
      setRegError("Please enter your full name.");
      return;
    }

    if (!phone.trim() || phone.trim().length < 7) {
      setRegError("Please provide a valid contact phone number.");
      return;
    }

    if (!regEmail.trim() || !/\S+@\S+\.\S+/.test(regEmail.trim())) {
      setRegError("Please enter a valid email address.");
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

    if (!agreeTerms) {
      setRegError("You must agree to the Terms of Service & GPS telemetry liveness verification.");
      return;
    }

    setRegLoading(true);

    try {
      await register({
        name: fullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: "RIDER",
        vehicleType,
        city,
      });

      showToast({
        type: "success",
        title: "Account Created!",
        message: `Step 1 complete! Proceeding to biometric face enrollment.`,
      });

      navigate("/onboarding/face");
    } catch (err: any) {
      setRegError(err.message || "Registration failed. Please try again.");
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

      {/* Main Auth Container */}
      <main className="max-w-md mx-auto w-full bg-white rounded-3xl shadow-plum border border-[#4A2C6D]/15 p-7 sm:p-8 relative">
        {/* Portal Header & Badge */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#2FBF8F]/15 text-[#2FBF8F] flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Smartphone className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#2FBF8F]/25">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F]" />
            <span>RIDER PORTAL</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#231B33]">Courier Access</h1>
          <p className="text-xs text-[#6B6480] mt-1">Review deliveries, verify liveness, and unlock instant payouts</p>
        </div>

        {/* Tab Controls: Login / Register */}
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
            Register Rider
          </button>
        </div>

        {/* ========================================================= */}
        {/* LOGIN TAB */}
        {/* ========================================================= */}
        {tab === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1.5">
                Rider Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B6480] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="rider@kinetics.demo"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D] focus:ring-1 focus:ring-[#4A2C6D] transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#231B33]">
                  Password
                </label>
                <span className="text-[11px] font-mono text-[#6B6480]">Demo: Rider@123</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B6480] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D] focus:ring-1 focus:ring-[#4A2C6D] transition-all font-medium"
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
                  <span>Authenticating Rider...</span>
                </>
              ) : (
                <span>Sign In to Rider Portal</span>
              )}
            </button>

            {/* Quick Demo Pre-fill */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#6B6480]">
              <span>Demo credentials:</span>
              <button
                type="button"
                onClick={() => {
                  setLoginEmail("rider@kinetics.demo");
                  setLoginPassword("Rider@123");
                }}
                className="font-bold text-[#4A2C6D] hover:underline"
              >
                Auto-fill Demo Rider
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* REGISTER TAB */}
        {/* ========================================================= */}
        {tab === "register" && (
          <form onSubmit={handleRegisterNext} className="space-y-3.5">
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
                  placeholder="Marcus Chen"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D] focus:ring-1 focus:ring-[#4A2C6D]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#231B33] mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[#6B6480] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 234-8901"
                    className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#231B33] mb-1">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                >
                  <option value="Bike">Bike (Motorcycle)</option>
                  <option value="Scooter">Scooter / Moped</option>
                  <option value="Cycle">Cycle (Bicycle)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B6480] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="marcus.chen@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
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

            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1">
                Operating City / Hub
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#6B6480] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Seattle, San Francisco, Chicago"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-[#FFF9F2]/50 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                  required
                />
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-[#6B6480] select-none">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded text-[#4A2C6D] focus:ring-[#4A2C6D]"
                />
                <span className="leading-normal">
                  I agree to the <span className="text-[#4A2C6D] font-bold">Terms of Service</span>, GPS telemetry monitoring, and biometric liveness verification for instant payout protection.
                </span>
              </label>
            </div>

            {/* Submit / Proceed to Selfie verification */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3.5 rounded-full bg-[#2FBF8F] hover:bg-[#28a87d] text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {regLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Registration...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Verify with Selfie (Mandatory)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full text-center text-xs text-[#6B6480] pt-6 pb-2">
        <p>Zero Biometric Storage • ISO 27001 Cryptographic Hash Security</p>
      </footer>
    </div>
  );
}
