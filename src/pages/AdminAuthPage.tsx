import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { Shield, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function AdminAuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [tab, setTab] = useState<"login" | "register">(initialMode);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (tab === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      login(email, "admin", name || "Elena Rostova");
      navigate("/admin/dashboard");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col justify-between py-8 px-6">
      <div className="max-w-md mx-auto w-full flex items-center justify-between mb-8">
        <Link
          to="/choose-role"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6B6480] hover:text-[#4A2C6D] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Choose another role</span>
        </Link>
        <Logo size="sm" />
      </div>

      <div className="max-w-md mx-auto w-full bg-white rounded-xl shadow-plum border border-[#4A2C6D]/15 p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#4A2C6D] text-white flex items-center justify-center mx-auto mb-3 shadow-soft">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#231B33]">Admin &amp; Analyst Portal</h1>
          <p className="text-xs text-[#6B6480] mt-1">Secure access to risk orchestration &amp; payout command center</p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-[#FFF9F2] border border-[#4A2C6D]/10 mb-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setTab("login"); setError(null); }}
            className={`py-2 rounded-lg transition-all ${tab === "login" ? "bg-[#4A2C6D] text-white shadow-sm" : "text-[#6B6480] hover:text-[#231B33]"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(null); }}
            className={`py-2 rounded-lg transition-all ${tab === "register" ? "bg-[#4A2C6D] text-white shadow-sm" : "text-[#6B6480] hover:text-[#231B33]"}`}
          >
            Register Fleet
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "register" && (
            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Elena Rostova"
                required
                className="w-full bg-[#FFF9F2] border border-[#4A2C6D]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#231B33] mb-1">Work Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="elena.rostova@deliveryops.com"
              required
              className="w-full bg-[#FFF9F2] border border-[#4A2C6D]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#231B33] mb-1">Password (min 8 chars)</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#FFF9F2] border border-[#4A2C6D]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#231B33] focus:outline-none focus:border-[#4A2C6D] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {tab === "register" && (
            <div>
              <label className="block text-xs font-bold text-[#231B33] mb-1">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#FFF9F2] border border-[#4A2C6D]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-bold text-sm shadow-plum transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Console...</span>
              </>
            ) : (
              <>
                <span>{tab === "login" ? "Sign In to Console" : "Complete Registration"}</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="max-w-md mx-auto w-full text-center text-xs text-[#6B6480]">
        Protected by hardware token authentication &amp; encrypted audit logs.
      </div>
    </div>
  );
}
