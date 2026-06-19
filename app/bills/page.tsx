"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Bill = {
  id: string;
  vendor: string;
  amount: number;
  due_date: string | null;
  status: "due" | "paid" | "void";
  description: string | null;
  category: string | null;
  paid_date: string | null;
};

function ageLabel(dueDateIso: string | null): { label: string; style: string } {
  if (!dueDateIso) return { label: "", style: "" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateIso);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, style: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" };
  if (days === 0) return { label: "Due today", style: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400" };
  if (days <= 7) return { label: `Due in ${days}d`, style: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400" };
  return { label: `Due in ${days}d`, style: "bg-gray-100 text-gray-500 dark:bg-gray-800" };
}

export default function BillsPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<"unpaid" | "all">("unpaid");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("accounts_payable");
      if (!active) { setGated(true); setLoading(false); return; }

      const { data, error } = await supabase
        .from("bills")
        .select("id, vendor, amount, due_date, status, description, category, paid_date")
        .eq("user_id", sessionData.session.user.id)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) { setError(error.message); setLoading(false); return; }
      setBills((data as Bill[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const visible = filter === "unpaid" ? bills.filter((b) => b.status === "due") : bills;

  const totalDue = bills.filter((b) => b.status === "due").reduce((sum, b) => sum + b.amount, 0);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-32" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Accounts Payable</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This module isn&apos;t active on your plan.</p>
        <Link
          href="/plan"
          className="inline-block px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Add Accounts Payable — $6 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bills</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {fmtMoney(totalDue)} outstanding
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden text-sm">
            {(["unpaid", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 capitalize font-semibold transition-colors ${
                  filter === f
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Link
            href="/bills/new"
            className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Add Bill
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === "unpaid" ? "No unpaid bills." : "No bills yet."}{" "}
            <Link href="/bills/new" className="underline">Add one.</Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {visible.map((b) => {
            const age = b.status === "due" ? ageLabel(b.due_date) : { label: "", style: "" };
            return (
              <Link
                key={b.id}
                href={`/bills/${b.id}`}
                className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-gray-900 dark:text-white">{b.vendor}</span>
                    {b.status === "paid" && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400">Paid</span>
                    )}
                    {b.status === "void" && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">Void</span>
                    )}
                    {age.label && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${age.style}`}>{age.label}</span>
                    )}
                  </div>
                  {(b.description || b.category || b.due_date) && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex gap-2">
                      {b.category && <span>{b.category}</span>}
                      {b.category && b.due_date && <span>·</span>}
                      {b.due_date && <span>Due {fmt(b.due_date)}</span>}
                      {b.paid_date && <><span>·</span><span>Paid {fmt(b.paid_date)}</span></>}
                    </div>
                  )}
                </div>
                <span className={`font-semibold tabular-nums ${b.status === "paid" ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"}`}>
                  {fmtMoney(b.amount)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
