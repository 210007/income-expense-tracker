"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Appointment = {
  id: string;
  title: string;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  status: "scheduled" | "completed" | "cancelled";
  invoice_id: string | null;
  customers: { id: string; name: string; email: string | null } | null;
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
  completed: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  cancelled: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const { data, error } = await supabase
      .from("appointments")
      .select("id, title, notes, start_time, end_time, status, invoice_id, customers(id, name, email)")
      .eq("id", id)
      .eq("user_id", sessionData.session.user.id)
      .single();

    if (error || !data) { setError(error?.message ?? "Appointment not found."); setLoading(false); return; }
    setAppointment(data as unknown as Appointment);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const setStatus = async (status: Appointment["status"]) => {
    if (!appointment) return;
    setUpdating(true);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id);
    setUpdating(false);
    if (error) { setError(error.message); return; }
    setAppointment((prev) => prev ? { ...prev, status } : prev);
  };

  const createInvoice = async () => {
    if (!appointment) return;
    setCreatingInvoice(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;

    const userId = sessionData.session.user.id;

    // Auto-number the invoice
    const { data: lastInv } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastNum = (lastInv?.[0]?.invoice_number ?? "INV-000").replace(/\D/g, "");
    const next = String(parseInt(lastNum || "0") + 1).padStart(3, "0");
    const invoiceNumber = `INV-${next}`;

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        customer_id: appointment.customers?.id ?? null,
        invoice_number: invoiceNumber,
        status: "draft",
        issue_date: new Date().toISOString().slice(0, 10),
        notes: `From appointment: ${appointment.title}`,
      })
      .select("id")
      .single();

    if (invErr || !inv) { setError(invErr?.message ?? "Failed to create invoice."); setCreatingInvoice(false); return; }

    // Link the invoice back to this appointment
    await supabase.from("appointments").update({ invoice_id: inv.id }).eq("id", appointment.id);

    setCreatingInvoice(false);
    router.push(`/invoices/${inv.id}`);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  if (loading) return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-56" />
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-32" />
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-20" />
      </div>
    </main>
  );

  if (error) return (
    <main className="p-6 max-w-4xl mx-auto">
      <p className="text-red-600">{error}</p>
    </main>
  );

  if (!appointment) return null;

  const statusActions = (
    [
      { label: "Mark Completed", status: "completed" },
      { label: "Mark Scheduled", status: "scheduled" },
      { label: "Cancel", status: "cancelled" },
    ] as { label: string; status: Appointment["status"] }[]
  ).filter((a) => a.status !== appointment.status);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => router.push("/appointments")}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-3"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{appointment.title}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[appointment.status]}`}>
              {appointment.status}
            </span>
          </div>
          {appointment.customers && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{appointment.customers.name}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {statusActions.map((action) => (
            <button
              key={action.status}
              onClick={() => setStatus(action.status)}
              disabled={updating}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
                action.status === "completed"
                  ? "border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                  : action.status === "cancelled"
                  ? "border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Start</p>
          <p className="text-gray-900 dark:text-white">{fmt(appointment.start_time)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">End</p>
          <p className="text-gray-900 dark:text-white">{appointment.end_time ? fmt(appointment.end_time) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Customer</p>
          <p>
            {appointment.customers ? (
              <a
                href={`/customers/${appointment.customers.id}`}
                className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
              >
                {appointment.customers.name}
              </a>
            ) : <span className="text-gray-400 dark:text-gray-500">—</span>}
          </p>
        </div>
      </div>

      {/* Notes */}
      {appointment.notes && (
        <section className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-5 text-sm text-gray-500 dark:text-gray-400">
          <p className="font-semibold text-gray-900 dark:text-white mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{appointment.notes}</p>
        </section>
      )}

      {/* Invoice */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <p className="font-semibold text-gray-900 dark:text-white mb-3">Invoice</p>
        {appointment.invoice_id ? (
          <a
            href={`/invoices/${appointment.invoice_id}`}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            View Invoice →
          </a>
        ) : (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No invoice linked to this appointment.</p>
            <button
              onClick={createInvoice}
              disabled={creatingInvoice}
              className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {creatingInvoice ? "Creating…" : "Create Invoice from Appointment"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
