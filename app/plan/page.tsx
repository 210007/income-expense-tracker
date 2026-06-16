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
  features: string[];
};

const MODULES: ModuleInfo[] = [
  {
    id: "invoicing",
    name: "Invoicing",
    description: "Create and send professional invoices, track payment status, and manage line items.",
    price: "$9 / mo",
    features: ["Unlimited invoices", "Line item builder", "Draft / Sent / Paid / Void workflow", "Per-customer invoice history"],
  },
  {
    id: "estimates",
    name: "Estimates & Quotes",
    description: "Send professional quotes to clients. Accept or decline, then convert to an invoice in one click.",
    price: "$6 / mo",
    features: ["Unlimited estimates", "Expiry dates", "Accept / Decline / Convert workflow", "Linked to invoices"],
  },
  {
    id: "time_tracking",
    name: "Time Tracking",
    description: "Log billable hours per client and generate invoices directly from your time entries.",
    price: "$9 / mo",
    features: ["Per-client hour logs", "Custom hourly rates", "One-click invoice from hours", "Uninvoiced hours dashboard"],
  },
  {
    id: "accounts_payable",
    name: "Accounts Payable",
    description: "Track bills you owe vendors, see what's overdue, and mark payments when made.",
    price: "$6 / mo",
    features: ["Bill tracking", "Due date aging", "Paid / Void workflow", "Category tagging"],
  },
  {
    id: "projects",
    name: "Projects",
    description: "Track job costs, budgets, and profitability per project or client engagement.",
    price: "$9 / mo",
    features: ["Budget vs. actual tracking", "Link transactions to projects", "Per-project P&L", "Active / Completed / Archived status"],
  },
  {
    id: "tax",
    name: "Tax Reporting",
    description: "Quarterly income and expense summaries, estimated tax owed, and 1099 vendor list.",
    price: "$6 / mo",
    features: ["Q1–Q4 breakdown", "Estimated quarterly tax", "Deduction summary by category", "1099 vendor candidates (>$600)"],
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Track products, stock levels, and cost of goods. Get alerts when stock runs low.",
    price: "$12 / mo",
    features: ["Product catalog", "Stock adjustments log", "Low stock alerts", "Cost price & unit price tracking"],
  },
  {
    id: "team",
    name: "Team Access",
    description: "Invite team members to your account with role-based permissions.",
    price: "$15 / mo",
    features: ["Unlimited team members", "Admin / Member / Viewer roles", "Invite by email", "Remove access anytime"],
  },
  {
    id: "recurring",
    name: "Recurring Transactions",
    description: "Auto-log income or expenses on a set schedule — weekly, monthly, or custom.",
    price: "$6 / mo",
    features: ["Flexible schedules", "Auto-categorization", "Skip or pause any series"],
  },
  {
    id: "scheduling",
    name: "Appointment Scheduling",
    description: "Internal calendar for client appointments with optional invoice generation on completion.",
    price: "$9 / mo",
    features: ["Calendar view", "Per-client appointment history", "One-click invoice from appointment"],
  },
  {
    id: "mileage",
    name: "Mileage Tracking",
    description: "Log business trips and automatically calculate your IRS standard mileage deduction.",
    price: "$6 / mo",
    features: ["Trip log with from/to locations", "70¢/mile IRS deduction calc", "Yearly summary", "Export-ready for tax time"],
  },
  {
    id: "budgeting",
    name: "Budgeting",
    description: "Set monthly spending limits per category and track actual vs budget with a progress dashboard.",
    price: "$6 / mo",
    features: ["Per-category monthly budgets", "Visual progress bars", "Over-budget alerts", "Unbudgeted spending summary"],
  },
  {
    id: "purchase_orders",
    name: "Purchase Orders",
    description: "Create and send purchase orders to vendors, track delivery status, and manage line items.",
    price: "$6 / mo",
    features: ["PO number auto-generation", "Email to vendor", "Draft / Sent / Received / Cancelled workflow", "Print & PDF export"],
  },
];

type ActiveMap = Partial<Record<ModuleName, { status: string; stripe_customer_id: string | null }>>;

function PlanPageInner() {
  const searchParams = useSearchParams();
  const successModule = searchParams.get("success");

  const [loading, setLoading] = useState(true);
  const [activeModules, setActiveModules] = useState<ActiveMap>({});
  const [working, setWorking] = useState<ModuleName | null>(null);
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
    for (const row of data ?? []) {
      map[row.module as ModuleName] = { status: row.status, stripe_customer_id: row.stripe_customer_id };
    }
    setActiveModules(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const subscribe = async (module: ModuleName) => {
    setError(null);
    setWorking(module);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ module }),
    });

    const json = await res.json();
    setWorking(null);

    if (!res.ok) { setError(json.error ?? "Something went wrong"); return; }
    window.location.href = json.url;
  };

  const openPortal = async () => {
    setPortalLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    });

    const json = await res.json();
    setPortalLoading(false);

    if (!res.ok) { setError(json.error ?? "Something went wrong"); return; }
    window.location.href = json.url;
  };

  const hasBilling = Object.values(activeModules).some((m) => m?.stripe_customer_id);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Plan</h1>
          <p className="text-sm opacity-50 mt-0.5">Add or remove modules anytime.</p>
        </div>
        {hasBilling && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70 disabled:opacity-40"
          >
            {portalLoading ? "Opening…" : "Manage Billing"}
          </button>
        )}
      </div>

      {successModule && (
        <div className="border border-green-500 text-green-600 dark:text-green-400 rounded-lg px-4 py-3 mb-6 text-sm">
          {MODULES.find((m) => m.id === successModule)?.name ?? successModule} activated successfully.
        </div>
      )}

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <p className="opacity-50">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => {
            const active = activeModules[mod.id];
            const isActive = active?.status === "active";
            const isPastDue = active?.status === "past_due";

            return (
              <div
                key={mod.id}
                className={`border rounded-xl p-5 flex flex-col gap-3 ${isActive ? "border-black dark:border-white" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-lg leading-tight">{mod.name}</h2>
                  {isActive && (
                    <span className="text-xs border border-black dark:border-white rounded-full px-2 py-0.5 whitespace-nowrap">
                      Active
                    </span>
                  )}
                  {isPastDue && (
                    <span className="text-xs border border-yellow-500 text-yellow-600 rounded-full px-2 py-0.5 whitespace-nowrap">
                      Past Due
                    </span>
                  )}
                </div>

                <p className="text-sm opacity-60 leading-relaxed">{mod.description}</p>

                <ul className="text-sm opacity-70 space-y-1">
                  {mod.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="opacity-40">—</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="font-medium">{mod.price}</span>
                  {!isActive && (
                    <button
                      onClick={() => subscribe(mod.id)}
                      disabled={working === mod.id}
                      className="bg-black text-white dark:bg-white dark:text-black text-sm rounded px-3 py-1.5 font-medium disabled:opacity-40 hover:opacity-80"
                    >
                      {working === mod.id ? "Redirecting…" : "Add Module"}
                    </button>
                  )}
                  {isActive && (
                    <button
                      onClick={openPortal}
                      disabled={portalLoading}
                      className="border text-sm rounded px-3 py-1.5 font-medium disabled:opacity-40 hover:opacity-70"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>}>
      <PlanPageInner />
    </Suspense>
  );
}
