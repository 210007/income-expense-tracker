"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Estimate = {
  id: string;
  estimate_number: string;
  status: string;
  issue_date: string;
  expiry_date: string | null;
  notes: string | null;
  customers: { name: string; email: string | null; phone: string | null; address: string | null } | null;
  estimate_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

export default function EstimatePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const { data, error } = await supabase
        .from("estimates")
        .select(`
          id, estimate_number, status, issue_date, expiry_date, notes,
          customers ( name, email, phone, address ),
          estimate_items ( id, description, quantity, unit_price )
        `)
        .eq("id", id)
        .eq("user_id", sessionData.session.user.id)
        .single();

      if (error || !data) { setError("Estimate not found."); return; }
      setEstimate(data as unknown as Estimate);
      setTimeout(() => window.print(), 500);
    })();
  }, [id]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!estimate) return <div className="p-8 opacity-50">Loading…</div>;

  const total = estimate.estimate_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        @page { margin: 1in; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2">
        <button onClick={() => window.print()} className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:opacity-80">
          Print / Save PDF
        </button>
        <button onClick={() => window.close()} className="border rounded px-4 py-2 text-sm hover:opacity-70">
          Close
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-12 font-sans text-sm text-gray-900">
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">ESTIMATE</h1>
            <p className="text-gray-500 font-mono">{estimate.estimate_number}</p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${
              estimate.status === "accepted" ? "bg-green-100 text-green-700" :
              estimate.status === "declined" ? "bg-red-100 text-red-600" :
              estimate.status === "converted" ? "bg-gray-100 text-gray-400" :
              "bg-blue-100 text-blue-700"
            }`}>
              {estimate.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Prepared For</p>
            {estimate.customers ? (
              <>
                <p className="font-semibold">{estimate.customers.name}</p>
                {estimate.customers.email && <p className="text-gray-600">{estimate.customers.email}</p>}
                {estimate.customers.phone && <p className="text-gray-600">{estimate.customers.phone}</p>}
                {estimate.customers.address && <p className="text-gray-600 whitespace-pre-line">{estimate.customers.address}</p>}
              </>
            ) : (
              <p className="text-gray-400">No customer</p>
            )}
          </div>
          <div className="text-right">
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Issue Date</p>
              <p>{fmt(estimate.issue_date)}</p>
            </div>
            {estimate.expiry_date && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Valid Until</p>
                <p className="font-medium">{fmt(estimate.expiry_date)}</p>
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
            {estimate.estimate_items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                <td className="py-3">{item.description}</td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right tabular-nums text-gray-600">{fmtMoney(item.unit_price)}</td>
                <td className="py-3 text-right tabular-nums font-medium">{fmtMoney(item.quantity * item.unit_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #111" }}>
              <td colSpan={3} className="pt-4 text-right font-bold text-base">Estimate Total</td>
              <td className="pt-4 text-right tabular-nums font-bold text-xl">{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>

        {estimate.notes && (
          <div className="border-t pt-6 mt-6">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Notes</p>
            <p className="text-gray-700 whitespace-pre-wrap">{estimate.notes}</p>
          </div>
        )}

        <div className="border-t mt-10 pt-6 text-center text-xs text-gray-400">
          This is an estimate, not a final invoice. Thank you for your consideration.
        </div>
      </div>
    </>
  );
}
