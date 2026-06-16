"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  customers: { name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  active: "text-green-600 dark:text-green-400",
  completed: "opacity-50",
  archived: "opacity-30",
};

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }

      const active = await hasModule("projects");
      if (!active) { setGated(true); setLoading(false); return; }

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, status, budget, start_date, end_date, customers(name)")
        .eq("user_id", sessionData.session.user.id)
        .order("created_at", { ascending: false });

      if (error) { setError(error.message); setLoading(false); return; }
      setProjects((data as unknown as Project[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const visible = filter === "active"
    ? projects.filter((p) => p.status === "active")
    : projects;

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Projects</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Projects — $9 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm opacity-50 mt-0.5">{visible.length} project{visible.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden text-sm">
            {(["active", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 capitalize ${filter === f ? "bg-black text-white dark:bg-white dark:text-black" : "hover:opacity-70"}`}>{f}</button>
            ))}
          </div>
          <Link href="/projects/new" className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">New Project</Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {visible.length === 0 ? (
        <p className="opacity-50 text-sm">No {filter === "active" ? "active " : ""}projects yet. <Link href="/projects/new" className="underline">Create one.</Link></p>
      ) : (
        <div className="grid gap-2">
          {visible.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block border rounded-lg p-4 hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium">{p.name}</span>
                  <span className={`text-xs font-medium capitalize ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                </div>
                {p.budget != null && <span className="opacity-50 text-sm tabular-nums">{fmtMoney(p.budget)} budget</span>}
              </div>
              <div className="text-sm opacity-60 mt-1 flex gap-2">
                {p.customers && <span>{p.customers.name}</span>}
                {p.customers && (p.start_date || p.end_date) && <span>·</span>}
                {p.start_date && <span>{fmtDate(p.start_date)}</span>}
                {p.start_date && p.end_date && <span>→</span>}
                {p.end_date && <span>{fmtDate(p.end_date)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
