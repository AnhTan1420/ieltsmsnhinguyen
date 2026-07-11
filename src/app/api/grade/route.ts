import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gradeSubmission } from "@/lib/grading";

export async function POST(request: Request) {
  const { submissionId, content, testPrompt } = await request.json();

  if (!submissionId || !content || !testPrompt) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const feedback = await gradeSubmission(content, testPrompt);

    const { error } = await getSupabaseAdmin()
      .from("submissions")
      .update({ feedback, band_score: feedback.band_score })
      .eq("id", submissionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error("Grading failed:", error);
    return NextResponse.json({ error: "All AI providers failed" }, { status: 502 });
  }
}
