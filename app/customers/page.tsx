"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Customer = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const uid = sessionData.session.user.id;
    setUserId(uid);

    const { data, error } = await supabase
      .from("customers")
      .select("id, user_id, name, email, phone, address, notes, created_at")
      .eq("user_id", uid)
      .order("name", { ascending: true });

    if (error) { setError(error.message); setLoading(false); return; }
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addCustomer = async () => {
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) { setFormError("Name is required."); return; }
    if (!userId) { window.location.href = "/login"; return; }

    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      user_id: userId,
      name: trimmedName,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (error) { setFormError(error.message); return; }

    // Reset form
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setNotes("");
    setShowForm(false);
    await load();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm opacity-50 mt-0.5">
            {loading ? "Loading…" : `${customers.length} customer${customers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70"
        >
          {showForm ? "Cancel" : "Add Customer"}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Add customer form */}
      {showForm && (
        <section className="border rounded-lg p-5 mb-6">
          <h2 className="font-semibold mb-4">New Customer</h2>
          <div className="grid gap-3">
            <div>
              <label className="text-sm opacity-60 block mb-1">Name *</label>
              <input
                className="w-full border rounded px-3 py-2 bg-transparent"
                placeholder="e.g. Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-60 block mb-1">Email</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-transparent"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm opacity-60 block mb-1">Phone</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-transparent"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm opacity-60 block mb-1">Address</label>
              <input
                className="w-full border rounded px-3 py-2 bg-transparent"
                placeholder="123 Main St, City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm opacity-60 block mb-1">Notes</label>
              <textarea
                className="w-full border rounded px-3 py-2 bg-transparent resize-none"
                rows={3}
                placeholder="Any notes about this customer…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {formError && <p className="text-red-600 text-sm">{formError}</p>}

            <button
              className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-50"
              onClick={addCustomer}
              disabled={saving}
            >
              {saving ? "Saving…" : "Add Customer"}
            </button>
          </div>
        </section>
      )}

      {/* Customer list */}
      {loading ? (
        <p className="opacity-50">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="opacity-50 text-sm">No customers yet. Add your first one above.</p>
      ) : (
        <div className="grid gap-2">
          {customers.map((c) => (
            <a
              key={c.id}
              href={`/customers/${c.id}`}
              className="block border rounded-lg p-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex justify-between gap-3">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs opacity-50 whitespace-nowrap">{fmtDate(c.created_at)}</div>
              </div>
              {(c.email || c.phone) && (
                <div className="text-sm opacity-60 mt-1">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
