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
  cost_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  category: string | null;
  active: boolean;
};

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
        .select("id, name, sku, unit_price, cost_price, stock_quantity, low_stock_threshold, category, active")
        .eq("user_id", sessionData.session.user.id)
        .order("name");
      if (error) { setError(error.message); setLoading(false); return; }
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const visible = products.filter((p) => {
    if (filter === "active") return p.active;
    if (filter === "low") return p.active && p.stock_quantity <= p.low_stock_threshold;
    return true;
  });

  const lowCount = products.filter((p) => p.active && p.stock_quantity <= p.low_stock_threshold).length;

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Inventory</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Inventory — $12 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm opacity-50 mt-0.5">
            {products.filter((p) => p.active).length} products
            {lowCount > 0 && <span className="text-yellow-600 dark:text-yellow-400 ml-2">· {lowCount} low stock</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden text-sm">
            {(["active", "low", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 capitalize ${filter === f ? "bg-black text-white dark:bg-white dark:text-black" : "hover:opacity-70"}`}>
                {f === "low" ? "Low Stock" : f}
              </button>
            ))}
          </div>
          <Link href="/inventory/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">Add Product</Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {visible.length === 0 ? (
        <p className="opacity-50 text-sm">No products found. <Link href="/inventory/new" className="underline">Add one.</Link></p>
      ) : (
        <div className="grid gap-2">
          {visible.map((p) => {
            const isLow = p.stock_quantity <= p.low_stock_threshold;
            return (
              <Link key={p.id} href={`/inventory/${p.id}`} className="block border rounded-lg p-4 hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-medium">{p.name}</span>
                    {p.sku && <span className="text-xs opacity-40 font-mono">{p.sku}</span>}
                    {isLow && (
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        {p.stock_quantity <= 0 ? "Out of stock" : "Low stock"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span className="tabular-nums opacity-60">{p.stock_quantity} in stock</span>
                    <span className="tabular-nums font-medium">{fmtMoney(p.unit_price)}</span>
                  </div>
                </div>
                {p.category && <p className="text-xs opacity-40 mt-1">{p.category}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
