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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Time Tracking</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Time Tracking — $9 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Time Tracking</h1>
          <p className="text-sm opacity-50 mt-0.5">{visible.length} entr{visible.length !== 1 ? "ies" : "y"}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden text-sm">
            {(["uninvoiced", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelected(new Set()); }}
                className={`px-3 py-1.5 capitalize ${filter === f ? "bg-black text-white dark:bg-white dark:text-black" : "hover:opacity-70"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <Link href="/time/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">
            Log Time
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {selected.size > 0 && (
        <div className="border rounded-lg p-4 mb-4 flex items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-medium">{selected.size} entr{selected.size !== 1 ? "ies" : "y"} selected</span>
            <span className="opacity-50 ml-2">— {fmtMoney(selectedTotal)}</span>
          </div>
          <button
            onClick={createInvoiceFromTime}
            disabled={creating}
            className="bg-black text-white dark:bg-white dark:text-black rounded px-3 py-1.5 text-sm font-medium hover:opacity-80 disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="opacity-50 text-sm">
          {filter === "uninvoiced" ? "No uninvoiced time entries." : "No time entries yet."}{" "}
          <Link href="/time/new" className="underline">Log time.</Link>
        </p>
      ) : (
        <div className="grid gap-2">
          {visible.map((e) => (
            <div
              key={e.id}
              onClick={() => !e.invoiced && toggleSelect(e.id)}
              className={`border rounded-lg p-4 flex items-center gap-4 ${!e.invoiced ? "cursor-pointer hover:opacity-80" : "opacity-50"} ${selected.has(e.id) ? "border-black dark:border-white" : ""}`}
            >
              {!e.invoiced && (
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggleSelect(e.id)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium truncate">{e.description}</span>
                  <span className="tabular-nums font-medium shrink-0">{fmtMoney(e.hours * e.rate)}</span>
                </div>
                <div className="text-sm opacity-60 mt-0.5 flex gap-2">
                  {e.customers && <span>{e.customers.name}</span>}
                  {e.customers && <span>·</span>}
                  <span>{e.hours}h @ {fmtMoney(e.rate)}/hr</span>
                  <span>·</span>
                  <span>{fmt(e.entry_date)}</span>
                  {e.invoiced && <><span>·</span><span className="text-green-600 dark:text-green-400">Invoiced</span></>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
