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

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setEmail(u.user?.email ?? null);
      setUserId(uid);
      if (uid) await loadCategories(uid);
      else setLoadingCats(false);
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

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      {/* Account */}
      <div className="border rounded-lg p-5 mb-4">
        <div className="font-semibold mb-3">Account</div>
        <div className="text-sm opacity-60 mb-1">Signed in as</div>
        <div className="font-medium mb-4">{email ?? "—"}</div>
        <button
          className="border rounded py-2 px-4 text-sm font-medium"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>

      {/* Categories */}
      <div className="border rounded-lg p-5 mb-4">
        <div className="font-semibold mb-1">Categories</div>
        <p className="text-sm opacity-50 mb-4">
          Customize the categories used for your transactions.
        </p>

        <div className="flex gap-2 mb-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="flex-1 border rounded px-3 py-2 bg-transparent"
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as "expense" | "income" | "both")}
            className="border rounded px-3 py-2 bg-transparent"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="both">Both</option>
          </select>
          <button
            className="border rounded px-4 py-2 font-medium disabled:opacity-50"
            disabled={saving || !normalizedName}
            onClick={addCategory}
          >
            {saving ? "…" : "Add"}
          </button>
        </div>

        {catError && <p className="text-red-600 text-sm mb-3">{catError}</p>}

        {loadingCats ? (
          <p className="opacity-50 text-sm">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="opacity-50 text-sm">No categories yet.</p>
        ) : (
          <div className="grid gap-2 mt-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="border rounded-lg px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs opacity-50 ml-2">{typeLabel(c.type)}</span>
                </div>
                <button
                  className="text-xs opacity-50 hover:opacity-100 hover:text-red-600"
                  onClick={() => deleteCategory(c.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bank */}
      <div className="border rounded-lg p-5">
        <div className="font-semibold mb-1">Bank Connection</div>
        <p className="text-sm opacity-50 mb-2">
          Connect a bank account to import transactions automatically.
        </p>
        <ConnectBankButton />
      </div>
    </main>
  );
}
