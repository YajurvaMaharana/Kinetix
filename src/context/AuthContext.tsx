import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { USE_MOCK } from "@/api/client";

export type UserRole = "ADMIN" | "ANALYST" | "RIDER";
export type UserStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED";

// Backwards-compatibility type alias
export type RoleType = UserRole;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  title?: string;
  courierId?: string;
  hub?: string;
  organization?: string;
  vehicleType?: string;
  city?: string;
}

// Backwards-compatible interface alias
export type UserProfile = User;

export interface RegisterPayload {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  organization?: string;
  vehicleType?: string;
  city?: string;
  inviteCode?: string;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  status: UserStatus | null;
  loadingSession: boolean;
  isAuthenticated: boolean;
  canDeployPolicies: boolean;
  canRunDemoControls: boolean;
  canApprovePayouts: boolean;
  canManageCases: boolean;
  isReadOnly: boolean;
  login: (email: string, password?: string, extraRoleOrName?: any) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; status: UserStatus; message: string }>;
  logout: () => void;
}

const SESSION_STORAGE_KEY = "kinetics_auth_session";

// Statutory Mock Users (only active when VITE_USE_MOCK=true)
export const MOCK_USERS: Record<string, { user: User; passwordHash: string }> = {
  "admin@kinetics.demo": {
    passwordHash: "Admin@123",
    user: {
      id: "usr_admin_01",
      name: "Elena Rostova",
      email: "admin@kinetics.demo",
      role: "ADMIN",
      status: "ACTIVE",
      avatar: "ER",
      title: "Platform Super Admin",
      hub: "Global Risk Operations",
    },
  },
  "analyst@kinetics.demo": {
    passwordHash: "Analyst@123",
    user: {
      id: "usr_analyst_01",
      name: "Marcus Vance",
      email: "analyst@kinetics.demo",
      role: "ANALYST",
      status: "ACTIVE",
      avatar: "MV",
      title: "Senior Risk Analyst",
      hub: "Seattle Downtown Hub",
    },
  },
  "rider@kinetics.demo": {
    passwordHash: "Rider@123",
    user: {
      id: "usr_rider_01",
      name: "Alex Rivera",
      email: "rider@kinetics.demo",
      role: "RIDER",
      status: "ACTIVE",
      avatar: "AR",
      title: "Courier Partner",
      courierId: "CR-8941",
      hub: "Seattle Downtown Hub",
    },
  },
  "pending@kinetics.demo": {
    passwordHash: "Pending@123",
    user: {
      id: "usr_pending_01",
      name: "Pending Analyst",
      email: "pending@kinetics.demo",
      role: "ANALYST",
      status: "PENDING",
      avatar: "PA",
      title: "Prospective Analyst",
      hub: "Triage Operations",
    },
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // App starts strictly logged out (null) - no default user, no auto-login
  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  // Restore session on load
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        if (USE_MOCK) {
          // In mock mode, restore ONLY if an explicit prior login session exists
          const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
          if (savedSession) {
            try {
              const parsed = JSON.parse(savedSession);
              if (parsed && parsed.id && parsed.role && parsed.status === "ACTIVE") {
                if (isMounted) setUser(parsed);
              } else {
                localStorage.removeItem(SESSION_STORAGE_KEY);
              }
            } catch (err) {
              localStorage.removeItem(SESSION_STORAGE_KEY);
            }
          }
        } else {
          // Real backend session check via GET /auth/me
          try {
            const response = await fetch("/auth/me", {
              credentials: "include",
              headers: { Accept: "application/json" },
            });
            if (response.ok) {
              const data = await response.json();
              if (isMounted && data?.user && data.user.status === "ACTIVE") {
                setUser(data.user);
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.user));
              }
            }
          } catch (err) {
            console.warn("Failed to restore session via GET /auth/me", err);
          }
        }
      } catch (e) {
        console.warn("Error restoring session", e);
      } finally {
        if (isMounted) setLoadingSession(false);
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password?: string, extraRoleOrName?: any): Promise<User> => {
      const normalizedEmail = email.trim().toLowerCase();

      if (USE_MOCK) {
        // Match user by normalized email
        const record = MOCK_USERS[normalizedEmail];

        if (!record) {
          // If login is called from legacy form without predefined mock email
          if (extraRoleOrName && typeof extraRoleOrName === "string") {
            const inferredRole: UserRole =
              extraRoleOrName.toUpperCase() === "ADMIN"
                ? "ADMIN"
                : extraRoleOrName.toUpperCase() === "RIDER"
                ? "RIDER"
                : "ANALYST";
            const dynamicUser: User = {
              id: `usr_${Math.random().toString(36).slice(2, 9)}`,
              name: extraRoleOrName || "Demo User",
              email: normalizedEmail,
              role: inferredRole,
              status: "ACTIVE",
              avatar: inferredRole.slice(0, 2),
              title: inferredRole === "ADMIN" ? "Platform Admin" : inferredRole === "RIDER" ? "Courier" : "Risk Analyst",
            };
            setUser(dynamicUser);
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(dynamicUser));
            return dynamicUser;
          }
          throw new Error("Invalid credentials. Please verify your email.");
        }

        // Verify password if provided
        if (password && record.passwordHash !== password) {
          throw new Error("Invalid password credentials.");
        }

        // Check user status
        if (record.user.status === "PENDING") {
          throw new Error("Account is pending administrator approval. Please wait for an Admin to review your request.");
        }

        if (record.user.status === "SUSPENDED" || record.user.status === "REJECTED") {
          throw new Error(`Account access denied (${record.user.status.toLowerCase()}).`);
        }

        setUser(record.user);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(record.user));
        return record.user;
      }

      // Real backend flow
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Authentication failed.");
      }

      const data = await res.json();
      if (data.user.status === "PENDING") {
        throw new Error("Account is pending administrator approval.");
      }

      setUser(data.user);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.user));
      return data.user;
    },
    []
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<{ success: boolean; status: UserStatus; message: string }> => {
      const normalizedEmail = payload.email.trim().toLowerCase();

      if (USE_MOCK) {
        // Riders are ACTIVE after verification; Analysts and Admins are PENDING
        const status: UserStatus = payload.role === "RIDER" ? "ACTIVE" : "PENDING";
        const newUser: User = {
          id: `usr_${Math.random().toString(36).slice(2, 9)}`,
          name: payload.name,
          email: normalizedEmail,
          role: payload.role,
          status,
          avatar: payload.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "U",
          title:
            payload.role === "ADMIN"
              ? "Platform Admin"
              : payload.role === "ANALYST"
              ? "Senior Risk Analyst"
              : "Courier Partner",
          organization: payload.organization,
          vehicleType: payload.vehicleType,
          city: payload.city,
        };

        MOCK_USERS[normalizedEmail] = {
          passwordHash: payload.password || "Password@123",
          user: newUser,
        };

        if (status === "ACTIVE") {
          setUser(newUser);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));
        }

        return {
          success: true,
          status,
          message:
            status === "ACTIVE"
              ? "Registration complete and verified."
              : "Request submitted, waiting for approval from an existing Admin.",
        };
      }

      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Registration request failed.");
      }

      return await res.json();
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem("kinetics_active_role");
    localStorage.removeItem("kinetics_user");

    if (!USE_MOCK) {
      fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }, []);

  const isAuthenticated = !!user;
  const role = user?.role || null;
  const status = user?.status || null;
  const canDeployPolicies = user?.role === "ADMIN";
  const canRunDemoControls = user?.role === "ADMIN";
  const canApprovePayouts = user?.role === "ADMIN" || user?.role === "ANALYST";
  const canManageCases = user?.role === "ADMIN" || user?.role === "ANALYST";
  const isReadOnly = user?.role === "RIDER";

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        status,
        loadingSession,
        isAuthenticated,
        canDeployPolicies,
        canRunDemoControls,
        canApprovePayouts,
        canManageCases,
        isReadOnly,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
