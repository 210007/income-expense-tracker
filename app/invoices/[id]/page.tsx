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
  customers: { id: string; name: string; email: string | null } | null;
  invoice_items: { id: string; description: string; quantity: number; unit_price: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "opacity-50",
  sent: "text-blue-600 dark:text-blue-400",
  paid: "text-green-600 dark:text-green-400",
  void: "opacity-30",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const { data, error } = await supabase
      .from("invoices")
      .select(`
        id, invoice_number, status, issue_date, due_date, notes,
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

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (error) return <main className="p-6 max-w-4xl mx-auto"><p className="text-red-600">{error}</p></main>;
  if (!invoice) return null;

  const total = invoice.invoice_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const statusActions: { label: string; status: Invoice["status"] }[] = [
    { label: "Mark as Sent", status: "sent" },
    { label: "Mark as Paid", status: "paid" },
    { label: "Mark as Draft", status: "draft" },
    { label: "Void Invoice", status: "void" },
  ].filter((a) => a.status !== invoice.status);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.push("/invoices")} className="text-sm opacity-50 hover:opacity-80 mb-2 block">
            ← Invoices
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold font-mono">{invoice.invoice_number}</h1>
            <span className={`text-sm font-medium capitalize ${STATUS_STYLE[invoice.status]}`}>
              {STATUS_LABEL[invoice.status]}
            </span>
          </div>
          {invoice.customers && (
            <p className="text-sm opacity-60 mt-1">{invoice.customers.name}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {statusActions.map((action) => (
            <button
              key={action.status}
              onClick={() => setStatus(action.status)}
              disabled={updating}
              className={`border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-40 ${
                action.status === "paid"
                  ? "border-green-500 text-green-600 dark:text-green-400"
                  : action.status === "void"
                  ? "border-red-400 text-red-500 opacity-60"
                  : ""
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="border rounded-xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="opacity-50 mb-1">Issue Date</p>
          <p>{fmt(invoice.issue_date)}</p>
        </div>
        <div>
          <p className="opacity-50 mb-1">Due Date</p>
          <p>{invoice.due_date ? fmt(invoice.due_date) : "—"}</p>
        </div>
        <div>
          <p className="opacity-50 mb-1">Customer</p>
          <p>
            {invoice.customers ? (
              <a href={`/customers/${invoice.customers.id}`} className="underline underline-offset-2">
                {invoice.customers.name}
              </a>
            ) : "—"}
          </p>
        </div>
        <div>
          <p className="opacity-50 mb-1">Email</p>
          <p>{invoice.customers?.email ?? "—"}</p>
        </div>
      </div>

      {/* Line items */}
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
            {invoice.invoice_items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-2.5">{item.description}</td>
                <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtMoney(item.unit_price)}</td>
                <td className="py-2.5 text-right tabular-nums font-medium">
                  {fmtMoney(item.quantity * item.unit_price)}
                </td>
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

      {/* Notes */}
      {invoice.notes && (
        <section className="border rounded-xl p-5 text-sm opacity-70">
          <p className="font-medium opacity-60 mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{invoice.notes}</p>
        </section>
      )}
    </main>
  );
}
