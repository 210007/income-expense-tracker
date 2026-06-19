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

const STATUS_CHIP: Record<string, string> = {
  active: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  completed: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  archived: "bg-gray-100 text-gray-400 dark:bg-gray-800",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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

  const visible = filter === "active" ? projects.filter((p) => p.status === "active") : projects;

  if (loading) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-9 bg-gray-200 dark:bg-gray-800 rounded-xl w-48" />
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-gray-100 dark:bg-gray-800 rounded-2xl" />)}
          </div>
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Projects</h1>
        <p className="text-sm text-gray-500 mb-6">Track work, budgets, and timelines on client projects.</p>
        <Link href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Add Projects — $9/mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {visible.length} project{visible.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {(["active", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f ? "brand-gradient text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {f === "all" ? "All" : "Active"}
              </button>
            ))}
          </div>
          <Link
            href="/projects/new"
            className="flex items-center gap-1.5 h-9 px-4 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Link>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-400 mb-3">
            {filter === "active" ? "No active projects." : "No projects yet."}
          </p>
          <Link href="/projects/new" className="text-sm text-blue-500 hover:text-blue-600">
            Create your first project →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white leading-snug">{p.name}</h3>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize shrink-0 ${STATUS_CHIP[p.status]}`}>
                  {p.status}
                </span>
              </div>

              {p.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{p.description}</p>
              )}

              <div className="mt-auto flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.customers && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full brand-gradient inline-block shrink-0" />
                      {p.customers.name}
                    </span>
                  )}
                  {p.start_date && (
                    <span>
                      {fmtDate(p.start_date)}
                      {p.end_date && ` – ${fmtDate(p.end_date)}`}
                    </span>
                  )}
                </div>
                {p.budget != null && (
                  <span className="font-semibold text-gray-600 dark:text-gray-300">{money(p.budget)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
