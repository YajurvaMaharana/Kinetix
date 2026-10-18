import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getPolicies,
  simulatePolicy,
  savePolicyDraft,
  deployPolicy,
  rollbackPolicy,
  PolicyRuleConfig,
  PolicyVersion,
  PolicySimulationComparison,
  DEFAULT_ACTIVE_POLICY_CONFIG,
} from "@/api/endpoints";
import {
  Scale,
  Sliders,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Play,
  Save,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  History,
  Lock,
  ArrowRight,
  Clock,
  Gauge,
  ScanFace,
  Banknote,
  Cpu,
  RefreshCw,
  GitFork,
  CheckSquare,
  Square,
} from "lucide-react";

export default function PoliciesPage() {
  const { user, role, canDeployPolicies, isReadOnly } = useAuth();
  const { showToast } = useToast();

  // Active Policy Configuration in Editor
  const [editorConfig, setEditorConfig] = useState<PolicyRuleConfig>({
    ...DEFAULT_ACTIVE_POLICY_CONFIG,
  });

  // Current Active Policy in Production (for diff and rollback)
  const [currentActiveConfig, setCurrentActiveConfig] = useState<PolicyRuleConfig>({
    ...DEFAULT_ACTIVE_POLICY_CONFIG,
  });

  // Version History State
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [activeVersionTag, setActiveVersionTag] = useState("v2.4.2");

  // Simulation State
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<PolicySimulationComparison | null>(null);

  // Deploy Confirmation Modal State
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployNote, setDeployNote] = useState("");
  const [deploying, setDeploying] = useState(false);

  // Draft Save Modal State
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  // Rollback Action State
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  // Initial Load: Fetch active policies, history, and run initial simulation
  useEffect(() => {
    async function loadInitialData() {
      try {
        const policyData = await getPolicies();
        if (policyData.current_config) {
          setCurrentActiveConfig(policyData.current_config);
          setEditorConfig(policyData.current_config);
        }
        if (policyData.versions && policyData.versions.length > 0) {
          setVersions(policyData.versions);
          const activeVer = policyData.versions.find((v) => v.status === "ACTIVE");
          if (activeVer) {
            setActiveVersionTag(activeVer.version_tag);
          }
        }
        // Run initial simulation
        const initialSim = await simulatePolicy(policyData.current_config || DEFAULT_ACTIVE_POLICY_CONFIG);
        setSimResult(initialSim);
      } catch (err: any) {
        console.error("Failed to load policy data", err);
      }
    }
    loadInitialData();
  }, []);

  // Handle Simulation execution
  const handleRunSimulation = async (configToSimulate?: PolicyRuleConfig) => {
    const targetConfig = configToSimulate || editorConfig;
    setSimulating(true);
    try {
      const res = await simulatePolicy(targetConfig);
      setSimResult(res);
      showToast({
        type: "info",
        title: "Simulation Completed",
        message: `Evaluated ${res.sessions_evaluated.toLocaleString()} historical courier sessions against proposed cut-lines.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Simulation Failed",
        message: err.message || "Failed to execute simulation.",
      });
    } finally {
      setSimulating(false);
    }
  };

  // Presets
  const applyPreset = (presetName: string) => {
    let preset: PolicyRuleConfig;
    if (presetName === "balanced") {
      preset = { ...DEFAULT_ACTIVE_POLICY_CONFIG };
    } else if (presetName === "containment") {
      preset = {
        challenge_threshold: 58,
        escalate_threshold: 32,
        allow_threshold: 80,
        max_velocity_kmh: 100,
        min_face_match: 0.90,
        hold_window_hours: 48,
        rules: {
          velocity_rule_active: true,
          face_match_rule_active: true,
          hold_window_active: true,
          emulator_block_active: true,
          device_collision_active: true,
        },
      };
    } else if (presetName === "frictionless") {
      preset = {
        challenge_threshold: 42,
        escalate_threshold: 18,
        allow_threshold: 68,
        max_velocity_kmh: 140,
        min_face_match: 0.80,
        hold_window_hours: 12,
        rules: {
          velocity_rule_active: true,
          face_match_rule_active: true,
          hold_window_active: false,
          emulator_block_active: true,
          device_collision_active: false,
        },
      };
    } else {
      preset = { ...currentActiveConfig };
    }

    setEditorConfig(preset);
    handleRunSimulation(preset);
    showToast({
      type: "info",
      title: "Preset Applied",
      message: `Loaded ${presetName.toUpperCase()} configuration into the simulator editor.`,
    });
  };

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (!draftName.trim()) {
      showToast({
        type: "warning",
        title: "Name Required",
        message: "Please enter a label for this policy draft.",
      });
      return;
    }
    setSavingDraft(true);
    try {
      const saved = await savePolicyDraft(editorConfig, draftName.trim());
      setVersions((prev) => [saved, ...prev]);
      setDraftModalOpen(false);
      setDraftName("");
      showToast({
        type: "success",
        title: "Draft Saved",
        message: `Policy draft "${saved.name}" stored in version history.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Draft Save Failed",
        message: err.message,
      });
    } finally {
      setSavingDraft(false);
    }
  };

  // Handle Deploy Policy
  const handleConfirmDeploy = async () => {
    if (!canDeployPolicies || isReadOnly) {
      showToast({
        type: "warning",
        title: "Permission Denied",
        message: "Admin role required to deploy policies to edge routers.",
      });
      return;
    }

    setDeploying(true);
    try {
      const deployed = await deployPolicy(
        editorConfig,
        deployNote.trim() || undefined,
        user?.name ? `${user.name} (Admin)` : "Admin"
      );
      setCurrentActiveConfig({ ...editorConfig });
      setActiveVersionTag(deployed.version_tag);
      setDeployModalOpen(false);
      setDeployNote("");

      // Update versions list
      setVersions((prev) => [
        deployed,
        ...prev.map((v) => (v.status === "ACTIVE" ? { ...v, status: "ARCHIVED" as const } : v)),
      ]);

      // Re-run simulation against newly deployed baseline
      handleRunSimulation(editorConfig);

      showToast({
        type: "success",
        title: "Policy Deployed to Edge Routers",
        message: `Version ${deployed.version_tag} is now LIVE. Thresholds pushed across all fleet regions.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Deployment Failed",
        message: err.message,
      });
    } finally {
      setDeploying(false);
    }
  };

  // Handle Rollback
  const handleRollback = async (version: PolicyVersion) => {
    if (!canDeployPolicies || isReadOnly) {
      // If not Admin, load into editor so they can inspect/simulate
      setEditorConfig({ ...version.config });
      handleRunSimulation(version.config);
      showToast({
        type: "info",
        title: "Loaded Into Editor",
        message: `Configuration from ${version.version_tag} loaded. (Rollback requires Admin role).`,
      });
      return;
    }

    setRollingBackId(version.id);
    try {
      const rolled = await rollbackPolicy(version.id, user?.name ? `${user.name} (Admin)` : "Admin");
      setCurrentActiveConfig({ ...version.config });
      setEditorConfig({ ...version.config });
      setActiveVersionTag(rolled.version_tag);

      // Refresh version list
      setVersions((prev) => [
        rolled,
        ...prev.map((v) => (v.status === "ACTIVE" ? { ...v, status: "ARCHIVED" as const } : v)),
      ]);

      handleRunSimulation(version.config);

      showToast({
        type: "success",
        title: "Policy Rolled Back",
        message: `Successfully rolled back active fleet policy to ${version.version_tag} (${version.name}).`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Rollback Failed",
        message: err.message,
      });
    } finally {
      setRollingBackId(null);
    }
  };

  // Helper to test if a parameter has changed between current and editor
  const hasParamDiff = (key: keyof PolicyRuleConfig) => {
    return currentActiveConfig[key] !== editorConfig[key];
  };

  const hasRuleDiff = (ruleKey: keyof PolicyRuleConfig["rules"]) => {
    return currentActiveConfig.rules[ruleKey] !== editorConfig.rules[ruleKey];
  };

  const totalDiffCount =
    (hasParamDiff("challenge_threshold") ? 1 : 0) +
    (hasParamDiff("escalate_threshold") ? 1 : 0) +
    (hasParamDiff("max_velocity_kmh") ? 1 : 0) +
    (hasParamDiff("min_face_match") ? 1 : 0) +
    (hasParamDiff("hold_window_hours") ? 1 : 0) +
    (hasRuleDiff("velocity_rule_active") ? 1 : 0) +
    (hasRuleDiff("face_match_rule_active") ? 1 : 0) +
    (hasRuleDiff("hold_window_active") ? 1 : 0) +
    (hasRuleDiff("emulator_block_active") ? 1 : 0) +
    (hasRuleDiff("device_collision_active") ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        badge="Autonomous Governance"
        title="Policy Cut-Line Matrix & Simulator"
        subtitle="Calibrate risk boundaries, evaluate customer friction vs fraud catch rate, and deploy edge rule policies."
        secondaryAction={{
          label: simulating ? "Simulating..." : "Run Simulation",
          icon: simulating ? RefreshCw : Play,
          onClick: () => handleRunSimulation(),
        }}
        primaryAction={{
          label: "Deploy Policy",
          icon: Sparkles,
          onClick: () => {
            if (!canDeployPolicies || isReadOnly) {
              showToast({
                type: "warning",
                title: "Admin Role Required",
                message: "Only Administrators can deploy production policies. Use the top role switcher to change your role.",
              });
              return;
            }
            setDeployModalOpen(true);
          },
          disabled: isReadOnly,
          variant: "primary",
        }}
      />

      {/* Status Bar / Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-soft">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--ink)]">Active Production Policy:</span>
              <span className="text-xs font-mono font-extrabold text-[var(--primary)] bg-[var(--lavender)] px-2.5 py-0.5 rounded-full">
                {activeVersionTag}
              </span>
              <span className="w-2 h-2 rounded-full bg-[var(--status-allow)] animate-pulse" />
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              Current live thresholds: Challenge &lt; {currentActiveConfig.challenge_threshold} &bull; Escalate &lt; {currentActiveConfig.escalate_threshold} &bull; Velocity &gt; {currentActiveConfig.max_velocity_kmh} km/h &bull; Escrow {currentActiveConfig.hold_window_hours}h
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-[var(--muted)] mr-1">Load Preset:</span>
          <button
            onClick={() => applyPreset("balanced")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-alt)] hover:bg-[var(--lavender)] text-[var(--ink)] border border-[var(--border-subtle)] transition-colors"
          >
            Balanced
          </button>
          <button
            onClick={() => applyPreset("containment")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-alt)] hover:bg-[var(--lavender)] text-[var(--status-escalate)] border border-[var(--border-subtle)] transition-colors"
          >
            Strict Containment
          </button>
          <button
            onClick={() => applyPreset("frictionless")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-alt)] hover:bg-[var(--lavender)] text-[var(--status-allow)] border border-[var(--border-subtle)] transition-colors"
          >
            Frictionless
          </button>
          <button
            onClick={() => applyPreset("reset")}
            className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-colors"
            title="Reset to Active Policy"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 2-Panel Layout: Left (Editor) vs Right (Simulation Results) */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* LEFT PANEL: Rule Editor with Sliders and Toggles                  */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="font-extrabold text-base text-[var(--ink)]">
                Threshold &amp; Rule Editor
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {totalDiffCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--status-challenge)]/15 text-[var(--status-challenge)] border border-[var(--status-challenge)]/30">
                  {totalDiffCount} Proposed {totalDiffCount === 1 ? "Change" : "Changes"}
                </span>
              )}
              <button
                onClick={() => setDraftModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-[var(--primary)] hover:bg-[var(--lavender)] border border-[var(--primary)]/30 transition-colors"
                title="Save current parameters as draft"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
            </div>
          </div>

          {/* Section A: Sliders */}
          <div className="space-y-5">
            {/* Slider 1: Challenge Threshold */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--status-challenge)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-challenge)]" />
                  Step-Up Challenge Floor
                </span>
                <div className="flex items-center gap-2">
                  {hasParamDiff("challenge_threshold") && (
                    <span className="text-[10px] text-[var(--muted)] line-through">
                      {currentActiveConfig.challenge_threshold}
                    </span>
                  )}
                  <span className="font-mono text-sm font-extrabold text-[var(--ink)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                    &lt; {editorConfig.challenge_threshold} pts
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="25"
                max="75"
                step="1"
                value={editorConfig.challenge_threshold}
                onChange={(e) =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    challenge_threshold: Number(e.target.value),
                  }))
                }
                className="w-full accent-[var(--status-challenge)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--muted)]">
                <span>25 (Permissive)</span>
                <span>Sessions below this score trigger Face or SMS step-up</span>
                <span>75 (Strict)</span>
              </div>
            </div>

            {/* Slider 2: Escalate Threshold */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--status-escalate)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-escalate)]" />
                  SOC Escalate &amp; Case Threshold
                </span>
                <div className="flex items-center gap-2">
                  {hasParamDiff("escalate_threshold") && (
                    <span className="text-[10px] text-[var(--muted)] line-through">
                      {currentActiveConfig.escalate_threshold}
                    </span>
                  )}
                  <span className="font-mono text-sm font-extrabold text-[var(--ink)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                    &lt; {editorConfig.escalate_threshold} pts
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                step="1"
                value={editorConfig.escalate_threshold}
                onChange={(e) =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    escalate_threshold: Number(e.target.value),
                  }))
                }
                className="w-full accent-[var(--status-escalate)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--muted)]">
                <span>10 (Permissive)</span>
                <span>Scores below this open investigation and escrow lock</span>
                <span>45 (Strict)</span>
              </div>
            </div>

            {/* Slider 3: Max Velocity km/h */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--primary)]">
                  <Gauge className="w-3.5 h-3.5" />
                  Max Velocity Boundary
                </span>
                <div className="flex items-center gap-2">
                  {hasParamDiff("max_velocity_kmh") && (
                    <span className="text-[10px] text-[var(--muted)] line-through">
                      {currentActiveConfig.max_velocity_kmh} km/h
                    </span>
                  )}
                  <span className="font-mono text-sm font-extrabold text-[var(--ink)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                    {editorConfig.max_velocity_kmh} km/h
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="60"
                max="200"
                step="5"
                value={editorConfig.max_velocity_kmh}
                onChange={(e) =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    max_velocity_kmh: Number(e.target.value),
                  }))
                }
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--muted)]">
                <span>60 km/h (Dense Urban)</span>
                <span>Kinematic delta above this is penalized as GPS teleportation</span>
                <span>200 km/h (Highway)</span>
              </div>
            </div>

            {/* Slider 4: Minimum Face Match */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--accent)]">
                  <ScanFace className="w-3.5 h-3.5" />
                  Minimum Face-Match Score
                </span>
                <div className="flex items-center gap-2">
                  {hasParamDiff("min_face_match") && (
                    <span className="text-[10px] text-[var(--muted)] line-through">
                      {currentActiveConfig.min_face_match.toFixed(2)}
                    </span>
                  )}
                  <span className="font-mono text-sm font-extrabold text-[var(--ink)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                    {editorConfig.min_face_match.toFixed(2)}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0.60"
                max="0.98"
                step="0.01"
                value={editorConfig.min_face_match}
                onChange={(e) =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    min_face_match: Number(e.target.value),
                  }))
                }
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--muted)]">
                <span>0.60 (Loose)</span>
                <span>InsightFace cosine similarity required to clear biometrics</span>
                <span>0.98 (Strict)</span>
              </div>
            </div>

            {/* Slider 5: Hold Window Hours */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--ink)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />
                  Payout Hold Window
                </span>
                <div className="flex items-center gap-2">
                  {hasParamDiff("hold_window_hours") && (
                    <span className="text-[10px] text-[var(--muted)] line-through">
                      {currentActiveConfig.hold_window_hours}h
                    </span>
                  )}
                  <span className="font-mono text-sm font-extrabold text-[var(--ink)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                    {editorConfig.hold_window_hours} Hours
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="6"
                max="72"
                step="6"
                value={editorConfig.hold_window_hours}
                onChange={(e) =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    hold_window_hours: Number(e.target.value),
                  }))
                }
                className="w-full accent-[var(--ink)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--muted)]">
                <span>6 Hours</span>
                <span>Quarantine duration for banking changes or high-risk flags</span>
                <span>72 Hours</span>
              </div>
            </div>
          </div>

          {/* Section B: Rule Toggles */}
          <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Detection Engines &amp; Safeguard Toggles
            </h4>

            {/* Toggle 1: Velocity Rule */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1 rounded-lg bg-[var(--lavender)] text-[var(--primary)]">
                  <Gauge className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                    <span>Velocity Plausibility Check</span>
                    {hasRuleDiff("velocity_rule_active") && (
                      <span className="text-[9px] font-bold text-[var(--status-challenge)] uppercase">
                        Modified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Flag impossible hops across microcells &amp; mock GPS location hooks
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    rules: {
                      ...prev.rules,
                      velocity_rule_active: !prev.rules.velocity_rule_active,
                    },
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  editorConfig.rules.velocity_rule_active
                    ? "bg-[var(--status-allow)]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editorConfig.rules.velocity_rule_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Face Match Gate */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1 rounded-lg bg-[var(--lavender)] text-[var(--accent)]">
                  <ScanFace className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                    <span>Biometric Face-Match Gate</span>
                    {hasRuleDiff("face_match_rule_active") && (
                      <span className="text-[9px] font-bold text-[var(--status-challenge)] uppercase">
                        Modified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Enforce facial liveness challenge on account handoffs &amp; jitter drops
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    rules: {
                      ...prev.rules,
                      face_match_rule_active: !prev.rules.face_match_rule_active,
                    },
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  editorConfig.rules.face_match_rule_active
                    ? "bg-[var(--status-allow)]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editorConfig.rules.face_match_rule_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: Payout Escrow Window */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1 rounded-lg bg-[var(--lavender)] text-[var(--primary)]">
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                    <span>24h Payout Escrow Window</span>
                    {hasRuleDiff("hold_window_active") && (
                      <span className="text-[9px] font-bold text-[var(--status-challenge)] uppercase">
                        Modified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Quarantine instant ACH withdrawals upon account destination change
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    rules: {
                      ...prev.rules,
                      hold_window_active: !prev.rules.hold_window_active,
                    },
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  editorConfig.rules.hold_window_active
                    ? "bg-[var(--status-allow)]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editorConfig.rules.hold_window_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 4: Emulator & Root Detection */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1 rounded-lg bg-[var(--lavender)] text-[var(--status-escalate)]">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                    <span>Emulator &amp; Magisk/KernelSU Block</span>
                    {hasRuleDiff("emulator_block_active") && (
                      <span className="text-[9px] font-bold text-[var(--status-challenge)] uppercase">
                        Modified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Auto-escalate virtualized devices without valid hardware keystore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    rules: {
                      ...prev.rules,
                      emulator_block_active: !prev.rules.emulator_block_active,
                    },
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  editorConfig.rules.emulator_block_active
                    ? "bg-[var(--status-allow)]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editorConfig.rules.emulator_block_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 5: Device Collision Ring Detection */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1 rounded-lg bg-[var(--lavender)] text-[var(--primary)]">
                  <GitFork className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                    <span>Syndicate Device Collision Detection</span>
                    {hasRuleDiff("device_collision_active") && (
                      <span className="text-[9px] font-bold text-[var(--status-challenge)] uppercase">
                        Modified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Flag hardware UUIDs shared across ≥2 driver profiles within 48h
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditorConfig((prev) => ({
                    ...prev,
                    rules: {
                      ...prev.rules,
                      device_collision_active: !prev.rules.device_collision_active,
                    },
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  editorConfig.rules.device_collision_active
                    ? "bg-[var(--status-allow)]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editorConfig.rules.device_collision_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer Action inside Editor */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              onClick={() => handleRunSimulation()}
              disabled={simulating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-extrabold bg-[var(--lavender)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all shadow-sm disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : ""}`} />
              <span>{simulating ? "Simulating Historical Cohort..." : "Run Replay Simulation"}</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT PANEL: Simulation Results comparing Current vs Proposed     */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-soft space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="font-extrabold text-base text-[var(--ink)]">
                  Simulation Results: Current vs. Proposed
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Replay test against {simResult ? simResult.sessions_evaluated.toLocaleString() : "15,000"} historical delivery journeys
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold text-[var(--primary)] bg-[var(--lavender)] px-2.5 py-1 rounded-full">
                Cohort Replay
              </span>
            </div>

            {/* Visual Comparative Bar Chart: Allow / Challenge / Escalate */}
            {simResult && (
              <div className="p-4 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                  <span>Decision Distribution Comparison</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-allow)]" />
                      Allow
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-challenge)]" />
                      Challenge
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-escalate)]" />
                      Escalate
                    </span>
                  </div>
                </div>

                {/* Current Baseline Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-slate-400" />
                      Current Baseline (Active)
                    </span>
                    <span className="font-mono text-[11px] text-[var(--muted)]">
                      {simResult.current.allow_pct}% / {simResult.current.challenge_pct}% / {simResult.current.escalate_pct}%
                    </span>
                  </div>
                  <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-200 shadow-inner">
                    <div
                      style={{ width: `${simResult.current.allow_pct}%` }}
                      className="bg-[var(--status-allow)] h-full flex items-center justify-center text-[10px] font-extrabold text-white transition-all duration-500"
                    >
                      {simResult.current.allow_pct}%
                    </div>
                    <div
                      style={{ width: `${simResult.current.challenge_pct}%` }}
                      className="bg-[var(--status-challenge)] h-full flex items-center justify-center text-[10px] font-extrabold text-white transition-all duration-500"
                    >
                      {simResult.current.challenge_pct}%
                    </div>
                    <div
                      style={{ width: `${simResult.current.escalate_pct}%` }}
                      className="bg-[var(--status-escalate)] h-full flex items-center justify-center text-[10px] font-extrabold text-white transition-all duration-500"
                    >
                      {simResult.current.escalate_pct}%
                    </div>
                  </div>
                </div>

                {/* Proposed Simulation Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[var(--primary)] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-[var(--primary)]" />
                      Proposed Rules (Simulated)
                    </span>
                    <span className="font-mono text-[11px] font-extrabold text-[var(--primary)]">
                      {simResult.proposed.allow_pct}% / {simResult.proposed.challenge_pct}% / {simResult.proposed.escalate_pct}%
                    </span>
                  </div>
                  <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-200 shadow-inner ring-2 ring-[var(--primary)]/30">
                    <div
                      style={{ width: `${simResult.proposed.allow_pct}%` }}
                      className="bg-[var(--status-allow)] h-full flex items-center justify-center text-[10px] font-extrabold text-white transition-all duration-500"
                    >
                      {simResult.proposed.allow_pct}%
                    </div>
                    <div
                      style={{ width: `${simResult.proposed.challenge_pct}%` }}
                      className="bg-[var(--status-challenge)] h-full flex items-center justify-center text-[10px] font-extrabold text-white transition-all duration-500"
                    >
                      {simResult.proposed.challenge_pct}%
                    </div>
                    <div
                      style={{ width: `${simResult.proposed.escalate_pct}%` }}
                      className="bg-[var(--status-escalate)] h-full flex items-center justify-center text-[10px] font-extrabold text-white transition-all duration-500"
                    >
                      {simResult.proposed.escalate_pct}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Comparative Metric Cards */}
            {simResult && (
              <div className="grid sm:grid-cols-2 gap-3.5">
                {/* Metric 1: Allow / Challenge / Escalate Delta */}
                <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)]">
                    <span>ALLOW SHARE (ZERO DELAY)</span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        simResult.diff.allow_delta_pct >= 0
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)]"
                      }`}
                    >
                      {simResult.diff.allow_delta_pct >= 0 ? "+" : ""}
                      {simResult.diff.allow_delta_pct}%
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--ink)] font-mono">
                    {simResult.proposed.allow_pct}%
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">
                    Current: {simResult.current.allow_pct}% &bull; Friction delta: {simResult.diff.challenge_delta_pct >= 0 ? "+" : ""}{simResult.diff.challenge_delta_pct}%
                  </p>
                </div>

                {/* Metric 2: Estimated False Positives */}
                <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)]">
                    <span>ESTIMATED FALSE POSITIVES</span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        simResult.diff.false_positives_delta <= 0
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                      }`}
                    >
                      {simResult.diff.false_positives_delta <= 0 ? "" : "+"}
                      {simResult.diff.false_positives_delta} cases
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--ink)] font-mono">
                    {simResult.proposed.estimated_false_positives}
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">
                    Current: {simResult.current.estimated_false_positives} false alarms per 15k trips
                  </p>
                </div>

                {/* Metric 3: Payouts Affected */}
                <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)]">
                    <span>PAYOUTS QUARANTINED</span>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[var(--lavender)] text-[var(--primary)]">
                      ${simResult.proposed.payouts_affected_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--ink)] font-mono">
                    {simResult.proposed.payouts_affected} couriers
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">
                    Current: {simResult.current.payouts_affected} couriers (${simResult.current.payouts_affected_amount.toLocaleString()})
                  </p>
                </div>

                {/* Metric 4: Estimated Fraud Caught */}
                <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)]">
                    <span>ESTIMATED FRAUD CAUGHT</span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        simResult.diff.fraud_caught_delta_pct >= 0
                          ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)]"
                          : "bg-[var(--status-escalate)]/15 text-[var(--status-escalate)]"
                      }`}
                    >
                      {simResult.diff.fraud_caught_delta_pct >= 0 ? "+" : ""}
                      {simResult.diff.fraud_caught_delta_pct}%
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--primary)] font-mono">
                    {simResult.proposed.estimated_fraud_caught_pct}%
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">
                    Current: {simResult.current.estimated_fraud_caught_pct}% &bull; Recall confidence 99.1%
                  </p>
                </div>
              </div>
            )}

            {/* Tradeoff Analysis Summary */}
            {simResult && (
              <div className="p-4 rounded-xl bg-[var(--lavender)]/60 border border-[var(--primary)]/20 text-xs">
                <div className="flex items-center gap-2 font-bold text-[var(--primary)] mb-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Tradeoff &amp; Impact Analysis</span>
                </div>
                <p className="text-[11px] text-[var(--ink)] leading-relaxed">
                  {simResult.diff.fraud_caught_delta_pct >= 0
                    ? `Proposed cut-lines increase fraud ring capture by +${simResult.diff.fraud_caught_delta_pct}% with ${
                        simResult.diff.false_positives_delta <= 0
                          ? `a reduction of ${Math.abs(simResult.diff.false_positives_delta)} false positives`
                          : `an acceptable increase of ${simResult.diff.false_positives_delta} false-positive step-up challenges`
                      }.`
                    : `Warning: Loosening these constraints reduces fraud catch by ${Math.abs(
                        simResult.diff.fraud_caught_delta_pct
                      )}%, potentially allowing undetected GPS hops to clear.`}
                </p>
              </div>
            )}
          </div>

          {/* Primary Action Button: Deploy Policy with Diff confirmation */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[var(--muted)]">
              {canDeployPolicies && !isReadOnly ? (
                <span className="flex items-center gap-1.5 text-[var(--status-allow)] font-bold">
                  <Check className="w-3.5 h-3.5" />
                  Admin Authorized to Deploy
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[var(--status-challenge)] font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  Admin Role Required to Deploy
                </span>
              )}
            </div>

            <button
              onClick={() => {
                if (!canDeployPolicies || isReadOnly) {
                  showToast({
                    type: "warning",
                    title: "Permission Required",
                    message: "Deploying edge policy rules requires Admin privileges.",
                  });
                  return;
                }
                setDeployModalOpen(true);
              }}
              disabled={isReadOnly}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-plum ${
                canDeployPolicies && !isReadOnly
                  ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-95"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Review Diff &amp; Deploy to Edge</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* COLLAPSIBLE VERSION HISTORY LIST WITH ROLLBACK ACTION                 */}
      {/* ===================================================================== */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-soft overflow-hidden">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--surface-alt)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-2">
                <span>Policy Version History &amp; Audit Trail</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--lavender)] text-[var(--primary)]">
                  {versions.length} {versions.length === 1 ? "Version" : "Versions"}
                </span>
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Immutable ledger of production deployments, test drafts, and one-click rollback checkpoints
              </p>
            </div>
          </div>
          <div className="p-1 rounded-lg text-[var(--muted)]">
            {historyOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {/* Collapsible Content */}
        {historyOpen && (
          <div className="border-t border-[var(--border-subtle)] p-5 space-y-3">
            {versions.map((ver) => {
              const isActive = ver.status === "ACTIVE";
              const isDraft = ver.status === "DRAFT";
              const isRollingBack = rollingBackId === ver.id;

              return (
                <div
                  key={ver.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isActive
                      ? "bg-[var(--surface-alt)] border-[var(--primary)]/40 ring-1 ring-[var(--primary)]/20"
                      : "bg-[var(--surface)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  {/* Left Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold text-[var(--ink)]">
                        {ver.version_tag}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isActive
                            ? "bg-[var(--status-allow)]/15 text-[var(--status-allow)] border border-[var(--status-allow)]/30"
                            : isDraft
                            ? "bg-[var(--status-challenge)]/15 text-[var(--status-challenge)] border border-[var(--status-challenge)]/30"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {ver.status}
                      </span>
                      <span className="font-bold text-xs text-[var(--ink)]">{ver.name}</span>
                    </div>

                    <p className="text-xs text-[var(--muted)] line-clamp-1">{ver.notes}</p>

                    {/* Snapshot Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)] font-mono pt-1">
                      <span className="bg-[var(--surface-alt)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        Challenge: &lt; {ver.config.challenge_threshold}
                      </span>
                      <span className="bg-[var(--surface-alt)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        Escalate: &lt; {ver.config.escalate_threshold}
                      </span>
                      <span className="bg-[var(--surface-alt)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        Velocity: {ver.config.max_velocity_kmh} km/h
                      </span>
                      <span className="bg-[var(--surface-alt)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        Face: {ver.config.min_face_match.toFixed(2)}
                      </span>
                      <span className="bg-[var(--surface-alt)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        Escrow: {ver.config.hold_window_hours}h
                      </span>
                      {ver.deployed_by && (
                        <span className="text-[var(--muted)] font-sans">
                          &bull; {ver.deployed_by}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--status-allow)]/10 text-[var(--status-allow)] text-xs font-bold border border-[var(--status-allow)]/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Live in Production
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditorConfig({ ...ver.config });
                            handleRunSimulation(ver.config);
                            showToast({
                              type: "info",
                              title: "Loaded Into Editor",
                              message: `Configuration from ${ver.version_tag} populated into the sliders & toggles.`,
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--ink)] bg-[var(--surface-alt)] hover:bg-[var(--lavender)] border border-[var(--border-subtle)] transition-colors"
                        >
                          Load in Editor
                        </button>

                        <button
                          onClick={() => handleRollback(ver)}
                          disabled={isRollingBack}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--status-challenge)] bg-[var(--status-challenge)]/10 hover:bg-[var(--status-challenge)]/20 border border-[var(--status-challenge)]/30 transition-all cursor-pointer disabled:opacity-50"
                          title="Rollback active policy to this version"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? "animate-spin" : ""}`} />
                          <span>{canDeployPolicies && !isReadOnly ? "Rollback" : "Inspect"}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* DEPLOY CONFIRMATION MODAL WITH DIFF                                   */}
      {/* ===================================================================== */}
      {deployModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--surface)] w-full max-w-2xl rounded-3xl shadow-dropdown border border-[var(--border)] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--lavender)] text-[var(--primary)] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--ink)]">
                    Confirm Policy Deployment to Edge
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Review side-by-side threshold diff before pushing to live fleet gateways
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeployModalOpen(false)}
                className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Diff View */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Diff Table */}
              <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="grid grid-cols-12 bg-[var(--surface-alt)] px-4 py-2.5 text-[11px] font-extrabold text-[var(--muted)] uppercase border-b border-[var(--border-subtle)]">
                  <div className="col-span-5">Policy Rule / Parameter</div>
                  <div className="col-span-3">Current Active ({activeVersionTag})</div>
                  <div className="col-span-4">Proposed (New Version)</div>
                </div>

                <div className="divide-y divide-[var(--border-subtle)] text-xs">
                  {/* Row 1: Challenge Threshold */}
                  <div className={`grid grid-cols-12 px-4 py-2.5 items-center ${hasParamDiff("challenge_threshold") ? "bg-[var(--lavender)]/40 font-bold" : ""}`}>
                    <div className="col-span-5 font-medium text-[var(--ink)]">Challenge Floor (pts)</div>
                    <div className="col-span-3 font-mono text-[var(--muted)]">{currentActiveConfig.challenge_threshold} pts</div>
                    <div className="col-span-4 font-mono font-extrabold text-[var(--primary)] flex items-center gap-1.5">
                      <span>{editorConfig.challenge_threshold} pts</span>
                      {hasParamDiff("challenge_threshold") && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--status-challenge)]/20 text-[var(--status-challenge)]">
                          Diff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Escalate Threshold */}
                  <div className={`grid grid-cols-12 px-4 py-2.5 items-center ${hasParamDiff("escalate_threshold") ? "bg-[var(--lavender)]/40 font-bold" : ""}`}>
                    <div className="col-span-5 font-medium text-[var(--ink)]">Escalate &amp; Case Floor (pts)</div>
                    <div className="col-span-3 font-mono text-[var(--muted)]">{currentActiveConfig.escalate_threshold} pts</div>
                    <div className="col-span-4 font-mono font-extrabold text-[var(--primary)] flex items-center gap-1.5">
                      <span>{editorConfig.escalate_threshold} pts</span>
                      {hasParamDiff("escalate_threshold") && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--status-challenge)]/20 text-[var(--status-challenge)]">
                          Diff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Max Velocity */}
                  <div className={`grid grid-cols-12 px-4 py-2.5 items-center ${hasParamDiff("max_velocity_kmh") ? "bg-[var(--lavender)]/40 font-bold" : ""}`}>
                    <div className="col-span-5 font-medium text-[var(--ink)]">Max Velocity Boundary</div>
                    <div className="col-span-3 font-mono text-[var(--muted)]">{currentActiveConfig.max_velocity_kmh} km/h</div>
                    <div className="col-span-4 font-mono font-extrabold text-[var(--primary)] flex items-center gap-1.5">
                      <span>{editorConfig.max_velocity_kmh} km/h</span>
                      {hasParamDiff("max_velocity_kmh") && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--status-challenge)]/20 text-[var(--status-challenge)]">
                          Diff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Min Face Match */}
                  <div className={`grid grid-cols-12 px-4 py-2.5 items-center ${hasParamDiff("min_face_match") ? "bg-[var(--lavender)]/40 font-bold" : ""}`}>
                    <div className="col-span-5 font-medium text-[var(--ink)]">Min Face Match Confidence</div>
                    <div className="col-span-3 font-mono text-[var(--muted)]">{currentActiveConfig.min_face_match.toFixed(2)}</div>
                    <div className="col-span-4 font-mono font-extrabold text-[var(--primary)] flex items-center gap-1.5">
                      <span>{editorConfig.min_face_match.toFixed(2)}</span>
                      {hasParamDiff("min_face_match") && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--status-challenge)]/20 text-[var(--status-challenge)]">
                          Diff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 5: Hold Window Hours */}
                  <div className={`grid grid-cols-12 px-4 py-2.5 items-center ${hasParamDiff("hold_window_hours") ? "bg-[var(--lavender)]/40 font-bold" : ""}`}>
                    <div className="col-span-5 font-medium text-[var(--ink)]">Escrow Hold Window</div>
                    <div className="col-span-3 font-mono text-[var(--muted)]">{currentActiveConfig.hold_window_hours} Hours</div>
                    <div className="col-span-4 font-mono font-extrabold text-[var(--primary)] flex items-center gap-1.5">
                      <span>{editorConfig.hold_window_hours} Hours</span>
                      {hasParamDiff("hold_window_hours") && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--status-challenge)]/20 text-[var(--status-challenge)]">
                          Diff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 6: Toggles Summary */}
                  <div className="grid grid-cols-12 px-4 py-2.5 items-center bg-[var(--surface-alt)]/50">
                    <div className="col-span-5 font-medium text-[var(--ink)]">Active Safeguards</div>
                    <div className="col-span-3 text-[11px] text-[var(--muted)]">
                      {Object.values(currentActiveConfig.rules).filter(Boolean).length}/5 Enabled
                    </div>
                    <div className="col-span-4 text-[11px] font-bold text-[var(--primary)]">
                      {Object.values(editorConfig.rules).filter(Boolean).length}/5 Enabled
                    </div>
                  </div>
                </div>
              </div>

              {/* Projected Impact Callout */}
              {simResult && (
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] text-xs text-center">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Pass Rate Delta</span>
                    <div className="font-mono text-base font-extrabold text-[var(--status-allow)]">
                      {simResult.diff.allow_delta_pct >= 0 ? "+" : ""}
                      {simResult.diff.allow_delta_pct}%
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Fraud Catch Delta</span>
                    <div className="font-mono text-base font-extrabold text-[var(--primary)]">
                      {simResult.diff.fraud_caught_delta_pct >= 0 ? "+" : ""}
                      {simResult.diff.fraud_caught_delta_pct}%
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase">False Positive Delta</span>
                    <div className="font-mono text-base font-extrabold text-[var(--accent)]">
                      {simResult.diff.false_positives_delta >= 0 ? "+" : ""}
                      {simResult.diff.false_positives_delta} cases
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Trail Deployment Note Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--ink)]">
                  Deployment Rationale &amp; Change Notes
                </label>
                <textarea
                  rows={2}
                  value={deployNote}
                  onChange={(e) => setDeployNote(e.target.value)}
                  placeholder="e.g. Q4 Peak surge calibration: tightening max velocity and adding biometric gate on courier handoffs."
                  className="w-full rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] p-3 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3 bg-[var(--surface-alt)]">
              <button
                type="button"
                onClick={() => setDeployModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeploy}
                disabled={deploying}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all shadow-plum disabled:opacity-50"
              >
                {deploying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{deploying ? "Deploying..." : "Confirm & Deploy to Edge Routers"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SAVE DRAFT MODAL                                                      */}
      {/* ===================================================================== */}
      {draftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-3xl shadow-dropdown border border-[var(--border)] overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-2">
                <Save className="w-4 h-4 text-[var(--primary)]" />
                <span>Save Policy Draft</span>
              </h3>
              <button
                onClick={() => setDraftModalOpen(false)}
                className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--ink)]">
                Draft Name or Identifier
              </label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Q4 Weekend Freeze Draft"
                className="w-full rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
              />
              <p className="text-[11px] text-[var(--muted)]">
                Saved drafts are added to version history for testing without impacting production edge routers.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDraftModalOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || !draftName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all disabled:opacity-50"
              >
                {savingDraft ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
