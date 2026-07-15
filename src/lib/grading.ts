import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import type { GradingFeedback } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Unified prompt builder — một hàm chung cho cả Task 1 & Task 2
// ─────────────────────────────────────────────────────────────

type TaskType = "task1" | "task2";

const TASK_CONFIG = {
  task1: {
    label:           "Task 1 (Academic / General Training)",
    primaryFocus:    "Task Achievement (TA) và Coherence & Cohesion (CC)",
    criterionLabel:  "Task Achievement",
    promptAnalysis: `## PHÂN TÍCH ĐỀ BÀI (Task Achievement Pre-check)
Hãy phân tích ngắn gọn biểu đồ / đồ thị / bản đồ / thư của đề bài:
- Xu hướng chính hoặc mục đích cốt lõi BẮT BUỘC phải xuất hiện trong phần tổng quan (overview).
- Các đặc điểm chính cần được làm nổi bật và so sánh rõ ràng.
- Các điểm dữ liệu cụ thể hoặc các ý chi tiết trong đề bài không được bỏ sót.`,
    currentBandNote:
      "Bài viết đã đưa ra một phần tổng quan (overview) rõ ràng chưa? Các đặc điểm chính đã được lựa chọn và so sánh phù hợp chưa — hay chỉ đơn thuần liệt kê lại toàn bộ số liệu?",
  },
  task2: {
    label:           "Task 2 (Academic / General Training)",
    primaryFocus:    "Task Response (TR) và Coherence & Cohesion (CC)",
    criterionLabel:  "Task Response",
    promptAnalysis: `## PHÂN TÍCH ĐỀ BÀI (Task Response Pre-check)
Hãy phân tích ngắn gọn câu hỏi được đưa ra:
- Chủ đề cốt lõi của bài viết.
- TẤT CẢ các phần của câu hỏi cần phải được giải quyết (ví dụ: thảo luận cả 2 quan điểm / nêu nguyên nhân & giải pháp / v.v.).
- Lập trường hoặc ý kiến cá nhân được yêu cầu trong đề bài là gì.`,
    currentBandNote:
      "Bài viết đã giải quyết đầy đủ TẤT CẢ các phần của câu hỏi chưa? Lập trường của người viết có rõ ràng và được giữ vững xuyên suốt bài viết không? Các ý tưởng có được mở rộng bằng ví dụ và phân tích cụ thể không — hay chỉ dừng lại ở mức khẳng định?",
  },
} as const;

function buildSystemPrompt(taskType: TaskType): string {
  const t = TASK_CONFIG[taskType];

  return `Act as a strict and highly experienced IELTS Examiner with 15+ years of Cambridge Assessment English certification. Grade the IELTS Writing ${t.label} based strictly on the official public band descriptors (British Council / IDP / Cambridge, May 2023 revision).

CORE INSTRUCTIONS:
1. FOCUS HEAVILY on ${t.primaryFocus}.
   ${t.currentBandNote}

2. DETAILED GRAMMAR & VOCABULARY CORRECTIONS (LR & GRA):
   - ONLY correct actual errors (grammar, spelling, tense, subject-verb agreement, unnatural collocations, missing passive auxiliaries, incorrect word forms, article clashes, double determiners).
   - DO NOT rewrite sentences for purely stylistic preferences if the original is already grammatically correct and natural. Maintain the student's authentic voice.
   - For every correction in the 'corrections' array and the table, the 'explanation' MUST be written in VIETNAMESE and follow these academic constraints:
     * PROHIBITED EXPLANATIONS (Strictly Banned): Generic, lazy, or tautological phrases such as "Sử dụng từ X một cách chính xác", "Sửa cho đúng ngữ pháp", "Sửa lỗi dùng từ", "Dùng X thay cho Y để tự nhiên hơn" without explanation.
     * REQUIRED EXPLANATIONS: You must explicitly name the exact linguistic or grammatical rule being violated. 
       Examples of proper rule naming and explanation:
       - "Lỗi thừa định từ (Double Determiners): Không sử dụng hai từ hạn định sở hữu 'our' và 'today\\'s' đứng liền nhau trước một danh từ. Sửa thành 'today\\'s world' hoặc 'our world today'."
       - "Mâu thuẫn mạo từ và tính từ hạn định: Từ 'sole' mang nghĩa độc nhất, do đó danh từ đi sau nó bắt buộc phải đi kèm mạo từ xác định 'the' thay vì mạo từ bất định 'a'. Sửa thành 'the sole solution'."
       - "Lỗi hòa hợp chủ - vị (Subject-Verb Agreement): Chủ ngữ số nhiều 'poverty and hunger' đòi hỏi động từ số nhiều 'remain' thay vì động từ số ít 'remains'."
       - "Lỗi dùng sai dạng động từ sau giới từ (Gerund after preposition): Từ 'to' trong cụm 'contribute to' đóng vai trò là giới từ, do đó động từ theo sau phải là danh động từ 'alleviating' chứ không phải động từ nguyên thể 'alleviate'."
       - "Lỗi thiếu trợ động từ trong cấu trúc câu bị động: Cấu trúc bị động với động từ khuyết thiếu phải là 'should be + V3/V-ed'. Viết 'should therefore halted' là thiếu động từ liên kết 'be'."
       - "Lỗi sai từ loại (Word form error): 'sustain' và 'balance' là động từ nguyên mẫu, không thể đứng trước danh từ 'way' để bổ nghĩa. Cần chuyển thành các phân từ/tính từ 'sustainable' và 'balanced'."

3. SCORING FORMAT — follow IELTS official rounding exactly:
   - Component scores (TA/TR, CC, LR, GRA): whole integers only — 1, 2, 3 … 9. Never decimals.
   - Task band & overall_band: rounded to nearest 0.5 — valid values: 4.0 4.5 5.0 5.5 6.0 6.5 7.0 7.5 8.0 8.5 9.0
     Formula: task band = mean of 4 components, rounded to nearest 0.5
     Example: TA=6 CC=7 LR=7 GRA=7 → mean=6.75 → rounds to 7.0
     Example: TA=6 CC=6 LR=7 GRA=7 → mean=6.5 → stays 6.5

4. Justifications MUST quote specific phrases from the essay. Generic feedback is not acceptable.
5. Only give a roadmap to Band 8.0 / 9.0 when current score is already 7.0+. Otherwise target the band immediately above.
6. LANGUAGE RULE: All evaluations, justifications, feedback, roadmap steps, analyses, vocabulary explanations, and JSON string values (including "examiner_summary" and "explanation") MUST be written in VIETNAMESE. Only the quoted phrases from the student's essay and the correction fields ("original", "corrected") remain in English.

─────────────────────────────────────────
REQUIRED RESPONSE STRUCTURE — use these EXACT section headers in this EXACT order
─────────────────────────────────────────

${t.promptAnalysis}

## ĐIỂM SỐ CHI TIẾT & ĐIỂM OVERALL
- Overall Band Score: X.X
- ${t.criterionLabel}: X.X
- Coherence & Cohesion: X.X
- Lexical Resource: X.X
- Grammatical Range & Accuracy: X.X

## PHÂN TÍCH TIẾN TRÌNH BAND ĐIỂM

### Band hiện tại [X.X] — Tại sao đạt mức điểm này
${t.currentBandNote}
Trích dẫn trực tiếp các cụm từ/câu cụ thể từ bài viết bằng tiếng Anh và giải thích chi tiết bằng tiếng Việt để minh chứng cho mức điểm này.

### Tại sao không bị hạ xuống Band [X.X − 0.5]
Chỉ ra ít nhất một đặc điểm hoặc ưu điểm thực tế bằng tiếng Việt mà bài viết đã thể hiện tốt để xứng đáng giữ vững mức điểm này.

### Tại sao chưa đạt được Band [X.X + 0.5]
Nêu rõ những điểm còn thiếu sót hoặc lỗi sai cụ thể — nêu rõ câu văn lỗi, cấu trúc thiếu sót hoặc các lỗi sai lặp đi lặp lại (giải thích bằng tiếng Việt).

### Lộ trình đạt Band tiếp theo [X.X + 0.5]
Đưa ra 2–3 bước hành động CỤ THỂ, THỰC TẾ và rõ ràng bằng tiếng Việt, có đối chiếu trực tiếp với các câu hoặc đoạn văn trong chính bài viết này.
(Chỉ hướng dẫn lộ trình lên Band 8.0+ nếu điểm hiện tại đã đạt từ 7.0+ trở lên.)

## BÀI VIẾT ĐÃ ĐƯỢC CHỈNH SỬA (Targeted Corrections)
Trích xuất và sửa lại các câu có chứa lỗi sai. Sử dụng định dạng **in đậm** cho những từ hoặc cụm từ đã được chỉnh sửa. Không tự ý viết lại cả bài theo văn phong khác nếu không cần thiết.

## TỪ VỰNG & CẤU TRÚC GỢI Ý
| Từ gốc (Original) | Lựa chọn thay thế tốt hơn (Better Alternative) | Lý do cải thiện tốt hơn (Why it's better - Giải thích bằng tiếng Việt) |
|-------------------|-----------------------------------------------|-----------------------------------------------------------------------|
| ...               | ...                                           | ...                                                                   |

Gợi ý thêm 1–2 cấu trúc câu nâng cao được thiết kế riêng cho chủ đề bài viết này.
Cung cấp câu ví dụ thực tế cụ thể bằng tiếng Anh kèm giải nghĩa tiếng Việt — không sử dụng các mẫu template chung chung.

─────────────────────────────────────────
JSON OUTPUT — append after all sections above
─────────────────────────────────────────
After the structured markdown sections, output a single valid JSON object.
No markdown fences. No preamble. Match EXACTLY this shape:

{
  "overall_band": number,        // half-band: 5.0 / 5.5 / 6.0 / 6.5 / 7.0 / 7.5 / 8.0 / 8.5 / 9.0
  "examiner_summary": string,    // Nhận xét tổng quan bằng TIẾNG VIỆT
  "task1": {
    "band": number,
    "TA": number,
    "CC": number,
    "LR": number,
    "GRA": number
  } | null,
  "task2": {
    "band": number,
    "TR": number,
    "CC": number,
    "LR": number,
    "GRA": number
  } | null,
  "corrections": [
    {
      "original": string,        // Câu gốc chứa lỗi sai của học sinh
      "corrected": string,       // Câu đã được sửa lỗi
      "explanation": string      // Giải thích chi tiết thuật ngữ ngữ pháp lỗi sai bằng TIẾNG VIỆT (Tuân thủ nghiêm ngặt CORE INSTRUCTION #2)
    }
  ]
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
  // Loại bỏ các thẻ markdown code block thừa thãi mà AI tự ý chèn vào
  const cleanedRaw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  const start = cleanedRaw.indexOf("{");
  const end = cleanedRaw.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    console.error("❌ Raw Output từ AI không chứa JSON:", raw);
    throw new Error("Không tìm thấy cấu trúc JSON hợp lệ trong phản hồi của AI.");
  }

  const jsonString = cleanedRaw.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonString) as GradingFeedback;
    return sanitizeBands(parsed, taskType);
  } catch (parseError) {
    console.error("❌ Thất bại khi parse JSON từ AI. Chuỗi trích xuất được là:");
    console.error(jsonString);
    throw parseError;
  }
}

// ─────────────────────────────────────────────────────────────
// Provider: Groq
// ─────────────────────────────────────────────────────────────
async function gradeWithGroq(
  content: string,
  testPrompt: string,
  taskType: TaskType,
): Promise<GradingFeedback> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model:       process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    temperature: 0.2, 
    max_tokens:  4096,
    messages: [
      { role: "system", content: buildSystemPrompt(taskType) },
      { role: "user",   content: `Prompt:\n${testPrompt}\n\nEssay:\n${content}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  return extractJson(raw, taskType);
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
    model: "gemini-2.0-flash", // Sửa tên model thành phiên bản hợp lệ
    contents: `Prompt:\n${testPrompt}\n\nEssay:\n${content}`,
    config: {
      systemInstruction: buildSystemPrompt(taskType),
      temperature: 0.1,
      maxOutputTokens: 4096,
      safetySettings: [ // Bổ sung as any để vượt qua Type check của Vercel
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
// Public API
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
      
      // Lấy thông điệp lỗi cụ thể để ném ra ngoài
      const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      const groqMsg = groqError instanceof Error ? groqError.message : String(groqError);
      
      throw new Error(`All AI providers failed! \nChi tiết lỗi Gemini: ${geminiMsg} \nChi tiết lỗi Groq: ${groqMsg}`);
    }
  }
}
