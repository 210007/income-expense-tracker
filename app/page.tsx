"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState("Checking Supabase connection...");

useEffect(() => {
  const check = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      window.location.href = "/login";
    } else {
      setStatus("Connected. Session: yes");
    }
  };
  check();
}, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Income / Expense Tracker</h1>
      <p className="mt-4">{status}</p>
      <a className="underline" href="/transactions">Go to Transactions</a>
    </main>
  );
}
