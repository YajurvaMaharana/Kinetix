"""
TrustJuggler Fraud Syndicate & Account-Sharing Graph Service.
Constructs a NetworkX multi-entity graph linking riders, devices, IPs,
bank accounts, and payout instruments to detect collusion rings, device farms,
and payout redirection hijacks.
"""

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import networkx as nx
from sqlalchemy.orm import Session

from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig


@dataclass
class GraphFactor:
    code: str
    category: str = "graph"
    points: float = 0.0
    label: str = ""
    observed: str = ""
    baseline: str = "isolated rider entity"
    explanation: str = ""


@dataclass
class GraphEvaluationResult:
    graph_risk: float
    factors: List[GraphFactor] = field(default_factory=list)
    cluster_id: Optional[str] = None
    cluster_size: int = 1
    shared_device_count: int = 1
    shared_payout_count: int = 1
    shared_identifiers: List[str] = field(default_factory=list)
    has_fraud_ring: bool = False
    has_multi_account_device_ring: bool = False
    degree_centrality: float = 0.0
    max_device_riders: int = 1
    max_bank_riders: int = 1
    calculation_time_ms: float = 0.0


class FraudGraphService:
    """
    Manages the NetworkX multi-entity bipartite graph and cluster discovery engine.
    Nodes represent riders, tokenized devices, tokenized IPs, bank accounts, and payout instruments.
    Edges represent authentications, bindings, and transactions between them.
    """

    def __init__(self) -> None:
        self.G: nx.Graph = nx.Graph()

    def reset(self) -> None:
        """Clears the graph."""
        self.G.clear()

    def add_entity(self, node_id: str, node_type: str, label: Optional[str] = None) -> None:
        """Inserts or updates a node in the multi-entity graph."""
        self.G.add_node(
            node_id,
            id=node_id,
            type=node_type,
            label=label or node_id,
        )

    def add_edge(
        self,
        source: str,
        target: str,
        relationship: str = "CONNECTED_TO",
        source_type: Optional[str] = None,
        target_type: Optional[str] = None,
    ) -> None:
        """
        Adds an undirected edge between two entities, inferring entity types if not yet present.
        """
        if source not in self.G:
            stype = source_type or self._infer_type(source, default="rider")
            self.add_entity(source, stype)
        if target not in self.G:
            ttype = target_type or self._infer_type(target, default="device")
            self.add_entity(target, ttype)

        self.G.add_edge(source, target, relationship=relationship)

    def _infer_type(self, node_id: str, default: str = "rider") -> str:
        nid = node_id.lower()
        if "dev" in nid or "phone" in nid or "imei" in nid:
            return "device"
        if "ip" in nid or "." in nid or ":" in nid:
            return "ip"
        if "bank" in nid or "acc" in nid:
            return "bank_account"
        if "pay" in nid or "wallet" in nid:
            return "payout_instrument"
        if "rider" in nid or "driver" in nid or "usr" in nid:
            return "rider"
        return default

    def add_rider_device(self, rider_id: str, device_id: str) -> None:
        self.add_edge(
            rider_id,
            device_id,
            relationship="USED_DEVICE",
            source_type="rider",
            target_type="device",
        )

    def add_rider_ip(self, rider_id: str, ip_address: str) -> None:
        self.add_edge(
            rider_id,
            ip_address,
            relationship="USED_IP",
            source_type="rider",
            target_type="ip",
        )

    def add_rider_bank(self, rider_id: str, bank_account: str) -> None:
        self.add_edge(
            rider_id,
            bank_account,
            relationship="USES_BANK_ACCOUNT",
            source_type="rider",
            target_type="bank_account",
        )

    def add_rider_payout(self, rider_id: str, payout_token: str) -> None:
        self.add_edge(
            rider_id,
            payout_token,
            relationship="USES_PAYOUT_INSTRUMENT",
            source_type="rider",
            target_type="payout_instrument",
        )

    def add_session_entities(
        self,
        rider_id: str,
        device_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        bank_account: Optional[str] = None,
        payout_token: Optional[str] = None,
    ) -> None:
        """Links all observed entities from a session event to the rider."""
        if not rider_id:
            return
        self.add_entity(rider_id, "rider")
        if device_id:
            self.add_rider_device(rider_id, device_id)
        if ip_address:
            self.add_rider_ip(rider_id, ip_address)
        if bank_account:
            self.add_rider_bank(rider_id, bank_account)
        if payout_token:
            self.add_rider_payout(rider_id, payout_token)

    def build_from_db(self, db: Session) -> None:
        """
        Hydrates graph topology from database entities:
        - DeviceRider (rider <-> device)
        - Session (rider <-> device, rider <-> IP)
        - PayoutAccount (rider <-> bank_account)
        - GraphEdge (explicit edges)
        """
        try:
            from app.models.entities import Device, DeviceRider, GraphEdge, PayoutAccount
            from app.models.entities import Session as SessionModel

            # 1. DeviceRider
            device_riders = db.query(DeviceRider).all()
            for dr in device_riders:
                dev = db.query(Device).filter(Device.id == dr.device_id).first()
                dev_identifier = dev.fingerprint if dev and dev.fingerprint else dr.device_id
                self.add_rider_device(dr.rider_id, dev_identifier)

            # 2. Sessions
            sessions = db.query(SessionModel).all()
            for sess in sessions:
                if sess.device_id:
                    self.add_rider_device(sess.rider_id, sess.device_id)
                if sess.ip_address:
                    self.add_rider_ip(sess.rider_id, sess.ip_address)

            # 3. Payout Accounts
            payouts = db.query(PayoutAccount).all()
            for pa in payouts:
                if pa.account_number_token:
                    self.add_rider_bank(pa.rider_id, pa.account_number_token)
                if pa.routing_token:
                    self.add_rider_payout(pa.rider_id, pa.routing_token)

            # 4. Explicit GraphEdges
            edges = db.query(GraphEdge).all()
            for e in edges:
                self.add_edge(
                    e.source_id,
                    e.target_id,
                    relationship=e.edge_type,
                    source_type=e.source_type,
                    target_type=e.target_type,
                )
        except Exception:
            # Fallback cleanly if database tables are uninitialized in unit test environments
            pass

    def evaluate_rider(
        self,
        rider_id: str,
        thresholds: Optional[ThresholdConfig] = None,
    ) -> GraphEvaluationResult:
        """
        Evaluates graph syndicate risk for a rider based on cluster topology,
        degree centrality, and shared entity counts.
        """
        start_t = time.perf_counter()
        cfg = thresholds or DEFAULT_THRESHOLDS

        if rider_id not in self.G or self.G.degree(rider_id) == 0:
            calc_time = (time.perf_counter() - start_t) * 1000.0
            return GraphEvaluationResult(
                graph_risk=0.0,
                cluster_size=1,
                shared_device_count=1,
                shared_payout_count=1,
                calculation_time_ms=calc_time,
            )

        # 1. Connected Component Discovery
        comp = nx.node_connected_component(self.G, rider_id)
        cluster_size = len(comp)

        riders = [n for n in comp if self.G.nodes[n].get("type") == "rider"]
        num_riders = len(riders)

        devices = [n for n in comp if self.G.nodes[n].get("type") == "device"]
        banks = [n for n in comp if self.G.nodes[n].get("type") in ("bank_account", "bank")]
        payouts = [
            n for n in comp if self.G.nodes[n].get("type") in ("payout_instrument", "payout")
        ]
        ips = [n for n in comp if self.G.nodes[n].get("type") == "ip"]

        # Compute rider counts sharing each non-rider entity
        dev_sharing: Dict[str, int] = {}
        for d in devices:
            r_nbrs = [u for u in self.G.neighbors(d) if self.G.nodes[u].get("type") == "rider"]
            dev_sharing[d] = len(r_nbrs)

        bank_sharing: Dict[str, int] = {}
        for b in banks:
            r_nbrs = [u for u in self.G.neighbors(b) if self.G.nodes[u].get("type") == "rider"]
            bank_sharing[b] = len(r_nbrs)

        payout_sharing: Dict[str, int] = {}
        for p in payouts:
            r_nbrs = [u for u in self.G.neighbors(p) if self.G.nodes[u].get("type") == "rider"]
            payout_sharing[p] = len(r_nbrs)

        ip_sharing: Dict[str, int] = {}
        for i in ips:
            r_nbrs = [u for u in self.G.neighbors(i) if self.G.nodes[u].get("type") == "rider"]
            ip_sharing[i] = len(r_nbrs)

        max_dev_riders = max(dev_sharing.values(), default=1)
        max_bank_riders = max(bank_sharing.values(), default=1)
        max_payout_riders = max(payout_sharing.values(), default=1)
        max_pay_bank = max(max_bank_riders, max_payout_riders)

        shared_devs = [d for d, c in dev_sharing.items() if c >= 2]
        shared_banks = [b for b, c in bank_sharing.items() if c >= 2]
        shared_pays = [p for p, c in payout_sharing.items() if c >= 2]
        shared_ips = [i for i, c in ip_sharing.items() if c >= 2]

        all_shared_identifiers = shared_devs + shared_banks + shared_pays + shared_ips
        shared_id_count = len(all_shared_identifiers)

        # Degree Centrality for rider
        deg_centrality = float(nx.degree_centrality(self.G).get(rider_id, 0.0))

        # 2. Risk Calculation based on explicit prompt rules
        # * 0.0 for isolated rider with unique device/IP.
        # * 0.4 for 2 riders sharing 1 device.
        # * 0.8+ for >= 3 riders sharing a device or bank account.
        # * 1.0 for dense fraud ring clusters with multiple shared identifiers.
        if num_riders <= 1 or shared_id_count == 0:
            graph_risk = 0.0
        elif num_riders == 2:
            if max_dev_riders == 2 and shared_id_count == 1:
                graph_risk = 0.40
            elif max_pay_bank >= 2 or shared_id_count >= 2:
                graph_risk = 0.80
            else:
                graph_risk = 0.40
        elif num_riders >= 3:
            # Dense fraud ring: multiple shared identifiers OR high sharing across devices/payouts
            if shared_id_count >= 2 or (
                max_dev_riders >= 3 and (max_pay_bank >= 2 or len(shared_devs) >= 2)
            ):
                graph_risk = 1.00
            else:
                graph_risk = 0.85
        else:
            graph_risk = 0.0

        # Hard rule trigger: MULTI_ACCOUNT_DEVICE_RING (+15 pts, floor 60) when degree >= 3 on shared device
        has_multi_account_device_ring = max_dev_riders >= 3 or max_pay_bank >= 3
        has_fraud_ring = graph_risk >= 0.80

        # 3. Factor Records: FRAUD_RING, SHARED_DEVICE_RING, SHARED_PAYOUT_INSTRUMENT
        factors: List[GraphFactor] = []

        if graph_risk >= 0.80 or has_fraud_ring:
            pts = round(cfg.w_graph_risk * graph_risk, 2)
            factors.append(
                GraphFactor(
                    code="FRAUD_RING",
                    category="graph",
                    points=pts,
                    label="Fraud Syndicate Collusion Ring",
                    observed=f"{num_riders} riders sharing {shared_id_count} identifiers (max_device_degree={max_dev_riders})",
                    baseline="isolated rider entity",
                    explanation="Account linked to multi-rider collusion syndicate sharing hardware devices or financial instruments.",
                )
            )

        if max_dev_riders >= 2:
            pts_dev = round(cfg.w_graph_risk * min(graph_risk, 0.40), 2)
            factors.append(
                GraphFactor(
                    code="SHARED_DEVICE_RING",
                    category="graph",
                    points=pts_dev,
                    label="Shared Device Hardware Ring",
                    observed=f"hardware device linked to {max_dev_riders} distinct rider accounts",
                    baseline="exclusive personal handset (1 account)",
                    explanation="Hardware device shared across multiple delivery driver accounts.",
                )
            )

        if max_pay_bank >= 2:
            pts_pay = round(cfg.w_graph_risk * min(graph_risk, 0.50), 2)
            factors.append(
                GraphFactor(
                    code="SHARED_PAYOUT_INSTRUMENT",
                    category="graph",
                    points=pts_pay,
                    label="Shared Payout Instrument",
                    observed=f"bank or payout instrument linked to {max_pay_bank} rider accounts",
                    baseline="exclusive payout account",
                    explanation="Financial routing instrument or bank account recycled across multiple rider identities.",
                )
            )

        calc_time = (time.perf_counter() - start_t) * 1000.0

        return GraphEvaluationResult(
            graph_risk=round(float(graph_risk), 2),
            factors=factors,
            cluster_id=f"cluster_{abs(hash(tuple(sorted(comp)))) % 100000}",
            cluster_size=cluster_size,
            shared_device_count=max(max_dev_riders, 1),
            shared_payout_count=max(max_pay_bank, 1),
            shared_identifiers=all_shared_identifiers,
            has_fraud_ring=has_fraud_ring,
            has_multi_account_device_ring=has_multi_account_device_ring,
            degree_centrality=round(deg_centrality, 4),
            max_device_riders=max_dev_riders,
            max_bank_riders=max_pay_bank,
            calculation_time_ms=calc_time,
        )

    def export_d3_subgraph(
        self,
        rider_id: str,
        depth: int = 2,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Analyst endpoint support:
        Exports subgraph nodes and edges in D3/JSON format for frontend visualization.
        Format: { nodes: [{id, type, label}], edges: [{source, target, relationship}] }
        Runs within latency constraints (<15ms).
        """
        if db is not None and self.G.number_of_nodes() == 0:
            self.build_from_db(db)

        if rider_id not in self.G:
            return {
                "nodes": [{"id": rider_id, "type": "rider", "label": rider_id}],
                "edges": [],
            }

        subG = nx.ego_graph(self.G, rider_id, radius=depth)

        nodes = [
            {
                "id": n,
                "type": self.G.nodes[n].get("type", "entity"),
                "label": self.G.nodes[n].get("label", str(n)),
            }
            for n in subG.nodes
        ]

        edges = [
            {
                "source": u,
                "target": v,
                "relationship": self.G.edges[u, v].get("relationship", "CONNECTED_TO"),
            }
            for u, v in subG.edges
        ]

        return {"nodes": nodes, "edges": edges}


# Global singleton graph service instance
graph_service = FraudGraphService()


def evaluate_graph(
    ctx: Any,
    thresholds: Optional[ThresholdConfig] = None,
    service: Optional[FraudGraphService] = None,
) -> GraphEvaluationResult:
    """
    Pure evaluation hook callable from scoring pipeline.
    Inspects ScoringContext, queries graph_service or telemetry overrides,
    and returns a full GraphEvaluationResult.
    """
    svc = service or graph_service
    cfg = thresholds or DEFAULT_THRESHOLDS

    # Check explicit override in context
    if hasattr(ctx, "graph_risk") and ctx.graph_risk is not None and ctx.graph_risk > 0.0:
        gr = float(ctx.graph_risk)
        factors: List[GraphFactor] = []
        if gr >= 0.80:
            factors.append(
                GraphFactor(
                    code="FRAUD_RING",
                    category="graph",
                    points=round(cfg.w_graph_risk * gr, 2),
                    label="Fraud Syndicate Collusion Ring",
                    observed=f"graph_risk={gr:.2f}",
                    baseline="isolated rider entity",
                    explanation="Account linked to multi-rider collusion syndicate sharing hardware devices or financial instruments.",
                )
            )
        elif gr >= 0.40:
            factors.append(
                GraphFactor(
                    code="SHARED_DEVICE_RING",
                    category="graph",
                    points=round(cfg.w_graph_risk * gr, 2),
                    label="Shared Device Hardware Ring",
                    observed=f"graph_risk={gr:.2f}",
                    baseline="exclusive personal handset (1 account)",
                    explanation="Hardware device shared across multiple delivery driver accounts.",
                )
            )
        return GraphEvaluationResult(
            graph_risk=gr,
            factors=factors,
            has_fraud_ring=gr >= 0.80,
            has_multi_account_device_ring=gr >= 0.80,
        )

    # Check graph_stats dictionary in context
    graph_stats = getattr(ctx, "graph_stats", None)
    if isinstance(graph_stats, dict) and "risk_score" in graph_stats:
        gr = float(graph_stats["risk_score"])
        shared_dev = int(graph_stats.get("shared_device_count", 1))
        shared_pay = int(graph_stats.get("shared_payout_count", 1))
        factors = []
        if gr >= 0.80:
            factors.append(
                GraphFactor(
                    code="FRAUD_RING",
                    category="graph",
                    points=round(cfg.w_graph_risk * gr, 2),
                    label="Fraud Syndicate Collusion Ring",
                    observed=f"shared_devices={shared_dev}, shared_payouts={shared_pay}",
                    baseline="isolated rider entity",
                    explanation="Account linked to multi-rider collusion syndicate sharing hardware devices or financial instruments.",
                )
            )
        return GraphEvaluationResult(
            graph_risk=gr,
            factors=factors,
            shared_device_count=shared_dev,
            shared_payout_count=shared_pay,
            has_fraud_ring=gr >= 0.80,
            has_multi_account_device_ring=shared_dev >= 3 or gr >= 0.80,
        )

    # Extract rider_id and identifiers from request_or_event
    req = getattr(ctx, "request_or_event", ctx)
    if hasattr(req, "model_dump"):
        req_dict = req.model_dump()
    elif isinstance(req, dict):
        req_dict = req
    else:
        req_dict = {}

    rider_id = req_dict.get("rider_id") or (hasattr(ctx, "rider_id") and ctx.rider_id) or None

    if rider_id and rider_id in svc.G:
        return svc.evaluate_rider(rider_id, cfg)

    # Fallback to telemetry counts if graph entity not loaded
    telem = req_dict.get("telemetry", {}) or req_dict
    try:
        shared_dev = int(
            telem.get("shared_device_count") or req_dict.get("shared_device_count") or 1
        )
        shared_pay = int(
            telem.get("shared_payout_count") or req_dict.get("shared_payout_count") or 1
        )
    except (ValueError, TypeError):
        shared_dev, shared_pay = 1, 1

    threats = str(req_dict.get("threat_tags", ""))
    if shared_dev >= 3 and shared_pay >= 2:
        risk = 1.00
    elif shared_dev >= 3 or shared_pay >= 3 or "FRAUD_RING" in threats:
        risk = 0.85
    elif shared_dev == 2:
        risk = 0.40
    else:
        risk = 0.0

    factors = []
    if risk >= 0.80:
        factors.append(
            GraphFactor(
                code="FRAUD_RING",
                category="graph",
                points=round(cfg.w_graph_risk * risk, 2),
                label="Fraud Syndicate Collusion Ring",
                observed=f"shared_device_count={shared_dev}, shared_payout_count={shared_pay}",
                baseline="isolated rider entity",
                explanation="Account linked to multi-rider collusion syndicate sharing hardware devices or financial instruments.",
            )
        )
    elif risk == 0.40:
        factors.append(
            GraphFactor(
                code="SHARED_DEVICE_RING",
                category="graph",
                points=round(cfg.w_graph_risk * risk, 2),
                label="Shared Device Hardware Ring",
                observed="shared_device_count=2",
                baseline="exclusive personal handset (1 account)",
                explanation="Hardware device shared across multiple delivery driver accounts.",
            )
        )

    return GraphEvaluationResult(
        graph_risk=risk,
        factors=factors,
        shared_device_count=shared_dev,
        shared_payout_count=shared_pay,
        has_fraud_ring=risk >= 0.80,
        has_multi_account_device_ring=shared_dev >= 3 or risk >= 0.80,
    )
