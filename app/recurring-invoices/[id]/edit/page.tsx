"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Customer = { id: string; name: string; email: string | null };
type ItemRow = { description: string; quantity: string; unit_price: string };

export default function EditRecurringInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [nextRunDate, setNextRunDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const [{ data: ri, error: riErr }, { data: custs }] = await Promise.all([
        supabase
          .from("recurring_invoices")
          .select("id, customer_id, frequency, next_run_date, end_date, auto_send, notes, recurring_invoice_items(description, quantity, unit_price)")
          .eq("id", id)
          .eq("user_id", sessionData.session.user.id)
          .single(),
        supabase
          .from("customers")
          .select("id, name, email")
          .eq("user_id", sessionData.session.user.id)
          .order("name"),
      ]);

      if (riErr || !ri) { setError("Template not found."); setLoading(false); return; }

      const template = ri as typeof ri & {
        recurring_invoice_items: { description: string; quantity: number; unit_price: number }[];
      };

      setCustomers((custs as Customer[]) ?? []);
      setCustomerId(template.customer_id ?? "");
      setFrequency(template.frequency as typeof frequency);
      setNextRunDate(template.next_run_date ?? "");
      setEndDate(template.end_date ?? "");
      setAutoSend(template.auto_send ?? false);
      setNotes(template.notes ?? "");
      setItems(template.recurring_invoice_items.map((it) => ({
        description: it.description,
        quantity: String(it.quantity),
        unit_price: String(it.unit_price),
      })));
      setLoading(false);
    })();
  }, [id]);

  const addItem = () => setItems((prev) => [...prev, { description: "", quantity: "1", unit_price: "" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, j) => j !== i));
  const updateItem = (i: number, field: keyof ItemRow, value: string) =>
    setItems((prev) => prev.map((it, j) => j === i ? { ...it, [field]: value } : it));

  const save = async () => {
    setError(null);
    const validItems = items.filter((it) => it.description.trim() && parseFloat(it.unit_price) > 0);
    if (validItems.length === 0) { setError("Add at least one line item with a price."); return; }
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const { error: updateErr } = await supabase
      .from("recurring_invoices")
      .update({
        customer_id: customerId || null,
        frequency,
        next_run_date: nextRunDate,
        end_date: endDate || null,
        auto_send: autoSend,
        notes: notes.trim() || null,
      })
      .eq("id", id)
      .eq("user_id", sessionData.session.user.id);

    if (updateErr) { setError(updateErr.message); setSaving(false); return; }

    await supabase.from("recurring_invoice_items").delete().eq("recurring_invoice_id", id);
    await supabase.from("recurring_invoice_items").insert(
      validItems.map((it) => ({
        recurring_invoice_id: id,
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
      }))
    );

    setSaving(false);
    router.push("/recurring-invoices");
  };

  const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const fmtMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="mt-6 space-y-4">
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error && items.length === 0) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-red-600">{error}</p>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Recurring Invoice</h1>
      </div>

      <div className="grid gap-5 max-w-2xl">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Schedule</h2>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Customer</label>
            <select
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">No customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Frequency</label>
              <select
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Next Run Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={nextRunDate}
                onChange={(e) => setNextRunDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">End Date (optional)</label>
              <input
                type="date"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
            />
            <div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Auto-send by email</span>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Automatically emails the invoice to the customer when generated</p>
            </div>
          </label>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Line Items</h2>
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_60px_100px_28px] gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
              <span>Description</span><span>Qty</span><span>Unit Price</span><span></span>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_100px_28px] gap-2 items-center">
                <input
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={it.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-2 bg-transparent text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-2 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={it.unit_price}
                  onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                />
                <button
                  onClick={() => removeItem(i)}
                  className="text-lg text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors text-center"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-left px-1 mt-1 transition-colors"
            >
              + Add line item
            </button>
          </div>
          {total > 0 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 font-semibold text-gray-900 dark:text-white">
              <span>Total per invoice</span>
              <span className="tabular-nums">{fmtMoney(total)}</span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Notes (optional)</h2>
          <textarea
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Added to each generated invoice"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </main>
  );
}
