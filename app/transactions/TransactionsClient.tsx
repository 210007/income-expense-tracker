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
  source?: string | null; // optional so this works before/after you add the column
};

type CategoryRow = {
  id: string;
  name: string;
  type: "income" | "expense" | "both" | string;
};

export default function TransactionsClient() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [rows, setRows] = useState<Txn[]>([]);
  const [receiptCounts, setReceiptCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // read query param ONLY on client after mount
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  // categories (per-user)
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  // form state
  const [txnDate, setTxnDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState<string>("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");

  const money = useMemo(
    () => (n: number) =>
      n.toLocaleString(undefined, { style: "currency", currency: "USD" }),
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

    if (!uid) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, type")
      .eq("user_id", uid)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      setCategories([]);
      setCatsLoading(false);
      return;
    }

    const list = (data as CategoryRow[]) ?? [];
    setCategories(list);
    setCatsLoading(false);
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    // Note: includes source if you've added it; safe even if it's null.
    const { data, error } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description, category, source")
      .order("txn_date", { ascending: false })
      .limit(300);

    if (error) {
      setLoading(false);
      return setError(error.message);
    }

    const txns = (data as Txn[]) ?? [];
    setRows(txns);

    const ids = txns.map((t) => t.id);
    if (ids.length === 0) {
      setReceiptCounts({});
      setLoading(false);
      return;
    }

    const { data: recData, error: recErr } = await supabase
      .from("receipts")
      .select("transaction_id")
      .in("transaction_id", ids);

    if (recErr) {
      setLoading(false);
      return setError(recErr.message);
    }

    const counts: Record<string, number> = {};
    for (const r of (recData as { transaction_id: string }[]) ?? []) {
      counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
    }
    setReceiptCounts(counts);

    setLoading(false);
  };

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  // Filter categories to match selected transaction type
  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      type === "expense"
        ? c.type === "expense" || c.type === "both"
        : c.type === "income" || c.type === "both"
    );
  }, [categories, type]);

  // If category is blank or no longer valid, pick a reasonable default
  useEffect(() => {
    if (catsLoading) return;

    if (filteredCategories.length === 0) {
      setCategory("");
      return;
    }

    const stillValid = filteredCategories.some((c) => c.name === category);
    if (!category || !stillValid) {
      setCategory(filteredCategories[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catsLoading, filteredCategories]);

  const addTransaction = async () => {
    setError(null);

    const amt = Number(amount);
    if (!txnDate) return setError("Please choose a date.");
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      return setError("Amount must be a positive number.");
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      txn_date: txnDate,
      type,
      amount: amt,
      vendor: vendor || null,
      description: description || null,
      category: category || null,
      source: "manual",
    });

    if (error) return setError(error.message);

    setAmount("");
    setVendor("");
    setDescription("");
    await load();
  };

  const importFromPlaid = async () => {
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData.session?.access_token;

    if (!jwt) {
      window.location.href = "/login";
      return;
    }

    setImporting(true);

    const res = await fetch("/api/plaid/import-transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });

    const out = await res.json();

    setImporting(false);

    if (!res.ok) {
      return setError(out?.error ?? "Plaid import failed");
    }

    await load();
    const n = out.upserted ?? out.inserted ?? 0;
    alert(`Imported Plaid transactions. Added/updated: ${n}`);
  };

  const displayedRows = useMemo(() => {
    if (!showMissingOnly) return rows;
    return rows.filter(
      (r) => r.type === "expense" && (receiptCounts[r.id] ?? 0) === 0
    );
  }, [rows, receiptCounts, showMissingOnly]);

  const missingCount = useMemo(() => {
    return rows.filter(
      (r) => r.type === "expense" && (receiptCounts[r.id] ?? 0) === 0
    ).length;
  }, [rows, receiptCounts]);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="opacity-80 mt-1">
            {showMissingOnly
              ? `Showing missing receipts (${missingCount})`
              : "Add, review, and categorize"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href="/dashboard"
            className="text-center bg-black text-white py-3 rounded font-medium"
          >
            Dashboard
          </a>

          <a
            href="/transactions?missing=1"
            className="text-center border py-3 rounded font-medium"
          >
            Missing receipts
          </a>

          <a
            href="/transactions"
            className="text-center border py-3 rounded font-medium"
          >
            Transactions
          </a>

          <button
            className="text-center border py-3 rounded font-medium"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <section className="mt-6 border p-4 rounded">
        <h2 className="font-semibold mb-3">Add transaction</h2>

        <div className="grid gap-2">
          <label className="text-sm">Date</label>
          <input
            className="border p-2 rounded bg-black text-white"
            type="date"
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
          />

          <label className="text-sm">Type</label>
          <select
            className="border p-2 rounded bg-black text-white"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <label className="text-sm">Category</label>
          <select
            className="border p-2 rounded bg-black text-white"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={catsLoading || filteredCategories.length === 0}
          >
            {catsLoading ? (
              <option value="">Loading categories…</option>
            ) : filteredCategories.length === 0 ? (
              <option value="">No categories found — add some in Settings</option>
            ) : (
              filteredCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))
            )}
          </select>

          <label className="text-sm">Amount</label>
          <input
            className="border p-2 rounded bg-black text-white"
            inputMode="decimal"
            placeholder="e.g. 42.50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label className="text-sm">Vendor (optional)</label>
          <input
            className="border p-2 rounded bg-black text-white"
            placeholder="e.g. Walmart"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />

          <label className="text-sm">Description (optional)</label>
          <input
            className="border p-2 rounded bg-black text-white"
            placeholder="e.g. nail supplies"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {error && <p className="text-red-600">{error}</p>}

          <button
            className="bg-black text-white px-4 py-3 rounded font-medium mt-2"
            onClick={addTransaction}
            disabled={importing}
          >
            Add
          </button>

          <button
            className="border px-4 py-3 rounded font-medium mt-1"
            onClick={async () => {
              await loadCategories();
              await load();
            }}
            disabled={importing}
          >
            Reload list
          </button>

          <button
            className="border px-4 py-3 rounded font-medium mt-1"
            onClick={importFromPlaid}
            disabled={importing}
          >
            {importing ? "Importing..." : "Import from bank (Plaid)"}
          </button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold mb-3">
          {showMissingOnly ? "Missing receipts" : "Recent"}
        </h2>

        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="grid gap-2">
            {displayedRows.length === 0 ? (
              <p className="opacity-80">
                {showMissingOnly
                  ? "No missing receipts — you're clean."
                  : "No transactions yet."}
              </p>
            ) : (
              displayedRows.map((r) => {
                const sign = r.type === "expense" ? "-" : "+";
                const amountText = `${sign}${money(Number(r.amount))}`;
                const hasReceipt = (receiptCounts[r.id] ?? 0) > 0;

                return (
                  <a
                    key={r.id}
                    href={`/transactions/${r.id}`}
                    className="block border rounded p-4 active:opacity-80"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="font-medium">
                        {r.vendor || "(No vendor)"} —{" "}
                        {r.description || "(No description)"}
                      </div>
                      <div className="whitespace-nowrap">{amountText}</div>
                    </div>

                    <div className="flex justify-between text-sm opacity-80 mt-2">
                      <div>{r.txn_date}</div>
                      <div>
                        {(r.category || "Uncategorized") +
                          " • " +
                          (hasReceipt ? "Receipt ✅" : "No receipt") +
                          (r.source === "plaid" ? " • Bank" : "")}
                      </div>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        )}
      </section>
    </main>
  );
}
