import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { public_token, institution } = await req.json();

  if (!public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

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

  const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
  const access_token = exchange.data.access_token;
  const item_id = exchange.data.item_id;

  const institution_id = institution?.institution_id ?? null;
  const institution_name = institution?.name ?? null;

  const { error: insertErr } = await supabase.from("plaid_items").insert({
    user_id: user.id,
    item_id,
    access_token,
    institution_id,
    institution_name,
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
