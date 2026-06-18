"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type CustomerField = { id: string; user_id: string; label: string; field_type: string; created_at: string };
type CustomerFieldValue = { id: string; customer_id: string; field_id: string; value: string | null };

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [fields, setFields] = useState<CustomerField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState("");
  const [savingField, setSavingField] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { router.push("/login"); return; }
    const uid = sessionData.session.user.id;

    const { data: custData, error: custErr } = await supabase
      .from("customers")
      .select("id, user_id, name, email, phone, address_street, address_city, address_state, address_zip, notes, created_at")
      .eq("id", id)
      .single();

    if (custErr || !custData) { setError(custErr?.message ?? "Customer not found."); setLoading(false); return; }

    const cust = custData as Customer;
    setCustomer(cust);
    setEditName(cust.name);
    setEditEmail(cust.email ?? "");
    setEditPhone(cust.phone ?? "");
    setEditStreet(cust.address_street ?? "");
    setEditCity(cust.address_city ?? "");
    setEditState(cust.address_state ?? "");
    setEditZip(cust.address_zip ?? "");
    setEditNotes(cust.notes ?? "");

    const { data: fieldsData } = await supabase
      .from("customer_fields")
      .select("id, user_id, label, field_type, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    const loadedFields = (fieldsData as CustomerField[]) ?? [];
    setFields(loadedFields);

    if (loadedFields.length > 0) {
      const { data: valData } = await supabase
        .from("customer_field_values")
        .select("id, customer_id, field_id, value")
        .eq("customer_id", id);
      const vals: Record<string, string> = {};
      for (const v of (valData as CustomerFieldValue[]) ?? []) vals[v.field_id] = v.value ?? "";
      setFieldValues(vals);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const startEdit = () => {
    if (!customer) return;
    setEditName(customer.name);
    setEditEmail(customer.email ?? "");
    setEditPhone(customer.phone ?? "");
    setEditStreet(customer.address_street ?? "");
    setEditCity(customer.address_city ?? "");
    setEditState(customer.address_state ?? "");
    setEditZip(customer.address_zip ?? "");
    setEditNotes(customer.notes ?? "");
    setSaveError(null);
    setEditing(true);
  };

  const saveCustomer = async () => {
    setSaveError(null);
    const trimmedName = editName.trim();
    if (!trimmedName) { setSaveError("Name is required."); return; }
    setSaving(true);
    const { error } = await supabase.from("customers").update({
      name: trimmedName,
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      address_street: editStreet.trim() || null,
      address_city: editCity.trim() || null,
      address_state: editState.trim() || null,
      address_zip: editZip.trim() || null,
      notes: editNotes.trim() || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setEditing(false);
    await load();
  };

  const deleteCustomer = async () => {
    if (!window.confirm(`Delete "${customer?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const { error } = await supabase.from("customers").delete().eq("id", id);
    setDeleting(false);
    if (error) { setError(error.message); return; }
    router.push("/customers");
  };

  const saveFieldValue = async (fieldId: string) => {
    setSavingField(true);
    const val = editingFieldValue.trim();
    await supabase.from("customer_field_values").upsert(
      { customer_id: id, field_id: fieldId, value: val || null },
      { onConflict: "customer_id,field_id" }
    );
    setFieldValues((prev) => ({ ...prev, [fieldId]: val }));
    setEditingFieldId(null);
    setSavingField(false);
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const fieldTypeLabel = (t: string) =>
    ({ text: "Text", number: "Number", date: "Date", boolean: "Yes/No" }[t] ?? t);

  const fullAddress = (c: Customer) =>
    [c.address_street, c.address_city, c.address_state, c.address_zip].filter(Boolean).join(", ");

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;
  if (error || !customer) return (
    <main className="p-6 max-w-4xl mx-auto">
      <a href="/customers" className="text-sm opacity-50 hover:opacity-100 mb-4 inline-block">← Customers</a>
      <p className="text-red-600">{error ?? "Customer not found."}</p>
    </main>
  );

  const mapsAddress = fullAddress(customer);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <a href="/customers" className="text-sm opacity-50 hover:opacity-100 mb-4 inline-block">← Customers</a>

      <section className="border rounded-lg p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          {!editing && (
            <div className="flex gap-2">
              <button onClick={startEdit} className="border rounded px-3 py-1.5 text-sm font-medium hover:opacity-70">Edit</button>
              <button onClick={deleteCustomer} disabled={deleting} className="border rounded px-3 py-1.5 text-sm font-medium text-red-600 hover:opacity-70 disabled:opacity-40">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid gap-3">
            <div>
              <label className="text-sm opacity-60 block mb-1">Name *</label>
              <input className="w-full border rounded px-3 py-2 bg-transparent" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-60 block mb-1">Email</label>
                <input type="email" className="w-full border rounded px-3 py-2 bg-transparent" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-sm opacity-60 block mb-1">Phone</label>
                <input type="tel" className="w-full border rounded px-3 py-2 bg-transparent" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm opacity-60 block mb-1">Street Address</label>
              <AddressAutocomplete
                className="w-full border rounded px-3 py-2 bg-transparent"
                placeholder="123 Main St"
                value={editStreet}
                onChange={setEditStreet}
                onComponents={(parts) => {
                  setEditStreet(parts.street);
                  setEditCity(parts.city);
                  setEditState(parts.state);
                  setEditZip(parts.zip);
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-sm opacity-60 block mb-1">City</label>
                <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Springfield" value={editCity} onChange={(e) => setEditCity(e.target.value)} />
              </div>
              <div>
                <label className="text-sm opacity-60 block mb-1">State</label>
                <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="IL" value={editState} onChange={(e) => setEditState(e.target.value)} />
              </div>
              <div>
                <label className="text-sm opacity-60 block mb-1">Zip Code</label>
                <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="62701" value={editZip} onChange={(e) => setEditZip(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm opacity-60 block mb-1">Notes</label>
              <textarea className="w-full border rounded px-3 py-2 bg-transparent resize-none" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            {saveError && <p className="text-red-600 text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={saveCustomer} disabled={saving} className="flex-1 bg-black text-white dark:bg-white dark:text-black py-2 rounded font-medium disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 border py-2 rounded font-medium">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="opacity-50 mb-0.5">Email</div>
                <div>{customer.email || <span className="opacity-40">—</span>}</div>
              </div>
              <div>
                <div className="opacity-50 mb-0.5">Phone</div>
                <div>{customer.phone || <span className="opacity-40">—</span>}</div>
              </div>
            </div>
            <div>
              <div className="opacity-50 mb-0.5">Address</div>
              {mapsAddress ? (
                <div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(mapsAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-start gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0 mt-0.5">
                      <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.003 3.5-4.697 3.5-8.328a8.25 8.25 0 00-16.5 0c0 3.63 1.556 6.326 3.5 8.328a19.579 19.579 0 002.682 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {customer.address_street && <span className="block">{customer.address_street}</span>}
                      {(customer.address_city || customer.address_state || customer.address_zip) && (
                        <span className="block">
                          {[customer.address_city, customer.address_state, customer.address_zip].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </span>
                  </a>
                </div>
              ) : <span className="opacity-40">—</span>}
            </div>
            <div>
              <div className="opacity-50 mb-0.5">Notes</div>
              <div className="whitespace-pre-wrap">{customer.notes || <span className="opacity-40">—</span>}</div>
            </div>
            <div className="opacity-40 text-xs pt-1">Added {fmtDate(customer.created_at)}</div>
          </div>
        )}
      </section>

      {fields.length > 0 && (
        <section className="border rounded-lg p-5 mb-4">
          <h2 className="font-semibold mb-4">Custom Fields</h2>
          <div className="grid gap-3">
            {fields.map((f) => (
              <div key={f.id} className="flex-1">
                <div className="text-xs opacity-50 mb-0.5">{f.label} <span className="italic">({fieldTypeLabel(f.field_type)})</span></div>
                {editingFieldId === f.id ? (
                  <div className="flex gap-2">
                    {f.field_type === "boolean" ? (
                      <select className="flex-1 border rounded px-2 py-1 bg-transparent text-sm" value={editingFieldValue} onChange={(e) => setEditingFieldValue(e.target.value)}>
                        <option value="">—</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input className="flex-1 border rounded px-2 py-1 bg-transparent text-sm" type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"} value={editingFieldValue} onChange={(e) => setEditingFieldValue(e.target.value)} />
                    )}
                    <button onClick={() => saveFieldValue(f.id)} disabled={savingField} className="border rounded px-2 py-1 text-xs font-medium disabled:opacity-50">{savingField ? "…" : "Save"}</button>
                    <button onClick={() => setEditingFieldId(null)} className="border rounded px-2 py-1 text-xs">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {fieldValues[f.id]
                        ? f.field_type === "boolean" ? (fieldValues[f.id] === "true" ? "Yes" : "No") : fieldValues[f.id]
                        : <span className="opacity-40">—</span>}
                    </span>
                    <button onClick={() => { setEditingFieldId(f.id); setEditingFieldValue(fieldValues[f.id] ?? ""); }} className="text-xs opacity-40 hover:opacity-80">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border rounded-lg p-5">
        <h2 className="font-semibold mb-2">Transactions</h2>
        <p className="text-sm opacity-50">Invoice &amp; transaction linking coming soon.</p>
      </section>
    </main>
  );
}
