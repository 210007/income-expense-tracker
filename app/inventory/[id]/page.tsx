"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  category: string | null;
  is_active: boolean;
};

type Adjustment = {
  id: string;
  adjustment: number;
  reason: string | null;
  created_at: string;
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adjQty, setAdjQty] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }
    setUserId(sessionData.session.user.id);

    const [{ data: prod, error: prodErr }, { data: adjs }] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).eq("user_id", sessionData.session.user.id).single(),
      supabase.from("inventory_adjustments").select("id, adjustment, reason, created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(20),
    ]);

    if (prodErr || !prod) { setError(prodErr?.message ?? "Product not found."); setLoading(false); return; }
    setProduct(prod as Product);
    setAdjustments((adjs as Adjustment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const applyAdjustment = async () => {
    if (!product || !userId) return;
    const qty = parseFloat(adjQty);
    if (!adjQty || isNaN(qty) || qty === 0) { setError("Enter a non-zero quantity."); return; }
    setSaving(true);
    setError(null);

    const newQty = product.stock_quantity + qty;

    const [{ error: adjErr }] = await Promise.all([
      supabase.from("inventory_adjustments").insert({
        product_id: product.id,
        user_id: userId,
        adjustment: qty,
        reason: adjReason.trim() || null,
      }),
      supabase.from("products").update({ stock_quantity: newQty }).eq("id", product.id),
    ]);

    setSaving(false);
    if (adjErr) { setError(adjErr.message); return; }
    setAdjQty("");
    setAdjReason("");
    setProduct((prev) => prev ? { ...prev, stock_quantity: newQty } : prev);
    await load();
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (loading) return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-20" />)}
        </div>
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-32" />
      </div>
    </main>
  );

  if (error && !product) return (
    <main className="p-6 max-w-4xl mx-auto">
      <p className="text-red-600">{error}</p>
    </main>
  );

  if (!product) return null;

  const margin = product.unit_price > 0
    ? ((product.unit_price - product.cost_price) / product.unit_price) * 100
    : 0;
  const isLow = product.stock_quantity <= product.low_stock_threshold;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => router.push("/inventory")}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-3"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
            {product.sku && <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{product.sku}</span>}
          </div>
          {product.category && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{product.category}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 ${isLow ? "border-yellow-400 dark:border-yellow-600" : "border-gray-200 dark:border-gray-700"}`}>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">In Stock</p>
          <p className={`font-semibold text-xl ${isLow ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}>{product.stock_quantity}</p>
          {isLow && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">{product.stock_quantity <= 0 ? "Out of stock" : "Low stock"}</p>}
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Sale Price</p>
          <p className="font-semibold text-xl text-gray-900 dark:text-white">{fmtMoney(product.unit_price)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Cost Price</p>
          <p className="font-semibold text-xl text-gray-900 dark:text-white">{fmtMoney(product.cost_price)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Margin</p>
          <p className="font-semibold text-xl text-gray-900 dark:text-white">{Math.round(margin)}%</p>
        </div>
      </div>

      {/* Adjust stock */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Adjust Stock</h2>
        <div className="grid grid-cols-[100px_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Qty (+/−)</label>
            <input
              type="number"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. 10 or -3"
              value={adjQty}
              onChange={(e) => setAdjQty(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Reason</label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. Restock, Sale, Damage"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
            />
          </div>
          <button
            onClick={applyAdjustment}
            disabled={saving}
            className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? "…" : "Apply"}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </section>

      {/* Adjustment history */}
      {adjustments.length > 0 && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Adjustment History</h2>
          <div className="grid gap-1">
            {adjustments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div>
                  <span className={`font-semibold ${a.adjustment > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {a.adjustment > 0 ? "+" : ""}{a.adjustment}
                  </span>
                  {a.reason && <span className="text-gray-500 dark:text-gray-400 ml-2">{a.reason}</span>}
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-xs">{fmtDate(a.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
