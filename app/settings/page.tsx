"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  const [newType, setNewType] = useState<"expense" | "income" | "both">(
    "expense"
  );
  const [saving, setSaving] = useState(false);

  const normalizedName = useMemo(
    () => newName.trim().replace(/\s+/g, " "),
    [newName]
  );

  const loadCategories = async (uid: string) => {
    setLoadingCats(true);
    setCatError(null);

    const { data, error } = await supabase
      .from("categories")
      .select("id, user_id, name, type, created_at")
      .eq("user_id", uid)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setCatError(error.message);
      setLoadingCats(false);
      return;
    }

    setCategories((data as CategoryRow[]) ?? []);
    setLoadingCats(false);
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      setEmail(u.user?.email ?? null);
      setUserId(uid);

      if (uid) {
        await loadCategories(uid);
      } else {
        setLoadingCats(false);
      }
    })();
  }, []);

  const addCategory = async () => {
    if (!userId) return;

    const name = normalizedName;
    if (!name) return;

    // Client-side duplicate check (case-insensitive) for same type
    const exists = categories.some(
      (c) =>
        c.type === newType && c.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setCatError("That category already exists for this type.");
      return;
    }

    setSaving(true);
    setCatError(null);

    const { error } = await supabase.from("categories").insert({
      user_id: userId,
      name,
      type: newType,
    });

    setSaving(false);

    if (error) {
      setCatError(error.message);
      return;
    }

    setNewName("");
    setNewType("expense");
    await loadCategories(userId);
  };

  const deleteCategory = async (id: string) => {
    const ok = window.confirm("Delete this category? This cannot be undone.");
    if (!ok) return;

    setCatError(null);

    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      setCatError(error.message);
      return;
    }

    if (userId) await loadCategories(userId);
  };

  const typeLabel = (t: string) => {
    if (t === "expense") return "Expense";
    if (t === "income") return "Income";
    if (t === "both") return "Both";
    return t;
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <a
          className="border rounded px-3 py-2 text-sm font-medium"
          href="/dashboard"
        >
          Back
        </a>
      </div>

      <div className="border rounded p-4 mt-5">
        <div className="text-sm opacity-80">Signed in as</div>
        <div className="font-medium mt-1">{email ?? "—"}</div>
      </div>

      {/* Categories */}
      <div className="border rounded p-4 mt-4">
        <div className="font-semibold">Categories</div>
        <p className="opacity-80 mt-1 text-sm">
          Add/remove categories used for manual transactions.
        </p>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category (e.g., Groceries)"
            className="border rounded px-3 py-2 sm:col-span-2"
          />

          <select
            value={newType}
            onChange={(e) =>
              setNewType(e.target.value as "expense" | "income" | "both")
            }
            className="border rounded px-3 py-2"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="both">Both</option>
          </select>
        </div>

        <button
          className="mt-2 w-full text-center border py-3 rounded font-medium disabled:opacity-50"
          disabled={saving || !normalizedName}
          onClick={addCategory}
        >
          {saving ? "Saving…" : "Add category"}
        </button>

        {catError && <p className="text-red-600 mt-3 text-sm">{catError}</p>}

        {loadingCats ? (
          <p className="opacity-80 mt-3">Loading categories…</p>
        ) : categories.length === 0 ? (
          <p className="opacity-80 mt-3">No categories yet.</p>
        ) : (
          <div className="grid gap-2 mt-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="border rounded px-3 py-2 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs opacity-70">{typeLabel(c.type)}</div>
                </div>

                <button
                  className="border rounded px-2 py-1 text-xs"
                  onClick={() => deleteCategory(c.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bank (placeholder for now) */}
      <div className="border rounded p-4 mt-4">
        <div className="font-semibold">Bank</div>
        <p className="opacity-80 mt-1 text-sm">
          Real-bank access is pending Plaid approval. For now, use manual entries
          and custom categories.
        </p>
      </div>

      {/* Account */}
      <div className="border rounded p-4 mt-4">
        <div className="font-semibold">Account</div>
        <button
          className="mt-3 w-full text-center border py-3 rounded font-medium"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>
    </main>
  );
}
