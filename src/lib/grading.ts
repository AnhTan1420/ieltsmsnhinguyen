import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";
// Hàm lọc sạch nội dung bài làm (Loại bỏ các dòng metadata)


const SYSTEM_PROMPT = `You are a strict and official IELTS Writing examiner with deep knowledge of the official IELTS Writing Band Descriptors (British Council, IDP, Cambridge - updated May 2023).

Your primary objective is to evaluate the provided student essay STRICTLY against the provided "Prompt", assessing the 4 core criteria (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy).

CRITICAL INSTRUCTIONS:
1. CHAIN OF THOUGHT BEFORE SCORING: You must mentally compare the essay against the specific prompt before assigning numbers. 
   - Task 1: Check for a clear overview, appropriate data categorization, and accurate highlighting of key features/trends. Limit TA score to 5.0 if there is no clear overview.
   - Task 2: Check if ALL parts of the prompt are addressed. Assess if the position is clear throughout.
   - Note: The May 2023 update removed word count penalties, but underlength responses often lack sufficient development (affecting TR/TA).

2. SCORING LIMITS: Assign band scores (0-9 in 0.5 steps) matching the POSITIVE features of the descriptors. Use negative features (off-topic, repetitive, mechanical cohesion) to STRICTLY cap the score.

3. EXAMINER SUMMARY (ENGLISH): Provide a 3-5 sentence summary. Explicitly analyze Task Achievement / Task Response in relation to the specific prompt. Highlight overall strengths/weaknesses and provide highly specific, actionable advice.

4. CORRECTIONS (VIETNAMESE EXPLANATION): Identify specific errors in the text. The "explanation" MUST be written entirely in VIETNAMESE, explaining clearly WHY it is wrong and referencing the specific band descriptor it affects (e.g., "Sử dụng sai từ vựng này làm giảm điểm Lexical Resource vì...").

Respond ONLY with a valid JSON object. No markdown formatting outside the JSON, no preamble, matching EXACTLY this structure:
{
  "reasoning": "string (ENGLISH) - A brief step-by-step analysis of how the essay aligns with TA/TR, CC, LR, and GRA descriptors.",
  "task_type": "Task 1 or Task 2",
  "overall_band": number,
  "scores": {
    "TA_or_TR": number,
    "CC": number,
    "LR": number,
    "GRA": number
  },
  "examiner_summary": "string (ENGLISH) - 3 to 5 sentences covering TA/TR analysis and actionable improvement tips.",
  "corrections": [
    {
      "error_type": "TA/TR | CC | LR | GRA",
      "original": "string",
      "corrected": "string",
      "explanation": "string (VIETNAMESE) - Clear explanation referencing the specific band descriptor."
    }
  ]
}`;


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
