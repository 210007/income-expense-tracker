"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Customer = { id: string; name: string };

function localDatetime(isoDate?: string | null, hour = 9, minute = 0): string {
  const d = isoDate ? new Date(isoDate + "T12:00:00") : new Date();
  d.setHours(hour, minute, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function NewAppointmentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const dateParam = params.get("date");

  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startTime, setStartTime] = useState(() => localDatetime(dateParam, 9, 0));
  const [endTime, setEndTime] = useState(() => localDatetime(dateParam, 10, 0));
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
    const { error: err } = await supabase.from("appointments").insert({
      user_id: userId,
      customer_id: customerId || null,
      title: title.trim(),
      notes: notes.trim() || null,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      status: "scheduled",
    });
    setSaving(false);

    if (err) { setError(err.message); return; }
    router.push("/appointments");
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 max-w-lg">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-xl w-48" />
        <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
      </div>
    );
  }

  if (gated) {
    return (
      <div>
        <p className="text-sm text-gray-500 mb-4">Scheduling module not active.</p>
        <a href="/plan" className="text-sm text-blue-500 hover:text-blue-600">Go to My Plan →</a>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
            Title *
          </label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g. Consultation, Site visit, Follow-up"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
            Customer
          </label>
          <select
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
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
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
              Start *
            </label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
              End
            </label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
            Notes
          </label>
          <textarea
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            rows={3}
            placeholder="Location, prep notes, what to bring…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 brand-gradient text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Scheduling…" : "Schedule Appointment"}
          </button>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewAppointmentPage() {
  const router = useRouter();
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Appointment</h1>
      </div>
      <Suspense fallback={<div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl max-w-lg" />}>
        <NewAppointmentForm />
      </Suspense>
    </main>
  );
}
