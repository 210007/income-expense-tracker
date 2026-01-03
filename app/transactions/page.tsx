"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Txn = {
  id: string;
  txn_date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string | null;
  description: string | null;
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Txn[]>([]);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [txnDate, setTxnDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState<string>("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description")
      .order("txn_date", { ascending: false })
      .limit(100);

    if (error) setError(error.message);
    else setRows((data as Txn[]) ?? []);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addTransaction = async () => {
    setError(null);

    const amt = Number(amount);
    if (!txnDate) return setError("Please choose a date.");
    if (!amount || Number.isNaN(amt) || amt <= 0) return setError("Amount must be a positive number.");

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
    });

    if (error) return setError(error.message);

    // reset + reload
    setAmount("");
    setVendor("");
    setDescription("");
    await load();
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <a className="underline" href="/">Home</a>
      </div>

      <section className="mt-6 border p-4 rounded">
        <h2 className="font-semibold mb-3">Add transaction</h2>

        <div className="grid gap-2">
          <label className="text-sm">Date</label>
          <input
            className="border p-2"
            type="date"
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
          />

          <label className="text-sm">Type</label>
          <select
            className="border p-2"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <label className="text-sm">Amount</label>
          <input
            className="border p-2"
            inputMode="decimal"
            placeholder="e.g. 42.50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label className="text-sm">Vendor (optional)</label>
          <input
            className="border p-2"
            placeholder="e.g. Walmart"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />

          <label className="text-sm">Description (optional)</label>
          <input
            className="border p-2"
            placeholder="e.g. office supplies"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {error && <p className="text-red-600">{error}</p>}

          <button
            className="bg-black text-white px-4 py-2 mt-2"
            onClick={addTransaction}
          >
            Add
          </button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold mb-3">Recent</h2>

        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="grid gap-2">
            {rows.length === 0 ? (
              <p className="opacity-80">No transactions yet.</p>
            ) : (
              rows.map((r) => (
                <a key={r.id} href={`/transactions/${r.id}`} className="block border rounded p-3">
                  <div className="flex justify-between">
                    <div className="font-medium">
                        {r.vendor || "(No vendor)"} — {r.description || "(No description)"}
                    </div>
                   <div>
                    {r.type === "expense" ? "-" : "+"}${Number(r.amount).toFixed(2)}
                </div>
            </div>
            <div className="text-sm opacity-80">{r.txn_date}</div>
            </a>
              ))
            )}
          </div>
        )}
      </section>
    </main>
  );
}
