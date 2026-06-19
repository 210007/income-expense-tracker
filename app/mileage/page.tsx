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

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-2xl w-40 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-2xl w-28" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-20" />
          ))}
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Mileage Tracking</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          Add Mileage Tracking — $6 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mileage</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{year} business trips</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden text-sm">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              ←
            </button>
            <span className="px-3 font-semibold tabular-nums text-gray-900 dark:text-white">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= currentYear}
              className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30"
            >
              →
            </button>
          </div>
          <Link href="/mileage/new" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            Log Trip
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Miles</p>
          <p className="font-bold text-2xl text-gray-900 dark:text-white tabular-nums">
            {totalMiles.toLocaleString("en-US", { maximumFractionDigits: 1 })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">IRS Rate</p>
          <p className="font-bold text-2xl text-gray-900 dark:text-white">{(IRS_RATE * 100).toFixed(1)}¢ / mi</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Est. Deduction</p>
          <p className="font-bold text-2xl text-green-600 dark:text-green-400 tabular-nums">{fmtMoney(totalDeduction)}</p>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {logs.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">No trips logged for {year}.</p>
          <Link href="/mileage/new" className="inline-block mt-3 px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            Log Your First Trip
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl"
            >
              <span className="text-sm text-gray-400 dark:text-gray-500 tabular-nums shrink-0 w-12">
                {fmtDate(log.trip_date)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{log.purpose}</p>
                {(log.from_location || log.to_location) && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {[log.from_location, log.to_location].filter(Boolean).join(" → ")}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm text-gray-900 dark:text-white tabular-nums">
                  {Number(log.miles).toLocaleString("en-US", { maximumFractionDigits: 1 })} mi
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                  {fmtMoney(Number(log.miles) * IRS_RATE)}
                </p>
              </div>
              <button
                onClick={() => remove(log.id)}
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-600 mt-6">
        IRS standard mileage rate of {(IRS_RATE * 100).toFixed(1)}¢/mile for {year}. Consult a tax professional for your actual deduction.
      </p>
    </main>
  );
}
