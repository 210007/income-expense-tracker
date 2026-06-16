"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PO = {
  id: string;
  po_number: string;
  vendor: string;
  vendor_email: string | null;
  status: string;
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  purchase_order_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

export default function POPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, vendor, vendor_email, status, order_date, expected_date, notes, purchase_order_items(id, description, quantity, unit_price)")
        .eq("id", id)
        .eq("user_id", sessionData.session.user.id)
        .single();

      if (error || !data) { setError("Purchase order not found."); return; }
      setPo(data as unknown as PO);
      setTimeout(() => window.print(), 500);
    })();
  }, [id]);

  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!po) return <div className="p-8 opacity-50">Loading…</div>;

  const total = po.purchase_order_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);

  return (
    <>
      <style>{`
        @media print { .no-print { display: none !important; } body { margin: 0; } }
        @page { margin: 1in; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2">
        <button onClick={() => window.print()} className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:opacity-80">
          Print / Save PDF
        </button>
        <button onClick={() => window.close()} className="border rounded px-4 py-2 text-sm hover:opacity-70">Close</button>
      </div>

      <div className="max-w-2xl mx-auto p-12 font-sans text-sm text-gray-900">
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">PURCHASE ORDER</h1>
            <p className="text-gray-500 font-mono">{po.po_number}</p>
          </div>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${
            po.status === "received" ? "bg-green-100 text-green-700" :
            po.status === "cancelled" ? "bg-gray-100 text-gray-400" :
            "bg-blue-100 text-blue-700"
          }`}>{po.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Vendor</p>
            <p className="font-semibold">{po.vendor}</p>
            {po.vendor_email && <p className="text-gray-600">{po.vendor_email}</p>}
          </div>
          <div className="text-right">
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Order Date</p>
              <p>{fmt(po.order_date)}</p>
            </div>
            {po.expected_date && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Expected Delivery</p>
                <p className="font-medium">{fmt(po.expected_date)}</p>
              </div>
            )}
          </div>
        </div>

        <table className="w-full mb-6" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #111" }}>
              <th className="text-left py-2 font-semibold text-xs uppercase tracking-wider text-gray-500">Description</th>
              <th className="text-right py-2 font-semibold text-xs uppercase tracking-wider text-gray-500 w-16">Qty</th>
              <th className="text-right py-2 font-semibold text-xs uppercase tracking-wider text-gray-500 w-28">Unit Price</th>
              <th className="text-right py-2 font-semibold text-xs uppercase tracking-wider text-gray-500 w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.purchase_order_items.map((it) => (
              <tr key={it.id} style={{ borderBottom: "1px solid #eee" }}>
                <td className="py-3">{it.description}</td>
                <td className="py-3 text-right tabular-nums">{Number(it.quantity)}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{fmtMoney(Number(it.unit_price))}</td>
                <td className="py-3 text-right tabular-nums font-medium">{fmtMoney(Number(it.quantity) * Number(it.unit_price))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #111" }}>
              <td colSpan={3} className="pt-4 text-right font-bold text-base">Total</td>
              <td className="pt-4 text-right tabular-nums font-bold text-xl">{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>

        {po.notes && (
          <div className="border-t pt-6 mt-6">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Notes</p>
            <p className="text-gray-700 whitespace-pre-wrap">{po.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
