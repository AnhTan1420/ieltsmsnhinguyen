import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import type { GradingFeedback } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// CẤU HÌNH & HELPERS
// ─────────────────────────────────────────────────────────────

type TaskType = "task1" | "task2";

/** 
 * CẮT NGẮN NỘI DUNG (Tránh lỗi 413 của Groq - Payload too large)
 * IELTS Writing thường < 500 từ (~2000 tokens). 
 * Giới hạn 8000 ký tự (~2500 tokens) là an toàn cho Groq Free Tier.
 */
function truncateContent(content: string, limit: number = 8000): string {
  if (content.length > limit) {
    return content.substring(0, limit) + "\n...[Nội dung đã cắt ngắn để phù hợp giới hạn API]";
  }
  return content;
}

const TASK_CONFIG = {
  task1: {
    label: "Task 1 (Academic / General Training)",
    primaryFocus: "Task Achievement (TA) và Coherence & Cohesion (CC)",
    criterionLabel: "Task Achievement",
    promptAnalysis: `## PHÂN TÍCH ĐỀ BÀI (Task Achievement Pre-check)\nPhân tích ngắn gọn biểu đồ/đề bài: Nêu xu hướng chính, các đặc điểm nổi bật và so sánh dữ liệu.`,
    currentBandNote: "Bài viết cần có overview rõ ràng, lựa chọn và so sánh các đặc điểm chính thay vì liệt kê số liệu.",
  },
  task2: {
    label: "Task 2 (Academic / General Training)",
    primaryFocus: "Task Response (TR) và Coherence & Cohesion (CC)",
    criterionLabel: "Task Response",
    promptAnalysis: `## PHÂN TÍCH ĐỀ BÀI (Task Response Pre-check)\nPhân tích ngắn gọn câu hỏi: Xác định chủ đề, giải quyết tất cả các phần của câu hỏi, nêu rõ lập trường cá nhân.`,
    currentBandNote: "Bài viết cần giải quyết đầy đủ câu hỏi, lập trường rõ ràng và có ví dụ/phân tích cụ thể.",
  },
} as const;

function buildSystemPrompt(taskType: TaskType): string {
  const t = TASK_CONFIG[taskType];
  return `Act as an expert IELTS Examiner. Grade the IELTS Writing ${t.label}.
  
CORE INSTRUCTIONS:
1. FOCUS on ${t.primaryFocus}.
2. Output ONLY VALID JSON. No extra text outside the JSON.
3. LANGUAGE: Feedback, justification, and JSON values MUST be in VIETNAMESE.
4. CORRECTIONS: Provide specific grammar corrections.
5. ROUNDING: Band scores must be 0.5 or integer.

${t.promptAnalysis}

## ĐIỂM SỐ CHI TIẾT
- Overall Band Score: X.X
- ${t.criterionLabel}: X.X
- Coherence & Cohesion: X.X
- Lexical Resource: X.X
- Grammatical Range & Accuracy: X.X

## PHÂN TÍCH
- Band hiện tại [X.X]: Giải thích bằng tiếng Việt.
- Tại sao không bị hạ band: Ưu điểm.
- Tại sao chưa đạt band [X.X + 0.5]: Nhược điểm.
- Lộ trình band tiếp theo: 2-3 bước cụ thể.

## BÀI VIẾT ĐÃ ĐƯỢC CHỈNH SỬA
(Cung cấp các câu sửa lỗi).

## TỪ VỰNG GỢI Ý
(Cung cấp bảng từ vựng).

JSON OUTPUT (Append this exact JSON at the end, NO markdown):
{
  "overall_band": number,
  "examiner_summary": "string",
  "task1": { "band": number, "TA": number, "CC": number, "LR": number, "GRA": number } | null,
  "task2": { "band": number, "TR": number, "CC": number, "LR": number, "GRA": number } | null,
  "corrections": [ { "original": "string", "corrected": "string", "explanation": "string" } ]
}`;
}

// ─────────────────────────────────────────────────────────────
// XỬ LÝ JSON CỨNG CÁP
// ─────────────────────────────────────────────────────────────
function extractJson(raw: string, taskType: TaskType): GradingFeedback {
  let jsonString = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = jsonString.indexOf("{");
  const end = jsonString.lastIndexOf("}");
  
  if (start === -1 || end === -1) throw new Error("Không tìm thấy JSON.");
  jsonString = jsonString.slice(start, end + 1);

  try {
    return JSON.parse(jsonString) as GradingFeedback;
  } catch (e) {
    // Thử làm sạch ký tự lạ nếu parse lỗi
    const cleaned = jsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    return JSON.parse(cleaned) as GradingFeedback;
  }
}

// ─────────────────────────────────────────────────────────────
// CÁC PROVIDER (ĐÃ THÊM TRUNCATE)
// ─────────────────────────────────────────────────────────────
async function gradeWithGroq(content: string, testPrompt: string, taskType: TaskType): Promise<GradingFeedback> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const safeContent = truncateContent(content); // <--- CHỐNG LỖI 413

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.2,
    max_tokens: 4096,
    messages: [
      { role: "system", content: buildSystemPrompt(taskType) },
      { role: "user", content: `Prompt:\n${testPrompt}\n\nEssay:\n${safeContent}` },
    ],
  });

  return extractJson(completion.choices[0]?.message?.content ?? "", taskType);
}

async function gradeWithGemini(content: string, testPrompt: string, taskType: TaskType, modelName: string): Promise<GradingFeedback> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
  const safeContent = truncateContent(content); // <--- CHỐNG LỖI 429 (Giảm token đầu vào)

  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Prompt:\n${testPrompt}\n\nEssay:\n${safeContent}`,
    config: {
      systemInstruction: buildSystemPrompt(taskType),
      temperature: 0.1,
    },
  });

  return extractJson(response.text || "", taskType);
}

// ─────────────────────────────────────────────────────────────
// CỔNG CHÍNH (FAILOVER)
// ─────────────────────────────────────────────────────────────
export async function gradeSubmission(
  content: string,
  testPrompt: string,
  taskType: TaskType = "task2",
): Promise<GradingFeedback> {
  const errors: string[] = [];

  // Thử Gemini 2.0
  try {
    return await gradeWithGemini(content, testPrompt, taskType, "gemini-2.0-flash");
  } catch (e: any) {
    errors.push(`Gemini 2.0 failed: ${e.message}`);
  }

  // Thử Gemini 1.5 (Nếu 2.0 không khả dụng)
  try {
    return await gradeWithGemini(content, testPrompt, taskType, "gemini-1.5-flash");
  } catch (e: any) {
    errors.push(`Gemini 1.5 failed: ${e.message}`);
  }

  // Thử Groq 8B (Nếu cả 2 Gemini đều lỗi)
  try {
    return await gradeWithGroq(content, testPrompt, taskType);
  } catch (e: any) {
    errors.push(`Groq failed: ${e.message}`);
    throw new Error(`All AI providers failed! ${errors.join(" | ")}`);
  }
}
