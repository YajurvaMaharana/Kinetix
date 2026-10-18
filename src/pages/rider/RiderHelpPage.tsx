import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  HelpCircle,
  MessageCircle,
  Phone,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Camera,
} from "lucide-react";

export default function RiderHelpPage() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "Why was my payout temporarily placed in escrow hold?",
      a: "When our telemetry system notices an unexpected location jump (such as 4 miles in 30 seconds, usually caused when entering tall buildings or cellular dead zones), it pauses payout for 24 hours to protect your funds from unauthorized logins. You can unlock it instantly at any time by completing a quick 3-second selfie verification.",
    },
    {
      q: "How does the 3D Facial Liveness check work?",
      a: "The liveness check asks you to look straight at your phone camera for 3 seconds. It checks for natural optical depth to prove you are physically holding the phone. We never store your photo on our servers.",
    },
    {
      q: "How can I keep my Trust Score above 95%?",
      a: "Keep your official delivery app open with accurate location permissions. Avoid mock-location apps, battery-saver modes that throttle GPS, or sharing your driver account with friends or family.",
    },
    {
      q: "When do weekly earnings disburse if I don't use Instant Cashout?",
      a: "Regular shift earnings disburse automatically via standard ACH direct deposit every Monday at 6:00 AM local time with zero transfer fees.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6F61]/15 text-[#FF6F61] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#FF6F61]/25">
          <span>COURIER ASSISTANCE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231B33]">
          Driver Help &amp; Support
        </h1>
        <p className="text-xs text-[#6B6480] mt-1">
          Plain-language answers for courier security, payout clearing, and account policies
        </p>
      </div>

      {/* Quick Contact Options */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-6 rounded-3xl bg-white border border-[#4A2C6D]/15 shadow-soft flex items-center justify-between">
          <div>
            <div className="font-extrabold text-sm text-[#231B33]">24/7 Fleet Dispatch Support</div>
            <div className="text-xs text-[#6B6480] mt-0.5">Average response time: &lt; 2 minutes</div>
            <div className="mt-3">
              <a
                href="tel:18005550199"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4A2C6D] text-white text-xs font-bold hover:bg-[#392153] transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Dispatch (1-800-555-0199)</span>
              </a>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-[#4A2C6D]/15 shadow-soft flex items-center justify-between">
          <div>
            <div className="font-extrabold text-sm text-[#231B33]">Dispute an Escrow Hold</div>
            <div className="text-xs text-[#6B6480] mt-0.5">Explain a flagged run directly to risk analysts</div>
            <div className="mt-3">
              <Link
                to="/rider/appeals"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2FBF8F] text-white text-xs font-bold hover:bg-[#28a87d] transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Submit an Appeal</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft space-y-4">
        <h2 className="text-base font-extrabold text-[#231B33]">Frequently Asked Questions</h2>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-[#4A2C6D]/10 overflow-hidden transition-all bg-[#FFF9F2]"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left font-extrabold text-xs text-[#231B33] flex items-center justify-between gap-4"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#4A2C6D] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B6480] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-[#6B6480] leading-relaxed border-t border-gray-100/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
