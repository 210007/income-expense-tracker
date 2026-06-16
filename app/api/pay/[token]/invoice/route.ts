import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = supabaseServer();

  const { data, error } = await db
    .from("invoices")
    .select(`
      id, invoice_number, status, issue_date, due_date, notes,
      customers ( name, email ),
      invoice_items ( id, description, quantity, unit_price )
    `)
    .eq("public_token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  return NextResponse.json(data);
}
