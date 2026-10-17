"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Camera,
  Smartphone,
  HelpCircle,
  FileText,
  Lock,
  ChevronRight,
  RefreshCw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { RiderExplanation, ActionOption } from "@/lib/types";
import { getRiderExplanation, apiFetch } from "@/lib/api";

export default function RiderExplainPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [riderId, setRiderId] = useState<string>("rider_demo");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<RiderExplanation | null>(null);
  const [recentSessions, setRecentSessions] = useState<Array<{ id: string; rider_id: string; status: string }>>([]);

  // Fetch recent sessions on mount to provide quick links
  useEffect(() => {
    async function loadSessions() {
      try {
        const sessions = await apiFetch<Array<{ id: string; rider_id: string; status: string }>>("/sessions");
        if (sessions && sessions.length > 0) {
          setRecentSessions(sessions.slice(0, 5));
          setSessionId((prev) => (prev ? prev : sessions[0].id));
          setRiderId((prev) => (prev && prev !== "rider_demo" ? prev : sessions[0].rider_id));
        }
      } catch {
        // Fallback demo session if API has no sessions
        setSessionId((prev) => (prev ? prev : "sess_demo_01"));
      }
    }
    loadSessions();
  }, []);

  const handleFetchExplanation = useCallback(async (targetSessionId: string, targetRiderId?: string) => {
    const sId = targetSessionId.trim();
    if (!sId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getRiderExplanation(sId, targetRiderId || riderId, "rider");
      setExplanation(data);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to fetch explanation for this session.";
      setError(message);
      setExplanation(null);
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    if (sessionId) {
      handleFetchExplanation(sessionId, riderId);
    }
  }, [sessionId, riderId, handleFetchExplanation]);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict.toLowerCase()) {
      case "clear":
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Account in Good Standing</span>
          </div>
        );
      case "verification pending":
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Quick Check Required</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-semibold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Under Safety Review</span>
          </div>
        );
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "selfie":
        return <Camera className="w-5 h-5 text-[#56D9F5]" />;
      case "otp":
        return <Smartphone className="w-5 h-5 text-[#A78BFA]" />;
      case "appeal":
        return <FileText className="w-5 h-5 text-amber-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#080B12] text-slate-100 pb-16">
      {/* Top Banner / Privacy Guarantee */}
      <div className="border-b border-slate-800/80 bg-gradient-to-r from-[#101521] via-[#0D121F] to-[#101521] px-4 py-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#56D9F5]/10 border border-[#56D9F5]/30 text-[#56D9F5] text-xs font-medium mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Transparent Security • Zero Secret Bans • Absolute Privacy</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Rider Security &amp; Account Status
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl mx-auto">
            You have the right to know why a verification was requested. TrustJuggler explains decisions
            clearly with plain English reasons, zero automated permanent bans, and immediate redress paths.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 mt-8 space-y-6">
        {/* Session Selector Card */}
        <div className="rounded-xl border border-slate-800 bg-[#101521]/70 backdrop-blur-md p-5 shadow-lg shadow-black/30">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select or Enter Session ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="e.g. sess_4a8b1c2d"
                  className="flex-1 bg-[#0B0F19] border border-slate-800 focus:border-[#56D9F5]/60 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                />
                <button
                  onClick={() => handleFetchExplanation(sessionId, riderId)}
                  disabled={loading || !sessionId.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#56D9F5]/20 hover:bg-[#56D9F5]/30 border border-[#56D9F5]/40 text-[#56D9F5] font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Inspect</span>
                </button>
              </div>
            </div>

            {recentSessions.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Recent Platform Sessions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {recentSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSessionId(s.id);
                        setRiderId(s.rider_id);
                        handleFetchExplanation(s.id, s.rider_id);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-colors ${
                        sessionId === s.id
                          ? "bg-[#56D9F5]/20 border-[#56D9F5]/50 text-[#56D9F5] font-semibold"
                          : "bg-[#0B0F19] border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {s.id.slice(0, 12)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="p-12 text-center rounded-xl border border-slate-800 bg-[#101521]/50 backdrop-blur-md">
            <RefreshCw className="w-8 h-8 text-[#56D9F5] animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Retrieving verified rider-safe security status...</p>
          </div>
        )}

        {error && (
          <div className="p-6 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">Explanation Unavailable</h4>
                <p className="text-xs text-rose-400/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Explanation Dossier */}
        {explanation && !loading && (
          <div className="space-y-6">
            {/* Primary Status Card */}
            <div className="rounded-xl border border-slate-800 bg-[#101521] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#56D9F5]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                    SESSION {explanation.session_id}
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-1">{explanation.headline}</h2>
                </div>
                <div>{getVerdictBadge(explanation.verdict)}</div>
              </div>

              {/* Rider Safe Summary Message */}
              <div className="mt-5 p-4 rounded-lg bg-[#0B0F19] border border-slate-800/80 text-slate-300 text-sm leading-relaxed">
                <p>{explanation.rider_safe_text}</p>
              </div>

              {/* Plain Reasons List */}
              <div className="mt-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Why this check was requested (Plain Reasons)
                </h3>
                <div className="grid gap-2.5">
                  {explanation.plain_reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#0B0F19]/60 border border-slate-800/60"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#56D9F5]" />
                      <span className="text-sm text-slate-200">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* What You Can Do (Action Options) */}
            <div className="rounded-xl border border-slate-800 bg-[#101521] p-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-[#56D9F5]" />
                <span>What You Can Do (Immediate Resolution)</span>
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                Choose an action below to instantly resolve verification holds or contest this security check.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {explanation.what_you_can_do.map((opt: ActionOption, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-800 bg-[#0B0F19] hover:border-[#56D9F5]/40 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 group-hover:scale-105 transition-transform">
                          {getActionIcon(opt.action)}
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800/70 text-slate-400">
                          {opt.action}
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm text-white">{opt.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{opt.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      {opt.action === "appeal" ? (
                        <Link
                          href={`/appeals?case_id=${encodeURIComponent(explanation.case_id || "")}&rider_id=${encodeURIComponent(riderId)}`}
                          className="flex items-center justify-between text-xs font-semibold text-amber-400 hover:text-amber-300"
                        >
                          <span>File an Appeal</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : opt.action === "selfie" ? (
                        <Link
                          href="/monitor"
                          className="flex items-center justify-between text-xs font-semibold text-[#56D9F5] hover:text-[#56D9F5]/80"
                        >
                          <span>Complete Selfie</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : opt.action === "otp" ? (
                        <Link
                          href="/monitor"
                          className="flex items-center justify-between text-xs font-semibold text-[#A78BFA] hover:text-[#A78BFA]/80"
                        >
                          <span>Enter SMS Code</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <a
                          href="mailto:trust-safety@trustjuggler.internal"
                          className="flex items-center justify-between text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          <span>Contact 24/7 Operations</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy & Fairness Commitments */}
            <div className="rounded-xl border border-slate-800/70 bg-[#0B0F19]/60 p-5 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-[#56D9F5]" />
                <span>Our Privacy &amp; Ethics Commitment to Riders</span>
              </div>
              <p>
                • <strong>No Raw Photo Storage:</strong> Camera frames are processed strictly in memory to verify liveness and are immediately erased. We store zero raw photographs.
              </p>
              <p>
                • <strong>Network Minimization:</strong> IP addresses and device serial numbers are irreversibly tokenized. We never store raw IP addresses.
              </p>
              <p>
                • <strong>Fair Human Redress:</strong> If you believe a security hold was placed in error, our SOC human analysts review appeals within 2 hours. Overturned appeals immediately restore your full earnings dispatch status.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
