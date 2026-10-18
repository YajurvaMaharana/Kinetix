import React from "react";
import { FolderX, Inbox, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  icon?: any;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl p-12 border border-[var(--border)] shadow-soft text-center flex flex-col items-center justify-center max-w-xl mx-auto my-6">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--primary)] flex items-center justify-center mb-4 shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-extrabold text-[var(--ink)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--muted)] max-w-sm leading-relaxed mb-6">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-5 py-2.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-plum transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
