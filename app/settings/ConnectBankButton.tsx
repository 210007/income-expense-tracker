"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePlaidLink } from "react-plaid-link";

export default function ConnectBankButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Step 1: fetch link_token from your API
  useEffect(() => {
    (async () => {
      setError(null);
      setStatus("Preparing bank connection…");

      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData.session?.access_token;

      if (!jwt) {
        setStatus("");
        return;
      }

      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const out = await res.json();

      if (!res.ok) {
        setStatus("");
        setError(out?.error ?? "Failed to create link token");
        return;
      }

      setLinkToken(out.link_token);
      setStatus("");
    })();
  }, []);

  // Step 2: open Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setError(null);
      setStatus("Saving bank connection…");

      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData.session?.access_token;

      if (!jwt) {
        setStatus("");
        return;
      }

      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          public_token,
          institution: metadata.institution,
        }),
      });

      const out = await res.json();

      if (!res.ok) {
        setStatus("");
        setError(out?.error ?? "Failed to save bank connection");
        return;
      }

      setStatus("Connected ✅");
      // simplest: reload so the rest of the app can reflect “connected”
      window.location.reload();
    },
    onExit: () => {
      // user closed Link
    },
  });

  return (
    <div className="mt-3">
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {status && <p className="opacity-80 text-sm mb-2">{status}</p>}

      <button
        className="w-full text-center border py-3 rounded font-medium disabled:opacity-50"
        disabled={!ready || !linkToken}
        onClick={() => open()}
      >
        {ready && linkToken ? "Connect bank" : "Loading…"}
      </button>

      <p className="opacity-70 text-xs mt-2">
        After connecting, go to Transactions and click “Import from bank (Plaid)”.
      </p>
    </div>
  );
}
