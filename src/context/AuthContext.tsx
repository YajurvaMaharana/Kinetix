import React, { createContext, useContext, useState, useEffect } from "react";

export type RoleType = "Analyst" | "Admin" | "Auditor";

export interface UserProfile {
  name: string;
  email: string;
  role: RoleType;
  avatar: string;
  title: string;
  courierId?: string;
  hub?: string;
}

interface AuthContextType {
  user: UserProfile;
  role: RoleType;
  setRole: (role: RoleType) => void;
  canDeployPolicies: boolean;
  canRunDemoControls: boolean;
  canApprovePayouts: boolean;
  canManageCases: boolean;
  isReadOnly: boolean;
  login: (email: string, userRole: string, name?: string) => void;
  logout: () => void;
}

const DEFAULT_USERS: Record<RoleType, UserProfile> = {
  Analyst: {
    name: "Marcus Vance",
    email: "marcus.vance@kinetics.internal",
    role: "Analyst",
    avatar: "MV",
    title: "Senior Risk Analyst",
    courierId: "CR-8941",
    hub: "Seattle Downtown Hub",
  },
  Admin: {
    name: "Elena Rostova",
    email: "elena.rostova@kinetics.internal",
    role: "Admin",
    avatar: "ER",
    title: "Platform Super Admin",
    courierId: "CR-8941",
    hub: "Global Risk Operations",
  },
  Auditor: {
    name: "David Sterling",
    email: "david.sterling@compliance.internal",
    role: "Auditor",
    avatar: "DS",
    title: "Compliance Auditor",
    courierId: "CR-8941",
    hub: "Seattle Downtown Hub",
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<RoleType>(() => {
    const saved = localStorage.getItem("kinetics_active_role");
    if (saved === "Admin" || saved === "Analyst" || saved === "Auditor") {
      return saved;
    }
    return "Analyst";
  });

  const [user, setUser] = useState<UserProfile>(() => DEFAULT_USERS[role]);

  const setRole = (newRole: RoleType) => {
    setRoleState(newRole);
    setUser(DEFAULT_USERS[newRole]);
    localStorage.setItem("kinetics_active_role", newRole);
  };

  const login = (email: string, userRole: string, name?: string) => {
    const normalizedRole: RoleType =
      userRole.toLowerCase() === "admin"
        ? "Admin"
        : userRole.toLowerCase() === "auditor"
        ? "Auditor"
        : "Analyst";

    setRole(normalizedRole);
    if (name) {
      setUser((prev) => ({
        ...prev,
        name,
        email,
        role: normalizedRole,
      }));
    }
  };

  useEffect(() => {
    setUser(DEFAULT_USERS[role]);
  }, [role]);

  const canDeployPolicies = role === "Admin";
  const canRunDemoControls = role === "Admin";
  const canApprovePayouts = role === "Analyst" || role === "Admin";
  const canManageCases = role === "Analyst" || role === "Admin";
  const isReadOnly = role === "Auditor";

  const logout = () => {
    setRole("Analyst");
    localStorage.removeItem("kinetics_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        setRole,
        canDeployPolicies,
        canRunDemoControls,
        canApprovePayouts,
        canManageCases,
        isReadOnly,
        login,
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
