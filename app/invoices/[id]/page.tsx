"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Invoice = {
  id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "void";
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  public_token: string;
  customers: { id: string; name: string; email: string | null } | null;
  invoice_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  sent: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  void: "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
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
      .from("invoices")
      .select(`
        id, invoice_number, status, issue_date, due_date, notes, public_token,
        customers ( id, name, email ),
        invoice_items ( id, description, quantity, unit_price )
      `)
      .eq("id", id)
      .eq("user_id", sessionData.session.user.id)
      .single();

    if (error || !data) { setError(error?.message ?? "Invoice not found."); setLoading(false); return; }
    setInvoice(data as unknown as Invoice);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const setStatus = async (status: Invoice["status"]) => {
    if (!invoice) return;
    setUpdating(true);
    const { error } = await supabase
      .from("invoices")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", invoice.id);
    setUpdating(false);
    if (error) { setError(error.message); return; }
    setInvoice((prev) => prev ? { ...prev, status } : prev);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const sendEmail = async () => {
    if (!invoice || !accessToken) return;
    setSending(true);
    const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setSending(false);
    const { error: err } = await res.json();
    if (err) { setError(err); return; }
    setInvoice((prev) => prev && prev.status === "draft" ? { ...prev, status: "sent" } : prev);
    showToast("Invoice sent by email!");
  };

  const copyPaymentLink = () => {
    if (!invoice) return;
    const url = `${window.location.origin}/pay/${invoice.public_token}`;
    navigator.clipboard.writeText(url);
    showToast("Payment link copied!");
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-48" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-28" />
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-48" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-red-600 text-sm">{error}</p>
      </main>
    );
  }

  if (!invoice) return null;

  const total = invoice.invoice_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const statusActions = (
    [
      { label: "Mark as Sent", status: "sent" },
      { label: "Mark as Paid", status: "paid" },
      { label: "Mark as Draft", status: "draft" },
      { label: "Void Invoice", status: "void" },
    ] as { label: string; status: Invoice["status"] }[]
  ).filter((a) => a.status !== invoice.status);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => router.push("/invoices")}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-3"
            aria-label="Back to Invoices"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{invoice.invoice_number}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[invoice.status]}`}>
              {STATUS_LABEL[invoice.status]}
            </span>
          </div>
          {invoice.customers && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{invoice.customers.name}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Utility actions */}
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => window.open(`/invoices/${invoice.id}/print`, "_blank")}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Print / PDF
            </button>
            <button
              onClick={copyPaymentLink}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Copy Payment Link
            </button>
            <button
              onClick={sendEmail}
              disabled={sending || !invoice.customers?.email}
              title={!invoice.customers?.email ? "Customer has no email address" : undefined}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? "Sending…" : "Send by Email"}
            </button>
          </div>
          {/* Status actions */}
          <div className="flex gap-2 flex-wrap justify-end">
            {statusActions.map((action) => (
              <button
                key={action.status}
                onClick={() => setStatus(action.status)}
                disabled={updating}
                className={`px-5 py-2.5 border rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  action.status === "paid"
                    ? "border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                    : action.status === "void"
                    ? "border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Issue Date</p>
          <p className="text-gray-900 dark:text-white">{fmt(invoice.issue_date)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Due Date</p>
          <p className="text-gray-900 dark:text-white">{invoice.due_date ? fmt(invoice.due_date) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Customer</p>
          <p>
            {invoice.customers ? (
              <a href={`/customers/${invoice.customers.id}`} className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
                {invoice.customers.name}
              </a>
            ) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Email</p>
          <p className="text-gray-900 dark:text-white">{invoice.customers?.email ?? "—"}</p>
        </div>
      </div>

      {/* Line items */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
              <th className="pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
              <th className="pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right w-16">Qty</th>
              <th className="pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right w-28">Unit Price</th>
              <th className="pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                <td className="py-3 text-gray-900 dark:text-white">{item.description}</td>
                <td className="py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{item.quantity}</td>
                <td className="py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtMoney(item.unit_price)}</td>
                <td className="py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                  {fmtMoney(item.quantity * item.unit_price)}
                </td>
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

      {/* Notes */}
      {invoice.notes && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Notes</p>
          <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{invoice.notes}</p>
        </section>
      )}
    </main>
  );
}
