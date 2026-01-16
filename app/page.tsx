"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    window.location.replace("/dashboard");
  }, []);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <p>Loading…</p>
    </main>
  );
}
