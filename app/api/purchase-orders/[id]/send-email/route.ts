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

  const { data: po, error } = await db
    .from("purchase_orders")
    .select("id, po_number, vendor, vendor_email, status, order_date, expected_date, notes, purchase_order_items(description, quantity, unit_price)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

  const p = po as typeof po & {
    purchase_order_items: { description: string; quantity: number; unit_price: number }[];
  };

  if (!p.vendor_email) return NextResponse.json({ error: "No vendor email address on this purchase order." }, { status: 400 });

  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const total = p.purchase_order_items.reduce((s: number, it: { quantity: number; unit_price: number }) => s + Number(it.quantity) * Number(it.unit_price), 0);

  const lineItemsHtml = p.purchase_order_items.map((it: { description: string; quantity: number; unit_price: number }) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">${it.description}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #f0f0f0;">${Number(it.quantity)}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #f0f0f0;color:#666;">${fmtMoney(Number(it.unit_price))}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:500;">${fmtMoney(Number(it.quantity) * Number(it.unit_price))}</td>
    </tr>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <div style="padding:32px 40px;border-bottom:1px solid #f0f0f0;">
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;">Purchase Order</h1>
      <p style="margin:0;font-family:monospace;color:#666;font-size:14px;">${p.po_number}</p>
    </div>
    <div style="padding:24px 40px;border-bottom:1px solid #f0f0f0;display:flex;gap:40px;">
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Order Date</p>
        <p style="margin:0;">${fmt(p.order_date)}</p>
      </div>
      ${p.expected_date ? `<div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;">Expected Delivery</p>
        <p style="margin:0;font-weight:600;">${fmt(p.expected_date)}</p>
      </div>` : ""}
    </div>
    <div style="padding:24px 40px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:2px solid #111;">
            <th style="text-align:left;padding:8px;font-size:11px;text-transform:uppercase;color:#999;font-weight:600;">Description</th>
            <th style="text-align:right;padding:8px;font-size:11px;text-transform:uppercase;color:#999;font-weight:600;width:60px;">Qty</th>
            <th style="text-align:right;padding:8px;font-size:11px;text-transform:uppercase;color:#999;font-weight:600;width:100px;">Price</th>
            <th style="text-align:right;padding:8px;font-size:11px;text-transform:uppercase;color:#999;font-weight:600;width:100px;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #111;">
            <td colspan="3" style="padding:16px 8px;text-align:right;font-weight:700;font-size:15px;">Total</td>
            <td style="padding:16px 8px;text-align:right;font-weight:700;font-size:20px;">${fmtMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    ${p.notes ? `<div style="padding:0 40px 24px;"><p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;color:#999;">Notes</p><p style="margin:0;font-size:14px;color:#444;white-space:pre-wrap;">${p.notes}</p></div>` : ""}
    <div style="padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">Sent via SoloBooks</p>
    </div>
  </div>
</body>
</html>`;

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "orders@solobooks.app";
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { error: sendError } = await resend.emails.send({
    from: fromEmail,
    to: p.vendor_email,
    subject: `Purchase Order ${p.po_number} from ${user.email ?? "SoloBooks"}`,
    html,
  });

  if (sendError) return NextResponse.json({ error: (sendError as { message?: string }).message ?? "Failed to send." }, { status: 500 });

  if (p.status === "draft") {
    await db.from("purchase_orders").update({ status: "sent" }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
