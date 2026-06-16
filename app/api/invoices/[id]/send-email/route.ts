import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: invoice, error } = await db
    .from("invoices")
    .select(`
      id, invoice_number, status, issue_date, due_date, notes, public_token,
      customers ( name, email ),
      invoice_items ( description, quantity, unit_price )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const inv = invoice as typeof invoice & {
    customers: { name: string; email: string | null } | null;
    invoice_items: { description: string; quantity: number; unit_price: number }[];
    public_token: string;
  };

  const customerEmail = inv.customers?.email;
  if (!customerEmail) return NextResponse.json({ error: "Customer has no email address." }, { status: 400 });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const total = inv.invoice_items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0);

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://solobooks.app";
  const paymentUrl = `${origin}/pay/${inv.public_token}`;

  const lineItemsHtml = inv.invoice_items.map((item: { description: string; quantity: number; unit_price: number }) => `
    <tr>
      <td style="padding: 10px 8px; border-bottom: 1px solid #f0f0f0;">${item.description}</td>
      <td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">${item.quantity}</td>
      <td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #f0f0f0; color: #666;">${fmtMoney(item.unit_price)}</td>
      <td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #f0f0f0; font-weight: 500;">${fmtMoney(item.quantity * item.unit_price)}</td>
    </tr>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <div style="padding:32px 40px;border-bottom:1px solid #f0f0f0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Invoice</h1>
          <p style="margin:0;font-family:monospace;color:#666;font-size:14px;">${inv.invoice_number}</p>
        </div>
      </div>
    </div>

    <div style="padding:24px 40px;border-bottom:1px solid #f0f0f0;display:flex;gap:40px;">
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Bill To</p>
        <p style="margin:0;font-weight:600;">${inv.customers?.name ?? ""}</p>
      </div>
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Issue Date</p>
        <p style="margin:0;">${fmt(inv.issue_date)}</p>
      </div>
      ${inv.due_date ? `
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Due Date</p>
        <p style="margin:0;font-weight:600;">${fmt(inv.due_date)}</p>
      </div>` : ""}
    </div>

    <div style="padding:24px 40px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:2px solid #111;">
            <th style="text-align:left;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;font-weight:600;">Description</th>
            <th style="text-align:right;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;font-weight:600;width:60px;">Qty</th>
            <th style="text-align:right;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;font-weight:600;width:100px;">Price</th>
            <th style="text-align:right;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;font-weight:600;width:100px;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #111;">
            <td colspan="3" style="padding:16px 8px;text-align:right;font-weight:700;font-size:15px;">Total Due</td>
            <td style="padding:16px 8px;text-align:right;font-weight:700;font-size:20px;">${fmtMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${inv.notes ? `
    <div style="padding:0 40px 24px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Notes</p>
      <p style="margin:0;font-size:14px;color:#444;white-space:pre-wrap;">${inv.notes}</p>
    </div>` : ""}

    <div style="padding:24px 40px;background:#f9f9f9;text-align:center;">
      <a href="${paymentUrl}" style="display:inline-block;background:#000;color:#fff;padding:14px 32px;border-radius:6px;font-weight:600;font-size:15px;text-decoration:none;">
        Pay ${fmtMoney(total)} Online
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#999;">Or visit: ${paymentUrl}</p>
    </div>

    <div style="padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">Sent via SoloBooks</p>
    </div>
  </div>
</body>
</html>`;

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "invoices@solobooks.app";
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { error: sendError } = await resend.emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: `Invoice ${inv.invoice_number} — ${fmtMoney(total)} due`,
    html,
  });

  if (sendError) return NextResponse.json({ error: (sendError as { message?: string }).message ?? "Failed to send email." }, { status: 500 });

  // Mark as sent if still draft
  if (inv.status === "draft") {
    await db.from("invoices").update({ status: "sent" }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
