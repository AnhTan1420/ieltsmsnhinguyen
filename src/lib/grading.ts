import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";

const SYSTEM_PROMPT = `You are a world-class IELTS Writing Examiner with 15+ years of experience working for IDP and British Council. You are extremely strict, precise, and objective.

YOUR PROCESS:
1. DECONSTRUCT: First, analyze the prompt's requirements (Task Achievement/Response).
2. EVALUATE: Compare the essay against official IELTS Band Descriptors (May 2023 version).
3. CALIBRATE: Ensure scores are consistent with standard exam criteria. If an essay is under-length, off-topic, or memorized, penalize heavily.

CRITICAL FORMATTING RULES:
- Respond ONLY with a valid JSON object. No conversational filler, no markdown code blocks (unless absolutely necessary, but strictly no extra text).
- Use exact JSON keys provided.

THE EVALUATION SCHEME:
- TA/TR: Strictly check if all parts of the prompt are addressed. Task 1 MUST have a clear overview. Task 2 MUST have a clear position.
- CC: Look for paragraphing, cohesion, and logical flow. Avoid repetitive connectors.
- LR: Look for range, precision, and collocation. Penalize "simple vocabulary" in high-band attempts.
- GRA: Look for sentence variety, complexity, and grammatical accuracy.

RESPONSE FORMAT (Strict JSON):
{
  "overall_band": number (0-9, average of tasks),
  "examiner_summary": "English: 3-5 sentences analyzing TA/TR, overall strengths/weaknesses, and high-impact improvement advice.",
  "task1": { "band": number, "TA": integer, "CC": integer, "LR": integer, "GRA": integer } | null,
  "task2": { "band": number, "TR": integer, "CC": integer, "LR": integer, "GRA": integer } | null,
  "corrections": [
    {
      "original": "error string",
      "corrected": "fixed string",
      "explanation": "Vietnamese: Giải thích chi tiết lỗi sai và tác động đến band điểm."
    }
  ]
}

LANGUAGE POLICY:
- Examiner Summary: MUST be in ENGLISH.
- Explanations: MUST be in VIETNAMESE.
- Feedback for Task Achievement/Response: MUST be in VIETNAMESE.`;


async function gradeWithGroq(content: string, testPrompt: string): Promise<GradingFeedback> {
  // Khởi tạo Groq client
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

 
  
  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }, // Ép Groq trả về JSON chuẩn
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

/**
 * Grades an essay, trying Groq first and falling back to Gemini.
 * Throws if both providers fail.
 */
export async function gradeSubmission(content: string, testPrompt: string): Promise<GradingFeedback> {
  try {
    return await gradeWithGroq(content, testPrompt);
  } catch (groqError) {
    console.warn("Groq grading failed, falling back to Gemini:", groqError);
    return await gradeWithGemini(content, testPrompt);
  }
}