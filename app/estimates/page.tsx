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

const STATUS_STYLES: Record<string, string> = {
  draft: "opacity-50",
  sent: "text-blue-600 dark:text-blue-400",
  accepted: "text-green-600 dark:text-green-400",
  declined: "text-red-500 opacity-60",
  converted: "opacity-40",
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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Estimates & Quotes</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Estimates — $6 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Estimates</h1>
          <p className="text-sm opacity-50 mt-0.5">{estimates.length} estimate{estimates.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/estimates/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">
          New Estimate
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {estimates.length === 0 ? (
        <p className="opacity-50 text-sm">No estimates yet. Create your first one above.</p>
      ) : (
        <div className="grid gap-2">
          {estimates.map((e) => (
            <Link key={e.id} href={`/estimates/${e.id}`} className="block border rounded-lg p-4 hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium font-mono text-sm">{e.estimate_number}</span>
                  <span className={`text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}>{e.status}</span>
                  {e.invoice_id && <span className="text-xs opacity-40">→ Invoice</span>}
                </div>
                <span className="font-medium tabular-nums">{fmtMoney(e.total)}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm opacity-60">
                <span>{e.customers?.name ?? "No customer"}</span>
                <span>·</span>
                <span>{fmt(e.issue_date)}</span>
                {e.expiry_date && <><span>·</span><span>Expires {fmt(e.expiry_date)}</span></>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
