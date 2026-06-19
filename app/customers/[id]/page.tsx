"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type Customer = {
  id: string; user_id: string; name: string; email: string | null; phone: string | null;
  address_street: string | null; address_city: string | null; address_state: string | null;
  address_zip: string | null; notes: string | null; created_at: string;
};
type CustomerField = { id: string; user_id: string; label: string; field_type: string; created_at: string };
type CustomerFieldValue = { id: string; customer_id: string; field_id: string; value: string | null };
type ServicePrice = { id: string; service_name: string; price: number };

const PREBUILT_FIELDS = [
  { label: "Service Frequency", field_type: "text", category: "Scheduling" },
  { label: "Preferred Day", field_type: "text", category: "Scheduling" },
  { label: "Preferred Time", field_type: "text", category: "Scheduling" },
  { label: "Property Type", field_type: "text", category: "Property" },
  { label: "Square Footage", field_type: "number", category: "Property" },
  { label: "Gate / Access Code", field_type: "text", category: "Property" },
  { label: "Number of Units", field_type: "number", category: "Property" },
  { label: "Hourly Rate", field_type: "number", category: "Billing" },
  { label: "Discount %", field_type: "number", category: "Billing" },
  { label: "Payment Terms", field_type: "text", category: "Billing" },
  { label: "Tax Exempt", field_type: "boolean", category: "Billing" },
  { label: "Credit Limit", field_type: "number", category: "Billing" },
  { label: "Birthday", field_type: "date", category: "Contact" },
  { label: "Preferred Contact Method", field_type: "text", category: "Contact" },
  { label: "Referred By", field_type: "text", category: "Contact" },
  { label: "Industry", field_type: "text", category: "Business" },
  { label: "Website", field_type: "text", category: "Business" },
  { label: "Account Number", field_type: "text", category: "Business" },
  { label: "Lead Source", field_type: "text", category: "Business" },
  { label: "VIP", field_type: "boolean", category: "Business" },
];

const FIELD_CATEGORIES = ["Scheduling", "Property", "Billing", "Contact", "Business"];

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
  const [deleting, setDeleting] = useState(false);

  const [fields, setFields] = useState<CustomerField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState("");
  const [savingField, setSavingField] = useState(false);

  const [managingFields, setManagingFields] = useState(false);
  const [addingCustomField, setAddingCustomField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [savingNewField, setSavingNewField] = useState(false);

  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [addingPrice, setAddingPrice] = useState(false);
  const [newPriceName, setNewPriceName] = useState("");
  const [newPriceAmount, setNewPriceAmount] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceName, setEditPriceName] = useState("");
  const [editPriceAmount, setEditPriceAmount] = useState("");

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

    const [{ data: fieldsData }, { data: pricesData }] = await Promise.all([
      supabase.from("customer_fields").select("id, user_id, label, field_type, created_at").eq("user_id", uid).order("created_at", { ascending: true }),
      supabase.from("customer_service_prices").select("id, service_name, price").eq("customer_id", id).order("created_at", { ascending: true }),
    ]);

    const loadedFields = (fieldsData as CustomerField[]) ?? [];
    setFields(loadedFields);
    setServicePrices((pricesData as ServicePrice[]) ?? []);

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

  const togglePrebuiltField = async (prebuilt: typeof PREBUILT_FIELDS[0], isActive: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    if (isActive) {
      const existing = fields.find((f) => f.label === prebuilt.label);
      if (existing) await supabase.from("customer_fields").delete().eq("id", existing.id);
    } else {
      await supabase.from("customer_fields").insert({ user_id: sessionData.session.user.id, label: prebuilt.label, field_type: prebuilt.field_type });
    }
    await load();
  };

  const addCustomField = async () => {
    if (!newFieldLabel.trim()) return;
    setSavingNewField(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setSavingNewField(false); return; }
    await supabase.from("customer_fields").insert({ user_id: sessionData.session.user.id, label: newFieldLabel.trim(), field_type: newFieldType });
    setNewFieldLabel("");
    setNewFieldType("text");
    setAddingCustomField(false);
    setSavingNewField(false);
    await load();
  };

  const deleteField = async (fieldId: string) => {
    await supabase.from("customer_fields").delete().eq("id", fieldId);
    await load();
  };

  const addServicePrice = async () => {
    if (!newPriceName.trim() || !newPriceAmount) return;
    setSavingPrice(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setSavingPrice(false); return; }
    await supabase.from("customer_service_prices").insert({
      customer_id: id,
      user_id: sessionData.session.user.id,
      service_name: newPriceName.trim(),
      price: parseFloat(newPriceAmount),
    });
    setNewPriceName("");
    setNewPriceAmount("");
    setAddingPrice(false);
    setSavingPrice(false);
    await load();
  };

  const saveEditPrice = async () => {
    if (!editingPriceId || !editPriceName.trim() || !editPriceAmount) return;
    setSavingPrice(true);
    await supabase.from("customer_service_prices").update({
      service_name: editPriceName.trim(),
      price: parseFloat(editPriceAmount),
    }).eq("id", editingPriceId);
    setEditingPriceId(null);
    setSavingPrice(false);
    await load();
  };

  const deleteServicePrice = async (priceId: string) => {
    await supabase.from("customer_service_prices").delete().eq("id", priceId);
    setServicePrices((prev) => prev.filter((p) => p.id !== priceId));
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const fieldTypeLabel = (t: string) => ({ text: "Text", number: "Number", date: "Date", boolean: "Yes/No" }[t] ?? t);
  const fullAddress = (c: Customer) => [c.address_street, c.address_city, c.address_state, c.address_zip].filter(Boolean).join(", ");

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

      {/* Customer info */}
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
              <div>
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

      {/* Service Prices */}
      <section className="border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Service Prices</h2>
          {!addingPrice && (
            <button onClick={() => setAddingPrice(true)} className="text-sm border rounded px-2 py-1 hover:opacity-70">+ Add</button>
          )}
        </div>

        {servicePrices.length === 0 && !addingPrice && (
          <p className="text-sm opacity-40">No service prices yet. Add named prices for this customer (e.g. Monthly Spray, Quarterly Treatment).</p>
        )}

        <div className="grid gap-2">
          {servicePrices.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              {editingPriceId === p.id ? (
                <>
                  <input className="flex-1 border rounded px-2 py-1 bg-transparent text-sm" value={editPriceName} onChange={(e) => setEditPriceName(e.target.value)} />
                  <span className="opacity-40 text-sm">$</span>
                  <input className="w-24 border rounded px-2 py-1 bg-transparent text-sm" type="number" step="0.01" min="0" value={editPriceAmount} onChange={(e) => setEditPriceAmount(e.target.value)} />
                  <button onClick={saveEditPrice} disabled={savingPrice} className="border rounded px-2 py-1 text-xs disabled:opacity-50 hover:opacity-70">Save</button>
                  <button onClick={() => setEditingPriceId(null)} className="border rounded px-2 py-1 text-xs hover:opacity-70">✕</button>
                </>
              ) : (
                <>
                  <span className="flex-1">{p.service_name}</span>
                  <span className="font-medium tabular-nums">${p.price.toFixed(2)}</span>
                  <button
                    onClick={() => { setEditingPriceId(p.id); setEditPriceName(p.service_name); setEditPriceAmount(String(p.price)); }}
                    className="opacity-30 hover:opacity-70"
                    title="Edit"
                  >✏</button>
                  <button onClick={() => deleteServicePrice(p.id)} className="opacity-30 hover:opacity-70 text-red-500" title="Delete">✕</button>
                </>
              )}
            </div>
          ))}
        </div>

        {addingPrice && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-40 border rounded px-2 py-1.5 bg-transparent text-sm"
              placeholder="Service name (e.g. Monthly Spray)"
              value={newPriceName}
              onChange={(e) => setNewPriceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addServicePrice()}
            />
            <div className="flex items-center border rounded overflow-hidden">
              <span className="px-2 opacity-40 text-sm">$</span>
              <input
                className="w-24 py-1.5 pr-2 bg-transparent text-sm outline-none"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newPriceAmount}
                onChange={(e) => setNewPriceAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addServicePrice()}
              />
            </div>
            <button
              onClick={addServicePrice}
              disabled={savingPrice || !newPriceName.trim() || !newPriceAmount}
              className="border rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:opacity-70"
            >
              Add
            </button>
            <button onClick={() => { setAddingPrice(false); setNewPriceName(""); setNewPriceAmount(""); }} className="border rounded px-3 py-1.5 text-sm hover:opacity-70">
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Custom Fields */}
      <section className="border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Custom Fields</h2>
            {managingFields && <p className="text-xs opacity-40 mt-0.5">These fields appear on all customer records</p>}
          </div>
          <button
            onClick={() => { setManagingFields((v) => !v); setAddingCustomField(false); }}
            className={`text-sm border rounded px-2 py-1 hover:opacity-70 transition-colors ${managingFields ? "bg-black text-white dark:bg-white dark:text-black border-transparent" : ""}`}
          >
            {managingFields ? "Done" : "✏ Manage"}
          </button>
        </div>

        {managingFields && (
          <div className="mb-5 pb-5 border-b">
            {FIELD_CATEGORIES.map((cat) => (
              <div key={cat} className="mb-4">
                <p className="text-xs font-semibold opacity-40 uppercase tracking-wider mb-2">{cat}</p>
                <div className="flex flex-wrap gap-2">
                  {PREBUILT_FIELDS.filter((f) => f.category === cat).map((pf) => {
                    const isActive = fields.some((f) => f.label === pf.label);
                    return (
                      <button
                        key={pf.label}
                        onClick={() => togglePrebuiltField(pf, isActive)}
                        className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                          isActive
                            ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                            : "hover:opacity-70"
                        }`}
                      >
                        {isActive ? "✓ " : ""}{pf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {addingCustomField ? (
              <div className="flex gap-2 mt-2 flex-wrap">
                <input
                  className="flex-1 min-w-32 border rounded px-2 py-1.5 bg-transparent text-sm"
                  placeholder="Field name"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
                <select className="border rounded px-2 py-1.5 bg-transparent text-sm" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Yes/No</option>
                </select>
                <button onClick={addCustomField} disabled={savingNewField || !newFieldLabel.trim()} className="border rounded px-2 py-1.5 text-sm disabled:opacity-50 hover:opacity-70">Add</button>
                <button onClick={() => setAddingCustomField(false)} className="border rounded px-2 py-1.5 text-sm hover:opacity-70">✕</button>
              </div>
            ) : (
              <button onClick={() => setAddingCustomField(true)} className="mt-2 text-xs border rounded px-3 py-1.5 hover:opacity-70">+ Custom Field</button>
            )}
          </div>
        )}

        {fields.length === 0 && !managingFields && (
          <p className="text-sm opacity-40">No custom fields yet. Click ✏ Manage to add fields for your business.</p>
        )}

        <div className="grid gap-3">
          {fields.map((f) => (
            <div key={f.id}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs opacity-50">{f.label} <span className="italic">({fieldTypeLabel(f.field_type)})</span></span>
                {managingFields && (
                  <button onClick={() => deleteField(f.id)} className="text-xs text-red-500 opacity-50 hover:opacity-100">Remove</button>
                )}
              </div>
              {editingFieldId === f.id ? (
                <div className="flex gap-2">
                  {f.field_type === "boolean" ? (
                    <select className="flex-1 border rounded px-2 py-1 bg-transparent text-sm" value={editingFieldValue} onChange={(e) => setEditingFieldValue(e.target.value)}>
                      <option value="">—</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      className="flex-1 border rounded px-2 py-1 bg-transparent text-sm"
                      type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                      value={editingFieldValue}
                      onChange={(e) => setEditingFieldValue(e.target.value)}
                    />
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

      <section className="border rounded-lg p-5">
        <h2 className="font-semibold mb-2">Transactions</h2>
        <p className="text-sm opacity-50">Invoice &amp; transaction linking coming soon.</p>
      </section>
    </main>
  );
}
