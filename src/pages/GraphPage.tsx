"use client";

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  GitFork,
  Download,
  RotateCcw,
  ExternalLink,
  Info,
} from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  subtitle: string;
  type: "COURIER" | "DEVICE" | "CELL_TOWER" | "SESSION" | "KIOSK";
  cx: number;
  cy: number;
  color: string;
  riskScore: number;
  details: string;
}

interface EdgeTelemetry {
  sourceTarget: string;
  type: string;
  timestamp: string;
  weight: string;
  detail: string;
  isPositive: boolean;
}

const graphNodes: GraphNode[] = [
  {
    id: "node_mv",
    label: "Marcus Vance",
    subtitle: "#TJ-8902 · Tier 1 Pro",
    type: "COURIER",
    cx: 480,
    cy: 390,
    color: "#FB7185",
    riskScore: 89,
    details: "Primary courier under investigation. Concurrent socket session reported from un-enrolled iPhone 15.",
  },
  {
    id: "node_dev_889a",
    label: "dev_889a (Velocity Ingress)",
    subtitle: "Apple iPhone 15 Pro",
    type: "DEVICE",
    cx: 390,
    cy: 280,
    color: "#FB7185",
    riskScore: 92,
    details: "Unregistered iOS device. Active at Manhattan Midtown Tunnel (14.2 km apart).",
  },
  {
    id: "node_dev_210c",
    label: "dev_210c (Primary)",
    subtitle: "Moto Edge 40 (Registered)",
    type: "DEVICE",
    cx: 320,
    cy: 200,
    color: "#34D399",
    riskScore: 12,
    details: "Legitimate courier handset. Enrolled in hardware keystore attestation.",
  },
  {
    id: "node_tower_412",
    label: "T-Mobile Cell #412",
    subtitle: "Queens-Midtown Tunnel",
    type: "CELL_TOWER",
    cx: 220,
    cy: 130,
    color: "#56D9F5",
    riskScore: 35,
    details: "Shared urban transit macrocell. High density corridor for Brooklyn-Manhattan traffic.",
  },
  {
    id: "node_ses_41c0",
    label: "ses_41c099a2",
    subtitle: "Session Active",
    type: "SESSION",
    cx: 140,
    cy: 80,
    color: "#A78BFA",
    riskScore: 68,
    details: "Secondary parallel socket connection established at 13:44:02 UTC.",
  },
  {
    id: "node_alvarez",
    label: "T. Alvarez",
    subtitle: "#TJ-4419 (Pristine)",
    type: "COURIER",
    cx: 80,
    cy: 30,
    color: "#34D399",
    riskScore: 5,
    details: "Nearby driver on corridor. No collusive collusion signals identified.",
  },
];

const mockEdges: EdgeTelemetry[] = [
  {
    sourceTarget: "dev_889a ── ses_98a7f10b",
    type: "Unpaired Socket Ingress",
    timestamp: "13:44:02 UTC",
    weight: "+0.34 SHAP",
    detail: "Unenrolled iPhone 15 active on Marcus Vance socket",
    isPositive: false,
  },
  {
    sourceTarget: "dev_210c ── ses_98a7f10b",
    type: "Authenticated Ingress",
    timestamp: "13:42:10 UTC",
    weight: "PASS (-0.15)",
    detail: "Moto Edge 40 signed via Biometric FaceID",
    isPositive: true,
  },
  {
    sourceTarget: "Cell #412 ── dev_889a",
    type: "Macrocell Corroboration",
    timestamp: "13:43:55 UTC",
    weight: "+0.44 SHAP",
    detail: "Dual ping emitted 14.2 km apart in 180s",
    isPositive: false,
  },
  {
    sourceTarget: "dev_904f ── Cell #412",
    type: "Shared Tunnel Conduit",
    timestamp: "13:40:00 UTC",
    weight: "NEUTRAL",
    detail: "High-density multi-courier transit waypoint",
    isPositive: true,
  },
];

export default function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode>(graphNodes[0]);
  const [activeClusterFilter, setActiveClusterFilter] = useState<string>("ALL");

  const handleExportTopology = () => {
    const topologyData = {
      clusterId: "CLUSTER-RING-409",
      exportedAt: new Date().toISOString(),
      generator: "TrustJuggler NetworkX v2.4",
      nodes: graphNodes,
      edges: mockEdges,
    };

    const blob = new Blob([JSON.stringify(topologyData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trustjuggler_topology_cluster_409_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
              TrustJuggler Platform
            </Link>
            <span>/</span>
            <span className="text-slate-200">Syndicate Graph &amp; Collusion Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <GitFork className="h-7 w-7 text-[#FB7185]" />
            <span>Fraud Graph &amp; Collusion Topology</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            NetworkX graph clustering: identifies multi-identity rings sharing hardware UUIDs, bank accounts, and macrocells.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setSelectedNode(graphNodes[0])}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#101521] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Focus
          </button>

          <button
            onClick={handleExportTopology}
            className="flex items-center gap-1.5 rounded-lg bg-[#56D9F5] px-3.5 py-1.5 text-xs font-bold text-[#003640] hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#56D9F5]/20 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Topology (JSON)
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Cluster-409 Topology Map</h2>
              <span className="rounded bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] font-mono text-red-400">
                14 Connected Nodes
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#FB7185]" /> High Risk
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#34D399]" /> Safe
              </span>
            </div>
          </div>

          <div className="relative h-[480px] w-full rounded-xl bg-[#080B12] border border-slate-800/80 overflow-hidden flex items-center justify-center p-4">
            <svg className="w-full h-full absolute inset-0" viewBox="0 0 600 450">
              <line x1="480" y1="390" x2="390" y2="280" stroke="#FB7185" strokeWidth="2.5" strokeDasharray="4 4" />
              <line x1="390" y1="280" x2="220" y2="130" stroke="#FB7185" strokeWidth="2" />
              <line x1="320" y1="200" x2="140" y2="80" stroke="#34D399" strokeWidth="1.5" />
              <line x1="140" y1="80" x2="80" y2="30" stroke="#34D399" strokeWidth="1" />

              {graphNodes.map((n) => {
                const isSelected = selectedNode.id === n.id;
                return (
                  <g
                    key={n.id}
                    onClick={() => setSelectedNode(n)}
                    className="cursor-pointer transition-transform hover:scale-110"
                  >
                    {isSelected && (
                      <circle cx={n.cx} cy={n.cy} r="24" fill="none" stroke={n.color} strokeWidth="1.5" strokeDasharray="3 3" className="animate-spin" />
                    )}
                    <circle
                      cx={n.cx}
                      cy={n.cy}
                      r="16"
                      fill="#101521"
                      stroke={n.color}
                      strokeWidth={isSelected ? "3" : "2"}
                    />
                    <text
                      x={n.cx}
                      y={n.cy + 28}
                      textAnchor="middle"
                      className="fill-slate-200 text-[10px] font-mono select-none font-bold"
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-base font-bold text-white">Node Inspector</h2>
            <span className="font-mono text-xs text-[#56D9F5]">{selectedNode.type}</span>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs text-slate-400 font-mono block">Node Entity</span>
              <span className="text-lg font-bold text-white">{selectedNode.label}</span>
              <span className="text-xs text-slate-400 block">{selectedNode.subtitle}</span>
            </div>

            <div className="rounded-lg bg-[#080B12] border border-slate-800 p-3 space-y-1">
              <span className="text-xs text-slate-400 font-mono block">Entity Risk Score</span>
              <span
                className={`text-2xl font-extrabold font-mono ${
                  selectedNode.riskScore >= 75 ? "text-[#FB7185]" : "text-[#34D399]"
                }`}
              >
                {selectedNode.riskScore} / 100
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#080B12] p-3 space-y-1 text-xs">
              <span className="font-semibold text-slate-300 block">Topological Forensic Note:</span>
              <p className="text-slate-400 leading-relaxed font-sans">{selectedNode.details}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
