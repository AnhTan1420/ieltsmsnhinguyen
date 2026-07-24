import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gradeSubmission } from "@/lib/grading";
import { requireAuth } from "@/lib/auth-server";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// Luôn tính lại "band" tổng của MỘT task từ chính 4 điểm tiêu chí, thay vì
// tin trực tiếp field "band"/"overall_band" mà model tự trả — vì model đôi
// khi tự mâu thuẫn (VD: chấm TA/CC/LR/GRA = 8,8,8,8 nhưng lại ghi "band 7.5"
// ở đâu đó, hoặc field "band" lệch khỏi trung bình 4 tiêu chí nó vừa chấm).
// Công thức làm tròn khớp CHÍNH XÁC quy tắc đã mô tả trong buildSystemPrompt:
// .25 → làm tròn lên .5; .75 → làm tròn lên nguyên tiếp theo; .0/.5 giữ nguyên.
// ─────────────────────────────────────────────────────────────
function filterTrivialCorrections(corrections: any[]): any[] {
  return (corrections || []).filter((c) => {
    const original = String(c?.original ?? "").trim().toLowerCase();
    const corrected = String(c?.corrected ?? "").trim().toLowerCase();
    return original !== corrected && original.length > 0 && corrected.length > 0;
  });
}

function roundIeltsBand(avg: number): number {
  const rem = avg % 1;
  if (Math.abs(rem - 0.25) < 1e-9) return Math.floor(avg) + 0.5;
  if (Math.abs(rem - 0.75) < 1e-9) return Math.ceil(avg);
  // .0 và .5 giữ nguyên; các phần dư khác gần như không xảy ra vì mỗi tiêu
  // chí luôn là bội số 0.5, nhưng vẫn làm tròn an toàn về 0.5 gần nhất.
  return Math.round(avg * 2) / 2;
}

function computeTaskBand(criteria: { criterionScore?: number; CC?: number; LR?: number; GRA?: number }): number | null {
  const { criterionScore, CC, LR, GRA } = criteria;
  const scores = [criterionScore, CC, LR, GRA];
  if (scores.some((s) => typeof s !== "number" || Number.isNaN(s))) return null;
  const avg = (scores as number[]).reduce((a, b) => a + b, 0) / 4;
  return roundIeltsBand(avg);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { submissionId, content, testPrompt, taskType, task1Prompt, task2Prompt, task1ImageUrl } = await request.json();

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
        gradeSubmission(content, task1Prompt, "task1", task1ImageUrl),
        gradeSubmission(content, task2Prompt, "task2")
      ]);

      const fb1 = feedback1 as any;
      const fb2 = feedback2 as any;

      const fb1TA = fb1.task1?.TA ?? fb1.TA;
      const fb1CC = fb1.task1?.CC ?? fb1.CC;
      const fb1LR = fb1.task1?.LR ?? fb1.LR;
      const fb1GRA = fb1.task1?.GRA ?? fb1.GRA;

      const fb2TR = fb2.task2?.TR ?? fb2.TR;
      const fb2CC = fb2.task2?.CC ?? fb2.CC;
      const fb2LR = fb2.task2?.LR ?? fb2.LR;
      const fb2GRA = fb2.task2?.GRA ?? fb2.GRA;

      // Ưu tiên tự tính từ 4 tiêu chí; chỉ fallback về field model trả nếu
      // vì lý do nào đó thiếu tiêu chí (record cũ, model trả thiếu field).
      const band1 = computeTaskBand({ criterionScore: fb1TA, CC: fb1CC, LR: fb1LR, GRA: fb1GRA })
        ?? Number(fb1.task1?.band || fb1.overall_band || fb1.band || 0);
      const band2 = computeTaskBand({ criterionScore: fb2TR, CC: fb2CC, LR: fb2LR, GRA: fb2GRA })
        ?? Number(fb2.task2?.band || fb2.overall_band || fb2.band || 0);

      const overallBand = roundIeltsBand((band1 + band2) / 2);

      feedback = {
        overall_band: overallBand,
        examiner_summary: `${fb1.examiner_summary || "Không có nhận xét."}\n\n${fb2.examiner_summary || "Không có nhận xét."}`.trim(),
        task1_summary: fb1.examiner_summary || "Không có nhận xét.",
        task2_summary: fb2.examiner_summary || "Không có nhận xét.",
        task1: {
          band: band1, // luôn là số tự tính, khớp 100% với bảng điểm chi tiết
          TA: fb1TA,
          CC: fb1CC,
          LR: fb1LR,
          GRA: fb1GRA,
        },
        task2: {
          band: band2,
          TR: fb2TR,
          CC: fb2CC,
          LR: fb2LR,
          GRA: fb2GRA,
        },
        corrections: [
          ...filterTrivialCorrections(fb1.corrections || []).map((c: any) => ({ ...c, task: "task1" as const })),
          ...filterTrivialCorrections(fb2.corrections || []).map((c: any) => ({ ...c, task: "task2" as const })),
        ],
        // 5 field dưới đây từng bị bỏ sót hoàn toàn khi gộp kết quả "both"
        // (feedback1/feedback2 đều có nhưng không được copy sang) — AI vẫn tốn
        // token sinh ra nhưng dữ liệu chưa từng được lưu/hiển thị. Giữ lại,
        // gắn "task" như "corrections" để UI lọc đúng theo từng task.
        vocabulary_suggestions: [
          ...(fb1.vocabulary_suggestions || []).map((v: any) => ({ ...v, task: "task1" as const })),
          ...(fb2.vocabulary_suggestions || []).map((v: any) => ({ ...v, task: "task2" as const })),
        ],
        advanced_structures: [
          ...(fb1.advanced_structures || []).map((s: any) => ({ ...s, task: "task1" as const })),
          ...(fb2.advanced_structures || []).map((s: any) => ({ ...s, task: "task2" as const })),
        ],
        essay_upgrades: [
          ...(fb1.essay_upgrades || []).map((u: any) => ({ ...u, task: "task1" as const })),
          ...(fb2.essay_upgrades || []).map((u: any) => ({ ...u, task: "task2" as const })),
        ],
        task1_golden_rule: fb1.golden_rule,
        task2_golden_rule: fb2.golden_rule,
        task1_band_progression: fb1.band_progression,
        task2_band_progression: fb2.band_progression,
        // edited_essay_markdown giữ lại làm fallback hiển thị cho dữ liệu CŨ —
        // dữ liệu mới dùng "essay_upgrades" ở trên (có thể highlight trong bài).
        task1_edited_essay_markdown: fb1.edited_essay_markdown,
        task2_edited_essay_markdown: fb2.edited_essay_markdown,
      };
    } else {
      if (!testPrompt) {
        return NextResponse.json({ error: "Missing testPrompt" }, { status: 400 });
      }
      const raw = (await gradeSubmission(content, testPrompt, taskType, task1ImageUrl)) as any;

      const criterionKey = taskType === "task1" ? "TA" : "TR";
      const criterionScore = raw.task1?.[criterionKey] ?? raw.task2?.[criterionKey] ?? raw[criterionKey];
      const CC = raw.task1?.CC ?? raw.task2?.CC ?? raw.CC;
      const LR = raw.task1?.LR ?? raw.task2?.LR ?? raw.LR;
      const GRA = raw.task1?.GRA ?? raw.task2?.GRA ?? raw.GRA;

      const computedBand = computeTaskBand({ criterionScore, CC, LR, GRA })
        ?? Number(raw.task1?.band ?? raw.task2?.band ?? raw.overall_band ?? raw.band ?? 0);

      const taskScoreObject = {
        band: computedBand,
        [criterionKey]: criterionScore,
        CC,
        LR,
        GRA,
      };

      feedback = {
        ...raw,
        overall_band: computedBand,
        corrections: filterTrivialCorrections(raw.corrections || []).map((c: any) => ({ ...c, task: taskType })),
        vocabulary_suggestions: (raw.vocabulary_suggestions || []).map((v: any) => ({ ...v, task: taskType })),
        advanced_structures: (raw.advanced_structures || []).map((s: any) => ({ ...s, task: taskType })),
        essay_upgrades: (raw.essay_upgrades || []).map((u: any) => ({ ...u, task: taskType })),
        task1: taskType === "task1" ? taskScoreObject : null,
        task2: taskType === "task2" ? taskScoreObject : null,
        ...(taskType === "task1"
          ? {
              task1_summary: raw.examiner_summary,
              task1_golden_rule: raw.golden_rule,
              task1_band_progression: raw.band_progression,
              task1_edited_essay_markdown: raw.edited_essay_markdown,
            }
          : {
              task2_summary: raw.examiner_summary,
              task2_golden_rule: raw.golden_rule,
              task2_band_progression: raw.band_progression,
              task2_edited_essay_markdown: raw.edited_essay_markdown,
            }),
      };
    }

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