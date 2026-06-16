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
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, style: "text-red-500" };
  if (days === 0) return { label: "Due today", style: "text-yellow-600 dark:text-yellow-400" };
  if (days <= 7) return { label: `Due in ${days}d`, style: "text-yellow-600 dark:text-yellow-400" };
  return { label: `Due in ${days}d`, style: "opacity-50" };
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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Accounts Payable</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Accounts Payable — $6 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Bills</h1>
          <p className="text-sm opacity-50 mt-0.5">
            {fmtMoney(totalDue)} outstanding
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden text-sm">
            {(["unpaid", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 capitalize ${filter === f ? "bg-black text-white dark:bg-white dark:text-black" : "hover:opacity-70"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <Link href="/bills/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">
            Add Bill
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {visible.length === 0 ? (
        <p className="opacity-50 text-sm">
          {filter === "unpaid" ? "No unpaid bills." : "No bills yet."}{" "}
          <Link href="/bills/new" className="underline">Add one.</Link>
        </p>
      ) : (
        <div className="grid gap-2">
          {visible.map((b) => {
            const age = b.status === "due" ? ageLabel(b.due_date) : { label: "", style: "" };
            return (
              <Link key={b.id} href={`/bills/${b.id}`} className="block border rounded-lg p-4 hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-medium">{b.vendor}</span>
                    {b.status === "paid" && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</span>}
                    {b.status === "void" && <span className="text-xs opacity-30 font-medium">Void</span>}
                    {age.label && <span className={`text-xs font-medium ${age.style}`}>{age.label}</span>}
                  </div>
                  <span className={`font-medium tabular-nums ${b.status === "paid" ? "opacity-40" : ""}`}>
                    {fmtMoney(b.amount)}
                  </span>
                </div>
                {(b.description || b.category || b.due_date) && (
                  <div className="text-sm opacity-60 mt-1 flex gap-2">
                    {b.category && <span>{b.category}</span>}
                    {b.category && b.due_date && <span>·</span>}
                    {b.due_date && <span>Due {fmt(b.due_date)}</span>}
                    {b.paid_date && <><span>·</span><span>Paid {fmt(b.paid_date)}</span></>}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
