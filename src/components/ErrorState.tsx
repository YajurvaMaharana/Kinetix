import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export default function ErrorState({
  title = "Failed to load telemetry data",
  message,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl p-8 border border-[var(--status-escalate)]/30 shadow-soft max-w-xl mx-auto my-6 text-center flex flex-col items-center">
      <div className="w-12 h-12 rounded-2xl bg-[var(--status-escalate)]/10 text-[var(--status-escalate)] flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-extrabold text-[var(--ink)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--muted)] max-w-md leading-relaxed mb-6">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="px-5 py-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)] text-xs font-bold hover:bg-[var(--lavender)] transition-all flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--primary)] ${retrying ? "animate-spin" : ""}`} />
          <span>{retrying ? "Retrying..." : "Retry Connection"}</span>
        </button>
      )}
    </div>
  );
}
