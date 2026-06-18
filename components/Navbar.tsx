"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const HIDE_ON = ["/", "/login"];

type Group = { label: string; links: { href: string; label: string }[] };

const GROUPS: Group[] = [
  {
    label: "Clients",
    links: [
      { href: "/customers", label: "Customers" },
      { href: "/projects", label: "Projects" },
      { href: "/time", label: "Time Tracking" },
      { href: "/appointments", label: "Appointments" },
    ],
  },
  {
    label: "Invoicing",
    links: [
      { href: "/invoices", label: "Invoices" },
      { href: "/estimates", label: "Estimates" },
      { href: "/recurring-invoices", label: "Recurring Invoices" },
    ],
  },
  {
    label: "Expenses",
    links: [
      { href: "/bills", label: "Bills" },
      { href: "/purchase-orders", label: "Purchase Orders" },
      { href: "/mileage", label: "Mileage" },
      { href: "/budget", label: "Budget" },
    ],
  },
  {
    label: "Reports",
    links: [
      { href: "/tax", label: "Tax" },
      { href: "/inventory", label: "Inventory" },
      { href: "/recurring", label: "Recurring Transactions" },
      { href: "/export", label: "Export" },
      { href: "/team", label: "Team" },
    ],
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close everything when navigating
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Close dropdowns when clicking outside the nav
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) {
        setOpenGroup(null);
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (HIDE_ON.includes(pathname) || pathname.startsWith("/auth/")) return null;

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const groupIsActive = (group: Group) => group.links.some((l) => isActive(l.href));

  const toggleGroup = (label: string) =>
    setOpenGroup((prev) => (prev === label ? null : label));

  return (
    <nav ref={navRef} className="border-b relative z-40">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Left: logo + nav items */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-xl tracking-tight shrink-0">
            SoloBooks
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            {/* Standalone: Dashboard */}
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-opacity ${
                isActive("/dashboard") ? "opacity-100" : "opacity-50 hover:opacity-80"
              }`}
            >
              Dashboard
            </Link>

            {/* Standalone: Transactions */}
            <Link
              href="/transactions"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-opacity ${
                isActive("/transactions") ? "opacity-100" : "opacity-50 hover:opacity-80"
              }`}
            >
              Transactions
            </Link>

            {/* Dropdown groups */}
            {GROUPS.map((group) => {
              const active = groupIsActive(group);
              const open = openGroup === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-opacity ${
                      active ? "opacity-100" : "opacity-50 hover:opacity-80"
                    }`}
                  >
                    {group.label}
                    <svg
                      className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {open && (
                    <div className="absolute top-full left-0 mt-1 w-48 border rounded-lg shadow-lg bg-white dark:bg-black overflow-hidden">
                      {group.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`block px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                            isActive(l.href) ? "font-semibold" : "opacity-70"
                          }`}
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: mobile toggle + account */}
        <div className="flex items-center gap-2">
          <button
            className="sm:hidden border rounded px-2 py-1 text-sm"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="border rounded-full w-9 h-9 flex items-center justify-center text-sm"
              aria-label="Account"
            >
              👤
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-2 w-44 border rounded-lg shadow-lg z-50 overflow-hidden bg-white dark:bg-black">
                <Link href="/plan" className="block px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10">
                  My Plan
                </Link>
                <Link href="/settings" className="block px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10">
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t px-6 py-4 flex flex-col gap-4 bg-white dark:bg-black">
          <Link href="/dashboard" className={`text-sm font-medium ${isActive("/dashboard") ? "" : "opacity-60"}`}>
            Dashboard
          </Link>
          <Link href="/transactions" className={`text-sm font-medium ${isActive("/transactions") ? "" : "opacity-60"}`}>
            Transactions
          </Link>
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-2">{group.label}</p>
              <div className="flex flex-col gap-2 pl-2">
                {group.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`text-sm ${isActive(l.href) ? "font-semibold" : "opacity-60"}`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
