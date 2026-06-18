import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MODULE_PRICES: Record<string, string> = {
  invoicing: process.env.STRIPE_INVOICING_PRICE_ID!,
  estimates: process.env.STRIPE_ESTIMATES_PRICE_ID!,
  time_tracking: process.env.STRIPE_TIME_TRACKING_PRICE_ID!,
  accounts_payable: process.env.STRIPE_ACCOUNTS_PAYABLE_PRICE_ID!,
  recurring: process.env.STRIPE_RECURRING_PRICE_ID!,
  scheduling: process.env.STRIPE_SCHEDULING_PRICE_ID!,
  projects: process.env.STRIPE_PROJECTS_PRICE_ID!,
  tax: process.env.STRIPE_TAX_PRICE_ID!,
  inventory: process.env.STRIPE_INVENTORY_PRICE_ID!,
  team: process.env.STRIPE_TEAM_PRICE_ID!,
  mileage: process.env.STRIPE_MILEAGE_PRICE_ID!,
  budgeting: process.env.STRIPE_BUDGETING_PRICE_ID!,
  purchase_orders: process.env.STRIPE_PURCHASE_ORDERS_PRICE_ID!,
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Support both single module and cart (array of modules)
  const modules: string[] = body.modules
    ? body.modules
    : body.module
    ? [body.module]
    : [];

  if (modules.length === 0) return NextResponse.json({ error: "No modules selected" }, { status: 400 });

  // Validate all price IDs exist
  for (const mod of modules) {
    if (!MODULE_PRICES[mod]) return NextResponse.json({ error: `Unknown module: ${mod}` }, { status: 400 });
  }

  // Filter out already-active modules
  const { data: existing } = await supabase
    .from("user_modules")
    .select("module, status")
    .eq("user_id", user.id)
    .in("module", modules);

  const activeModules = new Set((existing ?? []).filter((r) => r.status === "active").map((r) => r.module));
  const toSubscribe = modules.filter((m) => !activeModules.has(m));

  if (toSubscribe.length === 0) {
    return NextResponse.json({ error: "All selected modules are already active" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: toSubscribe.map((mod) => ({ price: MODULE_PRICES[mod], quantity: 1 })),
    success_url: `${origin}/plan?success=${toSubscribe[0]}`,
    cancel_url: `${origin}/plan`,
    metadata: {
      user_id: user.id,
      // Store all module names for webhook processing
      modules: toSubscribe.join(","),
      // Keep singular for backward compat
      module: toSubscribe[0],
    },
    customer_email: user.email,
  });

  return NextResponse.json({ url: session.url });
}
