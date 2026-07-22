import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import type { GradingFeedback } from "@/lib/types";
import type { TaskType, PromptMode } from "./prompt";
import { buildSystemPrompt } from "./prompt";
import { buildGradingJsonSchema } from "./schema";
import { extractJson, isFallbackWorthyError } from "./parse";

// ─────────────────────────────────────────────────────────────
// Provider: Groq — thử lần lượt 70b (chất lượng cao) rồi 8b (fallback khẩn cấp)
//
// llama-3.1-8b-instant ở tier on-demand/free giới hạn TPM (token/phút) rất
// thấp (thường ~6000), và giới hạn này tính TRÊN TỔNG system+user prompt
// CỘNG với max_tokens bạn xin cấp cho completion — chứ không phải chỉ số
// token model thực sự dùng. Vì vậy với model này bắt buộc dùng mode
// "minimal" (prompt ngắn, schema rút gọn) VÀ max_tokens thấp, nếu không sẽ
// luôn bị 413 "Request too large" dù model chưa kịp chạy.
// ─────────────────────────────────────────────────────────────

const GROQ_MODEL_CHAIN: Array<{ model: string; maxTokens: number; mode: PromptMode }> = [
  { model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", maxTokens: 3500, mode: "full" },
  { model: "llama-3.1-8b-instant", maxTokens: 1500, mode: "minimal" },
];

async function gradeWithGroq(
  content: string,
  testPrompt: string,
  taskType: TaskType,
): Promise<GradingFeedback> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const userContent = `Prompt:\n${testPrompt}\n\nEssay:\n${content}`;

  let lastError: any;

  for (const { model, maxTokens, mode } of GROQ_MODEL_CHAIN) {
    try {
      const systemPrompt = buildSystemPrompt(taskType, { mode });
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      return extractJson(raw, taskType);
    } catch (err: any) {
      lastError = err;
      if (!isFallbackWorthyError(err)) throw err; // lỗi thật (vd 400) → không che giấu
      console.warn(
        `⚠️ [groq] model ${model} thất bại (${err?.status ?? (err?.name === "JsonExtractionError" ? "invalid_json" : "?")}), thử model kế tiếp...`,
      );
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// Provider: Gemini — thử Flash (chất lượng cao) rồi Flash-Lite (TPM/RPD rộng hơn)
// Gemini hỗ trợ responseMimeType + responseSchema => ép cấu trúc JSON THẬT SỰ ở
// tầng API, không chỉ dựa vào lời văn trong prompt.
// ─────────────────────────────────────────────────────────────

const GEMINI_MODEL_CHAIN: Array<{ model: string; maxOutputTokens: number; mode: PromptMode }> = [
  { model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash", maxOutputTokens: 4096, mode: "full" },
  { model: "gemini-3.5-flash-lite", maxOutputTokens: 4096, mode: "compact" },
];

// ─────────────────────────────────────────────────────────────
// Tải ảnh biểu đồ/bảng/bản đồ gốc của đề Task 1 (test.image_url, thường là
// public URL trên Supabase Storage) và chuyển sang base64 để nhét thẳng vào
// request Gemini dạng inlineData — Gemini (multimodal) "nhìn" được ảnh này
// và có thể đối chiếu số liệu học sinh viết trong bài với số liệu thật.
// Trả về null nếu không có URL hoặc tải ảnh thất bại (khi đó vẫn chấm bình
// thường, chỉ là không có ảnh để đối chiếu — KHÔNG được làm hỏng cả lượt chấm).
// ─────────────────────────────────────────────────────────────
function guessImageMimeType(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function fetchTask1ImageInlineData(
  imageUrl?: string | null,
): Promise<{ mimeType: string; data: string } | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.warn(`⚠️ [gemini] Không tải được ảnh Task 1 (HTTP ${res.status}): ${imageUrl}`);
      return null;
    }
    const contentType = res.headers.get("content-type");
    const mimeType = contentType?.startsWith("image/") ? contentType : guessImageMimeType(imageUrl);
    const buffer = await res.arrayBuffer();
    return { mimeType, data: Buffer.from(buffer).toString("base64") };
  } catch (err) {
    console.warn(`⚠️ [gemini] Lỗi khi tải ảnh Task 1, sẽ chấm không có ảnh đối chiếu:`, err);
    return null;
  }
}

async function gradeWithGemini(
  content: string,
  testPrompt: string,
  taskType: TaskType,
  task1ImageUrl?: string | null,
): Promise<GradingFeedback> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
  const userContent = `Prompt:\n${testPrompt}\n\nEssay:\n${content}`;
  const jsonSchema = buildGradingJsonSchema(taskType);

  // Chỉ Task 1 mới có ảnh biểu đồ gốc để đối chiếu số liệu (Task 2 không có ảnh đề).
  const inlineImage =
    taskType === "task1" ? await fetchTask1ImageInlineData(task1ImageUrl) : null;

  const contents = inlineImage
    ? [
        {
          role: "user" as const,
          parts: [{ text: userContent }, { inlineData: inlineImage }],
        },
      ]
    : userContent;

  let lastError: any;

  for (const { model, maxOutputTokens, mode } of GEMINI_MODEL_CHAIN) {
    try {
      const systemPrompt = buildSystemPrompt(taskType, { mode, hasImage: Boolean(inlineImage) });
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: jsonSchema,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ] as any,
        },
      });

      return extractJson(response.text || "", taskType);
    } catch (err: any) {
      lastError = err;
      if (!isFallbackWorthyError(err)) throw err; // lỗi thật (vd prompt bị block, input sai) → không che giấu
      console.warn(
        `⚠️ [gemini] model ${model} thất bại (${err?.status ?? err?.code ?? (err?.name === "JsonExtractionError" ? "invalid_json" : "?")}), thử model kế tiếp...`,
      );
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// Public API — Gemini (Flash → Flash-Lite) trước,
// rớt xuống Groq (70b → 8b) nếu cả 2 model Gemini đều fail
// ─────────────────────────────────────────────────────────────
export async function gradeSubmission(
  content: string,
  testPrompt: string,
  taskType: TaskType = "task2",
  task1ImageUrl?: string | null,
): Promise<GradingFeedback> {
  try {
    return await gradeWithGemini(content, testPrompt, taskType, task1ImageUrl);
  } catch (geminiError) {
    console.warn("⚠️ [grader] Gemini failed. Lỗi chi tiết:", geminiError);

    // Lưu ý: llama trên Groq là model text-only, KHÔNG đọc được ảnh biểu đồ.
    // Khi rớt xuống nhánh fallback này, Task 1 chỉ còn được chấm dựa trên mô
    // tả bằng chữ của đề (testPrompt) — không có ảnh gốc để đối chiếu số liệu.
    try {
      return await gradeWithGroq(content, testPrompt, taskType);
    } catch (groqError) {
      console.error("❌ [grader] Groq also failed. Lỗi chi tiết:", groqError);

      const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      const groqMsg = groqError instanceof Error ? groqError.message : String(groqError);

      throw new Error(`All AI providers failed! \nChi tiết lỗi Gemini: ${geminiMsg} \nChi tiết lỗi Groq: ${groqMsg}`);
    }
  }
}