import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = supabaseServer();

  const { data: invoice, error } = await db
    .from("invoices")
    .select(`
      id, invoice_number, status,
      customers ( name, email ),
      invoice_items ( description, quantity, unit_price )
    `)
    .eq("public_token", token)
    .single();

  if (error || !invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const inv = invoice as typeof invoice & {
    invoice_items: { description: string; quantity: number; unit_price: number }[];
  };

  if (inv.status === "paid") return NextResponse.json({ error: "This invoice has already been paid." }, { status: 400 });
  if (inv.status === "void") return NextResponse.json({ error: "This invoice has been voided." }, { status: 400 });

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://solobooks.app";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: inv.invoice_items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: { name: item.description },
        unit_amount: Math.round(item.unit_price * item.quantity * 100),
      },
      quantity: 1,
    })),
    success_url: `${origin}/pay/${token}?success=1`,
    cancel_url: `${origin}/pay/${token}`,
    metadata: {
      invoice_id: inv.id,
      type: "invoice_payment",
    },
  });

  return NextResponse.json({ url: session.url });
}
