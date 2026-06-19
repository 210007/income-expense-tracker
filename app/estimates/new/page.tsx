"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Customer = { id: string; name: string };
type LineItem = { description: string; quantity: string; unit_price: string };

function newItem(): LineItem {
  return { description: "", quantity: "1", unit_price: "" };
}

export default function NewEstimatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [estimateNumber, setEstimateNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("estimates");
      if (!active) { setGated(true); setLoading(false); return; }

      setUserId(sessionData.session.user.id);

      const [{ data: custData }, { data: estData }] = await Promise.all([
        supabase.from("customers").select("id, name").eq("user_id", sessionData.session.user.id).order("name"),
        supabase.from("estimates").select("estimate_number").eq("user_id", sessionData.session.user.id).order("created_at", { ascending: false }).limit(1),
      ]);

      setCustomers((custData as Customer[]) ?? []);
      const lastNum = (estData?.[0]?.estimate_number ?? "EST-000").replace(/\D/g, "");
      setEstimateNumber(`EST-${String(parseInt(lastNum || "0") + 1).padStart(3, "0")}`);
      setLoading(false);
    })();
  }, []);

  const updateItem = (i: number, field: keyof LineItem, value: string) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const total = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  const save = async (status: "draft" | "sent") => {
    setError(null);
    if (!estimateNumber.trim()) { setError("Estimate number is required."); return; }
    if (items.every((i) => !i.description.trim())) { setError("Add at least one line item."); return; }
    if (!userId) return;

    setSaving(true);
    const { data: est, error: estErr } = await supabase
      .from("estimates")
      .insert({
        user_id: userId,
        customer_id: customerId || null,
        estimate_number: estimateNumber.trim(),
        status,
        issue_date: issueDate,
        expiry_date: expiryDate || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (estErr || !est) { setError(estErr?.message ?? "Failed to create estimate."); setSaving(false); return; }

    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length > 0) {
      await supabase.from("estimate_items").insert(
        validItems.map((i) => ({
          estimate_id: est.id,
          description: i.description.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
        }))
      );
    }

    router.push(`/estimates/${est.id}`);
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-10 w-48" />
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-40" />
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-52" />
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Estimates module not active.</p>
        <a href="/plan" className="text-sm underline text-gray-700 dark:text-gray-300">Go to My Plan</a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Go back"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Estimate</h1>
      </div>

      <div className="grid gap-5">
        {/* Header fields */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                Estimate #
              </label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={estimateNumber}
                onChange={(e) => setEstimateNumber(e.target.value)}
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
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                Issue Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                Expiry Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Line Items
          </h2>
          <div className="grid gap-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_110px_32px] gap-2 items-center">
                <input
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
                <input
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-transparent text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Qty"
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                />
                <input
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-transparent text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Unit price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                />
                <button
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 disabled:opacity-20 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setItems((prev) => [...prev, newItem()])}
            className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            + Add line item
          </button>
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total</p>
              <span className="font-bold text-xl text-gray-900 dark:text-white tabular-nums">{fmtMoney(total)}</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
            Notes
          </label>
          <textarea
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            rows={3}
            placeholder="Terms, conditions, validity notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save as Draft"}
          </button>
          <button
            onClick={() => save("sent")}
            disabled={saving}
            className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save & Mark Sent"}
          </button>
        </div>
      </div>
    </main>
  );
}
