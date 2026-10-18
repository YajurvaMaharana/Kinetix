import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
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
  X,
  ArrowRight,
} from "lucide-react";

interface CommandItem {
  title: string;
  category: string;
  path: string;
  icon: any;
  description: string;
}

const COMMANDS: CommandItem[] = [
  {
    title: "Overview Command Center",
    category: "Overview",
    path: "/overview",
    icon: Activity,
    description: "Macro fleet risk, trajectory chart, and priority triage queue",
  },
  {
    title: "Live Monitor",
    category: "Monitor",
    path: "/monitor/live",
    icon: ShieldAlert,
    description: "40Hz telemetry stream, sensor fusion, speed anomaly detection",
  },
  {
    title: "Fraud Graph & Rings",
    category: "Monitor",
    path: "/monitor/graph",
    icon: GitFork,
    description: "Syndicate cluster isolation, shared device UUIDs & IBAN links",
  },
  {
    title: "Case Investigations",
    category: "Cases",
    path: "/cases/investigations",
    icon: FolderKanban,
    description: "High-priority courier dossiers, audit evidence & review actions",
  },
  {
    title: "Appeals & Redress",
    category: "Cases",
    path: "/cases/appeals",
    icon: FileText,
    description: "Courier dispute adjudication, false positive remediation",
  },
  {
    title: "Payout Vault & Holds",
    category: "Money",
    path: "/money/payouts",
    icon: Banknote,
    description: "Gated disbursements, ACH approvals, and escrow lockups",
  },
  {
    title: "Policy Simulator",
    category: "Money",
    path: "/money/policies",
    icon: Scale,
    description: "Simulate score cut-lines, friction rates, and chargeback impact",
  },
  {
    title: "Rider Simulator",
    category: "Lab",
    path: "/lab/simulator",
    icon: Sliders,
    description: "Inject synthetic GPS teleportation, device farms, and shifts",
  },
  {
    title: "Demo Controls",
    category: "Lab",
    path: "/lab/demo",
    icon: Cpu,
    description: "Reset demo database, seed baseline couriers and collusion rings",
  },
  {
    title: "Model Evaluation",
    category: "Lab",
    path: "/lab/evaluation",
    icon: Award,
    description: "Precision-recall curves, inference latency & audit metrics",
  },
  {
    title: "Rider Experience View",
    category: "Rider View",
    path: "/rider-view",
    icon: Smartphone,
    description: "Switch to mobile courier experience, earnings, & selfie verify",
  },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or trigger
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = COMMANDS.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
    setQuery("");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[var(--surface)] w-full max-w-xl rounded-2xl shadow-plum border border-[var(--border)] overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <Search className="w-5 h-5 text-[var(--muted)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, route, or feature..."
            autoFocus
            className="w-full bg-transparent text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--background)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[var(--border-subtle)]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--muted)]">
              No matching pages or actions found. Try "payout", "graph", or "simulator".
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleSelect(item.path)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--lavender)] text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--primary)] flex items-center justify-center shrink-0 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[var(--ink)]">{item.title}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--muted)]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })
          )}
        </div>

        {/* Keyboard Footer */}
        <div className="px-4 py-2.5 bg-[var(--surface-alt)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span>Navigate with arrow keys or click</span>
          <span className="font-mono bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
            ESC to close
          </span>
        </div>
      </div>
    </div>
  );
}
