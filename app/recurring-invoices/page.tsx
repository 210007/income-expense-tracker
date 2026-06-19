"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type RecurringInvoice = {
  id: string;
  frequency: "weekly" | "monthly" | "yearly";
  next_run_date: string;
  end_date: string | null;
  active: boolean;
  auto_send: boolean;
  notes: string | null;
  customers: { name: string } | null;
  recurring_invoice_items: { quantity: number; unit_price: number }[];
};

const FREQ_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default function RecurringInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [rows, setRows] = useState<RecurringInvoice[]>([]);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const active = await hasModule("invoicing");
    if (!active) { setGated(true); setLoading(false); return; }

    const { data } = await supabase
      .from("recurring_invoices")
      .select(`
        id, frequency, next_run_date, end_date, active, auto_send, notes,
        customers ( name ),
        recurring_invoice_items ( quantity, unit_price )
      `)
      .eq("user_id", sessionData.session.user.id)
      .order("next_run_date", { ascending: true });

    setRows((data as unknown as RecurringInvoice[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("recurring_invoices").update({ active }).eq("id", id);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, active } : r));
  };

  const remove = async (id: string) => {
    await supabase.from("recurring_invoices").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Recurring Invoices</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Requires the Invoicing module.</p>
        <Link href="/plan" className="inline-block px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          Go to My Plan
        </Link>
      </main>
    );
  }

  const visible = showAll ? rows : rows.filter((r) => r.active);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{rows.filter((r) => r.active).length} active</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {showAll ? "Active only" : "Show all"}
          </button>
          <Link href="/recurring-invoices/new" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            + New Template
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {showAll ? "No recurring invoice templates yet." : "No active templates. "}
            <Link href="/recurring-invoices/new" className="underline">Create your first.</Link>
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          {visible.map((r, i) => {
            const total = r.recurring_invoice_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
            return (
              <div key={r.id} className={`p-4 flex items-center justify-between gap-4 ${i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""} ${!r.active ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{r.customers?.name ?? "No customer"}</p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 capitalize">{FREQ_LABEL[r.frequency]}</span>
                    {r.auto_send && <span className="text-xs text-gray-400 dark:text-gray-500">Auto-send</span>}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Next: {fmtDate(r.next_run_date)}
                    {r.end_date ? ` · Until ${fmtDate(r.end_date)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold tabular-nums text-sm text-gray-900 dark:text-white">{fmtMoney(total)}</span>
                  <Link
                    href={`/recurring-invoices/${r.id}/edit`}
                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => toggle(r.id, !r.active)}
                    className={`px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors ${
                      r.active
                        ? "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        : "border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                    }`}
                  >
                    {r.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-sm text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-sm text-gray-500 dark:text-gray-400">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">How it works</p>
        <p>Templates run automatically each morning. A new invoice is created in your account and, if Auto-send is on, emailed to the customer. Requires the Invoicing module to be active.</p>
      </div>
    </main>
  );
}
