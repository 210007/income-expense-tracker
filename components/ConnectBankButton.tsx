"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlaidLink } from "react-plaid-link";

export default function ConnectBankButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) { setErr("Not logged in."); setLoading(false); return; }

      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) { setErr(json?.error || "Failed to create link token."); setLoading(false); return; }
      setLinkToken(json.link_token || null);
      setLoading(false);
    })();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token, metadata) => {
      setErr(null);
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) { setErr("Not logged in."); setLoading(false); return; }

      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ public_token, institution: metadata.institution }),
      });
      const json = await res.json();
      setLoading(false);
      if (!res.ok) { setErr(json?.error || "Failed to connect bank."); return; }
      setSuccess(true);
    },
  });

  if (success) {
    return (
      <p className="mt-3 text-sm text-green-600">
        ✅ Bank connected! Use Sync on the dashboard to import transactions.
      </p>
    );
  }

  return (
    <div className="grid gap-2 mt-3">
      <button
        onClick={() => open()}
        disabled={!ready || !linkToken || loading}
        className="w-full border py-3 rounded font-medium disabled:opacity-50"
      >
        {loading ? "Loading…" : "Connect Bank"}
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
