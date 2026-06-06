"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TxnRow = {
  id: string;
  txn_date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string | null;
  description: string | null;
  category: string | null;
};

function isoStart(year: number, month: number) {
  return new Date(year, month, 1).toISOString().slice(0, 10);
}

function isoEnd(year: number, month: number) {
  return new Date(year, month + 1, 1).toISOString().slice(0, 10);
}

function fmtMonth(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [receiptCounts, setReceiptCounts] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const money = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const { data: txnData, error: txnErr } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description, category")
      .gte("txn_date", isoStart(year, month))
      .lt("txn_date", isoEnd(year, month))
      .order("txn_date", { ascending: false });

    if (txnErr) { setError(txnErr.message); setLoading(false); return; }

    const rows = (txnData as TxnRow[]) ?? [];
    setTxns(rows);

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) { setReceiptCounts({}); setLoading(false); return; }

    const { data: recData, error: recErr } = await supabase
      .from("receipts")
      .select("transaction_id")
      .in("transaction_id", ids);

    if (recErr) { setError(recErr.message); setLoading(false); return; }

    const counts: Record<string, number> = {};
    for (const r of (recData as { transaction_id: string }[]) ?? []) {
      counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
    }
    setReceiptCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, month]);

  const metrics = useMemo(() => {
    let income = 0, expenses = 0;
    for (const t of txns) {
      if (t.type === "income") income += Number(t.amount);
      if (t.type === "expense") expenses += Number(t.amount);
    }
    const net = income - expenses;
    const expenseTxns = txns.filter((t) => t.type === "expense");
    const withReceipt = expenseTxns.filter((t) => (receiptCounts[t.id] ?? 0) > 0);
    const missingCount = expenseTxns.length - withReceipt.length;
    const coverage =
      expenseTxns.length === 0
        ? 0
        : Math.round((withReceipt.length / expenseTxns.length) * 100);
    return { income, expenses, net, coverage, txnCount: txns.length, expenseCount: expenseTxns.length, missingCount };
  }, [txns, receiptCounts]);

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

  const maxCat = useMemo(
    () => Math.max(...categoryTotals.map((c) => c.total), 1),
    [categoryTotals]
  );

  const recent = useMemo(() => txns.slice(0, 5), [txns]);

  const syncPlaid = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncMsg(null);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) { setSyncing(false); setSyncError("Not logged in."); return; }

    const res = await fetch("/api/plaid/import-transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    setSyncing(false);

    if (!res.ok) { setSyncError(json?.error || "Sync failed."); return; }

    const n = json.upserted ?? json.inserted ?? 0;
    setSyncMsg(`Synced — ${n} transaction${n !== 1 ? "s" : ""} updated.`);
    await load();
  };

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{fmtMonth(year, month)}</h1>
          <p className="text-sm opacity-50 mt-0.5">{metrics.txnCount} transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70"
          >
            ←
          </button>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-30"
          >
            →
          </button>
          <button
            onClick={syncPlaid}
            disabled={syncing}
            className="border rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ml-1"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {syncError && <p className="text-red-600 text-sm mb-4">{syncError}</p>}
      {syncMsg && <p className="opacity-60 text-sm mb-4">{syncMsg}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="opacity-50">Loading…</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="border rounded-lg p-4">
              <div className="text-xs opacity-50 uppercase tracking-wide mb-1">Income</div>
              <div className="text-xl font-semibold text-green-600 dark:text-green-400">
                {money(metrics.income)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs opacity-50 uppercase tracking-wide mb-1">Expenses</div>
              <div className="text-xl font-semibold text-red-600 dark:text-red-400">
                {money(metrics.expenses)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs opacity-50 uppercase tracking-wide mb-1">Net</div>
              <div
                className={`text-xl font-semibold ${
                  metrics.net >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {money(metrics.net)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs opacity-50 uppercase tracking-wide mb-1">
                Receipt Coverage
              </div>
              <div className="text-xl font-semibold">{metrics.coverage}%</div>
              {metrics.missingCount > 0 && (
                <a
                  href="/transactions?missing=1"
                  className="text-xs text-orange-500 mt-1 block"
                >
                  {metrics.missingCount} missing →
                </a>
              )}
            </div>
          </div>

          {/* Category bar chart */}
          {categoryTotals.length > 0 && (
            <section className="border rounded-lg p-5 mb-6">
              <h2 className="font-semibold mb-4">Spending by Category</h2>
              <div className="grid gap-3">
                {categoryTotals.map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="opacity-80">{c.category}</span>
                      <span className="font-medium">{money(c.total)}</span>
                    </div>
                    <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full"
                        style={{ width: `${(c.total / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent transactions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recent</h2>
              <a href="/transactions" className="text-sm opacity-50 hover:opacity-100">
                View all →
              </a>
            </div>

            {recent.length === 0 ? (
              <p className="opacity-50 text-sm">No transactions this month.</p>
            ) : (
              <div className="grid gap-2">
                {recent.map((t) => {
                  const sign = t.type === "expense" ? "-" : "+";
                  const hasReceipt = (receiptCounts[t.id] ?? 0) > 0;
                  return (
                    <a
                      key={t.id}
                      href={`/transactions/${t.id}`}
                      className="block border rounded-lg p-4 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex justify-between gap-3">
                        <div className="font-medium truncate">
                          {t.vendor || t.description || "(No details)"}
                        </div>
                        <div
                          className={`whitespace-nowrap font-medium ${
                            t.type === "expense"
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {sign}
                          {money(Number(t.amount))}
                        </div>
                      </div>
                      <div className="flex justify-between text-xs opacity-50 mt-1.5">
                        <span>{t.txn_date}</span>
                        <span>
                          {t.category || "Uncategorized"} •{" "}
                          {hasReceipt ? "✅ Receipt" : "No receipt"}
                        </span>
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
