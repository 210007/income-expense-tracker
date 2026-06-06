import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-4xl mx-auto w-full">
        <span className="font-bold text-xl">SoloBooks</span>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm opacity-60 hover:opacity-100 py-2 px-3">
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-sm bg-black text-white py-2 px-4 rounded-lg font-medium hover:opacity-90"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Bookkeeping without the bloat.
        </h1>
        <p className="text-xl opacity-60 max-w-lg mb-8">
          SoloBooks gives small businesses and freelancers the features they
          actually use — without paying for the ones they don&apos;t.
        </p>
        <Link
          href="/login"
          className="bg-black text-white px-8 py-3 rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity"
        >
          Start for Free
        </Link>
      </section>

      {/* Features */}
      <section className="border-t px-6 py-14">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              icon: "📊",
              title: "Dashboard",
              desc: "Monthly income, expenses, net, and receipt coverage at a glance.",
            },
            {
              icon: "🏦",
              title: "Bank Sync",
              desc: "Connect your bank and import transactions automatically via Plaid.",
            },
            {
              icon: "🧾",
              title: "Receipt Tracking",
              desc: "Attach receipts to expenses. Know exactly what's missing at tax time.",
            },
            {
              icon: "🏷️",
              title: "Custom Categories",
              desc: "Build the category list that fits your business — not a generic template.",
            },
            {
              icon: "📁",
              title: "CSV Export",
              desc: "Export any date range to CSV for your accountant or tax software.",
            },
            {
              icon: "🔒",
              title: "Secure",
              desc: "Your data is yours. Hosted securely on Supabase, never sold.",
            },
          ].map((f) => (
            <div key={f.title} className="border rounded-lg p-5">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold mb-1">{f.title}</div>
              <p className="text-sm opacity-60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-5 text-center text-sm opacity-40">
        SoloBooks — Built for the people who don&apos;t need all of QuickBooks.
      </footer>
    </main>
  );
}
