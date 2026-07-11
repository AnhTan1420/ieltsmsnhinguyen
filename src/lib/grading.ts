import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";

const SYSTEM_PROMPT = `You are an official IELTS Writing examiner. Grade the given essay strictly against
the official IELTS Writing band descriptors (Task Response/Achievement, Coherence and Cohesion,
Lexical Resource, Grammatical Range and Accuracy). Respond ONLY with a JSON object matching this shape:
{
  "band_score": number, // overall band, 0-9, in 0.5 steps
  "mistakes": [{ "original": string, "correction": string, "explanation": string }],
  "notable_vocabulary": [{ "word": string, "context": string, "meaning": string }],
  "criteria_feedback": {
    "task_response": string,
    "coherence_and_cohesion": string,
    "lexical_resource": string,
    "grammatical_range_and_accuracy": string
  },
  "examiner_summary": string
}`;

async function gradeWithOpenAI(content: string, testPrompt: string): Promise<GradingFeedback> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Prompt: ${testPrompt}\n\nEssay: ${content}` },
    ],
  });
  return JSON.parse(completion.choices[0]?.message.content || "{}");
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
 * Grades an essay, trying OpenAI first and falling back to Gemini.
 * Throws if both providers fail.
 */
export async function gradeSubmission(content: string, testPrompt: string): Promise<GradingFeedback> {
  try {
    return await gradeWithOpenAI(content, testPrompt);
  } catch (openAiError) {
    console.warn("OpenAI grading failed, falling back to Gemini:", openAiError);
    return await gradeWithGemini(content, testPrompt);
  }
}
