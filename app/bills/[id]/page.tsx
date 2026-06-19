"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

const STATUS_BADGE: Record<string, string> = {
  due: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  overdue: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  void: "bg-gray-100 text-gray-400 dark:bg-gray-800",
};

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const { data, error } = await supabase
        .from("bills")
        .select("id, vendor, amount, due_date, status, description, category, paid_date")
        .eq("id", id)
        .eq("user_id", sessionData.session.user.id)
        .single();

      if (error || !data) { setError(error?.message ?? "Bill not found."); setLoading(false); return; }
      setBill(data as Bill);
      setLoading(false);
    })();
  }, [id]);

  const setStatus = async (status: Bill["status"]) => {
    if (!bill) return;
    setUpdating(true);
    const update: Partial<Bill> = { status };
    if (status === "paid") update.paid_date = new Date().toISOString().slice(0, 10);
    if (status === "due") update.paid_date = null;
    await supabase.from("bills").update(update).eq("id", bill.id);
    setUpdating(false);
    setBill((prev) => prev ? { ...prev, ...update } : prev);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-40" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-24" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-28" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-red-600 text-sm">{error}</p>
      </main>
    );
  }

  if (!bill) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueAge = bill.due_date
    ? Math.round((new Date(bill.due_date).getTime() - today.getTime()) / 86400000)
    : null;

  const isOverdue = bill.status === "due" && dueAge !== null && dueAge < 0;
  const badgeKey = bill.status === "void" ? "void" : bill.status === "paid" ? "paid" : isOverdue ? "overdue" : "due";
  const badgeLabel = bill.status === "void" ? "Void" : bill.status === "paid" ? "Paid" : isOverdue ? `${Math.abs(dueAge!)}d overdue` : "Due";

  const statusActions = (
    [
      { label: "Mark as Paid", status: "paid" },
      { label: "Mark as Due", status: "due" },
      { label: "Void Bill", status: "void" },
    ] as { label: string; status: Bill["status"] }[]
  ).filter((a) => a.status !== bill.status);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => router.push("/bills")}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-3"
            aria-label="Back to Bills"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{bill.vendor}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[badgeKey]}`}>
              {badgeLabel}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmtMoney(bill.amount)}</p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {statusActions.map((action) => (
            <button
              key={action.status}
              onClick={() => setStatus(action.status)}
              disabled={updating}
              className={`px-5 py-2.5 border rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                action.status === "paid"
                  ? "border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                  : action.status === "void"
                  ? "border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Due Date</p>
          <p className="text-gray-900 dark:text-white">{bill.due_date ? fmt(bill.due_date) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Paid Date</p>
          <p className="text-gray-900 dark:text-white">{bill.paid_date ? fmt(bill.paid_date) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Category</p>
          <p className="text-gray-900 dark:text-white">{bill.category ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Description</p>
          <p className="text-gray-900 dark:text-white">{bill.description ?? "—"}</p>
        </div>
      </div>
    </main>
  );
}
