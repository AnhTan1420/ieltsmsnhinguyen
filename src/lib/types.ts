export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type ClassRow = {
  id: string;
  name: string;
  created_at: string;
};

export type TestRow = {
  id: string;
  title: string;
  task1_prompt: string;
  task2_prompt: string;
  image_url: string | null;
  duration_minutes: number;
  class_id: string | null;
  created_at: string;
  // Chỉ có khi query join sang bảng classes (select("*, classes(name)"))
  classes?: { name: string } | null;
};

export type SubmissionStatus = "in_progress" | "completed" | "disqualified";
export type EndReason = "manual" | "timeout" | "disqualified";

export type Task1Score = {
  band: number;
  TA: number;
  CC: number;
  LR: number;
  GRA: number;
};

export type Task2Score = {
  band: number;
  TR: number;
  CC: number;
  LR: number;
  GRA: number;
};

export type Criterion = "CC" | "GRA" | "LR" | "TA" | "TR";

export type Correction = {
  original: string;
  corrected: string;
  explanation: string;
  criterion: Criterion;
  // Lỗi này thuộc task nào — gắn ở tầng route khi merge kết quả 2 lần gọi AI
  // (xem route.ts). Optional để tương thích với các submission cũ đã lưu
  // trước khi có field này (corrections khi đó không phân biệt được task,
  // UI sẽ tự fallback sang cách đoán bằng text-matching).
  task?: "task1" | "task2";
};

export type BandProgression = {
  current_band: number;
  why_current: string;
  why_not_lower: string;
  why_not_higher: string;
  roadmap_steps: string[];
};

export type VocabularySuggestion = {
  original_word: string;
  better_alternative: string;
  reason: string;
  // Gắn ở tầng route khi merge kết quả 2 lần gọi AI (taskType === "both").
  // Optional để tương thích dữ liệu cũ. Xem Correction.task để biết lý do.
  task?: "task1" | "task2";
};

export type AdvancedStructure = {
  structure_name: string;
  example_sentence_en: string;
  explanation_vi: string;
  // Câu GỐC lấy nguyên văn từ bài làm học sinh mà cấu trúc này dùng để nâng
  // cấp — dùng để highlight (xanh lá) đúng vị trí trong bài làm, bấm vào sẽ
  // hiện chi tiết ở panel "Chi tiết phản hồi". Optional: nếu AI không tìm
  // được câu gốc phù hợp (gợi ý mang tính tổng quát), để trống — khi đó gợi ý
  // vẫn hiện trong danh sách "Cấu trúc nâng cao gợi ý" nhưng không highlight
  // được trong bài làm.
  original_sentence?: string;
  task?: "task1" | "task2";
};

// Một lượt "nâng cấp câu" cụ thể: 1 câu ĐÃ ĐÚNG ngữ pháp trong bài học sinh
// (original) được viết lại hay hơn (upgraded) — khác với Correction (dùng
// cho câu SAI). Thay thế "edited_essay_markdown" (đoạn văn tự do, không định
// vị được trong bài gốc) bằng mảng có cấu trúc để có thể highlight (xanh
// dương) đúng câu gốc trong bài làm, giống cơ chế "corrections" đang làm.
export type EssayUpgrade = {
  original: string;
  upgraded: string;
  note: string;
  task?: "task1" | "task2";
};

export type GradingFeedback = {
  // --- các field cốt lõi (luôn có) ---
  overall_band: number;
  // Field cũ, giữ lại để tương thích ngược: với submission chỉ chấm 1 task,
  // đây là nhận xét đầy đủ của task đó. Với submission chấm "both", đây CHỈ
  // còn là bản nối chuỗi thô làm fallback — KHÔNG dùng field này để hiển thị
  // chính nữa, ưu tiên "task1_summary"/"task2_summary" bên dưới.
  examiner_summary: string;
  task1: Task1Score | null;
  task2: Task2Score | null;
  corrections: Correction[];

  // Nhận xét riêng biệt cho từng task — LUÔN được điền (cả khi chấm 1 task
  // lẫn khi chấm "both") kể từ khi route.ts được vá. Không có header markdown
  // cấp Task lồng bên trong — mỗi field là 1 bản nhận xét sạch của đúng 1 task.
  task1_summary?: string;
  task2_summary?: string;

  // --- các field mở rộng từ prompt (optional để tương thích dữ liệu cũ đã lưu trước khi vá) ---
  word_count?: number;
  meets_min_word_count?: boolean;
  prompt_analysis?: string;
  vocabulary_suggestions?: VocabularySuggestion[];
  advanced_structures?: AdvancedStructure[];
  essay_upgrades?: EssayUpgrade[];

  // Field cũ (chưa tách theo task, dạng đoạn văn tự do — không highlight được
  // trong bài gốc) — chỉ còn dùng làm fallback hiển thị cho submission cũ đã
  // chấm TRƯỚC khi có "essay_upgrades". Dữ liệu mới luôn ưu tiên các field
  // "task1_..."/"task2_..." bên dưới.
  band_progression?: BandProgression;
  edited_essay_markdown?: string;
  golden_rule?: string;

  task1_band_progression?: BandProgression;
  task2_band_progression?: BandProgression;
  task1_edited_essay_markdown?: string;
  task2_edited_essay_markdown?: string;
  task1_golden_rule?: string;
  task2_golden_rule?: string;
};

export type SubmissionRow = {
  id: string;
  test_id: string;
  student_id: string | null;
  student_name: string;
  content: string | null;
  warning_count: number;
  status: SubmissionStatus;
  end_reason: EndReason | null;
  band_score: number | null;
  feedback: GradingFeedback | null;
  started_at: string;
  submitted_at: string | null;
  created_at: string;
  // Do trigger set_updated_at() ở enable_realtime.sql tự set mỗi lần UPDATE —
  // dùng để hiện "cập nhật X giây trước" cạnh nhãn LIVE trên dashboard giáo viên.
  updated_at?: string;
  teacher_comment?: string | null;
  tests?: {
    title: string;
    task1_prompt: string;
    task2_prompt: string;
    image_url: string | null;
    duration_minutes: number;
    class_id: string | null;
  } | null;
};
