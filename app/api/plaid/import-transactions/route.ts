import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { plaidClient } from "@/lib/plaid";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    // ---- Auth: require Supabase JWT in Authorization header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = userData.user;

    // ---- Pull ALL linked items for the user (not just the first one)
    const { data: items, error: itemsErr } = await supabase
      .from("plaid_items")
      .select("item_id, access_token")
      .eq("user_id", user.id);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No bank connected yet." },
        { status: 400 }
      );
    }

    // ---- Date range (default last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    let totalFetched = 0;
    let totalUpserted = 0;

    // ---- For each linked bank item, page through transactions
    for (const item of items) {
      let offset = 0;
      const count = 250;

      while (true) {
        let plaidRes;
        try {
          plaidRes = await plaidClient.transactionsGet({
            access_token: item.access_token,
            start_date: isoDate(start),
            end_date: isoDate(end),
            options: { count, offset },
          });
        } catch (err: any) {
          const plaidError = err?.response?.data ?? null;
          return NextResponse.json(
            { error: "Plaid transactionsGet failed", plaidError },
            { status: 500 }
          );
        }

        const plaidTxns = plaidRes.data.transactions || [];
        const total = plaidRes.data.total_transactions || 0;

        totalFetched += plaidTxns.length;

        if (plaidTxns.length > 0) {
          const rows = plaidTxns.map((t) => {
            // Plaid: positive usually = expense/outflow, negative = income/inflow.
            const amt = Number(t.amount ?? 0);
            const isExpense = amt >= 0;

            // Vendor/description mapping:
            // - If Plaid provides merchant_name, use that as vendor.
            // - Use the raw Plaid "name" as description when it's useful.
            const vendor = t.merchant_name ?? t.name ?? null;
            const description = t.merchant_name ? (t.name ?? null) : null;

            return {
              user_id: user.id,
              txn_date: t.date ?? null, // YYYY-MM-DD
              type: isExpense ? "expense" : "income",
              amount: Math.abs(amt),
              vendor,
              description,
              // NOTE: This is Plaid's category primary (often ALL_CAPS_WITH_UNDERSCORES)
              // We can map this to your own categories later.
              category: (t.personal_finance_category?.primary ?? null) as string | null,
              plaid_transaction_id: t.transaction_id,
              plaid_account_id: t.account_id,
              source: "plaid",
            };
          });

          // Upsert by plaid_transaction_id (requires your unique index)
          const { error: upErr } = await supabase
            .from("transactions")
            .upsert(rows, { onConflict: "plaid_transaction_id" });

          if (upErr) {
            return NextResponse.json({ error: upErr.message }, { status: 500 });
          }

          totalUpserted += rows.length;
        }

        offset += plaidTxns.length;

        // done paging
        if (offset >= total || plaidTxns.length === 0) break;
      }
    }

    return NextResponse.json({
      ok: true,
      window: { start: isoDate(start), end: isoDate(end) },
      fetched: totalFetched,
      upserted: totalUpserted,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
