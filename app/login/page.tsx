"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Mode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (!email) { setError("Email is required."); return; }
    if (mode !== "reset" && !password) { setError("Password is required."); return; }

    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      setLoading(false);
      if (error) setError(error.message);
      else setMessage("Check your email for a password reset link.");
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      else setMessage("Account created! Check your email to confirm, then sign in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/dashboard";
  };

  const titles: Record<Mode, string> = {
    signin: "Sign In",
    signup: "Create Account",
    reset: "Reset Password",
  };

  const buttons: Record<Mode, string> = {
    signin: "Sign In",
    signup: "Create Account",
    reset: "Send Reset Link",
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center font-bold text-2xl mb-8 tracking-tight">
          SoloBooks
        </Link>

        <div className="border rounded-lg p-6">
          <h1 className="text-xl font-semibold mb-5">{titles[mode]}</h1>

          <div className="grid gap-3">
            <div>
              <label className="text-sm opacity-60 block mb-1">Email</label>
              <input
                className="w-full border rounded px-3 py-2 bg-transparent"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoComplete="email"
              />
            </div>

            {mode !== "reset" && (
              <div>
                <label className="text-sm opacity-60 block mb-1">Password</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-transparent"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {message && <p className="text-green-600 text-sm">{message}</p>}

            <button
              className="bg-black text-white py-2.5 rounded font-medium disabled:opacity-50 mt-1"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Please wait…" : buttons[mode]}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-4 text-sm opacity-50">
          {mode !== "signin" && (
            <button onClick={() => switchMode("signin")} className="hover:opacity-100">
              Sign In
            </button>
          )}
          {mode !== "signup" && (
            <button onClick={() => switchMode("signup")} className="hover:opacity-100">
              Create Account
            </button>
          )}
          {mode !== "reset" && (
            <button onClick={() => switchMode("reset")} className="hover:opacity-100">
              Forgot Password?
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
