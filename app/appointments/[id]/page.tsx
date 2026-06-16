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
  scheduled: "text-blue-600 dark:text-blue-400",
  completed: "text-green-600 dark:text-green-400",
  cancelled: "opacity-30",
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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (error) return <main className="p-6 max-w-4xl mx-auto"><p className="text-red-600">{error}</p></main>;
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
          <button onClick={() => router.push("/appointments")} className="text-sm opacity-50 hover:opacity-80 mb-2 block">
            ← Appointments
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{appointment.title}</h1>
            <span className={`text-sm font-medium capitalize ${STATUS_STYLE[appointment.status]}`}>
              {appointment.status}
            </span>
          </div>
          {appointment.customers && (
            <p className="text-sm opacity-60 mt-1">{appointment.customers.name}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {statusActions.map((action) => (
            <button
              key={action.status}
              onClick={() => setStatus(action.status)}
              disabled={updating}
              className={`border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-40 ${
                action.status === "completed" ? "border-green-500 text-green-600 dark:text-green-400" :
                action.status === "cancelled" ? "border-red-400 text-red-500 opacity-60" : ""
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="border rounded-xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="opacity-50 mb-1">Start</p>
          <p>{fmt(appointment.start_time)}</p>
        </div>
        <div>
          <p className="opacity-50 mb-1">End</p>
          <p>{appointment.end_time ? fmt(appointment.end_time) : "—"}</p>
        </div>
        <div>
          <p className="opacity-50 mb-1">Customer</p>
          <p>
            {appointment.customers ? (
              <a href={`/customers/${appointment.customers.id}`} className="underline underline-offset-2">
                {appointment.customers.name}
              </a>
            ) : "—"}
          </p>
        </div>
      </div>

      {/* Notes */}
      {appointment.notes && (
        <section className="border rounded-xl p-5 mb-5 text-sm opacity-70">
          <p className="font-medium opacity-60 mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{appointment.notes}</p>
        </section>
      )}

      {/* Invoice */}
      <section className="border rounded-xl p-5 text-sm">
        <p className="font-medium mb-3">Invoice</p>
        {appointment.invoice_id ? (
          <a
            href={`/invoices/${appointment.invoice_id}`}
            className="inline-block border rounded px-3 py-1.5 hover:opacity-70"
          >
            View Invoice →
          </a>
        ) : (
          <div>
            <p className="opacity-60 mb-3">No invoice linked to this appointment.</p>
            <button
              onClick={createInvoice}
              disabled={creatingInvoice}
              className="bg-black text-white dark:bg-white dark:text-black rounded px-4 py-2 text-sm font-medium hover:opacity-80 disabled:opacity-40"
            >
              {creatingInvoice ? "Creating…" : "Create Invoice from Appointment"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
