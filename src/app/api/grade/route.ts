import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gradeSubmission } from "@/lib/grading";

// Cấu hình tăng thời gian xử lý cho Vercel
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { submissionId, content, testPrompt, taskType, task1Prompt, task2Prompt } = await request.json();

  if (!submissionId || !content || !taskType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (taskType !== "task1" && taskType !== "task2" && taskType !== "both") {
    return NextResponse.json({ error: "Invalid taskType" }, { status: 400 });
  }

  try {
    let feedback: any;

    if (taskType === "both") {
      if (!task1Prompt || !task2Prompt) {
        return NextResponse.json({ error: "Missing task prompts for both tasks" }, { status: 400 });
      }

      const [feedback1, feedback2] = await Promise.all([
        gradeSubmission(content, task1Prompt, "task1"),
        gradeSubmission(content, task2Prompt, "task2")
      ]);

      const fb1 = feedback1 as any;
      const fb2 = feedback2 as any;

      const band1 = Number(fb1.task1?.band || fb1.overall_band || fb1.band || 0);
      const band2 = Number(fb2.task2?.band || fb2.overall_band || fb2.band || 0);

      const avgBand = (band1 + band2) / 2;
      const overallBand = Math.round(avgBand * 2) / 2;

      feedback = {
        overall_band: overallBand,
        examiner_summary: `### Task 1 Evaluation:\n${fb1.examiner_summary || "Không có nhận xét."}\n\n### Task 2 Evaluation:\n${fb2.examiner_summary || "Không có nhận xét."}`,
        task1: fb1.task1 || { band: band1, TA: fb1.TA, CC: fb1.CC, LR: fb1.LR, GRA: fb1.GRA },
        task2: fb2.task2 || { band: band2, TR: fb2.TR, CC: fb2.CC, LR: fb2.LR, GRA: fb2.GRA },
        corrections: [ ...(fb1.corrections || []), ...(fb2.corrections || []) ]
      };
    } else {
      if (!testPrompt) {
        return NextResponse.json({ error: "Missing testPrompt" }, { status: 400 });
      }
      feedback = await gradeSubmission(content, testPrompt, taskType);
    }

    const { error } = await getSupabaseAdmin()
      .from("submissions")
      .update({ feedback, band_score: feedback.overall_band })
      .eq("id", submissionId);

    if (error) {
      console.error("❌ Supabase update failed:", error);
      return NextResponse.json({ error: "Lỗi lưu dữ liệu.", detail: error.message }, { status: 502 });
    }

    return NextResponse.json(feedback);

  } catch (error: any) {
    // Log chi tiết vào Vercel
    console.error("❌ GRADING FAILED:", error);
    
    const technicalDetail = error instanceof Error ? error.message : String(error);
    
    // PHÂN LOẠI LỖI:
    // Nếu là lỗi Quota/Rate Limit (429) -> Trả về 503
    if (technicalDetail.includes("429") || technicalDetail.includes("Quota") || technicalDetail.includes("Rate limit")) {
      return NextResponse.json({ 
        error: "Hệ thống AI đang quá tải. Vui lòng thử lại sau.",
        detail: technicalDetail 
      }, { status: 503 });
    }

    // Nếu là lỗi code/hệ thống khác -> Trả về 502
    return NextResponse.json({ 
        error: "Đã xảy ra lỗi hệ thống nghiêm trọng.",
        detail: technicalDetail 
    }, { status: 502 });
  }
}
