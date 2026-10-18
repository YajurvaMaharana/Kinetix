import React from "react";
import { Link } from "react-router-dom";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}

export default function Logo({ size = "md", variant = "dark" }: LogoProps) {
  const iconSizes = {
    sm: "w-7 h-7 text-sm",
    md: "w-9 h-9 text-base",
    lg: "w-12 h-12 text-xl",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };

  return (
    <Link to="/" className="inline-flex items-center gap-2.5 group">
      <div className={`rounded-xl bg-[#4A2C6D] text-white font-extrabold flex items-center justify-center shadow-plum transition-transform group-hover:scale-105 ${iconSizes[size]}`}>
        K
      </div>
      <div className="flex flex-col">
        <span className={`font-extrabold tracking-tight ${textSizes[size]} ${variant === "light" ? "text-white" : "text-[#231B33]"}`}>
          Kinetix
        </span>
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#4A2C6D]/80 -mt-1">
          TrustJuggler AI
        </span>
      </div>
    </Link>
  );
}
