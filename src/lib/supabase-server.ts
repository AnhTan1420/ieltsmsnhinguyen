import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

// Use inside Route Handlers (not middleware) that require a signed-in teacher,
// e.g. /api/grade. Any route that uses getSupabaseAdmin() (service role, bypasses
// RLS) MUST call this first — RLS does not protect service-role writes.
export async function getAuthenticatedUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "development-placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route Handlers can't set cookies on an incoming request; sign-in/out
          // happens client-side, so this route only ever needs to read the session.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
