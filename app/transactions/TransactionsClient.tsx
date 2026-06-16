"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

  // form
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");

  const money = useMemo(
    () => (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" }),
    []
  );

  useEffect(() => {
    setShowMissingOnly(searchParams.get("missing") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCategories = async () => {
    setCatsLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { window.location.href = "/login"; return; }

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, type")
      .eq("user_id", uid)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) { setError(error.message); setCategories([]); setCatsLoading(false); return; }
    setCategories((data as CategoryRow[]) ?? []);
    setCatsLoading(false);
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const { data, error } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description, category, source, project_id")
      .order("txn_date", { ascending: false })
      .limit(300);

    const { data: projData } = await supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", sessionData.session.user.id)
      .neq("status", "archived")
      .order("name");
    setProjects((projData as Project[]) ?? []);

    if (error) { setLoading(false); return setError(error.message); }

    const txns = (data as Txn[]) ?? [];
    setRows(txns);

    const ids = txns.map((t) => t.id);
    if (ids.length === 0) { setReceiptCounts({}); setLoading(false); return; }

    const { data: recData, error: recErr } = await supabase
      .from("receipts")
      .select("transaction_id")
      .in("transaction_id", ids);

    if (recErr) { setLoading(false); return setError(recErr.message); }

    const counts: Record<string, number> = {};
    for (const r of (recData as { transaction_id: string }[]) ?? []) {
      counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
    }
    setReceiptCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); loadCategories(); }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      type === "expense"
        ? c.type === "expense" || c.type === "both"
        : c.type === "income" || c.type === "both"
    );
  }, [categories, type]);

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
    if (!txnDate) return setError("Please choose a date.");
    if (!amount || Number.isNaN(amt) || amt <= 0) return setError("Amount must be a positive number.");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { window.location.href = "/login"; return; }

    const { error } = await supabase.from("transactions").insert({
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

    if (error) return setError(error.message);
    setAmount("");
    setVendor("");
    setDescription("");
    setProjectId("");
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

    if (!res.ok) return setError(out?.error ?? "Plaid import failed");
    await load();
    const n = out.upserted ?? out.inserted ?? 0;
    alert(`Imported Plaid transactions. Added/updated: ${n}`);
  };

  const displayedRows = useMemo(() => {
    if (!showMissingOnly) return rows;
    return rows.filter((r) => r.type === "expense" && (receiptCounts[r.id] ?? 0) === 0);
  }, [rows, receiptCounts, showMissingOnly]);

  const missingCount = useMemo(
    () => rows.filter((r) => r.type === "expense" && (receiptCounts[r.id] ?? 0) === 0).length,
    [rows, receiptCounts]
  );

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm opacity-50 mt-0.5">
            {showMissingOnly
              ? `Missing receipts (${missingCount})`
              : "Add, review, and categorize"}
          </p>
        </div>
        {missingCount > 0 && (
          <a
            href={showMissingOnly ? "/transactions" : "/transactions?missing=1"}
            className="text-sm border rounded px-3 py-1.5 font-medium"
          >
            {showMissingOnly ? "Show all" : `Missing (${missingCount})`}
          </a>
        )}
      </div>

      {/* Add transaction form */}
      <section className="border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-4">Add Transaction</h2>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm opacity-60 block mb-1">Date</label>
              <input
                className="w-full border rounded px-3 py-2 bg-transparent"
                type="date"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm opacity-60 block mb-1">Type</label>
              <select
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={type}
                onChange={(e) => setType(e.target.value as "income" | "expense")}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm opacity-60 block mb-1">Amount</label>
            <input
              className="w-full border rounded px-3 py-2 bg-transparent"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm opacity-60 block mb-1">Category</label>
            <select
              className="w-full border rounded px-3 py-2 bg-transparent"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={catsLoading || filteredCategories.length === 0}
            >
              {catsLoading ? (
                <option value="">Loading…</option>
              ) : filteredCategories.length === 0 ? (
                <option value="">No categories — add some in Settings</option>
              ) : (
                filteredCategories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm opacity-60 block mb-1">Vendor (optional)</label>
              <input
                className="w-full border rounded px-3 py-2 bg-transparent"
                placeholder="e.g. Walmart"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm opacity-60 block mb-1">Description (optional)</label>
              <input
                className="w-full border rounded px-3 py-2 bg-transparent"
                placeholder="e.g. nail supplies"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {projects.length > 0 && (
            <div>
              <label className="text-sm opacity-60 block mb-1">Project (optional)</label>
              <select
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              className="flex-1 bg-black text-white py-2.5 rounded font-medium disabled:opacity-50"
              onClick={addTransaction}
              disabled={importing}
            >
              Add
            </button>
            <button
              className="flex-1 border py-2.5 rounded font-medium disabled:opacity-50"
              onClick={importFromPlaid}
              disabled={importing}
            >
              {importing ? "Importing…" : "Import from Bank"}
            </button>
          </div>
        </div>
      </section>

      {/* Transaction list */}
      <section>
        <h2 className="font-semibold mb-3">
          {showMissingOnly ? "Missing Receipts" : "All Transactions"}
        </h2>

        {loading ? (
          <p className="opacity-50">Loading…</p>
        ) : displayedRows.length === 0 ? (
          <p className="opacity-50 text-sm">
            {showMissingOnly ? "No missing receipts — you're clean. ✅" : "No transactions yet."}
          </p>
        ) : (
          <div className="grid gap-2">
            {displayedRows.map((r) => {
              const sign = r.type === "expense" ? "-" : "+";
              const hasReceipt = (receiptCounts[r.id] ?? 0) > 0;
              return (
                <a
                  key={r.id}
                  href={`/transactions/${r.id}`}
                  className="block border rounded-lg p-4 hover:opacity-80 transition-opacity"
                >
                  <div className="flex justify-between gap-3">
                    <div className="font-medium truncate">
                      {r.vendor || r.description || "(No details)"}
                    </div>
                    <div
                      className={`whitespace-nowrap font-medium ${
                        r.type === "expense"
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {sign}{money(Number(r.amount))}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs opacity-50 mt-1.5">
                    <span>{r.txn_date}</span>
                    <span>
                      {r.category || "Uncategorized"} •{" "}
                      {hasReceipt ? "✅ Receipt" : "No receipt"}
                      {r.source === "plaid" ? " • Bank" : ""}
                      {r.project_id && projects.find(p => p.id === r.project_id) ? ` • ${projects.find(p => p.id === r.project_id)!.name}` : ""}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
