"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Customer = { id: string; name: string };
type CatalogItem = { id: string; name: string; unit_price: number; unit: string | null; type: string };
type LineItem = { description: string; quantity: string; unit_price: string };

function newItem(): LineItem {
  return { description: "", quantity: "1", unit_price: "" };
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function NewInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
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

      const [{ data: custData }, { data: invData }, { data: prodData }] = await Promise.all([
        supabase.from("customers").select("id, name").eq("user_id", sessionData.session.user.id).order("name"),
        supabase.from("invoices").select("invoice_number").eq("user_id", sessionData.session.user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("products").select("id, name, unit_price, unit, type").eq("user_id", sessionData.session.user.id).eq("is_active", true).order("name"),
      ]);

      setCustomers((custData as Customer[]) ?? []);
      setCatalog((prodData as CatalogItem[]) ?? []);

      const lastNum = (invData?.[0]?.invoice_number ?? "INV-000").replace(/\D/g, "");
      const next = String(parseInt(lastNum || "0") + 1).padStart(3, "0");
      setInvoiceNumber(`INV-${next}`);

      setLoading(false);
    })();
  }, []);

  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const pickFromCatalog = (index: number, productId: string) => {
    const product = catalog.find((p) => p.id === productId);
    if (!product) return;
    const desc = product.unit ? `${product.name} (${product.unit})` : product.name;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, description: desc, unit_price: String(product.unit_price) } : item
      )
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
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

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-9 bg-gray-200 dark:bg-gray-800 rounded-xl w-48" />
          <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-gray-500 mb-4">Invoicing module not active.</p>
        <a href="/plan" className="text-sm text-blue-500 hover:text-blue-600">Go to My Plan →</a>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Invoice</h1>
      </div>

      {/* Invoice header fields */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Invoice #</label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Customer</label>
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Issue Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
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
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Line Items</h2>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="space-y-2">
              {/* Catalog picker row */}
              {catalog.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 text-xs text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) { pickFromCatalog(i, e.target.value); e.target.value = ""; } }}
                  >
                    <option value="">Pick from catalog…</option>
                    {catalog.filter((p) => p.type === "service").length > 0 && (
                      <optgroup label="Services">
                        {catalog.filter((p) => p.type === "service").map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — ${p.unit_price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</option>
                        ))}
                      </optgroup>
                    )}
                    {catalog.filter((p) => p.type === "product").length > 0 && (
                      <optgroup label="Products">
                        {catalog.filter((p) => p.type === "product").map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — ${p.unit_price.toFixed(2)}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* Item fields */}
              <div className="grid grid-cols-[1fr_72px_100px_28px] gap-2 items-center">
                <input
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                  <span className="px-2 text-gray-400 text-xs">$</span>
                  <input
                    className="flex-1 py-2.5 pr-3 bg-transparent text-sm text-right focus:outline-none"
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Line subtotal */}
              {item.description && (
                <div className="text-right text-xs text-gray-400 pr-9">
                  {(parseFloat(item.quantity) || 0) > 1 && (
                    <span>
                      {parseFloat(item.quantity) || 0} × ${parseFloat(item.unit_price || "0").toFixed(2)} = {" "}
                    </span>
                  )}
                  <span className="font-semibold text-gray-600 dark:text-gray-300">
                    {money((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setItems((prev) => [...prev, newItem()])}
          className="mt-4 flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add line item
        </button>

        <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{money(total)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Notes</label>
        <textarea
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          rows={3}
          placeholder="Payment terms, bank details, thank-you note…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 justify-end pb-4">
        <button
          onClick={() => save("draft")}
          disabled={saving}
          className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          onClick={() => save("sent")}
          disabled={saving}
          className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {saving ? "Saving…" : "Save & Mark Sent"}
        </button>
      </div>
    </main>
  );
}
