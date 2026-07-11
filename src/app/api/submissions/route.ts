import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Student opens a test link, types their name, and this creates the submission row.
// No auth required — anyone with the link can start a submission for that test.
export async function POST(request: Request) {
  const { testId, studentName } = (await request.json()) as {
    testId?: string;
    studentName?: string;
  };

  if (!testId || !studentName?.trim()) {
    return NextResponse.json({ error: "Missing testId or studentName" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: test, error: testError } = await supabaseAdmin
    .from("tests")
    .select("id, duration_minutes")
    .eq("id", testId)
    .single();

  if (testError || !test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  const { data: submission, error: insertError } = await supabaseAdmin
    .from("submissions")
    .insert({
      test_id: testId,
      student_name: studentName.trim(),
      status: "in_progress",
      warning_count: 0,
    })
    .select("id, started_at")
    .single();

  if (insertError || !submission) {
    return NextResponse.json({ error: insertError?.message ?? "Could not start test" }, { status: 500 });
  }

  return NextResponse.json({
    submissionId: submission.id,
    startedAt: submission.started_at,
    durationMinutes: test.duration_minutes,
  });
}
