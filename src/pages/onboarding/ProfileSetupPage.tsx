import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Logo from "@/components/Logo";
import {
  User,
  Phone,
  CreditCard,
  Bike,
  Building,
  Bell,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";

export default function ProfileSetupPage() {
  const { user, role, updateOnboardingStatus } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Rider Profile Fields
  const [emergencyContactName, setEmergencyContactName] = useState("Maria Rivera");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("+1 (555) 019-2831");
  const [upiId, setUpiId] = useState("alex.rivera@okaxis");
  const [bankAccount, setBankAccount] = useState("981240192831");
  const [ifscCode, setIfscCode] = useState("SBIN0004921");
  const [vehicleReg, setVehicleReg] = useState("WA-4912-BK");
  const [vehicleModel, setVehicleModel] = useState("Trek Powerfly 4 EV");

  // Analyst/Admin Fields
  const [department, setDepartment] = useState("Fraud Triage & Risk Ops");
  const [workPhone, setWorkPhone] = useState("+1 (555) 912-0041");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);

  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const profileData =
        role === "RIDER"
          ? {
              emergencyContactName,
              emergencyContactPhone,
              upiId,
              bankAccount,
              ifscCode,
              vehicleReg,
              vehicleModel,
            }
          : {
              department,
              workPhone,
              notifyEmail,
              notifyInApp,
            };

      // Save profile in localStorage
      localStorage.setItem(`kinetics_profile_${user?.id || "demo"}`, JSON.stringify(profileData));

      // Mark profileComplete in context
      updateOnboardingStatus({ profileComplete: true });

      showToast({ type: "success", title: "Profile Complete!", message: "Your operations profile has been saved." });

      // Redirect to appropriate destination
      if (role === "RIDER") {
        navigate("/rider/home");
      } else {
        navigate("/overview");
      }
    } catch (err: any) {
      showToast({ type: "error", title: "Profile Error", message: err.message || "Failed to save profile." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-cream)] text-[var(--ink)] flex flex-col items-center justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="w-full max-w-xl flex items-center justify-between py-4">
        <Logo />
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--lavender)] text-[var(--primary)] text-xs font-bold border border-[var(--primary)]/20">
          <span>{role === "RIDER" ? "Step 3 of 3 &bull; Profile Setup" : "Profile Setup"}</span>
        </div>
      </header>

      {/* Main Body */}
      <main className="w-full max-w-xl my-auto space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-dropdown border border-[var(--border)] space-y-6 animate-in fade-in duration-300">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--ink)]">
              {role === "RIDER" ? "Courier Operations Profile" : "Staff Operations Profile"}
            </h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Set up your dispatch payout destination and emergency contacts
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {role === "RIDER" ? (
              <>
                {/* Emergency Contact */}
                <div className="space-y-3 p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--primary)]">
                    <User className="w-4 h-4" />
                    <span>Emergency Contact</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Contact Name</label>
                      <input
                        type="text"
                        required
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Contact Phone</label>
                      <input
                        type="text"
                        required
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Payout Destination */}
                <div className="space-y-3 p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--primary)]">
                    <CreditCard className="w-4 h-4" />
                    <span>Payout & Bank Account Details</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">UPI ID (Instant Release)</label>
                      <input
                        type="text"
                        required
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Bank Account Number</label>
                        <input
                          type="text"
                          required
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">IFSC / Routing Code</label>
                        <input
                          type="text"
                          required
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vehicle Specs */}
                <div className="space-y-3 p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--primary)]">
                    <Bike className="w-4 h-4" />
                    <span>Vehicle & Fleet Registration</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">License / Reg Plate</label>
                      <input
                        type="text"
                        required
                        value={vehicleReg}
                        onChange={(e) => setVehicleReg(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Vehicle Model</label>
                      <input
                        type="text"
                        required
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Department & Contact */}
                <div className="space-y-3 p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--primary)]">
                    <Building className="w-4 h-4" />
                    <span>Department & Direct Contact</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Department / Ops Unit</label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">Direct Phone Line</label>
                      <input
                        type="text"
                        required
                        value={workPhone}
                        onChange={(e) => setWorkPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div className="space-y-3 p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--primary)]">
                    <Bell className="w-4 h-4" />
                    <span>Notification & Alert Dispatch</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyEmail}
                        onChange={(e) => setNotifyEmail(e.target.checked)}
                        className="w-4 h-4 text-[var(--primary)] accent-[var(--primary)] rounded cursor-pointer"
                      />
                      <span className="font-medium text-[var(--ink)]">Receive urgent fraud alerts via Email</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyInApp}
                        onChange={(e) => setNotifyInApp(e.target.checked)}
                        className="w-4 h-4 text-[var(--primary)] accent-[var(--primary)] rounded cursor-pointer"
                      />
                      <span className="font-medium text-[var(--ink)]">Real-time Command Center desktop notifications</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all shadow-plum cursor-pointer text-sm disabled:opacity-50"
            >
              <span>{saving ? "Saving Profile..." : "Complete Profile & Enter Portal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full max-w-xl text-center text-[11px] text-[var(--muted)] py-2">
        Kinetics Operations Gateway &bull; Encrypted Statutory Session
      </footer>
    </div>
  );
}
