import React, { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, loadingSession } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const deniedRef = useRef<string | null>(null);

  // While restoring session on initial load, show clean loading placeholder
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-[var(--muted)]">Checking security credentials...</span>
        </div>
      </div>
    );
  }

  // If logged out, redirect directly to /choose-role
  if (!user) {
    return <Navigate to="/choose-role" state={{ from: location }} replace />;
  }

  // Role authorization check
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const userHome = user.role === "RIDER" ? "/rider/home" : "/overview";

    const violationKey = `${user.role}:${location.pathname}`;
    if (deniedRef.current !== violationKey) {
      deniedRef.current = violationKey;
      showToast({
        type: "error",
        title: "Access Denied",
        message: `Your role (${user.role}) does not have permission to access ${location.pathname}. Redirected to your home portal.`,
      });
    }

    return <Navigate to={userHome} replace />;
  }

  // Onboarding checks for Rider
  if (user.role === "RIDER") {
    // Check local storage flag for enrollment if user.faceEnrolled isn't explicitly false
    const localEnrolled = localStorage.getItem(`kinetics_enrolled_face_${user.id}`) === "true";
    const faceEnrolled = user.faceEnrolled !== false || localEnrolled;

    if (!faceEnrolled && location.pathname !== "/onboarding/face") {
      return <Navigate to="/onboarding/face" replace />;
    }

    if (faceEnrolled && user.profileComplete === false && location.pathname !== "/onboarding/profile") {
      return <Navigate to="/onboarding/profile" replace />;
    }
  }

  // Onboarding profile check for Analyst / Admin if profileComplete is explicitly false
  if ((user.role === "ADMIN" || user.role === "ANALYST") && user.profileComplete === false && location.pathname !== "/onboarding/profile") {
    return <Navigate to="/onboarding/profile" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
