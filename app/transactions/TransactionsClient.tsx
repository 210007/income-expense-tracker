"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Txn = {
  id: string;
  txn_date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string | null;
  description: string | null;
  category: string | null;
  source?: string | null;
  project_id: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  type: "income" | "expense" | "both" | string;
};

type Project = { id: string; name: string };

export default function TransactionsClient() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<Txn[]>([]);
  const [receiptCounts, setReceiptCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  // form state
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  useEffect(() => {
    setShowMissingOnly(searchParams.get("missing") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCategories = async () => {
    setCatsLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { window.location.href = "/login"; return; }
    const { data } = await supabase
      .from("categories")
      .select("id, name, type")
      .eq("user_id", uid)
      .order("type")
      .order("name");
    setCategories((data as CategoryRow[]) ?? []);
    setCatsLoading(false);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const [{ data, error }, { data: projData }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, txn_date, type, amount, vendor, description, category, source, project_id")
        .order("txn_date", { ascending: false })
        .limit(300),
      supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", sessionData.session.user.id)
        .neq("status", "archived")
        .order("name"),
    ]);

    setProjects((projData as Project[]) ?? []);

    if (error) { setLoading(false); setError(error.message); return; }

    const txns = (data as Txn[]) ?? [];
    setRows(txns);

    if (txns.length === 0) { setReceiptCounts({}); setLoading(false); return; }

    const { data: recData } = await supabase
      .from("receipts")
      .select("transaction_id")
      .in("transaction_id", txns.map((t) => t.id));

    const counts: Record<string, number> = {};
    for (const r of (recData as { transaction_id: string }[]) ?? []) {
      counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
    }
    setReceiptCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); loadCategories(); }, []);

  const filteredCategories = useMemo(
    () => categories.filter((c) =>
      type === "expense" ? c.type === "expense" || c.type === "both" : c.type === "income" || c.type === "both"
    ),
    [categories, type]
  );

  useEffect(() => {
    if (catsLoading) return;
    if (filteredCategories.length === 0) { setCategory(""); return; }
    const stillValid = filteredCategories.some((c) => c.name === category);
    if (!category || !stillValid) setCategory(filteredCategories[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catsLoading, filteredCategories]);

  const addTransaction = async () => {
    setError(null);
    const amt = Number(amount);
    if (!txnDate) { setError("Choose a date."); return; }
    if (!amount || Number.isNaN(amt) || amt <= 0) { setError("Amount must be a positive number."); return; }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { window.location.href = "/login"; return; }

    setSaving(true);
    const { error: err } = await supabase.from("transactions").insert({
      user_id: userId,
      txn_date: txnDate,
      type,
      amount: amt,
      vendor: vendor || null,
      description: description || null,
      category: category || null,
      source: "manual",
      project_id: projectId || null,
    });
    setSaving(false);

    if (err) { setError(err.message); return; }
    setAmount(""); setVendor(""); setDescription(""); setProjectId("");
    setFormOpen(false);
    await load();
  };

  const importFromPlaid = async () => {
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData.session?.access_token;
    if (!jwt) { window.location.href = "/login"; return; }
    setImporting(true);
    const res = await fetch("/api/plaid/import-transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const out = await res.json();
    setImporting(false);
    if (!res.ok) { setError(out?.error ?? "Plaid import failed"); return; }
    await load();
    const n = out.upserted ?? out.inserted ?? 0;
    setError(null);
    alert(`Bank sync complete — ${n} transaction${n !== 1 ? "s" : ""} added/updated.`);
  };

  const displayedRows = useMemo(() => {
    if (!showMissingOnly) return rows;
    return rows.filter((r) => r.type === "expense" && (receiptCounts[r.id] ?? 0) === 0);
  }, [rows, receiptCounts, showMissingOnly]);

  const missingCount = useMemo(
    () => rows.filter((r) => r.type === "expense" && (receiptCounts[r.id] ?? 0) === 0).length,
    [rows, receiptCounts]
  );

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {showMissingOnly
              ? `Showing ${missingCount} transaction${missingCount !== 1 ? "s" : ""} missing receipts`
              : `${rows.length} transaction${rows.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {missingCount > 0 && (
            <Link
              href={showMissingOnly ? "/transactions" : "/transactions?missing=1"}
              className="h-9 px-3 text-xs font-medium border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
            >
              {showMissingOnly ? "Show all" : `Missing (${missingCount})`}
            </Link>
          )}
          <button
            onClick={importFromPlaid}
            disabled={importing}
            className="h-9 px-3 text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {importing ? "Syncing…" : "Sync Bank"}
          </button>
          <button
            onClick={() => { setFormOpen((v) => !v); setError(null); }}
            className="h-9 px-4 text-xs font-semibold brand-gradient text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {formOpen ? "Cancel" : "Add Transaction"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {formOpen && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">New Transaction</h2>

          {/* Type toggle */}
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden w-fit">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-5 py-2 text-sm font-semibold capitalize transition-colors ${
                  type === t
                    ? "brand-gradient text-white"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Amount *</label>
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                <span className="px-3 text-gray-400 text-sm">$</span>
                <input
                  inputMode="decimal"
                  className="flex-1 py-2.5 pr-4 bg-transparent text-sm focus:outline-none"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Category</label>
              <select
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={catsLoading || filteredCategories.length === 0}
              >
                {catsLoading ? (
                  <option>Loading…</option>
                ) : filteredCategories.length === 0 ? (
                  <option>No categories — add some in Settings</option>
                ) : (
                  filteredCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Vendor</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none"
                placeholder="e.g. Home Depot"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>

            <div className={projects.length > 0 ? "" : "sm:col-span-2"}>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none"
                placeholder="Optional notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {projects.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Project</label>
                <select
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={addTransaction}
            disabled={saving}
            className="w-full sm:w-auto px-8 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Transaction"}
          </button>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : displayedRows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-400">
            {showMissingOnly
              ? "No missing receipts — all caught up."
              : "No transactions yet."}
          </p>
          {!showMissingOnly && (
            <button
              onClick={() => setFormOpen(true)}
              className="mt-3 text-sm text-blue-500 hover:text-blue-600"
            >
              Add your first transaction →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayedRows.map((r) => {
            const hasReceipt = (receiptCounts[r.id] ?? 0) > 0;
            const proj = projectName(r.project_id);
            return (
              <Link
                key={r.id}
                href={`/transactions/${r.id}`}
                className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
              >
                {/* Type dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  r.type === "expense" ? "bg-red-400" : "bg-green-500"
                }`} />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {r.vendor || r.description || "(No details)"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{r.txn_date}</span>
                    {r.category && <><span className="opacity-30">·</span><span>{r.category}</span></>}
                    {proj && <><span className="opacity-30">·</span><span>{proj}</span></>}
                    {r.source === "plaid" && <><span className="opacity-30">·</span><span>Bank</span></>}
                  </p>
                </div>

                {/* Receipt badge */}
                <div className="shrink-0 flex items-center gap-2">
                  {r.type === "expense" && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      hasReceipt
                        ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                        : "bg-orange-50 text-orange-500 dark:bg-orange-950/30 dark:text-orange-400"
                    }`}>
                      {hasReceipt ? "Receipt" : "No receipt"}
                    </span>
                  )}
                  <span className={`text-sm font-bold ${
                    r.type === "expense"
                      ? "text-red-500 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}>
                    {r.type === "expense" ? "-" : "+"}{money(Number(r.amount))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
