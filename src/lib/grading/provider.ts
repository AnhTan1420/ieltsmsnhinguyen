import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import type { GradingFeedback } from "@/lib/types";
import type { TaskType, PromptMode } from "./prompt";
import { buildSystemPrompt } from "./prompt";
import { buildGradingJsonSchema } from "./schema";
import { extractJson, isFallbackWorthyError, JsonExtractionError } from "./parse";

// ─────────────────────────────────────────────────────────────
// CẤU HÌNH MODEL CHAIN CHUNG
// ─────────────────────────────────────────────────────────────
export interface ModelChainConfig {
  readonly model: string;
  readonly maxTokens: number;
  readonly mode: PromptMode;
  readonly timeoutMs: number;
}

// ─────────────────────────────────────────────────────────────
// NGÂN SÁCH THỜI GIAN TOÀN CỤC cho MỘT lượt gradeSubmission().
//
// Route /api/grade khai báo `export const maxDuration = 60` (giây) — đây là
// trần CỨNG của Vercel: nếu function chạy quá mốc đó, Vercel sẽ KILL nó giữa
// chừng và trả về lỗi hạ tầng thô (không phải lỗi JSON thân thiện mà
// gradeSubmission() cố tạo ra ở catch cuối cùng).
//
// Cộng dồn timeoutMs khai báo trong 2 chain bên dưới ở TRƯỜNG HỢP XẤU NHẤT
// (Gemini flash + flash-lite đều timeout, RỒI fallback sang Groq 70b + 8b
// cũng đều timeout): 25s + 15s + 20s + 10s = 70s — CHƯA tính thời gian tải
// ảnh Task 1 (thêm tối đa 8s nữa). Tức là > 60s, vượt trần Vercel.
//
// DEFAULT_BUDGET_MS giới hạn TỔNG thời gian thực tế (tải ảnh + mọi lượt thử
// của cả 2 provider) không bao giờ vượt quá con số này, bất kể timeoutMs cấu
// hình cho từng model là bao nhiêu — clampAttemptTimeout() bên dưới sẽ "cắt
// bớt" timeout của từng lượt thử theo ngân sách còn lại. Để 45s (60s trần
// Vercel − ~15s đệm cho auth, ghi Supabase, cold start...). Nếu sửa
// `maxDuration` ở route.ts, nhớ cân lại số này theo.
// ─────────────────────────────────────────────────────────────
// Export để route.ts (nơi khai báo `maxDuration`) có thể import và:
//  (1) truyền tường minh vào gradeSubmission() thay vì dựa vào default ngầm
//      — để mối liên hệ giữa 2 file này hiện rõ ngay trong code, không phải
//      chỉ nằm trong comment;
//  (2) tự cảnh báo lúc chạy nếu sau này ai đó chỉnh maxDuration hoặc số này
//      mà quên chỉnh số còn lại (xem sanity check trong route.ts).
export const DEFAULT_BUDGET_MS = 45_000;

/** Dưới mốc này thì thử thêm 1 model cũng gần như chắc chắn timeout — bỏ qua luôn cho đỡ tốn 1 lượt gọi vô ích. */
const MIN_VIABLE_ATTEMPT_MS = 3_000;

class Deadline {
  private readonly deadlineAt: number;
  constructor(budgetMs: number) {
    this.deadlineAt = Date.now() + budgetMs;
  }
  /** Số ms còn lại trong ngân sách (có thể âm nếu đã quá hạn). */
  remaining(): number {
    return this.deadlineAt - Date.now();
  }
}

/**
 * "Cắt" timeout của MỘT lượt thử theo thời gian ngân sách còn lại, đảm bảo dù
 * mỗi model trong chain được cấu hình timeoutMs riêng bao nhiêu thì tổng thời
 * gian toàn luồng gradeSubmission() vẫn không vượt DEFAULT_BUDGET_MS.
 * Trả về null nếu ngân sách còn lại quá ít để đáng thử thêm.
 */
function clampAttemptTimeout(deadline: Deadline, configuredTimeoutMs: number): number | null {
  const remaining = deadline.remaining();
  if (remaining < MIN_VIABLE_ATTEMPT_MS) return null;
  return Math.min(configuredTimeoutMs, remaining);
}

/**
 * Rút gọn 1 error thành chuỗi ngắn để log, dùng chung cho cả 2 provider.
 *
 * Dùng `instanceof` (không phải `err?.name === "JsonExtractionError"`) vì
 * `class JsonExtractionError extends Error { }` trong parse.ts không hề gán
 * lại `this.name` trong constructor — nghĩa là `err.name` của mọi instance
 * class này luôn là "Error" (kế thừa từ `Error.prototype.name`), KHÔNG BAO
 * GIỜ là "JsonExtractionError". Check theo `.name` sẽ luôn fail âm thầm và
 * rơi xuống nhánh dưới, in cả câu message tiếng Việt dài ra log thay vì tag
 * ngắn gọn "invalid_json" như mong muốn.
 */
function describeError(err: any): string {
  if (err instanceof JsonExtractionError) return "invalid_json";
  return String(err?.status ?? err?.code ?? err?.message ?? "unknown");
}

// ─────────────────────────────────────────────────────────────
// Provider: Groq — thử 70b (chất lượng cao) rồi 8b (fallback khẩn cấp)
// ─────────────────────────────────────────────────────────────
const GROQ_MODEL_CHAIN: readonly ModelChainConfig[] = Object.freeze([
  {
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    maxTokens: 3500,
    mode: "full",
    timeoutMs: 20_000, // 20s — sẽ bị clamp nếu ngân sách chung còn ít hơn
  },
  {
    model: "llama-3.1-8b-instant",
    maxTokens: 1500,
    mode: "minimal",
    timeoutMs: 10_000, // 10s
  },
]);

async function gradeWithGroq(
  content: string,
  testPrompt: string,
  taskType: TaskType,
  deadline: Deadline,
): Promise<GradingFeedback> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const userContent = `Prompt:\n${testPrompt}\n\nEssay:\n${content}`;

  let lastError: any = new Error("[groq] Hết ngân sách thời gian trước khi thử được model nào.");

  for (const { model, maxTokens, mode, timeoutMs } of GROQ_MODEL_CHAIN) {
    const attemptTimeout = clampAttemptTimeout(deadline, timeoutMs);
    if (attemptTimeout === null) {
      console.warn(`⚠️ [groq/${taskType}] Hết ngân sách thời gian, bỏ qua model ${model}.`);
      break;
    }

    try {
      const systemPrompt = buildSystemPrompt(taskType, { mode });
      const completion = await groq.chat.completions.create(
        {
          model,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        },
        // groq-sdk hỗ trợ timeout NATIVE ở tầng request options: nó tự gắn
        // AbortSignal và hủy THẬT request khi hết giờ (đã verify trong
        // node_modules/groq-sdk/internal/request-options.d.ts).
        { timeout: attemptTimeout },
      );

      const raw = completion.choices[0]?.message?.content ?? "";
      return extractJson(raw, taskType);
    } catch (err: any) {
      lastError = err;
      if (!isFallbackWorthyError(err)) throw err; // lỗi thật (vd 400) → không che giấu
      console.warn(
        `⚠️ [groq/${taskType}] Model ${model} thất bại (${describeError(err)}), thử model kế tiếp...`,
      );
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// Provider: Gemini — thử Flash (chất lượng cao) rồi Flash-Lite
// ─────────────────────────────────────────────────────────────
const GEMINI_MODEL_CHAIN: readonly ModelChainConfig[] = Object.freeze([
  {
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    maxTokens: 4096,
    mode: "full",
    timeoutMs: 30_000, // 30s
  },
  {
    model: "gemini-3.5-flash-lite",
    maxTokens: 4096,
    mode: "compact",
    timeoutMs: 10_000, // 10s
  },
]);

function guessImageMimeType(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function fetchTask1ImageInlineData(
  imageUrl: string | null | undefined,
  deadline: Deadline,
): Promise<{ mimeType: string; data: string } | null> {
  if (!imageUrl) return null;

  // Tải ảnh cũng phải nằm trong CÙNG ngân sách thời gian chung — nếu không,
  // một host ảnh chậm có thể ngốn hết ngân sách trước khi model chấm điểm
  // nào kịp chạy lượt đầu tiên.
  const attemptTimeout = clampAttemptTimeout(deadline, 8_000);
  if (attemptTimeout === null) {
    console.warn(`⚠️ [gemini] Hết ngân sách thời gian, bỏ qua tải ảnh Task 1: ${imageUrl}`);
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), attemptTimeout);

  try {
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`⚠️ [gemini] Không tải được ảnh Task 1 (HTTP ${res.status}): ${imageUrl}`);
      return null;
    }
    const contentType = res.headers.get("content-type");
    const mimeType = contentType?.startsWith("image/") ? contentType : guessImageMimeType(imageUrl);
    const buffer = await res.arrayBuffer();
    return { mimeType, data: Buffer.from(buffer).toString("base64") };
  } catch (err) {
    console.warn(`⚠️ [gemini] Lỗi/Timeout khi tải ảnh Task 1, sẽ chấm không có ảnh đối chiếu:`, err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function gradeWithGemini(
  content: string,
  testPrompt: string,
  taskType: TaskType,
  deadline: Deadline,
  task1ImageUrl?: string | null,
): Promise<GradingFeedback> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
  const userContent = `Prompt:\n${testPrompt}\n\nEssay:\n${content}`;
  const jsonSchema = buildGradingJsonSchema(taskType);

  const inlineImage =
    taskType === "task1" ? await fetchTask1ImageInlineData(task1ImageUrl, deadline) : null;

  const contents = inlineImage
    ? [
        {
          role: "user" as const,
          parts: [{ text: userContent }, { inlineData: inlineImage }],
        },
      ]
    : userContent;

  let lastError: any = new Error("[gemini] Hết ngân sách thời gian trước khi thử được model nào.");

  for (const { model, maxTokens, mode, timeoutMs } of GEMINI_MODEL_CHAIN) {
    const attemptTimeout = clampAttemptTimeout(deadline, timeoutMs);
    if (attemptTimeout === null) {
      console.warn(`⚠️ [gemini/${taskType}] Hết ngân sách thời gian, bỏ qua model ${model}.`);
      break;
    }

    try {
      const systemPrompt = buildSystemPrompt(taskType, { mode, hasImage: Boolean(inlineImage) });

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          responseSchema: jsonSchema,
          // Timeout THẬT ở tầng SDK (@google/genai đọc httpOptions.timeout,
          // tự tạo AbortController riêng và abort() request HTTP khi hết
          // giờ — đã verify trong dist/node của package). Khác với
          // Promise.race (cách làm trước đây): race chỉ khiến code NGƯNG
          // CHỜ promise đang chạy, chứ không hủy request thật — request vẫn
          // tiếp tục chạy trên server Google, vẫn tốn quota/token, và bạn
          // không kiểm soát được nó sẽ resolve/reject ra sao sau khi đã
          // "thua cuộc đua" (dữ liệu trả về, nếu có, bị vứt bỏ vô ích).
          httpOptions: { timeout: attemptTimeout },
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
        `⚠️ [gemini/${taskType}] Model ${model} thất bại (${describeError(err)}), thử model kế tiếp...`,
      );
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// Public API — Chạy Gemini trước, rớt xuống Groq nếu fail.
//
// budgetMs: tổng ngân sách thời gian cho CẢ lượt gọi này (Gemini + Groq +
// tải ảnh), mặc định DEFAULT_BUDGET_MS. Có thể truyền riêng nếu route gọi
// gradeSubmission() song song nhiều lần (VD taskType "both" trong route.ts
// dùng Promise.all cho task1 + task2) và muốn canh ngân sách khác nhau.
// ─────────────────────────────────────────────────────────────
export async function gradeSubmission(
  content: string,
  testPrompt: string,
  taskType: TaskType = "task2",
  task1ImageUrl?: string | null,
  budgetMs: number = DEFAULT_BUDGET_MS,
): Promise<GradingFeedback> {
  const deadline = new Deadline(budgetMs);

  try {
    return await gradeWithGemini(content, testPrompt, taskType, deadline, task1ImageUrl);
  } catch (geminiError) {
    console.warn(`⚠️ [grader/${taskType}] Gemini failed. Đang fallback sang Groq. Lỗi chi tiết:`, geminiError);

    try {
      return await gradeWithGroq(content, testPrompt, taskType, deadline);
    } catch (groqError) {
      console.error(`❌ [grader/${taskType}] Cả Gemini và Groq đều failed!`);

      const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      const groqMsg = groqError instanceof Error ? groqError.message : String(groqError);

      throw new Error(`Tất cả AI Providers đều thất bại!\n- Gemini: ${geminiMsg}\n- Groq: ${groqMsg}`);
    }
  }
}