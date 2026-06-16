"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  customers: { name: string; email: string | null } | null;
  invoice_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

function PayPageInner() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`/api/pay/${token}/invoice`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setInvoice(d);
      });
  }, [token]);

  const pay = async () => {
    setPaying(true);
    const res = await fetch(`/api/pay/${token}/checkout`, { method: "POST" });
    const { url, error: err } = await res.json();
    if (err || !url) { setError(err ?? "Payment failed."); setPaying(false); return; }
    window.location.href = url;
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <p className="text-sm opacity-50">This invoice may not exist or the link is invalid.</p>
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="opacity-50">Loading invoice…</p>
      </main>
    );
  }

  const total = invoice.invoice_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const isPaid = invoice.status === "paid";
  const isVoid = invoice.status === "void";

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Invoice</p>
          <h1 className="text-2xl font-bold font-mono">{invoice.invoice_number}</h1>
          {invoice.customers && <p className="opacity-60 mt-1 text-sm">To: {invoice.customers.name}</p>}
        </div>

        {success && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-5 mb-6 text-center">
            <p className="text-green-700 dark:text-green-400 font-semibold mb-1">Payment received!</p>
            <p className="text-sm text-green-600 dark:text-green-500 opacity-80">Thank you — your payment has been processed.</p>
          </div>
        )}

        {isPaid && !success && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6 text-center">
            <p className="text-green-700 dark:text-green-400 font-medium text-sm">This invoice has already been paid.</p>
          </div>
        )}

        {isVoid && (
          <div className="bg-gray-100 dark:bg-neutral-900 rounded-xl p-4 mb-6 text-center">
            <p className="opacity-50 text-sm">This invoice has been voided.</p>
          </div>
        )}

        {/* Invoice card */}
        <div className="bg-white dark:bg-neutral-900 border rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="p-5 border-b text-sm grid grid-cols-2 gap-4">
            <div>
              <p className="opacity-40 text-xs mb-1">Issue Date</p>
              <p>{fmt(invoice.issue_date)}</p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="opacity-40 text-xs mb-1">Due Date</p>
                <p className="font-medium">{fmt(invoice.due_date)}</p>
              </div>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-neutral-800">
                <th className="text-left px-5 py-2.5 font-medium opacity-50 text-xs uppercase tracking-wide">Description</th>
                <th className="text-right px-5 py-2.5 font-medium opacity-50 text-xs uppercase tracking-wide w-16">Qty</th>
                <th className="text-right px-5 py-2.5 font-medium opacity-50 text-xs uppercase tracking-wide w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-5 py-3">{item.description}</td>
                  <td className="px-5 py-3 text-right tabular-nums opacity-60">{item.quantity}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{fmtMoney(item.quantity * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-5 py-4 border-t bg-gray-50 dark:bg-neutral-800 flex items-center justify-between">
            <span className="font-semibold">Total Due</span>
            <span className="font-bold text-xl tabular-nums">{fmtMoney(total)}</span>
          </div>
        </div>

        {invoice.notes && (
          <div className="bg-white dark:bg-neutral-900 border rounded-xl p-5 text-sm mb-4">
            <p className="opacity-40 text-xs mb-1 uppercase tracking-wide">Notes</p>
            <p className="whitespace-pre-wrap opacity-70">{invoice.notes}</p>
          </div>
        )}

        {!isPaid && !isVoid && !success && (
          <button
            onClick={pay}
            disabled={paying}
            className="w-full bg-black text-white dark:bg-white dark:text-black py-4 rounded-xl font-semibold text-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {paying ? "Redirecting to payment…" : `Pay ${fmtMoney(total)}`}
          </button>
        )}

        <p className="text-center text-xs opacity-30 mt-6">Powered by SoloBooks</p>
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center"><p className="opacity-50">Loading…</p></main>}>
      <PayPageInner />
    </Suspense>
  );
}
