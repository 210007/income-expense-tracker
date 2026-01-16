import { Suspense } from "react";
import TransactionsClient from "./TransactionsClient";

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6 max-w-3xl mx-auto">Loading…</main>}>
      <TransactionsClient />
    </Suspense>
  );
}
