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
// cũng đều timeout): 40s + 10s + 20s + 10s = 80s — CHƯA tính thời gian tải
// ảnh Task 1 (thêm tối đa 8s nữa, ~88s). Tức là > 60s, vượt xa trần Vercel —
// đây chính xác là lý do clampAttemptTimeout()/DEFAULT_BUDGET_MS bên dưới tồn
// tại: KHÔNG được để tổng thời gian thực tế đi theo phép cộng dồn ngây thơ
// này, dù mỗi model riêng lẻ có "muốn" chờ lâu đến đâu.
//
// DEFAULT_BUDGET_MS giới hạn TỔNG thời gian thực tế (tải ảnh + mọi lượt thử
// của cả 2 provider) không bao giờ vượt quá con số này, bất kể timeoutMs cấu
// hình cho từng model là bao nhiêu — clampAttemptTimeout() bên dưới sẽ "cắt
// bớt" timeout của từng lượt thử theo ngân sách còn lại. Để 50s (60s trần
// Vercel − 5s đệm SAFETY_MARGIN_MS ở route.ts cho auth, parse request, ghi
// Supabase). Nếu sửa `maxDuration` hoặc `SAFETY_MARGIN_MS` ở route.ts, nhớ
// cân lại số này theo — sanity check ở route.ts sẽ tự cảnh báo nếu quên.
//
// LƯU Ý khi nới rộng timeoutMs của lượt Gemini full-mode (hiện 40s, xem
// GEMINI_MODEL_CHAIN bên dưới): nới càng nhiều thì càng ít ngân sách còn lại
// cho các lượt fallback phía sau nếu Gemini thật sự chạm hết timeout đó — ở
// mức 40s hiện tại, nếu Gemini full-mode dùng hết đúng 40s, chỉ còn ~10s cho
// Gemini flash-lite (vừa đủ 1 lượt), và gần như không còn gì cho Groq. Đây là
// đánh đổi CÓ CHỦ ĐÍCH: chấp nhận fallback nông hơn ở trường hợp xấu nhất để
// đổi lấy cơ hội Gemini full-mode chấm xong trọn vẹn (chất lượng cao hơn)
// thay vì bị cắt ngang sớm.
// ─────────────────────────────────────────────────────────────
// Export để route.ts (nơi khai báo `maxDuration`) có thể import và:
//  (1) truyền tường minh vào gradeSubmission() thay vì dựa vào default ngầm
//      — để mối liên hệ giữa 2 file này hiện rõ ngay trong code, không phải
//      chỉ nằm trong comment;
//  (2) tự cảnh báo lúc chạy nếu sau này ai đó chỉnh maxDuration hoặc số này
//      mà quên chỉnh số còn lại (xem sanity check trong route.ts).
export const DEFAULT_BUDGET_MS = 50_000;

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
 *
 * Check `err?.name === "AbortError"` PHẢI đứng TRƯỚC `err?.code`: khi
 * `httpOptions.timeout` hết giờ, @google/genai abort() request và ném ra một
 * `DOMException` tên "AbortError" — nhưng `DOMException` là API kế thừa từ
 * thời XML DOM cũ, nên nó LUÔN có sẵn thuộc tính số `.code` (hằng số kế thừa,
 * ví dụ `ABORT_ERR = 20`). Nếu không chặn trước, `err?.status ?? err?.code`
 * sẽ nhặt luôn con số "20" đó (vì nó không phải undefined) trước khi kịp tới
 * `err?.message`, in ra log dòng vô nghĩa "thất bại (20)" thay vì cho biết
 * đây thực chất là timeout — y hệt kiểu bug "check nhầm chỗ" như
 * JsonExtractionError ở trên, chỉ khác là do trùng tên field thay vì `.name`
 * bị ghi đè.
 */
function describeError(err: any): string {
  if (err instanceof JsonExtractionError) return "invalid_json";
  if (err?.name === "AbortError") return "timeout";
  return String(err?.status ?? err?.code ?? err?.message ?? "unknown");
}

/**
 * 429 (rate limit) khác về bản chất với timeout/500/503: thường chỉ là giới
 * hạn request/token TRONG 1 GIÂY hoặc 1 PHÚT (burst), tự hết sau vài giây —
 * không phải model đang lỗi hay quá tải kéo dài. Nhảy thẳng xuống model chất
 * lượng thấp hơn (vd Flash → Flash-Lite) ngay khi gặp 429 là lãng phí: rất có
 * thể chỉ cần đợi RATE_LIMIT_RETRY_DELAY_MS rồi gọi LẠI ĐÚNG model đó là qua.
 * Dùng riêng 1 check tách khỏi isFallbackWorthyError() (vốn gộp chung 429 với
 * timeout/500/503/408 để quyết định "có nên chuyển model khác hay không") vì
 * ở đây ta cần phân biệt: 429 → thử lại CÙNG model 1 lần trước, còn timeout/
 * 500/503/408 → nhảy model khác luôn (thử lại cùng chỗ vừa timeout/quá tải
 * gần như chắc chắn timeout/quá tải lần nữa, chỉ tổ tốn ngân sách thời gian).
 */
function isRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.response?.status ?? err?.code;
  if (status === 429) return true;
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate_limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("exceeded your current quota")
  );
}

/** Đợi ngắn trước khi thử lại cùng model sau lỗi 429. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini (RESOURCE_EXHAUSTED/429) thường trả kèm `error.details` chứa 1 object
 * RetryInfo { retryDelay: "22.362s" } — đây là con số THẬT Google khuyên đợi
 * trước khi gọi lại, hoàn toàn khác với việc đoán mò 1 con số cố định. Ưu
 * tiên dùng con số này (nếu có) thay vì RATE_LIMIT_RETRY_DELAY_MS mặc định —
 * đợi ĐÚNG khoảng Google yêu cầu tăng khả năng lần retry THÀNH CÔNG hẳn, thay
 * vì đợi 1.5s cố định rồi vẫn dính y hệt 429 (vì Google có thể cần đợi lâu
 * hơn thế nhiều, ví dụ khi đó là quota theo NGÀY/PHÚT chứ không phải burst
 * theo giây). Đã verify đúng cấu trúc lỗi thật Google trả (không suy đoán):
 *   error.details: [
 *     { "@type": ".../QuotaFailure", violations: [...] },
 *     { "@type": ".../RetryInfo", retryDelay: "22.362s" },
 *   ]
 * Thử nhiều vị trí có thể chứa `details` vì tuỳ phiên bản @google/genai, lỗi
 * có thể lộ field này trực tiếp trên object hoặc chỉ nằm trong `err.message`
 * dưới dạng JSON nguyên văn body lỗi HTTP gốc.
 */
function extractGoogleRetryDelayMs(err: any): number | null {
  const detailsCandidates: any[] = [
    err?.error?.details,
    err?.details,
    err?.response?.data?.error?.details,
  ];

  if (typeof err?.message === "string") {
    try {
      const parsed = JSON.parse(err.message);
      detailsCandidates.push(parsed?.error?.details);
    } catch {
      // err.message không phải JSON thuần (trường hợp bình thường) → bỏ qua
    }
  }

  for (const details of detailsCandidates) {
    if (!Array.isArray(details)) continue;
    const retryInfo = details.find(
      (d: any) => typeof d?.["@type"] === "string" && d["@type"].includes("RetryInfo"),
    );
    const match = typeof retryInfo?.retryDelay === "string" ? retryInfo.retryDelay.match(/^([\d.]+)s$/) : null;
    if (match) {
      const seconds = parseFloat(match[1]);
      if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);
    }
  }

  return null;
}

/** Số lần thử LẠI TRÊN CÙNG 1 MODEL khi gặp 429 (chưa tính lượt gọi đầu tiên). */
const RATE_LIMIT_MAX_RETRIES = 2;
/** Thời gian đợi giữa các lần thử lại khi gặp 429 — đủ để qua cơn burst limit theo giây, không đủ dài để ăn hết ngân sách chung. */
const RATE_LIMIT_RETRY_DELAY_MS = 1_500;

// ─────────────────────────────────────────────────────────────
// Provider: Groq — thử gpt-oss-120b (chất lượng cao) rồi gpt-oss-20b (fallback khẩn cấp)
//
// LƯU Ý: llama-3.3-70b-versatile và llama-3.1-8b-instant đã bị Groq NGƯNG
// PHỤC VỤ (decommission) từ 16/08/2026 cho tier free/developer — gọi 2 model
// này giờ trả về 404 model_not_found thẳng, không phải lỗi tạm thời nên
// isFallbackWorthyError() cũng không cứu được (model sai tên/không tồn tại
// không phải lỗi "đáng thử lại"). Đã thay bằng model thay thế chính thức
// Groq khuyến nghị: xem console.groq.com/docs/deprecations.
//   - llama-3.3-70b-versatile → openai/gpt-oss-120b (hoặc qwen/qwen3.6-27b)
//   - llama-3.1-8b-instant    → openai/gpt-oss-20b
// ─────────────────────────────────────────────────────────────
const GROQ_MODEL_CHAIN: readonly ModelChainConfig[] = Object.freeze([
  {
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    maxTokens: 3500,
    mode: "full",
    timeoutMs: 20_000, // 20s — sẽ bị clamp nếu ngân sách chung còn ít hơn
  },
  {
    model: "openai/gpt-oss-20b",
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
    let retriesLeft = RATE_LIMIT_MAX_RETRIES;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const attemptTimeout = clampAttemptTimeout(deadline, timeoutMs);
      if (attemptTimeout === null) {
        // Hết ngân sách thời gian: không chỉ bỏ qua model này mà DỪNG LUÔN cả
        // chain (throw thẳng ra ngoài for-loop) — thử model kế tiếp lúc này
        // chắc chắn cũng sẽ bị chặn bởi CÙNG điều kiện null này ngay lập tức,
        // chỉ tổ log thêm dòng cảnh báo thừa mà không đổi được kết quả.
        console.warn(`⚠️ [groq/${taskType}] Hết ngân sách thời gian, bỏ qua model ${model}.`);
        throw lastError;
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

        // 429 còn lượt retry & còn đủ ngân sách để đợi + gọi lại → thử lại CÙNG model.
        if (retriesLeft > 0 && isRateLimitError(err)) {
          const suggestedMs = extractGoogleRetryDelayMs(err);
          const waitMs = suggestedMs !== null ? Math.max(suggestedMs, RATE_LIMIT_RETRY_DELAY_MS) : RATE_LIMIT_RETRY_DELAY_MS;
          const stillViable = clampAttemptTimeout(deadline, waitMs + MIN_VIABLE_ATTEMPT_MS) !== null;

          if (stillViable) {
            retriesLeft -= 1;
            console.warn(
              `⚠️ [groq/${taskType}] Model ${model} bị rate limit (429), đợi ${waitMs}ms${suggestedMs !== null ? " (theo retryDelay)" : ""} rồi thử lại cùng model...`,
            );
            await sleep(waitMs);
            continue;
          }
        }

        console.warn(
          `⚠️ [groq/${taskType}] Model ${model} thất bại (${describeError(err)}), thử model kế tiếp...`,
        );
        break; // hết lượt retry cho model này → ra ngoài for, sang model kế tiếp trong chain
      }
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
    timeoutMs: 40_000, // 40s — nới từ 30s vì gặp 504 thật từ Google (không phải do abort của mình) khi model cần hơn 30s để trả lời; xem chi tiết đánh đổi ngân sách ở comment DEFAULT_BUDGET_MS phía trên.
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
    let retriesLeft = RATE_LIMIT_MAX_RETRIES;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const attemptTimeout = clampAttemptTimeout(deadline, timeoutMs);
      if (attemptTimeout === null) {
        // Hết ngân sách thời gian: dừng luôn cả chain, xem giải thích tương tự
        // ở gradeWithGroq() phía trên (cùng lý do, tránh log thừa vô ích).
        console.warn(`⚠️ [gemini/${taskType}] Hết ngân sách thời gian, bỏ qua model ${model}.`);
        throw lastError;
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
            // Ép thinking effort ở mức thấp: Gemini 3.5 Flash mặc định "medium"
            // thinking, và khi kết hợp với responseSchema, model có thể "nghĩ"
            // tràn lan tới mức chiếm gần hết maxOutputTokens trước khi kịp viết
            // JSON trả lời — phần JSON còn lại bị cắt cụt giữa chừng và
            // extractJson() không parse được (chính là nguồn gốc lỗi
            // "invalid_json" hay gặp ở Task 1, vốn có thêm ảnh nên model phải
            // "nghĩ" nhiều hơn). Set "low" để dành phần lớn ngân sách token cho
            // câu trả lời JSON thật sự thay vì cho reasoning ẩn.
            thinkingConfig: { thinkingLevel: "low" } as any,
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
            // attempts: 1 → TẮT retry nội bộ của SDK cho các mã lỗi retryable
            // (mặc định SDK tự thử lại tới 5 lần, backoff 1s→2s→4s→8s→16s trước
            // khi chịu thua — tức là có thể ngốn gần hết `attemptTimeout` chỉ để
            // retry LẶP LẠI đúng model/endpoint đang quá tải, rồi mới nhả lỗi ra
            // cho code ở đây). Model-chain ở trên (Flash → Flash-Lite → Groq)
            // đã đóng đúng vai trò "thử lại" đó rồi, và thử sang model/provider
            // KHÁC luôn hợp lý hơn retry mù quáng vào chỗ vừa quá tải — vừa
            // nhanh hơn (không tốn 30s chờ retry) vừa tăng khả năng thành công.
            httpOptions: { timeout: attemptTimeout, retryOptions: { attempts: 1 } as any },
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

        // 429 còn lượt retry & còn đủ ngân sách để đợi + gọi lại → thử lại CÙNG model
        // thay vì tụt xuống model chất lượng thấp hơn ngay (xem giải thích ở
        // isRateLimitError()/extractGoogleRetryDelayMs() phía trên).
        if (retriesLeft > 0 && isRateLimitError(err)) {
          const suggestedMs = extractGoogleRetryDelayMs(err);
          const waitMs = suggestedMs !== null ? Math.max(suggestedMs, RATE_LIMIT_RETRY_DELAY_MS) : RATE_LIMIT_RETRY_DELAY_MS;
          const stillViable = clampAttemptTimeout(deadline, waitMs + MIN_VIABLE_ATTEMPT_MS) !== null;

          if (stillViable) {
            retriesLeft -= 1;
            console.warn(
              `⚠️ [gemini/${taskType}] Model ${model} bị rate limit (429), đợi ${waitMs}ms${suggestedMs !== null ? " (theo retryDelay Google gợi ý)" : ""} rồi thử lại cùng model...`,
            );
            await sleep(waitMs);
            continue;
          }
        }

        console.warn(
          `⚠️ [gemini/${taskType}] Model ${model} thất bại (${describeError(err)}), thử model kế tiếp...`,
        );
        break; // hết lượt retry cho model này → ra ngoài while, sang model kế tiếp trong chain
      }
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