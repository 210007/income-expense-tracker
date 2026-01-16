"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Txn = {
  id: string;
  txn_date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string | null;
  description: string | null;
  category: string | null;
};

function toCSVValue(v: any) {
  const s = (v ?? "").toString();
  // Escape quotes, wrap in quotes if needed
  const needsQuotes = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export default function ExportPage() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const today = useMemo(() => new Date(), []);
  const startDefault = useMemo(() => {
    // default: Jan 1 of this year
    const d = new Date(today.getFullYear(), 0, 1);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const endDefault = useMemo(() => today.toISOString().slice(0, 10), [today]);

  const [startDate, setStartDate] = useState(startDefault);
  const [endDate, setEndDate] = useState(endDefault);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) window.location.href = "/login";
    })();
  }, []);

  const downloadCSV = async () => {
    setError(null);
    setStatus("Preparing export...");

    if (!startDate || !endDate) return setError("Pick a start and end date.");
    if (startDate > endDate) return setError("Start date must be before end date.");

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    // 1) Pull transactions in range (inclusive endDate)
    const { data: txnData, error: txnErr } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description, category")
      .gte("txn_date", startDate)
      .lte("txn_date", endDate)
      .order("txn_date", { ascending: true });

    if (txnErr) return setError(txnErr.message);

    const txns = (txnData as Txn[]) ?? [];
    const ids = txns.map((t) => t.id);

    // 2) Pull receipt rows for those ids, count client-side
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: recData, error: recErr } = await supabase
        .from("receipts")
        .select("transaction_id")
        .in("transaction_id", ids);

      if (recErr) return setError(recErr.message);

      for (const r of (recData as { transaction_id: string }[]) ?? []) {
        counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
      }
    }

    // 3) Build CSV
    const header = [
      "date",
      "type",
      "amount",
      "vendor",
      "description",
      "category",
      "receipt_count",
      "has_receipt",
      "transaction_id",
    ];

    const lines = [header.join(",")];

    for (const t of txns) {
      const receiptCount = counts[t.id] ?? 0;
      const row = [
        t.txn_date,
        t.type,
        Number(t.amount).toFixed(2),
        t.vendor ?? "",
        t.description ?? "",
        t.category ?? "",
        receiptCount.toString(),
        receiptCount > 0 ? "yes" : "no",
        t.id,
      ].map(toCSVValue);

      lines.push(row.join(","));
    }

    const csv = lines.join("\n");

    // 4) Download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `transactions_${startDate}_to_${endDate}.csv`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

    setStatus(`Downloaded ${txns.length} transactions ✅`);
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Export CSV</h1>
          <p className="opacity-80 mt-1">
            Download transactions for taxes or accounting.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href="/"
            className="text-center bg-black text-white py-3 rounded font-medium"
          >
            Dashboard
          </a>
          <a
            href="/transactions"
            className="text-center border py-3 rounded font-medium"
          >
            Transactions
          </a>
        </div>
      </div>

      <section className="mt-6 border rounded p-4">
        <h2 className="font-semibold mb-3">Date range</h2>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-sm">Start</label>
            <input
              className="border p-2 rounded"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">End</label>
            <input
              className="border p-2 rounded"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {error && <p className="text-red-600">{error}</p>}
          {status && <p className="opacity-80">{status}</p>}

          <button
            className="bg-black text-white px-4 py-3 rounded font-medium"
            onClick={downloadCSV}
          >
            Download CSV
          </button>

          <p className="text-sm opacity-80">
            Includes category and receipt status.
          </p>
        </div>
      </section>
    </main>
  );
}
