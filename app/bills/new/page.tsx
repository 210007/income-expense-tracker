"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

export default function NewBillPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("accounts_payable");
      if (!active) { setGated(true); setLoading(false); return; }

      setUserId(sessionData.session.user.id);

      const { data } = await supabase.from("categories").select("name").eq("user_id", sessionData.session.user.id).order("name");
      setCategories((data ?? []).map((c: { name: string }) => c.name));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setError(null);
    if (!vendor.trim()) { setError("Vendor is required."); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("Amount must be greater than 0."); return; }
    if (!userId) return;

    setSaving(true);
    const { error } = await supabase.from("bills").insert({
      user_id: userId,
      vendor: vendor.trim(),
      amount: parseFloat(amount),
      due_date: dueDate || null,
      description: description.trim() || null,
      category: category || null,
      status: "due",
    });
    setSaving(false);

    if (error) { setError(error.message); return; }
    router.push("/bills");
  };

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-32" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-64 max-w-lg" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Accounts Payable module not active.</p>
        <a href="/plan" className="text-sm text-blue-600 dark:text-blue-400 underline">Go to My Plan</a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Bill</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 grid gap-4 max-w-lg">
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Vendor *</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g. Electric company, Landlord"
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
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Due Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
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
              placeholder="e.g. Utilities, Rent"
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

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Add Bill"}
        </button>
      </div>
    </main>
  );
}
