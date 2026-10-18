import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { DateRangeProvider } from "@/context/DateRangeContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

// Admin & Analyst Command Center Pages
import OverviewPage from "@/pages/OverviewPage";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import FraudGraphPage from "@/pages/monitor/FraudGraphPage";
import InvestigationsPage from "@/pages/cases/InvestigationsPage";
import AppealsPage from "@/pages/cases/AppealsPage";
import PayoutsPage from "@/pages/money/PayoutsPage";
import PoliciesPage from "@/pages/money/PoliciesPage";
import SimulatorPage from "@/pages/lab/SimulatorPage";
import DemoControlsPage from "@/pages/lab/DemoControlsPage";
import EvaluationPage from "@/pages/lab/EvaluationPage";
import RiderViewPage from "@/pages/rider/RiderViewPage";

// Dedicated Rider Portal Pages & Shell
import RiderLayout from "@/components/RiderLayout";
import RiderHomePage from "@/pages/rider/RiderHomePage";
import RiderPayoutsPage from "@/pages/rider/RiderPayoutsPage";
import RiderTripsPage from "@/pages/rider/RiderTripsPage";
import RiderAppealsPage from "@/pages/rider/RiderAppealsPage";
import RiderVerifyPage from "@/pages/rider/RiderVerifyPage";
import RiderHelpPage from "@/pages/rider/RiderHelpPage";

// Onboarding Pages
import FaceEnrollmentPage from "@/pages/onboarding/FaceEnrollmentPage";
import ProfileSetupPage from "@/pages/onboarding/ProfileSetupPage";

// Standalone Landing & Auth Routes
import LandingPage from "@/pages/LandingPage";
import ChooseRolePage from "@/pages/ChooseRolePage";
import AdminAuthPage from "@/pages/AdminAuthPage";
import AnalystAuthPage from "@/pages/AnalystAuthPage";
import RiderAuthPage from "@/pages/RiderAuthPage";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <DateRangeProvider>
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<LandingPage />} />

              {/* Public Role Portal Selection Gateway */}
              <Route path="/choose-role" element={<ChooseRolePage />} />

              {/* Public Role-Specific Auth Routes */}
              <Route path="/auth/rider" element={<RiderAuthPage />} />
              <Route path="/auth/analyst" element={<AnalystAuthPage />} />
              <Route path="/auth/admin" element={<AdminAuthPage />} />

              {/* URL Aliases for backwards compatibility */}
              <Route path="/rider/auth" element={<RiderAuthPage />} />
              <Route path="/analyst/auth" element={<AnalystAuthPage />} />
              <Route path="/admin/auth" element={<AdminAuthPage />} />
              <Route path="/admin/dashboard" element={<Navigate to="/overview" replace />} />
              <Route path="/rider/dashboard" element={<Navigate to="/rider/home" replace />} />
              <Route path="/rider" element={<Navigate to="/rider/home" replace />} />

              {/* Onboarding Routes */}
              <Route
                path="/onboarding/face"
                element={
                  <ProtectedRoute allowedRoles={["RIDER"]}>
                    <FaceEnrollmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding/profile"
                element={
                  <ProtectedRoute allowedRoles={["RIDER", "ANALYST", "ADMIN"]}>
                    <ProfileSetupPage />
                  </ProtectedRoute>
                }
              />

              {/* ========================================================= */}
              {/* PROTECTED DEDICATED RIDER PORTAL (RIDER ONLY) */}
              {/* Riders never see the Admin navbar or any admin page */}
              {/* ========================================================= */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={["RIDER"]}>
                    <RiderLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/rider/home" element={<RiderHomePage />} />
                <Route path="/rider/payouts" element={<RiderPayoutsPage />} />
                <Route path="/rider/trips" element={<RiderTripsPage />} />
                <Route path="/rider/appeals" element={<RiderAppealsPage />} />
                <Route path="/rider/verify" element={<RiderVerifyPage />} />
                <Route path="/rider/help" element={<RiderHelpPage />} />
              </Route>

              {/* ========================================================= */}
              {/* CORE ADMIN & ANALYST COMMAND CENTER (ADMIN & ANALYST ONLY) */}
              {/* ========================================================= */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={["ADMIN", "ANALYST"]}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/monitor/live" element={<LiveMonitorPage />} />
                <Route path="/monitor/graph" element={<FraudGraphPage />} />
                <Route path="/cases/investigations" element={<InvestigationsPage />} />
                <Route path="/cases/appeals" element={<AppealsPage />} />
                <Route path="/money/payouts" element={<PayoutsPage />} />
                <Route path="/money/policies" element={<PoliciesPage />} />
                <Route path="/lab/simulator" element={<SimulatorPage />} />
                <Route path="/lab/demo" element={<DemoControlsPage />} />
                <Route path="/lab/evaluation" element={<EvaluationPage />} />
                <Route path="/rider-view" element={<RiderViewPage />} />

                {/* Section Shortcuts & Deep Link Aliases */}
                <Route path="/monitor" element={<Navigate to="/monitor/live" replace />} />
                <Route path="/graph" element={<Navigate to="/monitor/graph" replace />} />
                <Route path="/cases" element={<Navigate to="/cases/investigations" replace />} />
                <Route path="/appeals" element={<Navigate to="/cases/appeals" replace />} />
                <Route path="/money" element={<Navigate to="/money/payouts" replace />} />
                <Route path="/payouts" element={<Navigate to="/money/payouts" replace />} />
                <Route path="/policies" element={<Navigate to="/money/policies" replace />} />
                <Route path="/policy" element={<Navigate to="/money/policies" replace />} />
                <Route path="/lab" element={<Navigate to="/lab/simulator" replace />} />
                <Route path="/simulator" element={<Navigate to="/lab/simulator" replace />} />
                <Route path="/demo" element={<Navigate to="/lab/demo" replace />} />
                <Route path="/evaluation" element={<Navigate to="/lab/evaluation" replace />} />
                <Route path="/rider/explain" element={<Navigate to="/rider-view" replace />} />
              </Route>

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/choose-role" replace />} />
            </Routes>
          </DateRangeProvider>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
