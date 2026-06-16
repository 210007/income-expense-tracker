"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PO = {
  id: string;
  po_number: string;
  vendor: string;
  vendor_email: string | null;
  status: "draft" | "sent" | "received" | "cancelled";
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  purchase_order_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "opacity-40",
  sent: "text-blue-600 dark:text-blue-400",
  received: "text-green-600 dark:text-green-400",
  cancelled: "opacity-30",
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<PO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }
    setAccessToken(sessionData.session.access_token);

    const { data, error } = await supabase
      .from("purchase_orders")
      .select("id, po_number, vendor, vendor_email, status, order_date, expected_date, notes, purchase_order_items(id, description, quantity, unit_price)")
      .eq("id", id)
      .eq("user_id", sessionData.session.user.id)
      .single();

    if (error || !data) { setError(error?.message ?? "Purchase order not found."); setLoading(false); return; }
    setPo(data as unknown as PO);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const setStatus = async (status: PO["status"]) => {
    if (!po) return;
    setUpdating(true);
    await supabase.from("purchase_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", po.id);
    setUpdating(false);
    setPo((prev) => prev ? { ...prev, status } : prev);
  };

  const sendEmail = async () => {
    if (!po || !accessToken) return;
    setSending(true);
    const res = await fetch(`/api/purchase-orders/${po.id}/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setSending(false);
    const { error: err } = await res.json();
    if (err) { setError(err); return; }
    if (po.status === "draft") setPo((prev) => prev ? { ...prev, status: "sent" } : prev);
    showToast("Purchase order sent by email!");
  };

  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (error && !po) return <main className="p-6 max-w-4xl mx-auto"><p className="text-red-600">{error}</p></main>;
  if (!po) return null;

  const total = po.purchase_order_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);

  const statusActions = (
    [
      { label: "Mark as Sent", status: "sent" },
      { label: "Mark as Received", status: "received" },
      { label: "Revert to Draft", status: "draft" },
      { label: "Cancel", status: "cancelled" },
    ] as { label: string; status: PO["status"] }[]
  ).filter((a) => a.status !== po.status);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white dark:bg-white dark:text-black text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 font-medium">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.push("/purchase-orders")} className="text-sm opacity-50 hover:opacity-80 mb-2 block">← Purchase Orders</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold font-mono">{po.po_number}</h1>
            <span className={`text-sm font-medium capitalize ${STATUS_STYLE[po.status]}`}>{po.status}</span>
          </div>
          <p className="text-sm opacity-60 mt-1">{po.vendor}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`/purchase-orders/${po.id}/print`, "_blank")}
              className="border rounded px-3 py-1.5 text-sm hover:opacity-70"
            >
              Print / PDF
            </button>
            {po.vendor_email && (
              <button
                onClick={sendEmail}
                disabled={sending}
                className="border rounded px-3 py-1.5 text-sm hover:opacity-70 disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send by Email"}
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {statusActions.map((action) => (
              <button
                key={action.status}
                onClick={() => setStatus(action.status)}
                disabled={updating}
                className={`border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-40 ${
                  action.status === "received" ? "border-green-500 text-green-600 dark:text-green-400" :
                  action.status === "cancelled" ? "border-red-400 text-red-500 opacity-60" : ""
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><p className="opacity-50 mb-1">Order Date</p><p>{fmt(po.order_date)}</p></div>
        <div><p className="opacity-50 mb-1">Expected</p><p>{po.expected_date ? fmt(po.expected_date) : "—"}</p></div>
        <div><p className="opacity-50 mb-1">Vendor</p><p>{po.vendor}</p></div>
        <div><p className="opacity-50 mb-1">Vendor Email</p><p>{po.vendor_email ?? "—"}</p></div>
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
            {po.purchase_order_items.map((it) => (
              <tr key={it.id} className="border-b last:border-0">
                <td className="py-2.5">{it.description}</td>
                <td className="py-2.5 text-right tabular-nums">{Number(it.quantity)}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtMoney(Number(it.unit_price))}</td>
                <td className="py-2.5 text-right tabular-nums font-medium">{fmtMoney(Number(it.quantity) * Number(it.unit_price))}</td>
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

      {po.notes && (
        <section className="border rounded-xl p-5 text-sm opacity-70">
          <p className="font-medium opacity-60 mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{po.notes}</p>
        </section>
      )}
    </main>
  );
}
