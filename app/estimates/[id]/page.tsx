"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Estimate = {
  id: string;
  estimate_number: string;
  status: "draft" | "sent" | "accepted" | "declined" | "converted";
  issue_date: string;
  expiry_date: string | null;
  notes: string | null;
  invoice_id: string | null;
  customers: { id: string; name: string; email: string | null } | null;
  estimate_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "opacity-50",
  sent: "text-blue-600 dark:text-blue-400",
  accepted: "text-green-600 dark:text-green-400",
  declined: "text-red-500 opacity-60",
  converted: "opacity-40",
};

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }
      setAccessToken(sessionData.session.access_token);

      const { data, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, status, issue_date, expiry_date, notes, invoice_id, customers(id, name, email), estimate_items(id, description, quantity, unit_price)")
        .eq("id", id)
        .eq("user_id", sessionData.session.user.id)
        .single();

      if (error || !data) { setError(error?.message ?? "Estimate not found."); setLoading(false); return; }
      setEstimate(data as unknown as Estimate);
      setLoading(false);
    })();
  }, [id]);

  const setStatus = async (status: Estimate["status"]) => {
    if (!estimate) return;
    setUpdating(true);
    await supabase.from("estimates").update({ status, updated_at: new Date().toISOString() }).eq("id", estimate.id);
    setUpdating(false);
    setEstimate((prev) => prev ? { ...prev, status } : prev);
  };

  const convertToInvoice = async () => {
    if (!estimate) return;
    setConverting(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const userId = sessionData.session.user.id;

    const { data: lastInv } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastNum = (lastInv?.[0]?.invoice_number ?? "INV-000").replace(/\D/g, "");
    const invNumber = `INV-${String(parseInt(lastNum || "0") + 1).padStart(3, "0")}`;

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        customer_id: estimate.customers?.id ?? null,
        invoice_number: invNumber,
        status: "draft",
        issue_date: new Date().toISOString().slice(0, 10),
        notes: estimate.notes,
      })
      .select("id")
      .single();

    if (invErr || !inv) { setError(invErr?.message ?? "Failed to create invoice."); setConverting(false); return; }

    await supabase.from("invoice_items").insert(
      estimate.estimate_items.map((i) => ({
        invoice_id: inv.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }))
    );

    await supabase.from("estimates").update({ status: "converted", invoice_id: inv.id, updated_at: new Date().toISOString() }).eq("id", estimate.id);

    router.push(`/invoices/${inv.id}`);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const sendEmail = async () => {
    if (!estimate || !accessToken) return;
    setSending(true);
    const res = await fetch(`/api/estimates/${estimate.id}/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setSending(false);
    const { error: err } = await res.json();
    if (err) { setError(err); return; }
    setEstimate((prev) => prev && prev.status === "draft" ? { ...prev, status: "sent" } : prev);
    showToast("Estimate sent by email!");
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (error) return <main className="p-6 max-w-4xl mx-auto"><p className="text-red-600">{error}</p></main>;
  if (!estimate) return null;

  const total = estimate.estimate_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const canConvert = estimate.status === "accepted" && !estimate.invoice_id;

  const statusActions = (
    [
      { label: "Mark as Sent", status: "sent" },
      { label: "Mark Accepted", status: "accepted" },
      { label: "Mark Declined", status: "declined" },
      { label: "Save as Draft", status: "draft" },
    ] as { label: string; status: Estimate["status"] }[]
  ).filter((a) => a.status !== estimate.status && estimate.status !== "converted");

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white dark:bg-white dark:text-black text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 font-medium">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.push("/estimates")} className="text-sm opacity-50 hover:opacity-80 mb-2 block">← Estimates</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold font-mono">{estimate.estimate_number}</h1>
            <span className={`text-sm font-medium capitalize ${STATUS_STYLE[estimate.status]}`}>{estimate.status}</span>
          </div>
          {estimate.customers && <p className="text-sm opacity-60 mt-1">{estimate.customers.name}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Utility actions */}
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`/estimates/${estimate.id}/print`, "_blank")}
              className="border rounded px-3 py-1.5 text-sm hover:opacity-70"
            >
              Print / PDF
            </button>
            <button
              onClick={sendEmail}
              disabled={sending || !estimate.customers?.email}
              title={!estimate.customers?.email ? "Customer has no email address" : undefined}
              className="border rounded px-3 py-1.5 text-sm hover:opacity-70 disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send by Email"}
            </button>
          </div>
          {/* Status / workflow actions */}
          <div className="flex gap-2 flex-wrap justify-end">
            {canConvert && (
              <button onClick={convertToInvoice} disabled={converting} className="bg-black text-white dark:bg-white dark:text-black rounded px-3 py-1.5 text-sm font-medium hover:opacity-80 disabled:opacity-40">
                {converting ? "Converting…" : "Convert to Invoice"}
              </button>
            )}
            {estimate.invoice_id && (
              <a href={`/invoices/${estimate.invoice_id}`} className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">
                View Invoice →
              </a>
            )}
            {statusActions.map((action) => (
              <button key={action.status} onClick={() => setStatus(action.status)} disabled={updating} className={`border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-40 ${action.status === "accepted" ? "border-green-500 text-green-600 dark:text-green-400" : action.status === "declined" ? "border-red-400 text-red-500 opacity-60" : ""}`}>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><p className="opacity-50 mb-1">Issue Date</p><p>{fmt(estimate.issue_date)}</p></div>
        <div><p className="opacity-50 mb-1">Expiry Date</p><p>{estimate.expiry_date ? fmt(estimate.expiry_date) : "—"}</p></div>
        <div><p className="opacity-50 mb-1">Customer</p><p>{estimate.customers ? <a href={`/customers/${estimate.customers.id}`} className="underline underline-offset-2">{estimate.customers.name}</a> : "—"}</p></div>
        <div><p className="opacity-50 mb-1">Email</p><p>{estimate.customers?.email ?? "—"}</p></div>
      </div>

      <section className="border rounded-xl p-5 mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="opacity-50 text-left border-b">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium text-right w-16">Qty</th>
              <th className="pb-2 font-medium text-right w-28">Unit Price</th>
              <th className="pb-2 font-medium text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {estimate.estimate_items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-2.5">{item.description}</td>
                <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtMoney(item.unit_price)}</td>
                <td className="py-2.5 text-right tabular-nums font-medium">{fmtMoney(item.quantity * item.unit_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-right font-semibold">Total</td>
              <td className="pt-4 text-right tabular-nums font-semibold text-lg">{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {estimate.notes && (
        <section className="border rounded-xl p-5 text-sm opacity-70">
          <p className="font-medium opacity-60 mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{estimate.notes}</p>
        </section>
      )}
    </main>
  );
}
