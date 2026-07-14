// ============================================================
// GradingFeedback — shape returned by gradeSubmission()
// Must stay in sync with the JSON schema in grader.ts
// ============================================================

export type ErrorType =
  | "lexical_choice"
  | "grammatical_accuracy"
  | "collocation"
  | "word_form"
  | "cohesion"
  | "punctuation";

export type ErrorSeverity = "minor" | "moderate" | "significant";

export interface Correction {
  type: ErrorType;
  severity: ErrorSeverity;
  /** Exact phrase copied from the student's essay */
  original: string;
  /** Corrected version */
  corrected: string;
  /** Vietnamese explanation referencing the relevant band descriptor criterion */
  explanation: string;
  task: "task1" | "task2";
}

export interface CriterionJustifications {
  TA?: string; // Task Achievement (Task 1) — Vietnamese
  CC: string;  // Coherence & Cohesion — Vietnamese
  LR: string;  // Lexical Resource — Vietnamese
  GRA: string; // Grammatical Range & Accuracy — Vietnamese
}

export interface Task2Justifications {
  TR: string;  // Task Response — Vietnamese
  CC: string;
  LR: string;
  GRA: string;
}

export interface Task1Result {
  band: number;
  /** Task Achievement score */
  TA: number;
  CC: number;
  LR: number;
  GRA: number;
  /** Per-criterion justification paragraphs (Vietnamese) */
  justifications: CriterionJustifications & { TA: string };
}

export interface Task2Result {
  band: number;
  /** Task Response score */
  TR: number;
  CC: number;
  LR: number;
  GRA: number;
  justifications: Task2Justifications;
}

export interface PriorityImprovement {
  rank: 1 | 2 | 3;
  category: string;
  /** Concrete actionable advice (Vietnamese) */
  action: string;
  /** e.g. "Addressing this could raise TR from 7.0 to 7.5" (Vietnamese) */
  band_impact: string;
}

export interface ModelSentence {
  /** Exact sentence copied from the student essay */
  candidate_version: string;
  /** Band 8–9 rewrite of the same idea */
  enhanced_version: string;
  /** Vietnamese explanation of each change made */
  changes_explained: string;
}

export interface NextBandRoadmap {
  current_band: number;
  target_band: number;
  /** 2–3 focus areas in Vietnamese */
  key_focus_areas: string[];
}

// ============================================================
// SubmissionRow — a row from the `submissions` Supabase table.
// Used by FeedbackExport and other components that receive the
// full DB record alongside the grading result.
// ============================================================
export interface SubmissionRow {
  id: string;
  student_id: string;
  test_id: string;
  /** Raw essay text submitted by the student */
  content: string;
  /** The IELTS writing prompt / question */
  prompt: string;
  /** Submission status: pending → grading → graded | cancelled */
  status: "pending" | "grading" | "graded" | "cancelled" | "live";
  /** Overall band score (null until graded) */
  band_score: number | null;
  /** Full grading result JSON (null until graded) */
  feedback: GradingFeedback | null;
  /** Student display name (joined from profiles) */
  student_name?: string;
  /** Test title (joined from tests) */
  test_title?: string;
  /** Test type — drives which criteria are shown */
  test_type?: "MOCK_TEST" | "PRACTICE";
  submitted_at: string;   // ISO 8601
  graded_at: string | null;
  created_at: string;
}

export interface GradingFeedback {
  /** Final overall band (weighted: T1 × 1/3, T2 × 2/3), rounded to nearest 0.5 */
  overall_band: number;

  /**
   * 2–3 sentences in English, in the voice of a senior examiner.
   * Leads with the candidate's strongest quality, then names the primary barrier.
   */
  holistic_assessment: string;

  /** null when no Task 1 was submitted */
  task1: Task1Result | null;

  /** null when no Task 2 was submitted */
  task2: Task2Result | null;

  /** 3 specific strengths citing text from the essay (Vietnamese) */
  strengths: string[];

  /** 2 primary weaknesses citing text from the essay (Vietnamese) */
  primary_weaknesses: string[];

  /** Ranked list of 3 actionable improvements */
  priority_improvements: PriorityImprovement[];

  /** Array of 3–8 specific errors, prioritised by band-score impact */
  corrections: Correction[];

  /** A representative sentence rewritten at Band 8–9 level */
  model_sentence: ModelSentence;

  /** What the candidate needs to do to reach the next band */
  next_band_roadmap: NextBandRoadmap;

  // ----------------------------------------------------------
  // Backward-compat: older components may still read this field.
  // The new prompt writes `holistic_assessment` instead.
  // Keep optional so both old and new responses are accepted.
  // ----------------------------------------------------------
  /** @deprecated Use holistic_assessment instead */
  examiner_summary?: string;
}
