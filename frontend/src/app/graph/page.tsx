"use client";

import React, { useState } from "react";
import Link from "next/link";
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="text-[#56D9F5] font-semibold hover:underline cursor-pointer">
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

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setSelectedNode(graphNodes[0])}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#101521] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
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

      {/* Cluster Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { label: "All Active Subgraphs", key: "ALL", badge: "3 Clusters" },
          { label: "CLUSTER-RING-409 (Redmi Device Farm)", key: "409", badge: "14 Nodes · 98.4% Risk" },
          { label: "CLUSTER-RING-218 (Chicago Airport Circle)", key: "218", badge: "8 Nodes · Monitored" },
          { label: "CLUSTER-RING-104 (Emulated Driver Farm)", key: "104", badge: "6 Nodes · Disrupted" },
        ].map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveClusterFilter(c.key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono transition-all whitespace-nowrap ${
              activeClusterFilter === c.key
                ? "bg-[#56D9F5]/20 text-[#56D9F5] border border-[#56D9F5]/40 font-bold"
                : "bg-[#101521] text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <span>{c.label}</span>
            <span className="rounded bg-[#080B12] px-1.5 py-0.2 text-[10px] text-slate-400 border border-slate-800">
              {c.badge}
            </span>
          </button>
        ))}
      </div>

      {/* 2-Column Graph Workspace (Left: Interactive Topology SVG, Right: Node Inspector) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: SVG INTERACTIVE GRAPH (8 Cols) */}
        <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-[#101521] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-white">Cluster Subgraph: Queens-Brooklyn Transit Corridor</span>
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-red-400 border border-red-500/30">
                ACTIVE RING DETECTED
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">Interactive: Click node to inspect</span>
          </div>

          {/* SVG Canvas */}
          <div className="relative h-[480px] w-full overflow-hidden rounded-lg bg-[#080B12] border border-slate-800/80">
            {/* Legend Overlay */}
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-3 rounded-lg bg-[#101521]/90 border border-slate-800 p-2 text-[11px] font-mono text-slate-300 backdrop-blur-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FB7185]" /> Anomaly / Suspect
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#56D9F5]" /> Cell Infrastructure
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]" /> Verified Entity
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#A78BFA]" /> Session Token
              </span>
            </div>

            <svg className="w-full h-full" preserveAspectRatio="xMidYMid meet" viewBox="0 0 760 520">
              <defs>
                <linearGradient id="edge-suspicious" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#FB7185" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="edge-auth" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#56D9F5" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0.7" />
                </linearGradient>
              </defs>

              {/* Connecting Edges */}
              <line x1="140" y1="120" x2="260" y2="170" stroke="#56D9F5" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="260" y1="170" x2="360" y2="240" stroke="#56D9F5" strokeWidth="2.5" />
              <line x1="360" y1="240" x2="430" y2="330" stroke="url(#edge-suspicious)" strokeWidth="3" />
              <line x1="430" y1="330" x2="520" y2="430" stroke="url(#edge-suspicious)" strokeWidth="3.5" />
              <line x1="360" y1="240" x2="520" y2="430" stroke="url(#edge-auth)" strokeWidth="2" />

              {/* Edge Rapid Hop Badge */}
              <g transform="translate(475, 380)">
                <rect x="-65" y="-12" width="130" height="24" rx="12" fill="#101521" stroke="#FB7185" strokeWidth="1.5" />
                <text x="0" y="4" fill="#FB7185" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  14.2 km Rapid Hop
                </text>
              </g>

              {/* Interactive Nodes */}
              {/* Node 1: T. Alvarez */}
              <g
                transform="translate(140, 120)"
                onClick={() => setSelectedNode(graphNodes[5])}
                className="cursor-pointer group"
              >
                <circle cx="0" cy="0" r="24" fill="#101521" stroke="#34D399" strokeWidth="2" />
                <text x="0" y="4" fill="#34D399" fontSize="11" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  TA
                </text>
                <text x="0" y="38" fill="#e0e2ed" fontSize="11" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  T. Alvarez
                </text>
                <text x="0" y="52" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                  #TJ-4419 (Pristine)
                </text>
              </g>

              {/* Node 2: Cell Tower */}
              <g
                transform="translate(260, 170)"
                onClick={() => setSelectedNode(graphNodes[3])}
                className="cursor-pointer group"
              >
                <circle cx="0" cy="0" r="26" fill="#101521" stroke="#56D9F5" strokeWidth="2.5" />
                <text x="0" y="4" fill="#56D9F5" fontSize="11" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  TWR
                </text>
                <text x="0" y="40" fill="#e0e2ed" fontSize="11" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  T-Mobile Cell #412
                </text>
                <text x="0" y="54" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                  Queens-Midtown Tunnel
                </text>
              </g>

              {/* Node 3: dev_210c Moto Edge (Primary) */}
              <g
                transform="translate(360, 240)"
                onClick={() => setSelectedNode(graphNodes[2])}
                className="cursor-pointer group"
              >
                <circle cx="0" cy="0" r="26" fill="#101521" stroke="#34D399" strokeWidth="2.5" />
                <text x="0" y="4" fill="#34D399" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  ANDROID
                </text>
                <text x="0" y="40" fill="#e0e2ed" fontSize="11" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  Moto Edge 40
                </text>
                <text x="0" y="54" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                  dev_210c (Primary)
                </text>
              </g>

              {/* Node 4: dev_889a Velocity Ingress */}
              <g
                transform="translate(430, 330)"
                onClick={() => setSelectedNode(graphNodes[1])}
                className="cursor-pointer group"
              >
                <circle cx="0" cy="0" r="28" fill="#101521" stroke="#FB7185" strokeWidth="3" />
                <circle cx="0" cy="0" r="34" fill="none" stroke="#FB7185" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <text x="0" y="4" fill="#FB7185" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  iOS UNPAIRED
                </text>
                <text x="0" y="44" fill="#e0e2ed" fontSize="11" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                  Apple iPhone 15
                </text>
                <text x="0" y="58" fill="#FB7185" fontSize="10" fontFamily="monospace" textAnchor="middle">
                  dev_889a (Velocity Ingress)
                </text>
              </g>

              {/* Node 5: Marcus Vance (Focus Node) */}
              <g
                transform="translate(520, 430)"
                onClick={() => setSelectedNode(graphNodes[0])}
                className="cursor-pointer group"
              >
                <circle cx="0" cy="0" r="32" fill="#101521" stroke="#FB7185" strokeWidth="3.5" />
                <circle cx="0" cy="0" r="40" fill="none" stroke="#FB7185" strokeWidth="1.5" opacity="0.4" />
                <text x="0" y="5" fill="#FB7185" fontSize="14" fontFamily="sans-serif" fontWeight="extrabold" textAnchor="middle">
                  MV
                </text>
                <text x="0" y="50" fill="#ffffff" fontSize="12" fontFamily="sans-serif" fontWeight="extrabold" textAnchor="middle">
                  Marcus Vance
                </text>
                <text x="0" y="66" fill="#FB7185" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  #TJ-8902 · Tier 1 Pro
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* RIGHT COLUMN: NODE INSPECTION DRAWER & TELEMETRY TABLE (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#101521] p-5 space-y-5 sticky top-24">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Info className="h-4 w-4 text-[#56D9F5]" />
              Entity Telemetry Inspector
            </h2>
            <span className="rounded bg-[#56D9F5]/10 px-2 py-0.5 text-xs font-mono font-bold text-[#56D9F5] border border-[#56D9F5]/30">
              {selectedNode.type}
            </span>
          </div>

          {/* Selected Node Details Card */}
          <div className="rounded-xl border border-slate-800 bg-[#080B12] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">{selectedNode.label}</h3>
                <span className="text-xs text-slate-400 font-mono">{selectedNode.subtitle}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Cluster Risk</span>
                <span
                  className={`text-xl font-extrabold font-mono ${
                    selectedNode.riskScore >= 75
                      ? "text-[#FB7185]"
                      : selectedNode.riskScore >= 30
                      ? "text-[#FBBF24]"
                      : "text-[#34D399]"
                  }`}
                >
                  {selectedNode.riskScore}%
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed pt-2 border-t border-slate-800">
              {selectedNode.details}
            </p>
          </div>

          {/* Granular Edge Telemetry & Provenance Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Granular Edge Provenance</span>
              <span className="text-[10px] text-slate-500 font-mono">4 Observed Edges</span>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {mockEdges.map((edge, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-800/80 bg-[#080B12] p-2.5 space-y-1 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#56D9F5] font-bold truncate max-w-[170px]">{edge.sourceTarget}</span>
                    <span className={edge.isPositive ? "text-[#34D399] font-bold" : "text-[#FB7185] font-bold"}>
                      {edge.weight}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{edge.type}</span>
                    <span className="text-slate-500">{edge.timestamp}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans">{edge.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Link to Case */}
          <div className="pt-2 border-t border-slate-800">
            <Link
              href="/cases?id=INV-2024-8902"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#56D9F5]/10 text-[#56D9F5] border border-[#56D9F5]/30 py-2.5 px-4 text-xs font-bold hover:bg-[#56D9F5]/20 transition-all cursor-pointer"
            >
              Open Active Case Investigation (#INV-8902)
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
