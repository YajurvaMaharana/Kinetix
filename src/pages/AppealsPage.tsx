"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  ShieldCheck,
  RefreshCw,
  Filter,
  Check,
} from "lucide-react";
import { Appeal, Role } from "@/lib/types";
import { getActiveRole, listAppeals, createAppeal, resolveAppeal } from "@/lib/api";

function AppealsContent() {
  const [searchParams] = useSearchParams();
  const queryCaseId = searchParams.get("case_id") || "";
  const queryRiderId = searchParams.get("rider_id") || "";

  const [activeTab, setActiveTab] = useState<"submit" | "analyst">("submit");
  const [currentRole, setCurrentRole] = useState<Role>("analyst");

  const [riderIdInput, setRiderIdInput] = useState<string>(queryRiderId || "rider_demo");
  const [caseIdInput, setCaseIdInput] = useState<string>(queryCaseId);
  const [reasonInput, setReasonInput] = useState<string>("False positive security trigger on genuine session");
  const [supportingTextInput, setSupportingTextInput] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loadingAppeals, setLoadingAppeals] = useState<boolean>(false);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [reviewerNote, setReviewerNote] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const role = getActiveRole();
    setCurrentRole(role);
    if (role === "analyst" || role === "admin" || role === "investigator") {
      setActiveTab("analyst");
    } else {
      setActiveTab("submit");
    }
  }, []);

  const fetchAppealsList = React.useCallback(async () => {
    setLoadingAppeals(true);
    setActionError(null);
    try {
      const data = await listAppeals(
        statusFilter === "ALL" ? undefined : statusFilter,
        currentRole === "rider" ? riderIdInput : undefined,
        currentRole
      );
      setAppeals(data || []);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to load appeals.");
    } finally {
      setLoadingAppeals(false);
    }
  }, [statusFilter, currentRole, riderIdInput]);

  useEffect(() => {
    fetchAppealsList();
  }, [fetchAppealsList]);

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput.trim()) {
      setSubmitError("Please provide an appeal reason.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await createAppeal(
        {
          case_id: caseIdInput.trim() || undefined,
          rider_id: riderIdInput.trim() || undefined,
          reason: reasonInput.trim(),
          supporting_text: supportingTextInput.trim() || undefined,
        },
        riderIdInput.trim(),
        currentRole
      );
      setSubmitSuccess(`Appeal #${res.id} submitted successfully! Your case is now prioritized for analyst review.`);
      setSupportingTextInput("");
      fetchAppealsList();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg || "Failed to submit appeal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (appealId: string, action: "overturned" | "upheld") => {
    const note = reviewerNote[appealId]?.trim();
    if (!note) {
      setActionError(`A detailed reviewer note is mandatory before marking appeal as ${action}.`);
      return;
    }
    setResolvingId(appealId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await resolveAppeal(
        appealId,
        { action, note },
        currentRole
      );
      setActionSuccess(
        action === "overturned"
          ? `Appeal #${updated.id} OVERTURNED: Restrictions lifted, false-positive recorded, holds released, trust restored.`
          : `Appeal #${updated.id} UPHELD: Restrictions remain active with documented rationale.`
      );
      setReviewerNote((prev) => ({ ...prev, [appealId]: "" }));
      fetchAppealsList();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || `Failed to ${action} appeal.`);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B12] text-slate-100 pb-20">
      <div className="border-b border-slate-800/80 bg-gradient-to-r from-[#101521] via-[#0D121F] to-[#101521] px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium mb-2">
                <FileText className="w-3.5 h-3.5" />
                <span>Human-in-the-Loop Redress &amp; Adjudication</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white">Appeals &amp; Friction Redress</h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Automated security decisions are never irreversible. Riders can submit formal appeals to contest
                holds, while SOC analysts review dossiers to lift restrictions and record policy calibration feedback.
              </p>
            </div>

            <div className="flex items-center p-1 rounded-lg border border-slate-800 bg-[#0B0F19]">
              <button
                onClick={() => setActiveTab("submit")}
                className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "submit"
                    ? "bg-[#56D9F5]/20 text-[#56D9F5] border border-[#56D9F5]/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                File an Appeal
              </button>
              <button
                onClick={() => setActiveTab("analyst")}
                className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "analyst"
                    ? "bg-[#56D9F5]/20 text-[#56D9F5] border border-[#56D9F5]/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Analyst Queue ({appeals.filter((a) => a.status === "PENDING").length})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 mt-8">
        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold">Action Completed: </span>
              {actionSuccess}
            </div>
          </div>
        )}

        {actionError && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold">Resolution Error: </span>
              {actionError}
            </div>
          </div>
        )}

        {activeTab === "submit" && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-xl border border-slate-800 bg-[#101521] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-1">Submit Security Appeal</h2>
                <p className="text-xs text-slate-400 mb-6">
                  Provide context regarding why this security check or payout lock is a false alarm.
                </p>

                {submitSuccess && (
                  <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-sm leading-relaxed">{submitSuccess}</div>
                  </div>
                )}

                {submitError && (
                  <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-sm leading-relaxed">{submitError}</div>
                  </div>
                )}

                <form onSubmit={handleSubmitAppeal} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Rider Identifier
                      </label>
                      <input
                        type="text"
                        value={riderIdInput}
                        onChange={(e) => setRiderIdInput(e.target.value)}
                        required
                        className="w-full bg-[#0B0F19] border border-slate-800 focus:border-[#56D9F5]/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Case or Session ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={caseIdInput}
                        onChange={(e) => setCaseIdInput(e.target.value)}
                        placeholder="e.g. case_101 or leave blank"
                        className="w-full bg-[#0B0F19] border border-slate-800 focus:border-[#56D9F5]/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Primary Appeal Reason
                    </label>
                    <select
                      value={reasonInput}
                      onChange={(e) => setReasonInput(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-slate-800 focus:border-[#56D9F5]/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    >
                      <option value="False positive security trigger on genuine session">
                        False positive security trigger on genuine session
                      </option>
                      <option value="Legitimate new phone or device upgrade">
                        Legitimate new phone or device upgrade
                      </option>
                      <option value="Facial verification failed due to poor night lighting">
                        Facial verification failed due to poor night lighting
                      </option>
                      <option value="Interrupted mobile connection during delivery dispatch">
                        Interrupted mobile connection during delivery dispatch
                      </option>
                      <option value="Legitimate bank account change for payout earnings">
                        Legitimate bank account change for payout earnings
                      </option>
                      <option value="Other non-fraud operational reason">
                        Other non-fraud operational reason
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Supporting Context &amp; Details
                    </label>
                    <textarea
                      rows={4}
                      value={supportingTextInput}
                      onChange={(e) => setSupportingTextInput(e.target.value)}
                      placeholder="Explain what happened..."
                      className="w-full bg-[#0B0F19] border border-slate-800 focus:border-[#56D9F5]/60 rounded-lg p-3 text-sm text-slate-100 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#56D9F5]/80 to-[#A78BFA]/80 hover:from-[#56D9F5] hover:to-[#A78BFA] text-slate-950 font-bold text-sm shadow-lg shadow-[#56D9F5]/20 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{submitting ? "Submitting Appeal..." : "Submit Formal Appeal"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-slate-800 bg-[#101521] p-5 text-xs text-slate-400 space-y-4">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <ShieldCheck className="w-4 h-4 text-[#56D9F5]" />
                  <span>The Redress Guarantee</span>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800/80">
                    <span className="font-semibold text-slate-200 block mb-1">2-Hour Analyst SLA</span>
                    Appeals are routed directly to the priority SOC review console for human investigation.
                  </div>
                  <div className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800/80">
                    <span className="font-semibold text-emerald-400 block mb-1">Complete Overturn Effects</span>
                    Overturned appeals immediately activate your account, release held payouts, and restore trust scores.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "analyst" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-[#101521] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Filter Status:
                </span>
                <div className="flex gap-1">
                  {["ALL", "PENDING", "OVERTURNED", "UPHELD"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`text-xs px-3 py-1 rounded-md border font-medium transition-colors cursor-pointer ${
                        statusFilter === st
                          ? "bg-[#56D9F5]/20 border-[#56D9F5]/40 text-[#56D9F5] font-semibold"
                          : "bg-[#0B0F19] border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Total Appeals: <strong className="text-white">{appeals.length}</strong>
                </span>
                <button
                  onClick={fetchAppealsList}
                  disabled={loadingAppeals}
                  className="p-1.5 rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer"
                  title="Refresh Queue"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAppeals ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {loadingAppeals && appeals.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-slate-800 bg-[#101521]">
                <RefreshCw className="w-8 h-8 text-[#56D9F5] animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading appeal cases...</p>
              </div>
            ) : appeals.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-slate-800 bg-[#101521]">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Appeals Queue Empty</h3>
                <p className="text-xs text-slate-400 mt-1">
                  There are no appeals matching status &quot;{statusFilter}&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {appeals.map((appeal) => {
                  const isPending = appeal.status === "PENDING";
                  const isOverturned = appeal.status === "OVERTURNED";
                  const isUpheld = appeal.status === "UPHELD";

                  return (
                    <div
                      key={appeal.id}
                      className="rounded-xl border border-slate-800 bg-[#101521] p-5 shadow-lg space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-[#56D9F5]">
                            {appeal.id}
                          </span>
                          {appeal.case_id && (
                            <Link
                              to={`/cases?id=${encodeURIComponent(appeal.case_id)}`}
                              className="text-xs font-mono text-slate-400 hover:text-white underline decoration-dotted"
                            >
                              Case: {appeal.case_id}
                            </Link>
                          )}
                          <span className="text-xs text-slate-400 font-medium">
                            Rider: <strong className="text-slate-200">{appeal.rider_name || appeal.rider_id}</strong>
                          </span>
                        </div>

                        <div>
                          {isPending && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              <span>PENDING TRIAGE</span>
                            </span>
                          )}
                          {isOverturned && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>OVERTURNED (RESTORED)</span>
                            </span>
                          )}
                          {isUpheld && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>UPHELD (RESTRICTED)</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-2 p-3 rounded-lg bg-[#0B0F19] border border-slate-800/70">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Rider Reason
                          </span>
                          <p className="text-slate-200 font-medium">{appeal.reason}</p>
                          {appeal.supporting_text && (
                            <p className="text-slate-400 italic mt-1 leading-relaxed">
                              &quot;{appeal.supporting_text}&quot;
                            </p>
                          )}
                          <div className="text-[10px] text-slate-500 pt-1">
                            Filed: {new Date(appeal.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="space-y-3 p-3 rounded-lg bg-[#0B0F19] border border-slate-800/70 flex flex-col justify-between">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                              Analyst Adjudication
                            </span>

                            {isPending ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={2}
                                  value={reviewerNote[appeal.id] || ""}
                                  onChange={(e) =>
                                    setReviewerNote((prev) => ({
                                      ...prev,
                                      [appeal.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Enter mandatory reviewer rationale for this ruling..."
                                  className="w-full bg-[#101521] border border-slate-800 focus:border-[#56D9F5]/60 rounded-md p-2 text-xs text-slate-100 focus:outline-none resize-none"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-slate-300">
                                  <strong>Reviewer:</strong> {appeal.reviewer_id || "analyst"}
                                </p>
                                <p className="text-slate-300">
                                  <strong>Notes:</strong> {appeal.reviewer_notes || "No notes recorded."}
                                </p>
                                {appeal.updated_at && (
                                  <p className="text-[10px] text-slate-500">
                                    Resolved: {new Date(appeal.updated_at).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {isPending && (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                              <button
                                onClick={() => handleResolve(appeal.id, "overturned")}
                                disabled={resolvingId === appeal.id}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Overturn (Restore)</span>
                              </button>
                              <button
                                onClick={() => handleResolve(appeal.id, "upheld")}
                                disabled={resolvingId === appeal.id}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Uphold (Block)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppealsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080B12] py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin text-[#56D9F5]" />
          <span className="text-xs">Loading Appeals Management Console...</span>
        </div>
      }
    >
      <AppealsContent />
    </Suspense>
  );
}
