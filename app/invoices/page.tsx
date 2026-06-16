"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Invoice = {
  id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "void";
  issue_date: string;
  due_date: string | null;
  customers: { name: string } | null;
  total: number;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "opacity-50",
  sent: "text-blue-600 dark:text-blue-400",
  paid: "text-green-600 dark:text-green-400",
  void: "opacity-30 line-through",
};

export default function InvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("invoicing");
      if (!active) { setGated(true); setLoading(false); return; }

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, status, issue_date, due_date,
          customers ( name ),
          invoice_items ( quantity, unit_price )
        `)
        .eq("user_id", sessionData.session.user.id)
        .order("issue_date", { ascending: false });

      if (error) { setError(error.message); setLoading(false); return; }

      const mapped = (data ?? []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        status: inv.status,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        customers: inv.customers,
        total: (inv.invoice_items ?? []).reduce(
          (sum: number, item: any) => sum + item.quantity * item.unit_price,
          0
        ),
      }));

      setInvoices(mapped);
      setLoading(false);
    })();
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Invoicing</h1>
        <p className="opacity-60 mb-6 text-sm">
          The Invoicing module isn&apos;t active on your plan.
        </p>
        <Link
          href="/plan"
          className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80"
        >
          Add Invoicing — $9 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm opacity-50 mt-0.5">
            {loading ? "Loading…" : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70"
        >
          New Invoice
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {invoices.length === 0 ? (
        <p className="opacity-50 text-sm">No invoices yet. Create your first one above.</p>
      ) : (
        <div className="grid gap-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="block border rounded-lg p-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium font-mono text-sm">{inv.invoice_number}</span>
                  <span className={`text-xs font-medium capitalize ${STATUS_STYLES[inv.status]}`}>
                    {inv.status}
                  </span>
                </div>
                <span className="font-medium tabular-nums">{fmtMoney(inv.total)}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm opacity-60">
                <span>{inv.customers?.name ?? "No customer"}</span>
                <span>·</span>
                <span>{fmt(inv.issue_date)}</span>
                {inv.due_date && (
                  <>
                    <span>·</span>
                    <span>Due {fmt(inv.due_date)}</span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
