import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GradingFeedback } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Unified prompt builder — one function for Task 1 & Task 2
// Replaces TASK1_SYSTEM_PROMPT + TASK2_SYSTEM_PROMPT constants
// ─────────────────────────────────────────────────────────────

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
3. SCORING FORMAT — follow IELTS official rounding exactly:
   - Component scores (TA/TR, CC, LR, GRA): whole integers only — 1, 2, 3 … 9. Never decimals.
   - Task band & overall_band: rounded to nearest 0.5 — valid values: 4.0 4.5 5.0 5.5 6.0 6.5 7.0 7.5 8.0 8.5 9.0
     Formula: task band = mean of 4 components, rounded to nearest 0.5
     Example: TA=6 CC=7 LR=7 GRA=7 → mean=6.75 → rounds to 7.0
     Example: TA=6 CC=6 LR=7 GRA=7 → mean=6.5 → stays 6.5
4. Justifications MUST quote specific phrases from the essay. Generic feedback is not acceptable.
5. Only give a roadmap to Band 8.0 / 9.0 when current score is already 7.0+. Otherwise target the band immediately above.
6. "explanation" fields in the corrections array MUST be written in VIETNAMESE.
7. "examiner_summary" MUST be written in ENGLISH.

─────────────────────────────────────────
REQUIRED RESPONSE STRUCTURE — use these EXACT section headers in this EXACT order
─────────────────────────────────────────

${t.promptAnalysis}

## OVERALL & COMPONENT SCORES
- Overall Band Score: X.X
- ${t.criterionLabel}: X.X
- Coherence & Cohesion: X.X
- Lexical Resource: X.X
- Grammatical Range & Accuracy: X.X

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
  "overall_band": number,        // half-band: 5.0 / 5.5 / 6.0 / 6.5 / 7.0 / 7.5 / 8.0 / 8.5 / 9.0
  "examiner_summary": string,
  "task1": {
    "band": number,              // half-band (mean of TA+CC+LR+GRA rounded to nearest 0.5)
    "TA": number,                // integer 1–9
    "CC": number,                // integer 1–9
    "LR": number,                // integer 1–9
    "GRA": number                // integer 1–9
  } | null,
  "task2": {
    "band": number,              // half-band (mean of TR+CC+LR+GRA rounded to nearest 0.5)
    "TR": number,                // integer 1–9
    "CC": number,                // integer 1–9
    "LR": number,                // integer 1–9
    "GRA": number                // integer 1–9
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
// Helpers
// ─────────────────────────────────────────────────────────────

/** Round x to nearest 0.5, clamped to [1, 9] — for task band & overall_band */
function toHalfBand(x: number): number {
  return Math.round(Math.min(Math.max(x, 1), 9) * 2) / 2;
}

/** Round x to nearest integer, clamped to [1, 9] — for component scores */
function toInteger(x: number): number {
  return Math.round(Math.min(Math.max(x, 1), 9));
}

/**
 * Sanitize AI output to enforce IELTS scoring rules:
 * - Component scores (TA/TR, CC, LR, GRA) → integer 1–9
 * - Task band & overall_band → half-band (nearest 0.5)
 */
function sanitizeBands(raw: GradingFeedback): GradingFeedback {
  if (raw.task1) {
    raw.task1.TA  = toInteger(raw.task1.TA);
    raw.task1.CC  = toInteger(raw.task1.CC);
    raw.task1.LR  = toInteger(raw.task1.LR);
    raw.task1.GRA = toInteger(raw.task1.GRA);
    // Recalculate band from components if AI got it wrong
    const mean = (raw.task1.TA + raw.task1.CC + raw.task1.LR + raw.task1.GRA) / 4;
    raw.task1.band = toHalfBand(mean);
  }
  if (raw.task2) {
    raw.task2.TR  = toInteger(raw.task2.TR);
    raw.task2.CC  = toInteger(raw.task2.CC);
    raw.task2.LR  = toInteger(raw.task2.LR);
    raw.task2.GRA = toInteger(raw.task2.GRA);
    const mean = (raw.task2.TR + raw.task2.CC + raw.task2.LR + raw.task2.GRA) / 4;
    raw.task2.band = toHalfBand(mean);
  }
  // overall_band: T1 × 1/3 + T2 × 2/3 (or just the task that exists)
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
function extractJson(raw: string): GradingFeedback {
  const end = raw.lastIndexOf("}");
  if (end === -1) {
    throw new Error("Không tìm thấy dấu đóng ngoặc nhọn '}' nào trong phản hồi của AI.");
  }

  let balance = 0;
  let start = -1;

  // ĐI NGƯỢC từ dấu '}' cuối cùng về đầu để tìm dấu '{' cặp với nó
  for (let i = end; i >= 0; i--) {
    if (raw[i] === "}") balance++;
    if (raw[i] === "{") balance--;

    // Khi balance về đúng 0, ta đã tìm được dấu { ngoài cùng của Object cha
    if (balance === 0) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    throw new Error("Không tìm thấy dấu mở ngoặc '{' tương ứng với khối JSON.");
  }

  const jsonString = raw.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonString) as GradingFeedback;
    return sanitizeBands(parsed);
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
    model:       process.env.GROQ_MODEL ?? "llama-3.3-70b-specdec",
    temperature: 0.2,
    // No response_format: json_object — response is markdown + JSON mixed
    messages: [
      { role: "system", content: buildSystemPrompt(taskType) },
      { role: "user",   content: `Prompt:\n${testPrompt}\n\nEssay:\n${content}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  return extractJson(raw);
}

// ─────────────────────────────────────────────────────────────
// Provider: Gemini (fallback)
// ─────────────────────────────────────────────────────────────
async function gradeWithGemini(
  content: string,
  testPrompt: string,
  taskType: TaskType,
): Promise<GradingFeedback> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model  = genAI.getGenerativeModel({
    model:             "gemini-1.5-flash",
    systemInstruction: buildSystemPrompt(taskType),
    generationConfig:  { temperature: 0.2 },
    // No responseMimeType: json — response is markdown + JSON mixed
  });

  const result = await model.generateContent(
    `Prompt:\n${testPrompt}\n\nEssay:\n${content}`,
  );
  return extractJson(result.response.text());
}

// ─────────────────────────────────────────────────────────────
// Public API — Groq first, Gemini fallback
// ─────────────────────────────────────────────────────────────

/**
 * Grades an IELTS Writing submission.
 * @param content    - Student essay text
 * @param testPrompt - The IELTS writing question / chart description
 * @param taskType   - "task1" | "task2" — drives the scoring criteria and prompt sections
 */
export async function gradeSubmission(
  content: string,
  testPrompt: string,
  taskType: TaskType = "task2",
): Promise<GradingFeedback> {
  try {
    return await gradeWithGroq(content, testPrompt, taskType);
  } catch (groqError) {
    console.warn("[grader] Groq failed, falling back to Gemini:", groqError);
    return await gradeWithGemini(content, testPrompt, taskType);
  }
}
