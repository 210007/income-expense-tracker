"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type TimeEntry = {
  id: string;
  description: string;
  hours: number;
  rate: number;
  entry_date: string;
  invoiced: boolean;
  invoice_id: string | null;
  customers: { id: string; name: string } | null;
};

export default function TimePage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"uninvoiced" | "all">("uninvoiced");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const active = await hasModule("time_tracking");
    if (!active) { setGated(true); setLoading(false); return; }

    setUserId(sessionData.session.user.id);

    const { data, error } = await supabase
      .from("time_entries")
      .select("id, description, hours, rate, entry_date, invoiced, invoice_id, customers(id, name)")
      .eq("user_id", sessionData.session.user.id)
      .order("entry_date", { ascending: false });

    if (error) { setError(error.message); setLoading(false); return; }
    setEntries((data as unknown as TimeEntry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = filter === "uninvoiced" ? entries.filter((e) => !e.invoiced) : entries;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedEntries = visible.filter((e) => selected.has(e.id));
  const selectedTotal = selectedEntries.reduce((sum, e) => sum + e.hours * e.rate, 0);

  const createInvoiceFromTime = async () => {
    if (!userId || selectedEntries.length === 0) return;
    setCreating(true);
    setError(null);

    // Get customer from first selected entry (all should match ideally)
    const customerId = selectedEntries[0].customers?.id ?? null;

    const { data: lastInv } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastNum = (lastInv?.[0]?.invoice_number ?? "INV-000").replace(/\D/g, "");
    const next = String(parseInt(lastNum || "0") + 1).padStart(3, "0");

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        customer_id: customerId,
        invoice_number: `INV-${next}`,
        status: "draft",
        issue_date: new Date().toISOString().slice(0, 10),
        notes: "Generated from time entries.",
      })
      .select("id")
      .single();

    if (invErr || !inv) { setError(invErr?.message ?? "Failed to create invoice."); setCreating(false); return; }

    // Insert line items from time entries
    await supabase.from("invoice_items").insert(
      selectedEntries.map((e) => ({
        invoice_id: inv.id,
        description: e.description,
        quantity: e.hours,
        unit_price: e.rate,
      }))
    );

    // Mark entries as invoiced
    await supabase
      .from("time_entries")
      .update({ invoiced: true, invoice_id: inv.id })
      .in("id", selectedEntries.map((e) => e.id));

    window.location.href = `/invoices/${inv.id}`;
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-2xl w-44 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-2xl w-24" />
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
          ))}
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Time Tracking</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          Add Time Tracking — $9 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Tracking</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {visible.length} entr{visible.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden text-sm">
            {(["uninvoiced", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelected(new Set()); }}
                className={`px-4 py-2 capitalize font-medium transition-colors ${
                  filter === f
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Link href="/time/new" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            Log Time
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {selected.size > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-semibold text-gray-900 dark:text-white">
              {selected.size} entr{selected.size !== 1 ? "ies" : "y"} selected
            </span>
            <span className="text-gray-400 dark:text-gray-500 ml-2">— {fmtMoney(selectedTotal)}</span>
          </div>
          <button
            onClick={createInvoiceFromTime}
            disabled={creating}
            className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === "uninvoiced" ? "No uninvoiced time entries." : "No time entries yet."}
          </p>
          <Link href="/time/new" className="inline-block mt-3 px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            Log Time
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((e) => (
            <div
              key={e.id}
              onClick={() => !e.invoiced && toggleSelect(e.id)}
              className={`flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border rounded-2xl transition-all ${
                e.invoiced
                  ? "border-gray-100 dark:border-gray-800 opacity-60"
                  : selected.has(e.id)
                  ? "border-blue-500 dark:border-blue-400 shadow-sm cursor-pointer"
                  : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm cursor-pointer"
              }`}
            >
              {!e.invoiced && (
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggleSelect(e.id)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="shrink-0 w-4 h-4 rounded border-gray-300 accent-blue-500"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{e.description}</span>
                  <span className="tabular-nums font-semibold text-sm text-gray-900 dark:text-white shrink-0">{fmtMoney(e.hours * e.rate)}</span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                  {e.customers && <span>{e.customers.name}</span>}
                  {e.customers && <span>·</span>}
                  <span>{e.hours}h @ {fmtMoney(e.rate)}/hr</span>
                  <span>·</span>
                  <span>{fmt(e.entry_date)}</span>
                  {e.invoiced && (
                    <>
                      <span>·</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">Invoiced</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
