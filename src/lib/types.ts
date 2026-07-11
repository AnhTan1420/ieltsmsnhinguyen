export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type TestRow = {
  id: string;
  title: string;
  task1_prompt: string;
  task2_prompt: string;
  image_url: string | null;
  duration_minutes: number;
  created_at: string;
};

export type SubmissionStatus = "in_progress" | "completed" | "disqualified";
export type EndReason = "manual" | "timeout" | "disqualified";

export type GradingFeedback = {
  band_score: number;
  mistakes: Array<{
    original: string;
    correction: string;
    explanation: string;
  }>;
  notable_vocabulary: Array<{
    word: string;
    context: string;
    meaning: string;
  }>;
  criteria_feedback: {
    task_response: string;
    coherence_and_cohesion: string;
    lexical_resource: string;
    grammatical_range_and_accuracy: string;
  };
  examiner_summary: string;
};

export type SubmissionRow = {
  id: string;
  test_id: string;
  student_id: string | null;
  student_name: string;
  content: string | null;
  warning_count: number;
  status: SubmissionStatus;
  end_reason: EndReason | null;
  band_score: number | null;
  feedback: GradingFeedback | null;
  started_at: string;
  submitted_at: string | null;
  created_at: string;
  tests?: {
    title: string;
    task1_prompt: string;
    task2_prompt: string;
    duration_minutes: number;
  } | null;
};
