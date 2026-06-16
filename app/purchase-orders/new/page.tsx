"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type ItemRow = { description: string; quantity: string; unit_price: string };

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [vendor, setVendor] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }
      const active = await hasModule("purchase_orders");
      if (!active) { setGated(true); setLoading(false); return; }
      setUserId(sessionData.session.user.id);
      setLoading(false);
    })();
  }, []);

  const addItem = () => setItems((prev) => [...prev, { description: "", quantity: "1", unit_price: "" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, j) => j !== i));
  const updateItem = (i: number, field: keyof ItemRow, value: string) =>
    setItems((prev) => prev.map((it, j) => j === i ? { ...it, [field]: value } : it));

  const save = async () => {
    setError(null);
    if (!vendor.trim()) { setError("Vendor name is required."); return; }
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) { setError("Add at least one line item."); return; }
    if (!userId) return;
    setSaving(true);

    const { data: lastPO } = await supabase
      .from("purchase_orders")
      .select("po_number")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastNum = (lastPO?.[0]?.po_number ?? "PO-000").replace(/\D/g, "");
    const poNumber = `PO-${String(parseInt(lastNum || "0") + 1).padStart(3, "0")}`;

    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        user_id: userId,
        po_number: poNumber,
        vendor: vendor.trim(),
        vendor_email: vendorEmail.trim() || null,
        status: "draft",
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (poErr || !po) { setError(poErr?.message ?? "Failed to create purchase order."); setSaving(false); return; }

    await supabase.from("purchase_order_items").insert(
      validItems.map((it) => ({
        po_id: po.id,
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
      }))
    );

    setSaving(false);
    router.push(`/purchase-orders/${po.id}`);
  };

  const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const fmtMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (gated) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-60 text-sm mb-4">Purchase Orders module not active.</p><a href="/plan" className="text-sm underline">Go to My Plan</a></main>;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">New Purchase Order</h1>
      </div>

      <div className="grid gap-5 max-w-2xl">
        <div className="border rounded-xl p-5 grid gap-4">
          <h2 className="font-semibold">Vendor</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm opacity-60 block mb-1">Vendor Name *</label>
              <input className="w-full border rounded px-3 py-2 bg-transparent text-sm" placeholder="e.g. Office Depot" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div>
              <label className="text-sm opacity-60 block mb-1">Vendor Email (optional)</label>
              <input type="email" className="w-full border rounded px-3 py-2 bg-transparent text-sm" placeholder="vendor@example.com" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm opacity-60 block mb-1">Order Date *</label>
              <input type="date" className="w-full border rounded px-3 py-2 bg-transparent text-sm" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm opacity-60 block mb-1">Expected Delivery (optional)</label>
              <input type="date" className="w-full border rounded px-3 py-2 bg-transparent text-sm" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Items</h2>
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_60px_100px_28px] gap-2 text-xs opacity-50 px-1">
              <span>Description</span><span>Qty</span><span>Unit Price</span><span></span>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_100px_28px] gap-2 items-center">
                <input className="border rounded px-3 py-2 bg-transparent text-sm" placeholder="Item description" value={it.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                <input type="number" min="0.01" step="0.01" className="border rounded px-2 py-2 bg-transparent text-sm text-center" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                <input type="number" min="0" step="0.01" className="border rounded px-2 py-2 bg-transparent text-sm" placeholder="0.00" value={it.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} />
                <button onClick={() => removeItem(i)} className="text-lg opacity-30 hover:opacity-70 hover:text-red-500 text-center">×</button>
              </div>
            ))}
            <button onClick={addItem} className="text-sm opacity-50 hover:opacity-80 text-left px-1 mt-1">+ Add item</button>
          </div>
          {total > 0 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{fmtMoney(total)}</span>
            </div>
          )}
        </div>

        <div className="border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Notes (optional)</h2>
          <textarea className="w-full border rounded px-3 py-2 bg-transparent text-sm resize-none" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={save} disabled={saving} className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80">
          {saving ? "Saving…" : "Create Purchase Order"}
        </button>
      </div>
    </main>
  );
}
