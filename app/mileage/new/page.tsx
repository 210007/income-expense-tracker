"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

export default function NewMileagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [tripDate, setTripDate] = useState(today);
  const [miles, setMiles] = useState("");
  const [purpose, setPurpose] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }
      const active = await hasModule("mileage");
      if (!active) { setGated(true); setLoading(false); return; }
      setUserId(sessionData.session.user.id);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setError(null);
    const mi = parseFloat(miles);
    if (!purpose.trim()) { setError("Purpose is required."); return; }
    if (!miles || isNaN(mi) || mi <= 0) { setError("Enter a valid number of miles."); return; }
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("mileage_logs").insert({
      user_id: userId,
      trip_date: tripDate,
      miles: mi,
      purpose: purpose.trim(),
      from_location: from.trim() || null,
      to_location: to.trim() || null,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    router.push("/mileage");
  };

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-2xl w-32" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-64 max-w-lg" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Mileage module not active.</p>
        <a href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity inline-block">
          Go to My Plan
        </a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log Trip</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Date *</label>
            <input
              type="date"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Miles *</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. 12.5"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Purpose *</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g. Client meeting, Supply run, Site visit"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">From</label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Starting location"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">To</label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Destination"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        {miles && !isNaN(parseFloat(miles)) && parseFloat(miles) > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Estimated deduction:{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parseFloat(miles) * 0.70)}
              </span>{" "}
              at 70¢/mile
            </p>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Log Trip"}
        </button>
      </div>
    </main>
  );
}
