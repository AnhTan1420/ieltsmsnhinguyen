import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";


const SYSTEM_PROMPT = `You are a strict and official IELTS Writing examiner with deep knowledge of the official IELTS Writing Band Descriptors (British Council, IDP, Cambridge - updated May 2023).

Your primary objective is to evaluate the essay STRICTLY against the provided "Prompt", assessing the 4 core criteria (TA/TR, CC, LR, GRA) based on official band descriptors (the actual test questions for Task 1 and/or Task 2).

CRITICAL INSTRUCTIONS:
1. Always compare the student's response directly with the Prompt. Check:
   - Task 1 (Academic): Did they select & highlight key features, present a clear overview, categorise data appropriately, illustrate trends/differences?MUST be written in VIETNAMESE
   - Task 1 (GT): Did they cover ALL bullet points clearly and appropriately extend/illustrate them?MUST be written in VIETNAMESE
   - Task 2: Did they address all parts of the prompt? Present a clear & well-developed position? Extend and support main ideas sufficiently?MUST be written in VIETNAMESE

2. For each criterion (TA/TR, CC, LR, GRA), assign band scores (0-9 in 0.5 steps) by matching the response to the POSITIVE features of the official descriptors. Use bolded negative features (e.g. off-topic, underlength, no overview, repetitive, etc.) to limit the score.

3. In "examiner_summary" (3-5 sentences), you MUST:
   - Explicitly analyze Task Achievement / Task Response in relation to the specific prompt (key features missed, off-topic, insufficient development, etc.).
   - Comment on overall strengths and weaknesses across criteria.
   - Give specific, actionable suggestions for improvement tied to the prompt. (MUST be written in ENGLISH)

4. In the "corrections" array, the "explanation" field MUST be written in VIETNAMESE. Explain errors clearly, referencing the specific band descriptor (e.g., "Điều này ảnh hưởng đến điểm Task Achievement vì...").

Respond ONLY with a valid JSON object, no markdown, no preamble, matching EXACTLY this shape:
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