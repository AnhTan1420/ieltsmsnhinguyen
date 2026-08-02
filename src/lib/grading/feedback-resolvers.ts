import type { AdvancedStructure, BandProgression, Correction, EssayUpgrade, GradingFeedback, VocabularySuggestion } from "@/lib/types";

// Lấy đúng đoạn nhận xét của 1 task. Ưu tiên task1_summary/task2_summary (dữ
// liệu mới, route.ts đã điền sẵn không kèm header). Với submission cũ lưu
// trước khi có 2 field này, fallback: nếu examiner_summary có header
// "### Task N Evaluation:" thì tách theo header; nếu không có header (record
// cũ chỉ từng chấm 1 task) thì coi cả examiner_summary là của task đang hỏi.
export function resolveTaskSummary(feedback: GradingFeedback, task: "task1" | "task2"): string {
  const direct = task === "task1" ? feedback.task1_summary : feedback.task2_summary;
  if (direct) return direct;

  const raw = feedback.examiner_summary || "";
  const headerRegex = /^###\s*Task\s*\d[^\n]*$/gim;
  const matches = [...raw.matchAll(headerRegex)];

  if (matches.length === 0) return raw;

  const match = matches.find((m) => (task === "task1" ? /1/.test(m[0]) : /2/.test(m[0])));
  if (!match) return "";

  const matchIdx = matches.indexOf(match);
  const start = match.index ?? 0;
  const end = matchIdx + 1 < matches.length ? matches[matchIdx + 1].index! : raw.length;
  return raw.slice(start, end).replace(headerRegex, "").trim();
}

// Lọc corrections theo task. Ưu tiên field "task" đã gắn sẵn (dữ liệu mới).
// Fallback cho record cũ chưa có field này: đoán bằng cách so khớp text gốc
// của lỗi vào đúng bài làm của task đó.
export function resolveTaskCorrections(feedback: GradingFeedback, task: "task1" | "task2", answerText?: string): Correction[] {
  const all = feedback.corrections ?? [];
  const hasTags = all.some((c) => c.task);
  if (hasTags) return all.filter((c) => c.task === task);
  if (!answerText) return [];
  return all.filter((c) => answerText.includes(c.original));
}

// Task nào đang là "task đơn lẻ" của feedback này — dùng để fallback các field
// cũ (chưa tách theo task, lưu trước khi route.ts được vá) về đúng task đang
// hiển thị. Khi feedback có CẢ task1 lẫn task2 (chấm "both"), field cũ không
// đáng tin (chỉ còn của lần gọi cuối), nên KHÔNG fallback trong trường hợp đó.
function soloTaskOf(feedback: GradingFeedback): "task1" | "task2" | null {
  if (feedback.task1 && !feedback.task2) return "task1";
  if (feedback.task2 && !feedback.task1) return "task2";
  return null;
}

export function resolveTaskGoldenRule(feedback: GradingFeedback, task: "task1" | "task2"): string | undefined {
  const direct = task === "task1" ? feedback.task1_golden_rule : feedback.task2_golden_rule;
  if (direct) return direct;
  return feedback.golden_rule && soloTaskOf(feedback) === task ? feedback.golden_rule : undefined;
}

export function resolveTaskBandProgression(feedback: GradingFeedback, task: "task1" | "task2"): BandProgression | undefined {
  const direct = task === "task1" ? feedback.task1_band_progression : feedback.task2_band_progression;
  if (direct) return direct;
  return feedback.band_progression && soloTaskOf(feedback) === task ? feedback.band_progression : undefined;
}

export function resolveTaskEditedEssay(feedback: GradingFeedback, task: "task1" | "task2"): string | undefined {
  const direct = task === "task1" ? feedback.task1_edited_essay_markdown : feedback.task2_edited_essay_markdown;
  if (direct) return direct;
  return feedback.edited_essay_markdown && soloTaskOf(feedback) === task ? feedback.edited_essay_markdown : undefined;
}

export function resolveTaskEssayUpgrades(feedback: GradingFeedback, task: "task1" | "task2"): EssayUpgrade[] {
  const all = feedback.essay_upgrades ?? [];
  const hasTags = all.some((u) => u.task);
  if (hasTags) return all.filter((u) => u.task === task);
  return soloTaskOf(feedback) === task ? all : [];
}

export function resolveTaskVocabulary(feedback: GradingFeedback, task: "task1" | "task2"): VocabularySuggestion[] {
  const all = feedback.vocabulary_suggestions ?? [];
  const hasTags = all.some((v) => v.task);
  if (hasTags) return all.filter((v) => v.task === task);
  return soloTaskOf(feedback) === task ? all : [];
}

export function resolveTaskAdvancedStructures(feedback: GradingFeedback, task: "task1" | "task2"): AdvancedStructure[] {
  const all = feedback.advanced_structures ?? [];
  const hasTags = all.some((s) => s.task);
  if (hasTags) return all.filter((s) => s.task === task);
  return soloTaskOf(feedback) === task ? all : [];
}

// Hiển thị ĐÚNG giá trị band — KHÔNG làm tròn về số nguyên, vì Math.round(7.5) = 8
// sẽ khiến điểm hiển thị trông cao hơn thực tế. Lưu ý: overall_band/task.band có
// thể là half-band (VD 7.5, kết quả của việc lấy trung bình 4 tiêu chí); còn từng
// tiêu chí riêng lẻ (TA/TR, CC, LR, GRA) đúng chuẩn IELTS luôn là số nguyên, nên
// trong thực tế nhánh .5 của hàm này chỉ kích hoạt khi hiển thị band tổng.
export function formatBandScore(score: unknown): string {
  const n = Number(score);
  if (score === undefined || score === null || Number.isNaN(n)) return String(score ?? "");
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}