import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import type { GradingFeedback } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Unified prompt builder — một hàm chung cho cả Task 1 & Task 2
// ─────────────────────────────────────────────────────────────

type TaskType = "task1" | "task2";

const TASK_CONFIG = {
  task1: {
    label:          "Task 1 (Academic/GT)",
    primaryFocus:   "Task Achievement (TA) và Coherence & Cohesion (CC)",
    criterionLabel: "Task Achievement",
    promptAnalysis: `## PHÂN TÍCH ĐỀ (TA Pre-check)
Nêu ngắn gọn: xu hướng/mục đích chính (bắt buộc có trong overview), các đặc điểm nổi bật cần so sánh, số liệu quan trọng không được bỏ sót.`,
    currentBandNote:
      "Overview có nêu rõ xu hướng chính không? Các đặc điểm nổi bật đã được chọn lọc & so sánh, hay chỉ liệt kê số liệu?",
  },
  task2: {
    label:          "Task 2 (Academic/GT)",
    primaryFocus:   "Task Response (TR) và Coherence & Cohesion (CC)",
    criterionLabel: "Task Response",
    promptAnalysis: `## PHÂN TÍCH ĐỀ (TR Pre-check)
Nêu ngắn gọn: chủ đề chính, các phần của câu hỏi cần giải quyết (2 quan điểm/nguyên nhân-giải pháp...), lập trường cá nhân được yêu cầu.`,
    currentBandNote:
      "Bài đã giải quyết đủ TẤT CẢ các phần câu hỏi chưa? Lập trường có rõ ràng, nhất quán không? Ý tưởng có được mở rộng bằng ví dụ cụ thể hay chỉ khẳng định suông?",
  },
} as const;

function buildSystemPrompt(taskType: TaskType): string {
  const t = TASK_CONFIG[taskType];

  return `Bạn là giám khảo IELTS Writing với 15+ năm kinh nghiệm chấm thi (Cambridge Assessment English). Chấm ${t.label} theo band descriptor chính thức (British Council/IDP, bản 2023). Tập trung vào ${t.primaryFocus}.

QUY TẮC CHÍNH:
1. ${t.currentBandNote}
2. Chỉ sửa lỗi thật (ngữ pháp, chính tả, thì, hòa hợp chủ-vị, collocation sai, thiếu trợ động từ bị động, sai từ loại, mạo từ). KHÔNG viết lại câu chỉ vì lý do văn phong nếu câu gốc đã đúng ngữ pháp và tự nhiên.
3. Mọi "explanation" trong corrections PHẢI bằng TIẾNG VIỆT, nêu rõ TÊN quy tắc ngữ pháp bị vi phạm — cấm các câu chung chung như "sửa cho đúng ngữ pháp" hay "dùng từ X cho tự nhiên hơn" mà không giải thích.
   Ví dụ chuẩn:
   - "Lỗi hòa hợp chủ-vị: chủ ngữ số nhiều 'poverty and hunger' cần động từ số nhiều 'remain', không phải 'remains'."
   - "Lỗi thừa định từ (double determiners): không đặt 'our' và 'today's' liền nhau trước danh từ. Sửa: 'today's world' hoặc 'our world today'."
4. Band số nguyên cho từng tiêu chí (TA/TR, CC, LR, GRA). Band tổng = trung bình 4 tiêu chí, làm tròn đến 0.5 gần nhất (VD: 6.75→7.0; 6.5 giữ nguyên 6.5).
5. Trích dẫn cụm từ/câu cụ thể trong bài để minh chứng nhận xét — không nhận xét chung chung.
6. Chỉ đưa lộ trình lên Band 8.0/9.0 nếu điểm hiện tại đã ≥7.0. Ngược lại chỉ nhắm band kế tiếp.
7. Toàn bộ nhận xét/JSON string values viết bằng TIẾNG VIỆT, trừ phần trích dẫn bài viết gốc và "original"/"corrected" (giữ tiếng Anh).

CẤU TRÚC OUTPUT (theo đúng thứ tự, đúng tiêu đề):

${t.promptAnalysis}

## ĐIỂM SỐ CHI TIẾT
- Overall Band: X.X
- ${t.criterionLabel}: X.X | CC: X.X | LR: X.X | GRA: X.X

## PHÂN TÍCH TIẾN TRÌNH BAND
### Band hiện tại [X.X] — vì sao
Trích câu tiếng Anh cụ thể + giải thích tiếng Việt.
### Vì sao không bị hạ xuống [X.X-0.5]
Nêu ít nhất 1 điểm mạnh thực tế.
### Vì sao chưa đạt [X.X+0.5]
Nêu lỗi/thiếu sót cụ thể, trích câu lỗi.
### Lộ trình lên [X.X+0.5]
2-3 bước hành động cụ thể, đối chiếu trực tiếp câu/đoạn trong bài.

## BÀI VIẾT ĐÃ CHỈNH SỬA
Trích các câu có lỗi, sửa lại, **in đậm** phần sửa. Không viết lại toàn bài.

## TỪ VỰNG & CẤU TRÚC GỢI Ý
| Từ gốc | Thay thế tốt hơn | Lý do (tiếng Việt) |
|---|---|---|
Gợi ý thêm 1-2 cấu trúc nâng cao phù hợp chủ đề bài, kèm câu ví dụ tiếng Anh + giải nghĩa tiếng Việt.

─────────
Sau phần trên, xuất 1 JSON object hợp lệ, KHÔNG markdown fence, KHÔNG lời dẫn, đúng schema:

{
  "overall_band": number,
  "examiner_summary": string,
  "task1": {"band": number, "TA": number, "CC": number, "LR": number, "GRA": number} | null,
  "task2": {"band": number, "TR": number, "CC": number, "LR": number, "GRA": number} | null,
  "corrections": [{"original": string, "corrected": string, "explanation": string}]
}`;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toHalfBand(x: number): number {
  return Math.round(Math.min(Math.max(x, 1), 9) * 2) / 2;
}

function toInteger(x: number): number {
  return Math.round(Math.min(Math.max(x, 1), 9));
}

/**
 * Sanitize AI output: Bọc thép các trường hợp AI nhầm lẫn TA/TR hoặc nhầm Object Task1/Task2
 */
function sanitizeBands(raw: GradingFeedback, taskType: TaskType): GradingFeedback {
  // 1. CHỐNG ẢO GIÁC: Đang chấm Task 1 nhưng AI lại nhét kết quả vào object `task2`
  if (taskType === "task1" && !raw.task1 && raw.task2) {
    raw.task1 = raw.task2 as any;
    raw.task2 = null;
  } else if (taskType === "task2" && !raw.task2 && raw.task1) {
    raw.task2 = raw.task1 as any;
    raw.task1 = null;
  }

  // 2. CHUẨN HOÁ TASK 1
  if (raw.task1) {
    const taScore = raw.task1.TA ?? (raw.task1 as any).TR ?? 1;
    raw.task1.TA  = toInteger(taScore);
    raw.task1.CC  = toInteger(raw.task1.CC ?? 1);
    raw.task1.LR  = toInteger(raw.task1.LR ?? 1);
    raw.task1.GRA = toInteger(raw.task1.GRA ?? 1);

    const mean = (raw.task1.TA + raw.task1.CC + raw.task1.LR + raw.task1.GRA) / 4;
    raw.task1.band = toHalfBand(mean);
  }

  // 3. CHUẨN HOÁ TASK 2
  if (raw.task2) {
    const trScore = raw.task2.TR ?? (raw.task2 as any).TA ?? 1;
    raw.task2.TR  = toInteger(trScore);
    raw.task2.CC  = toInteger(raw.task2.CC ?? 1);
    raw.task2.LR  = toInteger(raw.task2.LR ?? 1);
    raw.task2.GRA = toInteger(raw.task2.GRA ?? 1);

    const mean = (raw.task2.TR + raw.task2.CC + raw.task2.LR + raw.task2.GRA) / 4;
    raw.task2.band = toHalfBand(mean);
  }

  // 4. TÍNH TOÁN LẠI OVERALL BAND
  if (raw.task1 && raw.task2) {
    raw.overall_band = toHalfBand((raw.task1.band + raw.task2.band * 2) / 3);
  } else if (raw.task1) {
    raw.overall_band = raw.task1.band;
  } else if (raw.task2) {
    raw.overall_band = raw.task2.band;
  }

  return raw;
}

/** Pull the JSON block out of a mixed markdown+JSON response */
function extractJson(raw: string, taskType: TaskType): GradingFeedback {
  // 1. Dọn dẹp markdown
  let jsonString = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 2. Tìm vị trí bắt đầu và kết thúc của JSON
  const start = jsonString.indexOf("{");
  const end = jsonString.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("Không tìm thấy cấu trúc JSON hợp lệ.");
  }

  jsonString = jsonString.slice(start, end + 1);

  // 3. XỬ LÝ LỖI ESCAPE CHARACTER (Nguyên nhân gây lỗi 512)
  jsonString = jsonString.replace(/\\n/g, "\\\\n")
                        .replace(/\\r/g, "\\\\r")
                        .replace(/\\t/g, "\\\\t");

  try {
    const parsed = JSON.parse(jsonString) as GradingFeedback;
    return sanitizeBands(parsed, taskType);
  } catch (parseError) {
    // Nếu vẫn lỗi, thử cách thủ công hơn: loại bỏ các ký tự điều khiển lạ
    const cleaned = jsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    const parsed = JSON.parse(cleaned) as GradingFeedback;
    return sanitizeBands(parsed, taskType);
  }
}

/** Lỗi có nên fallback sang model/provider khác hay không (rate limit/quota/quá tải) */
function isFallbackWorthyError(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || status === 413 || status === 503) return true;
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("rate_limit") ||
    msg.includes("quota") ||
    msg.includes("too large") ||
    msg.includes("overloaded")
  );
}

// ─────────────────────────────────────────────────────────────
// Provider: Groq — thử lần lượt 70b (chất lượng cao) rồi 8b (TPM rộng hơn)
// ─────────────────────────────────────────────────────────────

const GROQ_MODEL_CHAIN: Array<{ model: string; maxTokens: number }> = [
  { model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", maxTokens: 3500 },
  { model: "llama-3.1-8b-instant", maxTokens: 2800 },
];

async function gradeWithGroq(
  content: string,
  testPrompt: string,
  taskType: TaskType,
): Promise<GradingFeedback> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const systemPrompt = buildSystemPrompt(taskType);
  const userContent = `Prompt:\n${testPrompt}\n\nEssay:\n${content}`;

  let lastError: any;

  for (const { model, maxTokens } of GROQ_MODEL_CHAIN) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
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
      console.warn(`⚠️ [groq] model ${model} thất bại (${err?.status ?? "?"}), thử model kế tiếp...`);
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// Provider: Gemini
// ─────────────────────────────────────────────────────────────
async function gradeWithGemini(
  content: string,
  testPrompt: string,
  taskType: TaskType,
): Promise<GradingFeedback> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Prompt:\n${testPrompt}\n\nEssay:\n${content}`,
    config: {
      systemInstruction: buildSystemPrompt(taskType),
      temperature: 0.1,
      maxOutputTokens: 4096,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ] as any,
    },
  });

  return extractJson(response.text || "", taskType);
}

// ─────────────────────────────────────────────────────────────
// Public API — Gemini trước, rớt xuống Groq (70b → 8b) nếu Gemini fail
// ─────────────────────────────────────────────────────────────
export async function gradeSubmission(
  content: string,
  testPrompt: string,
  taskType: TaskType = "task2",
): Promise<GradingFeedback> {
  try {
    return await gradeWithGemini(content, testPrompt, taskType);
  } catch (geminiError) {
    console.warn("⚠️ [grader] Gemini failed. Lỗi chi tiết:", geminiError);

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
