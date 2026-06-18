import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const subscription = event.data.object as Stripe.Subscription;

  switch (event.type) {
    case "checkout.session.completed": {
      // One-time invoice payment
      if (session.metadata?.type === "invoice_payment") {
        const invoiceId = session.metadata?.invoice_id;
        if (invoiceId) {
          await supabase
            .from("invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", invoiceId);
        }
        break;
      }

      // Module subscription (single or cart)
      const userId = session.metadata?.user_id;
      if (!userId) break;

      const modulesStr = session.metadata?.modules;
      const singleModule = session.metadata?.module;
      const moduleList = modulesStr ? modulesStr.split(",") : singleModule ? [singleModule] : [];
      if (moduleList.length === 0) break;

      const sub = await stripe.subscriptions.retrieve(session.subscription as string);

      for (const module of moduleList) {
        await supabase.from("user_modules").upsert({
          user_id: userId,
          module,
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer as string,
          status: "active",
        }, { onConflict: "user_id,module" });
      }
      break;
    }

    case "customer.subscription.updated": {
      const status = subscription.status === "active" ? "active"
        : subscription.status === "past_due" ? "past_due"
        : "canceled";

      await supabase
        .from("user_modules")
        .update({ status })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      await supabase
        .from("user_modules")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
