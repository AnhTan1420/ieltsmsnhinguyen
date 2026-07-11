"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setEmail(null);
  };

  if (!email) {
    return (
      <Link href="/login" className="rounded-full border border-white/20 px-5 py-2 font-semibold hover:bg-white/10">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[220px] truncate text-sm text-slate-300 sm:inline">{email}</span>
      <button onClick={signOut} className="rounded-full border border-white/20 px-5 py-2 font-semibold hover:bg-white/10">
        Sign out
      </button>
    </div>
  );
}
