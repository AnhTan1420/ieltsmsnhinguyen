import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gradeSubmission } from "@/lib/grading";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function POST(request: Request) {
  const { submissionId, content, testPrompt } = await request.json();

  if (!submissionId || !content || !testPrompt) {
    return jsonResponse({ error: "Missing fields" }, 400);
  }

  try {
    const feedback = await gradeSubmission(content, testPrompt);

    const { error } = await getSupabaseAdmin()
      .from("submissions")
      .update({ feedback, band_score: feedback.band_score })
      .eq("id", submissionId);

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse(feedback);
  } catch (error) {
    console.error("Grading failed:", error);
    return jsonResponse({ error: "All AI providers failed" }, 502);
  }
}
