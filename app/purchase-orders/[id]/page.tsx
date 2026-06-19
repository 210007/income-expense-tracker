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

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  sent: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  received: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  cancelled: "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400",
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

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="mt-4 h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error && !po) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 font-semibold">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => router.push("/purchase-orders")}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-3"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{po.po_number}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[po.status]}`}>
              {po.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{po.vendor}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/purchase-orders/${po.id}/edit`)}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => window.open(`/purchase-orders/${po.id}/print`, "_blank")}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Print / PDF
            </button>
            {po.vendor_email && (
              <button
                onClick={sendEmail}
                disabled={sending}
                className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
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
                className={`px-4 py-2 border rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
                  action.status === "received"
                    ? "border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                    : action.status === "cancelled"
                    ? "border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Order Date</p>
          <p className="text-gray-900 dark:text-white">{fmt(po.order_date)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Expected</p>
          <p className="text-gray-900 dark:text-white">{po.expected_date ? fmt(po.expected_date) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Vendor</p>
          <p className="text-gray-900 dark:text-white">{po.vendor}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Vendor Email</p>
          <p className="text-gray-900 dark:text-white">{po.vendor_email ?? "—"}</p>
        </div>
      </div>

      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
              <th className="pb-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</th>
              <th className="pb-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right w-16">Qty</th>
              <th className="pb-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right w-28">Unit Price</th>
              <th className="pb-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.purchase_order_items.map((it) => (
              <tr key={it.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                <td className="py-2.5 text-gray-900 dark:text-white">{it.description}</td>
                <td className="py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{Number(it.quantity)}</td>
                <td className="py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{fmtMoney(Number(it.unit_price))}</td>
                <td className="py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{fmtMoney(Number(it.quantity) * Number(it.unit_price))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-right font-semibold text-gray-900 dark:text-white">Total</td>
              <td className="pt-4 text-right tabular-nums font-bold text-lg text-gray-900 dark:text-white">{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {po.notes && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-sm">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Notes</p>
          <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{po.notes}</p>
        </section>
      )}
    </main>
  );
}
