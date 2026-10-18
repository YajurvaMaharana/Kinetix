import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast container floating at top right */}
      <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const typeStyles = {
            success: "bg-[var(--surface)] border-[var(--status-allow)]/40 text-[var(--ink)]",
            error: "bg-[var(--surface)] border-[var(--status-escalate)]/40 text-[var(--ink)]",
            warning: "bg-[var(--surface)] border-[var(--status-challenge)]/40 text-[var(--ink)]",
            info: "bg-[var(--surface)] border-[var(--border)] text-[var(--ink)]",
          };

          const iconMap = {
            success: <CheckCircle2 className="w-5 h-5 text-[var(--status-allow)] shrink-0" />,
            error: <AlertCircle className="w-5 h-5 text-[var(--status-escalate)] shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-[var(--status-challenge)] shrink-0" />,
            info: <Info className="w-5 h-5 text-[var(--primary)] shrink-0" />,
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl border shadow-plum flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 ${typeStyles[toast.type]}`}
            >
              {iconMap[toast.type]}
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-xs leading-snug">{toast.title}</h5>
                {toast.message && (
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[var(--muted)] hover:text-[var(--ink)] p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
