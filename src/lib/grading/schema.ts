import type { TaskType } from "./prompt";

// JSON Schema (định dạng Gemini responseSchema — subset của OpenAPI schema)
// Không dùng cho Groq: Groq (OpenAI-compatible) response_format:"json_object"
// chỉ ép JSON hợp lệ về cú pháp, không nhận schema chi tiết như thế này.
export function buildGradingJsonSchema(taskType: TaskType) {
  const criterionKey = taskType === "task1" ? "TA" : "TR";

  // QUAN TRỌNG: Gemini không cho phép { type: "null" } đứng một mình làm schema
  // của 1 field. Field "có thể null" phải khai báo type thật (object) kèm
  // nullable: true — Gemini sẽ tự chọn trả object hoặc null cho field đó.
  const nullableTaskScoreSchema = {
    type: "object",
    nullable: true,
    properties: {
      band: { type: "number" },
      CC: { type: "number" },
      LR: { type: "number" },
      GRA: { type: "number" },
      [criterionKey]: { type: "number" },
    },
    required: ["band", "CC", "LR", "GRA", criterionKey],
  };

  return {
    type: "object",
    properties: {
      word_count: { type: "number" },
      meets_min_word_count: { type: "boolean" },
      overall_band: { type: "number" },
      examiner_summary: { type: "string" },
      prompt_analysis: { type: "string" },
      task1: nullableTaskScoreSchema,
      task2: nullableTaskScoreSchema,
      band_progression: {
        type: "object",
        properties: {
          current_band: { type: "number" },
          why_current: { type: "string" },
          why_not_lower: { type: "string" },
          why_not_higher: { type: "string" },
          roadmap_steps: { type: "array", items: { type: "string" } },
        },
        required: ["current_band", "why_current", "why_not_lower", "why_not_higher", "roadmap_steps"],
      },
      corrections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string" },
            corrected: { type: "string" },
            explanation: { type: "string" },
            criterion: { type: "string", enum: ["CC", "GRA", "LR", criterionKey] },
          },
          required: ["original", "corrected", "explanation", "criterion"],
        },
      },
      edited_essay_markdown: { type: "string" },
      vocabulary_suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original_word: { type: "string" },
            better_alternative: { type: "string" },
            reason: { type: "string" },
          },
          required: ["original_word", "better_alternative", "reason"],
        },
      },
      advanced_structures: {
        type: "array",
        items: {
          type: "object",
          properties: {
            structure_name: { type: "string" },
            example_sentence_en: { type: "string" },
            explanation_vi: { type: "string" },
          },
          required: ["structure_name", "example_sentence_en", "explanation_vi"],
        },
      },
      golden_rule: { type: "string" },
    },
    required: [
      "word_count",
      "meets_min_word_count",
      "overall_band",
      "examiner_summary",
      "prompt_analysis",
      "task1",
      "task2",
      "band_progression",
      "corrections",
      "edited_essay_markdown",
      "vocabulary_suggestions",
      "advanced_structures",
      "golden_rule",
    ],
  } as const;
}

// Schema RÚT GỌN dành riêng cho tier TPM thấp (vd Groq free/on-demand).
// Không dùng cho Gemini (Gemini vẫn nên dùng bản full ở trên).
export function buildMinimalGradingJsonSchema(taskType: TaskType) {
  const criterionKey = taskType === "task1" ? "TA" : "TR";
  const nullableTaskScoreSchema = {
    type: "object",
    nullable: true,
    properties: {
      band: { type: "number" },
      CC: { type: "number" },
      LR: { type: "number" },
      GRA: { type: "number" },
      [criterionKey]: { type: "number" },
    },
    required: ["band", "CC", "LR", "GRA", criterionKey],
  };

  return {
    type: "object",
    properties: {
      word_count: { type: "number" },
      meets_min_word_count: { type: "boolean" },
      overall_band: { type: "number" },
      examiner_summary: { type: "string" },
      task1: nullableTaskScoreSchema,
      task2: nullableTaskScoreSchema,
      corrections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string" },
            corrected: { type: "string" },
            explanation: { type: "string" },
            criterion: { type: "string", enum: ["CC", "GRA", "LR", criterionKey] },
          },
          required: ["original", "corrected", "explanation", "criterion"],
        },
      },
    },
    required: ["word_count", "meets_min_word_count", "overall_band", "examiner_summary", "task1", "task2", "corrections"],
  } as const;
}