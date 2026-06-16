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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (gated) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-60 text-sm mb-4">Accounts Payable module not active.</p><a href="/plan" className="text-sm underline">Go to My Plan</a></main>;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">Add Bill</h1>
      </div>

      <div className="border rounded-xl p-5 grid gap-4 max-w-lg">
        <div>
          <label className="text-sm opacity-60 block mb-1">Vendor *</label>
          <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="e.g. Electric company, Landlord" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Amount *</label>
            <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">Due Date</label>
            <input type="date" className="w-full border rounded px-3 py-2 bg-transparent" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Category</label>
          {categories.length > 0 ? (
            <select className="w-full border rounded px-3 py-2 bg-transparent" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="e.g. Utilities, Rent" value={category} onChange={(e) => setCategory(e.target.value)} />
          )}
        </div>

        <div>
          <label className="text-sm opacity-60 block mb-1">Description</label>
          <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Optional notes" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button onClick={save} disabled={saving} className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80">
          {saving ? "Saving…" : "Add Bill"}
        </button>
      </div>
    </main>
  );
}
