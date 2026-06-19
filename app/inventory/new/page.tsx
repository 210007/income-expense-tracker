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

  if (loading) return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-40" />
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-80" />
      </div>
    </main>
  );

  if (gated) return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm text-gray-500 dark:text-gray-400">
        Inventory module not active. <a href="/plan" className="underline font-medium">Go to My Plan</a>
      </div>
    </main>
  );

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Product</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4 max-w-lg">
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Product Name *</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g. Widget Pro, T-Shirt (L)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">SKU</label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. WGT-001"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Category</label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. Apparel"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Sale Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0.00"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Cost Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0.00"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Starting Stock</label>
            <input
              type="number"
              min="0"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Low Stock Alert</label>
            <input
              type="number"
              min="0"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="5"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
          <textarea
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Add Product"}
        </button>
      </div>
    </main>
  );
}
