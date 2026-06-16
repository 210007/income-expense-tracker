"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { hasModule } from "@/lib/modules";
import Link from "next/link";

type Member = {
  id: string;
  member_email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "active" | "removed";
  invited_at: string;
  accepted_at: string | null;
};

const ROLE_DESC: Record<string, string> = {
  admin: "Full access — can edit everything",
  member: "Can view and edit most data",
  viewer: "Read-only access",
};

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { window.location.href = "/login"; return; }

    const active = await hasModule("team");
    if (!active) { setGated(true); setLoading(false); return; }

    setUserId(sessionData.session.user.id);

    const { data } = await supabase
      .from("team_members")
      .select("id, member_email, role, status, invited_at, accepted_at")
      .eq("owner_user_id", sessionData.session.user.id)
      .neq("status", "removed")
      .order("invited_at", { ascending: false });

    setMembers((data as Member[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const invite = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email address."); return; }
    if (!userId) return;

    setInviting(true);
    const { error } = await supabase.from("team_members").insert({
      owner_user_id: userId,
      member_email: email.trim().toLowerCase(),
      role,
      status: "pending",
    });
    setInviting(false);

    if (error) {
      if (error.code === "23505") { setError("This person has already been invited."); }
      else { setError(error.message); }
      return;
    }

    setEmail("");
    setSuccess(`Invite sent to ${email.trim()}. They'll need to sign up and you can then activate them below.`);
    await load();
  };

  const updateRole = async (id: string, newRole: "admin" | "member" | "viewer") => {
    await supabase.from("team_members").update({ role: newRole }).eq("id", id);
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role: newRole } : m));
  };

  const remove = async (id: string) => {
    await supabase.from("team_members").update({ status: "removed" }).eq("id", id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (loading) return <main className="p-6 max-w-4xl mx-auto"><p className="opacity-50">Loading…</p></main>;

  if (gated) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Team Access</h1>
        <p className="opacity-60 mb-6 text-sm">This module isn&apos;t active on your plan.</p>
        <Link href="/plan" className="inline-block bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded font-medium text-sm hover:opacity-80">
          Add Team Access — $15 / mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm opacity-50 mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Invite form */}
      <section className="border rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-4">Invite a Team Member</h2>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input
              type="email"
              className="border rounded px-3 py-2 bg-transparent text-sm"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select className="border rounded px-3 py-2 bg-transparent text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <p className="text-xs opacity-50">{ROLE_DESC[role]}</p>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>}
          <button onClick={invite} disabled={inviting} className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded font-medium disabled:opacity-40 hover:opacity-80 text-sm">
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </section>

      {/* Member list */}
      {members.length > 0 && (
        <section className="border rounded-xl overflow-hidden">
          {members.map((m, i) => (
            <div key={m.id} className={`p-4 flex items-center justify-between gap-4 ${i > 0 ? "border-t" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium text-sm">{m.member_email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs ${m.status === "active" ? "text-green-600 dark:text-green-400" : "opacity-40"}`}>
                    {m.status === "active" ? "Active" : "Pending"}
                  </span>
                  <span className="opacity-30 text-xs">·</span>
                  <span className="text-xs opacity-40">Invited {fmtDate(m.invited_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="border rounded px-2 py-1 bg-transparent text-sm"
                  value={m.role}
                  onChange={(e) => updateRole(m.id, e.target.value as typeof m.role)}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button onClick={() => remove(m.id)} className="text-sm opacity-40 hover:opacity-70 hover:text-red-500">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {members.length === 0 && (
        <p className="opacity-50 text-sm">No team members yet. Invite someone above.</p>
      )}

      <div className="mt-6 border rounded-xl p-4 text-sm opacity-60">
        <p className="font-medium mb-1">How team access works</p>
        <p>Invite team members by email. Once they sign up for SoloBooks with the same email, their access becomes active. Admins and Members can view and edit your data. Viewers have read-only access.</p>
      </div>
    </main>
  );
}
