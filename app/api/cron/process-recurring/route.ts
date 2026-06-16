import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function nextRunDate(current: string, frequency: string): string {
  const d = new Date(current);
  switch (frequency) {
    case "daily":     d.setDate(d.getDate() + 1); break;
    case "weekly":    d.setDate(d.getDate() + 7); break;
    case "biweekly":  d.setDate(d.getDate() + 14); break;
    case "monthly":   d.setMonth(d.getMonth() + 1); break;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Recurring transactions ──────────────────────────────────────────────
  const { data: due } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("active", true)
    .lte("next_run_date", today);

  let txProcessed = 0;

  for (const r of due ?? []) {
    if (r.end_date && r.next_run_date > r.end_date) {
      await supabase.from("recurring_transactions").update({ active: false }).eq("id", r.id);
      continue;
    }

    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: r.user_id,
      txn_date: r.next_run_date,
      type: r.type,
      amount: r.amount,
      vendor: r.vendor,
      description: r.description,
      category: r.category,
      source: "recurring",
    });

    if (txErr) continue;

    const next = nextRunDate(r.next_run_date, r.frequency);
    const shouldDeactivate = r.end_date && next > r.end_date;
    await supabase.from("recurring_transactions").update({
      next_run_date: next,
      active: shouldDeactivate ? false : r.active,
    }).eq("id", r.id);

    txProcessed++;
  }

  // ── 2. Recurring invoices ──────────────────────────────────────────────────
  const { data: dueInvoices } = await supabase
    .from("recurring_invoices")
    .select("*, recurring_invoice_items(description, quantity, unit_price), customers(name, email)")
    .eq("active", true)
    .lte("next_run_date", today);

  let invProcessed = 0;

  for (const ri of dueInvoices ?? []) {
    if (ri.end_date && ri.next_run_date > ri.end_date) {
      await supabase.from("recurring_invoices").update({ active: false }).eq("id", ri.id);
      continue;
    }

    // Auto-generate invoice number
    const { data: lastInv } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", ri.user_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastNum = (lastInv?.[0]?.invoice_number ?? "INV-000").replace(/\D/g, "");
    const invoiceNumber = `INV-${String(parseInt(lastNum || "0") + 1).padStart(3, "0")}`;

    const issueDate = ri.next_run_date;
    const dueDate = (() => {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })();

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: ri.user_id,
        customer_id: ri.customer_id,
        invoice_number: invoiceNumber,
        status: ri.auto_send ? "sent" : "draft",
        issue_date: issueDate,
        due_date: dueDate,
        notes: ri.notes ?? null,
      })
      .select("id, public_token")
      .single();

    if (invErr || !inv) continue;

    const items = (ri.recurring_invoice_items ?? []) as { description: string; quantity: number; unit_price: number }[];
    if (items.length > 0) {
      await supabase.from("invoice_items").insert(
        items.map((it) => ({
          invoice_id: inv.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
        }))
      );
    }

    // Auto-send email if enabled and customer has email
    const customer = ri.customers as { name: string; email: string | null } | null;
    if (ri.auto_send && customer?.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fmtMoney = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
      const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://solobooks.app";

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "invoices@solobooks.app",
        to: customer.email,
        subject: `Invoice ${invoiceNumber} — ${fmtMoney(total)}`,
        html: `<p>Hi ${customer.name},</p><p>Please find your invoice ${invoiceNumber} for ${fmtMoney(total)} attached below.</p><p><a href="${appUrl}/pay/${inv.public_token}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Pay ${fmtMoney(total)} Online</a></p><p style="color:#aaa;font-size:12px;">Sent via SoloBooks</p>`,
      });
    }

    // Advance next_run_date
    const next = nextRunDate(ri.next_run_date, ri.frequency);
    const shouldDeactivate = ri.end_date && next > ri.end_date;
    await supabase.from("recurring_invoices").update({
      next_run_date: next,
      active: shouldDeactivate ? false : true,
    }).eq("id", ri.id);

    invProcessed++;
  }

  return NextResponse.json({ txProcessed, invProcessed });
}
