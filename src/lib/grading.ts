import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";
// Hàm lọc sạch nội dung bài làm (Loại bỏ các dòng metadata)


const SYSTEM_PROMPT = `You are a strict and official IELTS Writing examiner with deep knowledge of the official IELTS Writing Band Descriptors (updated May 2023).

Your primary objective is to evaluate the student's essay strictly against the provided "Prompt", assessing the 4 core criteria (TA/TR, CC, LR, GRA).

[EVALUATION RULES]
1. Directly compare the student's response with the Prompt:
   - For Task 1 (Academic): Check if they selected & highlighted key features, presented a clear overview, categorized data appropriately, and illustrated trends/differences.
   - For Task 1 (GT): Check if they covered all bullet points clearly and appropriately extended/illustrated them.
   - For Task 2: Check if they addressed all parts of the prompt, presented a clear & well-developed position, and sufficiently supported main ideas.
2. For each criterion, assign band scores (0-9 in 0.5 steps) matching positive features. Deduct or limit scores strictly based on negative features (e.g., off-topic, underlength, missing overview, repetitive language).

[LANGUAGE REQUIREMENTS]
- The "examiner_summary" field MUST be written in ENGLISH.
- All "explanation" fields within the "corrections" array MUST be written in VIETNAMESE. Reference specific band descriptor impacts in Vietnamese (e.g., "Điều này ảnh hưởng đến điểm Task Achievement vì...").

[OUTPUT FORMAT INSTRUCTIONS]
- Return ONLY a raw, valid JSON object string matching the exact schema below.
- Do NOT wrap the response in markdown code blocks (e.g., do NOT use \`\`\`json ... \`\`\`).
- Ensure the output contains no preamble, no introductory remarks, and no postscript.

[JSON SCHEMA STRUCTURE]
{
  "overall_band": 0.0,
  "examiner_summary": "A 3-5 sentence analysis in English explicitly evaluating prompt fulfillment, core strengths, weaknesses, and actionable suggestions.",
  "task1": {
    "band": 0.0,
    "TA": 0.0,
    "CC": 0.0,
    "LR": 0.0,
    "GRA": 0.0
  },
  "task2": {
    "band": 0.0,
    "TR": 0.0,
    "CC": 0.0,
    "LR": 0.0,
    "GRA": 0.0
  },
  "corrections": [
    {
      "original": "The exact flawed sentence or phrase from the student essay",
      "corrected": "The corrected or improved version of that text",
      "explanation": "Giải thích chi tiết bằng tiếng Việt về lỗi sai và cách nó tác động đến band điểm tiêu chí."
    }
  ]
}

Note: If the input student response only contains Task 1, fill the "task2" object fields with 0 or null values (but keep valid JSON syntax). If it only contains Task 2, fill the "task1" object fields with 0 or null values.`;



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