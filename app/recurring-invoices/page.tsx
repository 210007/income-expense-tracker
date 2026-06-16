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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Recurring Invoices</h1>
        <p className="opacity-60 mb-6 text-sm">Requires the Invoicing module.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
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
          <h1 className="text-2xl font-semibold">Recurring Invoices</h1>
          <p className="text-sm opacity-50 mt-0.5">{rows.filter((r) => r.active).length} active</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="border rounded px-3 py-1.5 text-sm hover:opacity-70"
          >
            {showAll ? "Active only" : "Show all"}
          </button>
          <Link href="/recurring-invoices/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">
            + New Template
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="opacity-50 text-sm">
          {showAll ? "No recurring invoice templates yet." : "No active templates. "}
          <Link href="/recurring-invoices/new" className="underline">Create your first.</Link>
        </p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {visible.map((r, i) => {
            const total = r.recurring_invoice_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
            return (
              <div key={r.id} className={`p-4 flex items-center justify-between gap-4 ${i > 0 ? "border-t" : ""} ${!r.active ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{r.customers?.name ?? "No customer"}</p>
                    <span className="text-xs border rounded-full px-2 py-0.5 opacity-60">{FREQ_LABEL[r.frequency]}</span>
                    {r.auto_send && <span className="text-xs opacity-40">Auto-send</span>}
                  </div>
                  <p className="text-xs opacity-40 mt-0.5">
                    Next: {fmtDate(r.next_run_date)}
                    {r.end_date ? ` · Until ${fmtDate(r.end_date)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium tabular-nums text-sm">{fmtMoney(total)}</span>
                  <button
                    onClick={() => toggle(r.id, !r.active)}
                    className={`text-xs border rounded px-2 py-1 hover:opacity-70 ${r.active ? "opacity-60" : "border-green-500 text-green-600 dark:text-green-400"}`}
                  >
                    {r.active ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => remove(r.id)} className="text-sm opacity-30 hover:opacity-70 hover:text-red-500">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 border rounded-xl p-4 text-sm opacity-60">
        <p className="font-medium mb-1">How it works</p>
        <p>Templates run automatically each morning. A new invoice is created in your account and, if Auto-send is on, emailed to the customer. Requires the Invoicing module to be active.</p>
      </div>
    </main>
  );
}
