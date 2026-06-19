"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import InfoTip from "@/components/InfoTip";

type Product = {
  id: string;
  name: string;
  type: "product" | "service";
  description: string | null;
  unit_price: number;
  cost_price: number | null;
  sku: string | null;
  unit: string | null;
  category: string | null;
  is_active: boolean;
  stock_quantity: number | null;
};

const UNITS_SERVICE = ["per hour", "per visit", "per month", "per day", "flat rate", "per sq ft", "per mile"];
const UNITS_PRODUCT = ["each", "per box", "per case", "per lb", "per oz", "per gallon"];

const TYPE_COLORS = {
  product: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  service: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
};

const emptyForm = {
  name: "", type: "service" as "product" | "service", description: "",
  unit_price: "", cost_price: "", sku: "", unit: "per visit", category: "", is_active: true,
};

type FormValues = typeof emptyForm;

function FormPanel({
  title, form, setField, save, cancel, saving, editing, error,
}: {
  title: string;
  form: FormValues;
  setField: (k: keyof FormValues, v: string | boolean) => void;
  save: () => void;
  cancel: () => void;
  saving: boolean;
  editing: string | null;
  error: string | null;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-6 bg-gray-50 dark:bg-gray-900/50">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-5">{title}</h3>

      {/* Type toggle */}
      <div className="mb-5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
          Type
          <InfoTip text="A Service is something you do (e.g. Monthly Spray). A Product is a physical item you sell (e.g. Pest Control Kit)." />
        </label>
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {(["service", "product"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setField("type", t);
                setField("unit", t === "service" ? "per visit" : "each");
              }}
              className={`px-5 py-2 text-sm font-medium capitalize transition-colors ${
                form.type === t
                  ? "brand-gradient text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Name *</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder={form.type === "service" ? "e.g. Monthly Treatment" : "e.g. Pest Control Spray"}
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
            Price *
            <InfoTip text="This is the price you charge your customer." />
          </label>
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
            <span className="px-3 text-gray-400 text-sm">$</span>
            <input
              type="number" step="0.01" min="0"
              className="flex-1 py-2.5 pr-4 bg-transparent text-sm focus:outline-none"
              placeholder="0.00"
              value={form.unit_price}
              onChange={(e) => setField("unit_price", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Unit</label>
          <select
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
            value={form.unit}
            onChange={(e) => setField("unit", e.target.value)}
          >
            {(form.type === "service" ? UNITS_SERVICE : UNITS_PRODUCT).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {form.type === "product" && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
              Cost Price
              <InfoTip text="What you pay for this item. Used to calculate profit margin." />
            </label>
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
              <span className="px-3 text-gray-400 text-sm">$</span>
              <input
                type="number" step="0.01" min="0"
                className="flex-1 py-2.5 pr-4 bg-transparent text-sm focus:outline-none"
                placeholder="0.00"
                value={form.cost_price}
                onChange={(e) => setField("cost_price", e.target.value)}
              />
            </div>
          </div>
        )}

        {form.type === "product" && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
              SKU
              <InfoTip text="Stock Keeping Unit — a unique code to identify this product." />
            </label>
            <input
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
              placeholder="e.g. PCK-001"
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Category</label>
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
            placeholder="e.g. Treatments, Cleaning, Labor"
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
          <textarea
            rows={2}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm resize-none focus:outline-none"
            placeholder="Brief description shown on invoices and estimates"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

      <div className="flex gap-3 mt-5">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving…" : editing ? "Save Changes" : "Add to Catalog"}
        </button>
        <button onClick={cancel} className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | "product" | "service">("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { router.push("/login"); return; }
    const { data } = await supabase
      .from("products")
      .select("id, name, type, description, unit_price, cost_price, sku, unit, category, is_active, stock_quantity")
      .eq("user_id", sessionData.session.user.id)
      .order("name");
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setField = (k: keyof typeof emptyForm, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const startEdit = (p: Product) => {
    setForm({
      name: p.name, type: p.type, description: p.description ?? "",
      unit_price: String(p.unit_price), cost_price: p.cost_price ? String(p.cost_price) : "",
      sku: p.sku ?? "", unit: p.unit ?? (p.type === "service" ? "per visit" : "each"),
      category: p.category ?? "", is_active: p.is_active,
    });
    setEditing(p.id);
    setAdding(false);
  };

  const startAdd = () => {
    setForm(emptyForm);
    setAdding(true);
    setEditing(null);
  };

  const cancel = () => { setAdding(false); setEditing(null); setError(null); };

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.unit_price) { setError("Price is required."); return; }
    setSaving(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;

    const payload = {
      user_id: sessionData.session.user.id,
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim() || null,
      unit_price: parseFloat(form.unit_price),
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      sku: form.sku.trim() || null,
      unit: form.unit || null,
      category: form.category.trim() || null,
      is_active: form.is_active,
    };

    if (editing) {
      await supabase.from("products").update(payload).eq("id", editing);
    } else {
      await supabase.from("products").insert(payload);
    }

    setSaving(false);
    cancel();
    await load();
  };

  const toggleActive = async (p: Product) => {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm("Delete this item?")) return;
    await supabase.from("products").delete().eq("id", id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const filtered = products.filter((p) => {
    if (filter !== "all" && p.type !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.category ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products & Services</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your catalog of items used in invoices, estimates, and purchase orders.
            <InfoTip text="Items added here can be quickly selected when creating invoices or estimates, saving you time and keeping pricing consistent." />
          </p>
        </div>
        {!adding && !editing && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        )}
      </div>

      {/* Inline add form */}
      {adding && <FormPanel title="New Item" form={form} setField={setField} save={save} cancel={cancel} saving={saving} editing={editing} error={error} />}

      {/* Filters */}
      {!adding && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["all", "service", "product"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? "brand-gradient text-white"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {f === "all" ? "All" : f === "service" ? "Services" : "Products"}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-48 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Search by name or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Product grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map((i) => (
            <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mb-5" />
              <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <div className="text-4xl mb-3">📦</div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No items yet</h3>
          <p className="text-sm text-gray-400 mb-5">Add your products and services to speed up invoicing.</p>
          <button onClick={startAdd} className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90">
            Add First Item
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            if (editing === p.id) return <div key={p.id} className="sm:col-span-2 lg:col-span-3"><FormPanel title="Edit Item" form={form} setField={setField} save={save} cancel={cancel} saving={saving} editing={editing} error={error} /></div>;
            return (
              <div
                key={p.id}
                className={`group border rounded-2xl p-5 flex flex-col gap-3 transition-all hover:shadow-md ${
                  p.is_active
                    ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${TYPE_COLORS[p.type ?? "product"]}`}>
                      {p.type ?? "product"}
                    </span>
                    {p.category && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{p.category}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors" title="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteProduct(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white leading-snug">{p.name}</h3>
                  {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.description}</p>}
                </div>

                <div className="mt-auto flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">${p.unit_price.toFixed(2)}</p>
                    {p.unit && <p className="text-xs text-gray-400">{p.unit}</p>}
                  </div>
                  <div className="text-right">
                    {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                    {p.cost_price && (
                      <p className="text-xs text-gray-400">
                        Margin: {Math.round(((p.unit_price - p.cost_price) / p.unit_price) * 100)}%
                      </p>
                    )}
                    <button
                      onClick={() => toggleActive(p)}
                      className={`text-xs mt-1 px-2 py-0.5 rounded-full border transition-colors ${
                        p.is_active
                          ? "border-green-200 text-green-600 dark:border-green-800 dark:text-green-400"
                          : "border-gray-200 text-gray-400"
                      }`}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
