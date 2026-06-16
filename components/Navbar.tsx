"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const HIDE_ON = ["/", "/login"];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-account-menu]"))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (HIDE_ON.includes(pathname) || pathname.startsWith("/auth/")) return null;

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/customers", label: "Customers" },
    { href: "/transactions", label: "Transactions" },
    { href: "/invoices", label: "Invoices" },
    { href: "/estimates", label: "Estimates" },
    { href: "/time", label: "Time" },
    { href: "/bills", label: "Bills" },
    { href: "/recurring", label: "Recurring" },
    { href: "/appointments", label: "Appointments" },
    { href: "/export", label: "Export" },
  ];

  const active = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <nav className="border-b">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="font-bold text-xl tracking-tight">
            SoloBooks
          </Link>
          <div className="hidden sm:flex items-center gap-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-opacity ${
                  active(l.href)
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-80"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="sm:hidden border rounded px-2 py-1 text-sm"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>

          <div className="relative" data-account-menu>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="border rounded-full w-9 h-9 flex items-center justify-center text-sm"
              aria-label="Account"
            >
              👤
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 border rounded shadow-lg z-50 overflow-hidden bg-white dark:bg-black">
                <Link
                  href="/plan"
                  className="block px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  My Plan
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <button
                  className="w-full text-left px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/login";
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="sm:hidden border-t px-6 py-3 flex flex-col gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium ${
                active(l.href) ? "opacity-100" : "opacity-60"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
