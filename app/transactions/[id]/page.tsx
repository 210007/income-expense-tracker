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
  project_id: string | null;
};

type Project = { id: string; name: string };

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [savingProject, setSavingProject] = useState(false);

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

    const [{ data: txnData, error: txnErr }, { data: projData }] = await Promise.all([
      supabase.from("transactions").select("id, txn_date, type, amount, vendor, description, category, project_id").eq("id", txnId).single(),
      supabase.from("projects").select("id, name").eq("user_id", sessionData.session!.user.id).neq("status", "archived").order("name"),
    ]);

    if (txnErr) return setError(txnErr.message);

    const t = txnData as Txn;
    setTxn(t);
    setCategory(t.category || "Other");
    setProjectId(t.project_id ?? "");
    setProjects((projData as Project[]) ?? []);

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

    setStatus("Category saved");
    await load();
  };

  const saveProject = async () => {
    setError(null);
    setStatus("");
    if (!txnId) return;
    setSavingProject(true);
    const { error: updErr } = await supabase
      .from("transactions")
      .update({ project_id: projectId || null })
      .eq("id", txnId);
    setSavingProject(false);
    if (updErr) return setError(updErr.message);
    setStatus("Project saved");
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
    setStatus("Uploaded");
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <a
          href="/transactions"
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          ←
        </a>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Details, category, and receipts</p>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
      {status && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{status}</p>}

      {!txn ? (
        <div className="animate-pulse space-y-3">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-24" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-16" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-5">
          <div className="flex justify-between gap-3 mb-3">
            <div className="font-semibold text-gray-900 dark:text-white">
              {txn.vendor || "(No vendor)"} — {txn.description || "(No description)"}
            </div>
            <div className={`whitespace-nowrap font-semibold tabular-nums ${txn.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {prettyAmount}
            </div>
          </div>

          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-5">
            <div>{txn.txn_date}</div>
            <div>{txn.category || "Uncategorized"}</div>
          </div>

          {/* Category editor */}
          <div className="space-y-2 mb-4">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Category</label>
            <div className="flex gap-2">
              <select
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-40"
                onClick={saveCategory}
                disabled={savingCategory}
              >
                {savingCategory ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Project tagger */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Project</label>
              <div className="flex gap-2">
                <select
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-40"
                  onClick={saveProject}
                  disabled={savingProject}
                >
                  {savingProject ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Receipt upload */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Add Receipt</h2>

        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-gray-600 dark:text-gray-400 mb-3 block"
        />

        <button
          className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          onClick={uploadReceipt}
        >
          Upload
        </button>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
          Tip: On phone, this will let you take a photo or select a PDF.
        </p>
      </section>

      {/* Receipt list */}
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Receipts</h2>

        {receipts.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm text-gray-500 dark:text-gray-400">
            No receipts uploaded yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl justify-between"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {r.file_name || r.storage_path}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(r.uploaded_at).toLocaleString()}
                  </div>
                </div>

                <button
                  className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
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
