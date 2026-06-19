"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  cost_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  category: string | null;
  is_active: boolean;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"active" | "low" | "all">("active");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }
      const active = await hasModule("inventory");
      if (!active) { setGated(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, unit_price, cost_price, stock_quantity, low_stock_threshold, category, is_active")
        .eq("user_id", sessionData.session.user.id)
        .eq("type", "product")
        .order("name");
      if (error) { setError(error.message); setLoading(false); return; }
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const lowCount = products.filter(
    (p) => p.is_active && p.stock_quantity <= (p.low_stock_threshold ?? 0)
  ).length;

  const visible = products.filter((p) => {
    if (filter === "active") return p.is_active;
    if (filter === "low") return p.is_active && p.stock_quantity <= (p.low_stock_threshold ?? 0);
    return true;
  });

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-9 bg-gray-200 dark:bg-gray-800 rounded-xl w-48" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl" />)}
          </div>
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Inventory</h1>
        <p className="text-sm text-gray-500 mb-6">Track stock levels, costs, and reorder points for your products.</p>
        <Link href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Add Inventory — $12/mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {products.filter((p) => p.is_active).length} products
            {lowCount > 0 && (
              <span className="ml-2 text-orange-500 dark:text-orange-400 font-medium">
                · {lowCount} low stock
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {(["active", "low", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  filter === f ? "brand-gradient text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {f === "low" ? "Low Stock" : f === "active" ? "Active" : "All"}
              </button>
            ))}
          </div>
          <Link
            href="/inventory/new"
            className="flex items-center gap-1.5 h-9 px-4 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Link>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-400 mb-3">
            {filter === "low" ? "No low-stock items." : "No products yet."}
          </p>
          <Link href="/inventory/new" className="text-sm text-blue-500 hover:text-blue-600">
            Add your first product →
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map((p) => {
            const isLow = p.stock_quantity <= (p.low_stock_threshold ?? 0);
            const isOut = p.stock_quantity <= 0;
            const margin = p.cost_price && p.unit_price > 0
              ? Math.round(((p.unit_price - p.cost_price) / p.unit_price) * 100)
              : null;

            return (
              <Link
                key={p.id}
                href={`/inventory/${p.id}`}
                className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  isOut ? "bg-red-500" : isLow ? "bg-orange-400" : "bg-green-500"
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{p.name}</p>
                    {p.sku && (
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {p.sku}
                      </span>
                    )}
                    {(isOut || isLow) && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isOut
                          ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                          : "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
                      }`}>
                        {isOut ? "Out of stock" : "Low stock"}
                      </span>
                    )}
                  </div>
                  {p.category && (
                    <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 dark:text-white">{money(p.unit_price)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.stock_quantity} in stock
                    {margin !== null && ` · ${margin}% margin`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
