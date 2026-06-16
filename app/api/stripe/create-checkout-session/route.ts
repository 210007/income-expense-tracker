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
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { module } = await req.json();
  const priceId = MODULE_PRICES[module];
  if (!priceId) return NextResponse.json({ error: "Unknown module" }, { status: 400 });

  const { data: existing } = await supabase
    .from("user_modules")
    .select("status")
    .eq("user_id", user.id)
    .eq("module", module)
    .single();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "Module already active" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/plan?success=${module}`,
    cancel_url: `${origin}/plan`,
    metadata: { user_id: user.id, module },
    customer_email: user.email,
  });

  return NextResponse.json({ url: session.url });
}
