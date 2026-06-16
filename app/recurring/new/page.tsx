"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function NewRecurringPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("recurring");
      if (!active) { setGated(true); setLoading(false); return; }

      setUserId(sessionData.session.user.id);

      const { data: catData } = await supabase
        .from("categories")
        .select("name")
        .eq("user_id", sessionData.session.user.id)
        .order("name");

      setCategories((catData ?? []).map((c: { name: string }) => c.name));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setError(null);
    if (!vendor.trim()) { setError("Vendor is required."); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("Amount must be greater than 0."); return; }
    if (!userId) return;

    setSaving(true);
    const { error } = await supabase.from("recurring_transactions").insert({
      user_id: userId,
      type,
      amount: parseFloat(amount),
      vendor: vendor.trim(),
      description: description.trim() || null,
      category: category || null,
      frequency,
      start_date: startDate,
      next_run_date: startDate,
      end_date: endDate || null,
      active: true,
    });
    setSaving(false);

    if (error) { setError(error.message); return; }
    router.push("/recurring");
  };

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="opacity-60 mb-4 text-sm">Recurring Transactions module not active.</p>
        <a href="/plan" className="text-sm underline">Go to My Plan</a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">New Recurring Transaction</h1>
      </div>

      <div className="border rounded-xl p-5 grid gap-4 max-w-lg">
        {/* Type toggle */}
        <div>
          <label className="text-sm opacity-60 block mb-2">Type</label>
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded border text-sm font-medium capitalize transition-colors ${
                  type === t
                    ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                    : "hover:opacity-70"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Vendor / Payee *</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent"
            placeholder="e.g. Netflix, Office Rent"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border rounded px-3 py-2 bg-transparent"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">Frequency</label>
            <select
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Category</label>
          {categories.length > 0 ? (
            <select
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— None —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input
              className="w-full border rounded px-3 py-2 bg-transparent"
              placeholder="e.g. Software, Utilities"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Description</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent"
            placeholder="Optional notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Start Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">End Date <span className="opacity-40">(optional)</span></label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80"
        >
          {saving ? "Saving…" : "Create Recurring Transaction"}
        </button>
      </div>
    </main>
  );
}
