import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Breadcrumb from "./Breadcrumb";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--ink)] flex flex-col font-sans">
      {/* Floating pill top navbar */}
      <Navbar />

      {/* Breadcrumb line below navbar */}
      <Breadcrumb />

      {/* Main page content area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
