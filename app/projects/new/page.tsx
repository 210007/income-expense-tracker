"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";

type Customer = { id: string; name: string };

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = "/login"; return; }
      const active = await hasModule("projects");
      if (!active) { setGated(true); setLoading(false); return; }
      setUserId(sessionData.session.user.id);
      const { data } = await supabase.from("customers").select("id, name").eq("user_id", sessionData.session.user.id).order("name");
      setCustomers((data as Customer[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!userId) return;
    setSaving(true);
    const { data: project, error } = await supabase.from("projects").insert({
      user_id: userId,
      customer_id: customerId || null,
      name: name.trim(),
      description: description.trim() || null,
      budget: budget ? parseFloat(budget) : null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: "active",
    }).select("id").single();
    setSaving(false);
    if (error || !project) { setError(error?.message ?? "Failed to create project."); return; }
    router.push(`/projects/${project.id}`);
  };

  if (loading) return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-40" />
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-64" />
      </div>
    </main>
  );

  if (gated) return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm text-gray-500 dark:text-gray-400">
        Projects module not active. <a href="/plan" className="underline font-medium">Go to My Plan</a>
      </div>
    </main>
  );

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Project</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4 max-w-lg">
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Project Name *</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g. Website Redesign, Office Buildout"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Customer</label>
          <select
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">— No customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
          <textarea
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Budget</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="0.00"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Start Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">End Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "Creating…" : "Create Project"}
        </button>
      </div>
    </main>
  );
}
