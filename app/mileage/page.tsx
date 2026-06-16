"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

const IRS_RATE = 0.70; // 2025 IRS standard mileage rate (70¢/mile)

type Log = {
  id: string;
  trip_date: string;
  miles: number;
  purpose: string;
  from_location: string | null;
  to_location: string | null;
};

export default function MileagePage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  const load = async (yr: number) => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const active = await hasModule("mileage");
    if (!active) { setGated(true); setLoading(false); return; }

    const { data, error } = await supabase
      .from("mileage_logs")
      .select("id, trip_date, miles, purpose, from_location, to_location")
      .eq("user_id", sessionData.session.user.id)
      .gte("trip_date", `${yr}-01-01`)
      .lte("trip_date", `${yr}-12-31`)
      .order("trip_date", { ascending: false });

    if (error) { setError(error.message); setLoading(false); return; }
    setLogs((data as Log[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year]);

  const remove = async (id: string) => {
    await supabase.from("mileage_logs").delete().eq("id", id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const totalMiles = logs.reduce((s, l) => s + Number(l.miles), 0);
  const totalDeduction = totalMiles * IRS_RATE;

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const currentYear = new Date().getFullYear();

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Mileage Tracking</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Mileage Tracking — $6 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Mileage</h1>
          <p className="text-sm opacity-50 mt-0.5">{year} business trips</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded overflow-hidden text-sm">
            <button onClick={() => setYear((y) => y - 1)} className="px-2 py-1.5 hover:opacity-70">←</button>
            <span className="px-2 font-medium tabular-nums">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear} className="px-2 py-1.5 hover:opacity-70 disabled:opacity-30">→</button>
          </div>
          <Link href="/mileage/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">
            Log Trip
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border rounded-xl p-4">
          <p className="text-xs opacity-50 mb-1">Total Miles</p>
          <p className="font-semibold text-xl tabular-nums">{totalMiles.toLocaleString("en-US", { maximumFractionDigits: 1 })}</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-xs opacity-50 mb-1">IRS Rate</p>
          <p className="font-semibold text-xl">{(IRS_RATE * 100).toFixed(1)}¢ / mi</p>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-xs opacity-50 mb-1">Est. Deduction</p>
          <p className="font-semibold text-xl text-green-600 dark:text-green-400 tabular-nums">{fmtMoney(totalDeduction)}</p>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {logs.length === 0 ? (
        <p className="opacity-50 text-sm">No trips logged for {year}. <Link href="/mileage/new" className="underline">Log your first trip.</Link></p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {logs.map((log, i) => (
            <div key={log.id} className={`p-4 flex items-center justify-between gap-4 ${i > 0 ? "border-t" : ""}`}>
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-sm opacity-40 tabular-nums shrink-0 w-12">{fmtDate(log.trip_date)}</span>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{log.purpose}</p>
                  {(log.from_location || log.to_location) && (
                    <p className="text-xs opacity-40 mt-0.5">
                      {[log.from_location, log.to_location].filter(Boolean).join(" → ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="font-medium text-sm tabular-nums">{Number(log.miles).toLocaleString("en-US", { maximumFractionDigits: 1 })} mi</p>
                  <p className="text-xs opacity-40 tabular-nums">{fmtMoney(Number(log.miles) * IRS_RATE)}</p>
                </div>
                <button onClick={() => remove(log.id)} className="text-sm opacity-30 hover:opacity-70 hover:text-red-500">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs opacity-30 mt-4">IRS standard mileage rate of {(IRS_RATE * 100).toFixed(1)}¢/mile for {year}. Consult a tax professional for your actual deduction.</p>
    </main>
  );
}
