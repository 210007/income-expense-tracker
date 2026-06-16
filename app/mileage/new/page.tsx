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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (gated) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-60 text-sm mb-4">Mileage module not active.</p><a href="/plan" className="text-sm underline">Go to My Plan</a></main>;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">Log Trip</h1>
      </div>

      <div className="border rounded-xl p-5 grid gap-4 max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Date *</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 bg-transparent text-sm"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">Miles *</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              className="w-full border rounded px-3 py-2 bg-transparent text-sm"
              placeholder="e.g. 12.5"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Purpose *</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent text-sm"
            placeholder="e.g. Client meeting, Supply run, Site visit"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">From</label>
            <input
              className="w-full border rounded px-3 py-2 bg-transparent text-sm"
              placeholder="Starting location"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">To</label>
            <input
              className="w-full border rounded px-3 py-2 bg-transparent text-sm"
              placeholder="Destination"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        {miles && !isNaN(parseFloat(miles)) && parseFloat(miles) > 0 && (
          <p className="text-sm opacity-50">
            Estimated deduction: <span className="font-medium">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parseFloat(miles) * 0.70)}</span> at 70¢/mile
          </p>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80 text-sm"
        >
          {saving ? "Saving…" : "Log Trip"}
        </button>
      </div>
    </main>
  );
}
