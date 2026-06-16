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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Budgeting</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Budget</h1>
          <p className="text-sm opacity-50 mt-0.5">{MONTH_NAMES[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-1 border rounded overflow-hidden text-sm">
          <button onClick={() => navigate(-1)} className="px-2 py-1.5 hover:opacity-70">←</button>
          <span className="px-2 font-medium tabular-nums">{MONTH_NAMES[month - 1].slice(0, 3)} {year}</span>
          <button
            onClick={() => navigate(1)}
            disabled={month === now.getMonth() + 1 && year === now.getFullYear()}
            className="px-2 py-1.5 hover:opacity-70 disabled:opacity-30"
          >→</button>
        </div>
      </div>

      {/* Summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="border rounded-xl p-4">
            <p className="text-xs opacity-50 mb-1">Total Budgeted</p>
            <p className="font-semibold text-xl tabular-nums">{fmtMoney(totalBudgeted)}</p>
          </div>
          <div className="border rounded-xl p-4">
            <p className="text-xs opacity-50 mb-1">Total Spent</p>
            <p className={`font-semibold text-xl tabular-nums ${totalSpent > totalBudgeted ? "text-red-500" : ""}`}>{fmtMoney(totalSpent)}</p>
          </div>
          <div className="border rounded-xl p-4">
            <p className="text-xs opacity-50 mb-1">Remaining</p>
            <p className={`font-semibold text-xl tabular-nums ${totalBudgeted - totalSpent < 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
              {fmtMoney(totalBudgeted - totalSpent)}
            </p>
          </div>
        </div>
      )}

      {/* Budget rows */}
      {budgets.length > 0 && (
        <section className="border rounded-xl overflow-hidden mb-6">
          {budgets.map((b, i) => {
            const spent = spendMap[b.category] ?? 0;
            const pct = b.amount > 0 ? Math.min((spent / Number(b.amount)) * 100, 100) : 0;
            const over = spent > Number(b.amount);
            const warn = !over && pct >= 80;

            return (
              <div key={b.id} className={`p-4 ${i > 0 ? "border-t" : ""}`}>
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="font-medium text-sm">{b.category}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm tabular-nums ${over ? "text-red-500" : "opacity-60"}`}>
                      {fmtMoney(spent)} / {" "}
                      {editingId === b.id ? (
                        <input
                          type="number"
                          autoFocus
                          className="border rounded px-2 py-0.5 w-24 bg-transparent text-sm"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          onBlur={() => saveEdit(b.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(b.id); if (e.key === "Escape") setEditingId(null); }}
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingId(b.id); setEditAmount(String(b.amount)); }}
                          className="underline underline-offset-2 hover:opacity-70"
                        >
                          {fmtMoney(Number(b.amount))}
                        </button>
                      )}
                    </span>
                    <button onClick={() => removeBudget(b.id)} className="opacity-30 hover:opacity-70 hover:text-red-500 text-sm">×</button>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${over ? "bg-red-500" : warn ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(spent / Number(b.amount) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs opacity-40 mt-1">
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
        <section className="border rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-3 text-sm">Unbudgeted Spending</h2>
          <div className="grid gap-2">
            {unbudgeted.map((s) => (
              <div key={s.category} className="flex items-center justify-between text-sm py-1">
                <span className="opacity-60">{s.category}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-medium">{fmtMoney(s.total)}</span>
                  <button
                    onClick={() => { setNewCategory(s.category); setNewAmount(""); }}
                    className="text-xs underline opacity-40 hover:opacity-70"
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
      <section className="border rounded-xl p-5">
        <h2 className="font-semibold mb-4">
          {budgets.length === 0 ? "Set Your First Budget" : "Add Category Budget"}
        </h2>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input
              className="border rounded px-3 py-2 bg-transparent text-sm"
              placeholder="Category (e.g. Office supplies)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <input
              type="number"
              min="1"
              step="1"
              className="border rounded px-3 py-2 bg-transparent text-sm w-28"
              placeholder="$0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
          </div>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <button
            onClick={addBudget}
            disabled={adding}
            className="bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80 text-sm"
          >
            {adding ? "Saving…" : "Add Budget"}
          </button>
        </div>
      </section>

      {budgets.length === 0 && spending.length === 0 && (
        <p className="opacity-40 text-sm mt-4">No spending recorded for {MONTH_NAMES[month - 1]} {year}.</p>
      )}
    </main>
  );
}
