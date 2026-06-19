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

function toCSVValue(v: unknown) {
  const s = (v ?? "").toString();
  const needsQuotes = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export default function ExportPage() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const today = useMemo(() => new Date(), []);
  const startDefault = useMemo(
    () => new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10),
    [today]
  );
  const endDefault = useMemo(() => today.toISOString().slice(0, 10), [today]);

  const [startDate, setStartDate] = useState(startDefault);
  const [endDate, setEndDate] = useState(endDefault);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) window.location.href = "/login";
    })();
  }, []);

  const downloadCSV = async () => {
    setError(null);
    setStatus("");

    if (!startDate || !endDate) return setError("Pick a start and end date.");
    if (startDate > endDate) return setError("Start date must be before end date.");

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    setLoading(true);
    setStatus("Fetching transactions…");

    const { data: txnData, error: txnErr } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description, category")
      .gte("txn_date", startDate)
      .lte("txn_date", endDate)
      .order("txn_date", { ascending: true });

    if (txnErr) { setError(txnErr.message); setLoading(false); setStatus(""); return; }

    const txns = (txnData as Txn[]) ?? [];
    const ids = txns.map((t) => t.id);

    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: recData, error: recErr } = await supabase
        .from("receipts")
        .select("transaction_id")
        .in("transaction_id", ids);

      if (recErr) { setError(recErr.message); setLoading(false); setStatus(""); return; }

      for (const r of (recData as { transaction_id: string }[]) ?? []) {
        counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
      }
    }

    const header = ["date", "type", "amount", "vendor", "description", "category", "receipt_count", "has_receipt", "transaction_id"];
    const lines = [header.join(",")];

    for (const t of txns) {
      const receiptCount = counts[t.id] ?? 0;
      lines.push(
        [
          t.txn_date,
          t.type,
          Number(t.amount).toFixed(2),
          t.vendor ?? "",
          t.description ?? "",
          t.category ?? "",
          receiptCount.toString(),
          receiptCount > 0 ? "yes" : "no",
          t.id,
        ]
          .map(toCSVValue)
          .join(",")
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solobooks_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setLoading(false);
    setStatus(`Downloaded ${txns.length} transactions ✅`);
  };

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Export</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Download transactions as CSV for your accountant or tax software.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4 max-w-lg">
        <div>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Date Range</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Start</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">End</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {status && <p className="text-sm text-gray-500 dark:text-gray-400">{status}</p>}

        <button
          className="w-full px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          onClick={downloadCSV}
          disabled={loading}
        >
          {loading ? "Preparing…" : "Download CSV"}
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Includes date, type, amount, vendor, description, category, receipt status, and transaction ID.
        </p>
      </div>
    </main>
  );
}
