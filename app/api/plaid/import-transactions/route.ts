import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { plaidClient } from "@/lib/plaid";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = userData.user;

    // Grab the user's first linked item (good enough for now)
    const { data: items, error: itemsErr } = await supabase
      .from("plaid_items")
      .select("access_token")
      .eq("user_id", user.id)
      .limit(1);

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No bank connected yet." }, { status: 400 });
    }

    const access_token = items[0].access_token;

    // Date range: last 30 days (you can change later)
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    // Pull transactions from Plaid
    const plaidRes = await plaidClient.transactionsGet({
      access_token,
      start_date: isoDate(start),
      end_date: isoDate(end),
      options: { count: 250, offset: 0 },
    });

    const plaidTxns = plaidRes.data.transactions || [];

    // Map Plaid -> your schema
    const rows = plaidTxns.map((t) => {
      // Plaid amounts: positive for outflow, negative for inflow (usually).
      // We'll normalize into your type + positive amount.
      const amt = Number(t.amount);
      const isExpense = amt > 0;

      return {
        user_id: user.id,
        txn_date: t.date, // YYYY-MM-DD
        type: isExpense ? "expense" : "income",
        amount: Math.abs(amt),
        vendor: t.merchant_name ?? t.name ?? null,
        description: t.name ?? null,
        category: (t.personal_finance_category?.primary ?? null) as string | null,
        plaid_transaction_id: t.transaction_id,
        source: "plaid",
      };
    });

    if (rows.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    // Insert, ignoring duplicates thanks to the unique index
    const { error: insErr } = await supabase
      .from("transactions")
      .upsert(rows, { onConflict: "plaid_transaction_id" });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ inserted: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
