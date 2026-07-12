import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MAX_WARNINGS = 5;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reason } = (await request.json()) as { reason?: string };

  if (!reason) {
    return NextResponse.json({ error: "Missing reason" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("submissions")
    .select("warning_count, status")
    .eq("id", id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "in_progress") {
    return NextResponse.json({
      warningCount: submission.warning_count,
      status: submission.status,
      maxWarnings: MAX_WARNINGS,
    });
  }

  const nextCount = submission.warning_count + 1;
  const disqualified = nextCount >= MAX_WARNINGS;

  // Try to insert warning record (non-blocking - don't fail if it fails)
  // Note: This is for audit only, failures are silently ignored
  try {
    await supabaseAdmin.from("warnings").insert({
      submission_id: id,
      reason,
      warning_number: nextCount,
    });
  } catch {
    // ignore insert failures
  }

  // Update submission with new warning count and status
  // This is the critical update - must succeed
  const { error: updateError } = await supabaseAdmin
    .from("submissions")
    .update({
      warning_count: nextCount,
      status: disqualified ? "disqualified" : "in_progress",
      end_reason: disqualified ? "disqualified" : null,
      submitted_at: disqualified ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (updateError) {
    console.error('Failed to update warning count:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Always return the updated count - frontend needs this to show correct warning count
  return NextResponse.json({
    warningCount: nextCount,
    status: disqualified ? "disqualified" : "in_progress",
    maxWarnings: MAX_WARNINGS,
  });
}
