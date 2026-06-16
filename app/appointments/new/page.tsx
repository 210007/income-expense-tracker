"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Customer = { id: string; name: string };

function localDatetimeDefault(offsetMinutes = 60): string {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startTime, setStartTime] = useState(localDatetimeDefault(60));
  const [endTime, setEndTime] = useState(localDatetimeDefault(120));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("scheduling");
      if (!active) { setGated(true); setLoading(false); return; }

      setUserId(sessionData.session.user.id);

      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .eq("user_id", sessionData.session.user.id)
        .order("name");

      setCustomers((data as Customer[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (!startTime) { setError("Start time is required."); return; }
    if (!userId) return;

    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      user_id: userId,
      customer_id: customerId || null,
      title: title.trim(),
      notes: notes.trim() || null,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      status: "scheduled",
    });
    setSaving(false);

    if (error) { setError(error.message); return; }
    router.push("/appointments");
  };

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="opacity-60 mb-4 text-sm">Appointment Scheduling module not active.</p>
        <a href="/plan" className="text-sm underline">Go to My Plan</a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">New Appointment</h1>
      </div>

      <div className="border rounded-xl p-5 grid gap-4 max-w-lg">
        <div>
          <label className="text-sm opacity-60 block mb-1">Title *</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent"
            placeholder="e.g. Consultation, Site visit, Follow-up"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Customer</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">— No customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Start *</label>
            <input
              type="datetime-local"
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">End <span className="opacity-40">(optional)</span></label>
            <input
              type="datetime-local"
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Notes</label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-transparent resize-none text-sm"
            rows={3}
            placeholder="What to discuss, location, prep notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80"
        >
          {saving ? "Saving…" : "Schedule Appointment"}
        </button>
      </div>
    </main>
  );
}
