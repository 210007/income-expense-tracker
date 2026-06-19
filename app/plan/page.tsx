"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { ModuleName } from "@/lib/modules";

type ModuleInfo = {
  id: ModuleName;
  name: string;
  description: string;
  price: string;
  priceMonthly: number;
  features: string[];
};

const MODULES: ModuleInfo[] = [
  { id: "invoicing", name: "Invoicing", price: "$9 / mo", priceMonthly: 9, description: "Create and send professional invoices, track payment status, and manage line items.", features: ["Unlimited invoices", "Line item builder", "Draft / Sent / Paid / Void workflow", "Per-customer invoice history"] },
  { id: "estimates", name: "Estimates & Quotes", price: "$6 / mo", priceMonthly: 6, description: "Send professional quotes to clients. Accept or decline, then convert to an invoice in one click.", features: ["Unlimited estimates", "Expiry dates", "Accept / Decline / Convert workflow", "Linked to invoices"] },
  { id: "time_tracking", name: "Time Tracking", price: "$9 / mo", priceMonthly: 9, description: "Log billable hours per client and generate invoices directly from your time entries.", features: ["Per-client hour logs", "Custom hourly rates", "One-click invoice from hours", "Uninvoiced hours dashboard"] },
  { id: "accounts_payable", name: "Accounts Payable", price: "$6 / mo", priceMonthly: 6, description: "Track bills you owe vendors, see what's overdue, and mark payments when made.", features: ["Bill tracking", "Due date aging", "Paid / Void workflow", "Category tagging"] },
  { id: "projects", name: "Projects", price: "$9 / mo", priceMonthly: 9, description: "Track job costs, budgets, and profitability per project or client engagement.", features: ["Budget vs. actual tracking", "Link transactions to projects", "Per-project P&L", "Active / Completed / Archived status"] },
  { id: "tax", name: "Tax Reporting", price: "$6 / mo", priceMonthly: 6, description: "Quarterly income and expense summaries, estimated tax owed, and 1099 vendor list.", features: ["Q1–Q4 breakdown", "Estimated quarterly tax", "Deduction summary by category", "1099 vendor candidates (>$600)"] },
  { id: "inventory", name: "Inventory", price: "$12 / mo", priceMonthly: 12, description: "Track products, stock levels, and cost of goods. Get alerts when stock runs low.", features: ["Product catalog", "Stock adjustments log", "Low stock alerts", "Cost price & unit price tracking"] },
  { id: "team", name: "Team Access", price: "$15 / mo", priceMonthly: 15, description: "Invite team members to your account with role-based permissions.", features: ["Unlimited team members", "Admin / Member / Viewer roles", "Invite by email", "Remove access anytime"] },
  { id: "recurring", name: "Recurring Transactions", price: "$6 / mo", priceMonthly: 6, description: "Auto-log income or expenses on a set schedule — weekly, monthly, or custom.", features: ["Flexible schedules", "Auto-categorization", "Skip or pause any series"] },
  { id: "scheduling", name: "Appointment Scheduling", price: "$9 / mo", priceMonthly: 9, description: "Internal calendar for client appointments with optional invoice generation on completion.", features: ["Calendar view", "Per-client appointment history", "One-click invoice from appointment"] },
  { id: "mileage", name: "Mileage Tracking", price: "$6 / mo", priceMonthly: 6, description: "Log business trips and automatically calculate your IRS standard mileage deduction.", features: ["Trip log with from/to locations", "70¢/mile IRS deduction calc", "Yearly summary", "Export-ready for tax time"] },
  { id: "budgeting", name: "Budgeting", price: "$6 / mo", priceMonthly: 6, description: "Set monthly spending limits per category and track actual vs budget with a progress dashboard.", features: ["Per-category monthly budgets", "Visual progress bars", "Over-budget alerts", "Unbudgeted spending summary"] },
  { id: "purchase_orders", name: "Purchase Orders", price: "$6 / mo", priceMonthly: 6, description: "Create and send purchase orders to vendors, track delivery status, and manage line items.", features: ["PO number auto-generation", "Email to vendor", "Draft / Sent / Received / Cancelled workflow", "Print & PDF export"] },
];

type ActiveMap = Partial<Record<ModuleName, { status: string; stripe_customer_id: string | null }>>;

function PlanPageInner() {
  const searchParams = useSearchParams();
  const successModule = searchParams.get("success");

  const [loading, setLoading] = useState(true);
  const [activeModules, setActiveModules] = useState<ActiveMap>({});
  const [cart, setCart] = useState<Set<ModuleName>>(new Set());
  const [working, setWorking] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }
    const { data } = await supabase
      .from("user_modules")
      .select("module, status, stripe_customer_id")
      .eq("user_id", sessionData.session.user.id);
    const map: ActiveMap = {};
    for (const row of data ?? []) map[row.module as ModuleName] = { status: row.status, stripe_customer_id: row.stripe_customer_id };
    setActiveModules(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const inactiveModules = MODULES.filter((m) => activeModules[m.id]?.status !== "active");

  const toggleCart = (id: ModuleName) => {
    setCart((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setCart(new Set(inactiveModules.map((m) => m.id)));
  const clearCart = () => setCart(new Set());

  const cartTotal = Array.from(cart).reduce((sum, id) => {
    const mod = MODULES.find((m) => m.id === id);
    return sum + (mod?.priceMonthly ?? 0);
  }, 0);

  const checkout = async (modules: ModuleName[]) => {
    setError(null);
    setWorking(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ modules }),
    });

    const json = await res.json();
    setWorking(false);
    if (!res.ok) { setError(json.error ?? "Something went wrong"); return; }
    window.location.href = json.url;
  };

  const openPortal = async () => {
    setPortalLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }
    const res = await fetch("/api/stripe/portal", { method: "POST", headers: { Authorization: `Bearer ${sessionData.session.access_token}` } });
    const json = await res.json();
    setPortalLoading(false);
    if (!res.ok) { setError(json.error ?? "Something went wrong"); return; }
    window.location.href = json.url;
  };

  const hasBilling = Object.values(activeModules).some((m) => m?.stripe_customer_id);

  return (
    <main className="p-6 max-w-4xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Plan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Add or remove modules anytime.</p>
        </div>
        <div className="flex gap-2">
          {inactiveModules.length > 0 && !loading && (
            <button
              onClick={cart.size === inactiveModules.length ? clearCart : selectAll}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {cart.size === inactiveModules.length ? "Deselect All" : "Select All"}
            </button>
          )}
          {hasBilling && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              {portalLoading ? "Opening…" : "Manage Billing"}
            </button>
          )}
        </div>
      </div>

      {successModule && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-2xl px-4 py-3 mb-6 text-sm font-medium">
          {MODULES.find((m) => m.id === successModule)?.name ?? successModule} activated successfully.
        </div>
      )}

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-52" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => {
            const active = activeModules[mod.id];
            const isActive = active?.status === "active";
            const isPastDue = active?.status === "past_due";
            const inCart = cart.has(mod.id);

            return (
              <div
                key={mod.id}
                className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 flex flex-col gap-3 transition-all ${
                  isActive
                    ? "border-gray-900 dark:border-white"
                    : inCart
                    ? "border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-lg leading-tight">{mod.name}</h2>
                  {isActive && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 whitespace-nowrap shrink-0">
                      Active
                    </span>
                  )}
                  {isPastDue && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-400 whitespace-nowrap shrink-0">
                      Past Due
                    </span>
                  )}
                  {inCart && !isActive && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 whitespace-nowrap shrink-0">
                      In Cart
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{mod.description}</p>

                <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  {mod.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-gray-300 dark:text-gray-600">—</span>{f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">{mod.price}</span>
                  {isActive ? (
                    <button
                      onClick={openPortal}
                      disabled={portalLoading}
                      className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                      Manage
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleCart(mod.id)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        inCart
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      {inCart ? "Remove" : "Add to Cart"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart footer */}
      {cart.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {cart.size} module{cart.size !== 1 ? "s" : ""} selected
                <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">· ${cartTotal}/mo total</span>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {Array.from(cart).map((id) => MODULES.find((m) => m.id === id)?.name).filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={clearCart}
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => checkout(Array.from(cart))}
                disabled={working}
                className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {working ? "Redirecting…" : `Subscribe · $${cartTotal}/mo`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-32 mb-6" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-52" />
          ))}
        </div>
      </main>
    }>
      <PlanPageInner />
    </Suspense>
  );
}
