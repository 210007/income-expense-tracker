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

  const { data: estimate, error } = await db
    .from("estimates")
    .select(`
      id, estimate_number, status, issue_date, expiry_date, notes,
      customers ( name, email ),
      estimate_items ( description, quantity, unit_price )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !estimate) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });

  const est = estimate as typeof estimate & {
    customers: { name: string; email: string | null } | null;
    estimate_items: { description: string; quantity: number; unit_price: number }[];
  };

  const customerEmail = est.customers?.email;
  if (!customerEmail) return NextResponse.json({ error: "Customer has no email address." }, { status: 400 });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const total = est.estimate_items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0);

  const lineItemsHtml = est.estimate_items.map((item: { description: string; quantity: number; unit_price: number }) => `
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
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Estimate</h1>
      <p style="margin:0;font-family:monospace;color:#666;font-size:14px;">${est.estimate_number}</p>
    </div>

    <div style="padding:24px 40px;border-bottom:1px solid #f0f0f0;display:flex;gap:40px;">
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Prepared For</p>
        <p style="margin:0;font-weight:600;">${est.customers?.name ?? ""}</p>
      </div>
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Issue Date</p>
        <p style="margin:0;">${fmt(est.issue_date)}</p>
      </div>
      ${est.expiry_date ? `
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Valid Until</p>
        <p style="margin:0;font-weight:600;">${fmt(est.expiry_date)}</p>
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
            <td colspan="3" style="padding:16px 8px;text-align:right;font-weight:700;font-size:15px;">Estimate Total</td>
            <td style="padding:16px 8px;text-align:right;font-weight:700;font-size:20px;">${fmtMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${est.notes ? `
    <div style="padding:0 40px 24px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Notes</p>
      <p style="margin:0;font-size:14px;color:#444;white-space:pre-wrap;">${est.notes}</p>
    </div>` : ""}

    <div style="padding:24px 40px;background:#f9f9f9;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;color:#555;">Please reply to this email to accept or decline this estimate.</p>
      <p style="margin:0;font-size:12px;color:#999;">This estimate is valid until ${est.expiry_date ? fmt(est.expiry_date) : "further notice"}.</p>
    </div>

    <div style="padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">Sent via SoloBooks</p>
    </div>
  </div>
</body>
</html>`;

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "estimates@solobooks.app";
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { error: sendError } = await resend.emails.send({
    from: fromEmail,
    to: customerEmail,
    subject: `Estimate ${est.estimate_number} — ${fmtMoney(total)}`,
    html,
  });

  if (sendError) return NextResponse.json({ error: (sendError as { message?: string }).message ?? "Failed to send email." }, { status: 500 });

  if (est.status === "draft") {
    await db.from("estimates").update({ status: "sent" }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
