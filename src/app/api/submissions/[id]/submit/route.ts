import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gradeSubmission } from "@/lib/grading";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, reason } = (await request.json()) as {
    content?: string;
    reason?: "manual" | "timeout";
  };

  if (typeof content !== "string") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("submissions")
    .select("status, test_id, tests(task1_prompt, task2_prompt)")
    .eq("id", id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "in_progress") {
    return NextResponse.json({ ok: true, status: submission.status, alreadyFinished: true });
  }

  const { error: updateError } = await supabaseAdmin
    .from("submissions")
    .update({
      content,
      status: "completed",
      end_reason: reason ?? "manual",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Kick off AI grading automatically. We await it so the student sees a final
  // status, but failures here should never block the (already saved) submission.
  const test = submission.tests as unknown as { task1_prompt: string; task2_prompt: string } | null;
  const testPrompt = [test?.task1_prompt, test?.task2_prompt].filter(Boolean).join("\n\n");

  try {
    if (content.trim() && testPrompt.trim()) {
      const feedback = await gradeSubmission(content, testPrompt);
      await supabaseAdmin
        .from("submissions")
        .update({ feedback, band_score: feedback.band_score })
        .eq("id", id);
    }
  } catch (gradeError) {
    console.error("Auto-grading after submit failed:", gradeError);
    // The teacher can still re-trigger grading manually from the dashboard.
  }

  return NextResponse.json({ ok: true, status: "completed" });
}
