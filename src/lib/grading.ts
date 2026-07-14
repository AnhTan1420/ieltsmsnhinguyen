import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import type { GradingFeedback } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Unified prompt builder — one function for Task 1 & Task 2
// ─────────────────────────────────────────────────────────────

type TaskType = "task1" | "task2";

const TASK_CONFIG = {
  task1: {
    label: "Task 1 (Academic / General Training)",
    primaryFocus: "Task Achievement (TA) and Coherence & Cohesion (CC)",
    criterionLabel: "Task Achievement",
    promptAnalysis: `## PROMPT ANALYSIS (Task Achievement Pre-check)
- Core trend/purpose required in overview.
- Key features to be highlighted/compared.
- Crucial data points that cannot be missed.`,
    currentBandNote: "Clear overview presented? Key features selected/compared appropriately rather than listing all data?",
  },
  task2: {
    label: "Task 2 (Academic / General Training)",
    primaryFocus: "Task Response (TR) and Coherence & Cohesion (CC)",
    criterionLabel: "Task Response",
    promptAnalysis: `## PROMPT ANALYSIS (Task Response Pre-check)
- Core topic and position required.
- Have ALL parts of the prompt been addressed?`,
    currentBandNote: "All parts addressed? Position clear/consistent? Ideas extended with relevant examples?",
  },
} as const;

function buildSystemPrompt(taskType: TaskType): string {
  const t = TASK_CONFIG[taskType];

  return `You are a strict, veteran IELTS Examiner (15+ years experience). Grade the IELTS Writing ${t.label} using the official May 2023 public band descriptors.

CORE INSTRUCTIONS:
1. FOCUS: Heavily evaluate ${t.primaryFocus}. ${t.currentBandNote}
2. COMPONENT SCORES (TA/TR, CC, LR, GRA): Must be whole integers (1-9).
3. BAND SCORE MATH: Average the 4 components. Round DOWN to nearest 0.5 if ending in .25, round UP to nearest 0.5 if ending in .75 (e.g., 6.25 -> 6.5 | 6.75 -> 7.0).
4. CORRECTIONS: Only fix factual language errors (grammar, spelling, unnatural phrasing). Preserve candidate's voice.
5. JUSTIFICATION: Quote specific words/phrases from the essay. No generic feedback.
6. ROADMAP: Target the next 0.5 band up. (Only target 8.0+ if current score is >= 7.0).
7. LANGUAGE: "explanation" fields in the JSON MUST be in VIETNAMESE. "examiner_summary" MUST be in ENGLISH.

─────────────────────────────────────────
REQUIRED RESPONSE STRUCTURE (Exact Headers)
─────────────────────────────────────────

${t.promptAnalysis}

## OVERALL & COMPONENT SCORES
- Overall Band Score: X.X
- ${t.criterionLabel}: X
- Coherence & Cohesion: X
- Lexical Resource: X
- Grammatical Range & Accuracy: X

## BAND PROGRESSION ANALYSIS

### Current Band [X.X]
[Justify with specific quotes from the essay]

### Why not [X.X − 0.5]
[Identify one concrete strength earning the current score]

### Why not [X.X + 0.5]
[Identify specific missing features or recurring errors]

### Next Band Roadmap [X.X + 0.5]
[2-3 actionable steps quoting the text]

## TARGETED CORRECTIONS
Extract ONLY the sentences with errors and correct them. Use **bold** for changed words. Do NOT reproduce the entire essay if it is not necessary.

## SUGGESTED VOCABULARY & STRUCTURES
| Original | Better Alternative | Why it's better |
|----------|--------------------|-----------------|
| ...      | ...                | ...             |

Provide 1-2 advanced sentence structures tailored to this topic.

─────────────────────────────────────────
JSON OUTPUT
─────────────────────────────────────────
Output ONLY a single valid JSON object after the markdown sections.
Do NOT wrap it in markdown fences (\`\`\`). Match this shape exactly:

{
  "overall_band": number,
  "examiner_summary": string,
  "task1": { "band": number, "TA": number, "CC": number, "LR": number, "GRA": number } | null,
  "task2": { "band": number, "TR": number, "CC": number, "LR": number, "GRA": number } | null,
  "corrections": [ { "original": string, "corrected": string, "explanation": string } ]
}`;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toHalfBand(x: number): number {
  return Math.round(Math.min(Math.max(x, 1), 9) * 2) / 2;
}

function toInteger(x: number): number {
  return Math.round(Math.min(Math.max(x, 1), 9));
}

/**
 * Sanitize AI output
 */
function sanitizeBands(raw: GradingFeedback, taskType: TaskType): GradingFeedback {
  if (taskType === "task1" && !raw.task1 && raw.task2) {
    raw.task1 = raw.task2 as any;
    raw.task2 = null;
  } else if (taskType === "task2" && !raw.task2 && raw.task1) {
    raw.task2 = raw.task1 as any;
    raw.task1 = null;
  }

  if (raw.task1) {
    const taScore = raw.task1.TA ?? (raw.task1 as any).TR ?? 1;
    raw.task1.TA  = toInteger(taScore);
    raw.task1.CC  = toInteger(raw.task1.CC ?? 1);
    raw.task1.LR  = toInteger(raw.task1.LR ?? 1);
    raw.task1.GRA = toInteger(raw.task1.GRA ?? 1);
    const mean = (raw.task1.TA + raw.task1.CC + raw.task1.LR + raw.task1.GRA) / 4;
    raw.task1.band = toHalfBand(mean);
  }

  if (raw.task2) {
    const trScore = raw.task2.TR ?? (raw.task2 as any).TA ?? 1;
    raw.task2.TR  = toInteger(trScore);
    raw.task2.CC  = toInteger(raw.task2.CC ?? 1);
    raw.task2.LR  = toInteger(raw.task2.LR ?? 1);
    raw.task2.GRA = toInteger(raw.task2.GRA ?? 1);
    const mean = (raw.task2.TR + raw.task2.CC + raw.task2.LR + raw.task2.GRA) / 4;
    raw.task2.band = toHalfBand(mean);
  }

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
function extractJson(raw: string, taskType: TaskType): GradingFeedback {
  const end = raw.lastIndexOf("}");
  if (end === -1) {
    throw new Error("Không tìm thấy dấu đóng ngoặc nhọn '}' nào trong phản hồi của AI.");
  }

  let balance = 0;
  let start = -1;

  for (let i = end; i >= 0; i--) {
    if (raw[i] === "}") balance++;
    if (raw[i] === "{") balance--;

    if (balance === 0) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    throw new Error("Không tìm thấy dấu mở ngoặc '{' tương ứng với khối JSON.");
  }

  // Dọn dẹp thêm nếu AI vô tình chèn markdown fences vào TRONG khối chuỗi cắt được
  const jsonString = raw.slice(start, end + 1).replace(/```json/g, "").replace(/```/g, "");

  try {
    const parsed = JSON.parse(jsonString) as GradingFeedback;
    return sanitizeBands(parsed, taskType);
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
    model:       process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    temperature: 0.2,
    max_tokens:  4096, // Đảm bảo output đủ dài
    messages: [
      { role: "system", content: buildSystemPrompt(taskType) },
      { role: "user",   content: `Prompt:\n${testPrompt}\n\nEssay:\n${content}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  return extractJson(raw, taskType);
}

// ─────────────────────────────────────────────────────────────
// Provider: Gemini
// ─────────────────────────────────────────────────────────────
async function gradeWithGemini(
  content: string,
  testPrompt: string,
  taskType: TaskType,
): Promise<GradingFeedback> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Prompt:\n${testPrompt}\n\nEssay:\n${content}`,
    config: {
      systemInstruction: buildSystemPrompt(taskType),
      temperature: 0.2,
      maxOutputTokens: 4096, // QUAN TRỌNG: Ngăn chặn timeout/lỗi cắt ngang JSON
    },
  });

  return extractJson(response.text || "", taskType);
}

// ─────────────────────────────────────────────────────────────
// Public API
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