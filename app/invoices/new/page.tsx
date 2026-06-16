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

export default function NewInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("invoicing");
      if (!active) { setGated(true); setLoading(false); return; }

      setUserId(sessionData.session.user.id);

      const [{ data: custData }, { data: invData }] = await Promise.all([
        supabase.from("customers").select("id, name").eq("user_id", sessionData.session.user.id).order("name"),
        supabase.from("invoices").select("invoice_number").eq("user_id", sessionData.session.user.id).order("created_at", { ascending: false }).limit(1),
      ]);

      setCustomers((custData as Customer[]) ?? []);

      const lastNum = (invData?.[0]?.invoice_number ?? "INV-000").replace(/\D/g, "");
      const next = String(parseInt(lastNum || "0") + 1).padStart(3, "0");
      setInvoiceNumber(`INV-${next}`);

      setLoading(false);
    })();
  }, []);

  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const save = async (status: "draft" | "sent") => {
    setError(null);
    if (!invoiceNumber.trim()) { setError("Invoice number is required."); return; }
    if (items.every((i) => !i.description.trim())) { setError("Add at least one line item."); return; }
    if (!userId) return;

    setSaving(true);

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        customer_id: customerId || null,
        invoice_number: invoiceNumber.trim(),
        status,
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (invErr || !inv) { setError(invErr?.message ?? "Failed to create invoice."); setSaving(false); return; }

    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length > 0) {
      const { error: itemErr } = await supabase.from("invoice_items").insert(
        validItems.map((i) => ({
          invoice_id: inv.id,
          description: i.description.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
        }))
      );
      if (itemErr) { setError(itemErr.message); setSaving(false); return; }
    }

    router.push(`/invoices/${inv.id}`);
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="opacity-60 mb-4 text-sm">Invoicing module not active.</p>
        <a href="/plan" className="text-sm underline">Go to My Plan</a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">New Invoice</h1>
      </div>

      <div className="grid gap-5">
        {/* Header fields */}
        <section className="border rounded-xl p-5 grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm opacity-60 block mb-1">Invoice #</label>
              <input
                className="w-full border rounded px-3 py-2 bg-transparent font-mono"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm opacity-60 block mb-1">Issue Date</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm opacity-60 block mb-1">Due Date</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className="border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Line Items</h2>
          <div className="grid gap-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                <input
                  className="border rounded px-3 py-2 bg-transparent text-sm"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2 bg-transparent text-sm text-right"
                  placeholder="Qty"
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2 bg-transparent text-sm text-right"
                  placeholder="Unit price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                />
                <button
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="opacity-30 hover:opacity-70 disabled:opacity-10 text-lg leading-none"
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setItems((prev) => [...prev, newItem()])}
            className="mt-3 text-sm opacity-50 hover:opacity-80"
          >
            + Add line item
          </button>

          <div className="flex justify-end mt-4 pt-4 border-t">
            <span className="font-semibold text-lg">{fmtMoney(total)}</span>
          </div>
        </section>

        {/* Notes */}
        <section className="border rounded-xl p-5">
          <label className="text-sm opacity-60 block mb-1">Notes</label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-transparent resize-none text-sm"
            rows={3}
            placeholder="Payment terms, bank details, thank-you note…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="border rounded px-4 py-2 text-sm font-medium hover:opacity-70 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save as Draft"}
          </button>
          <button
            onClick={() => save("sent")}
            disabled={saving}
            className="bg-black text-white dark:bg-white dark:text-black rounded px-4 py-2 text-sm font-medium hover:opacity-80 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save & Mark Sent"}
          </button>
        </div>
      </div>
    </main>
  );
}
