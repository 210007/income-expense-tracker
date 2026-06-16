import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  // Vercel cron jobs call with a secret header for security
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Find all due active recurring transactions
  const { data: due, error: fetchErr } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("active", true)
    .lte("next_run_date", today);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ processed: 0 });

  let processed = 0;

  for (const r of due) {
    // Skip if past end date
    if (r.end_date && r.next_run_date > r.end_date) {
      await supabase.from("recurring_transactions").update({ active: false }).eq("id", r.id);
      continue;
    }

    // Insert the real transaction
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

    // Advance next_run_date
    const next = nextRunDate(r.next_run_date, r.frequency);
    const shouldDeactivate = r.end_date && next > r.end_date;

    await supabase.from("recurring_transactions").update({
      next_run_date: next,
      active: shouldDeactivate ? false : r.active,
    }).eq("id", r.id);

    processed++;
  }

  return NextResponse.json({ processed });
}
