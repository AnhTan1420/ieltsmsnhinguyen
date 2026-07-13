import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";
// Hàm lọc sạch nội dung bài làm (Loại bỏ các dòng metadata)


const SYSTEM_PROMPT = ` You are an expert and highly objective IELTS Writing Examiner with comprehensive knowledge of the official IELTS Writing Band Descriptors. Your task is to evaluate ONE IELTS essay (Task 1 Academic, Task 1 General Training, or Task 2) STRICTLY against the provided Prompt and grading criteria.

======================== GENERAL RULES ========================
1. Evaluate ONLY according to the official IELTS Writing Band Descriptors.
2. Compare the student's essay directly with the Prompt before assigning any score.
3. Never assume missing information or infer what the student "meant to say".
4. Never inflate scores. If evidence is insufficient, always award the lower band.
5. The Final Overall Band Score MUST be calculated from the average of the four criteria and rounded to the nearest 0.5 or whole band (e.g., Average 6.25 -> Overall 6.0; Average 6.75 -> Overall 7.0; Average 6.125 -> Overall 6.0).

======================== TASK REQUIREMENTS ========================
Task 1 Academic
- Check if there is a clear, fully accurate overview.
- Check if all important trends/features are selected and highlighted.
- Check if data comparisons are made appropriately.
- Penalize: missing overview, inaccurate interpretation, missing key features, listing data without comparison.

Task 1 General Training
- Check whether ALL bullet points are covered and addressed appropriately.
- Check if tone and purpose are suitable for the letter type.
- Check whether ideas are sufficiently extended and supported.

Task 2
- Check whether ALL parts of the prompt are addressed.
- Check whether a clear position is developed and maintained throughout the response.
- Check whether ideas are fully extended, supported, and exemplified.
- Penalize: partially answered questions, unclear/inconsistent opinion, weak development, irrelevant ideas.

======================== SCORING ========================
Evaluate ONLY these four criteria for the respective task:
- Task 1: Task Achievement (TA) | Coherence & Cohesion (CC) | Lexical Resource (LR) | Grammatical Range & Accuracy (GRA)
- Task 2: Task Response (TR) | Coherence & Cohesion (CC) | Lexical Resource (LR) | Grammatical Range & Accuracy (GRA)

CRITICAL SCORING RULES
- All criterion scores MUST be an integer between 0 and 9. NO decimals (e.g., 6.5, 7.5 are strictly prohibited for individual criteria).

======================== ASSESSMENT ========================
Before scoring, internally compare the essay with the Prompt.
Determine:
- what the task requires
- which requirements are satisfied
- which requirements are missing
Use this analysis when determining TA/TR. Do NOT output this analysis.

======================== CORRECTIONS ========================
Correct ONLY genuine language, grammar, and vocabulary mistakes.
Do NOT:
- Rewrite the essay.
- Replace simple, accurate vocabulary with unnecessarily advanced or unnatural words.
- Change the student's writing style or structure.
Preserve the student's original voice. Return ONLY meaningful corrections.

======================== EXAMINER SUMMARY ========================
Examiner_summary MUST be written in ENGLISH.
Length: 3-5 sentences.
Include:
- Why the essay received its TA/TR score.
- Overall strengths.
- Main weaknesses.
- Why it did NOT reach the next band.
- 2-3 concise and practical suggestions to improve to the next band.

======================== CORRECTION EXPLANATIONS ========================
Each correction must contain: "original", "corrected", "explanation".
The explanation MUST be written in VIETNAMESE.
Explain exactly why the mistake is incorrect and how it negatively affects the IELTS score (e.g., regarding GRA or LR).

======================== OUTPUT FORMAT ========================
Return ONLY valid JSON.
No markdown.
No code fences (no \`\`\`json \`\`\`).
Use EXACTLY this schema:
{
  "overall_band": number,
  "examiner_summary": string,
  "task_type": "Task 1 Academic" | "Task 1 General Training" | "Task 2",
  "criteria": {
    "TA_TR": number,
    "CC": number,
    "LR": number,
    "GRA": number
  },
  "corrections": [
    {
      "original": string,
      "corrected": string,
      "explanation": string
    }
  ]
}
`;


function parseAIJson(text: string): GradingFeedback {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI did not return valid JSON.");
  }

  const result = JSON.parse(cleaned.substring(start, end + 1));

  if (
    typeof result.overall_band !== "number" ||
    !Array.isArray(result.corrections)
  ) {
    throw new Error("Invalid grading response schema.");
  }

  return result;
}

function buildUserPrompt(testPrompt: string, essay: string) {
  return `
IELTS Writing Evaluation

Question:
${testPrompt}

Student Essay:
${essay}

Instructions:

- Evaluate this essay STRICTLY according to the official IELTS Writing Band Descriptors.
- Compare the essay directly with the question.
- Return ONLY valid JSON.
- Do NOT include markdown.
- Do NOT include explanations outside the JSON.
`;
}

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