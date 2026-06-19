"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ── Types ────────────────────────────────────────────────────────────────────

type TxnRow = {
  id: string;
  txn_date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string | null;
  description: string | null;
  category: string | null;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
};

type DashboardConfig = {
  kpis: string[];
  widgets: string[];
  quick_links: string[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: DashboardConfig = {
  kpis: ["revenue", "expenses", "net", "receipt_coverage"],
  widgets: ["quick_links", "recent_transactions", "spending_chart", "recent_customers"],
  quick_links: ["new_customer", "transactions", "customers", "products"],
};

const KPI_OPTIONS: Array<{ id: string; label: string; module?: string }> = [
  { id: "revenue", label: "Revenue" },
  { id: "expenses", label: "Expenses" },
  { id: "net", label: "Net Profit" },
  { id: "receipt_coverage", label: "Receipt Coverage" },
  { id: "outstanding_invoices", label: "Outstanding Invoices", module: "invoicing" },
];

const WIDGET_OPTIONS: Array<{ id: string; label: string; module?: string }> = [
  { id: "quick_links", label: "Quick Links" },
  { id: "recent_transactions", label: "Recent Transactions" },
  { id: "spending_chart", label: "Spending by Category" },
  { id: "recent_customers", label: "Recent Customers" },
  { id: "upcoming_appointments", label: "Upcoming Appointments", module: "scheduling" },
  { id: "budget_overview", label: "Budget Overview", module: "budgeting" },
];

const QUICK_LINK_OPTIONS: Array<{ id: string; label: string; href: string; module?: string }> = [
  { id: "new_invoice", label: "New Invoice", href: "/invoices/new", module: "invoicing" },
  { id: "new_customer", label: "New Customer", href: "/customers/new" },
  { id: "new_estimate", label: "New Estimate", href: "/estimates/new", module: "estimates" },
  { id: "schedule", label: "Schedule", href: "/appointments", module: "scheduling" },
  { id: "transactions", label: "Transactions", href: "/transactions" },
  { id: "customers", label: "Customers", href: "/customers" },
  { id: "products", label: "Products", href: "/products" },
  { id: "log_time", label: "Log Time", href: "/time", module: "time_tracking" },
  { id: "log_mileage", label: "Log Mileage", href: "/mileage", module: "mileage" },
  { id: "new_bill", label: "New Bill", href: "/bills/new", module: "accounts_payable" },
  { id: "tax_reports", label: "Tax Reports", href: "/tax", module: "tax" },
  { id: "new_po", label: "Purchase Order", href: "/purchase-orders/new", module: "purchase_orders" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function isoStart(year: number, month: number) {
  return new Date(year, month, 1).toISOString().slice(0, 10);
}

function isoEnd(year: number, month: number) {
  return new Date(year, month + 1, 1).toISOString().slice(0, 10);
}

function fmtMonth(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GearIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Data state
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [receiptCounts, setReceiptCounts] = useState<Record<string, number>>({});
  const [recentCustomers, setRecentCustomers] = useState<CustomerRow[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState(0);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [userName, setUserName] = useState<string | null>(null);

  // Config / customize state
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draftConfig, setDraftConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // ── Load user config + modules (once) ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const userId = sessionData.session.user.id;
      const email = sessionData.session.user.email ?? null;
      if (email && !cancelled) setUserName(email.split("@")[0]);

      const [{ data: mods }, { data: prefs }] = await Promise.all([
        supabase.from("user_modules").select("module").eq("user_id", userId).eq("status", "active"),
        supabase.from("user_preferences").select("dashboard_config").eq("user_id", userId).single(),
      ]);

      if (cancelled) return;

      setActiveModules(new Set((mods ?? []).map((m: { module: string }) => m.module)));

      if (prefs?.dashboard_config && Object.keys(prefs.dashboard_config).length > 0) {
        const merged: DashboardConfig = { ...DEFAULT_CONFIG, ...prefs.dashboard_config };
        setConfig(merged);
        setDraftConfig(merged);
      }

      setConfigLoaded(true);
    }

    loadConfig();
    return () => { cancelled = true; };
  }, []);

  // ── Load month data ─────────────────────────────────────────────────────────
  const loadMonthData = useCallback(async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;

    const [{ data: txnData }, { data: custData }, { count }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, txn_date, type, amount, vendor, description, category")
        .gte("txn_date", isoStart(year, month))
        .lt("txn_date", isoEnd(year, month))
        .order("txn_date", { ascending: false }),
      supabase
        .from("customers")
        .select("id, name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "sent"),
    ]);

    const rows = (txnData ?? []) as TxnRow[];
    setTxns(rows);
    setRecentCustomers((custData ?? []) as CustomerRow[]);
    setOutstandingInvoices(count ?? 0);

    if (rows.length > 0) {
      const { data: recData } = await supabase
        .from("receipts")
        .select("transaction_id")
        .in("transaction_id", rows.map((r) => r.id));
      const counts: Record<string, number> = {};
      for (const r of (recData ?? []) as { transaction_id: string }[]) {
        counts[r.transaction_id] = (counts[r.transaction_id] ?? 0) + 1;
      }
      setReceiptCounts(counts);
    } else {
      setReceiptCounts({});
    }

    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadMonthData(); }, [loadMonthData]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    let income = 0, expenses = 0;
    for (const t of txns) {
      if (t.type === "income") income += Number(t.amount);
      if (t.type === "expense") expenses += Number(t.amount);
    }
    const net = income - expenses;
    const expenseTxns = txns.filter((t) => t.type === "expense");
    const withReceipt = expenseTxns.filter((t) => (receiptCounts[t.id] ?? 0) > 0);
    const missingCount = expenseTxns.length - withReceipt.length;
    const coverage =
      expenseTxns.length === 0 ? 0 : Math.round((withReceipt.length / expenseTxns.length) * 100);
    return { income, expenses, net, coverage, missingCount, txnCount: txns.length };
  }, [txns, receiptCounts]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of txns) {
      if (t.type !== "expense") continue;
      const cat = t.category || "Uncategorized";
      totals.set(cat, (totals.get(cat) ?? 0) + Number(t.amount));
    }
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [txns]);

  const maxCat = useMemo(() => Math.max(...categoryTotals.map((c) => c.total), 1), [categoryTotals]);

  const visibleQuickLinks = useMemo(
    () =>
      QUICK_LINK_OPTIONS.filter(
        (l) => config.quick_links.includes(l.id) && (!l.module || activeModules.has(l.module))
      ),
    [config.quick_links, activeModules]
  );

  // ── Actions ─────────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const syncPlaid = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) { setSyncing(false); return; }
    const res = await fetch("/api/plaid/import-transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    setSyncing(false);
    const n = json.upserted ?? json.inserted ?? 0;
    setSyncMsg(`${n} transaction${n !== 1 ? "s" : ""} updated`);
    await loadMonthData();
  };

  const toggleItem = (key: keyof DashboardConfig, id: string) => {
    setDraftConfig((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
      };
    });
  };

  const saveConfig = async (newConfig: DashboardConfig) => {
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await supabase.from("user_preferences").upsert(
        { user_id: sessionData.session.user.id, dashboard_config: newConfig, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }
    setConfig(newConfig);
    setSaving(false);
    setCustomizing(false);
  };

  const kpiDisplay = (id: string) => {
    switch (id) {
      case "revenue": return { label: "Revenue", value: money(metrics.income), color: "text-green-600 dark:text-green-400" };
      case "expenses": return { label: "Expenses", value: money(metrics.expenses), color: "text-red-500 dark:text-red-400" };
      case "net": return { label: "Net Profit", value: money(metrics.net), color: metrics.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400" };
      case "receipt_coverage": return { label: "Receipt Coverage", value: `${metrics.coverage}%`, color: "text-gray-900 dark:text-white" };
      case "outstanding_invoices": return { label: "Awaiting Payment", value: `${outstandingInvoices} invoice${outstandingInvoices !== 1 ? "s" : ""}`, color: "text-gray-900 dark:text-white" };
      default: return null;
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (!configLoaded) {
    return (
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />)}
          </div>
        </div>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}{userName ? `, ${userName}` : ""}!
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
            <span>{fmtMonth(year, month)}</span>
            <span className="opacity-30">·</span>
            <span>{metrics.txnCount} transaction{metrics.txnCount !== 1 ? "s" : ""}</span>
            {syncMsg && (
              <>
                <span className="opacity-30">·</span>
                <span className="text-green-600 dark:text-green-400">{syncMsg}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium">
              ‹
            </button>
            <span className="px-2 text-xs font-medium text-gray-500 dark:text-gray-400 select-none whitespace-nowrap">
              {new Date(year, month, 1).toLocaleString(undefined, { month: "short" })} {year}
            </span>
            <button onClick={nextMonth} disabled={isCurrentMonth} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-30">
              ›
            </button>
          </div>

          <button
            onClick={syncPlaid}
            disabled={syncing}
            className="h-8 px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync Bank"}
          </button>

          <button
            onClick={() => { setDraftConfig(config); setCustomizing((v) => !v); }}
            className={`h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
              customizing
                ? "brand-gradient text-white"
                : "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <GearIcon />
            {customizing ? "Cancel" : "Customize"}
          </button>
        </div>
      </div>

      {/* Customize panel */}
      {customizing && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5 bg-gray-50 dark:bg-gray-900 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">KPI Cards</p>
            <div className="flex flex-wrap gap-2">
              {KPI_OPTIONS.filter((k) => !k.module || activeModules.has(k.module)).map((k) => (
                <button
                  key={k.id}
                  onClick={() => toggleItem("kpis", k.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    draftConfig.kpis.includes(k.id)
                      ? "brand-gradient text-white border-transparent"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Widgets</p>
            <div className="flex flex-wrap gap-2">
              {WIDGET_OPTIONS.filter((w) => !w.module || activeModules.has(w.module)).map((w) => (
                <button
                  key={w.id}
                  onClick={() => toggleItem("widgets", w.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    draftConfig.widgets.includes(w.id)
                      ? "brand-gradient text-white border-transparent"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {draftConfig.widgets.includes("quick_links") && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Quick Links</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_LINK_OPTIONS.filter((l) => !l.module || activeModules.has(l.module)).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => toggleItem("quick_links", l.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      draftConfig.quick_links.includes(l.id)
                        ? "brand-gradient text-white border-transparent"
                        : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => saveConfig(draftConfig)}
              disabled={saving}
              className="h-9 px-5 rounded-xl brand-gradient text-white text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* KPI cards */}
      {config.kpis.length > 0 && (
        <div
          className={`grid gap-3 ${
            config.kpis.length === 1
              ? "grid-cols-1"
              : config.kpis.length === 2
              ? "grid-cols-2"
              : config.kpis.length === 3
              ? "grid-cols-3"
              : "grid-cols-2 sm:grid-cols-4"
          }`}
        >
          {config.kpis.map((id) => {
            const kpi = kpiDisplay(id);
            if (!kpi) return null;
            return (
              <div key={id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 font-medium">
                  {kpi.label}
                </p>
                {loading ? (
                  <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse w-24" />
                ) : (
                  <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                )}
                {id === "receipt_coverage" && !loading && metrics.missingCount > 0 && (
                  <Link href="/transactions?missing=1" className="text-xs text-orange-500 mt-1 block hover:text-orange-600">
                    {metrics.missingCount} missing receipt{metrics.missingCount !== 1 ? "s" : ""} →
                  </Link>
                )}
                {id === "outstanding_invoices" && !loading && outstandingInvoices > 0 && (
                  <Link href="/invoices?status=sent" className="text-xs text-blue-500 mt-1 block hover:text-blue-600">
                    View invoices →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Widget grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Quick Links */}
        {config.widgets.includes("quick_links") && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 text-gray-900 dark:text-white">Quick Links</h2>
            {visibleQuickLinks.length === 0 ? (
              <p className="text-sm text-gray-400">
                No quick links selected.{" "}
                <button onClick={() => { setDraftConfig(config); setCustomizing(true); }} className="text-blue-500 hover:text-blue-600">
                  Customize →
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visibleQuickLinks.map((l) => (
                  <Link
                    key={l.id}
                    href={l.href}
                    className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:border-transparent hover:shadow-sm transition-all"
                    style={{ backgroundImage: "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md brand-gradient shrink-0" />
                      <span className="truncate font-medium">{l.label}</span>
                    </div>
                    <ArrowIcon />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Transactions */}
        {config.widgets.includes("recent_transactions") && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
              <Link href="/transactions" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : txns.length === 0 ? (
              <p className="text-sm text-gray-400">No transactions this month.</p>
            ) : (
              <div className="space-y-0.5">
                {txns.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    href={`/transactions/${t.id}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">
                        {t.vendor || t.description || "(No details)"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.txn_date} · {t.category || "Uncategorized"}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold shrink-0 ${
                        t.type === "expense"
                          ? "text-red-500 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {t.type === "expense" ? "-" : "+"}
                      {money(Number(t.amount))}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spending by Category */}
        {config.widgets.includes("spending_chart") && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 text-gray-900 dark:text-white">Spending by Category</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />)}
              </div>
            ) : categoryTotals.length === 0 ? (
              <p className="text-sm text-gray-400">No expense data this month.</p>
            ) : (
              <div className="space-y-3">
                {categoryTotals.slice(0, 7).map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">{c.category}</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{money(c.total)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full brand-gradient rounded-full transition-all"
                        style={{ width: `${(c.total / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Customers */}
        {config.widgets.includes("recent_customers") && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Recent Customers</h2>
              <Link href="/customers" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentCustomers.length === 0 ? (
              <p className="text-sm text-gray-400">
                No customers yet.{" "}
                <Link href="/customers/new" className="text-blue-500 hover:text-blue-600">
                  Add one →
                </Link>
              </p>
            ) : (
              <div className="space-y-0.5">
                {recentCustomers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.name}</p>
                      {c.email && (
                        <p className="text-xs text-gray-400 truncate">{c.email}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming Appointments placeholder */}
        {config.widgets.includes("upcoming_appointments") && activeModules.has("scheduling") && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Upcoming Appointments</h2>
              <Link href="/appointments" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">View calendar →</Link>
            </div>
            <p className="text-sm text-gray-400">No upcoming appointments.</p>
          </div>
        )}

        {/* Budget Overview placeholder */}
        {config.widgets.includes("budget_overview") && activeModules.has("budgeting") && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Budget Overview</h2>
              <Link href="/budget" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">View budget →</Link>
            </div>
            <p className="text-sm text-gray-400">Set up your budget to track spending.</p>
          </div>
        )}
      </div>
    </main>
  );
}
