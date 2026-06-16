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

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (gated) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-60 text-sm mb-4">Projects module not active.</p><a href="/plan" className="text-sm underline">Go to My Plan</a></main>;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold">New Project</h1>
      </div>
      <div className="border rounded-xl p-5 grid gap-4 max-w-lg">
        <div>
          <label className="text-sm opacity-60 block mb-1">Project Name *</label>
          <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="e.g. Website Redesign, Office Buildout" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm opacity-60 block mb-1">Customer</label>
          <select className="w-full border rounded px-3 py-2 bg-transparent" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— No customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm opacity-60 block mb-1">Description</label>
          <textarea className="w-full border rounded px-3 py-2 bg-transparent resize-none text-sm" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="text-sm opacity-60 block mb-1">Budget</label>
          <input type="number" min="0" step="0.01" className="w-full border rounded px-3 py-2 bg-transparent" placeholder="0.00" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-60 block mb-1">Start Date</label>
            <input type="date" className="w-full border rounded px-3 py-2 bg-transparent" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm opacity-60 block mb-1">End Date</label>
            <input type="date" className="w-full border rounded px-3 py-2 bg-transparent" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={save} disabled={saving} className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80">
          {saving ? "Creating…" : "Create Project"}
        </button>
      </div>
    </main>
  );
}
