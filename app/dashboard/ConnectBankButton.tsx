"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlaidLink } from "react-plaid-link";

export default function ConnectBankButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setErr("Not logged in.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const json = await res.json();

      if (!res.ok) {
        setErr(json?.error || "Failed to create link token.");
        setLinkToken(null);
        setLoading(false);
        return;
      }

      setLinkToken(json.link_token || null);
      setLoading(false);
    })();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setErr(null);

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setErr("Not logged in.");
        return;
      }

      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          public_token,
          institution: metadata.institution,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErr(json?.error || "Failed to connect bank.");
        return;
      }

      alert("Bank connected!");
    },
  });

    return (
    <div className="w-full grid grid-cols-2 gap-2">
      <button
        onClick={() => open()}
        disabled={!ready || !linkToken || loading}
        className="w-full text-center bg-black text-white py-3 rounded font-medium disabled:opacity-50"
      >
        {loading ? "Loading…" : "Connect Bank"}
      </button>

      <button
        onClick={async () => {
          setErr(null);
          setLoading(true);

          const { data } = await supabase.auth.getSession();
          const accessToken = data.session?.access_token;

          const res = await fetch("/api/plaid/import-transactions", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          const json = await res.json();
          setLoading(false);

          if (!res.ok) {
            setErr(json?.error || "Failed to sync transactions.");
            return;
          }

          alert(`Imported ${json.inserted ?? 0} transactions. Refreshing…`);
          window.location.reload();
        }}
        disabled={loading}
        className="w-full text-center border py-3 rounded font-medium disabled:opacity-50"
      >
        Sync
      </button>

      {err && <p className="text-sm text-red-600 col-span-2">{err}</p>}
    </div>
  );

}
