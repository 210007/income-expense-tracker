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

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Recurring Transactions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This module isn&apos;t active on your plan.</p>
        <Link
          href="/plan"
          className="inline-block px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {rows.length} series · auto-logged on schedule
          </p>
        </div>
        <Link
          href="/recurring/new"
          className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          New Series
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {rows.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">No recurring transactions yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all ${!r.active ? "opacity-40" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{r.vendor}</span>
                  <span className={`text-xs font-semibold ${r.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {r.type === "income" ? "+" : "−"}{fmtMoney(r.amount)}
                  </span>
                </div>
                <div className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 flex gap-2">
                  <span>{FREQ_LABEL[r.frequency]}</span>
                  <span>·</span>
                  <span>Next: {fmtDate(r.next_run_date)}</span>
                  {r.category && <><span>·</span><span>{r.category}</span></>}
                </div>
              </div>
              <button
                onClick={() => toggleActive(r.id, r.active)}
                disabled={toggling === r.id}
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 whitespace-nowrap"
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
