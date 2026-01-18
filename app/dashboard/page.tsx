"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TxnRow = {
  id: string;
  txn_date: string; // YYYY-MM-DD
  type: "income" | "expense";
  amount: number;
  vendor: string | null;
  description: string | null;
  category: string | null;
};

function startOfMonthISO(d: Date) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  return dt.toISOString().slice(0, 10);
}

function startOfNextMonthISO(d: Date) {
  const dt = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return dt.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [receiptCounts, setReceiptCounts] = useState<Record<string, number>>(
    {}
  );

  // Account menu
  const [menuOpen, setMenuOpen] = useState(false);

  // Sync button
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-account-menu]")) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => startOfMonthISO(now), [now]);
  const nextMonthStart = useMemo(() => startOfNextMonthISO(now), [now]);

  const monthLabel = useMemo(() => {
    return now.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [now]);

  const money = useMemo(
    () => (n: number) =>
      n.toLocaleString(undefined, { style: "currency", currency: "USD" }),
    []
  );

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    // Pull this month's transactions
    const { data: txnData, error: txnErr } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description, category")
      .gte("txn_date", monthStart)
      .lt("txn_date", nextMonthStart)
      .order("txn_date", { ascending: false });

    if (txnErr) {
      setLoading(false);
      setError(txnErr.message);
      return;
    }

    const rows = (txnData as TxnRow[]) ?? [];
    setTxns(rows);

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      setReceiptCounts({});
      setLoading(false);
      return;
    }

    // Receipt counts for those transaction ids
    const { data: recData, error: recErr } = await supabase
      .from("receipts")
      .select("transaction_id")
      .in("transaction_id", ids);

    if (recErr) {
      setLoading(false);
      setError(recErr.message);
      return;
    }

    const counts: Record<string, number> = {};
    for (const r of (recData as { transaction_id: string }[]) ?? []) {
      counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
    }
    setReceiptCounts(counts);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo(() => {
    let income = 0;
    let expenses = 0;

    for (const t of txns) {
      if (t.type === "income") income += Number(t.amount);
      if (t.type === "expense") expenses += Number(t.amount);
    }

    const net = income - expenses;

    const expenseTxns = txns.filter((t) => t.type === "expense");
    const expenseWithReceipt = expenseTxns.filter(
      (t) => (receiptCounts[t.id] ?? 0) > 0
    );

    const missingCount = expenseTxns.length - expenseWithReceipt.length;

    const coverage =
      expenseTxns.length === 0
        ? 0
        : Math.round((expenseWithReceipt.length / expenseTxns.length) * 100);

    return {
      income,
      expenses,
      net,
      coverage,
      txnCount: txns.length,
      expenseCount: expenseTxns.length,
      missingCount,
    };
  }, [txns, receiptCounts]);

  const recent = useMemo(() => txns.slice(0, 5), [txns]);

  // Category totals (month) – expenses only
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const t of txns) {
      if (t.type !== "expense") continue;
      const cat = t.category || "Uncategorized";
      totals.set(cat, (totals.get(cat) ?? 0) + Number(t.amount));
    }

    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [txns]);

  const syncPlaid = async () => {
    setSyncing(true);
    setSyncError(null);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      setSyncing(false);
      setSyncError("Not logged in.");
      return;
    }

    const res = await fetch("/api/plaid/import-transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = await res.json();
    setSyncing(false);

    if (!res.ok) {
      setSyncError(json?.error || "Failed to sync.");
      return;
    }

    window.location.reload();
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      {/* Header + account menu */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Income / Expense Tracker</h1>
            <p className="opacity-80 mt-1">{monthLabel}</p>
          </div>

          <div className="relative" data-account-menu>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="border rounded-full w-10 h-10 flex items-center justify-center font-semibold"
              aria-label="Account menu"
            >
              <span className="text-lg">👤</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 border rounded bg-black shadow-lg overflow-hidden z-50">
                <a
                  href="/settings"
                  className="block px-4 py-3 text-sm hover:bg-white/10"
                >
                  Settings
                </a>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-white/10"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/login";
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href="/transactions"
            className="text-center bg-black text-white py-3 rounded font-medium"
          >
            Transactions
          </a>

          <a
            href="/transactions?missing=1"
            className="text-center border py-3 rounded font-medium relative"
          >
            Missing Receipts
            {metrics.missingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                {metrics.missingCount}
              </span>
            )}
          </a>

          <a
            href="/export"
            className="text-center border py-3 rounded font-medium"
          >
            Export to Excel
          </a>

          <button
            className="text-center border py-3 rounded font-medium disabled:opacity-50"
            disabled={syncing}
            onClick={syncPlaid}
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>

        {syncError && <p className="text-red-600 mt-1">{syncError}</p>}
      </div>

      {error && <p className="text-red-600 mt-4">{error}</p>}

      {loading ? (
        <p className="mt-4">Loading…</p>
      ) : (
        <>
          {/* Summary cards */}
          <section className="grid gap-3 mt-5">
            <div className="border rounded p-4">
              <div className="text-sm opacity-80">Income (month)</div>
              <div className="text-xl font-semibold mt-1">
                {money(metrics.income)}
              </div>
            </div>

            <div className="border rounded p-4">
              <div className="text-sm opacity-80">Expenses (month)</div>
              <div className="text-xl font-semibold mt-1">
                {money(metrics.expenses)}
              </div>
            </div>

            <div className="border rounded p-4">
              <div className="text-sm opacity-80">Net (month)</div>
              <div className="text-xl font-semibold mt-1">
                {money(metrics.net)}
              </div>
              <div className="text-sm opacity-80 mt-1">
                {metrics.txnCount} transactions this month
              </div>
            </div>

            <div className="border rounded p-4">
              <div className="text-sm opacity-80">Receipt coverage</div>
              <div className="text-xl font-semibold mt-1">
                {metrics.coverage}%
              </div>
              <div className="text-sm opacity-80 mt-1">
                {metrics.expenseCount} expense transactions this month
              </div>
            </div>
          </section>

          {/* Category breakdown */}
          <section className="mt-7">
            <h2 className="font-semibold">Spending by category (month)</h2>

            {categoryTotals.length === 0 ? (
              <p className="opacity-80 mt-2">No expenses yet this month.</p>
            ) : (
              <div className="grid gap-2 mt-3">
                {categoryTotals.map((c) => (
                  <div key={c.category} className="border rounded p-4">
                    <div className="flex justify-between gap-3">
                      <div className="font-medium">{c.category}</div>
                      <div className="whitespace-nowrap">{money(c.total)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent */}
          <section className="mt-7">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recent</h2>
              <a
                className="border rounded px-3 py-2 text-sm font-medium"
                href="/transactions"
              >
                View all
              </a>
            </div>

            {recent.length === 0 ? (
              <p className="opacity-80 mt-2">No transactions yet this month.</p>
            ) : (
              <div className="grid gap-2 mt-3">
                {recent.map((t) => {
                  const sign = t.type === "expense" ? "-" : "+";
                  const amount = `${sign}${money(Number(t.amount))}`;
                  const hasReceipt = (receiptCounts[t.id] ?? 0) > 0;

                  return (
                    <a
                      key={t.id}
                      href={`/transactions/${t.id}`}
                      className="block border rounded p-4 active:opacity-80"
                    >
                      <div className="flex justify-between gap-3">
                        <div className="font-medium">
                          {t.vendor || "(No vendor)"} —{" "}
                          {t.description || "(No description)"}
                        </div>
                        <div className="whitespace-nowrap">{amount}</div>
                      </div>

                      <div className="flex justify-between text-sm opacity-80 mt-2">
                        <div>{t.txn_date}</div>
                        <div>
                          {(t.category || "Uncategorized") +
                            " • " +
                            (hasReceipt ? "Receipt ✅" : "No receipt")}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
