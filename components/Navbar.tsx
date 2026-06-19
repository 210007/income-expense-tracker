"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { ModuleName } from "@/lib/modules";

const HIDE_ON = ["/", "/login"];

type NavItem = { href: string; label: string; module?: ModuleName };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Money In",
    items: [
      { href: "/invoices", label: "Invoices", module: "invoicing" },
      { href: "/recurring-invoices", label: "Recurring Invoices", module: "invoicing" },
      { href: "/estimates", label: "Estimates", module: "estimates" },
      { href: "/time", label: "Time Tracking", module: "time_tracking" },
    ],
  },
  {
    label: "Money Out",
    items: [
      { href: "/bills", label: "Bills", module: "accounts_payable" },
      { href: "/purchase-orders", label: "Purchase Orders", module: "purchase_orders" },
      { href: "/mileage", label: "Mileage", module: "mileage" },
      { href: "/budget", label: "Budget", module: "budgeting" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/projects", label: "Projects", module: "projects" },
      { href: "/appointments", label: "Scheduling", module: "scheduling" },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/tax", label: "Tax", module: "tax" },
      { href: "/inventory", label: "Inventory", module: "inventory" },
      { href: "/recurring", label: "Recurring Txns", module: "recurring" },
      { href: "/team", label: "Team", module: "team" },
    ],
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session || cancelled) return;
      supabase
        .from("user_modules")
        .select("module, status")
        .eq("user_id", data.session.user.id)
        .eq("status", "active")
        .then(({ data: mods }) => {
          if (cancelled) return;
          setActiveModules(new Set((mods ?? []).map((m) => m.module)));
          setModulesLoaded(true);
        });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

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

  const itemVisible = (item: NavItem) =>
    !item.module || activeModules.has(item.module);

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(itemVisible),
  })).filter((g) => g.items.length > 0);

  const groupIsActive = (g: typeof visibleGroups[0]) =>
    g.items.some((l) => isActive(l.href));

  const toggleGroup = (label: string) =>
    setOpenGroup((prev) => (prev === label ? null : label));

  const hasAnyModule = activeModules.size > 0;

  return (
    <nav ref={navRef} className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Left: logo + nav */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/dashboard" className="font-bold text-xl tracking-tight shrink-0 brand-text mr-2">
            SoloBooks
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            <NavLink href="/dashboard" label="Dashboard" active={isActive("/dashboard")} />
            <NavLink href="/transactions" label="Transactions" active={isActive("/transactions")} />
            <NavLink href="/customers" label="Customers" active={isActive("/customers")} />
            <NavLink href="/products" label="Products" active={isActive("/products")} />

            {modulesLoaded && visibleGroups.map((group) => {
              const active = groupIsActive(group);
              const open = openGroup === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      active
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full brand-gradient inline-block mr-0.5" />}
                    {group.label}
                    <svg className={`w-3 h-3 transition-transform opacity-60 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {open && (
                    <div className="absolute top-full left-0 mt-1 w-52 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl bg-white dark:bg-gray-900 overflow-hidden py-1">
                      {group.items.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                            isActive(l.href)
                              ? "font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800"
                              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          {isActive(l.href) && <span className="w-1 h-4 rounded-full brand-gradient" />}
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

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/plan"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full brand-gradient text-white hover:opacity-90 transition-opacity"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {hasAnyModule ? "Upgrade" : "Discover Features"}
          </Link>

          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>

          {/* Account menu */}
          <div className="relative">
            <button
              onClick={() => setAccountOpen((v) => !v)}
              className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
            >
              S
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-2 w-48 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl bg-white dark:bg-gray-900 overflow-hidden py-1 z-50">
                <Link href="/plan" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  My Plan
                </Link>
                <Link href="/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                >
                  <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-4 flex flex-col gap-1">
          <MobileLink href="/dashboard" label="Dashboard" active={isActive("/dashboard")} />
          <MobileLink href="/transactions" label="Transactions" active={isActive("/transactions")} />
          <MobileLink href="/customers" label="Customers" active={isActive("/customers")} />
          <MobileLink href="/products" label="Products & Services" active={isActive("/products")} />

          {modulesLoaded && visibleGroups.map((group) => (
            <div key={group.label} className="pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 px-3">{group.label}</p>
              {group.items.map((l) => (
                <MobileLink key={l.href} href={l.href} label={l.label} active={isActive(l.href)} />
              ))}
            </div>
          ))}

          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
            <Link href="/plan" className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg brand-gradient text-white">
              {hasAnyModule ? "Upgrade Plan" : "Discover Features"}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        active
          ? "text-gray-900 dark:text-white"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full brand-gradient" />
      )}
      {label}
    </Link>
  );
}

function MobileLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      {active && <span className="w-1 h-4 rounded-full brand-gradient shrink-0" />}
      {label}
    </Link>
  );
}
