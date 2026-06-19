"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type Customer = {
  id: string; user_id: string; name: string; email: string | null; phone: string | null;
  address_street: string | null; address_city: string | null; address_state: string | null;
  address_zip: string | null; notes: string | null; created_at: string;
};
type CustomerField = { id: string; user_id: string; label: string; field_type: string; created_at: string };
type CustomerFieldValue = { id: string; customer_id: string; field_id: string; value: string | null };
type ServicePrice = { id: string; service_name: string; price: number };
type Invoice = {
  id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "void";
  issue_date: string;
  due_date: string | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  sent: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  void: "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

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

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [hasInvoicing, setHasInvoicing] = useState(false);

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

    const invoicingActive = await hasModule("invoicing");
    setHasInvoicing(invoicingActive);

    const [{ data: fieldsData }, { data: pricesData }, { data: invData }] = await Promise.all([
      supabase.from("customer_fields").select("id, user_id, label, field_type, created_at").eq("user_id", uid).order("created_at", { ascending: true }),
      supabase.from("customer_service_prices").select("id, service_name, price").eq("customer_id", id).order("created_at", { ascending: true }),
      invoicingActive
        ? supabase.from("invoices").select("id, invoice_number, status, issue_date, due_date, invoice_items(quantity, unit_price)").eq("customer_id", id).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const loadedFields = (fieldsData as CustomerField[]) ?? [];
    setFields(loadedFields);
    setServicePrices((pricesData as ServicePrice[]) ?? []);
    setInvoices((invData as unknown as Invoice[]) ?? []);

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

  if (loading) return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-8 w-48" />
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-48" />
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-32" />
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-32" />
      </div>
    </main>
  );

  if (error || !customer) return (
    <main className="p-6 max-w-4xl mx-auto">
      <a href="/customers" className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-4 inline-flex">←</a>
      <p className="text-red-600">{error ?? "Customer not found."}</p>
    </main>
  );

  const mapsAddress = fullAddress(customer);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <a
        href="/customers"
        className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-4 inline-flex"
      >
        ←
      </a>

      {/* Customer info */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
          {!editing && (
            <div className="flex gap-2">
              <button
                onClick={startEdit}
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={deleteCustomer}
                disabled={deleting}
                className="px-5 py-2.5 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Name *</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Phone</label>
                <input
                  type="tel"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Street Address</label>
              <AddressAutocomplete
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">City</label>
                <input
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Springfield"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">State</label>
                <input
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="IL"
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Zip Code</label>
                <input
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="62701"
                  value={editZip}
                  onChange={(e) => setEditZip(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Notes</label>
              <textarea
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            {saveError && <p className="text-red-600 text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button
                onClick={saveCustomer}
                disabled={saving}
                className="flex-1 px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Email</div>
                <div className="text-gray-900 dark:text-white">{customer.email || <span className="text-gray-400 dark:text-gray-500">—</span>}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Phone</div>
                <div className="text-gray-900 dark:text-white">{customer.phone || <span className="text-gray-400 dark:text-gray-500">—</span>}</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Address</div>
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
              ) : <span className="text-gray-400 dark:text-gray-500">—</span>}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Notes</div>
              <div className="whitespace-pre-wrap text-gray-900 dark:text-white">{customer.notes || <span className="text-gray-400 dark:text-gray-500">—</span>}</div>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">Added {fmtDate(customer.created_at)}</div>
          </div>
        )}
      </section>

      {/* Service Prices */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Service Prices</h2>
          {!addingPrice && (
            <button
              onClick={() => setAddingPrice(true)}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              + Add
            </button>
          )}
        </div>

        {servicePrices.length === 0 && !addingPrice && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No service prices yet. Add named prices for this customer (e.g. Monthly Spray, Quarterly Treatment).</p>
        )}

        <div className="grid gap-2">
          {servicePrices.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 text-sm px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
            >
              {editingPriceId === p.id ? (
                <>
                  <input
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 bg-transparent text-sm focus:outline-none"
                    value={editPriceName}
                    onChange={(e) => setEditPriceName(e.target.value)}
                  />
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    className="w-24 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 bg-transparent text-sm focus:outline-none"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPriceAmount}
                    onChange={(e) => setEditPriceAmount(e.target.value)}
                  />
                  <button
                    onClick={saveEditPrice}
                    disabled={savingPrice}
                    className="px-3 py-1.5 brand-gradient text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingPriceId(null)}
                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-gray-900 dark:text-white">{p.service_name}</span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">${p.price.toFixed(2)}</span>
                  <button
                    onClick={() => { setEditingPriceId(p.id); setEditPriceName(p.service_name); setEditPriceAmount(String(p.price)); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Edit"
                  >
                    ✏
                  </button>
                  <button
                    onClick={() => deleteServicePrice(p.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {addingPrice && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-40 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Service name (e.g. Monthly Spray)"
              value={newPriceName}
              onChange={(e) => setNewPriceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addServicePrice()}
            />
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400 text-sm">$</span>
              <input
                className="w-24 py-2.5 pr-3 bg-transparent text-sm outline-none"
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
              className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Add
            </button>
            <button
              onClick={() => { setAddingPrice(false); setNewPriceName(""); setNewPriceAmount(""); }}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Custom Fields */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Custom Fields</h2>
            {managingFields && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">These fields appear on all customer records</p>}
          </div>
          <button
            onClick={() => { setManagingFields((v) => !v); setAddingCustomField(false); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              managingFields
                ? "brand-gradient text-white hover:opacity-90"
                : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {managingFields ? "Done" : "Manage"}
          </button>
        </div>

        {managingFields && (
          <div className="mb-5 pb-5 border-b border-gray-100 dark:border-gray-800">
            {FIELD_CATEGORIES.map((cat) => (
              <div key={cat} className="mb-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                <div className="flex flex-wrap gap-2">
                  {PREBUILT_FIELDS.filter((f) => f.category === cat).map((pf) => {
                    const isActive = fields.some((f) => f.label === pf.label);
                    return (
                      <button
                        key={pf.label}
                        onClick={() => togglePrebuiltField(pf, isActive)}
                        className={`text-xs rounded-full px-3 py-1.5 border transition-colors font-medium ${
                          isActive
                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
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
                  className="flex-1 min-w-32 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Field name"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
                <select
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 text-sm focus:outline-none"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Yes/No</option>
                </select>
                <button
                  onClick={addCustomField}
                  disabled={savingNewField || !newFieldLabel.trim()}
                  className="px-4 py-2 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => setAddingCustomField(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingCustomField(true)}
                className="mt-2 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                + Custom Field
              </button>
            )}
          </div>
        )}

        {fields.length === 0 && !managingFields && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No custom fields yet. Click Manage to add fields for your business.</p>
        )}

        <div className="grid gap-3">
          {fields.map((f) => (
            <div key={f.id}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {f.label} <span className="normal-case font-normal italic">({fieldTypeLabel(f.field_type)})</span>
                </span>
                {managingFields && (
                  <button
                    onClick={() => deleteField(f.id)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              {editingFieldId === f.id ? (
                <div className="flex gap-2">
                  {f.field_type === "boolean" ? (
                    <select
                      className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
                      value={editingFieldValue}
                      onChange={(e) => setEditingFieldValue(e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                      value={editingFieldValue}
                      onChange={(e) => setEditingFieldValue(e.target.value)}
                    />
                  )}
                  <button
                    onClick={() => saveFieldValue(f.id)}
                    disabled={savingField}
                    className="px-4 py-1.5 brand-gradient text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {savingField ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingFieldId(null)}
                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-900 dark:text-white">
                    {fieldValues[f.id]
                      ? f.field_type === "boolean" ? (fieldValues[f.id] === "true" ? "Yes" : "No") : fieldValues[f.id]
                      : <span className="text-gray-400 dark:text-gray-500">—</span>}
                  </span>
                  <button
                    onClick={() => { setEditingFieldId(f.id); setEditingFieldValue(fieldValues[f.id] ?? ""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {hasInvoicing && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Invoices</h2>
            <Link
              href="/invoices/new"
              className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + New Invoice
            </Link>
          </div>

          {invoices.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No invoices yet for this customer.</p>
          ) : (
            <div className="space-y-1.5">
              {invoices.map((inv) => {
                const total = inv.invoice_items.reduce(
                  (sum, item) => sum + item.quantity * item.unit_price,
                  0
                );
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all text-sm"
                  >
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">
                      {inv.invoice_number}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[inv.status]}`}>
                      {inv.status}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 flex-1">
                      {new Date(inv.issue_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {inv.due_date && (
                        <span className="ml-2 text-xs opacity-60">
                          due {new Date(inv.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white tabular-nums shrink-0">
                      {money(total)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
