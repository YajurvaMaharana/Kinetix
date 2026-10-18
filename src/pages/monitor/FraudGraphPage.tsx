import React, { useState, useRef, useMemo, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useToast } from "@/context/ToastContext";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  User,
  Smartphone,
  CreditCard,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  Eye,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Move,
  Building2,
  Flame,
  ExternalLink,
} from "lucide-react";

export type EntityType = "rider" | "device" | "bank";

export interface GraphNode {
  id: string;
  label: string;
  name: string;
  type: EntityType;
  x: number;
  y: number;
  riskScore: number;
  ringId?: "RING-C-902" | "RING-B-410" | "CLEAN-EAST";
  ringName?: string;
  metadata: Record<string, string>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: "SHARED_HARDWARE" | "LINKED_PAYOUT" | "COLOCATION" | "AUTH_DEVICE";
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  ringId?: "RING-C-902" | "RING-B-410" | "CLEAN-EAST";
  ruleDescription: string;
}

const INITIAL_NODES: GraphNode[] = [
  // --- Ring #C-902: Downtown Device Farm & Shared Bank ---
  {
    id: "r_8941",
    label: "CR-8941",
    name: "Alex Rivera",
    type: "rider",
    x: 230,
    y: 160,
    riskScore: 89,
    ringId: "RING-C-902",
    ringName: "Ring #C-902: Downtown Farm Syndicate",
    metadata: {
      hub: "North Hub",
      status: "Escalated for Velocity Spoof",
      orders: "14 Today",
      phone: "+1 (555) 234-8901",
    },
  },
  {
    id: "r_9023",
    label: "CR-9023",
    name: "Tariq Vance",
    type: "rider",
    x: 170,
    y: 310,
    riskScore: 84,
    ringId: "RING-C-902",
    ringName: "Ring #C-902: Downtown Farm Syndicate",
    metadata: {
      hub: "Downtown Core",
      status: "Shared Device Flag",
      orders: "19 Today",
      phone: "+1 (555) 782-9914",
    },
  },
  {
    id: "r_5542",
    label: "CR-5542",
    name: "David Kim",
    type: "rider",
    x: 320,
    y: 360,
    riskScore: 94,
    ringId: "RING-C-902",
    ringName: "Ring #C-902: Downtown Farm Syndicate",
    metadata: {
      hub: "South Bay",
      status: "Teleportation Anomaly",
      orders: "8 Today",
      phone: "+1 (555) 491-3829",
    },
  },
  {
    id: "d_redmi_farm",
    label: "DEV-IMEI-e3b0",
    name: "Xiaomi Redmi 12 (Rooted)",
    type: "device",
    x: 350,
    y: 220,
    riskScore: 95,
    ringId: "RING-C-902",
    ringName: "Ring #C-902: Downtown Farm Syndicate",
    metadata: {
      os: "Android 13 (Magisk Root)",
      carrier: "T-Mobile US",
      mockProvider: "Active Flag detected",
      firstSeen: "48h ago",
    },
  },
  {
    id: "b_chase_shared",
    label: "IBAN-CHASE-9921",
    name: "Chase Checking •••• 9921",
    type: "bank",
    x: 480,
    y: 290,
    riskScore: 92,
    ringId: "RING-C-902",
    ringName: "Ring #C-902: Downtown Farm Syndicate",
    metadata: {
      bank: "JPMorgan Chase NA",
      routing: "021000021",
      payoutHeld: "$1,240.00 Held",
      accountAge: "6 days",
    },
  },

  // --- Ring #B-410: Airport Corridor Colocation Ring ---
  {
    id: "r_6650",
    label: "CR-6650",
    name: "Kenji Sato",
    type: "rider",
    x: 640,
    y: 150,
    riskScore: 72,
    ringId: "RING-B-410",
    ringName: "Ring #B-410: Airport Colocation Ring",
    metadata: {
      hub: "Metro Core",
      status: "Dual-App Delivery",
      orders: "12 Today",
      phone: "+1 (555) 302-8812",
    },
  },
  {
    id: "r_4402",
    label: "CR-4402",
    name: "Aria Thorne",
    type: "rider",
    x: 790,
    y: 190,
    riskScore: 68,
    ringId: "RING-B-410",
    ringName: "Ring #B-410: Airport Colocation Ring",
    metadata: {
      hub: "Airport Corridor",
      status: "Colocation Probe Active",
      orders: "15 Today",
      phone: "+1 (555) 612-4091",
    },
  },
  {
    id: "d_pixel_shared",
    label: "DEV-IMEI-8819",
    name: "Google Pixel 8",
    type: "device",
    x: 710,
    y: 280,
    riskScore: 65,
    ringId: "RING-B-410",
    ringName: "Ring #B-410: Airport Colocation Ring",
    metadata: {
      os: "Android 14.1",
      carrier: "Google Fi",
      mockProvider: "None",
      firstSeen: "12 days ago",
    },
  },
  {
    id: "b_wells_shared",
    label: "IBAN-WELLS-4108",
    name: "Wells Fargo •••• 4108",
    type: "bank",
    x: 820,
    y: 330,
    riskScore: 62,
    ringId: "RING-B-410",
    ringName: "Ring #B-410: Airport Colocation Ring",
    metadata: {
      bank: "Wells Fargo Bank",
      routing: "121000247",
      payoutHeld: "$480.50 Held",
      accountAge: "24 days",
    },
  },

  // --- Clean Fleet / Verified Entities (East Sector) ---
  {
    id: "r_7812",
    label: "CR-7812",
    name: "Elena Rostova",
    type: "rider",
    x: 370,
    y: 470,
    riskScore: 11,
    ringId: "CLEAN-EAST",
    ringName: "Clean Verified Fleet",
    metadata: {
      hub: "East Sector",
      status: "Verified Payouts Active",
      orders: "22 Today",
      phone: "+1 (555) 492-1182",
    },
  },
  {
    id: "d_iphone_legit",
    label: "DEV-IMEI-4102",
    name: "Apple iPhone 15 Pro",
    type: "device",
    x: 520,
    y: 490,
    riskScore: 8,
    ringId: "CLEAN-EAST",
    ringName: "Clean Verified Fleet",
    metadata: {
      os: "iOS 18.2",
      carrier: "Verizon Wireless",
      secureEnclave: "Attested Hardware",
      firstSeen: "180 days ago",
    },
  },
  {
    id: "b_boa_legit",
    label: "IBAN-BOA-1283",
    name: "Bank of America •••• 1283",
    type: "bank",
    x: 660,
    y: 460,
    riskScore: 6,
    ringId: "CLEAN-EAST",
    ringName: "Clean Verified Fleet",
    metadata: {
      bank: "Bank of America NA",
      routing: "026009593",
      payoutHeld: "$0.00 (Instant Clearing)",
      accountAge: "3 years",
    },
  },
];

const INITIAL_EDGES: GraphEdge[] = [
  // Ring #C-902 Edges (High Risk / Collusion)
  {
    id: "e1",
    source: "r_8941",
    target: "d_redmi_farm",
    relationship: "SHARED_HARDWARE",
    riskLevel: "HIGH",
    ringId: "RING-C-902",
    ruleDescription: "Simultaneous app login signatures on single Magisk-rooted Redmi 12",
  },
  {
    id: "e2",
    source: "r_9023",
    target: "d_redmi_farm",
    relationship: "SHARED_HARDWARE",
    riskLevel: "HIGH",
    ringId: "RING-C-902",
    ruleDescription: "Device fingerprint hash collisions within a 15-minute dispatch window",
  },
  {
    id: "e3",
    source: "r_5542",
    target: "d_redmi_farm",
    relationship: "SHARED_HARDWARE",
    riskLevel: "HIGH",
    ringId: "RING-C-902",
    ruleDescription: "Shared IMEI and sensor noise distribution profile across accounts",
  },
  {
    id: "e4",
    source: "r_8941",
    target: "b_chase_shared",
    relationship: "LINKED_PAYOUT",
    riskLevel: "HIGH",
    ringId: "RING-C-902",
    ruleDescription: "Direct payout deposit routed to shared Chase account •••• 9921",
  },
  {
    id: "e5",
    source: "r_9023",
    target: "b_chase_shared",
    relationship: "LINKED_PAYOUT",
    riskLevel: "HIGH",
    ringId: "RING-C-902",
    ruleDescription: "Payout destination matches blacklisted multi-courier escrow node",
  },
  {
    id: "e6",
    source: "r_5542",
    target: "b_chase_shared",
    relationship: "LINKED_PAYOUT",
    riskLevel: "HIGH",
    ringId: "RING-C-902",
    ruleDescription: "Beneficiary tax ID mismatch detected across three delivery profiles",
  },

  // Ring #B-410 Edges (Medium Risk)
  {
    id: "e7",
    source: "r_6650",
    target: "d_pixel_shared",
    relationship: "SHARED_HARDWARE",
    riskLevel: "MEDIUM",
    ringId: "RING-B-410",
    ruleDescription: "Couriers toggle Bluetooth beacon identity on shared Pixel 8 handset",
  },
  {
    id: "e8",
    source: "r_4402",
    target: "d_pixel_shared",
    relationship: "SHARED_HARDWARE",
    riskLevel: "MEDIUM",
    ringId: "RING-B-410",
    ruleDescription: "Device identity shared alternately between morning & evening shifts",
  },
  {
    id: "e9",
    source: "r_6650",
    target: "b_wells_shared",
    relationship: "LINKED_PAYOUT",
    riskLevel: "MEDIUM",
    ringId: "RING-B-410",
    ruleDescription: "Linked payout route targeting Wells Fargo savings account •••• 4108",
  },
  {
    id: "e10",
    source: "r_4402",
    target: "b_wells_shared",
    relationship: "LINKED_PAYOUT",
    riskLevel: "MEDIUM",
    ringId: "RING-B-410",
    ruleDescription: "Direct deposit address matched against previous challenge record",
  },
  {
    id: "e11",
    source: "r_6650",
    target: "r_4402",
    relationship: "COLOCATION",
    riskLevel: "MEDIUM",
    ringId: "RING-B-410",
    ruleDescription: "Spatio-temporal trajectory correlation > 91% along Airport corridor",
  },

  // Clean East Sector Edges
  {
    id: "e12",
    source: "r_7812",
    target: "d_iphone_legit",
    relationship: "AUTH_DEVICE",
    riskLevel: "LOW",
    ringId: "CLEAN-EAST",
    ruleDescription: "Hardware-backed Secure Enclave cryptographic token attested",
  },
  {
    id: "e13",
    source: "r_7812",
    target: "b_boa_legit",
    relationship: "LINKED_PAYOUT",
    riskLevel: "LOW",
    ringId: "CLEAN-EAST",
    ruleDescription: "Single-owner bank account with 3-year verified settlement history",
  },
];

export default function FraudGraphPage() {
  const { showToast } = useToast();

  // Tab control
  const [activeTab, setActiveTab] = useState<"topology" | "syndicates" | "matrix">("topology");

  // Nodes & Edges
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [edges] = useState<GraphEdge[]>(INITIAL_EDGES);

  // Selection & Spotlight Filters
  const [selectedNodeId, setSelectedNodeId] = useState<string>("r_8941");
  const [ringFilter, setRingFilter] = useState<"ALL" | "RING-C-902" | "RING-B-410" | "CLEAN-EAST">("ALL");
  const [typeFilters, setTypeFilters] = useState<{ rider: boolean; device: boolean; bank: boolean }>({
    rider: true,
    device: true,
    bank: true,
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Canvas Pan & Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: -40, y: -20 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });

  // Interactive Node Dragging State
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // Node Map for rapid lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Selected Node
  const selectedNode = useMemo(() => {
    return nodeMap.get(selectedNodeId) || nodes[0];
  }, [nodeMap, selectedNodeId, nodes]);

  // Direct connected edges & neighbors for selected node
  const { connectedEdgeIds, neighborNodeIds } = useMemo(() => {
    const edgeIds = new Set<string>();
    const neighbors = new Set<string>();

    if (!selectedNodeId) return { connectedEdgeIds: edgeIds, neighborNodeIds: neighbors };

    edges.forEach((e) => {
      if (e.source === selectedNodeId) {
        edgeIds.add(e.id);
        neighbors.add(e.target);
      } else if (e.target === selectedNodeId) {
        edgeIds.add(e.id);
        neighbors.add(e.source);
      }
    });

    return { connectedEdgeIds: edgeIds, neighborNodeIds: neighbors };
  }, [edges, selectedNodeId]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: -40, y: -20 });
    setNodes(INITIAL_NODES);
    showToast({
      type: "info",
      title: "View Reset",
      message: "Graph viewport and node coordinates restored to default layout.",
    });
  };

  // Center / Focus on specific node
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      const target = nodeMap.get(nodeId);
      if (!target || !svgRef.current) return;
      setSelectedNodeId(nodeId);
      // Center canvas around target node coordinate
      setPan({
        x: 480 - target.x * zoom,
        y: 280 - target.y * zoom,
      });
      showToast({
        type: "info",
        title: `Focused: ${target.name}`,
        message: `${target.label} highlighted with connected graph ties.`,
      });
    },
    [nodeMap, zoom, showToast]
  );

  // SVG coordinate transformation helper
  const getSvgCoordinates = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: (clientX - pan.x) / zoom,
      y: (clientY - pan.y) / zoom,
    };
  };

  // Pan & Node Drag Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).tagName === "rect") {
      setIsPanning(true);
      setStartPanPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      const coords = getSvgCoordinates(e);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggedNodeId ? { ...n, x: Math.round(coords.x), y: Math.round(coords.y) } : n
        )
      );
      return;
    }
    if (isPanning) {
      setPan({
        x: e.clientX - startPanPos.x,
        y: e.clientY - startPanPos.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.min(2.2, Math.max(0.5, Number((z + zoomFactor).toFixed(2)))));
  };

  // Search filter node selection
  const handleSearchSelect = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return;
    const match = nodes.find(
      (n) =>
        n.label.toLowerCase().includes(query.toLowerCase()) ||
        n.name.toLowerCase().includes(query.toLowerCase())
    );
    if (match) {
      handleFocusNode(match.id);
    }
  };

  // Toggle entity type visibility
  const toggleTypeFilter = (type: EntityType) => {
    setTypeFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Helper for node icon
  const getNodeIcon = (type: EntityType) => {
    switch (type) {
      case "rider":
        return <User className="w-4 h-4" />;
      case "device":
        return <Smartphone className="w-4 h-4" />;
      case "bank":
        return <CreditCard className="w-4 h-4" />;
    }
  };

  // Helper for node color theme
  const getNodeColors = (node: GraphNode) => {
    const isSelected = node.id === selectedNodeId;
    const isNeighbor = neighborNodeIds.has(node.id);

    // Collusion Ring Styling
    if (node.ringId === "RING-C-902") {
      return {
        fill: "var(--surface)",
        stroke: "var(--status-escalate)",
        badgeBg: "bg-[var(--status-escalate)]/15",
        badgeText: "text-[var(--status-escalate)]",
        iconColor: "text-[var(--status-escalate)]",
        glow: isSelected || isNeighbor ? "drop-shadow(0 0 10px rgba(229,72,77,0.5))" : "none",
      };
    }
    if (node.ringId === "RING-B-410") {
      return {
        fill: "var(--surface)",
        stroke: "var(--status-challenge)",
        badgeBg: "bg-[var(--status-challenge)]/15",
        badgeText: "text-[var(--status-challenge)]",
        iconColor: "text-[var(--status-challenge)]",
        glow: isSelected || isNeighbor ? "drop-shadow(0 0 10px rgba(245,165,36,0.5))" : "none",
      };
    }
    return {
      fill: "var(--surface)",
      stroke: "var(--status-allow)",
      badgeBg: "bg-[var(--status-allow)]/15",
      badgeText: "text-[var(--status-allow)]",
      iconColor: "text-[var(--status-allow)]",
      glow: isSelected || isNeighbor ? "drop-shadow(0 0 10px rgba(47,191,143,0.5))" : "none",
    };
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Bipartite Collusion Graph"
        title="Fraud & Syndicate Graph"
        subtitle="Interactive 2D node-link topology isolating shared devices, bank routing accounts, and collusion rings"
        secondaryAction={{
          label: "Reset Graph View",
          icon: RotateCcw,
          onClick: handleResetZoom,
        }}
        primaryAction={{
          label: "Spotlight Ring #C-902",
          icon: Sparkles,
          onClick: () => {
            setActiveTab("topology");
            setRingFilter("RING-C-902");
            handleFocusNode("d_redmi_farm");
          },
          variant: "accent",
        }}
      />

      {/* Segmented Sub-view Navigation */}
      <SegmentedTabs
        tabs={[
          { id: "topology", label: "Interactive 2D Topology", count: nodes.length },
          { id: "syndicates", label: "Collusion Syndicates", count: 2, badge: "active" },
          { id: "matrix", label: "Bipartite Link Registry", count: edges.length },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* SUB-VIEW 1: Interactive 2D Graph Canvas & Split View */}
      {activeTab === "topology" && (
        <div className="space-y-4">
          {/* Ring Filter Pills & Entity Type Selectors */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] p-3 rounded-2xl border border-[var(--border)] shadow-soft">
            {/* Ring Spotlight Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-2">
                Ring Spotlight:
              </span>
              {[
                { id: "ALL", label: "All Entities" },
                { id: "RING-C-902", label: "Ring #C-902 (Redmi Farm • 3 Riders)" },
                { id: "RING-B-410", label: "Ring #B-410 (Airport Colocation)" },
                { id: "CLEAN-EAST", label: "Clean Verified Fleet" },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRingFilter(r.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    ringFilter === r.id
                      ? r.id === "RING-C-902"
                        ? "bg-[var(--status-escalate)] text-white shadow-sm"
                        : r.id === "RING-B-410"
                        ? "bg-[var(--status-challenge)] text-white shadow-sm"
                        : r.id === "CLEAN-EAST"
                        ? "bg-[var(--status-allow)] text-white shadow-sm"
                        : "bg-[var(--primary)] text-white shadow-sm"
                      : "bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Entity Type Visibility Filters */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Layers:
              </span>
              <button
                onClick={() => toggleTypeFilter("rider")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  typeFilters.rider
                    ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30"
                    : "bg-gray-100 text-gray-400 border-gray-200"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Riders ({nodes.filter((n) => n.type === "rider").length})</span>
              </button>
              <button
                onClick={() => toggleTypeFilter("device")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  typeFilters.device
                    ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30"
                    : "bg-gray-100 text-gray-400 border-gray-200"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Devices ({nodes.filter((n) => n.type === "device").length})</span>
              </button>
              <button
                onClick={() => toggleTypeFilter("bank")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  typeFilters.bank
                    ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30"
                    : "bg-gray-100 text-gray-400 border-gray-200"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Banks ({nodes.filter((n) => n.type === "bank").length})</span>
              </button>
            </div>
          </div>

          {/* MAIN GRAPH SPLIT VIEW: Left (2/3) Interactive 2D Graph Canvas + Right (1/3) Entity Inspector */}
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Graph Canvas Container */}
            <div className="lg:col-span-8 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden relative select-none">
              {/* Top Canvas Bar Controls */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Find node or IMEI..."
                    value={searchQuery}
                    onChange={(e) => handleSearchSelect(e.target.value)}
                    className="bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--border)] rounded-full pl-8 pr-3 py-1.5 text-xs text-[var(--ink)] shadow-soft focus:outline-none focus:border-[var(--primary)] w-48 transition-all"
                  />
                </div>
              </div>

              {/* Floating Zoom / Pan Toolbar */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-[var(--surface)]/95 backdrop-blur-md p-1 rounded-full border border-[var(--border)] shadow-soft">
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-alt)] text-[var(--ink)] transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold text-[var(--muted)] px-1">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-alt)] text-[var(--ink)] transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-alt)] text-[var(--ink)] transition-colors"
                  title="Fit Graph to Screen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Canvas Subtitle Status */}
              <div className="absolute bottom-4 left-4 z-20 pointer-events-none text-[11px] text-[var(--muted)] bg-[var(--surface)]/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[var(--border-subtle)] shadow-sm flex items-center gap-2">
                <Move className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Drag node or canvas to reposition • Click to inspect • Scroll to zoom</span>
              </div>

              {/* SVG 2D Canvas */}
              <svg
                ref={svgRef}
                className={`w-full h-[580px] bg-[var(--surface-alt)] ${
                  draggedNodeId ? "cursor-grabbing" : isPanning ? "cursor-grabbing" : "cursor-grab"
                }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                {/* Background Grid Pattern */}
                <defs>
                  <pattern id="graphGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="20" cy="20" r="1.2" fill="rgba(74, 44, 109, 0.08)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#graphGrid)" />

                {/* Transform Group for Pan & Zoom */}
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Collusion Ring Boundary Clusters (Convex Blobs) */}
                  {/* Ring #C-902 Cluster Boundary */}
                  {(ringFilter === "ALL" || ringFilter === "RING-C-902") && (
                    <g className="transition-opacity duration-300">
                      <path
                        d="M 150 130 Q 380 110 540 270 Q 430 430 190 390 Q 110 250 150 130 Z"
                        fill="rgba(229, 72, 77, 0.06)"
                        stroke="rgba(229, 72, 77, 0.35)"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />
                      <text
                        x="160"
                        y="120"
                        fill="var(--status-escalate)"
                        fontSize="11"
                        fontWeight="800"
                        letterSpacing="1px"
                      >
                        RING #C-902 (DOWNTOWN FARM SYNDICATE)
                      </text>
                    </g>
                  )}

                  {/* Ring #B-410 Cluster Boundary */}
                  {(ringFilter === "ALL" || ringFilter === "RING-B-410") && (
                    <g className="transition-opacity duration-300">
                      <path
                        d="M 610 110 Q 860 140 880 350 Q 750 410 630 260 Q 580 160 610 110 Z"
                        fill="rgba(245, 165, 36, 0.06)"
                        stroke="rgba(245, 165, 36, 0.35)"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />
                      <text
                        x="640"
                        y="110"
                        fill="var(--status-challenge)"
                        fontSize="11"
                        fontWeight="800"
                        letterSpacing="1px"
                      >
                        RING #B-410 (AIRPORT CORRIDOR)
                      </text>
                    </g>
                  )}

                  {/* Clean East Sector Boundary */}
                  {(ringFilter === "ALL" || ringFilter === "CLEAN-EAST") && (
                    <g className="transition-opacity duration-300">
                      <path
                        d="M 330 430 Q 560 410 730 440 Q 640 560 380 560 Z"
                        fill="rgba(47, 191, 143, 0.06)"
                        stroke="rgba(47, 191, 143, 0.35)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="370"
                        y="550"
                        fill="var(--status-allow)"
                        fontSize="11"
                        fontWeight="800"
                        letterSpacing="1px"
                      >
                        VERIFIED GENUINE FLEET (EAST SECTOR)
                      </text>
                    </g>
                  )}

                  {/* Edges / Relationship Links */}
                  {edges.map((edge) => {
                    const sourceNode = nodeMap.get(edge.source);
                    const targetNode = nodeMap.get(edge.target);
                    if (!sourceNode || !targetNode) return null;

                    // Check visibility based on entity type filters
                    if (!typeFilters[sourceNode.type] || !typeFilters[targetNode.type]) return null;

                    // Check ring filter
                    const matchesRing =
                      ringFilter === "ALL" ||
                      edge.ringId === ringFilter ||
                      sourceNode.ringId === ringFilter ||
                      targetNode.ringId === ringFilter;

                    const isConnectedToSelected = connectedEdgeIds.has(edge.id);
                    const isFaded = selectedNodeId && !isConnectedToSelected && matchesRing;

                    const strokeColor =
                      edge.riskLevel === "HIGH"
                        ? "var(--status-escalate)"
                        : edge.riskLevel === "MEDIUM"
                        ? "var(--status-challenge)"
                        : "var(--status-allow)";

                    const strokeWidth = isConnectedToSelected ? 3.5 : 1.8;

                    return (
                      <g key={edge.id} opacity={!matchesRing ? 0.08 : isFaded ? 0.25 : 1}>
                        {/* Glow line if selected */}
                        {isConnectedToSelected && (
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={strokeColor}
                            strokeWidth="8"
                            strokeOpacity="0.25"
                          />
                        )}

                        <line
                          x1={sourceNode.x}
                          y1={sourceNode.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={edge.riskLevel === "HIGH" ? "6 4" : "none"}
                        />

                        {/* Edge Label for Relationship */}
                        <text
                          x={(sourceNode.x + targetNode.x) / 2}
                          y={(sourceNode.y + targetNode.y) / 2 - 4}
                          fill="var(--muted)"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          className="select-none pointer-events-none"
                        >
                          {edge.relationship}
                        </text>
                      </g>
                    );
                  })}

                  {/* Nodes Rendering */}
                  {nodes.map((node) => {
                    if (!typeFilters[node.type]) return null;

                    const isSelected = node.id === selectedNodeId;
                    const isNeighbor = neighborNodeIds.has(node.id);
                    const matchesRing = ringFilter === "ALL" || node.ringId === ringFilter;
                    const isFaded = selectedNodeId && !isSelected && !isNeighbor && matchesRing;

                    const colors = getNodeColors(node);
                    const radius = node.type === "device" ? 28 : node.type === "bank" ? 26 : 24;

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                          setDraggedNodeId(node.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                        }}
                        opacity={!matchesRing ? 0.1 : isFaded ? 0.35 : 1}
                        className="cursor-pointer transition-transform duration-100"
                      >
                        {/* Selected Ring Pulse Circle */}
                        {isSelected && (
                          <circle
                            r={radius + 8}
                            fill="none"
                            stroke={colors.stroke}
                            strokeWidth="2"
                            strokeDasharray="4 3"
                            className="animate-spin"
                            style={{ transformOrigin: "0 0" }}
                          />
                        )}

                        {/* Outer Node Shape */}
                        <circle
                          r={radius}
                          fill={colors.fill}
                          stroke={colors.stroke}
                          strokeWidth={isSelected ? 3.5 : 2}
                          style={{ filter: colors.glow }}
                        />

                        {/* Entity Icon Container */}
                        <foreignObject
                          x={-14}
                          y={-14}
                          width={28}
                          height={28}
                          className="pointer-events-none"
                        >
                          <div className={`w-full h-full flex items-center justify-center ${colors.iconColor}`}>
                            {getNodeIcon(node.type)}
                          </div>
                        </foreignObject>

                        {/* Node Identifier Label (Below Node) */}
                        <text
                          y={radius + 14}
                          textAnchor="middle"
                          fill="var(--ink)"
                          fontSize="10"
                          fontWeight="800"
                          className="select-none pointer-events-none"
                        >
                          {node.label}
                        </text>

                        {/* Risk Tag Badge (Above Node) */}
                        <g transform={`translate(0, ${-radius - 8})`}>
                          <rect
                            x="-18"
                            y="-8"
                            width="36"
                            height="14"
                            rx="7"
                            fill={
                              node.riskScore > 70
                                ? "var(--status-escalate)"
                                : node.riskScore > 40
                                ? "var(--status-challenge)"
                                : "var(--status-allow)"
                            }
                          />
                          <text
                            x="0"
                            y="2.5"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="9"
                            fontWeight="900"
                            fontFamily="monospace"
                            className="select-none pointer-events-none"
                          >
                            {node.riskScore}%
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* Right Column: Node Inspector & Topology Dossier */}
            {selectedNode && (
              <div className="lg:col-span-4 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
                <div>
                  {/* Header with Type & Status */}
                  <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)]">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            selectedNode.type === "rider"
                              ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                              : selectedNode.type === "device"
                              ? "bg-indigo-500/10 text-indigo-700"
                              : "bg-emerald-500/10 text-emerald-700"
                          }`}
                        >
                          {getNodeIcon(selectedNode.type)}
                          <span>{selectedNode.type.toUpperCase()} NODE</span>
                        </span>

                        <span className="text-[10px] font-mono text-[var(--muted)]">
                          {selectedNode.label}
                        </span>
                      </div>

                      <h3 className="text-xl font-extrabold text-[var(--ink)] leading-snug">
                        {selectedNode.name}
                      </h3>
                    </div>

                    <div className="text-right">
                      <div
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold ${
                          selectedNode.riskScore > 70
                            ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                            : selectedNode.riskScore > 40
                            ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                            : "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                        }`}
                      >
                        Risk: {selectedNode.riskScore}%
                      </div>
                    </div>
                  </div>

                  {/* Collusion Ring Membership Alert */}
                  {selectedNode.ringName && (
                    <div
                      className={`mt-4 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        selectedNode.ringId === "RING-C-902"
                          ? "bg-[var(--status-escalate)]/10 border-[var(--status-escalate)]/25 text-[var(--ink)]"
                          : selectedNode.ringId === "RING-B-410"
                          ? "bg-[var(--status-challenge)]/10 border-[var(--status-challenge)]/25 text-[var(--ink)]"
                          : "bg-[var(--status-allow)]/10 border-[var(--status-allow)]/25 text-[var(--ink)]"
                      }`}
                    >
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          selectedNode.ringId === "RING-C-902"
                            ? "text-[var(--status-escalate)]"
                            : selectedNode.ringId === "RING-B-410"
                            ? "text-[var(--status-challenge)]"
                            : "text-[var(--status-allow)]"
                        }`}
                      />
                      <div>
                        <strong className="block text-[11px] font-bold">
                          {selectedNode.ringName}
                        </strong>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5">
                          {selectedNode.ringId === "RING-C-902"
                            ? "Part of a high-density syndicate sharing rooted handsets and Chase routing numbers."
                            : selectedNode.ringId === "RING-B-410"
                            ? "Synchronized courier cluster operating across overlapping delivery windows."
                            : "Clean entity profile with zero fraudulent graph ties."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Direct Neighbor Connections */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                      <span>Linked Graph Neighbors ({neighborNodeIds.size})</span>
                      <span className="text-[10px] text-[var(--muted)] font-mono">Bipartite Edges</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {Array.from(neighborNodeIds).map((neighborId) => {
                        const neighbor = nodeMap.get(neighborId);
                        if (!neighbor) return null;
                        return (
                          <button
                            key={neighbor.id}
                            onClick={() => handleFocusNode(neighbor.id)}
                            className="w-full text-left p-2.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] flex items-center justify-between group transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-[var(--surface)] text-[var(--primary)] flex items-center justify-center text-xs">
                                {getNodeIcon(neighbor.type)}
                              </div>
                              <div>
                                <div className="font-bold text-xs text-[var(--ink)]">{neighbor.name}</div>
                                <div className="text-[10px] font-mono text-[var(--muted)]">
                                  {neighbor.label} • {neighbor.type}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                              <span>Focus</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Metadata Details Grid */}
                  <div className="mt-4 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-2 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Entity Metadata
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      {Object.entries(selectedNode.metadata).map(([key, val]) => (
                        <div key={key}>
                          <span className="block text-[10px] text-[var(--muted)]/70 uppercase">
                            {key.replace(/([A-Z])/g, " $1")}
                          </span>
                          <strong className="text-[var(--ink)]">{val}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                  <span className="text-[10px] text-[var(--muted)]">
                    Node ID: <code className="font-mono text-[var(--ink)]">{selectedNode.id}</code>
                  </span>

                  <button
                    onClick={() => handleFocusNode(selectedNode.id)}
                    className="px-4 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-plum transition-all flex items-center gap-1.5"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Center on Node</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: Collusion Syndicates Deep Dive */}
      {activeTab === "syndicates" && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Syndicate #C-902 Card */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border-2 border-[var(--status-escalate)]/30 shadow-soft space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--status-escalate)]/15 text-[var(--status-escalate)] mb-2">
                    <Flame className="w-3.5 h-3.5" />
                    Active High-Risk Syndicate
                  </span>
                  <h3 className="text-xl font-extrabold text-[var(--ink)]">
                    Ring #C-902: Downtown Farm Syndicate
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Multi-courier account sharing clustered around a single Magisk-rooted Xiaomi device and Chase bank account.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-extrabold text-[var(--status-escalate)]">
                    95%
                  </span>
                  <span className="block text-[10px] text-[var(--muted)] font-bold">Ring Risk</span>
                </div>
              </div>

              {/* Stats Metrics */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-center">
                <div>
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-bold">Couriers</span>
                  <span className="text-base font-extrabold text-[var(--ink)]">3 Riders</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-bold">Held Payouts</span>
                  <span className="text-base font-extrabold text-[var(--status-escalate)]">$1,240.00</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-bold">Shared HW</span>
                  <span className="text-base font-extrabold text-[var(--ink)]">1 Phone</span>
                </div>
              </div>

              {/* Linked Members */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider block">
                  Identified Entity Nodes:
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {nodes
                    .filter((n) => n.ringId === "RING-C-902")
                    .map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[var(--surface)] text-[var(--status-escalate)] flex items-center justify-center text-xs">
                            {getNodeIcon(n.type)}
                          </div>
                          <div>
                            <span className="font-bold text-[var(--ink)]">{n.name}</span>
                            <span className="text-[10px] text-[var(--muted)] font-mono ml-2">({n.label})</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-[var(--status-escalate)]">
                          {n.riskScore}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end">
                <button
                  onClick={() => {
                    setActiveTab("topology");
                    setRingFilter("RING-C-902");
                    handleFocusNode("d_redmi_farm");
                  }}
                  className="px-4 py-2 rounded-full bg-[var(--status-escalate)] hover:opacity-90 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Spotlight in 2D Graph</span>
                </button>
              </div>
            </div>

            {/* Syndicate #B-410 Card */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border-2 border-[var(--status-challenge)]/30 shadow-soft space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--status-challenge)]/15 text-[var(--status-challenge)] mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Colocation Cluster
                  </span>
                  <h3 className="text-xl font-extrabold text-[var(--ink)]">
                    Ring #B-410: Airport Colocation
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Synchronized courier movement and shared delivery shift accounts along the Airport terminal highway corridor.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-extrabold text-[var(--status-challenge)]">
                    72%
                  </span>
                  <span className="block text-[10px] text-[var(--muted)] font-bold">Ring Risk</span>
                </div>
              </div>

              {/* Stats Metrics */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-center">
                <div>
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-bold">Couriers</span>
                  <span className="text-base font-extrabold text-[var(--ink)]">2 Riders</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-bold">Held Payouts</span>
                  <span className="text-base font-extrabold text-[var(--status-challenge)]">$480.50</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-bold">Shared HW</span>
                  <span className="text-base font-extrabold text-[var(--ink)]">1 Pixel 8</span>
                </div>
              </div>

              {/* Linked Members */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider block">
                  Identified Entity Nodes:
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {nodes
                    .filter((n) => n.ringId === "RING-B-410")
                    .map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[var(--surface)] text-[var(--status-challenge)] flex items-center justify-center text-xs">
                            {getNodeIcon(n.type)}
                          </div>
                          <div>
                            <span className="font-bold text-[var(--ink)]">{n.name}</span>
                            <span className="text-[10px] text-[var(--muted)] font-mono ml-2">({n.label})</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-[var(--status-challenge)]">
                          {n.riskScore}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end">
                <button
                  onClick={() => {
                    setActiveTab("topology");
                    setRingFilter("RING-B-410");
                    handleFocusNode("d_pixel_shared");
                  }}
                  className="px-4 py-2 rounded-full bg-[var(--status-challenge)] hover:opacity-90 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Spotlight in 2D Graph</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: Bipartite Link Registry Table */}
      {activeTab === "matrix" && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[var(--ink)]">
                Bipartite Link Registry ({edges.length} Graph Ties)
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Exhaustive listing of all validated connections, hardware bindings, and bank routes.
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--muted)]">
              Updated live with continuous sensor telemetry
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-alt)] text-[var(--muted)] uppercase text-[10px] font-bold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="py-3 px-4">Edge ID</th>
                  <th className="py-3 px-4">Source Entity</th>
                  <th className="py-3 px-4">Relationship</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Detection Trigger</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {edges.map((edge) => {
                  const source = nodeMap.get(edge.source);
                  const target = nodeMap.get(edge.target);
                  return (
                    <tr key={edge.id} className="hover:bg-[var(--surface-alt)] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[var(--primary)]">
                        {edge.id.toUpperCase()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--ink)]">{source?.name || edge.source}</div>
                        <div className="text-[10px] text-[var(--muted)] font-mono">{source?.label}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--ink)]">
                          {edge.relationship}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--ink)]">{target?.name || edge.target}</div>
                        <div className="text-[10px] text-[var(--muted)] font-mono">{target?.label}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            edge.riskLevel === "HIGH"
                              ? "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                              : edge.riskLevel === "MEDIUM"
                              ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                              : "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          }`}
                        >
                          {edge.riskLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--muted)] max-w-xs truncate">
                        {edge.ruleDescription}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setActiveTab("topology");
                            handleFocusNode(edge.source);
                          }}
                          className="px-3 py-1 rounded-full bg-[var(--surface)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] text-[var(--primary)] font-bold text-[11px] transition-all inline-flex items-center gap-1"
                        >
                          <span>Focus</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
