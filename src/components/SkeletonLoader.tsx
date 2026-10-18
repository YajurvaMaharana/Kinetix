import React from "react";

interface SkeletonProps {
  type?: "card" | "table" | "split" | "metrics";
  count?: number;
}

export default function SkeletonLoader({ type = "card", count = 3 }: SkeletonProps) {
  if (type === "metrics") {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-3"
          >
            <div className="h-3 w-24 bg-[var(--lavender)] rounded-full" />
            <div className="h-8 w-32 bg-[var(--lavender)] rounded-lg" />
            <div className="h-3 w-20 bg-[var(--lavender)] rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "split") {
    return (
      <div className="grid lg:grid-cols-12 gap-6 animate-pulse">
        <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-4">
          <div className="h-4 w-32 bg-[var(--lavender)] rounded-full mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 rounded-xl bg-[var(--surface-alt)] space-y-2">
              <div className="h-3 w-40 bg-[var(--lavender)] rounded-full" />
              <div className="h-2 w-28 bg-[var(--lavender)] rounded-full" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-4">
          <div className="h-6 w-48 bg-[var(--lavender)] rounded-full mb-4" />
          <div className="h-36 bg-[var(--surface-alt)] rounded-xl" />
          <div className="h-24 bg-[var(--surface-alt)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft animate-pulse space-y-4">
        <div className="h-4 w-40 bg-[var(--lavender)] rounded-full mb-6" />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--lavender)]" />
              <div className="space-y-1.5">
                <div className="h-3 w-32 bg-[var(--lavender)] rounded-full" />
                <div className="h-2 w-20 bg-[var(--lavender)] rounded-full" />
              </div>
            </div>
            <div className="h-4 w-16 bg-[var(--lavender)] rounded-full" />
            <div className="h-4 w-20 bg-[var(--lavender)] rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-3"
        >
          <div className="h-4 w-32 bg-[var(--lavender)] rounded-full" />
          <div className="h-20 bg-[var(--surface-alt)] rounded-xl" />
          <div className="h-3 w-24 bg-[var(--lavender)] rounded-full" />
        </div>
      ))}
    </div>
  );
}
