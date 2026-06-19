"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [lowThreshold, setLowThreshold] = useState("5");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }
      const active = await hasModule("inventory");
      if (!active) { setGated(true); setLoading(false); return; }
      setUserId(sessionData.session.user.id);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError("Product name is required."); return; }
    if (!userId) return;
    setSaving(true);
    const { data: product, error } = await supabase.from("products").insert({
      user_id: userId,
      name: name.trim(),
      sku: sku.trim() || null,
      description: description.trim() || null,
      unit_price: parseFloat(unitPrice) || 0,
      cost_price: parseFloat(costPrice) || 0,
      stock_quantity: parseFloat(stockQty) || 0,
      low_stock_threshold: parseFloat(lowThreshold) || 5,
      category: category.trim() || null,
      active: true,
      is_active: true,
    }).select("id").single();
    setSaving(false);
    if (error || !product) { setError(error?.message ?? "Failed to create product."); return; }
    router.push(`/inventory/${product.id}`);
  };

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (gated) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-60 text-sm mb-4">Inventory module not active.</p><a href="/plan" className="text-sm underline">Go to My Plan</a></main>;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">Add Product</h1>
      </div>
      <div className="border rounded-xl p-5 grid gap-4 max-w-lg">
        <div>
          <label className="text-sm opacity-60 block mb-1">Product Name *</label>
          <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="e.g. Widget Pro, T-Shirt (L)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">SKU</label>
            <input className="w-full border rounded px-3 py-2 bg-transparent font-mono text-sm" placeholder="e.g. WGT-001" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">Category</label>
            <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="e.g. Apparel" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Sale Price</label>
            <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="0.00" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">Cost Price</label>
            <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="0.00" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Starting Stock</label>
            <input type="number" min="0" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">Low Stock Alert</label>
            <input type="number" min="0" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="5" value={lowThreshold} onChange={(e) => setLowThreshold(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm opacity-60 block mb-1">Description</label>
          <textarea className="w-full border rounded px-3 py-2 bg-transparent resize-none text-sm" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={save} disabled={saving} className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80">
          {saving ? "Saving…" : "Add Product"}
        </button>
      </div>
    </main>
  );
}
