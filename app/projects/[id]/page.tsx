"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  customers: { id: string; name: string } | null;
};

type Transaction = {
  id: string;
  txn_date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string;
  description: string | null;
  category: string | null;
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const [{ data: proj, error: projErr }, { data: txns }] = await Promise.all([
        supabase.from("projects").select("id, name, description, status, budget, start_date, end_date, customers(id, name)").eq("id", id).eq("user_id", sessionData.session.user.id).single(),
        supabase.from("transactions").select("id, txn_date, type, amount, vendor, description, category").eq("project_id", id).order("txn_date", { ascending: false }),
      ]);

      if (projErr || !proj) { setError(projErr?.message ?? "Project not found."); setLoading(false); return; }
      setProject(proj as unknown as Project);
      setTransactions((txns as Transaction[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  const setStatus = async (status: Project["status"]) => {
    if (!project) return;
    setUpdating(true);
    await supabase.from("projects").update({ status }).eq("id", project.id);
    setUpdating(false);
    setProject((prev) => prev ? { ...prev, status } : prev);
  };

  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (error) return <main className="p-6 max-w-4xl mx-auto"><p className="text-red-600">{error}</p></main>;
  if (!project) return null;

  const statusActions = (
    [
      { label: "Mark Completed", status: "completed" },
      { label: "Mark Active", status: "active" },
      { label: "Archive", status: "archived" },
    ] as { label: string; status: Project["status"] }[]
  ).filter((a) => a.status !== project.status);

  const budgetUsed = project.budget ? (expenses / project.budget) * 100 : null;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.push("/projects")} className="text-sm opacity-50 hover:opacity-80 mb-2 block">← Projects</button>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.customers && <p className="text-sm opacity-60 mt-1">{project.customers.name}</p>}
          {project.description && <p className="text-sm opacity-50 mt-1">{project.description}</p>}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {statusActions.map((action) => (
            <button key={action.status} onClick={() => setStatus(action.status)} disabled={updating} className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-40">
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Income", value: fmtMoney(income), style: "text-green-600 dark:text-green-400" },
          { label: "Expenses", value: fmtMoney(expenses), style: "text-red-500" },
          { label: "Net", value: fmtMoney(net), style: net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500" },
          { label: "Budget", value: project.budget != null ? fmtMoney(project.budget) : "—", style: "" },
        ].map((s) => (
          <div key={s.label} className="border rounded-xl p-4">
            <p className="text-xs opacity-50 mb-1">{s.label}</p>
            <p className={`font-semibold text-lg ${s.style}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Budget progress */}
      {budgetUsed !== null && (
        <div className="border rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="opacity-60">Budget used</span>
            <span className="font-medium">{Math.round(budgetUsed)}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${budgetUsed > 90 ? "bg-red-500" : budgetUsed > 70 ? "bg-yellow-500" : "bg-green-500"}`}
              style={{ width: `${Math.min(budgetUsed, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs opacity-50 mt-1">
            <span>{fmtMoney(expenses)} spent</span>
            <span>{fmtMoney(project.budget! - expenses)} remaining</span>
          </div>
        </div>
      )}

      {/* Dates */}
      {(project.start_date || project.end_date) && (
        <div className="border rounded-xl p-4 mb-6 flex gap-8 text-sm">
          {project.start_date && <div><p className="opacity-50 mb-1">Start</p><p>{fmtDate(project.start_date)}</p></div>}
          {project.end_date && <div><p className="opacity-50 mb-1">End</p><p>{fmtDate(project.end_date)}</p></div>}
        </div>
      )}

      {/* Transactions */}
      <section>
        <h2 className="font-semibold mb-3">Linked Transactions ({transactions.length})</h2>
        {transactions.length === 0 ? (
          <p className="text-sm opacity-50">No transactions linked to this project yet. Tag transactions with this project from the Transactions page.</p>
        ) : (
          <div className="grid gap-2">
            {transactions.map((t) => (
              <div key={t.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{t.vendor}</span>
                  {t.description && <span className="opacity-50 ml-2">{t.description}</span>}
                </div>
                <span className={`tabular-nums font-medium ${t.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {t.type === "income" ? "+" : "−"}{fmtMoney(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
