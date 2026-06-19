"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type PO = {
  id: string;
  po_number: string;
  vendor: string;
  status: "draft" | "sent" | "received" | "cancelled";
  order_date: string;
  expected_date: string | null;
  purchase_order_items: { quantity: number; unit_price: number }[];
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  sent: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  received: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  cancelled: "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400",
};

export default function PurchaseOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [orders, setOrders] = useState<PO[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }
      const active = await hasModule("purchase_orders");
      if (!active) { setGated(true); setLoading(false); return; }
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, vendor, status, order_date, expected_date, purchase_order_items(quantity, unit_price)")
        .eq("user_id", sessionData.session.user.id)
        .order("order_date", { ascending: false });
      setOrders((data as PO[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-44 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Purchase Orders</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          Add Purchase Orders — $6 / mo
        </Link>
      </main>
    );
  }

  const visible = filter === "open"
    ? orders.filter((o) => o.status !== "received" && o.status !== "cancelled")
    : orders;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {orders.filter((o) => o.status !== "received" && o.status !== "cancelled").length} open
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden text-sm">
            {(["open", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 font-semibold capitalize transition-colors ${
                  filter === f
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Link href="/purchase-orders/new" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            New PO
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No purchase orders.{" "}
            <Link href="/purchase-orders/new" className="underline">Create one.</Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {visible.map((o) => {
            const total = o.purchase_order_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
            return (
              <Link
                key={o.id}
                href={`/purchase-orders/${o.id}`}
                className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{o.vendor}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{o.po_number}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[o.status]}`}>
                    {o.status}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums text-sm text-gray-900 dark:text-white">{fmtMoney(total)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {fmtDate(o.order_date)}
                    {o.expected_date ? ` · Exp ${fmtDate(o.expected_date)}` : ""}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
