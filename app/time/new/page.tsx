"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Customer = { id: string; name: string };

export default function NewTimeEntryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("time_tracking");
      if (!active) { setGated(true); setLoading(false); return; }

      setUserId(sessionData.session.user.id);

      const { data } = await supabase.from("customers").select("id, name").eq("user_id", sessionData.session.user.id).order("name");
      setCustomers((data as Customer[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setError(null);
    if (!description.trim()) { setError("Description is required."); return; }
    if (!hours || parseFloat(hours) <= 0) { setError("Hours must be greater than 0."); return; }
    if (!rate || parseFloat(rate) < 0) { setError("Rate is required."); return; }
    if (!userId) return;

    setSaving(true);
    const { error } = await supabase.from("time_entries").insert({
      user_id: userId,
      customer_id: customerId || null,
      description: description.trim(),
      hours: parseFloat(hours),
      rate: parseFloat(rate),
      entry_date: entryDate,
      invoiced: false,
    });
    setSaving(false);

    if (error) { setError(error.message); return; }
    router.push("/time");
  };

  const total = (parseFloat(hours) || 0) * (parseFloat(rate) || 0);
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (gated) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-60 text-sm mb-4">Time Tracking module not active.</p><a href="/plan" className="text-sm underline">Go to My Plan</a></main>;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">Log Time</h1>
      </div>

      <div className="border rounded-xl p-5 grid gap-4 max-w-lg">
        <div>
          <label className="text-sm opacity-60 block mb-1">Description *</label>
          <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="e.g. Website design, Consulting call" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Customer</label>
          <select className="w-full border rounded px-3 py-2 bg-transparent" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— No customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Hours *</label>
            <input type="number" min="0" step="0.25" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="0.00" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">Rate / hr *</label>
            <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="0.00" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
        </div>

        {total > 0 && (
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="opacity-60">Total</span>
            <span className="font-semibold">{fmtMoney(total)}</span>
          </div>
        )}

        <div>
          <label className="text-sm opacity-60 block mb-1">Date</label>
          <input type="date" className="w-full border rounded px-3 py-2 bg-transparent" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button onClick={save} disabled={saving} className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80">
          {saving ? "Saving…" : "Log Time Entry"}
        </button>
      </div>
    </main>
  );
}
