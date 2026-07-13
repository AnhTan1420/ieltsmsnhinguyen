import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";

// Hàm lọc sạch nội dung bài làm (loại bỏ các dòng metadata / header)
function cleanEssayContent(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return true; // giữ dòng trống để tách đoạn
      // Bỏ các dòng dạng === XXX ===
      if (/^===.*===$/.test(trimmed)) return false;
      // Bỏ các dòng metadata dạng "Key: value" ở phần đầu file
      if (/^(Họ và tên|Họ tên|Tên học sinh|Lớp|Ngày|Mã học sinh)\s*:/i.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

const SYSTEM_PROMPT = `You are a strict and official IELTS Writing Examiner with expert knowledge of the official IELTS Writing Band Descriptors (British Council, IDP, Cambridge - updated May 2023).

Your task is to evaluate ONE IELTS Writing essay (Task 1 Academic/General or Task 2) STRICTLY against the provided Prompt.

========================
INPUT FORMAT WARNING
========================

The essay text you receive may occasionally still contain leftover formatting artifacts such as section markers (e.g. "=== TASK 1 ==="), student names, or metadata lines that are NOT part of the actual essay.

- NEVER treat these as content errors.
- NEVER include them in "corrections".
- Silently ignore them and evaluate only the actual essay writing.

========================
GENERAL RULES
========================

1. Evaluate ONLY according to the official IELTS descriptors.

2. Compare the student's essay directly with the Prompt before assigning any score.

3. Never guess missing information.

4. Never inflate scores.

5. If evidence is insufficient, award the lower band.

6. Band scores:
- 0.0 - 9.0
- increments of 0.5 only.
Each correction must include:
 
- original
- corrected
- explanation
 
Explanation MUST be written in VIETNAMESE.
 
Explain WHY the mistake affects the IELTS score whenever possible.
 
Do NOT include stylistic preferences.
 
========================
JSON
========================
 
Return ONLY valid JSON.
 
No markdown.
 
No code fences.
 
No additional text.
 
Use EXACTLY this schema:
 
{
  "overall_band": number,
  "examiner_summary": string,
  "task1": {
    "band": number,
    "TA": integer,
    "CC": integer,
    "LR": integer,
    "GRA": integer
  } | null,
  "task2": {
    "band": number,
    "TR": integer,
    "CC": integer,
    "LR": integer,
    "GRA": integer
  } | null,
  "corrections": [
    {
      "original": string,
      "corrected": string,
      "explanation": string
    }
  ]
}
`;

async function gradeWithGroq(content: string, testPrompt: string): Promise<GradingFeedback> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Prompt: ${testPrompt}\n\nEssay: ${content}` },
    ],
  });

  return JSON.parse(completion.choices[0]?.message?.content || "{}");
}

async function gradeWithGemini(content: string, testPrompt: string): Promise<GradingFeedback> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent(`Prompt: ${testPrompt}\n\nEssay: ${content}`);
  return JSON.parse(result.response.text());
}

export async function gradeSubmission(content: string, testPrompt: string): Promise<GradingFeedback> {
  const cleanedContent = cleanEssayContent(content); // ← điểm sửa quan trọng nhất

  try {
    return await gradeWithGroq(cleanedContent, testPrompt);
  } catch (groqError) {
    console.warn("Groq grading failed, falling back to Gemini:", groqError);
    return await gradeWithGemini(cleanedContent, testPrompt);
  }
}