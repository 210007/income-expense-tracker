import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // 1) Verify user from the caller JWT
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  // 2) Use service role to delete data (bypasses RLS safely server-side)
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // If your schema differs, adjust these deletes.
  // Recommended: remove plaid items + bank accounts + plaid-linked transactions.
  const txDelete = await supabaseAdmin
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .not("bank_account_id", "is", null); // deletes only bank-imported txns if bank_account_id is used

  if (txDelete.error) {
    return NextResponse.json({ error: txDelete.error.message }, { status: 500 });
  }

  const acctDelete = await supabaseAdmin
    .from("bank_accounts")
    .delete()
    .eq("user_id", userId);

  if (acctDelete.error) {
    return NextResponse.json({ error: acctDelete.error.message }, { status: 500 });
  }

  const itemDelete = await supabaseAdmin
    .from("plaid_items")
    .delete()
    .eq("user_id", userId);

  if (itemDelete.error) {
    return NextResponse.json({ error: itemDelete.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
