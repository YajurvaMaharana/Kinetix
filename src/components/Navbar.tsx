import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import CommandPalette from "./CommandPalette";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { checkBackendHealth } from "@/api/client";
import {
  Activity,
  ShieldAlert,
  GitFork,
  FolderKanban,
  FileText,
  Banknote,
  Scale,
  Sliders,
  Cpu,
  Award,
  Smartphone,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  UserCheck,
  Check,
  Circle,
  ExternalLink,
} from "lucide-react";

interface NavGroupItem {
  name: string;
  path: string;
  isDirectLink?: boolean;
  children?: {
    name: string;
    path: string;
    description: string;
    icon: any;
  }[];
}

const NAV_GROUPS: NavGroupItem[] = [
  {
    name: "Overview",
    path: "/overview",
    isDirectLink: true,
  },
  {
    name: "Monitor",
    path: "/monitor",
    children: [
      {
        name: "Live Monitor",
        path: "/monitor/live",
        description: "Real-time telemetry, 40Hz sensor fusion & speed anomalies",
        icon: ShieldAlert,
      },
      {
        name: "Fraud Graph",
        path: "/monitor/graph",
        description: "Syndicate cluster isolation, shared device UUIDs & rings",
        icon: GitFork,
      },
    ],
  },
  {
    name: "Cases",
    path: "/cases",
    children: [
      {
        name: "Investigations",
        path: "/cases/investigations",
        description: "Flagged courier cases, audit evidence & review actions",
        icon: FolderKanban,
      },
      {
        name: "Appeals & Redress",
        path: "/cases/appeals",
        description: "Human-in-the-loop dispute adjudication & evidence",
        icon: FileText,
      },
    ],
  },
  {
    name: "Money",
    path: "/money",
    children: [
      {
        name: "Payouts",
        path: "/money/payouts",
        description: "Payout protection vault, holds & batch releases",
        icon: Banknote,
      },
      {
        name: "Policy Simulator",
        path: "/money/policies",
        description: "Simulate score cut-lines, friction & chargeback models",
        icon: Scale,
      },
    ],
  },
  {
    name: "Lab",
    path: "/lab",
    children: [
      {
        name: "Rider Simulator",
        path: "/lab/simulator",
        description: "Synthetic scenario injection (GPS jump, spoof, device ring)",
        icon: Sliders,
      },
      {
        name: "Demo Controls",
        path: "/lab/demo",
        description: "Reset or seed database & trigger platform workflows",
        icon: Cpu,
      },
      {
        name: "Evaluation",
        path: "/lab/evaluation",
        description: "Precision, recall, latency & benchmark telemetry",
        icon: Award,
      },
    ],
  },
  {
    name: "Rider View",
    path: "/rider-view",
    isDirectLink: true,
  },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Real backend health check status
  const [apiOnline, setApiOnline] = useState(true);
  const [apiStatusText, setApiStatusText] = useState("API :8000 online");

  const navRef = useRef<HTMLDivElement>(null);

  // Health check polling: every 4 seconds, paused if document is hidden
  useEffect(() => {
    let isMounted = true;

    async function probe() {
      if (document.hidden) return;
      const res = await checkBackendHealth();
      if (isMounted) {
        setApiOnline(res.online);
        setApiStatusText(res.online ? "API :8000 online" : "offline");
      }
    }

    probe();
    const interval = setInterval(probe, 4000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        probe();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Close dropdowns on route change or click outside
  useEffect(() => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        setNotificationsOpen(false);
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    showToast({
      type: "info",
      title: "Signed Out",
      message: "Session ended. Returned to role selection.",
    });
    navigate("/choose-role");
  };

  // Determine active group based on current pathname
  const isGroupActive = (group: NavGroupItem) => {
    if (group.isDirectLink) {
      return location.pathname === group.path;
    }
    return location.pathname.startsWith(group.path);
  };

  return (
    <>
      <header
        ref={navRef}
        className="sticky top-4 mx-4 my-2 z-50 rounded-full bg-[var(--surface)] shadow-plum border border-[var(--border)] px-5 py-2.5 backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo & Wordmark */}
          <div className="shrink-0 flex items-center">
            <Logo size="md" />
          </div>

          {/* Center: 6 Grouped Items (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1.5 bg-[var(--surface-alt)] p-1 rounded-full border border-[var(--border-subtle)]">
            {NAV_GROUPS.map((group) => {
              const active = isGroupActive(group);
              const isOpen = activeDropdown === group.name;

              if (group.isDirectLink) {
                return (
                  <Link
                    key={group.name}
                    to={group.path}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      active
                        ? "bg-[var(--primary)] text-white shadow-plum"
                        : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    {group.name}
                  </Link>
                );
              }

              return (
                <div key={group.name} className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(isOpen ? null : group.name)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                      active
                        ? "bg-[var(--primary)] text-white shadow-plum"
                        : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    <span>{group.name}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Group Dropdown Panel */}
                  {isOpen && group.children && (
                    <div className="absolute top-full left-0 mt-3 w-80 bg-[var(--surface)] rounded-2xl shadow-dropdown border border-[var(--border)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          {group.name} Console
                        </span>
                      </div>
                      <div className="space-y-1">
                        {group.children.map((child) => {
                          const Icon = child.icon;
                          const isChildActive = location.pathname === child.path;
                          return (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => setActiveDropdown(null)}
                              className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                                isChildActive
                                  ? "bg-[var(--lavender)] text-[var(--primary)]"
                                  : "hover:bg-[var(--surface-alt)] text-[var(--ink)]"
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-[var(--border-subtle)] ${
                                  isChildActive
                                    ? "bg-[var(--primary)] text-white"
                                    : "bg-[var(--surface)] text-[var(--primary)]"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs flex items-center justify-between">
                                  <span>{child.name}</span>
                                  {isChildActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                                  )}
                                </div>
                                <p className="text-[11px] text-[var(--muted)] line-clamp-1 mt-0.5">
                                  {child.description}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* ⌘K Command Search */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--primary)]/40 transition-all"
              title="Search commands and navigate (⌘K)"
            >
              <Search className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span className="hidden sm:inline text-[11px] font-semibold">Search...</span>
              <kbd className="hidden sm:inline text-[10px] font-mono font-bold bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                ⌘K
              </kbd>
            </button>

            {/* API Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                apiOnline
                  ? "bg-[var(--status-allow)]/10 text-[var(--status-allow)] border-[var(--status-allow)]/30"
                  : "bg-[var(--status-escalate)]/10 text-[var(--status-escalate)] border-[var(--status-escalate)]/30"
              }`}
              title={
                apiOnline
                  ? "Backend API online at port 8000"
                  : "Backend API offline or unreachable (mock mode active)"
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  apiOnline
                    ? "bg-[var(--status-allow)] animate-pulse"
                    : "bg-[var(--status-escalate)]"
                }`}
              />
              <span className="text-[11px] tracking-tight">{apiStatusText}</span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--lavender)] transition-all"
                title="System Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--status-escalate)]" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-[var(--surface)] rounded-2xl shadow-dropdown border border-[var(--border)] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] mb-2">
                    <span className="text-xs font-bold text-[var(--ink)]">Fleet Notifications</span>
                    <span className="text-[10px] font-bold text-[var(--status-escalate)] bg-[var(--status-escalate)]/10 px-2 py-0.5 rounded-full">
                      3 New
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
                      <div className="font-bold text-[var(--ink)] text-[11px]">Ring #C-902 Flagged</div>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        4 courier nodes linked via shared IMEI and carrier SIM.
                      </p>
                      <span className="text-[9px] text-[var(--muted)]">2m ago</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
                      <div className="font-bold text-[var(--ink)] text-[11px]">Payout Hold Triggered</div>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        Batch 14B ($1,240.00) held due to IBAN conflict.
                      </p>
                      <span className="text-[9px] text-[var(--muted)]">14m ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu & Logout */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-full bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border)] transition-all"
                title={user ? `${user.name} (${user.role})` : "Account Menu"}
              >
                <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-white font-extrabold flex items-center justify-center text-[11px] shadow-sm">
                  {user?.avatar || "K"}
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-3 w-60 bg-[var(--surface)] rounded-2xl shadow-dropdown border border-[var(--border)] p-2 z-50">
                  <div className="px-3 py-2 border-b border-[var(--border-subtle)] mb-1">
                    <div className="font-extrabold text-xs text-[var(--ink)]">{user?.name || "Anonymous User"}</div>
                    <div className="text-[10px] text-[var(--muted)] truncate">{user?.email || "No email"}</div>
                    
                    {/* Read-Only Role Badge */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[10px] font-black uppercase tracking-wider border border-[var(--primary)]/20">
                        {user?.role || "GUEST"}
                      </span>
                      {user?.title && (
                        <span className="text-[10px] font-medium text-[var(--muted)] truncate">
                          {user.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[var(--status-escalate)] hover:bg-[var(--status-escalate)]/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)]"
              title="Open Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Accordion Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden mt-4 pt-3 border-t border-[var(--border)] max-h-[75vh] overflow-y-auto space-y-2">
            {NAV_GROUPS.map((group) => {
              if (group.isDirectLink) {
                return (
                  <Link
                    key={group.name}
                    to={group.path}
                    className="block px-4 py-2.5 rounded-xl font-bold text-xs text-[var(--ink)] hover:bg-[var(--lavender)]"
                  >
                    {group.name}
                  </Link>
                );
              }
              return (
                <div key={group.name} className="p-2 rounded-xl bg-[var(--surface-alt)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-2">
                    {group.name}
                  </span>
                  <div className="mt-1 space-y-1">
                    {group.children?.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className="block px-3 py-2 rounded-lg text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface)]"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </header>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}
