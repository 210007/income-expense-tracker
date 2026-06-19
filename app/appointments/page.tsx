"use client";

import { useEffect, useMemo, useState } from "react";
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
  customers: { id: string; name: string } | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-300 dark:bg-gray-600",
};

const STATUS_CHIP: Record<string, string> = {
  scheduled: "bg-blue-500 text-white",
  completed: "bg-green-500 text-white",
  cancelled: "bg-gray-200 dark:bg-gray-700 text-gray-500",
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function fmtDayLabel(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

export default function AppointmentsPage() {
  const now = useMemo(() => new Date(), []);
  const todayISO = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO);

  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("scheduling");
      if (!active) {
        if (!cancelled) { setGated(true); setLoading(false); }
        return;
      }

      const start = isoDate(year, month, 1);
      const end = isoDate(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, 1);

      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, notes, start_time, end_time, status, invoice_id, customers(id, name)")
        .eq("user_id", sessionData.session.user.id)
        .gte("start_time", start)
        .lt("start_time", end)
        .order("start_time");

      if (cancelled) return;
      if (error) setError(error.message);
      else setAppointments((data as unknown as Appointment[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const d = a.start_time.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(a);
    }
    return map;
  }, [appointments]);

  const selectedAppts = useMemo(() => byDate.get(selectedDate) ?? [], [byDate, selectedDate]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, iso: null });
    for (let d = 1; d <= totalDays; d++) cells.push({ day: d, iso: isoDate(year, month, d) });
    while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
    return cells;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(todayISO);
  };

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-9 bg-gray-200 dark:bg-gray-800 rounded-xl w-64" />
          <div className="grid grid-cols-7 gap-0.5">
            {[...Array(35)].map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
          </div>
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Schedule</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          The Scheduling module isn't active on your plan.
        </p>
        <Link href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Add Scheduling — $9/mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schedule</h1>

          <div className="flex items-center gap-0 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={prevMonth}
              className="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-base transition-colors"
            >
              ‹
            </button>
            <span className="px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap select-none">
              {MONTHS[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-base transition-colors"
            >
              ›
            </button>
          </div>

          <button
            onClick={goToday}
            className="h-9 px-3 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Today
          </button>
        </div>

        <Link
          href={`/appointments/new?date=${selectedDate}`}
          className="flex items-center gap-1.5 px-4 py-2 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Appointment
        </Link>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Layout: calendar + side panel */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2 uppercase tracking-widest">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell.day || !cell.iso) {
                return (
                  <div
                    key={i}
                    className="min-h-[80px] sm:min-h-[96px] rounded-xl bg-gray-50 dark:bg-gray-900/20 opacity-30"
                  />
                );
              }

              const isToday = cell.iso === todayISO;
              const isSelected = cell.iso === selectedDate;
              const dayAppts = byDate.get(cell.iso) ?? [];

              return (
                <button
                  key={cell.iso}
                  onClick={() => setSelectedDate(cell.iso!)}
                  className={`min-h-[80px] sm:min-h-[96px] rounded-xl p-1.5 sm:p-2 text-left flex flex-col transition-all ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-500/40 shadow-sm"
                      : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800"
                  }`}
                >
                  <span
                    className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full mb-1 ${
                      isToday
                        ? "brand-gradient text-white"
                        : isSelected
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {cell.day}
                  </span>

                  <div className="flex flex-col gap-0.5 flex-1 overflow-hidden w-full">
                    {dayAppts.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded font-medium truncate ${STATUS_CHIP[a.status]}`}
                      >
                        <span className="hidden sm:inline">{fmtTime(a.start_time)} </span>
                        {a.title}
                      </div>
                    ))}
                    {dayAppts.length > 2 && (
                      <div className="text-[10px] sm:text-xs text-gray-400 px-1">
                        +{dayAppts.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day panel */}
        <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden lg:sticky lg:top-20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-sm text-gray-900 dark:text-white">
              {fmtDayLabel(selectedDate)}
            </h2>
            <Link
              href={`/appointments/new?date=${selectedDate}`}
              className="w-7 h-7 flex items-center justify-center brand-gradient rounded-lg text-white hover:opacity-90 transition-opacity"
              title="Add appointment"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>

          <div className="p-3">
            {selectedAppts.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 mb-2">Nothing scheduled</p>
                <Link
                  href={`/appointments/new?date=${selectedDate}`}
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                >
                  Schedule something →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedAppts.map((a) => (
                  <Link
                    key={a.id}
                    href={`/appointments/${a.id}`}
                    className={`block p-3 rounded-xl border transition-colors hover:shadow-sm ${
                      a.status === "cancelled"
                        ? "border-gray-100 dark:border-gray-800 opacity-50"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_DOT[a.status]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {a.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmtTime(a.start_time)}
                          {a.end_time ? ` – ${fmtTime(a.end_time)}` : ""}
                        </p>
                        {a.customers && (
                          <p className="text-xs text-gray-400 mt-0.5">{a.customers.name}</p>
                        )}
                        {a.invoice_id && (
                          <span className="text-xs text-green-600 dark:text-green-400 mt-0.5 block">
                            Invoiced
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
