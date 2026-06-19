"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Budget = {
  id: string;
  category: string;
  amount: number;
};

type SpendRow = { category: string; total: number };

export default function BudgetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spending, setSpending] = useState<SpendRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Add form
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const load = async (m: number, y: number) => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const active = await hasModule("budgeting");
    if (!active) { setGated(true); setLoading(false); return; }

    setUserId(sessionData.session.user.id);

    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, "0")}-${endDay}`;

    const [{ data: budgetData }, { data: txnData }] = await Promise.all([
      supabase
        .from("budgets")
        .select("id, category, amount")
        .eq("user_id", sessionData.session.user.id)
        .eq("month", m)
        .eq("year", y)
        .order("category"),
      supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", sessionData.session.user.id)
        .eq("type", "expense")
        .gte("txn_date", startDate)
        .lte("txn_date", endDate),
    ]);

    setBudgets((budgetData as Budget[]) ?? []);

    // Aggregate spending by category
    const spendMap: Record<string, number> = {};
    for (const t of (txnData ?? []) as { category: string | null; amount: number }[]) {
      const cat = t.category ?? "Uncategorized";
      spendMap[cat] = (spendMap[cat] ?? 0) + Number(t.amount);
    }
    setSpending(Object.entries(spendMap).map(([category, total]) => ({ category, total })));
    setLoading(false);
  };

  useEffect(() => { load(month, year); }, [month, year]);

  const navigate = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  };

  const addBudget = async () => {
    setFormError(null);
    if (!newCategory.trim()) { setFormError("Category is required."); return; }
    const amt = parseFloat(newAmount);
    if (!newAmount || isNaN(amt) || amt <= 0) { setFormError("Enter a valid amount."); return; }
    if (!userId) return;
    setAdding(true);
    const { error } = await supabase.from("budgets").upsert({
      user_id: userId,
      category: newCategory.trim(),
      month,
      year,
      amount: amt,
    }, { onConflict: "user_id,category,month,year" });
    setAdding(false);
    if (error) { setFormError(error.message); return; }
    setNewCategory("");
    setNewAmount("");
    await load(month, year);
  };

  const saveEdit = async (id: string) => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) return;
    await supabase.from("budgets").update({ amount: amt }).eq("id", id);
    setEditingId(null);
    await load(month, year);
  };

  const removeBudget = async (id: string) => {
    await supabase.from("budgets").delete().eq("id", id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-10 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-24" />
          ))}
        </div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-64" />
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Budgeting</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          Add Budgeting — $6 / mo
        </Link>
      </main>
    );
  }

  // Merge budgets and spending
  const spendMap = Object.fromEntries(spending.map((s) => [s.category, s.total]));
  const budgetedCategories = new Set(budgets.map((b) => b.category));

  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + (spendMap[b.category] ?? 0), 0);

  // Unbudgeted categories (have spending, no budget)
  const unbudgeted = spending.filter((s) => !budgetedCategories.has(s.category));

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budget</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{MONTH_NAMES[month - 1]} {year}</p>
        </div>
        {/* Month navigator */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden text-sm">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ←
          </button>
          <span className="px-2 font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
            {MONTH_NAMES[month - 1].slice(0, 3)} {year}
          </span>
          <button
            onClick={() => navigate(1)}
            disabled={month === now.getMonth() + 1 && year === now.getFullYear()}
            className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Total Budgeted</p>
            <p className="font-bold text-xl tabular-nums text-gray-900 dark:text-white">{fmtMoney(totalBudgeted)}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Total Spent</p>
            <p className={`font-bold text-xl tabular-nums ${totalSpent > totalBudgeted ? "text-red-500" : "text-gray-900 dark:text-white"}`}>
              {fmtMoney(totalSpent)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Remaining</p>
            <p className={`font-bold text-xl tabular-nums ${totalBudgeted - totalSpent < 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
              {fmtMoney(totalBudgeted - totalSpent)}
            </p>
          </div>
        </div>
      )}

      {/* Budget rows */}
      {budgets.length > 0 && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden mb-6">
          {budgets.map((b, i) => {
            const spent = spendMap[b.category] ?? 0;
            const pct = b.amount > 0 ? Math.min((spent / Number(b.amount)) * 100, 100) : 0;
            const over = spent > Number(b.amount);
            const warn = !over && pct >= 80;

            return (
              <div key={b.id} className={`p-5 ${i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}>
                <div className="flex items-center justify-between gap-4 mb-2.5">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{b.category}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm tabular-nums ${over ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}>
                      {fmtMoney(spent)}
                      {" / "}
                      {editingId === b.id ? (
                        <input
                          type="number"
                          autoFocus
                          className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-0.5 w-24 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          onBlur={() => saveEdit(b.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(b.id); if (e.key === "Escape") setEditingId(null); }}
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingId(b.id); setEditAmount(String(b.amount)); }}
                          className="underline underline-offset-2 hover:opacity-70 transition-opacity"
                        >
                          {fmtMoney(Number(b.amount))}
                        </button>
                      )}
                    </span>
                    <button
                      onClick={() => removeBudget(b.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-base leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${over ? "bg-red-500" : warn ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(spent / Number(b.amount) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  <span>{over ? `${fmtMoney(spent - Number(b.amount))} over budget` : `${fmtMoney(Number(b.amount) - spent)} left`}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Unbudgeted spending */}
      {unbudgeted.length > 0 && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-6">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Unbudgeted Spending
          </h2>
          <div className="grid gap-1">
            {unbudgeted.map((s) => (
              <div key={s.category} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">{s.category}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-semibold text-gray-900 dark:text-white">{fmtMoney(s.total)}</span>
                  <button
                    onClick={() => { setNewCategory(s.category); setNewAmount(""); }}
                    className="text-xs text-gray-400 dark:text-gray-500 underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    Set budget
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add budget form */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          {budgets.length === 0 ? "Set Your First Budget" : "Add Category Budget"}
        </h2>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Category (e.g. Office supplies)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <input
              type="number"
              min="1"
              step="1"
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="$0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
          </div>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <button
            onClick={addBudget}
            disabled={adding}
            className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {adding ? "Saving…" : "Add Budget"}
          </button>
        </div>
      </section>

      {budgets.length === 0 && spending.length === 0 && (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No spending recorded for {MONTH_NAMES[month - 1]} {year}.
          </p>
        </div>
      )}
    </main>
  );
}
