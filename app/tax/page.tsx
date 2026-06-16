"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Quarter = { label: string; income: number; expenses: number; months: number[] };
type CategoryTotal = { category: string; total: number };
type VendorTotal = { vendor: string; total: number };

const QUARTERS: { label: string; months: number[] }[] = [
  { label: "Q1 (Jan–Mar)", months: [1, 2, 3] },
  { label: "Q2 (Apr–Jun)", months: [4, 5, 6] },
  { label: "Q3 (Jul–Sep)", months: [7, 8, 9] },
  { label: "Q4 (Oct–Dec)", months: [10, 11, 12] },
];

export default function TaxPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryTotal[]>([]);
  const [vendors1099, setVendors1099] = useState<VendorTotal[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const load = async (yr: number) => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const active = await hasModule("tax");
    if (!active) { setGated(true); setLoading(false); return; }

    const { data: txns } = await supabase
      .from("transactions")
      .select("txn_date, type, amount, vendor, category")
      .eq("user_id", sessionData.session.user.id)
      .gte("txn_date", `${yr}-01-01`)
      .lte("txn_date", `${yr}-12-31`);

    const rows = txns ?? [];

    // Quarterly breakdown
    const qs: Quarter[] = QUARTERS.map((q) => {
      const qRows = rows.filter((r) => {
        const m = new Date(r.txn_date).getMonth() + 1;
        return q.months.includes(m);
      });
      return {
        label: q.label,
        months: q.months,
        income: qRows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0),
        expenses: qRows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0),
      };
    });
    setQuarters(qs);

    // Totals
    setTotalIncome(rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0));
    setTotalExpenses(rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0));

    // Expense categories
    const catMap: Record<string, number> = {};
    rows.filter((r) => r.type === "expense").forEach((r) => {
      const cat = r.category ?? "Uncategorized";
      catMap[cat] = (catMap[cat] ?? 0) + r.amount;
    });
    setExpenseCategories(
      Object.entries(catMap)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
    );

    // 1099 vendor candidates (expense vendors > $600)
    const vendorMap: Record<string, number> = {};
    rows.filter((r) => r.type === "expense").forEach((r) => {
      vendorMap[r.vendor] = (vendorMap[r.vendor] ?? 0) + r.amount;
    });
    setVendors1099(
      Object.entries(vendorMap)
        .filter(([, total]) => total >= 600)
        .map(([vendor, total]) => ({ vendor, total }))
        .sort((a, b) => b.total - a.total)
    );

    setLoading(false);
  };

  useEffect(() => { load(year); }, [year]);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const estimatedTax = (net: number) => Math.max(0, net * 0.25);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Tax Reporting</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Tax Reporting — $6 / mo
        </Link>
      </main>
    );
  }

  const net = totalIncome - totalExpenses;
  const currentYear = new Date().getFullYear();

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Tax Reporting</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="border rounded px-2 py-1 text-sm hover:opacity-70">←</button>
          <span className="font-medium w-12 text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear} className="border rounded px-2 py-1 text-sm hover:opacity-70 disabled:opacity-30">→</button>
        </div>
      </div>

      {/* Annual summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border rounded-xl p-4">
          <p className="text-xs opacity-50 mb-1">Total Income</p>
          <p className="font-semibold text-xl text-green-600 dark:text-green-400">{fmtMoney(totalIncome)}</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-xs opacity-50 mb-1">Total Expenses</p>
          <p className="font-semibold text-xl text-red-500">{fmtMoney(totalExpenses)}</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-xs opacity-50 mb-1">Net Profit</p>
          <p className={`font-semibold text-xl ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{fmtMoney(net)}</p>
        </div>
      </div>

      {/* Quarterly breakdown */}
      <section className="border rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-4">Quarterly Breakdown</h2>
        <div className="grid gap-3">
          {quarters.map((q) => {
            const qNet = q.income - q.expenses;
            const estTax = estimatedTax(qNet);
            return (
              <div key={q.label} className="grid grid-cols-4 gap-3 text-sm py-2 border-b last:border-0">
                <div className="font-medium">{q.label}</div>
                <div>
                  <p className="opacity-50 text-xs mb-0.5">Income</p>
                  <p className="text-green-600 dark:text-green-400 tabular-nums">{fmtMoney(q.income)}</p>
                </div>
                <div>
                  <p className="opacity-50 text-xs mb-0.5">Expenses</p>
                  <p className="text-red-500 tabular-nums">{fmtMoney(q.expenses)}</p>
                </div>
                <div>
                  <p className="opacity-50 text-xs mb-0.5">Est. Tax Owed</p>
                  <p className="font-medium tabular-nums">{fmtMoney(estTax)}</p>
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-4 gap-3 text-sm pt-1 font-semibold">
            <div>Annual Total</div>
            <div className="text-green-600 dark:text-green-400 tabular-nums">{fmtMoney(totalIncome)}</div>
            <div className="text-red-500 tabular-nums">{fmtMoney(totalExpenses)}</div>
            <div className="tabular-nums">{fmtMoney(estimatedTax(net))}</div>
          </div>
        </div>
        <p className="text-xs opacity-40 mt-3">Estimated tax based on 25% of net profit. Consult a tax professional for your actual liability.</p>
      </section>

      {/* Expense categories */}
      {expenseCategories.length > 0 && (
        <section className="border rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-4">Deductions by Category</h2>
          <div className="grid gap-2">
            {expenseCategories.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <span>{c.category}</span>
                <span className="tabular-nums font-medium">{fmtMoney(c.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1099 vendors */}
      {vendors1099.length > 0 && (
        <section className="border rounded-xl p-5">
          <h2 className="font-semibold mb-1">1099 Vendor Candidates</h2>
          <p className="text-xs opacity-50 mb-4">Vendors you paid $600 or more this year may require a 1099 form.</p>
          <div className="grid gap-2">
            {vendors1099.map((v) => (
              <div key={v.vendor} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <span>{v.vendor}</span>
                <span className="tabular-nums font-medium">{fmtMoney(v.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {totalIncome === 0 && totalExpenses === 0 && (
        <p className="opacity-50 text-sm">No transactions found for {year}.</p>
      )}
    </main>
  );
}
