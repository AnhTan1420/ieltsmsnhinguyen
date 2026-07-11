import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Periodic autosave while the student is typing. This is what lets the teacher
// dashboard show the essay "live" before it's submitted.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content } = (await request.json()) as { content?: string };

  if (typeof content !== "string") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("submissions")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "in_progress") {
    // Test already finished — silently ignore late autosave pings.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { error } = await supabaseAdmin.from("submissions").update({ content }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
