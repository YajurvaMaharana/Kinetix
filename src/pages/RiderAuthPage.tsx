import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import {
  Smartphone,
  Camera,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function RiderAuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [tab, setTab] = useState<"login" | "register">(initialMode);
  const [step] = useState(1);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [phone, setPhone] = useState("+1 (555) 234-8901");
  const [otp, setOtp] = useState("••••••");
  const [fullName, setFullName] = useState("Marcus Chen");
  const [vehicle, setVehicle] = useState<"Bicycle" | "Scooter / Moped" | "E-Bike" | "Automobile">("Scooter / Moped");
  const [hub, setHub] = useState("Seattle Metro - Central Hub (#4)");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === "register" && !agreeTerms) {
      setError("Please agree to GPS integrity telemetry & payout protection terms.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      login(phone, "rider", fullName);
      navigate("/rider/dashboard");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col justify-between py-6 px-4">
      {/* Top Header */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between mb-4">
        <Link
          to="/choose-role"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B6480] hover:text-[#4A2C6D] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Choose role</span>
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6F61]/15 text-[#FF6F61] text-[11px] font-bold">
          MOBILE EXPERIENCE (IOS / ANDROID 390×844)
        </div>
      </div>

      {/* Mobile Device Frame */}
      <div className="max-w-[400px] mx-auto w-full bg-[#231B33] rounded-[40px] p-4 shadow-plum border-4 border-[#4A2C6D]">
        <div className="bg-[#FFF9F2] rounded-[32px] overflow-hidden flex flex-col justify-between p-6 min-h-[720px] relative">
          
          {/* Phone Status Bar */}
          <div className="flex items-center justify-between text-xs font-bold text-[#231B33] mb-4">
            <span>9:41</span>
            <div className="w-20 h-4 bg-[#231B33] rounded-full mx-auto" />
            <div className="flex items-center gap-1">
              <span className="text-[10px]">5G</span>
              <div className="w-4 h-2.5 bg-[#231B33] rounded-sm" />
            </div>
          </div>

          {/* App Header Inside Phone */}
          <div className="flex items-center justify-between pb-3 border-b border-[#4A2C6D]/10 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#4A2C6D] text-white font-extrabold flex items-center justify-center text-xs">
                K
              </div>
              <span className="font-extrabold text-sm text-[#231B33]">Kinetics</span>
            </div>
            <button
              type="button"
              onClick={() => setTab(tab === "login" ? "register" : "login")}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D]"
            >
              {tab === "login" ? "Register" : "Sign In"}
            </button>
          </div>

          {error && (
            <div className="mb-3 p-2.5 rounded-lg bg-rose-500/15 text-rose-600 text-[11px] font-bold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Content */}
          {tab === "login" ? (
            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-[#6B6480] uppercase tracking-wider">Phase A: Shift Authentication</span>
                  <h2 className="text-lg font-extrabold text-[#231B33] mt-0.5">Welcome back, Courier!</h2>
                  <p className="text-xs text-[#6B6480]">Enter your registered credentials to verify your shift and access instant payouts.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#231B33] mb-1">Phone number or Email</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="w-full bg-white border border-[#4A2C6D]/20 rounded-xl px-3 py-2 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-[#231B33]">6-digit SMS OTP or Password</label>
                      <span className="text-[10px] text-amber-600 font-bold">⏱ 00:48s</span>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                        className="w-full bg-white border border-[#4A2C6D]/20 rounded-xl px-3 py-2 text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6B6480]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded text-[#4A2C6D]" />
                      <span>Stay logged in on this phone</span>
                    </label>
                    <a href="#forgot" className="text-[#4A2C6D] font-bold hover:underline">Forgot?</a>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-bold text-xs shadow-plum transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Continue to Rider Console →</span>}
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-[#6B6480] uppercase font-bold">Or Fast Pass</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <button
                  type="button"
                  onClick={() => { login(phone, "rider", fullName); navigate("/rider/dashboard"); }}
                  className="w-full py-2.5 rounded-full bg-[#F0EAFB] hover:bg-[#e2d5f8] text-[#4A2C6D] font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5 text-[#FF6F61]" />
                  <span>Use FaceID / Biometrics</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setTab("register")}
                    className="text-[11px] text-[#4A2C6D] font-bold hover:underline"
                  >
                    New to Kinetics? Register as Courier →
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 flex-1 flex flex-col justify-between text-left">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#6B6480] uppercase">Phase B: Onboarding</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">02 • Step 1 of 3</span>
                </div>
                <h2 className="text-base font-extrabold text-[#231B33]">Join the Verified Fleet</h2>
                <p className="text-[11px] text-[#6B6480] mb-3">Establish your courier profile to activate dynamic shift protection.</p>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-[#231B33] mb-0.5">Full Legal Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full bg-white border border-[#4A2C6D]/20 rounded-lg px-2.5 py-1.5 text-xs text-[#231B33]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#231B33] mb-0.5">Mobile Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full bg-white border border-[#4A2C6D]/20 rounded-lg px-2.5 py-1.5 text-xs text-[#231B33]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#231B33] mb-1">Vehicle Classification</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["Bicycle", "Scooter / Moped", "E-Bike", "Automobile"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVehicle(v)}
                          className={`p-2 rounded-lg border text-[11px] font-bold text-center transition-all ${vehicle === v ? "bg-[#4A2C6D] text-white border-[#4A2C6D]" : "bg-white text-[#231B33] border-gray-200"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#231B33] mb-0.5">Operating Hub / Region</label>
                    <select
                      value={hub}
                      onChange={(e) => setHub(e.target.value)}
                      className="w-full bg-white border border-[#4A2C6D]/20 rounded-lg px-2.5 py-1.5 text-xs text-[#231B33]"
                    >
                      <option>Seattle Metro - Central Hub (#4)</option>
                      <option>Downtown East Hub (#9)</option>
                      <option>Northside Delivery Hub (#12)</option>
                    </select>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#F0EAFB] border border-[#4A2C6D]/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#4A2C6D]" />
                      <div>
                        <div className="font-bold text-[11px] text-[#231B33]">Instant Liveness Selfie (5s)</div>
                        <div className="text-[9px] text-[#6B6480]">Checks 3D depth to prevent identity spoofing</div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-[#2FBF8F]" />
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer text-[10px] text-[#6B6480] pt-1">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 rounded text-[#4A2C6D]"
                    />
                    <span>I agree to continuous GPS integrity telemetry &amp; payout protection terms.</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-bold text-xs shadow-plum transition-all flex items-center justify-center gap-1.5 mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Submit &amp; Start Verification →</span>}
              </button>
            </form>
          )}

          {/* Bottom Home Indicator */}
          <div className="w-32 h-1 bg-[#231B33]/30 rounded-full mx-auto mt-2" />
        </div>
      </div>

      <div className="max-w-md mx-auto w-full text-center text-xs text-[#6B6480] mt-4">
        Zero-Trust Field Binding • Secure hardware token tying registered device IMEI and carrier SIM against bot spoofing.
      </div>
    </div>
  );
}
