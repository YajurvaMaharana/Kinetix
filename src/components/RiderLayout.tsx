import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Home,
  Banknote,
  Navigation,
  FileQuestion,
  ScanFace,
  HelpCircle,
  Bell,
  LogOut,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  ChevronRight,
  Bike,
  MapPin,
  Sparkles,
} from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: "warning" | "success" | "info";
  actionLink?: string;
}

const RIDER_NAV_ITEMS = [
  { name: "Home", path: "/rider/home", icon: Home },
  { name: "Payouts", path: "/rider/payouts", icon: Banknote },
  { name: "Trips", path: "/rider/trips", icon: Navigation },
  { name: "Appeals", path: "/rider/appeals", icon: FileQuestion },
  { name: "Verify", path: "/rider/verify", icon: ScanFace },
  { name: "Help", path: "/rider/help", icon: HelpCircle },
];

export default function RiderLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "n1",
      title: "Facial Verification Required",
      message: "Escrow hold on $44.50. Complete 3D selfie to release instantly.",
      time: "12m ago",
      unread: true,
      type: "warning",
      actionLink: "/rider/home",
    },
    {
      id: "n2",
      title: "Payout Cleared",
      message: "Yesterday's shift payout of $120.00 was disbursed to your debit card.",
      time: "3h ago",
      unread: false,
      type: "success",
      actionLink: "/rider/payouts",
    },
    {
      id: "n3",
      title: "Trust Score Updated",
      message: "Your trust score increased to 98% after 15 verified deliveries.",
      time: "1d ago",
      unread: false,
      type: "info",
    },
  ]);

  const navRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
        setNotificationsOpen(false);
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
      message: "Rider session ended. Returned to role selection.",
    });
    navigate("/choose-role");
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#231B33] flex flex-col font-sans selection:bg-[#4A2C6D]/20">
      {/* ========================================================= */}
      {/* TOP FLOATING NAVBAR (DESKTOP & TABLET) */}
      {/* ========================================================= */}
      <header
        ref={navRef}
        className="fixed top-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-5xl z-50 bg-[#FFF9F2]/95 backdrop-blur-md border border-[#4A2C6D]/15 rounded-full px-4 sm:px-6 py-2.5 shadow-plum transition-all"
      >
        <div className="flex items-center justify-between">
          {/* Left Brand & Badge */}
          <div className="flex items-center gap-3">
            <Link to="/rider/home" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#4A2C6D] text-white flex items-center justify-center font-black text-sm shadow-sm">
                K
              </div>
              <span className="font-extrabold text-base tracking-tight text-[#231B33]">
                Kinetics
              </span>
            </Link>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-black uppercase tracking-wider border border-[#2FBF8F]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF8F] animate-pulse" />
              <span>COURIER PORTAL</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white/60 p-1 rounded-full border border-[#4A2C6D]/10">
            {RIDER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#4A2C6D] text-white shadow-sm"
                      : "text-[#6B6480] hover:text-[#231B33] hover:bg-[#4A2C6D]/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Icons: Notifications & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileOpen(false);
                }}
                className={`p-2 rounded-full border transition-all relative ${
                  notificationsOpen
                    ? "bg-[#4A2C6D] text-white border-[#4A2C6D]"
                    : "bg-white text-[#231B33] border-[#4A2C6D]/15 hover:bg-[#4A2C6D]/5"
                }`}
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF6F61] text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-88 bg-white rounded-3xl shadow-dropdown border border-[#4A2C6D]/15 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-[#231B33]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FF6F61]/15 text-[#FF6F61] text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[10px] font-bold text-[#4A2C6D] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded-2xl border transition-all text-left ${
                          n.unread
                            ? "bg-[#FFF9F2] border-[#4A2C6D]/15"
                            : "bg-gray-50/60 border-transparent text-gray-500"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-extrabold text-xs text-[#231B33]">{n.title}</span>
                          <span className="text-[10px] text-[#6B6480] shrink-0">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-[#6B6480] mt-0.5 leading-snug">{n.message}</p>
                        {n.actionLink && (
                          <Link
                            to={n.actionLink}
                            onClick={() => setNotificationsOpen(false)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4A2C6D] hover:underline mt-1.5"
                          >
                            <span>Open in portal</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar & Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 p-1 pl-1.5 sm:pr-2.5 rounded-full bg-white border border-[#4A2C6D]/15 hover:border-[#4A2C6D]/30 transition-all shadow-xs"
                title="Account Menu"
              >
                <div className="w-7 h-7 rounded-full bg-[#2FBF8F] text-white font-extrabold text-xs flex items-center justify-center">
                  {user?.avatar || user?.name?.slice(0, 2).toUpperCase() || "CR"}
                </div>
                <span className="hidden sm:inline font-bold text-xs text-[#231B33] max-w-[100px] truncate">
                  {user?.name || "Rider"}
                </span>
              </button>

              {/* Profile Menu Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-dropdown border border-[#4A2C6D]/15 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="pb-3 border-b border-gray-100 mb-3">
                    <div className="font-extrabold text-sm text-[#231B33] truncate">
                      {user?.name || "Courier Partner"}
                    </div>
                    <div className="text-[11px] text-[#6B6480] truncate">{user?.email}</div>

                    {/* Read-Only Role Badge */}
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#2FBF8F]/15 text-[#2FBF8F] text-[10px] font-black uppercase tracking-wider border border-[#2FBF8F]/25">
                        ROLE: RIDER
                      </span>
                      <span className="text-[10px] font-mono text-[#6B6480]">
                        {user?.courierId || "CR-8941"}
                      </span>
                    </div>

                    {/* Vehicle & Hub Info */}
                    <div className="mt-2 text-[11px] text-[#6B6480] flex items-center gap-2">
                      <span className="flex items-center gap-1 font-semibold">
                        <Bike className="w-3.5 h-3.5 text-[#4A2C6D]" />
                        <span>{user?.vehicleType || "Scooter"}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#FF6F61]" />
                        <span className="truncate">{user?.city || "Seattle Hub"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Navigation Links inside Profile Menu */}
                  <div className="space-y-1 mb-2">
                    <Link
                      to="/rider/home"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#231B33] hover:bg-[#FFF9F2] transition-colors"
                    >
                      <Home className="w-3.5 h-3.5 text-[#4A2C6D]" />
                      <span>Rider Dashboard</span>
                    </Link>
                    <Link
                      to="/rider/payouts"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#231B33] hover:bg-[#FFF9F2] transition-colors"
                    >
                      <Banknote className="w-3.5 h-3.5 text-[#2FBF8F]" />
                      <span>Payouts &amp; Wallet</span>
                    </Link>
                    <Link
                      to="/rider/help"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#231B33] hover:bg-[#FFF9F2] transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-[#FF6F61]" />
                      <span>Driver Support</span>
                    </Link>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-[#FF6F61] hover:bg-[#FF6F61]/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN RIDER PORTAL CONTENT VIEWPORT */}
      {/* ========================================================= */}
      <main className="flex-1 pt-24 pb-24 md:pb-12 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>

      {/* ========================================================= */}
      {/* BOTTOM MOBILE TAB BAR (PHONES ONLY) */}
      {/* ========================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#4A2C6D]/15 py-2 px-3 z-50 shadow-lg flex items-center justify-around">
        {RIDER_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl min-w-[50px] min-h-[44px] transition-all ${
                isActive
                  ? "text-[#4A2C6D] font-extrabold"
                  : "text-[#6B6480] hover:text-[#231B33]"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? "bg-[#4A2C6D]/10" : ""
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-[#4A2C6D]" : ""}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
