import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gradeSubmission } from "@/lib/grading";

// TĂNG GIỚI HẠN THỜI GIAN CHẠY TRÊN VERCEL LÊN 60 GIÂY
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // 1. Nhận các tham số từ frontend gửi lên
  const { submissionId, content, testPrompt, taskType, task1Prompt, task2Prompt } = await request.json();

  // 2. Kiểm tra các tham số bắt buộc
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

      // Chấm song song cả 2 task
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
        task1: fb1.task1 || {
          band: band1,
          TA: fb1.task1?.TA ?? fb1.TA,
          CC: fb1.task1?.CC ?? fb1.CC,
          LR: fb1.task1?.LR ?? fb1.LR,
          GRA: fb1.task1?.GRA ?? fb1.GRA,
        },
        task2: fb2.task2 || {
          band: band2,
          TR: fb2.task2?.TR ?? fb2.TR,
          CC: fb2.task2?.CC ?? fb2.CC,
          LR: fb2.task2?.LR ?? fb2.LR,
          GRA: fb2.task2?.GRA ?? fb2.GRA,
        },
        corrections: [
          ...(fb1.corrections || []),
          ...(fb2.corrections || [])
        ]
      };
    } else {
      if (!testPrompt) {
        return NextResponse.json({ error: "Missing testPrompt" }, { status: 400 });
      }
      feedback = await gradeSubmission(content, testPrompt, taskType);
    }

    // 3. Cập nhật kết quả chấm vào Supabase
    const { error } = await getSupabaseAdmin()
      .from("submissions")
      .update({ feedback, band_score: feedback.overall_band })
      .eq("id", submissionId);

    if (error) {
        console.error("❌ Supabase Error:", error);
        return NextResponse.json({ 
            error: "Lỗi lưu kết quả vào Database.", 
            detail: error.message 
        }, { status: 502 });
    }

    return NextResponse.json(feedback);

  } catch (error: any) {
    // 1. Log lỗi cực chi tiết lên Vercel Logs (Server-side)
    const technicalDetail = error instanceof Error ? error.message : String(error);
    console.error("❌ GRADING FAILED:", technicalDetail);
    
    // 2. Phân loại lỗi để phản hồi cho Frontend
    // Lỗi Quota/Rate Limit (429) -> 503
    // Lỗi khác -> 502
    const isAIOverload = /429|rate limit|quota|exceeded/i.test(technicalDetail);

    // 3. Trả về phản hồi cho trình duyệt
    return NextResponse.json(
      {
        error: isAIOverload 
          ? "Hệ thống AI đang quá tải hoặc hết lượt dùng. Vui lòng thử lại sau hoặc liên hệ Anh Tân."
          : "Đã xảy ra lỗi hệ thống nghiêm trọng.",
        detail: technicalDetail // DỮ LIỆU NÀY SẼ HIỆN Ở F12 CỦA BẠN
      },
      { status: isAIOverload ? 503 : 502 }
    );
  }
}
