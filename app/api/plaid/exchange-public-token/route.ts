import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { public_token, institution } = await req.json();

  if (!public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  // User-scoped supabase client (RLS applies)
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = userData.user;

  let access_token: string;
  let item_id: string;

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
    access_token = exchange.data.access_token;
    item_id = exchange.data.item_id;
  } catch (err: any) {
    const plaidError = err?.response?.data ?? null;
    return NextResponse.json(
      { error: "Plaid itemPublicTokenExchange failed", plaidError },
      { status: 500 }
    );
  }

  const institution_id = institution?.institution_id ?? null;
  const institution_name = institution?.name ?? null;

  // Upsert prevents duplicate item_id issues on re-link
  const { error: upsertErr } = await supabase
    .from("plaid_items")
    .upsert(
      {
        user_id: user.id,
        item_id,
        access_token,
        institution_id,
        institution_name,
      },
      { onConflict: "item_id" }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item_id });
}
