import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  FileQuestion,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Send,
  Upload,
} from "lucide-react";

export default function RiderAppealsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState("TR-8938 ($44.50 Escrow Hold)");
  const [description, setDescription] = useState("");
  const [appeals, setAppeals] = useState([
    {
      id: "AP-4019",
      subject: "GPS drift during heavy rainstorm on 4th Ave",
      tripId: "TR-8938",
      amount: "$44.50",
      status: "In Review",
      createdDate: "Today, 1:10 PM",
      resolution: "Investigator assigned: Elena Rostova. Under review.",
    },
    {
      id: "AP-3812",
      subject: "Cellular drop at underground parking garage",
      tripId: "TR-7210",
      amount: "$18.00",
      status: "Resolved",
      createdDate: "Oct 12, 2026",
      resolution: "Verified: Cellular coverage gap confirmed. Funds cleared.",
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const newAppeal = {
      id: `AP-${Math.floor(4000 + Math.random() * 1000)}`,
      subject: description.slice(0, 50) + "...",
      tripId: selectedIssue.split(" ")[0],
      amount: "$44.50",
      status: "New",
      createdDate: "Just now",
      resolution: "Submitted. An analyst will review your sensor telemetry within 4 hours.",
    };

    setAppeals([newAppeal, ...appeals]);
    setDescription("");
    setShowForm(false);
    showToast({
      type: "success",
      title: "Appeal Submitted",
      message: "Your explanation has been sent to the risk review queue.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4A2C6D]/10 text-[#4A2C6D] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#4A2C6D]/20">
              <span>FAIR DISPUTE RESOLUTION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231B33]">
              Rider Appeals &amp; Disputes
            </h1>
            <p className="text-xs text-[#6B6480] mt-1">
              Dispute algorithmic flags or explain unusual delivery situations directly to human analysts
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="py-3 px-5 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Raise New Appeal</span>
          </button>
        </div>
      </div>

      {/* Appeal Form Drawer / Accordion */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#4A2C6D]/30 shadow-plum space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="font-extrabold text-base text-[#231B33]">Submit Dispute Appeal</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-bold text-[#6B6480] hover:text-[#231B33]"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#231B33] mb-1.5">
              Select Flagged Payout or Trip
            </label>
            <select
              value={selectedIssue}
              onChange={(e) => setSelectedIssue(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FFF9F2] text-xs text-[#231B33] font-semibold focus:outline-none focus:border-[#4A2C6D]"
            >
              <option value="TR-8938 ($44.50 Escrow Hold)">TR-8938: Urban Kitchens &amp; Grill ($44.50 Hold)</option>
              <option value="PO-9842 (Today's Escrow Batch)">PO-9842: Escrow Shift Batch ($44.50)</option>
              <option value="General Account Review">General: Trust Score Adjustment Inquiry</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#231B33] mb-1.5">
              Explain What Happened in Plain Language
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. During delivery at 12:15 PM, I entered an underground garage loading dock which cut cellular and GPS signal. I handed the order to the receptionist..."
              className="w-full p-3.5 rounded-xl border border-gray-200 bg-[#FFF9F2] text-xs text-[#231B33] focus:outline-none focus:border-[#4A2C6D]"
              required
            />
          </div>

          <button
            type="submit"
            className="py-3 px-6 rounded-full bg-[#4A2C6D] hover:bg-[#392153] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Submit Appeal to Risk Team</span>
          </button>
        </form>
      )}

      {/* Appeals List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#4A2C6D]/15 shadow-soft space-y-3">
        <h2 className="text-base font-extrabold text-[#231B33] mb-3">Your Past Appeals</h2>

        {appeals.map((a) => (
          <div
            key={a.id}
            className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#4A2C6D]/10 space-y-2 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-extrabold text-sm text-[#231B33]">{a.subject}</div>
                <div className="text-[11px] text-[#6B6480] mt-0.5">
                  Appeal ID: {a.id} • Trip: {a.tripId} • {a.createdDate}
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                  a.status === "Resolved"
                    ? "bg-[#2FBF8F]/15 text-[#2FBF8F] border border-[#2FBF8F]/25"
                    : a.status === "In Review"
                    ? "bg-amber-500/15 text-amber-800 border border-amber-500/30"
                    : "bg-[#4A2C6D]/10 text-[#4A2C6D] border border-[#4A2C6D]/20"
                }`}
              >
                {a.status}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-gray-100 text-[11px] text-[#6B6480]">
              <strong className="text-[#231B33]">Status Update:</strong> {a.resolution}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
