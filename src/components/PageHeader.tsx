import React from "react";

interface PageHeaderProps {
  badge?: string;
  title: string;
  subtitle: string;
  primaryAction?: {
    label: string;
    icon?: any;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "accent" | "secondary";
  };
  secondaryAction?: {
    label: string;
    icon?: any;
    onClick: () => void;
    disabled?: boolean;
  };
}

export default function PageHeader({
  badge,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        {badge && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold uppercase tracking-wider mb-1.5">
            {badge}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className="px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--ink)] shadow-soft hover:bg-[var(--surface-alt)] transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {secondaryAction.icon && (
              <secondaryAction.icon className="w-3.5 h-3.5 text-[var(--primary)]" />
            )}
            <span>{secondaryAction.label}</span>
          </button>
        )}

        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            className={`px-5 py-2.5 rounded-full text-xs font-bold shadow-plum transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              primaryAction.variant === "accent"
                ? "bg-[var(--accent)] text-white hover:bg-[#e05a4e]"
                : primaryAction.variant === "secondary"
                ? "bg-[var(--lavender)] text-[var(--primary)] hover:bg-[#e2d5f8]"
                : "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
            }`}
          >
            {primaryAction.loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />
            )}
            <span>{primaryAction.label}</span>
          </button>
        )}
      </div>
    </div>
  );
}
