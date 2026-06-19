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

const ROLE_CHIP: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  member: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  viewer: "bg-gray-100 text-gray-500 dark:bg-gray-800",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const initials = (email: string) => email.slice(0, 2).toUpperCase();

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
    const { error: err } = await supabase.from("team_members").insert({
      owner_user_id: userId,
      member_email: email.trim().toLowerCase(),
      role,
      status: "pending",
    });
    setInviting(false);
    if (err) {
      setError(err.code === "23505" ? "This person has already been invited." : err.message);
      return;
    }
    const sent = email.trim();
    setEmail("");
    setSuccess(`Invite recorded for ${sent}. Once they sign up with that email their access will activate.`);
    await load();
  };

  const updateRole = async (id: string, newRole: "admin" | "member" | "viewer") => {
    await supabase.from("team_members").update({ role: newRole }).eq("id", id);
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role: newRole } : m));
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this team member?")) return;
    await supabase.from("team_members").update({ status: "removed" }).eq("id", id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-9 bg-gray-200 dark:bg-gray-800 rounded-xl w-32" />
          <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (gated) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Team</h1>
        <p className="text-sm text-gray-500 mb-6">Invite teammates to view or edit your SoloBooks data.</p>
        <Link href="/plan" className="px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Add Team Access — $15/mo
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Invite form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Invite a Team Member</h2>

        <div className="grid sm:grid-cols-[1fr_auto] gap-3">
          <input
            type="email"
            className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
          />
          <select
            className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <p className="text-xs text-gray-400">{ROLE_DESC[role]}</p>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>}

        <button
          onClick={invite}
          disabled={inviting}
          className="px-6 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {inviting ? "Sending…" : "Send Invite"}
        </button>
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          {members.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}
            >
              <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials(m.member_email)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{m.member_email}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_CHIP[m.role]}`}>
                    {m.role}
                  </span>
                  <span className={`text-xs font-medium ${
                    m.status === "active" ? "text-green-600 dark:text-green-400" : "text-gray-400"
                  }`}>
                    {m.status === "active" ? "Active" : "Pending"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Invited {fmtDate(m.invited_at)}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-xs focus:outline-none"
                  value={m.role}
                  onChange={(e) => updateRole(m.id, e.target.value as typeof m.role)}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() => remove(m.id)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No team members yet. Invite someone above.</p>
      )}

      {/* How it works */}
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm text-gray-500 dark:text-gray-400">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">How team access works</p>
        <p>Invite teammates by email. Once they sign up for SoloBooks with the same email address, their access activates automatically. Admins and Members can view and edit your data; Viewers have read-only access.</p>
      </div>
    </main>
  );
}
