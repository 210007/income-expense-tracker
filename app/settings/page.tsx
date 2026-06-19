"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ConnectBankButton from "@/components/ConnectBankButton";

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense" | "both" | string;
  created_at: string;
};

type CustomerField = {
  id: string;
  user_id: string;
  label: string;
  field_type: string;
  created_at: string;
};

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"expense" | "income" | "both">("expense");
  const [saving, setSaving] = useState(false);

  const normalizedName = useMemo(() => newName.trim().replace(/\s+/g, " "), [newName]);

  // Customer custom fields
  const [customerFields, setCustomerFields] = useState<CustomerField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "date" | "boolean">("text");
  const [savingField, setSavingField] = useState(false);

  const loadCategories = async (uid: string) => {
    setLoadingCats(true);
    setCatError(null);

    const { data, error } = await supabase
      .from("categories")
      .select("id, user_id, name, type, created_at")
      .eq("user_id", uid)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) { setCatError(error.message); setLoadingCats(false); return; }
    setCategories((data as CategoryRow[]) ?? []);
    setLoadingCats(false);
  };

  const loadCustomerFields = async (uid: string) => {
    setLoadingFields(true);
    setFieldError(null);
    const { data, error } = await supabase
      .from("customer_fields")
      .select("id, user_id, label, field_type, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    if (error) { setFieldError(error.message); setLoadingFields(false); return; }
    setCustomerFields((data as CustomerField[]) ?? []);
    setLoadingFields(false);
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setEmail(u.user?.email ?? null);
      setUserId(uid);
      if (uid) {
        await loadCategories(uid);
        await loadCustomerFields(uid);
      } else {
        setLoadingCats(false);
        setLoadingFields(false);
      }
    })();
  }, []);

  const addCategory = async () => {
    if (!userId) return;
    const name = normalizedName;
    if (!name) return;

    const exists = categories.some(
      (c) => c.type === newType && c.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) { setCatError("That category already exists."); return; }

    setSaving(true);
    setCatError(null);

    const { error } = await supabase.from("categories").insert({ user_id: userId, name, type: newType });
    setSaving(false);

    if (error) { setCatError(error.message); return; }
    setNewName("");
    setNewType("expense");
    await loadCategories(userId);
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm("Delete this category? This cannot be undone.")) return;
    setCatError(null);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { setCatError(error.message); return; }
    if (userId) await loadCategories(userId);
  };

  const typeLabel = (t: string) =>
    t === "expense" ? "Expense" : t === "income" ? "Income" : t === "both" ? "Both" : t;

  const addCustomerField = async () => {
    if (!userId) return;
    const label = newFieldLabel.trim();
    if (!label) return;
    setSavingField(true);
    setFieldError(null);
    const { error } = await supabase.from("customer_fields").insert({
      user_id: userId,
      label,
      field_type: newFieldType,
    });
    setSavingField(false);
    if (error) { setFieldError(error.message); return; }
    setNewFieldLabel("");
    setNewFieldType("text");
    await loadCustomerFields(userId);
  };

  const deleteCustomerField = async (id: string) => {
    if (!window.confirm("Delete this custom field? All values for this field will also be deleted.")) return;
    setFieldError(null);
    const { error } = await supabase.from("customer_fields").delete().eq("id", id);
    if (error) { setFieldError(error.message); return; }
    if (userId) await loadCustomerFields(userId);
  };

  const fieldTypeLabel = (t: string) => {
    const map: Record<string, string> = { text: "Text", number: "Number", date: "Date", boolean: "Yes/No" };
    return map[t] ?? t;
  };

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      {/* Account */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
        <div className="font-semibold text-gray-900 dark:text-white mb-3">Account</div>
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Signed in as</div>
        <div className="font-medium text-gray-900 dark:text-white mb-4">{email ?? "—"}</div>
        <button
          className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>

      {/* Categories */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
        <div className="font-semibold text-gray-900 dark:text-white mb-1">Categories</div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Customize the categories used for your transactions.
        </p>

        <div className="flex gap-2 mb-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as "expense" | "income" | "both")}
            className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="both">Both</option>
          </select>
          <button
            className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={saving || !normalizedName}
            onClick={addCategory}
          >
            {saving ? "…" : "Add"}
          </button>
        </div>

        {catError && <p className="text-red-600 text-sm mb-3">{catError}</p>}

        {loadingCats ? (
          <div className="grid gap-2 mt-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-11" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No categories yet.</p>
        ) : (
          <div className="grid gap-2 mt-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl justify-between"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{typeLabel(c.type)}</span>
                </div>
                <button
                  className="px-5 py-2.5 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  onClick={() => deleteCategory(c.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Custom Fields */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
        <div className="font-semibold text-gray-900 dark:text-white mb-1">Customer Custom Fields</div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Add extra fields that appear on every customer record.
        </p>

        <div className="flex gap-2 mb-2">
          <input
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            placeholder="Field label (e.g. Birthday)"
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            onKeyDown={(e) => e.key === "Enter" && addCustomerField()}
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as "text" | "number" | "date" | "boolean")}
            className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Yes/No</option>
          </select>
          <button
            className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={savingField || !newFieldLabel.trim()}
            onClick={addCustomerField}
          >
            {savingField ? "…" : "Add"}
          </button>
        </div>

        {fieldError && <p className="text-red-600 text-sm mb-3">{fieldError}</p>}

        {loadingFields ? (
          <div className="grid gap-2 mt-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-2xl h-11" />
            ))}
          </div>
        ) : customerFields.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No custom fields yet.</p>
        ) : (
          <div className="grid gap-2 mt-3">
            {customerFields.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl justify-between"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{f.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{fieldTypeLabel(f.field_type)}</span>
                </div>
                <button
                  className="px-5 py-2.5 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  onClick={() => deleteCustomerField(f.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bank */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <div className="font-semibold text-gray-900 dark:text-white mb-1">Bank Connection</div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Connect a bank account to import transactions automatically.
        </p>
        <ConnectBankButton />
      </div>
    </main>
  );
}
