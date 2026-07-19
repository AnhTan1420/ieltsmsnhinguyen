import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gradeSubmission } from "@/lib/grading";
import { requireAuth } from "@/lib/auth-server";

// TĂNG GIỚI HẠN THỜI GIAN CHẠY TRÊN VERCEL LÊN 60 GIÂY
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // 0. BẢO MẬT: route này dùng service-role key (bỏ qua RLS) và gọi AI trả phí
  // (Groq/Gemini) — bắt buộc phải là giáo viên đã đăng nhập mới được gọi.
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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

      // Chấm song song cả 2 task — vẫn là 2 LẦN GỌI AI HOÀN TOÀN ĐỘC LẬP
      // (mỗi lần chỉ thấy đúng 1 task), đúng ngữ cảnh "giám khảo chuyên biệt".
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
        // Field cũ: KHÔNG còn tự chèn header "### Task N Evaluation:" nữa —
        // chỉ nối 2 đoạn nhận xét cách nhau 1 dòng trống, thuần làm fallback
        // cho bất kỳ chỗ nào còn đọc trực tiếp examiner_summary (không nên
        // dùng field này để hiển thị chính, xem task1_summary/task2_summary).
        examiner_summary: `${fb1.examiner_summary || "Không có nhận xét."}\n\n${fb2.examiner_summary || "Không có nhận xét."}`.trim(),
        // Nhận xét TÁCH RIÊNG từng task — đây là field UI nên dùng để hiển thị.
        task1_summary: fb1.examiner_summary || "Không có nhận xét.",
        task2_summary: fb2.examiner_summary || "Không có nhận xét.",
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
        // Gắn nhãn "task" vào từng lỗi ngay khi merge — UI không còn phải
        // đoán lỗi thuộc task nào bằng cách so khớp text nữa.
        corrections: [
          ...(fb1.corrections || []).map((c: any) => ({ ...c, task: "task1" as const })),
          ...(fb2.corrections || []).map((c: any) => ({ ...c, task: "task2" as const })),
        ],
      };
    } else {
      if (!testPrompt) {
        return NextResponse.json({ error: "Missing testPrompt" }, { status: 400 });
      }
      const raw = (await gradeSubmission(content, testPrompt, taskType)) as any;

      // Chấm 1 task riêng lẻ: vẫn gắn "task" vào corrections và điền
      // task1_summary/task2_summary tương ứng, để UI dùng chung 1 logic đọc
      // dữ liệu cho cả 2 trường hợp "both" và "chấm riêng 1 task".
      feedback = {
        ...raw,
        corrections: (raw.corrections || []).map((c: any) => ({ ...c, task: taskType })),
        ...(taskType === "task1"
          ? { task1_summary: raw.examiner_summary }
          : { task2_summary: raw.examiner_summary }),
      };
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
    const technicalDetail = error instanceof Error ? error.message : String(error);
    console.error("❌ GRADING FAILED:", technicalDetail);

    const isAIOverload = /429|rate limit|quota|exceeded/i.test(technicalDetail);

    return NextResponse.json(
      {
        error: isAIOverload 
          ? "Hệ thống AI đang quá tải hoặc hết lượt dùng. Vui lòng thử lại sau hoặc liên hệ Anh Tân."
          : "Đã xảy ra lỗi hệ thống nghiêm trọng.",
        detail: technicalDetail
      },
      { status: isAIOverload ? 503 : 502 }
    );
  }
}