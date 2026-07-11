import OpenAI from "openai";
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

// Khởi tạo client OpenAI nhưng trỏ đường dẫn về máy chủ của Groq
const groq = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY, 
  baseURL: "https://api.groq.com/openai/v1" 
});

export async function gradeSubmission(content: string, testPrompt: string): Promise<GradingFeedback> {
  try {
    const completion = await groq.chat.completions.create({
      // Llama 3 70B là mô hình rất thông minh của Meta, được Groq hỗ trợ chạy miễn phí
      model: "llama3-70b-8192", 
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Prompt: ${testPrompt}\n\nEssay: ${content}` },
      ],
    });

    return JSON.parse(completion.choices[0]?.message.content || "{}");
  } catch (error) {
    console.error("Lỗi khi chấm bài bằng Groq:", error);
    throw new Error("Hệ thống chấm điểm AI đang bận. Vui lòng thử lại sau.");
  }
}