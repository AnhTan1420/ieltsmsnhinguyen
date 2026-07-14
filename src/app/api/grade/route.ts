import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
// Ví dụ sửa trong file route.ts xử lý API chấm điểm
import { gradeSubmission } from '@/lib/grading';

export async function POST(req: Request) {
  const body = await req.json();
  const { content, testPrompt, taskType } = body; 
  // taskType phải được gửi từ Client lên, hoặc lấy từ Database (ví dụ: 'task1' hoặc 'task2')

  // Truyền tường minh taskType vào hàm
  const feedback = await gradeSubmission(content, testPrompt, taskType || "task2");
  
  return Response.json({ feedback });
}

export async function POST(request: Request) {
  const { submissionId, content, testPrompt } = await request.json();

  if (!submissionId || !content || !testPrompt) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const feedback = await gradeSubmission(content, testPrompt);

    const { error } = await getSupabaseAdmin()
      .from("submissions")
      .update({ feedback, band_score: feedback.overall_band })
      .eq("id", submissionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error("Grading failed:", error);
    return NextResponse.json({ error: "All AI providers failed" }, { status: 502 });
  }
}
