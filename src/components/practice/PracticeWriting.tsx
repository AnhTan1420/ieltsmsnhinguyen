"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Sparkles } from "lucide-react";
import type { GradingFeedback } from "@/lib/types";
import { TASK1_MIN_WORDS, TASK2_MIN_WORDS, countWords } from "@/lib/student-test-utils";
import StudentResultPanel from "@/components/test/StudentResultPanel";

type TaskType = "task1" | "task2";
type Draft = { prompt: string; essay: string };

const TASK_META: Record<
  TaskType,
  { label: string; minWords: number; promptPlaceholder: string; essayPlaceholder: string }
> = {
  task1: {
    label: "Writing Task 1",
    minWords: TASK1_MIN_WORDS,
    promptPlaceholder:
      "Dán đề bài Task 1 vào đây (Academic: mô tả biểu đồ/bảng/quy trình/bản đồ, hoặc General Training: đề thư)...",
    essayPlaceholder: "Viết bài làm Task 1 của bạn bằng tiếng Anh...",
  },
  task2: {
    label: "Writing Task 2",
    minWords: TASK2_MIN_WORDS,
    promptPlaceholder: 'Dán đề bài Task 2 vào đây (VD: "Do you agree or disagree that...")...',
    essayPlaceholder: "Viết bài luận Task 2 của bạn bằng tiếng Anh...",
  },
};

const EMPTY_DRAFTS: Record<TaskType, Draft> = {
  task1: { prompt: "", essay: "" },
  task2: { prompt: "", essay: "" },
};

// Trang luyện tập PUBLIC: khác với StudentTest (bài thi thật, có timer, chống
// gian lận, lưu Supabase), component này KHÔNG lưu trữ gì cả — mỗi lượt chấm
// là một request độc lập tới /api/practice/grade, kết quả chỉ tồn tại trên
// state của trình duyệt. Người dùng rời trang là mất, đúng tinh thần "luyện
// tập nháp" chứ không phải một bài thi được ghi nhận.
export default function PracticeWriting() {
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const [drafts, setDrafts] = useState<Record<TaskType, Draft>>(EMPTY_DRAFTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ taskType: TaskType; feedback: GradingFeedback } | null>(null);

  const meta = TASK_META[taskType];
  const draft = drafts[taskType];
  const words = countWords(draft.essay);
  const metMinWords = words >= meta.minWords;
  const progressPct = Math.min(100, Math.round((words / meta.minWords) * 100));

  const canSubmit = draft.prompt.trim().length > 0 && draft.essay.trim().length > 0 && !isSubmitting;

  function updateDraft(patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [taskType]: { ...prev[taskType], ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          prompt: draft.prompt.trim(),
          essay: draft.essay.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setError(data?.error || "Đã có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      setResult({ taskType, feedback: data as GradingFeedback });
    } catch {
      setError("Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePracticeAgain() {
    setResult(null);
    setError(null);
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              IELTS Writing Practice
            </span>
            <h1 className="mt-4 font-serif text-2xl font-bold text-slate-900">
              Kết quả chấm {TASK_META[result.taskType].label}
            </h1>
          </div>

          <StudentResultPanel feedback={result.feedback} />

          <button
            type="button"
            onClick={handlePracticeAgain}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Luyện tập bài khác
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            IELTS Writing Practice
          </span>
          <h1 className="mt-4 font-serif text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">
            Luyện viết &amp; chấm điểm tự động bằng AI
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Không cần đăng nhập. Chọn Task, nhập đề bài và bài làm của bạn để nhận điểm số &amp; nhận xét chi
            tiết theo đúng 4 tiêu chí chấm thi IELTS.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 inline-flex rounded-2xl bg-slate-100 p-1">
            {(Object.keys(TASK_META) as TaskType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTaskType(t)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  taskType === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {TASK_META[t].label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="practice-prompt" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Đề bài ({meta.label})
              </label>
              <textarea
                id="practice-prompt"
                className="min-h-[110px] w-full resize-y rounded-2xl border border-slate-300 p-4 text-[15px] leading-relaxed text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                placeholder={meta.promptPlaceholder}
                value={draft.prompt}
                onChange={(e) => updateDraft({ prompt: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="practice-essay" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Bài làm của bạn
              </label>
              <textarea
                id="practice-essay"
                className="min-h-[280px] w-full resize-y rounded-2xl border border-slate-300 p-4 font-serif text-base leading-[1.9] text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 sm:text-[15px]"
                placeholder={meta.essayPlaceholder}
                value={draft.essay}
                onChange={(e) => updateDraft({ essay: e.target.value })}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
              />

              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                  <span className={`flex items-center gap-1 ${metMinWords ? "text-emerald-600" : "text-slate-600"}`}>
                    {metMinWords && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {words} / {meta.minWords} từ
                  </span>
                  <span className="text-slate-400">
                    {metMinWords ? "Đã đạt yêu cầu tối thiểu" : `Còn thiếu ${meta.minWords - words} từ`}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      metMinWords ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang chấm bài bằng AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Chấm điểm với AI
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
