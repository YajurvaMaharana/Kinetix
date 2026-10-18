import React from "react";

export interface TabOption {
  id: string;
  label: string;
  count?: number | string;
  badge?: string;
}

interface SegmentedTabsProps {
  tabs: TabOption[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function SegmentedTabs({
  tabs,
  activeTab,
  onChange,
  className = "",
}: SegmentedTabsProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-soft mb-6 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
              isActive
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--surface-alt)] text-[var(--muted)] border border-[var(--border-subtle)]"
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
