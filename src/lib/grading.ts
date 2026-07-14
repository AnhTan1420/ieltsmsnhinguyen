import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";

type TaskType = "task1" | "task2";

const TASK_CONFIG = {
  task1: {
    label:           "Task 1 (Academic / General Training)",
    primaryFocus:    "Task Achievement (TA) and Coherence & Cohesion (CC)",
    criterionLabel:  "Task Achievement",
    promptAnalysis: `## PROMPT ANALYSIS (Task Achievement Pre-check)
Briefly analyse the chart / graph / map / letter prompt.
- Main trend or purpose that MUST appear in the overview
- Key features that MUST be highlighted and compared
- Specific data points or bullet points that cannot be missed`,
    currentBandNote:
      "Did the essay present a clear overview? Were key features selected and compared — not every data point listed?",
  },
  task2: {
    label:           "Task 2 (Academic / General Training)",
    primaryFocus:    "Task Response (TR) and Coherence & Cohesion (CC)",
    criterionLabel:  "Task Response",
    promptAnalysis: `## PROMPT ANALYSIS (Task Response Pre-check)
Briefly unpack the provided question.
- Core topic
- ALL parts of the question that MUST be addressed (both views / causes & solutions / etc.)
- What position or opinion is required`,
    currentBandNote:
      "Did the essay address ALL parts of the question? Is the position clear and consistently maintained? Were ideas extended with examples and analysis — not just asserted?",
  },
} as const;

function buildSystemPrompt(taskType: TaskType): string {
  const t = TASK_CONFIG[taskType];

  return `Act as a strict and highly experienced IELTS Examiner with 15+ years of Cambridge Assessment English certification. Grade the IELTS Writing ${t.label} based strictly on the official public band descriptors (British Council / IDP / Cambridge, May 2023 revision).

CORE INSTRUCTIONS:
1. FOCUS HEAVILY on ${t.primaryFocus}.
   ${t.currentBandNote}
2. For Lexical Resource (LR) and Grammatical Range & Accuracy (GRA), ONLY correct actual errors — grammar, spelling, unnatural collocations. DO NOT rewrite the entire essay. Preserve the original voice.
3. Band scores use 0.5 steps only (5.0 / 5.5 / 6.0 … 9.0). Overall and Task bands MUST be half-bands. Component scores (${t.criterionLabel === "Task Achievement" ? "TA" : "TR"}, CC, LR, GRA) MUST be whole integers (1–9).
4. Justifications MUST quote specific phrases from the essay. Generic feedback is not acceptable.
5. Only give a roadmap to Band 8.0 / 9.0 when current score is already 7.0+. Otherwise target the band immediately above.
6. "explanation" fields in the corrections array MUST be written in VIETNAMESE.
7. "examiner_summary" MUST be written in ENGLISH.

─────────────────────────────────────────
REQUIRED RESPONSE STRUCTURE — use these EXACT section headers in this EXACT order
─────────────────────────────────────────

${t.promptAnalysis}

## OVERALL & COMPONENT SCORES
- Overall Band Score: X.X (Must be a half-band, e.g., 6.0, 6.5)
- ${t.criterionLabel}: X (Must be an integer 1-9)
- Coherence & Cohesion: X (Must be an integer 1-9)
- Lexical Resource: X (Must be an integer 1-9)
- Grammatical Range & Accuracy: X (Must be an integer 1-9)

## BAND PROGRESSION ANALYSIS

### Current Band [X.X] — Why this score
${t.currentBandNote}
Cite specific phrases from the essay to justify the score.

### Why not Band [X.X − 0.5]
Name at least one concrete feature the essay demonstrated that earns the higher score.

### Why not Band [X.X + 0.5]
Name exactly what is missing or flawed — specific sentences, missing features, or recurring error patterns.

### Next Band Roadmap [X.X + 0.5]
2–3 SPECIFIC, ACTIONABLE steps referencing actual sentences or paragraphs from THIS essay.
(Target Band 8.0+ only when current score is already 7.0+.)

## LIGHTLY CORRECTED ESSAY
Reproduce the full essay with minimal targeted corrections only.
Use **bold** for every changed word or phrase. Do not rewrite for style.

## SUGGESTED VOCABULARY & STRUCTURES
| Original | Better Alternative | Why it's better |
|----------|--------------------|-----------------|
| ...      | ...                | ...             |

Provide 1–2 advanced sentence structures tailored to this specific essay's topic.
Show a concrete example sentence — not a generic template.

─────────────────────────────────────────
JSON OUTPUT — append after all sections above
─────────────────────────────────────────
After the structured markdown sections, output a single valid JSON object.
No markdown fences. No preamble. Match EXACTLY this shape:

{
  "overall_band": number, // MUST be a half-band (e.g., 5.0, 5.5, 6.0)
  "examiner_summary": string,
  "task1": {
    "band": number, // MUST be a half-band
    "TA": number,   // MUST be an integer 1-9
    "CC": number,   // MUST be an integer 1-9
    "LR": number,   // MUST be an integer 1-9
    "GRA": number   // MUST be an integer 1-9
  } | null,
  "task2": {
    "band": number, // MUST be a half-band
    "TR": number,   // MUST be an integer 1-9
    "CC": number,   // MUST be an integer 1-9
    "LR": number,   // MUST be an integer 1-9
    "GRA": number   // MUST be an integer 1-9
  } | null,
  "corrections": [
    {
      "original": string,
      "corrected": string,
      "explanation": string
    }
  ]
}`;
}

// ─────────────────────────────────────────────────────────────
// Helper: Trích xuất khối JSON an toàn nằm ở cuối chuỗi phản hồi
// ─────────────────────────────────────────────────────────────
function extractJson(raw: string): GradingFeedback {
  // Tìm từ khóa đặc trưng của Object JSON gốc để tránh bắt nhầm các dấu ngoặc nhọn {} trong bài viết
  const jsonStartMarker = raw.lastIndexOf('"overall_band"');
  if (jsonStartMarker === -1) {
    throw new Error("No valid JSON structure found in AI response");
  }

  // Tìm dấu mở ngoặc gốc '{' đứng trước cụm '"overall_band"' gần nhất
  const start = raw.lastIndexOf("{", jsonStartMarker);
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("Invalid JSON block boundaries");
  }

  const jsonString = raw.slice(start, end + 1).trim();
  return JSON.parse(jsonString) as GradingFeedback;
}

// ─────────────────────────────────────────────────────────────
// Provider: Gemini (Primary)
// ─────────────────────────────────────────────────────────────
async function gradeWithGemini(
  content: string,
  testPrompt: string,
  taskType: TaskType,
): Promise<GradingFeedback> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model:             "gemini-2.5-flash",
    systemInstruction: buildSystemPrompt(taskType),
    generationConfig:  { temperature: 0.2 },
  });

  const result = await model.generateContent(
    `Prompt:\n${testPrompt}\n\nEssay:\n${content}`,
  );
  return extractJson(result.response.text());
}

// ─────────────────────────────────────────────────────────────
// Provider: Groq (Fallback)
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
    messages: [
      { role: "system", content: buildSystemPrompt(taskType) },
      { role: "user",   content: `Prompt:\n${testPrompt}\n\nEssay:\n${content}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  return extractJson(raw);
}

// ─────────────────────────────────────────────────────────────
// Public API — Gemini trước, Groq dự phòng
// ─────────────────────────────────────────────────────────────
export async function gradeSubmission(
  content: string,
  testPrompt: string,
  taskType: TaskType = "task2",
): Promise<GradingFeedback> {
  try {
    return await gradeWithGemini(content, testPrompt, taskType);
  } catch (geminiError) {
    console.warn("[grader] Gemini failed, falling back to Groq:", geminiError);
    return await gradeWithGroq(content, testPrompt, taskType);
  }
}
