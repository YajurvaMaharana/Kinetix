import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import SkeletonLoader from "@/components/SkeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getGraphClusters, GraphCluster } from "@/api/endpoints";
import {
  GitFork,
  Cpu,
  Share2,
  ShieldAlert,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default function FraudGraphPage() {
  const { role, isReadOnly } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("rings");
  const [clusters, setClusters] = useState<GraphCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<GraphCluster | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getGraphClusters();
        setClusters(data);
        if (data.length > 0) setSelectedCluster(data[0]);
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Failed to load syndicate clusters",
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const handleRunClustering = () => {
    showToast({
      type: "info",
      title: "Louvain Community Detection Executing",
      message: "Partitioning 4.2M node bipartite entity graph across banking & IMEI edges.",
    });
  };

  const handleQuarantineRing = (clusterId: string) => {
    if (isReadOnly) {
      showToast({
        type: "warning",
        title: "Action Restricted",
        message: "Auditor role has read-only access.",
      });
      return;
    }
    setClusters((prev) =>
      prev.map((c) => (c.cluster_id === clusterId ? { ...c, status: "DISRUPTED" } : c))
    );
    if (selectedCluster?.cluster_id === clusterId) {
      setSelectedCluster((prev) => (prev ? { ...prev, status: "DISRUPTED" } : null));
    }
    showToast({
      type: "success",
      title: `Syndicate ${clusterId} Quarantined`,
      message: "Associated courier nodes restricted and escrow payout gates locked.",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Graph Intelligence"
        title="Fraud & Syndicate Graph"
        subtitle="High-order entity link extraction isolating device recycling farms & kickback rings"
        primaryAction={{
          label: "Run Louvain Clustering",
          icon: Sparkles,
          onClick: handleRunClustering,
        }}
      />

      <SegmentedTabs
        tabs={[
          { id: "rings", label: "Active Rings", count: clusters.length },
          { id: "identifiers", label: "Shared IBAN & Devices", count: 14 },
          { id: "quarantined", label: "Disrupted Syndicates", count: 1 },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {loading ? (
        <SkeletonLoader type="split" />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Discovered Rings */}
          <div className="lg:col-span-5 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-soft space-y-2 h-[560px] overflow-y-auto">
            <div className="px-2 py-1 text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center justify-between">
              <span>Isolated Collusion Clusters</span>
              <span className="font-mono text-[10px] text-[var(--primary)] font-bold">
                {clusters.length} Isolated
              </span>
            </div>

            {clusters.map((c) => {
              const isSelected = selectedCluster?.cluster_id === c.cluster_id;
              return (
                <button
                  key={c.cluster_id}
                  onClick={() => setSelectedCluster(c)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                    isSelected
                      ? "bg-[var(--lavender)] border-[var(--primary)] shadow-sm"
                      : "bg-[var(--surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)]">
                      {c.cluster_id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === "ACTIVE"
                          ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                          : "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-xs text-[var(--ink)] mb-1">
                    {c.name}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">
                    {c.nodes_count} interconnected courier nodes • Risk Score: {c.risk_score}%
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right Column: Interactive Entity Link Inspector */}
          {selectedCluster && (
            <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                      SYNDICATE DOSSIER • {selectedCluster.cluster_id}
                    </span>
                    <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
                      {selectedCluster.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleQuarantineRing(selectedCluster.cluster_id)}
                    disabled={isReadOnly || selectedCluster.status === "DISRUPTED"}
                    className="px-4 py-2 rounded-full bg-[var(--status-escalate)] hover:bg-[#d43f44] text-white text-xs font-bold shadow-plum transition-all disabled:opacity-50"
                  >
                    {selectedCluster.status === "DISRUPTED" ? "Quarantined" : "Quarantine Entire Ring"}
                  </button>
                </div>

                {/* Graph Visualization Card */}
                <div className="h-64 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] p-4 flex items-center justify-center relative overflow-hidden mb-6">
                  <div className="absolute inset-0 bg-radial from-[var(--primary)]/5 to-transparent pointer-events-none" />

                  {/* SVG Entity Graph Layout */}
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Center Bridge Node */}
                    <div className="w-14 h-14 rounded-2xl bg-[var(--primary)] text-white text-xs font-extrabold flex flex-col items-center justify-center shadow-plum z-10 border-2 border-white">
                      <span>SHARED</span>
                      <span className="text-[9px] opacity-80">IBAN</span>
                    </div>

                    {/* Orbiting Nodes */}
                    <div className="absolute -top-1 left-12 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <div className="text-[10px] font-extrabold text-[var(--status-escalate)]">Courier N1</div>
                      <div className="text-[9px] text-[var(--muted)]">CR-8941</div>
                    </div>
                    <div className="absolute -bottom-1 left-16 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <div className="text-[10px] font-extrabold text-[var(--status-escalate)]">Courier N2</div>
                      <div className="text-[9px] text-[var(--muted)]">CR-9023</div>
                    </div>
                    <div className="absolute top-6 right-16 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <div className="text-[10px] font-extrabold text-[var(--status-challenge)]">Courier N3</div>
                      <div className="text-[9px] text-[var(--muted)]">CR-6650</div>
                    </div>
                    <div className="absolute -bottom-1 right-12 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center">
                      <div className="text-[10px] font-extrabold text-[var(--status-challenge)]">Courier N4</div>
                      <div className="text-[9px] text-[var(--muted)]">CR-5542</div>
                    </div>
                  </div>
                </div>

                {/* Shared Identifiers List */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-[var(--ink)]">Extracted Entity Ties:</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedCluster.shared_identifiers.map((id, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--primary)]"
                      >
                        🔗 {id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Calculated via high-density graph community detection.</span>
                <span className="font-bold text-[var(--status-escalate)]">
                  Risk Index: {selectedCluster.risk_score}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
