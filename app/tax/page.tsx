"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type TxnRow = { txn_date: string; type: string; amount: number; vendor: string | null; category: string | null };
type Quarter = { label: string; income: number; expenses: number };
type CategoryTotal = { category: string; total: number };
type VendorTotal = { vendor: string; total: number };

const QUARTERS = [
  { label: "Q1 (Jan–Mar)", months: [1, 2, 3] },
  { label: "Q2 (Apr–Jun)", months: [4, 5, 6] },
  { label: "Q3 (Jul–Sep)", months: [7, 8, 9] },
  { label: "Q4 (Oct–Dec)", months: [10, 11, 12] },
];

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const estimatedTax = (net: number) => Math.max(0, net * 0.25);

export default function TaxPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [txns, setTxns] = useState<TxnRow[]>([]);

  const load = async (yr: number) => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }
    const active = await hasModule("tax");
    if (!active) { setGated(true); setLoading(false); return; }
    const { data } = await supabase
      .from("transactions")
      .select("txn_date, type, amount, vendor, category")
      .eq("user_id", sessionData.session.user.id)
      .gte("txn_date", `${yr}-01-01`)
      .lte("txn_date", `${yr}-12-31`);
    setTxns((data as TxnRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year]);

  const totalIncome = useMemo(
    () => txns.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0),
    [txns]
  );
  const totalExpenses = useMemo(
    () => txns.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0),
    [txns]
  );
  const net = totalIncome - totalExpenses;

  const quarters: Quarter[] = useMemo(
    () =>
      QUARTERS.map((q) => {
        const qRows = txns.filter((r) => q.months.includes(new Date(r.txn_date).getMonth() + 1));
        return {
          label: q.label,
          income: qRows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0),
          expenses: qRows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0),
        };
      }),
    [txns]
  );

  const expenseCategories: CategoryTotal[] = useMemo(() => {
    const map: Record<string, number> = {};
    txns.filter((r) => r.type === "expense").forEach((r) => {
      const cat = r.category ?? "Uncategorized";
      map[cat] = (map[cat] ?? 0) + Number(r.amount);
    });
    return Object.entries(map).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [txns]);

  const vendors1099: VendorTotal[] = useMemo(() => {
    const map: Record<string, number> = {};
    txns.filter((r) => r.type === "expense" && r.vendor).forEach((r) => {
      map[r.vendor!] = (map[r.vendor!] ?? 0) + Number(r.amount);
    });
    return Object.entries(map)
      .filter(([, total]) => total >= 600)
      .map(([vendor, total]) => ({ vendor, total }))
      .sort((a, b) => b.total - a.total);
  }, [txns]);

  const maxCat = useMemo(() => Math.max(...expenseCategories.map((c) => c.total), 1), [expenseCategories]);

  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-9 bg-gray-200 dark:bg-gray-800 rounded-xl w-56" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl" />)}
          </div>
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Tax Reporting</h1>
        <p className="text-sm text-gray-500 mb-6">Quarterly breakdowns, estimated taxes, and 1099 vendor tracking.</p>
        <Link href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Add Tax Reporting — $6/mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Reporting</h1>
        <div className="flex items-center gap-0 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-base transition-colors"
          >
            ‹
          </button>
          <span className="px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 select-none">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear}
            className="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-base transition-colors disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {/* Annual KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Income</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{money(totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Expenses</p>
          <p className="text-xl font-bold text-red-500">{money(totalExpenses)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Net Profit</p>
          <p className={`text-xl font-bold ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{money(net)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Est. Tax</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{money(estimatedTax(net))}</p>
          <p className="text-xs text-gray-400 mt-0.5">at 25%</p>
        </div>
      </div>

      {/* Quarterly breakdown */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Quarterly Breakdown</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {quarters.map((q) => {
            const qNet = q.income - q.expenses;
            return (
              <div key={q.label} className="grid grid-cols-4 gap-4 px-5 py-4 text-sm">
                <div className="font-semibold text-gray-700 dark:text-gray-300">{q.label}</div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Income</p>
                  <p className="font-semibold text-green-600 dark:text-green-400 tabular-nums">{money(q.income)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Expenses</p>
                  <p className="font-semibold text-red-500 tabular-nums">{money(q.expenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Est. Tax</p>
                  <p className="font-semibold tabular-nums">{money(estimatedTax(qNet))}</p>
                </div>
              </div>
            );
          })}
          {/* Totals row */}
          <div className="grid grid-cols-4 gap-4 px-5 py-4 text-sm bg-gray-50 dark:bg-gray-800/50">
            <div className="font-bold text-gray-700 dark:text-gray-300">Annual</div>
            <div className="font-bold text-green-600 dark:text-green-400 tabular-nums">{money(totalIncome)}</div>
            <div className="font-bold text-red-500 tabular-nums">{money(totalExpenses)}</div>
            <div className="font-bold tabular-nums">{money(estimatedTax(net))}</div>
          </div>
        </div>
        <p className="text-xs text-gray-400 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          Estimated tax is 25% of net profit. Consult a tax professional for your actual liability.
        </p>
      </div>

      {/* Deductions */}
      {expenseCategories.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Deductions by Category</h2>
          <div className="space-y-3">
            {expenseCategories.map((c) => (
              <div key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">{c.category}</span>
                  <span className="font-semibold tabular-nums">{money(c.total)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full brand-gradient rounded-full" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1099 vendors */}
      {vendors1099.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-1">1099 Vendor Candidates</h2>
          <p className="text-xs text-gray-400 mb-4">Vendors paid $600 or more this year may require a Form 1099.</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {vendors1099.map((v) => (
              <div key={v.vendor} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-700 dark:text-gray-300">{v.vendor}</span>
                <span className="font-semibold tabular-nums">{money(v.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalIncome === 0 && totalExpenses === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No transactions found for {year}.</p>
      )}
    </main>
  );
}
