"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

type ReceiptRow = {
  id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  uploaded_at: string;
};

const CATEGORY_OPTIONS = [
  "Office supplies",
  "Equipment",
  "Software & subscriptions",
  "Advertising/marketing",
  "Travel",
  "Meals",
  "Shipping/postage",
  "Fees",
  "Utilities",
  "Other",
] as const;

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const txnId = params?.id;

  const [txn, setTxn] = useState<Txn | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const [category, setCategory] = useState<string>("Other");
  const [savingCategory, setSavingCategory] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const prettyAmount = useMemo(() => {
    if (!txn) return "";
    const sign = txn.type === "expense" ? "-" : "+";
    return `${sign}$${Number(txn.amount).toFixed(2)}`;
  }, [txn]);

  const load = async () => {
    setError(null);

    if (!txnId) {
      setError("Invalid transaction URL (missing id).");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const { data: txnData, error: txnErr } = await supabase
      .from("transactions")
      .select("id, txn_date, type, amount, vendor, description, category")
      .eq("id", txnId)
      .single();

    if (txnErr) return setError(txnErr.message);

    const t = txnData as Txn;
    setTxn(t);
    setCategory(t.category || "Other");

    const { data: receiptData, error: recErr } = await supabase
      .from("receipts")
      .select("id, storage_path, file_name, mime_type, uploaded_at")
      .eq("transaction_id", txnId)
      .order("uploaded_at", { ascending: false });

    if (recErr) return setError(recErr.message);
    setReceipts((receiptData as ReceiptRow[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnId]);

  const saveCategory = async () => {
    setError(null);
    setStatus("");

    if (!txnId) return setError("Missing transaction id from the URL.");
    if (!txn) return setError("Transaction not loaded yet.");

    setSavingCategory(true);

    const { error: updErr } = await supabase
      .from("transactions")
      .update({ category })
      .eq("id", txnId);

    setSavingCategory(false);

    if (updErr) return setError(updErr.message);

    setStatus("Category saved ✅");
    await load();
  };

  const uploadReceipt = async () => {
    setError(null);
    setStatus("");

    if (!txnId) return setError("Missing transaction id from the URL.");
    if (!file) return setError("Pick a file first.");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      window.location.href = "/login";
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${txnId}/${Date.now()}_${safeName}`;

    setStatus("Uploading to storage...");

    const { error: storageErr } = await supabase.storage
      .from("receipts")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (storageErr) return setError(storageErr.message);

    setStatus("Saving receipt link...");

    const { error: dbErr } = await supabase.from("receipts").insert({
      user_id: userId,
      transaction_id: txnId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
    });

    if (dbErr) return setError(dbErr.message);

    setFile(null);
    setStatus("Uploaded ✅");
    await load();
  };

  const openReceipt = async (storagePath: string) => {
    setError(null);

    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(storagePath, 60);

    if (error) return setError(error.message);

    window.open(data.signedUrl, "_blank");
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      {/* Phone-friendly action bar */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transaction</h1>
          <p className="opacity-80 mt-1">Details, category, and receipts</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <a
            href="/transactions"
            className="text-center bg-black text-white py-3 rounded font-medium"
          >
            Back
          </a>

          <a
            href="/"
            className="text-center border py-3 rounded font-medium"
          >
            Dashboard
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

      {error && <p className="text-red-600 mt-4">{error}</p>}
      {status && <p className="mt-3 opacity-80">{status}</p>}

      {!txn ? (
        <p className="mt-4">Loading…</p>
      ) : (
        <div className="border rounded p-4 mt-4">
          <div className="flex justify-between gap-3">
            <div className="font-medium">
              {txn.vendor || "(No vendor)"} —{" "}
              {txn.description || "(No description)"}
            </div>
            <div className="whitespace-nowrap">{prettyAmount}</div>
          </div>

          <div className="flex justify-between text-sm opacity-80 mt-2">
            <div>{txn.txn_date}</div>
            <div>{txn.category || "Uncategorized"}</div>
          </div>

          {/* Category editor */}
          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium">Category</label>
            <div className="flex gap-2">
              <select
                className="border p-2 rounded w-full"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                className="bg-black text-white px-4 py-2 rounded font-medium whitespace-nowrap"
                onClick={saveCategory}
                disabled={savingCategory}
              >
                {savingCategory ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt upload */}
      <section className="border rounded p-4 mt-6">
        <h2 className="font-semibold mb-3">Add receipt</h2>

        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button
          className="bg-black text-white px-4 py-3 rounded font-medium mt-3"
          onClick={uploadReceipt}
        >
          Upload
        </button>

        <p className="text-sm opacity-80 mt-2">
          Tip: On phone, this will let her take a photo or select a PDF.
        </p>
      </section>

      {/* Receipt list */}
      <section className="mt-6">
        <h2 className="font-semibold mb-3">Receipts</h2>

        {receipts.length === 0 ? (
          <p className="opacity-80">No receipts uploaded yet.</p>
        ) : (
          <div className="grid gap-2">
            {receipts.map((r) => (
              <div
                key={r.id}
                className="border rounded p-4 flex justify-between gap-3"
              >
                <div>
                  <div className="font-medium">
                    {r.file_name || r.storage_path}
                  </div>
                  <div className="text-sm opacity-80 mt-1">
                    {new Date(r.uploaded_at).toLocaleString()}
                  </div>
                </div>

                <button
                  className="border rounded px-4 py-2 font-medium whitespace-nowrap"
                  onClick={() => openReceipt(r.storage_path)}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
