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

const STATUS_STYLE: Record<string, string> = {
  draft: "opacity-40",
  sent: "text-blue-600 dark:text-blue-400",
  received: "text-green-600 dark:text-green-400",
  cancelled: "opacity-30 line-through",
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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Purchase Orders</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
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
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
          <p className="text-sm opacity-50 mt-0.5">{orders.filter((o) => o.status !== "received" && o.status !== "cancelled").length} open</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden text-sm">
            {(["open", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 capitalize ${filter === f ? "bg-black text-white dark:bg-white dark:text-black" : "hover:opacity-70"}`}>
                {f}
              </button>
            ))}
          </div>
          <Link href="/purchase-orders/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">
            New PO
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="opacity-50 text-sm">No purchase orders. <Link href="/purchase-orders/new" className="underline">Create one.</Link></p>
      ) : (
        <div className="grid gap-2">
          {visible.map((o) => {
            const total = o.purchase_order_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
            return (
              <Link key={o.id} href={`/purchase-orders/${o.id}`} className="block border rounded-lg p-4 hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-medium">{o.vendor}</span>
                    <span className="text-xs opacity-40 font-mono">{o.po_number}</span>
                    <span className={`text-xs font-medium capitalize ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                  </div>
                  <span className="tabular-nums font-medium text-sm shrink-0">{fmtMoney(total)}</span>
                </div>
                <div className="text-xs opacity-40 mt-1">
                  Ordered {fmtDate(o.order_date)}
                  {o.expected_date ? ` · Expected ${fmtDate(o.expected_date)}` : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
