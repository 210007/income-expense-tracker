"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Appointment = {
  id: string;
  title: string;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  status: "scheduled" | "completed" | "cancelled";
  invoice_id: string | null;
  customers: { name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "text-blue-600 dark:text-blue-400",
  completed: "text-green-600 dark:text-green-400",
  cancelled: "opacity-30",
};

export default function AppointmentsPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("scheduling");
      if (!active) { setGated(true); setLoading(false); return; }

      const query = supabase
        .from("appointments")
        .select("id, title, notes, start_time, end_time, status, invoice_id, customers(name)")
        .eq("user_id", sessionData.session.user.id)
        .order("start_time", { ascending: true });

      const { data, error } = await query;

      if (error) { setError(error.message); setLoading(false); return; }
      setAppointments((data as unknown as Appointment[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  const now = new Date().toISOString();

  const visible = filter === "upcoming"
    ? appointments.filter((a) => a.start_time >= now && a.status !== "cancelled")
    : appointments;

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Appointments</h1>
        <p className="opacity-60 mb-6 text-sm">The Appointment Scheduling module isn&apos;t active on your plan.</p>
        <Link
          href="/plan"
          className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80"
        >
          Add Scheduling — $9 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Appointments</h1>
          <p className="text-sm opacity-50 mt-0.5">{visible.length} shown</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden text-sm">
            {(["upcoming", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 capitalize ${filter === f ? "bg-black text-white dark:bg-white dark:text-black" : "hover:opacity-70"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <Link
            href="/appointments/new"
            className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70"
          >
            New
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {visible.length === 0 ? (
        <p className="opacity-50 text-sm">
          {filter === "upcoming" ? "No upcoming appointments." : "No appointments yet."}{" "}
          <Link href="/appointments/new" className="underline">Schedule one.</Link>
        </p>
      ) : (
        <div className="grid gap-2">
          {visible.map((a) => (
            <Link
              key={a.id}
              href={`/appointments/${a.id}`}
              className="block border rounded-lg p-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{a.title}</span>
                <span className={`text-xs font-medium capitalize ${STATUS_STYLE[a.status]}`}>
                  {a.status}
                </span>
              </div>
              <div className="text-sm opacity-60 mt-1 flex gap-2">
                {a.customers && <span>{a.customers.name}</span>}
                {a.customers && <span>·</span>}
                <span>{fmt(a.start_time)}</span>
                {a.invoice_id && <><span>·</span><span className="text-green-600 dark:text-green-400">Invoiced</span></>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
