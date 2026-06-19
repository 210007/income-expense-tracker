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

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  sent: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  void: "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400",
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

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-40" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invoicing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          The Invoicing module isn&apos;t active on your plan.
        </p>
        <Link
          href="/plan"
          className="inline-block px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "Loading…" : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          New Invoice
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {invoices.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">No invoices yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-semibold font-mono text-sm text-gray-900 dark:text-white">{inv.invoice_number}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[inv.status]}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500 dark:text-gray-400">
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
              </div>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{fmtMoney(inv.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
