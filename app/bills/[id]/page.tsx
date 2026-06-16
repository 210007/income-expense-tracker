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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (error) return <main className="p-6 max-w-4xl mx-auto"><p className="text-red-600">{error}</p></main>;
  if (!bill) return null;

  const statusActions = (
    [
      { label: "Mark as Paid", status: "paid" },
      { label: "Mark as Due", status: "due" },
      { label: "Void Bill", status: "void" },
    ] as { label: string; status: Bill["status"] }[]
  ).filter((a) => a.status !== bill.status);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueAge = bill.due_date
    ? Math.round((new Date(bill.due_date).getTime() - today.getTime()) / 86400000)
    : null;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.push("/bills")} className="text-sm opacity-50 hover:opacity-80 mb-2 block">← Bills</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{bill.vendor}</h1>
            {bill.status === "paid" && <span className="text-sm font-medium text-green-600 dark:text-green-400">Paid</span>}
            {bill.status === "void" && <span className="text-sm font-medium opacity-30">Void</span>}
            {bill.status === "due" && dueAge !== null && dueAge < 0 && (
              <span className="text-sm font-medium text-red-500">{Math.abs(dueAge)}d overdue</span>
            )}
          </div>
          <p className="text-2xl font-bold mt-1">{fmtMoney(bill.amount)}</p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {statusActions.map((action) => (
            <button
              key={action.status}
              onClick={() => setStatus(action.status)}
              disabled={updating}
              className={`border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-40 ${
                action.status === "paid" ? "border-green-500 text-green-600 dark:text-green-400" :
                action.status === "void" ? "border-red-400 text-red-500 opacity-60" : ""
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><p className="opacity-50 mb-1">Due Date</p><p>{bill.due_date ? fmt(bill.due_date) : "—"}</p></div>
        <div><p className="opacity-50 mb-1">Paid Date</p><p>{bill.paid_date ? fmt(bill.paid_date) : "—"}</p></div>
        <div><p className="opacity-50 mb-1">Category</p><p>{bill.category ?? "—"}</p></div>
        <div><p className="opacity-50 mb-1">Description</p><p>{bill.description ?? "—"}</p></div>
      </div>
    </main>
  );
}
