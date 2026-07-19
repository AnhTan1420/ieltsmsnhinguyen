export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type TestRow = {
  id: string;
  title: string;
  task1_prompt: string;
  task2_prompt: string;
  image_url: string | null;
  duration_minutes: number;
  created_at: string;
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
};

export type AdvancedStructure = {
  structure_name: string;
  example_sentence_en: string;
  explanation_vi: string;
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
  band_progression?: BandProgression;
  edited_essay_markdown?: string;
  vocabulary_suggestions?: VocabularySuggestion[];
  advanced_structures?: AdvancedStructure[];
  golden_rule?: string;
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
  teacher_comment?: string | null;
  tests?: {
    title: string;
    task1_prompt: string;
    task2_prompt: string;
    image_url: string | null;
    duration_minutes: number;
  } | null;
};