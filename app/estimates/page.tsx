"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Estimate = {
  id: string;
  estimate_number: string;
  status: "draft" | "sent" | "accepted" | "declined" | "converted";
  issue_date: string;
  expiry_date: string | null;
  invoice_id: string | null;
  customers: { name: string } | null;
  total: number;
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  sent: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  accepted: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  declined: "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400",
  converted: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
};

export default function EstimatesPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("estimates");
      if (!active) { setGated(true); setLoading(false); return; }

      const { data, error } = await supabase
        .from("estimates")
        .select(`
          id, estimate_number, status, issue_date, expiry_date, invoice_id,
          customers ( name ),
          estimate_items ( quantity, unit_price )
        `)
        .eq("user_id", sessionData.session.user.id)
        .order("issue_date", { ascending: false });

      if (error) { setError(error.message); setLoading(false); return; }

      setEstimates(
        (data ?? []).map((e: any) => ({
          id: e.id,
          estimate_number: e.estimate_number,
          status: e.status,
          issue_date: e.issue_date,
          expiry_date: e.expiry_date,
          invoice_id: e.invoice_id,
          customers: e.customers,
          total: (e.estimate_items ?? []).reduce(
            (sum: number, i: any) => sum + i.quantity * i.unit_price, 0
          ),
        }))
      );
      setLoading(false);
    })();
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-20" />
        ))}
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Estimates &amp; Quotes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          Add Estimates — $6 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estimates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {estimates.length} estimate{estimates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/estimates/new"
          className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          New Estimate
        </Link>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {estimates.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">No estimates yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {estimates.map((e) => (
            <Link
              key={e.id}
              href={`/estimates/${e.id}`}
              className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="font-semibold font-mono text-sm text-gray-900 dark:text-white">
                    {e.estimate_number}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[e.status]}`}>
                    {e.status}
                  </span>
                  {e.invoice_id && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">→ Invoice</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{e.customers?.name ?? "No customer"}</span>
                  <span>·</span>
                  <span>{fmt(e.issue_date)}</span>
                  {e.expiry_date && (
                    <>
                      <span>·</span>
                      <span>Expires {fmt(e.expiry_date)}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-white shrink-0">
                {fmtMoney(e.total)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
