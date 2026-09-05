import type { TaskType } from "./prompt";

// ─────────────────────────────────────────────────────────────
// Tách từ src/app/api/grade/route.ts để DÙNG CHUNG giữa:
//  - /api/grade        (route bài thi thật, có auth giáo viên, ghi Supabase)
//  - /api/practice/grade (route luyện tập public, không auth, không ghi DB)
// Mục đích: cả 2 nơi tự tính lại band / lọc dữ liệu phải dùng ĐÚNG MỘT công
// thức, tránh trường hợp sau này sửa 1 chỗ mà quên chỗ còn lại khiến band
// hiển thị lệch nhau giữa bài thi thật và bài luyện tập.
// ─────────────────────────────────────────────────────────────

/**
 * Luôn tính lại "band" tổng của MỘT task từ chính 4 điểm tiêu chí, thay vì
 * tin trực tiếp field "band"/"overall_band" mà model tự trả — vì model đôi
 * khi tự mâu thuẫn (VD: chấm TA/CC/LR/GRA = 8,8,8,8 nhưng lại ghi "band 7.5"
 * ở đâu đó, hoặc field "band" lệch khỏi trung bình 4 tiêu chí nó vừa chấm).
 * Công thức làm tròn khớp CHÍNH XÁC quy tắc đã mô tả trong buildSystemPrompt:
 * .25 → làm tròn lên .5; .75 → làm tròn lên nguyên tiếp theo; .0/.5 giữ nguyên.
 */
export function roundIeltsBand(avg: number): number {
  const rem = avg % 1;
  if (Math.abs(rem - 0.25) < 1e-9) return Math.floor(avg) + 0.5;
  if (Math.abs(rem - 0.75) < 1e-9) return Math.ceil(avg);
  // .0 và .5 giữ nguyên; các phần dư khác gần như không xảy ra vì mỗi tiêu
  // chí luôn là bội số 0.5, nhưng vẫn làm tròn an toàn về 0.5 gần nhất.
  return Math.round(avg * 2) / 2;
}

export function computeTaskBand(criteria: {
  criterionScore?: number;
  CC?: number;
  LR?: number;
  GRA?: number;
}): number | null {
  const { criterionScore, CC, LR, GRA } = criteria;
  const scores = [criterionScore, CC, LR, GRA];
  if (scores.some((s) => typeof s !== "number" || Number.isNaN(s))) return null;
  const avg = (scores as number[]).reduce((a, b) => a + b, 0) / 4;
  return roundIeltsBand(avg);
}

/** Loại bỏ correction "sửa" ra y hệt bản gốc (model đôi khi trả correction rỗng/thừa). */
export function filterTrivialCorrections(corrections: any[]): any[] {
  return (corrections || []).filter((c) => {
    const original = String(c?.original ?? "").trim().toLowerCase();
    const corrected = String(c?.corrected ?? "").trim().toLowerCase();
    return original !== corrected && original.length > 0 && corrected.length > 0;
  });
}

/**
 * Chuẩn hoá kết quả thô mà gradeSubmission() trả về cho MỘT task đơn lẻ
 * (task1 HOẶC task2 — KHÔNG dùng cho chế độ "both", vì "both" cần merge 2
 * lượt gọi AI với overall_band riêng, xem logic merge trong api/grade/route.ts)
 * thành một object khớp shape `GradingFeedback`:
 *  - Tự tính lại band từ 4 tiêu chí thay vì tin field model trả (xem computeTaskBand).
 *  - Lọc correction rỗng/thừa.
 *  - Gắn field "task" vào corrections/vocabulary_suggestions/advanced_structures/
 *    essay_upgrades để UI (feedback-resolvers.ts) lọc đúng theo task.
 *  - Copy examiner_summary/golden_rule/band_progression/edited_essay_markdown
 *    sang đúng field "task{N}_..." tương ứng.
 */
export function buildSingleTaskFeedback(raw: any, taskType: TaskType): any {
  const criterionKey = taskType === "task1" ? "TA" : "TR";
  const criterionScore = raw.task1?.[criterionKey] ?? raw.task2?.[criterionKey] ?? raw[criterionKey];
  const CC = raw.task1?.CC ?? raw.task2?.CC ?? raw.CC;
  const LR = raw.task1?.LR ?? raw.task2?.LR ?? raw.LR;
  const GRA = raw.task1?.GRA ?? raw.task2?.GRA ?? raw.GRA;

  const computedBand =
    computeTaskBand({ criterionScore, CC, LR, GRA }) ??
    Number(raw.task1?.band ?? raw.task2?.band ?? raw.overall_band ?? raw.band ?? 0);

  const taskScoreObject = {
    band: computedBand,
    [criterionKey]: criterionScore,
    CC,
    LR,
    GRA,
  };

  return {
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
