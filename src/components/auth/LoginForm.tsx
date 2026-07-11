"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuthMode = "sign-in" | "sign-up";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsLoading(true);

    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
              },
              emailRedirectTo: `${window.location.origin}${next}`,
            },
          });

    setIsLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setMessage("Account created. Check your email to confirm your account, then sign in.");
      setMode("sign-in");
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">IELTS Writing</p>
        <h1 className="mt-3 text-3xl font-bold">{mode === "sign-in" ? "Sign in" : "Create account"}</h1>
        <p className="mt-2 text-slate-300">
          This login is only for teachers, to manage tests and grade submissions. Students don&apos;t need an account
          — they just open the test link you share with them.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "sign-up" && (
            <>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Full name</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-slate-950 outline-none focus:ring-4 focus:ring-cyan-300/30"
                  required
                />
              </label>
              <div className="rounded-xl bg-cyan-400/10 p-3 text-sm text-cyan-100">
                Any account created here can create tests and view all submissions in the Teacher Dashboard.
              </div>
            </>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-slate-950 outline-none focus:ring-4 focus:ring-cyan-300/30"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-slate-950 outline-none focus:ring-4 focus:ring-cyan-300/30"
              minLength={6}
              required
            />
          </label>

          {message && <div className="rounded-xl bg-amber-400/15 p-3 text-sm text-amber-100">{message}</div>}

          <button
            disabled={isLoading}
            className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setMessage(null);
          }}
          className="mt-5 w-full text-sm font-semibold text-cyan-200 hover:text-cyan-100"
        >
          {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
