import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import AppLayout from "@/components/AppLayout";

// Main App Pages
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

// Standalone Landing & Auth Routes
import LandingPage from "@/pages/LandingPage";
import ChooseRolePage from "@/pages/ChooseRolePage";
import AdminAuthPage from "@/pages/AdminAuthPage";
import RiderAuthPage from "@/pages/RiderAuthPage";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            {/* Standalone Landing & Auth Flows */}
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/choose-role" element={<ChooseRolePage />} />
            <Route path="/admin/auth" element={<AdminAuthPage />} />
            <Route path="/rider/auth" element={<RiderAuthPage />} />

            {/* Legacy aliases redirecting to unified routes */}
            <Route path="/admin/dashboard" element={<Navigate to="/overview" replace />} />
            <Route path="/rider/dashboard" element={<Navigate to="/rider-view" replace />} />

            {/* Core Application Shell with Floating Pill Navbar & Breadcrumb */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/overview" replace />} />
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
            </Route>

            {/* Fallback to Overview */}
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
