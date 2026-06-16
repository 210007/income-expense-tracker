"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type RecurringTx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  vendor: string;
  description: string | null;
  category: string | null;
  frequency: string;
  next_run_date: string;
  end_date: string | null;
  active: boolean;
};

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default function RecurringPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [rows, setRows] = useState<RecurringTx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const active = await hasModule("recurring");
    if (!active) { setGated(true); setLoading(false); return; }

    const { data, error } = await supabase
      .from("recurring_transactions")
      .select("id, type, amount, vendor, description, category, frequency, next_run_date, end_date, active")
      .eq("user_id", sessionData.session.user.id)
      .order("next_run_date", { ascending: true });

    if (error) { setError(error.message); setLoading(false); return; }
    setRows((data as RecurringTx[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    setToggling(id);
    await supabase.from("recurring_transactions").update({ active: !current }).eq("id", id);
    setToggling(null);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, active: !current } : r));
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Recurring Transactions</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link
          href="/plan"
          className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80"
        >
          Add Recurring — $6 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Recurring Transactions</h1>
          <p className="text-sm opacity-50 mt-0.5">
            {rows.length} series · auto-logged on schedule
          </p>
        </div>
        <Link
          href="/recurring/new"
          className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70"
        >
          New Series
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {rows.length === 0 ? (
        <p className="opacity-50 text-sm">No recurring transactions yet. Add your first one above.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`border rounded-lg p-4 flex items-center justify-between gap-4 ${!r.active ? "opacity-40" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.vendor}</span>
                  <span className={`text-xs font-medium ${r.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {r.type === "income" ? "+" : "−"}{fmtMoney(r.amount)}
                  </span>
                </div>
                <div className="text-sm opacity-60 mt-0.5 flex gap-2">
                  <span>{FREQ_LABEL[r.frequency]}</span>
                  <span>·</span>
                  <span>Next: {fmtDate(r.next_run_date)}</span>
                  {r.category && <><span>·</span><span>{r.category}</span></>}
                </div>
              </div>
              <button
                onClick={() => toggleActive(r.id, r.active)}
                disabled={toggling === r.id}
                className="border rounded px-3 py-1.5 text-xs font-medium hover:opacity-70 disabled:opacity-40 whitespace-nowrap"
              >
                {toggling === r.id ? "…" : r.active ? "Pause" : "Resume"}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
