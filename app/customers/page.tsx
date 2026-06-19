"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type Customer = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  notes: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }
    setUserId(sessionData.session.user.id);
    const { data, error } = await supabase
      .from("customers")
      .select("id, user_id, name, email, phone, address_street, address_city, address_state, address_zip, notes, created_at")
      .eq("user_id", sessionData.session.user.id)
      .order("name");
    if (error) { setError(error.message); setLoading(false); return; }
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(""); setEmail(""); setPhone("");
    setStreet(""); setCity(""); setState(""); setZip(""); setNotes("");
  };

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
      address_street: street.trim() || null,
      address_city: city.trim() || null,
      address_state: state.trim() || null,
      address_zip: zip.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    resetForm();
    setShowForm(false);
    await load();
  };

  const fullAddress = (c: Customer) =>
    [c.address_city, c.address_state].filter(Boolean).join(", ");

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q)
    );
  });

  const initials = (name: string) => {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "Loading…" : `${customers.length} customer${customers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="flex items-center gap-1.5 h-9 px-4 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {showForm ? "Cancel" : "Add Customer"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Add form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">New Customer</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Name *</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="e.g. Jane Smith or Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Phone</label>
              <input
                type="tel"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Street Address</label>
              <AddressAutocomplete
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="123 Main St"
                value={street}
                onChange={setStreet}
                onComponents={(parts) => {
                  setStreet(parts.street);
                  setCity(parts.city);
                  setState(parts.state);
                  setZip(parts.zip);
                }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">City</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none"
                placeholder="Springfield"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">State</label>
                <input
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none"
                  placeholder="IL"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Zip</label>
                <input
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none"
                  placeholder="62701"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Notes</label>
              <textarea
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm resize-none focus:outline-none"
                rows={2}
                placeholder="Any notes about this customer…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {formError && <p className="text-red-500 text-sm">{formError}</p>}

          <button
            onClick={addCustomer}
            disabled={saving}
            className="px-8 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Customer"}
          </button>
        </div>
      )}

      {/* Search */}
      {!loading && customers.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Customer list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-sm text-gray-400 mb-3">
            {search ? `No customers match "${search}"` : "No customers yet."}
          </p>
          {!search && (
            <button onClick={() => setShowForm(true)} className="text-sm text-blue-500 hover:text-blue-600">
              Add your first customer →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold shrink-0">
                {initials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{c.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  {c.email && <span>{c.email}</span>}
                  {c.email && c.phone && <span className="opacity-30">·</span>}
                  {c.phone && <span>{c.phone}</span>}
                  {fullAddress(c) && (
                    <>
                      {(c.email || c.phone) && <span className="opacity-30">·</span>}
                      <span>{fullAddress(c)}</span>
                    </>
                  )}
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
