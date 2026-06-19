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

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-2xl mt-6" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Recurring Transactions module not active.</p>
        <a href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">Go to My Plan</a>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Recurring Transaction</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4 max-w-lg">
        {/* Type toggle */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Type</label>
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold capitalize transition-colors ${
                  type === t
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Vendor / Payee *</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g. Netflix, Office Rent"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Frequency</label>
            <select
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
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
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Category</label>
          {categories.length > 0 ? (
            <select
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— None —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. Software, Utilities"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Optional notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Start Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
              End Date <span className="font-normal normal-case tracking-normal opacity-60">(optional)</span>
            </label>
            <input
              type="date"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Create Recurring Transaction"}
        </button>
      </div>
    </main>
  );
}
